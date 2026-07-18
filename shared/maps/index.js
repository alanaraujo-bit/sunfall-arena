// ============================================================
// SUNFALL ARENA — registry de mapas (cliente + servidor)
// Cada mapa exporta: KEY, NAME, LIM, BARRELS, SOLIDS, BOUNDS,
// SPAWNS ([x, z, y?]), PATROL. A física genérica que consome
// esses dados mora em shared/mapdata.js.
// ============================================================
import * as canion from './canion.js';
import * as ocaso from './ocaso.js';

export const MAPS = { canion, ocaso };
export const DEFAULT_MAP = 'canion';   // públicas trocam para 'ocaso' quando o blockout estiver pronto

// Lista para UI (ordem de exibição)
export const MAP_LIST = [canion, ocaso].map(m => ({ key: m.KEY, name: m.NAME }));

export function getMap(key) {
  return MAPS[key] || MAPS[DEFAULT_MAP];
}
