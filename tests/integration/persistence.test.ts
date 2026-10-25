import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Client } from 'pg';
import { startTestDatabase, type TestDatabase } from '../support/postgres';
import { openLobbySubscriber, openSubscriber, request, spawnGameServer, startGameServer, type TestServer } from './helpers';

type State = {
  sessionId: string;
  roomName: string;
  variant: string;
  status: string;
  drawMode: string | null;
  drawnNumbers: number[];
  undoneNumbers: number[];
  lastUndoneNumber: number | null;
  gameModeId: string;
  stageIndex: number;
  currentStage: string;
  completedStages: string[];
  verifiedBingo: { claimedNumbers: number[] } | null;
  customGameModes: { id: string; name: string; patterns: string[] }[];
};
type ErrorResult = { error: string; code?: string };
type RoomList = { sessions: { sessionId: string; drawnCount: number }[] };

const OUTAGE_TIMEOUT_MS = 10_000;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

let database: TestDatabase;
let server: TestServer | undefined;

async function startServer(env: Record<string, string> = {}) {
  server = await startGameServer({ databaseUrl: database.url, env });
  return server;
}

async function restartServer() {
  await server?.stop();
  return startServer();
}

const send = <T = State>(message: Record<string, unknown>, timeoutMs = 3_000) => request<T>(server!.url, message, timeoutMs);

async function createRoom(roomName: string, extra: Record<string, unknown> = {}) {
  const room = await send({ action: 'create-session', roomName, ...extra });
  assert.ok(room && !('error' in room), `room "${roomName}" should be created`);
  return room as State;
}

async function callNumbers(sessionId: string, numbers: number[]) {
  for (const number of numbers) {
    const result = await send<State | ErrorResult>({ action: 'call-number', sessionId, number });
    assert.ok(result && !('error' in result), `call ${number}`);
  }
}

async function query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const client = new Client({ connectionString: database.url });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

describe('persistence across restarts', () => {
  before(async () => {
    database = await startTestDatabase();
  });
  after(async () => {
    await server?.stop();
    await database.dispose();
  });

  it('creates the schema and the default room on first start, and keeps them on later starts', async () => {
    await startServer();
    assert.deepEqual(await query('SELECT version, name FROM schema_migrations ORDER BY version'), [{ version: 1, name: 'create-rooms' }]);
    assert.deepEqual((await query('SELECT session_id FROM rooms')).map((row) => row.session_id), ['default']);

    await callNumbers('default', [5]);
    await restartServer();
    assert.equal((await query('SELECT count(*)::int AS count FROM schema_migrations'))[0].count, 1);
    assert.deepEqual((await send({ action: 'ping', sessionId: 'default' }))?.drawnNumbers, [5]);
    assert.equal((await query('SELECT count(*)::int AS count FROM rooms'))[0].count, 1);
  });

  it('persists calls and undo, and restores them exactly after a restart', async () => {
    await restartServer();
    const room = await createRoom('Restore me');
    await callNumbers(room.sessionId, [11, 22, 33]);
    await send({ action: 'undo-last-draw', sessionId: room.sessionId, number: 33 });
    const before = await send({ action: 'ping', sessionId: room.sessionId });
    assert.deepEqual(before?.drawnNumbers, [11, 22]);

    const [row] = await query('SELECT drawn_numbers, undone_numbers, last_undone_number, draw_mode, status FROM rooms WHERE session_id = $1', [room.sessionId]);
    assert.deepEqual(row, {
      drawn_numbers: [11, 22], undone_numbers: [33], last_undone_number: 33, draw_mode: 'manual', status: 'in-play',
    });

    await restartServer();
    assert.deepEqual(await send({ action: 'ping', sessionId: room.sessionId }), before);
    const listed = await send<RoomList>({ action: 'list-sessions' });
    assert.equal(listed?.sessions.find((summary) => summary.sessionId === room.sessionId)?.drawnCount, 2);
  });

  it('restores automatic draws and keeps drawing without repeats', async () => {
    const room = await createRoom('Auto restore', { gameModeId: 'single-row' });
    for (let i = 0; i < 4; i += 1) await send({ action: 'draw', sessionId: room.sessionId });
    const before = await send({ action: 'ping', sessionId: room.sessionId });

    await restartServer();
    const restored = await send({ action: 'ping', sessionId: room.sessionId });
    assert.deepEqual(restored, before);
    assert.equal(restored?.drawMode, 'auto');

    for (let i = 0; i < 3; i += 1) await send({ action: 'draw', sessionId: room.sessionId });
    const after = await send({ action: 'ping', sessionId: room.sessionId });
    assert.equal(new Set(after?.drawnNumbers).size, 7);
    assert.deepEqual(after?.drawnNumbers.slice(0, 4), before?.drawnNumbers);
  });

  it('restores mode, stage progress and the verified claim', async () => {
    const room = await createRoom('Stage restore');
    await callNumbers(room.sessionId, range(1, 10));
    await send({ action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
    const before = await send({ action: 'ping', sessionId: room.sessionId });
    assert.equal(before?.stageIndex, 1);
    assert.deepEqual(before?.completedStages, ['top-row']);
    assert.deepEqual(before?.verifiedBingo, { claimedNumbers: range(1, 5) });

    await restartServer();
    assert.deepEqual(await send({ action: 'ping', sessionId: room.sessionId }), before);

    const next = await send({ action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(6, 10), expectedStageIndex: 1 });
    assert.equal(next?.stageIndex, 2);
  });

  it('restores a completed game and keeps it locked until reset', async () => {
    const room = await createRoom('Complete restore', { gameModeId: 'single-row' });
    await callNumbers(room.sessionId, range(1, 5));
    await send({ action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
    assert.equal((await send({ action: 'ping', sessionId: room.sessionId }))?.status, 'complete');

    await restartServer();
    assert.equal((await send({ action: 'ping', sessionId: room.sessionId }))?.status, 'complete');
    const blocked = await send<ErrorResult>({ action: 'call-number', sessionId: room.sessionId, number: 40 });
    assert.match(blocked?.error ?? '', /complete/i);
  });

  it('restores custom modes and rooms of other variants', async () => {
    const custom = await createRoom('Custom restore', { gameModeId: 'custom', gameModeName: 'Corners', patterns: ['left-column', 'full-card'] });
    const ninety = await createRoom('Ninety restore', { variant: '90-ball' });
    const speedy = await createRoom('Speedy restore', { variant: 'speedy' });
    await callNumbers(ninety.sessionId, [88, 3]);
    await callNumbers(speedy.sessionId, [30]);

    await restartServer();
    const restoredCustom = await send({ action: 'ping', sessionId: custom.sessionId });
    assert.deepEqual(restoredCustom?.customGameModes, custom.customGameModes);
    assert.equal(restoredCustom?.currentStage, 'left-column');
    const restoredNinety = await send({ action: 'ping', sessionId: ninety.sessionId });
    assert.equal(restoredNinety?.variant, '90-ball');
    assert.deepEqual(restoredNinety?.drawnNumbers, [88, 3]);
    assert.equal((await send({ action: 'ping', sessionId: speedy.sessionId }))?.variant, 'speedy');
  });

  it('persists a reset and restores the cleared room with its mode and name', async () => {
    const room = await createRoom('Reset persisted', { gameModeId: 'custom', gameModeName: 'Mine', patterns: ['top-row', 'full-card'] });
    await callNumbers(room.sessionId, range(1, 5));
    await send({ action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
    await send({ action: 'reset', sessionId: room.sessionId });

    await restartServer();
    const restored = await send({ action: 'ping', sessionId: room.sessionId });
    assert.deepEqual(restored?.drawnNumbers, []);
    assert.deepEqual(restored?.undoneNumbers, []);
    assert.deepEqual(restored?.completedStages, []);
    assert.equal(restored?.drawMode, null);
    assert.equal(restored?.verifiedBingo, null);
    assert.equal(restored?.status, 'waiting');
    assert.equal(restored?.stageIndex, 0);
    assert.equal(restored?.roomName, 'Reset persisted');
    assert.equal(restored?.gameModeId, room.gameModeId);
    assert.deepEqual(restored?.customGameModes, room.customGameModes);
  });

  it('keeps rooms isolated in storage, including reset', async () => {
    const a = await createRoom('Store iso A');
    const b = await createRoom('Store iso B');
    await callNumbers(a.sessionId, [1, 2]);
    await callNumbers(b.sessionId, [3, 4]);
    await send({ action: 'reset', sessionId: a.sessionId });

    await restartServer();
    assert.deepEqual((await send({ action: 'ping', sessionId: a.sessionId }))?.drawnNumbers, []);
    assert.deepEqual((await send({ action: 'ping', sessionId: b.sessionId }))?.drawnNumbers, [3, 4]);
  });

  it('keeps room IDs unique across restarts', async () => {
    const first = await createRoom('Same name');
    await callNumbers(first.sessionId, [10]);
    await restartServer();
    const second = await createRoom('Same name');
    assert.equal(first.sessionId, 'same-name');
    assert.equal(second.sessionId, 'same-name-2');
    assert.deepEqual((await send({ action: 'ping', sessionId: first.sessionId }))?.drawnNumbers, [10]);
  });

  it('does not recreate the default room over a stored one', async () => {
    await send({ action: 'reset', sessionId: 'default' });
    await callNumbers('default', [60, 61]);
    await restartServer();
    assert.deepEqual((await send({ action: 'ping', sessionId: 'default' }))?.drawnNumbers, [60, 61]);
  });

  it('serialises concurrent actions on one room without losing any', async () => {
    const room = await createRoom('Concurrent');
    const numbers = range(1, 25);
    await Promise.all(numbers.map((number) => send({ action: 'call-number', sessionId: room.sessionId, number })));
    const live = await send({ action: 'ping', sessionId: room.sessionId });
    assert.deepEqual([...live!.drawnNumbers].sort((x, y) => x - y), numbers);

    await restartServer();
    assert.deepEqual((await send({ action: 'ping', sessionId: room.sessionId }))?.drawnNumbers, live?.drawnNumbers);
  });
});

describe('storage failures', () => {
  before(async () => {
    database = await startTestDatabase();
    await startServer();
  });
  after(async () => {
    await server?.stop();
    await database.dispose();
  });

  it('rejects every kind of change while the database is down, without altering state or notifying clients', async () => {
    const room = await createRoom('Outage');
    const other = await createRoom('Outage lobby');
    await callNumbers(room.sessionId, range(1, 5));
    const before = await send({ action: 'ping', sessionId: room.sessionId });
    const subscriber = await openSubscriber(server!.url, room.sessionId);
    const lobby = await openLobbySubscriber(server!.url);
    const roomMessages = subscriber.messages.length;
    const lobbyMessages = lobby.messages.length;

    await database.pause();
    try {
      const attempts: Record<string, unknown>[] = [
        { action: 'call-number', sessionId: room.sessionId, number: 30 },
        { action: 'draw', sessionId: other.sessionId },
        { action: 'undo-last-draw', sessionId: room.sessionId, number: 5 },
        { action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(1, 5), expectedStageIndex: 0 },
        { action: 'reset', sessionId: room.sessionId },
        { action: 'create-session', roomName: 'Never stored' },
      ];
      for (const attempt of attempts) {
        const result = await send<ErrorResult>(attempt, OUTAGE_TIMEOUT_MS);
        assert.equal(result?.code, 'storage-error', String(attempt.action));
        assert.match(result?.error ?? '', /could not be saved/i);
        assert.doesNotMatch(result?.error ?? '', /ECONNREFUSED|postgres|bingo-test/i);
      }

      assert.deepEqual(await send({ action: 'ping', sessionId: room.sessionId }), before);
      assert.deepEqual((await send({ action: 'ping', sessionId: other.sessionId }))?.drawnNumbers, []);
      const listed = await send<RoomList>({ action: 'list-sessions' });
      assert.ok(!listed?.sessions.some((summary) => summary.sessionId.startsWith('never-stored')));
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(subscriber.messages.length, roomMessages);
      assert.equal(lobby.messages.length, lobbyMessages);
    } finally {
      subscriber.close();
      lobby.close();
      await database.resume();
    }

    const recovered = await send<State | ErrorResult>({ action: 'call-number', sessionId: room.sessionId, number: 30 }, OUTAGE_TIMEOUT_MS);
    assert.ok(recovered && !('error' in recovered), 'the same call succeeds once storage is back');
    assert.deepEqual(recovered.drawnNumbers, [...range(1, 5), 30]);
    const [row] = await query('SELECT drawn_numbers FROM rooms WHERE session_id = $1', [room.sessionId]);
    assert.deepEqual(row.drawn_numbers, [...range(1, 5), 30]);
  });

  it('does not write credentials or connection details to the server log', async () => {
    const logs = server!.logs();
    assert.match(logs, /Storage failure/);
    assert.doesNotMatch(logs, /bingo-test/);
    assert.doesNotMatch(logs, /postgres:\/\//);
  });

  it('rolls back a failed room creation instead of reserving its ID', async () => {
    await database.pause();
    try {
      const failed = await send<ErrorResult>({ action: 'create-session', roomName: 'Reserved name' }, OUTAGE_TIMEOUT_MS);
      assert.equal(failed?.code, 'storage-error');
    } finally {
      await database.resume();
    }
    const created = await send<State | ErrorResult>({ action: 'create-session', roomName: 'Reserved name' }, OUTAGE_TIMEOUT_MS);
    assert.ok(created && !('error' in created));
    assert.equal(created.sessionId, 'reserved-name');
  });
});

describe('startup', () => {
  before(async () => {
    database = await startTestDatabase();
  });
  after(async () => {
    await database.dispose();
  });

  it('refuses to start without DATABASE_URL', async () => {
    await assert.rejects(spawnGameServer({ DATABASE_URL: '' }), /DATABASE_URL is not set/);
  });

  it('refuses to start when the database is unreachable, without leaking the connection string', async () => {
    await database.pause();
    try {
      await assert.rejects(
        spawnGameServer({ DATABASE_URL: database.url, DATABASE_CONNECT_ATTEMPTS: '2' }),
        (error: Error) => /could not start/.test(error.message) && !/bingo-test/.test(error.message),
      );
    } finally {
      await database.resume();
    }
  });

  it('waits for a database that is still starting', async () => {
    await database.pause();
    const pending = spawnGameServer({ DATABASE_URL: database.url, DATABASE_CONNECT_ATTEMPTS: '20' });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await database.resume();
    const started = await pending;
    try {
      const state = await request<State>(started.url, { action: 'ping', sessionId: 'default' }, 3_000);
      assert.equal(state?.sessionId, 'default');
    } finally {
      await started.stop();
    }
  });

  it('refuses to start against a database from a newer version', async () => {
    const first = await spawnGameServer({ DATABASE_URL: database.url });
    await first.stop();
    await query("INSERT INTO schema_migrations (version, name) VALUES (999, 'from-the-future')");
    await assert.rejects(spawnGameServer({ DATABASE_URL: database.url }), /newer than this service supports/);
    await query('DELETE FROM schema_migrations WHERE version = 999');
  });

  it('refuses to start when a stored room is damaged, rather than dropping it', async () => {
    await query(
      `INSERT INTO rooms (session_id, room_name, variant, game_mode_id, custom_game_modes, status)
       VALUES ('damaged', 'Damaged', '75-ball', 'custom-x', '[{"id": 1}]'::jsonb, 'waiting')`,
    );
    await assert.rejects(spawnGameServer({ DATABASE_URL: database.url }), /Stored room "damaged" is invalid/);
    await query("DELETE FROM rooms WHERE session_id = 'damaged'");
    const started = await spawnGameServer({ DATABASE_URL: database.url });
    await started.stop();
  });

  it('lets two services start at once without conflicting migrations', async () => {
    const fresh = await startTestDatabase();
    try {
      const [one, two] = await Promise.all([
        spawnGameServer({ DATABASE_URL: fresh.url }),
        spawnGameServer({ DATABASE_URL: fresh.url }),
      ]);
      await Promise.all([one.stop(), two.stop()]);
    } finally {
      await fresh.dispose();
    }
  });
});
