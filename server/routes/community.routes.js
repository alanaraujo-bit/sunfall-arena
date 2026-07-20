// ============================================================
// SUNFALL ARENA — rotas da Central da Comunidade
// Reações e favoritos dos patch notes + sugestões + reporte de
// bugs. Tudo validado, sanitizado e com rate limit; sugestões e
// bugs são persistidos no banco e espelhados no Discord.
// ============================================================
import { Router } from 'express';
import { createHash } from 'crypto';
import { query } from '../db.js';
import { optionalAuth } from '../auth.js';
import { rateLimit } from '../ratelimit.js';
import { patchIds, validReactions } from '../services/patchmeta.js';
import { sendToDiscord, suggestionEmbed, bugEmbed } from '../services/discord.js';

const router = Router();

// ---------------- identidade e utilidades ----------------

const ANON_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATCH_ID_RE = /^v\d+\.\d+\.\d+$/;

// Ator: conta logada vira "u:<id>"; convidado usa um UUID gerado no
// navegador ("a:<uuid>"). Assim reações/favoritos valem para todos e
// continuam únicos por pessoa.
function resolveActor(req) {
  if (req.user?.sub) return `u:${req.user.sub}`;
  const anon = String(req.headers['x-sf-anon'] || '');
  if (ANON_RE.test(anon)) return `a:${anon.toLowerCase()}`;
  return null;
}

function clientIp(req) {
  return String(
    req.headers['fly-client-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress || '?'
  );
}

const ipHash = ip => createHash('sha256').update(ip).digest('hex');

// Sanitização: remove caracteres de controle, normaliza espaços extremos
// e limita tamanho — nada de payload gigante nem lixo invisível.
function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function bad(res, error) { return res.status(400).json({ error }); }

// ---------------- reações e favoritos ----------------

const socialLimit = rateLimit('social', 40, 60 * 1000, clientIp);

// Estado social de todos os patches numa chamada só: contadores públicos,
// + o que ESTE ator já reagiu/favoritou (para pintar a UI).
router.get('/patchnotes/social', optionalAuth, async (req, res) => {
  const actor = resolveActor(req);
  const [counts, mine, favs] = await Promise.all([
    query(`SELECT patch_id, emoji, COUNT(*)::int AS n FROM patch_reactions GROUP BY patch_id, emoji`),
    actor
      ? query(`SELECT patch_id, emoji FROM patch_reactions WHERE actor = $1`, [actor])
      : Promise.resolve({ rows: [] }),
    actor
      ? query(`SELECT patch_id FROM patch_favorites WHERE actor = $1`, [actor])
      : Promise.resolve({ rows: [] })
  ]);

  const reactions = {};
  for (const r of counts.rows) (reactions[r.patch_id] ??= {})[r.emoji] = r.n;
  const mineMap = {};
  for (const r of mine.rows) (mineMap[r.patch_id] ??= []).push(r.emoji);
  res.json({ reactions, mine: mineMap, favorites: favs.rows.map(r => r.patch_id) });
});

router.post('/patchnotes/:id/react', optionalAuth, socialLimit, async (req, res) => {
  const actor = resolveActor(req);
  if (!actor) return bad(res, 'missing_actor');
  const patchId = String(req.params.id);
  if (!PATCH_ID_RE.test(patchId) || (patchIds.size && !patchIds.has(patchId))) return bad(res, 'unknown_patch');
  const emoji = String(req.body?.emoji || '');
  if (!validReactions.has(emoji)) return bad(res, 'invalid_emoji');
  const on = !!req.body?.on;

  if (on) {
    await query(
      `INSERT INTO patch_reactions (patch_id, emoji, actor) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [patchId, emoji, actor]
    );
  } else {
    await query(`DELETE FROM patch_reactions WHERE patch_id=$1 AND emoji=$2 AND actor=$3`, [patchId, emoji, actor]);
  }
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM patch_reactions WHERE patch_id=$1 AND emoji=$2`,
    [patchId, emoji]
  );
  res.json({ ok: true, emoji, count: rows[0].n, on });
});

router.post('/patchnotes/:id/favorite', optionalAuth, socialLimit, async (req, res) => {
  const actor = resolveActor(req);
  if (!actor) return bad(res, 'missing_actor');
  const patchId = String(req.params.id);
  if (!PATCH_ID_RE.test(patchId) || (patchIds.size && !patchIds.has(patchId))) return bad(res, 'unknown_patch');
  const on = !!req.body?.on;

  if (on) {
    await query(
      `INSERT INTO patch_favorites (patch_id, actor) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [patchId, actor]
    );
  } else {
    await query(`DELETE FROM patch_favorites WHERE patch_id=$1 AND actor=$2`, [patchId, actor]);
  }
  res.json({ ok: true, on });
});

// ---------------- sugestões ----------------

const SUGGESTION_CATEGORIES = {
  ideia: '💡 Ideia', melhoria: '📈 Melhoria', elogio: '❤️ Elogio',
  opiniao: '💬 Opinião', experiencia: '🎮 Experiência', outro: '📦 Outro'
};
const submitLimit = rateLimit('submit', 5, 10 * 60 * 1000, clientIp);

router.post('/community/suggestion', optionalAuth, submitLimit, async (req, res) => {
  const category = clean(req.body?.category, 20).toLowerCase();
  const title = clean(req.body?.title, 80);
  const message = clean(req.body?.message, 2000);
  const version = clean(req.body?.version, 20);

  if (!SUGGESTION_CATEGORIES[category]) return bad(res, 'invalid_category');
  if (title.length < 4) return bad(res, 'title_too_short');
  if (message.length < 10) return bad(res, 'message_too_short');
  if (version && !PATCH_ID_RE.test(version)) return bad(res, 'invalid_version');

  const username = req.user?.username || clean(req.body?.nickname, 20) || 'Convidado';
  const payload = { category, title, message };

  const { rows } = await query(
    `INSERT INTO community_submissions (kind, user_id, username, payload, client_version, ip_hash)
     VALUES ('suggestion', $1, $2, $3, $4, $5) RETURNING id`,
    [req.user?.sub || null, username, JSON.stringify(payload), version || null, ipHash(clientIp(req))]
  );

  const delivered = await sendToDiscord(suggestionEmbed({
    categoryLabel: SUGGESTION_CATEGORIES[category],
    title, message, username, version, id: rows[0].id
  }));
  res.json({ ok: true, id: rows[0].id, delivered });
});

// ---------------- reporte de bugs ----------------

const BUG_CATEGORIES = {
  gameplay: '🎮 Gameplay', interface: '🎨 Interface', rede: '📡 Rede',
  audio: '🔊 Áudio', grafico: '🖼️ Gráficos', conta: '👤 Conta', outro: '📦 Outro'
};
const SEVERITIES = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
const PRIORITIES = { low: 'Baixa', medium: 'Média', high: 'Alta' };

router.post('/community/bug', optionalAuth, submitLimit, async (req, res) => {
  const b = req.body || {};
  const bug = {
    category: clean(b.category, 20).toLowerCase(),
    title: clean(b.title, 80),
    description: clean(b.description, 2000),
    steps: clean(b.steps, 1500),
    expected: clean(b.expected, 500),
    actual: clean(b.actual, 500),
    severity: clean(b.severity, 10).toLowerCase(),
    priority: clean(b.priority, 10).toLowerCase(),
    version: clean(b.version, 20),
    platform: clean(b.platform, 150),
    resolution: clean(b.resolution, 20),
    monitor: clean(b.monitor, 50),
    fps: clean(b.fps, 20),
    hardware: clean(b.hardware, 200),
    logs: clean(b.logs, 3000)
  };

  if (!BUG_CATEGORIES[bug.category]) return bad(res, 'invalid_category');
  if (bug.title.length < 4) return bad(res, 'title_too_short');
  if (bug.description.length < 10) return bad(res, 'description_too_short');
  if (!SEVERITIES[bug.severity]) return bad(res, 'invalid_severity');
  if (!PRIORITIES[bug.priority]) return bad(res, 'invalid_priority');
  if (bug.version && !PATCH_ID_RE.test(bug.version)) return bad(res, 'invalid_version');

  const username = req.user?.username || clean(b.nickname, 20) || 'Convidado';

  const { rows } = await query(
    `INSERT INTO community_submissions (kind, user_id, username, payload, client_version, ip_hash)
     VALUES ('bug', $1, $2, $3, $4, $5) RETURNING id`,
    [req.user?.sub || null, username, JSON.stringify(bug), bug.version || null, ipHash(clientIp(req))]
  );

  const delivered = await sendToDiscord(bugEmbed({
    ...bug,
    id: rows[0].id,
    username,
    categoryLabel: BUG_CATEGORIES[bug.category],
    severityLabel: SEVERITIES[bug.severity],
    priorityLabel: PRIORITIES[bug.priority]
  }));
  res.json({ ok: true, id: rows[0].id, delivered });
});

export default router;
