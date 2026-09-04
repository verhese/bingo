'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameSession } from '@/lib/useGameSession';
import { VariantSelector } from '@/components/VariantSelector';
import { VARIANTS } from '@/lib/variants';
import type { GameVariant } from '@/types/game';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export default function AdminPanelPage() {
  const [variant, setVariant] = useState<GameVariant>('90-ball');
  const [manualNumber, setManualNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { drawNumber, callNumber, state } = useGameSession(WS_URL);
  const maxNumber = VARIANTS[state?.variant ?? variant].maxNumber;

  const handleVariantChange = async (newVariant: GameVariant) => {
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change-variant', variant: newVariant }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      throw new Error(result.error ?? 'Unable to change the game variant');
    }

    setVariant(newVariant);
  };

  const handleManualCall = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await callNumber(Number(manualNumber));
      setManualNumber('');
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to call that number');
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input/select
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

    if (e.code === 'Space') {
      e.preventDefault(); // Prevent page scroll
      drawNumber();
    } else if (e.key === 'r' || e.key === 'R') {
      // Reset game
      fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      }).then(() => alert('Game reset!'));
    }
  }, [drawNumber]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bingo-bg p-8 text-2xl">
      <h1 className="mb-8 heading-lg font-bold text-bingo-text">Admin Panel</h1>
      <div className="flex flex-col gap-6">
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
              className="w-40 rounded border-2 border-white/30 bg-bingo-surface px-4 py-3 text-3xl font-bold text-bingo-text"
              required
            />
            <button
              type="submit"
              className="rounded-xl border-2 border-bingo-accent px-6 py-3 text-xl font-bold text-bingo-accent hover:bg-bingo-accent hover:text-bingo-bg"
            >
              Call Number
            </button>
          </div>
          {error && <p role="alert" className="text-lg font-bold text-red-300">{error}</p>}
        </form>
        <button
          type="button"
          onClick={drawNumber}
          className="rounded-xl bg-bingo-accent px-8 py-4 text-3xl font-bold text-bingo-bg hover:opacity-90"
        >
          Draw Number
        </button>
        <button
          type="button"
          onClick={() => {
            fetch('/api/game', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reset' }),
            }).then(() => alert('Game reset!'));
          }}
          className="rounded-xl border-2 border-white/30 px-6 py-2 text-lg text-bingo-text hover:border-bingo-accent hover:text-bingo-accent"
        >
          Reset Game
        </button>
        <p className="text-sm text-bingo-muted">
          Keyboard: <kbd className="rounded bg-bingo-surface px-1.5 py-0.5 font-mono text-base">Space</kbd> = Draw,{' '}
          <kbd className="rounded bg-bingo-surface px-1.5 py-0.5 font-mono text-base">R</kbd> = Reset
        </p>
      </div>
    </div>
  );
}
