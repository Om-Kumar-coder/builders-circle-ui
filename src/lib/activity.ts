import { apiClient } from './api-client';
import { ActivityEvent, ActivitySubmission, ACTIVITY_LIMITS } from '@/types/activity';

// Cooldown tracking (in-memory, resets on page reload)
const lastSubmissionTime = new Map<string, number>();
const COOLDOWN_MS = ACTIVITY_LIMITS.COOLDOWN_MINUTES * 60 * 1000;

/**
 * Submit a new activity event
 */
export async function submitActivity(
  userId: string,
  submission: ActivitySubmission
): Promise<{ success: boolean; activity?: ActivityEvent; error?: string }> {
  try {
    console.log('📝 Activity submission started:', {
      userId,
      submission
    });

    // Validate inputs
    if (!submission.proofLink.trim()) {
      console.log('❌ Validation failed: Empty proof link');
      return { success: false, error: 'Proof link is required' };
    }

    // Validate hours if provided
    if (submission.hoursLogged !== undefined) {
      if (submission.hoursLogged <= 0 || submission.hoursLogged > ACTIVITY_LIMITS.MAX_HOURS_PER_DAY) {
        return { 
          success: false, 
          error: `Hours must be between 0.1 and ${ACTIVITY_LIMITS.MAX_HOURS_PER_DAY}` 
        };
      }
    }

    // Check cooldown
    const cooldownKey = `${userId}-${submission.cycleId}`;
    const lastSubmission = lastSubmissionTime.get(cooldownKey);
    const now = Date.now();
    
    if (lastSubmission && now - lastSubmission < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastSubmission)) / 1000);
      console.log('⏰ Cooldown active:', { remainingSeconds });
      return { 
        success: false, 
        error: `Please wait ${remainingSeconds} seconds before submitting again` 
      };
    }

    console.log('🚀 Calling API to create activity...');

    // Create activity
    const activity = await apiClient.createActivity(submission);

    // Update cooldown
    lastSubmissionTime.set(cooldownKey, now);

    console.log('✅ Activity created successfully:', activity);

    return {
      success: true,
      activity,
    };
  } catch (error: unknown) {
    console.error('💥 Activity submission error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit activity',
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
 * Get pending activities for admin review
 */
export async function getPendingActivities(): Promise<ActivityEvent[]> {
  try {
    return await apiClient.getPendingActivities();
  } catch (error) {
    console.error('Error fetching pending activities:', error);
    return [];
  }
}

/**
 * Verify an activity (admin only)
 */
export async function verifyActivity(
  activityId: string,
  status: 'verified' | 'rejected' | 'changes_requested',
  rejectionReason?: string,
  calculatedOwnership?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiClient.verifyActivity(activityId, {
      status,
      rejectionReason,
      calculatedOwnership,
    });
    return { success: true };
  } catch (error: unknown) {
    console.error('Error verifying activity:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to verify activity' };
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

/**
 * Get work hours summary for a user in a cycle
 */
export async function getWorkHoursSummary(
  userId: string,
  cycleId: string
): Promise<{
  totalHours: number;
  verifiedHours: number;
  pendingHours: number;
  rejectedHours: number;
}> {
  try {
    const activities = await apiClient.getActivities({ userId, cycleId });
    
    const summary = activities.reduce((acc, activity) => {
      const hours = activity.hoursLogged || 0;
      acc.totalHours += hours;
      
      switch (activity.status) {
        case 'verified':
          acc.verifiedHours += hours;
          break;
        case 'pending':
        case 'changes_requested':
          acc.pendingHours += hours;
          break;
        case 'rejected':
          acc.rejectedHours += hours;
          break;
      }
      
      return acc;
    }, {
      totalHours: 0,
      verifiedHours: 0,
      pendingHours: 0,
      rejectedHours: 0,
    });

    return summary;
  } catch (error) {
    console.error('Error fetching work hours summary:', error);
    return {
      totalHours: 0,
      verifiedHours: 0,
      pendingHours: 0,
      rejectedHours: 0,
    };
  }
}
