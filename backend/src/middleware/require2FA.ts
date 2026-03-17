import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from './auth';

/**
 * Blocks API access if the user has 2FA enabled but the current JWT was not
 * issued after a successful 2FA verification.
 * Users without 2FA enabled are allowed through.
 * Must be used AFTER authMiddleware.
 */
export const require2FA = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { twoFactorEnabled: true },
    });

    // If 2FA is not set up, no verification needed
    if (!user?.twoFactorEnabled) return next();

    // 2FA is enabled — JWT must have been issued after successful TOTP verification
    if (!req.user?.twoFactorVerified) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'TWO_FACTOR_REQUIRED',
        message: 'Two-factor authentication is required. Please log in again with your 2FA code.',
      });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
