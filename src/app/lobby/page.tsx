'use client';

import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { RoomSummary } from '@/types/game';

export default function LobbyPage() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/game?rooms=true');
        if (!response.ok) throw new Error('Unable to load rooms');
        const result = (await response.json()) as { sessions?: RoomSummary[] };
        if (isCurrent && Array.isArray(result.sessions)) setRooms(result.sessions);
      } catch {
        if (isCurrent) setFailed(true);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };
    void loadRooms();
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen w-screen flex-col items-center bg-bingo-bg p-8 text-bingo-text">
      <div className="mb-8 flex w-full max-w-2xl items-center justify-between">
        <h1 className="heading-lg font-bold">Lobby</h1>
        <ThemeToggle />
      </div>
      {loading && <output className="text-xl">Loading rooms...</output>}
      {failed && <p role="alert" className="text-xl font-bold text-bingo-danger">Unable to load the room list.</p>}
      {!loading && !failed && rooms.length === 0 && (
        <p className="text-xl text-bingo-muted">No rooms yet. Create one in the admin panel.</p>
      )}
      <ul className="flex w-full max-w-2xl flex-col gap-4">
        {rooms.map((room) => (
          <li key={room.sessionId} className="flex items-stretch gap-3">
            <a
              href={`/game-room?room=${encodeURIComponent(room.sessionId)}`}
              className="flex flex-1 flex-col rounded-lg border-2 border-bingo-muted bg-bingo-surface p-4 text-xl hover:border-bingo-accent"
            >
              <span className="font-bold">{room.roomName}</span>
              <span className="text-base text-bingo-muted">
                {room.variant} · {room.drawnCount} called · {room.status}
              </span>
            </a>
            <a
              href={`/admin-panel?room=${encodeURIComponent(room.sessionId)}`}
              aria-label={`Admin for ${room.roomName}`}
              className="flex items-center rounded-lg border-2 border-bingo-muted px-4 text-lg font-bold hover:border-bingo-accent hover:text-bingo-accent"
            >
              Admin
            </a>
          </li>
        ))}
      </ul>
      <a
        href="/admin-panel"
        className="mt-8 rounded-lg border-2 border-bingo-muted px-5 py-3 text-lg font-bold hover:border-bingo-accent hover:text-bingo-accent"
      >
        Admin Panel
      </a>
    </main>
  );
}
