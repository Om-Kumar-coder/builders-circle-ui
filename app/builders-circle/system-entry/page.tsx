'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowRight, AlertTriangle, Info } from 'lucide-react';

const SESSION_KEY = 'prefilter_session_id';
const ACK_KEY = 'prefilter_ack';
const TOKEN_KEY = 'prefilter_token';

function generateSessionId(): string {
  return `pref_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export default function SystemEntryPage() {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [logging, setLogging] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>('');
  const hasLoggedView = useRef(false);
  const hasLoggedScroll = useRef(false);

  // ── Event logging ───────────────────────────────────────────────────────

  const logEvent = useCallback(async (event: string, metadata?: Record<string, unknown>) => {
    try {
      await fetch('/api/triage/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          sessionId: sessionId.current,
          metadata,
        }),
      });
    } catch {
      // Silent — event logging should never break UX
    }
  }, []);

  // ── JWT token acquisition flow ─────────────────────────────────────────

  const acquireJwtToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/triage/prefilter/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data?.token ?? null;
    } catch {
      return null;
    }
  }, []);

  const setCookieViaServer = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/prefilter/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // ── Initialize ─────────────────────────────────────────────────────────

  useEffect(() => {
    sessionId.current = getOrCreateSessionId();

    // Check if already acknowledged
    const ack = localStorage.getItem(ACK_KEY);
    if (ack === 'true') {
      setAcknowledged(true);
    }

    // Log page view (once)
    if (!hasLoggedView.current) {
      hasLoggedView.current = true;
      logEvent('prefilter_page_view');
    }
  }, [logEvent]);

  // ── Scroll tracking ────────────────────────────────────────────────────

  useEffect(() => {
    const handleScroll = () => {
      if (hasLoggedScroll.current) return;
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const progress = Math.abs(rect.top) / rect.height;
      if (progress >= 0.5) {
        hasLoggedScroll.current = true;
        logEvent('prefilter_scrolled_50');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [logEvent]);

  // ── Exit tracking ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!acknowledged) {
        // Use sendBeacon for reliable delivery during page unload
        const body = JSON.stringify({
          event: 'prefilter_exit_no_click',
          sessionId: sessionId.current,
        });
        navigator.sendBeacon('/api/triage/event', new Blob([body], { type: 'application/json' }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [acknowledged]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleCheckboxChange = async (checked: boolean) => {
    if (checked) {
      // 1. Acquire JWT token from server
      const token = await acquireJwtToken();

      // 2. Store acknowledgment + token in localStorage
      localStorage.setItem(ACK_KEY, 'true');
      localStorage.setItem(ACK_KEY + '_timestamp', new Date().toISOString());
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        // 3. Set httpOnly cookie server-side (non-blocking)
        setCookieViaServer(token).catch(() => {});
      }

      // 4. Log event
      await logEvent('prefilter_checkbox_checked');

      setAcknowledged(true);
    } else {
      // Remove all stored state
      localStorage.removeItem(ACK_KEY);
      localStorage.removeItem(ACK_KEY + '_timestamp');
      localStorage.removeItem(TOKEN_KEY);
      setAcknowledged(false);
    }
  };

  const handleCTA = async () => {
    if (!acknowledged || logging) return;
    setLogging(true);

    try {
      await logEvent('prefilter_cta_click');
      // Small delay to ensure event is sent
      await new Promise(r => setTimeout(r, 200));
      router.push('/triage/apply');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Builders Circle</h1>
            <p className="text-xs text-gray-500">System Entry</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-sm font-medium mb-6">
            <Info className="w-4 h-4" />
            Entry Control Layer
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Welcome to the{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Builder&apos;s Circle
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            A contribution-based ownership economy platform for distributed teams.
            Before you proceed, please review the entry requirements below.
          </p>
        </div>

        {/* Requirements Section */}
        <div ref={sectionRef} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 mb-8">
          <h3 className="text-xl font-semibold text-white mb-6">Entry Requirements</h3>

          <div className="space-y-6">
            <RequirementItem
              number="1"
              title="Commitment to Contribution"
              description="Builders Circle is built on verified contributions. You must be prepared to actively contribute your skills, time, and expertise. Passive participation is not supported."
            />
            <RequirementItem
              number="2"
              title="Alignment with Platform Values"
              description="We prioritize transparent, collaborative, and high-quality work. Your submissions will be reviewed by both our AI gatekeeper (Veronica) and human administrators."
            />
            <RequirementItem
              number="3"
              title="Verifiable Track Record"
              description="You will need to provide proof of your work and execution capability. All submissions must include verifiable links, descriptions of outcomes, and honest time reporting."
            />
            <RequirementItem
              number="4"
              title="Onboarding &amp; Security"
              description="All accepted members must complete email verification, set up two-factor authentication (2FA), and accept the platform agreement before participating."
            />
          </div>
        </div>

        {/* Acknowledgment */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <input
                id="ack"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
            </div>
            <label htmlFor="ack" className="text-gray-300 text-sm leading-relaxed cursor-pointer select-none">
              <span className="font-medium text-white">I acknowledge and agree</span> that I have read and understand
              the entry requirements above. I understand that the Builders Circle platform involves a thorough review
              process, and that my application will be evaluated based on the information I provide.
            </label>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={handleCTA}
            disabled={!acknowledged || logging}
            className={`
              inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold
              transition-all duration-200
              ${
                acknowledged
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {logging ? (
              'Processing...'
            ) : (
              <>
                Proceed to Application
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          {!acknowledged && (
            <p className="text-gray-600 text-sm mt-3">
              Please read and acknowledge the entry requirements above to continue
            </p>
          )}
        </div>

        {/* Info */}
        <div className="mt-12 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300/70 text-sm leading-relaxed">
              This is the controlled entry point to Builders Circle. Only complete this process if you
              are genuinely interested in contributing to a builder community.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementItem({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">
        {number}
      </div>
      <div>
        <h4 className="text-white font-medium mb-1">{title}</h4>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
