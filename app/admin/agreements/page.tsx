'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { FileText, Plus, CheckCircle, Clock, Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Agreement {
  id: string;
  version: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

interface AcceptanceLog {
  id: string;
  acceptedAt: string;
  ipAddress: string | null;
  user: { id: string; email: string; name: string | null };
  agreement: { version: string; title: string };
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>{message}</div>
  );
}

export default function AdminAgreementsPage() {
  const { user, loading: authLoading } = useAuth();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [log, setLog] = useState<AcceptanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ version: '', title: '', content: '', setActive: false });
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'versions' | 'log'>('versions');

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, acceptLog] = await Promise.all([
        apiClient.getAgreementHistory(),
        apiClient.getAgreementAcceptanceLog(),
      ]);
      setAgreements(hist);
      setLog(acceptLog);
    } catch {
      showToast('Failed to load agreements', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  async function handleActivate(id: string) {
    setActivating(id);
    try {
      await apiClient.activateAgreement(id);
      showToast('Agreement activated — all users must re-accept');
      load();
    } catch {
      showToast('Failed to activate', 'error');
    } finally {
      setActivating(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.version || !form.title || !form.content) return;
    setCreating(true);
    try {
      await apiClient.createAgreement(form);
      showToast('Agreement created');
      setShowCreate(false);
      setForm({ version: '', title: '', content: '', setActive: false });
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setCreating(false);
    }
  }

  if (authLoading) return <LoadingScreen />;
  if (!user || !['admin', 'founder'].includes(user.role ?? '')) {
    return <MainLayout title="Agreements"><p className="text-gray-400 p-8">Access denied.</p></MainLayout>;
  }

  return (
    <MainLayout title="Agreements">
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Agreements</h1>
            <p className="text-gray-400 mt-1">Manage versioned agreements and view acceptance records</p>
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Version
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Create New Agreement Version</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Version (e.g. v1.1)</label>
                  <input
                    value={form.version}
                    onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
                    placeholder="v1.1"
                    required
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Title</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Builder's Circle Participation Agreement"
                    required
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Content (Markdown supported)</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={10}
                  required
                  placeholder="Enter the full agreement text here..."
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(p => ({ ...p, setActive: !p.setActive }))}
                  className={`w-10 h-5 rounded-full relative transition-colors ${form.setActive ? 'bg-indigo-600' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.setActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-300">Set as active (requires all users to re-accept)</span>
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={creating}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Agreement'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {(['versions', 'log'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'versions' ? 'Versions' : 'Acceptance Log'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'versions' ? (
          <div className="space-y-3">
            {agreements.length === 0 && (
              <div className="text-center py-12 text-gray-500">No agreements yet. Create the first version.</div>
            )}
            {agreements.map(a => (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg mt-0.5">
                      <FileText className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-100">{a.version}</span>
                        {a.isActive && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full">Active</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">{a.title}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Created {new Date(a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {' · '}
                        {log.filter(l => l.agreement.version === a.version).length} acceptance{log.filter(l => l.agreement.version === a.version).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {!a.isActive && (
                    <button
                      onClick={() => handleActivate(a.id)}
                      disabled={activating === a.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {activating === a.id ? 'Activating...' : 'Set Active'}
                    </button>
                  )}
                </div>
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-400 font-mono whitespace-pre-wrap">{a.content.slice(0, 400)}{a.content.length > 400 ? '...' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-5 border-b border-gray-800">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-200">{log.length} total acceptance{log.length !== 1 ? 's' : ''}</span>
            </div>
            {log.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-sm">No acceptances recorded yet.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {log.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <span className="text-xs text-indigo-400 font-medium">
                          {(entry.user.name ?? entry.user.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-200">{entry.user.name ?? entry.user.email}</p>
                        <p className="text-xs text-gray-500">{entry.user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full">
                        {entry.agreement.version}
                      </span>
                      <div className="flex items-center gap-1 mt-1 justify-end text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.acceptedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {entry.ipAddress && <p className="text-xs text-gray-600 mt-0.5">IP: {entry.ipAddress}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
