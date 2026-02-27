import { databases } from './appwrite';
import { ID, Query, Models } from 'appwrite';

export interface ActivityEvent extends Models.Document {
  userId: string;
  cycleId: string;
  activityType: string;
  proofLink: string;
  description?: string;
  verified: string; // 'pending' | 'verified' | 'rejected'
}

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '';
const ACTIVITY_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID || '';
const PARTICIPATION_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID || '';

// Cooldown tracking (in-memory, resets on page reload)
const lastSubmissionTime = new Map<string, number>();
const COOLDOWN_MS = 30000; // 30 seconds

/**
 * Submit a new activity event
 */
export async function submitActivity(
  userId: string,
  cycleId: string,
  activityType: string,
  proofLink: string,
  description?: string
): Promise<{ success: boolean; activity?: ActivityEvent; error?: string }> {
  try {
    // Validate inputs
    if (!proofLink.trim()) {
      return { success: false, error: 'Proof link is required' };
    }

    // Check cooldown
    const cooldownKey = `${userId}-${cycleId}`;
    const lastSubmission = lastSubmissionTime.get(cooldownKey);
    const now = Date.now();
    
    if (lastSubmission && now - lastSubmission < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastSubmission)) / 1000);
      return { 
        success: false, 
        error: `Please wait ${remainingSeconds} seconds before submitting again` 
      };
    }

    // Create activity document
    const activity = await databases.createDocument(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        cycleId,
        activityType,
        proofLink: proofLink.trim(),
        description: description?.trim() || '',
        verified: 'pending',
      }
    );

    // Update participation record
    await updateParticipationActivity(userId, cycleId);

    // Update cooldown
    lastSubmissionTime.set(cooldownKey, now);

    return {
      success: true,
      activity: activity as ActivityEvent,
    };
  } catch (error: any) {
    console.error('Error submitting activity:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit activity',
    };
  }
}

/**
 * Update participation record with latest activity timestamp
 */
export async function updateParticipationActivity(
  userId: string,
  cycleId: string
): Promise<void> {
  try {
    // Find participation record
    const response = await databases.listDocuments(
      DATABASE_ID,
      PARTICIPATION_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('cycleId', cycleId),
        Query.limit(1),
      ]
    );

    if (response.documents.length === 0) {
      throw new Error('Participation record not found');
    }

    const participation = response.documents[0];

    // Update with current timestamp and reset stall stage
    await databases.updateDocument(
      DATABASE_ID,
      PARTICIPATION_COLLECTION_ID,
      participation.$id,
      {
        lastActivityDate: new Date().toISOString(),
        participationStatus: 'active',
        stallStage: 'none',
      }
    );
  } catch (error) {
    console.error('Error updating participation activity:', error);
    throw error;
  }
}

/**
 * Get all activities for a user in a specific cycle
 */
export async function getUserCycleActivity(
  userId: string,
  cycleId: string
): Promise<ActivityEvent[]> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('cycleId', cycleId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]
    );

    return response.documents as ActivityEvent[];
  } catch (error) {
    console.error('Error fetching user cycle activity:', error);
    return [];
  }
}

/**
 * Get all activities for a cycle (for admins/timeline)
 */
export async function getCycleActivity(cycleId: string): Promise<ActivityEvent[]> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      [
        Query.equal('cycleId', cycleId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]
    );

    return response.documents as ActivityEvent[];
  } catch (error) {
    console.error('Error fetching cycle activity:', error);
    return [];
  }
}

/**
 * Get last activity for a user across all cycles
 */
export async function getLastActivity(userId: string): Promise<ActivityEvent | null> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ]
    );

    if (response.documents.length > 0) {
      return response.documents[0] as ActivityEvent;
    }
    return null;
  } catch (error) {
    console.error('Error fetching last activity:', error);
    return null;
  }
}

/**
 * Get activity count for a user in a cycle
 */
export async function getActivityCount(
  userId: string,
  cycleId: string
): Promise<number> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      ACTIVITY_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('cycleId', cycleId),
      ]
    );

    return response.total;
  } catch (error) {
    console.error('Error fetching activity count:', error);
    return 0;
  }
}
