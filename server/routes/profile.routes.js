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
  res.json(rows[0]);
});

router.get('/stats/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT kills, deaths, headshots, matches_played AS "matchesPlayed"
     FROM player_stats WHERE user_id = $1`,
    [req.user.sub]
  );
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

export default router;
