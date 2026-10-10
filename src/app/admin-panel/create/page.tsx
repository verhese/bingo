'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VARIANTS } from '@/lib/variants';
import { PageBar } from '@/components/PageBar';
import { BINGO_PATTERNS, type BingoPattern } from '@/lib/bingoPatterns';
import { BUILT_IN_GAME_MODES, DEFAULT_GAME_MODE_ID } from '@/lib/gameModes';
import type { GameState, GameVariant } from '@/types/game';

const fieldClass = 'w-full rounded border-2 border-bingo-muted bg-bingo-bg px-4 py-3 text-lg font-bold text-bingo-text';

export default function CreateRoomPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState('');
  const [variant, setVariant] = useState<GameVariant>('75-ball');
  const [gameModeId, setGameModeId] = useState(DEFAULT_GAME_MODE_ID);
  const [gameModeName, setGameModeName] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<BingoPattern[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const supportsGameModes = variant === '75-ball';

  const togglePattern = (pattern: BingoPattern) => {
    setSelectedPatterns((current) => (
      current.includes(pattern)
        ? current.filter((selected) => selected !== pattern)
        : [...current, pattern]
    ));
  };

  const movePattern = (index: number, direction: -1 | 1) => {
    setSelectedPatterns((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-session',
          roomName,
          variant,
          ...(supportsGameModes ? { gameModeId } : {}),
          ...(supportsGameModes && gameModeId === 'custom' ? { gameModeName, patterns: selectedPatterns } : {}),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? 'Unable to create the room');
      }
      const result = (await response.json()) as { gameState: GameState };
      router.push(`/admin-panel?room=${encodeURIComponent(result.gameState.sessionId)}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the room');
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell text-xl">
      <PageBar title="Create a room">
        <button
          type="submit"
          form="create-room-form"
          disabled={submitting || (supportsGameModes && gameModeId === 'custom' && selectedPatterns.length === 0)}
          className="bar-button bar-button-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create Room
        </button>
        <a href="/lobby" className="bar-button">Cancel</a>
      </PageBar>
      <div className="page-content">
      <form id="create-room-form" onSubmit={handleSubmit} className="page-panel flex flex-col gap-3">
        {error && (
          <p role="alert" className="flex items-start gap-3 rounded-lg border-2 border-bingo-danger p-3 text-lg font-bold text-bingo-text">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-bingo-danger" aria-hidden="true" />
            {error}
          </p>
        )}
        <label htmlFor="new-room-name" className="font-bold text-bingo-text">Room name</label>
        <input id="new-room-name" type="text" value={roomName} onChange={(event) => setRoomName(event.target.value)} maxLength={40} className={fieldClass} required />
        <label htmlFor="new-room-variant" className="font-bold text-bingo-text">New room variant</label>
        <select id="new-room-variant" value={variant} onChange={(event) => setVariant(event.target.value as GameVariant)} className={fieldClass}>
          {Object.values(VARIANTS).map((item) => (
            <option key={item.name} value={item.name}>{item.name}</option>
          ))}
        </select>
        {supportsGameModes && (
          <>
            <label htmlFor="new-room-game-mode" className="font-bold text-bingo-text">New room game mode</label>
            <select id="new-room-game-mode" value={gameModeId} onChange={(event) => setGameModeId(event.target.value)} className={fieldClass}>
              {BUILT_IN_GAME_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.name}</option>
              ))}
              <option value="custom">Custom mode</option>
            </select>
            {gameModeId === 'custom' && (
              <>
                <label htmlFor="new-room-game-mode-name" className="font-bold text-bingo-text">Custom mode name</label>
                <input id="new-room-game-mode-name" type="text" value={gameModeName} onChange={(event) => setGameModeName(event.target.value)} maxLength={40} required className={fieldClass} />
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 font-bold text-bingo-text">Patterns (in stage order)</legend>
                  {Object.keys(BINGO_PATTERNS).map((pattern) => {
                    const typedPattern = pattern as BingoPattern;
                    return (
                      <label key={pattern} className="flex items-center gap-2 text-bingo-text">
                        <input
                          type="checkbox"
                          checked={selectedPatterns.includes(typedPattern)}
                          onChange={() => togglePattern(typedPattern)}
                          className="h-5 w-5 accent-bingo-accent"
                        />
                        {BINGO_PATTERNS[typedPattern].name}
                      </label>
                    );
                  })}
                </fieldset>
                {selectedPatterns.length > 0 && (
                  <ol aria-label="Custom mode stage order" className="flex flex-col gap-2">
                    {selectedPatterns.map((pattern, index) => (
                      <li key={pattern} className="flex items-center justify-between gap-3 rounded border border-bingo-muted bg-bingo-bg px-3 py-2 text-bingo-text">
                        <span>{index + 1}. {BINGO_PATTERNS[pattern].name}</span>
                        <span className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => movePattern(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${BINGO_PATTERNS[pattern].name} earlier`}
                            className="rounded border border-bingo-muted px-3 py-1 disabled:opacity-40"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => movePattern(index, 1)}
                            disabled={index === selectedPatterns.length - 1}
                            aria-label={`Move ${BINGO_PATTERNS[pattern].name} later`}
                            className="rounded border border-bingo-muted px-3 py-1 disabled:opacity-40"
                          >
                            Down
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            <p className="text-sm text-bingo-muted">The game mode is fixed for the lifetime of the room.</p>
          </>
        )}
      </form>
      </div>
    </main>
  );
}
