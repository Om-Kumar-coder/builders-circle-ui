/**
 * Phase 2a — Application Scoring Engine Tests
 *
 * Covers:
 *   Group 1 — Pure sub-score functions (intent, capital, execution, vp, availability, veronica)
 *   Group 2 — Route determination with boundary values
 *   Group 3 — Weight loading with mocked Prisma (empty table, DB error, partial weights)
 *   Group 4 — Full scoreApplication pipeline with mocked Prisma
 *   Group 5 — Fire-and-forget wrapper
 *   Group 6 — Batch unscored scoring
 *
 * Pure function tests require no DB. Integration tests mock prisma directly.
 */
import {
  scoreIntentExport,
  scoreCapitalExport,
  scoreExecutionExport,
  scoreValuePropositionExport,
  scoreAvailabilityExport,
  scoreVeronicaExport,
  determineRouteExport,
  loadScoringWeights,
  scoreApplication,
  scoreApplicationFireAndForget,
  scoreUnscoredApplications,
} from '../services/scoring/applicationScoringService';
import { prisma } from '../config/database';

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP 1: SUB-SCORE PURE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Application Scoring — Sub-Scores [Group 1]', () => {

  // ── 1.1 Intent Score ─────────────────────────────────────────────────────
  describe('scoreIntent', () => {
    test('join and collaborate → 0.8', () => {
      expect(scoreIntentExport('join')).toBe(0.8);
      expect(scoreIntentExport('collaborate')).toBe(0.8);
    });

    test('invest and propose → 0.9', () => {
      expect(scoreIntentExport('invest')).toBe(0.9);
      expect(scoreIntentExport('propose')).toBe(0.9);
    });

    test('other → 0.3', () => {
      expect(scoreIntentExport('other')).toBe(0.3);
    });

    test('null/undefined → 0.3', () => {
      expect(scoreIntentExport(null)).toBe(0.3);
    });

    test('unknown intent type → 0.3', () => {
      expect(scoreIntentExport('unknown_value')).toBe(0.3);
    });
  });

  // ── 1.2 Capital Score ─────────────────────────────────────────────────────
  describe('scoreCapital', () => {
    test('null → 0.3', () => {
      expect(scoreCapitalExport(null)).toBe(0.3);
    });

    test('empty string → 0.3', () => {
      expect(scoreCapitalExport('')).toBe(0.3);
    });

    test('250k+ variants → 1.0', () => {
      expect(scoreCapitalExport('250k+')).toBe(1.0);
      expect(scoreCapitalExport('$250k+')).toBe(1.0);
      expect(scoreCapitalExport('$250K+')).toBe(1.0);
      expect(scoreCapitalExport('250000+')).toBe(1.0);
      expect(scoreCapitalExport('$250,000')).toBe(1.0);
    });

    test('50k–250k variants → 0.7', () => {
      expect(scoreCapitalExport('50k – 250k')).toBe(0.7);
      expect(scoreCapitalExport('$50k – $250k')).toBe(0.7);
      expect(scoreCapitalExport('50000')).toBe(0.7);
      expect(scoreCapitalExport('100000')).toBe(0.7);
    });

    test('10k–50k variants → 0.4', () => {
      expect(scoreCapitalExport('10k – 50k')).toBe(0.4);
      expect(scoreCapitalExport('$10k – $50k')).toBe(0.4);
      expect(scoreCapitalExport('15000')).toBe(0.4);
    });

    test('below 10k → 0.3', () => {
      expect(scoreCapitalExport('5k')).toBe(0.3);
      expect(scoreCapitalExport('$5,000')).toBe(0.3);
      expect(scoreCapitalExport('not_applicable')).toBe(0.3);
    });
  });

  // ── 1.3 Execution Score ───────────────────────────────────────────────────
  describe('scoreExecution', () => {
    test('has URL + outcome >= 50 chars → 0.9', () => {
      const longOutcome = 'A'.repeat(50);
      expect(scoreExecutionExport('https://github.com/example', longOutcome)).toBe(0.9);
    });

    test('has URL + outcome > 0 but < 50 → 0.6', () => {
      expect(scoreExecutionExport('https://github.com/example', 'Built a feature.')).toBe(0.6);
    });

    test('has outcome >= 50 but no URL → 0.5', () => {
      const longOutcome = 'A'.repeat(50);
      expect(scoreExecutionExport('', longOutcome)).toBe(0.5);
      expect(scoreExecutionExport(null, longOutcome)).toBe(0.5);
    });

    test('has URL but empty outcome → 0.4', () => {
      expect(scoreExecutionExport('https://github.com/example', '')).toBe(0.4);
      expect(scoreExecutionExport('https://github.com/example', null)).toBe(0.4);
    });

    test('no URL and no outcome → 0.2', () => {
      expect(scoreExecutionExport('', '')).toBe(0.2);
      expect(scoreExecutionExport(null, null)).toBe(0.2);
    });

    test('URL whitespace-only treated as missing → 0.2', () => {
      expect(scoreExecutionExport('   ', '')).toBe(0.2);
    });

    test('outcome exactly 49 chars with URL → 0.6', () => {
      const outcome49 = 'A'.repeat(49);
      expect(scoreExecutionExport('https://github.com/example', outcome49)).toBe(0.6);
    });

    test('outcome exactly 50 chars with URL → 0.9', () => {
      const outcome50 = 'A'.repeat(50);
      expect(scoreExecutionExport('https://github.com/example', outcome50)).toBe(0.9);
    });
  });

  // ── 1.4 Value Proposition Score ──────────────────────────────────────────
  describe('scoreValueProposition', () => {
    test('null/empty → 0.2', () => {
      expect(scoreValuePropositionExport(null)).toBe(0.2);
      expect(scoreValuePropositionExport('')).toBe(0.2);
    });

    test('whitespace-only → 0.2', () => {
      expect(scoreValuePropositionExport('   ')).toBe(0.2);
    });

    test('≤ 20 chars → 0.2', () => {
      expect(scoreValuePropositionExport('Short vp')).toBe(0.2);    // 9 chars
      expect(scoreValuePropositionExport('A'.repeat(20))).toBe(0.2);
    });

    test('21–50 chars → 0.3', () => {
      expect(scoreValuePropositionExport('A'.repeat(21))).toBe(0.3);
      expect(scoreValuePropositionExport('A'.repeat(50))).toBe(0.3);
    });

    test('51–100 chars → 0.5', () => {
      expect(scoreValuePropositionExport('A'.repeat(51))).toBe(0.5);
      expect(scoreValuePropositionExport('A'.repeat(100))).toBe(0.5);
    });

    test('101–200 chars → 0.7', () => {
      expect(scoreValuePropositionExport('A'.repeat(101))).toBe(0.7);
      expect(scoreValuePropositionExport('A'.repeat(200))).toBe(0.7);
    });

    test('> 200 chars → 0.9', () => {
      expect(scoreValuePropositionExport('A'.repeat(201))).toBe(0.9);
      expect(scoreValuePropositionExport('A'.repeat(500))).toBe(0.9);
    });
  });

  // ── 1.5 Availability Score ───────────────────────────────────────────────
  describe('scoreAvailability', () => {
    test('null → 0.3', () => {
      expect(scoreAvailabilityExport(null)).toBe(0.3);
    });

    test('full-time or full → 1.0', () => {
      expect(scoreAvailabilityExport('full-time')).toBe(1.0);
      expect(scoreAvailabilityExport('Full Time')).toBe(1.0);
      expect(scoreAvailabilityExport('FULL')).toBe(1.0);
      expect(scoreAvailabilityExport('fully available')).toBe(1.0);
    });

    test('part-time or part → 0.6', () => {
      expect(scoreAvailabilityExport('part-time')).toBe(0.6);
      expect(scoreAvailabilityExport('Part Time')).toBe(0.6);
      expect(scoreAvailabilityExport('PART')).toBe(0.6);
    });

    test('other/unrecognized → 0.3', () => {
      expect(scoreAvailabilityExport('weekends only')).toBe(0.3);
      expect(scoreAvailabilityExport('flexible')).toBe(0.3);
      expect(scoreAvailabilityExport('not sure')).toBe(0.3);
    });
  });

  // ── 1.6 Veronica Score ──────────────────────────────────────────────────
  describe('scoreVeronica', () => {
    test('null → 0.5 (default)', () => {
      expect(scoreVeronicaExport(null)).toBe(0.5);
    });

    test('undefined → 0.5 (default)', () => {
      expect(scoreVeronicaExport(undefined)).toBe(0.5);
    });

    test('passes through valid scores unchanged', () => {
      expect(scoreVeronicaExport(0.0)).toBe(0.0);
      expect(scoreVeronicaExport(0.25)).toBe(0.25);
      expect(scoreVeronicaExport(0.5)).toBe(0.5);
      expect(scoreVeronicaExport(0.75)).toBe(0.75);
      expect(scoreVeronicaExport(1.0)).toBe(1.0);
    });

    test('clamps values below 0 to 0', () => {
      expect(scoreVeronicaExport(-0.1)).toBe(0);
      expect(scoreVeronicaExport(-1.0)).toBe(0);
    });

    test('clamps values above 1 to 1', () => {
      expect(scoreVeronicaExport(1.1)).toBe(1.0);
      expect(scoreVeronicaExport(2.0)).toBe(1.0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP 2: ROUTE DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Application Scoring — Route Determination [Group 2]', () => {
  test('score >= 0.75 → fast_track', () => {
    expect(determineRouteExport(0.75)).toBe('fast_track');
    expect(determineRouteExport(0.80)).toBe('fast_track');
    expect(determineRouteExport(1.0)).toBe('fast_track');
  });

  test('score 0.40–0.74 → standard', () => {
    expect(determineRouteExport(0.40)).toBe('standard');
    expect(determineRouteExport(0.50)).toBe('standard');
    expect(determineRouteExport(0.74)).toBe('standard');
  });

  test('score < 0.40 → hold', () => {
    expect(determineRouteExport(0.39)).toBe('hold');
    expect(determineRouteExport(0.0)).toBe('hold');
    expect(determineRouteExport(-0.1)).toBe('hold');
  });

  test('edge case at exactly 0.75 boundary', () => {
    expect(determineRouteExport(0.75)).toBe('fast_track');
  });

  test('edge case at exactly 0.40 boundary', () => {
    expect(determineRouteExport(0.40)).toBe('standard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP 3: WEIGHT LOADING (MOCKED)
// ─────────────────────────────────────────────────────────────────────────────

describe('Application Scoring — Weight Loading [Group 3]', () => {
  const originalFindMany = prisma.scoringWeight.findMany;

  afterEach(() => {
    prisma.scoringWeight.findMany = originalFindMany;
  });

  test('returns default weights when table is empty', async () => {
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]);
    const weights = await loadScoringWeights();
    expect(weights.intent).toBe(1.0);
    expect(weights.capital).toBe(0.5);
    expect(weights.execution).toBe(2.0);
    expect(weights.vp).toBe(1.5);
    expect(weights.availability).toBe(0.8);
    expect(weights.veronica).toBe(1.2);
  });

  test('returns stored weights when table has rows', async () => {
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([
      { weightKey: 'intent', weight: 2.0 },
      { weightKey: 'execution', weight: 3.0 },
    ]);
    const weights = await loadScoringWeights();
    // Stored values
    expect(weights.intent).toBe(2.0);
    expect(weights.execution).toBe(3.0);
    // Missing keys filled with defaults
    expect(weights.capital).toBe(0.5);
    expect(weights.vp).toBe(1.5);
    expect(weights.availability).toBe(0.8);
    expect(weights.veronica).toBe(1.2);
  });

  test('falls back to defaults on DB error', async () => {
    prisma.scoringWeight.findMany = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    const weights = await loadScoringWeights();
    expect(weights.intent).toBe(1.0);
    expect(weights.capital).toBe(0.5);
    expect(weights.execution).toBe(2.0);
    expect(weights.vp).toBe(1.5);
    expect(weights.availability).toBe(0.8);
    expect(weights.veronica).toBe(1.2);
  });

  test('ignores unknown weight keys', async () => {
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([
      { weightKey: 'intent', weight: 1.5 },
      { weightKey: 'bogus_key', weight: 99.0 }, // Should be ignored
    ]);
    const weights = await loadScoringWeights();
    expect(weights.intent).toBe(1.5);
    expect((weights as unknown as Record<string, unknown>).bogus_key).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP 4: FULL scoreApplication PIPELINE (MOCKED)
// ─────────────────────────────────────────────────────────────────────────────

describe('Application Scoring — Full Pipeline [Group 4]', () => {
  const mockIntake = {
    id: 'intake-test-1',
    fullName: 'Alice',
    email: 'alice@test.com',
    intentType: 'join',
    capitalRange: '$50k – $250k',
    executionProofUrl: 'https://github.com/alice/project',
    executionOutcome: 'Built a distributed task queue. Implemented retry logic with exponential backoff. Deployed to production serving 10k+ requests daily.',
    executionRecency: 'last-month',
    valueProposition: 'I bring deep experience in distributed systems and real-time data processing. I have built and scaled platforms handling millions of events per day. I am passionate about open-source and community building.',
    availability: 'full-time',
    timeline: 'next-month',
    intentOutcome30_60: 'Ship first MVP',
    prefilterAck: true,
    prefilterSessionId: 'sess_abc123',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    phoneOrWhatsapp: null,
    countryTimezone: null,
  };

  const mockReview = { veronicaScore: 0.85 };

  const originalFindUniqueEntry = prisma.entryIntake.findUnique;
  const originalFindFirstReview = prisma.gatekeeperReview.findFirst;
  const originalFindManyWeights = prisma.scoringWeight.findMany;
  const originalUpsertScore = prisma.applicationScore.upsert;
  const originalCreateLog = prisma.systemLog.create;

  afterEach(() => {
    prisma.entryIntake.findUnique = originalFindUniqueEntry;
    prisma.gatekeeperReview.findFirst = originalFindFirstReview;
    prisma.scoringWeight.findMany = originalFindManyWeights;
    prisma.applicationScore.upsert = originalUpsertScore;
    prisma.systemLog.create = originalCreateLog;
  });

  test('scores high-potential applicant as fast_track', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue(mockIntake);
    prisma.gatekeeperReview.findFirst = jest.fn().mockResolvedValue(mockReview);
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]); // use defaults
    prisma.applicationScore.upsert = jest.fn().mockResolvedValue({});
    prisma.systemLog.create = jest.fn().mockResolvedValue({});

    const result = await scoreApplication('intake-test-1');

    expect(result).not.toBeNull();
    expect(result!.entryIntakeId).toBe('intake-test-1');
    expect(result!.routeTag).toBe('fast_track');
    expect(result!.totalScore).toBeGreaterThanOrEqual(0.75);
    expect(result!.subScores.intent).toBe(0.8);   // join
    expect(result!.subScores.capital).toBe(0.7);   // $50k-$250k
    expect(result!.subScores.execution).toBe(0.9);  // URL + outcome >= 50
    expect(result!.subScores.valueProposition).toBe(0.9); // > 200 chars
    expect(result!.subScores.availability).toBe(1.0); // full-time
    expect(result!.subScores.veronica).toBe(0.85);  // from review
  });

  test('scores weak applicant as hold', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue({
      ...mockIntake,
      intentType: 'other',
      capitalRange: null,
      executionProofUrl: '',
      executionOutcome: '',
      valueProposition: 'Hi',
      availability: null,
    });
    prisma.gatekeeperReview.findFirst = jest.fn().mockResolvedValue(null); // no review yet
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]); // use defaults
    prisma.applicationScore.upsert = jest.fn().mockResolvedValue({});
    prisma.systemLog.create = jest.fn().mockResolvedValue({});

    const result = await scoreApplication('intake-test-2');

    expect(result).not.toBeNull();
    expect(result!.routeTag).toBe('hold');
    expect(result!.totalScore).toBeLessThan(0.40);
    expect(result!.subScores.veronica).toBe(0.5); // default when no review
  });

  test('returns null for non-existent intake', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue(null);

    const result = await scoreApplication('intake-nonexistent');
    expect(result).toBeNull();
  });

  test('handles Prisma error gracefully — returns null, does not throw', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockRejectedValue(new Error('DB timeout'));

    const result = await scoreApplication('intake-test-3');
    expect(result).toBeNull();
  });

  test('persists to ApplicationScore table via upsert', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue(mockIntake);
    prisma.gatekeeperReview.findFirst = jest.fn().mockResolvedValue(mockReview);
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]);
    prisma.systemLog.create = jest.fn().mockResolvedValue({});

    const upsertMock = jest.fn().mockResolvedValue({});
    prisma.applicationScore.upsert = upsertMock;

    await scoreApplication('intake-test-1');

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArgs = upsertMock.mock.calls[0][0];
    expect(upsertArgs.where.entryIntakeId).toBe('intake-test-1');
    expect(upsertArgs.create.entryIntakeId).toBe('intake-test-1');
    expect(upsertArgs.create.totalScore).toBeGreaterThan(0);
    expect(upsertArgs.create.routeTag).toBe('fast_track');
  });

  test('handles missing GatekeeperReview by defaulting veronica to 0.5', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue(mockIntake);
    prisma.gatekeeperReview.findFirst = jest.fn().mockResolvedValue(null);
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]);
    prisma.applicationScore.upsert = jest.fn().mockResolvedValue({});
    prisma.systemLog.create = jest.fn().mockResolvedValue({});

    const result = await scoreApplication('intake-test-1');
    expect(result).not.toBeNull();
    expect(result!.subScores.veronica).toBe(0.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP 5: FIRE-AND-FORGET WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

describe('Application Scoring — Fire-and-Forget [Group 5]', () => {
  const originalFindUnique = prisma.entryIntake.findUnique;
  const originalUpsert = prisma.applicationScore.upsert;
  const originalCreate = prisma.systemLog.create;
  const originalFindFirst = prisma.gatekeeperReview.findFirst;
  const originalFindMany = prisma.scoringWeight.findMany;

  afterEach(() => {
    prisma.entryIntake.findUnique = originalFindUnique;
    prisma.applicationScore.upsert = originalUpsert;
    prisma.systemLog.create = originalCreate;
    prisma.gatekeeperReview.findFirst = originalFindFirst;
    prisma.scoringWeight.findMany = originalFindMany;
  });

  test('resolves successfully when scoring succeeds', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue({
      id: 'intake-ff-1',
      fullName: 'Bob',
      email: 'bob@test.com',
      intentType: 'invest',
      capitalRange: '250k+',
      executionProofUrl: 'https://example.com',
      executionOutcome: 'Outcome text that is long enough to pass the fifty character threshold easily.',
      valueProposition: 'A'.repeat(100),
      availability: 'full-time',
    });
    prisma.gatekeeperReview.findFirst = jest.fn().mockResolvedValue(null);
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]);
    prisma.applicationScore.upsert = jest.fn().mockResolvedValue({});
    prisma.systemLog.create = jest.fn().mockResolvedValue({});

    await expect(scoreApplicationFireAndForget('intake-ff-1')).resolves.toBeUndefined();
  });

  test('does not throw when scoring throws internally', async () => {
    prisma.entryIntake.findUnique = jest.fn().mockRejectedValue(new Error('Unexpected error'));

    // The fire-and-forget wrapper should swallow errors
    await expect(scoreApplicationFireAndForget('intake-ff-2')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP 6: BATCH UNSCORED SCORING
// ─────────────────────────────────────────────────────────────────────────────

describe('Application Scoring — Batch Unscored [Group 6]', () => {
  const originalFindManyEntry = prisma.entryIntake.findMany;
  const originalFindManyScore = prisma.applicationScore.findMany;
  const originalFindUnique = prisma.entryIntake.findUnique;
  const originalFindFirst = prisma.gatekeeperReview.findFirst;
  const originalFindManyWeights = prisma.scoringWeight.findMany;
  const originalUpsert = prisma.applicationScore.upsert;
  const originalCreate = prisma.systemLog.create;

  afterEach(() => {
    prisma.entryIntake.findMany = originalFindManyEntry;
    prisma.applicationScore.findMany = originalFindManyScore;
    prisma.entryIntake.findUnique = originalFindUnique;
    prisma.gatekeeperReview.findFirst = originalFindFirst;
    prisma.scoringWeight.findMany = originalFindManyWeights;
    prisma.applicationScore.upsert = originalUpsert;
    prisma.systemLog.create = originalCreate;
  });

  test('scores unscored intakes and returns count', async () => {
    // Three intakes exist, one already scored
    prisma.applicationScore.findMany = jest.fn().mockResolvedValue([
      { entryIntakeId: 'intake-scored-1' },
    ]);
    prisma.entryIntake.findMany = jest.fn().mockResolvedValue([
      { id: 'intake-scored-1' },
      { id: 'intake-unscored-1' },
      { id: 'intake-unscored-2' },
    ]);
    // Mock scoreApplication calls for unscored intakes
    prisma.entryIntake.findUnique = jest.fn().mockResolvedValue({
      id: 'intake-unscored-1',
      intentType: 'collaborate',
      capitalRange: null,
      executionProofUrl: null,
      executionOutcome: null,
      valueProposition: 'Some value proposition that is long enough to get a decent score.',
      availability: null,
    });
    prisma.gatekeeperReview.findFirst = jest.fn().mockResolvedValue(null);
    prisma.scoringWeight.findMany = jest.fn().mockResolvedValue([]);
    prisma.applicationScore.upsert = jest.fn().mockResolvedValue({});
    prisma.systemLog.create = jest.fn().mockResolvedValue({});

    const result = await scoreUnscoredApplications();
    expect(result.scored).toBe(2);
  });

  test('returns 0 when all intakes already scored', async () => {
    prisma.applicationScore.findMany = jest.fn().mockResolvedValue([
      { entryIntakeId: 'intake-a' },
      { entryIntakeId: 'intake-b' },
    ]);
    prisma.entryIntake.findMany = jest.fn().mockResolvedValue([
      { id: 'intake-a' },
      { id: 'intake-b' },
    ]);

    const result = await scoreUnscoredApplications();
    expect(result.scored).toBe(0);
  });
});
