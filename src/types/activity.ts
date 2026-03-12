export type ActivityStatus = 'pending' | 'verified' | 'rejected' | 'changes_requested';

export type ActivityType = 
  | 'code' 
  | 'documentation' 
  | 'review' 
  | 'task_completion' 
  | 'hours_logged' 
  | 'meeting' 
  | 'research';

export interface ActivityEvent {
  id: string;
  userId: string;
  cycleId: string;
  activityType: string;
  proofLink: string;
  description?: string;
  hoursLogged?: number;
  workSummary?: string;
  taskReference?: string;
  status: ActivityStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  contributionType: ActivityType;
  contributionWeight: number;
  calculatedOwnership: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  cycle?: {
    id: string;
    name: string;
    state: string;
  };
  verifier?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ActivitySubmission {
  cycleId: string;
  activityType: string;
  proofLink: string;
  description?: string;
  hoursLogged?: number;
  workSummary?: string;
  taskReference?: string;
  contributionType: ActivityType;
  contributionWeight?: number;
}

export interface ActivityVerification {
  status: ActivityStatus;
  rejectionReason?: string;
  calculatedOwnership?: number;
}

// Contribution weights for different activity types
export const CONTRIBUTION_WEIGHTS: Record<ActivityType, number> = {
  code: 1.0,
  documentation: 0.6,
  review: 0.5,
  hours_logged: 0.4,
  research: 0.5,
  meeting: 0.2,
  task_completion: 0.8,
};

// Activity type labels for UI
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  code: 'Code Contribution',
  documentation: 'Documentation',
  review: 'Code Review',
  hours_logged: 'Hours Logged',
  research: 'Research',
  meeting: 'Meeting',
  task_completion: 'Task Completion',
};

// Status labels and colors for UI
export const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string; bgColor: string }> = {
  pending: {
    label: 'Pending Review',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900/20 border-yellow-800/50',
  },
  verified: {
    label: 'Verified',
    color: 'text-green-400',
    bgColor: 'bg-green-900/20 border-green-800/50',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    bgColor: 'bg-red-900/20 border-red-800/50',
  },
  changes_requested: {
    label: 'Changes Requested',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/20 border-orange-800/50',
  },
};

// Anti-abuse limits
export const ACTIVITY_LIMITS = {
  MAX_ACTIVITIES_PER_DAY: 10,
  MAX_HOURS_PER_DAY: 12,
  COOLDOWN_MINUTES: 1, // Minimum time between submissions
};