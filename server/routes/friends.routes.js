// ============================================================
// SUNFALL ARENA — rotas de amigos (pedido, aceite, remoção, lista)
// Modelo: uma linha por relação em friendships; status pending/accepted.
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { players } from '../game/state.js';

const router = Router();
router.use(requireAuth);

function onlineAccountIds() {
  const online = new Set();
  for (const p of players.values()) if (p.accountId) online.add(String(p.accountId));
  return online;
}

// Lista completa: amigos aceitos + pedidos recebidos + pedidos enviados
router.get('/', async (req, res) => {
  const uid = req.user.sub;
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, p.level, f.status,
              (f.requester_id = $1) AS requested_by_me
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       JOIN player_profiles p ON p.user_id = u.id
       WHERE f.requester_id = $1 OR f.addressee_id = $1
       ORDER BY u.username`,
      [uid]
    );
    const online = onlineAccountIds();
    const friends = [], incoming = [], outgoing = [];
    for (const r of rows) {
      const item = { id: r.id, username: r.username, level: r.level, online: online.has(String(r.id)) };
      if (r.status === 'accepted') friends.push(item);
      else if (r.requested_by_me) outgoing.push(item);
      else incoming.push(item);
    }
    res.json({ friends, incoming, outgoing });
  } catch (err) {
    console.error('[friends] list failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Enviar pedido por nome de usuário. Se já houver pedido do outro lado, aceita direto.
router.post('/request', async (req, res) => {
  const uid = req.user.sub;
  const { username } = req.body || {};
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  try {
    const { rows } = await query('SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: 'user_not_found' });
    if (String(target.id) === String(uid)) return res.status(400).json({ error: 'cannot_add_self' });

    const existing = await query(
      `SELECT status, requester_id FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [uid, target.id]
    );
    if (existing.rows.length) {
      const e = existing.rows[0];
      if (e.status === 'accepted') return res.status(409).json({ error: 'already_friends' });
      if (String(e.requester_id) === String(target.id)) {
        await query(
          `UPDATE friendships SET status = 'accepted' WHERE requester_id = $1 AND addressee_id = $2`,
          [target.id, uid]
        );
        return res.json({ accepted: true, user: target });
      }
      return res.status(409).json({ error: 'request_pending' });
    }

    await query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [uid, target.id]);
    res.status(201).json({ requested: true, user: target });
  } catch (err) {
    console.error('[friends] request failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Aceitar pedido recebido
router.post('/accept', async (req, res) => {
  const uid = req.user.sub;
  const { userId } = req.body || {};
  if (!/^\d+$/.test(String(userId))) return res.status(400).json({ error: 'invalid_input' });
  try {
    const r = await query(
      `UPDATE friendships SET status = 'accepted'
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [userId, uid]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'request_not_found' });
    res.json({ accepted: true });
  } catch (err) {
    console.error('[friends] accept failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Remover amizade / recusar pedido recebido / cancelar pedido enviado
router.delete('/:userId', async (req, res) => {
  const uid = req.user.sub;
  const other = req.params.userId;
  if (!/^\d+$/.test(other)) return res.status(400).json({ error: 'invalid_input' });
  try {
    const r = await query(
      `DELETE FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [uid, other]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ removed: true });
  } catch (err) {
    console.error('[friends] delete failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
