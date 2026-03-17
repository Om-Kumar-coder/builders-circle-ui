'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import {
  User, Shield, Bell, Save, Key, ShieldCheck, ShieldOff,
  Monitor, LogOut, RefreshCw, CheckCircle, AlertTriangle,
  ShieldAlert, Smartphone, MapPin, FileText,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import ActiveSessionsModal from '@/components/settings/ActiveSessionsModal';
import TwoFactorSetup from '@/components/settings/TwoFactorSetup';
import ReAuthModal from '@/components/settings/ReAuthModal';
import AgreementViewerModal from '@/components/agreements/AgreementViewerModal';
import AccessOverviewWidget from '@/components/auth/AccessOverviewWidget';

type NotificationPrefs = {
  stallWarnings: boolean;
  activityReminders: boolean;
  cycleUpdates: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  stallWarnings: true,
  activityReminders: true,
  cycleUpdates: true,
};

type SecurityStrength = 'Weak' | 'Medium' | 'Strong';

function getSecurityStrength(twoFa: boolean, sessionCount: number): SecurityStrength {
  if (twoFa && sessionCount <= 2) return 'Strong';
  if (twoFa) return 'Medium';
  return 'Weak';
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading, logout } = useAuth();

  // Notification prefs
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [activeSessionCount, setActiveSessionCount] = useState(0);
  const [lastLogin] = useState<string>(new Date().toISOString());

  // Security events
  const [securityEvents, setSecurityEvents] = useState<Array<{
    id: string; eventType: string; ipAddress: string | null;
    userAgent: string | null; createdAt: string;
  }>>([]);

  // Modals
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [reAuthCallback, setReAuthCallback] = useState<(() => void) | null>(null);
  const [showAgreementModal, setShowAgreementModal] = useState(false);

  // Agreement status
  const [agreementStatus, setAgreementStatus] = useState<{
    hasAccepted: boolean;
    acceptedVersion: string | null;
    currentVersion: string | null;
  } | null>(null);

  // Change password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  // Email verification
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadSessionCount = useCallback(async () => {
    try {
      const sessions = await apiClient.listSessions();
      setActiveSessionCount(sessions.filter((s: { sessionEnd: string | null }) => !s.sessionEnd).length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTwoFactorEnabled((user as any).twoFactorEnabled ?? false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEmailVerified((user as any).emailVerified ?? false);
    loadSessionCount();
    apiClient.getSecurityEvents().then(setSecurityEvents).catch(() => {});
    apiClient.getAgreementUserStatus().then(setAgreementStatus).catch(() => {});
  }, [user, loadSessionCount]);

  useEffect(() => {
    if (!user) return;
    apiClient.getNotificationPreferences()
      .then(prefs => setNotifications(prefs))
      .catch(() => {/* keep defaults */});
  }, [user]);

  const securityStrength = getSecurityStrength(twoFactorEnabled, activeSessionCount);
  const strengthColor = securityStrength === 'Strong' ? 'text-green-400 bg-green-500/10 border-green-500/30'
    : securityStrength === 'Medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await apiClient.updateNotificationPreferences(notifications);
      showToast('Preferences saved');
    } catch {
      showToast('Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setVerificationMessage('');
    try {
      await apiClient.resendVerificationEmail(user!.email);
      setVerificationMessage('Verification email sent!');
    } catch {
      setVerificationMessage('Failed to send email');
    } finally {
      setResendingVerification(false);
      setTimeout(() => setVerificationMessage(''), 4000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match');
      return;
    }
    if (pwForm.next.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    setPwLoading(true);
    try {
      await apiClient.changePassword(pwForm.current, pwForm.next);
      showToast('Password changed. You may need to log in again on other devices.');
      setPwForm({ current: '', next: '', confirm: '' });
      setShowPasswordForm(false);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  function openReAuth(callback: () => void) {
    setReAuthCallback(() => callback);
    setShowReAuthModal(true);
  }

  const handleLogoutAllDevices = () => {
    openReAuth(async () => {
      setShowReAuthModal(false);
      try {
        await apiClient.endAllOtherSessions();
        await loadSessionCount();
        showToast('Logged out of all other devices');
      } catch {
        showToast('Failed to logout devices', 'error');
      }
    });
  };

  if (authLoading) return <LoadingScreen />;

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
      {toast && <Toast message={toast.message} type={toast.type} />}

      {showSessionsModal && (
        <ActiveSessionsModal onClose={() => { setShowSessionsModal(false); loadSessionCount(); }} />
      )}
      {show2FAModal && (
        <TwoFactorSetup
          enabled={twoFactorEnabled}
          onClose={() => setShow2FAModal(false)}
          onToggled={(val) => {
            setTwoFactorEnabled(val);
            showToast(val ? '2FA enabled' : '2FA disabled');
          }}
        />
      )}
      {showReAuthModal && reAuthCallback && (
        <ReAuthModal
          title="Confirm your identity"
          description="Enter your password to proceed."
          onSuccess={reAuthCallback}
          onClose={() => setShowReAuthModal(false)}
        />
      )}
      {showAgreementModal && (
        <AgreementViewerModal onClose={() => setShowAgreementModal(false)} />
      )}

      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
        {/* Page Header with security badge */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Settings</h1>
            <p className="text-gray-400 mt-1">Manage your profile and preferences</p>
          </div>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${strengthColor}`}>
            Security: {securityStrength}
          </span>
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input type="text" value={user.name || ''} readOnly disabled
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input type="email" value={user.email || ''} readOnly disabled
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
              <input type="text" value={user.role || 'member'} readOnly disabled
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 capitalize disabled:opacity-50 disabled:cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">Contact an admin to change your role</p>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100">Security</h2>
          </div>

          {/* Security Status Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6 mt-4">
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-center">
              <div className={`text-xs font-medium mb-1 ${twoFactorEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {twoFactorEnabled ? '2FA On' : '2FA Off'}
              </div>
              <div className={`w-2 h-2 rounded-full mx-auto ${twoFactorEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-center">
              <div className="text-xs font-medium text-gray-300 mb-1">{activeSessionCount} session{activeSessionCount !== 1 ? 's' : ''}</div>
              <div className="text-xs text-gray-500">active</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 text-center">
              <div className="text-xs font-medium text-gray-300 mb-1">Last login</div>
              <div className="text-xs text-gray-500">{new Date(lastLogin).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Email verification banner */}
            {!emailVerified && (
              <div className="flex items-center justify-between p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <div>
                  <p className="text-sm font-medium text-yellow-300">Email not verified</p>
                  <p className="text-xs text-yellow-500/80">Verify your email to secure your account</p>
                  {verificationMessage && <p className="text-xs text-green-400 mt-1">{verificationMessage}</p>}
                </div>
                <button onClick={handleResendVerification} disabled={resendingVerification}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {resendingVerification ? 'Sending...' : 'Resend'}
                </button>
              </div>
            )}

            {/* Change Password */}
            <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">Change Password</p>
                    <p className="text-xs text-gray-500">Update your account password</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowPasswordForm(v => !v); setPwError(''); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  {showPasswordForm ? 'Cancel' : 'Change'}
                </button>
              </div>

              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3 border-t border-gray-700/50 pt-4">
                  {pwError && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                      {pwError}
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder="Current password"
                    value={pwForm.current}
                    onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={pwForm.next}
                    onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {pwLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}
            </div>

            {/* Two-Factor Authentication */}
            <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {twoFactorEnabled
                    ? <ShieldCheck className="w-5 h-5 text-green-400" />
                    : <ShieldOff className="w-5 h-5 text-gray-400" />
                  }
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-200">Two-Factor Authentication</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        twoFactorEnabled
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}>
                        {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {twoFactorEnabled ? 'Your account is protected with 2FA' : 'Add an extra layer of security'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShow2FAModal(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    twoFactorEnabled
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Active Sessions</p>
                  <p className="text-xs text-gray-500">{activeSessionCount} active session{activeSessionCount !== 1 ? 's' : ''} · manage your devices</p>
                </div>
              </div>
              <button
                onClick={() => setShowSessionsModal(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                Manage
              </button>
            </div>

            {/* Security Actions */}
            <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
              <p className="text-sm font-medium text-gray-300 mb-3">Security Actions</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => openReAuth(() => { setShowReAuthModal(false); showToast('Identity confirmed'); })}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-authenticate
                </button>
                <button
                  onClick={handleLogoutAllDevices}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout all devices
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security Alerts Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Security Alerts</h2>
              <p className="text-xs text-gray-500 mt-0.5">Recent security events on your account</p>
            </div>
          </div>

          {securityEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No security events recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {securityEvents.map(ev => {
                const label: Record<string, string> = {
                  new_login: 'Login',
                  new_device: 'New device login',
                  password_changed: 'Password changed',
                  '2fa_enabled': '2FA enabled',
                  '2fa_disabled': '2FA disabled',
                  reauth: 'Re-authentication',
                  role_change: 'Role changed',
                };
                const color: Record<string, string> = {
                  new_device: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
                  password_changed: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
                  '2fa_disabled': 'text-red-400 bg-red-500/10 border-red-500/30',
                  '2fa_enabled': 'text-green-400 bg-green-500/10 border-green-500/30',
                  new_login: 'text-gray-400 bg-gray-700/50 border-gray-600/50',
                  reauth: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                  role_change: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
                };
                const cls = color[ev.eventType] ?? color.new_login;
                const ua = ev.userAgent ?? '';
                const deviceHint = ua.includes('Mobile') ? 'Mobile' : ua.includes('Tablet') ? 'Tablet' : ua ? 'Desktop' : null;

                return (
                  <div key={ev.id} className={`flex items-start gap-3 p-3 rounded-lg border ${cls}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {ev.eventType === 'new_device' ? (
                        <Smartphone className="w-4 h-4" />
                      ) : ev.eventType.startsWith('2fa') ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : ev.eventType === 'password_changed' ? (
                        <Key className="w-4 h-4" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{label[ev.eventType] ?? ev.eventType}</p>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {ev.ipAddress && (
                          <span className="text-xs opacity-70">IP: {ev.ipAddress}</span>
                        )}
                        {deviceHint && (
                          <span className="text-xs opacity-70">{deviceHint}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs opacity-60 flex-shrink-0">
                      {new Date(ev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Bell className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100">Notifications</h2>
          </div>
          <div className="space-y-4">
            {(
              [
                { key: 'stallWarnings', label: 'Stall Warnings', desc: 'Get notified when your activity drops' },
                { key: 'activityReminders', label: 'Activity Reminders', desc: 'Reminders to submit your work' },
                { key: 'cycleUpdates', label: 'Cycle Updates', desc: 'Updates about build cycles' },
              ] as const
            ).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div>
                  <p className="text-sm font-medium text-gray-200">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{ minHeight: '24px', minWidth: '44px', height: '24px', width: '44px', padding: 0 }}
                  className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                    notifications[key] ? 'bg-indigo-600' : 'bg-gray-700'
                  }`}
                >
                  <span className={`pointer-events-none absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    notifications[key] ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveNotifications}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Access Overview */}
        <AccessOverviewWidget />

        {/* Agreements Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Agreements</h2>
              <p className="text-xs text-gray-500 mt-0.5">Your legal agreements and acceptance history</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div>
              <p className="text-sm font-medium text-gray-200">Current Agreement</p>
              {agreementStatus ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">
                    {agreementStatus.currentVersion ?? 'No active agreement'}
                  </span>
                  {agreementStatus.currentVersion && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      agreementStatus.hasAccepted
                        ? 'bg-green-500/10 text-green-400 border-green-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}>
                      {agreementStatus.hasAccepted ? 'Accepted' : 'Not accepted'}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Loading...</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAgreementModal(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                View Agreement
              </button>
            </div>
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
                {new Date(user.createdAt || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Email Verified</span>
              <span className={`flex items-center gap-1.5 text-sm font-medium ${emailVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                {emailVerified ? <><CheckCircle className="w-4 h-4" /> Verified</> : <><AlertTriangle className="w-4 h-4" /> Not verified</>}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-400">Account Status</span>
              <span className={`text-sm font-medium ${user.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                {user.status === 'active' ? 'Active' : user.status || 'Unknown'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
