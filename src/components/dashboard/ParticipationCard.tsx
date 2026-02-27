'use client';

import { Activity, Clock, AlertTriangle } from 'lucide-react';

type ParticipationStatus = 'Active' | 'At Risk' | 'Diminishing' | 'Paused';

interface ParticipationData {
  status: ParticipationStatus;
  lastActivity: string;
  nextThreshold: string;
}

interface ParticipationCardProps {
  data?: ParticipationData;
}

const statusConfig = {
  Active: {
    color: 'text-green-400',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-800/50',
    gradientFrom: 'from-green-900/20',
    gradientTo: 'to-emerald-900/20',
  },
  'At Risk': {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500',
    borderColor: 'border-yellow-800/50',
    gradientFrom: 'from-yellow-900/20',
    gradientTo: 'to-orange-900/20',
  },
  Diminishing: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-800/50',
    gradientFrom: 'from-orange-900/20',
    gradientTo: 'to-red-900/20',
  },
  Paused: {
    color: 'text-red-400',
    bgColor: 'bg-red-500',
    borderColor: 'border-red-800/50',
    gradientFrom: 'from-red-900/20',
    gradientTo: 'to-rose-900/20',
  },
};

export default function ParticipationCard({ data }: ParticipationCardProps) {
  const participationData = data || {
    status: 'At Risk' as ParticipationStatus,
    lastActivity: '9 days ago',
    nextThreshold: 'Diminishing in 4 days',
  };

  const config = statusConfig[participationData.status];

  return (
    <div
      className={`bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} 
        rounded-2xl p-6 border ${config.borderColor} 
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${config.bgColor} animate-pulse`} />
          <div>
            <p className="text-sm text-gray-400 font-medium">Participation Status</p>
            <p className={`text-2xl font-bold ${config.color} mt-1`}>
              {participationData.status}
            </p>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-gray-800/50">
          <Activity className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-3 text-sm">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400">Last activity:</span>
          <span className="text-gray-200 font-medium">{participationData.lastActivity}</span>
        </div>

        {participationData.status !== 'Active' && (
          <div className="flex items-start space-x-3 text-sm p-3 bg-gray-900/50 rounded-lg border border-gray-800">
            <AlertTriangle className={`w-4 h-4 ${config.color} mt-0.5 flex-shrink-0`} />
            <div>
              <span className="text-gray-400">Next threshold: </span>
              <span className={`${config.color} font-medium`}>
                {participationData.nextThreshold}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
