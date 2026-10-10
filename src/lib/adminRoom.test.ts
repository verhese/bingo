import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getOpenAdminRoom } from './adminRoom';
import type { RoomSummary } from '@/types/game';

const rooms: RoomSummary[] = [
  { sessionId: 'friday-night', roomName: 'Friday Night', variant: '75-ball', drawnCount: 0, status: 'waiting' },
];

describe('admin room readiness', () => {
  it('returns the selected room only after its matching game state is open', () => {
    assert.deepEqual(getOpenAdminRoom('friday-night', rooms, { sessionId: 'friday-night' }), rooms[0]);
  });

  it('keeps controls unavailable without a selection, a listed room, or matching state', () => {
    assert.equal(getOpenAdminRoom('', rooms, { sessionId: 'friday-night' }), null);
    assert.equal(getOpenAdminRoom('missing-room', rooms, { sessionId: 'missing-room' }), null);
    assert.equal(getOpenAdminRoom('friday-night', rooms, null), null);
    assert.equal(getOpenAdminRoom('friday-night', rooms, { sessionId: 'another-room' }), null);
  });
});
