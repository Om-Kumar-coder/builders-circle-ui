import { apiClient } from './api-client';

export interface ParticipationRecord {
  id: string;
  userId: string;
  cycleId: string;
  optedIn: boolean;
  participationStatus: 'active' | 'at-risk' | 'paused' | 'grace';
  stallStage: 'none' | 'grace' | 'active' | 'at_risk' | 'diminishing' | 'paused';
  lastActivityDate: string | null;
  createdAt: string;
  cycle?: {
    id: string;
    name: string;
    state: string;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Get participation record for a user in a specific cycle
 */
export async function getParticipation(
  userId: string,
  cycleId: string
): Promise<ParticipationRecord | null> {
  try {
    const participation = await apiClient.getParticipation(cycleId);
    return participation;
  } catch (error) {
    console.error('Error fetching participation:', error);
    return null;
  }
}

/**
 * Join a build cycle - creates participation record
 */
export async function joinCycle(
  userId: string,
  cycleId: string
): Promise<{ success: boolean; participation?: ParticipationRecord; error?: string }> {
  try {
    const participation = await apiClient.joinCycle(cycleId);
    return {
      success: true,
      participation,
    };
  } catch (error: any) {
    console.error('Error joining cycle:', error);
    return {
      success: false,
      error: error.message || 'Failed to join cycle',
    };
  }
}

/**
 * Get all cycles a user is participating in
 */
export async function getUserParticipatingCycles(
  userId: string
): Promise<ParticipationRecord[]> {
  try {
    // This would need to be implemented in the backend
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error fetching user participations:', error);
    return [];
  }
}

/**
 * Get participation status summary for a user
 */
export async function getParticipationStatus(userId: string): Promise<{
  activeCount: number;
  atRiskCount: number;
  graceCount: number;
  participations: ParticipationRecord[];
}> {
  try {
    const participations = await getUserParticipatingCycles(userId);

    const activeCount = participations.filter(
      (p) => p.participationStatus === 'active'
    ).length;
    const atRiskCount = participations.filter(
      (p) => p.participationStatus === 'at-risk'
    ).length;
    const graceCount = participations.filter(
      (p) => p.participationStatus === 'grace'
    ).length;

    return {
      activeCount,
      atRiskCount,
      graceCount,
      participations,
    };
  } catch (error) {
    console.error('Error fetching participation status:', error);
    return {
      activeCount: 0,
      atRiskCount: 0,
      graceCount: 0,
      participations: [],
    };
  }
}

/**
 * Get all participants for a specific cycle
 */
export async function getCycleParticipants(
  cycleId: string
): Promise<ParticipationRecord[]> {
  try {
    // This would need to be implemented in the backend
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error fetching cycle participants:', error);
    return [];
  }
}