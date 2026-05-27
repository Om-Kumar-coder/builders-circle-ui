/**
 * Veronica — AI Gatekeeper Service
 * Uses Phi-3 Mini (3.8B) via Ollama for lightweight, fast validation.
 * Ollama endpoint: http://localhost:11434
 *
 * Validation philosophy:
 *   - Default to SKEPTICISM — only pass work that is clearly real
 *   - Detect gibberish, copy-paste, keyword dumps, and spec sheets
 *   - Require: action + context + outcome structure
 *   - NEVER auto-approve — always require human review for any uncertain cases
 *   - Fallback defaults to NEEDS REVIEW, not VALID
 *   - Auto-block when relevanceScore < 0.3 OR isMeaningfulWork === false
 */

import logger from '../utils/logger';
import { prisma } from '../config/database';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = 'phi3:mini';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SemanticAnalysis {
  isMeaningfulWork: boolean;
  hasAction: boolean;       // contains verbs: built, fixed, implemented, designed, etc.
  hasOutcome: boolean;      // describes a result or impact
  isCopyPaste: boolean;     // repeated phrases, spec dumps, doc copy
  relevanceScore: number;   // 0–1: how relevant to the stated contribution type
  reasoning: string;        // AI's explanation for inspection on failure
}

export interface VeronicaDimensions {
  intentConfidence: number;      // 0-1: genuineness of stated intent
  executionCredibility: number;  // 0-1: credibility of proof links & outcomes
  vpQuality: number;             // 0-1: specificity & authenticity of value prop
  trustScore: number;            // 0-1: anti-spam / fraud signal (inverted)
  commitmentSignal: number;      // 0-1: commitment from availability detail
  inferredCapitalSignal: number; // 0-1: capital capacity inferred from language
}

export interface VeronicaResult {
  status: 'VALID' | 'NEEDS_REVIEW' | 'FLAGGED';
  score: number;            // 0.0–1.0 overall confidence
  flags: string[];
  notes: string;
  semantic?: SemanticAnalysis;
  isFallback?: boolean;
  aiDecision?: 'AUTO_PASS' | 'FLAGGED' | 'AUTO_BLOCK';
  veronicaDimensions?: VeronicaDimensions;
  /** @deprecated Removed — Veronica no longer auto-approves anything. */
  autoApproved?: never;
}

export interface VeronicaHealthStatus {
  available: boolean;
  model: string | null;
  responseLatencyMs: number | null;
  checkedAt: string;
}

// ── Health Check ──────────────────────────────────────────────────────────────

export async function checkVeronicaHealth(): Promise<VeronicaHealthStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      return { available: false, model: null, responseLatencyMs: latency, checkedAt: new Date().toISOString() };
    }
    const data = await res.json() as { models?: Array<{ name: string }> };
    const loaded = data.models?.find(m => m.name.startsWith('phi3')) ?? null;
    return {
      available: true,
      model: loaded?.name ?? null,
      responseLatencyMs: latency,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      available: false,
      model: null,
      responseLatencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }
}

// ── Decision logic ────────────────────────────────────────────────────────────

function resolveAiDecision(score: number, semantic?: SemanticAnalysis): VeronicaResult['aiDecision'] {
  // Hard block conditions
  if (semantic && (!semantic.isMeaningfulWork || semantic.relevanceScore < 0.3)) return 'AUTO_BLOCK';
  if (score <= 0.30) return 'AUTO_BLOCK';
  // Never auto-pass — always require human review
  return 'FLAGGED';
}

function buildSemanticFlags(semantic: SemanticAnalysis): string[] {
  const flags: string[] = [];
  if (semantic.isCopyPaste)          flags.push('copy_paste_detected');
  if (!semantic.hasAction)           flags.push('no_action_verb');
  if (!semantic.hasOutcome)          flags.push('no_outcome_described');
  if (!semantic.isMeaningfulWork)    flags.push('not_meaningful_work');
  if (semantic.relevanceScore < 0.5) flags.push('low_relevance');
  if (semantic.relevanceScore < 0.3) flags.push('irrelevant_content');
  return flags;
}

function resolveStatusFromSemantic(score: number, semantic: SemanticAnalysis): VeronicaResult['status'] {
  if (!semantic.isMeaningfulWork || semantic.isCopyPaste || semantic.relevanceScore < 0.3) return 'FLAGGED';
  if (!semantic.hasAction || !semantic.hasOutcome || semantic.relevanceScore < 0.5) return 'NEEDS_REVIEW';
  // No more VALID for score >= 0.75 — always NEEDS_REVIEW at minimum
  // Only VALID if clearly meaningful work with action + outcome + high relevance
  if (score >= 0.75 && semantic.hasAction && semantic.hasOutcome) return 'NEEDS_REVIEW';
  return 'NEEDS_REVIEW';
}

// ── Ollama call ───────────────────────────────────────────────────────────────

interface OllamaResponse { response: string; done: boolean; }

async function callVeronica(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 500 },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = (await res.json()) as OllamaResponse;
  return data.response;
}

function parseDimensions(raw: Record<string, unknown>): VeronicaDimensions {
  const dims = (raw.dimensions ?? raw.veronicaDimensions ?? {}) as Record<string, unknown>;
  return {
    intentConfidence: Math.min(1, Math.max(0, parseFloat(dims.intentConfidence as string) ?? 0.5)),
    executionCredibility: Math.min(1, Math.max(0, parseFloat(dims.executionCredibility as string) ?? 0.5)),
    vpQuality: Math.min(1, Math.max(0, parseFloat(dims.vpQuality as string) ?? 0.5)),
    trustScore: Math.min(1, Math.max(0, parseFloat(dims.trustScore as string) ?? 0.5)),
    commitmentSignal: Math.min(1, Math.max(0, parseFloat(dims.commitmentSignal as string) ?? 0.5)),
    inferredCapitalSignal: Math.min(1, Math.max(0, parseFloat(dims.inferredCapitalSignal as string) ?? 0.5)),
  };
}

function parseSubmissionResponse(raw: string): { result: Omit<VeronicaResult, 'isFallback' | 'aiDecision' | 'autoApproved'>; semantic: SemanticAnalysis } {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const semantic: SemanticAnalysis = {
        isMeaningfulWork: Boolean(parsed.isMeaningfulWork ?? true),
        hasAction:        Boolean(parsed.hasAction ?? true),
        hasOutcome:       Boolean(parsed.hasOutcome ?? true),
        isCopyPaste:      Boolean(parsed.isCopyPaste ?? false),
        relevanceScore:   Math.min(1, Math.max(0, parseFloat(parsed.relevanceScore) || 0.5)),
        reasoning:        String(parsed.reasoning || parsed.notes || ''),
      };
      const score = Math.min(1, Math.max(0, parseFloat(parsed.score) || 0.5));
      const flags = [...(Array.isArray(parsed.flags) ? parsed.flags : []), ...buildSemanticFlags(semantic)];
      const status = resolveStatusFromSemantic(score, semantic);
      const veronicaDimensions = parseDimensions(parsed);
      return {
        result: { status, score, flags, notes: semantic.reasoning, semantic, veronicaDimensions },
        semantic,
      };
    }
  } catch { /* fallback below */ }
  return {
    result: { status: 'NEEDS_REVIEW', score: 0.5, flags: ['parse_error'], notes: raw.slice(0, 300) },
    semantic: { isMeaningfulWork: true, hasAction: true, hasOutcome: true, isCopyPaste: false, relevanceScore: 0.5, reasoning: raw.slice(0, 300) },
  };
}

function parseIntakeResponse(raw: string): VeronicaResult {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const veronicaDimensions = parseDimensions(parsed);
      return {
        status: parsed.status || 'NEEDS_REVIEW',
        score: Math.min(1, Math.max(0, parseFloat(parsed.score) || 0.5)),
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        notes: parsed.notes || '',
        veronicaDimensions,
      };
    }
  } catch { /* fallback below */ }
  return { status: 'NEEDS_REVIEW', score: 0.5, flags: ['parse_error'], notes: raw.slice(0, 200) };
}

// ── Audit logging helpers ─────────────────────────────────────────────────────

function logVeronicaDecision(event: string, activityId: string | undefined, score: number, flags: string[], reasoning: string) {
  prisma.systemLog.create({
    data: {
      event,
      severity: event.includes('block') || event.includes('gibberish') ? 'WARNING' : 'INFO',
      message: `[Veronica] ${event} — score: ${score.toFixed(2)}, flags: ${flags.join(', ') || 'none'}`,
      metadata: JSON.stringify({ activityId, score, flags, reasoning }),
    },
  }).catch(() => {});
}

// ── User Intake Review ────────────────────────────────────────────────────────

export async function reviewUserIntake(data: {
  name: string;
  email: string;
  roleType: string;
  description: string;
  proofLinks?: string;
  availability?: string;
}): Promise<VeronicaResult> {
  const prompt = `You are Veronica, an AI gatekeeper reviewing a new user registration application.
Be strict. Default to skepticism. Only approve if the application is clearly genuine.

Application:
- Name: ${data.name}
- Email: ${data.email}
- Role Type: ${data.roleType}
- Description: ${data.description}
- Proof Links: ${data.proofLinks || 'none'}
- Availability: ${data.availability || 'not specified'}

Reject or flag if:
1. Description is empty, gibberish, or under 15 words
2. Description is a copy-paste of a job posting or generic template
3. No clear reason why they want to join
4. Proof links missing for technical roles (dev, engineer, designer)
5. Email looks invalid

Respond ONLY with this JSON (no other text):
{"status":"VALID|NEEDS_REVIEW|FLAGGED","score":0.0-1.0,"flags":["flag1"],"notes":"brief reason for decision","dimensions":{"intentConfidence":0.0-1.0,"executionCredibility":0.0-1.0,"vpQuality":0.0-1.0,"trustScore":0.0-1.0,"commitmentSignal":0.0-1.0,"inferredCapitalSignal":0.0-1.0}}`;

  try {
    const raw = await callVeronica(prompt);
    const result = parseIntakeResponse(raw);
    const aiDecision = resolveAiDecision(result.score);
    return { ...result, isFallback: false, aiDecision };
  } catch (err) {
    logger.warn('[Veronica] intake review failed, using rule-based fallback', { err });
    prisma.systemLog.create({
      data: {
        event: 'veronica_ai_failure',
        severity: 'WARNING',
        message: '[Veronica] Ollama unavailable for intake review — rule-based fallback used',
        metadata: JSON.stringify({ type: 'intake', email: data.email, error: String(err) }),
      },
    }).catch(() => {});
    const result = ruleBasedIntakeCheck(data);
    return { ...result, flags: [...result.flags, 'ai_fallback'], isFallback: true, aiDecision: resolveAiDecision(result.score) };
  }
}

// ── Submission Pre-Check (semantic) ──────────────────────────────────────────

export async function reviewSubmission(data: {
  description: string;
  proofLink: string;
  hoursLogged?: number;
  contributionType: string;
  existingCount?: number;
  activityId?: string;
}): Promise<VeronicaResult> {
  const prompt = `You are Veronica, an AI gatekeeper evaluating whether a work submission represents REAL WORK DONE.

Be strict. Default to skepticism. Only mark as meaningful if a real task was clearly performed.

Submission:
- Contribution Type: ${data.contributionType}
- Description: "${data.description}"
- Proof Link: ${data.proofLink}
- Hours Logged: ${data.hoursLogged ?? 'not specified'}
- Similar submissions today by same user: ${data.existingCount ?? 0}

REJECT or FLAG if:
- Description is a product spec, documentation dump, or copy-paste
- Description contains only nouns/keywords with no action verbs
- No clear action was taken (built, fixed, implemented, designed, reviewed, etc.)
- No outcome or result is described
- Description is vague, generic, or could apply to anything
- Proof link does not match the contribution type
- Possible duplicate (similar submissions today > 2)

ACCEPT only if:
- A real task was performed
- There is a clear action (what was done)
- There is a context or outcome (why / what changed)
- The proof link is plausible for the contribution type

Respond ONLY with this JSON (no other text):
{
  "status": "VALID|NEEDS_REVIEW|FLAGGED",
  "score": 0.0-1.0,
  "isMeaningfulWork": true|false,
  "hasAction": true|false,
  "hasOutcome": true|false,
  "isCopyPaste": true|false,
  "relevanceScore": 0.0-1.0,
  "flags": ["flag1", "flag2"],
  "reasoning": "one sentence explaining the decision",
  "dimensions": {
    "intentConfidence": 0.0-1.0,
    "executionCredibility": 0.0-1.0,
    "vpQuality": 0.0-1.0,
    "trustScore": 0.0-1.0,
    "commitmentSignal": 0.0-1.0,
    "inferredCapitalSignal": 0.0-1.0
  }
}`;

  try {
    const raw = await callVeronica(prompt);
    const { result, semantic } = parseSubmissionResponse(raw);
    const aiDecision = resolveAiDecision(result.score, semantic);
    // No auto-approval — always needs review
    const logEvent =
      aiDecision === 'AUTO_BLOCK' ? (semantic.isCopyPaste ? 'veronica_rejected_gibberish' : 'veronica_auto_blocked') :
      'veronica_needs_review';

    logVeronicaDecision(logEvent, data.activityId, result.score, result.flags, semantic.reasoning);

    return { ...result, semantic, isFallback: false, aiDecision };
  } catch (err) {
    logger.warn('[Veronica] submission review failed, using rule-based fallback', { err });
    prisma.systemLog.create({
      data: {
        event: 'veronica_ai_failure',
        severity: 'WARNING',
        message: '[Veronica] Ollama unavailable for submission review — rule-based fallback used',
        metadata: JSON.stringify({ type: 'submission', contributionType: data.contributionType, activityId: data.activityId, error: String(err) }),
      },
    }).catch(() => {});
    const result = ruleBasedSubmissionCheck(data);
    const aiDecision = resolveAiDecision(result.score);
    logVeronicaDecision('veronica_fallback_used', data.activityId, result.score, result.flags, result.notes);
    return { ...result, flags: [...result.flags, 'ai_fallback'], isFallback: true, aiDecision };
  }
}

// ── Rule-Based Fallbacks ──────────────────────────────────────────────────────

// Action verbs that indicate real work was done
const ACTION_VERBS = [
  'built','fixed','implemented','designed','created','developed','wrote','updated',
  'refactored','deployed','tested','reviewed','resolved','added','removed','migrated',
  'optimized','debugged','integrated','configured','set up','shipped','released',
  'completed','finished','delivered','merged','closed','documented',
];

function hasActionVerb(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_VERBS.some(v => lower.includes(v));
}

function detectCopyPaste(text: string): boolean {
  const words = text.trim().split(/\s+/);
  // Check for repeated phrases (3+ word sequences appearing twice)
  for (let i = 0; i < words.length - 3; i++) {
    const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
    const rest = words.slice(i + 3).join(' ').toLowerCase();
    if (rest.includes(phrase)) return true;
  }
  // High noun density heuristic: very few verbs relative to length
  const verbCount = ACTION_VERBS.filter(v => text.toLowerCase().includes(v)).length;
  if (words.length > 20 && verbCount === 0) return true;
  return false;
}

function ruleBasedIntakeCheck(data: {
  name: string;
  email: string;
  roleType: string;
  description: string;
  proofLinks?: string;
}): VeronicaResult {
  const flags: string[] = [];
  // Start skeptical — default to 0.5 instead of 1.0
  let score = 0.5;

  const wordCount = data.description?.trim().split(/\s+/).length ?? 0;
  if (!data.description || wordCount < 10) { flags.push('description_too_short'); score -= 0.2; }
  if (!data.email?.includes('@')) { flags.push('invalid_email'); score -= 0.3; }
  if (!data.roleType) { flags.push('missing_role_type'); score -= 0.15; }
  if (!data.proofLinks && ['developer','engineer','designer'].some(r => data.roleType?.toLowerCase().includes(r))) {
    flags.push('missing_proof_for_technical_role'); score -= 0.15;
  }

  score = Math.max(0, Math.min(score, 0.65)); // Cap max at 0.65 so it's never VALID via fallback
  // Fallback NEVER returns VALID — best case is NEEDS_REVIEW
  const status = score >= 0.4 ? 'NEEDS_REVIEW' : 'FLAGGED';
  // Synthetic dimensions from rule analysis
  const veronicaDimensions: VeronicaDimensions = {
    intentConfidence: status === 'FLAGGED' ? 0.25 : 0.45,
    executionCredibility: data.proofLinks?.startsWith('http') ? 0.4 : 0.25,
    vpQuality: flags.includes('description_too_short') ? 0.2 : 0.4,
    trustScore: flags.includes('invalid_email') ? 0.2 : 0.5,
    commitmentSignal: 0.4,
    inferredCapitalSignal: 0.3,
  };
  return { status, score, flags, notes: flags.length ? `Issues: ${flags.join(', ')}` : 'Fallback check — no issues found but needs human review', veronicaDimensions };
}

function ruleBasedSubmissionCheck(data: {
  description: string;
  proofLink: string;
  hoursLogged?: number;
  existingCount?: number;
} | null | undefined): VeronicaResult {
  // Defensive guard: null/undefined data gets default fallback
  if (!data) {
    return { status: 'FLAGGED', score: 0.3, flags: ['invalid_input'], notes: 'Rule-based fallback — null or undefined input' };
  }
  const flags: string[] = [];
  // Start skeptical — default to 0.5 instead of 1.0
  let score = 0.5;
  const desc = data.description?.trim() ?? '';

  if (!data.proofLink || !data.proofLink.startsWith('http')) {
    flags.push('invalid_proof_link'); score -= 0.2;
  }
  if (desc.length < 20) {
    flags.push('description_too_short'); score -= 0.2;
  }
  if (desc.length >= 20 && !hasActionVerb(desc)) {
    flags.push('no_action_verb'); score -= 0.15;
  }
  if (desc.length >= 20 && detectCopyPaste(desc)) {
    flags.push('copy_paste_detected'); score -= 0.25;
  }
  if (data.hoursLogged !== undefined && (data.hoursLogged < 0.5 || data.hoursLogged > 12)) {
    flags.push('hours_out_of_range'); score -= 0.1;
  }
  if ((data.existingCount ?? 0) > 2) {
    flags.push('possible_duplicate'); score -= 0.1;
  }

  score = Math.max(0, Math.min(score, 0.65)); // Cap max at 0.65 — never VALID via fallback
  // Fallback NEVER returns VALID — best case is NEEDS_REVIEW
  const status = score >= 0.4 ? 'NEEDS_REVIEW' : 'FLAGGED';
  const notes = flags.length
    ? `Rule-based issues: ${flags.join(', ')}`
    : 'Fallback check — no issues found but needs human review';
  // Synthetic dimensions from rule analysis
  const veronicaDimensions: VeronicaDimensions = {
    intentConfidence: status === 'FLAGGED' ? 0.2 : 0.45,
    executionCredibility: data.proofLink?.startsWith('http') ? 0.4 : 0.25,
    vpQuality: flags.includes('description_too_short') || flags.includes('copy_paste_detected') ? 0.15 : 0.4,
    trustScore: flags.includes('copy_paste_detected') || flags.includes('no_action_verb') ? 0.2 : 0.5,
    commitmentSignal: 0.4,
    inferredCapitalSignal: 0.3,
  };
  return { status, score, flags, notes, veronicaDimensions };
}

// ── Exported rule-based check for backtest use ────────────────────────────────
export function ruleBasedSubmissionCheckExport(data: {
  description: string;
  proofLink: string;
  hoursLogged?: number;
  existingCount?: number;
}): VeronicaResult {
  return ruleBasedSubmissionCheck(data);
}
