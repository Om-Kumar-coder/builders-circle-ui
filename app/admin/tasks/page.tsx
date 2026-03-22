'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useCycle } from '@/context/CycleContext';
import { apiClient } from '@/lib/api-client';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import TaskDetailPanel from '@/components/tasks/TaskDetailPanel';
import type { Task } from '@/types/task';
import { Plus, Users, CheckCircle, Clock, AlertCircle, LayoutGrid, List } from 'lucide-react';

type ViewMode = 'table' | 'kanban';

const statusIcon = { open: Clock, in_progress: Clock, review: Clock, completed: CheckCircle, overdue: AlertCircle };
const statusColor: Record<string, string> = {
  open: 'text-blue-400',
  in_progress: 'text-yellow-400',
  review: 'text-purple-400',
  completed: 'text-green-400',
  overdue: 'text-red-400',
};

export default function AdminTasksPage() {
  const { user } = useAuth();
  const { activeCycle } = useCycle();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<{ id: string; name?: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', isStarter: false });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!activeCycle) return;
    try {
      setLoading(true);
      const data = await apiClient.getTasks(activeCycle.id);
      setTasks(data);
    } catch {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [activeCycle]);

  useEffect(() => {
    fetchTasks();
    apiClient.getAdminUsers().then(u => setUsers(u)).catch(() => {});
  }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.title || !activeCycle) return;
    try {
      setSubmitting(true);
      setError(null);
      await apiClient.createTask({ ...form, cycleId: activeCycle.id });
      setForm({ title: '', description: '', dueDate: '', isStarter: false });
      setShowCreate(false);
      fetchTasks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (taskId: string) => {
    if (!selectedUsers.length) return;
    try {
      setSubmitting(true);
      await apiClient.assignTask(taskId, selectedUsers);
      setShowAssign(null);
      setSelectedUsers([]);
      fetchTasks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign task');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  if (!user || !isAdmin) {
    return <MainLayout title="Tasks"><p className="text-gray-400 p-6">Access denied.</p></MainLayout>;
  }

  return (
    <MainLayout title="Task Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Task Management</h1>
            <p className="text-sm text-gray-400 mt-1">{activeCycle?.name ?? 'No active cycle'}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-gray-700 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                aria-label="Table view"
              >
                <List size={13} /> Table
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-gray-700 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                aria-label="Kanban view"
              >
                <LayoutGrid size={13} /> Kanban
              </button>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
            >
              <Plus size={15} /> New Task
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-2">{error}</p>}

        {/* Create Task Form */}
        {showCreate && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Create Task</h3>
            <input
              placeholder="Title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isStarter}
                onChange={e => setForm(f => ({ ...f, isStarter: e.target.checked }))}
                className="rounded border-gray-600 bg-gray-700 text-indigo-500"
              />
              Starter Task <span className="text-xs text-gray-500">(auto-assigned to new members)</span>
            </label>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={submitting || !form.title}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          loading ? (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-64 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />
              ))}
            </div>
          ) : (
            <KanbanBoard
              tasks={tasks}
              isAdmin={isAdmin}
              onTaskClick={setSelectedTaskId}
              onTasksChange={setTasks}
            />
          )
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />)}</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No tasks yet. Create one above.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => {
                const Icon = statusIcon[task.status as keyof typeof statusIcon] ?? Clock;
                const color = statusColor[task.status] ?? 'text-gray-400';
                return (
                  <div
                    key={task.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-100 truncate">{task.title}</p>
                          {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className={`text-xs capitalize font-medium ${color}`}>{task.status.replace('_', ' ')}</span>
                            {task.isStarter && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 font-medium">Starter</span>
                            )}
                            {task.dueDate && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.assignments && task.assignments.length > 0 && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Users size={10} /> {task.assignments.length} assigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setShowAssign(task.id); setSelectedUsers([]); }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                      >
                        <Users size={12} /> Assign
                      </button>
                    </div>

                    {/* Assign panel */}
                    {showAssign === task.id && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2" onClick={e => e.stopPropagation()}>
                        <p className="text-xs text-gray-400">Select users to assign:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {users.map(u => (
                            <label key={u.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-gray-100">
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(u.id)}
                                onChange={e => setSelectedUsers(prev =>
                                  e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                                )}
                                className="rounded border-gray-600 bg-gray-700 text-indigo-500"
                              />
                              {u.name ?? u.email}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAssign(task.id)} disabled={submitting || !selectedUsers.length}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50">
                            {submitting ? 'Assigning...' : 'Assign'}
                          </button>
                          <button onClick={() => setShowAssign(null)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Task detail panel */}
      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchTasks}
      />
    </MainLayout>
  );
}
