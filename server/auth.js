// ============================================================
// SUNFALL ARENA — autenticação (hash de senha + JWT)
// ============================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = '15d';

export function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const claims = verifyToken(token);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  req.user = claims;
  next();
}

// Nunca bloqueia — só popula req.user quando há um token válido. Usado em
// rotas públicas que precisam saber "quem está perguntando" sem deixar de
// responder a visitantes anônimos.
export function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  req.user = token ? verifyToken(token) : null;
  next();
}
