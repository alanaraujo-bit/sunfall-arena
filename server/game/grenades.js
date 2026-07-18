// ============================================================
// SUNFALL ARENA — granadas (servidor autoritativo)
// Física compartilhada (shared/nadephysics.js). Dois tipos:
//   frag  → explode com dano por distância + bloqueio por cobertura
//   smoke → deposita uma nuvem que nega visão por um tempo
// ============================================================
import { PLAYER, raycastSolids } from '../../shared/mapdata.js';
import { NADE, SMOKE, SMOKE_LIFE_MS, advanceGrenade, launchGrenade } from '../../shared/nadephysics.js';

export const NADE_COUNT_START = NADE.COUNT_START;
export const SMOKE_COUNT_START = SMOKE.COUNT_START;
export const NADE_FUSE_MS = NADE.FUSE_MS;
export const NADE_THROW_COOLDOWN_MS = 300;
export { SMOKE_LIFE_MS };

let nextNadeId = 1;

export function throwGrenade(room, player, origin, dir, power, kind = 'frag') {
  const phys = launchGrenade(origin, dir, power);
  const fuse = kind === 'smoke' ? SMOKE.FUSE_MS : NADE.FUSE_MS;
  const nade = {
    id: nextNadeId++,
    kind,
    ownerId: player.id,
    ownerTeam: player.team,
    pos: phys.pos, vel: phys.vel, grounded: phys.grounded,
    fuseAt: Date.now() + fuse
  };
  room.grenades.set(nade.id, nade);
  return nade;
}

// Avança a física de todas as granadas da sala. Ao vencer o fuse, separa por
// tipo: explosions (frag, aplicar dano) e smokeDeploys (smoke, virar nuvem).
export function updateGrenades(room, dt, now) {
  const bounces = [];
  const explosions = [];
  const smokeDeploys = [];
  for (const nade of room.grenades.values()) {
    if (now >= nade.fuseAt) {
      (nade.kind === 'smoke' ? smokeDeploys : explosions).push(nade);
      room.grenades.delete(nade.id);
      continue;
    }
    if (advanceGrenade(nade, dt)) bounces.push(nade);
  }
  return { bounces, explosions, smokeDeploys };
}

// Dano com queda suave pela distância; cobertura sólida entre a explosão e o
// jogador bloqueia o dano por completo (como em CS/Valorant).
export function explodeGrenade(room, nade, players, damageFn) {
  const owner = players.get(nade.ownerId);
  if (!owner) return;   // lançador já saiu da sala — sem autoria, sem dano
  const { x, y, z } = nade.pos;
  for (const p of players.values()) {
    if (!p.alive) continue;
    const cx = p.pos.x - x, cy = (p.pos.y + PLAYER.BODY_H * 0.5) - y, cz = p.pos.z - z;
    const dist = Math.hypot(cx, cy, cz);
    if (dist > NADE.DMG_RADIUS) continue;
    const dl = dist || 0.001;
    if (raycastSolids(x, y, z, cx / dl, cy / dl, cz / dl) < dist - 0.35) continue; // cobertura bloqueia
    const t = Math.max(0, 1 - dist / NADE.DMG_RADIUS);
    const dmg = Math.round(NADE.DMG_MAX * Math.pow(t, 1.4));
    if (dmg > 0) damageFn(room, owner, p, dmg, false, 3, false, false);
  }
}

// Deposita uma nuvem de fumaça a partir da granada que venceu o fuse. O centro
// fica um pouco acima do ponto de parada (a nuvem "senta" no chão e sobe).
export function deploySmoke(room, nade, now) {
  const smoke = {
    id: nade.id,
    pos: { x: nade.pos.x, y: nade.pos.y + SMOKE.CENTER_UP, z: nade.pos.z },
    deployAt: now,
    expireAt: now + SMOKE_LIFE_MS
  };
  (room.smokes ||= new Map()).set(smoke.id, smoke);
  return smoke;
}

// Remove nuvens expiradas; devolve os ids removidos (p/ avisar os clientes).
export function updateSmokes(room, now) {
  if (!room.smokes || room.smokes.size === 0) return null;
  let expired = null;
  for (const s of room.smokes.values()) {
    if (now >= s.expireAt) (expired ||= []).push(s.id), room.smokes.delete(s.id);
  }
  return expired;
}

// Uma linha de visão (a→b) está bloqueada por fumaça? Teste segmento × esfera
// contra cada nuvem ativa. Usado pelo LOS dos bots para que a fumaça também
// os cegue (a fumaça não para balas — apenas nega visão).
export function sightBlockedBySmoke(room, ax, ay, az, bx, by, bz) {
  if (!room.smokes || room.smokes.size === 0) return false;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  const r2 = SMOKE.RADIUS * SMOKE.RADIUS;
  for (const s of room.smokes.values()) {
    const ex = s.pos.x - ax, ey = s.pos.y - ay, ez = s.pos.z - az;
    let t = len2 > 1e-6 ? (ex * dx + ey * dy + ez * dz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - s.pos.x, py = ay + dy * t - s.pos.y, pz = az + dz * t - s.pos.z;
    if (px * px + py * py + pz * pz < r2) return true;
  }
  return false;
}
