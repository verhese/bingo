export const DEFAULT_ROOM_ID = 'default';

export function normalizeRoomId(value: string | null | undefined): string {
  const roomId = value?.trim().toLowerCase();
  if (!roomId || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(roomId)) {
    return DEFAULT_ROOM_ID;
  }
  return roomId;
}