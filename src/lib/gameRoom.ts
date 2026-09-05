export const DEFAULT_ROOM_ID = 'default';

export function normalizeRoomName(value: string | undefined): string {
  const roomName = value?.trim().replace(/\s+/g, ' ');
  return roomName ? roomName.slice(0, 40) : 'New room';
}

export function normalizeRoomId(value: string | null | undefined): string {
  const roomId = value?.trim().toLowerCase();
  if (!roomId || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(roomId)) {
    return DEFAULT_ROOM_ID;
  }
  return roomId;
}