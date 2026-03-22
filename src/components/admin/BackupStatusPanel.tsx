'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Database, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, Clock, Server, ShieldCheck, Play, HardDrive, Cloud,
} from 'lucide-react';

interface BackupFile {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

interface BackupStatus {
  lastBackupTime: string | null;
  lastBackupStatus: 'success' | 'failed' | 'unknown';
  recoveryReady: boolean;
  uptimeSince: string | null;
  backupFiles: BackupFile[];
  totalBackups: number;
  driveConfigured: boolean;
  driveLastUploaded: string | null;
  dbHealth: {
    connected: boolean;
    userCount: number;
    activityCount: number;
    cycleCount: number;
    systemLogCount: number;
  };
  recentErrors: { message: string; timestamp: string }[];
  criticalErrorsLast24h: number;
  checkedAt: string;
}

function fmt(iso: string | null) {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIcon({ status }: { status: 'success' | 'failed' | 'unknown' }) {
  if (status === 'success') return <CheckCircle className="w-5 h-5 text-green-400" />;
  if (status === 'failed') return <XCircle className="w-5 h-5 text-red-400" />;
  return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
}

function StatusLabel({ status }: { status: 'success' | 'failed' | 'unknown' }) {
  const map = { success: 'text-green-400', failed: 'text-red-400', unknown: 'text-yellow-400' };
  return <span className={`text-sm font-semibold capitalize ${map[status]}`}>{status}</span>;
}

export default function BackupStatusPanel() {
  const [data, setData] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getBackupStatus();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load backup status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const result = await apiClient.triggerBackup();
      if (result.success) {
        setTriggerMsg({ ok: true, text: `Backup created: ${result.fileName} (${fmtBytes(result.sizeBytes ?? 0)})` });
        await load();
      } else {
        setTriggerMsg({ ok: false, text: result.error ?? 'Backup failed' });
      }
    } catch (e: unknown) {
      setTriggerMsg({ ok: false, text: e instanceof Error ? e.message : 'Backup trigger failed' });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Backup &amp; Recovery</h2>
            <p className="text-xs text-gray-500">PostgreSQL dump · daily at 1 AM · last 7 retained</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTrigger}
            disabled={triggering || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 border border-indigo-600 rounded-lg text-white text-xs transition-colors disabled:opacity-50"
            aria-label="Run backup now"
          >
            <Play className={`w-3.5 h-3.5 ${triggering ? 'animate-pulse' : ''}`} />
            {triggering ? 'Running\u2026' : 'Run Now'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-xs transition-colors disabled:opacity-50"
            aria-label="Refresh backup status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
          triggerMsg.ok
            ? 'bg-green-900/20 border-green-800/50 text-green-400'
            : 'bg-red-900/20 border-red-800/50 text-red-400'
        }`}>
          {triggerMsg.ok
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />}
          {triggerMsg.text}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg" />)}
        </div>
      )}

      {data && (
        <>
          {data.lastBackupStatus === 'failed' && (
            <div className="flex items-center gap-3 bg-red-950/40 border border-red-700/60 text-red-300 px-4 py-3 rounded-xl">
              <XCircle className="w-5 h-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold">Last backup failed</p>
                <p className="text-xs text-red-400/80 mt-0.5">Check server logs and verify the backups/ directory is writable.</p>
              </div>
            </div>
          )}

          {data.totalBackups === 0 && (
            <div className="flex items-center gap-3 bg-yellow-950/30 border border-yellow-700/50 text-yellow-300 px-4 py-3 rounded-xl">
              <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
              <p className="text-sm">No backup files found. Click &quot;Run Now&quot; to create the first backup.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={data.lastBackupStatus} />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Last Backup</span>
              </div>
              <StatusLabel status={data.lastBackupStatus} />
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmt(data.lastBackupTime)}
              </p>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {data.recoveryReady
                  ? <ShieldCheck className="w-5 h-5 text-green-400" />
                  : <AlertTriangle className="w-5 h-5 text-red-400" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recovery</span>
              </div>
              <span className={`text-sm font-semibold ${data.recoveryReady ? 'text-green-400' : 'text-red-400'}`}>
                {data.recoveryReady ? 'Ready' : 'Not Ready'}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {data.totalBackups} backup{data.totalBackups !== 1 ? 's' : ''} on disk
                {' \u00b7 '}
                {data.criticalErrorsLast24h} critical (24h)
              </p>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className={`w-5 h-5 ${data.dbHealth.connected ? 'text-green-400' : 'text-red-400'}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Database</span>
              </div>
              <span className={`text-sm font-semibold ${data.dbHealth.connected ? 'text-green-400' : 'text-red-400'}`}>
                {data.dbHealth.connected ? 'Connected' : 'Disconnected'}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {data.dbHealth.userCount.toLocaleString()} users &middot; {data.dbHealth.cycleCount} cycles
              </p>
            </div>

            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className={`w-5 h-5 ${data.driveConfigured ? 'text-blue-400' : 'text-gray-600'}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Google Drive</span>
              </div>
              <span className={`text-sm font-semibold ${data.driveConfigured ? 'text-blue-400' : 'text-gray-500'}`}>
                {data.driveConfigured ? 'Configured' : 'Not set up'}
              </span>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {data.driveLastUploaded ? fmt(data.driveLastUploaded) : 'Never uploaded'}
              </p>
            </div>
          </div>

          {data.backupFiles.length > 0 && (
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                Backup Files (last {data.backupFiles.length})
              </p>
              <div className="space-y-2">
                {data.backupFiles.map((f, i) => (
                  <div key={f.fileName} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded text-[10px] font-semibold">
                          latest
                        </span>
                      )}
                      <span className="text-gray-300 font-mono">{f.fileName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>{fmtBytes(f.sizeBytes)}</span>
                      <span>{fmt(f.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Record Counts</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Users', value: data.dbHealth.userCount },
                { label: 'Activities', value: data.dbHealth.activityCount },
                { label: 'Cycles', value: data.dbHealth.cycleCount },
                { label: 'System Logs', value: data.dbHealth.systemLogCount },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold text-gray-100">{value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {data.recentErrors.length > 0 && (
            <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Recent Errors</p>
              <div className="space-y-2">
                {data.recentErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-500 shrink-0">{fmt(e.timestamp)}</span>
                    <span className="text-red-300 break-all">{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600 text-right">Checked at {fmt(data.checkedAt)}</p>
        </>
      )}
    </div>
  );
}
