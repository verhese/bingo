import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { startTestDatabase, type TestDatabase } from './postgres';

/**
 * End-to-end backend: a throwaway PostgreSQL, the game server, and a control endpoint
 * so tests can restart the game server or interrupt the database.
 *
 *   POST /restart-game-server   restarts the game server against the same database
 *   POST /pause-database        stops PostgreSQL, keeping its data
 *   POST /resume-database       starts PostgreSQL again
 */
const WS_PORT = Number(process.env.WS_PORT);
const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT);
const DB_PORT = Number(process.env.E2E_DB_PORT);

let database: TestDatabase;
let gameServer: ChildProcess | undefined;

function startGameServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/ws-server.ts'], {
      env: { ...process.env, DATABASE_URL: database.url, WS_PORT: String(WS_PORT) },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    gameServer = child;
    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
      if (chunk.toString().includes('running on')) resolve();
    });
    child.once('exit', (code) => reject(new Error(`Game server exited (${code})`)));
  });
}

function stopGameServer(): Promise<void> {
  return new Promise((resolve) => {
    const child = gameServer;
    if (!child || child.exitCode !== null) return resolve();
    child.removeAllListeners('exit');
    child.once('exit', () => resolve());
    child.kill();
  });
}

async function shutdown() {
  await stopGameServer();
  await database?.dispose();
  process.exit(0);
}

async function main() {
  database = await startTestDatabase({ port: DB_PORT });
  await startGameServer();

  // The control server is opened last: Playwright treats its port as the signal that everything is ready.
  createServer((request, response) => {
    const run = async () => {
      if (request.method !== 'POST') return false;
      if (request.url === '/restart-game-server') {
        await stopGameServer();
        await startGameServer();
      } else if (request.url === '/pause-database') {
        await database.pause();
      } else if (request.url === '/resume-database') {
        await database.resume();
      } else {
        return false;
      }
      return true;
    };
    run().then(
      (handled) => response.writeHead(handled ? 204 : 404).end(),
      (error: Error) => response.writeHead(500).end(error.message),
    );
  }).listen(CONTROL_PORT);

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
