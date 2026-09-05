# Bingo

Bingo is an accessibility-focused web app for community bingo sessions. It gives callers clear controls and projects the current call, full board, and call history to the room. All game data is visual; no sound is required.

## Features

- Large live caller display and responsive drawn-number board.
- Independent named game rooms using a `room` query parameter.
- 90-ball, 75-ball, and Speedy Bingo variants.
- Random draws, validated manual calls, resets, variant changes, and five-number Bingo-claim verification.
- Live room-scoped updates over WebSocket.
- High-contrast light theme, persisted dark-theme option, and keyboard caller controls.
- Printable 75-ball and 90-ball card sets with browser print and A4 PDF download.

## Requirements

- Node.js 18 or later
- npm

## Local development

```bash
npm install
npm run dev
# In a second terminal
npm run dev:ws
```

The Next.js app runs at `http://localhost:3000`; the WebSocket game service runs at `ws://localhost:3001`.

| URL | Purpose |
|---|---|
| `http://localhost:3000/game-room` | Projector-facing game room |
| `http://localhost:3000/admin-panel` | Caller controls |
| `http://localhost:3000/player-card` | Player-card generation, printing, and PDF download |

Use the same `room` value in the game room and admin URLs to share a session, for example `?room=hall-a`. Missing or invalid room IDs select `default`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with Turbopack. |
| `npm run dev:ws` | Start the WebSocket game service in watch mode. |
| `npm run build` | Build the production web application. |
| `npm run start` | Start the production Next.js server. |
| `npm run start:ws` | Start the WebSocket game service. |
| `npm run lint` | Run ESLint across the project. |

Automated test scripts are not configured yet.

## Docker deployment

[compose.yaml](compose.yaml) runs the web application and WebSocket game service as separate containers. Publish port `3000` for the web app and port `3001` for browser WebSocket connections.

`GAME_SERVER_WS_URL=ws://ws-server:3001` is configured inside Compose for the web container. Browsers must not use that internal hostname. By default clients use the page hostname on port `3001`; set `NEXT_PUBLIC_WS_URL` before building when a different public WebSocket URL is required:

```env
NEXT_PUBLIC_WS_URL=wss://bingo.example.com:3001
```

## Architecture and limitations

The WebSocket process is the game authority. The HTTP route at `/api/game` validates and forwards caller actions to it, while browser clients first load a snapshot and then subscribe directly for room-specific state updates. Sessions are held in memory only, so restarting the WebSocket service clears every room and its call history. The admin panel is a caller-facing route but does not currently include authentication.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design, [shared/flow-webservice-api-reference.md](shared/flow-webservice-api-reference.md) for the HTTP and WebSocket contracts, and [shared/flow-ui-reference.md](shared/flow-ui-reference.md) for UI behavior.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. This project is licensed under the [MIT License](LICENSE).
