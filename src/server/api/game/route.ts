import { NextRequest, NextResponse } from 'next/server';
import WebSocket, { type RawData } from 'ws';
import { VARIANTS } from '@/lib/variants';
import { verifyBingoNumbers } from '@/lib/bingoClaim';
import { normalizeRoomId } from '@/lib/gameRoom';
import type { GameState, GameVariant } from '@/types/game';

const WS_URL = process.env.GAME_SERVER_WS_URL || 'ws://localhost:3001';

function parseGameState(data: RawData): GameState {
  return JSON.parse(parseResponseText(data)) as GameState;
}

function parseResponseText(data: RawData): string {
  let text: string;
  if (Array.isArray(data)) {
    text = Buffer.concat(data).toString();
  } else if (data instanceof ArrayBuffer) {
    text = Buffer.from(data).toString();
  } else {
    text = data.toString();
  }
  return text;
}

function requestGameState(
  message: {
    action: 'draw' | 'call-number' | 'reset' | 'change-variant' | 'verify-bingo' | 'ping';
    sessionId?: string;
    variant?: GameVariant;
    number?: number;
    claimedNumbers?: number[];
  },
): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);

    socket.once('open', () => socket.send(JSON.stringify(message)));
    socket.on('message', (data) => {
      const gameState = parseGameState(data);
      socket.close();
      resolve(gameState);
    });
    socket.once('error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

function requestSessionIds(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);

    socket.once('open', () => socket.send(JSON.stringify({ action: 'list-sessions' })));
    socket.on('message', (data) => {
      const response = JSON.parse(parseResponseText(data)) as { sessionIds?: unknown };
      socket.close();
      if (Array.isArray(response.sessionIds) && response.sessionIds.every((sessionId) => typeof sessionId === 'string')) {
        resolve(response.sessionIds);
        return;
      }
      reject(new Error('Invalid game service session list'));
    });
    socket.once('error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

// POST /api/game — Handles draw and reset actions
export async function POST(req: NextRequest) {
  let body: {
    action: 'draw' | 'call-number' | 'reset' | 'change-variant' | 'verify-bingo';
    sessionId?: string;
    variant?: GameVariant;
    number?: number;
    claimedNumbers?: number[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const { action, variant, number, claimedNumbers } = body;
  const sessionId = normalizeRoomId(body.sessionId);

  if (!['draw', 'call-number', 'reset', 'change-variant', 'verify-bingo'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (action === 'change-variant' && (!variant || !VARIANTS[variant])) {
    return NextResponse.json({ error: 'Unknown variant' }, { status: 400 });
  }

  try {
    if (action === 'call-number') {
      const currentState = await requestGameState({ action: 'ping', sessionId });
      const maxNumber = VARIANTS[currentState.variant].maxNumber;
      if (
        typeof number !== 'number'
        || !Number.isInteger(number)
        || number < 1
        || number > maxNumber
      ) {
        return NextResponse.json(
          { error: `Enter a whole number from 1 to ${maxNumber}` },
          { status: 400 },
        );
      }
      if (currentState.drawnNumbers.includes(number)) {
        return NextResponse.json({ error: 'That number has already been called' }, { status: 400 });
      }
    }

    if (action === 'verify-bingo') {
      const currentState = await requestGameState({ action: 'ping', sessionId });
      const verification = verifyBingoNumbers(
        Array.isArray(claimedNumbers) ? claimedNumbers : [],
        currentState.drawnNumbers,
        currentState.variant,
      );
      if (!verification.isVerified) {
        return NextResponse.json({ error: 'The claimed line cannot be verified' }, { status: 400 });
      }
    }

    const gameState = await requestGameState({ action, sessionId, variant, number, claimedNumbers });
    return NextResponse.json({ gameState });
  } catch {
    return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
  }
}

// GET /api/game — Get current game state
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('rooms') === 'true') {
    try {
      const sessionIds = await requestSessionIds();
      return NextResponse.json({ sessionIds });
    } catch {
      return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
    }
  }

  const sessionId = normalizeRoomId(req.nextUrl.searchParams.get('sessionId'));
  try {
    const gameState = await requestGameState({ action: 'ping', sessionId });
    return NextResponse.json({ gameState });
  } catch {
    return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
  }
}
