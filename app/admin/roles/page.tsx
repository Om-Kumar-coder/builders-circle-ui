'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { 
  Users, 
  Shield, 
  Crown, 
  Settings, 
  Eye, 
  RefreshCw,
  Search,
  ChevronDown,
  Check
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
    cycle: {
      name: string;
      state: string;
    };
  }>;
}

const ROLES = [
  {
    value: 'founder',
    label: 'Founder',
    icon: Crown,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    description: 'Full platform control, can manage all aspects'
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    description: 'Can verify activities, manage cycles, override decisions'
  },
  {
    value: 'employee',
    label: 'Employee',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    description: 'Can submit activities and participate in cycles'
  },
  {
    value: 'contributor',
    label: 'Contributor',
    icon: Users,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    description: 'Can submit activities and participate in cycles'
  },
  {
    value: 'observer',
    label: 'Observer',
    icon: Eye,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    description: 'Read-only access to platform data'
  }
];

const PERMISSIONS = {
  founder: [
    'Full platform control',
    'Manage all users and roles',
    'Create and manage cycles',
    'Verify activities',
    'Admin overrides',
    'System configuration'
  ],
  admin: [
    'Verify activities',
    'Manage cycles',
    'Admin overrides',
    'Dispute resolution',
    'View audit logs',
    'Moderate discussions'
  ],
  employee: [
    'Submit activities',
    'Participate in cycles',
    'View own data',
    'Join discussions'
  ],
  contributor: [
    'Submit activities',
    'Participate in cycles',
    'View own data',
    'Join discussions'
  ],
  observer: [
    'Read-only access',
    'View public data',
    'View cycle information'
  ]
};

export default function AdminRolesPage() {
  const { user, loading: authLoading } = useAuth();
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

  const isFounder = user?.role === 'founder';
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

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.id.includes(searchTerm);
    const matchesRole = selectedRole === 'all' || u.profile.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    if (selectedUser.profile.role === newRole) return;

    if (!isFounder && (selectedUser.profile.role === 'founder' || newRole === 'founder')) {
      setModalError('Only founders can manage founder roles');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);
      await apiClient.updateUserRole(selectedUser.id, newRole);

      setShowRoleModal(false);
      setSelectedUser(null);
      setNewRole('');
      setModalError(null);
      await fetchUsers();
      setSuccessMessage(`Role updated successfully for ${selectedUser.name || selectedUser.email}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setModalError(`Failed to update role: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.profile.role);
    setModalError(null);
    setShowRoleModal(true);
  };

  const getRoleInfo = (roleValue: string) => {
    return ROLES.find(r => r.value === roleValue) || ROLES[3]; // Default to contributor
  };

  const roleStats = ROLES.map(role => ({
    ...role,
    count: users.filter(u => u.profile.role === role.value).length
  }));

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return (
      <MainLayout title="Role Management">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Access denied. Admin privileges required.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Role Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              Role Management
            </h1>
            <p className="text-gray-400 mt-1">
              Manage user roles and permissions across the platform
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

        {/* Role Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {roleStats.map((role) => {
            const IconComponent = role.icon;
            return (
              <div key={role.value} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <IconComponent className={`w-5 h-5 ${role.color}`} />
                  <span className="text-2xl font-bold text-gray-100">{role.count}</span>
                </div>
                <p className="text-sm font-medium text-gray-200">{role.label}</p>
                <p className="text-xs text-gray-400 mt-1">{role.description}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
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
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pr-8
                text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Roles</option>
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Success State */}
        {successMessage && (
          <div className="bg-green-900/20 border border-green-800/50 text-green-400 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const roleInfo = getRoleInfo(user.profile.role);
              const IconComponent = roleInfo.icon;
              
              return (
                <div key={user.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full ${roleInfo.bgColor}`}>
                        <IconComponent className={`w-6 h-6 ${roleInfo.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-100">
                          {user.name || 'Unnamed User'}
                        </h3>
                        <p className="text-gray-400 text-sm">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleInfo.bgColor} ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.profile.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {user.profile.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Active Cycles</p>
                        <p className="text-lg font-medium text-gray-100">
                          {user.cycleParticipations.filter(p => p.cycle.state === 'active').length}
                        </p>
                      </div>
                      
                      {/* Only allow role changes if user is founder, or if target is not founder */}
                      {(isFounder || user.profile.role !== 'founder') && (
                        <button
                          onClick={() => openRoleModal(user)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg 
                            font-medium transition-colors flex items-center gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          Change Role
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Permissions Preview */}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-sm font-medium text-gray-300 mb-2">Current Permissions:</p>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSIONS[user.profile.role as keyof typeof PERMISSIONS]?.slice(0, 3).map((permission, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">
                          {permission}
                        </span>
                      ))}
                      {PERMISSIONS[user.profile.role as keyof typeof PERMISSIONS]?.length > 3 && (
                        <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">
                          +{PERMISSIONS[user.profile.role as keyof typeof PERMISSIONS].length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No users found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-gray-100">Change User Role</h3>
              <p className="text-gray-400 text-sm mt-1">
                User: {selectedUser.name || selectedUser.email}
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-4">Select new role:</p>
                <div className="space-y-3">
                  {ROLES.map((role) => {
                    const IconComponent = role.icon;
                    const isDisabled = !isFounder && role.value === 'founder';
                    
                    return (
                      <label
                        key={role.value}
                        className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                          newRole === role.value
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={newRole === role.value}
                          onChange={(e) => setNewRole(e.target.value)}
                          disabled={isDisabled}
                          className="sr-only"
                        />
                        <div className={`p-2 rounded-full ${role.bgColor} mr-4`}>
                          <IconComponent className={`w-5 h-5 ${role.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-100">{role.label}</h4>
                            {newRole === role.value && (
                              <Check className="w-4 h-4 text-indigo-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{role.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Permissions Preview */}
              {newRole && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-3">
                    Permissions for {ROLES.find(r => r.value === newRole)?.label}:
                  </p>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <ul className="space-y-1">
                      {PERMISSIONS[newRole as keyof typeof PERMISSIONS]?.map((permission, index) => (
                        <li key={index} className="text-sm text-gray-300 flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-400" />
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => { setShowRoleModal(false); setModalError(null); }}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              {modalError && (
                <span className="text-sm text-red-400 flex-1 text-right mr-2">{modalError}</span>
              )}
              <button
                onClick={handleRoleChange}
                disabled={submitting || !newRole || newRole === selectedUser.profile.role}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg 
                  font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}