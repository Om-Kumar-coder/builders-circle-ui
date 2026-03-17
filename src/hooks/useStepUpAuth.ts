import { useCallback } from 'react';
import { useStepUp } from './useStepUp';

/**
 * Convenience wrapper around useStepUp for admin actions.
 * Usage:
 *   const { requireStepUpAuth, stepUpProps } = useStepUpAuth();
 *   await requireStepUpAuth('change user role', async () => { ... });
 */
export function useStepUpAuth() {
  const { ensureStepUp, stepUpProps } = useStepUp();

  const requireStepUpAuth = useCallback(
    async <T>(actionLabel: string, fn: () => Promise<T> | T): Promise<T> => {
      await ensureStepUp(actionLabel);
      return fn();
    },
    [ensureStepUp]
  );

  return { requireStepUpAuth, stepUpProps };
}
