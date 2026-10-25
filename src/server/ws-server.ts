import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { isGameVariant, VARIANTS } from '@/lib/variants';
import { generateAllNumbers, getNextNumber } from '@/lib/bingoNumbers';
import { verifyBingoNumbers } from '@/lib/bingoClaim';
import { BUILT_IN_GAME_MODES, DEFAULT_GAME_MODE_ID, advanceGameModeStage, createCustomGameMode } from '@/lib/gameModes';
import { DEFAULT_ROOM_ID, normalizeRoomId, normalizeRoomName } from '@/lib/gameRoom';
import { createNewGame, getStages, syncStageState } from '@/lib/gameState';
import { createRoomStore } from './storage';
import { fromPersistedRoom, toPersistedRoom } from './storage/serialization';
import { StorageError, describeError, type RoomStore } from './storage/types';
import type { GameState, GameVariant, RoomSummary } from '@/types/game';

interface GameSession {
  gameState: GameState;
  allNumbers: number[];
}

type GameActionResult = GameState | { error: string; code?: string } | null;

const STORAGE_ERROR_MESSAGE = 'The game state could not be saved. Nothing was changed; please try again.';

// Cache of every room, loaded from the room store at startup (sessionId → session data).
// A change is committed here only after the store has accepted it.
const gameSessions = new Map<string, GameSession>();

function getSession(sessionId?: string): GameState | null {
  const normalizedSessionId = normalizeRoomId(sessionId);
  const session = gameSessions.get(normalizedSessionId);
  return session ? session.gameState : null;
}

function storeSession(gameState: GameState) {
  gameSessions.set(gameState.sessionId, {
    gameState,
    allNumbers: generateAllNumbers(VARIANTS[gameState.variant].maxNumber),
  });
}

/** Builds a new room and picks its unique ID. The room is not stored until it has been persisted. */
function createSession(
  roomName?: string,
  variant: GameVariant = '75-ball',
  gameModeId = DEFAULT_GAME_MODE_ID,
  gameModeName?: unknown,
  patterns?: unknown,
): GameActionResult {
  if (!isGameVariant(variant)) return { error: 'Unknown variant.' };
  let selectedGameModeId = variant === '75-ball' ? gameModeId : DEFAULT_GAME_MODE_ID;
  let customGameModes: GameState['customGameModes'] = [];
  if (variant === '75-ball' && gameModeId === 'custom') {
    const result = createCustomGameMode(gameModeName, patterns, BUILT_IN_GAME_MODES);
    if ('error' in result) return result;
    customGameModes = [result.mode];
    selectedGameModeId = result.mode.id;
  } else if (variant === '75-ball' && !BUILT_IN_GAME_MODES.some((mode) => mode.id === gameModeId)) {
    return { error: 'Select an available game mode for the new room.' };
  }

  const normalizedRoomName = normalizeRoomName(roomName);
  const baseId = normalizeRoomId(normalizedRoomName.replace(/\s+/g, '-'));
  let sessionId = baseId === DEFAULT_ROOM_ID ? `room-${Date.now()}` : baseId;
  let suffix = 2;
  while (gameSessions.has(sessionId)) {
    sessionId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return createNewGame(variant, sessionId, normalizedRoomName, selectedGameModeId, customGameModes);
}

function getSessionSummaries(): RoomSummary[] {
  return Array.from(gameSessions.values(), ({ gameState }) => ({
    sessionId: gameState.sessionId,
    roomName: gameState.roomName,
    variant: gameState.variant,
    drawnCount: gameState.drawnNumbers.length,
    status: gameState.status,
  })).sort((first, second) => first.roomName.localeCompare(second.roomName));
}

const port = Number(process.env.WS_PORT ?? 3001);
let store: RoomStore;
// The socket server is attached to an HTTP server that only listens once storage is ready.
const httpServer = createServer();
const wss = new WebSocketServer({ noServer: true });
const clientSessionIds = new WeakMap<WebSocket, string>();
const lobbySubscribers = new Set<WebSocket>();
function broadcastSessionState(gameState: GameState, sender: WebSocket) {
  const message = JSON.stringify(gameState);
  wss.clients.forEach((client) => {
    if (
      client !== sender
      && client.readyState === WebSocket.OPEN
      && clientSessionIds.get(client) === gameState.sessionId
    ) {
      client.send(message);
    }
  });
}

function broadcastSessionSummaries() {
  const message = JSON.stringify({ sessions: getSessionSummaries() });
  lobbySubscribers.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

function undoLastDraw(session: GameState, expectedNumber?: number): GameActionResult {
  if (session.drawMode !== 'manual') {
    return { error: 'Undo is only available for manual calls.' };
  }
  if (session.status !== 'in-play' || session.drawnNumbers.length === 0) {
    return { error: 'There is no call to undo.' };
  }

  const lastNumber = session.drawnNumbers.at(-1)!;
  if (expectedNumber !== undefined && expectedNumber !== lastNumber) {
    return { error: 'The latest call changed. Review the current call before undoing.' };
  }
  session.drawnNumbers.pop();
  if (!session.undoneNumbers.includes(lastNumber)) session.undoneNumbers.push(lastNumber);
  session.lastUndoneNumber = lastNumber;
  session.verifiedBingo = null;
  return { ...session };
}

function handleGameAction(
  parsed: {
    action: string;
    sessionId?: string;
    roomName?: string;
    variant?: GameVariant;
    number?: number;
    claimedNumbers?: number[];
    expectedStageIndex?: number;
    gameModeId?: string;
    gameModeName?: unknown;
    patterns?: unknown;
  },
): GameActionResult {
  if (parsed.action === 'create-session') {
    return createSession(parsed.roomName, parsed.variant, parsed.gameModeId, parsed.gameModeName, parsed.patterns);
  }

  const sessionData = gameSessions.get(normalizeRoomId(parsed.sessionId));
  if (!sessionData) return { error: 'Room not found.' };
  // Work on a copy: the stored room is replaced only after the new state has been persisted.
  const session = structuredClone(sessionData.gameState);

  if (parsed.action === 'undo-last-draw') return undoLastDraw(session, parsed.number);

  if (parsed.action === 'create-game-mode') {
    return { error: 'Custom game modes must be configured when creating a room.' };
  }

  if (parsed.action === 'select-game-mode') {
    return { error: 'A room game mode is fixed when the room is created.' };
  }

  if (parsed.action === 'change-variant') {
    return { error: 'A room game variant is fixed when the room is created.' };
  }

  if (
    session.status === 'complete'
    && ['draw', 'call-number', 'undo-last-draw', 'verify-bingo'].includes(parsed.action)
  ) {
    return { error: 'The game is complete. Reset the game before continuing.' };
  }

  if (parsed.action === 'draw' && session.drawMode === 'manual') {
    return { error: 'Draw mode is locked to manual calls. Reset the game to switch to automatic drawing.' };
  }
  if (parsed.action === 'call-number' && session.drawMode === 'auto') {
    return { error: 'Draw mode is locked to automatic drawing. Reset the game to switch to manual calls.' };
  }

  if (parsed.action === 'draw') {
    if (session.status === 'waiting') session.status = 'in-play';
    const nextNum = getNextNumber(sessionData.allNumbers, session.drawnNumbers);
    if (nextNum !== null) {
      session.drawMode ??= 'auto';
      session.drawnNumbers.push(nextNum);
      session.undoneNumbers = session.undoneNumbers.filter((number) => number !== nextNum);
      session.lastUndoneNumber = null;
      session.verifiedBingo = null;
    }
    else session.status = 'complete';
    return { ...session };
  }

  if (parsed.action === 'call-number' && typeof parsed.number === 'number') {
    if (session.status === 'waiting') session.status = 'in-play';
    session.drawMode ??= 'manual';
    session.drawnNumbers.push(parsed.number);
    session.undoneNumbers = session.undoneNumbers.filter((number) => number !== parsed.number);
    session.lastUndoneNumber = null;
    session.verifiedBingo = null;
    return { ...session };
  }

  if (parsed.action === 'verify-bingo') {
    if (!Number.isInteger(parsed.expectedStageIndex)) {
      return { error: 'The expected game stage is required to verify Bingo.' };
    }
    if (parsed.expectedStageIndex !== session.stageIndex) {
      return { error: 'The game stage changed. Review the active stage before verifying Bingo.' };
    }

    const stages = getStages(session);
    const activeStage = stages[Math.min(session.stageIndex ?? 0, stages.length - 1)] ?? 'single-row';
    const verification = verifyBingoNumbers(
      parsed.claimedNumbers ?? [],
      session.drawnNumbers,
      session.variant,
      session.variant === '75-ball' ? activeStage : 'single-row',
    );
    if (!verification.isVerified) return null;

    session.verifiedBingo = { claimedNumbers: verification.claimedNumbers };
    if (session.variant !== '75-ball') {
      return { ...session };
    }

    const nextStageState = advanceGameModeStage(session.gameModeId, session.stageIndex ?? 0, session.customGameModes);
    syncStageState(session, nextStageState.currentStageIndex);
    session.completedStages = Array.from(new Set([
      ...session.completedStages,
      activeStage,
    ]));
    session.status = nextStageState.isComplete ? 'complete' : 'in-play';
    return { ...session };
  }

  if (parsed.action === 'reset') {
    const resetGame = createNewGame(session.variant, session.sessionId, session.roomName);
    resetGame.gameModeId = session.variant === '75-ball' ? session.gameModeId : '';
    resetGame.customGameModes = session.variant === '75-ball' ? session.customGameModes : [];
    syncStageState(resetGame, 0);
    return resetGame;
  }

  return null;
}

const roomLocks = new Map<string, Promise<unknown>>();

/** Runs actions for one key strictly one after another, so a persisted change never interleaves with another. */
function runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = roomLocks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  const tail = next.catch(() => undefined);
  roomLocks.set(key, tail);
  void tail.then(() => {
    if (roomLocks.get(key) === tail) roomLocks.delete(key);
  });
  return next;
}

/** Applies an action and persists the result before it becomes visible to any client. */
function applyGameAction(parsed: Parameters<typeof handleGameAction>[0]): Promise<GameActionResult> {
  const lockKey = parsed.action === 'create-session' ? '\0create' : normalizeRoomId(parsed.sessionId);
  return runExclusive(lockKey, async () => {
    const result = handleGameAction(parsed);
    if (!result || 'error' in result) return result;

    try {
      if (parsed.action === 'create-session') {
        const created = await store.createRoom(toPersistedRoom(result));
        if (!created) return { error: 'A room with that ID already exists. Please try again.' };
      } else {
        await store.saveRoom(toPersistedRoom(result));
      }
    } catch (error) {
      reportStorageFailure(parsed.action, error);
      return { error: STORAGE_ERROR_MESSAGE, code: 'storage-error' };
    }
    storeSession(result);
    return result;
  });
}

function reportStorageFailure(action: string, error: unknown) {
  const code = error instanceof StorageError ? error.code : 'unknown';
  console.error(`Storage failure during "${action}" [${code}]: ${describeError(error)}`);
}

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected. Total clients:', wss.clients.size);

  ws.on('message', (data: Buffer) => {
    let parsed: {
      action: string;
      sessionId?: string;
      roomName?: string;
      variant?: GameVariant;
      number?: number;
      claimedNumbers?: number[];
      expectedStageIndex?: number;
      gameModeId?: string;
      gameModeName?: unknown;
      patterns?: unknown;
    };
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return; // Ignore malformed messages
    }

    if (parsed.action === 'subscribe') {
      const session = getSession(parsed.sessionId);
      if (!session) {
        ws.send(JSON.stringify({ error: 'Room not found.' }));
        return;
      }
      clientSessionIds.set(ws, session.sessionId);
      ws.send(JSON.stringify(session));
      return;
    }

    if (parsed.action === 'list-sessions') {
      ws.send(JSON.stringify({ sessions: getSessionSummaries() }));
      return;
    }

    if (parsed.action === 'subscribe-lobby') {
      lobbySubscribers.add(ws);
      ws.send(JSON.stringify({ sessions: getSessionSummaries() }));
      return;
    }

    if (parsed.action === 'ping') {
      const session = getSession(parsed.sessionId);
      if (!session) {
        ws.send(JSON.stringify({ error: 'Room not found.' }));
        return;
      }
      ws.send(JSON.stringify(session));
      return;
    }

    void (async () => {
      let actionResult: GameActionResult;
      try {
        actionResult = await applyGameAction(parsed);
      } catch (error) {
        console.error('Unexpected failure handling action:', error instanceof Error ? error.message : error);
        actionResult = { error: 'The action could not be completed.' };
      }

      if (!actionResult) return;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(actionResult));
      if ('error' in actionResult) return;

      broadcastSessionState(actionResult, ws);
      broadcastSessionSummaries();
    })();
  });

  ws.on('close', () => {
    lobbySubscribers.delete(ws);
    console.log('Client disconnected. Total clients:', wss.clients.size);
  });

  ws.on('error', (err: Error) => {
    console.error('WebSocket error:', err.message);
  });
});

/** Loads persisted rooms, makes sure the default room exists, then starts accepting connections. */
async function start() {
  store = createRoomStore();
  await store.init();

  for (const room of await store.loadRooms()) storeSession(fromPersistedRoom(room));
  if (!gameSessions.has(DEFAULT_ROOM_ID)) {
    const defaultRoom = createNewGame('75-ball', DEFAULT_ROOM_ID, DEFAULT_ROOM_ID);
    await store.createRoom(toPersistedRoom(defaultRoom));
    storeSession(defaultRoom);
  }
  console.log(`Restored ${gameSessions.size} room(s) from storage`);

  httpServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, resolve);
  });
  console.log(`Bingo WebSocket server running on ws://localhost:${port}`);
}

async function shutdown() {
  console.log('\nShutting down WebSocket server...');
  wss.close();
  httpServer.close();
  await store?.close().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

start().catch((error) => {
  console.error(`Bingo WebSocket server could not start: ${describeError(error)}`);
  process.exit(1);
});
