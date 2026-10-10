import type { BingoPattern } from '@/lib/bingoPatterns';

export const GAME_MODES = {
  'single-row': {
    name: 'Single Row',
    stages: ['single-row'] as BingoPattern[],
  },
  standard: {
    name: 'Standard',
    stages: ['top-row', 'bottom-row', 'sint-andreas-cross', 'full-card'] as BingoPattern[],
  },
} as const;

export type GameMode = keyof typeof GAME_MODES;

export const DEFAULT_GAME_MODE: GameMode = 'single-row';

export function normalizeGameMode(mode?: string | null): GameMode {
  return mode === 'standard' ? 'standard' : 'single-row';
}

export function getGameModeStages(mode?: GameMode | string | null): BingoPattern[] {
  const normalizedMode = normalizeGameMode(mode);
  return [...GAME_MODES[normalizedMode].stages];
}

export function getActiveStage(mode: GameMode | string | null, stageIndex: number): BingoPattern | undefined {
  const stages = getGameModeStages(mode);
  if (stages.length === 0) return undefined;
  const safeIndex = Math.max(0, Math.min(stageIndex, stages.length - 1));
  return stages[safeIndex];
}

export function getNextStageIndex(mode: GameMode | string | null, stageIndex: number): number | null {
  const stages = getGameModeStages(mode);
  if (stages.length === 0) return null;
  const safeIndex = Math.max(0, Math.min(stageIndex, stages.length - 1));
  return safeIndex + 1 < stages.length ? safeIndex + 1 : null;
}

export function advanceGameModeStage(mode: GameMode | string | null, stageIndex: number) {
  const normalizedMode = normalizeGameMode(mode);
  const stages = getGameModeStages(normalizedMode);
  const lastIndex = Math.max(0, stages.length - 1);
  const safeIndex = Math.max(0, Math.min(stageIndex, lastIndex));
  const nextStageIndex = getNextStageIndex(normalizedMode, safeIndex);

  if (nextStageIndex === null) {
    return {
      currentStageIndex: safeIndex,
      currentStage: stages[safeIndex] ?? 'single-row',
      isFinalStage: true,
      isComplete: true,
    };
  }

  return {
    currentStageIndex: nextStageIndex,
    currentStage: stages[nextStageIndex],
    isFinalStage: nextStageIndex === lastIndex,
    isComplete: false,
  };
}
