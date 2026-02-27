'use client';

import type { ParticipationRecord } from '@/lib/participation';

interface StallStageIndicatorProps {
  participation: ParticipationRecord;
  showDetails?: boolean;
}

const STALL_STAGE_CONFIG = {
  none: {
    label: 'Active',
    color: 'text-green-400',
    bg: 'bg-green-900/20',
    border: 'border-green-800/50',
    icon: '✓',
    description: 'Recent activity submitted',
  },
  active: {
    label: 'Active',
    color: 'text-green-400',
    bg: 'bg-green-900/20',
    border: 'border-green-800/50',
    icon: '✓',
    description: '0-6 days since last activity',
  },
  grace: {
    label: 'Grace Period',
    color: 'text-blue-400',
    bg: 'bg-blue-900/20',
    border: 'border-blue-800/50',
    icon: '⏳',
    description: 'No activity yet - grace period active',
  },
  at_risk: {
    label: 'At Risk',
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-800/50',
    icon: '⚠',
    description: '7-13 days since last activity',
  },
  diminishing: {
    label: 'Diminishing',
    color: 'text-orange-400',
    bg: 'bg-orange-900/20',
    border: 'border-orange-800/50',
    icon: '⚠',
    description: '14-20 days since last activity',
  },
  paused: {
    label: 'Paused',
    color: 'text-red-400',
    bg: 'bg-red-900/20',
    border: 'border-red-800/50',
    icon: '⏸',
    description: '21+ days since last activity',
  },
};

export default function StallStageIndicator({ participation, showDetails = false }: StallStageIndicatorProps) {
  const stallStage = participation.stallStage || 'grace';
  const config = STALL_STAGE_CONFIG[stallStage as keyof typeof STALL_STAGE_CONFIG] || STALL_STAGE_CONFIG.grace;

  const calculateDaysInactive = () => {
    if (!participation.lastActivityDate) return null;
    
    const now = new Date();
    const lastActivity = new Date(participation.lastActivityDate);
    const diffTime = Math.abs(now.getTime() - lastActivity.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysInactive = calculateDaysInactive();

  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.border} border`}>
        <span className="text-lg">{config.icon}</span>
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`text-lg font-semibold ${config.color}`}>{config.label}</h3>
            {daysInactive !== null && (
              <span className="text-sm text-gray-400">
                ({daysInactive} {daysInactive === 1 ? 'day' : 'days'} inactive)
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mb-3">{config.description}</p>
          
          {/* Progress bar showing time until next stage */}
          {stallStage !== 'paused' && daysInactive !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Current Stage</span>
                <span>Next Stage</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stallStage === 'active' ? 'bg-green-500' :
                    stallStage === 'at_risk' ? 'bg-yellow-500' :
                    stallStage === 'diminishing' ? 'bg-orange-500' :
                    'bg-gray-500'
                  }`}
                  style={{
                    width: `${
                      stallStage === 'active' ? (daysInactive / 6) * 100 :
                      stallStage === 'at_risk' ? ((daysInactive - 6) / 7) * 100 :
                      stallStage === 'diminishing' ? ((daysInactive - 13) / 7) * 100 :
                      0
                    }%`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {stallStage === 'active' ? `${6 - daysInactive} days until At Risk` :
                   stallStage === 'at_risk' ? `${13 - daysInactive} days until Diminishing` :
                   stallStage === 'diminishing' ? `${20 - daysInactive} days until Paused` :
                   'Submit activity to reset'}
                </span>
              </div>
            </div>
          )}

          {stallStage === 'paused' && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              Submit activity to resume participation
            </div>
          )}

          {stallStage === 'grace' && (
            <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400">
              Submit your first activity to start tracking
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
