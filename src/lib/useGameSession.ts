'use client';

import { useState, useEffect } from 'react';
import type { GameState } from '@/types/game';

export function useGameSession(url: string) {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => setState(JSON.parse(e.data));
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [url]);

  const drawNumber = async () => {
    return performGameAction('draw');
  };

  const callNumber = async (number: number) => {
    return performGameAction('call-number', number);
  };

  const performGameAction = async (
    action: 'draw' | 'call-number',
    number?: number,
  ) => {
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sessionId: state?.sessionId, number }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      throw new Error(result.error ?? 'Unable to draw a number');
    }

    const result = (await response.json()) as { gameState: GameState };
    setState(result.gameState);
  };

  return { state, connected, drawNumber, callNumber };
}
