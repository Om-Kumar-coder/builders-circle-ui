'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, CheckCircle, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Agreement {
  id: string;
  version: string;
  title: string;
  content: string;
}

interface AgreementModalProps {
  agreement: Agreement;
  onAccepted: () => void;
}

export default function AgreementModal({ agreement, onAccepted }: AgreementModalProps) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // If content is short enough to not need scrolling, mark as scrolled
    if (el.scrollHeight <= el.clientHeight) setScrolledToBottom(true);
  }, []);

  function handleScroll() {
    const el = contentRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    if (atBottom) setScrolledToBottom(true);
  }

  async function handleAccept() {
    if (!checked || !scrolledToBottom) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.acceptAgreement(agreement.id);
      onAccepted();
    } catch {
      setError('Failed to record acceptance. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-800 flex-shrink-0">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-100">Agreement Update Required</h2>
            <p className="text-xs text-gray-500 mt-0.5">Version {agreement.version} · You must accept to continue</p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full font-medium">
            Action Required
          </span>
        </div>

        {/* Agreement title */}
        <div className="px-6 pt-4 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-200">{agreement.title}</h3>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
        >
          <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
            {agreement.content}
          </div>
        </div>

        {/* Scroll hint */}
        {!scrolledToBottom && (
          <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 flex-shrink-0">
            <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
            Scroll to read the full agreement
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 space-y-4 flex-shrink-0">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Checkbox */}
          <label className={`flex items-start gap-3 cursor-pointer group ${!scrolledToBottom ? 'opacity-40 pointer-events-none' : ''}`}>
            <div
              onClick={() => scrolledToBottom && setChecked(v => !v)}
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600 group-hover:border-indigo-500'
              }`}
            >
              {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm text-gray-300">
              I have read and agree to the terms of this agreement (version {agreement.version})
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!checked || !scrolledToBottom || loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors text-sm"
          >
            {loading ? 'Recording acceptance...' : 'Accept & Continue'}
          </button>

          <p className="text-xs text-gray-600 text-center">
            Your acceptance is recorded with timestamp, IP address, and device info for compliance purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
