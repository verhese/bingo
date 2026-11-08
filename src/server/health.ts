const DEFAULT_GAME_SERVER_WS_URL = 'ws://localhost:3001';

export async function isGameServiceReady(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const url = new URL(process.env.GAME_SERVER_WS_URL || DEFAULT_GAME_SERVER_WS_URL);
    if (url.protocol === 'ws:') {
      url.protocol = 'http:';
    } else if (url.protocol === 'wss:') {
      url.protocol = 'https:';
    } else {
      return false;
    }

    url.username = '';
    url.password = '';
    url.pathname = '/health/ready';
    url.search = '';
    url.hash = '';

    const response = await fetcher(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
