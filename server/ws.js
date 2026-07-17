// ============================================================
// SUNFALL ARENA — WebSocket: presença (hello), salas (play/leave),
// convites e combate autoritativo com partidas que terminam.
// ============================================================
import { WebSocketServer } from 'ws';
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

function damage(room, attacker, victim, dmg, head = false) {
  if (room.state !== 'playing') return;
  if (!victim || !victim.alive || !attacker || !attacker.alive) return;
  // TDM: sem fogo amigo (aliados não se ferem)
  if (room.settings.gm === 'tdm' && attacker !== victim && attacker.team === victim.team) return;
  victim.hp -= dmg;
  if (victim.hp > 0) {
    broadcastRoom(room, { t: 'dmg', id: victim.id, hp: victim.hp, by: attacker.id });
    return;
  }
  victim.hp = 0;
  victim.alive = false;
  victim.deaths++;
  if (attacker !== victim) attacker.kills++;
  broadcastRoom(room, { t: 'dmg', id: victim.id, hp: 0, by: attacker.id });
  broadcastRoom(room, { t: 'die', id: victim.id, by: attacker.id, kk: attacker.kills, vd: victim.deaths, h: head });

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

  wss.on('connection', (ws, req) => {
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
          broadcastRoom(room, { t: 'fire', id: self.id, o: msg.o, d: msg.d, w: msg.w }, self.id);
          break;
        case 'hit': {
          const victim = room.players.get(msg.id);
          const dmg = Math.min(200, Math.max(1, +msg.dmg || 0));
          damage(room, self, victim, dmg, !!msg.h);
          break;
        }
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
        state[p.id] = [
          +p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2),
          +p.yaw.toFixed(3), +p.pitch.toFixed(3), p.anim, p.hp
        ];
      }
      broadcastRoom(room, {
        t: 's', p: state,
        tl: room.state === 'playing' ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : 0,
        ts: room.settings.gm === 'tdm' ? teamScores(room) : undefined
      });
    }
  }, TICK_MS);
}
