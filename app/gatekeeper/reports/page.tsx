'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../../src/components/layout/MainLayout';
import { apiClient } from '../../../src/lib/api-client';
import { BarChart2, ChevronLeft, RefreshCw, Users, FileText, Activity, Layers } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '../../../src/hooks/usePermissions';

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
}

function StatCell({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { isAdmin, can } = usePermissions();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await apiClient.getDailyReports();
      if (res.success) {
        setReports(res.data.reports);
      } else {
        setFetchError(res.error ?? 'Failed to load reports');
      }
    } catch (e: any) {
      setFetchError(`${e.message ?? 'Failed to load reports'} (status: ${e.status ?? 'unknown'})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      const res = await apiClient.generateDailyReport();
      if (!res.success) {
        setGenerateError(res.error ?? 'Generation failed');
        return;
      }
      await fetchReports();
    } catch (e: any) {
      setGenerateError(`${e.message ?? 'Generation failed'} (status: ${e.status ?? 'unknown'})`);
    } finally {
      setGenerating(false);
    }
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
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                {generating ? 'Generating...' : 'Generate Now'}
              </button>
            )}
          </div>
        </div>

        {fetchError && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
            Fetch error: {fetchError}
          </div>
        )}
        {generateError && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
            {generateError}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No reports yet. Reports are auto-generated daily at 11:55 PM.</div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const date = new Date(report.reportDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
              const isExpanded = expanded === report.id;

              return (
                <div key={report.id} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : report.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-700/30 transition-colors text-left"
                  >
                    <div>
                      <span className="text-white font-semibold">{date}</span>
                      <span className="text-gray-500 text-xs ml-3">Generated {new Date(report.generatedAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-blue-400">{report.newSignups} signups</span>
                      <span className="text-violet-400">{report.totalSubmissions} submissions</span>
                      {report.flaggedItems > 0 && (
                        <span className="text-red-400">{report.flaggedItems} flagged</span>
                      )}
                      <span className="text-gray-500">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
                      {/* User Activity */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
                          <Users className="w-3.5 h-3.5" /> User Activity
                        </div>
                        <StatCell label="New Signups" value={report.newSignups} color="text-blue-400" />
                        <StatCell label="Approved" value={report.approvedUsers} color="text-emerald-400" />
                        <StatCell label="Rejected" value={report.rejectedUsers} color="text-red-400" />
                      </div>

                      {/* Submissions */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
                          <FileText className="w-3.5 h-3.5" /> Submissions
                        </div>
                        <StatCell label="Total" value={report.totalSubmissions} />
                        <StatCell label="Approved" value={report.approvedSubmissions} color="text-emerald-400" />
                        <StatCell label="Rejected" value={report.rejectedSubmissions} color="text-red-400" />
                        <StatCell label="Pending" value={report.pendingSubmissions} color="text-amber-400" />
                      </div>

                      {/* Contributors */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
                          <Activity className="w-3.5 h-3.5" /> Contributors
                        </div>
                        <StatCell label="Active (7d)" value={report.activeContributors} color="text-emerald-400" />
                        <StatCell label="Inactive" value={report.inactiveContributors} color="text-gray-400" />
                      </div>

                      {/* System Status */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
                          <Layers className="w-3.5 h-3.5" /> System Status
                        </div>
                        <StatCell label="Open Cycles" value={report.openCycles} color="text-blue-400" />
                        <StatCell label="Pending Reviews" value={report.pendingReviews} color="text-amber-400" />
                        <StatCell label="Flagged Items" value={report.flaggedItems} color="text-red-400" />
                      </div>
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
