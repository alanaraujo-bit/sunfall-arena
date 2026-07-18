// ============================================================
// SUNFALL ARENA — física da granada de fragmentação (compartilhada)
// Mesma simulação rodando no servidor (autoritativo) e no cliente
// (previsão local do próprio lançamento + arco de mira) — evita
// divergência entre o que o jogador vê e o que o servidor decide.
// ============================================================
export const NADE = {
  RADIUS: 0.09,
  GRAVITY: 24,          // m/s² — igual ao jogador, mundo consistente
  RESTITUTION: 0.45,    // perde ~55% da velocidade normal a cada quique
  AIR_DRAG: 0.06,
  ROLL_FRICTION: 5.5,
  SETTLE_SPEED: 0.35,
  SPEED_MIN: 9,
  SPEED_MAX: 19,
  FUSE_MS: 1500,       // fuse curto: pega alvo em movimento (2.1s era longo demais)
  COUNT_START: 2,
  DMG_MAX: 110,
  DMG_RADIUS: 6.5      // raio mais generoso — "perto" já machuca
};

// Granada de FUMAÇA (Módulo 03) — mesma física da explosiva; ao final do fuse,
// em vez de explodir, deposita uma nuvem que nega visão por um tempo.
export const SMOKE = {
  FUSE_MS: 1400,        // tempo até depositar a fumaça (deploy onde parou)
  RADIUS: 2.5,          // raio tático: núcleo opaco + bloqueio de visão dos bots
  CENTER_UP: 1.1,       // altura do centro da nuvem acima do ponto de deploy
  DEPLOY_MS: 1100,      // expansão inicial (billowing)
  HOLD_MS: 13000,       // tempo denso
  DISSIPATE_MS: 2800,   // dissipação lenta
  COUNT_START: 1
};
export const SMOKE_LIFE_MS = SMOKE.DEPLOY_MS + SMOKE.HOLD_MS + SMOKE.DISSIPATE_MS;

function blocked(bounds, x, y, z, r) {
  for (const b of bounds) {
    if (x + r > b.minx && x - r < b.maxx &&
        z + r > b.minz && z - r < b.maxz &&
        y + r > b.miny && y - r < b.maxy) return true;
  }
  return false;
}

function moveAxis(nade, axis, delta, bounds) {
  if (!delta) return false;
  const nx = axis === 'x' ? nade.pos.x + delta : nade.pos.x;
  const nz = axis === 'z' ? nade.pos.z + delta : nade.pos.z;
  if (!blocked(bounds, nx, nade.pos.y, nz, NADE.RADIUS)) {
    nade.pos[axis] += delta;
    return false;
  }
  const incoming = nade.vel[axis];
  if (Math.abs(incoming) < 0.15) { nade.vel[axis] = 0; return false; }   // encosta e para, sem tremer
  nade.vel[axis] = -incoming * NADE.RESTITUTION;
  if (axis === 'x') nade.vel.z *= 0.82; else nade.vel.x *= 0.82;
  return Math.abs(incoming) > 0.6;   // só conta como "quique audível" acima do limiar
}

function moveY(nade, delta, bounds) {
  const ny = nade.pos.y + delta;
  nade.grounded = false;
  if (nade.vel.y <= 0) {
    const hitBelow = blocked(bounds, nade.pos.x, ny, nade.pos.z, NADE.RADIUS) || ny - NADE.RADIUS <= 0;
    if (hitBelow) {
      let floor = NADE.RADIUS;
      for (const b of bounds) {
        if (nade.pos.x + NADE.RADIUS > b.minx && nade.pos.x - NADE.RADIUS < b.maxx &&
            nade.pos.z + NADE.RADIUS > b.minz && nade.pos.z - NADE.RADIUS < b.maxz &&
            b.maxy <= nade.pos.y + 0.05 && b.maxy + NADE.RADIUS > floor) floor = b.maxy + NADE.RADIUS;
      }
      nade.pos.y = floor;
      if (nade.vel.y < -NADE.SETTLE_SPEED) { nade.vel.y = -nade.vel.y * NADE.RESTITUTION; return true; }
      nade.vel.y = 0; nade.grounded = true;
      return false;
    }
    nade.pos.y = ny;
    return false;
  }
  if (blocked(bounds, nade.pos.x, ny, nade.pos.z, NADE.RADIUS)) {
    nade.vel.y = -nade.vel.y * NADE.RESTITUTION * 0.6;
    return true;
  }
  nade.pos.y = ny;
  return false;
}

// Avança `nade` ({pos:{x,y,z}, vel:{x,y,z}, grounded}) em `dt` segundos
// contra os `bounds` do mapa. Retorna true se quicou (audivelmente).
export function stepGrenade(nade, dt, bounds) {
  nade.vel.y -= NADE.GRAVITY * dt;
  if (!nade.grounded) {
    const drag = Math.exp(-NADE.AIR_DRAG * dt);
    nade.vel.x *= drag; nade.vel.z *= drag;
  }
  let bounced = false;
  if (moveAxis(nade, 'x', nade.vel.x * dt, bounds)) bounced = true;
  if (moveAxis(nade, 'z', nade.vel.z * dt, bounds)) bounced = true;
  if (moveY(nade, nade.vel.y * dt, bounds)) bounced = true;
  if (nade.grounded) {
    const speed = Math.hypot(nade.vel.x, nade.vel.z);
    if (speed > 0.01) {
      const f = Math.exp(-NADE.ROLL_FRICTION * dt);
      nade.vel.x *= f; nade.vel.z *= f;
    }
  }
  return bounced;
}

// Sub-passos por chamada: em alta velocidade (lançamento forte), um único
// passo de ~33ms pode "atravessar" paredes finas (parapeitos, grades) e o
// quique perde fidelidade. Cliente e servidor chamam sempre esta função —
// nunca stepGrenade() sozinha — para garantir a mesma granularidade dos
// dois lados (previsão do cliente == verdade do servidor).
export function advanceGrenade(nade, dt, bounds, substeps = 4) {
  const sub = dt / substeps;
  let bounced = false;
  for (let i = 0; i < substeps; i++) {
    if (stepGrenade(nade, sub, bounds)) bounced = true;
  }
  return bounced;
}

// Cria o estado inicial de uma granada lançada de `origin` na direção
// `dir` (unitária) com força `power` (0..1).
export function launchGrenade(origin, dir, power) {
  const pw = Math.max(0, Math.min(1, power));
  const speed = NADE.SPEED_MIN + (NADE.SPEED_MAX - NADE.SPEED_MIN) * pw;
  return {
    pos: { x: origin.x, y: origin.y, z: origin.z },
    vel: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
    grounded: false
  };
}
