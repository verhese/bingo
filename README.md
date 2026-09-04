# Bingo

> A web app to support bingo afternoons for our non-profit. Designed for accessibility — clear visuals, simple controls, easy for older players with hearing challenges.

## Overview

Bingo brings clarity and fun to our community bingo sessions. It displays:

- **The number just drawn** — big, bold, impossible to miss
- **All drawn numbers** in this game session on a clearly marked board
- **Current variant** being played (90-ball, 75-ball, Speedy Bingo, etc.)
- **Game state** — who has won, what's next

Everything is live and shared across the room so everyone sees the same thing at the same time.

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bingo

# Install dependencies
npm install

# Start the development server
npm run dev

# In a second terminal, start the live game service
npm run dev:ws
```

### Synology NAS Deployment

The included [compose.yaml](compose.yaml) runs the web app and its WebSocket game service as separate containers. In Synology Container Manager, create a project from this repository folder and use `compose.yaml` as the project file.

Publish both container ports on the NAS:

| NAS port | Service | Purpose |
|---|---|---|
| `3000` | `web` | Bingo application |
| `3001` | `ws-server` | Live game updates for browsers |

For a normal LAN installation, leave `NEXT_PUBLIC_WS_URL` blank in `.env`; clients will connect to the same NAS hostname on port `3001`. When using a reverse proxy or a custom public address, set it before building the project, for example:

```env
NEXT_PUBLIC_WS_URL=wss://bingo.example.com:3001
```

The Compose file configures `GAME_SERVER_WS_URL=ws://ws-server:3001` internally. Do not expose that Docker service hostname to browsers.

### Project Structure

```
.
├── src/
│   ├── components/           # UI components
│   │   ├── Board.tsx         # Main bingo board (drawn numbers grid)
│   │   ├── CallerDisplay.tsx # Big "current number" display
│   │   ├── VariantSelector.tsx # Pick which game variant
│   │   └── GameSessionBar.tsx # Session controls & status
│   ├── pages/
│   │   ├── GameRoom.tsx      # Live bingo room (projector / screen view)
│   │   ├── AdminPanel.tsx    # Caller / admin controls
│   │   └── PlayerCard.tsx    # Printable / on-screen player cards
│   ├── lib/
│   │   ├── useGameSession.ts # SWR hook for live session state
│   │   ├── bingoNumbers.ts   # Number generation, validation
│   │   └── variants.ts       # Variant definitions (90-ball, 75-ball…)
│   └── server/
│       └── api/              # API routes
├── web-dashboard/            # Admin dashboard for session management
├── public/
│   └── player-cards/         # Pre-printed bingo card templates
├── shared/
│   ├── flow-webservice-api-reference.md
│   └── flow-ui-reference.md
├── docs/
│   └── ARCHITECTURE.md
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end (Cypress / Playwright) |
| `npm run lint` | ESLint on all source code |
| `npm run format` | Prettier formatting |

## Key Features

- **Big clear display** — Current number shown at 200px+ so anyone in the room can read it
- **Drawn-number grid** — Full board with drawn cells highlighted; remaining numbers faded but visible
- **Variant support** — Switch between 90-ball, 75-ball, Speedy Bingo mid-session (with admin lock)
- **Live sync** — All screens update instantly via WebSocket / SSE
- **Printable cards** — Generate player cards for each game
- **Accessibility-first** — High contrast, large fonts, no reliance on sound

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design details.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting pull requests.

## API Reference

- **[Flow Webservice API Reference](./shared/flow-webservice-api-reference.md)**
- **[Flow UI Reference](./shared/flow-ui-reference.md)**

## License

This project is licensed under the [MIT License](./LICENSE).

## Acknowledgements

Built with ❤️ for our wonderful bingo community.
