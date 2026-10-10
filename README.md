# Bingo

Bingo is an accessibility-focused web app for community bingo sessions. It gives callers clear controls and projects the current call, full board, and call history to the room. All game data is visual; no sound is required.

## Features

- Large live caller display and responsive drawn-number board.
- Independent named game rooms using a `room` query parameter.
- 90-ball, 75-ball, and Speedy Bingo variants.
- Built-in Single Row and Standard game modes, plus room-local custom 75-ball modes with reorderable stages.
- Random draws, validated manual calls, resets, variant changes, and five-number Bingo-claim verification.
- Live room-scoped updates over WebSocket.
- High-contrast light theme, persisted dark-theme option, and keyboard caller controls.
- Printable 75-ball and 90-ball card sets with browser print and A4 PDF download.

## 75-ball game modes

Choose a game mode when creating a room; that mode is fixed for the room, including after a reset. A verified Bingo claim completes the current stage and advances the game to the next one:

- **Single Row** — one stage; a player wins by completing any horizontal row on their card.
- **Standard** — four stages, in order: **Top Row**, **Bottom Row**, **Sint-Andreas Cross** (the X-shaped pattern), then **Full Card**. The game is complete when a claim for the full card is verified.

When creating a room, you can also define a custom mode by selecting patterns and arranging their stage order. Custom modes belong to that room. Game modes are available for 75-ball games.

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
| `npm test` | Run unit and integration tests. |
| `npm run test:unit` | Run unit tests for pure game rules and utilities (`src/**/*.test.ts`). |
| `npm run test:integration` | Start a throwaway WebSocket game server on a free port and test its actions and the `/api/game` handlers (`tests/integration`). |
| `npm run test:e2e` | Run Playwright browser tests against isolated servers on ports 3100/3101 (`tests/e2e`). |
| `npm run test:all` | Run every test suite. |

Before the first end-to-end run, install the browser with `npx playwright install chromium`. The test suites start their own servers and keep no state, so they can run while the development servers are running. CI runs them in `.github/workflows/tests.yml`.

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
