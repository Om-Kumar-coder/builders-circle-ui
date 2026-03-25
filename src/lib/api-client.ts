/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API Client for Builder's Circle Backend
 * Replaces Appwrite functionality with REST API calls
 */

import { handleTokenExpiry, onReAuthDismissed } from './auth-expiry-handler';
import { getStepUpToken } from './step-up';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private getStepUpHeaders(): HeadersInit {
    const token = getStepUpToken();
    return token ? { 'X-Step-Up-Token': token } : {};
  }

  private getAuthHeaders(): HeadersInit {
    // Try localStorage token first (cross-origin safe), fall back to cookie via credentials: 'include'
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return token
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
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

      if (!response.ok) {
        let errorMessage = 'Request failed';
        
        if (response.status === 401) {
          // Only trigger re-auth modal for authenticated API calls, not for
          // auth endpoints themselves (login, session check, signup, etc.)
          const isAuthEndpoint = endpoint.startsWith('/auth/');
          if (!isAuthEndpoint) {
            try {
              await handleTokenExpiry();
              // Token was refreshed — retry once with the new token
              return this.request<T>(endpoint, options, 0);
            } catch {
              onReAuthDismissed();
              throw new ApiError(401, 'Session expired');
            }
          }
          // For auth endpoints, just throw with the server's error message
          errorMessage = responseData.error || responseData.message || 'Invalid credentials';
          throw new ApiError(401, errorMessage);
        } else if (response.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (responseData.error) {
          // Append validation details if present (e.g. activity validation failures)
          errorMessage = responseData.details?.length
            ? `${responseData.error}: ${(responseData.details as string[]).join('; ')}`
            : responseData.error;
          // 2FA required — redirect to login so user can complete 2FA step
          // Only redirect if not already on an auth page to prevent redirect loops
          if (
            responseData.error === 'TWO_FACTOR_REQUIRED' &&
            typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/login') &&
            !window.location.pathname.startsWith('/verify') &&
            !window.location.pathname.startsWith('/set-password')
          ) {
            window.location.href = '/verify-2fa';
          }
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (response.status === 403) {
          // Check if this is an agreement enforcement block
          if (responseData.error === 'AGREEMENT_NOT_ACCEPTED') {
            window.dispatchEvent(new CustomEvent('agreement:required', {
              detail: {
                agreementId: responseData.agreementId,
                agreementVersion: responseData.agreementVersion,
              },
            }));
          }
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
          // If data field is present, return it; otherwise return the full response
          // so callers can access top-level fields like needsPassword, message, etc.
          return responseData.data !== undefined ? responseData.data : responseData;
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
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw new ApiError(0, 'Network error. Please check your connection.');
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<any> {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
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
      // Cookie is cleared by the server; nothing to do client-side.
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
  async getActivities(params?: { cycleId?: string; userId?: string; linkedTaskId?: string } | string): Promise<any[]> {
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
    if (params.linkedTaskId) query.set('linkedTaskId', params.linkedTaskId);
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

  async getCycleParticipants(cycleId: string): Promise<any[]> {
    return this.request<any[]>(`/participation/${cycleId}/all`);
  }

  // Ownership methods
  async getOwnership(userId: string, cycleId: string): Promise<any> {
    return this.request<any>(`/ownership/${userId}/${cycleId}`);
  }

  async getOwnershipSummary(): Promise<any> {
    return this.request<any>('/ownership/summary');
  }

  async getNormalizedOwnership(userId: string, cycleId: string): Promise<any> {
    return this.request<any>(`/ownership/normalized/${userId}/${cycleId}`);
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

  async dismissThreatAlert(notificationId: string): Promise<void> {
    return this.request<void>(`/notifications/${notificationId}/dismiss-threat`, { method: 'POST' });
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
  async getAuditLogs(params?: {
    action?: string;
    adminSearch?: string;
    targetSearch?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const q = new URLSearchParams();
    if (params?.action)       q.set('action',       params.action);
    if (params?.adminSearch)  q.set('adminSearch',  params.adminSearch);
    if (params?.targetSearch) q.set('targetSearch', params.targetSearch);
    if (params?.startDate)    q.set('startDate',    params.startDate);
    if (params?.endDate)      q.set('endDate',      params.endDate);
    if (params?.page)         q.set('page',         String(params.page));
    if (params?.limit)        q.set('limit',        String(params.limit));
    const qs = q.toString();
    return this.request(`/admin/audit${qs ? `?${qs}` : ''}`);
  }

  async resolveDispute(disputeId: string, status: 'approved' | 'denied', resolution: string): Promise<any> {
    return this.request<any>('/admin/resolve-dispute', {
      method: 'POST',
      body: JSON.stringify({ disputeId, status, resolution }),
      headers: this.getStepUpHeaders(),
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
      headers: this.getStepUpHeaders(),
    });
  }

  async deleteUser(userId: string): Promise<any> {
    return this.request<any>(`/admin/users/${userId}`, {
      method: 'DELETE',
      headers: this.getStepUpHeaders(),
    });
  }

  // Admin override methods
  async overrideOwnership(userId: string, cycleId: string, ownershipAmount: number, reason: string): Promise<any> {
    return this.request<any>('/admin/override/ownership', {
      method: 'POST',
      body: JSON.stringify({ userId, cycleId, ownershipAmount, reason }),
      headers: this.getStepUpHeaders(),
    });
  }

  async overrideMultiplier(userId: string, cycleId: string, multiplier: number, reason: string): Promise<any> {
    return this.request<any>('/admin/override/multiplier', {
      method: 'POST',
      body: JSON.stringify({ userId, cycleId, multiplier, reason }),
      headers: this.getStepUpHeaders(),
    });
  }

  async clearStallStatus(userId: string, cycleId: string, reason: string): Promise<any> {
    return this.request<any>('/admin/override/stall-clear', {
      method: 'POST',
      body: JSON.stringify({ userId, cycleId, reason }),
      headers: this.getStepUpHeaders(),
    });
  }

  // Manual job execution
  async executeManualJob(jobId: string): Promise<{ success?: boolean; message?: string; error?: string }> {
    const data = await this.request<{ message?: string }>('/admin/jobs/execute', {
      method: 'POST',
      body: JSON.stringify({ jobId }),
      headers: this.getStepUpHeaders(),
    });
    return { success: true, message: data?.message };
  }

  // Messaging methods
  getCycleMessagesStreamUrl(cycleId: string): string {
    // Returns URL without token — callers must use fetch() with Authorization header
    // (EventSource cannot set headers; use fetchSSE helper instead)
    return `${API_BASE_URL}/messages/cycle/${cycleId}/stream`;
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

  async endCurrentSession(): Promise<any> {
    return this.request<any>('/sessions/end', {
      method: 'POST',
    });
  }

  async getSessionAnalytics(days = 30): Promise<any> {
    return this.request<any>(`/sessions/analytics?days=${days}`);
  }

  // Password & re-auth methods
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.request<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async verifyPassword(password: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // Session management methods
  async listSessions(): Promise<any[]> {
    return this.request<any[]>('/sessions/list');
  }

  async endSession(sessionId: string): Promise<void> {
    return this.request<void>(`/sessions/end/${sessionId}`, { method: 'POST' });
  }

  async endAllOtherSessions(): Promise<{ ended: number }> {
    return this.request<{ ended: number }>('/sessions/end-all', { method: 'POST' });
  }

  // Dispute methods
  async createDispute(activityId: string, reason: string): Promise<any> {
    return this.request<any>(`/activities/${activityId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Email verification methods
  async verifyEmail(token: string): Promise<{ success: boolean; message?: string; needsPassword?: boolean }> {
    return this.request<{ success: boolean; message?: string; needsPassword?: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async setPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async completeTour(): Promise<void> {
    return this.request<void>('/onboarding/tour-complete', { method: 'POST' });
  }

  async resendVerificationEmail(email: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>('/auth/resend-verification-by-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // 2FA methods
  async setup2FA(): Promise<{ secret: string; qrCode: string }> {
    return this.request<{ secret: string; qrCode: string }>('/auth/2fa/setup', { method: 'POST' });
  }

  async enable2FA(code: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disable2FA(code: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getSecurityEvents(): Promise<Array<{
    id: string;
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: string | null;
    createdAt: string;
  }>> {
    return this.request('/security/events');
  }

  async loginWith2FA(email: string, password: string, totpCode: string): Promise<any> {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpCode }),
    });
  }

  /** Re-authenticate with password only (for forced re-auth modal) */
  async reLogin(password: string, email?: string): Promise<string> {
    await this.request<any>('/auth/relogin', {
      method: 'POST',
      body: JSON.stringify({ password, ...(email ? { email } : {}) }),
    });
    // Cookie is refreshed by the server; return empty string for API compat.
    return '';
  }

  /** Request a step-up token by re-verifying password */
  async requestStepUp(password: string): Promise<{ token: string }> {
    return this.request<{ token: string }>('/auth/step-up', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // Agreement methods
  async getCurrentAgreement(): Promise<any> {
    return this.request<any>('/agreements/current');
  }

  async getAgreementHistory(): Promise<any[]> {
    return this.request<any[]>('/agreements/history');
  }

  async getAgreementUserStatus(): Promise<{ hasAccepted: boolean; acceptedVersion: string | null; currentVersion: string | null; agreementId: string | null }> {
    return this.request('/agreements/user-status');
  }

  async acceptAgreement(agreementId: string): Promise<any> {
    return this.request<any>('/agreements/accept', {
      method: 'POST',
      body: JSON.stringify({ agreementId }),
    });
  }

  async createAgreement(data: { version: string; title: string; content: string; setActive?: boolean }): Promise<any> {
    return this.request<any>('/agreements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async activateAgreement(id: string): Promise<any> {
    return this.request<any>(`/agreements/${id}/activate`, { method: 'PATCH' });
  }

  async getAgreementAcceptanceLog(): Promise<any[]> {
    return this.request<any[]>('/agreements/acceptance-log');
  }

  // Task methods
  async getTasks(cycleId?: string): Promise<any[]> {
    const qs = cycleId ? `?cycleId=${cycleId}` : '';
    return this.request<any[]>(`/tasks${qs}`);
  }

  async getTask(taskId: string): Promise<any> {
    return this.request<any>(`/tasks/${taskId}`);
  }

  async getMyTasks(): Promise<any[]> {
    return this.request<any[]>('/tasks/my');
  }

  async createTask(data: {
    title: string;
    description?: string;
    acceptanceCriteria?: string;
    proofLink?: string;
    securityNote?: string;
    restricted?: boolean;
    isStarter?: boolean;
    cycleId: string;
    dueDate?: string;
  }): Promise<any> {
    return this.request<any>('/tasks', { method: 'POST', body: JSON.stringify(data) });
  }

  async assignTask(taskId: string, userIds: string[]): Promise<any> {
    return this.request<any>('/tasks/assign', { method: 'POST', body: JSON.stringify({ taskId, userIds }) });
  }

  async updateTaskStatus(taskId: string, status: string): Promise<any> {
    return this.request<any>(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  async completeTask(taskId: string): Promise<any> {
    return this.request<any>(`/tasks/${taskId}/complete`, { method: 'PATCH' });
  }

  async startTask(taskId: string): Promise<any> {
    return this.request<any>(`/tasks/${taskId}/claim`, { method: 'PATCH' });
  }

  // Leave methods
  async requestLeave(data: { cycleId: string; startDate: string; endDate: string; reason?: string }): Promise<any> {
    return this.request<any>('/leave/request', { method: 'POST', body: JSON.stringify(data) });
  }

  async getMyLeaves(): Promise<any[]> {
    return this.request<any[]>('/leave/my');
  }

  async getLeaveStatus(cycleId: string): Promise<{ onLeave: boolean; leave: any | null }> {
    return this.request<{ onLeave: boolean; leave: any | null }>(`/leave/status/${cycleId}`);
  }

  async adminGrantLeave(data: { userId: string; cycleId: string; startDate: string; endDate: string; reason?: string }): Promise<any> {
    return this.request<any>('/leave/admin/grant', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminOverrideParticipation(data: { userId: string; cycleId: string; status: string; reason?: string }): Promise<any> {
    return this.request<any>('/leave/admin/override', { method: 'PATCH', body: JSON.stringify(data) });
  }

  async adminGetAllLeaves(): Promise<any[]> {
    return this.request<any[]>('/leave/admin/all');
  }

  // Access control methods
  async adminBulkAction(action: string, userIds: string[], metadata?: Record<string, unknown>): Promise<any> {
    return this.request<any>('/admin/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ action, userIds, metadata }),
      headers: this.getStepUpHeaders(),
    });
  }

  async adminGrantAccess(data: { userId: string; type: string; value?: string; expiresAt?: string }): Promise<any> {
    return this.request<any>('/admin/grant-access', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: this.getStepUpHeaders(),
    });
  }

  async adminRevokeAccess(data: { userId: string; type?: string; grantId?: string }): Promise<any> {
    return this.request<any>('/admin/revoke-access', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: this.getStepUpHeaders(),
    });
  }

  async adminGetAccessGrants(userId: string): Promise<any[]> {
    return this.request<any[]>(`/admin/access-grants/${userId}`);
  }

  async adminGetActionLogs(): Promise<any[]> {
    return this.request<any[]>('/admin/action-logs');
  }

  // Logs & export methods
  async getLogs(params?: { userId?: string; type?: string; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<any> {
    const q = new URLSearchParams();
    if (params?.userId) q.set('userId', params.userId);
    if (params?.type) q.set('type', params.type);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return this.request<any>(`/logs?${q.toString()}`);
  }

  async downloadLogsExport(params: { type?: string; format?: string; targetUserId?: string }): Promise<void> {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.format) q.set('format', params.format);
    if (params.targetUserId) q.set('targetUserId', params.targetUserId);
    const response = await fetch(`${API_BASE_URL}/logs/export?${q.toString()}`, {
      mode: 'cors',
      credentials: 'include',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new ApiError(response.status, 'Export failed');
    const blob = await response.blob();
    const ext = params.format === 'csv' ? 'csv' : 'json';
    triggerBlobDownload(blob, `${params.type ?? 'logs'}_export.${ext}`);
  }

  async downloadOwnershipExport(params: { format?: string; targetUserId?: string }): Promise<void> {
    const q = new URLSearchParams();
    if (params.format) q.set('format', params.format);
    if (params.targetUserId) q.set('targetUserId', params.targetUserId);
    const response = await fetch(`${API_BASE_URL}/ownership/export?${q.toString()}`, {
      mode: 'cors',
      credentials: 'include',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new ApiError(response.status, 'Export failed');
    const blob = await response.blob();
    const ext = params.format === 'csv' ? 'csv' : 'json';
    triggerBlobDownload(blob, `ownership_export.${ext}`);
  }

  // Onboarding methods
  async getOnboardingStatus(): Promise<{
    onboardingStep: number;
    onboardingCompleted: boolean;
    twoFactorEnabled: boolean;
    role: string;
    agreementAccepted: boolean;
    agreementId: string | null;
    agreementVersion: string | null;
  }> {
    return this.request('/onboarding/status');
  }

  async advanceOnboardingStep(step: number, data?: Record<string, unknown>): Promise<{ onboardingStep: number; onboardingCompleted: boolean }> {
    return this.request('/onboarding/step', {
      method: 'POST',
      body: JSON.stringify({ step, data }),
    });
  }

  async submitAccessRequest(accessType: string, reason: string): Promise<any> {    return this.request<any>('/logs/access-request', {
      method: 'POST',
      body: JSON.stringify({ accessType, reason }),
    });
  }

  async getAccessRequests(): Promise<any[]> {
    return this.request<any[]>('/logs/access-requests');
  }

  async reviewAccessRequest(id: string, status: 'approved' | 'rejected'): Promise<any> {
    return this.request<any>(`/logs/access-request/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getEffectiveOwnership(userId: string, cycleId: string): Promise<any> {
    return this.request<any>(`/ownership/effective/${userId}/${cycleId}`);
  }

  // ── Docs Vault ──────────────────────────────────────────────────────────────

  async getFolders(): Promise<any[]> {
    return this.request<any[]>('/docs/folders');
  }

  async createFolder(name: string, parentId?: string): Promise<any> {
    return this.request<any>('/docs/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
  }

  async getDocs(params?: { folderId?: string; label?: string; search?: string; cycleId?: string }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.folderId) q.set('folderId', params.folderId);
    if (params?.label) q.set('label', params.label);
    if (params?.search) q.set('search', params.search);
    if (params?.cycleId) q.set('cycleId', params.cycleId);
    const qs = q.toString();
    return this.request<any[]>(qs ? `/docs?${qs}` : '/docs');
  }

  async getDocMeta(id: string): Promise<any> {
    return this.request<any>(`/docs/${id}`);
  }

  /** Fetches the doc file via Authorization header and returns an object URL for safe rendering. */
  async getDocBlobUrl(id: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/docs/view/${id}`, {
      mode: 'cors',
      credentials: 'include',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new ApiError(response.status, 'Access denied');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  /** Fetches the doc via the download endpoint and triggers a browser download. */
  async downloadDoc(id: string, filename: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/docs/download/${id}`, {
      mode: 'cors',
      credentials: 'include',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) throw new ApiError(response.status, 'Download access denied');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async requestDocAccess(documentId: string, reason: string, requestedDays?: number): Promise<any> {
    return this.request<any>('/docs/request-access', {
      method: 'POST',
      body: JSON.stringify({ documentId, reason, requestedDays }),
    });
  }

  async adminGrantDocAccess(data: {
    userId: string;
    documentId: string;
    accessType?: 'view' | 'download';
    expiresInDays?: number;
  }): Promise<any> {
    return this.request<any>('/docs/grant-access', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: this.getStepUpHeaders(),
    });
  }

  async adminRevokeDocAccess(userId: string, documentId: string): Promise<any> {
    return this.request<any>('/docs/revoke-access', {
      method: 'POST',
      body: JSON.stringify({ userId, documentId }),
      headers: this.getStepUpHeaders(),
    });
  }

  async adminCreateDoc(data: {
    title: string;
    file: File;
    securityLabel?: string;
    folderId?: string;
  }): Promise<any> {
    const form = new FormData();
    form.append('file', data.file);
    form.append('title', data.title);
    if (data.securityLabel) form.append('securityLabel', data.securityLabel);
    if (data.folderId) form.append('folderId', data.folderId);

    const response = await fetch(`${API_BASE_URL}/docs/upload`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      // No Content-Type header — browser sets multipart boundary automatically
      body: form,
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new ApiError(response.status, json.error || 'Upload failed');
    }
    return json.data;
  }

  async adminUpdateDoc(id: string, data: {
    title?: string;
    folderId?: string | null;
    securityLabel?: string;
    isActive?: boolean;
  }): Promise<any> {
    return this.request<any>(`/docs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminUploadDocVersion(documentId: string, file: File): Promise<any> {
    const form = new FormData();
    form.append('file', file);
    form.append('documentId', documentId);

    const response = await fetch(`${API_BASE_URL}/docs/version`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      body: form,
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new ApiError(response.status, json.error || 'Version upload failed');
    }
    return json.data;
  }

  async getDocActivity(documentId: string): Promise<any[]> {
    return this.request<any[]>(`/docs/${documentId}/activity`);
  }

  async getDocAccessGrants(documentId: string): Promise<any[]> {
    return this.request<any[]>(`/docs/${documentId}/access`);
  }

  // Groups
  async getGroups(): Promise<any[]> {
    return this.request<any[]>('/groups/admin');
  }

  async createGroup(data: { name: string; description?: string; isDefault?: boolean }): Promise<any> {
    return this.request<any>('/groups/admin', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateGroup(id: string, data: { name?: string; description?: string; isDefault?: boolean }): Promise<any> {
    return this.request<any>(`/groups/admin/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteGroup(id: string): Promise<any> {
    return this.request<any>(`/groups/admin/${id}`, { method: 'DELETE' });
  }

  async assignUserGroup(userId: string, groupId: string | null): Promise<any> {
    return this.request<any>(`/groups/admin/users/${userId}/group`, { method: 'PATCH', body: JSON.stringify({ groupId }) });
  }

  async getMyGroup(): Promise<any> {
    return this.request<any>('/groups/my');
  }

  // Triage
  async submitTriage(data: object): Promise<any> {
    return this.request<any>('/triage/submit', { method: 'POST', body: JSON.stringify(data) });
  }

  async getTriageList(status?: string): Promise<any[]> {
    const qs = status ? `?status=${status}` : '';
    return this.request<any[]>(`/triage/admin${qs}`);
  }

  async getTriageDetail(id: string): Promise<any> {
    return this.request<any>(`/triage/admin/${id}`);
  }

  async approveTriageSubmission(id: string, role?: string): Promise<any> {
    return this.request<any>(`/triage/admin/${id}/approve`, { method: 'POST', body: JSON.stringify({ role }) });
  }

  async rejectTriageSubmission(id: string, note?: string): Promise<any> {
    return this.request<any>(`/triage/admin/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
  }

  async syncSheet(): Promise<{ imported: number; skipped: number }> {
    return this.request('/triage/admin/sync-sheet', { method: 'POST' });
  }

  // Ideas
  async submitIdea(data: { title: string; description: string; attachments?: string[] }): Promise<any> {
    return this.request<any>('/ideas', { method: 'POST', body: JSON.stringify(data) });
  }

  async getMyIdeas(): Promise<any[]> {
    return this.request<any[]>('/ideas/my');
  }

  async getIdeaDetail(id: string): Promise<any> {
    return this.request<any>(`/ideas/${id}`);
  }

  async getAdminIdeas(status?: string): Promise<any[]> {
    const qs = status ? `?status=${status}` : '';
    return this.request<any[]>(`/ideas/admin/list${qs}`);
  }

  async approveIdea(id: string, options: { cycleName?: string; startDate: string; endDate: string }): Promise<any> {
    return this.request<any>(`/ideas/admin/${id}/approve`, { method: 'POST', body: JSON.stringify(options) });
  }

  async rejectIdea(id: string, note?: string): Promise<any> {
    return this.request<any>(`/ideas/admin/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
  }

  // Backup & Recovery
  async getBackupStatus(): Promise<{
    lastBackupTime: string | null;
    lastBackupStatus: 'success' | 'failed' | 'unknown';
    recoveryReady: boolean;
    uptimeSince: string | null;
    backupFiles: { fileName: string; sizeBytes: number; createdAt: string }[];
    totalBackups: number;
    driveConfigured: boolean;
    driveLastUploaded: string | null;
    dbHealth: {
      connected: boolean;
      userCount: number;
      activityCount: number;
      cycleCount: number;
      systemLogCount: number;
    };
    recentErrors: { message: string; timestamp: string }[];
    criticalErrorsLast24h: number;
    checkedAt: string;
  }> {
    return this.request('/admin/backup/status');
  }

  async triggerBackup(): Promise<{
    success: boolean;
    fileName?: string;
    sizeBytes?: number;
    timestamp: string;
    error?: string;
  }> {
    return this.request('/admin/backup/trigger', { method: 'POST' });
  }
}

export const apiClient = new ApiClient();
export { ApiError };