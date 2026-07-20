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

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
  await query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS playtime_seconds INTEGER NOT NULL DEFAULT 0;`);
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
  await query(`
    CREATE TABLE IF NOT EXISTS player_mode_stats (
      user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode           VARCHAR(10) NOT NULL,
      kills          INTEGER NOT NULL DEFAULT 0,
      deaths         INTEGER NOT NULL DEFAULT 0,
      headshots      INTEGER NOT NULL DEFAULT 0,
      wins           INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      playtime_seconds INTEGER NOT NULL DEFAULT 0,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, mode)
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS player_map_stats (
      user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      map_key        VARCHAR(20) NOT NULL,
      kills          INTEGER NOT NULL DEFAULT 0,
      deaths         INTEGER NOT NULL DEFAULT 0,
      headshots      INTEGER NOT NULL DEFAULT 0,
      wins           INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      playtime_seconds INTEGER NOT NULL DEFAULT 0,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, map_key)
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS player_likes (
      liker_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (liker_id, target_id),
      CHECK (liker_id <> target_id)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS player_likes_target_idx ON player_likes (target_id);`);
  // --- Central da Comunidade (patch notes / sugestões / bugs) ---
  // "actor" identifica quem reagiu/favoritou: "u:<id>" para contas,
  // "a:<uuid>" para convidados (uuid gerado no navegador) — assim
  // reações funcionam para todos, sem duplicar por pessoa.
  await query(`
    CREATE TABLE IF NOT EXISTS patch_reactions (
      patch_id   VARCHAR(20) NOT NULL,
      emoji      VARCHAR(8)  NOT NULL,
      actor      VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (patch_id, emoji, actor)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS patch_reactions_patch_idx ON patch_reactions (patch_id);`);
  await query(`
    CREATE TABLE IF NOT EXISTS patch_favorites (
      patch_id   VARCHAR(20) NOT NULL,
      actor      VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (patch_id, actor)
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS community_submissions (
      id             BIGSERIAL PRIMARY KEY,
      kind           VARCHAR(10) NOT NULL,
      user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
      username       VARCHAR(40),
      payload        JSONB NOT NULL,
      client_version VARCHAR(20),
      ip_hash        VARCHAR(64),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log('[db] migrate ok');
}
