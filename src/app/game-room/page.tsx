'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameSession } from '@/lib/useGameSession';
import { CallerDisplay } from '@/components/CallerDisplay';
import { Board } from '@/components/Board';
import { DrawHistory } from '@/components/DrawHistory';
import { GameSessionBar } from '@/components/GameSessionBar';
import type { GameVariant } from '@/types/game';
import { VARIANTS } from '@/lib/variants';
import { normalizeRoomId } from '@/lib/gameRoom';
import { getWebSocketUrl } from '@/lib/websocketUrl';
import type { RoomSummary } from '@/types/game';

const WS_URL = getWebSocketUrl();

function GameRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = normalizeRoomId(searchParams.get('room'));
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const { state } = useGameSession(WS_URL, roomId);
  const variant = (state?.variant as GameVariant) ?? '90-ball';
  const cfg = VARIANTS[variant];

  useEffect(() => {
    let isCurrent = true;

    const loadRooms = async () => {
      try {
        const response = await fetch('/api/game?rooms=true');
        if (!response.ok) return;
        const result = (await response.json()) as { sessions?: unknown };
        if (!Array.isArray(result.sessions) || !isCurrent) return;
        setRooms(result.sessions as RoomSummary[]);
      } catch {
        // Keep the current room available if the room list cannot be loaded.
      }
    };

    void loadRooms();
    return () => {
      isCurrent = false;
    };
  }, [roomId]);

  const handleRoomChange = (nextRoomId: string) => {
    router.push(`/game-room?room=${encodeURIComponent(nextRoomId)}`);
  };

  const availableRooms = rooms.some((room) => room.sessionId === roomId)
    ? rooms
    : [{ sessionId: roomId, roomName: roomId, variant, drawnCount: 0, status: 'waiting' as const }, ...rooms];

  return (
    <main className="game-room">
      <GameSessionBar
        roomId={roomId}
        rooms={availableRooms}
        onRoomChange={handleRoomChange}
        variant={cfg.name}
        drawnCount={state?.drawnNumbers.length ?? 0}
        status={state?.status ?? 'waiting'}
      />
      <CallerDisplay number={state?.drawnNumbers[state?.drawnNumbers.length - 1] ?? null} />
      <div className="game-room-board-area">
        <Board
          maxNumber={cfg.maxNumber}
          drawnNumbers={state?.drawnNumbers ?? []}
          verifiedBingo={state?.verifiedBingo?.claimedNumbers}
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
