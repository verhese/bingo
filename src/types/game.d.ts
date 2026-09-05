export interface GameState {
  sessionId: string;
  roomName: string;
  variant: GameVariant;
  drawnNumbers: number[];
  status: 'waiting' | 'in-play' | 'complete';
  verifiedBingo: VerifiedBingo | null;
}

export interface VerifiedBingo {
  claimedNumbers: number[];
}

export interface RoomSummary {
  sessionId: string;
  roomName: string;
  variant: GameVariant;
  drawnCount: number;
  status: GameState['status'];
}

export type GameVariant = '90-ball' | '75-ball' | 'speedy';

export interface VariantConfig {
  name: GameVariant;
  maxNumber: number;
  cardsPerGame: number;
  drawIntervalMs?: number; // for auto-draw mode
}
