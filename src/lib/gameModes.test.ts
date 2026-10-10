import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BINGO_PATTERNS } from '@/lib/bingoPatterns';
import {
  BUILT_IN_GAME_MODES,
  createCustomGameMode,
  getGameMode,
  type GameMode,
} from '@/lib/gameModes';

describe('game modes', () => {
  it('provides the backwards-compatible and Standard built-in modes', () => {
    assert.deepEqual(BUILT_IN_GAME_MODES, [
      { id: 'single-row', name: 'Single Row', patterns: ['single-row'] },
      {
        id: 'standard',
        name: 'Standard',
        patterns: ['top-row', 'bottom-row', 'sint-andreas-cross', 'full-card'],
      },
    ]);
  });

  it('resolves a custom mode and falls back to Single Row for unknown IDs', () => {
    const custom: GameMode = { id: 'custom-test', name: 'Test', patterns: ['full-card'] };
    assert.equal(getGameMode('custom-test', [custom]).name, 'Test');
    assert.equal(getGameMode('missing', []).id, 'single-row');
  });

  it('creates custom modes with the chosen stage order and a unique room-local ID', () => {
    const first = createCustomGameMode('My mode', ['full-card', 'top-row'], BUILT_IN_GAME_MODES);
    assert.deepEqual(first, {
      mode: { id: 'custom-my-mode', name: 'My mode', patterns: ['full-card', 'top-row'] },
    });

    if ('error' in first) return;
    const second = createCustomGameMode('Another mode', ['bottom-row'], [
      ...BUILT_IN_GAME_MODES,
      first.mode,
    ]);
    assert.deepEqual(second, {
      mode: { id: 'custom-another-mode', name: 'Another mode', patterns: ['bottom-row'] },
    });
  });

  it('rejects empty, duplicate, invalid, or already named custom modes', () => {
    assert.deepEqual(createCustomGameMode('Custom', [], BUILT_IN_GAME_MODES), {
      error: 'Select one or more unique available patterns.',
    });
    assert.deepEqual(createCustomGameMode('Custom', ['top-row', 'top-row'], BUILT_IN_GAME_MODES), {
      error: 'Select one or more unique available patterns.',
    });
    assert.deepEqual(createCustomGameMode('Custom', ['not-a-pattern'], BUILT_IN_GAME_MODES), {
      error: 'Select one or more unique available patterns.',
    });
    assert.deepEqual(createCustomGameMode(' standard ', ['top-row'], BUILT_IN_GAME_MODES), {
      error: 'A game mode with that name already exists.',
    });
    assert.deepEqual(createCustomGameMode('  ', ['top-row'], BUILT_IN_GAME_MODES), {
      error: 'Enter a game mode name from 1 to 40 characters.',
    });
  });

  it('uses the pattern registry as the source for available pattern choices', () => {
    assert.ok(Object.keys(BINGO_PATTERNS).includes('single-row'));
    for (const pattern of Object.keys(BINGO_PATTERNS)) {
      assert.deepEqual(createCustomGameMode('Mode', [pattern], BUILT_IN_GAME_MODES), {
        mode: { id: `custom-mode`, name: 'Mode', patterns: [pattern] },
      });
    }
  });

  it('avoids ID collisions when different names produce the same slug', () => {
    const first = createCustomGameMode('Hall A', ['top-row'], BUILT_IN_GAME_MODES);
    assert.ok('mode' in first);
    if ('error' in first) return;

    assert.deepEqual(createCustomGameMode('Hall-A', ['bottom-row'], [
      ...BUILT_IN_GAME_MODES,
      first.mode,
    ]), {
      mode: { id: 'custom-hall-a-2', name: 'Hall-A', patterns: ['bottom-row'] },
    });
  });
});
