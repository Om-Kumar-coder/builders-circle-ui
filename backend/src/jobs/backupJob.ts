import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(process.cwd(), 'backups');

const RETENTION_COUNT = 7;

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  sizeBytes?: number;
  driveFileId?: string;
  driveUploaded?: boolean;
  error?: string;
  timestamp: string;
}

// ── Parse DATABASE_URL into pg_dump env vars ──────────────────────────────────
function parseDatabaseUrl(url: string): Record<string, string> | null {
  try {
    // postgresql://user:pass@host:port/dbname
    const u = new URL(url);
    if (!['postgresql:', 'postgres:'].includes(u.protocol)) return null;
    return {
      PGHOST:     u.hostname,
      PGPORT:     u.port || '5432',
      PGUSER:     decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password),
      PGDATABASE: u.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

// ── Google Drive upload ───────────────────────────────────────────────────────
async function uploadToDrive(filePath: string, fileName: string): Promise<string | null> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId     = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { google } = require('googleapis') as any;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: 'application/octet-stream', body: fs.createReadStream(filePath) },
      fields: 'id',
    });
    return response.data.id ?? null;
  } catch (err) {
    logger.error(`Google Drive upload failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Main backup job ───────────────────────────────────────────────────────────
export class BackupJob {
  static async run(): Promise<BackupResult> {
    const timestamp = new Date().toISOString();
    const dbUrl = process.env.DATABASE_URL ?? '';
    const pgEnv = parseDatabaseUrl(dbUrl);

    if (!pgEnv) {
      const error = 'DATABASE_URL is not a valid PostgreSQL URL — backup skipped';
      logger.warn(error);
      await BackupJob._log('backup_skipped', 'WARNING', error);
      return { success: false, error, timestamp };
    }

    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });

      const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `backup-${dateTag}.sql`;
      const destPath = path.join(BACKUP_DIR, fileName);

      // Run pg_dump
      execSync(`pg_dump -Fp -f "${destPath}"`, {
        env: { ...process.env, ...pgEnv },
        stdio: 'pipe',
      });

      const { size } = fs.statSync(destPath);
      BackupJob._pruneOldBackups();

      // Google Drive upload (best-effort)
      const driveFileId = await uploadToDrive(destPath, fileName);
      const driveUploaded = driveFileId !== null;

      const msg = driveUploaded
        ? `Backup created: ${fileName} (${(size / 1024).toFixed(1)} KB) — uploaded to Google Drive`
        : `Backup created: ${fileName} (${(size / 1024).toFixed(1)} KB)`;

      logger.info(msg);
      await BackupJob._log('backup_completed', 'INFO', msg, {
        fileName, sizeBytes: size, driveFileId: driveFileId ?? undefined,
      });

      return { success: true, filePath: destPath, fileName, sizeBytes: size, driveFileId: driveFileId ?? undefined, driveUploaded, timestamp };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`Backup failed: ${error}`);
      await BackupJob._log('backup_failed', 'ERROR', `Backup failed: ${error}`);
      return { success: false, error, timestamp };
    }
  }

  static listBackups(): { fileName: string; sizeBytes: number; createdAt: string }[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs
      .readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && (f.endsWith('.sql') || f.endsWith('.db')))
      .map(f => {
        const full = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(full);
        return { fileName: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private static _pruneOldBackups() {
    const all = BackupJob.listBackups();
    for (const f of all.slice(RETENTION_COUNT)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f.fileName)); } catch { /* best-effort */ }
    }
  }

  private static async _log(event: string, severity: string, message: string, meta?: object) {
    try {
      await prisma.systemLog.create({
        data: { event, severity, message, metadata: meta ? JSON.stringify(meta) : null },
      });
    } catch { /* don't let logging failure break the backup */ }
  }
}
