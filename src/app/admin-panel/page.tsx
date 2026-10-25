'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameSession } from '@/lib/useGameSession';
import { RecentCalls } from '@/components/RecentCalls';
import { GameStageStatus } from '@/components/GameStageStatus';
import { PageBar } from '@/components/PageBar';
import { VARIANTS } from '@/lib/variants';
import { verifyBingoClaim, type BingoClaimResult } from '@/lib/bingoClaim';
import { BINGO_PATTERNS, getBingoPatternNumberCounts, type BingoPattern } from '@/lib/bingoPatterns';
import { BUILT_IN_GAME_MODES } from '@/lib/gameModes';
import { normalizeRoomId } from '@/lib/gameRoom';
import { getOpenAdminRoom } from '@/lib/adminRoom';
import type { GameVariant, RoomSummary } from '@/types/game';

function AdminPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRoomId = searchParams.get('room')?.trim() ?? '';
  const normalizedRoomId = normalizeRoomId(requestedRoomId);
  const roomId = requestedRoomId && (normalizedRoomId !== 'default' || requestedRoomId.toLowerCase() === 'default')
    ? normalizedRoomId
    : '';
  const [variant, setVariant] = useState<GameVariant>('75-ball');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [claimNumbers, setClaimNumbers] = useState(['', '', '', '', '']);
  const [claimResult, setClaimResult] = useState<BingoClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [undoConfirmation, setUndoConfirmation] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const verifyDialogRef = useRef<HTMLDialogElement>(null);
  const {
    drawNumber,
    callNumber,
    undoLastCall,
    state,
  } = useGameSession(roomId);
  const activeRoom = getOpenAdminRoom(roomId, rooms, state);
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
    setRoomsLoaded(false);
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/game?rooms=true');
        if (!response.ok) return;
        const result = (await response.json()) as { sessions?: RoomSummary[] };
        if (Array.isArray(result.sessions)) setRooms(result.sessions);
      } catch {
        // The active room remains available while the directory is unavailable.
      } finally {
        setRoomsLoaded(true);
      }
    };
    void loadRooms();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      router.replace('/lobby');
      return;
    }

    const roomExists = rooms.some((room) => room.sessionId === roomId);
    if (roomsLoaded && !roomExists) {
      router.replace('/lobby');
    }
  }, [roomId, rooms, roomsLoaded, router]);

  useEffect(() => {
    if (state) setVariant(state.variant);
  }, [state]);

  useEffect(() => {
    if (drawMode !== 'manual') setUndoConfirmation(false);
  }, [drawMode]);

  useEffect(() => {
    setClaimNumbers(Array.from({ length: claimFieldCount }, () => ''));
  }, [claimFieldCount, claimPattern]);

  useEffect(() => {
    const dialog = verifyDialogRef.current;
    if (isVerifyDialogOpen && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
    }
  }, [isVerifyDialogOpen]);

  const handleDrawNumber = async () => {
    if (!activeRoom || autoDrawLocked) return;
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
    if (!activeRoom || manualCallLocked) return;
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
    const target = e.target;
    if (
      e.altKey
      || e.ctrlKey
      || e.metaKey
      || e.shiftKey
      || e.repeat
      || !(target instanceof HTMLElement)
      || target.isContentEditable
      || target.closest('input, select, textarea, button, a, [role="dialog"], [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [contenteditable="true"]')
    ) return;

    if (activeRoom && e.code === 'Space') {
      e.preventDefault(); // Prevent page scroll
      if (!autoDrawLocked) void handleDrawNumber();
    }
  }, [activeRoom, autoDrawLocked, handleDrawNumber]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className="page-shell text-xl">
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
      <PageBar title="Game control">
        {activeRoom && (
          <a
            href={`/game-room?room=${encodeURIComponent(roomId)}`}
            target="_blank"
            rel="noreferrer"
            className="bar-button"
          >
            Open Game Room
          </a>
        )}
        <a href="/lobby" className="bar-button">Back to lobby</a>
      </PageBar>
      <div className="page-content">
        <section aria-labelledby="room-step-title" className="page-panel flex flex-col gap-4">
          <h2 id="room-step-title" className="text-2xl font-bold text-bingo-text">Room</h2>
          {activeRoom ? (
            <>
              <p role="status" className="font-bold text-bingo-accent">
                Active room: {activeRoom.roomName} ({activeRoom.variant})
              </p>
              <div className="flex flex-col gap-3 rounded-lg border border-bingo-muted p-4">
                <h3 className="font-bold text-bingo-text">Room settings</h3>
                <p className="text-bingo-text">
                  Game variant: {activeRoom.variant} — fixed when this room was created.
                                </p>
                {(state?.variant ?? variant) === '75-ball' && (
                  <section className="flex flex-col gap-3 rounded-lg border border-bingo-muted bg-bingo-bg p-4">
                    <h4 className="font-bold text-bingo-text">75-ball game mode</h4>
                    <p className="text-bingo-text">
                      {state?.customGameModes.find((mode) => mode.id === state.gameModeId)?.name
                        ?? BUILT_IN_GAME_MODES.find((mode) => mode.id === state?.gameModeId)?.name
                        ?? state?.gameModeId}
                      {' — '}fixed when this room was created.
                    </p>
                  </section>
                )}
              </div>
            </>
          ) : (
            <p role="status" className="text-bingo-muted">
              {!roomsLoaded
                ? 'Loading the selected room…'
                : rooms.some((room) => room.sessionId === roomId)
                  ? 'Opening the selected room…'
                  : 'This room is unavailable. Return to the lobby or create a new room.'}
            </p>
          )}
        </section>
        <section aria-labelledby="game-control-step-title" className="page-panel flex flex-col gap-4">
          <h2 id="game-control-step-title" className="text-2xl font-bold text-bingo-text">Game controls</h2>
          {activeRoom ? (
            <>
        <GameStageStatus state={state} />
        <RecentCalls drawnNumbers={state?.drawnNumbers ?? []} />
        {drawMode && (
          <output className="text-sm font-bold text-bingo-accent">
            Draw mode locked: {drawMode === 'auto' ? 'automatic' : 'manual'}.
          </output>
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
          aria-keyshortcuts="Space"
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
          Press <kbd className="rounded bg-bingo-surface px-1.5 py-0.5 font-mono text-base">Space</kbd> to draw when focus is outside an interactive control.
        </p>
            </>
          ) : (
            <p className="text-bingo-muted">Game controls will be available once the room is open.</p>
          )}
        </section>
      </div>
      {isVerifyDialogOpen && (
          <dialog
            ref={verifyDialogRef}
            aria-labelledby="verify-bingo-title"
            aria-describedby="verify-bingo-description"
            onClose={() => setIsVerifyDialogOpen(false)}
            className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border-2 border-bingo-muted bg-bingo-surface p-6 text-bingo-text shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="verify-bingo-title" className="text-3xl font-bold text-bingo-text">Verify a Bingo call</h2>
                <p id="verify-bingo-description" className="mt-1 text-lg text-bingo-muted">Enter the {claimCounts.join(' or ')} numbers on the card for the claimed {BINGO_PATTERNS[claimPattern].name} (the free centre space is not counted).</p>
              </div>
              <button
                type="button"
                onClick={() => verifyDialogRef.current?.close()}
                aria-label="Close verification dialog"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-bingo-muted text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
              >
                <X className="h-6 w-6" aria-hidden="true" />
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
                  onClick={() => verifyDialogRef.current?.close()}
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
          </dialog>
      )}
    </main>
  );
}

export default function AdminPanelPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bingo-bg" />}>
      <AdminPanel />
    </Suspense>
  );
}
