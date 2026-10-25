import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createNewGame, syncStageState } from '@/lib/gameState';
import { createRoomStore } from './index';
import { MIGRATIONS } from './postgres';
import { fromPersistedRoom, toPersistedRoom } from './serialization';
import { StorageError, type PersistedRoom } from './types';

function playedRoom() {
  const state = createNewGame('75-ball', 'hall-a', 'Hall A', 'custom-finals', [
    { id: 'custom-finals', name: 'Finals', patterns: ['top-row', 'full-card'] },
  ]);
  state.drawMode = 'manual';
  state.status = 'in-play';
  state.drawnNumbers = [12, 7, 42];
  state.undoneNumbers = [9];
  state.lastUndoneNumber = 9;
  state.completedStages = ['top-row'];
  state.verifiedBingo = { claimedNumbers: [12, 7, 42] };
  return syncStageState(state, 1);
}

describe('room serialization', () => {
  it('round-trips a room including undo state, stage progress and the verified claim', () => {
    const state = playedRoom();
    const restored = fromPersistedRoom(toPersistedRoom(state));
    assert.deepEqual(restored, state);
    assert.equal(restored.currentStage, 'full-card');
  });

  it('round-trips rooms of every variant', () => {
    for (const variant of ['90-ball', 'speedy'] as const) {
      const state = createNewGame(variant, `room-${variant}`, variant);
      state.drawMode = 'auto';
      state.drawnNumbers = [3, 1];
      assert.deepEqual(fromPersistedRoom(toPersistedRoom(state)), state);
    }
  });

  it('copies state so later changes do not alter the persisted snapshot', () => {
    const state = playedRoom();
    const persisted = toPersistedRoom(state);
    state.drawnNumbers.push(60);
    state.verifiedBingo!.claimedNumbers.push(60);
    assert.deepEqual(persisted.drawnNumbers, [12, 7, 42]);
    assert.deepEqual(persisted.verifiedBingo, { claimedNumbers: [12, 7, 42] });
  });

  it('rejects damaged stored rooms instead of loading them', () => {
    const valid = toPersistedRoom(playedRoom());
    const damaged: Partial<PersistedRoom>[] = [
      { variant: 'bogus' as PersistedRoom['variant'] },
      { status: 'finished' as PersistedRoom['status'] },
      { drawMode: 'both' as PersistedRoom['drawMode'] },
      { drawnNumbers: [1, 1] },
      { drawnNumbers: [1.5] },
      { stageIndex: -1 },
      { completedStages: ['nope' as PersistedRoom['completedStages'][number]] },
      { customGameModes: [{ id: 1 }] as unknown as PersistedRoom['customGameModes'] },
      { verifiedBingo: { claimedNumbers: ['x'] } as unknown as PersistedRoom['verifiedBingo'] },
    ];
    for (const change of damaged) {
      assert.throws(
        () => fromPersistedRoom({ ...valid, ...change }),
        (error: unknown) => error instanceof StorageError && error.code === 'corrupt-data',
        JSON.stringify(change),
      );
    }
  });
});

describe('storage configuration', () => {
  it('requires DATABASE_URL', () => {
    assert.throws(() => createRoomStore({}), /DATABASE_URL is not set/);
    assert.throws(() => createRoomStore({ DATABASE_URL: '  ' }), /DATABASE_URL is not set/);
  });

  it('does not echo the connection string in its error', () => {
    try {
      createRoomStore({});
    } catch (error) {
      assert.doesNotMatch((error as Error).message, /password@/);
    }
  });
});

describe('migrations', () => {
  it('are numbered consecutively from 1 with unique names', () => {
    assert.deepEqual(MIGRATIONS.map(({ version }) => version), MIGRATIONS.map((_, index) => index + 1));
    assert.equal(new Set(MIGRATIONS.map(({ name }) => name)).size, MIGRATIONS.length);
  });
});
