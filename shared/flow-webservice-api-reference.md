# Bingo Game API

## Game session

All endpoints use the shared WebSocket game service at `NEXT_PUBLIC_WS_URL`.

### `GET /api/game`

Returns the active game session.

```json
{
  "gameState": {
    "sessionId": "default",
    "variant": "90-ball",
    "drawnNumbers": [],
    "status": "waiting"
  }
}
```

### `POST /api/game`

Accepts a JSON body with one of these actions:

```json
{ "action": "draw", "sessionId": "default" }
{ "action": "call-number", "number": 42, "sessionId": "default" }
{ "action": "reset", "sessionId": "default" }
{ "action": "change-variant", "variant": "75-ball", "sessionId": "default" }
```

Each successful request returns the updated `gameState`. `call-number` accepts an uncalled whole number within the active variant's range. Invalid JSON, unsupported actions, unknown variants, duplicate numbers, and invalid number ranges return `400`; an unavailable game service returns `503`.