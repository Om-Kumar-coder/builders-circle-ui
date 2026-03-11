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
      mode: 'cors',
      credentials: 'include',
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
  async signup(email: string, password: string, name?: string): Promise<{ token?: string; user?: any; success?: boolean; error?: string }> {
    const response = await this.request<{ token?: string; user?: any; success?: boolean; error?: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    // Store token in localStorage
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
  }

  async login(email: string, password: string): Promise<{ token?: string; user?: any; success?: boolean; error?: string }> {
    const response = await this.request<{ token?: string; user?: any; success?: boolean; error?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Store token in localStorage
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
  }

  async getCurrentUser(): Promise<any> {
    return this.request<any>('/auth/me');
  }

  async logout(): Promise<{ success?: boolean }> {
    const response = await this.request<{ success?: boolean }>('/auth/logout', { method: 'POST' });
    
    // Remove token from localStorage
    localStorage.removeItem('auth_token');
    
    return response;
  }

  // Cycles methods
  async getCycles(): Promise<any[]> {
    return this.request<any[]>('/cycles');
  }

  async getCycle(id: string): Promise<any> {
    return this.request<any>(`/cycles/${id}`);
  }

  async createCycle(data: {
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<any> {
    return this.request<any>('/cycles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCycle(id: string, data: Partial<{
    name: string;
    state: string;
    startDate: string;
    endDate: string;
  }>): Promise<any> {
    return this.request<any>(`/cycles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCycle(id: string): Promise<{ success?: boolean }> {
    return this.request<{ success?: boolean }>(`/cycles/${id}`, { method: 'DELETE' });
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

  async updateParticipation(id: string, data: any): Promise<any> {
    return this.request<any>(`/participation/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Activities methods
  async getActivities(params?: { userId?: string; cycleId?: string }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.cycleId) searchParams.append('cycleId', params.cycleId);
    
    const query = searchParams.toString();
    return this.request<any[]>(`/activities${query ? `?${query}` : ''}`);
  }

  async createActivity(data: {
    cycleId: string;
    activityType: string;
    proofLink: string;
    description?: string;
    contributionType?: string;
    contributionWeight?: number;
  }): Promise<any> {
    return this.request<any>('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateActivity(id: string, data: any): Promise<any> {
    return this.request<any>(`/activities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteActivity(id: string): Promise<{ success?: boolean }> {
    return this.request<{ success?: boolean }>(`/activities/${id}`, { method: 'DELETE' });
  }

  // Ownership methods
  async getOwnership(userId: string, cycleId: string): Promise<{ 
    success?: boolean; 
    entries?: any[]; 
    totalOwnership?: number; 
    multiplier?: number; 
    effectiveOwnership?: number; 
    error?: string 
  }> {
    return this.request<{ 
      success?: boolean; 
      entries?: any[]; 
      totalOwnership?: number; 
      multiplier?: number; 
      effectiveOwnership?: number; 
      error?: string 
    }>(`/ownership/${userId}/${cycleId}`);
  }

  // Notifications methods
  async getNotifications(): Promise<any[]> {
    return this.request<any[]>('/notifications');
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const notifications = await this.getNotifications();
    return { count: notifications.filter((n: any) => !n.read).length };
  }

  async markNotificationRead(id: string): Promise<{ success?: boolean }> {
    return this.request<{ success?: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead(): Promise<void> {
    const notifications = await this.getNotifications();
    const unreadIds = notifications.filter((n: any) => !n.read).map((n: any) => n.id);
    
    await Promise.all(
      unreadIds.map(id => this.markNotificationRead(id))
    );
  }

  // Admin methods
  async getAuditLogs(): Promise<any[]> {
    return this.request<any[]>('/admin/audit');
  }

  async resolveDispute(disputeId: string, resolution: string): Promise<{ success?: boolean }> {
    return this.request<{ success?: boolean }>('/admin/resolve-dispute', {
      method: 'POST',
      body: JSON.stringify({ disputeId, resolution }),
    });
  }
}

export const apiClient = new ApiClient();
export { ApiError };