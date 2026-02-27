import { cookies } from 'next/headers';

/**
 * Server-side helper to check if user has an active Appwrite session
 * This runs on the server and checks for the Appwrite session cookie
 */
export async function getServerSession() {
  const cookieStore = await cookies();
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const sessionCookieName = `a_session_${projectId}`;
  
  const session = cookieStore.get(sessionCookieName);
  return session?.value || null;
}

/**
 * Check if user is authenticated (has session cookie)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return !!session;
}

/**
 * Get session cookie name for Appwrite
 */
export function getSessionCookieName(): string {
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  return `a_session_${projectId}`;
}
