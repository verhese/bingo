# Bingo UI Reference

## Game-session integration

`useGameSession` loads the selected room's current state through `GET /api/game?sessionId=...` and subscribes to the WebSocket game service for live updates. `getWebSocketUrl` uses `NEXT_PUBLIC_WS_URL` when set; otherwise it connects to the current browser hostname on port `3001`, choosing `wss` for HTTPS pages. The `room` query parameter selects a named session, such as `/admin-panel?room=hall-a` and `/game-room?room=hall-a`; no parameter uses the `default` room. The admin panel provides a readable active-room selector with each room's variant and drawn count, plus a separate new-room control that accepts a display name and lets the service create its internal ID. It also shows the five most recently called numbers for the active room, newest first. The game-room session bar uses `GET /api/game?rooms=true` to populate a room dropdown with display names. The admin panel uses `POST /api/game` to call a caller-entered number, draw a random number, verify a Bingo call, reset, and change the active variant; the game room rerenders only from broadcasts for its selected room. Failures from these admin actions, including an unavailable game service, appear in a dismissible alert notification rather than as uncaught browser errors.

## Display theme

The app starts in a high-contrast light theme for projection: white page and caller surfaces, dark text, slate borders, deep-amber controls, and bright yellow drawn-number cells. An icon button in the game-room session banner switches between light and dark themes. The selected theme is stored in browser local storage, so a projector keeps its preference after a refresh.

## Responsive board

`Board` applies a grid density tailored to its active variant and available space. Wide game-room displays use 15 columns for 90-ball and 75-ball boards; the layout reduces columns at tablet and phone breakpoints to retain readable cells. Each variant defines its grid rows as well as columns, so the board fills the available panel height without overflowing. Cell type scales to the board container rather than the viewport, and the phone game room reserves a stable caller-display height so the board follows directly below it without horizontal overflow.

## Draw history

`GameRoomPage` shows a scrollable `DrawHistory` panel beside the number board. It presents all called numbers in reverse draw order, with the newest call first and its draw position displayed. The panel has an explicit empty state before the first number is called and uses the live `drawnNumbers` game state, so it updates with every WebSocket broadcast.

## Bingo-call verification

`AdminPanelPage` places a `Verify Bingo` button beneath the draw control. It opens a dialog with five separate, tab-navigable number fields for the claimed winning line. The dialog checks that the numbers are unique, fall within the active variant's range, and are all present in the live drawn-number state, then sends valid claims to the game service for authoritative verification. Once confirmed, the game room shows a high-visibility `BINGO!` announcement above the number board with the verified winning line. The announcement disappears when the next number is called, or when the game is reset or its variant changes.

## Player cards

`PlayerCardPage` generates stable 75-ball or 90-ball card sets. Its controls can change the card quantity, enter a card-set name, generate a replacement set, open the browser print flow, or download the displayed set as a multi-page A4 PDF with one card per page. A supplied card-set name is printed below each card grid without a per-card number.

Run `npm run dev` and `npm run dev:ws` during local development.