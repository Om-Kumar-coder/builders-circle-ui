import { useState, useCallback, useRef } from 'react';
import { isStepUpValid } from '@/lib/step-up';

interface StepUpState {
  visible: boolean;
  action: string;
  resolve: (() => void) | null;
  reject: (() => void) | null;
}

/**
 * Returns `ensureStepUp(actionLabel)` — call it before any sensitive admin action.
 * If a valid step-up token exists it resolves immediately.
 * Otherwise it shows the StepUpModal and resolves/rejects based on user input.
 *
 * Also returns `stepUpProps` to spread onto <StepUpModal />.
 */
export function useStepUp() {
  const [state, setState] = useState<StepUpState>({
    visible: false,
    action: '',
    resolve: null,
    reject: null,
  });

  const ensureStepUp = useCallback((action: string): Promise<void> => {
    if (isStepUpValid()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      setState({ visible: true, action, resolve, reject });
    });
  }, []);

  const handleSuccess = useCallback(() => {
    setState(s => { s.resolve?.(); return { visible: false, action: '', resolve: null, reject: null }; });
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => { s.reject?.(); return { visible: false, action: '', resolve: null, reject: null }; });
  }, []);

  return {
    ensureStepUp,
    stepUpProps: state.visible
      ? { action: state.action, onSuccess: handleSuccess, onCancel: handleCancel }
      : null,
  };
}
