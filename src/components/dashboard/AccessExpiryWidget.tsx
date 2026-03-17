'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ShieldOff, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

interface AccessGrant {
  id: string;
  type: string;
  value: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

function getDaysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function AccessExpiryWidget() {
  const { user } = useAuth();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiClient.adminGetAccessGrants(user.id)
      .then(setGrants)
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, [user]);

  const now = new Date();
  const active = grants.filter(g => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > now));
  const expiring = active
    .filter(g => g.expiresAt)
    .map(g => ({ ...g, daysLeft: getDaysUntil(g.expiresAt!) }))
    .filter(g => g.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-gray-200">Access Expiry</h3>
        {expiring.length > 0 && (
          <span className="ml-auto text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-800/50 px-2 py-0.5 rounded-full">
            {expiring.length} expiring soon
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-9 bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      ) : expiring.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-green-400 py-2">
          <CheckCircle className="w-4 h-4" />
          <span>No access expiring in the next 14 days</span>
        </div>
      ) : (
        <div className="space-y-2">
          {expiring.map(g => {
            const urgent = g.daysLeft <= 2;
            const warning = g.daysLeft <= 7;
            return (
              <div
                key={g.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm
                  ${urgent
                    ? 'bg-red-900/20 border-red-800/40'
                    : warning
                    ? 'bg-yellow-900/20 border-yellow-800/40'
                    : 'bg-gray-800/60 border-gray-700/50'}`}
              >
                <div className="flex items-center gap-2">
                  {urgent
                    ? <ShieldOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  <span className={`font-medium capitalize ${urgent ? 'text-red-300' : warning ? 'text-yellow-300' : 'text-gray-300'}`}>
                    {g.type.replace(/_/g, ' ')}
                  </span>
                  {g.value && <span className="text-gray-500 text-xs">· {g.value}</span>}
                </div>
                <span className={`text-xs font-medium ${urgent ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {g.daysLeft === 0 ? 'Today' : g.daysLeft === 1 ? 'Tomorrow' : `${g.daysLeft}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && active.length > 0 && (
        <p className="text-xs text-gray-500">
          {active.length} active grant{active.length !== 1 ? 's' : ''} total
        </p>
      )}
    </div>
  );
}
