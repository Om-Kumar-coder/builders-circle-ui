import { databases } from './appwrite';
import { ID, Query, Models } from 'appwrite';

export interface ParticipationRecord extends Models.Document {
  userId: string;
  cycleId: string;
  optedIn: boolean;
  participationStatus: 'active' | 'at-risk' | 'paused' | 'grace';
  stallStage: 'grace' | 'yellow' | 'orange' | 'red' | 'none';
  lastActivityDate: string | null;
  createdAt: string;
}

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
const PARTICIPATION_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID || '';

/**
 * Get participation record for a user in a specific cycle
 */
export async function getParticipation(
  userId: string,
  cycleId: string
): Promise<ParticipationRecord | null> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      PARTICIPATION_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('cycleId', cycleId),
        Query.limit(1),
      ]
    );

    if (response.documents.length > 0) {
      return response.documents[0] as ParticipationRecord;
    }
    return null;
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
    // Check if already participating
    const existing = await getParticipation(userId, cycleId);
    if (existing) {
      return {
        success: true,
        participation: existing,
      };
    }

    // Create new participation record
    const now = new Date().toISOString();
    const participation = await databases.createDocument(
      DATABASE_ID,
      PARTICIPATION_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        cycleId,
        optedIn: true,
        participationStatus: 'grace',
        stallStage: 'grace',
        lastActivityDate: null,
        createdAt: now,
      }
    );

    return {
      success: true,
      participation: participation as ParticipationRecord,
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
    const response = await databases.listDocuments(
      DATABASE_ID,
      PARTICIPATION_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('optedIn', true),
        Query.orderDesc('$createdAt'),
      ]
    );

    return response.documents as ParticipationRecord[];
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
    const response = await databases.listDocuments(
      DATABASE_ID,
      PARTICIPATION_COLLECTION_ID,
      [
        Query.equal('cycleId', cycleId),
        Query.equal('optedIn', true),
        Query.orderDesc('$createdAt'),
      ]
    );

    return response.documents as ParticipationRecord[];
  } catch (error) {
    console.error('Error fetching cycle participants:', error);
    return [];
  }
}
