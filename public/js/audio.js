// ============================================================
// SFX 100% procedural via WebAudio — sem arquivos de áudio.
// ============================================================
let AC = null, master = null, noiseBuf = null;
let volume = 0.5;

// Exporta o AudioContext para o player de música (compartilha o mesmo contexto)
export function getAudioContext() { return AC; }

function ensure() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = volume;
    master.connect(AC.destination);
    // buffer de ruído branco reutilizável
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
}

function noise(dur, vol, fStart, fEnd, type = 'lowpass', delay = 0) {
  const src = AC.createBufferSource();
  src.buffer = noiseBuf;
  const t0 = AC.currentTime + delay;
  const f = AC.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(fStart, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), t0 + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur);
}

function tone(freq, dur, vol, type = 'sine', slideTo = null, delay = 0) {
  const o = AC.createOscillator();
  o.type = type;
  const t0 = AC.currentTime + delay;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export const SFX = {
  unlock() { ensure(); },

  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  },

  // Tiros em camadas: transiente mecânico + corpo + soco grave (+ eco no sniper).
  // `v` varia o timbre por disparo (rajada não soa metralhadora de brinquedo);
  // `muf` abafa os agudos com a distância (vol < 1 = tiro de outro jogador longe).
  shot(sniper = false, vol = 1) {
    ensure();
    const v = 0.94 + Math.random() * 0.12;
    const muf = 0.45 + 0.55 * Math.min(1, vol);
    if (sniper) {
      // FERRÃO-SR: estalo seco de ferrolho + corpo grave longo + eco duplo
      if (vol > 0.35) noise(0.035, 0.5 * vol, 6000, 2500, 'highpass');
      noise(0.34, 0.55 * vol, 1500 * v * muf, 90);
      tone(118 * v, 0.28, 0.42 * vol, 'square', 36);
      tone(57, 0.42, 0.4 * vol, 'sine', 24);
      noise(0.22, 0.16 * vol, 900 * muf, 140, 'lowpass', 0.1);
      noise(0.3, 0.09 * vol, 600 * muf, 90, 'lowpass', 0.22);
    } else {
      // FALCÃO-9: clique do mecanismo + corpo médio + soco curto no grave
      if (vol > 0.35) noise(0.018, 0.3 * vol, 5200, 3000, 'highpass');
      noise(0.11, 0.44 * vol, 2800 * v * muf, 420);
      tone(160 * v, 0.075, 0.3 * vol, 'square', 78);
      tone(86 * v, 0.1, 0.26 * vol, 'sine', 46);
    }
  },

  // ---- Faca ----
  // corte no ar: sopro curto e agudo varrendo grave
  knifeSwing() {
    ensure();
    noise(0.16, 0.28, 5200, 700, 'bandpass');
    tone(520, 0.1, 0.08, 'sine', 180);
  },
  // acerto na carne: impacto abafado + toque metálico
  knifeHit() {
    ensure();
    noise(0.09, 0.32, 1400, 220);
    tone(150, 0.12, 0.32, 'sawtooth', 60);
    tone(1900, 0.05, 0.12, 'triangle', 2600, 0.01);
  },
  // backstab: golpe seco + brilho metálico marcante (recompensa)
  backstab() {
    ensure();
    noise(0.12, 0.4, 1200, 160);
    tone(120, 0.16, 0.4, 'sawtooth', 48);
    tone(1500, 0.09, 0.22, 'triangle', 2400);
    tone(2200, 0.12, 0.16, 'sine', 3000, 0.05);
  },
  // sacar a faca: aço deslizando
  knifeEquip() { ensure(); noise(0.14, 0.16, 3200, 6000, 'highpass'); tone(760, 0.07, 0.09, 'triangle', 1300); },

  // ---- Granada ----
  // puxar o pino: clique metálico curto e seco
  nadePin() { ensure(); noise(0.05, 0.14, 3000, 1800, 'highpass'); tone(900, 0.04, 0.1, 'square'); },
  // arremesso: sopro do braço + liberação
  nadeThrow() { ensure(); noise(0.22, 0.22, 2200, 500, 'bandpass'); tone(200, 0.14, 0.08, 'sine', 90); },
  // quique no chão/parede: tinido metálico curto (volume por distância)
  nadeBounce(vol = 1) { ensure(); tone(1400, 0.05, 0.18 * vol, 'triangle', 700); noise(0.04, 0.1 * vol, 2600, 900); },
  // explosão: estalo agudo inicial + corpo grave + cauda de poeira assentando
  nadeExplode(vol = 1) {
    ensure();
    noise(0.08, 0.5 * vol, 4000, 800, 'bandpass');
    noise(0.55, 0.6 * vol, 900, 70);
    tone(65, 0.5, 0.5 * vol, 'sawtooth', 30);
    tone(38, 0.7, 0.45 * vol, 'sine', 22, 0.02);
    noise(0.9, 0.22 * vol, 300, 60, 'lowpass');
  },
  // confirmação de dano em área (hitmarker de granada)
  nadeHit() { ensure(); tone(600, 0.08, 0.28, 'sawtooth', 1000); tone(300, 0.06, 0.2, 'sine', 700, 0.02); },
  // deploy da fumaça: chiado pressurizado (ruído sustentado que abre e fecha)
  smokeDeploy(vol = 1) {
    ensure();
    noise(1.3, 0.34 * vol, 900, 5200, 'bandpass');   // jato pressurizado subindo
    noise(1.6, 0.2 * vol, 600, 200, 'lowpass');       // corpo grave da nuvem
    tone(220, 0.5, 0.05 * vol, 'sine', 120);
  },

  // acerto no corpo: "thock" de impacto na carne + blip de confirmação
  hit() {
    ensure();
    noise(0.07, 0.28, 1100, 260);
    tone(340, 0.06, 0.2, 'sawtooth', 190);
    tone(880, 0.05, 0.22, 'sine', 1250);
  },
  // headshot: "ding" metálico inconfundível (sino com parciais) + crunch seco
  headshot() {
    ensure();
    noise(0.045, 0.22, 1600, 500);
    tone(1245, 0.14, 0.3, 'triangle', 1180);
    tone(1867, 0.1, 0.16, 'sine', 1780, 0.012);
    tone(2490, 0.16, 0.1, 'sine', 2350, 0.03);
  },
  kill() { ensure(); tone(520, 0.09, 0.3, 'triangle'); tone(780, 0.12, 0.3, 'triangle', null, 0.09); tone(1040, 0.18, 0.28, 'triangle', null, 0.18); },
  hurt() { ensure(); tone(180, 0.14, 0.35, 'sawtooth', 90); noise(0.1, 0.15, 700, 200); },
  die() { ensure(); tone(300, 0.5, 0.3, 'sawtooth', 60); noise(0.4, 0.2, 900, 100); },
  reload() { ensure(); noise(0.05, 0.2, 1800, 1200, 'highpass'); },
  reloadEnd() { ensure(); noise(0.06, 0.25, 2200, 1400, 'highpass'); tone(320, 0.05, 0.15, 'square'); },
  jump() { ensure(); noise(0.08, 0.1, 500, 900, 'bandpass'); },
  land(v = 1) { ensure(); noise(0.12, 0.18 * v, 400, 120); },
  step() { ensure(); noise(0.05, 0.07, 500, 250); },
  swap() { ensure(); noise(0.06, 0.15, 1400, 900, 'highpass'); tone(240, 0.05, 0.1, 'square'); },
  empty() { ensure(); tone(220, 0.05, 0.15, 'square', 180); },
  spawn() { ensure(); tone(420, 0.1, 0.2, 'triangle', 640); tone(840, 0.15, 0.15, 'triangle', null, 0.1); },
  kitReady() { ensure(); tone(660, 0.08, 0.22, 'triangle', 990); tone(990, 0.1, 0.18, 'triangle', null, 0.07); },
  heal() { ensure(); tone(500, 0.12, 0.25, 'sine', 760); tone(760, 0.16, 0.2, 'sine', null, 0.08); },
  multiKill(n) {
    ensure();
    const base = 480 + Math.min(n, 5) * 60;
    tone(base, 0.1, 0.32, 'triangle', base * 1.5);
    tone(base * 1.5, 0.14, 0.3, 'triangle', base * 2, 0.09);
    if (n >= 4) tone(base * 2, 0.18, 0.28, 'triangle', base * 2.6, 0.18);
  }
};
