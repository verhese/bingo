# Bingo UI Reference

## Game-session integration

`useGameSession` subscribes to the WebSocket game service for live state updates. The admin panel uses `POST /api/game` to call a caller-entered number, draw a random number, reset, and change the active variant; the game room rerenders from broadcast game state.

Run `npm run dev` and `npm run dev:ws` during local development.