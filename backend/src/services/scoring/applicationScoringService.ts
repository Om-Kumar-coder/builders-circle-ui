/**
 * Application Scoring Engine — Phase 2a
 *
 * Pure score functions + full pipeline for scoring entry intake applications.
 * All DB-accessing functions accept mocked Prisma for testability.
 */

import { prisma } from '../../config/database';
import logger from '../../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubScores {
  intent: number;
  capital: number;
  execution: number;
  valueProposition: number;
  availability: number;
  veronica: number;
}

export interface WeightMap {
  intent: number;
  capital: number;
  execution: number;
  vp: number;
  availability: number;
  veronica: number;
}

export interface ScoringResult {
  entryIntakeId: string;
  totalScore: number;
  routeTag: 'fast_track' | 'standard' | 'hold';
  subScores: SubScores;
  scoredAt: Date;
}

const DEFAULT_WEIGHTS: WeightMap = {
  intent: 1.0,
  capital: 0.5,
  execution: 2.0,
  vp: 1.5,
  availability: 0.8,
  veronica: 1.2,
};

// ── 1. SUB-SCORE PURE FUNCTIONS ──────────────────────────────────────────────

/** Score based on intent type */
export function scoreIntentExport(intentType: string | null | undefined): number {
  switch (intentType) {
    case 'join':
    case 'collaborate':
      return 0.8;
    case 'invest':
    case 'propose':
      return 0.9;
    case 'other':
      return 0.3;
    default:
      return 0.3;
  }
}

/** Score based on capital range */
export function scoreCapitalExport(capitalRange: string | null | undefined): number {
  if (!capitalRange || capitalRange.trim() === '') return 0.3;

  const input = capitalRange.trim();

  // Truncate extremely long inputs to prevent regex DoS
  const truncated = input.length > 200 ? input.slice(0, 200) : input;

  // Extract the first number found (digits with optional commas)
  const numMatch = truncated.match(/(\d[\d,]*)/);
  if (!numMatch) return 0.3;

  const numStr = numMatch[1].replace(/,/g, '');
  let numericValue = parseInt(numStr, 10);

  if (isNaN(numericValue)) return 0.3;

  // Check for 'k'/'K' suffix (thousands) — e.g. "250k+" → 250 * 1000 = 250000
  const afterNum = truncated.slice(numMatch.index! + numMatch[0].length);
  if (/^\s*[kK]/.test(afterNum)) {
    numericValue *= 1000;
  }

  if (numericValue >= 250000) return 1.0;
  if (numericValue >= 50000) return 0.7;
  if (numericValue >= 10000) return 0.4;
  return 0.3;
}

/** Score based on execution track record */
export function scoreExecutionExport(
  proofUrl: string | null | undefined,
  outcome: string | null | undefined,
): number {
  const hasUrl = !!proofUrl && proofUrl.trim().startsWith('http');
  const outcomeStr = (outcome ?? '').trim();
  const outcomeLen = outcomeStr.length;

  if (hasUrl && outcomeLen >= 50) return 0.9;
  if (hasUrl && outcomeLen > 0) return 0.6;
  if (!hasUrl && outcomeLen >= 50) return 0.5;
  if (hasUrl && outcomeLen === 0) return 0.4;
  return 0.2;
}

/** Score based on value proposition length and quality */
export function scoreValuePropositionExport(vp: string | null | undefined): number {
  if (!vp || vp.trim().length === 0) return 0.2;

  const len = vp.trim().length;
  if (len > 200) return 0.9;
  if (len > 100) return 0.7;
  if (len > 50) return 0.5;
  if (len > 20) return 0.3;
  return 0.2;
}

/** Score based on availability */
export function scoreAvailabilityExport(availability: string | null | undefined): number {
  if (!availability) return 0.3;

  const lower = availability.toLowerCase().trim();
  if (lower.startsWith('full') || lower === 'full') return 1.0;
  if (lower.startsWith('part')) return 0.6;
  return 0.3;
}

/** Score from Veronica review (pass-through with clamping) */
export function scoreVeronicaExport(veronicaScore: number | null | undefined): number {
  if (veronicaScore === null || veronicaScore === undefined) return 0.5;
  if (!Number.isFinite(veronicaScore)) return 0.5;
  return Math.min(1, Math.max(0, veronicaScore));
}

// ── 2. ROUTE DETERMINATION ──────────────────────────────────────────────────

/** Determine application route based on total weighted score */
export function determineRouteExport(totalScore: number): 'fast_track' | 'standard' | 'hold' {
  // NaN should fall to hold, but Infinity (edge case) should be treated as extremely high
  if (isNaN(totalScore)) return 'hold';
  if (totalScore >= 0.75) return 'fast_track';
  if (totalScore >= 0.40) return 'standard';
  return 'hold';
}

// ── 3. WEIGHT LOADING ───────────────────────────────────────────────────────

/** Load scoring weights from DB, falling back to defaults on error or empty table */
export async function loadScoringWeights(): Promise<WeightMap> {
  try {
    const rows = await prisma.scoringWeight.findMany({
      where: { isActive: true },
    });

    if (!rows || rows.length === 0) {
      return { ...DEFAULT_WEIGHTS };
    }

    const weights: WeightMap = { ...DEFAULT_WEIGHTS };
    for (const row of rows) {
      const key = row.weightKey as keyof WeightMap;
      if (key in weights) {
        weights[key] = row.weight;
      }
    }
    return weights;
  } catch (err) {
    logger.warn('[Scoring] Failed to load weights from DB, using defaults', { err });
    return { ...DEFAULT_WEIGHTS };
  }
}

// ── 4. FULL SCORE APPLICATION PIPELINE ──────────────────────────────────────

/**
 * Compute the weighted total score from sub-scores.
 */
function computeWeightedTotal(subScores: SubScores, weights: WeightMap): number {
  const weighted =
    subScores.intent * weights.intent +
    subScores.capital * weights.capital +
    subScores.execution * weights.execution +
    subScores.valueProposition * weights.vp +
    subScores.availability * weights.availability +
    subScores.veronica * weights.veronica;

  const totalWeight =
    weights.intent +
    weights.capital +
    weights.execution +
    weights.vp +
    weights.availability +
    weights.veronica;

  return totalWeight > 0 ? weighted / totalWeight : 0;
}

/**
 * Score a single application by intake ID.
 * Fetches intake data + gatekeeper review, computes sub-scores, determines route,
 * persists result, and returns the full scoring result.
 */
export async function scoreApplication(
  entryIntakeId: string,
): Promise<ScoringResult | null> {
  try {
    // Fetch intake data
    const intake = await prisma.entryIntake.findUnique({
      where: { id: entryIntakeId },
    });

    if (!intake) return null;

    // Fetch gatekeeper review for veronica score
    const review = await prisma.gatekeeperReview.findFirst({
      where: { entityType: 'user_intake', entityId: intake.id },
      orderBy: { createdAt: 'desc' },
    });

    const veronicaScore = review?.veronicaScore ?? null;

    // Compute sub-scores
    const subScores: SubScores = {
      intent: scoreIntentExport(intake.intentType),
      capital: scoreCapitalExport(intake.capitalRange),
      execution: scoreExecutionExport(intake.executionProofUrl, intake.executionOutcome),
      valueProposition: scoreValuePropositionExport(intake.valueProposition),
      availability: scoreAvailabilityExport(intake.availability),
      veronica: scoreVeronicaExport(veronicaScore),
    };

    // Load weights
    const weights = await loadScoringWeights();

    // Compute weighted total
    const totalScore = computeWeightedTotal(subScores, weights);

    // Determine route
    const routeTag = determineRouteExport(totalScore);

    const now = new Date();

    // Persist
    await prisma.applicationScore.upsert({
      where: { entryIntakeId: intake.id },
      create: {
        entryIntakeId: intake.id,
        totalScore,
        routeTag,
        subScores: JSON.stringify(subScores),
        scoredAt: now,
      },
      update: {
        totalScore,
        routeTag,
        subScores: JSON.stringify(subScores),
        scoredAt: now,
      },
    });

    // Audit log
    await prisma.systemLog.create({
      data: {
        event: 'application_scored',
        severity: 'INFO',
        message: `[Scoring] Application ${intake.id} scored: ${(totalScore * 100).toFixed(1)}% → ${routeTag}`,
        metadata: JSON.stringify({ entryIntakeId: intake.id, totalScore, routeTag, subScores }),
      },
    }).catch(() => {});

    return {
      entryIntakeId: intake.id,
      totalScore,
      routeTag,
      subScores,
      scoredAt: now,
    };
  } catch (err) {
    logger.error('[Scoring] scoreApplication failed', { entryIntakeId, err });
    return null;
  }
}

/**
 * Fire-and-forget scoring — never throws, always resolves.
 */
export async function scoreApplicationFireAndForget(entryIntakeId: string): Promise<void> {
  try {
    await scoreApplication(entryIntakeId);
  } catch {
    // Silently swallow — this is fire-and-forget
  }
}

/**
 * Recompute an existing application score (forces re-fetch and re-persist).
 * Alias used by the scoring route.
 */
export async function recomputeApplicationScore(entryIntakeId: string): Promise<ScoringResult | null> {
  return scoreApplication(entryIntakeId);
}

// ── 5. BATCH UNSCORED APPLICATIONS ─────────────────────────────────────────

/**
 * Find all intake entries that don't have an ApplicationScore yet and score them.
 * Returns { scored: number } with the count of newly scored entries.
 */
export async function scoreUnscoredApplications(): Promise<{ scored: number }> {
  try {
    // Get all already-scored intake IDs
    const existingScores = await prisma.applicationScore.findMany({
      select: { entryIntakeId: true },
    });
    const scoredIds = new Set(existingScores.map(s => s.entryIntakeId));

    // Get all intakes
    const allIntakes = await prisma.entryIntake.findMany({
      select: { id: true },
    });

    // Filter to unscored
    const unscoredIds = allIntakes
      .map(i => i.id)
      .filter(id => !scoredIds.has(id));

    if (unscoredIds.length === 0) {
      return { scored: 0 };
    }

    // Score each unscored intake sequentially (to avoid DB thundering herd)
    let scored = 0;
    for (const id of unscoredIds) {
      const result = await scoreApplication(id);
      if (result !== null) scored++;
    }

    return { scored };
  } catch (err) {
    logger.error('[Scoring] scoreUnscoredApplications failed', { err });
    return { scored: 0 };
  }
}
