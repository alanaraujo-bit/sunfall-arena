// ============================================================
// SUNFALL ARENA — WebSocket: join (conta/convidado), sync, combate
// ============================================================
import { WebSocketServer } from 'ws';
import { players, spawnPos, nextPlayerId, nextColor, snapshot, broadcast } from './game/state.js';
import { spawnBots, updateBot, BOT_COUNT } from './game/bots.js';
import { awardXpAndPersist, persistDeath, loadProfileForJoin, markMatchStart } from './game/stats.js';
import { verifyToken } from './auth.js';

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

  if (attacker !== victim && attacker.accountId) {
    awardXpAndPersist(attacker.accountId, { headshot: head })
      .catch(err => console.error('[xp] award failed for', attacker.accountId, err));
  }
  if (victim.accountId) {
    persistDeath(victim.accountId)
      .catch(err => console.error('[stats] death persist failed for', victim.accountId, err));
  }

  setTimeout(() => {
    if (!players.has(victim.id)) return;
    victim.pos = spawnPos();
    victim.hp = 100;
    victim.alive = true;
    broadcast({ t: 'spawn', id: victim.id, pos: [victim.pos.x, victim.pos.y, victim.pos.z] });
  }, 2600);
}

export function attachWs(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    if (process.env.NODE_ENV === 'production') {
      const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
      const origin = req.headers.origin;
      if (allowed.length && !allowed.includes(origin)) { ws.close(1008, 'origin not allowed'); return; }
    }

    let self = null;

    ws.on('message', async raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.t === 'join' && !self) {
        let accountId = null, displayName, persistedColor = null;

        if (msg.token) {
          const claims = verifyToken(msg.token);
          if (claims) {
            const profile = await loadProfileForJoin(claims.sub).catch(() => null);
            if (profile) {
              accountId = claims.sub;
              displayName = profile.username;
              persistedColor = profile.color;
            }
          }
        }
        if (!accountId) {
          displayName = String(msg.name || 'Recruta').slice(0, 14);
        }

        self = {
          id: nextPlayerId(),
          accountId,
          name: displayName,
          color: persistedColor || nextColor(),
          pos: spawnPos(), yaw: 0, pitch: 0, anim: 0,
          hp: 100, kills: 0, deaths: 0, alive: true, bot: false, ws
        };
        players.set(self.id, self);
        ws.send(JSON.stringify({
          t: 'init', id: self.id,
          players: [...players.values()].map(snapshot)
        }));
        broadcast({ t: 'j', p: snapshot(self) }, self.id);
        console.log(`+ ${self.name} (#${self.id}${accountId ? ', conta' : ', convidado'}) entrou — ${players.size} na arena`);

        if (accountId) markMatchStart(accountId).catch(() => {});
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

  return wss;
}

export function startGameLoop() {
  spawnBots();

  setInterval(() => {
    const dt = 1 / 15;
    for (const p of players.values()) if (p.bot) updateBot(p, dt, damage);

    const state = {};
    for (const p of players.values()) {
      state[p.id] = [
        +p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2),
        +p.yaw.toFixed(3), +p.pitch.toFixed(3), p.anim, p.hp
      ];
    }
    broadcast({ t: 's', p: state });
  }, 66);
}
