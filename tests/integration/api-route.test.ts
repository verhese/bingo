import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { startGameServer, type TestServer } from './helpers';
import {
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_SESSION_SECRET,
  TEST_INTERNAL_API_TOKEN,
} from '../support/test-auth';

type Route = typeof import('../../src/app/api/game/route');
type LoginRoute = typeof import('../../src/app/api/auth/login/route');

let server: TestServer;
let route: Route;
let loginRoute: LoginRoute;
let adminSessionCookie = '';

async function post(body: unknown, authenticated = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost',
  };
  if (authenticated && adminSessionCookie) {
    headers.Cookie = `bingo-admin-session=${adminSessionCookie}`;
  }
  const response = await route.POST(new NextRequest('http://localhost/api/game', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function login(password: string, clientIp = '127.0.0.1') {
  return loginRoute.POST(new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      'X-Forwarded-For': clientIp,
    },
    body: JSON.stringify({ password }),
  }));
}

async function get(query: string) {
  const response = await route.GET(new NextRequest(`http://localhost/api/game?${query}`));
  return { status: response.status, body: await response.json() as Record<string, any> };
}

async function createRoom(roomName: string, gameModeId = 'standard') {
  const { status, body } = await post({ action: 'create-session', roomName, gameModeId });
  assert.equal(status, 200);
  return body.gameState.sessionId as string;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('HTTP API /api/game', () => {
  before(async () => {
    process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
    process.env.ADMIN_SESSION_SECRET = TEST_ADMIN_SESSION_SECRET;
    process.env.INTERNAL_API_TOKEN = TEST_INTERNAL_API_TOKEN;
    server = await startGameServer();
    process.env.GAME_SERVER_WS_URL = server.url;
    route = await import('../../src/app/api/game/route');
    loginRoute = await import('../../src/app/api/auth/login/route');
    const response = await login(TEST_ADMIN_PASSWORD);
    adminSessionCookie = response.cookies.get('bingo-admin-session')?.value ?? '';
  });
  after(async () => {
    await server.stop();
  });

  it('rejects invalid JSON, unknown actions and unknown variants', async () => {
    assert.equal((await post('not json')).status, 400);
    assert.equal((await post({ action: 'explode' })).status, 400);
    assert.equal((await post({ action: 'change-variant', variant: 'bogus' })).status, 409);
    assert.equal((await post({ action: 'create-session', variant: 'toString' })).status, 400);
    assert.equal((await post({ action: 'change-variant', variant: '90-ball' })).status, 409);
  });

  it('requires a valid administrator session and same-origin requests for mutations', async () => {
    assert.equal((await post({ action: 'reset', sessionId: 'default' }, false)).status, 401);
    const wrongPassword = await login('incorrect password');
    assert.equal(wrongPassword.status, 401);
    assert.ok(adminSessionCookie);

    const crossOrigin = await route.POST(new NextRequest('http://localhost/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
        Cookie: `bingo-admin-session=${adminSessionCookie}`,
      },
      body: JSON.stringify({ action: 'reset', sessionId: 'default' }),
    }));
    assert.equal(crossOrigin.status, 403);
  });

  it('limits administrator login attempts per client', async () => {
    const clientIp = '192.0.2.1';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await login('incorrect password', clientIp)).status, 401);
    }

    const limited = await login(TEST_ADMIN_PASSWORD, clientIp);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    assert.equal((await login(TEST_ADMIN_PASSWORD, '192.0.2.2')).status, 200);
  });

  it('creates a room and exposes it through the room list and state endpoints', async () => {
    const id = await createRoom('Http Room', 'single-row');
    const rooms = await get('rooms=true');
    assert.ok(rooms.body.sessions.some((room: { sessionId: string }) => room.sessionId === id));
    const state = await get(`sessionId=${id}`);
    assert.equal(state.body.gameState.gameModeId, 'single-row');
  });

  it('rejects mode changes on an existing room with 409', async () => {
    const id = await createRoom('Fixed mode');
    const result = await post({ action: 'select-game-mode', sessionId: id, gameModeId: 'single-row' });
    assert.equal(result.status, 409);
  });

  it('validates called numbers', async () => {
    const id = await createRoom('Call validation');
    for (const number of [0, 76, 1.5, 'x']) {
      assert.equal((await post({ action: 'call-number', sessionId: id, number })).status, 400, `number ${number}`);
    }
    assert.equal((await post({ action: 'call-number', sessionId: id, number: 9 })).status, 200);
    const duplicate = await post({ action: 'call-number', sessionId: id, number: 9 });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.error, /already/i);
  });

  it('verifies claims against the active stage (8 numbers for the cross)', async () => {
    const id = await createRoom('Stage claims');
    for (const number of range(1, 20)) await post({ action: 'call-number', sessionId: id, number });

    assert.equal((await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: [1, 2, 3, 4, 99], expectedStageIndex: 0 })).status, 400);
    assert.equal((await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 0 })).status, 200);
    assert.equal((await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(6, 10), expectedStageIndex: 1 })).status, 200);

    const fiveForCross = await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 2 });
    assert.equal(fiveForCross.status, 400);

    const cross = await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 8), expectedStageIndex: 2 });
    assert.equal(cross.status, 200);
    assert.equal(cross.body.gameState.currentStage, 'full-card');
  });

  it('requires the expected stage and rejects a stale one', async () => {
    const id = await createRoom('Stale api');
    for (const number of range(1, 10)) await post({ action: 'call-number', sessionId: id, number });

    const missing = await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5) });
    assert.equal(missing.status, 400);

    assert.equal((await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 0 })).status, 200);
    const stale = await post({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(6, 10), expectedStageIndex: 0 });
    assert.equal(stale.status, 409);
  });

  it('keeps rooms isolated and resets only the targeted room', async () => {
    const a = await createRoom('Api iso A');
    const b = await createRoom('Api iso B');
    await post({ action: 'call-number', sessionId: a, number: 1 });
    await post({ action: 'call-number', sessionId: b, number: 2 });
    await post({ action: 'reset', sessionId: a });
    assert.deepEqual((await get(`sessionId=${a}`)).body.gameState.drawnNumbers, []);
    assert.deepEqual((await get(`sessionId=${b}`)).body.gameState.drawnNumbers, [2]);
  });

  it('reports a storage failure as 503 without changing the room, then recovers', async () => {
    const id = await createRoom('Api storage');
    await post({ action: 'call-number', sessionId: id, number: 4 });

    await server.database!.pause();
    try {
      const failed = await post({ action: 'call-number', sessionId: id, number: 5 });
      assert.equal(failed.status, 503);
      assert.equal(failed.body.code, 'storage-error');
      assert.match(failed.body.error, /could not be saved/i);
      assert.doesNotMatch(JSON.stringify(failed.body), /ECONNREFUSED|postgres|bingo-test/i);

      const created = await post({ action: 'create-session', roomName: 'Api storage never' });
      assert.equal(created.status, 503);
      assert.equal(created.body.code, 'storage-error');

      assert.deepEqual((await get(`sessionId=${id}`)).body.gameState.drawnNumbers, [4]);
      assert.ok(!(await get('rooms=true')).body.sessions.some((room: { sessionId: string }) => room.sessionId === 'api-storage-never'));
    } finally {
      await server.database!.resume();
    }

    const retried = await post({ action: 'call-number', sessionId: id, number: 5 });
    assert.equal(retried.status, 200);
    assert.deepEqual(retried.body.gameState.drawnNumbers, [4, 5]);
  });

  it('reports 503 when the game service is unavailable', async () => {
    await server.stop();
    assert.equal((await get('rooms=true')).status, 503);
    assert.equal((await post({ action: 'draw', sessionId: 'default' })).status, 503);
  });
});
