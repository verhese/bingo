import { Pool, type PoolClient } from 'pg';
import { StorageError, type PersistedRoom, type RoomStore } from './types';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Append-only. Never edit a released migration; add a new one. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'create-rooms',
    sql: `
      CREATE TABLE rooms (
        session_id text PRIMARY KEY CHECK (session_id ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
        room_name text NOT NULL CHECK (char_length(room_name) BETWEEN 1 AND 40),
        variant text NOT NULL CHECK (variant IN ('90-ball', '75-ball', 'speedy')),
        game_mode_id text NOT NULL,
        custom_game_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
        stage_index integer NOT NULL DEFAULT 0 CHECK (stage_index >= 0),
        completed_stages text[] NOT NULL DEFAULT '{}',
        draw_mode text CHECK (draw_mode IN ('manual', 'auto')),
        drawn_numbers integer[] NOT NULL DEFAULT '{}',
        undone_numbers integer[] NOT NULL DEFAULT '{}',
        last_undone_number integer,
        status text NOT NULL CHECK (status IN ('waiting', 'in-play', 'complete')),
        verified_bingo jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `,
  },
];

// Arbitrary constant so concurrent service starts serialise their migrations.
const MIGRATION_LOCK_ID = 7_212_014;

const COLUMNS = `session_id, room_name, variant, game_mode_id, custom_game_modes, stage_index,
  completed_stages, draw_mode, drawn_numbers, undone_numbers, last_undone_number, status, verified_bingo`;

interface RoomRow {
  session_id: string;
  room_name: string;
  variant: PersistedRoom['variant'];
  game_mode_id: string;
  custom_game_modes: PersistedRoom['customGameModes'];
  stage_index: number;
  completed_stages: PersistedRoom['completedStages'];
  draw_mode: PersistedRoom['drawMode'];
  drawn_numbers: number[];
  undone_numbers: number[];
  last_undone_number: number | null;
  status: PersistedRoom['status'];
  verified_bingo: PersistedRoom['verifiedBingo'];
}

function toRow(room: PersistedRoom): unknown[] {
  return [
    room.sessionId,
    room.roomName,
    room.variant,
    room.gameModeId,
    JSON.stringify(room.customGameModes),
    room.stageIndex,
    room.completedStages,
    room.drawMode,
    room.drawnNumbers,
    room.undoneNumbers,
    room.lastUndoneNumber,
    room.status,
    room.verifiedBingo === null ? null : JSON.stringify(room.verifiedBingo),
  ];
}

function fromRow(row: RoomRow): PersistedRoom {
  return {
    sessionId: row.session_id,
    roomName: row.room_name,
    variant: row.variant,
    gameModeId: row.game_mode_id,
    customGameModes: row.custom_game_modes,
    stageIndex: row.stage_index,
    completedStages: row.completed_stages,
    drawMode: row.draw_mode,
    drawnNumbers: row.drawn_numbers,
    undoneNumbers: row.undone_numbers,
    lastUndoneNumber: row.last_undone_number,
    status: row.status,
    verifiedBingo: row.verified_bingo,
  };
}

const PLACEHOLDERS = '$1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::jsonb';

export interface PostgresRoomStoreOptions {
  connectionString: string;
  /** Attempts made by init() before giving up, one second apart. Lets the service outlast a database that is still starting. */
  connectAttempts?: number;
}

export class PostgresRoomStore implements RoomStore {
  private readonly pool: Pool;
  private readonly connectAttempts: number;

  constructor({ connectionString, connectAttempts = 30 }: PostgresRoomStoreOptions) {
    this.connectAttempts = connectAttempts;
    this.pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 3_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
    });
    // Idle clients can error when the database restarts; the next query reconnects.
    this.pool.on('error', (error) => console.error('Database connection error:', error.message));
  }

  async init(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.connectAttempts; attempt += 1) {
      try {
        await this.migrate();
        return;
      } catch (error) {
        if (error instanceof StorageError && error.code === 'schema-mismatch') throw error;
        lastError = error;
        if (attempt < this.connectAttempts) {
          console.warn(`Database not ready (attempt ${attempt}/${this.connectAttempts}); retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
      }
    }
    throw new StorageError('unavailable', 'The database could not be reached or initialised.', { cause: lastError });
  }

  private async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version integer PRIMARY KEY,
          name text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const { rows } = await client.query<{ version: number }>('SELECT max(version) AS version FROM schema_migrations');
      const current = rows[0]?.version ?? 0;
      const latest = MIGRATIONS[MIGRATIONS.length - 1].version;
      if (current > latest) {
        throw new StorageError(
          'schema-mismatch',
          `Database schema version ${current} is newer than this service supports (${latest}).`,
        );
      }
      for (const migration of MIGRATIONS.filter(({ version }) => version > current)) {
        await this.applyMigration(client, migration);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyMigration(client: PoolClient, migration: Migration): Promise<void> {
    console.log(`Applying database migration ${migration.version} (${migration.name})`);
    await client.query(migration.sql);
    await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
  }

  async loadRooms(): Promise<PersistedRoom[]> {
    try {
      const { rows } = await this.pool.query<RoomRow>(`SELECT ${COLUMNS} FROM rooms ORDER BY created_at, session_id`);
      return rows.map(fromRow);
    } catch (error) {
      throw new StorageError('unavailable', 'Rooms could not be loaded from the database.', { cause: error });
    }
  }

  async createRoom(room: PersistedRoom): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `INSERT INTO rooms (${COLUMNS}) VALUES (${PLACEHOLDERS}) ON CONFLICT (session_id) DO NOTHING`,
        toRow(room),
      );
      return result.rowCount === 1;
    } catch (error) {
      throw new StorageError('write-failed', 'The room could not be saved.', { cause: error });
    }
  }

  async saveRoom(room: PersistedRoom): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO rooms (${COLUMNS}) VALUES (${PLACEHOLDERS})
         ON CONFLICT (session_id) DO UPDATE SET
           room_name = EXCLUDED.room_name,
           variant = EXCLUDED.variant,
           game_mode_id = EXCLUDED.game_mode_id,
           custom_game_modes = EXCLUDED.custom_game_modes,
           stage_index = EXCLUDED.stage_index,
           completed_stages = EXCLUDED.completed_stages,
           draw_mode = EXCLUDED.draw_mode,
           drawn_numbers = EXCLUDED.drawn_numbers,
           undone_numbers = EXCLUDED.undone_numbers,
           last_undone_number = EXCLUDED.last_undone_number,
           status = EXCLUDED.status,
           verified_bingo = EXCLUDED.verified_bingo,
           updated_at = now()`,
        toRow(room),
      );
    } catch (error) {
      throw new StorageError('write-failed', 'The room state could not be saved.', { cause: error });
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
