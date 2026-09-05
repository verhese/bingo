import { ThemeToggle } from '@/components/ThemeToggle';

interface GameSessionBarProps {
  readonly roomId: string;
  readonly roomIds: readonly string[];
  readonly onRoomChange: (roomId: string) => void;
  readonly variant: string;
  readonly drawnCount: number;
  readonly status: 'waiting' | 'in-play' | 'complete';
}

export function GameSessionBar({ roomId, roomIds, onRoomChange, variant, drawnCount, status }: GameSessionBarProps) {
  return (
    <header className="game-session-bar">
      <label className="game-session-room">
        <span>Room</span>
        <select value={roomId} onChange={(event) => onRoomChange(event.target.value)}>
          {roomIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <span>Variant: {variant}</span>
      <span>Drawn: {drawnCount}</span>
      <span className="text-bingo-accent capitalize">{status}</span>
      <ThemeToggle />
    </header>
  );
}
