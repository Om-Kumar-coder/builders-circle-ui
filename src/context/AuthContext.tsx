'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '../lib/api-client';
import { useRouter } from 'next/navigation';
import type { User, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        role: userData.role as User['role'],
        status: userData.status,
        bio: userData.bio,
        avatar: userData.avatar
      });
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await apiClient.login(email, password);
      const userData = response.user;
      
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        role: userData.role as User['role'],
        status: userData.status,
        bio: userData.bio,
        avatar: userData.avatar
      });
      
      // Role-based redirection
      if (userData.role === 'founder' || userData.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (error: any) {
      throw error;
    }
  }

  async function signup(name: string, email: string, password: string) {
    try {
      const response = await apiClient.signup(email, password, name);
      const userData = response.user;
      
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        role: userData.role as User['role'],
        status: userData.status,
        bio: userData.bio,
        avatar: userData.avatar
      });
      
      router.replace('/dashboard');
    } catch (error: any) {
      throw error;
    }
  }

  async function logout() {
    try {
      await apiClient.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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
