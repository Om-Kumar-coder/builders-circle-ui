'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import { Check, Shield, Lock, Eye, ClipboardList, Loader2, ChevronRight } from 'lucide-react';
import TwoFactorSetup from '@/components/settings/TwoFactorSetup';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
  onboardingStep: number;
  onboardingCompleted: boolean;
  twoFactorEnabled: boolean;
  role: string;
  agreementAccepted: boolean;
  agreementId: string | null;
  agreementVersion: string | null;
}

// ── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Accept Rules",       icon: ClipboardList },
  { label: "Enable 2FA",         icon: Shield },
  { label: "Password Security",  icon: Lock },
  { label: "Access Tier",        icon: Eye },
  { label: "Final Review",       icon: Check },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed display step
  const [fetching, setFetching] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');

  // Step 1 state
  const [agreementContent, setAgreementContent] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [agreementAccepting, setAgreementAccepting] = useState(false);

  // Step 3 state
  const [passwordConfirmed, setPasswordConfirmed] = useState(false);

  // Step 2 — show 2FA modal
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorDone, setTwoFactorDone] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiClient.getOnboardingStatus();
      setStatus(s);
      setCurrentStep(s.onboardingStep); // server step is 0-4 (0 = not started, 1-5 = completed steps)
      setTwoFactorDone(s.twoFactorEnabled);
      if (s.agreementAccepted) setAgreementChecked(true);

      // Load agreement content for step 1
      if (!s.agreementAccepted && s.agreementId) {
        try {
          const agreement = await apiClient.getCurrentAgreement();
          setAgreementContent(agreement?.content ?? '');
        } catch {
          setAgreementContent('By proceeding, you agree to follow the Builder\'s Circle community rules and code of conduct.');
        }
      }
    } catch {
      setError('Failed to load onboarding status.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.onboardingCompleted) {
        router.replace(user.role === 'founder' || user.role === 'admin' ? '/admin' : '/dashboard');
        return;
      }
      loadStatus();
    }
  }, [user, loading, router, loadStatus]);

  // ── Step actions ────────────────────────────────────────────────────────────

  async function acceptAgreement() {
    if (!status?.agreementId) return;
    setAgreementAccepting(true);
    setError('');
    try {
      await apiClient.acceptAgreement(status.agreementId);
      setAgreementChecked(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to accept agreement');
    } finally {
      setAgreementAccepting(false);
    }
  }

  async function advanceStep(step: number) {
    setAdvancing(true);
    setError('');
    try {
      const result = await apiClient.advanceOnboardingStep(step);
      setCurrentStep(result.onboardingStep);
      if (result.onboardingCompleted) {
        await refreshUser();
        router.replace(user?.role === 'founder' || user?.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to advance step');
    } finally {
      setAdvancing(false);
    }
  }

  function handle2FAToggled(enabled: boolean) {
    setTwoFactorDone(enabled);
    setShow2FA(false);
    if (enabled) {
      // Refresh status to sync server state
      loadStatus();
    }
  }

  // ── Render guards ───────────────────────────────────────────────────────────

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user || !status) return null;

  // displayStep is 1-indexed for UI (currentStep from server is 0-4)
  const displayStep = currentStep + 1; // which step we're ON (1-5)
  const completedUpTo = currentStep;   // steps 1..completedUpTo are done

  // ── Step content ────────────────────────────────────────────────────────────

  function renderStepContent() {
    switch (displayStep) {
      case 1:
        return <StepAcceptRules
          content={agreementContent}
          checked={agreementChecked}
          accepting={agreementAccepting}
          onAccept={acceptAgreement}
          onNext={() => advanceStep(1)}
          advancing={advancing}
          error={error}
        />;
      case 2:
        return <StepEnable2FA
          done={twoFactorDone}
          onSetup={() => setShow2FA(true)}
          onNext={() => advanceStep(2)}
          advancing={advancing}
          error={error}
        />;
      case 3:
        return <StepPasswordManager
          confirmed={passwordConfirmed}
          onConfirm={() => setPasswordConfirmed(true)}
          onNext={() => advanceStep(3)}
          advancing={advancing}
          error={error}
        />;
      case 4:
        return <StepAccessTier
          role={status!.role}
          onNext={() => advanceStep(4)}
          advancing={advancing}
          error={error}
        />;
      case 5:
        return <StepFinalReview
          role={status!.role}
          twoFactorEnabled={twoFactorDone}
          onEnter={() => advanceStep(5)}
          advancing={advancing}
          error={error}
        />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* 2FA modal */}
      {show2FA && (
        <TwoFactorSetup
          enabled={false}
          mandatory
          onClose={() => setShow2FA(false)}
          onToggled={handle2FAToggled}
        />
      )}

      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Builder's Circle</h1>
          <p className="text-gray-400">Complete these steps to activate your account</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((step, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < displayStep;
            const isCurrent = stepNum === displayStep;
            const Icon = step.icon;
            return (
              <div key={idx} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-indigo-600 border-indigo-600'
                      : isCurrent
                      ? 'bg-gray-900 border-indigo-500'
                      : 'bg-gray-900 border-gray-700'
                  }`}>
                    {isCompleted
                      ? <Check className="w-5 h-5 text-white" />
                      : <Icon className={`w-5 h-5 ${isCurrent ? 'text-indigo-400' : 'text-gray-600'}`} />
                    }
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isCurrent ? 'text-indigo-400' : isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 ${stepNum < displayStep ? 'bg-indigo-600' : 'bg-gray-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-full">
              Step {displayStep} of {STEPS.length}
            </span>
            <span className="text-sm text-gray-500">{STEPS[displayStep - 1]?.label}</span>
          </div>
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Accept Rules ──────────────────────────────────────────────────────

function StepAcceptRules({
  content, checked, accepting, onAccept, onNext, advancing, error
}: {
  content: string; checked: boolean; accepting: boolean;
  onAccept: () => void; onNext: () => void; advancing: boolean; error: string;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Accept Builder's Circle Rules</h2>
      <p className="text-gray-400 text-sm">Read and accept the community rules before proceeding.</p>

      <div className="bg-gray-800 rounded-xl p-4 max-h-64 overflow-y-auto text-sm text-gray-300 leading-relaxed whitespace-pre-wrap border border-gray-700">
        {content || `Welcome to Builder's Circle.

By joining, you agree to:
• Contribute honestly and transparently
• Respect all community members
• Submit accurate activity records
• Maintain confidentiality of proprietary information
• Follow the code of conduct at all times

Violations may result in suspension or removal from the platform.`}
      </div>

      {!checked ? (
        <button
          onClick={onAccept}
          disabled={accepting}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {accepting ? 'Accepting...' : 'I Accept the Rules'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            Rules accepted
          </div>
          <NextButton onClick={onNext} loading={advancing} />
        </div>
      )}
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ── Step 2: Enable 2FA ────────────────────────────────────────────────────────

function StepEnable2FA({
  done, onSetup, onNext, advancing, error
}: {
  done: boolean; onSetup: () => void; onNext: () => void; advancing: boolean; error: string;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Enable Two-Factor Authentication</h2>
      <p className="text-gray-400 text-sm">
        2FA is mandatory for all Builder's Circle accounts. You'll need an authenticator app like Google Authenticator or Authy.
      </p>

      {!done ? (
        <button
          onClick={onSetup}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Set Up 2FA Now
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            <Check className="w-4 h-4 flex-shrink-0" />
            Two-factor authentication is enabled
          </div>
          <NextButton onClick={onNext} loading={advancing} />
        </div>
      )}
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ── Step 3: Password Manager ──────────────────────────────────────────────────

function StepPasswordManager({
  confirmed, onConfirm, onNext, advancing, error
}: {
  confirmed: boolean; onConfirm: () => void; onNext: () => void; advancing: boolean; error: string;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Secure Your Password</h2>
      <p className="text-gray-400 text-sm">
        We strongly recommend using a password manager to keep your account secure.
      </p>

      <div className="bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-700">
        <p className="text-sm text-gray-300 font-medium">Recommended password managers:</p>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>1Password</li>
          <li>Bitwarden (free & open source)</li>
          <li>Dashlane</li>
          <li>Your browser's built-in password manager</li>
        </ul>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => e.target.checked && onConfirm()}
          className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
          I have saved my password securely and understand I am responsible for maintaining access to my account.
        </span>
      </label>

      {confirmed && <NextButton onClick={onNext} loading={advancing} />}
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ── Step 4: Access Tier ───────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, { label: string; description: string; permissions: string[] }> = {
  founder: {
    label: 'Founder',
    description: 'Full platform access with administrative capabilities.',
    permissions: ['Manage all cycles', 'Admin panel access', 'Override ownership', 'Manage users'],
  },
  admin: {
    label: 'Administrator',
    description: 'Administrative access to manage the platform.',
    permissions: ['Manage cycles', 'Admin panel access', 'Review activities', 'Manage users'],
  },
  contributor: {
    label: 'Contributor',
    description: 'Standard contributor access to participate in build cycles.',
    permissions: ['Join build cycles', 'Submit activity', 'Earn ownership', 'View earnings'],
  },
  employee: {
    label: 'Employee',
    description: 'Employee access with standard contribution capabilities.',
    permissions: ['Join build cycles', 'Submit activity', 'View dashboard'],
  },
  observer: {
    label: 'Observer',
    description: 'Read-only access to view platform activity.',
    permissions: ['View cycles', 'View activity feed', 'View analytics'],
  },
};

function StepAccessTier({
  role, onNext, advancing, error
}: {
  role: string; onNext: () => void; advancing: boolean; error: string;
}) {
  const info = ROLE_DESCRIPTIONS[role] ?? ROLE_DESCRIPTIONS.contributor;
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">Your Access Tier</h2>
      <p className="text-gray-400 text-sm">Your role and permissions have been assigned. This is read-only.</p>

      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-white font-semibold">{info.label}</p>
            <p className="text-gray-400 text-sm">{info.description}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Permissions</p>
          <ul className="space-y-1">
            {info.permissions.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-gray-300">
                <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <NextButton onClick={onNext} loading={advancing} />
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ── Step 5: Final Review ──────────────────────────────────────────────────────

function StepFinalReview({
  role, twoFactorEnabled, onEnter, advancing, error
}: {
  role: string; twoFactorEnabled: boolean; onEnter: () => void; advancing: boolean; error: string;
}) {
  const roleInfo = ROLE_DESCRIPTIONS[role] ?? ROLE_DESCRIPTIONS.contributor;
  const items = [
    { label: 'Rules accepted', done: true },
    { label: '2FA enabled', done: twoFactorEnabled },
    { label: 'Password secured', done: true },
    { label: `Access tier: ${roleInfo.label}`, done: true },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-white">You're all set</h2>
      <p className="text-gray-400 text-sm">Review your setup before entering the app.</p>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.done ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <Check className={`w-3.5 h-3.5 ${item.done ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <span className="text-sm text-gray-300">{item.label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onEnter}
        disabled={advancing}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        {advancing ? 'Entering...' : 'Enter Builder\'s Circle'}
      </button>
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function NextButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
      {loading ? 'Saving...' : 'Continue'}
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
      {msg}
    </div>
  );
}
