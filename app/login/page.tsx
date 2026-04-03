'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Loader2, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Suspense } from 'react';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, loading, refreshUser, is2FAVerified } = useAuth();
  const router = useRouter();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!loading && user && is2FAVerified && !redirectingRef.current) {
      redirectingRef.current = true;
      if (!user.onboardingCompleted) {
        router.replace('/onboarding');
      } else if (user.role === 'founder' || user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router, is2FAVerified]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await login(email, password);
      // If backend signals 2FA required
      if (res?.requires2FA) {
        setStep('2fa');
        return;
      }
      // If email not yet verified — redirect to verify-email page
      if (res?.emailNotVerified) {
        router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      // Successful login — redirect manually (auto-redirect is suppressed when needs2FA)
      const userData = await apiClient.getCurrentUser();
      if (!userData.onboardingCompleted) {
        router.replace('/onboarding');
      } else if (userData.role === 'founder' || userData.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await apiClient.loginWith2FA(email, password, totpCode);
      if (res?.token) {
        localStorage.setItem('auth_token', res.token);
        document.cookie = `auth_token=${res.token}; path=/; max-age=604800; SameSite=Lax`;
      }
      await refreshUser();
      const role = res?.user?.role;
      if (role === 'founder' || role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (user && is2FAVerified) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="flex justify-center mb-8">
            <div className={`p-3 rounded-full ${step === '2fa' ? 'bg-purple-600' : 'bg-blue-600'}`}>
              {step === '2fa' ? (
                <ShieldCheck className="w-8 h-8 text-white" />
              ) : (
                <LogIn className="w-8 h-8 text-white" />
              )}
            </div>
          </div>

          {step === 'credentials' ? (
            <>
              <h1 className="text-3xl font-bold text-white text-center mb-2">Welcome Back</h1>
              <p className="text-gray-400 text-center mb-8">Sign in to Builder&apos;s Circle</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleCredentials} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Signing in...</> : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <p className="text-gray-400">
                  <Link href="/forgot-password" className="text-gray-400 hover:text-gray-200 text-sm transition">Forgot password?</Link>
                </p>
                <p className="text-gray-400">
                  Don&apos;t have an account?{' '}
                  <Link href="/submit-to-triage" className="text-blue-500 hover:text-blue-400 font-medium transition">Sign up</Link>
                </p>
                <p className="text-gray-500 text-sm">
                  Want to join?{' '}
                  <a href="https://docs.google.com/forms/d/e/1FAIpQLSf5j4p877uErugDzliFP7A5ZqyoT2sq6-W_Jdxm9C2hmuKe5w/viewform" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-medium transition">Apply to Builder&apos;s Circle</a>
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">Two-Factor Auth</h1>
              <p className="text-gray-400 text-center mb-8">Enter the 6-digit code from your authenticator app</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handle2FA} className="space-y-6">
                <div>
                  <label htmlFor="totp" className="block text-sm font-medium text-gray-300 mb-2">Authentication Code</label>
                  <input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="000000"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || totpCode.length !== 6}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Verifying...</> : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}
                  className="w-full text-gray-400 hover:text-gray-200 text-sm transition"
                >
                  ← Back to login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
