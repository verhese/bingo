import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  clearAdminLoginAttempts,
  consumeAdminLoginAttempt,
  createAdminSessionToken,
  isAdminAuthConfigured,
  isSameOrigin,
  isValidAdminSession,
  verifyAdminPassword,
} from './admin-auth';

const originalEnvironment = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
};

describe('administrator authentication', () => {
  before(() => {
    process.env.ADMIN_PASSWORD = 'test-password-with-sufficient-length';
    process.env.ADMIN_SESSION_SECRET = 'test-session-signing-secret-that-is-over-32-bytes';
  });

  after(() => {
    if (originalEnvironment.ADMIN_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalEnvironment.ADMIN_PASSWORD;
    if (originalEnvironment.ADMIN_SESSION_SECRET === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalEnvironment.ADMIN_SESSION_SECRET;
  });

  it('requires configured credentials and compares the password', () => {
    assert.equal(isAdminAuthConfigured(), true);
    assert.equal(verifyAdminPassword('test-password-with-sufficient-length'), true);
    assert.equal(verifyAdminPassword('wrong-password'), false);
    assert.equal(verifyAdminPassword(null), false);
  });

  it('accepts only unexpired, signed administrator sessions', () => {
    const now = 1_800_000_000_000;
    const token = createAdminSessionToken(now);
    assert.equal(isValidAdminSession(token, now), true);
    assert.equal(isValidAdminSession(`${token.slice(0, -1)}x`, now), false);
    assert.equal(isValidAdminSession(token, now + 8 * 60 * 60 * 1000), false);
    assert.equal(isValidAdminSession(undefined, now), false);
  });

  it('requires an exact same-origin match', () => {
    assert.equal(isSameOrigin('https://bingo.example', 'https://bingo.example'), true);
    assert.equal(isSameOrigin('https://attacker.example', 'https://bingo.example'), false);
    assert.equal(isSameOrigin(null, 'https://bingo.example'), false);
  });

  it('limits login attempts within a window and resets after it expires', () => {
    const client = 'admin-auth-rate-limit-test';
    const now = 1_800_000_000_000;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(consumeAdminLoginAttempt(client, now), null);
    }

    assert.equal(consumeAdminLoginAttempt(client, now), 15 * 60);
    assert.equal(consumeAdminLoginAttempt(client, now + 15 * 60 * 1000), null);
    clearAdminLoginAttempts(client);
  });
});
