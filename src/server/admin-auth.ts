import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'bingo-admin-session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

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
