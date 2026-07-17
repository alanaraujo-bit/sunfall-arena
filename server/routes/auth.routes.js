// ============================================================
// SUNFALL ARENA — rotas de autenticação
// ============================================================
import { Router } from 'express';
import { query } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../auth.js';

const router = Router();

function validCreds(username, password) {
  return typeof username === 'string' && typeof password === 'string' &&
    username.trim().length >= 3 && username.trim().length <= 20 &&
    /^[A-Za-z0-9_.-]+$/.test(username.trim()) && password.length >= 8;
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!validCreds(username, password)) {
    return res.status(400).json({ error: 'invalid_input', message: 'usuário (3-20) e senha (min 8) são obrigatórios' });
  }
  const name = username.trim();
  try {
    const exists = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [name]);
    if (exists.rows.length) return res.status(409).json({ error: 'username_taken' });

    const hash = await hashPassword(password);
    const { rows } = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [name, hash]
    );
    const user = rows[0];
    await query('INSERT INTO player_profiles (user_id) VALUES ($1)', [user.id]);
    await query('INSERT INTO player_stats (user_id) VALUES ($1)', [user.id]);

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error('[auth] register failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!validCreds(username, password)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  try {
    const { rows } = await query('SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    const row = rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const user = { id: row.id, username: row.username };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('[auth] login failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
