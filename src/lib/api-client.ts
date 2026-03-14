/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API Client for Builder's Circle Backend
 * Replaces Appwrite functionality with REST API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private getAuthHeaders(): HeadersInit {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        'Content-Type': 'application/json',
      };
    }
    
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log('🌐 API Request:', {
      method: options.method || 'GET',
      url,
      hasBody: !!options.body
    });
    
    try {
      const response = await fetch(url, {
        ...options,
        mode: 'cors',
        credentials: 'include',
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = {};
      }      
      console.log('📥 API Response:', {
        status: response.status,
        ok: response.ok,
        data: responseData
      });

      if (!response.ok) {
        let errorMessage = 'Request failed';
        
        if (response.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (response.status === 401) {
          errorMessage = 'Authentication required';
        } else if (response.status === 403) {
          errorMessage = 'Access denied';
        } else if (response.status === 404) {
          errorMessage = 'Resource not found';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        throw new ApiError(response.status, errorMessage);
      }

      // Handle standardized success format
      if (responseData.success !== undefined) {
        if (responseData.success) {
          return responseData.data;
        } else {
          throw new ApiError(400, responseData.error || 'Request failed');
        }
      }

      return responseData;
    } catch (error) {
      if (error instanceof ApiError) {
        // Retry on server errors (5xx) and network errors, but not on client errors (4xx)
        const isRetryable = error.status === 0 || error.status >= 500;
        if (isRetryable && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * (3 - retries)));
          return this.request<T>(endpoint, options, retries - 1);
        }
        throw error;
      }
      
      console.error('🚨 API Request failed:', error);
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw new ApiError(0, 'Network error. Please check your connection.');
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<any> {
    const response = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
  }

  async signup(name: string, email: string, password: string): Promise<any> {
    return this.request<any>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request<void>('/auth/logout', {
        method: 'POST',
      });
    } finally {
      localStorage.removeItem('auth_token');
    }
  }

  async getCurrentUser(): Promise<any> {
    return this.request<any>('/auth/me');
  }

  // Cycle methods
  async getCycles(): Promise<any[]> {
    return this.request<any[]>('/cycles');
  }

  async getCycle(cycleId: string): Promise<any> {
    return this.request<any>(`/cycles/${cycleId}`);
  }

  async createCycle(cycleData: any): Promise<any> {
    return this.request<any>('/cycles', {
      method: 'POST',
      body: JSON.stringify(cycleData),
    });
  }

  async updateCycle(cycleId: string, data: { state?: string; name?: string; description?: string }): Promise<any> {
    return this.request<any>(`/cycles/${cycleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCycle(cycleId: string): Promise<void> {
    return this.request<void>(`/cycles/${cycleId}`, { method: 'DELETE' });
  }

  // Activity methods
  async getActivities(params?: { cycleId?: string; userId?: string } | string): Promise<any[]> {
    // Support both legacy string cycleId and new object params
    if (typeof params === 'string') {
      return this.request<any[]>(`/activities?cycleId=${params}`);
    }
    if (!params) {
      return this.request<any[]>('/activities');
    }
    const query = new URLSearchParams();
    if (params.cycleId) query.set('cycleId', params.cycleId);
    if (params.userId) query.set('userId', params.userId);
    const qs = query.toString();
    return this.request<any[]>(qs ? `/activities?${qs}` : '/activities');
  }

  async createActivity(data: any): Promise<any> {
    return this.request<any>('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitActivity(activityData: any): Promise<any> {
    return this.createActivity(activityData);
  }

  async approveActivity(activityId: string, feedback?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.request<{ success: boolean; data?: any; error?: string }>(`/activities/${activityId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'verified', feedbackComment: feedback }),
    });
  }

  async rejectActivity(activityId: string, reason?: string, feedback?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.request<{ success: boolean; data?: any; error?: string }>(`/activities/${activityId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejectionReason: reason, feedbackComment: feedback }),
    });
  }

  async requestActivityChanges(activityId: string, reason?: string, feedback?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.request<{ success: boolean; data?: any; error?: string }>(`/activities/${activityId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'changes_requested', rejectionReason: reason, feedbackComment: feedback }),
    });
  }

  async verifyActivity(activityId: string, verificationData: any): Promise<any> {
    return this.request<any>(`/activities/${activityId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify(verificationData),
    });
  }

  async getPendingActivities(): Promise<any[]> {
    return this.request<any[]>('/activities/pending');
  }

  async getTopContributors(limit = 5): Promise<any[]> {
    return this.request<any[]>(`/analytics/contributors?limit=${limit}`);
  }

  // Participation methods
  async joinCycle(cycleId: string): Promise<any> {
    return this.request<any>('/participation/join', {
      method: 'POST',
      body: JSON.stringify({ cycleId }),
    });
  }

  async getParticipation(cycleId: string): Promise<any> {
    return this.request<any>(`/participation/${cycleId}`);
  }

  async getUserParticipations(userId: string): Promise<any[]> {
    return this.request<any[]>(`/participation/user/${userId}`);
  }

  // Ownership methods
  async getOwnership(userId: string, cycleId: string): Promise<any> {
    return this.request<any>(`/ownership/${userId}/${cycleId}`);
  }

  async getOwnershipSummary(): Promise<any> {
    return this.request<any>('/ownership/summary');
  }

  // Analytics methods
  async getDashboardAnalytics(cycleId?: string): Promise<any> {
    const endpoint = cycleId ? `/analytics/dashboard?cycleId=${cycleId}` : '/analytics/dashboard';
    return this.request<any>(endpoint);
  }

  async getUserReputation(userId: string): Promise<any> {
    return this.request<any>(`/analytics/reputation/${userId}`);
  }

  async getCycleEngagement(cycleId: string): Promise<any> {
    return this.request<any>(`/analytics/engagement/${cycleId}`);
  }

  async getCycleAnalytics(cycleId: string): Promise<any> {
    return this.request<any>(`/analytics/cycle/${cycleId}`);
  }

  // Team methods
  async getTeamMembers(cycleId: string): Promise<any[]> {
    return this.request<any[]>(`/participation/${cycleId}/all`);
  }

  // Notification methods
  async getNotifications(): Promise<any[]> {
    return this.request<any[]>('/notifications');
  }

  async markNotificationRead(notificationId: string): Promise<any> {
    return this.request<any>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request<any>('/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/notifications/unread-count');
  }

  async getNotificationPreferences(): Promise<{ stallWarnings: boolean; activityReminders: boolean; cycleUpdates: boolean }> {
    return this.request('/notifications/preferences');
  }

  async updateNotificationPreferences(prefs: { stallWarnings: boolean; activityReminders: boolean; cycleUpdates: boolean }): Promise<void> {
    return this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  }

  // Contribution weight methods
  async getContributionWeights(): Promise<any[]> {
    return this.request<any[]>('/weights');
  }

  async updateContributionWeight(contributionType: string, weight: number, description?: string): Promise<any> {
    return this.request<any>(`/weights/${contributionType}`, {
      method: 'PATCH',
      body: JSON.stringify({ weight, description }),
    });
  }

  async resetContributionWeights(): Promise<any[]> {
    return this.request<any[]>('/weights/reset', {
      method: 'POST',
    });
  }

  // Accountability status
  async getAccountabilityStatus(): Promise<any> {
    return this.request<any>('/admin/accountability/status');
  }

  // Manual job execution shortcuts
  async runStallEvaluator(): Promise<{ success?: boolean; message?: string; error?: string }> {
    return this.executeManualJob('stall-evaluator');
  }

  async runMultiplierAdjustment(): Promise<{ success?: boolean; message?: string; error?: string }> {
    return this.executeManualJob('multiplier-adjustment');
  }

  async runOwnershipDecay(): Promise<{ success?: boolean; message?: string; error?: string }> {
    return this.executeManualJob('ownership-decay');
  }

  async runCycleFinalizer(): Promise<{ success?: boolean; message?: string; error?: string }> {
    return this.executeManualJob('cycle-finalizer');
  }

  // Admin methods
  async getAuditLogs(): Promise<any[]> {
    return this.request<any[]>('/admin/audit');
  }

  async resolveDispute(disputeId: string, status: 'approved' | 'denied', resolution: string): Promise<any> {
    return this.request<any>('/admin/resolve-dispute', {
      method: 'POST',
      body: JSON.stringify({ disputeId, status, resolution }),
    });
  }

  async getDisputes(): Promise<any[]> {
    return this.request<any[]>('/admin/disputes');
  }

  async getAdminUsers(): Promise<any[]> {
    return this.request<any[]>('/admin/users');
  }

  async updateUserRole(userId: string, role: string): Promise<any> {
    return this.request<any>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  // Admin override methods
  async overrideOwnership(userId: string, cycleId: string, ownershipAmount: number, reason: string): Promise<any> {
    return this.request<any>('/admin/override/ownership', {
      method: 'POST',
      body: JSON.stringify({ userId, cycleId, ownershipAmount, reason }),
    });
  }

  async overrideMultiplier(userId: string, cycleId: string, multiplier: number, reason: string): Promise<any> {
    return this.request<any>('/admin/override/multiplier', {
      method: 'POST',
      body: JSON.stringify({ userId, cycleId, multiplier, reason }),
    });
  }

  async clearStallStatus(userId: string, cycleId: string, reason: string): Promise<any> {
    return this.request<any>('/admin/override/stall-clear', {
      method: 'POST',
      body: JSON.stringify({ userId, cycleId, reason }),
    });
  }

  // Manual job execution
  async executeManualJob(jobId: string): Promise<{ success?: boolean; message?: string; error?: string }> {
    const data = await this.request<{ message?: string }>('/admin/jobs/execute', {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    });
    return { success: true, message: data?.message };
  }

  // Messaging methods
  getCycleMessagesStreamUrl(cycleId: string): string {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return `${API_BASE_URL}/messages/cycle/${cycleId}/stream?token=${token ?? ''}`;
  }

  async getCycleMessages(cycleId: string): Promise<any[]> {
    return this.request<any[]>(`/messages/cycle/${cycleId}`);
  }

  async sendMessage(cycleId: string, message: string, mentions: string[] = []): Promise<any> {
    return this.request<any>('/messages', {
      method: 'POST',
      body: JSON.stringify({ cycleId, message, mentions }),
    });
  }

  async editMessage(messageId: string, message: string): Promise<any> {
    return this.request<any>(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ message }),
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.request<void>(`/messages/${messageId}`, { method: 'DELETE' });
  }

  async markMessageRead(messageId: string): Promise<void> {
    return this.request<void>(`/messages/${messageId}/read`, { method: 'POST' });
  }

  async getUnreadMessageCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/messages/unread-count');
  }

  async getMyMentions(): Promise<any[]> {
    return this.request<any[]>('/messages/mentions');
  }

  // Session tracking methods
  async startSession(page: string): Promise<any> {
    return this.request<any>('/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ pageVisited: page }),
    });
  }

  async sendHeartbeat(page: string): Promise<any> {
    return this.request<any>('/sessions/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ pageVisited: page }),
    });
  }

  async endSession(): Promise<any> {
    return this.request<any>('/sessions/end', {
      method: 'POST',
    });
  }

  async getSessionAnalytics(days = 30): Promise<any> {
    return this.request<any>(`/sessions/analytics?days=${days}`);
  }

  // Dispute methods
  async createDispute(activityId: string, reason: string): Promise<any> {
    return this.request<any>(`/activities/${activityId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Email verification methods
  async verifyEmail(token: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerificationEmail(email: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

export const apiClient = new ApiClient();
export { ApiError };