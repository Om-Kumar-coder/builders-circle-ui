'use client';

import { useState } from 'react';
import { X, ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import Image from 'next/image';

interface TwoFactorSetupProps {
  enabled: boolean;
  onClose: () => void;
  onToggled: (enabled: boolean) => void;
  mandatory?: boolean;
}

export default function TwoFactorSetup({ enabled, onClose, onToggled, mandatory = false }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'disable'>(
    enabled ? 'disable' : 'intro'
  );
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startSetup() {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.setup2FA();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('scan');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable() {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.enable2FA(code);
      onToggled(true);
      if (!mandatory) onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable() {
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.disable2FA(code);
      onToggled(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100">
              {enabled ? 'Disable 2FA' : 'Enable 2FA'}
            </h2>
          </div>
          {!mandatory && (
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Intro */}
          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Two-factor authentication adds an extra layer of security. You&apos;ll need an authenticator app like Google Authenticator or Authy.
              </p>
              <button
                onClick={startSetup}
                disabled={loading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Get Started'}
              </button>
            </div>
          )}

          {/* QR scan */}
          {step === 'scan' && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Scan this QR code with your authenticator app:</p>
              {qrCode && (
                <div className="flex justify-center bg-white p-3 rounded-xl">
                  <Image src={qrCode} alt="2FA QR Code" width={180} height={180} />
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Or enter this key manually:</p>
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                  <code className="text-xs text-gray-300 flex-1 break-all">{secret}</code>
                  <button onClick={copySecret} className="text-gray-400 hover:text-gray-200 flex-shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setStep('verify')}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                I&apos;ve scanned it →
              </button>
            </div>
          )}

          {/* Verify enable */}
          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Enter the 6-digit code from your authenticator app to confirm:</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="000000"
              />
              <button
                onClick={confirmEnable}
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Enable 2FA'}
              </button>
              <button onClick={() => setStep('scan')} className="w-full text-gray-400 hover:text-gray-200 text-sm transition">
                ← Back
              </button>
            </div>
          )}

          {/* Disable */}
          {step === 'disable' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <ShieldOff className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">This will remove 2FA protection from your account.</p>
              </div>
              <p className="text-gray-400 text-sm">Enter your current authenticator code to confirm:</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="000000"
              />
              <button
                onClick={confirmDisable}
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
