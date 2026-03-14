'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Play, 
  RefreshCw, 
  Clock, 
  Users, 
  TrendingUp, 
  Archive,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface JobExecutionPanelProps {
  onJobComplete?: () => void;
}

const AVAILABLE_JOBS = [
  {
    id: 'stall-evaluator',
    name: 'Stall Evaluator',
    description: 'Evaluate participation health and update stall stages for all active participants',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    warning: 'This will update stall stages and may trigger notifications to users'
  },
  {
    id: 'multiplier-adjustment',
    name: 'Multiplier Adjustment',
    description: 'Adjust ownership multipliers based on current stall stages',
    icon: TrendingUp,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    warning: 'This will modify user multipliers and affect ownership calculations'
  },
  {
    id: 'ownership-decay',
    name: 'Ownership Decay',
    description: 'Apply time-based ownership decay for inactive participants',
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    warning: 'This will reduce ownership for participants with extended inactivity'
  },
  {
    id: 'cycle-finalizer',
    name: 'Cycle Finalizer',
    description: 'Finalize closed cycles and calculate final ownership distribution',
    icon: Archive,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    warning: 'This will permanently finalize cycle ownership and cannot be undone'
  }
];

export default function JobExecutionPanel({ onJobComplete }: JobExecutionPanelProps) {
  const [executingJobs, setExecutingJobs] = useState<Set<string>>(new Set());
  const [jobResults, setJobResults] = useState<Record<string, { success: boolean; message: string; timestamp: Date }>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);

  const executeJob = async (jobId: string) => {
    setExecutingJobs(prev => new Set(prev).add(jobId));
    
    try {
      const response = await apiClient.executeManualJob(jobId);
      
      setJobResults(prev => ({
        ...prev,
        [jobId]: {
          success: response?.success ?? true,
          message: response?.message || 'Job completed successfully',
          timestamp: new Date()
        }
      }));

      if (onJobComplete) {
        onJobComplete();
      }
    } catch (error) {
      setJobResults(prev => ({
        ...prev,
        [jobId]: {
          success: false,
          message: error instanceof Error ? error.message : 'Job execution failed',
          timestamp: new Date()
        }
      }));
    } finally {
      setExecutingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      setShowConfirmDialog(null);
    }
  };

  const handleJobClick = (jobId: string) => {
    setShowConfirmDialog(jobId);
  };

  const confirmJobExecution = () => {
    if (showConfirmDialog) {
      executeJob(showConfirmDialog);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Manual Job Execution</h3>
          <p className="text-sm text-gray-400 mt-1">
            Manually trigger background jobs for system maintenance and updates
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AVAILABLE_JOBS.map((job) => {
          const Icon = job.icon;
          const isExecuting = executingJobs.has(job.id);
          const result = jobResults[job.id];

          return (
            <div
              key={job.id}
              className={`bg-gray-900 border rounded-lg p-6 transition-all duration-200 ${job.borderColor}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${job.bgColor}`}>
                    <Icon className={`w-5 h-5 ${job.color}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-100">{job.name}</h4>
                    <p className="text-sm text-gray-400 mt-1">{job.description}</p>
                  </div>
                </div>
              </div>

              {/* Job Result */}
              {result && (
                <div className={`mb-4 p-3 rounded-lg border ${
                  result.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {result.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <p className="text-xs opacity-80">{result.message}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {result.timestamp.toLocaleString()}
                  </p>
                </div>
              )}

              <button
                onClick={() => handleJobClick(job.id)}
                disabled={isExecuting}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg 
                  font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${job.bgColor} ${job.color} border ${job.borderColor} hover:opacity-80`}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Execute Job</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-semibold text-gray-100">Confirm Job Execution</h3>
            </div>
            
            {(() => {
              const job = AVAILABLE_JOBS.find(j => j.id === showConfirmDialog);
              return job ? (
                <div className="space-y-4">
                  <p className="text-gray-300">
                    Are you sure you want to execute <strong>{job.name}</strong>?
                  </p>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <p className="text-sm text-yellow-400">
                      <strong>Warning:</strong> {job.warning}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={confirmJobExecution}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg 
                        font-medium transition-colors"
                    >
                      Execute Job
                    </button>
                    <button
                      onClick={() => setShowConfirmDialog(null)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg 
                        font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}