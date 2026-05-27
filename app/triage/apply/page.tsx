'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft, CheckCircle, Send, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

const ACK_KEY = 'prefilter_ack';
const SESSION_KEY = 'prefilter_session_id';

const INTENT_TYPES = [
  { value: 'join', label: 'Join as Contributor', description: 'I want to contribute to existing projects' },
  { value: 'collaborate', label: 'Collaborate', description: 'I want to partner on a new initiative' },
  { value: 'invest', label: 'Invest / Sponsor', description: 'I want to provide capital or resources' },
  { value: 'propose', label: 'Propose a Project', description: 'I have a project idea to propose' },
  { value: 'other', label: 'Other', description: 'Something else' },
];

const CAPITAL_RANGES = [
  { value: 'pre_revenue', label: 'Pre-revenue / Idea stage' },
  { value: '1k_10k', label: '$1K – $10K' },
  { value: '10k_50k', label: '$10K – $50K' },
  { value: '50k_100k', label: '$50K – $100K' },
  { value: '100k_plus', label: '$100K+' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'less_than_5', label: 'Less than 5 hrs/week' },
  { value: '5_10', label: '5–10 hrs/week' },
  { value: '10_20', label: '10–20 hrs/week' },
  { value: '20_40', label: '20–40 hrs/week' },
  { value: '40_plus', label: '40+ hrs/week' },
];

const TIMELINE_OPTIONS = [
  { value: 'immediately', label: 'Immediately (within 1–2 weeks)' },
  { value: '1_3_months', label: '1–3 months' },
  { value: '3_6_months', label: '3–6 months' },
  { value: '6_plus_months', label: '6+ months' },
  { value: 'exploring', label: 'Just exploring / no fixed timeline' },
];

const RECENCY_OPTIONS = [
  { value: 'last_week', label: 'Within the last week' },
  { value: 'last_month', label: 'Within the last month' },
  { value: 'last_3_months', label: 'Within the last 3 months' },
  { value: 'last_year', label: 'Within the last year' },
  { value: 'more_than_year', label: 'More than a year ago' },
];

interface FormData {
  fullName: string;
  email: string;
  phoneOrWhatsapp: string;
  countryTimezone: string;
  intentType: string;
  capitalRange: string;
  executionProofUrl: string;
  executionOutcome: string;
  executionRecency: string;
  valueProposition: string;
  availability: string;
  timeline: string;
  intentOutcome30_60: string;
}

interface FormErrors {
  [key: string]: string;
}

export default function TriageApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ id: string; message: string } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    fullName: '',
    email: '',
    phoneOrWhatsapp: '',
    countryTimezone: '',
    intentType: '',
    capitalRange: '',
    executionProofUrl: '',
    executionOutcome: '',
    executionRecency: '',
    valueProposition: '',
    availability: '',
    timeline: '',
    intentOutcome30_60: '',
  });

  // ── Access control: block if prefilter_ack !== true or prefilter_token missing ─────

  useEffect(() => {
    const ack = localStorage.getItem(ACK_KEY);
    const token = localStorage.getItem('prefilter_token');
    if (ack !== 'true' || !token) {
      router.replace('/builders-circle/system-entry');
      return;
    }
    setLoading(false);
  }, [router]);

  // ── reCAPTCHA ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Load reCAPTCHA script if site key is configured
    const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;
    if (!siteKey) {
      setCaptchaLoaded(true); // No CAPTCHA configured — skip
      return;
    }

    if (typeof window === 'undefined') return;

    const scriptId = 'recaptcha-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setCaptchaLoaded(true);
      document.body.appendChild(script);
    } else {
      setCaptchaLoaded(true);
    }
  }, []);

  const executeCaptcha = useCallback(async (): Promise<string | null> => {
    const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;
    if (!siteKey || typeof window === 'undefined') return null;
    try {
      const token = await (window as any).grecaptcha.execute(siteKey, { action: 'submit' });
      return token;
    } catch {
      return null;
    }
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────

  const handleChange = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name is required (min 2 characters)';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!form.intentType) {
      newErrors.intentType = 'Please select your intent type';
    }
    if (!form.valueProposition.trim() || form.valueProposition.trim().length < 20) {
      newErrors.valueProposition = 'Value proposition must be at least 20 characters';
    }
    if (form.executionProofUrl && form.executionProofUrl.trim() && 
        !/^https?:\/\/.+/.test(form.executionProofUrl.trim())) {
      newErrors.executionProofUrl = 'Must be a valid URL starting with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      // Get CAPTCHA token if available
      let token: string | null = null;
      if (captchaLoaded && process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY) {
        token = await executeCaptcha();
      }

      const sessionId = sessionStorage.getItem(SESSION_KEY) || '';

      const response = await fetch('/api/triage/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phoneOrWhatsapp: form.phoneOrWhatsapp.trim() || null,
          countryTimezone: form.countryTimezone.trim() || null,
          intentType: form.intentType,
          capitalRange: form.capitalRange || null,
          executionProofUrl: form.executionProofUrl.trim() || null,
          executionOutcome: form.executionOutcome.trim() || null,
          executionRecency: form.executionRecency || null,
          valueProposition: form.valueProposition.trim(),
          availability: form.availability || null,
          timeline: form.timeline || null,
          intentOutcome30_60: form.intentOutcome30_60.trim() || null,
          prefilterAck: true,
          prefilterSessionId: sessionId || null,
          captchaToken: token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle expired prefilter token — redirect back to system-entry
        if (response.status === 403 && data.error?.toLowerCase().includes('expired prefilter')) {
          localStorage.removeItem(ACK_KEY);
          localStorage.removeItem('prefilter_token');
          router.replace('/builders-circle/system-entry');
          return;
        }
        setErrors({ _general: data.error || 'Submission failed. Please try again.' });
        return;
      }

      setSubmitted(true);
      setSubmitResult(data.data);
    } catch {
      setErrors({ _general: 'Network error. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="max-w-lg mx-auto px-6 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Application Received</h2>
          <p className="text-gray-400 mb-2">
            Thank you for your application. Our team will review it and get back to you.
          </p>
          {submitResult?.id && (
            <p className="text-gray-500 text-sm mb-6">
              Reference ID: <span className="font-mono text-gray-400">{submitResult.id}</span>
            </p>
          )}
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/builders-circle/system-entry')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Builders Circle</h1>
            <p className="text-xs text-gray-500">Application Form</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Page intro */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Submit Your Application</h2>
          <p className="text-gray-400">
            Please fill out all required fields. Your submission will be reviewed by our team.
          </p>
        </div>

        {/* General error */}
        {errors._general && (
          <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{errors._general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Personal Info */}
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-1">Personal Information</h3>
            <p className="text-gray-500 text-sm mb-6">Basic contact details</p>

            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Your full name"
                  className={`w-full px-4 py-2.5 bg-gray-800/80 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    errors.fullName ? 'border-red-500/50' : 'border-gray-700'
                  }`}
                />
                {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-2.5 bg-gray-800/80 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    errors.email ? 'border-red-500/50' : 'border-gray-700'
                  }`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label htmlFor="phoneOrWhatsapp" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Phone / WhatsApp
                </label>
                <input
                  id="phoneOrWhatsapp"
                  type="text"
                  value={form.phoneOrWhatsapp}
                  onChange={(e) => handleChange('phoneOrWhatsapp', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* Country / Timezone */}
              <div>
                <label htmlFor="countryTimezone" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Country / Timezone
                </label>
                <input
                  id="countryTimezone"
                  type="text"
                  value={form.countryTimezone}
                  onChange={(e) => handleChange('countryTimezone', e.target.value)}
                  placeholder="e.g. United States (EST)"
                  className="w-full px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Intent */}
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-1">Intent &amp; Contribution</h3>
            <p className="text-gray-500 text-sm mb-6">What brings you to Builders Circle?</p>

            <div className="space-y-5">
              {/* Intent Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Intent Type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {INTENT_TYPES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('intentType', opt.value)}
                      className={`text-left px-4 py-3 rounded-xl border transition-all ${
                        form.intentType === opt.value
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                          : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{opt.description}</div>
                    </button>
                  ))}
                </div>
                {errors.intentType && <p className="text-red-400 text-xs mt-1">{errors.intentType}</p>}
              </div>

              {/* Capital Range (shown for invest intent) */}
              {form.intentType === 'invest' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Capital Range
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CAPITAL_RANGES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleChange('capitalRange', opt.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          form.capitalRange === opt.value
                            ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                            : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Execution Track Record */}
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-1">Execution Track Record</h3>
            <p className="text-gray-500 text-sm mb-6">Show us what you have built or contributed to</p>

            <div className="space-y-5">
              {/* Proof URL */}
              <div>
                <label htmlFor="executionProofUrl" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Proof of Work URL
                  <span className="text-gray-500 font-normal ml-1">(GitHub, portfolio, project link)</span>
                </label>
                <input
                  id="executionProofUrl"
                  type="url"
                  value={form.executionProofUrl}
                  onChange={(e) => handleChange('executionProofUrl', e.target.value)}
                  placeholder="https://github.com/your-repo"
                  className={`w-full px-4 py-2.5 bg-gray-800/80 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    errors.executionProofUrl ? 'border-red-500/50' : 'border-gray-700'
                  }`}
                />
                {errors.executionProofUrl && <p className="text-red-400 text-xs mt-1">{errors.executionProofUrl}</p>}
              </div>

              {/* Execution Outcome */}
              <div>
                <label htmlFor="executionOutcome" className="block text-sm font-medium text-gray-300 mb-1.5">
                  What was the outcome?
                </label>
                <textarea
                  id="executionOutcome"
                  value={form.executionOutcome}
                  onChange={(e) => handleChange('executionOutcome', e.target.value)}
                  placeholder="Describe what you achieved, the impact, metrics, etc."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* Recency */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  When did this happen?
                </label>
                <div className="flex flex-wrap gap-2">
                  {RECENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('executionRecency', opt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        form.executionRecency === opt.value
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                          : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Value Proposition */}
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-1">Value Proposition</h3>
            <p className="text-gray-500 text-sm mb-6">Why should you be part of Builders Circle?</p>

            <div className="space-y-5">
              {/* Value Proposition */}
              <div>
                <label htmlFor="valueProposition" className="block text-sm font-medium text-gray-300 mb-1.5">
                  What value can you bring? <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="valueProposition"
                  value={form.valueProposition}
                  onChange={(e) => handleChange('valueProposition', e.target.value)}
                  placeholder="Describe your skills, expertise, network, capital, or unique perspective you bring to the community. Min 20 characters."
                  rows={4}
                  className={`w-full px-4 py-2.5 bg-gray-800/80 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none ${
                    errors.valueProposition ? 'border-red-500/50' : 'border-gray-700'
                  }`}
                />
                <div className="flex justify-between mt-1">
                  {errors.valueProposition && <p className="text-red-400 text-xs">{errors.valueProposition}</p>}
                  <p className="text-gray-600 text-xs ml-auto">{form.valueProposition.length} / 3000</p>
                </div>
              </div>

              {/* Intent Outcome 30-60 days */}
              <div>
                <label htmlFor="intentOutcome30_60" className="block text-sm font-medium text-gray-300 mb-1.5">
                  What would you aim to achieve in your first 30–60 days?
                </label>
                <textarea
                  id="intentOutcome30_60"
                  value={form.intentOutcome30_60}
                  onChange={(e) => handleChange('intentOutcome30_60', e.target.value)}
                  placeholder="Describe goals, milestones, or contributions you would focus on"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none"
                />
              </div>
            </div>
          </section>

          {/* Section 5: Availability & Timeline */}
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-1">Availability &amp; Timeline</h3>
            <p className="text-gray-500 text-sm mb-6">Your capacity and time commitment</p>

            <div className="space-y-5">
              {/* Availability */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  How much time can you commit?
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('availability', opt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        form.availability === opt.value
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                          : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  When would you like to start?
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIMELINE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('timeline', opt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        form.timeline === opt.value
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                          : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* reCAPTCHA notice */}
          {process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY && (
            <div className="text-center">
              <p className="text-gray-600 text-xs">
                This site is protected by reCAPTCHA and the Google{' '}
                <a href="https://policies.google.com/privacy" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                {' '}and{' '}
                <a href="https://policies.google.com/terms" className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>
                {' '}apply.
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={submitting}
              className={`
                inline-flex items-center gap-2 px-10 py-3.5 rounded-xl text-base font-semibold
                transition-all duration-200
                ${
                  submitting
                    ? 'bg-indigo-800 text-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
                }
              `}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
