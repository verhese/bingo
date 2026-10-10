import type { GameState } from '@/types/game';

export interface ObservedRoomStatus {
  roomId: string;
  status: GameState['status'];
}

/** A finished game that has been reset returns the game room to the lobby. */
export function shouldReturnToLobby(previous: ObservedRoomStatus | null, next: ObservedRoomStatus): boolean {
  return previous?.roomId === next.roomId && previous.status === 'complete' && next.status === 'waiting';
}
