// ============================================================
// SUNFALL ARENA — física de mapa compartilhada (cliente + servidor)
// Genérica: nenhum dado de mapa aqui. Cada mapa (shared/maps/*.js)
// monta seus SOLIDS/BOUNDS com os helpers B/stairs/buildBounds, e
// todas as consultas (raycast, pushOut) recebem os bounds do mapa
// da sala — salas diferentes podem rodar mapas diferentes.
// ============================================================

export const PLAYER = {
  R: 0.42,      // raio do corpo
  H: 1.8,       // altura total
  EYE: 1.62,    // altura dos olhos
  HEAD_Y: 1.62, // centro da cabeça (hitbox)
  HEAD_R: 0.33, // raio da cabeça
  BODY_H: 1.5   // altura da hitbox do corpo
};

// Barris explosíveis (ver server/game/barrels.js) — dimensões/dano globais;
// as POSIÇÕES são por mapa (export BARRELS de cada shared/maps/*.js).
export const BARREL_W = 1.05, BARREL_H = 1.5;
export const BARREL_HP = 60;
export const BARREL_DMG_MAX = 130;
export const BARREL_DMG_RADIUS = 6.5;

// B(x, yBase, z, w, h, d, mat) -> caixa com y armazenado no CENTRO
export function B(x, y, z, w, h, d, mat) {
  return { x, y: y + h / 2, z, w, h, d, mat };
}

// Lance de escada como caixas empilhadas a partir do chão. `y0` é a base do
// lance (ex.: 2.6 para um lance que parte do piso de um terraço) — cada
// degrau é uma caixa do chão até y0 + rise*(i+1).
export function stairs(list, x, z, dx, dz, count, rise, run, width, mat, y0 = 0) {
  for (let i = 0; i < count; i++) {
    const sx = x + dx * run * i, sz = z + dz * run * i;
    const w = dx !== 0 ? run : width;
    const d = dz !== 0 ? run : width;
    list.push(B(sx, 0, sz, w, y0 + rise * (i + 1), d, mat));
  }
}

// Bounds pré-computados (min/max) para colisão e raycast
export function buildBounds(solids) {
  return solids.map(s => ({
    minx: s.x - s.w / 2, maxx: s.x + s.w / 2,
    miny: s.y - s.h / 2, maxy: s.y + s.h / 2,
    minz: s.z - s.d / 2, maxz: s.z + s.d / 2,
    mat: s.mat, bid: s.bid
  }));
}

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

// Menor t contra os `bounds` do mapa (Infinity se livre). excludeBid pula a
// caixa de UM barril específico — usado pela explosão dele mesmo, pra não
// "raspar" na própria caixa e se achar bloqueado por si só (distância ~0).
export function raycastSolids(bounds, ox, oy, oz, dx, dy, dz, maxT = Infinity, excludeBid = null) {
  let best = maxT;
  for (const b of bounds) {
    if (excludeBid != null && b.bid === excludeBid) continue;
    const t = rayBox(ox, oy, oz, dx, dy, dz, b);
    if (t < best) best = t;
  }
  return best === maxT ? (maxT === Infinity ? Infinity : maxT) : best;
}

// Altura de chão em (x, z) para quem está a `fromY`: o topo mais alto que
// ainda é "subível" (≤ fromY + 0.95). Sem nada embaixo, devolve 0 (chão).
// Usado pelos bots para acompanhar terraços, escadas e quedas.
export function floorTopAt(bounds, x, z, fromY, r = PLAYER.R * 0.8) {
  let top = 0;
  for (const b of bounds) {
    if (x + r > b.minx && x - r < b.maxx && z + r > b.minz && z - r < b.maxz &&
        b.maxy <= fromY + 0.95 && b.maxy > top) top = b.maxy;
  }
  return top;
}

// Empurra uma posição para fora dos sólidos (horizontal) — usado pelos bots.
// `lim` é o clamp do mapa (export LIM de cada shared/maps/*.js).
//
// A janela vertical (0.95 subida de degrau / 1.4 teto) tem que ficar EM
// SINCRONIA com botBlocked() em server/game/bots.js — as duas funções
// decidem "isso bloqueia o bot?" pro MESMO corpo, e antes usavam janelas
// diferentes (esta usava a altura FIXA do jogador H=1.8): moveBot() deixava
// o bot subir um degrau (dentro do alcance de 0.95 acima dos pés), mas
// pushOut() via aquele mesmo degrau como bloqueio de corpo inteiro e
// empurrava de volta pra posição exata de antes — bot preso pra sempre
// bem na borda entre dois degraus (achado pelo playtest da Fase 7: todo
// ponto de travamento permanente era uma junção de escada).
export function pushOut(bounds, lim, p, r = PLAYER.R) {
  for (const b of bounds) {
    if (b.maxy - p.y <= 0.95) continue;   // degrau: sobe, não empurra
    if (b.miny - p.y > 1.4) continue;     // teto: passa por baixo
    const ox = Math.min(p.x + r - b.minx, b.maxx - (p.x - r));
    const oz = Math.min(p.z + r - b.minz, b.maxz - (p.z - r));
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) p.x += (p.x < b.x ? -ox : ox);
    else p.z += (p.z < b.z ? -oz : oz);
  }
  p.x = Math.max(-lim, Math.min(lim, p.x));
  p.z = Math.max(-lim, Math.min(lim, p.z));
}
