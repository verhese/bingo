import { WebSocketServer, WebSocket } from 'ws';
import { VARIANTS } from '@/lib/variants';
import { generateAllNumbers, getNextNumber } from '@/lib/bingoNumbers';
import { verifyBingoNumbers } from '@/lib/bingoClaim';
import { DEFAULT_ROOM_ID, normalizeRoomId, normalizeRoomName } from '@/lib/gameRoom';
import type { GameState, GameVariant, RoomSummary } from '@/types/game';

interface GameSession {
  gameState: GameState;
  allNumbers: number[];
}

// In-memory game state store (sessionId → session data)
const gameSessions = new Map<string, GameSession>();

function createNewGame(
  variant: GameVariant = '90-ball',
  sessionId = DEFAULT_ROOM_ID,
  roomName = sessionId,
): GameState {
  const cfg = VARIANTS[variant];
  if (!cfg) throw new Error(`Unknown variant: ${variant}`);
  return {
    sessionId,
    roomName,
    variant,
    drawnNumbers: [],
    status: 'waiting',
    verifiedBingo: null,
  };
}

function getOrCreateSession(sessionId?: string): GameState {
  const normalizedSessionId = normalizeRoomId(sessionId);
  if (gameSessions.has(normalizedSessionId)) {
    return gameSessions.get(normalizedSessionId)!.gameState;
  }
  const newGame = createNewGame('90-ball', normalizedSessionId, normalizedSessionId);
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
  const gameState = createNewGame('90-ball', sessionId, normalizedRoomName);
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

function handleGameAction(
  parsed: { action: string; sessionId?: string; roomName?: string; variant?: GameVariant; number?: number; claimedNumbers?: number[] },
): GameState | null {
  if (parsed.action === 'create-session') return createSession(parsed.roomName);

  const session = getOrCreateSession(parsed.sessionId);
  const sessionData = gameSessions.get(session.sessionId);
  if (!sessionData) return null;

  if (parsed.action === 'draw') {
    if (session.status === 'waiting') session.status = 'in-play';
    const nextNum = getNextNumber(sessionData.allNumbers, session.drawnNumbers);
    if (nextNum !== null) {
      session.drawnNumbers.push(nextNum);
      session.verifiedBingo = null;
    }
    else session.status = 'complete';
    return { ...session };
  }

  if (parsed.action === 'call-number' && typeof parsed.number === 'number') {
    if (session.status === 'waiting') session.status = 'in-play';
    session.drawnNumbers.push(parsed.number);
    session.verifiedBingo = null;
    return { ...session };
  }

  if (parsed.action === 'verify-bingo') {
    const verification = verifyBingoNumbers(
      parsed.claimedNumbers ?? [],
      session.drawnNumbers,
      session.variant,
    );
    if (!verification.isVerified) return null;

    session.verifiedBingo = { claimedNumbers: verification.claimedNumbers };
    return { ...session };
  }

  if (parsed.action === 'reset') {
    const resetGame = createNewGame(session.variant, session.sessionId);
    gameSessions.set(session.sessionId, {
      gameState: resetGame,
      allNumbers: generateAllNumbers(VARIANTS[resetGame.variant].maxNumber),
    });
    return resetGame;
  }

  if (parsed.action === 'change-variant' && parsed.variant && VARIANTS[parsed.variant]) {
    session.variant = parsed.variant;
    session.drawnNumbers = [];
    session.status = 'waiting';
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

    const broadcastState = handleGameAction(parsed);

    if (broadcastState) {
      ws.send(JSON.stringify(broadcastState));
      broadcastSessionState(broadcastState, ws);
    }
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
