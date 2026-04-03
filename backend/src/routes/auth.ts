/* eslint-disable @typescript-eslint/no-unused-vars */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { EmailService } from '../services/emailService';
import { SecurityService } from '../services/securityService';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().optional(), // 6-digit code if 2FA enabled
});

const verifyEmailSchema = z.object({ token: z.string() });
const totpVerifySchema = z.object({ code: z.string().length(6) });

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function signJwt(userId: string, twoFactorVerified = false, role = 'contributor') {
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ userId, jti, twoFactorVerified, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES,
  } as jwt.SignOptions);
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production', // secure in production only
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches default JWT_EXPIRES)
  path: '/',
};

function setAuthCookie(res: import('express').Response, token: string) {
  res.cookie('auth_token', token, COOKIE_OPTS);
}

/** Revoke a single token by its jti. */
export async function revokeToken(jti: string, userId: string, expiresAt: Date) {
  await prisma.revokedToken.upsert({
    where: { jti },
    update: {},
    create: { jti, userId, expiresAt },
  });
}

/** Revoke ALL tokens for a user (force logout from all devices). */
export async function revokeAllUserTokens(userId: string) {
  // We can't enumerate issued JWTs, so we store a per-user revocation timestamp.
  // authMiddleware will reject any token issued before this time.
  await prisma.user.update({
    where: { id: userId },
    data: { tokenRevokedAt: new Date() },
  });
}

// ── Sign up ───────────────────────────────────────────────────────────────────
// Direct signup is disabled. New members must apply via /submit-to-triage
// and be approved by an admin before an account is created.

router.post('/signup', (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Direct signup is not available. Please apply at /submit-to-triage and wait for admin approval.',
  });
});

router.post('/signup-disabled-stub', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = makeToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerifyToken: verifyToken,
        emailVerifyExpiry: verifyExpiry,
        profile: { create: { role: 'contributor', status: 'active' } },
      },
      include: { profile: true },
    });

    // Send verification email (non-blocking)
    EmailService.sendVerificationEmail(email, name ?? null, verifyToken).catch(
      (err) => console.error('Failed to send verification email:', err)
    );

    const token = signJwt(user.id, false, user.profile?.role ?? 'contributor');
    setAuthCookie(res, token);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.profile?.role ?? 'contributor',
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, totpCode } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // ── Phase 4: post-credential checks ──────────────────────────────────────
    // Hard block: suspended / inactive accounts cannot log in at all
    const profileStatus = user.profile?.status ?? 'active';
    if (profileStatus === 'suspended' || profileStatus === 'inactive') {
      return res.status(403).json({ error: 'Account suspended. Please contact support.' });
    }
    // Soft flag: unverified email — allow login but signal frontend to redirect
    const emailNotVerified = !user.emailVerified;
    // ── End Phase 4 checks ────────────────────────────────────────────────────

    // 2FA check
    let twoFactorVerified = false;
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        // Signal to frontend that 2FA is required
        return res.status(200).json({ requires2FA: true });
      }
      const valid = speakeasy.totp.verify({ token: totpCode, secret: user.twoFactorSecret, encoding: 'base32' });
      if (!valid) {
        return res.status(400).json({ error: 'Invalid 2FA code' });
      }
      twoFactorVerified = true;
    }

    const token = signJwt(user.id, twoFactorVerified, user.profile?.role ?? 'contributor');
    setAuthCookie(res, token);

    // Fire security alert for new device/IP (non-blocking)
    SecurityService.handleLogin(user.id, user.email, user.name ?? null, {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.profile?.role ?? 'contributor',
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
      },
      ...(emailNotVerified ? { emailNotVerified: true } : {}),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Verify email ──────────────────────────────────────────────────────────────

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    // If the user has no password set (triage-approved), keep the token alive
    // so the /set-password endpoint can use it. Clear it only for normal users.
    const needsPassword = !user.password || user.password === '';

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        // Keep token alive for triage users who still need to set a password
        ...(needsPassword ? {} : {
          emailVerifyToken: null,
          emailVerifyExpiry: null,
        }),
      },
    });

    res.json({ success: true, message: 'Email verified successfully', needsPassword });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Resend verification email ─────────────────────────────────────────────────

// Authenticated resend (from settings)
router.post('/resend-verification', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email already verified' });

    const verifyToken = makeToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyToken, emailVerifyExpiry: verifyExpiry },
    });

    await EmailService.sendVerificationEmail(user.email, user.name, verifyToken);

    res.json({ success: true, message: 'Verification email sent' });
  } catch {
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Unauthenticated resend (from verify-email page, by email address)
router.post('/resend-verification-by-email', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to avoid email enumeration
    if (!user || user.emailVerified) {
      return res.json({ success: true, message: 'If that email exists, a verification link has been sent' });
    }

    const verifyToken = makeToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyToken, emailVerifyExpiry: verifyExpiry },
    });

    await EmailService.sendVerificationEmail(user.email, user.name, verifyToken);

    res.json({ success: true, message: 'If that email exists, a verification link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// ── 2FA: generate setup (QR code) ─────────────────────────────────────────────

router.post('/2fa/setup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.twoFactorEnabled) return res.status(400).json({ error: '2FA already enabled' });

    const secret = speakeasy.generateSecret({ name: `Builders Circle (${user.email})` });
    const otpauth = secret.otpauth_url!;
    const qrCode = await QRCode.toDataURL(otpauth);

    // Store secret temporarily (not enabled yet until verified)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    res.json({ secret: secret.base32, qrCode });
  } catch {
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// ── 2FA: confirm and enable ───────────────────────────────────────────────────

router.post('/2fa/enable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = totpVerifySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Run /2fa/setup first' });
    }

    const valid = speakeasy.totp.verify({ token: code, secret: user.twoFactorSecret, encoding: 'base32' });
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    SecurityService.handle2FAChanged(user.id, user.email, user.name ?? null, true, {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ success: true, message: '2FA enabled' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// ── 2FA: disable ─────────────────────────────────────────────────────────────

router.post('/2fa/disable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = totpVerifySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    const valid = speakeasy.totp.verify({ token: code, secret: user.twoFactorSecret, encoding: 'base32' });
    if (!valid) return res.status(400).json({ error: 'Invalid code' });

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    SecurityService.handle2FAChanged(user.id, user.email, user.name ?? null, false, {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ success: true, message: '2FA disabled' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ── Get current user ──────────────────────────────────────────────────────────

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        profile: { select: { role: true, status: true, bio: true, avatar: true } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.profile?.role ?? 'contributor',
      status: user.profile?.status ?? 'active',
      bio: user.profile?.bio,
      avatar: user.profile?.avatar,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorVerified: req.user!.twoFactorVerified,
      onboardingStep: user.onboardingStep ?? 0,
      onboardingCompleted: user.onboardingCompleted ?? false,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Change password ───────────────────────────────────────────────────────────

router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, tokenRevokedAt: now },
    });

    // Invalidate all activity sessions (force re-login on other devices)
    await prisma.userActivitySession.updateMany({
      where: { userId: user.id, sessionEnd: null },
      data: { sessionEnd: now },
    });

    // Security notification + email
    SecurityService.handlePasswordChanged(user.id, user.email, user.name ?? null, {
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ── Verify password (re-auth) ─────────────────────────────────────────────────

router.post('/verify-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Incorrect password' });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') ||
      (req.cookies?.auth_token as string | undefined);

    if (token) {
      try {
        const decoded = jwt.decode(token) as { userId: string; jti?: string; exp?: number } | null;
        if (decoded?.jti) {
          const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 86400000);
          await revokeToken(decoded.jti, decoded.userId, expiresAt);
        }
      } catch {
        // best-effort
      }
    }

    // Clear the HttpOnly cookie
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── Step-up authentication ────────────────────────────────────────────────────

const STEP_UP_TTL_MS = 15 * 60 * 1000; // 15 minutes

function signStepUpToken(userId: string): string {
  const payload = `${userId}:${Date.now() + STEP_UP_TTL_MS}`;
  const sig = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyStepUpToken(token: string, userId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastColon = decoded.lastIndexOf(':');
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);

    const expected = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(payload)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return false;
    }

    const [tokenUserId, expiryStr] = payload.split(':');
    if (tokenUserId !== userId) return false;
    if (Date.now() > Number(expiryStr)) return false;

    return true;
  } catch {
    return false;
  }
}

// POST /auth/step-up — verify password and issue a short-lived step-up token
router.post('/step-up', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const token = signStepUpToken(user.id);
    res.json({ token });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Forgot password ───────────────────────────────────────────────────────────

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = makeToken();
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: hashedToken, passwordResetExpiry: expiry },
      });

      EmailService.sendPasswordResetEmail(email, user.name ?? null, resetToken).catch(
        (err) => console.error('Failed to send password reset email:', err)
      );
    }

    res.json({ success: true, message: 'If that email exists, a password reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reset password ────────────────────────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(req.body);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiry: null,
        // Invalidate all existing sessions
        tokenRevokedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});



// ── Set password (triage-approved users with empty password) ─────────────────

router.post('/set-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    }).parse(req.body);

    // Reuse the emailVerifyToken — same token that was sent in the approval email
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired link. Please request a new verification email.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    res.json({ success: true, message: 'Password set successfully. You can now complete onboarding.' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/relogin', async (req: Request, res: Response) => {
  try {
    const { password, email } = z.object({
      password: z.string(),
      email: z.string().email().optional(),
    }).parse(req.body);

    // Identify the user from the (possibly expired) cookie token first,
    // then fall back to the email field in the body.
    let userId: string | null = null;
    const cookieToken: string | undefined = req.cookies?.auth_token;
    if (cookieToken) {
      try {
        const decoded = jwt.decode(cookieToken) as { userId?: string } | null;
        if (decoded?.userId) userId = decoded.userId;
      } catch { /* ignore */ }
    }

    let user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
      : null;

    // Fallback: look up by email if cookie decode failed
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = signJwt(user.id, user.twoFactorEnabled, user.profile?.role ?? 'contributor');
    setAuthCookie(res, token);
    res.json({ token });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
