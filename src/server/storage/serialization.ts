import type { BingoPattern } from '@/lib/bingoPatterns';
import type { GameMode } from '@/lib/gameModes';
import { BUILT_IN_GAME_MODES, isBingoPattern } from '@/lib/gameModes';
import { createNewGame, getStages, syncStageState } from '@/lib/gameState';
import { isGameVariant, VARIANTS } from '@/lib/variants';
import type { GameState } from '@/types/game';
import { StorageError, type PersistedRoom } from './types';

const STATUSES: readonly GameState['status'][] = ['waiting', 'in-play', 'complete'];

export function toPersistedRoom(state: GameState): PersistedRoom {
  return {
    sessionId: state.sessionId,
    roomName: state.roomName,
    variant: state.variant,
    gameModeId: state.gameModeId,
    customGameModes: state.customGameModes.map((mode) => ({ ...mode, patterns: [...mode.patterns] })),
    stageIndex: state.stageIndex,
    completedStages: [...state.completedStages],
    drawMode: state.drawMode,
    drawnNumbers: [...state.drawnNumbers],
    undoneNumbers: [...state.undoneNumbers],
    lastUndoneNumber: state.lastUndoneNumber,
    status: state.status,
    verifiedBingo: state.verifiedBingo ? { claimedNumbers: [...state.verifiedBingo.claimedNumbers] } : null,
  };
}

function corrupt(sessionId: string, problem: string): never {
  throw new StorageError('corrupt-data', `Stored room "${sessionId}" is invalid: ${problem}.`);
}

const isIntegerArray = (value: unknown): value is number[] => (
  Array.isArray(value) && value.every((item) => Number.isInteger(item))
);

/** Rebuilds the full GameState, validating the stored data so a damaged row fails loudly. */
export function fromPersistedRoom(room: PersistedRoom): GameState {
  const id = room.sessionId;
  if (!isGameVariant(room.variant)) corrupt(id, 'unknown variant');
  if (!STATUSES.includes(room.status)) corrupt(id, 'unknown status');
  if (room.drawMode !== null && room.drawMode !== 'manual' && room.drawMode !== 'auto') corrupt(id, 'unknown draw mode');
  if (!isIntegerArray(room.drawnNumbers) || !isIntegerArray(room.undoneNumbers)) corrupt(id, 'invalid call history');
  const maxNumber = VARIANTS[room.variant].maxNumber;
  const isValidNumber = (number: number) => number >= 1 && number <= maxNumber;
  if (![...room.drawnNumbers, ...room.undoneNumbers].every(isValidNumber)) corrupt(id, 'invalid call history');
  if (new Set(room.drawnNumbers).size !== room.drawnNumbers.length) corrupt(id, 'duplicate called numbers');
  if (room.lastUndoneNumber !== null && (!Number.isInteger(room.lastUndoneNumber) || !isValidNumber(room.lastUndoneNumber))) {
    corrupt(id, 'invalid last undone number');
  }
  if (!Number.isInteger(room.stageIndex) || room.stageIndex < 0) corrupt(id, 'invalid stage index');
  if (!Array.isArray(room.completedStages) || !room.completedStages.every(isBingoPattern)) corrupt(id, 'invalid completed stages');
  if (!Array.isArray(room.customGameModes) || !room.customGameModes.every(isGameMode)) corrupt(id, 'invalid custom game modes');
  if (
    room.verifiedBingo !== null
    && (!isIntegerArray(room.verifiedBingo.claimedNumbers) || !room.verifiedBingo.claimedNumbers.every(isValidNumber))
  ) {
    corrupt(id, 'invalid verified claim');
  }
  if (
    room.variant === '75-ball'
    && !BUILT_IN_GAME_MODES.some((mode) => mode.id === room.gameModeId)
    && !room.customGameModes.some((mode) => mode.id === room.gameModeId)
  ) {
    corrupt(id, 'unknown game mode');
  }

  const state = createNewGame(room.variant, room.sessionId, room.roomName, room.gameModeId, room.customGameModes);
  if (room.stageIndex >= getStages(state).length) corrupt(id, 'invalid stage index');
  state.completedStages = [...room.completedStages] as BingoPattern[];
  state.drawMode = room.drawMode;
  state.drawnNumbers = [...room.drawnNumbers];
  state.undoneNumbers = [...room.undoneNumbers];
  state.lastUndoneNumber = room.lastUndoneNumber;
  state.status = room.status;
  state.verifiedBingo = room.verifiedBingo ? { claimedNumbers: [...room.verifiedBingo.claimedNumbers] } : null;
  return syncStageState(state, room.stageIndex);
}

function isGameMode(value: unknown): value is GameMode {
  if (typeof value !== 'object' || value === null) return false;
  const mode = value as Partial<GameMode>;
  return typeof mode.id === 'string'
    && typeof mode.name === 'string'
    && Array.isArray(mode.patterns)
    && mode.patterns.length > 0
    && mode.patterns.every(isBingoPattern);
}
