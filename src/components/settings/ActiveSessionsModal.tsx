'use client';

import { useState, useEffect } from 'react';
import { X, Monitor, Clock, Wifi, WifiOff, LogOut } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DeviceSession {
  id: string;
  device: string;
  lastActive: string;
  sessionStart: string;
  sessionEnd: string | null;
  durationMinutes: number;
  isCurrent: boolean;
}

interface ActiveSessionsModalProps {
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActiveSessionsModal({ onClose }: ActiveSessionsModalProps) {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [endingAll, setEndingAll] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listSessions();
      setSessions(data);
    } catch {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleEndSession(id: string) {
    setEnding(id);
    try {
      await apiClient.endSession(id);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, sessionEnd: new Date().toISOString() } : s));
      showToast('Session ended');
    } catch {
      showToast('Failed to end session');
    } finally {
      setEnding(null);
    }
  }

  async function handleEndAll() {
    setEndingAll(true);
    try {
      const result = await apiClient.endAllOtherSessions();
      await load();
      showToast(`Ended ${result.ended} other session${result.ended !== 1 ? 's' : ''}`);
    } catch {
      showToast('Failed to end sessions');
    } finally {
      setEndingAll(false);
    }
  }

  const activeSessions = sessions.filter(s => !s.sessionEnd);
  const pastSessions = sessions.filter(s => s.sessionEnd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Monitor className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Active Sessions</h2>
              <p className="text-xs text-gray-500">{activeSessions.length} active · {pastSessions.length} past</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {toast && (
            <div className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 text-center">
              {toast}
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-center text-red-400 text-sm py-8">{error}</p>}
          {!loading && !error && (
            <>
              {activeSessions.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <WifiOff className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-500">No active sessions</span>
                </div>
              )}
              {activeSessions.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-200 truncate max-w-[180px]">{s.device || 'Browser session'}</p>
                        {s.isCurrent && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">current</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Active {timeAgo(s.lastActive)}</span>
                      </div>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => handleEndSession(s.id)}
                      disabled={ending === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {ending === s.id ? '...' : 'End'}
                    </button>
                  )}
                </div>
              ))}
              {pastSessions.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 pt-2">Recent past sessions</p>
                  {pastSessions.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-gray-800/30 rounded-lg border border-gray-700/30 opacity-60">
                      <div className="flex items-center gap-3">
                        <WifiOff className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-400 truncate max-w-[200px]">{s.device || 'Browser session'}</p>
                          <p className="text-xs text-gray-600 mt-0.5">Ended {timeAgo(s.sessionEnd!)}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600">{s.durationMinutes}m</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleEndAll}
            disabled={endingAll || activeSessions.filter(s => !s.isCurrent).length === 0}
            className="flex-1 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          >
            {endingAll ? 'Ending...' : 'Logout all other sessions'}
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
