'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import {
  Scale,
  GitBranch,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
  Lightbulb,
  Sliders,
  ToggleLeft,
  TrendingUp,
} from 'lucide-react';
import DashboardPanel from '@/components/scoring/DashboardPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoringWeight {
  id: string;
  weightKey: string;
  weight: number;
  label: string | null;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
}

interface TierThreshold {
  id: string;
  tier: string;
  minScore: number;
  minCycles: number;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
}

type Tab = 'weights' | 'tiers' | 'dashboard';

// ── Label mappings ────────────────────────────────────────────────────────────

const WEIGHT_KEY_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  intent: {
    label: 'Intent Type',
    icon: '🎯',
    desc: 'Importance of the applicant\'s intent type (join, collaborate, invest, propose, other)',
  },
  capital: {
    label: 'Capital Commitment',
    icon: '💰',
    desc: 'Importance of the capital range the applicant is committing',
  },
  execution: {
    label: 'Execution Track Record',
    icon: '⚡',
    desc: 'Importance of prior execution proof (URL + outcome text)',
  },
  vp: {
    label: 'Value Proposition',
    icon: '💡',
    desc: 'Importance of the value proposition quality (length-based)',
  },
  availability: {
    label: 'Time Availability',
    icon: '📅',
    desc: 'Importance of the applicant\'s time commitment (full-time, part-time)',
  },
  veronica: {
    label: 'Veronica AI Score',
    icon: '🤖',
    desc: 'Importance of the Veronica AI gatekeeper scan score',
  },
};

const TIER_LABELS: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  founder: {
    label: 'Founder',
    icon: '👑',
    color: 'text-purple-400',
    desc: 'Full platform access & governance rights (admin-assigned only)',
  },
  core: {
    label: 'Core',
    icon: '⭐',
    color: 'text-amber-400',
    desc: 'Significant ownership stake & voting weight',
  },
  contributor: {
    label: 'Contributor',
    icon: '🔧',
    color: 'text-blue-400',
    desc: 'Active participant earning ownership',
  },
  employee: {
    label: 'Employee',
    icon: '💼',
    color: 'text-green-400',
    desc: 'Salaried team member (role-based, not score-based)',
  },
  observer: {
    label: 'Observer',
    icon: '👁️',
    color: 'text-gray-400',
    desc: 'Read-only access (default for new/inactive users)',
  },
};

const WEIGHT_KEY_ORDER = ['intent', 'capital', 'execution', 'vp', 'availability', 'veronica'];
const TIER_ORDER = ['founder', 'core', 'contributor', 'employee', 'observer'];

// ── Scoring threshold info ────────────────────────────────────────────────────

const ROUTE_THRESHOLDS = [
  { label: 'Fast Track', min: 0.75, color: 'text-green-400', bg: 'bg-green-900/20' },
  { label: 'Standard', min: 0.40, color: 'text-amber-400', bg: 'bg-amber-900/20' },
  { label: 'Hold', min: 0, color: 'text-gray-400', bg: 'bg-gray-800/30' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScoringAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('weights');

  // Weights state
  const [weights, setWeights] = useState<ScoringWeight[]>([]);
  const [editedWeights, setEditedWeights] = useState<Record<string, number>>({});

  // Tiers state
  const [thresholds, setThresholds] = useState<TierThreshold[]>([]);
  const [editedTiers, setEditedTiers] = useState<Record<string, { minScore: number; minCycles: number; description: string }>>({});

  // Shared state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchWeights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getScoringWeights();
      setWeights(data.weights ?? []);
    } catch (err: unknown) {
      console.error('Error fetching scoring weights:', err);
      setError((err as Error).message || 'Failed to fetch scoring weights');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTiers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getTierThresholds();
      setThresholds(data.thresholds ?? []);
    } catch (err: unknown) {
      console.error('Error fetching tier thresholds:', err);
      setError((err as Error).message || 'Failed to fetch tier thresholds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'founder') {
      if (activeTab === 'weights') fetchWeights();
      else fetchTiers();
    }
  }, [activeTab, user?.role, fetchWeights, fetchTiers]);

  // ── Weight helpers ─────────────────────────────────────────────────────────

  const getWeightValue = (key: string) => {
    if (editedWeights[key] !== undefined) return editedWeights[key];
    const w = weights.find(w => w.weightKey === key);
    return w?.weight ?? 1.0;
  };

  const handleWeightChange = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      setEditedWeights(prev => ({ ...prev, [key]: num }));
    }
  };

  const hasWeightChanges = (key: string) => editedWeights[key] !== undefined;

  const saveWeights = async () => {
    const keys = Object.keys(editedWeights);
    if (keys.length === 0) return;

    try {
      setSaving('weights');
      setError(null);

      const payload = keys.map(key => ({
        weightKey: key as 'intent' | 'capital' | 'execution' | 'vp' | 'availability' | 'veronica',
        weight: editedWeights[key],
      }));

      await apiClient.updateScoringWeights(payload);

      // Refresh
      await fetchWeights();
      setEditedWeights({});
      setSuccess('Scoring weights updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Error saving weights:', err);
      setError((err as Error).message || 'Failed to save weights');
    } finally {
      setSaving(null);
    }
  };

  const resetWeightEdits = () => {
    setEditedWeights({});
  };

  // ── Tier helpers ───────────────────────────────────────────────────────────

  const getTierField = (tier: string, field: 'minScore' | 'minCycles' | 'description') => {
    if (editedTiers[tier] && editedTiers[tier][field] !== undefined) {
      return editedTiers[tier][field];
    }
    const t = thresholds.find(tr => tr.tier === tier);
    if (field === 'description') return t?.description ?? '';
    return t?.[field] ?? 0;
  };

  const handleTierChange = (tier: string, field: 'minScore' | 'minCycles', value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setEditedTiers(prev => ({
        ...prev,
        [tier]: { ...prev[tier], minScore: prev[tier]?.minScore ?? getTierField(tier, 'minScore') as number, minCycles: prev[tier]?.minCycles ?? getTierField(tier, 'minCycles') as number, description: prev[tier]?.description ?? getTierField(tier, 'description') as string, [field]: num },
      }));
    }
  };

  const handleTierDescriptionChange = (tier: string, value: string) => {
    setEditedTiers(prev => ({
      ...prev,
      [tier]: { ...prev[tier], minScore: prev[tier]?.minScore ?? getTierField(tier, 'minScore') as number, minCycles: prev[tier]?.minCycles ?? getTierField(tier, 'minCycles') as number, description: value },
    }));
  };

  const hasTierChanges = (tier: string) => {
    if (!editedTiers[tier]) return false;
    const orig = thresholds.find(t => t.tier === tier);
    if (!orig) return true;
    const e = editedTiers[tier];
    return e.minScore !== orig.minScore || e.minCycles !== orig.minCycles || e.description !== (orig.description ?? '');
  };

  const saveTiers = async () => {
    const tiersWithChanges = TIER_ORDER.filter(t => hasTierChanges(t));
    if (tiersWithChanges.length === 0) return;

    try {
      setSaving('tiers');
      setError(null);

      const payload = tiersWithChanges.map(tier => ({
        tier: tier as 'founder' | 'core' | 'contributor' | 'employee' | 'observer',
        minScore: editedTiers[tier].minScore,
        minCycles: editedTiers[tier].minCycles,
        description: editedTiers[tier].description || undefined,
      }));

      await apiClient.updateTierThresholds(payload);

      await fetchTiers();
      setEditedTiers({});
      setSuccess('Tier thresholds updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Error saving tiers:', err);
      setError((err as Error).message || 'Failed to save tier thresholds');
    } finally {
      setSaving(null);
    }
  };

  const resetTierEdits = () => {
    setEditedTiers({});
  };

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (authLoading) return <LoadingScreen />;

  if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
    return (
      <MainLayout title="Scoring Configuration">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Scale className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-100 mb-2">Access Denied</h1>
            <p className="text-gray-400">You need admin privileges to access this page.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const hasAnyWeightChanges = Object.keys(editedWeights).length > 0;
  const hasAnyTierChanges = TIER_ORDER.some(t => hasTierChanges(t));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Scoring Configuration">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-full">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Scoring Configuration</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Manage application scoring weights and tier thresholds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <Info className="w-4 h-4" />
              <span>How it works</span>
            </button>
            <button
              onClick={activeTab === 'weights' ? fetchWeights : activeTab === 'tiers' ? fetchTiers : undefined}
              disabled={loading && activeTab !== 'dashboard'}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{activeTab === 'dashboard' ? 'Auto-refresh' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <div className="bg-indigo-900/15 border border-indigo-800/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-6 h-6 text-indigo-400 mt-0.5 shrink-0" />
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <h3 className="font-semibold text-indigo-300 mb-1">Scoring Weights</h3>
                  <p>
                    Each scoring dimension (intent, capital, execution, value proposition, availability, Veronica AI)
                    has a configurable weight that controls how much it contributes to the total application score.
                    Higher weights = more influence. Range: 0.0 to 10.0 (1.0 = standard).
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-300 mb-1">Tier Thresholds</h3>
                  <p>
                    User tiers are determined by a composite score (0–100) computed from ownership, contribution,
                    reputation, cycle count, and Veronica score. Configure the minimum score and minimum cycles
                    required for each tier. Founder and Employee are role-based and cannot be earned through scoring.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-300 mb-1">Tier Formula</h3>
                  <p className="text-gray-400">
                    tierScore = (3.0 × ownership + 2.0 × contribution + 1.5 × reputation + 1.0 × cycles + 0.5 × veronica) / 8.0
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-4 bg-green-900/20 border border-green-800/50 rounded-xl text-green-400">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('weights')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'weights'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Scoring Weights
          </button>
          <button
            onClick={() => setActiveTab('tiers')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tiers'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Tier Thresholds
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* ── Scoring Weights Panel ─────────────────────────────────────────────── */}
        {activeTab === 'weights' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Panel header */}
            <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold text-gray-100">Scoring Weights</h2>
              </div>
              {hasAnyWeightChanges && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetWeightEdits}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo All
                  </button>
                  <button
                    onClick={saveWeights}
                    disabled={saving === 'weights'}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <Save className={`w-3.5 h-3.5 ${saving === 'weights' ? 'animate-pulse' : ''}`} />
                    {saving === 'weights' ? 'Saving...' : `Save ${Object.keys(editedWeights).length} Change${Object.keys(editedWeights).length > 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>

            {/* Weight list */}
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-32" />
                        <div className="h-3 bg-gray-700 rounded w-64" />
                      </div>
                      <div className="h-10 bg-gray-700 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {WEIGHT_KEY_ORDER.map(key => {
                  const meta = WEIGHT_KEY_LABELS[key];
                  const weight = weights.find(w => w.weightKey === key);
                  const currentValue = getWeightValue(key);
                  const changed = hasWeightChanges(key);

                  return (
                    <div
                      key={key}
                      className={`bg-gray-800/40 border rounded-xl p-5 transition-all ${
                        changed ? 'border-indigo-600/50 ring-1 ring-indigo-600/20' : 'border-gray-700/50 hover:border-gray-600/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{meta.icon}</span>
                            <h3 className="font-semibold text-gray-100">{meta.label}</h3>
                            {changed && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 font-medium">
                                Edited
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">{meta.desc}</p>
                          {weight?.updatedAt && (
                            <p className="text-[11px] text-gray-500 mt-1.5">
                              Last updated: {new Date(weight.updatedAt).toLocaleDateString()} • Key: <code className="text-indigo-400 bg-indigo-950/30 px-1 rounded">{key}</code>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <input
                                type="range"
                                min="0"
                                max="10"
                                step="0.1"
                                value={currentValue}
                                onChange={e => handleWeightChange(key, e.target.value)}
                                className="w-28 h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/30"
                              />
                              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5 px-0.5">
                                <span>0</span>
                                <span>5</span>
                                <span>10</span>
                              </div>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={currentValue}
                              onChange={e => handleWeightChange(key, e.target.value)}
                              className={`w-20 px-3 py-2 rounded-lg text-sm font-mono text-center transition-all ${
                                changed
                                  ? 'bg-indigo-900/30 border-indigo-600 text-indigo-200'
                                  : 'bg-gray-700 border-gray-600 text-gray-100'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weight bar visualization */}
                      <div className="mt-3 pt-3 border-t border-gray-700/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">Influence</span>
                          <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                currentValue > 0
                                  ? currentValue >= 2
                                    ? 'bg-indigo-500'
                                    : currentValue >= 1
                                    ? 'bg-blue-500'
                                    : 'bg-gray-500'
                                  : ''
                              }`}
                              style={{ width: `${(currentValue / 10) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 font-mono w-10 text-right">
                            {((currentValue / 10) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Route thresholds info footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-800/20">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500 font-medium">Application Route Thresholds</span>
              </div>
              <div className="flex gap-3">
                {ROUTE_THRESHOLDS.map(r => (
                  <div key={r.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${r.bg}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${r.color.replace('text', 'bg')}`} />
                    <span className="text-xs text-gray-400">{r.label}</span>
                    <span className={`text-xs font-mono ${r.color}`}>
                      {r.min > 0 ? `≥ ${r.min}` : '< 0.40'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Dashboard Panel ──────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && <DashboardPanel />}

        {/* ── Tier Thresholds Panel ────────────────────────────────────────────── */}
        {activeTab === 'tiers' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Panel header */}
            <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-gray-100">Tier Thresholds</h2>
              </div>
              {hasAnyTierChanges && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetTierEdits}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo All
                  </button>
                  <button
                    onClick={saveTiers}
                    disabled={saving === 'tiers'}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <Save className={`w-3.5 h-3.5 ${saving === 'tiers' ? 'animate-pulse' : ''}`} />
                    {saving === 'tiers' ? 'Saving...' : `Save Changes`}
                  </button>
                </div>
              )}
            </div>

            {/* Tier list */}
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-24" />
                        <div className="h-3 bg-gray-700 rounded w-48" />
                      </div>
                      <div className="flex gap-3">
                        <div className="h-10 bg-gray-700 rounded w-20" />
                        <div className="h-10 bg-gray-700 rounded w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {TIER_ORDER.map(tierKey => {
                  const meta = TIER_LABELS[tierKey];
                  const threshold = thresholds.find(t => t.tier === tierKey);
                  const changed = hasTierChanges(tierKey);
                  const isRoleBased = tierKey === 'founder' || tierKey === 'employee';

                  return (
                    <div
                      key={tierKey}
                      className={`bg-gray-800/40 border rounded-xl p-5 transition-all ${
                        changed ? 'border-indigo-600/50 ring-1 ring-indigo-600/20' : 'border-gray-700/50 hover:border-gray-600/50'
                      } ${!threshold?.isActive && threshold ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{meta.icon}</span>
                            <h3 className={`font-semibold text-lg ${meta.color}`}>{meta.label}</h3>
                            {isRoleBased && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-400 font-medium">
                                Role-based
                              </span>
                            )}
                            {changed && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 font-medium">
                                Edited
                              </span>
                            )}
                            {threshold && !threshold.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400 font-medium">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{meta.desc}</p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {/* Min Score */}
                          <div className="text-center">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                              Min Score
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={getTierField(tierKey, 'minScore')}
                              onChange={e => handleTierChange(tierKey, 'minScore', e.target.value)}
                              className={`w-16 px-2 py-2 rounded-lg text-sm font-mono text-center transition-all ${
                                changed
                                  ? 'bg-indigo-900/30 border-indigo-600 text-indigo-200'
                                  : 'bg-gray-700 border-gray-600 text-gray-100'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            />
                          </div>

                          {/* Min Cycles */}
                          <div className="text-center">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                              Min Cycles
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={getTierField(tierKey, 'minCycles')}
                              onChange={e => handleTierChange(tierKey, 'minCycles', e.target.value)}
                              className={`w-16 px-2 py-2 rounded-lg text-sm font-mono text-center transition-all ${
                                changed
                                  ? 'bg-indigo-900/30 border-indigo-600 text-indigo-200'
                                  : 'bg-gray-700 border-gray-600 text-gray-100'
                              } border focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Description (edit inline) */}
                      <div className="mt-3 pt-3 border-t border-gray-700/30">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={getTierField(tierKey, 'description') as string}
                          onChange={e => handleTierDescriptionChange(tierKey, e.target.value)}
                          placeholder="Describe this tier..."
                          className={`w-full px-3 py-1.5 rounded-lg text-sm transition-all ${
                            changed
                              ? 'bg-indigo-900/20 border-indigo-600/50 text-gray-200'
                              : 'bg-gray-700/50 border-gray-600/50 text-gray-300'
                          } border focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tier scoring formula footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-800/20">
              <div className="flex items-center gap-2 mb-2">
                <ToggleLeft className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500 font-medium">Tier Scoring Formula</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Ownership', weight: '3.0', color: 'text-purple-400' },
                  { label: 'Contribution', weight: '2.0', color: 'text-blue-400' },
                  { label: 'Reputation', weight: '1.5', color: 'text-green-400' },
                  { label: 'Cycles', weight: '1.0', color: 'text-amber-400' },
                  { label: 'Veronica', weight: '0.5', color: 'text-gray-400' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800/40">
                    <span className={`text-xs font-medium ${f.color}`}>{f.label}</span>
                    <span className="text-[10px] text-gray-500">×</span>
                    <span className="text-xs text-gray-400 font-mono">{f.weight}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800/40">
                  <span className="text-xs text-gray-500">Denominator:</span>
                  <span className="text-xs text-gray-400 font-mono">8.0</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
