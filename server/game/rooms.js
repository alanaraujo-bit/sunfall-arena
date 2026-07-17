// ============================================================
// SUNFALL ARENA — salas (rooms): públicas com matchmaking simples
// e personalizadas com código. Cada sala tem jogadores, bots,
// placar e cronômetro de partida próprios.
// ============================================================
import { SPAWNS } from '../../shared/mapdata.js';
import { makeBot } from './bots.js';
import { awardWin, persistMatchPlayed } from './stats.js';

export const COLORS = ['#3fc8b4', '#f0844c', '#b07ce0', '#8ac850', '#e86a9c', '#f0c04c', '#5c9ce8', '#e05c50'];

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PUBLIC_KL = 30;
const PUBLIC_TL = 10 * 60 * 1000;
const PUBLIC_BOT_TARGET = 4;   // bots = max(0, 4 - jogadores reais)
export const MAX_REAL = 8;
const RESTART_DELAY = 10_000;

export const rooms = new Map(); // code -> Room

let nextId = 1;
export function nextPlayerId() { return nextId++; }

function makeCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    if (!rooms.has(c)) return c;
  }
}

function makeRoom(mode, settings, hostAccountId = null) {
  const room = {
    code: makeCode(),
    mode,                        // 'public' | 'custom'
    settings,                    // { bots, kl, tl }  (bots: alvo fixo em custom; dinâmico em public)
    hostAccountId,
    players: new Map(),
    colorIdx: 0,
    state: 'playing',
    endsAt: Date.now() + settings.tl,
    resetTimer: null
  };
  rooms.set(room.code, room);
  return room;
}

export function findOrCreatePublic() {
  for (const room of rooms.values()) {
    if (room.mode === 'public' && realCount(room) < MAX_REAL) return room;
  }
  return makeRoom('public', { bots: PUBLIC_BOT_TARGET, kl: PUBLIC_KL, tl: PUBLIC_TL });
}

export function createCustom({ bots, kl, tl }, hostAccountId) {
  return makeRoom('custom', { bots, kl, tl }, hostAccountId);
}

export function getByCode(code) {
  return rooms.get(String(code || '').toUpperCase().trim()) || null;
}

export function realCount(room) {
  let n = 0;
  for (const p of room.players.values()) if (!p.bot) n++;
  return n;
}

export function nextColor(room) {
  return COLORS[room.colorIdx++ % COLORS.length];
}

export function spawnPos(room) {
  // spawn mais distante dos inimigos vivos da sala
  let best = SPAWNS[0], bestD = -1;
  for (const [sx, sz] of SPAWNS) {
    let minD = Infinity;
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      const d = (p.pos.x - sx) ** 2 + (p.pos.z - sz) ** 2;
      if (d < minD) minD = d;
    }
    if (minD > bestD) { bestD = minD; best = [sx, sz]; }
  }
  return { x: best[0], y: 0, z: best[1] };
}

export function snapshot(p) {
  return {
    id: p.id, name: p.name, color: p.color, bot: !!p.bot,
    pos: [p.pos.x, p.pos.y, p.pos.z], hp: p.hp, k: p.kills, d: p.deaths
  };
}

export function broadcastRoom(room, obj, exceptId = null) {
  const raw = JSON.stringify(obj);
  for (const p of room.players.values()) {
    if (p.ws && p.id !== exceptId && p.ws.readyState === 1) p.ws.send(raw);
  }
}

// Mantém a quantidade de bots da sala no alvo (públicas: alvo dinâmico)
export function adjustBots(room) {
  const target = room.mode === 'public'
    ? Math.max(0, PUBLIC_BOT_TARGET - realCount(room))
    : room.settings.bots;

  const bots = [...room.players.values()].filter(p => p.bot);
  while (bots.length < target) {
    const bot = makeBot(room);
    room.players.set(bot.id, bot);
    bots.push(bot);
    broadcastRoom(room, { t: 'j', p: snapshot(bot) });
  }
  while (bots.length > target) {
    const bot = bots.pop();
    room.players.delete(bot.id);
    broadcastRoom(room, { t: 'l', id: bot.id });
  }
}

export function removePlayer(room, player) {
  if (!room.players.has(player.id)) return;
  room.players.delete(player.id);
  broadcastRoom(room, { t: 'l', id: player.id });
  if (realCount(room) === 0) {
    destroyRoom(room);
  } else if (room.mode === 'public') {
    adjustBots(room);
  }
}

export function destroyRoom(room) {
  if (room.resetTimer) clearTimeout(room.resetTimer);
  rooms.delete(room.code);
}

function boardOf(room) {
  return [...room.players.values()]
    .map(snapshot)
    .sort((a, b) => b.k - a.k || a.d - b.d);
}

export function endMatch(room, winner = null) {
  if (room.state !== 'playing') return;
  room.state = 'ended';

  if (!winner) {
    // fim por tempo: líder em kills, desempate por menos mortes
    for (const p of room.players.values()) {
      if (!winner || p.kills > winner.kills || (p.kills === winner.kills && p.deaths < winner.deaths)) winner = p;
    }
  }

  broadcastRoom(room, {
    t: 'end',
    winId: winner ? winner.id : null,
    board: boardOf(room),
    next: RESTART_DELAY / 1000
  });

  for (const p of room.players.values()) {
    if (!p.accountId) continue;
    persistMatchPlayed(p.accountId).catch(err => console.error('[stats] match persist failed', err));
    if (winner && p.id === winner.id) {
      awardWin(p.accountId).catch(err => console.error('[stats] win persist failed', err));
    }
  }

  room.resetTimer = setTimeout(() => {
    if (rooms.has(room.code)) resetMatch(room);
  }, RESTART_DELAY);
}

export function resetMatch(room) {
  room.state = 'playing';
  room.endsAt = Date.now() + room.settings.tl;
  for (const p of room.players.values()) {
    p.kills = 0; p.deaths = 0;
    p.hp = 100; p.alive = true;
    p.pos = spawnPos(room);
  }
  broadcastRoom(room, {
    t: 'restart',
    end: room.endsAt,
    players: [...room.players.values()].map(snapshot)
  });
}
