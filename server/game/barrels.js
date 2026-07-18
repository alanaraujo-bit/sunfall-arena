// ============================================================
// SUNFALL ARENA — barris explosivos (servidor autoritativo)
// Levam dano de bala (e de granadas próximas, em reação em cadeia);
// ao estourar, aplicam dano em área igual à granada de frag (mesma
// queda suave por distância + bloqueio por cobertura sólida).
// ============================================================
import { PLAYER, raycastSolids, BARREL_W, BARREL_H, BARREL_HP, BARREL_DMG_MAX, BARREL_DMG_RADIUS } from '../../shared/mapdata.js';

export function initBarrels(map) {
  return map.BARRELS.map(b => ({ id: b.id, x: b.x, y: b.y || 0, z: b.z, hp: BARREL_HP, alive: true }));
}

// AABB do barril (mesmo formato usado por rayBox) — `y` é a base (piso do
// terraço onde o barril está; 0 = chão).
export function barrelBounds(b) {
  const r = BARREL_W / 2, y = b.y || 0;
  return { minx: b.x - r, maxx: b.x + r, miny: y, maxy: y + BARREL_H, minz: b.z - r, maxz: b.z + r };
}

// Aplica dano num barril vivo. Se estourar, aplica dano em área nos jogadores
// próximos e devolve o ponto de explosão pro broadcast; senão devolve null
// (sem feedback de dano parcial — só o estouro final importa pro jogo).
export function damageBarrel(room, barrel, dmg, attacker, players, damageFn) {
  if (!barrel.alive) return null;
  barrel.hp -= dmg;
  if (barrel.hp > 0) return null;
  barrel.alive = false;
  barrel.hp = 0;
  const x = barrel.x, y = (barrel.y || 0) + BARREL_H + 0.1, z = barrel.z;
  for (const p of players.values()) {
    if (!p.alive) continue;
    const cx = p.pos.x - x, cy = (p.pos.y + PLAYER.BODY_H * 0.5) - y, cz = p.pos.z - z;
    const dist = Math.hypot(cx, cy, cz);
    if (dist > BARREL_DMG_RADIUS) continue;
    const dl = dist || 0.001;
    // exclui a própria caixa do barril (destroço, mas ainda sólido) do teste
    // de cobertura — senão o raio "raspa" nela mesma e bloqueia tudo
    if (raycastSolids(room.map.BOUNDS, x, y, z, cx / dl, cy / dl, cz / dl, Infinity, barrel.id) < dist - 0.4) continue;
    const t = Math.max(0, 1 - dist / BARREL_DMG_RADIUS);
    const dealt = Math.round(BARREL_DMG_MAX * Math.pow(t, 1.15));
    if (dealt > 0) damageFn(room, attacker, p, dealt, false, 4, false, false);
  }
  return { id: barrel.id, x, y, z };
}
