import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isAdminAuthConfigured,
  isSameOrigin,
  verifyAdminPassword,
} from '@/server/admin-auth';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Administrator authentication is not configured.' }, { status: 503 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
  if (!verifyAdminPassword(body?.password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
