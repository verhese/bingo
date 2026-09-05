import { ThemeToggle } from '@/components/ThemeToggle';
import type { RoomSummary } from '@/types/game';

interface GameSessionBarProps {
  readonly roomId: string;
  readonly rooms: readonly RoomSummary[];
  readonly onRoomChange: (roomId: string) => void;
  readonly variant: string;
  readonly drawnCount: number;
  readonly status: 'waiting' | 'in-play' | 'complete';
}

export function GameSessionBar({ roomId, rooms, onRoomChange, variant, drawnCount, status }: GameSessionBarProps) {
  return (
    <header className="game-session-bar">
      <label className="game-session-room">
        <span>Room</span>
        <select value={roomId} onChange={(event) => onRoomChange(event.target.value)}>
          {rooms.map((room) => <option key={room.sessionId} value={room.sessionId}>{room.roomName}</option>)}
        </select>
      </label>
      <span>Variant: {variant}</span>
      <span>Drawn: {drawnCount}</span>
      <span className="text-bingo-accent capitalize">{status}</span>
      <ThemeToggle />
    </header>
  );
}
