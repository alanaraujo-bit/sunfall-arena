// ============================================================
// SUNFALL ARENA — salas (rooms): públicas com matchmaking simples
// e personalizadas com código. Cada sala tem jogadores, bots,
// placar e cronômetro de partida próprios.
// ============================================================
import { getMap, DEFAULT_MAP, MAPS } from '../../shared/maps/index.js';
import { makeBot } from './bots.js';
import { awardWin, persistMatchPlayed } from './stats.js';
import { NADE_COUNT_START, SMOKE_COUNT_START } from './grenades.js';
import { initBarrels } from './barrels.js';
import { initHighlights } from './highlights.js';

export const COLORS = ['#3fc8b4', '#f0844c', '#b07ce0', '#8ac850', '#e86a9c', '#f0c04c', '#5c9ce8', '#e05c50'];

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GAME_MODES = ['ffa', 'tdm'];
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
  const mapKey = settings.map && getMap(settings.map).KEY === settings.map ? settings.map : DEFAULT_MAP;
  const room = {
    code: makeCode(),
    mode,                        // 'public' | 'custom'
    settings,                    // { gm, bots, kl, tl, map }  (gm: 'ffa'|'tdm')
    mapKey,
    map: getMap(mapKey),         // dados do mapa da sala (BOUNDS/SPAWNS/PATROL/…)
    hostAccountId,
    players: new Map(),
    grenades: new Map(),
    smokes: new Map(),
    barrels: null,               // preenchido abaixo (precisa do map)
    ...initHighlights(),
    colorIdx: 0,
    state: 'playing',
    endsAt: Date.now() + settings.tl,
    resetTimer: null
  };
  room.barrels = initBarrels(room.map);
  rooms.set(room.code, room);
  return room;
}

export function findOrCreatePublic(mapKey) {
  const key = MAPS[mapKey] ? mapKey : DEFAULT_MAP;
  for (const room of rooms.values()) {
    if (room.mode === 'public' && room.mapKey === key && realCount(room) < MAX_REAL) return room;
  }
  return makeRoom('public', { gm: 'ffa', bots: PUBLIC_BOT_TARGET, kl: PUBLIC_KL, tl: PUBLIC_TL, map: key });
}

// Jogadores reais em salas PÚBLICAS agora, por mapa — usado pelo seletor de
// mapa do lobby (o jogador escolhe onde tem gente jogando de verdade, sem
// precisar entrar às cegas). Mapas sem nenhuma sala pública ativa aparecem
// com 0 (não com "sala inexistente" — o jogador pode ser o primeiro).
export function publicRoomCounts() {
  const counts = {};
  for (const key of Object.keys(MAPS)) counts[key] = 0;
  for (const room of rooms.values()) {
    if (room.mode === 'public') counts[room.mapKey] = (counts[room.mapKey] || 0) + realCount(room);
  }
  return counts;
}

export function createCustom({ gm, bots, kl, tl, map }, hostAccountId) {
  const mode = GAME_MODES.includes(gm) ? gm : 'ffa';
  return makeRoom('custom', { gm: mode, bots, kl, tl, map }, hostAccountId);
}

// menor equipe (empate -> 0). Considera todos (reais + bots).
export function assignTeam(room) {
  let t0 = 0, t1 = 0;
  for (const p of room.players.values()) {
    if (p.team === 0) t0++; else if (p.team === 1) t1++;
  }
  return t0 <= t1 ? 0 : 1;
}

export function teamScores(room) {
  const s = [0, 0];
  for (const p of room.players.values()) {
    if (p.team === 0 || p.team === 1) s[p.team] += p.kills;
  }
  return s;
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
  // spawn mais distante dos inimigos vivos da sala — formato [x, z, y?]
  const spawns = room.map.SPAWNS;
  let best = spawns[0], bestD = -1;
  for (const s of spawns) {
    let minD = Infinity;
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      const d = (p.pos.x - s[0]) ** 2 + (p.pos.z - s[1]) ** 2;
      if (d < minD) minD = d;
    }
    if (minD > bestD) { bestD = minD; best = s; }
  }
  return { x: best[0], y: best[2] || 0, z: best[1] };
}

export function snapshot(p) {
  return {
    id: p.id, name: p.name, color: p.color, bot: !!p.bot,
    team: p.team ?? null,
    pos: [p.pos.x, p.pos.y, p.pos.z], hp: p.hp, k: p.kills, d: p.deaths,
    nades: p.nades || 0, smokes: p.smokes || 0
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

export function endMatch(room, winner = null, winTeam = null) {
  if (room.state !== 'playing') return;
  room.state = 'ended';

  const tdm = room.settings.gm === 'tdm';

  if (tdm) {
    if (winTeam === null) {
      // fim por tempo: time com mais kills (empate -> null)
      const [a, b] = teamScores(room);
      winTeam = a === b ? null : (a > b ? 0 : 1);
    }
  } else if (!winner) {
    // fim por tempo: líder em kills, desempate por menos mortes
    for (const p of room.players.values()) {
      if (!winner || p.kills > winner.kills || (p.kills === winner.kills && p.deaths < winner.deaths)) winner = p;
    }
  }

  broadcastRoom(room, {
    t: 'end',
    gm: room.settings.gm,
    winId: !tdm && winner ? winner.id : null,
    winTeam: tdm ? winTeam : null,
    teamScores: tdm ? teamScores(room) : null,
    board: boardOf(room),
    next: RESTART_DELAY / 1000,
    bestMoment: room.bestMoment
  });

  for (const p of room.players.values()) {
    if (!p.accountId) continue;
    persistMatchPlayed(p.accountId).catch(err => console.error('[stats] match persist failed', err));
    const won = tdm ? (winTeam !== null && p.team === winTeam) : (winner && p.id === winner.id);
    if (won) awardWin(p.accountId).catch(err => console.error('[stats] win persist failed', err));
  }

  room.resetTimer = setTimeout(() => {
    if (rooms.has(room.code)) resetMatch(room);
  }, RESTART_DELAY);
}

export function resetMatch(room) {
  room.state = 'playing';
  room.endsAt = Date.now() + room.settings.tl;
  room.grenades.clear();
  room.smokes.clear();
  room.barrels = initBarrels(room.map);
  Object.assign(room, initHighlights());
  for (const p of room.players.values()) {
    p.kills = 0; p.deaths = 0;
    p.hp = 100; p.alive = true;
    p.nades = NADE_COUNT_START;
    p.smokes = SMOKE_COUNT_START;
    p.pos = spawnPos(room);
  }
  broadcastRoom(room, {
    t: 'restart',
    end: room.endsAt,
    players: [...room.players.values()].map(snapshot)
  });
}
