import { NextRequest, NextResponse } from 'next/server';
import { isIP } from 'node:net';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  clearAdminLoginAttempts,
  consumeAdminLoginAttempt,
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

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const client = forwardedFor && isIP(forwardedFor) ? forwardedFor : 'unknown';
  const retryAfter = consumeAdminLoginAttempt(client);
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
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

  clearAdminLoginAttempts(client);
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
