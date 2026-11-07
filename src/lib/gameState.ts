import { VARIANTS } from '@/lib/variants';
import { DEFAULT_GAME_MODE_ID, getActiveStage, getGameModeStages } from '@/lib/gameModes';
import { DEFAULT_ROOM_ID } from '@/lib/gameRoom';
import type { GameState, GameVariant } from '@/types/game';

export function createNewGame(
  variant: GameVariant = '75-ball',
  sessionId = DEFAULT_ROOM_ID,
  roomName = sessionId,
  gameModeId = DEFAULT_GAME_MODE_ID,
  customGameModes: GameState['customGameModes'] = [],
): GameState {
  const cfg = VARIANTS[variant];
  if (!cfg) throw new Error(`Unknown variant: ${variant}`);
  const effectiveGameModeId = variant === '75-ball' ? gameModeId : '';
  const stage = getActiveStage(effectiveGameModeId, 0, customGameModes) ?? 'single-row';
  return {
    sessionId,
    roomName,
    variant,
    gameModeId: effectiveGameModeId,
    customGameModes,
    mode: effectiveGameModeId,
    selectedMode: effectiveGameModeId,
    gameMode: effectiveGameModeId,
    stageIndex: 0,
    currentStageIndex: 0,
    activeStageIndex: 0,
    stage,
    currentStage: stage,
    activeStage: stage,
    completedStages: [],
    drawMode: null,
    drawnNumbers: [],
    undoneNumbers: [],
    lastUndoneNumber: null,
    status: 'waiting',
    verifiedBingo: null,
  };
}

export function getStages(session: GameState) {
  return session.variant === '75-ball'
    ? getGameModeStages(session.gameModeId, session.customGameModes)
    : getGameModeStages('single-row');
}

export function syncStageState(session: GameState, stageIndex = session.stageIndex ?? 0) {
  const stages = getStages(session);
  const safeIndex = Math.max(0, Math.min(stageIndex, Math.max(0, stages.length - 1)));
  const currentStage = stages[safeIndex] ?? 'single-row';

  session.mode = session.gameModeId;
  session.selectedMode = session.gameModeId;
  session.gameMode = session.gameModeId;
  session.stageIndex = safeIndex;
  session.currentStageIndex = safeIndex;
  session.activeStageIndex = safeIndex;
  session.stage = currentStage;
  session.currentStage = currentStage;
  session.activeStage = currentStage;
  return session;
}
