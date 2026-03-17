'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ExportButtonProps {
  type: 'ownership' | 'admin' | 'security' | 'participation';
  format?: 'csv' | 'json';
  targetUserId?: string;
  disabled?: boolean;
  label?: string;
}

export default function ExportButton({ type, format = 'csv', targetUserId, disabled, label }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      if (type === 'ownership') {
        await apiClient.downloadOwnershipExport({ format, targetUserId });
      } else {
        await apiClient.downloadLogsExport({ type, format, targetUserId });
      }
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || loading}
      title={disabled ? 'Export not available for view-only users' : `Export ${type} as ${format.toUpperCase()}`}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {label ?? `Export ${format.toUpperCase()}`}
    </button>
  );
}
