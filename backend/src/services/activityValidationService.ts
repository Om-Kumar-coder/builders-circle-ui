/**
 * Activity Validation Service
 * Enforces proof URL rules, duplicate detection, and minimum quality checks
 * before an activity is accepted into the system.
 */

import { prisma } from '../config/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Proof URL rules per contribution type ─────────────────────────────────────

/**
 * Each contribution type declares which URL patterns are acceptable proof.
 * At least one pattern must match.
 */
const PROOF_RULES: Record<string, { patterns: RegExp[]; label: string }[]> = {
  code: [
    {
      label: 'GitHub / GitLab / Bitbucket commit, PR, or issue',
      patterns: [
        /^https:\/\/github\.com\/.+\/(commit|pull|issues|compare)\/.+/i,
        /^https:\/\/gitlab\.com\/.+\/(commit|merge_requests|-\/issues)\/.+/i,
        /^https:\/\/bitbucket\.org\/.+\/(commits|pull-requests)\/.+/i,
      ],
    },
  ],
  documentation: [
    {
      label: 'GitHub / GitLab PR, commit, Notion, Confluence, or Google Docs',
      patterns: [
        /^https:\/\/github\.com\/.+\/(pull|commit)\/.+/i,
        /^https:\/\/gitlab\.com\/.+\/(merge_requests|commit)\/.+/i,
        /^https:\/\/www\.notion\.so\/.+/i,
        /^https:\/\/[a-z0-9-]+\.atlassian\.net\/wiki\/.+/i,
        /^https:\/\/docs\.google\.com\/.+/i,
      ],
    },
  ],
  review: [
    {
      label: 'GitHub / GitLab PR review or comment',
      patterns: [
        /^https:\/\/github\.com\/.+\/pull\/\d+.*/i,
        /^https:\/\/gitlab\.com\/.+\/merge_requests\/\d+.*/i,
      ],
    },
  ],
  hours_logged: [
    {
      label: 'Any verifiable HTTPS URL (Toggl, Harvest, Jira, GitHub, etc.)',
      patterns: [/^https:\/\/.+/i],
    },
  ],
  meeting: [
    {
      label: 'Any verifiable HTTPS URL (calendar invite, recording, notes)',
      patterns: [/^https:\/\/.+/i],
    },
  ],
  research: [
    {
      label: 'Any verifiable HTTPS URL (doc, report, GitHub issue, etc.)',
      patterns: [/^https:\/\/.+/i],
    },
  ],
  task_completion: [
    {
      label: 'GitHub issue/PR, Jira, Linear, or Notion task',
      patterns: [
        /^https:\/\/github\.com\/.+\/issues\/\d+.*/i,
        /^https:\/\/github\.com\/.+\/pull\/\d+.*/i,
        /^https:\/\/[a-z0-9-]+\.atlassian\.net\/browse\/.+/i,
        /^https:\/\/linear\.app\/.+\/issue\/.+/i,
        /^https:\/\/www\.notion\.so\/.+/i,
      ],
    },
  ],
};

// ── Quality thresholds ────────────────────────────────────────────────────────

const QUALITY = {
  MIN_DESCRIPTION_LENGTH: 20,
  MIN_WORK_SUMMARY_LENGTH: 30,
  // Duplicate window: same user + same proofLink within this many hours
  DUPLICATE_WINDOW_HOURS: 72,
  // Similarity window: same user + same cycle + same contributionType within this many minutes
  SPAM_WINDOW_MINUTES: 30,
  MAX_SIMILAR_IN_WINDOW: 3,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateProofUrl(proofLink: string, contributionType: string): string | null {
  const rules = PROOF_RULES[contributionType] ?? PROOF_RULES['hours_logged'];

  for (const rule of rules) {
    if (rule.patterns.some(p => p.test(proofLink))) return null; // valid
  }

  const labels = rules.map(r => r.label).join('; or ');
  return `Proof link is not valid for "${contributionType}". Expected: ${labels}.`;
}

function checkDescriptionQuality(
  description: string | undefined,
  workSummary: string | undefined,
): string | null {
  const desc = (description ?? '').trim();
  const summary = (workSummary ?? '').trim();

  if (desc.length > 0 && desc.length < QUALITY.MIN_DESCRIPTION_LENGTH) {
    return `Description is too short (${desc.length} chars). Provide at least ${QUALITY.MIN_DESCRIPTION_LENGTH} characters or leave it blank.`;
  }
  if (summary.length > 0 && summary.length < QUALITY.MIN_WORK_SUMMARY_LENGTH) {
    return `Work summary is too short (${summary.length} chars). Provide at least ${QUALITY.MIN_WORK_SUMMARY_LENGTH} characters or leave it blank.`;
  }
  return null;
}

// ── Main validator ────────────────────────────────────────────────────────────

export async function validateActivitySubmission(params: {
  userId: string;
  cycleId: string;
  contributionType: string;
  proofLink: string;
  description?: string;
  workSummary?: string;
  hoursLogged?: number;
  linkedTaskId?: string;
}): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Proof URL format validation
  const proofError = validateProofUrl(params.proofLink, params.contributionType);
  if (proofError) errors.push(proofError);

  // 2. Description / work summary quality
  const qualityError = checkDescriptionQuality(params.description, params.workSummary);
  if (qualityError) errors.push(qualityError);

  // 3. Hours sanity check
  if (params.hoursLogged !== undefined) {
    if (params.hoursLogged <= 0) errors.push('Hours logged must be greater than 0.');
    if (params.hoursLogged > 12) errors.push('Hours logged cannot exceed 12 per activity.');
  }

  // 4. Duplicate proof link detection (same user, same URL, within window)
  const dupWindow = new Date(Date.now() - QUALITY.DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000);
  const duplicate = await prisma.activityEvent.findFirst({
    where: {
      userId: params.userId,
      proofLink: params.proofLink,
      createdAt: { gte: dupWindow },
    },
    select: { id: true, createdAt: true },
  });
  if (duplicate) {
    errors.push(
      `Duplicate submission: this proof link was already submitted within the last ${QUALITY.DUPLICATE_WINDOW_HOURS} hours (activity ${duplicate.id}).`
    );
  }

  // 5. Spam detection — too many of the same type in a short window
  const spamWindow = new Date(Date.now() - QUALITY.SPAM_WINDOW_MINUTES * 60 * 1000);
  const recentSimilar = await prisma.activityEvent.count({
    where: {
      userId: params.userId,
      cycleId: params.cycleId,
      contributionType: params.contributionType,
      createdAt: { gte: spamWindow },
    },
  });
  if (recentSimilar >= QUALITY.MAX_SIMILAR_IN_WINDOW) {
    errors.push(
      `Spam detected: ${recentSimilar} "${params.contributionType}" activities submitted in the last ${QUALITY.SPAM_WINDOW_MINUTES} minutes. Please wait before submitting more.`
    );
  }

  // 6. Warn if no description AND no work summary (not a hard block, just advisory)
  if (!params.description?.trim() && !params.workSummary?.trim()) {
    warnings.push('No description or work summary provided. Adding context helps reviewers approve your activity faster.');
  }

  // 7. Nudge toward linkedTaskId for task_completion type
  if (params.contributionType === 'task_completion' && !params.linkedTaskId) {
    warnings.push(
      'task_completion activities should be linked to a task. Use linkedTaskId to connect this to an assigned task.'
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
