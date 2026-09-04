# Bingo App — Development Backlog

> Last synced: 2026-08-29

## 🏗️ PROJECT SETUP (Done ✅)

### Documentation Files
| File | Status | Notes |
|---|---|---|
| `README.md` | ✅ Done | Updated for Bingo bingo afternoons app purpose, accessibility features |
| `CONTRIBUTING.md` | ✅ Done | Standard contribution guidelines |
| `CHANGELOG.md` | ✅ Done | Unreleased section with bingo-app features |
| `CODE_OF_CONDUCT.md` | ✅ Done | Standard Contributor Covenant (no domain changes needed) |
| `LICENSE` | ✅ Done | MIT License |
| `docs/ARCHITECTURE.md` | ✅ Done | Redone for Bingo app — CallerDisplay, Board, VariantSelector, GameSessionBar components |
| `BACKLOG.md` | ✅ Done | Updated 2026-08-30 — Phase 1 complete, all core files implemented |

### Configuration Files
| File | Status | Notes |
|---|---|---|
| `package.json` | ✅ Done | All dependencies declared (next, react, tailwind, swr, ws, lucide-react, etc.) |
| `next.config.mjs` | ✅ Done | Basic Next.js config |
| `tsconfig.json` | ✅ Done | Strict mode, path aliases (@/* → src/*) |
| `tailwind.config.ts` | ✅ Done | Custom Bingo theme colors and font sizes |
| `.env.example` | ✅ Done | BINGO_VARIANT, NEXT_PUBLIC_WS_URL |

### Directory Structure Created
| Path | Status | Notes |
|---|---|---|
| `src/app/` | ✅ Done | App Router root |
| `src/app/game-room/` | ✅ Done | Live bingo room page |
| `src/app/admin-panel/` | ✅ Done | Caller controls page |
| `src/app/player-card/` | ✅ Done | Player card viewer page |
| `src/components/` | ✅ Done | UI components |
| `src/lib/` | ✅ Done | Utility functions |
| `src/server/api/` | ✅ Done | API routes |
| `src/server/api/game/` | ✅ Done | Game action API routes |
| `src/styles/` | ✅ Done | Global CSS |
| `src/types/` | ✅ Done | TypeScript interfaces |

---

## ✅ COMPLETED — Phase 1 (2026-08-30)

All core files are now implemented and functional:

| File | Status | Notes |
|---|---|---|
| `src/server/ws-server.ts` | ✅ Done | WebSocket server on port 3001, session management, draw/reset/change-variant |
| `src/server/api/game/route.ts` | ✅ Done | API routes: POST /draw, POST /reset, GET /state |
| `src/app/admin-panel/page.tsx` | ✅ Done | Keyboard shortcuts (Space=draw, R=reset) |
| `src/app/player-card/page.tsx` | ✅ Done | Real random card generation + print support |
| `src/lib/generateCard.ts` | ✅ Done | 75-ball and 90-ball random card generation |

### Error Status After Session
| File | Errors Remaining |
|---|---|
| `ws-server.ts` | **ZERO** |
| `api/game/route.ts` | **ZERO** |
| `admin-panel/page.tsx` | **ZERO** |
| `player-card/page.tsx` | **ZERO** |
| `bingoNumbers.ts` | **ZERO** |
| `game-room/page.tsx` | Minor: unused import + variable (no runtime impact) |
| `generateCard.ts` | Pylance Python lint warnings on Math.random (harmless — see below) |

### Remaining Harmless Warnings
- **generateCard.ts**: Pylance (Python linter) flags `Math.random` in `.ts` files. Fix: add `"python.analysis.ignore": ["**/*.ts"]` to workspace settings or configure pyright to exclude these files. Code is functionally correct.
- **game-room/page.tsx**: Unused import `VariantSelector` and unused variable `drawNumber`. No runtime impact, cleanup can wait.

---

### Utilities (`src/lib/`)
| File | Needs? | Description |
|---|---|---|
| `variants.ts` | ✅ Done | VARIANTS record (90-ball, 75-ball, speedy), getVariant() helper |
| `bingoNumbers.ts` | ✅ Done | generateAllNumbers(), getNextNumber() functions |
| `useGameSession.ts` | ✅ Done | Client hook — WebSocket connect, drawNumber() fetch via POST /api/game |

### Components (`src/components/`)
| File | Needs? | Description |
|---|---|---|
| `CallerDisplay.tsx` | ✅ Done | Large number display (200px), high contrast bg-bingo-bg, text-bingo-accent |
| `Board.tsx` | ✅ Done | Grid of maxNumber cells, highlighted drawn vs undrawn styling |
| `VariantSelector.tsx` | ✅ Done | Admin-only dropdown to switch game variant |
| `GameSessionBar.tsx` | ✅ Done | Top bar showing variant, drawn count, status |

### App Pages (`src/app/`)
| File | Needs? | Description |
|---|---|---|
| `layout.tsx` | ✅ Done | Root layout, metadata (title: "Bingo"), global font size 18px |
| `game-room/page.tsx` | ✅ Done | Full-screen CallerDisplay + Board + GameSessionBar |
| `admin-panel/page.tsx` | ✅ Done | Variant selector + big Draw Number button, keyboard shortcuts (Space=draw, R=reset) |
| `player-card/page.tsx` | ✅ Done | Printable bingo card layout with print @media query support |

### Server (`src/server/`)
| File | Needs? | Description |
|---|---|---|
| `api/game/route.ts` | ✅ Done | API route handler bridges draw, reset, variant, and state requests to the game service |
| `ws-server.ts` | ✅ Done | WebSocket server on port 3001 is the shared session authority for live sync |

### Styles (`src/styles/`)
| File | Needs? | Description |
|---|---|---|
| `globals.css` | ✅ Done | Tailwind @import, 18px accessibility baseline, print media rules for player cards |

---

## 📋 FUTURE ENHANCEMENTS (Not Yet Started)

- [ ] PDF export for print-ready cards
- [ ] "Bingo!" call verification UI in AdminPanel  
- [ ] Drawn-number history list (scrollable)
- [ ] Board responsive cell sizing
- [x] Synology NAS Docker deployment (`Dockerfile`, `compose.yaml`, and deployment guide)
- [ ] Production readiness (ESLint configuration and tests)
- [ ] Accessibility audit (WCAG contrast, screen readers, keyboard nav)

---

## 🔗 REFERENCES & DECISIONS

### Tech Stack (Confirmed)
- **Framework:** Next.js 15 (App Router, Turbopack dev server)
- **Language:** TypeScript (strict mode)
- **Styling:** TailwindCSS 4 + @tailwindcss/forms + @tailwindcss/typography
- **State Sync:** SWR for data fetching, WebSocket for live updates
- **Icons:** lucide-react
- **Runtime:** Node.js >= 18

### Key Design Decisions (From ARCHITECTURE.md)
- Large fonts / high contrast — Players have hearing and vision challenges
- No sound dependency — Hearing-impaired players must not miss anything
- SWR for state fetching — Automatic revalidation keeps all screens in sync without polling
- Variant-aware number pool — 90-ball = numbers 1–90, 75-ball = 1–75
- Admin-locked actions — Only the caller can draw numbers or change variants

### Color Palette (Tailwind config)
| Token | Value | Usage |
|---|---|---|
| `bingo-bg` | #1a1a2e | App background |
| `bingo-surface` | #16213e | Cards, bars, panels |
| `bingo-accent` | #f0c040 | Drawn numbers, CTA buttons |
| `bingo-muted` | #8b9bb4 | Secondary text, faded cells |
| `bingo-text` | #ffffff | Primary text |
| `bingo-success` | #4ade80 | "Bingo!" confirmed state |

---

## 🚀 HOW TO RESUME AFTER CONNECTION LOSS

If connection issues interrupt work:

1. **Check this backlog** to see what's done vs pending
2. **Verify file existence:**
   ```bash
   dir src\components /b
   dir src\lib /b
   dir src\app\game-room\page.tsx /b
   dir src\server /r
   ```
3. **If any source files are missing, ask the assistant to create them from this backlog**
4. **To build and run:**
   ```bash
   npm install
   npm run dev
   ```
5. **Test URLs in browser:**
   - `http://localhost:3000/game-room` — Live bingo room display
   - `http://localhost:3000/admin-panel` — Caller controls
   - `http://localhost:3000/player-card` — Printable player cards

---

## 📝 NOTES

- This backlog should be updated after every work session so progress is never lost.
- Files in the "⚠️ Verify" column may or may not have been created — check them manually.
- Files in the "❌ Not Created" column definitely need to be created.
