// ============================================================
// SUNFALL ARENA — rotas de perfil e estatísticas
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/profile/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.username, p.level, p.xp, p.color
     FROM users u JOIN player_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'not_found' });

  const { rows: likeRows } = await query(
    'SELECT COUNT(*) AS n FROM player_likes WHERE target_id = $1',
    [req.user.sub]
  );
  res.json({ ...rows[0], likesCount: Number(likeRows[0].n) });
});

router.get('/stats/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT kills, deaths, headshots, wins, matches_played AS "matchesPlayed",
            playtime_seconds AS "playtimeSeconds"
     FROM player_stats WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'not_found' });

  const [byMode, byMap] = await Promise.all([
    query(
      `SELECT mode, kills, deaths, headshots, wins, matches_played AS "matchesPlayed",
              playtime_seconds AS "playtimeSeconds"
       FROM player_mode_stats WHERE user_id = $1`,
      [req.user.sub]
    ),
    query(
      `SELECT map_key AS "mapKey", kills, deaths, headshots, wins, matches_played AS "matchesPlayed",
              playtime_seconds AS "playtimeSeconds"
       FROM player_map_stats WHERE user_id = $1`,
      [req.user.sub]
    )
  ]);

  res.json({ ...rows[0], byMode: byMode.rows, byMap: byMap.rows });
});

export default router;
