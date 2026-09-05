# Bingo UI Reference

## Game-session integration

`useGameSession` selects a room from the page `room` query parameter, loads its initial state through `GET /api/game?sessionId=...`, then subscribes over WebSocket with `{ "action": "subscribe", "sessionId": ... }`. Omitted or invalid IDs use `default`. `getWebSocketUrl` uses `NEXT_PUBLIC_WS_URL` when present; otherwise it connects to the page hostname on port `3001`, using `wss` for HTTPS pages.

The game room and admin panel both show the active room as a query parameter. The admin panel lists the available room summaries and can create a room from a name; the game room lists rooms in its session bar. The directory is fetched when the selected room changes, so newly created rooms become visible after navigation or a subsequent room selection.

## Game room

`GameRoomPage` renders `GameSessionBar`, `CallerDisplay`, `Board`, and `DrawHistory` for the selected room. The session bar shows room, variant, number count, status, and an icon-only theme control. `CallerDisplay` displays the latest called number or an em dash before the first call, using a polite ARIA live region.

`Board` is a single component with layouts for 90-ball, 75-ball, and Speedy Bingo. It highlights called numbers and displays a high-visibility verified-Bingo announcement above the grid when the room state includes a verified claim. `DrawHistory` presents every call newest first with its original draw position and an explicit empty state.

The board adapts from 15 columns on wide screens to denser phone layouts. On small screens, the caller display has a fixed-height row and draw history moves beneath the board.

## Admin panel

The caller UI provides:

- An active-room selector, room-creation form, and link that opens the selected game room.
- Five recent calls, newest first.
- Variant selection, a random draw command, a validated manual-number form, and reset.
- `Space` to draw and `R` to reset unless focus is in an input or select; `Escape` closes the Bingo dialog.
- A five-field Bingo-verification dialog that reports wrong count, invalid/repeated values, and numbers not yet called before submitting a valid claim.
- A dismissible service-error alert for failed caller actions.

There is no sign-in or other authorization behavior at this time.

## Theme and accessibility

The default is a high-contrast light theme with white caller surfaces, dark text, slate borders, amber controls, and yellow drawn cells. The game-room theme button switches to dark mode and stores the choice in `localStorage` under `bingo-theme`. Core state is communicated visually without a sound dependency, and caller controls provide visible labels and keyboard access.

## Player cards

`PlayerCardPage` is independent of live game sessions. It generates 75-ball or 90-ball card sets with a selectable quantity (1, 2, 3, 4, 5, 6, 8, or 10), optional card-set name, browser print action, replacement-card action, and multi-page A4 PDF download. A supplied set name appears beneath every displayed card; generated cards do not show individual card numbers. Speedy Bingo cards are not available.
