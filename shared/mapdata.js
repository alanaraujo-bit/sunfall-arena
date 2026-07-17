// ============================================================
// SUNFALL ARENA — dados do mapa compartilhados (cliente + servidor)
// Colisores AABB, spawns, rotas de patrulha dos bots e raycast.
// ============================================================

export const PLAYER = {
  R: 0.42,      // raio do corpo
  H: 1.8,       // altura total
  EYE: 1.62,    // altura dos olhos
  HEAD_Y: 1.62, // centro da cabeça (hitbox)
  HEAD_R: 0.33, // raio da cabeça
  BODY_H: 1.5   // altura da hitbox do corpo
};

// B(x, yBase, z, w, h, d, mat) -> caixa com y armazenado no CENTRO
function B(x, y, z, w, h, d, mat) {
  return { x, y: y + h / 2, z, w, h, d, mat };
}

function stairs(list, x, z, dx, dz, count, rise, run, width, mat) {
  for (let i = 0; i < count; i++) {
    const sx = x + dx * run * i, sz = z + dz * run * i;
    const w = dx !== 0 ? run : width;
    const d = dz !== 0 ? run : width;
    list.push(B(sx, 0, sz, w, rise * (i + 1), d, mat));
  }
}

export const SOLIDS = [];
const S = SOLIDS;

// ---- Perímetro: paredões de canyon ----
S.push(B(0, 0, -43, 96, 11, 8, 'cliff'));
S.push(B(0, 0, 43, 96, 11, 8, 'cliff'));
S.push(B(-43, 0, 0, 8, 11, 96, 'cliff'));
S.push(B(43, 0, 0, 8, 11, 96, 'cliff'));

// ---- Casa noroeste (telhado acessível por escada) ----
S.push(B(-22, 0, -18, 10, 5, 8, 'plaster'));
S.push(B(-22, 5, -21.8, 10, 0.9, 0.4, 'plaster2'));   // parapeito norte
S.push(B(-22, 5, -14.2, 10, 0.9, 0.4, 'plaster2'));   // parapeito sul
S.push(B(-26.8, 5, -18, 0.4, 0.9, 7.6, 'plaster2'));  // parapeito oeste
stairs(S, -16.2, -21.5, 0, 1, 6, 0.84, 0.95, 2.4, 'stone');

// ---- Torre nordeste (posição de sniper) ----
S.push(B(20, 0, -20, 5, 9, 5, 'stone'));              // fuste
S.push(B(20, 9, -20, 7, 0.6, 7, 'wood'));             // plataforma
S.push(B(20, 9.6, -23.2, 7, 1, 0.35, 'wood2'));
S.push(B(20, 9.6, -16.8, 7, 1, 0.35, 'wood2'));
S.push(B(23.3, 9.6, -20, 0.35, 1, 6.4, 'wood2'));
stairs(S, 15.3, -13, 0, -1, 11, 0.87, 0.8, 2.2, 'stone');

// ---- Mercado sul (coberta sobre colunas) ----
S.push(B(-7, 0, 19.4, 0.7, 3.4, 0.7, 'wood'));
S.push(B(7, 0, 19.4, 0.7, 3.4, 0.7, 'wood'));
S.push(B(-7, 0, 24.6, 0.7, 3.4, 0.7, 'wood'));
S.push(B(7, 0, 24.6, 0.7, 3.4, 0.7, 'wood'));
S.push(B(0, 3.4, 22, 16.5, 0.5, 7, 'wood'));          // telhado
S.push(B(-3.5, 0, 22, 2.4, 1.05, 1.3, 'wood'));       // bancada
S.push(B(3.5, 0, 22, 2.4, 1.05, 1.3, 'wood'));        // bancada

// ---- Plataforma oeste ----
S.push(B(-27, 0, 6, 8, 2.4, 8, 'stone'));
stairs(S, -22.2, 6, -1, 0, 3, 0.8, 0.9, 3, 'stone');
S.push(B(-28, 2.4, 3.4, 2.6, 1.1, 0.5, 'wood2'));
S.push(B(-25, 2.4, 8.5, 0.5, 1.1, 2.6, 'wood2'));

// ---- Casa leste ----
S.push(B(24, 0, 8, 7, 4.5, 7, 'plaster'));
S.push(B(24, 4.5, 4.7, 7, 0.8, 0.4, 'plaster2'));
S.push(B(24, 4.5, 11.3, 7, 0.8, 0.4, 'plaster2'));
S.push(B(20.7, 4.5, 8, 0.4, 0.8, 6.2, 'plaster2'));
S.push(B(27.3, 4.5, 8, 0.4, 0.8, 6.2, 'plaster2'));

// ---- Centro: obelisco com cristal ----
S.push(B(0, 0, 0, 2.6, 0.9, 2.6, 'stone'));
S.push(B(0, 0.9, 0, 1.1, 2.6, 1.1, 'stone'));

// ---- Muretas de cobertura ----
S.push(B(-8, 0, -7, 3.4, 1.25, 0.6, 'stone2'));
S.push(B(9, 0, 3, 3.4, 1.25, 0.6, 'stone2'));
S.push(B(5, 0, -13, 0.6, 1.25, 3.4, 'stone2'));
S.push(B(-12, 0, 11, 0.6, 1.25, 3.4, 'stone2'));

// ---- Caixotes ----
S.push(B(-18.5, 0, -10.5, 1.35, 1.35, 1.35, 'crate'));
S.push(B(-17.1, 0, -10.2, 1.35, 1.35, 1.35, 'crate'));
S.push(B(-17.8, 1.35, -10.35, 1.35, 1.35, 1.35, 'crate'));
S.push(B(6.5, 0, 19, 1.35, 1.35, 1.35, 'crate'));
S.push(B(7.9, 0, 19.4, 1.35, 1.35, 1.35, 'crate'));
S.push(B(23.5, 0, -14.5, 1.35, 1.35, 1.35, 'crate'));
S.push(B(24.6, 0, -15.6, 1.35, 1.35, 1.35, 'crate'));
S.push(B(19.5, 0, 8.5, 1.35, 1.35, 1.35, 'crate'));

// ---- Barris ----
S.push(B(-13, 0, -20, 1.05, 1.5, 1.05, 'barrel'));
S.push(B(-11.9, 0, -20.6, 1.05, 1.5, 1.05, 'barrel'));
S.push(B(10, 0, 24.5, 1.05, 1.5, 1.05, 'barrel'));
S.push(B(26, 0, 13, 1.05, 1.5, 1.05, 'barrel'));

// ---- Rochas internas ----
S.push(B(-6, 0, 15, 3, 2.2, 2.6, 'rock'));
S.push(B(12, 0, -6, 2.6, 1.8, 2.2, 'rock'));
S.push(B(-15, 0, 2, 2.2, 1.6, 2.4, 'rock'));

// ---- Palmeiras (tronco colide) ----
S.push(B(-30, 0, -6, 0.6, 3.5, 0.6, 'palm'));
S.push(B(28, 0, -8, 0.6, 3.5, 0.6, 'palm'));
S.push(B(14, 0, 14, 0.6, 3.5, 0.6, 'palm'));

// Bounds pré-computados (min/max) para colisão e raycast
export const BOUNDS = SOLIDS.map(s => ({
  minx: s.x - s.w / 2, maxx: s.x + s.w / 2,
  miny: s.y - s.h / 2, maxy: s.y + s.h / 2,
  minz: s.z - s.d / 2, maxz: s.z + s.d / 2,
  mat: s.mat
}));

export const SPAWNS = [
  [-30, -28], [30, -30], [-33, 20], [33, 22], [0, -33],
  [-16, 31], [18, 31], [33, -2], [-33, -4]
];

export const PATROL = [
  [0, -10], [10, 0], [0, 12], [-10, 0], [-20, -12], [22, -8],
  [-24, 14], [12, 22], [-4, 26], [26, 16], [0, -26], [-28, -20]
];

// ---- Raycast: raio vs AABB (slab method). Retorna t ou Infinity ----
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minx || ox > b.maxx) return Infinity; }
  else {
    let t1 = (b.minx - ox) / dx, t2 = (b.maxx - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) { if (oy < b.miny || oy > b.maxy) return Infinity; }
  else {
    let t1 = (b.miny - oy) / dy, t2 = (b.maxy - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minz || oz > b.maxz) return Infinity; }
  else {
    let t1 = (b.minz - oz) / dz, t2 = (b.maxz - oz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  if (tmax < Math.max(tmin, 0)) return Infinity;
  return tmin >= 0 ? tmin : 0;
}

// Menor t contra todos os sólidos (Infinity se livre)
export function raycastSolids(ox, oy, oz, dx, dy, dz, maxT = Infinity) {
  let best = maxT;
  for (const b of BOUNDS) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b);
    if (t < best) best = t;
  }
  return best === maxT ? (maxT === Infinity ? Infinity : maxT) : best;
}

// Empurra uma posição para fora dos sólidos (horizontal) — usado pelos bots
export function pushOut(p, r = PLAYER.R, h = PLAYER.H) {
  for (const b of BOUNDS) {
    if (p.y + h <= b.miny || p.y >= b.maxy) continue;
    const ox = Math.min(p.x + r - b.minx, b.maxx - (p.x - r));
    const oz = Math.min(p.z + r - b.minz, b.maxz - (p.z - r));
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) p.x += (p.x < b.x ? -ox : ox);
    else p.z += (p.z < b.z ? -oz : oz);
  }
  const LIM = 38;
  p.x = Math.max(-LIM, Math.min(LIM, p.x));
  p.z = Math.max(-LIM, Math.min(LIM, p.z));
}
