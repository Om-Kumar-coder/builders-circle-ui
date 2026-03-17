'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const RULES = [
  {
    icon: '📋',
    title: 'Submit activity regularly',
    desc: 'Log your contributions each cycle to maintain active status and protect your ownership stake.',
  },
  {
    icon: '⚡',
    title: 'Multiplier affects earnings',
    desc: 'Your activity multiplier scales your effective ownership. Consistent contributions keep it high.',
  },
  {
    icon: '⏸️',
    title: 'Inactivity triggers stall stages',
    desc: 'Missing activity moves you through Grace → At Risk → Diminishing → Paused. Ownership decays when paused.',
  },
  {
    icon: '🔒',
    title: 'Vested ownership is permanent',
    desc: 'Once vested, ownership cannot be taken away. Provisional ownership vests at cycle completion.',
  },
  {
    icon: '🤝',
    title: 'Agreements are binding',
    desc: 'Signed agreements govern your participation terms. Review them in the Docs section.',
  },
];

export default function RulesBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-indigo-900/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-200">How this platform works</span>
          <span className="text-xs text-indigo-400/70 hidden sm:inline">· Participation rules &amp; ownership explained</span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-indigo-400" />
          : <ChevronDown className="w-4 h-4 text-indigo-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {RULES.map(rule => (
            <div key={rule.title} className="flex gap-3 p-3 bg-indigo-900/20 rounded-xl border border-indigo-800/30">
              <span className="text-lg leading-none mt-0.5">{rule.icon}</span>
              <div>
                <p className="text-sm font-medium text-indigo-200">{rule.title}</p>
                <p className="text-xs text-indigo-300/70 mt-0.5 leading-relaxed">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
