/**
 * Scoring Engine — Shared TypeScript types for the frontend.
 *
 * These types mirror the backend's ScoringResult, SubScores, etc. and are used
 * by the API client, the scoring dashboard, and any other scoring UI components.
 */

// ── Sub-scores (matches backend applicationScoringService.SubScores) ────────

export interface SubScores {
  intent: number;
  capital: number;
  execution: number;
  valueProposition: number;
  availability: number;
  veronica: number;
}

// ── Veronica AI structured dimension scores ─────────────────────────────────

export interface VeronicaDimensions {
  intentConfidence: number;
  executionCredibility: number;
  vpQuality: number;
  trustScore: number;
  commitmentSignal: number;
  inferredCapitalSignal: number;
}

// ── Scoring weight ─────────────────────────────────────────────────────────

export interface ScoringWeight {
  id: string;
  weightKey: string;
  weight: number;
  label: string | null;
  description: string | null;
  isActive: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Application score (from the list endpoint) ─────────────────────────────

export interface ApplicationScoreItem {
  id: string;
  entryIntakeId: string;
  totalScore: number;
  routeTag: string;
  subScores: string; // JSON string of SubScores (Prisma stores as String?)
  scoredAt: string;
  createdAt: string;
  updatedAt: string;
  intake?: {
    fullName: string;
    email: string;
    intentType: string;
    capitalRange?: string | null;
  } | null;
}

// ── Application score detail (single-item endpoint) ────────────────────────

export interface ApplicationScoreDetail {
  score: {
    id: string;
    entryIntakeId: string;
    totalScore: number;
    routeTag: string;
    subScores: string | null;  // JSON string
    scoredAt: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  intake: {
    id: string;
    fullName: string;
    email: string;
    intentType: string;
    capitalRange: string | null;
    status: string;
  } | null;
  veronicaDimensions: Record<string, number> | null;
}

// ── Pagination ─────────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── API Response envelopes ─────────────────────────────────────────────────

export interface ApplicationScoresResponse {
  scores: ApplicationScoreItem[];
  pagination: Pagination;
}

export interface ScoringWeightsResponse {
  weights: ScoringWeight[];
  activeWeights: Record<string, number>;
}

export interface TierThreshold {
  id: string;
  tier: string;
  minScore: number;
  minCycles: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TierThresholdsResponse {
  thresholds: TierThreshold[];
}

// ── Route assignment ───────────────────────────────────────────────────────

export interface RouteAssignment {
  id: string;
  entryIntakeId: string;
  route: string;
  priority: string;
  reason: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface RouteAssignmentsResponse {
  routes: RouteAssignment[];
  pagination: Pagination;
}

// ── Sub-score display helpers ──────────────────────────────────────────────

/**
 * Parse sub-scores from a JSON string or object into a typed SubScores object.
 * Safe to call with null/undefined — returns default zeroed scores.
 */
export function parseSubScores(raw: string | Partial<SubScores> | null | undefined): SubScores {
  const defaults: SubScores = {
    intent: 0,
    capital: 0,
    execution: 0,
    valueProposition: 0,
    availability: 0,
    veronica: 0,
  };
  if (!raw) return { ...defaults };
  if (typeof raw === 'string') {
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return { ...defaults };
    }
  }
  return { ...defaults, ...raw };
}

/**
 * Map from the backend's sub-score keys to radar-chart-friendly dimension labels.
 */
export const DIMENSION_LABELS: Record<string, { label: string; color: string }> = {
  intent: { label: 'Intent', color: '#818cf8' },
  capital: { label: 'Capital', color: '#34d399' },
  execution: { label: 'Execution', color: '#fbbf24' },
  valueProposition: { label: 'Value Prop', color: '#f472b6' },
  availability: { label: 'Availability', color: '#60a5fa' },
  veronica: { label: 'Veronica AI', color: '#a78bfa' },
};

export const ROUTE_COLORS: Record<string, string> = {
  fast_track: '#10b981',
  standard: '#f59e0b',
  hold: '#6b7280',
};

export const ROUTE_LABELS: Record<string, string> = {
  fast_track: 'Fast Track',
  standard: 'Standard',
  hold: 'Hold',
};
