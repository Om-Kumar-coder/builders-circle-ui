import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from './auth';

/**
 * Blocks API access until the user has completed onboarding.
 * Must be used AFTER authMiddleware.
 */
export const requireOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { onboardingCompleted: true },
    });

    if (!user?.onboardingCompleted) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'ONBOARDING_INCOMPLETE',
        message: 'You must complete onboarding before accessing this resource.',
      });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
