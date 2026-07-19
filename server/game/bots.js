// ============================================================
// SUNFALL ARENA — bots: patrulha, mira e tiro (por sala)
// ============================================================
import { PLAYER, raycastSolids, pushOut, floorTopAt } from '../../shared/mapdata.js';
import { nextPlayerId, nextColor, spawnPos, broadcastRoom, assignTeam } from './rooms.js';
import { sightBlockedBySmoke } from './grenades.js';

// Um obstáculo bloqueia o bot se a caixa cruza a altura do corpo dele,
// RELATIVA ao chão em que ele está (y). Topo até 0.95 acima dos pés é degrau
// (sobe); base 1.4 acima da cabeça é teto/telhado (passa por baixo).
function botBlocked(bounds, x, z, y) {
  const r = PLAYER.R;
  for (const b of bounds) {
    if (b.maxy - y <= 0.95) continue;
    if (b.miny - y > 1.4) continue;
    if (x + r > b.minx && x - r < b.maxx && z + r > b.minz && z - r < b.maxz) return true;
  }
  return false;
}

// Move o bot com colisão separada por eixo (desliza rente à parede em vez de
// enfiar nela e ser "teleportado" pra fora pelo pushOut), acompanhando a
// altura do terreno (sobe degrau, cai de borda). Retorna se andou.
// Deltas sub-milimétricos NÃO contam como movimento — sem isso, um bot
// alinhado no eixo com o alvo "anda" 1e-17 por tick contra uma parede,
// o stuckT nunca dispara e ele fica pregado na face do terraço pra sempre.
function moveBot(bounds, bot, dx, dz) {
  let moved = false;
  const y = bot.pos.y;
  if (Math.abs(dx) > 1e-3 && !botBlocked(bounds, bot.pos.x + dx, bot.pos.z, y)) { bot.pos.x += dx; moved = true; }
  if (Math.abs(dz) > 1e-3 && !botBlocked(bounds, bot.pos.x, bot.pos.z + dz, y)) { bot.pos.z += dz; moved = true; }
  if (moved) bot.pos.y = floorTopAt(bounds, bot.pos.x, bot.pos.z, y);
  return moved;
}

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
    wp: (Math.random() * room.map.PATROL.length) | 0,
    fireT: 1 + Math.random() * 2, burst: 0, strafe: 0, stuckT: 0, combatStuckT: 0
  };
}

function hasLOS(room, a, b) {
  const ax = a.pos.x, ay = a.pos.y + 1.55, az = a.pos.z;
  const bx = b.pos.x, by = b.pos.y + 1.3, bz = b.pos.z;
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.001) return true;
  const ux = dx / dist, uy = dy / dist, uz = dz / dist;
  if (raycastSolids(room.map.BOUNDS, ax, ay, az, ux, uy, uz) <= dist - 0.6) return false; // parede
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
    // encarar o alvo + strafe lateral (com colisão: inverte o lado se travar)
    bot.yaw = Math.atan2(-(target.pos.x - bot.pos.x), -(target.pos.z - bot.pos.z));
    bot.strafe += dt;
    const side = Math.sin(bot.strafe * 1.7) > 0 ? 1 : -1;
    const px = Math.cos(bot.yaw) * side, pz = -Math.sin(bot.yaw) * side;
    const moved = moveBot(room.map.BOUNDS, bot, px * 2.6 * dt, pz * 2.6 * dt);
    if (!moved) {
      bot.strafe += 1.2;   // encostou na parede → troca de direção
      // MAS trocar de lado não ajuda se os dois lados do strafe estiverem
      // bloqueados ao mesmo tempo (canto apertado, muretas empilhadas da
      // Escadaria, canal do Aqueduto) — sem isso o bot fica preso pra
      // sempre atirando do mesmo lugar (achado pelo playtest da Fase 7).
      // Depois de meio segundo preso, tenta se AFASTAR direto do alvo:
      // por onde o bot chegou até ali quase sempre tem espaço livre.
      bot.combatStuckT = (bot.combatStuckT || 0) + dt;
      if (bot.combatStuckT > 0.35) {
        let ax = bot.pos.x - target.pos.x, az = bot.pos.z - target.pos.z;
        const al = Math.hypot(ax, az) || 1;
        moveBot(room.map.BOUNDS, bot, (ax / al) * 2.6 * dt, (az / al) * 2.6 * dt);
      }
    } else {
      bot.combatStuckT = 0;
    }
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
    // patrulha (com colisão: se travar no caminho, pula pro próximo waypoint
    // em vez de moer contra o obstáculo)
    const patrol = room.map.PATROL;
    const [wx, wz] = patrol[bot.wp % patrol.length];
    const dx = wx - bot.pos.x, dz = wz - bot.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.6) {
      bot.wp = (bot.wp + 1 + (Math.random() * 3 | 0)) % patrol.length;
      bot.stuckT = 0;
    } else {
      const moved = moveBot(room.map.BOUNDS, bot, (dx / d) * 4.2 * dt, (dz / d) * 4.2 * dt);
      bot.yaw = Math.atan2(-dx, -dz);
      bot.anim = 1;
      bot.stuckT = moved ? 0 : (bot.stuckT || 0) + dt;
      if (bot.stuckT > 0.4) {   // preso num obstáculo → escolhe outro destino
        bot.wp = (bot.wp + 1 + (Math.random() * 3 | 0)) % patrol.length;
        bot.stuckT = 0;
      }
    }
  }
  pushOut(room.map.BOUNDS, room.map.LIM, bot.pos);   // rede de segurança
  bot.pos.y = floorTopAt(room.map.BOUNDS, bot.pos.x, bot.pos.z, bot.pos.y);
}
