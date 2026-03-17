import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from './auth';

/**
 * Blocks the request if the authenticated user has not accepted
 * the currently active agreement. Must be used AFTER authMiddleware.
 * Admins and founders are exempt so they can manage agreements without lockout.
 */
export const requireAgreement = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Admins/founders are exempt
    if (req.user?.role === 'admin' || req.user?.role === 'founder') return next();

    const active = await prisma.agreement.findFirst({ where: { isActive: true } });

    // No active agreement configured — allow through
    if (!active) return next();

    const record = await prisma.userAgreement.findUnique({
      where: {
        userId_agreementId: { userId: req.user!.id, agreementId: active.id },
      },
    });

    if (!record) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'AGREEMENT_NOT_ACCEPTED',
        message: 'You must accept the latest agreement before performing this action.',
        agreementId: active.id,
        agreementVersion: active.version,
      });
    }

    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
