/**
 * Veronica — AI Gatekeeper Service
 * Uses Phi-3 Mini (3.8B) via Ollama for lightweight, fast validation.
 * Ollama endpoint: http://localhost:11434
 */

import logger from '../utils/logger';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = 'phi3:mini';

export interface VeronicaResult {
  status: 'VALID' | 'NEEDS_REVIEW' | 'FLAGGED';
  score: number; // 0.0–1.0
  flags: string[];
  notes: string;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

async function callVeronica(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 300 },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = (await res.json()) as OllamaResponse;
  return data.response;
}

function parseVeronicaResponse(raw: string): VeronicaResult {
  try {
    // Extract JSON block from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        status: parsed.status || 'NEEDS_REVIEW',
        score: Math.min(1, Math.max(0, parseFloat(parsed.score) || 0.5)),
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        notes: parsed.notes || '',
      };
    }
  } catch {
    // fallback below
  }
  return { status: 'NEEDS_REVIEW', score: 0.5, flags: ['parse_error'], notes: raw.slice(0, 200) };
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

Evaluate this application and respond ONLY with a JSON object.

Application:
- Name: ${data.name}
- Email: ${data.email}
- Role Type: ${data.roleType}
- Description: ${data.description}
- Proof Links: ${data.proofLinks || 'none'}
- Availability: ${data.availability || 'not specified'}

Rules to check:
1. Description must be meaningful (not empty or gibberish)
2. Email must look valid
3. Role type must be specified
4. Proof links should be present for technical roles
5. Flag if description is too short (under 20 words)
6. Flag if proof links are missing for developer/engineer roles

Respond ONLY with this JSON (no other text):
{"status":"VALID|NEEDS_REVIEW|FLAGGED","score":0.0-1.0,"flags":["flag1","flag2"],"notes":"brief reason"}`;

  try {
    const raw = await callVeronica(prompt);
    return parseVeronicaResponse(raw);
  } catch (err) {
    logger.warn('[Veronica] intake review failed, using rule-based fallback', { err });
    return ruleBasedIntakeCheck(data);
  }
}

// ── Submission Pre-Check ──────────────────────────────────────────────────────

export async function reviewSubmission(data: {
  description: string;
  proofLink: string;
  hoursLogged?: number;
  contributionType: string;
  existingCount?: number; // duplicate check
}): Promise<VeronicaResult> {
  const prompt = `You are Veronica, an AI gatekeeper reviewing an activity submission before admin verification.

Evaluate this submission and respond ONLY with a JSON object.

Submission:
- Description: ${data.description}
- Proof Link: ${data.proofLink}
- Hours Logged: ${data.hoursLogged ?? 'not specified'}
- Contribution Type: ${data.contributionType}
- Similar submissions today: ${data.existingCount ?? 0}

Rules to check:
1. Proof link must be a valid URL
2. Description must be meaningful (not empty or too short)
3. Hours must be between 0.5 and 12 if provided
4. Flag if similar submissions exist today (possible duplicate)
5. Flag if description is vague or generic

Respond ONLY with this JSON (no other text):
{"status":"VALID|NEEDS_REVIEW|FLAGGED","score":0.0-1.0,"flags":["flag1","flag2"],"notes":"brief reason"}`;

  try {
    const raw = await callVeronica(prompt);
    return parseVeronicaResponse(raw);
  } catch (err) {
    logger.warn('[Veronica] submission review failed, using rule-based fallback', { err });
    return ruleBasedSubmissionCheck(data);
  }
}

// ── Rule-Based Fallbacks (when Ollama is unavailable) ────────────────────────

function ruleBasedIntakeCheck(data: {
  name: string;
  email: string;
  roleType: string;
  description: string;
  proofLinks?: string;
}): VeronicaResult {
  const flags: string[] = [];
  let score = 1.0;

  if (!data.description || data.description.trim().split(/\s+/).length < 10) {
    flags.push('description_too_short');
    score -= 0.3;
  }
  if (!data.email?.includes('@')) {
    flags.push('invalid_email');
    score -= 0.4;
  }
  if (!data.roleType) {
    flags.push('missing_role_type');
    score -= 0.2;
  }
  if (!data.proofLinks && ['developer', 'engineer', 'designer'].some(r => data.roleType?.toLowerCase().includes(r))) {
    flags.push('missing_proof_for_technical_role');
    score -= 0.2;
  }

  score = Math.max(0, score);
  const status = score >= 0.7 ? 'VALID' : score >= 0.4 ? 'NEEDS_REVIEW' : 'FLAGGED';
  return { status, score, flags, notes: flags.length ? `Issues: ${flags.join(', ')}` : 'Passed rule checks' };
}

function ruleBasedSubmissionCheck(data: {
  description: string;
  proofLink: string;
  hoursLogged?: number;
  existingCount?: number;
}): VeronicaResult {
  const flags: string[] = [];
  let score = 1.0;

  if (!data.proofLink || !data.proofLink.startsWith('http')) {
    flags.push('invalid_proof_link');
    score -= 0.4;
  }
  if (!data.description || data.description.trim().length < 20) {
    flags.push('description_too_short');
    score -= 0.3;
  }
  if (data.hoursLogged !== undefined && (data.hoursLogged < 0.5 || data.hoursLogged > 12)) {
    flags.push('hours_out_of_range');
    score -= 0.2;
  }
  if ((data.existingCount ?? 0) > 2) {
    flags.push('possible_duplicate');
    score -= 0.2;
  }

  score = Math.max(0, score);
  const status = score >= 0.7 ? 'VALID' : score >= 0.4 ? 'NEEDS_REVIEW' : 'FLAGGED';
  return { status, score, flags, notes: flags.length ? `Issues: ${flags.join(', ')}` : 'Passed rule checks' };
}
