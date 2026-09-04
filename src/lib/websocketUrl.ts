export function getWebSocketUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (configuredUrl) return configuredUrl;

  if (typeof window === 'undefined') return 'ws://localhost:3001';

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:3001`;
}