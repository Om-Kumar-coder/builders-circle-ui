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
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(response.status, errorData.error || 'Request failed');
    }

    return response.json();
  }

  // Auth methods
  async signup(email: string, password: string, name?: string) {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    // Store token in localStorage
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
  }

  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Store token in localStorage
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    const response = await this.request('/auth/logout', { method: 'POST' });
    
    // Remove token from localStorage
    localStorage.removeItem('auth_token');
    
    return response;
  }

  // Cycles methods
  async getCycles() {
    return this.request('/cycles');
  }

  async getCycle(id: string) {
    return this.request(`/cycles/${id}`);
  }

  async createCycle(data: {
    name: string;
    startDate: string;
    endDate: string;
  }) {
    return this.request('/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCycle(id: string, data: Partial<{
    name: string;
    state: string;
    startDate: string;
    endDate: string;
  }>) {
    return this.request(`/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCycle(id: string) {
    return this.request(`/cycles/${id}`, { method: 'DELETE' });
  }

  // Participation methods
  async joinCycle(cycleId: string) {
    return this.request('/participation/join', {
      method: 'POST',
      body: JSON.stringify({ cycleId }),
    });
  }

  async getParticipation(cycleId: string) {
    return this.request(`/participation/${cycleId}`);
  }

  async updateParticipation(id: string, data: any) {
    return this.request(`/participation/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Activities methods
  async getActivities(params?: { userId?: string; cycleId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.cycleId) searchParams.append('cycleId', params.cycleId);
    
    const query = searchParams.toString();
    return this.request(`/activities${query ? `?${query}` : ''}`);
  }

  async createActivity(data: {
    cycleId: string;
    activityType: string;
    proofLink: string;
    description?: string;
  }) {
    return this.request('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateActivity(id: string, data: any) {
    return this.request(`/activities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteActivity(id: string) {
    return this.request(`/activities/${id}`, { method: 'DELETE' });
  }

  // Ownership methods
  async getOwnership(userId: string, cycleId: string) {
    return this.request(`/ownership/${userId}/${cycleId}`);
  }

  // Notifications methods
  async getNotifications() {
    return this.request('/notifications');
  }

  async getUnreadCount() {
    const notifications = await this.getNotifications();
    return { count: notifications.filter((n: any) => !n.read).length };
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    const notifications = await this.getNotifications();
    const unreadIds = notifications.filter((n: any) => !n.read).map((n: any) => n.id);
    
    await Promise.all(
      unreadIds.map(id => this.markNotificationRead(id))
    );
  }

  // Admin methods
  async getAuditLogs() {
    return this.request('/admin/audit');
  }

  async resolveDispute(disputeId: string, resolution: string) {
    return this.request('/admin/resolve-dispute', {
      method: 'POST',
      body: JSON.stringify({ disputeId, resolution }),
    });
  }
}

export const apiClient = new ApiClient();
export { ApiError };