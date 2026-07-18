// ============================================================
// SUNFALL ARENA — granadas de fragmentação (servidor autoritativo)
// Física compartilhada (shared/nadephysics.js) + temporizador de
// espoleta + dano por distância com bloqueio de cobertura (LOS).
// ============================================================
import { PLAYER, raycastSolids } from '../../shared/mapdata.js';
import { NADE, advanceGrenade, launchGrenade } from '../../shared/nadephysics.js';

export const NADE_COUNT_START = NADE.COUNT_START;
export const NADE_FUSE_MS = NADE.FUSE_MS;
export const NADE_THROW_COOLDOWN_MS = 300;

let nextNadeId = 1;

export function throwGrenade(room, player, origin, dir, power) {
  const phys = launchGrenade(origin, dir, power);
  const nade = {
    id: nextNadeId++,
    ownerId: player.id,
    ownerTeam: player.team,
    pos: phys.pos, vel: phys.vel, grounded: phys.grounded,
    fuseAt: Date.now() + NADE_FUSE_MS
  };
  room.grenades.set(nade.id, nade);
  return nade;
}

// Avança a física de todas as granadas da sala por `dt` segundos.
// Retorna { bounces, explosions } para o chamador transmitir/aplicar.
export function updateGrenades(room, dt, now) {
  const bounces = [];
  const explosions = [];
  for (const nade of room.grenades.values()) {
    if (now >= nade.fuseAt) {
      explosions.push(nade);
      room.grenades.delete(nade.id);
      continue;
    }
    if (advanceGrenade(nade, dt)) bounces.push(nade);
  }
  return { bounces, explosions };
}

// Dano com queda suave pela distância; cobertura sólida entre a explosão
// e o jogador bloqueia o dano por completo (como em CS/Valorant).
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
