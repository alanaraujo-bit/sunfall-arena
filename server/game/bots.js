// ============================================================
// SUNFALL ARENA — bots: patrulha, mira e tiro (por sala)
// ============================================================
import { PATROL, raycastSolids, pushOut } from '../../shared/mapdata.js';
import { nextPlayerId, nextColor, spawnPos, broadcastRoom, assignTeam } from './rooms.js';
import { sightBlockedBySmoke } from './grenades.js';

const BOT_NAMES = [
  'Tuca', 'Zumbi-77', 'Nina.exe', 'Kadu', 'Foguete', 'Piolho',
  'Dona-Morte', 'Sabre', 'Trovao', 'Careca', 'Mel', 'Vulto'
];
let botNameIdx = 0;

export function makeBot(room) {
  return {
    id: nextPlayerId(),
    accountId: null,
    name: BOT_NAMES[botNameIdx++ % BOT_NAMES.length],
    color: nextColor(room),
    team: room.settings.gm === 'tdm' ? assignTeam(room) : null,
    pos: spawnPos(room), yaw: 0, pitch: 0, anim: 1,
    hp: 100, kills: 0, deaths: 0, alive: true, bot: true, ws: null,
    wp: (Math.random() * PATROL.length) | 0,
    fireT: 1 + Math.random() * 2, burst: 0, strafe: 0
  };
}

function hasLOS(room, a, b) {
  const ax = a.pos.x, ay = a.pos.y + 1.55, az = a.pos.z;
  const bx = b.pos.x, by = b.pos.y + 1.3, bz = b.pos.z;
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.001) return true;
  const ux = dx / dist, uy = dy / dist, uz = dz / dist;
  if (raycastSolids(ax, ay, az, ux, uy, uz) <= dist - 0.6) return false;       // parede
  if (sightBlockedBySmoke(room, ax, ay, az, bx, by, bz)) return false;         // fumaça cega o bot
  return true;
}

export function updateBot(room, bot, dt, damage) {
  if (!bot.alive) return;

  // alvo: humano mais próximo com LOS; senão outro bot (nunca do próprio time)
  const tdm = room.settings.gm === 'tdm';
  let target = null, tDist = 40;
  for (const pass of [false, true]) {
    for (const p of room.players.values()) {
      if (p === bot || !p.alive || p.bot !== pass) continue;
      if (tdm && p.team === bot.team) continue;
      const d = Math.hypot(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
      if (d < tDist && hasLOS(room, bot, p)) { target = p; tDist = d; }
    }
    if (target) break;
  }

  if (target) {
    // encarar o alvo + strafe lateral
    bot.yaw = Math.atan2(-(target.pos.x - bot.pos.x), -(target.pos.z - bot.pos.z));
    bot.strafe += dt;
    const side = Math.sin(bot.strafe * 1.7) > 0 ? 1 : -1;
    const px = Math.cos(bot.yaw) * side, pz = -Math.sin(bot.yaw) * side;
    bot.pos.x += px * 2.6 * dt;
    bot.pos.z += pz * 2.6 * dt;
    bot.anim = 1;

    bot.fireT -= dt;
    if (bot.fireT <= 0) {
      if (bot.burst <= 0) bot.burst = 4;
      bot.burst--;
      bot.fireT = bot.burst > 0 ? 0.14 : 1.1 + Math.random() * 0.9;
      // tracer para os clientes
      const ex = bot.pos.x, ey = bot.pos.y + 1.55, ez = bot.pos.z;
      let dx = target.pos.x - ex, dy = target.pos.y + 1.2 - ey, dz = target.pos.z - ez;
      const d = Math.hypot(dx, dy, dz) || 1;
      dx = dx / d + (Math.random() - 0.5) * 0.06;
      dy = dy / d + (Math.random() - 0.5) * 0.06;
      dz = dz / d + (Math.random() - 0.5) * 0.06;
      broadcastRoom(room, { t: 'fire', id: bot.id, o: [ex, ey, ez], d: [dx, dy, dz], w: 0 });
      const chance = Math.max(0.08, Math.min(0.45, 0.5 - tDist * 0.009));
      if (Math.random() < chance) damage(room, bot, target, 8 + (Math.random() * 5 | 0), false, 0);
    }
  } else {
    // patrulha
    const [wx, wz] = PATROL[bot.wp];
    const dx = wx - bot.pos.x, dz = wz - bot.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.6) {
      bot.wp = (bot.wp + 1 + (Math.random() * 3 | 0)) % PATROL.length;
    } else {
      bot.pos.x += (dx / d) * 4.2 * dt;
      bot.pos.z += (dz / d) * 4.2 * dt;
      bot.yaw = Math.atan2(-dx, -dz);
      bot.anim = 1;
    }
  }
  pushOut(bot.pos);
  bot.pos.y = 0;
}
