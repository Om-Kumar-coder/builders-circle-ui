'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  Users,
  Zap,
  Clock,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Target,
  Activity,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Eye,
  Info,
} from 'lucide-react';
import {
  type SubScores,
  type ApplicationScoreItem as ScoreItem,
  type Pagination,
  parseSubScores,
  DIMENSION_LABELS,
  ROUTE_LABELS,
} from '@/types/scoring';

type SortField = 'totalScore' | 'createdAt' | 'routeTag';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatScore(val: number): string {
  return (val * 100).toFixed(0);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPanel() {
  // Leaderboard state
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [sortBy, setSortBy] = useState<SortField>('totalScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected score for detail view
  const [selectedScore, setSelectedScore] = useState<ScoreItem | null>(null);
  const [veronicaDimensions, setVeronicaDimensions] = useState<Record<string, number> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    avgScore: 0,
    fastTrackPct: 0,
    standardPct: 0,
    holdPct: 0,
  });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getApplicationScores({
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder: sortDir,
      });

      const items: ScoreItem[] = (data.scores ?? []).map(s => ({
        id: s.id,
        entryIntakeId: s.entryIntakeId,
        totalScore: s.totalScore,
        subScores: s.subScores,
        routeTag: s.routeTag,
        scoredAt: s.scoredAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        intake: s.intake,
      }));

      setScores(items);
      setPagination(prev => ({ ...prev, ...(data.pagination ?? {}) }));

      // Compute aggregate stats
      const total = data.pagination?.total ?? items.length;
      const avg = items.length > 0
        ? items.reduce((sum: number, s: ScoreItem) => sum + s.totalScore, 0) / items.length
        : 0;
      const ft = items.filter((s: ScoreItem) => s.routeTag === 'fast_track').length;
      const st = items.filter((s: ScoreItem) => s.routeTag === 'standard').length;
      const hl = items.filter((s: ScoreItem) => s.routeTag === 'hold').length;
      const denom = items.length || 1;

      setStats({
        total,
        avgScore: avg,
        fastTrackPct: Math.round((ft / denom) * 100),
        standardPct: Math.round((st / denom) * 100),
        holdPct: Math.round((hl / denom) * 100),
      });
    } catch (err: unknown) {
      console.error('Error fetching scores:', err);
      setError((err as Error).message || 'Failed to fetch scores');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, sortBy, sortDir]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // ── Sort / Pagination helpers ─────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page }));
  };

  // ── Fetch veronica dimensions when a score is selected ─────────────────
  useEffect(() => {
    if (!selectedScore) {
      setVeronicaDimensions(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    apiClient.getApplicationScoreDetail(selectedScore.entryIntakeId)
      .then(data => {
        if (!cancelled) {
          setVeronicaDimensions(data.veronicaDimensions);
        }
      })
      .catch(() => { if (!cancelled) setVeronicaDimensions(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedScore?.entryIntakeId]);

  const handleRowClick = (score: ScoreItem) => {
    setSelectedScore(prev => (prev?.id === score.id ? null : score));
  };

  // ── Filter scores by search term ──────────────────────────────────────────

  const filteredScores = scores.filter(s => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const name = s.intake?.fullName?.toLowerCase() ?? '';
    const email = s.intake?.email?.toLowerCase() ?? '';
    return name.includes(q) || email.includes(q);
  });

  // ── Radar chart data ──────────────────────────────────────────────────────

  const radarData = selectedScore
    ? (Object.keys(DIMENSION_LABELS) as (keyof SubScores)[]).map(key => {
        const sub = parseSubScores(selectedScore.subScores);
        return {
          dimension: DIMENSION_LABELS[key].label,
          value: sub[key] ?? 0,
          fullMark: 1,
        };
      })
    : [];

  // ── Sort indicator ────────────────────────────────────────────────────────

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 ml-1" />;
    return sortDir === 'desc'
      ? <ArrowDown className="w-3.5 h-3.5 text-indigo-400 ml-1" />
      : <ArrowUp className="w-3.5 h-3.5 text-indigo-400 ml-1" />;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : stats.total}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Applications scored</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Avg Score</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : `${formatScore(stats.avgScore)}%`}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Across all applications</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Fast Track</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : `${stats.fastTrackPct}%`}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Of displayed scores</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Standard</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : `${stats.standardPct}%`}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Of displayed scores</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Hold</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">
            {loading ? '—' : `${stats.holdPct}%`}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Of displayed scores</p>
        </div>
      </div>

      {/* ── Main panel: leaderboard + detail ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Leaderboard table — spans 2 cols on large screens */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-100">Score Leaderboard</h2>
              {!loading && (
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {pagination.total} total
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-52 pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={fetchScores}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 bg-gray-800/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{error}</p>
              <button onClick={fetchScores} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 underline">
                Try again
              </button>
            </div>
          ) : filteredScores.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">
              {searchTerm ? 'No results matching your search' : 'No scored applications found'}
            </p>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm ? 'Try adjusting your search term' : 'Applications will appear here once scoring runs'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium w-10">
                      #
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Applicant
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium cursor-pointer select-none" onClick={() => toggleSort('totalScore')}>
                      <div className="flex items-center">
                        Score
                        <SortIcon field="totalScore" />
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium cursor-pointer select-none" onClick={() => toggleSort('routeTag')}>
                      <div className="flex items-center">
                        Route
                        <SortIcon field="routeTag" />
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Intent
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                      <div className="flex items-center">
                        Date
                        <SortIcon field="createdAt" />
                      </div>
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody>                    {filteredScores.map((score, idx) => {
                    const globalRank = (pagination.page - 1) * pagination.limit + idx + 1;
                    const isSelected = selectedScore?.id === score.id;
                    const sub = parseSubScores(score.subScores);

                    return (
                      <tr
                        key={score.id}
                        onClick={() => handleRowClick(score)}
                        className={`border-b border-gray-800/50 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-900/20 hover:bg-indigo-900/30'
                            : 'hover:bg-gray-800/40'
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{globalRank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-900/50 border border-indigo-800/50 flex items-center justify-center text-xs font-medium text-indigo-300 shrink-0">
                              {score.intake?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-gray-200 font-medium truncate max-w-[180px]">
                                {score.intake?.fullName ?? 'Unknown'}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate max-w-[180px]">
                                {score.intake?.email ?? '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-700/50 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  score.totalScore >= 0.75
                                    ? 'bg-emerald-500'
                                    : score.totalScore >= 0.40
                                    ? 'bg-amber-500'
                                    : 'bg-gray-500'
                                }`}
                                style={{ width: `${Math.min(score.totalScore * 100, 100)}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs font-semibold ${
                              score.totalScore >= 0.75
                                ? 'text-emerald-400'
                                : score.totalScore >= 0.40
                                ? 'text-amber-400'
                                : 'text-gray-400'
                            }`}>
                              {formatScore(score.totalScore)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            score.routeTag === 'fast_track'
                              ? 'bg-emerald-900/30 text-emerald-300'
                              : score.routeTag === 'standard'
                              ? 'bg-amber-900/30 text-amber-300'
                              : 'bg-gray-800 text-gray-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              score.routeTag === 'fast_track'
                                ? 'bg-emerald-400'
                                : score.routeTag === 'standard'
                                ? 'bg-amber-400'
                                : 'bg-gray-500'
                            }`} />
                            {ROUTE_LABELS[score.routeTag] ?? score.routeTag}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400 capitalize">
                            {score.intake?.intentType?.replace(/_/g, ' ') ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(score.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={e => { e.stopPropagation(); handleRowClick(score); }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-indigo-600/30 text-indigo-300'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                            }`}
                            title="View score breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, pagination.page - 2);
                    const page = start + i;
                    if (page > pagination.totalPages) return null;
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          page === pagination.page
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Score Detail Panel (Radar Chart) ───────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-100">Score Breakdown</h2>
          </div>

          {!selectedScore ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center">
                <Eye className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium">Select an application</p>
              <p className="text-sm text-gray-500 mt-1">
                Click any row in the leaderboard to see its score breakdown
              </p>
            </div>
          ) : (
            <div className="p-5">
              {/* Selected applicant info */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-800">
                <div className="w-10 h-10 rounded-full bg-indigo-900/50 border border-indigo-800/50 flex items-center justify-center text-lg font-bold text-indigo-300 shrink-0">
                  {selectedScore.intake?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-100 font-semibold truncate">
                    {selectedScore.intake?.fullName ?? 'Unknown Applicant'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{selectedScore.intake?.email ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      selectedScore.routeTag === 'fast_track'
                        ? 'bg-emerald-900/30 text-emerald-300'
                        : selectedScore.routeTag === 'standard'
                        ? 'bg-amber-900/30 text-amber-300'
                        : 'bg-gray-800 text-gray-400'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${
                        selectedScore.routeTag === 'fast_track'
                          ? 'bg-emerald-400'
                          : selectedScore.routeTag === 'standard'
                          ? 'bg-amber-400'
                          : 'bg-gray-500'
                      }`} />
                      {ROUTE_LABELS[selectedScore.routeTag] ?? selectedScore.routeTag}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: <span className="text-gray-300 font-mono font-semibold">{formatScore(selectedScore.totalScore)}%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-500" />
                  Dimension Scores
                </h3>
                <div className="bg-gray-800/40 rounded-xl p-3">
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 1]}
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      />
                      <Radar
                        dataKey="value"
                        stroke="#818cf8"
                        fill="#818cf8"
                        fillOpacity={0.25}
                        strokeWidth={2}
                        dot={{ fill: '#818cf8', r: 3 }}
                        activeDot={{ r: 5, fill: '#a5b4fc' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '0.5rem',
                          fontSize: '13px',
                        }}
                        formatter={(value: number) => [`${(value * 100).toFixed(0)}%`, 'Score']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dimension breakdown table */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-500" />
                  Dimension Details
                </h3>
                <div className="space-y-1.5">
                  {(Object.keys(DIMENSION_LABELS) as (keyof SubScores)[]).map(key => {
                    const meta = DIMENSION_LABELS[key];
                    const sub = parseSubScores(selectedScore.subScores);
                    const val = sub[key];
                    return (
                      <div key={key} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-800/30 transition-colors">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-xs text-gray-400 w-20">{meta.label}</span>
                        <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${val * 100}%`, backgroundColor: meta.color }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-300 w-10 text-right">
                          {formatScore(val)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Veronica AI Dimensions ───────────────────────────── */}
              {veronicaDimensions && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-900/50 border border-purple-700/50 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                    </span>
                    Veronica AI Dimensions
                    {detailLoading && (
                      <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" />
                    )}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'intentConfidence', label: 'Intent Confidence' },
                      { key: 'executionCredibility', label: 'Exec Credibility' },
                      { key: 'vpQuality', label: 'VP Quality' },
                      { key: 'trustScore', label: 'Trust Score' },
                      { key: 'commitmentSignal', label: 'Commitment Signal' },
                      { key: 'inferredCapitalSignal', label: 'Inferred Capital' },
                    ].map(({ key, label }) => {
                      const val = veronicaDimensions[key] ?? 0;
                      const pct = (val * 100).toFixed(0);
                      const blendedKey: keyof SubScores =
                        key === 'intentConfidence' ? 'intent' :
                        key === 'executionCredibility' ? 'execution' :
                        key === 'vpQuality' ? 'valueProposition' :
                        key === 'trustScore' ? 'availability' :
                        key === 'commitmentSignal' ? 'availability' :
                        'veronica';
                      const sub = parseSubScores(selectedScore.subScores);
                      const blendedVal = sub[blendedKey];
                      const blendedPct = (blendedVal * 100).toFixed(0);
                      return (
                        <div
                          key={key}
                          className="bg-gray-800/30 rounded-xl p-3 border border-gray-800/50"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-gray-400 font-medium">{label}</span>
                            <span className="text-xs font-mono text-purple-300 font-semibold">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden mb-1">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${val * 100}%`, backgroundColor: '#a78bfa' }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-500">
                            Blended → <span className="text-gray-400 font-mono">{blendedPct}%</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                    AI-generated scores for each dimension. Blended 40% with rule-based sub-scores.
                  </p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
