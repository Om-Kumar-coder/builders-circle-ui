'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../../src/components/layout/MainLayout';
import { apiClient } from '../../../src/lib/api-client';
import { FileCheck, Zap, AlertTriangle, Clock, ChevronLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import VeronicaBadge from '../../../src/components/gatekeeper/VeronicaBadge';
import GatekeeperActionModal from '../../../src/components/gatekeeper/GatekeeperActionModal';

type StatusFilter = 'all' | 'PENDING' | 'VALID' | 'NEEDS_REVIEW' | 'FLAGGED' | 'APPROVED' | 'REJECTED' | 'SENT_BACK';

export default function SubmissionsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [page, setPage] = useState(1);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getGatekeeperSubmissions({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: 20,
      });
      if (res.success) {
        setReviews(res.data.reviews);
        setTotal(res.data.total);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleScan = async (activityId: string) => {
    setScanning(activityId);
    try {
      await apiClient.scanSubmissionWithVeronica(activityId);
      await fetchSubmissions();
    } finally {
      setScanning(null);
    }
  };

  const statusFilters: StatusFilter[] = ['all', 'PENDING', 'VALID', 'NEEDS_REVIEW', 'FLAGGED', 'APPROVED', 'REJECTED', 'SENT_BACK'];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/gatekeeper" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <FileCheck className="w-5 h-5 text-violet-400" />
          <h1 className="text-xl font-bold text-white">Submission Pre-Check Queue</h1>
          <span className="ml-auto text-gray-400 text-sm">{total} items</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No items in this queue</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        {review.activity?.user?.name ?? 'Unknown User'}
                      </span>
                      <span className="text-gray-500 text-sm">{review.activity?.user?.email}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-2">
                      <span className="bg-gray-700 px-2 py-0.5 rounded">{review.activity?.contributionType}</span>
                      {review.activity?.hoursLogged && (
                        <span className="bg-gray-700 px-2 py-0.5 rounded">{review.activity.hoursLogged}h</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.activity?.description && (
                      <p className="text-gray-400 text-sm line-clamp-2">{review.activity.description}</p>
                    )}
                    {review.activity?.proofLink && (
                      <a
                        href={review.activity.proofLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Proof Link
                      </a>
                    )}
                    {review.activity?.linkedTask && (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded mt-1">
                        Task: {review.activity.linkedTask.title}
                        <span className="text-gray-500">({review.activity.linkedTask.status})</span>
                      </span>
                    )}
                    {review.veronicaNotes && (
                      <p className="text-gray-500 text-xs mt-1 italic">Veronica: {review.veronicaNotes}</p>
                    )}
                    {review.veronicaFlags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {review.veronicaFlags.map((f: string) => (
                          <span key={f} className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <VeronicaBadge status={review.status} score={review.veronicaScore} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleScan(review.entityId)}
                        disabled={scanning === review.entityId}
                        className="flex items-center gap-1 px-2 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded text-xs transition-colors disabled:opacity-50"
                      >
                        <Zap className="w-3 h-3" />
                        {scanning === review.entityId ? 'Scanning...' : 'Scan'}
                      </button>
                      <button
                        onClick={() => setSelectedReview(review)}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                      >
                        Action
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > 20 && (
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 bg-gray-800 text-gray-400 rounded disabled:opacity-40 hover:bg-gray-700 text-sm">Prev</button>
            <span className="px-3 py-1 text-gray-400 text-sm">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
              className="px-3 py-1 bg-gray-800 text-gray-400 rounded disabled:opacity-40 hover:bg-gray-700 text-sm">Next</button>
          </div>
        )}
      </div>

      {selectedReview && (
        <GatekeeperActionModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onSuccess={() => { setSelectedReview(null); fetchSubmissions(); }}
        />
      )}
    </MainLayout>
  );
}
