# Bingo UI Reference

## Game-session integration

`useGameSession` subscribes to the WebSocket game service for live state updates. `getWebSocketUrl` uses `NEXT_PUBLIC_WS_URL` when set; otherwise it connects to the current browser hostname on port `3001`, choosing `wss` for HTTPS pages. The admin panel uses `POST /api/game` to call a caller-entered number, draw a random number, verify a Bingo call, reset, and change the active variant; the game room rerenders from broadcast game state.

## Bingo-call verification

`AdminPanelPage` places a `Verify Bingo` button beneath the draw control. It opens a dialog with five separate, tab-navigable number fields for the claimed winning line. The dialog checks that the numbers are unique, fall within the active variant's range, and are all present in the live drawn-number state, then sends valid claims to the game service for authoritative verification. Once confirmed, the game room shows a high-visibility `BINGO!` announcement above the number board with the verified winning line. The announcement disappears when the next number is called, or when the game is reset or its variant changes.

## Player cards

`PlayerCardPage` generates stable 75-ball or 90-ball card sets. Its controls can change the card quantity, enter a card-set name, generate a replacement set, open the browser print flow, or download the displayed set as a multi-page A4 PDF with one card per page. A supplied card-set name is printed below each card grid without a per-card number.

Run `npm run dev` and `npm run dev:ws` during local development.