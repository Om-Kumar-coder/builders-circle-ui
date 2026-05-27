# Veronica Structured Score Dimensions — Design

## 1. Current State

Veronica (Phi-3 Mini via Ollama) produces a **single flat `score` (0–1)** stored as `GatekeeperReview.veronicaScore`. This score is consumed by the Application Scoring Engine as one of 6 sub-scores, weighted at 1.2×.

**Current output shape** (intake):

```ts
interface VeronicaResult {
  status: 'VALID' | 'NEEDS_REVIEW' | 'FLAGGED';
  score: number;        // single flat 0–1
  flags: string[];
  notes: string;
  semantic?: SemanticAnalysis;
  isFallback?: boolean;
  aiDecision?: 'AUTO_PASS' | 'FLAGGED' | 'AUTO_BLOCK';
}
```

**Current scoring engine consumption** (`scoreVeronicaExport`):

```ts
export function scoreVeronicaExport(veronicaScore: number | null | undefined): number {
  // Just clamp a flat number
  return Math.min(1, Math.max(0, veronicaScore ?? 0.5));
}
```

## 2. Problem

A flat `veronicaScore` squashes all nuance into a single number. The scoring engine's `veronica` dimension could be vastly more informative if it decomposed into sub-components that map to the other 5 scoring dimensions:

| Current dimension | What Veronica could contribute |
|---|---|
| `intent` (1.0×) | Confidence that the stated intent is genuine (vs. spam/research) |
| `capital` (0.5×) | Signals about financial capacity inferred from application quality |
| `execution` (2.0×) | Assessment of whether past work described is credible |
| `vp` (1.5×) | Quality & authenticity of the value proposition |
| `availability` (0.8×) | Commitment signals (tone, specificity of availability) |

## 3. Design: Structured Veronica Dimensions

### 3a. New Output Type

Instead of a single `score`, Veronica returns a **dimension map** alongside its overall score:

```ts
export interface VeronicaDimensionScores {
  /** Confidence the applicant is a real human with genuine intent (0–1) */
  intentConfidence: number;
  /** Credibility of execution claims / proof links (0–1) */
  executionCredibility: number;
  /** Quality and authenticity of value proposition (0–1) */
  vpQuality: number;
  /** Spam/fraud risk (0 = high risk, 1 = low risk) — inverted for intuitive scoring */
  trustScore: number;
  /** Commitment signal strength from availability & timeline detail (0–1) */
  commitmentSignal: number;
  /** Capital capacity signals inferred from language (0–1) — only used if capitalRange not provided */
  inferredCapitalSignal: number;
}

export interface VeronicaResult {
  status: 'VALID' | 'NEEDS_REVIEW' | 'FLAGGED';
  overallScore: number;       // still a single 0–1 for backward compat
  dimensions: VeronicaDimensionScores; // NEW
  flags: string[];
  notes: string;
  semantic?: SemanticAnalysis;       // submission only
  isFallback?: boolean;
  aiDecision?: 'AUTO_PASS' | 'FLAGGED' | 'AUTO_BLOCK';
}
```

### 3b. Prompt Changes

**Intake prompt** — Add dimension extraction instructions to the existing JSON output format:

```
Respond ONLY with this JSON (no other text):
{
  "status": "VALID|NEEDS_REVIEW|FLAGGED",
  "overallScore": 0.0-1.0,
  "dimensions": {
    "intentConfidence": 0.0-1.0,
    "executionCredibility": 0.0-1.0,
    "vpQuality": 0.0-1.0,
    "trustScore": 0.0-1.0,
    "commitmentSignal": 0.0-1.0,
    "inferredCapitalSignal": 0.0-1.0
  },
  "flags": ["flag1"],
  "notes": "brief reason for decision"
}

Scoring guidance for dimensions:
- intentConfidence: Is the applicant's stated reason genuine? Low if vague/generic.
- executionCredibility: Do proof links and outcomes suggest real past work?
- vpQuality: Is the value proposition specific, well-articulated, and realistic?
- trustScore: Low if spam signals (gibberish, copy-paste, keyword stuffing).
- commitmentSignal: High if availability is specific, timeline is realistic.
- inferredCapitalSignal: Low if no capital mentioned; high if language suggests access.
```

**Submission prompt** — Already has semantic analysis (`isMeaningfulWork`, `hasAction`, `hasOutcome`, `relevanceScore`, `reasoning`). Extend to include:

```
Respond ONLY with this JSON (no other text):
{
  "status": "VALID|NEEDS_REVIEW|FLAGGED",
  "overallScore": 0.0-1.0,
  "dimensions": {
    "intentConfidence": 0.0-1.0,
    "executionCredibility": 0.0-1.0,
    "vpQuality": 0.0-1.0,
    "trustScore": 0.0-1.0,
    "commitmentSignal": 0.0-1.0,
    "inferredCapitalSignal": 0.0-1.0
  },
  "isMeaningfulWork": true|false,
  "hasAction": true|false,
  "hasOutcome": true|false,
  "isCopyPaste": true|false,
  "relevanceScore": 0.0-1.0,
  "flags": ["flag1", "flag2"],
  "reasoning": "one sentence explaining the decision"
}
```

### 3c. New Score Integration Function

Replace `scoreVeronicaExport` with a function that maps dimensions to the scoring engine's 5 existing sub-scores:

```ts
export interface VeronicaScores {
  intent: number;
  capital: number;
  execution: number;
  vp: number;
  availability: number;
}

export function scoreVeronicaDimensions(
  dimensions: VeronicaDimensionScores | null | undefined,
  intake?: { intentType?: string; capitalRange?: string }
): VeronicaScores {
  if (!dimensions) {
    // Fallback to safe defaults
    return { intent: 0.5, capital: 0.5, execution: 0.5, vp: 0.5, availability: 0.5 };
  }

  return {
    // Blend Veronica's intent confidence with the rule-based score
    intent: dimensions.intentConfidence,
    // Use inferred capital signal unless the applicant provided explicit capital
    capital: (intake?.capitalRange && intake.capitalRange.trim() !== '')
      ? scoreCapitalExport(intake.capitalRange)  // prefer explicit
      : dimensions.inferredCapitalSignal,         // fallback to Veronica's inference
    execution: dimensions.executionCredibility,
    vp: dimensions.vpQuality,
    // Blend trust (anti-spam) with commitment
    availability: (dimensions.trustScore * 0.6 + dimensions.commitmentSignal * 0.4),
  };
}
```

### 3d. Backward Compatibility

The existing `veronicaScore` field on `GatekeeperReview` remains populated as `overallScore`. The dimension map is stored in a **new column** `veronicaDimensions` (JSON string). This allows old records to still work with the flat `scoreVeronicaExport` function, while new records enable the richer pipeline.

**Schema change** (Prisma):

```prisma
model GatekeeperReview {
  // ... existing fields remain unchanged ...
  veronicaScore      Float?    // 0.0–1.0 overall — kept for backward compat
  veronicaDimensions String?   // NEW: JSON string of VeronicaDimensionScores
  veronicaFlags      String?   // JSON array of flag strings
  veronicaNotes      String?   // Veronica's reasoning summary
}
```

**The scoring engine** conditionally uses the dimension-aware path:

```ts
// In applicationScoringService.ts:
const veronicaDims = review?.veronicaDimensions
  ? JSON.parse(review.veronicaDimensions) as VeronicaDimensionScores
  : null;

if (veronicaDims) {
  const vScores = scoreVeronicaDimensions(veronicaDims, intake);
  subScores.intent = (subScores.intent + vScores.intent) / 2;       // blend
  subScores.capital = vScores.capital;                                // replace if inferred
  subScores.execution = (subScores.execution + vScores.execution) / 2; // blend
  subScores.valueProposition = (subScores.valueProposition + vScores.vp) / 2; // blend
  subScores.availability = (subScores.availability + vScores.availability) / 2; // blend
  subScores.veronica = review.veronicaScore ?? 0.5;                   // keep for backward compat
} else {
  // Legacy path — use veronicaScore as flat input
  subScores.veronica = scoreVeronicaExport(review?.veronicaScore);
}
```

### 3e. Rule-Based Fallback for Dimensions

When Ollama is unavailable, the fallback (currently `ruleBasedIntakeCheck` / `ruleBasedSubmissionCheck`) should also produce synthetic dimensions:

```ts
function fallbackDimensions(data: { description?: string; proofLink?: string }): VeronicaDimensionScores {
  return {
    intentConfidence: 0.5,
    executionCredibility: data.proofLink?.startsWith('http') ? 0.5 : 0.3,
    vpQuality: 0.5,
    trustScore: detectCopyPaste(data.description ?? '') ? 0.2 : 0.5,
    commitmentSignal: 0.5,
    inferredCapitalSignal: 0.3,
  };
}
```

### 3f. Storage in ApplicationScore

The `ApplicationScore.subScores` JSON currently stores the 6 rule-based dimensions. After this change, it would store the **blended** dimensions that incorporate Veronica's structured output. The veronica-fields within `subScores` would expand to:

```json
{
  "intent": 0.75,
  "capital": 0.3,
  "execution": 0.6,
  "valueProposition": 0.7,
  "availability": 0.8,
  "veronica": 0.65,
  "veronicaDimensions": {
    "intentConfidence": 0.8,
    "executionCredibility": 0.6,
    "vpQuality": 0.75,
    "trustScore": 0.85,
    "commitmentSignal": 0.7,
    "inferredCapitalSignal": 0.3
  }
}
```

## 4. Migration Plan

### Phase 1 — Add storage (safe, no behavioral change)
1. Add `veronicaDimensions` column to `gatekeeper_reviews` (nullable `TEXT`)
2. Regenerate Prisma client
3. No code changes — old code path still runs

### Phase 2 — Update prompt + parser
1. Update the `reviewUserIntake` prompt to request dimension JSON
2. Update `parseIntakeResponse` / `parseSubmissionResponse` to extract dimensions
3. Store `veronicaDimensions` in the DB alongside existing `veronicaScore`
4. Keep `overallScore` populated for backward compat — both old and new records work

### Phase 3 — Wire into scoring engine
1. Create `scoreVeronicaDimensions()` function
2. Modify `scoreApplication()` to conditionally use dimensions when available
3. Add `scoreVeronicaDimensionsExport` for testability
4. Keep legacy `scoreVeronicaExport` for records without dimensions

### Phase 4 — Update dashboards
1. Surface `veronicaDimensions` in the admin scoring dashboard's radar chart
2. Add a "Veronica breakdown" tab showing the 6 AI-inferred scores compared to rule-based scores

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Phi-3 Mini can't produce reliable dimensions** | Dimension scores are noisy | Compare dimension scores against rule-based scores in test suite. If correlation < 0.5, add a smoothing layer. |
| **Larger prompt → slower inference** | Increased latency (current: 5–15s) | Keep dimension extraction as additive to existing prompt. If too slow, consider a parallel lightweight call just for dimensions. |
| **Parsing errors increase with larger JSON** | More fallback hits | Add lenient parsing that accepts partial dimension data (default missing dims to 0.5). |
| **Developers confused about which score to use** | Inconsistent interpretation | `overallScore` remains the canonical gatekeeper score. Dimensions are consumed only by the scoring engine — no new API surface changes for frontend. |
| **Old records lack dimensions** | Special case in scoring engine | Handled gracefully: `veronicaDimensions ? rich_path : flat_path`. |

## 6. Success Criteria

1. Application scoring engine produces measurably different (and more accurate) total scores when dimension data is present
2. `scoreUnscoredApplications()` on legacy records produces identical results to before (backward compat)
3. Admin dashboard can display per-dimension breakdown for new scans
4. Fallback path still produces valid (if diminished) dimension estimates
5. No regression in the 201 existing tests
