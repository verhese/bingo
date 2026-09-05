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
    "drawnNumbers": [12, 42],
    "status": "in-play",
    "verifiedBingo": { "claimedNumbers": [12, 24, 38, 42, 69] }
  }
}
```

`variant` is `90-ball`, `75-ball`, or `speedy`; their maximum numbers are 90, 75, and 30 respectively. `status` is `waiting`, `in-play`, or `complete`. `verifiedBingo` is `null` until a valid claim is accepted.

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
| `{ "action": "draw", "sessionId": "default" }` | Calls an available random number. Clears a verified Bingo. |
| `{ "action": "call-number", "sessionId": "default", "number": 42 }` | Calls one uncalled integer in the active variant range. |
| `{ "action": "create-session", "roomName": "Main Hall" }` | Creates a 90-ball room with a normalized display name and unique ID. |
| `{ "action": "verify-bingo", "sessionId": "default", "claimedNumbers": [12, 24, 38, 54, 69] }` | Accepts exactly five unique, drawn numbers in range and sets `verifiedBingo`. |
| `{ "action": "reset", "sessionId": "default" }` | Clears calls and sets the status to `waiting`, retaining the variant. |
| `{ "action": "change-variant", "sessionId": "default", "variant": "75-ball" }` | Changes the variant, clears calls, and sets the status to `waiting`. |

`call-number` rejects duplicates, non-integers, and numbers outside the active range. `verify-bingo` rejects all claims other than five unique, already-drawn numbers in that range. A new number, reset, or variant change clears a previously verified Bingo.

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

Malformed WebSocket JSON is ignored. Unsupported or invalid direct WebSocket actions do not produce a structured error response; use the HTTP API for validated caller actions.
