'use client';

import { useState } from 'react';
import { Zap, Loader2, CheckCircle } from 'lucide-react';
import { joinCycle } from '@/lib/participation';

interface JoinBuildButtonProps {
  userId: string;
  cycleId: string;
  onSuccess?: () => void;
  className?: string;
}

export default function JoinBuildButton({
  userId,
  cycleId,
  onSuccess,
  className = '',
}: JoinBuildButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);

    const result = await joinCycle(userId, cycleId);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 800);
    } else {
      setError(result.error || 'Failed to join cycle');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <button
        disabled
        className={`px-4 py-2 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 animate-in fade-in duration-300 ${className}`}
      >
        <CheckCircle className="w-4 h-4" />
        Joined!
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleJoin}
        disabled={loading}
        className={`px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Joining...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Join Build
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
