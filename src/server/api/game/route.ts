import { NextRequest, NextResponse } from 'next/server';
import WebSocket, { type RawData } from 'ws';
import { VARIANTS } from '@/lib/variants';
import type { GameState, GameVariant } from '@/types/game';

export const runtime = 'nodejs';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

function parseGameState(data: RawData): GameState {
  let text: string;
  if (Array.isArray(data)) {
    text = Buffer.concat(data).toString();
  } else if (data instanceof ArrayBuffer) {
    text = Buffer.from(data).toString();
  } else {
    text = data.toString();
  }
  return JSON.parse(text) as GameState;
}

function requestGameState(
  message: {
    action: 'draw' | 'call-number' | 'reset' | 'change-variant' | 'ping';
    sessionId?: string;
    variant?: GameVariant;
    number?: number;
  },
): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    const waitForUpdatedState = message.action !== 'ping';
    let receivedInitialState = false;

    socket.once('open', () => socket.send(JSON.stringify(message)));
    socket.on('message', (data) => {
      const gameState = parseGameState(data);
      if (waitForUpdatedState && !receivedInitialState) {
        receivedInitialState = true;
        return;
      }
      socket.close();
      resolve(gameState);
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
    action: 'draw' | 'call-number' | 'reset' | 'change-variant';
    sessionId?: string;
    variant?: GameVariant;
    number?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const { action, sessionId, variant, number } = body;

  if (!['draw', 'call-number', 'reset', 'change-variant'].includes(action)) {
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

    const gameState = await requestGameState({ action, sessionId, variant, number });
    return NextResponse.json({ gameState });
  } catch {
    return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
  }
}

// GET /api/game/state — Get current game state
export async function GET() {
  try {
    const gameState = await requestGameState({ action: 'ping' });
    return NextResponse.json({ gameState });
  } catch {
    return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
  }
}
