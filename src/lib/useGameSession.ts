'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_ROOM_ID } from '@/lib/gameRoom';
import type { GameState } from '@/types/game';

export function useGameSession(url: string, sessionId = DEFAULT_ROOM_ID) {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    const ws = new WebSocket(url);
    setState(null);

    const loadState = async () => {
      try {
        const response = await fetch(`/api/game?sessionId=${encodeURIComponent(sessionId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = (await response.json()) as { gameState?: GameState };
        if (isCurrent && result.gameState?.sessionId === sessionId) {
          setState(result.gameState);
        }
      } catch {
        // The WebSocket subscription remains available as a live-state fallback.
      }
    };

    void loadState();
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ action: 'subscribe', sessionId }));
    };
    ws.onmessage = (e) => setState(JSON.parse(e.data));
    ws.onclose = () => setConnected(false);
    return () => {
      isCurrent = false;
      controller.abort();
      ws.close();
    };
  }, [sessionId, url]);

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
      body: JSON.stringify({ action, sessionId, number }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      throw new Error(result.error ?? 'Unable to draw a number');
    }

    const result = (await response.json()) as { gameState: GameState };
    setState(result.gameState);
  };

  const activeState = state?.sessionId === sessionId ? state : null;
  return { state: activeState, connected, drawNumber, callNumber };
}
