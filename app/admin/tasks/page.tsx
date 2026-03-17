'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useCycle } from '@/context/CycleContext';
import { apiClient } from '@/lib/api-client';
import type { Task } from '@/types/task';
import { Plus, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const statusIcon = { open: Clock, completed: CheckCircle, overdue: AlertCircle };
const statusColor = {
  open: 'text-blue-400',
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
  const [form, setForm] = useState({ title: '', description: '', dueDate: '' });
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setForm({ title: '', description: '', dueDate: '' });
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

  if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
    return <MainLayout title="Tasks"><p className="text-gray-400 p-6">Access denied.</p></MainLayout>;
  }

  return (
    <MainLayout title="Task Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Task Management</h1>
            <p className="text-sm text-gray-400 mt-1">{activeCycle?.name ?? 'No active cycle'}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus size={15} /> New Task
          </button>
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

        {/* Tasks List */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />)}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No tasks yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => {
              const Icon = statusIcon[task.status as keyof typeof statusIcon] ?? Clock;
              const color = statusColor[task.status as keyof typeof statusColor] ?? 'text-gray-400';
              return (
                <div key={task.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">{task.title}</p>
                        {task.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className={`text-xs capitalize font-medium ${color}`}>{task.status}</span>
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
                      onClick={() => { setShowAssign(task.id); setSelectedUsers([]); }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                    >
                      <Users size={12} /> Assign
                    </button>
                  </div>

                  {/* Assign panel */}
                  {showAssign === task.id && (
                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
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
        )}
      </div>
    </MainLayout>
  );
}
