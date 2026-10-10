import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import WebSocket from 'ws';

export interface TestServer {
  readonly port: number;
  readonly url: string;
  stop(): Promise<void>;
}

export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export async function startGameServer(): Promise<TestServer> {
  const port = await getFreePort();
  const child: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'src/server/ws-server.ts'], {
    env: { ...process.env, WS_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Game server did not start in time')), 20_000);
    child.once('exit', (code) => reject(new Error(`Game server exited early (${code})`)));
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('running on')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  return {
    port,
    url: `ws://localhost:${port}`,
    stop: () => new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', () => resolve());
      child.kill();
    }),
  };
}

/** Sends one message and resolves with the first reply, or null if none arrives. */
export async function request<T = Record<string, unknown>>(
  url: string,
  message: Record<string, unknown>,
  timeoutMs = 750,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      resolve(null);
    }, timeoutMs);
    socket.once('open', () => socket.send(JSON.stringify(message)));
    socket.once('message', (data) => {
      clearTimeout(timer);
      socket.close();
      resolve(JSON.parse(data.toString()) as T);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function openSubscriber(url: string, sessionId: string) {
  const socket = new WebSocket(url);
  const messages: Record<string, unknown>[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as Record<string, unknown>));
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify({ action: 'subscribe', sessionId }));
  await waitFor(() => messages.length >= 1);
  return {
    messages,
    close: () => socket.close(),
  };
}

export async function waitFor(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
