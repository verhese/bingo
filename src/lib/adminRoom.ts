import type { GameState, RoomSummary } from '@/types/game';

export function getOpenAdminRoom(
  roomId: string,
  rooms: readonly RoomSummary[],
  state: Pick<GameState, 'sessionId'> | null | undefined,
): RoomSummary | null {
  if (!roomId || state?.sessionId !== roomId) return null;
  return rooms.find((room) => room.sessionId === roomId) ?? null;
}
