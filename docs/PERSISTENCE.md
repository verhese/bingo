# Persistence

Rooms and game state are stored in PostgreSQL. The WebSocket game service is the only component that talks to the database; the Next.js app reaches it through the game service as before.

## What is stored

One row per room in the `rooms` table, holding the canonical state: room ID and name, variant, game mode (including a room's custom mode definition), stage index and completed stages, draw mode, called numbers in order, undone numbers and the last undone number, game status, and the verified Bingo claim. Derived values (the stage aliases in `GameState`) are rebuilt on load.

Every accepted change (create, draw, call, undo, verify, reset) is written to PostgreSQL **before** the new state is applied in memory, returned to the caller, or broadcast to subscribers. The service keeps an in-memory cache of all rooms for fast reads and fan-out; PostgreSQL is the source of truth, and the cache is rebuilt from it on every start.

Rooms are isolated by room ID. A reset replaces only that room's row and keeps its identity, name, variant, and mode.

## Configuration

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | game service | PostgreSQL connection string, e.g. `postgres://bingo:<password>@localhost:5432/bingo`. **Required**: the service refuses to start without it, so rooms are never silently kept in memory only. |
| `POSTGRES_PASSWORD` | Docker Compose | Password for the bundled `postgres` service. **Required** by Compose; Compose builds the game service's `DATABASE_URL` from it. |
| `DATABASE_CONNECT_ATTEMPTS` | game service | Optional. Startup connection attempts, one per second (default `30`), so the service can outlast a database that is still starting. |

Do not commit credentials. `.env*` files are git-ignored; `.env.example` lists the variable names only. Connection strings and passwords are never written to logs or returned to clients.

PostgreSQL 17 is used by the bundled Compose service and the test suites; the schema uses only basic, long-standing PostgreSQL features.

## First run and migrations

There is nothing to run by hand. On startup the service connects, takes a database advisory lock (so two services starting together cannot collide), creates the `schema_migrations` table if needed, and applies any migrations it has not recorded yet, each in the same transaction as its bookkeeping row. It then loads all rooms and creates the `default` room if it does not exist.

- A database whose schema version is **newer** than the service supports is rejected at startup (protects against running an old image after an upgrade).
- A stored room that fails validation stops the service with a clear message rather than being silently skipped.
- Migrations live in `src/server/storage/postgres.ts` and are append-only: never edit a released migration, add a new one.

Rooms created before this change lived in memory only and cannot be recovered.

## Local development

```bash
cp .env.example .env            # then set POSTGRES_PASSWORD
docker compose up -d postgres   # PostgreSQL on 127.0.0.1:5432
export DATABASE_URL=postgres://bingo:<POSTGRES_PASSWORD>@localhost:5432/bingo
npm run dev:ws
```

(PowerShell: `$env:DATABASE_URL = "postgres://bingo:<POSTGRES_PASSWORD>@localhost:5432/bingo"`.)

Compose reads `POSTGRES_PASSWORD` from `.env`; the dev scripts do not read `.env`, so export `DATABASE_URL` in your shell.

Tests need no database setup: integration and end-to-end suites start a throwaway PostgreSQL (`embedded-postgres`) on a free port with its own temporary data directory, and remove it afterwards.

## Production

- Use the Compose `postgres` service with the `postgres-data` volume, or point `DATABASE_URL` at a managed PostgreSQL. With a managed database, remove the `postgres` service and its `depends_on` entry.
- Remove the `127.0.0.1:5432` port mapping unless you need it.
- Keep **one** game-service instance. Rooms are cached in that process and live updates are not shared between instances; running several would let their caches diverge. Scaling out needs cross-instance coordination and is out of scope here.
- Run the database over a private network or enable TLS (`?sslmode=require` in `DATABASE_URL`).

## Failure behaviour

If PostgreSQL cannot store a change, the game service leaves the room unchanged, does not broadcast, and replies with `{ "error": "The game state could not be saved. Nothing was changed; please try again.", "code": "storage-error" }`. `POST /api/game` returns that as HTTP `503` with the same body, and the admin panel shows the message. The cause is logged server-side without credentials. Once the database is back, the same action can simply be retried. While the database is down, reads still work from the in-memory cache.

## Backup and restore

Back up the database, not the container:

```bash
docker compose exec postgres pg_dump -U bingo -Fc bingo > bingo.dump
docker compose exec -T postgres pg_restore -U bingo -d bingo --clean --if-exists < bingo.dump
```

Restart `ws-server` after a restore so it reloads the rooms. `docker compose down -v` deletes the `postgres-data` volume and with it every room.
