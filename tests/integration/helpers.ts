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
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    function cleanup() {
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
      child.stdout?.removeListener('data', onData);
    }
    function fail(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (child.exitCode === null && child.signalCode === null) child.kill();
      reject(error);
    }
    const onExit = (code: number | null) => fail(new Error(`Game server exited early (${code})`));
    const onError = (error: Error) => fail(error);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes('running on')) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }
    };

    timer = setTimeout(() => fail(new Error('Game server did not start in time')), 20_000);
    child.once('exit', onExit);
    child.once('error', onError);
    child.stdout?.on('data', onData);
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

/** Sends a raw message and resolves with the first reply, or null if none arrives. */
export async function requestRaw<T = Record<string, unknown>>(
  url: string,
  message: string,
  timeoutMs = 750,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      resolve(null);
    }, timeoutMs);
    socket.once('open', () => socket.send(message));
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

/** Sends one JSON message and resolves with the first reply, or null if none arrives. */
export function request<T = Record<string, unknown>>(
  url: string,
  message: Record<string, unknown>,
  timeoutMs = 750,
): Promise<T | null> {
  return requestRaw(url, JSON.stringify(message), timeoutMs);
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
