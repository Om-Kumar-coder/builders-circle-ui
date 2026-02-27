'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { account, databases } from '../lib/appwrite';
import { ID } from 'appwrite';
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
      const currentUser = await account.get();
      await fetchUserRole(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserRole(userData: any) {
    try {
      // Fetch user profile from database to get role
      const profile = await databases.getDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID || '',
        userData.$id
      );
      setUser({ ...userData, role: profile.role as User['role'] });
    } catch (error) {
      // If profile doesn't exist, set user without role
      setUser({ ...userData, role: 'contributor' });
    }
  }

  async function login(email: string, password: string) {
    // Check if already logged in
    try {
      const existingUser = await account.get();
      if (existingUser) {
        await fetchUserRole(existingUser);
        router.replace('/dashboard');
        return;
      }
    } catch {
      // No existing session, continue with login
    }

    // Create new session
    try {
      await account.createEmailPasswordSession(email, password);
      const userData = await account.get();
      await fetchUserRole(userData);
      
      // Role-based redirection
      const profile = await databases.getDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID || '',
        userData.$id
      ).catch(() => null);
      
      const userRole = profile?.role || 'contributor';
      if (userRole === 'founder' || userRole === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (error: any) {
      // Handle "session is active" error
      if (error.message && error.message.toLowerCase().includes('session')) {
        const userData = await account.get();
        await fetchUserRole(userData);
        router.replace('/dashboard');
        return;
      }
      throw error;
    }
  }

  async function signup(name: string, email: string, password: string) {
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    const userData = await account.get();
    await fetchUserRole(userData);
    router.replace('/dashboard');
  }

  async function logout() {
    await account.deleteSession('current');
    setUser(null);
    router.replace('/login');
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
