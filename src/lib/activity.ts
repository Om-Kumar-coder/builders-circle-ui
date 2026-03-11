import { apiClient } from './api-client';

export interface ActivityEvent {
  id: string;
  userId: string;
  cycleId: string;
  activityType: string;
  proofLink: string;
  description?: string;
  verified: 'pending' | 'verified' | 'rejected';
  contributionType: 'code' | 'documentation' | 'review' | 'hours_logged';
  contributionWeight: number;
  calculatedOwnership: number;
  createdAt: string;
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
}

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
  description?: string,
  contributionType: 'code' | 'documentation' | 'review' | 'hours_logged' = 'code',
  contributionWeight: number = 1.0
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

    // Create activity
    const activity = await apiClient.createActivity({
      cycleId,
      activityType,
      proofLink: proofLink.trim(),
      description: description?.trim(),
      contributionType,
      contributionWeight,
    });

    // Update cooldown
    lastSubmissionTime.set(cooldownKey, now);

    return {
      success: true,
      activity,
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
 * Get all activities for a user in a specific cycle
 */
export async function getUserCycleActivity(
  userId: string,
  cycleId: string
): Promise<ActivityEvent[]> {
  try {
    return await apiClient.getActivities({ userId, cycleId });
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
    return await apiClient.getActivities({ cycleId });
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
    const activities = await apiClient.getActivities({ userId });
    const sortedActivities = activities.sort((a: ActivityEvent, b: ActivityEvent) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sortedActivities[0] || null;
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
    const activities = await apiClient.getActivities({ userId, cycleId });
    return activities.length;
  } catch (error) {
    console.error('Error fetching activity count:', error);
    return 0;
  }
}
