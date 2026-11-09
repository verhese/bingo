import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { GET as getLive } from '../app/api/health/live/route';
import { GET as getReady } from '../app/api/health/ready/route';

const originalFetch = globalThis.fetch;
const originalGameServerUrl = process.env.GAME_SERVER_WS_URL;

describe('health routes', () => {
  before(() => {
    process.env.GAME_SERVER_WS_URL = 'wss://user:password@ws-server:3001/private?token=secret';
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (originalGameServerUrl === undefined) delete process.env.GAME_SERVER_WS_URL;
    else process.env.GAME_SERVER_WS_URL = originalGameServerUrl;
  });

  it('reports web liveness without requiring the game service', async () => {
    globalThis.fetch = async () => {
      throw new Error('The game service should not be queried for liveness.');
    };

    const response = getLive();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  it('checks the private game service readiness endpoint', async () => {
    let requestedUrl = '';
    globalThis.fetch = async (input, init) => {
      requestedUrl = String(input);
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.redirect, 'manual');
      assert.ok(init?.signal);
      return new Response(null, { status: 200 });
    };

    const response = await getReady();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(requestedUrl, 'https://ws-server:3001/health/ready');
  });

  it('reports unavailable when the game service cannot be reached', async () => {
    globalThis.fetch = async () => {
      throw new Error('Private endpoint and credential details must not escape.');
    };

    const response = await getReady();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});
