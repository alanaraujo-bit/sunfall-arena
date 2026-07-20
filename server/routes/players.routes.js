// ============================================================
// SUNFALL ARENA — perfis públicos e ranking (sem autenticação)
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { onlineAccountIds } from '../presence.js';
import { optionalAuth, requireAuth } from '../auth.js';

const router = Router();

// Perfil público de qualquer jogador, por nome de usuário
router.get('/players/:username', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.created_at AS "createdAt", p.level, p.xp,
              s.kills, s.deaths, s.headshots, s.wins, s.matches_played AS "matchesPlayed",
              s.playtime_seconds AS "playtimeSeconds"
       FROM users u
       JOIN player_profiles p ON p.user_id = u.id
       JOIN player_stats s ON s.user_id = u.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [String(req.params.username || '')]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'user_not_found' });

    const [byMode, byMap, likes] = await Promise.all([
      query(
        `SELECT mode, kills, deaths, headshots, wins, matches_played AS "matchesPlayed",
                playtime_seconds AS "playtimeSeconds"
         FROM player_mode_stats WHERE user_id = $1`,
        [r.id]
      ),
      query(
        `SELECT map_key AS "mapKey", kills, deaths, headshots, wins, matches_played AS "matchesPlayed",
                playtime_seconds AS "playtimeSeconds"
         FROM player_map_stats WHERE user_id = $1`,
        [r.id]
      ),
      query(
        `SELECT COUNT(*) AS "likesCount",
                EXISTS(SELECT 1 FROM player_likes WHERE liker_id = $2 AND target_id = $1) AS "likedByMe"
         FROM player_likes WHERE target_id = $1`,
        [r.id, req.user ? req.user.sub : 0]
      )
    ]);

    res.json({
      id: r.id, username: r.username, level: r.level, xp: r.xp,
      createdAt: r.createdAt,
      online: onlineAccountIds().has(String(r.id)),
      stats: {
        kills: r.kills, deaths: r.deaths, headshots: r.headshots,
        wins: r.wins, matchesPlayed: r.matchesPlayed, playtimeSeconds: r.playtimeSeconds
      },
      byMode: byMode.rows, byMap: byMap.rows,
      likesCount: Number(likes.rows[0].likesCount),
      likedByMe: likes.rows[0].likedByMe
    });
  } catch (err) {
    console.error('[players] profile failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Curtir / descurtir o perfil de outro jogador (1 curtida por par de jogadores)
router.post('/players/:username/like', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [String(req.params.username || '')]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'user_not_found' });
    if (String(target.id) === String(req.user.sub)) return res.status(400).json({ error: 'cannot_like_self' });

    await query(
      `INSERT INTO player_likes (liker_id, target_id) VALUES ($1, $2)
       ON CONFLICT (liker_id, target_id) DO NOTHING`,
      [req.user.sub, target.id]
    );
    const { rows: countRows } = await query('SELECT COUNT(*) AS n FROM player_likes WHERE target_id = $1', [target.id]);
    res.json({ liked: true, likesCount: Number(countRows[0].n) });
  } catch (err) {
    console.error('[players] like failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.delete('/players/:username/like', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [String(req.params.username || '')]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'user_not_found' });

    await query('DELETE FROM player_likes WHERE liker_id = $1 AND target_id = $2', [req.user.sub, target.id]);
    const { rows: countRows } = await query('SELECT COUNT(*) AS n FROM player_likes WHERE target_id = $1', [target.id]);
    res.json({ liked: false, likesCount: Number(countRows[0].n) });
  } catch (err) {
    console.error('[players] unlike failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Top 50 por XP (nível segue o XP), desempate por vitórias
router.get('/leaderboard', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, p.level, p.xp, s.wins, s.kills, s.deaths
       FROM users u
       JOIN player_profiles p ON p.user_id = u.id
       JOIN player_stats s ON s.user_id = u.id
       ORDER BY p.xp DESC, s.wins DESC, u.username ASC
       LIMIT 50`
    );
    const online = onlineAccountIds();
    res.json({
      players: rows.map(r => ({
        id: r.id, username: r.username, level: r.level, xp: r.xp,
        wins: r.wins, kills: r.kills, deaths: r.deaths,
        online: online.has(String(r.id))
      }))
    });
  } catch (err) {
    console.error('[players] leaderboard failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
