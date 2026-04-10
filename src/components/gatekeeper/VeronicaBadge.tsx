import { CheckCircle, AlertTriangle, Clock, XCircle, Shield } from 'lucide-react';

interface Props {
  status: string;
  score?: number | null;
}

const CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  VALID:        { label: 'Valid',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
  NEEDS_REVIEW: { label: 'Needs Review', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   icon: AlertTriangle },
  FLAGGED:      { label: 'Flagged',      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',       icon: XCircle },
  PENDING:      { label: 'Pending',      color: 'text-gray-400',    bg: 'bg-gray-500/10 border-gray-500/20',     icon: Clock },
  APPROVED:     { label: 'Approved',     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
  REJECTED:     { label: 'Rejected',     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',       icon: XCircle },
  SENT_BACK:    { label: 'Sent Back',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   icon: AlertTriangle },
};

export default function VeronicaBadge({ status, score }: Props) {
  const cfg = CONFIG[status] ?? CONFIG['PENDING'];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
      {score != null && (
        <span className="opacity-60 ml-0.5">{Math.round(score * 100)}%</span>
      )}
    </div>
  );
}
