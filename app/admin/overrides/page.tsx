'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { 
  Shield, 
  Users, 
  AlertTriangle, 
  RefreshCw,
  Search,
  Settings,
  TrendingUp,
  Zap
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  profile: {
    role: string;
    status: string;
  };
  cycleParticipations: Array<{
    cycleId: string;
    stallStage: string;
    participationStatus: string;
    cycle: {
      id: string;
      name: string;
      state: string;
    };
  }>;
}

interface OverrideAction {
  type: 'ownership' | 'multiplier' | 'stall-clear';
  userId: string;
  cycleId: string;
  value?: number;
  reason: string;
}

export default function AdminOverridesPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideAction, setOverrideAction] = useState<OverrideAction>({
    type: 'ownership',
    userId: '',
    cycleId: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

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

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.includes(searchTerm)
  );

  const handleOverride = async () => {
    if (!overrideAction.reason.trim()) {
      alert('Please provide a reason for the override');
      return;
    }

    try {
      setSubmitting(true);

      switch (overrideAction.type) {
        case 'ownership':
          if (!overrideAction.value) {
            alert('Please specify ownership amount');
            return;
          }
          await apiClient.overrideOwnership(
            overrideAction.userId,
            overrideAction.cycleId,
            overrideAction.value,
            overrideAction.reason
          );
          break;
        case 'multiplier':
          if (!overrideAction.value) {
            alert('Please specify multiplier value');
            return;
          }
          await apiClient.overrideMultiplier(
            overrideAction.userId,
            overrideAction.cycleId,
            overrideAction.value,
            overrideAction.reason
          );
          break;
        case 'stall-clear':
          await apiClient.clearStallStatus(
            overrideAction.userId,
            overrideAction.cycleId,
            overrideAction.reason
          );
          break;
      }

      alert('Override applied successfully!');
      setShowOverrideModal(false);
      setOverrideAction({ type: 'ownership', userId: '', cycleId: '', reason: '' });
      fetchUsers(); // Refresh data
    } catch (err) {
      alert(`Override failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openOverrideModal = (type: OverrideAction['type'], user: User, cycleId?: string) => {
    setOverrideAction({
      type,
      userId: user.id,
      cycleId: cycleId || user.cycleParticipations[0]?.cycleId || '',
      reason: ''
    });
    setSelectedUser(user);
    setShowOverrideModal(true);
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return (
      <MainLayout title="Admin Overrides">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Access denied. Admin privileges required.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Admin Overrides">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-500" />
              Admin Override Panel
            </h1>
            <p className="text-gray-400 mt-1">
              Manually correct governance outcomes and manage user participation
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Warning */}
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-medium">Use with Caution</h3>
              <p className="text-red-300/80 text-sm mt-1">
                Admin overrides create permanent audit trail entries and should only be used to correct 
                system errors or address exceptional circumstances. All actions are logged and traceable.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search users by email, name, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg 
              text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-100">
                        {user.name || 'Unnamed User'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.profile.role === 'founder' ? 'bg-purple-500/20 text-purple-400' :
                        user.profile.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {user.profile.role}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.profile.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.profile.status}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{user.email}</p>
                    
                    {/* Participations */}
                    {user.cycleParticipations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-300">Active Participations:</h4>
                        {user.cycleParticipations.map((participation) => (
                          <div key={participation.cycleId} 
                            className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                            <div>
                              <p className="text-sm font-medium text-gray-200">
                                {participation.cycle.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  participation.stallStage === 'active' ? 'bg-green-500/20 text-green-400' :
                                  participation.stallStage === 'at_risk' ? 'bg-yellow-500/20 text-yellow-400' :
                                  participation.stallStage === 'diminishing' ? 'bg-orange-500/20 text-orange-400' :
                                  participation.stallStage === 'paused' ? 'bg-red-500/20 text-red-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {participation.stallStage}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {participation.cycle.state}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openOverrideModal('ownership', user, participation.cycleId)}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition-colors"
                              >
                                <TrendingUp className="w-3 h-3 inline mr-1" />
                                Ownership
                              </button>
                              <button
                                onClick={() => openOverrideModal('multiplier', user, participation.cycleId)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                              >
                                <Settings className="w-3 h-3 inline mr-1" />
                                Multiplier
                              </button>
                              {participation.stallStage !== 'active' && (
                                <button
                                  onClick={() => openOverrideModal('stall-clear', user, participation.cycleId)}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                                >
                                  <Zap className="w-3 h-3 inline mr-1" />
                                  Clear Stall
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No users found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-gray-100">
                {overrideAction.type === 'ownership' ? 'Override Ownership' :
                 overrideAction.type === 'multiplier' ? 'Override Multiplier' :
                 'Clear Stall Status'}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                User: {selectedUser?.name || selectedUser?.email}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {(overrideAction.type === 'ownership' || overrideAction.type === 'multiplier') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {overrideAction.type === 'ownership' ? 'Ownership Amount' : 'Multiplier Value'}
                  </label>
                  <input
                    type="number"
                    step={overrideAction.type === 'ownership' ? '0.01' : '0.1'}
                    min="0"
                    max={overrideAction.type === 'multiplier' ? '2' : undefined}
                    value={overrideAction.value || ''}
                    onChange={(e) => setOverrideAction(prev => ({ 
                      ...prev, 
                      value: parseFloat(e.target.value) || 0 
                    }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                      text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={overrideAction.type === 'ownership' ? '0.00' : '1.0'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for Override *
                </label>
                <textarea
                  value={overrideAction.reason}
                  onChange={(e) => setOverrideAction(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                    text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                  placeholder="Explain why this override is necessary..."
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOverride}
                disabled={submitting || !overrideAction.reason.trim()}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg 
                  font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Applying...' : 'Apply Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}