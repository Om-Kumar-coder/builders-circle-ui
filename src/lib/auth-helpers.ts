import { cookies } from 'next/headers';

/**
 * Server-side helper to check if user has an active session
 * This runs on the server and checks for the JWT token cookie
 */
export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  return token?.value || null;
}

/**
 * Check if user is authenticated (has session cookie)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return !!session;
}

/**
 * Get session cookie name for JWT auth
 */
export function getSessionCookieName(): string {
  return 'auth_token';
}