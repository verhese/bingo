# Bingo

Bingo is an accessibility-focused web app for community bingo sessions. It gives callers clear controls and projects the current call, full board, and call history to the room. All game data is visual; no sound is required.

## Features

- Large live caller display and responsive drawn-number board.
- Independent named game rooms using a `room` query parameter.
- 90-ball, 75-ball, and Speedy Bingo variants.
- Built-in Single Row and Standard game modes, plus room-local custom 75-ball modes with reorderable stages.
- Random draws, validated manual calls, resets, and five-number Bingo-claim verification.
- Live room-scoped updates over WebSocket.
- Rooms, call history, and game state persist across restarts in PostgreSQL.
- High-contrast light theme, persisted dark-theme option, and keyboard caller controls.
- Printable 75-ball and 90-ball card sets with browser print and A4 PDF download.

## 75-ball game modes

Choose a game mode when creating a room; that mode is fixed for the room, including after a reset. A verified Bingo claim completes the current stage and advances the game to the next one:

- **Single Row** — one stage; a player wins by completing any horizontal row on their card.
- **Standard** — four stages, in order: **Top Row**, **Bottom Row**, **Sint-Andreas Cross** (the X-shaped pattern), then **Full Card**. The game is complete when a claim for the full card is verified.

When creating a room, you can also define a custom mode by selecting patterns and arranging their stage order. Custom modes belong to that room. Game modes are available for 75-ball games.

## Requirements

- Node.js 20.9 or later
- npm
- PostgreSQL (the game service stores rooms and game state there; Docker Compose provides one — see [docs/PERSISTENCE.md](docs/PERSISTENCE.md))

## Local development

```bash
npm install
cp .env.example .env              # set POSTGRES_PASSWORD
docker compose up -d postgres     # PostgreSQL on 127.0.0.1:5432
export DATABASE_URL=postgres://bingo:<POSTGRES_PASSWORD>@localhost:5432/bingo
npm run dev
# In a second terminal (with DATABASE_URL set)
npm run dev:ws
```

The Next.js app runs at `http://localhost:3000`; the WebSocket game service runs at `ws://localhost:3001`. The game service refuses to start without `DATABASE_URL`; tables are created automatically on first start.

| URL | Purpose |
|---|---|
| `http://localhost:3000/game-room` | Projector-facing game room |
| `http://localhost:3000/admin-panel/create` | Create a room (redirects to game control) |
| `http://localhost:3000/admin-panel?room=<id>` | Caller game controls for one room |
| `http://localhost:3000/player-card` | Player-card generation, printing, and PDF download |

Use the same `room` value in the game room and admin URLs to share a session, for example `?room=hall-a`. Missing or invalid room IDs redirect the admin panel to the lobby instead of creating a room.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with Turbopack. |
| `npm run dev:ws` | Start the WebSocket game service in watch mode (needs `DATABASE_URL`). |
| `npm run build` | Build the production web application. |
| `npm run start` | Start the production Next.js server. |
| `npm run start:ws` | Start the WebSocket game service (needs `DATABASE_URL`). |
| `npm run lint` | Run ESLint across the project. |
| `npm test` | Run unit and integration tests. |
| `npm run test:unit` | Run unit tests for pure game rules, storage serialization, and utilities (`src/**/*.test.ts`). |
| `npm run test:integration` | Start a throwaway PostgreSQL and WebSocket game server on free ports and test its actions, persistence across restarts, storage failures, and the `/api/game` handlers (`tests/integration`). |
| `npm run test:e2e` | Run Playwright browser tests against isolated servers and a throwaway PostgreSQL on ports 3100/3101/3102/54329 (`tests/e2e`). |
| `npm run test:all` | Run every test suite. |

Before the first end-to-end run, install the browser with `npx playwright install chromium`. The test suites start their own servers and database (no Docker or local PostgreSQL needed) and keep no state, so they can run while the development servers are running. CI runs them in `.github/workflows/tests.yml`.

## Docker deployment

[compose.yaml](compose.yaml) runs the web application, the WebSocket game service, and PostgreSQL as separate containers. Publish port `3000` for the web app and port `3001` for browser WebSocket connections. Set `POSTGRES_PASSWORD` (in `.env` or the environment) before starting; Compose will not start without it. Rooms are stored in the `postgres-data` volume, so they survive restarts and `docker compose up -d` upgrades; `docker compose down -v` deletes them. See [docs/PERSISTENCE.md](docs/PERSISTENCE.md) for configuration, backups, and production notes.

`GAME_SERVER_WS_URL=ws://ws-server:3001` is configured inside Compose for the web container. Browsers must not use that internal hostname. By default clients use the page hostname on port `3001`. Set `WS_PUBLIC_URL` on the `web` service when a different public WebSocket URL is required (for example behind a reverse proxy, such as on a Synology NAS):

```env
WS_PUBLIC_URL=wss://bingo.example.com
```

This is a runtime variable served through `/api/ws-config`, so changing it only needs a container restart (`docker compose up -d`), not a rebuild.

### Prebuilt image

CI publishes one generic image to GHCR (`ghcr.io/<owner>/bingo`, tags `latest` and the commit SHA) and, when the `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets exist, to Docker Hub. Use it for both services instead of building locally:

```yaml
services:
  web:
    image: ghcr.io/<owner>/bingo:latest
    command: npm start
  ws-server:
    image: ghcr.io/<owner>/bingo:latest
    command: npm run start:ws
```

Update with `docker compose pull && docker compose up -d`.

## Architecture and limitations

The WebSocket process is the game authority. The HTTP route at `/api/game` validates and forwards caller actions to it, while browser clients first load a snapshot and then subscribe directly for room-specific state updates. Rooms and game state are stored in PostgreSQL and restored when the service restarts; the service must run as a single instance. The admin panel is a caller-facing route but does not currently include authentication.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design, [shared/flow-webservice-api-reference.md](shared/flow-webservice-api-reference.md) for the HTTP and WebSocket contracts, and [shared/flow-ui-reference.md](shared/flow-ui-reference.md) for UI behavior.

See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for the automated accessibility checks, keyboard test results, and outstanding manual screen-reader verification.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. This project is licensed under the [MIT License](LICENSE).
