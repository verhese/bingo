import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldReturnToLobby } from './lobbyRedirect';

describe('shouldReturnToLobby', () => {
  it('returns to the lobby when a complete game is reset', () => {
    assert.equal(shouldReturnToLobby({ roomId: 'a', status: 'complete' }, { roomId: 'a', status: 'waiting' }), true);
  });

  it('stays in the room for resets of unfinished games', () => {
    assert.equal(shouldReturnToLobby({ roomId: 'a', status: 'in-play' }, { roomId: 'a', status: 'waiting' }), false);
  });

  it('ignores the first observed state and other transitions', () => {
    assert.equal(shouldReturnToLobby(null, { roomId: 'a', status: 'waiting' }), false);
    assert.equal(shouldReturnToLobby({ roomId: 'a', status: 'waiting' }, { roomId: 'a', status: 'in-play' }), false);
    assert.equal(shouldReturnToLobby({ roomId: 'a', status: 'in-play' }, { roomId: 'a', status: 'complete' }), false);
  });

  it('ignores a complete room followed by a different waiting room', () => {
    assert.equal(shouldReturnToLobby({ roomId: 'a', status: 'complete' }, { roomId: 'b', status: 'waiting' }), false);
  });
});
