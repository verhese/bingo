# Bingo Game API

## Game sessions

All endpoints use the shared WebSocket game service at `GAME_SERVER_WS_URL`. It defaults to `ws://localhost:3001` for local development; Docker Compose supplies `ws://ws-server:3001` for the internal container network. Each room has an isolated game session identified by a lowercase slug of up to 32 characters. Omitting `sessionId` selects the `default` room.

### `GET /api/game?sessionId=hall-a`

Returns the selected room's game session.

```json
{
  "gameState": {
    "sessionId": "default",
    "variant": "90-ball",
    "drawnNumbers": [],
    "status": "waiting",
    "verifiedBingo": null
  }
}
```

### `GET /api/game?rooms=true`

Returns all active room identifiers for room selectors. The `default` room is always included.

```json
{
  "sessionIds": ["default", "hall-a", "lobby"]
}
```

### `POST /api/game`

Accepts a JSON body with one of these actions:

```json
{ "action": "draw", "sessionId": "default" }
{ "action": "call-number", "number": 42, "sessionId": "default" }
{ "action": "verify-bingo", "claimedNumbers": [12, 24, 38, 54, 69], "sessionId": "default" }
{ "action": "reset", "sessionId": "default" }
{ "action": "change-variant", "variant": "75-ball", "sessionId": "default" }
```

Each successful request returns the updated `gameState` for its `sessionId`. `call-number` accepts an uncalled whole number within the active variant's range. `verify-bingo` accepts exactly five unique, previously called numbers within the active variant's range; when accepted, `gameState.verifiedBingo` is broadcast only to clients subscribed to that room. Calling another number, resetting the game, or changing its variant clears the verified Bingo for that room. Invalid JSON, unsupported actions, unknown variants, duplicate numbers, invalid number ranges, and unverifiable Bingo claims return `400`; an unavailable game service returns `503`.