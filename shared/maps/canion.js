// ============================================================
// MAPA 01 — CÂNION (o mapa original de Sunfall Arena)
// Preservado como referência da evolução do jogo. Dados puros:
// a física genérica mora em shared/mapdata.js.
// ============================================================
import { B, stairs, buildBounds, BARREL_W, BARREL_H } from '../mapdata.js';

export const KEY = 'canion';
export const NAME = 'Cânion';
export const LIM = 38;   // clamp horizontal dos bots (pushOut)

// Barris explosíveis — posição no chão (y=0).
export const BARRELS = [
  { id: 0, x: -13, z: -20 },
  { id: 1, x: -11.9, z: -20.6 },
  { id: 2, x: 10, z: 24.5 },
  { id: 3, x: 26, z: 13 }
];

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
// bid identifica QUAL barril, pra explodeGrenade/damageBarrel poderem excluir
// a própria caixa do teste de cobertura (senão o raio de LOS "raspa" de volta
// nela mesma e bloqueia o dano contra qualquer alvo por perto).
for (const b of BARRELS) S.push({ ...B(b.x, 0, b.z, BARREL_W, BARREL_H, BARREL_W, 'barrel'), bid: b.id });

// ---- Rochas internas ----
S.push(B(-6, 0, 15, 3, 2.2, 2.6, 'rock'));
S.push(B(12, 0, -6, 2.6, 1.8, 2.2, 'rock'));
S.push(B(-15, 0, 2, 2.2, 1.6, 2.4, 'rock'));

// ---- Palmeiras (tronco colide) ----
S.push(B(-30, 0, -6, 0.6, 3.5, 0.6, 'palm'));
S.push(B(28, 0, -8, 0.6, 3.5, 0.6, 'palm'));
S.push(B(14, 0, 14, 0.6, 3.5, 0.6, 'palm'));

export const BOUNDS = buildBounds(SOLIDS);

// Spawns: [x, z] (y opcional, padrão 0)
export const SPAWNS = [
  [-30, -28], [30, -30], [-33, 20], [33, 22], [0, -33],
  [-16, 31], [18, 31], [33, -2], [-33, -4]
];

export const PATROL = [
  [0, -10], [10, 0], [0, 12], [-10, 0], [-20, -12], [22, -8],
  [-24, 14], [12, 22], [-4, 26], [26, 16], [0, -26], [-28, -20]
];
