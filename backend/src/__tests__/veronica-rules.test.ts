/**
 * Test Group 3, 4, 5 — Veronica AI Logic, Consistency & Fallback
 *
 * Tests the rule-based fallback functions that run when Ollama is unavailable.
 * These are pure functions — no DB, no network calls.
 */
import { ruleBasedSubmissionCheckExport } from '../services/veronicaService';

// ── HELPER: Valid submission data ──────────────────────────────────────────

function makeValidSubmission(overrides: Record<string, unknown> = {}) {
  return {
    description: 'Built a real-time notification system using WebSockets. Implemented the server-side event emitter and integrated with the frontend React components. Fixed 3 related bugs during testing.',
    proofLink: 'https://github.com/example/pr/42',
    hoursLogged: 4,
    existingCount: 0,
    ...overrides,
  };
}

// ── TEST GROUP 3: AI (VERONICA) LOGIC ─────────────────────────────────────

describe('Veronica Rule-Based Logic [Group 3]', () => {

  // ── Scenario 1: High-quality structured submission ────────────────────
  describe('High-quality structured submission', () => {
    const result = ruleBasedSubmissionCheckExport(makeValidSubmission());

    test('should NOT be FLAGGED', () => {
      expect(['NEEDS_REVIEW', 'VALID']).toContain(result.status);
    });

    test('should NOT auto-approve (never 100% confidence)', () => {
      expect(result.score).toBeLessThan(0.75);
      expect(result.status).not.toBe('VALID');
    });

    test('should have no critical flags', () => {
      expect(result.flags).not.toContain('description_too_short');
      expect(result.flags).not.toContain('invalid_proof_link');
      expect(result.flags).not.toContain('copy_paste_detected');
    });
  });

  // ── Scenario 2: Low-quality vague submission ──────────────────────────
  describe('Low-quality vague submission', () => {
    const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
      description: 'Did some stuff',
      proofLink: '',
      hoursLogged: 0.25,
    }));

    test('should be FLAGGED or NEEDS_REVIEW', () => {
      expect(['FLAGGED', 'NEEDS_REVIEW']).toContain(result.status);
    });

    test('should have description_too_short flag', () => {
      expect(result.flags).toContain('description_too_short');
    });

    test('should have invalid_proof_link flag', () => {
      expect(result.flags).toContain('invalid_proof_link');
    });

    test('score should be low', () => {
      expect(result.score).toBeLessThan(0.5);
    });
  });

  // ── Scenario 3: Spam content ──────────────────────────────────────────
  describe('Spam content detection', () => {
    const spamDescriptions = [
      'Buy cheap tickets now! Limited time offer!!! Click here!!! https://spam.my.link/ Buy cheap tickets now! Limited time offer!!!',
      'Check out my profile! Check out my profile! Check out my profile! Check out my profile!',
      'Win a free iPhone! Win a free iPhone! Win a free iPhone! Win a free iPhone!',
    ];

    spamDescriptions.forEach((desc, i) => {
      test(`should flag spam variant ${i + 1}`, () => {
        const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
          description: desc,
          proofLink: 'https://spam.link',
        }));
        expect(result.flags).toContain('copy_paste_detected');
        expect(result.score).toBeLessThan(0.5);
      });
    });
  });

  // ── Scenario 4: Duplicate content ─────────────────────────────────────
  describe('Duplicate content detection', () => {
    test('should flag when existingCount > 2', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        existingCount: 5,
      }));
      expect(result.flags).toContain('possible_duplicate');
      expect(result.score).toBeLessThan(0.5);
    });

    test('should not flag when existingCount is 0-2', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        existingCount: 1,
      }));
      expect(result.flags).not.toContain('possible_duplicate');
    });
  });

  // ── Scenario 5: Contradictory/empty inputs ────────────────────────────
  describe('Contradictory / empty inputs', () => {
    test('should handle empty description', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        description: '',
      }));
      expect(result.flags).toContain('description_too_short');
      expect(result.status).toBe('FLAGGED');
    });

    test('should handle whitespace-only description', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        description: '   ',
      }));
      expect(result.flags).toContain('description_too_short');
    });

    test('should handle null proofLink', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        proofLink: null as any,
      }));
      expect(result.flags).toContain('invalid_proof_link');
    });

    test('should handle undefined proofLink', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        proofLink: undefined as any,
      }));
      expect(result.flags).toContain('invalid_proof_link');
    });
  });

  // ── Scenario 6: Empty intent / no action verbs ────────────────────────
  describe('No action verb detection', () => {
    test('should flag description with no action verbs', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        description: 'The system architecture consists of multiple microservices that communicate via message queues. The database schema includes users, products, and orders tables.',
        proofLink: 'https://github.com/example/repo',
      }));
      // This description has NO action verbs — it's a spec/description
      expect(result.flags).toContain('no_action_verb');
    });

    test('should NOT flag with clear action verbs', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        description: 'Built a REST API endpoint for user authentication. Implemented JWT token verification and added rate limiting to prevent abuse. Tested with 100 concurrent requests.',
        proofLink: 'https://github.com/example/auth',
      }));
      expect(result.flags).not.toContain('no_action_verb');
    });
  });

  // ── Scenario 7: Hours out of range ────────────────────────────────────
  describe('Hours validation', () => {
    test('should flag hours less than 0.5', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        hoursLogged: 0.1,
      }));
      expect(result.flags).toContain('hours_out_of_range');
    });

    test('should flag hours greater than 12', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        hoursLogged: 16,
      }));
      expect(result.flags).toContain('hours_out_of_range');
    });

    test('should accept hours between 0.5 and 12', () => {
      [0.5, 2, 6, 8, 12].forEach(hours => {
        const result = ruleBasedSubmissionCheckExport(makeValidSubmission({ hoursLogged: hours }));
        expect(result.flags).not.toContain('hours_out_of_range');
      });
    });

    test('should handle undefined hoursLogged', () => {
      const result = ruleBasedSubmissionCheckExport(makeValidSubmission({
        hoursLogged: undefined,
      }));
      expect(result.flags).not.toContain('hours_out_of_range');
    });
  });
});

// ── TEST GROUP 4: OUTPUT CONSISTENCY ──────────────────────────────────────

describe('Veronica Output Consistency [Group 4]', () => {
  const testCases = [
    { name: 'high quality submission', data: makeValidSubmission() },
    { name: 'low quality submission', data: makeValidSubmission({ description: 'Did some coding', proofLink: '', hoursLogged: 0.1 }) },
    { name: 'copy paste', data: makeValidSubmission({ description: 'Buy now! Buy now! Buy now! Buy now!', proofLink: 'https://spam.com' }) },
    { name: 'no action verb', data: makeValidSubmission({ description: 'The architecture of the system consists of multiple layers with various components interacting through well-defined interfaces.', proofLink: 'https://github.com/example' }) },
    { name: 'short description', data: makeValidSubmission({ description: 'Hi', proofLink: '', hoursLogged: 0 }) },
  ];

  testCases.forEach(({ name, data }) => {
    test(`${name} produces consistent results across 5 runs`, () => {
      const results = Array.from({ length: 5 }, () => ruleBasedSubmissionCheckExport(data));

      // All runs should have the same status
      const statuses = results.map(r => r.status);
      expect(new Set(statuses).size).toBe(1);

      // All runs should have the same score
      const scores = results.map(r => r.score);
      expect(new Set(scores).size).toBe(1);

      // All runs should have the same flags
      const flagSets = results.map(r => JSON.stringify(r.flags.sort()));
      expect(new Set(flagSets).size).toBe(1);
    });
  });
});

// ── TEST GROUP 5: FALLBACK SYSTEM ────────────────────────────────────────

describe('Veronica Fallback System [Group 5]', () => {
  test('rule-based fallback NEVER returns VALID', () => {
    // Try with the best possible data
    const bestCases = [
      makeValidSubmission({ description: 'Built a complex distributed system from scratch. Implemented multiple microservices with event-driven architecture. Deployed to production with zero downtime.', proofLink: 'https://github.com/example/awesome-project', hoursLogged: 8 }),
      makeValidSubmission({ description: 'Refactored the entire authentication flow. Migrated from JWT to session-based auth with Redis. Added comprehensive test coverage reaching 95%.', proofLink: 'https://github.com/example/auth-refactor', hoursLogged: 12 }),
      makeValidSubmission({ description: 'Implemented CI/CD pipeline using GitHub Actions. Configured automated testing, building, and deployment to staging. Reduced deployment time from 30min to 5min.', proofLink: 'https://github.com/example/ci-cd', hoursLogged: 6 }),
    ];

    bestCases.forEach((data, i) => {
      const result = ruleBasedSubmissionCheckExport(data);
      expect(result.status).not.toBe('VALID');
      expect(result.score).toBeLessThanOrEqual(0.65);
    });
  });

  test('score is always capped at 0.65 maximum', () => {
    // Even with perfect data, score should never exceed 0.65
    const manyResults = Array.from({ length: 20 }, () => {
      const desc = `Built ${Math.random().toString(36).substring(2, 8)}. Implemented ${Math.random().toString(36).substring(2, 8)}. Deployed ${Math.random().toString(36).substring(2, 8)}.`;
      return ruleBasedSubmissionCheckExport(makeValidSubmission({
        description: 'Built a feature. Implemented the changes. Deployed to production.',
        proofLink: 'https://github.com/example/repo',
      }));
    });

    manyResults.forEach(r => {
      expect(r.score).toBeLessThanOrEqual(0.65);
    });
  });

  test('score is never negative', () => {
    const edgeCases = [
      makeValidSubmission({ description: '', proofLink: '', hoursLogged: 0, existingCount: 99 }),
      makeValidSubmission({ description: '', proofLink: '', hoursLogged: 0 }),
      makeValidSubmission({ description: '', proofLink: null as any }),
    ];

    edgeCases.forEach(data => {
      const result = ruleBasedSubmissionCheckExport(data);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  test('status is always one of the allowed values', () => {
    const allowedStatuses = ['FLAGGED', 'NEEDS_REVIEW'];
    // Submit with various data patterns
    const variedResults = [
      makeValidSubmission(),
      makeValidSubmission({ description: 'a', proofLink: '' }),
      makeValidSubmission({ description: '', proofLink: '' }),
      makeValidSubmission({ description: 'Built a thing. Deployed it. Fixed bugs.', proofLink: 'https://example.com' }),
    ].map(d => ruleBasedSubmissionCheckExport(d));

    variedResults.forEach(r => {
      expect(allowedStatuses).toContain(r.status);
    });
  });
});
