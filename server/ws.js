// ============================================================
// SUNFALL ARENA — WebSocket: presença (hello), salas (play/leave),
// convites e combate autoritativo com partidas que terminam.
// ============================================================
import { WebSocketServer } from 'ws';
import { PLAYER, rayBox, raycastSolids } from '../shared/mapdata.js';
import {
  rooms, findOrCreatePublic, createCustom, getByCode, realCount, MAX_REAL,
  nextPlayerId, nextColor, spawnPos, snapshot, broadcastRoom,
  adjustBots, removePlayer, endMatch, assignTeam, teamScores
} from './game/rooms.js';
import { updateBot } from './game/bots.js';
import { awardXpAndPersist, persistDeath, loadProfileForJoin } from './game/stats.js';
import { verifyToken } from './auth.js';
import { setPresence, clearPresence, getPresence } from './presence.js';
import { query } from './db.js';

// ---------------- Armas (fonte da verdade — o cliente não decide dano) ----------------
const WEAPONS = [
  { dmg: 16, head: 1.75, int: 0.115 },   // FALCÃO-9
  { dmg: 92, head: 2, int: 1.05 }        // FERRÃO-SR
];
const REWIND_MAX_MS = 1000;
const KIT_STREAK = 3;     // kills seguidas (sem morrer) para ganhar 1 kit
const KIT_MAX = 2;        // cargas de kit acumuláveis
const KIT_HEAL = 50;      // vida restaurada por uso
const KIT_USE_MS = 1000;  // tempo de canalização

// posição do jogador rebobinada para o instante `sv` (lag compensation)
function rewindPos(p, sv) {
  const h = p.hist;
  if (!h || !h.length) return p.pos;
  if (sv >= h[h.length - 1].t) return h[h.length - 1];
  for (let i = h.length - 1; i > 0; i--) {
    if (h[i - 1].t <= sv) {
      const a = h[i - 1], b = h[i];
      const al = (sv - a.t) / ((b.t - a.t) || 1);
      return { x: a.x + (b.x - a.x) * al, y: a.y + (b.y - a.y) * al, z: a.z + (b.z - a.z) * al };
    }
  }
  return h[0];
}

function damage(room, attacker, victim, dmg, head = false, wi = 0) {
  if (room.state !== 'playing') return;
  if (!victim || !victim.alive || !attacker || !attacker.alive) return;
  // TDM: sem fogo amigo (aliados não se ferem)
  if (room.settings.gm === 'tdm' && attacker !== victim && attacker.team === victim.team) return;
  victim.hp -= dmg;
  if (victim.hp > 0) {
    broadcastRoom(room, { t: 'dmg', id: victim.id, hp: victim.hp, by: attacker.id, h: head });
    return;
  }
  victim.hp = 0;
  victim.alive = false;
  victim.deaths++;
  if (attacker !== victim) attacker.kills++;
  broadcastRoom(room, { t: 'dmg', id: victim.id, hp: 0, by: attacker.id, h: head });
  broadcastRoom(room, { t: 'die', id: victim.id, by: attacker.id, kk: attacker.kills, vd: victim.deaths, h: head, w: wi });

  if (attacker !== victim && attacker.accountId) {
    awardXpAndPersist(attacker.accountId, { headshot: head })
      .catch(err => console.error('[xp] award failed for', attacker.accountId, err));
  }
  if (victim.accountId) {
    persistDeath(victim.accountId)
      .catch(err => console.error('[stats] death persist failed for', victim.accountId, err));
  }

  if (attacker !== victim) {
    if (room.settings.gm === 'tdm') {
      const [a, b] = teamScores(room);
      if (a >= room.settings.kl || b >= room.settings.kl) {
        endMatch(room, null, a >= b ? 0 : 1);
        return;
      }
    } else if (attacker.kills >= room.settings.kl) {
      endMatch(room, attacker);
      return;
    }
  }

  setTimeout(() => {
    if (!rooms.has(room.code) || room.state !== 'playing') return;
    if (!room.players.has(victim.id)) return;
    victim.pos = spawnPos(room);
    victim.hp = 100;
    victim.alive = true;
    broadcastRoom(room, { t: 'spawn', id: victim.id, pos: [victim.pos.x, victim.pos.y, victim.pos.z] });
  }, 2600);
}

async function isFriendAccepted(a, b) {
  const { rows } = await query(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [a, b]
  );
  return rows.length > 0;
}

export function attachWs(server) {
  const wss = new WebSocketServer({ server });

  // Server-side ping to keep connections alive through Fly.io proxy
  const PING_INTERVAL = 25_000;
  const pingTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, PING_INTERVAL);
  wss.on('close', () => clearInterval(pingTimer));

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    if (process.env.NODE_ENV === 'production') {
      const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
      const origin = req.headers.origin;
      if (allowed.length && !allowed.includes(origin)) { ws.close(1008, 'origin not allowed'); return; }
    }

    let auth = null;   // { accountId, username, color } quando logado
    let self = null;   // jogador dentro de uma sala
    let room = null;

    const send = obj => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

    function leaveRoom() {
      if (!room || !self) return;
      removePlayer(room, self);
      console.log(`- ${self.name} saiu da sala ${room.code}`);
      self = null;
      room = null;
    }

    function joinRoom(target, displayName) {
      self = {
        id: nextPlayerId(),
        accountId: auth ? auth.accountId : null,
        name: displayName,
        color: (auth && auth.color) || nextColor(target),
        team: target.settings.gm === 'tdm' ? assignTeam(target) : null,
        pos: spawnPos(target), yaw: 0, pitch: 0, anim: 0,
        hp: 100, kills: 0, deaths: 0, alive: true, bot: false, ws
      };
      room = target;
      room.players.set(self.id, self);
      send({
        t: 'init',
        id: self.id,
        code: room.code,
        mode: room.mode,
        gm: room.settings.gm,
        team: self.team,
        kl: room.settings.kl,
        end: room.endsAt,
        players: [...room.players.values()].map(snapshot)
      });
      broadcastRoom(room, { t: 'j', p: snapshot(self) }, self.id);
      adjustBots(room);
      console.log(`+ ${self.name} (${self.accountId ? 'conta' : 'convidado'}) entrou na sala ${room.code} [${room.mode}/${room.settings.gm}] — ${realCount(room)} reais`);
    }

    ws.on('message', async raw => {
      try {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.t === 'ping') { send({ t: 'pong', ts: msg.ts }); return; }

      switch (msg.t) {
        case 'hello': {
          const claims = msg.token ? verifyToken(msg.token) : null;
          if (claims) {
            const profile = await loadProfileForJoin(claims.sub).catch(() => null);
            if (profile) {
              auth = { accountId: claims.sub, username: profile.username, color: profile.color };
              setPresence(auth.accountId, ws, auth.username);
            }
          } else if (auth) {
            clearPresence(auth.accountId, ws);
            auth = null;
          }
          send({ t: 'hello', ok: true, user: auth ? auth.username : null });
          return;
        }

        case 'play': {
          if (room) leaveRoom();
          const displayName = auth
            ? auth.username
            : String(msg.name || 'Recruta').slice(0, 14);

          if (msg.mode === 'public') {
            joinRoom(findOrCreatePublic(), displayName);
          } else if (msg.mode === 'create') {
            const gm = msg.gm === 'tdm' ? 'tdm' : 'ffa';
            const bots = Math.min(6, Math.max(0, msg.bots | 0));
            const kl = [10, 20, 30].includes(+msg.kl) ? +msg.kl : 20;
            const tlMin = [5, 10, 15].includes(+msg.tl) ? +msg.tl : 10;
            joinRoom(createCustom({ gm, bots, kl, tl: tlMin * 60 * 1000 }, auth ? auth.accountId : null), displayName);
          } else if (msg.mode === 'join') {
            const target = getByCode(msg.code);
            if (!target) { send({ t: 'err', code: 'room_not_found' }); return; }
            if (realCount(target) >= MAX_REAL) { send({ t: 'err', code: 'room_full' }); return; }
            joinRoom(target, displayName);
          }
          return;
        }

        case 'leave':
          leaveRoom();
          return;

        case 'team': {
          if (!self || !room || room.settings.gm !== 'tdm') return;
          const wanted = msg.team === 1 ? 1 : 0;
          if (self.team === wanted) return;
          self.team = wanted;
          self.deaths++;               // trocar de time custa uma morte (respawn)
          self.alive = false;
          broadcastRoom(room, { t: 'teamchg', id: self.id, team: wanted });
          setTimeout(() => {
            if (!rooms.has(room.code) || !room.players.has(self.id)) return;
            self.pos = spawnPos(room);
            self.hp = 100;
            self.alive = true;
            broadcastRoom(room, { t: 'spawn', id: self.id, pos: [self.pos.x, self.pos.y, self.pos.z] });
          }, 600);
          return;
        }

        case 'invite': {
          if (!auth) { send({ t: 'err', code: 'unauthorized' }); return; }
          if (!room || room.mode !== 'custom') { send({ t: 'err', code: 'not_in_custom_room' }); return; }
          const targetId = String(msg.userId || '');
          if (!/^\d+$/.test(targetId)) return;
          const ok = await isFriendAccepted(auth.accountId, targetId).catch(() => false);
          if (!ok) { send({ t: 'err', code: 'not_friends' }); return; }
          const target = getPresence(targetId);
          if (!target || target.ws.readyState !== 1) { send({ t: 'err', code: 'friend_offline' }); return; }
          target.ws.send(JSON.stringify({ t: 'invited', from: auth.username, code: room.code }));
          send({ t: 'invite_sent', to: targetId });
          return;
        }
      }

      if (!self || !room) return;

      switch (msg.t) {
        case 's': {
          if (!self.alive || !Array.isArray(msg.p)) break;
          const nx = +msg.p[0] || 0, ny = +msg.p[1] || 0, nz = +msg.p[2] || 0;
          // anti-speedhack: rejeita deslocamento horizontal implausível
          const now = Date.now();
          const sdt = Math.min(0.5, (now - (self.lastS || now)) / 1000) || 0.033;
          self.lastS = now;
          if (Math.hypot(nx - self.pos.x, nz - self.pos.z) > Math.max(1.5, 30 * sdt)) break;
          self.pos.x = nx; self.pos.y = ny; self.pos.z = nz;
          self.yaw = +msg.r[0] || 0;
          self.pitch = +msg.r[1] || 0;
          self.anim = msg.a | 0;
          break;
        }
        case 'fire': {
          // Tiro autoritativo: o servidor valida cadência e origem, rebobina o
          // mundo para o instante que o atirador via (sv) e refaz o raycast.
          if (!self.alive || room.state !== 'playing') break;
          const wi = msg.w === 1 ? 1 : 0;
          const w = WEAPONS[wi];
          const now = Date.now();
          self.lastFire = self.lastFire || [0, 0];
          if (now - self.lastFire[wi] < w.int * 1000 * 0.85) break;   // cadência da arma
          self.lastFire[wi] = now;

          if (!Array.isArray(msg.o) || !Array.isArray(msg.d)) break;
          const ox = +msg.o[0], oy = +msg.o[1], oz = +msg.o[2];
          let dx = +msg.d[0], dy = +msg.d[1], dz = +msg.d[2];
          const dl = Math.hypot(dx, dy, dz);
          if (!(dl > 0.5 && dl < 2)) break;
          dx /= dl; dy /= dl; dz /= dl;
          // origem precisa ser plausível (perto da posição conhecida do jogador)
          if (Math.hypot(ox - self.pos.x, oz - self.pos.z) > 3 ||
              Math.abs(oy - (self.pos.y + PLAYER.EYE)) > 2) break;

          broadcastRoom(room, { t: 'fire', id: self.id, o: [ox, oy, oz], d: [dx, dy, dz], w: wi }, self.id);

          const sv = Math.min(now, Math.max(now - REWIND_MAX_MS, +msg.sv || now));
          const tMap = raycastSolids(ox, oy, oz, dx, dy, dz);
          let victim = null, hitT = tMap, head = false;
          for (const p of room.players.values()) {
            if (p === self || !p.alive) continue;
            if (room.settings.gm === 'tdm' && p.team === self.team) continue;
            const rp = rewindPos(p, sv);
            // cabeça (esfera)
            const hx = rp.x - ox, hy = rp.y + PLAYER.HEAD_Y - oy, hz = rp.z - oz;
            const tc = hx * dx + hy * dy + hz * dz;
            if (tc > 0) {
              const d2 = hx * hx + hy * hy + hz * hz - tc * tc;
              if (d2 < PLAYER.HEAD_R * PLAYER.HEAD_R && tc < hitT) {
                hitT = tc; victim = p; head = true;
                continue;
              }
            }
            // corpo (AABB)
            const R = PLAYER.R;
            const tb = rayBox(ox, oy, oz, dx, dy, dz, {
              minx: rp.x - R, maxx: rp.x + R,
              miny: rp.y, maxy: rp.y + PLAYER.BODY_H,
              minz: rp.z - R, maxz: rp.z + R
            });
            if (tb < hitT) { hitT = tb; victim = p; head = false; }
          }
          if (victim) {
            damage(room, self, victim, Math.round(w.dmg * (head ? w.head : 1)), head, wi);
          }
          break;
        }
      }
      } catch (err) {
        // uma mensagem malformada nunca pode derrubar o servidor
        console.error('[ws] erro no handler de mensagem:', err);
      }
    });

    ws.on('close', () => {
      leaveRoom();
      if (auth) clearPresence(auth.accountId, ws);
    });
    ws.on('error', () => {});
  });

  return wss;
}

const TICK_MS = 33;               // ~30 Hz (antes 15 Hz) — movimento mais fluido
const TICK_DT = TICK_MS / 1000;

export function startGameLoop() {
  setInterval(() => {
    const now = Date.now();

    for (const room of rooms.values()) {
      if (room.state === 'playing') {
        for (const p of room.players.values()) if (p.bot) updateBot(room, p, TICK_DT, damage);
        if (now >= room.endsAt) endMatch(room);
      }

      const state = {};
      for (const p of room.players.values()) {
        // histórico p/ lag compensation (~1.3s)
        (p.hist ||= []).push({ t: now, x: p.pos.x, y: p.pos.y, z: p.pos.z });
        if (p.hist.length > 40) p.hist.shift();
        state[p.id] = [
          +p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2),
          +p.yaw.toFixed(3), +p.pitch.toFixed(3), p.anim, p.hp
        ];
      }
      broadcastRoom(room, {
        t: 's', p: state, sv: now,
        tl: room.state === 'playing' ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : 0,
        ts: room.settings.gm === 'tdm' ? teamScores(room) : undefined
      });
    }
  }, TICK_MS);
}
