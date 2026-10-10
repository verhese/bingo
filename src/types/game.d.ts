import type { BingoPattern } from '@/lib/bingoPatterns';

export type GameMode = 'single-row' | 'standard';

export interface GameState {
  sessionId: string;
  roomName: string;
  variant: GameVariant;
  mode: GameMode;
  selectedMode: GameMode;
  gameMode: GameMode;
  stageIndex: number;
  currentStageIndex: number;
  activeStageIndex: number;
  stage: BingoPattern;
  currentStage: BingoPattern;
  activeStage: BingoPattern;
  completedStages: BingoPattern[];
  drawMode: 'manual' | 'auto' | null;
  drawnNumbers: number[];
  undoneNumbers: number[];
  lastUndoneNumber: number | null;
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
