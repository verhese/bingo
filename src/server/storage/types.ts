import type { BingoPattern } from '@/lib/bingoPatterns';
import type { GameMode } from '@/lib/gameModes';
import type { GameState, GameVariant, VerifiedBingo } from '@/types/game';

/** The canonical, storage-independent shape of a room. Derived stage aliases are rebuilt on restore. */
export interface PersistedRoom {
  sessionId: string;
  roomName: string;
  variant: GameVariant;
  gameModeId: string;
  customGameModes: GameMode[];
  stageIndex: number;
  completedStages: BingoPattern[];
  drawMode: GameState['drawMode'];
  drawnNumbers: number[];
  undoneNumbers: number[];
  lastUndoneNumber: number | null;
  status: GameState['status'];
  verifiedBingo: VerifiedBingo | null;
}

export type StorageErrorCode = 'unavailable' | 'write-failed' | 'corrupt-data' | 'schema-mismatch';

/** Raised for any persistence failure. The message is safe to log; it never carries connection details. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
    this.code = code;
  }
}

/** Describes an error for the log without the connection string; uses the system error code when the message is empty. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const cause = error.cause;
  if (!(cause instanceof Error)) return error.message;
  const detail = (cause as { code?: unknown }).code ?? cause.message;
  return detail ? `${error.message} (${String(detail)})` : error.message;
}

/** Boundary between the game rules and durable storage. */
export interface RoomStore {
  /** Prepares storage (connects, applies migrations). Must complete before any other call. */
  init(): Promise<void>;
  loadRooms(): Promise<PersistedRoom[]>;
  /** Inserts a new room. Resolves false, leaving storage unchanged, if the ID already exists. */
  createRoom(room: PersistedRoom): Promise<boolean>;
  /** Replaces the stored state of an existing room, or creates it. */
  saveRoom(room: PersistedRoom): Promise<void>;
  close(): Promise<void>;
}
