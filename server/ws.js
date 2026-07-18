// ============================================================
// SUNFALL ARENA — WebSocket: presença (hello), salas (play/leave),
// convites e combate autoritativo com partidas que terminam.
// ============================================================
import { WebSocketServer } from 'ws';
import { PLAYER, rayBox, raycastSolids, BARREL_DMG_RADIUS } from '../shared/mapdata.js';
import {
  rooms, findOrCreatePublic, createCustom, getByCode, realCount, MAX_REAL,
  nextPlayerId, nextColor, spawnPos, snapshot, broadcastRoom,
  adjustBots, removePlayer, endMatch, assignTeam, teamScores
} from './game/rooms.js';
import { updateBot } from './game/bots.js';
import {
  NADE_COUNT_START, SMOKE_COUNT_START, NADE_THROW_COOLDOWN_MS, SMOKE_LIFE_MS,
  throwGrenade, updateGrenades, explodeGrenade, deploySmoke, updateSmokes
} from './game/grenades.js';
import { barrelBounds, damageBarrel } from './game/barrels.js';
import { awardXpAndPersist, persistDeath, loadProfileForJoin } from './game/stats.js';
import { verifyToken } from './auth.js';
import { setPresence, clearPresence, getPresence } from './presence.js';
import { query } from './db.js';

// ---------------- Armas (fonte da verdade — o cliente não decide dano) ----------------
const WEAPONS = [
  { dmg: 16, head: 1.75, int: 0.115 },   // FALCÃO-9
  { dmg: 92, head: 2, int: 1.05 }        // FERRÃO-SR
];
// Faca (índice 2). Alcance/cone ligeiramente mais generosos que a previsão do
// cliente para nunca rejeitar um golpe que o atirador viu conectar.
// arc = cosseno do meio-ângulo do cone frontal aceito.
const KNIFE = [
  { dmg: 55, range: 2.7, arc: 0.5,  cd: 0.5 },   // leve (corte)
  { dmg: 80, range: 3.1, arc: 0.45, cd: 0.85 }   // pesado (estocada)
];
const BACKSTAB_DMG = 200;   // pelas costas: eliminação garantida
const REWIND_MAX_MS = 1000;
const KIT_STREAK = 3;     // kills seguidas (sem morrer) para ganhar 1 kit
const KIT_MAX = 2;        // cargas de kit acumuláveis
const KIT_HEAL = 50;      // vida restaurada por uso
const KIT_USE_MS = 1000;  // tempo de canalização
const RESPAWN_MIN_MS = 500;       // tempo mínimo morto antes de poder renascer (evita abuso)
const RESPAWN_FAILSAFE_MS = 5000; // renascimento automático caso o cliente nunca peça (saiu/ocioso)

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

// Renasce o jogador na hora (chamado pelo pedido do cliente ou pelo failsafe).
// Autoritativo: o servidor decide a posição e só renasce quem está de fato morto.
function respawnPlayer(room, victim) {
  clearTimeout(victim.respawnTimer);
  victim.respawnTimer = null;
  if (!rooms.has(room.code) || room.state !== 'playing') return;
  if (!room.players.has(victim.id) || victim.alive) return;
  victim.pos = spawnPos(room);
  victim.hp = 100;
  victim.alive = true;
  victim.nades = NADE_COUNT_START;
  victim.smokes = SMOKE_COUNT_START;
  broadcastRoom(room, {
    t: 'spawn', id: victim.id, pos: [victim.pos.x, victim.pos.y, victim.pos.z],
    nades: victim.nades, smokes: victim.smokes
  });
}

function damage(room, attacker, victim, dmg, head = false, wi = 0, bs = false, requireAttackerAlive = true) {
  if (room.state !== 'playing') return;
  if (!victim || !victim.alive || !attacker || (requireAttackerAlive && !attacker.alive)) return;
  // TDM: sem fogo amigo (aliados não se ferem)
  if (room.settings.gm === 'tdm' && attacker !== victim && attacker.team === victim.team) return;
  victim.hp -= dmg;
  if (victim.hp > 0) {
    broadcastRoom(room, { t: 'dmg', id: victim.id, hp: victim.hp, by: attacker.id, h: head, bs, w: wi, dmg });
    return;
  }
  victim.hp = 0;
  victim.alive = false;
  victim.deaths++;
  victim.streak = 0;
  if (attacker !== victim) {
    attacker.kills++;
    attacker.streak = (attacker.streak || 0) + 1;
    if (attacker.streak % KIT_STREAK === 0 && (attacker.kits || 0) < KIT_MAX) {
      attacker.kits = (attacker.kits || 0) + 1;
      if (attacker.ws && attacker.ws.readyState === 1) {
        attacker.ws.send(JSON.stringify({ t: 'kit', n: attacker.kits }));
      }
    }
  }
  broadcastRoom(room, { t: 'dmg', id: victim.id, hp: 0, by: attacker.id, h: head, bs, w: wi, dmg });
  broadcastRoom(room, { t: 'die', id: victim.id, by: attacker.id, kk: attacker.kills, vd: victim.deaths, h: head, w: wi, bs });

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

  // Renascimento sob demanda: o cliente controla o momento (após o killcam ou
  // ao apertar F). O servidor só mantém um failsafe caso o pedido nunca chegue.
  victim.deadAt = Date.now();
  clearTimeout(victim.respawnTimer);
  victim.respawnTimer = setTimeout(() => respawnPlayer(room, victim), RESPAWN_FAILSAFE_MS);
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
        hp: 100, kills: 0, deaths: 0, streak: 0, kits: 0, healingKit: false,
        nades: NADE_COUNT_START, smokes: SMOKE_COUNT_START,
        alive: true, bot: false, ws
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
        players: [...room.players.values()].map(snapshot),
        deadBarrels: room.barrels.filter(b => !b.alive).map(b => b.id)
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
          self.streak = 0;
          self.alive = false;
          broadcastRoom(room, { t: 'teamchg', id: self.id, team: wanted });
          setTimeout(() => {
            if (!rooms.has(room.code) || !room.players.has(self.id)) return;
            self.pos = spawnPos(room);
            self.hp = 100;
            self.alive = true;
            self.nades = NADE_COUNT_START;
            self.smokes = SMOKE_COUNT_START;
            broadcastRoom(room, {
              t: 'spawn', id: self.id, pos: [self.pos.x, self.pos.y, self.pos.z],
              nades: self.nades, smokes: self.smokes
            });
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
        case 'respawn': {
          // Pedido de renascimento (fim do killcam ou tecla F). Só vale se está
          // morto; respeita o tempo mínimo para não virar teleporte instantâneo.
          if (self.alive || room.state !== 'playing') break;
          const waited = Date.now() - (self.deadAt || 0);
          if (waited >= RESPAWN_MIN_MS) {
            respawnPlayer(room, self);
          } else {
            clearTimeout(self.respawnTimer);
            self.respawnTimer = setTimeout(() => respawnPlayer(room, self), RESPAWN_MIN_MS - waited);
          }
          break;
        }
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
        case 'usekit': {
          if (!self.alive || room.state !== 'playing') break;
          if (!self.kits || self.healingKit) break;
          self.kits--;
          self.healingKit = true;
          const p = self, r = room;
          setTimeout(() => {
            p.healingKit = false;
            if (!rooms.has(r.code) || !r.players.has(p.id) || !p.alive) return;
            p.hp = Math.min(100, p.hp + KIT_HEAL);
            send({ t: 'heal', id: p.id, hp: p.hp });
          }, KIT_USE_MS);
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
          } else {
            // ninguém no meio da bala — ela pode ter parado num barril vivo
            let barrelHit = null, barrelT = hitT;
            for (const b of room.barrels) {
              if (!b.alive) continue;
              const t = rayBox(ox, oy, oz, dx, dy, dz, barrelBounds(b));
              if (t < barrelT) { barrelT = t; barrelHit = b; }
            }
            if (barrelHit) {
              const res = damageBarrel(room, barrelHit, w.dmg, self, room.players, damage);
              if (res) broadcastRoom(room, { t: 'barrelboom', id: res.id, x: res.x, y: res.y, z: res.z });
            }
          }
          break;
        }
        case 'melee': {
          // Ataque corpo a corpo autoritativo: valida cadência e origem,
          // rebobina o alvo, exige alcance curto + cone frontal + LOS livre.
          if (!self.alive || room.state !== 'playing') break;
          const heavy = msg.h ? 1 : 0;
          const km = KNIFE[heavy];
          const now = Date.now();
          self.lastMelee = self.lastMelee || 0;
          if (now - self.lastMelee < km.cd * 1000 * 0.85) break;   // cadência da faca
          self.lastMelee = now;

          if (!Array.isArray(msg.o) || !Array.isArray(msg.d)) break;
          const ox = +msg.o[0], oy = +msg.o[1], oz = +msg.o[2];
          let dx = +msg.d[0], dy = +msg.d[1], dz = +msg.d[2];
          const dl = Math.hypot(dx, dy, dz);
          if (!(dl > 0.5 && dl < 2)) break;
          dx /= dl; dy /= dl; dz /= dl;
          if (Math.hypot(ox - self.pos.x, oz - self.pos.z) > 3 ||
              Math.abs(oy - (self.pos.y + PLAYER.EYE)) > 2) break;

          broadcastRoom(room, { t: 'melee', id: self.id, o: [ox, oy, oz], d: [dx, dy, dz], h: heavy }, self.id);

          const sv = Math.min(now, Math.max(now - REWIND_MAX_MS, +msg.sv || now));
          let victim = null, bestD = km.range;
          for (const p of room.players.values()) {
            if (p === self || !p.alive) continue;
            if (room.settings.gm === 'tdm' && p.team === self.team) continue;
            const rp = rewindPos(p, sv);
            const cx = rp.x - ox, cy = (rp.y + PLAYER.BODY_H * 0.5) - oy, cz = rp.z - oz;
            const d = Math.hypot(cx, cy, cz);
            if (d > km.range || d < 0.001) continue;
            if ((cx * dx + cy * dy + cz * dz) / d < km.arc) continue;        // fora do cone
            if (raycastSolids(ox, oy, oz, cx / d, cy / d, cz / d) < d - 0.4) continue; // parede no meio
            if (d < bestD) { bestD = d; victim = p; }
          }
          if (victim) {
            // backstab: vítima de costas para o atacante → letal
            const fx = -Math.sin(victim.yaw), fz = -Math.cos(victim.yaw);
            let ax = victim.pos.x - self.pos.x, az = victim.pos.z - self.pos.z;
            const al = Math.hypot(ax, az) || 1;
            const backstab = (fx * (ax / al) + fz * (az / al)) > 0.5;
            damage(room, self, victim, backstab ? BACKSTAB_DMG : km.dmg, false, 2, backstab);
          }
          break;
        }
        case 'nade': {
          // Lançamento de granada (frag ou fumaça): física e efeito são 100%
          // do servidor (ver server/game/grenades.js); o cliente só prevê.
          if (!self.alive || room.state !== 'playing') break;
          const kind = msg.kind === 'smoke' ? 'smoke' : 'frag';
          const field = kind === 'smoke' ? 'smokes' : 'nades';
          if (!self[field] || self[field] <= 0) break;
          const now = Date.now();
          if (now - (self.lastThrow || 0) < NADE_THROW_COOLDOWN_MS) break;   // cadência única p/ os dois tipos

          if (!Array.isArray(msg.o) || !Array.isArray(msg.d)) break;
          const ox = +msg.o[0], oy = +msg.o[1], oz = +msg.o[2];
          let dx = +msg.d[0], dy = +msg.d[1], dz = +msg.d[2];
          const dl = Math.hypot(dx, dy, dz);
          if (!(dl > 0.5 && dl < 2)) break;
          dx /= dl; dy /= dl; dz /= dl;
          if (Math.hypot(ox - self.pos.x, oz - self.pos.z) > 3 ||
              Math.abs(oy - (self.pos.y + PLAYER.EYE)) > 2) break;
          const pw = Math.max(0, Math.min(1, +msg.pw || 0));

          self.lastThrow = now;
          self[field]--;
          const nade = throwGrenade(room, self, { x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz }, pw, kind);
          // id + kind: o cliente "adota" o mesh previsto sob este id real; os
          // outros clientes aprendem o tipo para desenhar o modelo certo em voo
          send({ t: 'nc', kind, n: self[field], id: nade.id });
          broadcastRoom(room, { t: 'ng', id: nade.id, kind }, self.id);
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

      // física das granadas continua mesmo pós-fim de partida (uma granada já
      // no ar não "congela" no ar); damage() se auto-bloqueia fora de 'playing'
      const { bounces, explosions, smokeDeploys } = updateGrenades(room, TICK_DT, now);
      for (const nade of bounces) {
        broadcastRoom(room, {
          t: 'nb', id: nade.id, o: [+nade.pos.x.toFixed(2), +nade.pos.y.toFixed(2), +nade.pos.z.toFixed(2)]
        });
      }
      for (const nade of explosions) {
        broadcastRoom(room, {
          t: 'nadeboom', id: nade.id, o: [+nade.pos.x.toFixed(2), +nade.pos.y.toFixed(2), +nade.pos.z.toFixed(2)]
        });
        explodeGrenade(room, nade, room.players, damage);
        // reação em cadeia: granada perto o bastante detona um barril vivo
        const thrower = room.players.get(nade.ownerId);
        if (thrower) {
          for (const b of room.barrels) {
            if (!b.alive) continue;
            const dist = Math.hypot(b.x - nade.pos.x, b.z - nade.pos.z);
            if (dist > BARREL_DMG_RADIUS) continue;
            const res = damageBarrel(room, b, 9999, thrower, room.players, damage);
            if (res) broadcastRoom(room, { t: 'barrelboom', id: res.id, x: res.x, y: res.y, z: res.z });
          }
        }
      }
      for (const nade of smokeDeploys) {
        const s = deploySmoke(room, nade, now);
        broadcastRoom(room, {
          t: 'smokestart', id: s.id, o: [+s.pos.x.toFixed(2), +s.pos.y.toFixed(2), +s.pos.z.toFixed(2)], dur: SMOKE_LIFE_MS
        });
      }
      const expiredSmokes = updateSmokes(room, now);
      if (expiredSmokes) for (const id of expiredSmokes) broadcastRoom(room, { t: 'smokeend', id });

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
      const nstate = {};
      for (const nade of room.grenades.values()) {
        nstate[nade.id] = [+nade.pos.x.toFixed(2), +nade.pos.y.toFixed(2), +nade.pos.z.toFixed(2)];
      }
      broadcastRoom(room, {
        t: 's', p: state, n: nstate, sv: now,
        tl: room.state === 'playing' ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : 0,
        ts: room.settings.gm === 'tdm' ? teamScores(room) : undefined
      });
    }
  }, TICK_MS);
}
