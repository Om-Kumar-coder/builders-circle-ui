import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify the token against the backend
    const verifyRes = await fetch(`${API_BASE_URL}/triage/prefilter/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!verifyRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired prefilter token' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: { message: 'Cookie set' },
    });

    // Set httpOnly cookie — not accessible from client-side JS
    // Secure: true in production, false in dev (localhost)
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('prefilter_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 2 * 60 * 60, // 2 hours (matches JWT expiry)
    });

    return response;
  } catch (err) {
    console.error('[Prefilter set-cookie] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to set prefilter cookie' },
      { status: 500 }
    );
  }
}
