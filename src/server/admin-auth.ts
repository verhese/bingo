import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'bingo-admin-session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const ADMIN_LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_MAX_CLIENTS = 10_000;
const adminLoginAttempts = new Map<string, { attempts: number; resetAt: number }>();

function removeExpiredAdminLoginAttempts(now: number): void {
  for (const [client, attempt] of adminLoginAttempts) {
    if (attempt.resetAt <= now) adminLoginAttempts.delete(client);
  }
}

export function consumeAdminLoginAttempt(client: string, now = Date.now()): number | null {
  removeExpiredAdminLoginAttempts(now);
  const attempt = adminLoginAttempts.get(client);
  if (attempt && attempt.attempts >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    return Math.ceil((attempt.resetAt - now) / 1000);
  }
  if (!attempt && adminLoginAttempts.size >= ADMIN_LOGIN_MAX_CLIENTS) {
    return Math.ceil(ADMIN_LOGIN_ATTEMPT_WINDOW_MS / 1000);
  }
  if (attempt) {
    attempt.attempts += 1;
  } else {
    adminLoginAttempts.set(client, {
      attempts: 1,
      resetAt: now + ADMIN_LOGIN_ATTEMPT_WINDOW_MS,
    });
  }
  return null;
}

export function clearAdminLoginAttempts(client: string): void {
  adminLoginAttempts.delete(client);
}

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}

function fixedTimeStringEquals(first: string, second: string): boolean {
  const firstHash = createHash('sha256').update(first).digest();
  const secondHash = createHash('sha256').update(second).digest();
  return timingSafeEqual(firstHash, secondHash);
}

function sign(expiry: string, secret: string): string {
  return createHmac('sha256', secret).update(expiry).digest('base64url');
}

export function isAdminAuthConfigured(): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password && password.length >= 16 && getSessionSecret());
}

export function verifyAdminPassword(candidate: unknown): boolean {
  const password = process.env.ADMIN_PASSWORD;
  return typeof candidate === 'string'
    && isAdminAuthConfigured()
    && fixedTimeStringEquals(candidate, password!);
}

export function createAdminSessionToken(now = Date.now()): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET must contain at least 32 bytes.');
  const expiry = String(now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiry}.${sign(expiry, secret)}`;
}

export function isValidAdminSession(token: string | undefined, now = Date.now()): boolean {
  const secret = getSessionSecret();
  if (!token || !secret || !isAdminAuthConfigured()) return false;
  const [expiry, signature, ...extra] = token.split('.');
  if (!expiry || !signature || extra.length > 0 || !/^\d{13}$/.test(expiry)) return false;
  const expiryTime = Number(expiry);
  if (expiryTime <= now || expiryTime > now + (ADMIN_SESSION_MAX_AGE_SECONDS + 60) * 1000) return false;
  return fixedTimeStringEquals(signature, sign(expiry, secret));
}

export function isSameOrigin(origin: string | null, expectedOrigin: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function isValidInternalApiToken(candidate: unknown): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  return typeof candidate === 'string'
    && Boolean(expected && Buffer.byteLength(expected) >= 32)
    && fixedTimeStringEquals(candidate, expected!);
}
