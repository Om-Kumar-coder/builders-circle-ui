'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X, Lock, AlertTriangle, Calendar, User, CheckSquare,
  ExternalLink, FileText, Clock, Activity, ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import type { Task } from '@/types/task';
import type { ActivityEvent } from '@/types/activity';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
  /** Called after a status action (complete/start) so parent can refresh */
  onTaskUpdated?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  open: 'text-blue-400 bg-blue-900/30 border-blue-800/40',
  in_progress: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40',
  completed: 'text-green-400 bg-green-900/30 border-green-800/40',
  overdue: 'text-red-400 bg-red-900/30 border-red-800/40',
};

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function isOverdue(task: Task) {
  return task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{children}</p>;
}

function Divider() {
  return <div className="border-t border-gray-700/60 my-5" />;
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse p-6">
      <div className="h-6 bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-700 rounded w-1/2" />
      <div className="h-20 bg-gray-700 rounded" />
      <div className="h-4 bg-gray-700 rounded w-2/3" />
    </div>
  );
}

// ── Activity history for a task (by linkedTaskId) ────────────────────────────

function TaskActivityHistory({ task }: { task: Task }) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getActivities({ linkedTaskId: task.id })
      .then((all: ActivityEvent[]) => setActivities(all))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [task.id]);

  if (loading) return <div className="animate-pulse h-12 bg-gray-700 rounded" />;
  if (!activities.length) {
    return <p className="text-sm text-gray-500 italic">No activity submissions linked to this task yet.</p>;
  }

  return (
    <div className="space-y-2">
      {activities.map(a => (
        <div key={a.id} className="bg-gray-800 rounded-lg p-3 flex items-start gap-3">
          <Activity className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-200 font-medium truncate">
                {a.user?.name || a.user?.email || 'Unknown'}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize shrink-0 ${
                a.status === 'verified' ? 'bg-green-900/40 text-green-400' :
                a.status === 'rejected' ? 'bg-red-900/40 text-red-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {a.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.description || a.workSummary || '—'}</p>
            <p className="text-xs text-gray-600 mt-1">{fmtTime(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Related docs linked by task title/id in doc metadata ─────────────────────

function RelatedDocs({ task }: { task: Task }) {
  const [docs, setDocs] = useState<{ id: string; title: string; securityLabel: string; access: unknown }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getDocs({ search: task.title, cycleId: task.cycleId })
      .then((all: { id: string; title: string; securityLabel: string; access: unknown; isActive: boolean }[]) =>
        setDocs(all.filter(d => d.isActive))
      )
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [task.title, task.cycleId]);

  if (loading) return null;
  if (!docs.length) return null;

  return (
    <>
      <SectionLabel>Related Documents</SectionLabel>
      <div className="space-y-2 mb-5">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <p className="text-sm text-gray-200 truncate">{doc.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                doc.securityLabel === 'confidential' ? 'bg-red-900/40 text-red-400' :
                doc.securityLabel === 'restricted' ? 'bg-yellow-900/40 text-yellow-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {doc.securityLabel}
              </span>
              {doc.access ? (
                <a
                  href={`/docs/view/${doc.id}`}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  aria-label={`View ${doc.title}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </a>
              ) : (
                <span className="text-xs text-gray-600">No access</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <Divider />
    </>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function TaskDetailPanel({ taskId, onClose, onTaskUpdated }: TaskDetailPanelProps) {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTask = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTask(id);
      setTask(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taskId) {
      setTask(null);
      setActionError(null);
      fetchTask(taskId);
    }
  }, [taskId, fetchTask]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!taskId) return null;

  // ── Derived state ──────────────────────────────────────────────────────────

  const myAssignment = task?.assignments?.find(a => a.userId === user?.id);
  const canAct = !!myAssignment && task?.status !== 'completed';
  const isRestricted = task?.restricted;
  // Task is fully claimed if someone else is already in_progress on it
  const isFullyClaimed = !myAssignment && task?.assignments?.some(a => a.status === 'in_progress');
  const canSeeSecurityNote = isAdmin || isRestricted; // everyone sees the warning; only admin sees the note

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!task) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiClient.startTask(task.id);
      await fetchTask(task.id);
      onTaskUpdated?.();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to start task');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    if (!task) return;
    // Tasks complete via activity submission — redirect user there
    window.location.href = `/activity?taskId=${task.id}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Task detail"
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700/60 z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/60 shrink-0">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Task Detail</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && <Skeleton />}

          {error && (
            <div className="m-6 flex items-center gap-2 bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {task && !loading && (
            <div className="p-6 space-y-0">

              {/* Restricted warning banner */}
              {isRestricted && (
                <div className="flex items-start gap-3 bg-yellow-900/20 border border-yellow-700/50 text-yellow-300 rounded-lg px-4 py-3 mb-5">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Restricted Task</p>
                    <p className="text-xs text-yellow-400/80 mt-0.5">
                      This task contains sensitive information. Access is limited to authorized personnel.
                    </p>
                  </div>
                </div>
              )}

              {/* Title + status */}
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-lg font-semibold text-gray-100 leading-snug flex items-center gap-2">
                  {isRestricted && <Lock className="w-4 h-4 text-yellow-400 shrink-0" />}
                  {task.title}
                </h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize shrink-0 ${STATUS_STYLES[task.status] ?? 'text-gray-400 bg-gray-700 border-gray-600'}`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>

              {/* Due date */}
              {task.dueDate && (
                <div className={`flex items-center gap-1.5 text-xs mt-1 mb-4 ${isOverdue(task) ? 'text-red-400' : 'text-gray-500'}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  Due {fmt(task.dueDate)}
                  {isOverdue(task) && <span className="ml-1 font-semibold">· Overdue</span>}
                </div>
              )}

              <Divider />

              {/* Description */}
              {task.description && (
                <>
                  <SectionLabel>Description</SectionLabel>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-5">{task.description}</p>
                  <Divider />
                </>
              )}

              {/* Acceptance criteria */}
              {task.acceptanceCriteria && (
                <>
                  <SectionLabel>Acceptance Criteria</SectionLabel>
                  <div className="bg-gray-800/60 rounded-lg p-3 mb-5">
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{task.acceptanceCriteria}</p>
                  </div>
                  <Divider />
                </>
              )}

              {/* Assignees */}
              <SectionLabel>Assignees</SectionLabel>
              {task.assignments && task.assignments.length > 0 ? (
                <div className="space-y-2 mb-5">
                  {task.assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-300 text-xs font-semibold">
                          {(a.user?.name || a.user?.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-gray-200">{a.user?.name || a.user?.email || 'Unknown'}</p>
                          {a.completedAt && (
                            <p className="text-xs text-gray-500">Completed {fmt(a.completedAt)}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.status === 'completed' ? 'bg-green-900/40 text-green-400' :
                        a.status === 'in_progress' ? 'bg-yellow-900/40 text-yellow-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {ASSIGNMENT_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                  ))}
                  {isFullyClaimed && (
                    <div className="flex items-center gap-2 bg-orange-900/20 border border-orange-700/40 text-orange-300 rounded-lg px-3 py-2 text-xs mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      This task is fully claimed and cannot be started by another member.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic mb-5">No assignees yet.</p>
              )}

              <Divider />

              {/* Proof / PR link */}
              {task.proofLink && (
                <>
                  <SectionLabel>Repo / PR Link</SectionLabel>
                  <a
                    href={task.proofLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors mb-5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {task.proofLink}
                  </a>
                  <Divider />
                </>
              )}

              {/* Related docs */}
              <RelatedDocs task={task} />

              {/* Security note */}
              {canSeeSecurityNote && task.securityNote && (
                <>
                  <Divider />
                  <SectionLabel>Security Notes</SectionLabel>
                  <div className="flex items-start gap-2 bg-yellow-900/10 border border-yellow-800/40 rounded-lg px-3 py-2.5">
                    <Lock className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-yellow-300/90 leading-relaxed">{task.securityNote}</p>
                  </div>
                </>
              )}

              {/* Activity history */}
              <Divider />
              <SectionLabel>Activity History</SectionLabel>
              <TaskActivityHistory task={task} />

              {/* Creator / meta */}
              <Divider />
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Created by {task.creator?.name || task.creator?.email || 'Unknown'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmt(task.createdAt)}
                </span>
              </div>

              {/* Action error */}
              {actionError && (
                <div className="mt-4 flex items-center gap-2 bg-red-900/20 border border-red-800/50 text-red-400 px-3 py-2 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {actionError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions — only for assigned users */}
        {task && canAct && (
          <div className="px-6 py-4 border-t border-gray-700/60 flex gap-3 shrink-0">
            {myAssignment?.status === 'assigned' && !isFullyClaimed && (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {actionLoading ? 'Updating…' : 'Start Task'}
              </button>
            )}
            {myAssignment?.status === 'in_progress' && (
              <button
                onClick={handleComplete}
                disabled={actionLoading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Submit Activity to Complete
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
