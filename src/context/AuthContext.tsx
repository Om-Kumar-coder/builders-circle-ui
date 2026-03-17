'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '../lib/api-client';
import { useRouter } from 'next/navigation';
import type { User, AuthContextType } from '../types/auth';
import { startSessionTimers, clearSessionTimers, attachActivityListeners } from '../lib/session-timer';
import { setCachedEmail } from '../lib/auth-expiry-handler';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function mapUser(userData: Record<string, unknown>): User {
    return {
      id: userData.id as string,
      email: userData.email as string,
      name: userData.name as string | undefined,
      createdAt: userData.createdAt as string | undefined,
      role: userData.role as User['role'],
      status: userData.status as string | undefined,
      bio: userData.bio as string | undefined,
      avatar: userData.avatar as string | undefined,
      twoFactorEnabled: userData.twoFactorEnabled as boolean | undefined,
      emailVerified: userData.emailVerified as boolean | undefined,
      onboardingStep: userData.onboardingStep as number | undefined,
      onboardingCompleted: userData.onboardingCompleted as boolean | undefined,
    };
  }

  async function checkSession() {
    try {
      const userData = await apiClient.getCurrentUser();
      const mapped = mapUser(userData);
      setUser(mapped);
      setCachedEmail(mapped.email);
      startSessionTimers();
      attachActivityListeners();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshUser() {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(mapUser(userData));
    } catch {
      setUser(null);
    }
  }

  async function login(email: string, password: string) {
    const response = await apiClient.login(email, password);

    // Backend signals 2FA is required — don't set user yet
    if (response?.requires2FA) {
      return { requires2FA: true };
    }

    const userData = response.user;
    const mapped = mapUser(userData);
    setUser(mapped);
    setCachedEmail(mapped.email);

    // Store token in a client-accessible cookie on the frontend domain
    // so the Next.js proxy can verify it for route protection
    if (response.token) {
      document.cookie = `auth_token=${response.token}; path=/; max-age=604800; SameSite=Lax`;
    }

    startSessionTimers();
    attachActivityListeners();

    // Enforce onboarding before accessing the app
    if (!mapped.onboardingCompleted) {
      router.replace('/onboarding');
      return;
    }

    if (userData.role === 'founder' || userData.role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/dashboard');
    }
  }

  async function signup(name: string, email: string, password: string) {
    const response = await apiClient.signup(name, email, password);
    const userData = response.user;
    setUser(mapUser(userData));
    if (response.token) {
      document.cookie = `auth_token=${response.token}; path=/; max-age=604800; SameSite=Lax`;
    }
    router.replace('/onboarding');
  }

  async function logout() {
    clearSessionTimers();
    // Clear the frontend cookie
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
    try {
      await apiClient.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
