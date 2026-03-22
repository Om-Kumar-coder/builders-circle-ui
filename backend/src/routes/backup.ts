import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { BackupJob } from '../jobs/backupJob';
import path from 'path';
import fs from 'fs';

const router = Router();

// Resolve log path relative to the backend process, not cwd (fixes Docker/PM2 issues)
const LOG_PATH = path.resolve(__dirname, '../../logs/combined.log');

function tailFile(filePath: string, maxLines = 300): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
}

interface LogEntry { level?: string; message?: string; timestamp?: string }
function parseLogLine(line: string): LogEntry | null {
  try { return JSON.parse(line); } catch { return null; }
}

// ── GET /api/admin/backup/status ──────────────────────────────────────────────
router.get('/status', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();

    // DB health
    const [userCount, activityCount, cycleCount, systemLogCount] = await Promise.all([
      prisma.user.count(),
      prisma.activityEvent.count(),
      prisma.buildCycle.count(),
      prisma.systemLog.count(),
    ]);

    // Real backup status — read actual backup files on disk
    const backupFiles = BackupJob.listBackups();
    const latestFile = backupFiles[0] ?? null;

    // Cross-reference with SystemLog for the last backup event
    const lastBackupLog = await prisma.systemLog.findFirst({
      where: { event: { in: ['backup_completed', 'backup_failed'] } },
      orderBy: { timestamp: 'desc' },
    });

    let lastBackupTime: string | null = latestFile?.createdAt ?? lastBackupLog?.timestamp.toISOString() ?? null;
    let lastBackupStatus: 'success' | 'failed' | 'unknown' = 'unknown';

    if (latestFile) {
      // Trust the file on disk — if it exists, the last backup succeeded
      lastBackupStatus = 'success';
    } else if (lastBackupLog) {
      lastBackupStatus = lastBackupLog.event === 'backup_failed' ? 'failed' : 'unknown';
    }

    // Winston log — errors only (log path is now resolved from __dirname)
    const rawLines = tailFile(LOG_PATH, 300);
    const parsed = rawLines.map(parseLogLine).filter((l): l is LogEntry => l !== null);
    const serverStarts = parsed.filter(l => l.message?.includes('Server running'));
    const errorLines = parsed.filter(l => l.level === 'error');
    const lastStart = serverStarts.at(-1);

    // Critical errors last 24h
    const criticalErrors = await prisma.systemLog.count({
      where: {
        severity: 'CRITICAL',
        timestamp: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    // Recovery readiness: DB reachable + at least one valid backup file exists
    const recoveryReady = backupFiles.length > 0 && criticalErrors === 0;

    const driveConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_FOLDER_ID);

    // Check if last backup was uploaded to Drive
    const lastDriveLog = await prisma.systemLog.findFirst({
      where: { event: 'backup_completed', metadata: { contains: 'driveFileId' } },
      orderBy: { timestamp: 'desc' },
    });
    const driveLastUploaded = lastDriveLog?.timestamp.toISOString() ?? null;

    res.json({
      success: true,
      data: {
        lastBackupTime,
        lastBackupStatus,
        recoveryReady,
        uptimeSince: lastStart?.timestamp ?? null,
        backupFiles: backupFiles.slice(0, 5),
        totalBackups: backupFiles.length,
        driveConfigured,
        driveLastUploaded,
        dbHealth: {
          connected: true,
          userCount,
          activityCount,
          cycleCount,
          systemLogCount,
        },
        recentErrors: errorLines.slice(-5).map(e => ({
          message: e.message ?? '',
          timestamp: e.timestamp ?? '',
        })),
        criticalErrorsLast24h: criticalErrors,
        checkedAt: now.toISOString(),
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch backup status',
    });
  }
});

// ── POST /api/admin/backup/trigger ────────────────────────────────────────────
router.post('/trigger', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await BackupJob.run();
    if (result.success) {
      res.json({ success: true, data: result, error: null });
    } else {
      res.status(500).json({ success: false, data: result, error: result.error ?? 'Backup failed' });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Backup trigger failed',
    });
  }
});

export default router;
