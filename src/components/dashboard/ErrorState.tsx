import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-900/20 border border-red-800/50 rounded-2xl p-8 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-3 bg-red-500/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            Failed to Load Data
          </h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 
              border border-red-800/50 rounded-lg text-red-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
}
