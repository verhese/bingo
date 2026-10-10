import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { openSubscriber, request, requestRaw, startGameServer, waitFor, type TestServer } from './helpers';

type State = {
  sessionId: string;
  roomName: string;
  variant: string;
  status: string;
  drawMode: string | null;
  drawnNumbers: number[];
  undoneNumbers: number[];
  gameModeId: string;
  stageIndex: number;
  currentStage: string;
  completedStages: string[];
  verifiedBingo: { claimedNumbers: number[] } | null;
  customGameModes: { id: string; name: string; patterns: string[] }[];
};
type ErrorResult = { error: string };

let server: TestServer;
const send = <T = State>(message: Record<string, unknown>) => request<T>(server.url, message);

async function createRoom(roomName: string, gameModeId = 'standard', extra: Record<string, unknown> = {}) {
  const room = await send({ action: 'create-session', roomName, gameModeId, ...extra });
  assert.ok(room && !('error' in room), 'room should be created');
  return room as State;
}

async function callNumbers(sessionId: string, numbers: number[]) {
  for (const number of numbers) await send({ action: 'call-number', sessionId, number });
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('game server (WebSocket)', () => {
  before(async () => {
    server = await startGameServer();
  });
  after(async () => {
    await server.stop();
  });

  describe('rooms', () => {
    it('creates rooms with unique ids and lists them', async () => {
      const first = await createRoom('Alpha Room');
      const second = await createRoom('Alpha Room');
      assert.equal(first.sessionId, 'alpha-room');
      assert.equal(second.sessionId, 'alpha-room-2');

      const list = await send<{ sessions: { sessionId: string; roomName: string }[] }>({ action: 'list-sessions' });
      const ids = list?.sessions.map((room) => room.sessionId) ?? [];
      assert.ok(ids.includes('alpha-room') && ids.includes('alpha-room-2') && ids.includes('default'));
    });

    it('fixes the game mode at creation and rejects unknown modes', async () => {
      const room = await createRoom('Single', 'single-row');
      assert.equal(room.gameModeId, 'single-row');
      assert.equal(room.currentStage, 'single-row');

      const defaultRoom = await send({ action: 'create-session', roomName: 'Default mode' }) as State;
      assert.equal(defaultRoom.gameModeId, 'standard');

      const rejected = await send<ErrorResult>({ action: 'create-session', roomName: 'Bad', gameModeId: 'nope' });
      assert.match(rejected?.error ?? '', /game mode/i);
    });

    it('supports custom modes defined at creation', async () => {
      const room = await createRoom('Custom', 'custom', {
        gameModeName: 'Corners',
        patterns: ['left-column', 'full-card'],
      });
      assert.equal(room.customGameModes[0].name, 'Corners');
      assert.equal(room.currentStage, 'left-column');

      const invalid = await send<ErrorResult>({
        action: 'create-session', roomName: 'Empty custom', gameModeId: 'custom', gameModeName: 'X', patterns: [],
      });
      assert.ok(invalid?.error);
    });

    it('does not apply game modes to non-75-ball rooms', async () => {
      const room = await send({
        action: 'create-session',
        roomName: 'Ninety Ball',
        variant: '90-ball',
        gameModeId: 'custom',
        gameModeName: 'Ignored',
        patterns: ['full-card'],
      });
      assert.ok(room && !('error' in room));
      assert.equal((room as State).variant, '90-ball');
      assert.equal((room as State).gameModeId, '');
      assert.deepEqual((room as State).customGameModes, []);
    });

    it('rejects changing the game mode of an existing room', async () => {
      const room = await createRoom('Locked mode');
      for (const message of [
        { action: 'select-game-mode', gameModeId: 'single-row' },
        { action: 'create-game-mode', gameModeName: 'Late', patterns: ['full-card'] },
      ]) {
        const result = await send<ErrorResult>({ ...message, sessionId: room.sessionId });
        assert.ok(result?.error);
      }
      const state = await send({ action: 'ping', sessionId: room.sessionId });
      assert.equal(state?.gameModeId, 'standard');
    });

    it('isolates draws between rooms', async () => {
      const a = await createRoom('Isolation A');
      const b = await createRoom('Isolation B');
      await callNumbers(a.sessionId, [5, 6, 7]);
      const stateA = await send({ action: 'ping', sessionId: a.sessionId });
      const stateB = await send({ action: 'ping', sessionId: b.sessionId });
      assert.deepEqual(stateA?.drawnNumbers, [5, 6, 7]);
      assert.deepEqual(stateB?.drawnNumbers, []);
    });
  });

  describe('drawing and calling', () => {
    it('draws unique numbers automatically and locks the mode to auto', async () => {
      const room = await createRoom('Auto draw');
      for (let i = 0; i < 5; i += 1) await send({ action: 'draw', sessionId: room.sessionId });
      const state = await send({ action: 'ping', sessionId: room.sessionId });
      assert.equal(state?.status, 'in-play');
      assert.equal(state?.drawMode, 'auto');
      assert.equal(new Set(state?.drawnNumbers).size, 5);

      const rejected = await send<ErrorResult>({ action: 'call-number', sessionId: room.sessionId, number: 70 });
      assert.match(rejected?.error ?? '', /automatic/i);
    });

    it('locks manual calling against automatic draws', async () => {
      const room = await createRoom('Manual draw');
      await callNumbers(room.sessionId, [10]);
      const rejected = await send<ErrorResult>({ action: 'draw', sessionId: room.sessionId });
      assert.match(rejected?.error ?? '', /manual/i);
    });

    it('undoes the last call and records it', async () => {
      const room = await createRoom('Undo');
      await callNumbers(room.sessionId, [11, 12]);
      const state = await send({ action: 'undo-last-draw', sessionId: room.sessionId, number: 12 });
      assert.deepEqual(state?.drawnNumbers, [11]);
      assert.deepEqual(state?.undoneNumbers, [12]);
    });

    it('finishes the game when every number has been drawn', async () => {
      const room = await createRoom('Exhaust', 'single-row');
      await send({ action: 'change-variant', sessionId: room.sessionId, variant: 'speedy' });
      for (let i = 0; i < 31; i += 1) await send({ action: 'draw', sessionId: room.sessionId });
      const state = await send({ action: 'ping', sessionId: room.sessionId });
      assert.equal(state?.drawnNumbers.length, 30);
      assert.equal(state?.status, 'complete');
    });
  });

  describe('multi-stage verification (standard mode)', () => {
    it('advances through every stage and completes the game', async () => {
      const room = await createRoom('Stages');
      const id = room.sessionId;
      await callNumbers(id, range(1, 30));

      const claims: [string, number[]][] = [
        ['top-row', range(1, 5)],
        ['bottom-row', range(6, 10)],
        ['sint-andreas-cross', range(1, 8)],
        ['full-card', range(1, 24)],
      ];
      for (const [index, [stage, numbers]] of claims.entries()) {
        const before = await send({ action: 'ping', sessionId: id });
        assert.equal(before?.currentStage, stage);
        assert.equal(before?.stageIndex, index);

        const result = await send({ action: 'verify-bingo', sessionId: id, claimedNumbers: numbers, expectedStageIndex: index });
        assert.deepEqual(result?.verifiedBingo?.claimedNumbers, numbers);
        assert.ok(result?.completedStages.includes(stage));
      }

      const final = await send({ action: 'ping', sessionId: id });
      assert.equal(final?.status, 'complete');
      assert.equal(final?.completedStages.length, 4);
    });

    it('requires eight numbers for the cross', async () => {
      const room = await createRoom('Cross count');
      const id = room.sessionId;
      await callNumbers(id, range(1, 20));
      await send({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
      await send({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(6, 10), expectedStageIndex: 1 });

      assert.equal(await send({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 2 }), null);
      const state = await send({ action: 'ping', sessionId: id });
      assert.equal(state?.currentStage, 'sint-andreas-cross');
      assert.deepEqual(state?.verifiedBingo?.claimedNumbers, range(6, 10));
      assert.deepEqual(state?.completedStages, ['top-row', 'bottom-row']);
    });

    it('ignores claims containing numbers that were not drawn', async () => {
      const room = await createRoom('Undrawn claim');
      await callNumbers(room.sessionId, range(1, 4));
      const result = await send({ action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
      assert.equal(result, null);
    });

    it('requires the expected stage and rejects a stale one', async () => {
      const room = await createRoom('Stale stage');
      const id = room.sessionId;
      await callNumbers(id, range(1, 10));

      const missing = await send<ErrorResult>({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5) });
      assert.match(missing?.error ?? '', /expected game stage/i);

      await send({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
      const stale = await send<ErrorResult>({
        action: 'verify-bingo', sessionId: id, claimedNumbers: range(6, 10), expectedStageIndex: 0,
      });
      assert.match(stale?.error ?? '', /stage changed/i);
      const state = await send({ action: 'ping', sessionId: id });
      assert.equal(state?.stageIndex, 1);
    });

    it('clears a verified bingo when the next number is called', async () => {
      const room = await createRoom('Clear banner');
      await callNumbers(room.sessionId, range(1, 5));
      await send({ action: 'verify-bingo', sessionId: room.sessionId, claimedNumbers: range(1, 5), expectedStageIndex: 0 });
      const after = await send({ action: 'call-number', sessionId: room.sessionId, number: 20 });
      assert.equal(after?.verifiedBingo, null);
    });
  });

  describe('reset and variants', () => {
    it('resets draws and stages but keeps the room mode and name', async () => {
      const room = await createRoom('Reset me', 'custom', { gameModeName: 'Mine', patterns: ['top-row', 'full-card'] });
      const id = room.sessionId;
      await callNumbers(id, range(1, 5));
      await send({ action: 'verify-bingo', sessionId: id, claimedNumbers: range(1, 5), expectedStageIndex: 0 });

      const reset = await send({ action: 'reset', sessionId: id });
      assert.deepEqual(reset?.drawnNumbers, []);
      assert.equal(reset?.status, 'waiting');
      assert.equal(reset?.stageIndex, 0);
      assert.deepEqual(reset?.completedStages, []);
      assert.equal(reset?.gameModeId, room.gameModeId);
      assert.equal(reset?.roomName, 'Reset me');
    });

    it('reset only affects its own room', async () => {
      const a = await createRoom('Reset A');
      const b = await createRoom('Reset B');
      await callNumbers(a.sessionId, [1, 2]);
      await callNumbers(b.sessionId, [3, 4]);
      await send({ action: 'reset', sessionId: a.sessionId });
      const stateB = await send({ action: 'ping', sessionId: b.sessionId });
      assert.deepEqual(stateB?.drawnNumbers, [3, 4]);
    });

    it('changes variant and clears the draw state', async () => {
      const room = await createRoom('Variant', 'custom', { gameModeName: 'Mine', patterns: ['top-row'] });
      await callNumbers(room.sessionId, [1, 2]);
      const state = await send({ action: 'change-variant', sessionId: room.sessionId, variant: '90-ball' });
      assert.equal(state?.variant, '90-ball');
      assert.deepEqual(state?.drawnNumbers, []);
      assert.equal(state?.status, 'waiting');
      assert.equal(state?.gameModeId, '');
      assert.deepEqual(state?.customGameModes, []);

      const backTo75 = await send({ action: 'change-variant', sessionId: room.sessionId, variant: '75-ball' });
      assert.equal(backTo75?.gameModeId, 'standard');
      assert.deepEqual(backTo75?.customGameModes, []);
    });
  });

  describe('broadcasts', () => {
    it('notifies subscribers of their own room only', async () => {
      const a = await createRoom('Broadcast A');
      const b = await createRoom('Broadcast B');
      const subA = await openSubscriber(server.url, a.sessionId);
      const subB = await openSubscriber(server.url, b.sessionId);
      try {
        await callNumbers(a.sessionId, [42]);
        await waitFor(() => subA.messages.length >= 2);
        assert.deepEqual((subA.messages.at(-1) as State).drawnNumbers, [42]);
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(subB.messages.length, 1);
      } finally {
        subA.close();
        subB.close();
      }
    });
  });

  it('ignores unknown actions', async () => {
    const reply = await request(server.url, { action: 'not-a-real-action', sessionId: 'default' });
    assert.equal(reply, null);
    const state = await send({ action: 'ping', sessionId: 'default' });
    assert.equal(state?.sessionId, 'default');
  });

  it('ignores malformed JSON messages', async () => {
    const reply = await requestRaw(server.url, '{');
    assert.equal(reply, null);
    const state = await send({ action: 'ping', sessionId: 'default' });
    assert.equal(state?.sessionId, 'default');
  });
});
