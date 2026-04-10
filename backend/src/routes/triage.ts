import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { assignStarterTasks } from '../services/starterTaskService';
import { auditLog } from '../services/integrityService';
import { env } from '../config/env';
import { EmailService } from '../services/emailService';
// Standardized token expiry (24h) — used for both signup and triage
const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000;

const router = Router();

// 3 submissions per IP per hour
const triageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, data: null, error: 'Too many submissions. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submitSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  roleType: z.enum(['dev', 'business', 'marketing', 'design', 'other']),
  submissionType: z.enum(['join', 'project', 'other']),
  description: z.string().min(50).max(2000),
  proofLinks: z.array(z.string().url().startsWith('https://')).max(5).optional(),
  availability: z.string().max(200).optional(),
});

async function mapRoleToGroup(roleType: string) {
  // Try exact name match first
  const group = await prisma.group.findFirst({
    where: { name: { equals: roleType } },
  });
  if (group) return group;

  // Fall back to default group
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } });
  if (defaultGroup) return defaultGroup;

  // Last resort: any group
  const anyGroup = await prisma.group.findFirst();
  if (anyGroup) return anyGroup;

  throw new Error('No groups configured. Please create at least one group in the admin panel.');
}

// POST /api/triage/submit — public
router.post('/submit', triageLimiter, async (req: Request, res: Response) => {
  try {
    const data = submitSchema.parse(req.body);

    // ISSUE 6: reject if a PENDING submission already exists for this email
    // (the DB partial unique index enforces this, but we give a friendly error first)
    const existingPending = await prisma.triageSubmission.findFirst({
      where: { email: data.email, status: 'PENDING' },
    });
    if (existingPending) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'A pending application for this email already exists. Please wait for review.',
      });
    }

    const submission = await prisma.triageSubmission.create({
      data: {
        name: data.name,
        email: data.email,
        roleType: data.roleType,
        submissionType: data.submissionType,
        description: data.description,
        proofLinks: data.proofLinks ? JSON.stringify(data.proofLinks) : '[]',
        availability: data.availability,
      },
    });

    // Auto-create GatekeeperReview and trigger async Veronica scan
    const reviewId = `intake-${submission.id}`;
    await prisma.gatekeeperReview.create({
      data: {
        id: reviewId,
        entityType: 'user_intake',
        entityId: submission.id,
        queue: 'new_users',
        status: 'PENDING',
      },
    });

    // Fire-and-forget Veronica scan (non-blocking)
    import('../services/veronicaService').then(({ reviewUserIntake }) =>
      reviewUserIntake({
        name: data.name,
        email: data.email,
        roleType: data.roleType,
        description: data.description,
        proofLinks: data.proofLinks ? JSON.stringify(data.proofLinks) : undefined,
        availability: data.availability,
      }).then(result =>
        prisma.gatekeeperReview.update({
          where: { id: reviewId },
          data: {
            status: result.status,
            veronicaScore: result.score,
            veronicaFlags: JSON.stringify(result.flags),
            veronicaNotes: result.notes,
            updatedAt: new Date(),
          },
        })
      ).catch(() => {}) // never crash the request
    ).catch(() => {});

    res.status(201).json({ success: true, data: { id: submission.id, status: 'PENDING' }, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    // ISSUE 6: handle DB-level unique constraint violation gracefully
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ success: false, data: null, error: 'A pending application for this email already exists.' });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to submit application' });
  }
});

// GET /api/admin/triage — list submissions
router.get('/admin', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {};
    const submissions = await prisma.triageSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with Veronica review data
    const parsed = await Promise.all(submissions.map(async (s) => {
      const review = await prisma.gatekeeperReview.findUnique({
        where: { id: `intake-${s.id}` },
        select: { status: true, veronicaScore: true, veronicaFlags: true, veronicaNotes: true },
      });
      return {
        ...s,
        proofLinks: s.proofLinks ? JSON.parse(s.proofLinks) : [],
        veronicaReview: review
          ? { ...review, veronicaFlags: review.veronicaFlags ? JSON.parse(review.veronicaFlags) : [] }
          : null,
      };
    }));

    res.json({ success: true, data: parsed, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch submissions' });
  }
});

// POST /api/admin/triage/sync-sheet — must be before /:id routes to avoid param collision
router.post('/admin/sync-sheet', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: AuthRequest, res: Response) => {
  try {
    const sheetId = env.GOOGLE_SHEET_ID ?? process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      return res.status(503).json({ success: false, data: null, error: 'GOOGLE_SHEET_ID not configured' });
    }

    // gviz/tq works with "anyone with the link" — no publish-to-web required
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Sheet1`;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return res.status(502).json({ success: false, data: null, error: 'Failed to fetch sheet. Ensure it is shared with "Anyone with the link".' });
    }

    const csv = await response.text();
    const lines = csv.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
    if (lines.length < 2) {
      return res.json({ success: true, data: { imported: 0, skipped: 0 }, error: null });
    }

    const headers = parseCsvLine(lines[0]);
    const col = (row: string[], name: string) => {
      const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      return idx >= 0 ? (row[idx] ?? '').trim() : '';
    };

    let imported = 0;
    let skipped = 0;

    for (const line of lines.slice(1)) {
      const row = parseCsvLine(line);
      const email = col(row, 'email');
      if (!email || !email.includes('@')) { skipped++; continue; }

      const existing = await prisma.triageSubmission.findFirst({ where: { email } });
      if (existing) { skipped++; continue; }

      const name = col(row, 'full name') || col(row, 'name') || col(row, 'digital signature') || 'Unknown';
      const engagement = col(row, 'engaging');
      const primaryRole = col(row, 'primary role') || col(row, 'intended role');
      const techStack = col(row, 'tech stack') || col(row, 'tools');
      const experience = col(row, 'years of experience') || col(row, 'experience');
      const availability = col(row, 'availability') || col(row, 'hours');
      const country = col(row, 'country') || col(row, 'time zone');
      const startDate = col(row, 'start');
      const whatsapp = col(row, 'whatsapp') || col(row, 'telegram');

      const descParts = [
        engagement && `Engagement: ${engagement}`,
        primaryRole && `Role: ${primaryRole}`,
        experience && `Experience: ${experience}`,
        techStack && `Tech stack: ${techStack}`,
        country && `Location: ${country}`,
        startDate && `Can start: ${startDate}`,
        whatsapp && `Contact: ${whatsapp}`,
      ].filter(Boolean);
      const description = descParts.length
        ? descParts.join('. ')
        : `Interest form submission from ${name}.`;

      await prisma.triageSubmission.create({
        data: {
          name,
          email,
          roleType: guessRoleType(engagement, primaryRole),
          submissionType: 'join',
          description: description.length < 50 ? description.padEnd(50, '.') : description,
          availability: availability || null,
          proofLinks: '[]',
        },
      });
      // Auto-create GatekeeperReview for sheet-synced entries (fire-and-forget Veronica scan)
      const syncedSubmission = await prisma.triageSubmission.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
      if (syncedSubmission) {
        const reviewId = `intake-${syncedSubmission.id}`;
        prisma.gatekeeperReview.create({
          data: { id: reviewId, entityType: 'user_intake', entityId: syncedSubmission.id, queue: 'new_users', status: 'PENDING' },
        }).then(() =>
          import('../services/veronicaService').then(({ reviewUserIntake }) =>
            reviewUserIntake({ name, email, roleType: guessRoleType(engagement, primaryRole), description: syncedSubmission.description })
              .then(result => prisma.gatekeeperReview.update({
                where: { id: reviewId },
                data: { status: result.status, veronicaScore: result.score, veronicaFlags: JSON.stringify(result.flags), veronicaNotes: result.notes, updatedAt: new Date() },
              }))
          )
        ).catch(() => {});
      }
      imported++;
    }

    res.json({ success: true, data: { imported, skipped }, error: null });
  } catch (err) {
    console.error('Sheet sync error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to sync sheet' });
  }
});

// GET /api/admin/triage/:id
router.get('/admin/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {  try {
    const submission = await prisma.triageSubmission.findUnique({ where: { id: req.params.id as string } });
    if (!submission) return res.status(404).json({ success: false, data: null, error: 'Not found' });
    res.json({ success: true, data: { ...submission, proofLinks: submission.proofLinks ? JSON.parse(submission.proofLinks) : [] }, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch submission' });
  }
});

// POST /api/admin/triage/:id/approve
router.post('/admin/:id/approve', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const submission = await prisma.triageSubmission.findUniqueOrThrow({ where: { id: req.params.id as string } });

    if (submission.status !== 'PENDING') {
      return res.status(400).json({ success: false, data: null, error: 'Submission already reviewed' });
    }

    // Allow admin to override the assigned role at approval time
    const { role: overrideRole } = z.object({ role: z.string().optional() }).parse(req.body);
    const effectiveRoleType = overrideRole ?? submission.roleType;

    const group = await mapRoleToGroup(effectiveRoleType).catch((e: Error) => {
      throw Object.assign(e, { status: 500 });
    });

    // if user already exists, link them instead of creating a duplicate
    let user = await prisma.user.findUnique({ where: { email: submission.email } });
    let isExistingUser = false;
    let verifyToken: string;

    if (user) {
      // Link existing user to the correct group if not already assigned
      isExistingUser = true;
      verifyToken = crypto.randomBytes(32).toString('hex');
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          groupId: user.groupId ?? group.id,
          emailVerifyToken: verifyToken,
          emailVerifyExpiry: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
        },
      });
    } else {
      verifyToken = crypto.randomBytes(32).toString('hex');
      // Map roleType to a valid user profile role
      const profileRole = ['admin', 'founder', 'contributor', 'employee', 'observer'].includes(effectiveRoleType)
        ? effectiveRoleType as 'admin' | 'founder' | 'contributor' | 'employee' | 'observer'
        : 'contributor';
      user = await prisma.user.create({
        data: {
          email: submission.email,
          name: submission.name,
          password: '',
          emailVerified: false,
          emailVerifyToken: verifyToken,
          emailVerifyExpiry: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
          onboardingStep: 0,
          onboardingCompleted: false,
          groupId: group.id,
          profile: { create: { role: profileRole } },
        },
      });
    }

    // Send approval + verification email (non-blocking)
    sendTriageApprovalEmail(submission.email, submission.name, verifyToken).catch(() => {});

    await assignStarterTasks(user.id, group.id);

    await prisma.triageSubmission.update({
      where: { id: submission.id },
      data: { status: 'APPROVED', reviewedBy: req.user!.id, reviewedAt: new Date() },
    });

    // ISSUE 10: structured audit log
    await auditLog(req.user!.id, 'triage_approved', 'triage', submission.id, [user.id], {
      createdUserId: user.id,
      email: submission.email,
      groupId: group.id,
      isExistingUser,
    });

    res.json({ success: true, data: { userId: user.id, groupId: group.id, isExistingUser }, error: null });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status ?? 500).json({ success: false, data: null, error: e.message ?? 'Failed to approve submission' });
  }
});

// POST /api/admin/triage/:id/reject
router.post('/admin/:id/reject', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body);
    const submission = await prisma.triageSubmission.findUniqueOrThrow({ where: { id: req.params.id as string } });

    if (submission.status !== 'PENDING') {
      return res.status(400).json({ success: false, data: null, error: 'Submission already reviewed' });
    }

    await prisma.triageSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'REJECTED',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        rejectionNote: note ?? null,
      },
    });

    // Send rejection email (non-blocking)
    sendTriageRejectionEmail(submission.email, submission.name, note).catch(() => {});

    // ISSUE 10: audit log rejection
    await auditLog(req.user!.id, 'triage_rejected', 'triage', submission.id, [], {
      email: submission.email,
      note: note ?? null,
    });

    res.json({ success: true, data: null, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to reject submission' });
  }
});

// ── Google Sheet / Form sync ──────────────────────────────────────────────────

// Helper: parse a CSV line respecting quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim()); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function guessRoleType(engagement: string, primaryRole: string): string {
  const combined = `${engagement} ${primaryRole}`.toLowerCase();
  if (combined.includes('invest')) return 'business';
  if (combined.includes('dev') || combined.includes('tech') || combined.includes('engineer')) return 'dev';
  if (combined.includes('market')) return 'marketing';
  if (combined.includes('design')) return 'design';
  if (combined.includes('business') || combined.includes('product') || combined.includes('operat')) return 'business';
  return 'other';
}


// ── Email helpers ─────────────────────────────────────────────────────────────

async function sendTriageApprovalEmail(email: string, name: string, token: string) {
  const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  const { Resend } = await import('resend');
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'Builders Circle <noreply@triagebuilders.com>',
    to: email,
    subject: 'Your application has been approved – Builders Circle',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;border-radius:12px">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:700;color:#6366f1">Builder's Circle</span>
        </div>
        <h2 style="margin:0 0 16px;font-size:20px;color:#111">Application Approved 🎉</h2>
        <p style="color:#374151">Hi ${name ?? 'there'},</p>
        <p style="color:#374151">Your application to join Builder's Circle has been approved. Click the button below to verify your email and set up your account.</p>
        <a href="${verifyLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email &amp; Get Started
        </a>
        <p style="color:#9ca3af;font-size:13px">This link expires in 24 hours. Or copy: ${verifyLink}</p>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">This is an automated message from Builder's Circle. Do not reply to this email.</p>
      </div>
    `,
  });
}

async function sendTriageRejectionEmail(email: string, name: string, note?: string | null) {
  const { Resend } = await import('resend');
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'Builders Circle <noreply@triagebuilders.com>',
    to: email,
    subject: 'Your Builder\'s Circle application – update',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;border-radius:12px">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:700;color:#6366f1">Builder's Circle</span>
        </div>
        <h2 style="margin:0 0 16px;font-size:20px;color:#111">Application Update</h2>
        <p style="color:#374151">Hi ${name ?? 'there'},</p>
        <p style="color:#374151">Thank you for your interest in Builder's Circle. After reviewing your application, we are unable to move forward at this time.</p>
        ${note ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb"><p style="color:#374151;margin:0;font-size:14px"><strong>Reviewer note:</strong> ${note}</p></div>` : ''}
        <p style="color:#374151">You are welcome to reapply in the future. If you have questions, please contact support.</p>
        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">This is an automated message from Builder's Circle. Do not reply to this email.</p>
      </div>
    `,
  });
}

export { mapRoleToGroup };
export default router;
