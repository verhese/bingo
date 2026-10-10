'use client';

import { useEffect, useState } from 'react';
import { PageBar } from '@/components/PageBar';
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
    <main className="page-shell">
      <PageBar title="Lobby">
        <a href="/admin-panel/create" className="bar-button">Create Room</a>
      </PageBar>
      <div className="page-content">
      {loading && <output className="text-xl">Loading rooms...</output>}
      {failed && <p role="alert" className="text-xl font-bold text-bingo-danger">Unable to load the room list.</p>}
      {!loading && !failed && rooms.length === 0 && (
        <p className="text-xl text-bingo-muted">No rooms yet. Create one to get started.</p>
      )}
      <ul className="flex flex-col gap-4">
        {rooms.map((room) => (
          <li key={room.sessionId} className="flex items-stretch gap-3">
            <a
              href={`/game-room?room=${encodeURIComponent(room.sessionId)}`}
              className="page-panel flex flex-1 flex-col text-xl hover:border-bingo-accent"
            >
              <span className="font-bold">{room.roomName}</span>
              <span className="text-base text-bingo-muted">
                {room.variant} · {room.drawnCount} called · {room.status}
              </span>
            </a>
            <a
              href={`/admin-panel?room=${encodeURIComponent(room.sessionId)}`}
              aria-label={`Admin for ${room.roomName}`}
              className="page-panel flex items-center text-lg font-bold hover:border-bingo-accent hover:text-bingo-accent"
            >
              Admin
            </a>
          </li>
        ))}
      </ul>
      </div>
    </main>
  );
}
