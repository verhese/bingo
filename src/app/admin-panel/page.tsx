'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameSession } from '@/lib/useGameSession';
import { RecentCalls } from '@/components/RecentCalls';
import { VariantSelector } from '@/components/VariantSelector';
import { GameStageStatus } from '@/components/GameStageStatus';
import { VARIANTS } from '@/lib/variants';
import { verifyBingoClaim, type BingoClaimResult } from '@/lib/bingoClaim';
import { BINGO_PATTERNS, getBingoPatternNumberCounts, type BingoPattern } from '@/lib/bingoPatterns';
import { BUILT_IN_GAME_MODES } from '@/lib/gameModes';
import { normalizeRoomId } from '@/lib/gameRoom';
import type { GameState, GameVariant, RoomSummary } from '@/types/game';
import { getWebSocketUrl } from '@/lib/websocketUrl';

const WS_URL = getWebSocketUrl();

function AdminPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = normalizeRoomId(searchParams.get('room'));
  const [variant, setVariant] = useState<GameVariant>('75-ball');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomGameModeId, setNewRoomGameModeId] = useState(BUILT_IN_GAME_MODES[0].id);
  const [manualNumber, setManualNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [claimNumbers, setClaimNumbers] = useState(['', '', '', '', '']);
  const [claimResult, setClaimResult] = useState<BingoClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [undoConfirmation, setUndoConfirmation] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [gameModeName, setGameModeName] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<BingoPattern[]>([]);
  const {
    drawNumber,
    callNumber,
    undoLastCall,
    state,
  } = useGameSession(WS_URL, roomId);
  const maxNumber = VARIANTS[state?.variant ?? variant].maxNumber;
  const drawMode = state?.drawMode ?? null;
  const autoDrawLocked = drawMode === 'manual';
  const manualCallLocked = drawMode === 'auto';
  const claimPattern: BingoPattern = state?.variant === '75-ball' ? state.currentStage : 'single-row';
  const claimCounts = getBingoPatternNumberCounts(claimPattern);
  const claimFieldCount = claimCounts[claimCounts.length - 1];
  const claimMinimum = claimCounts[0];
  const lastCall = state?.drawnNumbers.at(-1);
  const canUndo = drawMode === 'manual' && state?.status === 'in-play' && lastCall !== undefined;

  useEffect(() => {
    setUndoConfirmation(false);
    setVariant('75-ball');
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/game?rooms=true');
        if (!response.ok) return;
        const result = (await response.json()) as { sessions?: RoomSummary[] };
        if (Array.isArray(result.sessions)) setRooms(result.sessions);
      } catch {
        // The active room remains available while the directory is unavailable.
      }
    };
    void loadRooms();
  }, [roomId]);

  useEffect(() => {
    if (state) setVariant(state.variant);
  }, [state]);

  useEffect(() => {
    if (drawMode !== 'manual') setUndoConfirmation(false);
  }, [drawMode]);

  useEffect(() => {
    setClaimNumbers(Array.from({ length: claimFieldCount }, () => ''));
  }, [claimFieldCount, claimPattern]);

  const handleCreateRoom = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-session',
          roomName: newRoomName,
          gameModeId: newRoomGameModeId,
          ...(newRoomGameModeId === 'custom' ? { gameModeName, patterns: selectedPatterns } : {}),
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? 'Unable to create the room');
      }
      const result = (await response.json()) as { gameState: GameState };
      setRooms((currentRooms) => [
        ...currentRooms.filter((room) => room.sessionId !== result.gameState.sessionId),
        {
          sessionId: result.gameState.sessionId,
          roomName: result.gameState.roomName,
          variant: result.gameState.variant,
          drawnCount: result.gameState.drawnNumbers.length,
          status: result.gameState.status,
        },
      ].sort((first, second) => first.roomName.localeCompare(second.roomName)));
      setNewRoomName('');
      setNewRoomGameModeId(BUILT_IN_GAME_MODES[0].id);
      setGameModeName('');
      setSelectedPatterns([]);
      router.push(`/admin-panel?room=${encodeURIComponent(result.gameState.sessionId)}`);
    } catch (createError) {
      setServiceError(createError instanceof Error ? createError.message : 'Unable to create the room');
    }
  };

  const handleVariantChange = async (newVariant: GameVariant) => {
    setServiceError(null);
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change-variant', sessionId: roomId, variant: newVariant }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? 'Unable to change the game variant');
      }

      setVariant(newVariant);
    } catch (variantError) {
      setServiceError(variantError instanceof Error ? variantError.message : 'Unable to change the game variant');
    }
  };

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

  const handleDrawNumber = async () => {
    if (autoDrawLocked) return;
    setServiceError(null);
    try {
      await drawNumber();
    } catch (drawError) {
      setServiceError(drawError instanceof Error ? drawError.message : 'Unable to draw a number');
    }
  };

  const handleReset = async () => {
    setServiceError(null);
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', sessionId: roomId }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? 'Unable to reset the game');
      }
    } catch (resetError) {
      setServiceError(resetError instanceof Error ? resetError.message : 'Unable to reset the game');
    }
  };

  const handleUndoLastCall = async () => {
    if (!canUndo || lastCall === undefined) return;
    setServiceError(null);
    try {
      await undoLastCall(lastCall);
      setUndoConfirmation(false);
    } catch (undoError) {
      setServiceError(undoError instanceof Error ? undoError.message : 'Unable to undo the last call');
    }
  };

  const handleManualCall = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manualCallLocked) return;
    setError(null);
    try {
      await callNumber(Number(manualNumber));
      setManualNumber('');
    } catch (callError) {
      const message = callError instanceof Error ? callError.message : 'Unable to call that number';
      setError(message);
      setServiceError(message);
    }
  };

  const handleClaimVerification = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClaimError(null);
    const verification = verifyBingoClaim(claimNumbers.join(','), state?.drawnNumbers ?? [], state?.variant ?? variant, claimPattern);
    if (!verification.isVerified) {
      setClaimResult(verification);
      return;
    }

    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-bingo',
          sessionId: roomId,
          claimedNumbers: verification.claimedNumbers,
          expectedStageIndex: state?.stageIndex,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? 'Unable to verify the Bingo call');
      }
      setClaimResult(verification);
    } catch (verificationError) {
      const message = verificationError instanceof Error ? verificationError.message : 'Unable to verify the Bingo call';
      setClaimResult(null);
      setClaimError(message);
      setServiceError(message);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isVerifyDialogOpen) {
      setIsVerifyDialogOpen(false);
      return;
    }

    // Ignore if user is typing in an input/select
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

    if (e.code === 'Space') {
      e.preventDefault(); // Prevent page scroll
      if (!autoDrawLocked) void handleDrawNumber();
    } else if (e.key === 'r' || e.key === 'R') {
      void handleReset();
    }
  }, [autoDrawLocked, handleDrawNumber, handleReset, isVerifyDialogOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-bingo-bg p-8 text-2xl">
      {serviceError && (
        <div role="alert" className="fixed right-4 top-4 z-50 flex max-w-md items-start gap-3 rounded-lg border-2 border-bingo-danger bg-bingo-surface p-4 text-lg text-bingo-text shadow-2xl">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-bingo-danger" aria-hidden="true" />
          <p className="font-bold">{serviceError}</p>
          <button
            type="button"
            onClick={() => setServiceError(null)}
            title="Dismiss notification"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-bingo-muted text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Dismiss notification</span>
          </button>
        </div>
      )}
      <h1 className="mb-8 heading-lg font-bold text-bingo-text">Admin Panel</h1>
      <GameStageStatus state={state} />
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <label htmlFor="room-id" className="font-bold text-bingo-text">Active room</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="room-id"
              value={roomId}
              onChange={(event) => router.push(`/admin-panel?room=${encodeURIComponent(event.target.value)}`)}
              className="w-56 rounded border-2 border-bingo-muted bg-bingo-surface px-4 py-3 text-xl font-bold text-bingo-text"
            >
              {(rooms.some((room) => room.sessionId === roomId) ? rooms : [{ sessionId: roomId, roomName: roomId, variant, drawnCount: 0, status: 'waiting' as const }, ...rooms]).map((room) => (
                <option key={room.sessionId} value={room.sessionId}>{room.roomName} - {room.variant}, {room.drawnCount} called</option>
              ))}
            </select>
            <a
              href={`/game-room?room=${encodeURIComponent(roomId)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border-2 border-bingo-muted px-5 py-3 text-lg font-bold text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
            >
              Open Game Room
            </a>
          </div>
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-3 rounded-lg border-2 border-bingo-muted bg-bingo-surface p-4">
            <h2 className="text-xl font-bold text-bingo-text">Create a new room</h2>
            <label htmlFor="new-room-name" className="font-bold text-bingo-text">Room name</label>
            <input id="new-room-name" type="text" value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} maxLength={40} className="w-full rounded border-2 border-bingo-muted bg-bingo-bg px-4 py-3 text-lg font-bold text-bingo-text" required />
            <label htmlFor="new-room-game-mode" className="font-bold text-bingo-text">Room game mode</label>
            <select
              id="new-room-game-mode"
              value={newRoomGameModeId}
              onChange={(event) => setNewRoomGameModeId(event.target.value)}
              className="w-full rounded border-2 border-bingo-muted bg-bingo-bg px-4 py-3 text-lg font-bold text-bingo-text"
            >
              {BUILT_IN_GAME_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.name}</option>
              ))}
              <option value="custom">Custom mode</option>
            </select>
            {newRoomGameModeId === 'custom' && (
              <>
                <label htmlFor="new-room-game-mode-name" className="font-bold text-bingo-text">Custom mode name</label>
                <input
                  id="new-room-game-mode-name"
                  type="text"
                  value={gameModeName}
                  onChange={(event) => setGameModeName(event.target.value)}
                  maxLength={40}
                  required
                  className="w-full rounded border-2 border-bingo-muted bg-bingo-bg px-4 py-3 text-lg font-bold text-bingo-text"
                />
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
            <button
              type="submit"
              disabled={newRoomGameModeId === 'custom' && selectedPatterns.length === 0}
              className="self-start rounded-lg bg-bingo-accent px-5 py-3 text-lg font-bold text-bingo-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Room
            </button>
          </form>
        </section>
        <RecentCalls drawnNumbers={state?.drawnNumbers ?? []} />
        {drawMode && (
          <output className="text-sm font-bold text-bingo-accent">
            Draw mode locked: {drawMode === 'auto' ? 'automatic' : 'manual'}.
          </output>
        )}
        <VariantSelector current={variant} onChange={handleVariantChange} />
        {(state?.variant ?? variant) === '75-ball' && (
          <section className="flex flex-col gap-3 rounded-lg border-2 border-bingo-muted bg-bingo-surface p-4">
            <h2 className="text-xl font-bold text-bingo-text">75-ball game mode</h2>
            <p className="text-bingo-text">
              {state?.customGameModes.find((mode) => mode.id === state.gameModeId)?.name
                ?? BUILT_IN_GAME_MODES.find((mode) => mode.id === state?.gameModeId)?.name
                ?? state?.gameModeId}
              {' — '}fixed when this room was created.
            </p>
          </section>
        )}
        <form onSubmit={handleManualCall} className="flex flex-col gap-3">
          <label htmlFor="manual-number" className="font-bold text-bingo-text">
            Call a specific number (1-{maxNumber})
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="manual-number"
              type="number"
              min="1"
              max={maxNumber}
              step="1"
              value={manualNumber}
              disabled={manualCallLocked}
              onChange={(event) => setManualNumber(event.target.value)}
              className="w-40 rounded border-2 border-bingo-muted bg-bingo-surface px-4 py-3 text-3xl font-bold text-bingo-text disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
            <button
              type="submit"
              disabled={manualCallLocked}
              className="rounded-xl border-2 border-bingo-accent px-6 py-3 text-xl font-bold text-bingo-accent hover:bg-bingo-accent hover:text-bingo-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Call Number
            </button>
            {drawMode === 'manual' && (
              undoConfirmation ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-bingo-text">Undo {lastCall}?</span>
                  <button type="button" onClick={handleUndoLastCall} disabled={!canUndo} className="flex items-center gap-2 rounded-xl border-2 border-red-700 bg-red-700 px-6 py-3 text-xl font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <RotateCcw className="h-5 w-5" aria-hidden="true" />
                    Undo Call
                  </button>
                  <button type="button" onClick={() => setUndoConfirmation(false)} className="rounded-xl border-2 border-bingo-muted px-6 py-3 text-xl font-bold text-bingo-text hover:bg-bingo-surface">
                    Keep Call
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setUndoConfirmation(true)}
                  disabled={!canUndo}
                  className="flex items-center gap-2 rounded-xl border-2 border-red-700 px-6 py-3 text-xl font-bold text-red-700 hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-5 w-5" aria-hidden="true" />
                  Undo Last Call
                </button>
              )
            )}
          </div>
          {error && <p role="alert" className="text-lg font-bold text-bingo-danger">{error}</p>}
        </form>
        <button
          type="button"
          onClick={handleDrawNumber}
          disabled={autoDrawLocked}
          className="rounded-xl bg-bingo-accent px-8 py-4 text-3xl font-bold text-bingo-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Draw Number
        </button>
        <button
          type="button"
          onClick={() => setIsVerifyDialogOpen(true)}
          className="rounded-lg border-2 border-bingo-success px-6 py-3 text-xl font-bold text-bingo-success hover:bg-bingo-success hover:text-bingo-bg"
        >
          Verify Bingo
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-xl border-2 border-bingo-muted px-6 py-2 text-lg text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
        >
          Reset Game
        </button>
        <p className="text-sm text-bingo-muted">
          Keyboard: <kbd className="rounded bg-bingo-surface px-1.5 py-0.5 font-mono text-base">Space</kbd> = Draw,{' '}
          <kbd className="rounded bg-bingo-surface px-1.5 py-0.5 font-mono text-base">R</kbd> = Reset
        </p>
      </div>
      {isVerifyDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-bingo-title"
            aria-describedby="verify-bingo-description"
            className="w-full max-w-2xl rounded-lg border-2 border-bingo-muted bg-bingo-surface p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="verify-bingo-title" className="text-3xl font-bold text-bingo-text">Verify a Bingo call</h2>
                <p id="verify-bingo-description" className="mt-1 text-lg text-bingo-muted">Enter the {claimCounts.join(' or ')} numbers on the card for the claimed {BINGO_PATTERNS[claimPattern].name} (the free centre space is not counted).</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVerifyDialogOpen(false)}
                title="Close verification dialog"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-bingo-muted text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
              >
                <X className="h-6 w-6" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <form onSubmit={handleClaimVerification} className="flex flex-col gap-4">
              <fieldset>
                <legend className="mb-2 font-bold text-bingo-text">Winning numbers ({BINGO_PATTERNS[claimPattern].name})</legend>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(4.5rem, 1fr))' }}>
                  {claimNumbers.map((number, index) => (
                    <input
                      key={index}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={maxNumber}
                      step="1"
                      autoFocus={index === 0}
                      value={number}
                      onChange={(event) => {
                        setClaimNumbers((numbers) => numbers.map((value, numberIndex) => (
                          numberIndex === index ? event.target.value : value
                        )));
                        setClaimResult(null);
                        setClaimError(null);
                      }}
                      aria-label={`Winning number ${index + 1}`}
                      className="min-w-0 rounded-lg border-2 border-bingo-muted bg-bingo-bg px-2 py-3 text-center text-xl font-bold text-bingo-text"
                      required={index < claimMinimum}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsVerifyDialogOpen(false)}
                  className="rounded-lg border-2 border-bingo-muted px-6 py-3 text-xl font-bold text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-bingo-success px-6 py-3 text-xl font-bold text-bingo-bg hover:opacity-90"
                >
                  Verify Bingo
                </button>
              </div>
              {claimResult && (
                <div
                  role="status"
                  className={claimResult.isVerified ? 'border-l-4 border-bingo-success bg-bingo-success/15 p-3 text-bingo-text' : 'border-l-4 border-bingo-danger bg-bingo-danger/10 p-3 text-bingo-text'}
                >
                  {claimResult.isVerified ? (
                    <p className="font-bold text-bingo-success">Bingo verified. Every number in this line has been called.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-bold text-bingo-danger">This call cannot be verified yet.</p>
                      {!claimResult.requiredNumberCounts.includes(claimResult.claimedNumbers.length) && (
                        <p>Enter exactly {claimResult.requiredNumberCounts.join(' or ')} numbers for the {BINGO_PATTERNS[claimPattern].name}.</p>
                      )}
                      {claimResult.invalidNumbers.length > 0 && <p>Invalid or repeated numbers: {claimResult.invalidNumbers.join(', ')}.</p>}
                      {claimResult.missingNumbers.length > 0 && <p>Not called: {claimResult.missingNumbers.join(', ')}.</p>}
                    </div>
                  )}
                </div>
              )}
              {claimError && <p role="alert" className="font-bold text-bingo-danger">{claimError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPanelPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bingo-bg" />}>
      <AdminPanel />
    </Suspense>
  );
}
