# Bingo Game API

## Game session

All endpoints use the shared WebSocket game service at `GAME_SERVER_WS_URL`. It defaults to `ws://localhost:3001` for local development; Docker Compose supplies `ws://ws-server:3001` for the internal container network.

### `GET /api/game`

Returns the active game session.

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

### `POST /api/game`

Accepts a JSON body with one of these actions:

```json
{ "action": "draw", "sessionId": "default" }
{ "action": "call-number", "number": 42, "sessionId": "default" }
{ "action": "verify-bingo", "claimedNumbers": [12, 24, 38, 54, 69], "sessionId": "default" }
{ "action": "reset", "sessionId": "default" }
{ "action": "change-variant", "variant": "75-ball", "sessionId": "default" }
```

Each successful request returns the updated `gameState`. `call-number` accepts an uncalled whole number within the active variant's range. `verify-bingo` accepts exactly five unique, previously called numbers within the active variant's range; when accepted, `gameState.verifiedBingo` contains the claimed line and is broadcast to all game-room clients. Calling another number, resetting the game, or changing its variant clears the verified Bingo. Invalid JSON, unsupported actions, unknown variants, duplicate numbers, invalid number ranges, and unverifiable Bingo claims return `400`; an unavailable game service returns `503`.