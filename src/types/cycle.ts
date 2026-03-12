export type CycleState = 'planned' | 'active' | 'paused' | 'closed';

export interface BuildCycle {
  id: string;
  name: string;
  description?: string; // Optional description
  state: CycleState;
  startDate: string;
  endDate: string;
  participantCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Legacy type - kept for backward compatibility
export interface CycleParticipation {
  id: string;
  cycleId: string;
  userId: string;
  userName: string;
  lastActivity: string;
  stallStage: string;
  isActive: boolean;
  joinedAt: string;
}
