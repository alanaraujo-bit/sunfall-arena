// ============================================================
// SUNFALL ARENA — acesso a banco (Postgres via Railway)
// ============================================================
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      username      VARCHAR(20) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));`);
  await query(`
    CREATE TABLE IF NOT EXISTS player_profiles (
      user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      level       INTEGER NOT NULL DEFAULT 1,
      xp          INTEGER NOT NULL DEFAULT 0,
      color       VARCHAR(9),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS player_stats (
      user_id        BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      kills          INTEGER NOT NULL DEFAULT 0,
      deaths         INTEGER NOT NULL DEFAULT 0,
      headshots      INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS wins INTEGER NOT NULL DEFAULT 0;`);
  await query(`
    CREATE TABLE IF NOT EXISTS friendships (
      requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       VARCHAR(10) NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (requester_id, addressee_id),
      CHECK (requester_id <> addressee_id)
    );
  `);
  console.log('[db] migrate ok');
}
