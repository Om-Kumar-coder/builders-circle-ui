'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { Settings, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

interface ContributionWeight {
  id: string;
  contributionType: string;
  weight: number;
  description?: string;
  updatedAt: string;
  updatedBy?: string;
}

const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  code: 'Code Contribution',
  documentation: 'Documentation',
  review: 'Code Review',
  hours_logged: 'Hours Logged',
  research: 'Research',
  meeting: 'Meeting',
  task_completion: 'Task Completion',
};

export default function WeightsManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const [weights, setWeights] = useState<ContributionWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedWeights, setEditedWeights] = useState<Record<string, number>>({});

  const fetchWeights = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getContributionWeights();
      setWeights(data);
    } catch (err: unknown) {
      console.error('Error fetching weights:', err);
      setError((err as Error).message || 'Failed to fetch contribution weights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'founder') {
      fetchWeights();
    }
  }, [user]);

  const handleWeightChange = (contributionType: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
      setEditedWeights(prev => ({
        ...prev,
        [contributionType]: numValue,
      }));
    }
  };

  const saveWeight = async (contributionType: string) => {
    const newWeight = editedWeights[contributionType];
    if (newWeight === undefined) return;

    try {
      setSaving(contributionType);
      setError(null);
      
      await apiClient.updateContributionWeight(contributionType, newWeight);
      
      // Update local state
      setWeights(prev => prev.map(w => 
        w.contributionType === contributionType 
          ? { ...w, weight: newWeight, updatedAt: new Date().toISOString() }
          : w
      ));
      
      // Clear edited state
      setEditedWeights(prev => {
        const next = { ...prev };
        delete next[contributionType];
        return next;
      });
      
      setSuccess(`Updated ${CONTRIBUTION_TYPE_LABELS[contributionType]} weight`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Error saving weight:', err);
      setError((err as Error).message || 'Failed to save weight');
    } finally {
      setSaving(null);
    }
  };

  const resetAllWeights = async () => {
    if (!confirm('Are you sure you want to reset all weights to their default values?')) {
      return;
    }

    try {
      setSaving('reset');
      setError(null);
      
      const resetWeights = await apiClient.resetContributionWeights();
      setWeights(resetWeights);
      setEditedWeights({});
      
      setSuccess('All weights reset to defaults');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Error resetting weights:', err);
      setError((err as Error).message || 'Failed to reset weights');
    } finally {
      setSaving(null);
    }
  };

  const getDisplayWeight = (weight: ContributionWeight) => {
    return editedWeights[weight.contributionType] ?? weight.weight;
  };

  const hasChanges = (contributionType: string) => {
    return editedWeights[contributionType] !== undefined;
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
    return (
      <MainLayout title="Contribution Weights">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-100 mb-2">Access Denied</h1>
            <p className="text-gray-400">You need admin privileges to access this page.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Contribution Weights">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Contribution Weights</h1>
            <p className="text-gray-400 mt-1">Configure how different contribution types are weighted</p>
          </div>
          <button
            onClick={resetAllWeights}
            disabled={saving === 'reset'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${saving === 'reset' ? 'animate-spin' : ''}`} />
            <span>Reset to Defaults</span>
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-4 bg-green-900/20 border border-green-800/50 rounded-lg text-green-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Weights Configuration */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-semibold text-gray-100">Weight Configuration</h2>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-700 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {weights.map((weight) => (
                <div
                  key={weight.contributionType}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-100">
                        {CONTRIBUTION_TYPE_LABELS[weight.contributionType] || weight.contributionType}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {weight.description || `Weight multiplier for ${weight.contributionType} contributions`}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Last updated: {new Date(weight.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={getDisplayWeight(weight)}
                          onChange={(e) => handleWeightChange(weight.contributionType, e.target.value)}
                          className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 
                            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <span className="text-gray-400 text-sm">×</span>
                      </div>

                      {hasChanges(weight.contributionType) && (
                        <button
                          onClick={() => saveWeight(weight.contributionType)}
                          disabled={saving === weight.contributionType}
                          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 
                            text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                        >
                          <Save className={`w-4 h-4 ${saving === weight.contributionType ? 'animate-pulse' : ''}`} />
                          <span>Save</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Panel */}
          <div className="mt-8 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
            <h4 className="text-sm font-medium text-gray-300 mb-2">How Weights Work</h4>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• Weights are multipliers applied to base ownership rewards</p>
              <p>• Higher weights = more ownership for the same activity</p>
              <p>• Range: 0.0 to 10.0 (1.0 = standard weight)</p>
              <p>• Changes apply to new activities only</p>
            </div>
          </div>
        </div>

        {/* Weight Examples */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Example Calculations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Code Contribution (4 hours)</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Base reward: 0.1%</p>
                <p>Weight: {weights.find(w => w.contributionType === 'code')?.weight || 1.0}×</p>
                <p>Hours factor: 1.0× (4 hours)</p>
                <p className="text-green-400 font-medium">
                  Total: {((0.1 * (weights.find(w => w.contributionType === 'code')?.weight || 1.0) * 1.0)).toFixed(3)}%
                </p>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Documentation (2 hours)</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Base reward: 0.1%</p>
                <p>Weight: {weights.find(w => w.contributionType === 'documentation')?.weight || 0.6}×</p>
                <p>Hours factor: 0.5× (2 hours)</p>
                <p className="text-green-400 font-medium">
                  Total: {((0.1 * (weights.find(w => w.contributionType === 'documentation')?.weight || 0.6) * 0.5)).toFixed(3)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}