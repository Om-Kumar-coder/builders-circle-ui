'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import StepUpModal from '@/components/auth/StepUpModal';
import { useStepUpAuth } from '@/hooks/useStepUpAuth';
import { 
  Users, Shield, Crown, Settings, Eye, RefreshCw,
  Search, ChevronDown, Check, Square, CheckSquare,
  Trash2, UserX, LogOut, X,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  profile: { role: string; status: string };
  cycleParticipations: Array<{ cycleId: string; cycle: { name: string; state: string } }>;
}

const ROLES = [
  { value: 'founder', label: 'Founder', icon: Crown, color: 'text-purple-400', bgColor: 'bg-purple-500/20', description: 'Full platform control' },
  { value: 'admin', label: 'Admin', icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/20', description: 'Verify activities, manage cycles' },
  { value: 'employee', label: 'Employee', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/20', description: 'Submit activities and participate' },
  { value: 'contributor', label: 'Contributor', icon: Users, color: 'text-green-400', bgColor: 'bg-green-500/20', description: 'Submit activities and participate' },
  { value: 'observer', label: 'Observer', icon: Eye, color: 'text-gray-400', bgColor: 'bg-gray-500/20', description: 'Read-only access' },
];

const PERMISSIONS = {
  founder: ['Full platform control', 'Manage all users and roles', 'Create and manage cycles', 'Verify activities', 'Admin overrides', 'System configuration'],
  admin: ['Verify activities', 'Manage cycles', 'Admin overrides', 'Dispute resolution', 'View audit logs', 'Moderate discussions'],
  employee: ['Submit activities', 'Participate in cycles', 'View own data', 'Join discussions'],
  contributor: ['Submit activities', 'Participate in cycles', 'View own data', 'Join discussions'],
  observer: ['Read-only access', 'View public data', 'View cycle information'],
};

const BULK_ACTIONS = [
  { value: 'change_role', label: 'Change Role', icon: Settings, color: 'text-indigo-400' },
  { value: 'force_logout', label: 'Force Logout', icon: LogOut, color: 'text-yellow-400' },
  { value: 'revoke_access', label: 'Revoke Access', icon: UserX, color: 'text-orange-400' },
  { value: 'remove_from_cycle', label: 'Remove from Cycle', icon: Trash2, color: 'text-red-400' },
];

export default function AdminRolesPage() {
  const { user: _user, loading: authLoading } = useAuth();
  const { isAdmin, isFounder } = usePermissions();
  const { requireStepUpAuth, stepUpProps } = useStepUpAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkRole, setBulkRole] = useState('contributor');
  const [bulkCycleId, setBulkCycleId] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminUsers();
      setUsers(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm);
    const matchesRole = selectedRole === 'all' || u.profile.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  // ── Bulk selection ────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkSubmitting(true);
    try {
      const userIds = Array.from(selectedIds);
      const metadata: Record<string, unknown> = {};
      if (bulkAction === 'change_role') metadata.role = bulkRole;
      if (bulkAction === 'remove_from_cycle') metadata.cycleId = bulkCycleId;

      await requireStepUpAuth(`bulk ${bulkAction}`, async () => {
        await apiClient.adminBulkAction(bulkAction, userIds, metadata);
      });

      setSuccessMessage(`Bulk action "${bulkAction}" applied to ${userIds.length} user(s).`);
      setTimeout(() => setSuccessMessage(null), 4000);
      clearSelection();
      setBulkAction('');
      setShowBulkConfirm(false);
      await fetchUsers();
    } catch {
      // cancelled or failed
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ── Single role change ────────────────────────────────────────────────────

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole || selectedUser.profile.role === newRole) return;
    if (!isFounder && (selectedUser.profile.role === 'founder' || newRole === 'founder')) {
      setModalError('Only founders can manage founder roles');
      return;
    }
    try {
      await requireStepUpAuth('change user role', async () => {
        setSubmitting(true);
        setModalError(null);
        await apiClient.updateUserRole(selectedUser.id, newRole);
      });
      setShowRoleModal(false);
      setSelectedUser(null);
      setNewRole('');
      setModalError(null);
      await fetchUsers();
      setSuccessMessage(`Role updated for ${selectedUser.name || selectedUser.email}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setModalError(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openRoleModal = (u: User) => { setSelectedUser(u); setNewRole(u.profile.role); setModalError(null); setShowRoleModal(true); };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteSubmitting(true);
    try {
      await requireStepUpAuth('delete user', async () => {
        await apiClient.deleteUser(userToDelete.id);
      });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      setSuccessMessage(`User ${userToDelete.name || userToDelete.email} deleted.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchUsers();
    } catch {
      // cancelled or failed
    } finally {
      setDeleteSubmitting(false);
    }
  };
  const getRoleInfo = (v: string) => ROLES.find(r => r.value === v) || ROLES[3];
  const roleStats = ROLES.map(role => ({ ...role, count: users.filter(u => u.profile.role === role.value).length }));

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return (
    <MainLayout title="Role Management">
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Access denied. Admin privileges required.</p>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout title="Role Management">
      <div className="space-y-6">
        {stepUpProps && <StepUpModal {...stepUpProps} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              Role Management
            </h1>
            <p className="text-gray-400 mt-1">Manage user roles and permissions</p>
          </div>
          <button onClick={fetchUsers} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Role Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {roleStats.map(role => {
            const IconComponent = role.icon;
            return (
              <div key={role.value} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <IconComponent className={`w-5 h-5 ${role.color}`} />
                  <span className="text-2xl font-bold text-gray-100">{role.count}</span>
                </div>
                <p className="text-sm font-medium text-gray-200">{role.label}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search users..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="relative">
            <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pr-8 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Roles</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        {error && <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">{error}</div>}
        {successMessage && <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg">{successMessage}</div>}

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-20 bg-gray-900 border border-indigo-500/40 rounded-xl p-4 flex flex-wrap items-center gap-3 shadow-xl">
            <span className="text-sm font-medium text-indigo-300">{selectedIds.size} selected</span>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Choose action...</option>
                {BULK_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>

              {bulkAction === 'change_role' && (
                <select value={bulkRole} onChange={e => setBulkRole(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ROLES.filter(r => isFounder || r.value !== 'founder').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              )}

              {bulkAction === 'remove_from_cycle' && (
                <input type="text" placeholder="Cycle ID" value={bulkCycleId}
                  onChange={e => setBulkCycleId(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
              )}

              <button onClick={() => setShowBulkConfirm(true)} disabled={!bulkAction || bulkSubmitting}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Apply
              </button>
            </div>
            <button onClick={clearSelection} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            {filteredUsers.length > 0 && (
              <div className="flex items-center gap-2 px-2">
                <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                  {selectedIds.size === filteredUsers.length && filteredUsers.length > 0
                    ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                    : <Square className="w-4 h-4" />}
                  Select all ({filteredUsers.length})
                </button>
              </div>
            )}

            {filteredUsers.map(u => {
              const roleInfo = getRoleInfo(u.profile.role);
              const IconComponent = roleInfo.icon;
              const isSelected = selectedIds.has(u.id);

              return (
                <div key={u.id}
                  className={`bg-gray-900 border rounded-lg p-5 transition-all ${isSelected ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-4">
                    <button onClick={() => toggleSelect(u.id)} className="flex-shrink-0 text-gray-400 hover:text-indigo-400 transition-colors">
                      {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-400" /> : <Square className="w-5 h-5" />}
                    </button>

                    <div className={`p-3 rounded-full ${roleInfo.bgColor}`}>
                      <IconComponent className={`w-5 h-5 ${roleInfo.color}`} />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-medium text-gray-100">{u.name || 'Unnamed User'}</h3>
                      <p className="text-gray-400 text-sm">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleInfo.bgColor} ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.profile.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {u.profile.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Active Cycles</p>
                        <p className="text-lg font-medium text-gray-100">
                          {u.cycleParticipations.filter(p => p.cycle.state === 'active').length}
                        </p>
                      </div>
                      {(isFounder || u.profile.role !== 'founder') && (
                        <button onClick={() => openRoleModal(u)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                          <Settings className="w-3.5 h-3.5" />
                          Change Role
                        </button>
                      )}
                      {isFounder && (
                        <button onClick={() => { setUserToDelete(u); setShowDeleteConfirm(true); }}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No users found.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-800/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Delete User</h3>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              Permanently delete <span className="text-white font-medium">{userToDelete.name || userToDelete.email}</span>?
            </p>
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
              This will delete all their activities, ownership records, participations, and data. This cannot be undone. Step-up authentication required.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteUser} disabled={deleteSubmitting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {deleteSubmitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Confirm Dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Confirm Bulk Action</h3>
            <p className="text-gray-400 text-sm mb-4">
              Apply <span className="text-indigo-300 font-medium">{bulkAction}</span> to{' '}
              <span className="text-white font-medium">{selectedIds.size}</span> user(s)?
              {bulkAction === 'change_role' && <span className="block mt-1 text-yellow-400">New role: {bulkRole}</span>}
            </p>
            <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-4">
              Step-up authentication will be required.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleBulkAction} disabled={bulkSubmitting}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {bulkSubmitting ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-gray-100">Change User Role</h3>
              <p className="text-gray-400 text-sm mt-1">{selectedUser.name || selectedUser.email}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                {ROLES.map(role => {
                  const IconComponent = role.icon;
                  const isDisabled = !isFounder && role.value === 'founder';
                  return (
                    <label key={role.value}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${newRole === role.value ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 hover:border-gray-600'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input type="radio" name="role" value={role.value} checked={newRole === role.value}
                        onChange={e => setNewRole(e.target.value)} disabled={isDisabled} className="sr-only" />
                      <div className={`p-2 rounded-full ${role.bgColor} mr-4`}>
                        <IconComponent className={`w-5 h-5 ${role.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-100">{role.label}</h4>
                          {newRole === role.value && <Check className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <p className="text-sm text-gray-400">{role.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              {newRole && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-300 mb-2">Permissions:</p>
                  <ul className="space-y-1">
                    {PERMISSIONS[newRole as keyof typeof PERMISSIONS]?.map((p, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                        <Check className="w-3 h-3 text-green-400" />{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button onClick={() => { setShowRoleModal(false); setModalError(null); }}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
              {modalError && <span className="text-sm text-red-400 flex-1 text-right mr-2">{modalError}</span>}
              <button onClick={handleRoleChange} disabled={submitting || !newRole || newRole === selectedUser.profile.role}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {submitting ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

