'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function GroupBadge() {
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getMyGroup()
      .then((g: { name?: string } | null) => setGroupName(g?.name ?? null))
      .catch(() => null);
  }, []);

  if (!groupName) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-900/30 text-teal-400 border border-teal-800/40">
      <Users size={11} />
      {groupName}
    </span>
  );
}
