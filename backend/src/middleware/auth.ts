import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { verifyStepUpToken } from '../routes/auth';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    twoFactorVerified: boolean;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Accept token from Authorization header or HttpOnly cookie only.
    // Query param token is NOT accepted (prevents token leakage in logs/referrers).
    const token =
      req.header('Authorization')?.replace('Bearer ', '') ||
      (req.cookies?.auth_token as string | undefined);

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; jti?: string; iat?: number; twoFactorVerified?: boolean };

    // Check per-token revocation (logout)
    if (decoded.jti) {
      const revoked = await prisma.revokedToken.findUnique({ where: { jti: decoded.jti } });
      if (revoked) {
        return res.status(401).json({ success: false, data: null, error: 'Token has been revoked.' });
      }
    }

    // Get user with profile to include role
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid token.'
      });
    }

    // Check per-user revocation (force logout all devices)
    if (user.tokenRevokedAt && decoded.iat && decoded.iat * 1000 < user.tokenRevokedAt.getTime()) {
      return res.status(401).json({ success: false, data: null, error: 'Session invalidated. Please log in again.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.profile?.role || 'contributor',
      twoFactorVerified: decoded.twoFactorVerified ?? false,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid token.'
    });
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Blocks users who hold an active view_only AccessGrant from performing
 * any mutating (write) operation. Must be used AFTER authMiddleware.
 *
 * Admins and founders are exempt — their role already supersedes any grant.
 */
export const requireFullAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ success: false, data: null, error: 'Authentication required.' });
  }

  // Admins/founders are never restricted by view_only grants
  if (['admin', 'founder'].includes(req.user.role)) {
    return next();
  }

  const grant = await prisma.accessGrant.findFirst({
    where: { userId: req.user.id, type: 'view_only', revokedAt: null },
  });

  if (grant) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'View-only access: this action is not permitted.',
    });
  }

  next();
};

/**
 * Requires a valid step-up token in the X-Step-Up-Token header.
 * Must be used AFTER authMiddleware so req.user is populated.
 */
export const stepUpMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.header('X-Step-Up-Token');
  if (!token || !req.user) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Step-up authentication required. Please re-verify your identity.',
      requiresStepUp: true,
    });
  }
  if (!verifyStepUpToken(token, req.user.id)) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'Step-up token is invalid or expired. Please re-verify your identity.',
      requiresStepUp: true,
    });
  }
  next();
};