# Bingo App - Development Backlog

> Last verified against the codebase: 2026-09-05

## Completed

### Application and game play

- [x] Next.js App Router pages for the game room, caller controls, and printable player cards.
- [x] Per-room game sessions selected by the `room` query parameter; invalid or missing room IDs use `default`.
- [x] 90-ball, 75-ball, and Speedy Bingo variants.
- [x] Random drawing and validated manual number calls.
- [x] Session reset, variant changes, and room creation.
- [x] Caller-side Bingo claim verification for exactly five drawn numbers.
- [x] WebSocket live updates scoped to each subscribed room.

### User experience

- [x] Large caller display with a high-contrast light theme and optional persisted dark theme.
- [x] Responsive called-number board, including the Speedy Bingo layout.
- [x] Full draw history in the game room and five recent calls in the admin panel.
- [x] Keyboard controls in the admin panel: `Space` draws and `R` resets when focus is not in a form field.
- [x] Printable 75-ball and 90-ball card sets, browser printing, and multi-page A4 PDF download.
- [x] Optional card-set labels beneath generated cards.
- [x] Dismissible caller-action errors and accessible Bingo-verification feedback.

### Deployment

- [x] Docker Compose deployment with separate web and WebSocket service containers.
- [x] Configurable browser WebSocket URL (`NEXT_PUBLIC_WS_URL`) and server-to-service URL (`GAME_SERVER_WS_URL`).

## Remaining work

- [ ] Add automated unit, integration, and end-to-end tests. No test scripts currently exist in `package.json`.
- [ ] Complete an accessibility audit, including screen-reader and keyboard-only manual testing.
- [ ] Add durable session storage for rooms and calls. Sessions are currently in memory only.
- [ ] Define and implement authentication and access control for caller controls. The current admin route has no authentication layer.
- [ ] Improve production operations: health checks, structured logging, and a deployment/runbook validation pass.

## Current runtime surface

| Area | Location | Notes |
|---|---|---|
| App routes | `src/app/` | `/` redirects to `/game-room`; game room, admin panel, and player cards use the App Router. |
| HTTP game API | `src/app/api/game/route.ts` | Re-exports the implementation from `src/server/api/game/route.ts`. |
| Game authority | `src/server/ws-server.ts` | In-memory room sessions; port `3001` by default or `WS_PORT`. |
| Client state | `src/lib/useGameSession.ts` | Fetches an initial HTTP snapshot and subscribes to the selected room over WebSocket. |
| Components | `src/components/` | Board, caller display, history, recent calls, session bar, theme toggle, and variant selector. |
| Shared contracts | `shared/` | Keep both flow references in sync when API or UI behavior changes. |

## Local development

```bash
npm install
npm run dev
# In a separate terminal:
npm run dev:ws
```

Open `http://localhost:3000/game-room`, `http://localhost:3000/admin-panel`, or `http://localhost:3000/player-card`. Add `?room=hall-a` to the game room or admin URL to select a room.
