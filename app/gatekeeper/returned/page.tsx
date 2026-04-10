'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../../src/components/layout/MainLayout';
import { apiClient } from '../../../src/lib/api-client';
import { RotateCcw, ChevronLeft, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import VeronicaBadge from '../../../src/components/gatekeeper/VeronicaBadge';
import GatekeeperActionModal from '../../../src/components/gatekeeper/GatekeeperActionModal';

export default function ReturnedPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [page, setPage] = useState(1);

  const fetchReturned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getGatekeeperReturned({ page, limit: 20 });
      if (res?.reviews) {
        setReviews(res.reviews);
        setTotal(res.total);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchReturned(); }, [fetchReturned]);

  const handleMove = async (reviewId: string, queue: 'new_users' | 'submissions') => {
    try {
      await apiClient.moveGatekeeperItem(reviewId, queue);
      await fetchReturned();
    } catch {
      // silent
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/gatekeeper" className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <RotateCcw className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl font-bold text-white">Returned / Corrections Queue</h1>
          <span className="ml-auto text-gray-400 text-sm">{total} items</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No returned items</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => {
              const label = review.entityType === 'user_intake'
                ? (review.triage?.name ?? 'User Application')
                : (review.activity?.user?.name ?? 'Activity Submission');
              const sub = review.entityType === 'user_intake'
                ? review.triage?.email
                : review.activity?.contributionType;

              return (
                <div key={review.id} className="bg-gray-800/60 border border-amber-500/20 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          {review.entityType === 'user_intake' ? 'User Intake' : 'Submission'}
                        </span>
                        <span className="text-white font-medium">{label}</span>
                        <span className="text-gray-500 text-sm">{sub}</span>
                      </div>
                      {review.notes && (
                        <p className="text-amber-300/70 text-sm mt-1">Note: {review.notes}</p>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3" />
                        Returned {new Date(review.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <VeronicaBadge status={review.status} score={review.veronicaScore} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMove(review.id, review.entityType === 'user_intake' ? 'new_users' : 'submissions')}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs transition-colors"
                        >
                          <ArrowRight className="w-3 h-3" /> Move Back
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
              );
            })}
          </div>
        )}
      </div>

      {selectedReview && (
        <GatekeeperActionModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onSuccess={() => { setSelectedReview(null); fetchReturned(); }}
        />
      )}
    </MainLayout>
  );
}
