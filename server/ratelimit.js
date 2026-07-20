// ============================================================
// SUNFALL ARENA — rate limit em memória (janela deslizante)
// Proteção anti-spam das rotas da comunidade. Por processo — é
// suficiente porque o jogo roda em uma única instância no Fly.
// ============================================================
const buckets = new Map();

// true = permitido; false = estourou o limite
export function allow(key, max, windowMs) {
  const now = Date.now();
  let hits = buckets.get(key);
  if (!hits) { hits = []; buckets.set(key, hits); }
  while (hits.length && hits[0] <= now - windowMs) hits.shift();
  if (hits.length >= max) return false;
  hits.push(now);
  return true;
}

// Middleware Express: keyFn extrai a chave da requisição
export function rateLimit(name, max, windowMs, keyFn) {
  return (req, res, next) => {
    const key = `${name}:${keyFn(req)}`;
    if (!allow(key, max, windowMs)) {
      return res.status(429).json({ error: 'rate_limited', retryAfterMs: windowMs });
    }
    next();
  };
}

// faxina periódica para o Map não crescer para sempre
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, hits] of buckets) {
    while (hits.length && hits[0] <= cutoff) hits.shift();
    if (!hits.length) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();
