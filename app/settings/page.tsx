'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { User, Shield, Bell, Save, Key } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  
  // Notification preferences state
  const [notifications, setNotifications] = useState({
    stallWarnings: true,
    activityReminders: true,
    cycleUpdates: true,
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSaveNotifications = async () => {
    setSaving(true);
    setSaveMessage('');
    
    try {
      // TODO: Implement actual save to database
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveMessage('Preferences saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Settings">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view settings.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Settings">
      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your profile and preferences</p>
        </div>

        {/* Profile Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100">Profile</h2>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={user.name || ''}
                readOnly
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg 
                  text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed"
                disabled
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email || ''}
                readOnly
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg 
                  text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed"
                disabled
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <input
                type="text"
                value={user.role || 'member'}
                readOnly
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg 
                  text-gray-300 capitalize disabled:opacity-50 disabled:cursor-not-allowed"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                Contact an admin to change your role
              </p>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100">Security</h2>
          </div>

          <div className="space-y-4">
            {/* Change Password */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Change Password</p>
                  <p className="text-xs text-gray-500">Update your account password</p>
                </div>
              </div>
              <button
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg 
                  text-sm font-medium transition-colors"
                onClick={() => alert('Password change functionality coming soon!')}
              >
                Change
              </button>
            </div>

            {/* Active Sessions */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div>
                <p className="text-sm font-medium text-gray-200">Active Sessions</p>
                <p className="text-xs text-gray-500">Manage your active login sessions</p>
              </div>
              <button
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg 
                  text-sm font-medium transition-colors"
                onClick={() => alert('Session management coming soon!')}
              >
                View
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Bell className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100">Notifications</h2>
          </div>

          <div className="space-y-4">
            {/* Stall Warnings */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div>
                <p className="text-sm font-medium text-gray-200">Stall Warnings</p>
                <p className="text-xs text-gray-500">Get notified when your activity drops</p>
              </div>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, stallWarnings: !prev.stallWarnings }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.stallWarnings ? 'bg-indigo-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.stallWarnings ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Activity Reminders */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div>
                <p className="text-sm font-medium text-gray-200">Activity Reminders</p>
                <p className="text-xs text-gray-500">Reminders to submit your work</p>
              </div>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, activityReminders: !prev.activityReminders }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.activityReminders ? 'bg-indigo-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.activityReminders ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Cycle Updates */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div>
                <p className="text-sm font-medium text-gray-200">Cycle Updates</p>
                <p className="text-xs text-gray-500">Updates about build cycles</p>
              </div>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, cycleUpdates: !prev.cycleUpdates }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications.cycleUpdates ? 'bg-indigo-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications.cycleUpdates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex items-center justify-between">
            {saveMessage && (
              <p className={`text-sm ${saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                {saveMessage}
              </p>
            )}
            <button
              onClick={handleSaveNotifications}
              disabled={saving}
              className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 
                text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Account Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">User ID</span>
              <span className="text-gray-300 font-mono text-xs">{user.id}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Account Created</span>
              <span className="text-gray-300">
                {new Date(user.createdAt || '').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-400">Account Status</span>
              <span className={`text-sm font-medium ${user.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                {user.status === 'active' ? 'Active' : user.status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
