'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log to console in development, could send to error reporting service
    console.error('[App Error]', {
      message: error.message,
      digest: error.digest,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-red-900/30 rounded-full border border-red-800/50">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-100 mb-2">
          Something went wrong
        </h1>

        <p className="text-sm text-gray-400 mb-2">
          An unexpected error occurred. Our team has been notified.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-left">
            <p className="text-xs font-mono text-red-300 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-gray-500 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 
            text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
