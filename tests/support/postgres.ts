import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface TestDatabase {
  readonly url: string;
  /** Stops PostgreSQL but keeps its data, simulating a database outage. */
  pause(): Promise<void>;
  /** Starts PostgreSQL again on the same port with the data it had. */
  resume(): Promise<void>;
  /** Stops PostgreSQL and deletes its data. */
  dispose(): Promise<void>;
}

const USER = 'bingo';
const PASSWORD = 'bingo-test';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/** Starts a throwaway PostgreSQL cluster on a free port. Pass `port` to pin it. */
export async function startTestDatabase(options: { port?: number } = {}): Promise<TestDatabase> {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dataDir = await mkdtemp(join(tmpdir(), 'bingo-pg-'));
  const port = options.port ?? await getFreePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port,
    persistent: true,
    onLog: () => undefined,
    onError: () => undefined,
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('bingo');

  let running = true;
  return {
    url: `postgres://${USER}:${PASSWORD}@localhost:${port}/bingo`,
    async pause() {
      if (!running) return;
      running = false;
      await postgres.stop();
    },
    async resume() {
      if (running) return;
      await postgres.start();
      running = true;
    },
    async dispose() {
      if (running) await postgres.stop();
      running = false;
      await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
