export type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = Readonly<Record<string, string | number | boolean | null>>;

export function logEvent(
  service: string,
  level: LogLevel,
  event: string,
  context: LogContext = {},
): void {
  const line = JSON.stringify({
    ...context,
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
