'use client';

import { useState, Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.forgotPassword(email);
    } catch {
      // Intentionally swallow errors — always show success to prevent enumeration
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="flex justify-center mb-8">
            <div className="p-3 rounded-full bg-indigo-600">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>

          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-14 h-14 text-green-400 mx-auto" />
              <h1 className="text-2xl font-bold text-white">Check your email</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                If an account exists for <span className="text-white font-medium">{email}</span>, a password reset link has been sent. Check your inbox and spam folder.
              </p>
              <p className="text-gray-500 text-xs">The link expires in 15 minutes.</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition mt-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">Forgot Password</h1>
              <p className="text-gray-400 text-center text-sm mb-8">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Sending...</>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
