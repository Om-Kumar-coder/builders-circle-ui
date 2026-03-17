'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import AgreementModal from './AgreementModal';

interface Agreement {
  id: string;
  version: string;
  title: string;
  content: string;
}

// Poll interval: 5 minutes — catches version upgrades for long-running sessions
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export default function AgreementGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkAgreement = useCallback(async () => {
    try {
      const [status, current] = await Promise.all([
        apiClient.getAgreementUserStatus(),
        apiClient.getCurrentAgreement().catch(() => null),
      ]);

      if (!current) {
        setChecked(true);
        setNeedsAcceptance(false);
        return;
      }

      setAgreement(current);

      if (!status.hasAccepted) {
        setNeedsAcceptance(true);
      } else {
        setChecked(true);
        setNeedsAcceptance(false);
      }
    } catch {
      // Don't block the user if the check fails
      setChecked(true);
    }
  }, []);

  // Initial check on mount / user change
  useEffect(() => {
    if (authLoading || !user) return;
    checkAgreement();
  }, [user, authLoading, checkAgreement]);

  // Periodic poll to catch version upgrades mid-session
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkAgreement, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, checkAgreement]);

  // Intercept 403 AGREEMENT_NOT_ACCEPTED events fired by the API client
  useEffect(() => {
    function handleAgreementRequired() {
      // Re-fetch the current agreement content and force the modal
      apiClient.getCurrentAgreement()
        .then((current) => {
          setAgreement(current);
          setNeedsAcceptance(true);
          setChecked(true); // keep children rendered but modal blocks interaction
        })
        .catch(() => {});
    }

    window.addEventListener('agreement:required', handleAgreementRequired);
    return () => window.removeEventListener('agreement:required', handleAgreementRequired);
  }, []);

  function handleAccepted() {
    setNeedsAcceptance(false);
    setChecked(true);
  }

  if (authLoading || !checked) {
    return (
      <>
        {needsAcceptance && agreement && (
          <AgreementModal agreement={agreement} onAccepted={handleAccepted} />
        )}
        {children}
      </>
    );
  }

  return (
    <>
      {needsAcceptance && agreement && (
        <AgreementModal agreement={agreement} onAccepted={handleAccepted} />
      )}
      {children}
    </>
  );
}
