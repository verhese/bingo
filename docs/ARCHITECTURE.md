# Architecture

This document describes the system architecture of Bingo — a web app to support bingo afternoons for our non-profit.

## High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                 Admin Panel / Caller                  │
│  ┌──────────────┐       ┌─────────────────────────┐ │
│  │  Admin UI    │       │  Number Caller Button   │ │
│  │ (variant     │       │         (click to draw) │ │
│  │  selector,   │       └──────────┬──────────────┘ │
│  │  game mgmt)  │                  │                │
│  └──────────────┘                  ▼                │
└─────────────────────────┬───────────────────────────┘
                          │  WebSocket / SSE
                          ▼
┌─────────────────────────────────────────────────────┐
│               Game Engine Service                    │
│  ┌───────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Number    │ │ Variant   │ │ Session Manager  │  │
│  │ Generator │ │ Registry  │ │                  │  │
│  └───────────┘ └───────────┘ └──────────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ Game Room    │ │ Player      │ │  Board       │
│ (projector   │ │ Cards API   │ │  State Store │
│  view)       │ │             │ │              │
└──────────────┘ └─────────────┘ └──────────────┘
```

## Core Components

### CallerDisplay (`src/components/CallerDisplay.tsx`)

Shows the number just drawn at a very large size (200px+). High-contrast colour scheme. Announces nothing by sound — visual only.

### Board (`src/components/Board.tsx`)

A grid showing all numbers for the current variant. Drawn numbers are highlighted; undrawn numbers remain visible but muted.

```
boards/
├── Bingo90Board.tsx      # 90-ball layout (1-90)
├── Bingo75Board.tsx      # 75-ball layout (1-75)
└── BoardBase.tsx         # Shared grid rendering logic
```

### VariantSelector (`src/components/VariantSelector.tsx`)

Admin-only dropdown to switch the active game variant. Prevents accidental mid-game changes.

### GameSessionBar (`src/components/GameSessionBar.tsx`)

Shows current session info: variant, numbers drawn count, game status (waiting / in-play / complete).

### Pages

| Page | Purpose |
|---|---|
| `GameRoom` | Full-screen display for the room projector. Shows CallerDisplay + Board side by side. |
| `AdminPanel` | Controls: draw number, reset board, pick variant, generate player cards. Locked to admin role. |
| `PlayerCard` | Renders a printable bingo card layout (A4). Can also be viewed on-screen for digital players. |

### Live Sync

All screens subscribe to the same game session via WebSocket. When the caller draws a number:

1. Caller clicks "Draw" in AdminPanel
2. Game Engine picks next available number (variant-aware)
3. WebSocket broadcasts `{ drawnNumber, sessionId, variant }`
4. All connected clients re-render instantly (SWR + SWR subscription or direct WS listener)

### Planned Enhancements

The current implementation uses one shared game session and provides persistent high-contrast light and dark display themes. Future work will support multiple concurrent sessions. Each session will need isolated game state and WebSocket broadcasts, allowing separate rooms to operate independently.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Large fonts / high contrast | Players have hearing and vision challenges — visual clarity is critical. |
| No sound dependency | Hearing-impaired players must not miss anything. |
| SWR for state fetching | Automatic revalidation keeps all screens in sync without polling. |
| Variant-aware number pool | 90-ball = numbers 1–90, 75-ball = 1–75, etc. Board + generator adapt to variant. |
| Admin-locked actions | Only the caller can draw numbers or change variants during a game. |

## Data Flow

```
Caller (AdminPanel)
    │ click "Draw"
    ▼
Game Engine → pick next number → validate against drawn set
    │
    ├──► WebSocket broadcast (live room screens update)
    ├──► Persist drawn set to DB
    └──► Emit 'numberDrawn' event
        │
        ├─► GameRoom page: CallerDisplay + Board re-render
        ├─► Player cards: auto-ink matched numbers
        └─► AdminPanel: update drawn count, check for wins
```

## Accessibility Considerations

| Concern | Solution |
|---|---|
| Hard of hearing | No sound required; all info visual |
| Poor vision | 200px caller number, high-contrast palette, large grid cells (min 48×48px) |
| Motor impairment | Keyboard shortcuts for admin: `Space` = draw, `R` = reset |
| Cognitive load | One variant at a time; clear visual distinction between game states |

