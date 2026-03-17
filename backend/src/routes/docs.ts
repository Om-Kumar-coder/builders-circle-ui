import { Router, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';
import logger from '../utils/logger';

const router = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['admin', 'founder'];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Base upload directory. All stored files live under here.
 * Never expose this path in API responses.
 */
const UPLOAD_BASE = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/docs')
);

// ── Multer configuration ──────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const now = new Date();
    const dest = path.join(
      UPLOAD_BASE,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0')
    );
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, PNG, JPEG`));
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown) {
  return res.json({ success: true, data, error: null });
}
function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, data: null, error });
}

/**
 * Resolve an absolute filePath and verify it stays within UPLOAD_BASE.
 * Returns null if the path escapes the base directory (traversal guard).
 */
function safeResolvePath(filePath: string): string | null {
  // filePath is already absolute (stored that way on upload)
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOAD_BASE + path.sep) && resolved !== UPLOAD_BASE) {
    return null;
  }
  return resolved;
}

async function logActivity(
  userId: string,
  documentId: string,
  action: string,
  req: AuthRequest
) {
  await prisma.documentActivity.create({
    data: {
      userId,
      documentId,
      action,
      metadata: JSON.stringify({ ip: req.ip, userAgent: req.get('User-Agent') }),
    },
  });
}

async function getActiveAccess(userId: string, documentId: string) {
  return prisma.documentAccess.findFirst({
    where: {
      userId,
      documentId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
}

/** Strip internal storage fields before sending to client */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeDoc(doc: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { filePath, ...safe } = doc;
  return safe;
}

// ── Folder routes ─────────────────────────────────────────────────────────────

router.get('/folders', authMiddleware, async (_req, res: Response) => {
  const folders = await prisma.docFolder.findMany({
    orderBy: { name: 'asc' },
    include: { children: { orderBy: { name: 'asc' } } },
  });
  return ok(res, folders);
});

router.post(
  '/folders',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  async (req: AuthRequest, res: Response) => {
    const { name, parentId } = z
      .object({ name: z.string().min(1), parentId: z.string().optional() })
      .parse(req.body);
    const folder = await prisma.docFolder.create({ data: { name, parentId } });
    return ok(res, folder);
  }
);

// ── Document list / metadata ──────────────────────────────────────────────────

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { folderId, label, search } = req.query as Record<string, string>;
  const isAdmin = ADMIN_ROLES.includes(req.user!.role);

  const where: Record<string, unknown> = { isActive: true };
  if (folderId) where.folderId = folderId;
  if (label) where.securityLabel = label;
  if (search) where.title = { contains: search };

  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      folder: { select: { id: true, name: true } },
      creator: { select: { id: true, email: true, name: true } },
      _count: { select: { versions: true } },
    },
  });

  if (!isAdmin) {
    const userId = req.user!.id;
    const accessRecords = await prisma.documentAccess.findMany({
      where: { userId, documentId: { in: docs.map((d) => d.id) }, revokedAt: null },
    });
    const accessMap = new Map(accessRecords.map((a) => [a.documentId, a]));

    const enriched = docs.map((doc) => {
      const access = accessMap.get(doc.id);
      const expired = access?.expiresAt && access.expiresAt < new Date();
      return {
        ...sanitizeDoc(doc),
        access: access && !expired
          ? { type: access.accessType, expiresAt: access.expiresAt }
          : null,
      };
    });
    return ok(res, enriched);
  }

  return ok(res, docs.map(sanitizeDoc));
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const doc = await prisma.document.findUnique({
    where: { id, isActive: true },
    include: {
      folder: true,
      creator: { select: { id: true, email: true, name: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: { id: true, versionNumber: true, uploadedBy: true, createdAt: true },
      },
    },
  });
  if (!doc) return fail(res, 404, 'Document not found');

  const isAdmin = ADMIN_ROLES.includes(req.user!.role);
  if (!isAdmin) {
    const access = await getActiveAccess(req.user!.id, doc.id);
    if (!access) return fail(res, 403, 'Access denied');
    return ok(res, {
      ...sanitizeDoc(doc),
      access: { type: access.accessType, expiresAt: access.expiresAt },
    });
  }

  return ok(res, sanitizeDoc(doc));
});

// ── Secure file streaming ─────────────────────────────────────────────────────

router.get('/view/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = await prisma.document.findUnique({ where: { id, isActive: true } });
    if (!doc) return fail(res, 404, 'Document not found');

    const isAdmin = ADMIN_ROLES.includes(req.user!.role);
    if (!isAdmin) {
      const access = await getActiveAccess(req.user!.id, doc.id);
      if (!access) {
        await logActivity(req.user!.id, doc.id, 'view_denied', req);
        return fail(res, 403, 'Access denied or expired');
      }
    }

    await logActivity(req.user!.id, doc.id, 'view', req);

    const filePath = safeResolvePath(doc.filePath);
    if (!filePath) {
      logger.error(`Path traversal attempt blocked for doc ${doc.id}`);
      return fail(res, 400, 'Invalid file path');
    }
    if (!fs.existsSync(filePath)) {
      logger.error(`Doc file missing on disk: ${filePath}`);
      return fail(res, 404, 'File not found on server');
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    logger.error('Doc view error', err);
    return fail(res, 500, 'Failed to stream document');
  }
});

router.get('/download/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = await prisma.document.findUnique({ where: { id, isActive: true } });
    if (!doc) return fail(res, 404, 'Document not found');

    const isAdmin = ADMIN_ROLES.includes(req.user!.role);
    if (!isAdmin) {
      const access = await getActiveAccess(req.user!.id, doc.id);
      if (!access || access.accessType !== 'download') {
        await logActivity(req.user!.id, doc.id, 'download_denied', req);
        return fail(res, 403, 'Download access not granted');
      }
    }

    await logActivity(req.user!.id, doc.id, 'download', req);

    const filePath = safeResolvePath(doc.filePath);
    if (!filePath) return fail(res, 400, 'Invalid file path');
    if (!fs.existsSync(filePath)) return fail(res, 404, 'File not found on server');

    const ext = path.extname(doc.filePath);
    const safeTitle = doc.title.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}${ext}"`);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'no-store');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    logger.error('Doc download error', err);
    return fail(res, 500, 'Failed to download document');
  }
});

// ── File upload (admin) ───────────────────────────────────────────────────────

/**
 * POST /api/docs/upload
 * Multipart form-data fields:
 *   file          — the file (required)
 *   title         — document title (required)
 *   securityLabel — internal | restricted | confidential (optional, default: internal)
 *   folderId      — folder id (optional)
 */
router.post(
  '/upload',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  (req: AuthRequest, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return fail(res, 413, 'File exceeds 20 MB limit');
        }
        return fail(res, 400, err.message);
      }
      if (err) return fail(res, 400, err.message);
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) return fail(res, 400, 'No file uploaded');

      const { title, securityLabel, folderId } = z
        .object({
          title: z.string().min(1),
          securityLabel: z.enum(['internal', 'restricted', 'confidential']).default('internal'),
          folderId: z.string().optional(),
        })
        .parse(req.body);

      const doc = await prisma.document.create({
        data: {
          title,
          filePath: req.file.path,   // absolute path on disk
          mimeType: req.file.mimetype,
          size: req.file.size,
          securityLabel,
          folderId: folderId || null,
          createdBy: req.user!.id,
          versions: {
            create: {
              filePath: req.file.path,
              mimeType: req.file.mimetype,
              versionNumber: 1,
              uploadedBy: req.user!.id,
            },
          },
        },
      });

      logger.info(`Doc uploaded: ${doc.id} by ${req.user!.id}`);
      return ok(res, sanitizeDoc(doc));
    } catch (err) {
      // Clean up uploaded file on DB error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      logger.error('Doc upload error', err);
      return fail(res, 500, 'Upload failed');
    }
  }
);

// ── Version upload (admin) ────────────────────────────────────────────────────

/**
 * POST /api/docs/version
 * Multipart form-data fields:
 *   file       — the new version file (required)
 *   documentId — target document id (required)
 */
router.post(
  '/version',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  (req: AuthRequest, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'File exceeds 20 MB limit');
        return fail(res, 400, err.message);
      }
      if (err) return fail(res, 400, err.message);
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) return fail(res, 400, 'No file uploaded');

      const { documentId } = z
        .object({ documentId: z.string().min(1) })
        .parse(req.body);

      const existing = await prisma.document.findUnique({ where: { id: documentId } });
      if (!existing) {
        fs.unlinkSync(req.file.path);
        return fail(res, 404, 'Document not found');
      }

      const latest = await prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVersion = (latest?.versionNumber ?? 0) + 1;

      const version = await prisma.documentVersion.create({
        data: {
          documentId,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          versionNumber: nextVersion,
          uploadedBy: req.user!.id,
        },
      });

      // Update document to point at new file
      await prisma.document.update({
        where: { id: documentId },
        data: {
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });

      await logActivity(req.user!.id, documentId, 'upload_version', req);
      logger.info(`Doc version ${nextVersion} uploaded for ${documentId}`);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { filePath: _fp, ...safeVersion } = version;
      return ok(res, safeVersion);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      logger.error('Doc version upload error', err);
      return fail(res, 500, 'Version upload failed');
    }
  }
);

// ── Access request ────────────────────────────────────────────────────────────

router.post('/request-access', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { documentId, reason, requestedDays } = z
    .object({
      documentId: z.string(),
      reason: z.string().min(5),
      requestedDays: z.number().int().min(1).max(365).optional(),
    })
    .parse(req.body);

  const doc = await prisma.document.findUnique({ where: { id: documentId, isActive: true } });
  if (!doc) return fail(res, 404, 'Document not found');

  await logActivity(req.user!.id, documentId, 'request_access', req);

  const admins = await prisma.userProfile.findMany({
    where: { role: { in: ADMIN_ROLES } },
    select: { userId: true },
  });
  await Promise.all(
    admins.map((a) =>
      NotificationService.createNotification(
        a.userId,
        'doc_access_request',
        `${req.user!.email} requested access to "${doc.title}"`,
        { documentId, requesterId: req.user!.id, reason, requestedDays }
      )
    )
  );

  return ok(res, { message: 'Access request submitted' });
});

// ── Admin: grant / revoke access ──────────────────────────────────────────────

router.post(
  '/grant-access',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  async (req: AuthRequest, res: Response) => {
    const { userId, documentId, accessType, expiresInDays } = z
      .object({
        userId: z.string(),
        documentId: z.string(),
        accessType: z.enum(['view', 'download']).default('view'),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(req.body);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;

    await prisma.documentAccess.updateMany({
      where: { userId, documentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const grant = await prisma.documentAccess.create({
      data: { userId, documentId, accessType, expiresAt, grantedBy: req.user!.id },
    });

    await logActivity(req.user!.id, documentId, 'grant_access', req);

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    await NotificationService.createNotification(
      userId,
      'doc_access_granted',
      `You have been granted ${accessType} access to "${doc?.title}"`,
      { documentId, accessType, expiresAt: expiresAt?.toISOString() }
    );

    return ok(res, grant);
  }
);

router.post(
  '/revoke-access',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  async (req: AuthRequest, res: Response) => {
    const { userId, documentId } = z
      .object({ userId: z.string(), documentId: z.string() })
      .parse(req.body);

    await prisma.documentAccess.updateMany({
      where: { userId, documentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity(req.user!.id, documentId, 'revoke_access', req);

    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    await NotificationService.createNotification(
      userId,
      'doc_access_revoked',
      `Your access to "${doc?.title}" has been revoked`,
      { documentId }
    );

    return ok(res, { message: 'Access revoked' });
  }
);

// ── Admin: update metadata ────────────────────────────────────────────────────

router.patch(
  '/:id',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, folderId, securityLabel, isActive } = z
      .object({
        title: z.string().optional(),
        folderId: z.string().nullable().optional(),
        securityLabel: z.enum(['internal', 'restricted', 'confidential']).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);

    const doc = await prisma.document.update({
      where: { id },
      data: { title, folderId, securityLabel, isActive },
    });
    return ok(res, sanitizeDoc(doc));
  }
);

// ── Audit / access log (admin) ────────────────────────────────────────────────

router.get(
  '/:id/activity',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const activity = await prisma.documentActivity.findMany({
      where: { documentId: id },
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return ok(res, activity);
  }
);

router.get(
  '/:id/access',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const grants = await prisma.documentAccess.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        granter: { select: { id: true, email: true, name: true } },
      },
    });
    return ok(res, grants);
  }
);

export default router;
