'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameSession } from '@/lib/useGameSession';
import { VariantSelector } from '@/components/VariantSelector';
import { VARIANTS } from '@/lib/variants';
import { verifyBingoClaim, type BingoClaimResult } from '@/lib/bingoClaim';
import { normalizeRoomId } from '@/lib/gameRoom';
import type { GameVariant } from '@/types/game';
import { getWebSocketUrl } from '@/lib/websocketUrl';

const WS_URL = getWebSocketUrl();

function AdminPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = normalizeRoomId(searchParams.get('room'));
  const [variant, setVariant] = useState<GameVariant>('90-ball');
  const [roomInput, setRoomInput] = useState(roomId);
  const [manualNumber, setManualNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [claimNumbers, setClaimNumbers] = useState(['', '', '', '', '']);
  const [claimResult, setClaimResult] = useState<BingoClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const { drawNumber, callNumber, state } = useGameSession(WS_URL, roomId);
  const maxNumber = VARIANTS[state?.variant ?? variant].maxNumber;

  useEffect(() => {
    setRoomInput(roomId);
    setVariant('90-ball');
  }, [roomId]);

  useEffect(() => {
    if (state) setVariant(state.variant);
  }, [state]);

  const handleRoomChange = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextRoomId = normalizeRoomId(roomInput);
    setRoomInput(nextRoomId);
    router.push(`/admin-panel?room=${encodeURIComponent(nextRoomId)}`);
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

  const handleDrawNumber = async () => {
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

  const handleManualCall = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    const verification = verifyBingoClaim(claimNumbers.join(','), state?.drawnNumbers ?? [], state?.variant ?? variant);
    if (!verification.isVerified) {
      setClaimResult(verification);
      return;
    }

    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-bingo', sessionId: roomId, claimedNumbers: verification.claimedNumbers }),
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
      void handleDrawNumber();
    } else if (e.key === 'r' || e.key === 'R') {
      void handleReset();
    }
  }, [handleDrawNumber, handleReset, isVerifyDialogOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bingo-bg p-8 text-2xl">
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
      <div className="flex flex-col gap-6">
        <form onSubmit={handleRoomChange} className="flex flex-col gap-2">
          <label htmlFor="room-id" className="font-bold text-bingo-text">Room</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="room-id"
              type="text"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              pattern="[a-z0-9][a-z0-9\-]{0,31}"
              maxLength={32}
              className="w-56 rounded border-2 border-bingo-muted bg-bingo-surface px-4 py-3 text-xl font-bold text-bingo-text"
              required
            />
            <button
              type="submit"
              className="rounded-lg border-2 border-bingo-accent px-5 py-3 text-lg font-bold text-bingo-accent hover:bg-bingo-accent hover:text-bingo-bg"
            >
              Open Room
            </button>
            <a
              href={`/game-room?room=${encodeURIComponent(roomId)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border-2 border-bingo-muted px-5 py-3 text-lg font-bold text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
            >
              Open Game Room
            </a>
          </div>
        </form>
        <VariantSelector current={variant} onChange={handleVariantChange} />
        <form onSubmit={handleManualCall} className="flex flex-col gap-3">
          <label htmlFor="manual-number" className="font-bold text-bingo-text">
            Call a specific number (1-{maxNumber})
          </label>
          <div className="flex gap-3">
            <input
              id="manual-number"
              type="number"
              min="1"
              max={maxNumber}
              step="1"
              value={manualNumber}
              onChange={(event) => setManualNumber(event.target.value)}
              className="w-40 rounded border-2 border-bingo-muted bg-bingo-surface px-4 py-3 text-3xl font-bold text-bingo-text"
              required
            />
            <button
              type="submit"
              className="rounded-xl border-2 border-bingo-accent px-6 py-3 text-xl font-bold text-bingo-accent hover:bg-bingo-accent hover:text-bingo-bg"
            >
              Call Number
            </button>
          </div>
          {error && <p role="alert" className="text-lg font-bold text-bingo-danger">{error}</p>}
        </form>
        <button
          type="button"
          onClick={handleDrawNumber}
          className="rounded-xl bg-bingo-accent px-8 py-4 text-3xl font-bold text-bingo-bg hover:opacity-90"
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
                <p id="verify-bingo-description" className="mt-1 text-lg text-bingo-muted">Enter the five numbers in the claimed winning line.</p>
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
                <legend className="mb-2 font-bold text-bingo-text">Winning line numbers</legend>
                <div className="grid grid-cols-5 gap-3">
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
                      aria-label={`Winning line number ${index + 1}`}
                      className="min-w-0 rounded-lg border-2 border-bingo-muted bg-bingo-bg px-2 py-3 text-center text-xl font-bold text-bingo-text"
                      required
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
                      {claimResult.claimedNumbers.length !== 5 && <p>Enter exactly five numbers from one winning line.</p>}
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
