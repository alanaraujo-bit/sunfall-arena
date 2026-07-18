// ============================================================
// MAPA 02 — OCASO (vila em terraços no desfiladeiro, ao poente)
// >>> FASE 2: BLOCKOUT COMPLETO <<<
// Todos os colisores do layout aprovado (design/mapa-02-ocaso.md),
// com materiais placeholder. Arquitetura de verdade (vãos, arcos,
// telhados, kit modular) entra na Fase 3.
//
// Convenções: norte = -Z, leste = +X. Terraços:
//   Mercado y=0 (z 10..44) · Vila y=2,6 (z -16..10) · Templo y=5,2 (z -44..-16)
// Física: degrau máx 0,95 · pulo ~1,6 → faces de 2,6 são intransponíveis
// fora dos conectores (Escadaria, Aqueduto, Beco, Ferreiro, Mina).
// ============================================================
import { B, stairs, buildBounds, BARREL_W, BARREL_H } from '../mapdata.js';

export const KEY = 'ocaso';
export const NAME = 'Ocaso (em obras)';
export const LIM = 43;

// Barris explosivos — [x, z] + y (base). Pontos táticos do design.
export const BARRELS = [
  { id: 0, x: -6, z: 24, y: 0 },        // Mercado, entre bancas
  { id: 1, x: 8, z: -10.4, y: 2.6 },    // canto do Pátio
  { id: 2, x: -34.6, z: -20, y: 2.6 },  // dentro da Mina (deixa 1,2m de passagem)
  { id: 3, x: 38, z: -14, y: 5.2 }      // topo do Aqueduto
];

export const SOLIDS = [];
const S = SOLIDS;

// R(x1, z1, x2, z2, yBase, h, mat) — caixa por CANTOS (menos erro de conta)
function R(x1, z1, x2, z2, y, h, mat) {
  S.push(B((x1 + x2) / 2, y, (z1 + z2) / 2, x2 - x1, h, z2 - z1, mat));
}

// ================= PERÍMETRO =================
R(-52, -52, 52, -44, 0, 14, 'cliff');   // norte
R(-52, 44, 52, 52, 0, 14, 'cliff');    // sul
R(-52, -52, -44, 52, 0, 14, 'cliff');  // oeste
R(44, -52, 52, 52, 0, 14, 'cliff');    // leste
// chanfros orgânicos nos cantos (quebra o quadrado)
R(-47, -42, -39, -34, 0, 14, 'cliff');
R(39, -42, 47, -34, 0, 14, 'cliff');
R(-47, 34, -39, 42, 0, 14, 'cliff');
R(39, 34, 47, 42, 0, 14, 'cliff');

// ================= MERCADO (y=0, z 10..44) =================
// Portão da Vila (oeste): pilares + verga (passa-se por baixo, vão livre 3,4m
// no centro; 2,7m junto aos pilares por causa das enxilharias do arco)
R(-44, 17.6, -40.6, 19.4, 0, 4.6, 'stone');
R(-44, 25.6, -40.6, 27.4, 0, 4.6, 'stone');
R(-40.6, 17.6, -38.8, 19.4, 0, 4.6, 'stone');
R(-40.6, 25.6, -38.8, 27.4, 0, 4.6, 'stone');
R(-40.6, 17.6, -38.8, 27.4, 3.4, 1.2, 'stone');   // verga
R(-40.6, 19.4, -38.8, 20.6, 2.7, 0.7, 'stone');   // enxilharia norte (canto do arco)
R(-40.6, 24.4, -38.8, 25.6, 2.7, 0.7, 'stone');   // enxilharia sul

// Bancas do mercado (balcão + 2 postes + coberta) — quebram a linha da rua.
// Posições exportadas: o cliente decora (toldo listrado, mercadoria).
export const BANCAS = [[-14, 21], [-4, 24.5], [6, 21], [16, 24]];
for (const [cx, cz] of BANCAS) {
  R(cx - 1.2, cz - 0.65, cx + 1.2, cz + 0.65, 0, 1.05, 'wood');            // balcão
  R(cx - 1.5, cz - 0.85, cx - 1.32, cz - 0.67, 0, 2.05, 'wood2');          // poste
  R(cx + 1.32, cz + 0.67, cx + 1.5, cz + 0.85, 0, 2.05, 'wood2');          // poste
  R(cx - 1.6, cz - 1.0, cx + 1.6, cz + 1.0, 2.05, 0.15, 'wood2');          // coberta
}

// Arcos: passagem coberta no lado norte da rua (colunas + telhado baixo)
export const ARCOS = { front: [-3.5, 1, 5.5, 10, 14.5], back: [-3.5, 5.5, 14.5], zf: 17.2, zb: 15.4, h: 3.3, roof: [-4.6, 14.8, 15.6, 17.8] };
for (const cx of ARCOS.front) R(cx - 0.3, 16.9, cx + 0.3, 17.5, 0, 3.3, 'pillar');
for (const cx of ARCOS.back) R(cx - 0.3, 15.1, cx + 0.3, 15.7, 0, 3.3, 'pillar');
R(-4.6, 14.8, 15.6, 17.8, 3.3, 0.4, 'wood');

// Praça da Fonte (leste)
R(31.2, 20.2, 34.8, 23.8, 0, 0.95, 'stone2');     // bacia
R(32.5, 21.5, 33.5, 22.5, 0.95, 1.5, 'stone');    // coluna d'água

// Casas fechadas (colisor = bloco; o cliente decora as fachadas com vãos
// recuados, telhados, cornijas e vigas). face = lado voltado ao jogador:
// N=-z S=+z W=-x E=+x. As do Mercado abrem pra rua (N); as da Vila, pro
// miolo por onde se circula.
export const CASAS = [
  { x1: -30, z1: 28, x2: -20, z2: 35, y: 0, h: 5.0, mat: 'plaster', face: 'N', zone: 'mercado' },
  { x1: -12, z1: 29, x2: 0, z2: 36, y: 0, h: 4.4, mat: 'plaster', face: 'N', zone: 'mercado' },
  { x1: 8, z1: 28, x2: 20, z2: 34, y: 0, h: 4.8, mat: 'plaster', face: 'N', zone: 'mercado' },
  { x1: -3, z1: 0, x2: 2.7, z2: 8, y: 2.6, h: 4.2, mat: 'plaster', face: 'S', zone: 'vila' },
  { x1: 5.3, z1: 1, x2: 11, z2: 9, y: 2.6, h: 4.6, mat: 'plaster', face: 'W', zone: 'vila' },
  { x1: -6, z1: -14, x2: 4, z2: -10, y: 2.6, h: 4.6, mat: 'plaster', face: 'S', zone: 'vila' },
  { x1: -22, z1: -8, x2: -14, z2: 0, y: 2.6, h: 4.4, mat: 'plaster', face: 'E', zone: 'vila' },
  { x1: 14, z1: -10, x2: 22, z2: -2, y: 2.6, h: 4.4, mat: 'plaster', face: 'W', zone: 'vila' },
  { x1: 26, z1: -12, x2: 32, z2: -6, y: 2.6, h: 3.6, mat: 'stone', face: 'W', zone: 'vila', shed: true }
];
for (const c of CASAS.filter(c => c.zone === 'mercado')) R(c.x1, c.z1, c.x2, c.z2, c.y, c.h, c.mat);

// Bolsão sul: caixotes e rocha (cobertura dos spawns)
R(-16.7, 38.3, -15.35, 39.65, 0, 1.35, 'crate');
R(-15.3, 38.7, -13.95, 40.05, 0, 1.35, 'crate');
R(9.3, 39.3, 10.65, 40.65, 0, 1.35, 'crate');
R(24.7, 38, 27.3, 40.2, 0, 1.8, 'rock');

// ================= ESCADARIA GRANDE (oeste) =================
// Dois lances de 9 degraus (0,29 × 0,45), sobrepondo a face dos terraços
stairs(S, -27, 13.6, 0, -1, 9, 0.29, 0.45, 5, 'stone');        // Mercado 0 -> Vila 2,6
stairs(S, -27, -12.4, 0, -1, 9, 0.29, 0.45, 5, 'stone', 2.6);  // Vila 2,6 -> Templo 5,2
// muretas laterais (cobertura parcial na subida)
R(-30.1, 12, -29.5, 14.2, 0, 1.7, 'stone2');
R(-30.1, 9.8, -29.5, 12, 0, 3.4, 'stone2');
R(-24.5, 12, -23.9, 14.2, 0, 1.7, 'stone2');
R(-24.5, 9.8, -23.9, 12, 0, 3.4, 'stone2');
R(-30.1, -14.2, -29.5, -12, 0, 4.3, 'stone2');
R(-30.1, -16, -29.5, -14.2, 0, 5.9, 'stone2');
R(-24.5, -14.2, -23.9, -12, 0, 4.3, 'stone2');
R(-24.5, -16, -23.9, -14.2, 0, 5.9, 'stone2');

// ================= AQUEDUTO (leste) =================
stairs(S, 39, 12, 0, -1, 18, 0.29, 0.5, 4, 'stone');   // rampa 0 -> 5,2
R(36.7, -16, 41.3, 3.5, 0, 5.2, 'stone');              // tabuleiro até a face do Templo
// muretas do canal (altura do joelho no tabuleiro — cobertura de agachar)
R(36.8, -16, 37.35, 3.5, 5.2, 0.9, 'stone2');
R(40.65, -16, 41.2, 3.5, 5.2, 0.9, 'stone2');
// laterais da rampa (fecham a subida, cobertura de quem sobe)
R(36.8, 3.5, 37.35, 7.75, 0, 4.2, 'stone2');
R(40.65, 3.5, 41.2, 7.75, 0, 4.2, 'stone2');
R(36.8, 7.75, 37.35, 12, 0, 2.4, 'stone2');
R(40.65, 7.75, 41.2, 12, 0, 2.4, 'stone2');

// ================= VILA (y=2,6, z -16..10) =================
// Laje em 3 pedaços, deixando o vão do Beco (x 2,7..5,3, z -4..10)
R(-44, -16, 2.7, 10, 0, 2.6, 'stone');       // oeste
R(5.3, -16, 36.7, 10, 0, 2.6, 'stone');      // leste (encosta no tabuleiro do Aqueduto)
R(2.7, -16, 5.3, -4, 0, 2.6, 'stone');       // faixa norte do Beco

// Beco: escada da rua + piso alto + pilar quebra-visão (força o "S")
stairs(S, 4, 9.75, 0, -1, 9, 0.29, 0.45, 2.6, 'stone');
R(2.7, -4, 5.3, 6.375, 0, 2.6, 'stone');
R(2.7, 1.6, 4.0, 2.8, 2.6, 2.4, 'plaster');

// Casario da Vila (mesmos blocos de CASAS — o cliente decora as fachadas)
for (const c of CASAS.filter(c => c.zone === 'vila')) R(c.x1, c.z1, c.x2, c.z2, c.y, c.h, c.mat);

// Pátio da Cisterna: cisterna + muretas de cobertura
R(-1.3, -7.3, 1.3, -4.7, 2.6, 0.9, 'stone2');   // cisterna
R(-5.4, -2.6, -2.6, -2, 2.6, 1.1, 'stone2');
R(5.6, -9, 6.2, -6.2, 2.6, 1.1, 'stone2');

// ---- Casa do Ferreiro (interior de 2 níveis, cavalgando a face do terraço) ----
// Corpo x -16..-8, z 10..16,5 · térreo y0 (porta p/ rua) · andar y2,6 (porta p/ Vila)
R(-16, 10, -15.5, 16.5, 0, 5.4, 'plaster');            // parede oeste
R(-8.5, 10, -8, 16.5, 0, 5.4, 'plaster');              // parede leste
// parede sul (rua): vão da porta térrea + vão da porta da varanda (andar)
R(-16, 16, -12.9, 16.5, 0, 5.4, 'plaster');
R(-11.1, 16, -8, 16.5, 0, 5.4, 'plaster');
R(-12.9, 16, -11.1, 16.5, 2.2, 0.4, 'plaster');        // verga da porta térrea
R(-12.9, 16, -11.1, 16.5, 4.8, 0.6, 'plaster');        // verga da porta do andar
// parede norte (Vila): porta só no andar (y 2,6..4,8)
R(-15.5, 10, -12.9, 10.5, 0, 5.4, 'plaster');
R(-11.1, 10, -8.5, 10.5, 0, 5.4, 'plaster');
R(-12.9, 10, -11.1, 10.5, 0, 2.6, 'plaster');          // peitoril (fecha o térreo)
R(-12.9, 10, -11.1, 10.5, 4.8, 0.6, 'plaster');        // verga
R(-16, 10, -8, 16.5, 5.0, 0.4, 'wood');                // telhado
// piso do andar (deixa o vão da escada interna a oeste)
R(-13.5, 10.5, -8.5, 16, 2.35, 0.25, 'wood');
R(-15.5, 15, -13.5, 16, 2.35, 0.25, 'wood');
// escada interna (térreo -> andar, junto à parede oeste)
stairs(S, -14.5, 14.6, 0, -1, 9, 0.29, 0.4, 1.8, 'wood');
// forja no canto NE do térreo (prop sólido — o cliente decora com chaminé/brasa)
R(-9.9, 10.7, -8.6, 12, 0, 1.5, 'stone2');
// varanda sobre a rua (posição forte com contra-jogo por 2 lados)
R(-13.5, 16.5, -10.5, 17.7, 2.35, 0.25, 'wood');
R(-13.5, 17.7, -10.5, 18.15, 2.6, 0.95, 'wood2');
R(-13.95, 16.5, -13.5, 18.15, 2.6, 0.95, 'wood2');
R(-10.5, 16.5, -10.05, 18.15, 2.6, 0.95, 'wood2');

// ================= TEMPLO (y=5,2, z -44..-16) =================
// Laje em pedaços, deixando o corredor da MINA (x -36,3..-33,7, z -28,6..-16,
// piso 2,6, teto 4,9) e a trincheira de saída com escada (x -33,7..-29,4,
// z -28,6..-26, céu aberto)
R(-44, -44, -36.3, -16, 0, 5.2, 'stone');              // faixa oeste
R(-36.3, -28.6, -33.7, -16, 0, 2.6, 'stone');          // sub-piso do corredor
R(-36.3, -28.6, -33.7, -16, 4.9, 0.3, 'stone');        // teto do corredor
R(-36.3, -44, -27.5, -28.6, 0, 5.2, 'stone');          // bloco norte
R(-33.7, -26, -27.5, -16, 0, 5.2, 'stone');            // bloco sul da trincheira
R(-29.4, -28.6, -27.5, -26, 0, 5.2, 'stone');          // patamar de saída
R(-27.5, -44, 44, -16, 0, 5.2, 'stone');               // bloco principal leste
// escada da Mina (2,6 -> 5,2, dentro da trincheira)
stairs(S, -33.2, -27.3, 1, 0, 9, 0.29, 0.45, 2.6, 'stone', 2.6);
// parapeitos da boca da trincheira (no piso do Templo)
R(-33.7, -26, -29.4, -25.45, 5.2, 0.6, 'stone2');
R(-33.7, -29.15, -29.4, -28.6, 5.2, 0.6, 'stone2');

// Longa: colunata (colunas a cada ~7m, vão central para o Altar).
// mat 'pillar': o colisor é a caixa, mas o visual vem do kit (cilindro
// com base/capitel) — o builder pula caixas 'pillar'.
export const COLUNAS_LONGA = [-32, -25, -18, -11, 11, 18, 25, 32];
for (const cx of COLUNAS_LONGA) {
  R(cx - 0.35, -21.95, cx + 0.35, -21.25, 5.2, 4.2, 'pillar');
}

// Muretas de cobertura do Templo
R(-15.5, -25.1, -12.5, -24.5, 5.2, 1.1, 'stone2');
R(7.7, -21, 8.3, -18, 5.2, 1.1, 'stone2');
R(16.5, -30.3, 19.5, -29.7, 5.2, 1.1, 'stone2');
R(16.3, -33.7, 17.65, -32.35, 5.2, 1.35, 'crate');
R(17.6, -34.4, 18.95, -33.05, 5.2, 1.35, 'crate');

// Altar do Cristal: plataforma em degraus (subível — high ground exposto)
R(-4.5, -39.5, 4.5, -30.5, 5.2, 0.5, 'stone');
R(-3.2, -38.2, 3.2, -31.8, 5.7, 0.5, 'stone');
R(-2, -37, 2, -33, 6.2, 0.6, 'stone');
R(-0.7, -35.7, 0.7, -34.3, 6.8, 1.6, 'stone');         // plinto do cristal

// Torre do Sino: fuste + plataforma 8,95 + parapeitos + escada externa exposta
R(24, -38.2, 28.4, -33.8, 5.2, 3.4, 'stone');
R(23.2, -39, 29.2, -33, 8.6, 0.35, 'wood');
R(23.2, -39, 29.2, -38.65, 8.95, 1.0, 'wood2');        // parapeito norte
R(23.2, -33.35, 29.2, -33, 8.95, 1.0, 'wood2');        // parapeito sul
R(28.85, -39, 29.2, -33, 8.95, 1.0, 'wood2');          // parapeito leste
R(23.2, -39, 23.55, -36, 8.95, 1.0, 'wood2');          // parapeito oeste (com vão p/ escada)
stairs(S, 22.5, -30.4, 0, -1, 13, 0.29, 0.4, 1.6, 'stone', 5.2);

// ---- Barris (colisores; bid p/ excluir a própria caixa no teste de cobertura) ----
for (const b of BARRELS) S.push({ ...B(b.x, b.y || 0, b.z, BARREL_W, BARREL_H, BARREL_W, 'barrel'), bid: b.id });

export const BOUNDS = buildBounds(SOLIDS);

// Spawns [x, z, y] — perímetro das 3 faixas, fora das linhas longas
export const SPAWNS = [
  [-38, 29, 0], [35, 27, 0], [14, 27, 0], [39, 15, 0], [0, 38, 0], [24, 36, 0],
  [-19, 4, 2.6], [-1, -3, 2.6], [-35, -8, 2.6],
  [-36, -32, 5.2], [0, -41, 5.2], [33, -20, 5.2]
];

// Patrulha dos bots: giro pelas 3 faixas — sobe pelo Aqueduto, cruza o
// Templo, desce pela Escadaria, visita Vila/Pátio/Beco e volta pela rua.
// Waypoints VIZINHOS são alcançáveis em linha quase reta (verificado por
// simulação de caminhada no teste da Fase 2); saltos de +2/+3 podem falhar
// e são recuperados pelo stuckT do bot.
export const PATROL = [
  [-34, 22], [-24, 21], [-14, 25], [0, 20], [12, 26], [24, 26.5], [35.5, 26],
  [39, 15], [39, 8], [39, -2], [40, -12], [39, -18],
  [30, -20], [20, -28], [8, -24], [0, -28], [-12, -24], [-24, -30], [-31, -20],
  [-27, -14], [-27, -2], [-35, -8], [-19, 4], [-1, -3],
  [4.6, -2], [4.6, 4.5], [4.6, 12], [1, 20], [-10, 19], [-22, 19]
];
