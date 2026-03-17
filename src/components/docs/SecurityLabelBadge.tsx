import type { SecurityLabel } from '@/types/docs';

const CONFIG: Record<SecurityLabel, { label: string; className: string }> = {
  internal:     { label: 'Internal',     className: 'bg-blue-900/40 text-blue-300 border border-blue-700' },
  restricted:   { label: 'Restricted',   className: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700' },
  confidential: { label: 'Confidential', className: 'bg-red-900/40 text-red-300 border border-red-700' },
};

export default function SecurityLabelBadge({ label }: { label: SecurityLabel }) {
  const cfg = CONFIG[label] ?? CONFIG.internal;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
