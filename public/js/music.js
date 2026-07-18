// ============================================================
// SUNFALL ARENA — Lobby Music Player
// Player de música ambiente para o lobby com crossfade suave,
// playlist das faixas em /music/, shuffle, repeat.
// Controles expostos via API pública — a UI fica no painel
// de Configurações → Áudio (não no lobby).
// ============================================================

const MUSIC_PATH = '/music/';
const CROSSFADE_DURATION = 3.5;
const FADE_IN_DURATION = 2.0;

const TRACKS = [
  { file: 'Finally Alive.m4a',        label: 'Finally Alive' },
  { file: 'Let It Breathe.m4a',       label: 'Let It Breathe' },
  { file: 'THE FINALS.m4a',           label: 'THE FINALS' },
  { file: 'The World\'s Greatest Game Show.m4a', label: 'The World\'s Greatest Game Show' }
];

// ---- Estado ----
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let volume = 0.5;                 // volume da música (0-1)
let repeatMode = 0;               // 0=off, 1=playlist, 2=one
let shuffleOrder = [];
let shuffleIdx = 0;

let playerA = null;
let playerB = null;
let activePlayer = 'A';
let AC = null;

let onTrackChange = null; // callback(index, label)

// Callbacks para a UI de configurações atualizar seus controles
let onStateChange = null; // callback()

// ============================================================
// Inicialização
// ============================================================

export function init(opts = {}) {
  AC = opts.audioContext || null;
  onTrackChange = opts.onTrackChange || null;
  onStateChange = opts.onStateChange || null;

  playerA = new Audio();
  playerB = new Audio();
  playerA.preload = 'auto';
  playerB.preload = 'auto';
  playerA.volume = 0;
  playerB.volume = 0;

  // Lê volume salvo em sf_settings
  try {
    const s = JSON.parse(localStorage.getItem('sf_settings') || '{}');
    if (typeof s.musicVolume === 'number') {
      volume = Math.max(0, Math.min(1, s.musicVolume));
    }
    if (typeof s.musicRepeat === 'number') repeatMode = s.musicRepeat;
    if (typeof s.musicShuffle === 'boolean') isShuffled = s.musicShuffle;
    if (typeof s.musicTrack === 'number' && s.musicTrack < TRACKS.length) {
      currentIndex = s.musicTrack;
    }
  } catch {}

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); }
    else if (isPlaying) { resume(); }
  });
}

// ============================================================
// Núcleo do player
// ============================================================

function getActivePlayer() { return activePlayer === 'A' ? playerA : playerB; }
function getInactivePlayer() { return activePlayer === 'A' ? playerB : playerA; }
function swapPlayers() { activePlayer = activePlayer === 'A' ? 'B' : 'A'; }

export function play() {
  if (isPlaying) return;
  if (!playerA.src) { playTrack(currentIndex); return; }
  isPlaying = true;
  const p = getActivePlayer();
  p.play().catch(() => {});
  fadeTo(p, volume, FADE_IN_DURATION);
  notifyState();
}

export function pause() {
  if (!isPlaying) return;
  isPlaying = false;
  const p = getActivePlayer();
  fadeTo(p, 0, 0.3);
  setTimeout(() => { if (!isPlaying) p.pause(); }, 350);
  const ip = getInactivePlayer();
  ip.volume = 0; ip.pause();
  notifyState();
}

export function togglePlayPause() {
  if (isPlaying) pause(); else play();
}

function resume() {
  if (!isPlaying) return;
  const p = getActivePlayer();
  p.play().catch(() => {});
  fadeTo(p, volume, FADE_IN_DURATION);
}

function playTrack(index) {
  const track = TRACKS[index];
  if (!track) return;

  const prevPlayer = getActivePlayer();
  const newPlayer = getInactivePlayer();

  newPlayer.src = MUSIC_PATH + encodeURI(track.file);
  newPlayer.currentTime = 0;
  newPlayer.volume = 0;
  newPlayer.play().catch(() => {});

  fadeTo(prevPlayer, 0, CROSSFADE_DURATION);
  fadeTo(newPlayer, volume, CROSSFADE_DURATION);

  swapPlayers();
  currentIndex = index;
  isPlaying = true;

  const onEnded = () => {
    newPlayer.removeEventListener('ended', onEnded);
    advanceToNext();
  };
  newPlayer.addEventListener('ended', onEnded);

  if (onTrackChange) onTrackChange(index, track.label);
  persistState();
  notifyState();
}

function advanceToNext() {
  if (repeatMode === 2) { playTrack(currentIndex); return; }
  const next = getNextIndex();
  if (next === null) { isPlaying = false; notifyState(); return; }
  playTrack(next);
}

function getNextIndex() {
  if (isShuffled) {
    shuffleIdx++;
    return shuffleIdx < shuffleOrder.length ? shuffleOrder[shuffleIdx] : null;
  }
  const next = currentIndex + 1;
  return next < TRACKS.length ? next : null;
}

function getPrevIndex() {
  if (isShuffled) { shuffleIdx = Math.max(0, shuffleIdx - 1); return shuffleOrder[shuffleIdx]; }
  return Math.max(0, currentIndex - 1);
}

export function nextTrack() {
  const n = getNextIndex();
  if (n !== null) playTrack(n);
}

export function prevTrack() {
  const p = getActivePlayer();
  if (p && p.currentTime > 3) { p.currentTime = 0; return; }
  const n = getPrevIndex();
  if (n !== null) playTrack(n);
}

export function playTrackByIndex(i) {
  if (i >= 0 && i < TRACKS.length) playTrack(i);
}

// ============================================================
// Shuffle (Fisher-Yates)
// ============================================================

export function toggleShuffle() {
  isShuffled = !isShuffled;
  if (isShuffled) {
    shuffleOrder = TRACKS.map((_, i) => i);
    for (let i = shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
    }
    if (shuffleOrder[0] === currentIndex && shuffleOrder.length > 1) {
      [shuffleOrder[0], shuffleOrder[1]] = [shuffleOrder[1], shuffleOrder[0]];
    }
    shuffleIdx = 0;
  }
  persistState();
  notifyState();
}

// ============================================================
// Repeat
// ============================================================

export function cycleRepeat() {
  repeatMode = (repeatMode + 1) % 3; // 0→1→2→0
  persistState();
  notifyState();
}

// ============================================================
// Volume / Fade
// ============================================================

function fadeTo(player, targetVol, duration) {
  if (!player) return;
  const start = player.volume;
  const t0 = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / (duration * 1000));
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    player.volume = start + (targetVol - start) * e;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function applyVolume() {
  const p = getActivePlayer();
  if (p && isPlaying) p.volume = volume;
  const ip = getInactivePlayer();
  if (ip) ip.volume = 0;
}

export function setMusicVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  applyVolume();
  persistState();
  notifyState();
}

export function getMusicVolume() { return volume; }

// ============================================================
// Persistência unificada em sf_settings
// ============================================================

function persistState() {
  try {
    const s = JSON.parse(localStorage.getItem('sf_settings') || '{}');
    s.musicVolume = volume;
    s.musicRepeat = repeatMode;
    s.musicShuffle = isShuffled;
    s.musicTrack = currentIndex;
    localStorage.setItem('sf_settings', JSON.stringify(s));
  } catch {}
}

function notifyState() {
  if (onStateChange) onStateChange();
}

// ============================================================
// API pública
// ============================================================

export function getCurrentTrack() { return TRACKS[currentIndex]; }
export function getCurrentIndex() { return currentIndex; }
export function getTrackList() { return TRACKS; }
export function isMusicPlaying() { return isPlaying; }
export function getShuffle() { return isShuffled; }
export function getRepeatMode() { return repeatMode; }

export function startLobbyMusic() {
  if (isPlaying) { notifyState(); return; }
  if (AC && AC.state === 'suspended') AC.resume();
  if (!playerA.src) {
    playTrack(currentIndex);
  } else {
    play();
  }
  // Se o play() falhou por autoplay (browser bloqueou),
    // agenda para tentar de novo no primeiro clique/tecla/touch do usuário
  const retryOnInteraction = () => {
    document.removeEventListener('click', retryOnInteraction);
    document.removeEventListener('keydown', retryOnInteraction);
    document.removeEventListener('touchstart', retryOnInteraction);
    if (!isPlaying) {
      if (AC && AC.state === 'suspended') AC.resume();
      // Toca depois de um breve delay para dar tempo do AudioContext ativar
      setTimeout(() => {
        if (!isPlaying) {
          if (!playerA.src) playTrack(currentIndex);
          else play();
        }
      }, 300);
    }
  };
  document.addEventListener('click', retryOnInteraction);
  document.addEventListener('keydown', retryOnInteraction);
  document.addEventListener('touchstart', retryOnInteraction);
  notifyState();
}

export function stopLobbyMusic() {
  pause();
  if (playerA) { playerA.pause(); playerA.currentTime = 0; }
  if (playerB) { playerB.pause(); playerB.currentTime = 0; }
  isPlaying = false;
  notifyState();
}

export function setOnStateChange(cb) { onStateChange = cb; }
