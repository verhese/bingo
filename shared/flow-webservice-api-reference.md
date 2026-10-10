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
    "variant": "75-ball",
    "gameModeId": "standard",
    "customGameModes": [],
    "mode": "standard",
    "selectedMode": "standard",
    "gameMode": "standard",
    "stageIndex": 1,
    "currentStageIndex": 1,
    "activeStageIndex": 1,
    "stage": "bottom-row",
    "currentStage": "bottom-row",
    "activeStage": "bottom-row",
    "completedStages": ["top-row"],
    "drawMode": "auto",
    "drawnNumbers": [12, 42],
    "undoneNumbers": [],
    "lastUndoneNumber": null,
    "status": "in-play",
    "verifiedBingo": { "claimedNumbers": [12, 24, 38, 42, 69] }
  }
}
```

`variant` is `90-ball`, `75-ball`, or `speedy`; their maximum numbers are 90, 75, and 30 respectively. `status` is `waiting`, `in-play`, or `complete`. `verifiedBingo` is `null` until a valid claim is accepted.
`gameModeId` defaults to `single-row`. The built-in modes are `single-row` and `standard`; `customGameModes` lists the optional custom mode configured when the room was created. Each mode has an `id`, `name`, and ordered `patterns` array. The room's selected mode is immutable after creation, including after reset. Custom modes are in-memory only and do not survive a game-service restart.
`mode`, `selectedMode`, and `gameMode` mirror `gameModeId`. `stageIndex`/`currentStage` identify the currently active bingo stage in the selected ordered mode; `completedStages` tracks prior stage confirmations. Reset and variant changes clear the stage state.
`drawMode` is `null` before the first accepted call, then `auto` for random draws or `manual` for caller-entered numbers. Reset and variant changes clear the mode.
`undoneNumbers` contains calls removed with undo; those numbers remain marked on the board until called again. Reset and variant changes clear this list.
`lastUndoneNumber` is the most recently undone call shown in the caller display. It remains set until another number is called, then resets to `null`. Reset and variant changes also clear it.

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
| `{ "action": "undo-last-draw", "sessionId": "default", "number": 42 }` | In manual mode, removes the latest call if it is still 42, marks it undone, and clears a verified Bingo. The `number` guard prevents a stale confirmation from undoing a newer call. |
| `{ "action": "create-session", "roomName": "Main Hall", "variant": "75-ball", "gameModeId": "standard" }` | Creates a room with a normalized display name and unique ID. `variant` is optional and defaults to `75-ball`; `gameModeId` is only used for 75-ball rooms and defaults to `standard`. |
| `{ "action": "create-session", "roomName": "Finals", "gameModeId": "custom", "gameModeName": "Finals", "patterns": ["top-row", "full-card"] }` | Creates a room with a custom mode composed of one or more unique registered patterns, in the supplied stage order. |
| `{ "action": "verify-bingo", "sessionId": "default", "expectedStageIndex": 0, "claimedNumbers": [12, 24, 38, 54, 69] }` | Accepts the unique, drawn numbers required by the expected active stage (5 for a row, 8 for the cross, 24 for full card; Single Row also allows 4) and sets `verifiedBingo`. A stale `expectedStageIndex` returns `409`. |
| `{ "action": "reset", "sessionId": "default" }` | Clears calls and draw mode and sets the status to `waiting`, retaining the variant. |
| `{ "action": "change-variant", "sessionId": "default", "variant": "75-ball" }` | Changes the variant, clears calls and draw mode, and sets the status to `waiting`. |

`call-number` rejects duplicates, non-integers, and numbers outside the active range. Switching between automatic and manual calls after the first accepted call returns `409` with an `error` string; reset or variant change unlocks the game. `verify-bingo` requires the `expectedStageIndex` from the caller's current game state and returns `409` if that stage has changed; it rejects all claims that are not the unique, already-drawn numbers the active stage requires. A new number, reset, or variant change clears a previously verified Bingo.
The deprecated `select-game-mode` and `create-game-mode` actions are rejected: a room's mode must be selected or configured in `create-session` and cannot be changed later. Reset preserves the selected mode and its custom definition; custom modes remain isolated to their room and are lost when the service restarts.
`undo-last-draw` is accepted only in manual mode while the game is in play and at least one number has been called; automatic mode, an empty call history, or a stale `number` returns `409`. Undoing preserves manual mode. Calling an undone number again removes its undone marker.

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
