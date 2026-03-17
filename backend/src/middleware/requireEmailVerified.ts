import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from './auth';

/**
 * Blocks API access if the user has not verified their email address.
 * Must be used AFTER authMiddleware.
 */
export const requireEmailVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'EMAIL_NOT_VERIFIED',
        message: 'You must verify your email address before accessing this resource.',
      });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
