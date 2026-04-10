/**
 * Step-up token utilities — extracted here to break the circular dependency:
 *   routes/auth.ts ↔ middleware/auth.ts
 */
import crypto from 'crypto';
import { env } from '../config/env';

const STEP_UP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function signStepUpToken(userId: string): string {
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
