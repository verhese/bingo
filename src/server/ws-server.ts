import { WebSocketServer, WebSocket } from 'ws';
import { VARIANTS } from '@/lib/variants';
import { generateAllNumbers, getNextNumber } from '@/lib/bingoNumbers';
import type { GameState, GameVariant } from '@/types/game';

interface GameSession {
  gameState: GameState;
  allNumbers: number[];
}

// In-memory game state store (sessionId → session data)
const gameSessions = new Map<string, GameSession>();

function createNewGame(
  variant: GameVariant = '90-ball',
  sessionId = 'default',
): GameState {
  const cfg = VARIANTS[variant];
  if (!cfg) throw new Error(`Unknown variant: ${variant}`);
  return {
    sessionId,
    variant,
    drawnNumbers: [],
    status: 'waiting',
  };
}

function getOrCreateSession(sessionId = 'default'): GameState {
  if (gameSessions.has(sessionId)) {
    return gameSessions.get(sessionId)!.gameState;
  }
  const newGame = createNewGame('90-ball', sessionId);
  gameSessions.set(newGame.sessionId, {
    gameState: newGame,
    allNumbers: generateAllNumbers(VARIANTS[newGame.variant].maxNumber),
  });
  return newGame;
}

const wss = new WebSocketServer({ port: 3001 });

console.log('Bingo WebSocket server running on ws://localhost:3001');

function handleGameAction(
  parsed: { action: string; sessionId?: string; variant?: GameVariant; number?: number },
): GameState | null {
  const session = getOrCreateSession(parsed.sessionId);
  const sessionData = gameSessions.get(session.sessionId);
  if (!sessionData) return null;

  if (parsed.action === 'draw') {
    if (session.status === 'waiting') session.status = 'in-play';
    const nextNum = getNextNumber(sessionData.allNumbers, session.drawnNumbers);
    if (nextNum !== null) session.drawnNumbers.push(nextNum);
    else session.status = 'complete';
    return { ...session };
  }

  if (parsed.action === 'call-number' && typeof parsed.number === 'number') {
    if (session.status === 'waiting') session.status = 'in-play';
    session.drawnNumbers.push(parsed.number);
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

  ws.send(JSON.stringify(getOrCreateSession()));

  ws.on('message', (data: Buffer) => {
    let parsed: {
      action: string;
      sessionId?: string;
      variant?: GameVariant;
      number?: number;
    };
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return; // Ignore malformed messages
    }

    if (parsed.action === 'ping') {
      ws.send(JSON.stringify(getOrCreateSession(parsed.sessionId)));
      return;
    }

    const broadcastState = handleGameAction(parsed);

    if (broadcastState) {
      const msg = JSON.stringify(broadcastState);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
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
