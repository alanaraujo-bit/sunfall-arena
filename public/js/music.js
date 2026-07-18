// ============================================================
// SUNFALL ARENA — Lobby Music Player
// Player de música ambiente para o lobby com crossfade suave,
// playlist das faixas em /music/, shuffle, repeat e controles
// de volume independentes (volume da música vs SFX).
// ============================================================

const MUSIC_PATH = '/music/';
const CROSSFADE_DURATION = 3.5; // segundos de transição entre faixas
const FADE_IN_DURATION = 2.0;   // fade-in ao iniciar/retomar

// Lista de faixas — nomes dos arquivos na pasta /music/
const TRACKS = [
  { file: 'Finally Alive.m4a',        label: 'Finally Alive' },
  { file: 'Let It Breathe.m4a',       label: 'Let It Breathe' },
  { file: 'THE FINALS.m4a',           label: 'THE FINALS' },
  { file: 'The World\'s Greatest Game Show.m4a', label: 'The World\'s Greatest Game Show' }
];

// Estado do player
let currentIndex = 0;
let isPlaying = false;
let isShuffled = false;
let volume = 0.35;          // volume da música (0-1), independente do SFX
let shuffleOrder = [];
let shuffleIdx = 0;

// AudioContext compartilhado com o SFX (via o mesmo AC)
let AC = null;

// Áudio elements — usamos 2 players para fazer crossfade
let playerA = null;  // ativo
let playerB = null;  // inativo (em fade-out)
let activePlayer = 'A'; // 'A' ou 'B'

// Timers
let crossfadeTimer = null;
let nextTrackTimer = null;

// UI elements
let ui = null;

// Callbacks
let onTrackChange = null; // (index, label) => void

// ============================================================
// Inicialização
// ============================================================

export function init(opts = {}) {
  AC = opts.audioContext || null;
  onTrackChange = opts.onTrackChange || null;

  // Cria os elementos <audio>
  playerA = new Audio();
  playerB = new Audio();
  playerA.preload = 'auto';
  playerB.preload = 'auto';
  playerA.volume = 0;
  playerB.volume = 0;

  // Carrega estado salvo
  loadState();

  // Cria a UI
  buildUI();

  // Responde a mudanças de visibilidade (pausa/retoma quando a aba perde foco)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
    } else if (isPlaying) {
      resume();
    }
  });
}

// ============================================================
// UI — player minimalista no canto inferior esquerdo do lobby
// ============================================================

function buildUI() {
  if (ui) return;

  const container = document.createElement('div');
  container.id = 'music-player';
  container.innerHTML = `
    <div id="mp-toggle" tabindex="0" role="button" aria-label="Abrir player de música">
      <span id="mp-toggle-icon">♪</span>
    </div>
    <div id="mp-panel" class="hidden">
      <div id="mp-header">
        <span id="mp-icon">♪</span>
        <span id="mp-title">MÚSICA NO LOBBY</span>
      </div>
      <div id="mp-track-info">
        <span id="mp-track-label">Carregando…</span>
        <span id="mp-track-counter"></span>
      </div>
      <div id="mp-progress">
        <input type="range" id="mp-seek" min="0" max="100" step="0.1" value="0" aria-label="Progresso da música">
        <div id="mp-times">
          <span id="mp-current">0:00</span>
          <span id="mp-duration">0:00</span>
        </div>
      </div>
      <div id="mp-controls">
        <button type="button" id="mp-prev" class="mp-btn" aria-label="Faixa anterior" title="Anterior">⏮</button>
        <button type="button" id="mp-play" class="mp-btn mp-btn-primary" aria-label="Tocar/Pausar" title="Tocar/Pausar">▶</button>
        <button type="button" id="mp-next" class="mp-btn" aria-label="Próxima faixa" title="Próxima">⏭</button>
        <button type="button" id="mp-shuffle" class="mp-btn" aria-label="Aleatório" title="Modo aleatório">🔀</button>
        <button type="button" id="mp-repeat" class="mp-btn" aria-label="Repetir" title="Repetir playlist">🔁</button>
      </div>
      <div id="mp-volume-row">
        <span id="mp-vol-icon">🔊</span>
        <input type="range" id="mp-volume" min="0" max="100" step="1" value="${Math.round(volume * 100)}" aria-label="Volume da música">
        <span id="mp-vol-val">${Math.round(volume * 100)}</span>
      </div>
      <div id="mp-tracklist">
        ${TRACKS.map((t, i) => `<div class="mp-track-item" data-index="${i}"><span class="mp-ti-num">${i + 1}</span><span class="mp-ti-label">${t.label}</span></div>`).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(container);
  ui = {
    container,
    panel: container.querySelector('#mp-panel'),
    toggle: container.querySelector('#mp-toggle'),
    toggleIcon: container.querySelector('#mp-toggle-icon'),
    playBtn: container.querySelector('#mp-play'),
    prevBtn: container.querySelector('#mp-prev'),
    nextBtn: container.querySelector('#mp-next'),
    shuffleBtn: container.querySelector('#mp-shuffle'),
    repeatBtn: container.querySelector('#mp-repeat'),
    seek: container.querySelector('#mp-seek'),
    currentTime: container.querySelector('#mp-current'),
    duration: container.querySelector('#mp-duration'),
    volumeSlider: container.querySelector('#mp-volume'),
    volumeVal: container.querySelector('#mp-vol-val'),
    trackLabel: container.querySelector('#mp-track-label'),
    trackCounter: container.querySelector('#mp-track-counter'),
    trackList: container.querySelector('#mp-tracklist'),
    volIcon: container.querySelector('#mp-vol-icon')
  };

  // Eventos
  ui.toggle.onclick = () => {
    const open = !ui.panel.classList.contains('hidden');
    ui.panel.classList.toggle('hidden', open);
    ui.toggle.classList.toggle('active', !open);
  };

  ui.playBtn.onclick = () => {
    if (isPlaying) pause();
    else play();
  };

  ui.prevBtn.onclick = prevTrack;
  ui.nextBtn.onclick = nextTrack;

  ui.shuffleBtn.onclick = () => {
    isShuffled = !isShuffled;
    if (isShuffled) buildShuffleOrder();
    updateShuffleUI();
    saveState();
  };

  ui.repeatBtn.onclick = () => {
    // Cicla: off → playlist → uma faixa
    const modes = [0, 1, 2]; // 0=off, 1=playlist, 2=one
    const cur = settings.musicRepeat || 0;
    const next = modes[(modes.indexOf(cur) + 1) % modes.length];
    settings.musicRepeat = next;
    updateRepeatUI();
    saveState();
  };

  ui.seek.oninput = () => {
    const p = getActivePlayer();
    if (p && p.duration) {
      p.currentTime = (ui.seek.value / 100) * p.duration;
    }
  };

  ui.volumeSlider.oninput = () => {
    volume = ui.volumeSlider.value / 100;
    ui.volumeVal.textContent = Math.round(volume * 100);
    updateVolumeIcon();
    applyVolume();
    saveState();
  };

  // Clica numa faixa da lista para tocar
  ui.trackList.querySelectorAll('.mp-track-item').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.index);
      if (idx !== currentIndex) {
        playTrack(idx);
      }
    };
  });

  updateShuffleUI();
  updateRepeatUI();
  updateVolumeIcon();
  updateTrackInfo();
}

// ============================================================
// Controles principais
// ============================================================

function getActivePlayer() {
  return activePlayer === 'A' ? playerA : playerB;
}

function getInactivePlayer() {
  return activePlayer === 'A' ? playerB : playerA;
}

function swapPlayers() {
  activePlayer = activePlayer === 'A' ? 'B' : 'A';
}

export function play() {
  if (isPlaying) return;
  if (!playerA.src) {
    playTrack(currentIndex);
    return;
  }
  isPlaying = true;
  const p = getActivePlayer();
  p.play().catch(() => {});
  // fade-in suave ao retomar
  fadeTo(p, volume, FADE_IN_DURATION);
  updatePlayBtn();
}

export function pause() {
  if (!isPlaying) return;
  isPlaying = false;
  const p = getActivePlayer();
  // fade-out rápido ao pausar
  fadeTo(p, 0, 0.3);
  setTimeout(() => {
    if (!isPlaying) p.pause();
  }, 350);
  // também silencia o inativo
  const ip = getInactivePlayer();
  ip.volume = 0;
  ip.pause();
  clearTimeout(crossfadeTimer);
  clearTimeout(nextTrackTimer);
  updatePlayBtn();
}

function resume() {
  // Só retoma se estava tocando antes
  if (!isPlaying) return;
  const p = getActivePlayer();
  p.play().catch(() => {});
  fadeTo(p, volume, FADE_IN_DURATION);
}

function playTrack(index) {
  clearTimeout(crossfadeTimer);
  clearTimeout(nextTrackTimer);

  const track = TRACKS[index];
  if (!track) return;

  const prevPlayer = getActivePlayer();
  const newPlayer = getInactivePlayer();

  // Carrega a nova faixa no player inativo
  newPlayer.src = MUSIC_PATH + encodeURI(track.file);
  newPlayer.currentTime = 0;
  newPlayer.volume = 0;
  newPlayer.play().catch(() => {});

  // Faz crossfade: fade-out do antigo, fade-in do novo
  const startVol = volume;
  fadeTo(prevPlayer, 0, CROSSFADE_DURATION);
  fadeTo(newPlayer, startVol, CROSSFADE_DURATION);

  // Marca a transição
  swapPlayers();
  currentIndex = index;
  isPlaying = true;

  // Agenda a próxima faixa quando a atual terminar
  const onEnded = () => {
    newPlayer.removeEventListener('ended', onEnded);
    advanceToNext();
  };
  newPlayer.addEventListener('ended', onEnded);

  // Atualiza a UI
  updatePlayBtn();
  updateTrackInfo();
  highlightTrackInList();
  if (onTrackChange) onTrackChange(index, track.label);

  // Progresso
  updateSeekLoop();

  saveState();
}

function advanceToNext() {
  const repeatMode = settings.musicRepeat || 0;
  if (repeatMode === 2) {
    // Repetir uma faixa
    playTrack(currentIndex);
    return;
  }
  const next = getNextIndex();
  if (next === null) {
    // Fim da playlist sem repeat — pausa
    isPlaying = false;
    updatePlayBtn();
    return;
  }
  playTrack(next);
}

function getNextIndex() {
  if (isShuffled) {
    shuffleIdx++;
    if (shuffleIdx >= shuffleOrder.length) {
      return null;
    }
    return shuffleOrder[shuffleIdx];
  }
  const next = currentIndex + 1;
  if (next >= TRACKS.length) {
    return null;
  }
  return next;
}

function getPrevIndex() {
  if (isShuffled) {
    shuffleIdx = Math.max(0, shuffleIdx - 1);
    return shuffleOrder[shuffleIdx];
  }
  return Math.max(0, currentIndex - 1);
}

export function nextTrack() {
  const next = getNextIndex();
  if (next !== null) playTrack(next);
}

export function prevTrack() {
  // Se já passou mais de 3s, volta ao início da faixa atual
  const p = getActivePlayer();
  if (p && p.currentTime > 3) {
    p.currentTime = 0;
    return;
  }
  const prev = getPrevIndex();
  if (prev !== null) playTrack(prev);
}

// ============================================================
// Embaralhamento (Fisher-Yates)
// ============================================================

function buildShuffleOrder() {
  shuffleOrder = TRACKS.map((_, i) => i);
  for (let i = shuffleOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
  }
  // Garante que a primeira não seja a mesma que está tocando
  if (shuffleOrder[0] === currentIndex && shuffleOrder.length > 1) {
    [shuffleOrder[0], shuffleOrder[1]] = [shuffleOrder[1], shuffleOrder[0]];
  }
  shuffleIdx = 0;
}

// ============================================================
// Volume / Fade
// ============================================================

function fadeTo(player, targetVol, duration) {
  if (!player) return;
  const start = player.volume;
  const startTime = performance.now();
  const step = () => {
    const elapsed = (performance.now() - startTime) / 1000;
    const t = Math.min(1, elapsed / duration);
    // ease-in-out quadrático
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    player.volume = start + (targetVol - start) * eased;
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
  if (ui) {
    ui.volumeSlider.value = Math.round(volume * 100);
    ui.volumeVal.textContent = Math.round(volume * 100);
    updateVolumeIcon();
  }
  saveState();
}

export function getMusicVolume() {
  return volume;
}

function updateVolumeIcon() {
  if (!ui) return;
  ui.volIcon.textContent = volume === 0 ? '🔇' : volume < 0.3 ? '🔈' : volume < 0.6 ? '🔉' : '🔊';
}

// ============================================================
// Progresso / Seek
// ============================================================

let seekRAF = null;

function updateSeekLoop() {
  if (seekRAF) cancelAnimationFrame(seekRAF);
  if (!isPlaying) return;
  const p = getActivePlayer();
  if (!p || !p.duration) {
    seekRAF = requestAnimationFrame(updateSeekLoop);
    return;
  }
  if (!ui) return;
  const progress = (p.currentTime / p.duration) * 100;
  ui.seek.value = Math.min(100, Math.max(0, progress));
  ui.currentTime.textContent = formatTime(p.currentTime);
  ui.duration.textContent = formatTime(p.duration);
  seekRAF = requestAnimationFrame(updateSeekLoop);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ============================================================
// UI helpers
// ============================================================

function updatePlayBtn() {
  if (!ui) return;
  ui.playBtn.textContent = isPlaying ? '⏸' : '▶';
  ui.playBtn.title = isPlaying ? 'Pausar' : 'Tocar';
  ui.toggleIcon.textContent = isPlaying ? '♫' : '♪';
}

function updateTrackInfo() {
  if (!ui) return;
  const track = TRACKS[currentIndex];
  if (track) {
    ui.trackLabel.textContent = track.label;
    const total = TRACKS.length;
    const current = isShuffled ? shuffleIdx + 1 : currentIndex + 1;
    ui.trackCounter.textContent = `${current} / ${total}`;
  }
}

function highlightTrackInList() {
  if (!ui) return;
  ui.trackList.querySelectorAll('.mp-track-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentIndex);
  });
}

function updateShuffleUI() {
  if (!ui) return;
  ui.shuffleBtn.classList.toggle('active', isShuffled);
}

function updateRepeatUI() {
  if (!ui) return;
  const mode = settings.musicRepeat || 0;
  ui.repeatBtn.classList.toggle('active', mode > 0);
  ui.repeatBtn.textContent = mode === 2 ? '🔂' : '🔁';
}

// ============================================================
// Integração com as configurações
// ============================================================

// settings é um objeto global definido em main.js —
// armazenamos musicVolume e musicRepeat nele
const settings = window.__sfSettings || {};
if (!window.__sfSettings) window.__sfSettings = settings;

export function getSettings() {
  return window.__sfSettings || {};
}

function saveState() {
  try {
    const s = window.__sfSettings || {};
    s.musicVolume = volume;
    s.musicRepeat = s.musicRepeat || 0;
    s.musicShuffle = isShuffled;
    // Salva no localStorage (main.js já faz isso via saveSettings)
    // Mas como musicVolume é separado, fazemos nossa própria persistência
    localStorage.setItem('sf_music_state', JSON.stringify({
      volume,
      repeat: s.musicRepeat || 0,
      shuffle: isShuffled,
      currentIndex,
      shuffleOrder,
      shuffleIdx
    }));
  } catch {}
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('sf_music_state') || '{}');
    if (typeof saved.volume === 'number') volume = saved.volume;
    if (typeof saved.repeat === 'number') {
      if (!window.__sfSettings) window.__sfSettings = {};
      window.__sfSettings.musicRepeat = saved.repeat;
    }
    if (typeof saved.shuffle === 'boolean') isShuffled = saved.shuffle;
    if (Array.isArray(saved.shuffleOrder) && saved.shuffleOrder.length === TRACKS.length) {
      shuffleOrder = saved.shuffleOrder;
      shuffleIdx = saved.shuffleIdx || 0;
    }
    if (typeof saved.currentIndex === 'number' && saved.currentIndex < TRACKS.length) {
      currentIndex = saved.currentIndex;
    }
  } catch {}
}

// ============================================================
// API pública
// ============================================================

export function getCurrentTrack() {
  return TRACKS[currentIndex];
}

export function getTrackList() {
  return TRACKS;
}

export function isMusicPlaying() {
  return isPlaying;
}

export function setOnTrackChange(callback) {
  onTrackChange = callback;
}

// Inicia a música no lobby (chamado por main.js ao entrar no lobby)
export function startLobbyMusic() {
  // Só inicia se o usuário já interagiu com a página
  if (!isPlaying && !playerA.src) {
    // Primeira interação: usa o play() do AudioContext para desbloquear
    if (AC && AC.state === 'suspended') AC.resume();
    playTrack(currentIndex);
  } else if (!isPlaying && playerA.src) {
    play();
  }
}

// Para a música ao sair do lobby / entrar em partida
export function stopLobbyMusic() {
  pause();
  if (playerA) { playerA.pause(); playerA.currentTime = 0; }
  if (playerB) { playerB.pause(); playerB.currentTime = 0; }
  isPlaying = false;
  if (ui) updatePlayBtn();
}
