// ============================================================
// SUNFALL ARENA — serving estático (apenas para dev local via `npm start`;
// em produção o frontend é servido pelo Vercel, não por este processo)
// ============================================================
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

export function staticMiddleware(req, res, next) {
  serve(req, res).catch(() => next());
}

async function serve(req, res) {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const base = url.startsWith('/shared/') ? ROOT : join(ROOT, 'public');
  const path = normalize(join(base, url.startsWith('/shared/') ? url : url));
  if (!path.startsWith(normalize(ROOT))) { res.writeHead(403); res.end(); return; }
  const data = await readFile(path);
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
  res.end(data);
}
