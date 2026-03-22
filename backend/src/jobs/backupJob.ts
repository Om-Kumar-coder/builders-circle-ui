import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(process.cwd(), 'backups');

const DB_PATH = (() => {
  const url = process.env.DATABASE_URL ?? '';
  const match = url.match(/^file:(.+)$/);
  if (!match) return null;
  const p = match[1];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
})();

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

// ── Google Drive upload via OAuth2 (uploads to user's personal Drive) ────────
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
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(filePath),
      },
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

    if (!DB_PATH) {
      const error = 'DATABASE_URL is not a SQLite file path — backup skipped';
      logger.warn(error);
      await BackupJob._log('backup_skipped', 'WARNING', error);
      return { success: false, error, timestamp };
    }

    if (!fs.existsSync(DB_PATH)) {
      const error = `Database file not found at ${DB_PATH}`;
      logger.error(error);
      await BackupJob._log('backup_failed', 'ERROR', error);
      return { success: false, error, timestamp };
    }

    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });

      const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `backup-${dateTag}.db`;
      const destPath = path.join(BACKUP_DIR, fileName);

      // 1. Local copy
      fs.copyFileSync(DB_PATH, destPath);
      const { size } = fs.statSync(destPath);

      BackupJob._pruneOldBackups();

      // 2. Google Drive upload (best-effort — local backup is already done)
      const driveFileId = await uploadToDrive(destPath, fileName);
      const driveUploaded = driveFileId !== null;

      const msg = driveUploaded
        ? `Backup created: ${fileName} (${(size / 1024).toFixed(1)} KB) — uploaded to Google Drive`
        : `Backup created: ${fileName} (${(size / 1024).toFixed(1)} KB)`;

      logger.info(msg);
      await BackupJob._log('backup_completed', 'INFO', msg, {
        fileName,
        sizeBytes: size,
        driveFileId: driveFileId ?? undefined,
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
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
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
