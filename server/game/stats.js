// ============================================================
// SUNFALL ARENA — XP e persistência de estatísticas (contas reais)
// Chamado fire-and-forget a partir do jogo — nunca bloqueia o loop.
// ============================================================
import { query } from '../db.js';

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

export async function awardXpAndPersist(accountId, { headshot = false } = {}) {
  await addXp(accountId, XP_PER_KILL + (headshot ? XP_HEADSHOT_BONUS : 0));
  await query(
    `UPDATE player_stats SET kills = kills + 1,
       headshots = headshots + $1, updated_at = now()
     WHERE user_id = $2`,
    [headshot ? 1 : 0, accountId]
  );
}

export async function persistDeath(accountId) {
  await query(
    `UPDATE player_stats SET deaths = deaths + 1, updated_at = now() WHERE user_id = $1`,
    [accountId]
  );
}

export async function awardWin(accountId) {
  await addXp(accountId, XP_WIN_BONUS);
  await query(
    `UPDATE player_stats SET wins = wins + 1, updated_at = now() WHERE user_id = $1`,
    [accountId]
  );
}

export async function persistMatchPlayed(accountId) {
  await query(
    `UPDATE player_stats SET matches_played = matches_played + 1, updated_at = now() WHERE user_id = $1`,
    [accountId]
  );
}

export async function loadProfileForJoin(accountId) {
  const { rows } = await query(
    `SELECT u.username, p.color FROM users u
     JOIN player_profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [accountId]
  );
  return rows[0] || null;
}
