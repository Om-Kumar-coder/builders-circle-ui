const STYLES = {
  PENDING: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',
  APPROVED: 'bg-green-900/30 text-green-400 border-green-800/40',
  REJECTED: 'bg-red-900/30 text-red-400 border-red-800/40',
};

export default function IdeaStatusBadge({ status }: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${STYLES[status]}`}>
      {status}
    </span>
  );
}
