// ============================================================
// SUNFALL ARENA — estado do jogo (jogadores, spawn, broadcast)
// ============================================================
import { SPAWNS } from '../../shared/mapdata.js';

export const COLORS = ['#3fc8b4', '#f0844c', '#b07ce0', '#8ac850', '#e86a9c', '#f0c04c', '#5c9ce8', '#e05c50'];
let nextId = 1;
let colorIdx = 0;
export const players = new Map(); // id -> {id,accountId,name,color,pos,yaw,pitch,anim,hp,kills,deaths,alive,bot,ws}

export function nextPlayerId() { return nextId++; }
export function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

export function spawnPos() {
  // spawn mais distante dos inimigos vivos
  let best = SPAWNS[0], bestD = -1;
  for (const [sx, sz] of SPAWNS) {
    let minD = Infinity;
    for (const p of players.values()) {
      if (!p.alive) continue;
      const d = (p.pos.x - sx) ** 2 + (p.pos.z - sz) ** 2;
      if (d < minD) minD = d;
    }
    if (minD > bestD) { bestD = minD; best = [sx, sz]; }
  }
  return { x: best[0], y: 0, z: best[1] };
}

export function snapshot(p) {
  return {
    id: p.id, name: p.name, color: p.color, bot: !!p.bot,
    pos: [p.pos.x, p.pos.y, p.pos.z], hp: p.hp, k: p.kills, d: p.deaths
  };
}

export function broadcast(obj, exceptId = null) {
  const raw = JSON.stringify(obj);
  for (const p of players.values()) {
    if (p.ws && p.id !== exceptId && p.ws.readyState === 1) p.ws.send(raw);
  }
}
