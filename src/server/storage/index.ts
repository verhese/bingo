import { PostgresRoomStore } from './postgres';
import type { RoomStore } from './types';

/** Creates the room store from DATABASE_URL. Fails fast when it is missing so rooms are never silently kept in memory. */
export function createRoomStore(env: Record<string, string | undefined> = process.env): RoomStore {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Set it to a PostgreSQL connection URL (see docs/PERSISTENCE.md).');
  }
  const attempts = Number(env.DATABASE_CONNECT_ATTEMPTS);
  return new PostgresRoomStore({
    connectionString,
    connectAttempts: Number.isInteger(attempts) && attempts > 0 ? attempts : undefined,
  });
}
