'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCycles } from '@/hooks/useCycles';
import { useActivity } from '@/hooks/useActivity';
import { useOwnershipData } from '@/hooks/useOwnershipData';
import { useCycle } from '@/context/CycleContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import { ACTIVITY_TYPE_LABELS, STATUS_CONFIG } from '@/types/activity';
import type { ActivityEvent } from '@/types/activity';
import {
  User, Mail, Shield, Calendar, Hash, CheckCircle, Clock,
  Zap, Activity, TrendingUp, Star, Users, BarChart3,
  ChevronRight, AlertTriangle, Percent,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const roleColors: Record<string, string> = {
  founder:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin:       'bg-red-500/20    text-red-400    border-red-500/30',
  contributor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  employee:    'bg-blue-500/20   text-blue-400   border-blue-500/30',
  observer:    'bg-gray-500/20   text-gray-400   border-gray-500/30',
};

const stallColors: Record<string, string> = {
  none:        'text-green-400',
  grace:       'text-yellow-400',
  active:      'text-orange-400',
  at_risk:     'text-red-400',
  diminishing: 'text-red-500',
  paused:      'text-gray-400',
};

const TABS = ['Overview', 'Activity', 'Participation', 'Earnings'] as const;
type Tab = typeof TABS[number];

// ── stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-indigo-400' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-gray-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-100">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { activeCycle } = useCycle();
  const { cycles: _cycles } = useCycles();
  const cycleId = activeCycle?.id ?? '';

  const { activities, loading: actLoading } = useActivity(user?.id ?? '', cycleId);
  const { data: ownership, loading: ownLoading } = useOwnershipData(user?.id ?? '', cycleId);

  const [reputation, setReputation]       = useState<Record<string, number> | null>(null);
  const [participations, setParticipations] = useState<Record<string, unknown>[]>([]);
  const [ledger, setLedger]               = useState<Record<string, unknown>[]>([]);
  const [tab, setTab]                     = useState<Tab>('Overview');
  const [extraLoading, setExtraLoading]   = useState(true);

  const fetchExtra = useCallback(async () => {
    if (!user?.id) return;
    setExtraLoading(true);
    try {
      const [rep, parts] = await Promise.allSettled([
        apiClient.getUserReputation(user.id),
        apiClient.getUserParticipations(user.id),
      ]);
      if (rep.status === 'fulfilled')   setReputation(rep.value);
      if (parts.status === 'fulfilled') setParticipations(parts.value ?? []);

      if (cycleId) {
        const own = await apiClient.getOwnership(user.id, cycleId).catch(() => null);
        setLedger(own?.entries ?? []);
      }
    } finally {
      setExtraLoading(false);
    }
  }, [user?.id, cycleId]);

  useEffect(() => { fetchExtra(); }, [fetchExtra]);

  if (authLoading) return <LoadingScreen />;
  if (!user) return (
    <MainLayout title="Profile">
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Please log in to view your profile.</p>
      </div>
    </MainLayout>
  );

  const initials  = user.name ? getInitials(user.name) : user.email[0].toUpperCase();
  const roleClass = roleColors[user.role ?? 'observer'] ?? roleColors.observer;
  const joinDate  = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const isAdmin = user.role === 'admin' || user.role === 'founder';

  // derived stats
  const verified   = activities.filter(a => a.status === 'verified').length;
  const pending    = activities.filter(a => a.status === 'pending').length;
  const totalHours = activities.reduce((s, a) => s + (a.hoursLogged ?? 0), 0);
  const reputationScore = (reputation as Record<string, number>)?.reputationScore ?? (reputation as Record<string, number>)?.score ?? null;
  const cyclesJoined    = participations.length;
  const cyclesCompleted = participations.filter((p: Record<string, unknown>) => (p.cycle as Record<string, unknown>)?.state === 'closed').length;

  return (
    <MainLayout title="Profile">
      <div className="max-w-5xl space-y-6 animate-in fade-in duration-300">

        {/* ── Profile Header ─────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600
              flex items-center justify-center flex-shrink-0">
              <span className="text-white text-3xl font-semibold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-100 truncate">{user.name || 'Unnamed User'}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
              {user.bio && <p className="text-sm text-gray-300 mt-2 leading-relaxed">{user.bio}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${roleClass}`}>
                  {user.role ?? 'observer'}
                </span>
                <span className={`flex items-center gap-1 text-xs ${user.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {user.status === 'active'
                    ? <><CheckCircle className="w-3 h-3" />Active</>
                    : <><Clock className="w-3 h-3" />{user.status ?? 'Unknown'}</>}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />Joined {joinDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Zap}       label="Cycles Joined"    value={cyclesJoined}    color="text-indigo-400" />
          <StatCard icon={CheckCircle} label="Cycles Completed" value={cyclesCompleted} color="text-green-400" />
          <StatCard icon={Activity}  label="Activities"       value={activities.length} sub={`${verified} verified`} color="text-yellow-400" />
          <StatCard icon={Star}      label="Reputation"
            value={reputationScore !== null ? reputationScore.toFixed(1) : '—'}
            color="text-purple-400" />
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ───────────────────────────────────────────────── */}
        {tab === 'Overview' && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Account Details */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-1">
              <h2 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />Account Details
              </h2>
              {[
                { icon: Mail,     label: 'Email',   value: user.email },
                { icon: Shield,   label: 'Role',    value: user.role ?? 'observer', capitalize: true },
                { icon: Calendar, label: 'Joined',  value: joinDate },
                { icon: Hash,     label: 'User ID', value: user.id, mono: true },
              ].map(({ icon: Icon, label, value, capitalize, mono }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
                  <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm text-gray-400 w-20 flex-shrink-0">{label}</span>
                  <span className={`text-sm text-gray-200 truncate ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Ownership snapshot */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Percent className="w-4 h-4 text-gray-400" />Ownership Snapshot
                {activeCycle && <span className="text-xs text-gray-500 font-normal">({activeCycle.name})</span>}
              </h2>
              {ownLoading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => (
                  <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
                ))}</div>
              ) : ownership ? (
                <div className="space-y-3">
                  {[
                    { label: 'Vested',      value: ownership.vested,      color: 'bg-green-500' },
                    { label: 'Provisional', value: ownership.provisional, color: 'bg-yellow-500' },
                    { label: 'Effective',   value: ownership.effective,   color: 'bg-indigo-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{label}</span><span>{value.toFixed(3)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(value * 10, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-2 border-t border-gray-800">
                    <span className="text-gray-400">Multiplier</span>
                    <span className="text-indigo-400 font-medium">{ownership.multiplier.toFixed(1)}×</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No ownership data for active cycle.</p>
              )}
            </div>

            {/* Reputation breakdown */}
            {reputation && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:col-span-2">
                <h2 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-400" />Reputation Breakdown
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Score',        value: (reputation as Record<string, number>).reputationScore?.toFixed(1) ?? '—' },
                    { label: 'Verified',     value: (reputation as Record<string, number>).verifiedActivities ?? '—' },
                    { label: 'Consistency',  value: (reputation as Record<string, number>).consistencyScore != null ? `${((reputation as Record<string, number>).consistencyScore * 100).toFixed(0)}%` : '—' },
                    { label: 'Hours Logged', value: (reputation as Record<string, number>).totalHoursLogged ?? totalHours },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-800/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-semibold text-gray-100">{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Activity Tab ───────────────────────────────────────────────── */}
        {tab === 'Activity' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />Activity Timeline
              </h2>
              <div className="flex gap-3 text-xs text-gray-400">
                <span className="text-green-400">{verified} verified</span>
                <span className="text-yellow-400">{pending} pending</span>
              </div>
            </div>
            {actLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => (
                <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
              ))}</div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No activities yet for this cycle.</p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 20).map((a: ActivityEvent) => {
                  const cfg = STATUS_CONFIG[a.status];
                  return (
                    <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bgColor}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.color.replace('text-', 'bg-')}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {ACTIVITY_TYPE_LABELS[a.contributionType as keyof typeof ACTIVITY_TYPE_LABELS] ?? a.activityType}
                          </span>
                          <span className={`text-xs flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {a.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{a.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                          {a.hoursLogged && <span>{a.hoursLogged}h</span>}
                          {a.calculatedOwnership > 0 && <span className="text-indigo-400">+{a.calculatedOwnership.toFixed(4)}%</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Participation Tab ──────────────────────────────────────────── */}
        {tab === 'Participation' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-gray-100 mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />Participation History
            </h2>
            {extraLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => (
                <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse" />
              ))}</div>
            ) : participations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No cycle participations found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-3 font-medium">Cycle</th>
                      <th className="text-left pb-3 font-medium">Status</th>
                      <th className="text-left pb-3 font-medium">Stall Stage</th>
                      <th className="text-left pb-3 font-medium">Last Activity</th>
                      <th className="text-left pb-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {participations.map((p: Record<string, unknown>) => (
                      <tr key={p.id as string} className="text-gray-300">
                        <td className="py-3 font-medium text-gray-100">{(p.cycle as Record<string, unknown>)?.name as string ?? '—'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                            p.participationStatus === 'active' ? 'bg-green-500/20 text-green-400' :
                            p.participationStatus === 'at-risk' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>{p.participationStatus as string}</span>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs capitalize ${stallColors[p.stallStage as string] ?? 'text-gray-400'}`}>
                            {p.stallStage === 'none' ? '✓ Good' : p.stallStage as string}
                          </span>
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {p.lastActivityDate ? new Date(p.lastActivityDate as string).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {new Date(p.createdAt as string).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Earnings Tab ───────────────────────────────────────────────── */}
        {tab === 'Earnings' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Percent}    label="Vested"      value={ownership ? `${ownership.vested.toFixed(3)}%` : '—'}      color="text-green-400" />
              <StatCard icon={TrendingUp} label="Provisional" value={ownership ? `${ownership.provisional.toFixed(3)}%` : '—'} color="text-yellow-400" />
              <StatCard icon={Zap}        label="Effective"   value={ownership ? `${ownership.effective.toFixed(3)}%` : '—'}   color="text-indigo-400" />
              <StatCard icon={Star}       label="Multiplier"  value={ownership ? `${ownership.multiplier.toFixed(1)}×` : '—'}  color="text-purple-400" />
            </div>

            {/* Ledger */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-gray-100 mb-5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />Ownership Ledger
              </h2>
              {extraLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => (
                  <div key={i} className="h-12 bg-gray-800 rounded-xl animate-pulse" />
                ))}</div>
              ) : ledger.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No ledger entries for this cycle.</p>
              ) : (
                <div className="space-y-2">
                  {ledger.map((e: Record<string, unknown>) => (
                    <div key={e.id as string} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                      <div>
                        <p className="text-sm text-gray-200 capitalize">{(e.eventType as string)?.replace(/_/g, ' ')}</p>
                        {e.reason && <p className="text-xs text-gray-500 mt-0.5">{e.reason as string}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${(e.ownershipAmount as number) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(e.ownershipAmount as number) >= 0 ? '+' : ''}{(e.ownershipAmount as number).toFixed(4)}%
                        </p>
                        <p className="text-xs text-gray-500">{new Date(e.createdAt as string).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Admin Panel ────────────────────────────────────────────────── */}
        {isAdmin && (
          <div className="bg-gray-900 border border-red-900/40 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-red-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />Admin Controls
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Manage Roles',     href: '/admin/roles',           icon: Users },
                { label: 'Activity Review',  href: '/admin/activity-review', icon: CheckCircle },
                { label: 'Audit Logs',       href: '/admin/audit',           icon: Clock },
                { label: 'Overrides',        href: '/admin/overrides',       icon: AlertTriangle },
              ].map(({ label, href, icon: Icon }) => (
                <a key={href} href={href}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl
                    hover:bg-gray-800 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
