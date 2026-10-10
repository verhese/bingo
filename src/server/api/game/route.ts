import { NextRequest, NextResponse } from 'next/server';
import WebSocket, { type RawData } from 'ws';
import { isGameVariant, VARIANTS } from '@/lib/variants';
import { verifyBingoNumbers } from '@/lib/bingoClaim';
import { BUILT_IN_GAME_MODES, createCustomGameMode } from '@/lib/gameModes';
import { normalizeRoomId } from '@/lib/gameRoom';
import type { GameState, GameVariant, RoomSummary } from '@/types/game';

const WS_URL = process.env.GAME_SERVER_WS_URL || 'ws://localhost:3001';

class GameActionRejectedError extends Error {}

function parseGameResponse(data: RawData): GameState {
  const response = JSON.parse(parseResponseText(data)) as GameState | { error?: unknown };
  if ('error' in response && typeof response.error === 'string') {
    throw new GameActionRejectedError(response.error);
  }
  return response as GameState;
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
    action: 'create-session' | 'draw' | 'call-number' | 'undo-last-draw' | 'reset' | 'change-variant' | 'verify-bingo' | 'select-game-mode' | 'create-game-mode' | 'ping';
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
): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);

    socket.once('open', () => socket.send(JSON.stringify(message)));
    socket.on('message', (data) => {
      try {
        const gameState = parseGameResponse(data);
        socket.close();
        resolve(gameState);
      } catch (error) {
        socket.close();
        reject(error);
      }
    });
    socket.once('error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

function requestSessions(): Promise<RoomSummary[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);

    socket.once('open', () => socket.send(JSON.stringify({ action: 'list-sessions' })));
    socket.on('message', (data) => {
      const response = JSON.parse(parseResponseText(data)) as { sessions?: unknown };
      socket.close();
      if (Array.isArray(response.sessions)) {
        resolve(response.sessions as RoomSummary[]);
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
    action: 'create-session' | 'draw' | 'call-number' | 'undo-last-draw' | 'reset' | 'change-variant' | 'verify-bingo' | 'select-game-mode' | 'create-game-mode';
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
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const {
    action,
    roomName,
    variant,
    number,
    claimedNumbers,
    expectedStageIndex,
    gameModeId,
    gameModeName,
    patterns,
  } = body;
  const sessionId = normalizeRoomId(body.sessionId);

  if (!['create-session', 'draw', 'call-number', 'undo-last-draw', 'reset', 'change-variant', 'verify-bingo', 'select-game-mode', 'create-game-mode'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  if (action === 'create-session') {
    if (variant !== undefined && !isGameVariant(variant)) {
      return NextResponse.json({ error: 'Unknown variant' }, { status: 400 });
    }
    if (
      gameModeId !== undefined
      && (variant ?? '75-ball') === '75-ball'
      && (typeof gameModeId !== 'string'
        || (gameModeId !== 'custom' && !BUILT_IN_GAME_MODES.some((mode) => mode.id === gameModeId)))
    ) {
      return NextResponse.json({ error: 'Select an available game mode for the new room.' }, { status: 400 });
    }
    if (gameModeId === 'custom' && (variant ?? '75-ball') === '75-ball') {
      const validation = createCustomGameMode(gameModeName, patterns, BUILT_IN_GAME_MODES);
      if ('error' in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }
  }
  if (action === 'select-game-mode' || action === 'create-game-mode') {
    return NextResponse.json({ error: 'A room game mode is fixed when the room is created.' }, { status: 409 });
  }
  if (action === 'change-variant') {
    return NextResponse.json({ error: 'A room game variant is fixed when the room is created.' }, { status: 409 });
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
      if (!Number.isInteger(expectedStageIndex)) {
        return NextResponse.json({ error: 'The expected game stage is required to verify Bingo.' }, { status: 400 });
      }
      const currentState = await requestGameState({ action: 'ping', sessionId });
      if (expectedStageIndex !== currentState.stageIndex) {
        return NextResponse.json(
          { error: 'The game stage changed. Review the active stage before verifying Bingo.' },
          { status: 409 },
        );
      }
      const verification = verifyBingoNumbers(
        Array.isArray(claimedNumbers) ? claimedNumbers : [],
        currentState.drawnNumbers,
        currentState.variant,
        currentState.variant === '75-ball' ? currentState.currentStage : 'single-row',
      );
      if (!verification.isVerified) {
        return NextResponse.json({ error: 'The claimed line cannot be verified' }, { status: 400 });
      }
    }

    const gameState = await requestGameState({
      action,
      sessionId,
      roomName,
      variant,
      number,
      claimedNumbers,
      expectedStageIndex,
      gameModeId,
      gameModeName,
      patterns,
    });
    return NextResponse.json({ gameState });
  } catch (error) {
    if (error instanceof GameActionRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
  }
}

// GET /api/game — Get current game state
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('rooms') === 'true') {
    try {
      const sessions = await requestSessions();
      return NextResponse.json({ sessions });
    } catch {
      return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
    }
  }

  const sessionId = normalizeRoomId(req.nextUrl.searchParams.get('sessionId'));
  try {
    const gameState = await requestGameState({ action: 'ping', sessionId });
    return NextResponse.json({ gameState });
  } catch (error) {
    if (error instanceof GameActionRejectedError && error.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Game service is unavailable' }, { status: 503 });
  }
}
