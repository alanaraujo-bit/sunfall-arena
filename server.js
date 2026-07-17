// ============================================================
// SUNFALL ARENA — servidor (HTTP estático + WebSocket)
// Relay de estado, dano/kills autoritativos e bots com patrulha.
// ============================================================
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { SPAWNS, PATROL, raycastSolids, pushOut } from './shared/mapdata.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/') url = '/index.html';
    // /shared/* vem da pasta shared; o resto de public/
    const base = url.startsWith('/shared/') ? ROOT : join(ROOT, 'public');
    const path = normalize(join(base, url.startsWith('/shared/') ? url : url));
    if (!path.startsWith(normalize(ROOT))) { res.writeHead(403); res.end(); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('404');
  }
});

// ---------------- Estado do jogo ----------------
const COLORS = ['#3fc8b4', '#f0844c', '#b07ce0', '#8ac850', '#e86a9c', '#f0c04c', '#5c9ce8', '#e05c50'];
let nextId = 1, colorIdx = 0;
const players = new Map(); // id -> {id,name,color,pos,yaw,pitch,anim,hp,kills,deaths,alive,bot,ws}

function spawnPos() {
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

function snapshot(p) {
  return {
    id: p.id, name: p.name, color: p.color, bot: !!p.bot,
    pos: [p.pos.x, p.pos.y, p.pos.z], hp: p.hp, k: p.kills, d: p.deaths
  };
}

function broadcast(obj, exceptId = null) {
  const raw = JSON.stringify(obj);
  for (const p of players.values()) {
    if (p.ws && p.id !== exceptId && p.ws.readyState === 1) p.ws.send(raw);
  }
}

function damage(attacker, victim, dmg, head = false) {
  if (!victim || !victim.alive || !attacker || !attacker.alive) return;
  victim.hp -= dmg;
  if (victim.hp > 0) {
    broadcast({ t: 'dmg', id: victim.id, hp: victim.hp, by: attacker.id });
    return;
  }
  victim.hp = 0;
  victim.alive = false;
  victim.deaths++;
  if (attacker !== victim) attacker.kills++;
  broadcast({ t: 'dmg', id: victim.id, hp: 0, by: attacker.id });
  broadcast({ t: 'die', id: victim.id, by: attacker.id, kk: attacker.kills, vd: victim.deaths, h: head });
  setTimeout(() => {
    if (!players.has(victim.id)) return;
    victim.pos = spawnPos();
    victim.hp = 100;
    victim.alive = true;
    broadcast({ t: 'spawn', id: victim.id, pos: [victim.pos.x, victim.pos.y, victim.pos.z] });
  }, 2600);
}

// ---------------- WebSocket ----------------
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  let self = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.t === 'join' && !self) {
      self = {
        id: nextId++,
        name: String(msg.name || 'Recruta').slice(0, 14),
        color: COLORS[colorIdx++ % COLORS.length],
        pos: spawnPos(), yaw: 0, pitch: 0, anim: 0,
        hp: 100, kills: 0, deaths: 0, alive: true, bot: false, ws
      };
      players.set(self.id, self);
      ws.send(JSON.stringify({
        t: 'init', id: self.id,
        players: [...players.values()].map(snapshot)
      }));
      broadcast({ t: 'j', p: snapshot(self) }, self.id);
      console.log(`+ ${self.name} (#${self.id}) entrou — ${players.size} na arena`);
      return;
    }
    if (!self) return;

    switch (msg.t) {
      case 's':
        if (!self.alive || !Array.isArray(msg.p)) break;
        self.pos.x = +msg.p[0] || 0;
        self.pos.y = +msg.p[1] || 0;
        self.pos.z = +msg.p[2] || 0;
        self.yaw = +msg.r[0] || 0;
        self.pitch = +msg.r[1] || 0;
        self.anim = msg.a | 0;
        break;
      case 'fire':
        broadcast({ t: 'fire', id: self.id, o: msg.o, d: msg.d, w: msg.w }, self.id);
        break;
      case 'hit': {
        const victim = players.get(msg.id);
        const dmg = Math.min(200, Math.max(1, +msg.dmg || 0));
        damage(self, victim, dmg, !!msg.h);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!self) return;
    players.delete(self.id);
    broadcast({ t: 'l', id: self.id });
    console.log(`- ${self.name} saiu — ${players.size - BOT_COUNT} jogador(es)`);
  });
  ws.on('error', () => {});
});

// ---------------- Bots ----------------
const BOT_COUNT = 3;
const BOT_NAMES = ['Tuca', 'Zumbi-77', 'Nina.exe'];

for (let i = 0; i < BOT_COUNT; i++) {
  const bot = {
    id: nextId++,
    name: BOT_NAMES[i],
    color: COLORS[colorIdx++ % COLORS.length],
    pos: spawnPos(), yaw: 0, pitch: 0, anim: 1,
    hp: 100, kills: 0, deaths: 0, alive: true, bot: true, ws: null,
    wp: (Math.random() * PATROL.length) | 0,
    fireT: 1 + Math.random() * 2, burst: 0, strafe: 0
  };
  players.set(bot.id, bot);
}

function hasLOS(a, b) {
  const ax = a.pos.x, ay = a.pos.y + 1.55, az = a.pos.z;
  const bx = b.pos.x, by = b.pos.y + 1.3, bz = b.pos.z;
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.001) return true;
  dx /= dist; dy /= dist; dz /= dist;
  return raycastSolids(ax, ay, az, dx, dy, dz) > dist - 0.6;
}

function updateBot(bot, dt) {
  if (!bot.alive) return;

  // alvo: humano mais próximo com LOS; senão outro bot
  let target = null, tDist = 40;
  for (const pass of [false, true]) {
    for (const p of players.values()) {
      if (p === bot || !p.alive || p.bot !== pass) continue;
      const d = Math.hypot(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
      if (d < tDist && hasLOS(bot, p)) { target = p; tDist = d; }
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
      broadcast({ t: 'fire', id: bot.id, o: [ex, ey, ez], d: [dx, dy, dz], w: 0 });
      const chance = Math.max(0.08, Math.min(0.45, 0.5 - tDist * 0.009));
      if (Math.random() < chance) damage(bot, target, 8 + (Math.random() * 5 | 0));
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

// ---------------- Loop principal (15Hz) ----------------
setInterval(() => {
  const dt = 1 / 15;
  for (const p of players.values()) if (p.bot) updateBot(p, dt);

  const state = {};
  for (const p of players.values()) {
    state[p.id] = [
      +p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2),
      +p.yaw.toFixed(3), +p.pitch.toFixed(3), p.anim, p.hp
    ];
  }
  broadcast({ t: 's', p: state });
}, 66);

server.listen(PORT, () => {
  console.log('==========================================');
  console.log('  SUNFALL ARENA');
  console.log(`  http://localhost:${PORT}`);
  console.log('  Abra em várias abas para multiplayer,');
  console.log('  ou compartilhe seu IP na rede local.');
  console.log('==========================================');
});
