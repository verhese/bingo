# Bingo Game API

## Service model

The public HTTP API is `/api/game`. Its implementation communicates with the WebSocket game service at `GAME_SERVER_WS_URL`, which defaults to `ws://localhost:3001`; Docker Compose sets it to `ws://ws-server:3001` inside the container network. The game service holds room sessions in memory only.

All HTTP actions return `503` with `{ "error": "Game service is unavailable" }` when the service cannot be reached. Invalid input returns `400` with an `error` string.

`sessionId` is optional. Missing or invalid IDs resolve to `default`; valid IDs are lower-case, begin with a letter or digit, contain only letters, digits, and hyphens, and are at most 32 characters.

## State shapes

```json
{
  "gameState": {
    "sessionId": "hall-a",
    "roomName": "Main Hall",
    "variant": "90-ball",
    "drawMode": "auto",
    "drawnNumbers": [12, 42],
    "undoneNumbers": [],
    "status": "in-play",
    "verifiedBingo": { "claimedNumbers": [12, 24, 38, 42, 69] }
  }
}
```

`variant` is `90-ball`, `75-ball`, or `speedy`; their maximum numbers are 90, 75, and 30 respectively. `status` is `waiting`, `in-play`, or `complete`. `verifiedBingo` is `null` until a valid claim is accepted.
`drawMode` is `null` before the first accepted call, then `auto` for random draws or `manual` for caller-entered numbers. Reset and variant changes clear the mode.
`undoneNumbers` contains calls removed with undo; those numbers remain marked on the board until called again. Reset and variant changes clear this list.

```json
{
  "sessions": [
    { "sessionId": "hall-a", "roomName": "Main Hall", "variant": "90-ball", "drawnCount": 12, "status": "in-play" }
  ]
}
```

## HTTP endpoints

### `GET /api/game?sessionId=hall-a`

Returns the selected room as `{ "gameState": GameState }`. The request creates the session if it does not yet exist.

### `GET /api/game?rooms=true`

Returns `{ "sessions": RoomSummary[] }`, sorted by room name. The default room is created and included when the directory is first requested. The game room, admin panel, and player-card room selector use this directory; player cards use the selected 75-ball or 90-ball summary's `roomName` as their printed card-set name and its `variant` as the generated card layout.

### `POST /api/game`

Send JSON with one of the following actions. A successful response is always `{ "gameState": GameState }`.

| Request | Effect |
|---|---|
| `{ "action": "draw", "sessionId": "default" }` | Calls an available random number. Locks the game to automatic drawing on its first accepted call and clears a verified Bingo. |
| `{ "action": "call-number", "sessionId": "default", "number": 42 }` | Calls one uncalled integer in the active variant range. Locks the game to manual calls on its first accepted call. |
| `{ "action": "undo-last-draw", "sessionId": "default", "number": 42 }` | Removes the latest call if it is still 42, marks it undone, and clears a verified Bingo. The `number` guard prevents a stale confirmation from undoing a newer call. |
| `{ "action": "create-session", "roomName": "Main Hall" }` | Creates a 75-ball room with a normalized display name and unique ID. |
| `{ "action": "verify-bingo", "sessionId": "default", "claimedNumbers": [12, 24, 38, 54, 69] }` | Accepts exactly five unique, drawn numbers in range and sets `verifiedBingo`. |
| `{ "action": "reset", "sessionId": "default" }` | Clears calls and draw mode and sets the status to `waiting`, retaining the variant. |
| `{ "action": "change-variant", "sessionId": "default", "variant": "75-ball" }` | Changes the variant, clears calls and draw mode, and sets the status to `waiting`. |

`call-number` rejects duplicates, non-integers, and numbers outside the active range. Switching between automatic and manual calls after the first accepted call returns `409` with an `error` string; reset or variant change unlocks the game. `verify-bingo` rejects all claims other than five unique, already-drawn numbers in that range. A new number, reset, or variant change clears a previously verified Bingo.
`undo-last-draw` is accepted only while the game is in play and at least one number has been called; otherwise it returns `409`. Undoing preserves the draw mode. Calling an undone number again removes its undone marker.

## Browser WebSocket protocol

Browsers connect to `NEXT_PUBLIC_WS_URL` when configured; otherwise they use the current page hostname on port `3001` and select `ws` or `wss` from the page protocol. After connecting, the client must subscribe:

```json
{ "action": "subscribe", "sessionId": "hall-a" }
```

The service immediately sends the room `GameState`, then sends each subsequent state update only to sockets subscribed to that room. The same service also understands these internal/protocol messages:

| Message | Response |
|---|---|
| `{ "action": "list-sessions" }` | `{ "sessions": RoomSummary[] }` |
| `{ "action": "ping", "sessionId": "hall-a" }` | Current `GameState` |
| Any public game action above | Updated `GameState`, broadcast to subscribed room clients when accepted |

Malformed WebSocket JSON is ignored. A draw-mode conflict returns `{ "error": "..." }` to the requesting socket and is not broadcast. Other unsupported or invalid direct WebSocket actions do not produce a structured error response; use the HTTP API for validated caller actions.
