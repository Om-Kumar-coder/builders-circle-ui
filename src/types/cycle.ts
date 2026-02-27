import { Models } from 'appwrite';

export type CycleState = 'planned' | 'active' | 'paused' | 'closed';

export interface BuildCycle extends Models.Document {
  name: string;
  state: CycleState;
  startDate: string;
  endDate: string;
  participantCount?: number; // Optional since it might not be in the schema yet
  // Appwrite provides these with $ prefix
  $createdAt: string;
  $updatedAt: string;
}

export interface CycleParticipation extends Models.Document {
  cycleId: string;
  userId: string;
  userName: string;
  lastActivity: string;
  stallStage: string;
  isActive: boolean;
  joinedAt: string;
}
