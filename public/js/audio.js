// ============================================================
// SFX 100% procedural via WebAudio — sem arquivos de áudio.
// ============================================================
let AC = null, master = null, noiseBuf = null;
let volume = 0.5;

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

function noise(dur, vol, fStart, fEnd, type = 'lowpass') {
  const src = AC.createBufferSource();
  src.buffer = noiseBuf;
  const f = AC.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(fStart, AC.currentTime);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), AC.currentTime + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); src.stop(AC.currentTime + dur);
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

  shot(sniper = false, vol = 1) {
    ensure();
    if (sniper) {
      noise(0.3, 0.55 * vol, 3200, 220);
      tone(130, 0.22, 0.4 * vol, 'square', 45);
      tone(60, 0.3, 0.35 * vol, 'sine', 30);
    } else {
      noise(0.13, 0.45 * vol, 2600, 350);
      tone(150, 0.09, 0.3 * vol, 'square', 70);
    }
  },

  hit() { ensure(); tone(880, 0.06, 0.25, 'sine', 1200); },
  headshot() { ensure(); tone(1100, 0.05, 0.28, 'sine', 1600); tone(1500, 0.07, 0.2, 'sine', 2000, 0.04); },
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
