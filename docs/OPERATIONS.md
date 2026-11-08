# Operations runbook

This runbook deploys the web app, the single-instance WebSocket game service, and PostgreSQL with Docker Compose. Keep PostgreSQL on a private network and publish the web and WebSocket ports only through the intended firewall or reverse proxy.

## Prerequisites and configuration

- Docker Engine with the Docker Compose plugin, or Podman with a Compose provider. For Podman, substitute `podman compose` for `docker compose` in the commands below.
- A persistent Docker volume for PostgreSQL, or a separately managed PostgreSQL database.
- A unique administrator password of at least 16 characters, and independently generated `ADMIN_SESSION_SECRET` and `INTERNAL_API_TOKEN` values of at least 32 bytes each.
- A strong PostgreSQL password. Do not reuse the administrator password or either application secret.

Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `INTERNAL_API_TOKEN`. Keep `.env` out of source control. For HTTPS deployments, set `WS_PUBLIC_URL` to the public `wss://` address configured on the reverse proxy. Compose supplies the internal `GAME_SERVER_WS_URL`; do not expose `INTERNAL_API_TOKEN` or the internal URL to browsers.

Review the resolved configuration before starting:

```sh
docker compose config --quiet
```

## Deploy and verify

For a source deployment, build and start all services:

```sh
docker compose up --build -d
docker compose ps
```

The checked-in Compose file builds both application services from the current source. For a published-image deployment, configure both `web` and `ws-server` to use the same selected image (and remove their `build` entries) before pulling and starting:

```sh
docker compose pull
docker compose up -d
docker compose ps
```

Wait until `web`, `ws-server`, and `postgres` report `healthy`. The web service depends on the game service health check, and the game service depends on PostgreSQL health. Verify the endpoints from a machine that can reach the published ports:

```sh
curl --fail http://localhost:3000/api/health/live
curl --fail http://localhost:3000/api/health/ready
curl --fail http://localhost:3001/health/live
curl --fail http://localhost:3001/health/ready
```

Each successful endpoint returns `{"status":"ok"}`. Web readiness checks the private game-service readiness endpoint; game-service readiness checks PostgreSQL with a lightweight query. Liveness does not depend on downstream services. An unavailable readiness check returns HTTP `503` without disclosing configuration or database details.

## Logs and troubleshooting

Application events are one JSON object per line with an ISO timestamp, severity (`level`), service, event, and relevant non-secret context. Follow service logs with:

```sh
docker compose logs --follow --timestamps web ws-server postgres
```

Use the `service`, `level`, and `event` fields to filter application logs. Startup failures, database retries, failed persistence operations, health-check failures, client lifecycle events, and shutdown are recorded. Do not enable request-body or environment-variable logging; logs must not contain passwords, tokens, or database connection strings.

If a service is unhealthy:

1. Check `docker compose ps` and inspect the affected service's logs.
2. Verify required values are set in `.env`, without copying secrets into support tickets or logs.
3. If `ws-server` is unhealthy, verify PostgreSQL is healthy and its data volume is available.
4. If `web` is unhealthy, verify `ws-server` is healthy and that the internal `GAME_SERVER_WS_URL` resolves on the Compose network.
5. After correcting the cause, run `docker compose up -d` and repeat all four health requests.

## Upgrade and restart

For a source deployment, rebuild and recreate services after reviewing the release:

```sh
docker compose up --build -d
docker compose ps
```

For a published image deployment, pull the intended tag and recreate services:

```sh
docker compose pull
docker compose up -d
docker compose ps
```

Verify readiness after every upgrade. Run one `ws-server` instance only: room state is cached in that process and is not coordinated across multiple service instances.

If the upgraded application is unhealthy, restore the previous source revision or image tag and redeploy it, leaving the PostgreSQL volume intact. Confirm the prior application version supports the current database schema before rolling back; restore a database backup only when the data itself must be recovered.

## Backup and recovery

Back up the database before upgrades or maintenance:

```sh
docker compose exec -T postgres pg_dump -U bingo -Fc bingo > bingo.dump
```

To restore a dump, stop the game service so its in-memory state cannot overwrite the restored database. Restore, then restart it and verify readiness:

```sh
docker compose stop ws-server &&
docker compose exec -T postgres pg_restore -U bingo -d bingo --clean --if-exists < bingo.dump &&
docker compose start ws-server
docker compose ps
curl --fail http://localhost:3001/health/ready
curl --fail http://localhost:3000/api/health/ready
```

Never use `docker compose down -v` for a routine restart: it removes the PostgreSQL data volume and all stored rooms.

## Validation record

On 2026-11-08, a clean, isolated deployment was built from the checked-in Compose file using Podman 6.1.4 and Docker Compose 5.6.1, with separate loopback ports and a fresh database volume. All three containers became healthy and all four health endpoints returned `200`. Stopping PostgreSQL caused both readiness endpoints to return `503` while both liveness endpoints remained `200`; readiness recovered after PostgreSQL restarted. Structured web and game-service error logs were checked for the test credentials. A game-service restart, database backup and restore, and a subsequent Compose `up -d` retained the expected room state.

The deployment is **not fully validated for production**: a normal HTTP login request with an origin matching the published host and port was rejected with `403 Invalid request origin`. The standalone server compared it against its internal `http://0.0.0.0:3000` origin. The authenticated gameplay and persistence checks above used a synthetic origin matching that internal value, not a browser-compatible deployment. Resolve and retest external-origin handling, including the intended HTTPS reverse proxy, before release.

The automated integration suite verifies the game service's health endpoints and structured storage-error logs; unit tests cover the web health routes.
