'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../../src/components/layout/MainLayout';
import { apiClient } from '../../../src/lib/api-client';
import {
  BarChart2, ChevronLeft, RefreshCw, Users, FileText, Activity,
  Layers, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle,
  AlertCircle, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '../../../src/hooks/usePermissions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DailyReport {
  id: string;
  reportDate: string;
  newSignups: number;
  approvedUsers: number;
  rejectedUsers: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  pendingSubmissions: number;
  activeContributors: number;
  inactiveContributors: number;
  openCycles: number;
  pendingReviews: number;
  flaggedItems: number;
  generatedAt: string;
  metadata?: string;
}

interface ReportDetail {
  date: string;
  approvedTriages: Array<{ id: string; name: string; email: string; roleType: string; reviewedAt: string }>;
  rejectedTriages: Array<{ id: string; name: string; email: string; roleType: string; reviewedAt: string; rejectionNote?: string }>;
  verifiedActivities: Array<{
    id: string; contributionType: string; hoursLogged?: number; calculatedOwnership?: number;
    verifiedAt: string; proofLink: string;
    user: { id: string; name?: string; email: string };
    verifier?: { id: string; name?: string; email: string };
    linkedTask?: { id: string; title: string };
  }>;
  rejectedActivities: Array<{
    id: string; contributionType: string; hoursLogged?: number; verifiedAt: string;
    rejectionReason?: string; proofLink: string;
    user: { id: string; name?: string; email: string };
    verifier?: { id: string; name?: string; email: string };
  }>;
  changesRequestedActivities: Array<{
    id: string; contributionType: string; hoursLogged?: number; verifiedAt: string;
    rejectionReason?: string;
    user: { id: string; name?: string; email: string };
  }>;
  newTriages: Array<{ id: string; name: string; email: string; roleType: string; status: string; createdAt: string }>;
}

// ── Delta helpers ─────────────────────────────────────────────────────────────

function getDelta(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  return current - previous;
}

function DeltaBadge({ delta, invertColor = false }: { delta: number | null; invertColor?: boolean }) {
  if (delta === null) return <span className="text-gray-600 text-xs">—</span>;
  if (delta === 0) return <span className="inline-flex items-center gap-0.5 text-gray-500 text-xs"><Minus className="w-3 h-3" /> 0</span>;
  const isPositive = delta > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? '+' : ''}{delta}
    </span>
  );
}

function StatCell({ label, value, color = 'text-white', delta, invertColor = false }: {
  label: string; value: number; color?: string; delta: number | null; invertColor?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <DeltaBadge delta={delta} invertColor={invertColor} />
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function parseMetadata(raw?: string): { aiAutoBlocked?: number; aiAutoPass?: number; aiFallback?: number } {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function toDateParam(reportDate: string) {
  const d = new Date(reportDate);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ detail, loading }: { detail: ReportDetail | null; loading: boolean }) {
  if (loading) return <div className="text-center py-6 text-gray-400 text-sm">Loading details...</div>;
  if (!detail) return null;

  const hasAnything =
    detail.newTriages.length > 0 ||
    detail.approvedTriages.length > 0 ||
    detail.rejectedTriages.length > 0 ||
    detail.verifiedActivities.length > 0 ||
    detail.rejectedActivities.length > 0 ||
    detail.changesRequestedActivities.length > 0;

  if (!hasAnything) {
    return <div className="text-center py-4 text-gray-500 text-sm">No activity records found for this day.</div>;
  }

  return (
    <div className="space-y-5">

      {/* New signups */}
      {detail.newTriages.length > 0 && (
        <Section icon={<Users className="w-3.5 h-3.5 text-blue-400" />} title="New Applications" count={detail.newTriages.length} color="text-blue-400">
          {detail.newTriages.map(t => (
            <Row key={t.id}
              left={<><span className="text-white font-medium">{t.name}</span><span className="text-gray-500 ml-2 text-xs">{t.email}</span></>}
              right={<>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{t.roleType}</span>
                <StatusPill status={t.status} />
                <span className="text-gray-500 text-xs">{fmt(t.createdAt)}</span>
              </>}
            />
          ))}
        </Section>
      )}

      {/* Approved users */}
      {detail.approvedTriages.length > 0 && (
        <Section icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-400" />} title="Approved Applications" count={detail.approvedTriages.length} color="text-emerald-400">
          {detail.approvedTriages.map(t => (
            <Row key={t.id}
              left={<><span className="text-white font-medium">{t.name}</span><span className="text-gray-500 ml-2 text-xs">{t.email}</span></>}
              right={<>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{t.roleType}</span>
                <span className="text-gray-500 text-xs">{fmt(t.reviewedAt)}</span>
              </>}
            />
          ))}
        </Section>
      )}

      {/* Rejected users */}
      {detail.rejectedTriages.length > 0 && (
        <Section icon={<XCircle className="w-3.5 h-3.5 text-red-400" />} title="Rejected Applications" count={detail.rejectedTriages.length} color="text-red-400">
          {detail.rejectedTriages.map(t => (
            <Row key={t.id}
              left={<>
                <span className="text-white font-medium">{t.name}</span>
                <span className="text-gray-500 ml-2 text-xs">{t.email}</span>
                {t.rejectionNote && <span className="text-red-400/70 text-xs ml-2 italic">"{t.rejectionNote}"</span>}
              </>}
              right={<>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{t.roleType}</span>
                <span className="text-gray-500 text-xs">{fmt(t.reviewedAt)}</span>
              </>}
            />
          ))}
        </Section>
      )}

      {/* Verified activities */}
      {detail.verifiedActivities.length > 0 && (
        <Section icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-400" />} title="Verified Activities" count={detail.verifiedActivities.length} color="text-emerald-400">
          {detail.verifiedActivities.map(a => (
            <Row key={a.id}
              left={<>
                <span className="text-white font-medium">{a.user?.name ?? a.user?.email}</span>
                <span className="text-gray-500 ml-2 text-xs capitalize">{a.contributionType.replace('_', ' ')}</span>
                {a.linkedTask && <span className="text-indigo-400 text-xs ml-2">→ {a.linkedTask.title}</span>}
              </>}
              right={<>
                {a.hoursLogged && <span className="text-xs text-gray-400">{a.hoursLogged}h</span>}
                {a.calculatedOwnership != null && a.calculatedOwnership > 0 && (
                  <span className="text-xs text-emerald-400 font-medium">+{a.calculatedOwnership.toFixed(3)} ownership</span>
                )}
                <a href={a.proofLink} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-gray-500 text-xs">{fmt(a.verifiedAt)}</span>
              </>}
            />
          ))}
        </Section>
      )}

      {/* Rejected activities */}
      {detail.rejectedActivities.length > 0 && (
        <Section icon={<XCircle className="w-3.5 h-3.5 text-red-400" />} title="Rejected Activities" count={detail.rejectedActivities.length} color="text-red-400">
          {detail.rejectedActivities.map(a => (
            <Row key={a.id}
              left={<>
                <span className="text-white font-medium">{a.user?.name ?? a.user?.email}</span>
                <span className="text-gray-500 ml-2 text-xs capitalize">{a.contributionType.replace('_', ' ')}</span>
                {a.rejectionReason && <span className="text-red-400/70 text-xs ml-2 italic">"{a.rejectionReason}"</span>}
              </>}
              right={<>
                {a.hoursLogged && <span className="text-xs text-gray-400">{a.hoursLogged}h</span>}
                <a href={a.proofLink} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-gray-500 text-xs">{fmt(a.verifiedAt)}</span>
              </>}
            />
          ))}
        </Section>
      )}

      {/* Changes requested */}
      {detail.changesRequestedActivities.length > 0 && (
        <Section icon={<AlertCircle className="w-3.5 h-3.5 text-amber-400" />} title="Changes Requested" count={detail.changesRequestedActivities.length} color="text-amber-400">
          {detail.changesRequestedActivities.map(a => (
            <Row key={a.id}
              left={<>
                <span className="text-white font-medium">{a.user?.name ?? a.user?.email}</span>
                <span className="text-gray-500 ml-2 text-xs capitalize">{a.contributionType.replace('_', ' ')}</span>
                {a.rejectionReason && <span className="text-amber-400/70 text-xs ml-2 italic">"{a.rejectionReason}"</span>}
              </>}
              right={<>
                {a.hoursLogged && <span className="text-xs text-gray-400">{a.hoursLogged}h</span>}
                <span className="text-gray-500 text-xs">{fmt(a.verifiedAt)}</span>
              </>}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, count, color, children }: {
  icon: React.ReactNode; title: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide mb-2 ${color}`}>
        {icon} {title} <span className="text-gray-600 normal-case font-normal">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-gray-900/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 flex-wrap min-w-0 text-sm">{left}</div>
      <div className="flex items-center gap-2 shrink-0 text-sm">{right}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-gray-700 text-gray-300',
    APPROVED: 'bg-emerald-500/20 text-emerald-400',
    REJECTED: 'bg-red-500/20 text-red-400',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-700 text-gray-300'}`}>{status}</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<Record<string, 'summary' | 'detail'>>({});
  const [detailCache, setDetailCache] = useState<Record<string, ReportDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const { isAdmin, can } = usePermissions();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await apiClient.getDailyReports();
      if (res?.reports) setReports(res.reports);
      else setFetchError(`Unexpected response: ${JSON.stringify(res)}`);
    } catch (e: any) {
      setFetchError(`${e.message ?? 'Failed to load reports'} [${e.status ?? 'no-status'}]`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      await apiClient.generateDailyReport();
      await fetchReports();
    } catch (e: any) {
      setGenerateError(`${e.message ?? 'Generation failed'} [${e.status ?? 'no-status'}]`);
    } finally {
      setGenerating(false);
    }
  };

  const loadDetail = useCallback(async (reportId: string, reportDate: string) => {
    if (detailCache[reportId]) return;
    setDetailLoading(prev => ({ ...prev, [reportId]: true }));
    try {
      const dateParam = toDateParam(reportDate);
      const res = await apiClient.getReportDetail(dateParam);
      setDetailCache(prev => ({ ...prev, [reportId]: res }));
    } catch {
      // leave cache empty — DetailPanel handles null
    } finally {
      setDetailLoading(prev => ({ ...prev, [reportId]: false }));
    }
  }, [detailCache]);

  const handleExpand = (report: DailyReport) => {
    const isOpen = expanded === report.id;
    setExpanded(isOpen ? null : report.id);
    if (!isOpen) {
      // default to summary tab; pre-load detail in background
      setDetailTab(prev => ({ ...prev, [report.id]: prev[report.id] ?? 'summary' }));
      loadDetail(report.id, report.reportDate);
    }
  };

  const switchTab = (reportId: string, tab: 'summary' | 'detail') => {
    setDetailTab(prev => ({ ...prev, [reportId]: tab }));
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/gatekeeper" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <BarChart2 className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Daily Reports</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={fetchReports} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {(isAdmin || can('gatekeeper:reports')) && (
              <button onClick={handleGenerate} disabled={generating}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
                <BarChart2 className="w-3.5 h-3.5" />
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
            )}
          </div>
        </div>

        {fetchError && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
            {fetchError}
          </div>
        )}
        {generateError && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
            {generateError}
          </div>
        )}

        {!loading && reports.length > 1 && (
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 px-1">
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-400" /> increase vs prev day</span>
            <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400" /> decrease vs prev day</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No reports yet. Reports are auto-generated daily at 11:55 PM.</div>
        ) : (
          <div className="space-y-3">
            {reports.map((report, idx) => {
              const prev = reports[idx + 1] as DailyReport | undefined;
              const date = new Date(report.reportDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
              const isOpen = expanded === report.id;
              const meta = parseMetadata(report.metadata);
              const tab = detailTab[report.id] ?? 'summary';

              return (
                <div key={report.id} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                  {/* Collapsed row */}
                  <button onClick={() => handleExpand(report)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-700/30 transition-colors text-left">
                    <div>
                      <span className="text-white font-semibold">{date}</span>
                      <span className="text-gray-500 text-xs ml-3">Generated {new Date(report.generatedAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-5 text-sm">
                      <span className="flex items-center gap-1.5 text-blue-400">
                        {report.newSignups} signups
                        {(() => { const d = getDelta(report.newSignups, prev?.newSignups); return d !== null && d !== 0 ? <span className={`text-xs ${d > 0 ? 'text-emerald-400' : 'text-red-400'}`}>({d > 0 ? '+' : ''}{d})</span> : null; })()}
                      </span>
                      <span className="flex items-center gap-1.5 text-violet-400">
                        {report.totalSubmissions} submissions
                        {(() => { const d = getDelta(report.totalSubmissions, prev?.totalSubmissions); return d !== null && d !== 0 ? <span className={`text-xs ${d > 0 ? 'text-emerald-400' : 'text-red-400'}`}>({d > 0 ? '+' : ''}{d})</span> : null; })()}
                      </span>
                      {report.flaggedItems > 0 && (
                        <span className="flex items-center gap-1.5 text-red-400">
                          {report.flaggedItems} flagged
                          {(() => { const d = getDelta(report.flaggedItems, prev?.flaggedItems); return d !== null && d !== 0 ? <span className={`text-xs ${d > 0 ? 'text-red-400' : 'text-emerald-400'}`}>({d > 0 ? '+' : ''}{d})</span> : null; })()}
                        </span>
                      )}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </button>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t border-gray-700">
                      {/* Tab bar */}
                      <div className="flex border-b border-gray-700">
                        {(['summary', 'detail'] as const).map(t => (
                          <button key={t} onClick={() => switchTab(report.id, t)}
                            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                              tab === t ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                            }`}>
                            {t === 'summary' ? 'Summary' : 'Records'}
                          </button>
                        ))}
                      </div>

                      {/* Summary tab */}
                      {tab === 'summary' && (
                        <div className="px-5 py-5 space-y-5">
                          {prev && <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg px-3 py-2">Comparing to {new Date(prev.reportDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
                          {!prev && <div className="text-xs text-gray-600 bg-gray-900/50 rounded-lg px-3 py-2">No previous report — this is the earliest record.</div>}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide"><Users className="w-3.5 h-3.5" /> User Activity</div>
                              <StatCell label="New Signups" value={report.newSignups} color="text-blue-400" delta={getDelta(report.newSignups, prev?.newSignups)} />
                              <StatCell label="Approved" value={report.approvedUsers} color="text-emerald-400" delta={getDelta(report.approvedUsers, prev?.approvedUsers)} />
                              <StatCell label="Rejected" value={report.rejectedUsers} color="text-red-400" delta={getDelta(report.rejectedUsers, prev?.rejectedUsers)} invertColor />
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide"><FileText className="w-3.5 h-3.5" /> Submissions</div>
                              <StatCell label="Total" value={report.totalSubmissions} delta={getDelta(report.totalSubmissions, prev?.totalSubmissions)} />
                              <StatCell label="Approved" value={report.approvedSubmissions} color="text-emerald-400" delta={getDelta(report.approvedSubmissions, prev?.approvedSubmissions)} />
                              <StatCell label="Rejected" value={report.rejectedSubmissions} color="text-red-400" delta={getDelta(report.rejectedSubmissions, prev?.rejectedSubmissions)} invertColor />
                              <StatCell label="Pending" value={report.pendingSubmissions} color="text-amber-400" delta={getDelta(report.pendingSubmissions, prev?.pendingSubmissions)} invertColor />
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide"><Activity className="w-3.5 h-3.5" /> Contributors</div>
                              <StatCell label="Active (7d)" value={report.activeContributors} color="text-emerald-400" delta={getDelta(report.activeContributors, prev?.activeContributors)} />
                              <StatCell label="Inactive" value={report.inactiveContributors} color="text-gray-400" delta={getDelta(report.inactiveContributors, prev?.inactiveContributors)} invertColor />
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide"><Layers className="w-3.5 h-3.5" /> System Status</div>
                              <StatCell label="Open Cycles" value={report.openCycles} color="text-blue-400" delta={getDelta(report.openCycles, prev?.openCycles)} />
                              <StatCell label="Pending Reviews" value={report.pendingReviews} color="text-amber-400" delta={getDelta(report.pendingReviews, prev?.pendingReviews)} invertColor />
                              <StatCell label="Flagged Items" value={report.flaggedItems} color="text-red-400" delta={getDelta(report.flaggedItems, prev?.flaggedItems)} invertColor />
                            </div>
                          </div>
                          {(meta.aiAutoBlocked !== undefined || meta.aiAutoPass !== undefined || meta.aiFallback !== undefined) && (
                            <div className="border-t border-gray-700/50 pt-4">
                              <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Veronica AI Activity</div>
                              <div className="flex flex-wrap gap-6">
                                {meta.aiAutoPass !== undefined && <div className="text-center"><div className="text-lg font-bold text-emerald-400">{meta.aiAutoPass}</div><div className="text-xs text-gray-500">Auto-passed</div></div>}
                                {meta.aiAutoBlocked !== undefined && <div className="text-center"><div className="text-lg font-bold text-red-400">{meta.aiAutoBlocked}</div><div className="text-xs text-gray-500">Auto-blocked</div></div>}
                                {meta.aiFallback !== undefined && <div className="text-center"><div className="text-lg font-bold text-amber-400">{meta.aiFallback}</div><div className="text-xs text-gray-500">Fallback (rule-based)</div></div>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Records tab */}
                      {tab === 'detail' && (
                        <div className="px-5 py-5">
                          <DetailPanel detail={detailCache[report.id] ?? null} loading={!!detailLoading[report.id]} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
