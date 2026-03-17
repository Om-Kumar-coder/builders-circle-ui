'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Notice {
  id: string;
  type: 'warning' | 'info' | 'critical';
  message: string;
  dismissible?: boolean;
}

function buildNotices(user: { twoFactorEnabled?: boolean; emailVerified?: boolean; role?: string } | null): Notice[] {
  if (!user) return [];
  const notices: Notice[] = [];

  if (!user.twoFactorEnabled) {
    notices.push({
      id: '2fa',
      type: 'warning',
      message: '2FA is not enabled. Enable it in Settings to secure your account.',
      dismissible: false,
    });
  }

  if (!user.emailVerified) {
    notices.push({
      id: 'email',
      type: 'warning',
      message: 'Your email address is not verified.',
      dismissible: false,
    });
  }

  if (user.twoFactorEnabled && user.emailVerified) {
    notices.push({
      id: 'secure',
      type: 'info',
      message: 'Your account security is up to date.',
      dismissible: true,
    });
  }

  return notices;
}

const typeConfig = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-900/20 border-red-800/40',
    text: 'text-red-300',
    icon_color: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-yellow-900/20 border-yellow-800/40',
    text: 'text-yellow-300',
    icon_color: 'text-yellow-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-900/20 border-blue-800/40',
    text: 'text-blue-300',
    icon_color: 'text-blue-400',
  },
};

export default function SecurityNoticesWidget() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    setNotices(buildNotices(user));
  }, [user]);

  const visible = notices.filter(n => !dismissed.has(n.id));

  if (visible.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-gray-200">Security Notices</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-400 py-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>No security notices</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-gray-200">Security Notices</h3>
        <span className="ml-auto text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800/50 px-2 py-0.5 rounded-full">
          {visible.length}
        </span>
      </div>

      <div className="space-y-2">
        {visible.map(notice => {
          const cfg = typeConfig[notice.type];
          const Icon = cfg.icon;
          return (
            <div
              key={notice.id}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${cfg.bg}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.icon_color}`} />
              <span className={`flex-1 ${cfg.text}`}>{notice.message}</span>
              {notice.dismissible && (
                <button
                  onClick={() => setDismissed(prev => new Set([...prev, notice.id]))}
                  className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
