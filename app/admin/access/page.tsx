'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import StepUpModal from '@/components/auth/StepUpModal';
import GrantAccessModal from '@/components/admin/GrantAccessModal';
import AssignGroupModal from '@/components/groups/AssignGroupModal';
import { useStepUpAuth } from '@/hooks/useStepUpAuth';
import {
  ShieldCheck, ShieldOff, Search, RefreshCw, Clock,
  CheckCircle, XCircle, Users, ChevronDown, Bell,
} from 'lucide-react';

interface AccessGrant {
  id: string;
  userId: string;
  type: string;
  value: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  granter: { id: string; email: string; name: string | null };
}

interface UserWithGrants {
  id: string;
  email: string;
  name: string | null;
  profile: { role: string; status: string };
  grants: AccessGrant[];
}

interface AccessRequest {
  id: string;
  userId: string;
  message: string;
  metadata: string;
  timestamp: string;
  user?: { id: string; name: string | null; email: string };
}

function AccessBadge({ grant }: { grant: AccessGrant }) {
  const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();
  const isRevoked = !!grant.revokedAt;

  if (isRevoked) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-3 h-3" /> {grant.type} (revoked)
    </span>
  );
  if (isExpired) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-500/10 text-gray-400 border border-gray-500/20">
      <Clock className="w-3 h-3" /> {grant.type} (expired)
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
      <CheckCircle className="w-3 h-3" /> {grant.type}
      {grant.expiresAt && (
        <span className="text-gray-400 ml-1">· expires {new Date(grant.expiresAt).toLocaleDateString()}</span>
      )}
    </span>
  );
}

export default function AccessManagementPage() {
  const { user: _user, loading: authLoading } = useAuth();
  const { requireStepUpAuth, stepUpProps } = useStepUpAuth();
  const [users, setUsers] = useState<UserWithGrants[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [grantTarget, setGrantTarget] = useState<UserWithGrants | null>(null);
  const [groupTarget, setGroupTarget] = useState<UserWithGrants | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const { isAdmin } = usePermissions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allUsers, requests] = await Promise.all([
        apiClient.getAdminUsers(),
        apiClient.getAccessRequests().catch(() => []),
      ]);
      const withGrants = await Promise.all(
        allUsers.map(async (u: UserWithGrants) => {
          try {
            const grants = await apiClient.adminGetAccessGrants(u.id);
            return { ...u, grants };
          } catch {
            return { ...u, grants: [] };
          }
        })
      );
      setUsers(withGrants);
      setAccessRequests(requests);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const handleRevoke = async (userId: string, grantId: string, type: string) => {
    setRevoking(grantId);
    try {
      await requireStepUpAuth(`revoke ${type} access`, async () => {
        await apiClient.adminRevokeAccess({ userId, grantId });
      });
      setSuccessMsg('Access revoked.');
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchData();
    } catch {
      // cancelled or failed
    } finally {
      setRevoking(null);
    }
  };

  const handleReviewRequest = async (id: string, status: 'approved' | 'rejected') => {
    setReviewingId(id);
    try {
      await apiClient.reviewAccessRequest(id, status);
      setSuccessMsg(`Request ${status}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchData();
    } finally {
      setReviewingId(null);
    }
  };

  const handleGrantSuccess = async () => {
    setGrantTarget(null);
    setSuccessMsg('Access granted successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);
    await fetchData();
  };

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return (
    <MainLayout title="Access Management">
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Access denied.</p>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout title="Access Management">
      <div className="space-y-6">
        {stepUpProps && <StepUpModal {...stepUpProps} />}
        {grantTarget && (
          <GrantAccessModal
            userId={grantTarget.id}
            userName={grantTarget.name || grantTarget.email}
            onSuccess={handleGrantSuccess}
            onClose={() => setGrantTarget(null)}
          />
        )}
        {groupTarget && (
          <AssignGroupModal
            userId={groupTarget.id}
            userName={groupTarget.name || groupTarget.email}
            currentGroupId={(groupTarget as { groupId?: string }).groupId}
            onSave={async (groupId) => {
              const { apiClient } = await import('@/lib/api-client');
              await apiClient.assignUserGroup(groupTarget.id, groupId);
              setSuccessMsg('Group assigned.');
              setTimeout(() => setSuccessMsg(''), 3000);
              await fetchData();
            }}
            onClose={() => setGroupTarget(null)}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-green-500" />
              Access Management
            </h1>
            <p className="text-gray-400 mt-1">Grant and revoke temporary or permanent access for users</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {successMsg && (
          <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg">
            {successMsg}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => {
              const activeGrants = u.grants.filter(g => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > new Date()));
              const isExpanded = expandedUser === u.id;

              return (
                <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-800 rounded-full">
                        <Users className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-100">{u.name || 'Unnamed'}</p>
                        <p className="text-sm text-gray-400">{u.email}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {u.profile.role}
                          </span>
                          {activeGrants.map(g => <AccessBadge key={g.id} grant={g} />)}
                          {activeGrants.length === 0 && (
                            <span className="text-xs text-gray-500">No active grants</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setGrantTarget(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Grant
                      </button>
                      <button
                        onClick={() => setGroupTarget(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 rounded-lg text-sm font-medium transition-colors"
                      >
                        Group
                      </button>
                      {u.grants.length > 0 && (
                        <button
                          onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                        >
                          History
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 p-5 space-y-2">
                      <p className="text-sm font-medium text-gray-300 mb-3">Access History</p>
                      {u.grants.map(g => {
                        const isActive = !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > new Date());
                        return (
                          <div key={g.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <AccessBadge grant={g} />
                                {g.value && <span className="text-xs text-gray-400">· {g.value}</span>}
                              </div>
                              <p className="text-xs text-gray-500">
                                Granted by {g.granter.name || g.granter.email} · {new Date(g.createdAt).toLocaleString()}
                              </p>
                              {g.expiresAt && (
                                <p className="text-xs text-gray-500">
                                  Expires: {new Date(g.expiresAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                            {isActive && (
                              <button
                                onClick={() => handleRevoke(u.id, g.id, g.type)}
                                disabled={revoking === g.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                              >
                                <ShieldOff className="w-3.5 h-3.5" />
                                {revoking === g.id ? 'Revoking...' : 'Revoke'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No users found.</p>
              </div>
            )}
          </div>
        )}

        {/* Pending Access Requests */}
        {accessRequests.filter(r => { try { return JSON.parse(r.metadata)?.status === 'pending'; } catch { return false; } }).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-gray-100">Pending Access Requests</h2>
            </div>
            {accessRequests.map(req => {
              let meta: Record<string, string> = {};
              try { meta = JSON.parse(req.metadata); } catch { /* ignore */ }
              if (meta.status !== 'pending') return null;
              return (
                <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-200">{req.user?.name || req.user?.email || req.userId}</p>
                    <p className="text-xs text-gray-400">Requesting: <span className="text-indigo-400">{meta.accessType}</span></p>
                    <p className="text-xs text-gray-500">{meta.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReviewRequest(req.id, 'approved')} disabled={reviewingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg text-sm transition-colors disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => handleReviewRequest(req.id, 'rejected')} disabled={reviewingId === req.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
