import { ThemeToggle } from '@/components/ThemeToggle';

interface GameSessionBarProps {
  readonly roomName: string;
  readonly variant: string;
  readonly drawnCount: number;
  readonly status: 'waiting' | 'in-play' | 'complete';
}

export function GameSessionBar({ roomName, variant, drawnCount, status }: GameSessionBarProps) {
  return (
    <header className="game-session-bar">
      <span className="font-bold">Room: {roomName}</span>
      <span>Variant: {variant}</span>
      <span>Drawn: {drawnCount}</span>
      <span className="text-bingo-accent capitalize">Status: {status}</span>
      <a href="/lobby" className="bar-button">Back to lobby</a>
      <ThemeToggle />
    </header>
  );
}
