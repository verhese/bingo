import { WebSocketServer, WebSocket } from 'ws';
import { VARIANTS } from '@/lib/variants';
import { generateAllNumbers, getNextNumber } from '@/lib/bingoNumbers';
import { verifyBingoNumbers } from '@/lib/bingoClaim';
import { DEFAULT_ROOM_ID, normalizeRoomId, normalizeRoomName } from '@/lib/gameRoom';
import { DEFAULT_GAME_MODE, advanceGameModeStage, getActiveStage, getGameModeStages, normalizeGameMode } from '@/lib/gameModes';
import type { GameState, GameMode, GameVariant, RoomSummary } from '@/types/game';

interface GameSession {
  gameState: GameState;
  allNumbers: number[];
}

type GameActionResult = GameState | { error: string } | null;

// In-memory game state store (sessionId → session data)
const gameSessions = new Map<string, GameSession>();

function createNewGame(
  variant: GameVariant = '75-ball',
  sessionId = DEFAULT_ROOM_ID,
  roomName = sessionId,
): GameState {
  const cfg = VARIANTS[variant];
  if (!cfg) throw new Error(`Unknown variant: ${variant}`);
  const mode = normalizeGameMode(DEFAULT_GAME_MODE);
  const stage = getActiveStage(mode, 0) ?? 'single-row';
  return {
    sessionId,
    roomName,
    variant,
    mode,
    selectedMode: mode,
    gameMode: mode,
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

function resolveRoomMode(session: GameState): GameMode {
  if (session.variant !== '75-ball') return 'single-row';
  return normalizeGameMode(session.mode ?? session.gameMode ?? session.selectedMode ?? DEFAULT_GAME_MODE);
}

function syncStageState(session: GameState, mode: GameMode = resolveRoomMode(session), stageIndex = session.stageIndex ?? 0) {
  const normalizedMode = normalizeGameMode(mode);
  const stages = getGameModeStages(normalizedMode);
  const safeIndex = Math.max(0, Math.min(stageIndex, Math.max(0, stages.length - 1)));
  const currentStage = getActiveStage(normalizedMode, safeIndex) ?? 'single-row';

  session.mode = normalizedMode;
  session.selectedMode = normalizedMode;
  session.gameMode = normalizedMode;
  session.stageIndex = safeIndex;
  session.currentStageIndex = safeIndex;
  session.activeStageIndex = safeIndex;
  session.stage = currentStage;
  session.currentStage = currentStage;
  session.activeStage = currentStage;
  return session;
}

function getOrCreateSession(sessionId?: string): GameState {
  const normalizedSessionId = normalizeRoomId(sessionId);
  if (gameSessions.has(normalizedSessionId)) {
    return gameSessions.get(normalizedSessionId)!.gameState;
  }
  const newGame = createNewGame('75-ball', normalizedSessionId, normalizedSessionId);
  gameSessions.set(newGame.sessionId, {
    gameState: newGame,
    allNumbers: generateAllNumbers(VARIANTS[newGame.variant].maxNumber),
  });
  return newGame;
}

function createSession(roomName?: string): GameState {
  const normalizedRoomName = normalizeRoomName(roomName);
  const baseId = normalizeRoomId(normalizedRoomName.replace(/\s+/g, '-'));
  let sessionId = baseId === DEFAULT_ROOM_ID ? `room-${Date.now()}` : baseId;
  let suffix = 2;
  while (gameSessions.has(sessionId)) {
    sessionId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  const gameState = createNewGame('75-ball', sessionId, normalizedRoomName);
  gameSessions.set(sessionId, {
    gameState,
    allNumbers: generateAllNumbers(VARIANTS[gameState.variant].maxNumber),
  });
  return gameState;
}

function getSessionSummaries(): RoomSummary[] {
  getOrCreateSession();
  return Array.from(gameSessions.values(), ({ gameState }) => ({
    sessionId: gameState.sessionId,
    roomName: gameState.roomName,
    variant: gameState.variant,
    drawnCount: gameState.drawnNumbers.length,
    status: gameState.status,
  })).sort((first, second) => first.roomName.localeCompare(second.roomName));
}

const port = Number(process.env.WS_PORT ?? 3001);
const wss = new WebSocketServer({ port });
const clientSessionIds = new WeakMap<WebSocket, string>();

console.log(`Bingo WebSocket server running on ws://localhost:${port}`);

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
  parsed: { action: string; sessionId?: string; roomName?: string; variant?: GameVariant; number?: number; claimedNumbers?: number[] },
): GameActionResult {
  if (parsed.action === 'create-session') return createSession(parsed.roomName);

  const session = getOrCreateSession(parsed.sessionId);
  const sessionData = gameSessions.get(session.sessionId);
  if (!sessionData) return null;

  if (parsed.action === 'undo-last-draw') return undoLastDraw(session, parsed.number);

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
    const currentMode = resolveRoomMode(session);
    const activeStage = getActiveStage(currentMode, session.stageIndex ?? 0) ?? 'single-row';
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

    const nextStageState = advanceGameModeStage(currentMode, session.stageIndex ?? 0);
    syncStageState(session, currentMode, nextStageState.currentStageIndex);
    session.completedStages = Array.from(new Set([
      ...session.completedStages,
      activeStage,
    ]));
    session.status = nextStageState.isComplete ? 'complete' : 'in-play';
    return { ...session };
  }

  if (parsed.action === 'reset') {
    const resetGame = createNewGame(session.variant, session.sessionId);
    syncStageState(resetGame, DEFAULT_GAME_MODE, 0);
    gameSessions.set(session.sessionId, {
      gameState: resetGame,
      allNumbers: generateAllNumbers(VARIANTS[resetGame.variant].maxNumber),
    });
    return resetGame;
  }

  if (parsed.action === 'change-variant' && parsed.variant && VARIANTS[parsed.variant]) {
    session.variant = parsed.variant;
    session.drawnNumbers = [];
    session.undoneNumbers = [];
    session.lastUndoneNumber = null;
    session.status = 'waiting';
    session.drawMode = null;
    session.verifiedBingo = null;
    const nextMode = parsed.variant === '75-ball' ? normalizeGameMode(session.mode ?? session.gameMode ?? session.selectedMode ?? DEFAULT_GAME_MODE) : 'single-row';
    syncStageState(session, nextMode, 0);
    gameSessions.set(session.sessionId, {
      gameState: session,
      allNumbers: generateAllNumbers(VARIANTS[parsed.variant].maxNumber),
    });
    return session;
  }

  return null;
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
    };
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return; // Ignore malformed messages
    }

    if (parsed.action === 'subscribe') {
      const session = getOrCreateSession(parsed.sessionId);
      clientSessionIds.set(ws, session.sessionId);
      ws.send(JSON.stringify(session));
      return;
    }

    if (parsed.action === 'list-sessions') {
      ws.send(JSON.stringify({ sessions: getSessionSummaries() }));
      return;
    }

    if (parsed.action === 'ping') {
      ws.send(JSON.stringify(getOrCreateSession(parsed.sessionId)));
      return;
    }

    const actionResult = handleGameAction(parsed);

    if (!actionResult) return;
    if ('error' in actionResult) {
      ws.send(JSON.stringify(actionResult));
      return;
    }

    ws.send(JSON.stringify(actionResult));
    broadcastSessionState(actionResult, ws);
  });

  ws.on('close', () => {
    console.log('Client disconnected. Total clients:', wss.clients.size);
  });

  ws.on('error', (err: Error) => {
    console.error('WebSocket error:', err.message);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down WebSocket server...');
  wss.close();
  process.exit(0);
});
