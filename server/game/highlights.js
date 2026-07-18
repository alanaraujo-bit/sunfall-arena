// ============================================================
// SUNFALL ARENA — "melhor momento" da partida (servidor autoritativo)
// Grava um buffer rolante de posições (mesmo formato do broadcast 's') e de
// tiros (mesmo formato do broadcast 'fire') por sala. Quando alguém fecha um
// multi-kill (kills dentro da mesma janela de tempo do HUD client-side) que
// bate o recorde da partida, recorta esse buffer e guarda em room.bestMoment
// — pronto pra ser transmitido a todo mundo no fim da partida e reproduzido
// como um killcam, só que de uma jogada de qualquer jogador, não a sua morte.
// ============================================================

const REPLAY_BUF_MS = 13000;   // retenção do buffer rolante (cobre até um quad-kill lento)
const MULTI_KILL_WINDOW_MS = 4000;   // mesma janela do HUD client-side (MULTI_KILL_WINDOW)
const LEAD_IN_MS = 1500;    // quanto do passado antes do 1º abate entra no replay
// SEM padding depois do último abate: a captura é síncrona (dentro de damage(),
// no mesmo instante do abate que fecha a partida) — frames "futuros" ainda
// nem existem no buffer. O cliente segura no último quadro sozinho (mesma
// pausa client-side que o killcam pessoal já faz, sem precisar de mais dados).

export function initHighlights() {
  return { replayBuf: [], fireBuf: [], killWindow: new Map(), bestMoment: null };
}

// chamada todo tick, com o mesmo objeto `state` que vai no broadcast 's'
export function recordFrame(room, sv, state) {
  const buf = room.replayBuf;
  buf.push({ sv, p: state });
  const cutoff = sv - REPLAY_BUF_MS;
  while (buf.length && buf[0].sv < cutoff) buf.shift();
}

// chamada toda vez que um 'fire' é validado e transmitido
export function recordFire(room, wall, id, o, d, w) {
  const buf = room.fireBuf;
  buf.push({ wall, id, o, d, w });
  const cutoff = wall - REPLAY_BUF_MS;
  while (buf.length && buf[0].wall < cutoff) buf.shift();
}

// chamada no momento em que um abate é confirmado (dentro de damage(), só no
// branch letal). Atualiza a sequência de multi-kill do atacante e, se for um
// novo recorde da partida (>=2 abates e maior que o atual bestMoment), recorta
// o buffer rolante e grava room.bestMoment.
export function registerKill(room, attacker, victim, head, wi, bs) {
  const now = Date.now();
  const kw = room.killWindow;
  const prev = kw.get(attacker.id);
  const within = prev && (now - prev.lastAt) <= MULTI_KILL_WINDOW_MS;
  const kills = within ? prev.kills : [];
  kills.push({ victimId: victim.id, atSv: now, head: !!head, w: wi, bs: !!bs });
  kw.set(attacker.id, { lastAt: now, kills });

  const bestN = room.bestMoment ? room.bestMoment.kills.length : 0;
  if (kills.length >= 2 && kills.length > bestN) {
    captureBestMoment(room, attacker.id, kills);
  }
}

function captureBestMoment(room, killerId, kills) {
  const firstAt = kills[0].atSv, lastAt = kills[kills.length - 1].atSv;
  const winStart = firstAt - LEAD_IN_MS, winEnd = lastAt;
  const ids = new Set([killerId, ...kills.map(k => k.victimId)]);

  const frames = room.replayBuf
    .filter(f => f.sv >= winStart - 200 && f.sv <= winEnd)
    .map(f => {
      const p = {};
      for (const id of ids) if (f.p[id]) p[id] = f.p[id];
      return { sv: f.sv, p };
    });
  // histórico curto demais (streak logo no início da sala, buffer ainda vazio) — ignora
  if (frames.length < 3) return;

  const shots = room.fireBuf
    .filter(f => f.id === killerId && f.wall >= winStart - 300 && f.wall <= winEnd + 60)
    .map(f => ({ wall: f.wall, o: f.o, d: f.d, w: f.w }));

  room.bestMoment = {
    killerId,
    kills: kills.map(k => ({ ...k })),
    frames, shots,
    startSv: winStart, endSv: winEnd
  };
}
