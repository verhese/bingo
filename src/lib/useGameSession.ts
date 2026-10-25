'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_ROOM_ID } from '@/lib/gameRoom';
import type { GameState } from '@/types/game';

function defaultWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:3001`;
}

/** Resolves the browser-facing WebSocket URL configured at runtime via WS_PUBLIC_URL. */
export async function fetchWebSocketUrl(signal?: AbortSignal): Promise<string> {
  try {
    const response = await fetch('/api/ws-config', { signal });
    if (response.ok) {
      const result = (await response.json()) as { url?: string | null };
      if (result.url) return result.url;
    }
  } catch {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  }
  return defaultWebSocketUrl();
}

export function useGameSession(sessionId = DEFAULT_ROOM_ID) {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    let ws: WebSocket | null = null;
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

    const connect = async () => {
      let url: string;
      try {
        url = await fetchWebSocketUrl(controller.signal);
      } catch {
        return;
      }
      if (!isCurrent) return;
      const socket = new WebSocket(url);
      ws = socket;
      socket.onopen = () => {
        setConnected(true);
        socket.send(JSON.stringify({ action: 'subscribe', sessionId }));
      };
      socket.onmessage = (e) => setState(JSON.parse(e.data));
      socket.onclose = () => setConnected(false);
    };
    void connect();
    return () => {
      isCurrent = false;
      controller.abort();
      ws?.close();
    };
  }, [sessionId]);

  const drawNumber = async () => {
    return performGameAction('draw');
  };

  const callNumber = async (number: number) => {
    return performGameAction('call-number', number);
  };

  const undoLastCall = async (number: number) => {
    return performGameAction('undo-last-draw', number);
  };

  const performGameAction = async (
    action: 'draw' | 'call-number' | 'undo-last-draw',
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
  return { state: activeState, connected, drawNumber, callNumber, undoLastCall };
}
