// ============================================================
// SUNFALL ARENA — XP e persistência de estatísticas (contas reais)
// Chamado fire-and-forget a partir do jogo — nunca bloqueia o loop.
// ============================================================
import { query, withTransaction } from '../db.js';

const XP_PER_KILL = 100;
const XP_HEADSHOT_BONUS = 50;
const XP_WIN_BONUS = 250;
const XP_PER_LEVEL = 500;

async function addXp(accountId, gained) {
  const { rows } = await query(
    `UPDATE player_profiles SET xp = xp + $1, updated_at = now()
     WHERE user_id = $2 RETURNING xp`,
    [gained, accountId]
  );
  if (!rows.length) return;
  const level = Math.floor(rows[0].xp / XP_PER_LEVEL) + 1;
  await query('UPDATE player_profiles SET level = $1 WHERE user_id = $2', [level, accountId]);
}

// Espelha um evento de jogo nas 3 tabelas de stats (agregado + por modo + por
// mapa) dentro de uma única transação — sem isso, uma falha no meio deixaria
// as tabelas permanentemente divergentes entre si.
async function bumpStats(accountId, mode, mapKey, deltas) {
  const {
    kills = 0, deaths = 0, headshots = 0,
    wins = 0, matchesPlayed = 0, playtimeSeconds = 0
  } = deltas;

  await withTransaction(async client => {
    await client.query(
      `UPDATE player_stats SET
         kills = kills + $1, deaths = deaths + $2, headshots = headshots + $3,
         wins = wins + $4, matches_played = matches_played + $5,
         playtime_seconds = playtime_seconds + $6, updated_at = now()
       WHERE user_id = $7`,
      [kills, deaths, headshots, wins, matchesPlayed, playtimeSeconds, accountId]
    );
    await client.query(
      `INSERT INTO player_mode_stats (user_id, mode, kills, deaths, headshots, wins, matches_played, playtime_seconds)
       VALUES ($7, $8, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, mode) DO UPDATE SET
         kills = player_mode_stats.kills + EXCLUDED.kills,
         deaths = player_mode_stats.deaths + EXCLUDED.deaths,
         headshots = player_mode_stats.headshots + EXCLUDED.headshots,
         wins = player_mode_stats.wins + EXCLUDED.wins,
         matches_played = player_mode_stats.matches_played + EXCLUDED.matches_played,
         playtime_seconds = player_mode_stats.playtime_seconds + EXCLUDED.playtime_seconds,
         updated_at = now()`,
      [kills, deaths, headshots, wins, matchesPlayed, playtimeSeconds, accountId, mode]
    );
    await client.query(
      `INSERT INTO player_map_stats (user_id, map_key, kills, deaths, headshots, wins, matches_played, playtime_seconds)
       VALUES ($7, $8, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, map_key) DO UPDATE SET
         kills = player_map_stats.kills + EXCLUDED.kills,
         deaths = player_map_stats.deaths + EXCLUDED.deaths,
         headshots = player_map_stats.headshots + EXCLUDED.headshots,
         wins = player_map_stats.wins + EXCLUDED.wins,
         matches_played = player_map_stats.matches_played + EXCLUDED.matches_played,
         playtime_seconds = player_map_stats.playtime_seconds + EXCLUDED.playtime_seconds,
         updated_at = now()`,
      [kills, deaths, headshots, wins, matchesPlayed, playtimeSeconds, accountId, mapKey]
    );
  });
}

export async function awardXpAndPersist(accountId, mode, mapKey, { headshot = false } = {}) {
  await addXp(accountId, XP_PER_KILL + (headshot ? XP_HEADSHOT_BONUS : 0));
  await bumpStats(accountId, mode, mapKey, { kills: 1, headshots: headshot ? 1 : 0 });
}

export async function persistDeath(accountId, mode, mapKey) {
  await bumpStats(accountId, mode, mapKey, { deaths: 1 });
}

// Substitui as antigas awardWin + persistMatchPlayed (chamadas em sequência
// no mesmo loop de endMatch) por uma única passada nas 3 tabelas.
export async function recordMatchResult(accountId, mode, mapKey, won) {
  await bumpStats(accountId, mode, mapKey, { matchesPlayed: 1, wins: won ? 1 : 0 });
  if (won) await addXp(accountId, XP_WIN_BONUS);
}

export async function persistPlaytime(accountId, mode, mapKey, seconds) {
  if (seconds <= 0) return;
  await bumpStats(accountId, mode, mapKey, { playtimeSeconds: seconds });
}

export async function loadProfileForJoin(accountId) {
  const { rows } = await query(
    `SELECT u.username, p.color FROM users u
     JOIN player_profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [accountId]
  );
  return rows[0] || null;
}
