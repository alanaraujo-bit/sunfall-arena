// ============================================================
// MAPA 02 — OCASO (vila em terraços no desfiladeiro, ao poente)
// >>> STUB DA FASE 1 <<<
// Só o esqueleto dos três terraços + conectores, para validar a
// infraestrutura multi-mapa de ponta a ponta. O blockout completo
// (design/mapa-02-ocaso.md) entra na Fase 2.
//
// Convenções: norte = -Z, leste = +X. Terraços:
//   Mercado y=0 (z 10..44) · Vila y=2,6 (z -16..10) · Templo y=5,2 (z -44..-16)
// ============================================================
import { B, stairs, buildBounds } from '../mapdata.js';

export const KEY = 'ocaso';
export const NAME = 'Ocaso (em obras)';
export const LIM = 43;

// Fase 1: sem barris — os 4 pontos táticos do design entram na Fase 2.
export const BARRELS = [];

export const SOLIDS = [];
const S = SOLIDS;

// ---- Perímetro: paredões do desfiladeiro ----
S.push(B(0, 0, -48, 104, 14, 8, 'cliff'));
S.push(B(0, 0, 48, 104, 14, 8, 'cliff'));
S.push(B(-48, 0, 0, 8, 14, 104, 'cliff'));
S.push(B(48, 0, 0, 8, 14, 104, 'cliff'));

// ---- Terraços (plataformas maciças; o muro de arrimo é a própria face) ----
S.push(B(-4, 0, -3, 80, 2.6, 26, 'stone'));    // Vila (y 2,6): x -44..36, z -16..10
S.push(B(0, 0, -30, 88, 5.2, 28, 'stone'));    // Templo (y 5,2): x -44..44, z -44..-16

// ---- Escadaria Grande (oeste): dois lances, SOBREPONDO a face dos terraços
// (o último degrau invade o terraço — sem fresta entre degrau e piso) ----
stairs(S, -27, 13.6, 0, -1, 9, 0.29, 0.45, 5, 'stone');        // Mercado 0 -> Vila 2,6
stairs(S, -27, -12.4, 0, -1, 9, 0.29, 0.45, 5, 'stone', 2.6);  // Vila 2,6 -> Templo 5,2

// ---- Aqueduto (leste): rampa 0 -> 5,2 + tabuleiro elevado até o Templo ----
stairs(S, 39, 12, 0, -1, 18, 0.29, 0.5, 4, 'stone');         // sobe até y 5,2 em z~3,5
S.push(B(39, 0, -6.25, 4.6, 5.2, 19.5, 'stone'));            // tabuleiro do canal até a face do Templo

// ---- Referências de zona (placeholders p/ orientação no stub) ----
S.push(B(0, 5.2, -35, 4, 3, 4, 'stone'));                    // Altar (marco norte)
S.push(B(-7, 0, 22, 2.4, 1.05, 1.3, 'wood'));                // bancada do Mercado
S.push(B(7, 0, 22, 2.4, 1.05, 1.3, 'wood'));                 // bancada do Mercado
S.push(B(0, 2.6, -6, 2.6, 0.9, 2.6, 'stone2'));              // cisterna (Pátio)

export const BOUNDS = buildBounds(SOLIDS);

// Fase 1: spawns só na banda baixa (y=0) — bots ainda não conhecem
// altura de terreno (chega na Fase 2 junto com o blockout completo).
export const SPAWNS = [
  [-38, 29, 0], [35, 27, 0], [14, 27, 0], [-14, 32, 0],
  [39, 16, 0], [-33, 20, 0], [0, 38, 0], [24, 36, 0]
];

export const PATROL = [
  [-30, 24], [-10, 28], [10, 24], [26, 26], [36, 18],
  [14, 36], [-8, 38], [-24, 32]
];
