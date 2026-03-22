'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, ChevronRight, Clock } from 'lucide-react';
import StepUpModal from '@/components/auth/StepUpModal';
import { useThreatAlerts, type ThreatAlert } from '@/hooks/useThreatAlerts';
import { useRouter } from 'next/navigation';

// ── Single banner row ─────────────────────────────────────────────────────────

function BannerRow({
  alert,
  onDismiss,
  onAction,
}: {
  alert: ThreatAlert;
  onDismiss: () => void;
  onAction: (alert: ThreatAlert) => void;
}) {
  const isCritical = alert.level === 'critical';

  const containerClass = isCritical
    ? 'bg-red-950/80 border-red-700/60 text-red-100'
    : 'bg-yellow-950/80 border-yellow-700/60 text-yellow-100';

  const iconClass = isCritical ? 'text-red-400' : 'text-yellow-400';
  const Icon = isCritical ? ShieldAlert : AlertTriangle;

  const timeStr = new Date(alert.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-opacity-40 ${containerClass}`}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <Icon size={16} className={`shrink-0 ${iconClass}`} aria-hidden="true" />

      {/* Message + timestamp */}
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
        <span className="text-sm font-medium leading-snug truncate">{alert.message}</span>
        <span className="flex items-center gap-1 text-xs opacity-60 shrink-0">
          <Clock size={10} />
          {timeStr}
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={() => onAction(alert)}
        className={`
          shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md
          transition-colors border
          ${isCritical
            ? 'border-red-500/50 hover:bg-red-800/60 text-red-200'
            : 'border-yellow-500/50 hover:bg-yellow-800/60 text-yellow-200'
          }
        `}
        aria-label="Review security activity"
      >
        Review activity
        <ChevronRight size={12} />
      </button>

      {/* Dismiss — critical alerts require step-up; warning alerts dismiss directly */}
      <button
        onClick={() => onDismiss()}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-1 rounded"
        aria-label={isCritical ? 'Dismiss alert (requires verification)' : 'Dismiss alert'}
        title={isCritical ? 'Requires step-up verification to dismiss' : 'Dismiss'}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ThreatBanner() {
  const { alerts, dismiss } = useThreatAlerts();
  const router = useRouter();
  const [stepUpTarget, setStepUpTarget] = useState<ThreatAlert | null>(null);
  // Tracks whether step-up is for "review" or "dismiss" action
  const [stepUpIntent, setStepUpIntent] = useState<'review' | 'dismiss'>('review');

  if (alerts.length === 0) return null;

  function handleAction(alert: ThreatAlert) {
    // All alerts require step-up before navigating to the review page
    setStepUpIntent('review');
    setStepUpTarget(alert);
  }

  function handleDismiss(alert: ThreatAlert) {
    if (alert.level === 'critical') {
      // Critical alerts require step-up before dismissal
      setStepUpIntent('dismiss');
      setStepUpTarget(alert);
    } else {
      dismiss(alert.id);
    }
  }

  function handleStepUpSuccess() {
    if (!stepUpTarget) return;
    if (stepUpIntent === 'dismiss') {
      dismiss(stepUpTarget.id);
    } else {
      router.push('/settings?tab=security');
    }
    setStepUpTarget(null);
  }

  function handleStepUpCancel() {
    setStepUpTarget(null);
  }

  return (
    <>
      {/* Fixed banner stack at top of viewport, above everything except modals */}
      <div
        className="fixed top-0 left-0 right-0 z-[90] flex flex-col shadow-lg"
        aria-label="Security threat alerts"
      >
        {alerts.map(alert => (
          <BannerRow
            key={alert.id}
            alert={alert}
            onDismiss={() => handleDismiss(alert)}
            onAction={handleAction}
          />
        ))}
      </div>

      {/* Spacer so page content isn't hidden behind the banner */}
      <div style={{ height: alerts.length * 44 }} aria-hidden="true" />

      {/* Step-up modal triggered by "Review activity" or critical dismiss */}
      {stepUpTarget && (
        <StepUpModal
          action={stepUpIntent === 'dismiss' ? 'dismiss critical security alert' : 'review security activity'}
          onSuccess={handleStepUpSuccess}
          onCancel={handleStepUpCancel}
        />
      )}
    </>
  );
}
