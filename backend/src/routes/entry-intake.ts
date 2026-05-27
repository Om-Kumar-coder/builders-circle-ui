/**
 * Entry Control Layer — Intake & Event Logging Routes
 *
 * Phase 1: Entry Control Layer
 * Public endpoints for prefilter + intake form submission.
 * No scoring, no routing, no AI decisions.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database';
import { env } from '../config/env';
import logger from '../utils/logger';
import { reviewUserIntake } from '../services/veronicaService';
import { scoreApplicationFireAndForget } from '../services/scoring/applicationScoringService';
import { executeRouting } from '../services/scoring/routingService';

const router = Router();

// ── Rate limiting ─────────────────────────────────────────────────────────────
// 5 submissions per IP per hour
const intakeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () => env.NODE_ENV === 'test',
  message: { success: false, data: null, error: 'Too many submissions. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit for event logging (100 events per IP per hour)
const eventLogLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  skip: () => env.NODE_ENV === 'test',
  message: { success: false, data: null, error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Validation schemas ────────────────────────────────────────────────────────

const intakeSchema = z.object({
  fullName: z.string().min(2, 'Full name is required (min 2 characters)').max(200),
  email: z.string().email('Valid email is required'),
  phoneOrWhatsapp: z.string().max(50).optional().nullable(),
  countryTimezone: z.string().max(100).optional().nullable(),
  intentType: z.enum(['join', 'collaborate', 'invest', 'propose', 'other'], {
    errorMap: () => ({ message: 'Intent type is required' }),
  }),
  capitalRange: z.string().max(100).optional().nullable(),
  executionProofUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional().nullable(),
  executionOutcome: z.string().max(2000).optional().nullable(),
  executionRecency: z.string().max(100).optional().nullable(),
  valueProposition: z.string().min(20, 'Value proposition must be at least 20 characters').max(3000),
  availability: z.string().max(200).optional().nullable(),
  timeline: z.string().max(200).optional().nullable(),
  intentOutcome30_60: z.string().max(2000).optional().nullable(),
  prefilterAck: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the prefilter agreement' }),
  }),
  prefilterToken: z.string().optional().nullable(),
  prefilterSessionId: z.string().optional().nullable(),
  captchaToken: z.string().optional().nullable(),
});

const eventLogSchema = z.object({
  event: z.enum([
    'prefilter_page_view',
    'prefilter_scrolled_50',
    'prefilter_checkbox_checked',
    'prefilter_cta_click',
    'prefilter_exit_no_click',
    'intake_submitted',
  ]),
  sessionId: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

// ── Akismet spam check ────────────────────────────────────────────────────────

const AKISMET_API_KEY = process.env.AKISMET_API_KEY || '';
const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:3000';

async function checkAkismetSpam(params: {
  userIp: string;
  userAgent: string;
  commentAuthor: string;
  commentAuthorEmail: string;
  commentContent: string;
}): Promise<{ isSpam: boolean; reason?: string }> {
  if (!AKISMET_API_KEY) {
    // No API key configured — skip check
    return { isSpam: false };
  }

  try {
    const response = await fetch(`https://${AKISMET_API_KEY}.rest.akismet.com/1.1/comment-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        blog: FRONTEND_URL,
        user_ip: params.userIp,
        user_agent: params.userAgent,
        comment_author: params.commentAuthor,
        comment_author_email: params.commentAuthorEmail,
        comment_content: params.commentContent,
        comment_type: 'contact-form',
        blog_lang: 'en',
      }),
    });

    const body = await response.text();
    if (body.trim() === 'true') {
      return { isSpam: true, reason: 'Flagged as spam by Akismet' };
    }

    // Check the debug help info if available
    const debugHelp = response.headers.get('X-akismet-debug-help');
    return { isSpam: false };
  } catch {
    // Akismet failure should not block submissions — log and continue
    console.warn('[Akismet] Check failed, allowing submission');
    return { isSpam: false };
  }
}

// ── JWT token helpers ─────────────────────────────────────────────────────────

const JWT_SECRET = env.JWT_SECRET || 'fallback-dev-secret-min-32-chars-long!!';

/** Sign a prefilter acknowledgment JWT */
function signPrefilterToken(sessionId: string): string {
  return jwt.sign(
    { sessionId, type: 'prefilter_ack', jti: `pref_${Date.now()}_${Math.random().toString(36).substring(2, 10)}` },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

/** Verify and decode a prefilter JWT. Returns null on any failure. */
function verifyPrefilterToken(token: string): { sessionId: string; type: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sessionId: string; type: string };
    if (decoded.type !== 'prefilter_ack') return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── CAPTCHA validation ────────────────────────────────────────────────────────

async function validateCaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.CAPTCHA_SECRET_KEY;
  if (!secretKey) {
    // No CAPTCHA configured — skip validation
    return true;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json() as { success: boolean; score?: number };
    // reCAPTCHA v3 returns a score; v2 returns success boolean
    if (data.score !== undefined) {
      return data.success && data.score >= 0.5;
    }
    return data.success === true;
  } catch {
    return false;
  }
}

// ── POST /api/triage/intake — Submit entry intake form ────────────────────────

router.post('/intake', intakeLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const data = intakeSchema.parse(req.body);

    // 1. CAPTCHA validation — fail-closed when keys are configured
    // If no CAPTCHA_SECRET_KEY is set, the form works without CAPTCHA
    const captchaSecretKey = process.env.CAPTCHA_SECRET_KEY;
    if (captchaSecretKey) {
      if (env.NODE_ENV === 'production') {
        if (!data.captchaToken) {
          return res.status(400).json({
            success: false,
            data: null,
            error: 'CAPTCHA is required',
          });
        }
        const captchaValid = await validateCaptcha(data.captchaToken);
        if (!captchaValid) {
          return res.status(400).json({
            success: false,
            data: null,
            error: 'CAPTCHA validation failed. Please try again.',
          });
        }
      } else if (data.captchaToken) {
        // In non-production, validate CAPTCHA if provided
        const captchaValid = await validateCaptcha(data.captchaToken);
        if (!captchaValid) {
          return res.status(400).json({
            success: false,
            data: null,
            error: 'CAPTCHA validation failed. Please try again.',
          });
        }
      }
    }

    // 2. Akismet spam check
    const akismetResult = await checkAkismetSpam({
      userIp: req.ip || req.socket.remoteAddress || '0.0.0.0',
      userAgent: req.get('User-Agent') || '',
      commentAuthor: data.fullName,
      commentAuthorEmail: data.email,
      commentContent: `${data.valueProposition} ${data.executionOutcome || ''}`,
    });

    if (akismetResult.isSpam) {
      // Log the spam attempt but still reject silently (don't reveal it's spam)
      await prisma.eventLog.create({
        data: {
          event: 'intake_spam_blocked',
          sessionId: data.prefilterSessionId || null,
          metadata: JSON.stringify({ email: data.email, reason: akismetResult.reason }),
          ipAddress: req.ip || null,
        },
      }).catch(() => {});

      return res.status(400).json({
        success: false,
        data: null,
        error: 'Your submission could not be processed. Please try again later.',
      });
    }

    // 3. Validate prefilter token
    if (data.prefilterToken) {
      const decoded = verifyPrefilterToken(data.prefilterToken);
      if (!decoded) {
        return res.status(403).json({
          success: false,
          data: null,
          error: 'Invalid or expired prefilter session. Please go back and acknowledge the entry requirements again.',
        });
      }
      // Session ID mismatch check
      if (data.prefilterSessionId && decoded.sessionId !== data.prefilterSessionId) {
        return res.status(403).json({
          success: false,
          data: null,
          error: 'Prefilter session mismatch. Please restart the process.',
        });
      }
    } else if (captchaSecretKey && env.NODE_ENV === 'production' && !data.captchaToken) {
      // In production with CAPTCHA configured, require either a prefilter token or CAPTCHA
      return res.status(400).json({
        success: false,
        data: null,
        error: 'CAPTCHA is required',
      });
    }

    // 4. Check for duplicate email (existing intake with PENDING status)
    const existingPending = await prisma.entryIntake.findFirst({
      where: { email: data.email, status: 'PENDING' },
    });
    if (existingPending) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'A pending application for this email already exists. Please wait for review.',
      });
    }

    // 5. Store submission
    const intake = await prisma.entryIntake.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneOrWhatsapp: data.phoneOrWhatsapp || null,
        countryTimezone: data.countryTimezone || null,
        intentType: data.intentType,
        capitalRange: data.capitalRange || null,
        executionProofUrl: data.executionProofUrl || null,
        executionOutcome: data.executionOutcome || null,
        executionRecency: data.executionRecency || null,
        valueProposition: data.valueProposition,
        availability: data.availability || null,
        timeline: data.timeline || null,
        intentOutcome30_60: data.intentOutcome30_60 || null,
        prefilterAck: true,
        prefilterSessionId: data.prefilterSessionId || null,
        status: 'PENDING',
      },
    });

    // 6. Log event: intake_submitted
    await prisma.eventLog.create({
      data: {
        event: 'intake_submitted',
        sessionId: data.prefilterSessionId || null,
        metadata: JSON.stringify({
          intakeId: intake.id,
          intentType: data.intentType,
          email: data.email,
        }),
        ipAddress: req.ip || null,
      },
    }).catch(() => {});

    // 7. Log to system_logs for audit trail
    await prisma.systemLog.create({
      data: {
        event: 'entry_intake_submitted',
        severity: 'INFO',
        message: `[Entry] Intake submitted — ${data.fullName} (${data.email}) — intent: ${data.intentType}`,
        metadata: JSON.stringify({ intakeId: intake.id, intentType: data.intentType }),
      },
    }).catch(() => {});

    // 8. Create GatekeeperReview so intake shows up in the gatekeeper queue
    const reviewId = `entry-${intake.id}`;
    await prisma.gatekeeperReview.create({
      data: {
        id: reviewId,
        entityType: 'user_intake',
        entityId: intake.id,
        queue: 'new_users',
        status: 'PENDING',
      },
    }).catch((err) => {
      logger.warn('[Entry] Failed to create GatekeeperReview', { err });
    });

    // 9. Fire-and-forget Veronica scan (non-blocking)
    reviewUserIntake({
      name: data.fullName,
      email: data.email,
      roleType: data.intentType,
      description: `${data.valueProposition}${data.executionOutcome ? ' — ' + data.executionOutcome : ''}`,
      proofLinks: data.executionProofUrl || undefined,
      availability: data.availability || undefined,
    }).then(result =>
      prisma.gatekeeperReview.update({
        where: { id: reviewId },
        data: {
          status: result.status,
          veronicaScore: result.score,
          veronicaFlags: JSON.stringify(result.flags),
          veronicaNotes: result.notes,
          veronicaDimensions: result.veronicaDimensions ? JSON.stringify(result.veronicaDimensions) : null,
          updatedAt: new Date(),
        },
      })
    ).catch((err) => {
      logger.warn('[Entry] Veronica scan failed for ' + data.email, { err });
    });

    // 10. Fire-and-forget scoring + routing (Phase 2) — runs asynchronously
    scoreApplicationFireAndForget(intake.id).then((_result) => {
      // After scoring completes, execute routing
      // We re-fetch the score to pass the full ScoringResult to the routing service
      prisma.applicationScore.findUnique({
        where: { entryIntakeId: intake.id },
      }).then((score) => {
        if (!score) return;
        const subScores = score.subScores ? JSON.parse(score.subScores) : {};
        executeRouting(
          intake.id,
          data.fullName,
          data.email,
          data.intentType,
          data.capitalRange,
          {
            entryIntakeId: intake.id,
            totalScore: score.totalScore,
            routeTag: score.routeTag as 'fast_track' | 'standard' | 'hold',
            subScores,
            scoredAt: score.scoredAt,
          },
        ).catch((err) => {
          logger.warn('[Entry] Routing failed for ' + data.email, { err });
        });
      });
    });

    res.status(201).json({
      success: true,
      data: {
        id: intake.id,
        status: intake.status,
        message: 'Your application has been received. We will review it and get back to you.',
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: err.errors[0]?.message || 'Validation failed',
      });
    }
    console.error('[Entry] Intake error:', err);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to process submission. Please try again later.',
    });
  }
});

// ── POST /api/triage/event — Log prefilter events ────────────────────────────

router.post('/event', eventLogLimiter, async (req: Request, res: Response) => {
  try {
    const data = eventLogSchema.parse(req.body);

    await prisma.eventLog.create({
      data: {
        event: data.event,
        sessionId: data.sessionId || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        ipAddress: req.ip || null,
      },
    });

    res.status(201).json({ success: true, data: null, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0]?.message || 'Validation failed' });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to log event' });
  }
});

// ── POST /api/triage/intake/check-email — Check if email already submitted ───

router.post('/intake/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const existing = await prisma.entryIntake.findFirst({
      where: { email, status: 'PENDING' },
      select: { id: true },
    });

    res.json({
      success: true,
      data: { exists: !!existing },
      error: null,
    });
  } catch {
    res.status(400).json({ success: false, data: null, error: 'Invalid email' });
  }
});

// ── POST /api/triage/prefilter/ack — Issue signed JWT for an acknowledged session ────

router.post('/prefilter/ack', async (req: Request, res: Response) => {
  try {
    const { sessionId } = z.object({
      sessionId: z.string({ required_error: 'Session ID is required' }).min(1, 'Session ID is required'),
    }).parse(req.body);

    const token = signPrefilterToken(sessionId);

    res.json({
      success: true,
      data: { token, expiresIn: '2h' },
      error: null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: err.errors[0]?.message || 'Session ID is required',
      });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to issue acknowledgment token' });
  }
});

// ── POST /api/triage/prefilter/verify — Verify a prefilter JWT ─────────────────

router.post('/prefilter/verify', async (req: Request, res: Response) => {
  try {
    const { token } = z.object({
      token: z.string().min(1, 'Token is required'),
    }).parse(req.body);

    const decoded = verifyPrefilterToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid or expired prefilter token. Please go back and acknowledge the entry requirements again.',
      });
    }

    res.json({
      success: true,
      data: { valid: true, sessionId: decoded.sessionId, type: decoded.type },
      error: null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: err.errors[0]?.message || 'Token is required',
      });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to verify token' });
  }
});

// ── GET /api/triage/funnel — Funnel analytics query ────────────────────────────

router.get('/funnel', async (req: Request, res: Response) => {
  try {
    const events = [
      'prefilter_page_view',
      'prefilter_scrolled_50',
      'prefilter_checkbox_checked',
      'prefilter_cta_click',
      'intake_submitted',
    ];

    const counts = await Promise.all(
      events.map(event =>
        prisma.eventLog.count({
          where: { event },
        })
      ),
    );

    const funnel: Record<string, number> = {};
    events.forEach((event, i) => {
      funnel[event] = counts[i];
    });

    const views = counts[0];
    const scrolled = counts[1];
    const checked = counts[2];
    const cta = counts[3];
    const submitted = counts[4];

    const conversionRates = {
      viewToScroll: views > 0 ? `${((scrolled / views) * 100).toFixed(1)}%` : '0%',
      viewToCheck: views > 0 ? `${((checked / views) * 100).toFixed(1)}%` : '0%',
      checkToCta: checked > 0 ? `${((cta / checked) * 100).toFixed(1)}%` : '0%',
      ctaToSubmit: cta > 0 ? `${((submitted / cta) * 100).toFixed(1)}%` : '0%',
      viewToSubmit: views > 0 ? `${((submitted / views) * 100).toFixed(1)}%` : '0%',
      checkToSubmit: checked > 0 ? `${((submitted / checked) * 100).toFixed(1)}%` : '0%',
    };

    res.json({
      success: true,
      data: { funnel, conversionRates },
      error: null,
    });
  } catch (err) {
    logger.error('[Funnel] Failed to fetch analytics', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch funnel analytics' });
  }
});

export default router;
