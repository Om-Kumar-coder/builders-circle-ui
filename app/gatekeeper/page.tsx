'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../../src/components/layout/MainLayout';
import { apiClient } from '../../src/lib/api-client';
import { Shield, Users, FileCheck, RotateCcw, BarChart2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface QueueCounts {
  new_users: number;
  submissions: number;
  returned: number;
}

export default function GatekeeperDashboard() {
  const [queues, setQueues] = useState<QueueCounts>({ new_users: 0, submissions: 0, returned: 0 });
  const [loading, setLoading] = useState(true);

  const fetchQueues = useCallback(async () => {
    try {
      const res = await apiClient.getGatekeeperQueues();
      if (res.success) setQueues(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueues(); }, [fetchQueues]);

  const cards = [
    {
      title: 'User Intake',
      description: 'Review new signups and applications',
      icon: Users,
      count: queues.new_users,
      href: '/gatekeeper/intake',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Submission Pre-Check',
      description: 'Pre-screen activity submissions before admin review',
      icon: FileCheck,
      count: queues.submissions,
      href: '/gatekeeper/submissions',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      title: 'Returned / Corrections',
      description: 'Items sent back for more information',
      icon: RotateCcw,
      count: queues.returned,
      href: '/gatekeeper/returned',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Daily Reports',
      description: 'Auto-generated system activity summaries',
      icon: BarChart2,
      count: null,
      href: '/gatekeeper/reports',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Veronica</h1>
              <p className="text-gray-400 text-sm">Gatekeeper System — Phi-3 Mini powered</p>
            </div>
          </div>
          <button
            onClick={fetchQueues}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Queue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href}>
                <div className={`p-6 rounded-xl border ${card.bg} hover:opacity-90 transition-opacity cursor-pointer`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${card.color}`} />
                      <div>
                        <h3 className="text-white font-semibold">{card.title}</h3>
                        <p className="text-gray-400 text-sm mt-0.5">{card.description}</p>
                      </div>
                    </div>
                    {card.count !== null && (
                      <span className={`text-2xl font-bold ${card.color}`}>
                        {loading ? '—' : card.count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Flow diagram */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">System Flow</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
            {[
              'User Signup',
              '→',
              'Veronica Pre-Check',
              '→',
              'Gatekeeper Review',
              '→',
              'Approve / Reject / Send Back',
              '→',
              'Admin Final Verification',
            ].map((step, i) => (
              <span
                key={i}
                className={step === '→' ? 'text-gray-600' : 'px-3 py-1 bg-gray-700 rounded-full text-gray-300'}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
