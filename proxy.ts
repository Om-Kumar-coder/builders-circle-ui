import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/admin', '/dashboard', '/activity', '/earnings', '/insights', '/team', '/profile', '/settings', '/docs', '/build-cycles'];
const ADMIN_PATHS = ['/admin'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode without verification — just check role claim for admin routing.
  // Real auth is enforced by the backend on every API call.
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('auth_token');
      return response;
    }

    const isAdminPath = ADMIN_PATHS.some(p => pathname.startsWith(p));
    if (isAdminPath && payload.role !== 'admin' && payload.role !== 'founder') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/activity/:path*',
    '/earnings/:path*',
    '/insights/:path*',
    '/team/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/docs/:path*',
    '/build-cycles/:path*',
  ],
};
