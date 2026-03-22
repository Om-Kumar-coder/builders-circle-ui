'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useGroups } from '@/hooks/useGroups';
import GroupCard from '@/components/groups/GroupCard';
import CreateGroupModal from '@/components/groups/CreateGroupModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { Group } from '@/hooks/useGroups';
import { Plus, Users, RefreshCw } from 'lucide-react';

export default function AdminGroupsPage() {
  const { loading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();
  const { groups, loading, fetchGroups, createGroup, updateGroup, deleteGroup } = useGroups();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { if (isAdmin) fetchGroups(); }, [isAdmin, fetchGroups]);

  async function handleSave(data: { name: string; description?: string; isDefault?: boolean }) {
    if (editing) {
      await updateGroup(editing.id, data);
      setSuccessMsg('Group updated.');
    } else {
      await createGroup(data);
      setSuccessMsg('Group created.');
    }
    setTimeout(() => setSuccessMsg(''), 3000);
    setEditing(null);
    setCreating(false);
    fetchGroups();
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteGroup(deleting.id);
      setSuccessMsg('Group deleted.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete group');
      setTimeout(() => setErrorMsg(''), 4000);
    }
    setDeleting(null);
    fetchGroups();
  }

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return (
    <MainLayout title="Groups">
      <p className="text-gray-400">Access denied.</p>
    </MainLayout>
  );

  return (
    <MainLayout title="Group Management">
      <div className="space-y-6">
        {(creating || editing) && (
          <CreateGroupModal
            group={editing}
            onSave={handleSave}
            onClose={() => { setCreating(false); setEditing(null); }}
          />
        )}
        {deleting && (
          <ConfirmDialog
            isOpen={!!deleting}
            title="Delete Group"
            message={`Delete group "${deleting.name}"? Tasks in this group will become unscoped.`}
            confirmLabel="Delete"
            onConfirm={handleDelete}
            onCancel={() => setDeleting(null)}
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7 text-teal-400" />
            <h1 className="text-2xl font-bold text-gray-100">Groups</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchGroups}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> New Group
            </button>
          </div>
        </div>

        {successMsg && <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg">{successMsg}</div>}
        {errorMsg && <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">{errorMsg}</div>}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No groups yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(g => (
              <GroupCard
                key={g.id}
                group={g}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
