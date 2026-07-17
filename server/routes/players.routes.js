// ============================================================
// SUNFALL ARENA — perfis públicos e ranking (sem autenticação)
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { onlineAccountIds } from '../presence.js';

const router = Router();

// Perfil público de qualquer jogador, por nome de usuário
router.get('/players/:username', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.created_at AS "createdAt", p.level, p.xp,
              s.kills, s.deaths, s.headshots, s.wins, s.matches_played AS "matchesPlayed"
       FROM users u
       JOIN player_profiles p ON p.user_id = u.id
       JOIN player_stats s ON s.user_id = u.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [String(req.params.username || '')]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'user_not_found' });
    res.json({
      id: r.id, username: r.username, level: r.level, xp: r.xp,
      createdAt: r.createdAt,
      online: onlineAccountIds().has(String(r.id)),
      stats: {
        kills: r.kills, deaths: r.deaths, headshots: r.headshots,
        wins: r.wins, matchesPlayed: r.matchesPlayed
      }
    });
  } catch (err) {
    console.error('[players] profile failed', err);
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
