# Bingo UI Reference

## Game-session integration

`useGameSession` subscribes to the WebSocket game service for live state updates. `getWebSocketUrl` uses `NEXT_PUBLIC_WS_URL` when set; otherwise it connects to the current browser hostname on port `3001`, choosing `wss` for HTTPS pages. The admin panel uses `POST /api/game` to call a caller-entered number, draw a random number, reset, and change the active variant; the game room rerenders from broadcast game state.

Run `npm run dev` and `npm run dev:ws` during local development.