import { ThemeToggle } from '@/components/ThemeToggle';

interface GameSessionBarProps {
  readonly variant: string;
  readonly drawnCount: number;
  readonly status: 'waiting' | 'in-play' | 'complete';
}

export function GameSessionBar({ variant, drawnCount, status }: GameSessionBarProps) {
  return (
    <header className="game-session-bar">
      <span>Variant: {variant}</span>
      <span>Drawn: {drawnCount}</span>
      <span className="text-bingo-accent capitalize">{status}</span>
      <ThemeToggle />
    </header>
  );
}
