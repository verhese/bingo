'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameSession } from '@/lib/useGameSession';
import { CallerDisplay } from '@/components/CallerDisplay';
import { Board } from '@/components/Board';
import { DrawHistory } from '@/components/DrawHistory';
import { GameSessionBar } from '@/components/GameSessionBar';
import { GameStageStatus } from '@/components/GameStageStatus';
import type { GameVariant } from '@/types/game';
import { VARIANTS } from '@/lib/variants';
import { normalizeRoomId } from '@/lib/gameRoom';
import { shouldReturnToLobby, type ObservedRoomStatus } from '@/lib/lobbyRedirect';

function GameRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const room = searchParams.get('room');
  const hasRoom = Boolean(room?.trim());
  const roomId = normalizeRoomId(room);
  const { state } = useGameSession(roomId);
  const previousStatus = useRef<ObservedRoomStatus | null>(null);
  const variant = (state?.variant as GameVariant) ?? '75-ball';
  const cfg = VARIANTS[variant];
  const lastUndoneNumber = state?.lastUndoneNumber ?? null;
  const callerNumber = lastUndoneNumber ?? state?.drawnNumbers.at(-1) ?? null;

  useEffect(() => {
    if (!hasRoom) router.replace('/lobby');
  }, [hasRoom, router]);

  useEffect(() => {
    if (!state) return;
    const previous = previousStatus.current;
    const next = { roomId: state.sessionId, status: state.status };
    previousStatus.current = next;
    if (shouldReturnToLobby(previous, next)) router.push('/lobby');
  }, [state, router]);

  return (
    <main className="game-room">
      <h1 className="sr-only">Bingo game room</h1>
      <GameSessionBar
        roomName={state?.roomName ?? roomId}
        variant={cfg.name}
        drawnCount={state?.drawnNumbers.length ?? 0}
        status={state?.status ?? 'waiting'}
      />
      <CallerDisplay number={callerNumber} isUndone={lastUndoneNumber !== null} />
      <div className="game-room-board-area">
        <Board
          maxNumber={cfg.maxNumber}
          drawnNumbers={state?.drawnNumbers ?? []}
          undoneNumbers={state?.undoneNumbers ?? []}
          verifiedBingo={state?.verifiedBingo?.claimedNumbers}
          stageStatus={<GameStageStatus state={state} />}
        />
        <DrawHistory drawnNumbers={state?.drawnNumbers ?? []} />
      </div>
    </main>
  );
}

export default function GameRoomPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bingo-bg" />}>
      <GameRoom />
    </Suspense>
  );
}
