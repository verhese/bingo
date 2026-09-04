export interface GameState {
  sessionId: string;
  variant: GameVariant;
  drawnNumbers: number[];
  status: 'waiting' | 'in-play' | 'complete';
}

export type GameVariant = '90-ball' | '75-ball' | 'speedy';

export interface VariantConfig {
  name: GameVariant;
  maxNumber: number;
  cardsPerGame: number;
  drawIntervalMs?: number; // for auto-draw mode
}
