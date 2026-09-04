'use client';

import { useGameSession } from '@/lib/useGameSession';
import { CallerDisplay } from '@/components/CallerDisplay';
import { Board } from '@/components/Board';
import { GameSessionBar } from '@/components/GameSessionBar';
import type { GameVariant } from '@/types/game';
import { VARIANTS } from '@/lib/variants';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export default function GameRoomPage() {
  const { state } = useGameSession(WS_URL);
  const variant = (state?.variant as GameVariant) ?? '90-ball';
  const cfg = VARIANTS[variant];

  return (
    <main className="game-room">
      <GameSessionBar
        variant={cfg.name}
        drawnCount={state?.drawnNumbers.length ?? 0}
        status={state?.status ?? 'waiting'}
      />
      <CallerDisplay number={state?.drawnNumbers[state?.drawnNumbers.length - 1] ?? null} />
      <Board maxNumber={cfg.maxNumber} drawnNumbers={state?.drawnNumbers ?? []} />
    </main>
  );
}
