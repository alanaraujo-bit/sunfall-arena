// ============================================================
// SUNFALL ARENA — cliente principal
// Movimentação rápida (slide/bunny-hop), hitscan, efeitos,
// interpolação de jogadores remotos e HUD.
// ============================================================
import * as THREE from 'three';
import { BOUNDS, PLAYER, raycastSolids } from '/shared/mapdata.js';
import { buildWorld, makeCharacter, makeViewmodel, makeGrenadeMesh, makeSmokeCanisterMesh } from './world.js';
import { NADE, SMOKE, SMOKE_LIFE_MS, advanceGrenade, launchGrenade } from '/shared/nadephysics.js';
import { tex, spriteTex, setTexQuality, smokeTex } from './textures.js';
import { Net, api, apiAuth, apiPublicGet } from './net.js';
import { SFX, getAudioContext } from './audio.js';
import * as Music from './music.js';
import { initArmory } from './armory.js';

// Log de erros visível no DOM (debug em headless)
const errlog = document.getElementById('errlog');
window.addEventListener('error', e => { errlog.textContent += e.message + '\n'; });

// ---------------- Configurações (antes do renderer — AA e escala dependem delas) ----------------
const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', slide: 'ShiftLeft', reload: 'KeyR', kit: 'KeyE',
  w1: 'Digit1', w2: 'Digit2', w3: 'Digit3', melee: 'KeyV', nade: 'KeyG', smoke: 'KeyC', board: 'Tab'
};
const BIND_LABELS = {
  forward: 'Andar — frente', back: 'Andar — trás', left: 'Andar — esquerda', right: 'Andar — direita',
  jump: 'Pular', slide: 'Deslizar', reload: 'Recarregar', kit: 'Usar Kit',
  w1: 'Arma 1', w2: 'Arma 2', w3: 'Faca', melee: 'Golpe rápido', nade: 'Granada', smoke: 'Fumaça', board: 'Placar'
};

// Presets de qualidade — cada um define as opções individuais.
// scale = % da resolução; shadows = tamanho do shadow map (0 = sem sombra)
const PRESETS = {
  potato: { scale: 50,  shadows: 0,    aa: 'off', particles: 'off',  decor: 'off', texq: 'low' },
  low:    { scale: 75,  shadows: 0,    aa: 'off', particles: 'low',  decor: 'off', texq: 'low' },
  med:    { scale: 100, shadows: 1024, aa: 'on',  particles: 'full', decor: 'on',  texq: 'med' },
  high:   { scale: 100, shadows: 2048, aa: 'on',  particles: 'full', decor: 'on',  texq: 'high' }
};

let settings = {
  preset: 'med', ...PRESETS.med,
  fov: 78, vol: 50, perf: 'on', binds: { ...DEFAULT_BINDS }
};
try {
  const saved = JSON.parse(localStorage.getItem('sf_settings') || '{}');
  // migração do formato antigo ({ quality: 'low'|'med'|'high' })
  if (saved.quality && !saved.preset) {
    saved.preset = saved.quality;
    Object.assign(saved, PRESETS[saved.quality] || PRESETS.med);
    delete saved.quality;
  }
  settings = { ...settings, ...saved, binds: { ...DEFAULT_BINDS, ...(saved.binds || {}) } };
} catch { /* settings corrompidas: usa padrão */ }
const binds = settings.binds;
const saveSettings = () => localStorage.setItem('sf_settings', JSON.stringify(settings));

// ---------------- Setup básico ----------------
// powerPreference: 'high-performance' faz o navegador escolher a GPU
// dedicada (RTX/GTX/Radeon) em máquinas híbridas — sem isso o jogo
// pode rodar inteiro na GPU integrada, mesmo com placa boa parada.
const AA_ACTIVE = settings.aa !== 'off'; // AA só muda recriando o contexto (recarregar)
const renderer = new THREE.WebGLRenderer({
  antialias: AA_ACTIVE,
  powerPreference: 'high-performance',
  stencil: false
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * (settings.scale / 100));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = settings.shadows > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

// Identifica a GPU real em uso. Renderização por software (SwiftShader)
// = aceleração de hardware desligada no navegador — causa nº 1 de FPS baixo.
let gpuName = '';
try {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  gpuName = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
} catch { /* alguns navegadores bloqueiam a extensão */ }
const SOFTWARE_GL = /swiftshader|llvmpipe|software|basic render/i.test(gpuName);

const scene = new THREE.Scene();
let BASE_FOV = 78;
const ZOOM_FOV = 24;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.08, 600);
camera.rotation.order = 'YXZ';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Constrói o mundo (texturas na qualidade configurada)
setTexQuality(settings.texq);
let world = buildWorld(scene, { decor: settings.decor !== 'off' });
let worldDecor = settings.decor, worldTexq = settings.texq;

// Personagem em destaque no lobby (showcase giratório na praça central)
const lobbyChar = makeCharacter('#3fc8b4');
lobbyChar.position.set(0, 0, 6.5);
scene.add(lobbyChar);
function setLobbyCharColor(hex) {
  const nc = makeCharacter(hex);
  nc.position.copy(lobbyChar.position);
  nc.rotation.copy(lobbyChar.rotation);
  scene.remove(lobbyChar);
  scene.add(nc);
  lobbyCharRef.g = nc;
}
const lobbyCharRef = { g: lobbyChar };

// ---------------- HUD ----------------
const $ = id => document.getElementById(id);
const hud = {
  menu: $('menu'), nameInput: $('name-input'),
  mpBtn: $('mp-btn'), customBtn: $('custom-btn'), customPanel: $('custom-panel'),
  cfgGm: $('cfg-gm'), cfgBots: $('cfg-bots'), cfgKl: $('cfg-kl'), cfgTl: $('cfg-tl'),
  createBtn: $('create-btn'), codeInput: $('code-input'), joinBtn: $('join-btn'),
  idChip: $('id-chip'), idAvatar: $('id-avatar'), idName: $('id-name'),
  idLevel: $('id-level'), idXpFill: $('id-xpfill'), idXpText: $('id-xptext'),
  btnFullscreen: $('btn-fullscreen'),
  navFriends: $('nav-friends'), friendsHint: $('friends-hint'),
  modeChip: $('mode-chip'), modeChipTitle: $('mode-chip-title'), modeChipSub: $('mode-chip-sub'),
  startBtn: $('start-btn'), playDock: $('play-dock'), pauseCard: $('pause-card'),
  teamSwitch: $('team-switch'), team0: $('team-0'), team1: $('team-1'),
  roomLine: $('room-line'), roomCode: $('room-code'),
  resumeBtn: $('resume-btn'), leaveBtn: $('leave-btn'),
  inviteBanner: $('invite-banner'), inviteText: $('invite-text'),
  inviteAccept: $('invite-accept'), inviteDismiss: $('invite-dismiss'),
  matchBar: $('match-bar'), mbTime: $('mb-time'), mbScore: $('mb-score'),
  endscreen: $('endscreen'), endWinnerName: $('end-winner-name'),
  endRows: $('end-rows'), endCount: $('end-count'),
  sens: $('sens'), sensVal: $('sens-val'), menuTitle: $('menu-title'),
  menuStatus: $('menu-status'), hpFill: $('hp-fill'), hpNum: $('hp-num'),
  ammo: $('ammo'), wname: $('weapon-name'), feed: $('feed'), board: $('board'),
  boardRows: $('board-rows'), hitmarker: $('hitmarker'), dmgFlash: $('dmg-flash'),
  death: $('death'), deathBy: $('death-by'), scope: $('scope'), game: $('hud'),
  killcam: $('killcam'), killcamBy: $('killcam-by'), killcamProgress: $('killcam-progress'),
  fade: $('fade'),
  killPop: $('kill-pop'), multiKill: $('multi-kill'),
  stamBox: $('stam-box'), stamFill: $('stam-fill'),
  kitBox: $('kit-box'), kitCount: $('kit-count'), kitBar: $('kit-bar'),
  nadeBox: $('nade-box'), nadeCount: $('nade-count'), nadeBar: $('nade-bar'),
  smokeBox: $('smoke-box'), smokeCount: $('smoke-count'), smokeBar: $('smoke-bar'),
  tabGuest: $('tab-guest'), tabAccount: $('tab-account'),
  guestPanel: $('guest-panel'), accountPanel: $('account-panel'),
  accUser: $('acc-user'), accPass: $('acc-pass'), accountStatus: $('account-status'),
  accountInfo: $('account-info'), accountBtns: $('account-btns'),
  loginBtn: $('login-btn'), registerBtn: $('register-btn'),
  friendsBox: $('friends-box'), friendName: $('friend-name'),
  friendAddBtn: $('friend-add-btn'), friendStatus: $('friend-status'),
  friendsList: $('friends-list'),
  navProfile: $('nav-profile'), navConfig: $('nav-config'),
  profileHint: $('profile-hint'), profileContent: $('profile-content'),
  pfName: $('pf-name'), pfLevel: $('pf-level'), pfXpFill: $('pf-xpfill'), pfXpText: $('pf-xptext'),
  stWins: $('st-wins'), stMatches: $('st-matches'), stKills: $('st-kills'),
  stDeaths: $('st-deaths'), stKd: $('st-kd'), stHs: $('st-hs'),
  setQuality: $('set-quality'), setFov: $('set-fov'), setFovVal: $('set-fov-val'),
  setScale: $('set-scale'), setScaleVal: $('set-scale-val'),
  setShadows: $('set-shadows'), setAa: $('set-aa'), aaNote: $('aa-note'), aaReload: $('aa-reload'),
  setParticles: $('set-particles'), setDecor: $('set-decor'), setTex: $('set-tex'),
  gpuLine: $('gpu-line'), fpsHint: $('fps-hint'),
  setVol: $('set-vol'), setVolVal: $('set-vol-val'), setPerf: $('set-perf'),
  perf: $('perf'), perfFps: $('perf-fps'), perfPing: $('perf-ping'), perfDraw: $('perf-draw'),
  bindsList: $('binds-list'), bindsReset: $('binds-reset'),
  navRank: $('nav-rank'),
  rankSearch: $('rank-search'), rankSearchBtn: $('rank-search-btn'),
  rankStatus: $('rank-status'), rankList: $('rank-list'),
  playerModal: $('player-modal'), pmClose: $('pm-close'), pmDot: $('pm-dot'),
  pmName: $('pm-name'), pmLevel: $('pm-level'), pmSince: $('pm-since'),
  pmXpFill: $('pm-xpfill'), pmXpText: $('pm-xptext'),
  pmWins: $('pm-wins'), pmMatches: $('pm-matches'), pmWinrate: $('pm-winrate'),
  pmKills: $('pm-kills'), pmDeaths: $('pm-deaths'), pmKd: $('pm-kd'),
  pmHs: $('pm-hs'), pmHsrate: $('pm-hsrate'),
  pmAddFriend: $('pm-addfriend'), pmStatus: $('pm-status')
};
hud.nameInput.value = localStorage.getItem('sf_name') || '';
hud.sens.value = localStorage.getItem('sf_sens') || '1';
hud.sensVal.textContent = (+hud.sens.value).toFixed(1);
hud.sens.oninput = () => {
  hud.sensVal.textContent = (+hud.sens.value).toFixed(1);
  localStorage.setItem('sf_sens', hud.sens.value);
};

function applyGraphics() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * (settings.scale / 100));
  const tone = settings.preset === 'potato' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  if (renderer.toneMapping !== tone) {
    renderer.toneMapping = tone;
    // tone mapping é compilado no shader — força recompilar os materiais
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  const sh = +settings.shadows;
  renderer.shadowMap.enabled = sh > 0;
  world.sun.castShadow = sh > 0;
  if (sh > 0 && world.sun.shadow.mapSize.x !== sh) {
    world.sun.shadow.mapSize.set(sh, sh);
    if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; }
  }
  // sem decoração, a névoa aproxima e esconde o mapa vazio ao longe
  scene.fog.near = settings.decor === 'off' ? 45 : 70;
  scene.fog.far = settings.decor === 'off' ? 150 : 260;
  BASE_FOV = settings.fov;
}

// Reconstrói o mundo ao vivo quando decoração/texturas mudam
function maybeRebuildWorld() {
  if (worldDecor === settings.decor && worldTexq === settings.texq) return;
  worldDecor = settings.decor;
  worldTexq = settings.texq;
  scene.remove(world.group);
  world.dispose();
  setTexQuality(settings.texq);
  world = buildWorld(scene, { decor: settings.decor !== 'off' });
  applyGraphics(); // reaplica sombras/névoa no sol novo
}

function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const nice = {
    Space: 'ESPAÇO', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT D.',
    ControlLeft: 'CTRL', ControlRight: 'CTRL D.', AltLeft: 'ALT', Tab: 'TAB',
    CapsLock: 'CAPS', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→'
  };
  return nice[code] || code.toUpperCase();
}

let listeningBind = null; // {action, btn}
function buildBindsUI() {
  hud.bindsList.textContent = '';
  for (const action of Object.keys(DEFAULT_BINDS)) {
    const row = document.createElement('div');
    row.className = 'bind-row';
    const label = document.createElement('label');
    label.textContent = BIND_LABELS[action];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bind-key';
    btn.textContent = keyLabel(binds[action]);
    btn.onclick = () => {
      if (listeningBind) {
        listeningBind.btn.classList.remove('listening');
        listeningBind.btn.textContent = keyLabel(binds[listeningBind.action]);
      }
      listeningBind = { action, btn };
      btn.classList.add('listening');
      btn.textContent = 'PRESSIONE…';
    };
    row.append(label, btn);
    hud.bindsList.appendChild(row);
  }
}

// captura da nova tecla (fase de captura, para não vazar pro jogo)
addEventListener('keydown', e => {
  if (!listeningBind) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.code !== 'Escape') {
    binds[listeningBind.action] = e.code;
    saveSettings();
  }
  listeningBind.btn.classList.remove('listening');
  listeningBind.btn.textContent = keyLabel(binds[listeningBind.action]);
  listeningBind = null;
}, true);

hud.bindsReset.onclick = () => {
  Object.assign(binds, DEFAULT_BINDS);
  saveSettings();
  buildBindsUI();
};

// ---- Controles de gráficos ----
function syncGfxControls() {
  hud.setQuality.value = PRESETS[settings.preset] ? settings.preset : 'custom';
  hud.setScale.value = settings.scale;
  hud.setScaleVal.textContent = settings.scale + '%';
  hud.setShadows.value = String(settings.shadows);
  hud.setAa.value = settings.aa;
  hud.setParticles.value = settings.particles;
  hud.setDecor.value = settings.decor;
  hud.setTex.value = settings.texq;
  updateAaNote();
}
function updateAaNote() {
  // AA só é aplicado na criação do contexto WebGL — exige recarregar
  const pending = (settings.aa !== 'off') !== AA_ACTIVE;
  hud.aaNote.classList.toggle('hidden', !pending);
}
function afterGfxChange() {
  saveSettings();
  applyGraphics();
  maybeRebuildWorld();
  updateAaNote();
}
hud.setQuality.onchange = () => {
  const p = hud.setQuality.value;
  if (!PRESETS[p]) return;
  settings.preset = p;
  Object.assign(settings, PRESETS[p]);
  syncGfxControls();
  afterGfxChange();
};
function customize(key, val) {
  settings[key] = val;
  settings.preset = 'custom';
  hud.setQuality.value = 'custom';
  afterGfxChange();
}
hud.setScale.oninput = () => {
  hud.setScaleVal.textContent = hud.setScale.value + '%';
  customize('scale', +hud.setScale.value);
};
hud.setShadows.onchange = () => customize('shadows', +hud.setShadows.value);
hud.setAa.onchange = () => customize('aa', hud.setAa.value);
hud.setParticles.onchange = () => customize('particles', hud.setParticles.value);
hud.setDecor.onchange = () => customize('decor', hud.setDecor.value);
hud.setTex.onchange = () => customize('texq', hud.setTex.value);
hud.aaReload.onclick = () => location.reload();
// O navegador MASCARA o modelo exato da GPU por privacidade (mostra um
// modelo genérico "or similar") — só o fabricante é confiável. O que
// importa: NVIDIA/AMD = placa dedicada em uso; SwiftShader = sem aceleração.
function gpuLabel() {
  if (SOFTWARE_GL) return 'renderização por software';
  if (/nvidia|geforce|rtx\b|gtx\b/i.test(gpuName)) return 'NVIDIA — placa dedicada em uso ✓';
  if (/\bamd\b|radeon/i.test(gpuName)) return 'AMD Radeon — placa dedicada em uso ✓';
  if (/intel|\buhd\b|iris/i.test(gpuName)) return 'Intel (integrada) — se você tem placa dedicada, force-a nas config. de vídeo do Windows';
  if (/apple/i.test(gpuName)) return 'Apple';
  return gpuName || 'desconhecida';
}
hud.gpuLine.textContent = 'GPU em uso: ' + gpuLabel() +
  ' · o navegador esconde o modelo exato por privacidade';
hud.gpuLine.title = gpuName; // string bruta no tooltip p/ diagnóstico
if (SOFTWARE_GL) {
  hud.gpuLine.classList.add('warn');
  hud.gpuLine.textContent = 'GPU em uso: SEM aceleração de hardware (software)!';
  $('gl-warn').classList.remove('hidden');
} else if (/intel|\buhd\b|iris/i.test(gpuName)) {
  hud.gpuLine.classList.add('warn');
}
syncGfxControls();
hud.setFov.value = settings.fov;
hud.setFovVal.textContent = settings.fov;
hud.setFov.oninput = () => {
  settings.fov = +hud.setFov.value;
  hud.setFovVal.textContent = settings.fov;
  applyGraphics(); saveSettings();
};
hud.setVol.value = settings.vol;
hud.setVolVal.textContent = settings.vol;
hud.setVol.oninput = () => {
  settings.vol = +hud.setVol.value;
  hud.setVolVal.textContent = settings.vol;
  SFX.setVolume(settings.vol / 100);
  saveSettings();
};
// Volume da música (config)
const musicVolSlider = $('set-music-vol');
const musicVolVal = $('set-music-vol-val');
if (musicVolSlider) {
  // O volume já foi carregado pelo music.js do sf_settings
  const volPct = Math.round(Music.getMusicVolume() * 100);
  musicVolSlider.value = volPct;
  musicVolVal.textContent = volPct;
  musicVolSlider.oninput = () => {
    const v = +musicVolSlider.value / 100;
    musicVolVal.textContent = musicVolSlider.value;
    Music.setMusicVolume(v);
  };
}

// ---- Controles do player de música no painel de áudio ----
function setupMusicConfigUI() {
  const playBtn = $('mc-play');
  const prevBtn = $('mc-prev');
  const nextBtn = $('mc-next');
  const shuffleBtn = $('mc-shuffle');
  const repeatBtn = $('mc-repeat');
  const statusEl = $('mc-status');
  const trackNameEl = $('mc-track-name');
  const trackList = document.getElementById('mc-tracklist');

  if (!playBtn) return;

  function refreshMusicUI() {
    const playing = Music.isMusicPlaying();
    const track = Music.getCurrentTrack();
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.title = playing ? 'Pausar' : 'Tocar';
    if (statusEl) statusEl.textContent = playing ? '▶ Tocando' : '⏸ Pausado';
    if (trackNameEl && track) trackNameEl.textContent = track.label;
    shuffleBtn.classList.toggle('active', Music.getShuffle());
    const rm = Music.getRepeatMode();
    repeatBtn.classList.toggle('active', rm > 0);
    repeatBtn.textContent = rm === 2 ? '🔂' : '🔁';
    // destaque na tracklist
    if (trackList) {
      trackList.querySelectorAll('.mc-track-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.index) === Music.getCurrentIndex());
      });
    }
  }

  playBtn.onclick = () => { Music.togglePlayPause(); refreshMusicUI(); };
  prevBtn.onclick = () => { Music.prevTrack(); refreshMusicUI(); };
  nextBtn.onclick = () => { Music.nextTrack(); refreshMusicUI(); };
  shuffleBtn.onclick = () => { Music.toggleShuffle(); refreshMusicUI(); };
  repeatBtn.onclick = () => { Music.cycleRepeat(); refreshMusicUI(); };

  // Clica na faixa da lista
  if (trackList) {
    trackList.querySelectorAll('.mc-track-item').forEach(el => {
      el.onclick = () => {
        Music.playTrackByIndex(parseInt(el.dataset.index));
        refreshMusicUI();
      };
    });
  }

  // Callback quando o estado mudar (início automático, etc)
  Music.setOnStateChange(refreshMusicUI);

  refreshMusicUI();
}

function applyPerf() { hud.perf.classList.toggle('hidden', settings.perf !== 'on'); }
hud.setPerf.value = settings.perf;
hud.setPerf.onchange = () => { settings.perf = hud.setPerf.value; applyPerf(); saveSettings(); };
SFX.setVolume(settings.vol / 100);
applyGraphics();
applyPerf();
buildBindsUI();

// Inicializa o player de música do lobby
Music.init({
  audioContext: getAudioContext()
});
setupMusicConfigUI();

// Inicia a música automaticamente — se o browser bloquear autoplay,
// o music.js já trata de tentar de novo na primeira interação do usuário.
setTimeout(() => Music.startLobbyMusic(), 1000);

// ---------------- FPS / Ping ----------------
let fpsAccum = 0, fpsFrames = 0, fpsShown = 0, ping = 0;
let fpsLowT = 0, fpsHintDone = false;
function updatePerf(dt) {
  fpsAccum += dt; fpsFrames++;
  if (fpsAccum < 0.4) return;
  fpsShown = Math.round(fpsFrames / fpsAccum);
  fpsAccum = 0; fpsFrames = 0;

  // FPS baixo sustentado em partida → dica única para baixar a qualidade
  if (playing && fpsShown < 40) fpsLowT += 0.4; else fpsLowT = 0;
  if (fpsLowT >= 8 && !fpsHintDone && settings.preset !== 'potato') {
    fpsHintDone = true;
    hud.fpsHint.classList.add('show');
    setTimeout(() => hud.fpsHint.classList.remove('show'), 9000);
  }

  if (settings.perf !== 'on') return;
  hud.perfFps.textContent = `${fpsShown} FPS`;
  hud.perfFps.className = fpsShown >= 50 ? '' : (fpsShown >= 30 ? 'mid' : 'low');
  hud.perfPing.textContent = ping ? `${ping} ms` : '-- ms';
  hud.perfPing.className = ping < 80 ? '' : (ping < 150 ? 'mid' : 'high');
  hud.perfDraw.textContent = `${renderer.info.render.calls} dc`;
}

// (o handler de 'pong' e o envio de ping ficam após `const net` ser criado)

// ---------------- Navegação do menu ----------------
// ---------------- Telas do lobby (overlays) ----------------
const screens = {
  account: $('screen-account'), profile: $('screen-profile'), friends: $('screen-friends'),
  rank: $('screen-rank'), config: $('screen-config'), modes: $('screen-modes'),
  armory: $('screen-armory')
};
let currentScreen = null;

// Arsenal: inicializado sob demanda (o visualizador 3D só é criado ao abrir)
let armory = null;

function showScreen(name) {
  if (armory && currentScreen === 'armory' && name !== 'armory') armory.close();
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('show', k === name);
  currentScreen = name;
  if (name === 'profile') loadProfile();
  if (name === 'rank') loadLeaderboard();
  if (name === 'friends') { renderFriendsScreen(); refreshFriends(); }
  if (name === 'armory') { if (!armory) armory = initArmory(); armory.open(); }
}
function closeScreen() {
  if (armory && currentScreen === 'armory') armory.close();
  for (const el of Object.values(screens)) el.classList.remove('show');
  currentScreen = null;
}

// botões que abrem telas
hud.idChip.onclick = () => showScreen('account');
hud.navProfile.onclick = () => showScreen('profile');
hud.navFriends.onclick = () => showScreen('friends');
hud.navRank.onclick = () => showScreen('rank');
hud.navConfig.onclick = () => showScreen('config');
hud.modeChip.onclick = () => showScreen('modes');
$('nav-arsenal').onclick = () => showScreen('armory');

// fechar telas: botão ✕, clicar fora do painel, ou Esc
for (const el of Object.values(screens)) {
  el.querySelector('.screen-close')?.addEventListener('click', closeScreen);
  el.addEventListener('click', e => { if (e.target === el) closeScreen(); });
}
addEventListener('keydown', e => {
  if (e.code === 'Escape' && currentScreen && !playing) closeScreen();
}, true);

// sub-navegação das configurações
document.querySelectorAll('#cfg-side .cfg-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('#cfg-side .cfg-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('#cfg-pages .cfg-page').forEach(p =>
      p.classList.toggle('hidden', p.dataset.page !== tab.dataset.page));
  };
});

// tela cheia
hud.btnFullscreen.onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
};

// atualiza o chip de identidade no topo do lobby
function updateIdChip() {
  if (auth) {
    hud.idName.textContent = auth.username;
    hud.idAvatar.textContent = auth.username[0].toUpperCase();
    hud.idLevel.classList.remove('hidden');
    apiAuth('GET', '/profile/me', auth.token).then(p => {
      hud.idLevel.querySelector('b').textContent = p.level;
      const inLevel = p.xp - (p.level - 1) * 500;
      hud.idXpFill.style.width = `${Math.min(100, (inLevel / 500) * 100)}%`;
      hud.idXpText.textContent = `${inLevel}/500 XP`;
      if (p.color) setLobbyCharColor(p.color);
    }).catch(() => {});
  } else {
    const nick = (hud.nameInput.value.trim() || 'Recruta').slice(0, 14);
    hud.idName.textContent = nick;
    hud.idAvatar.textContent = nick[0].toUpperCase();
    hud.idLevel.classList.add('hidden');
    hud.idXpFill.style.width = '0';
    hud.idXpText.textContent = 'convidado';
  }
}

async function loadProfile() {
  const logged = !!auth;
  hud.profileHint.classList.toggle('hidden', logged);
  hud.profileContent.classList.toggle('hidden', !logged);
  if (!logged) return;
  try {
    const [prof, stats] = await Promise.all([
      apiAuth('GET', '/profile/me', auth.token),
      apiAuth('GET', '/stats/me', auth.token)
    ]);
    hud.pfName.textContent = prof.username;
    hud.pfLevel.textContent = prof.level;
    const inLevel = prof.xp - (prof.level - 1) * 500;
    hud.pfXpFill.style.width = `${Math.min(100, (inLevel / 500) * 100)}%`;
    hud.pfXpText.textContent = `${inLevel} / 500 XP · total ${prof.xp}`;
    hud.stWins.textContent = stats.wins ?? 0;
    hud.stMatches.textContent = stats.matchesPlayed;
    hud.stKills.textContent = stats.kills;
    hud.stDeaths.textContent = stats.deaths;
    hud.stKd.textContent = (stats.kills / Math.max(1, stats.deaths)).toFixed(2);
    hud.stHs.textContent = stats.headshots;
  } catch { /* mantém últimos valores */ }
}

// ---------------- Ranking + perfil público ----------------
const MEDALS = ['🥇', '🥈', '🥉'];

async function loadLeaderboard() {
  hud.rankStatus.textContent = '';
  try {
    const { players: top } = await apiPublicGet('/leaderboard');
    hud.rankList.textContent = '';
    if (!top.length) {
      hud.rankStatus.textContent = 'Ainda não há jogadores ranqueados.';
      return;
    }
    top.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row';

      const pos = document.createElement('span');
      pos.className = 'rk-pos';
      pos.textContent = MEDALS[i] || `#${i + 1}`;

      const dot = document.createElement('span');
      dot.className = 'rk-dot' + (p.online ? ' on' : '');

      const name = document.createElement('span');
      name.className = 'rk-name';
      name.textContent = p.username;

      const lvl = document.createElement('span');
      lvl.className = 'rk-lvl';
      lvl.textContent = `NV ${p.level}`;

      const wins = document.createElement('span');
      wins.className = 'rk-stat';
      wins.textContent = `${p.wins} vit.`;

      const kd = document.createElement('span');
      kd.className = 'rk-stat';
      kd.textContent = `${(p.kills / Math.max(1, p.deaths)).toFixed(2)} K/D`;

      row.append(pos, dot, name, lvl, wins, kd);
      row.onclick = () => openPlayerProfile(p.username);
      hud.rankList.appendChild(row);
    });
  } catch {
    hud.rankStatus.textContent = 'Falha ao carregar o ranking.';
  }
}

async function openPlayerProfile(username) {
  hud.pmStatus.textContent = '';
  try {
    const p = await apiPublicGet(`/players/${encodeURIComponent(username)}`);
    hud.pmDot.className = p.online ? 'on' : '';
    hud.pmName.textContent = p.username;
    hud.pmLevel.textContent = p.level;
    const since = new Date(p.createdAt);
    hud.pmSince.textContent = `${p.online ? 'online agora' : 'offline'} · jogando desde ${since.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    const inLevel = p.xp - (p.level - 1) * 500;
    hud.pmXpFill.style.width = `${Math.min(100, (inLevel / 500) * 100)}%`;
    hud.pmXpText.textContent = `${inLevel} / 500 XP · total ${p.xp}`;
    const s = p.stats;
    hud.pmWins.textContent = s.wins;
    hud.pmMatches.textContent = s.matchesPlayed;
    hud.pmWinrate.textContent = `${Math.round((s.wins / Math.max(1, s.matchesPlayed)) * 100)}%`;
    hud.pmKills.textContent = s.kills;
    hud.pmDeaths.textContent = s.deaths;
    hud.pmKd.textContent = (s.kills / Math.max(1, s.deaths)).toFixed(2);
    hud.pmHs.textContent = s.headshots;
    hud.pmHsrate.textContent = `${Math.round((s.headshots / Math.max(1, s.kills)) * 100)}%`;

    const isSelf = auth && auth.username.toLowerCase() === p.username.toLowerCase();
    hud.pmAddFriend.classList.toggle('hidden', !auth || isSelf);
    hud.pmAddFriend.onclick = async () => {
      hud.pmStatus.style.color = '';
      try {
        await apiAuth('POST', '/friends/request', auth.token, { username: p.username });
        hud.pmStatus.style.color = '#6ee0c8';
        hud.pmStatus.textContent = 'Pedido de amizade enviado!';
        refreshFriends();
      } catch (err) {
        hud.pmStatus.style.color = '#f0806a';
        hud.pmStatus.textContent = FRIEND_ERRORS[err.code] || 'Falha ao enviar pedido.';
      }
    };

    hud.playerModal.classList.remove('hidden');
  } catch (err) {
    if (err.code === 'user_not_found') hud.rankStatus.textContent = 'Jogador não encontrado.';
    else hud.rankStatus.textContent = 'Falha ao carregar perfil.';
  }
}

hud.pmClose.onclick = () => hud.playerModal.classList.add('hidden');
hud.playerModal.addEventListener('click', e => {
  if (e.target === hud.playerModal) hud.playerModal.classList.add('hidden');
});

hud.rankSearchBtn.onclick = () => {
  const q = hud.rankSearch.value.trim();
  if (q.length >= 3) openPlayerProfile(q);
  else hud.rankStatus.textContent = 'Digite pelo menos 3 caracteres.';
};
hud.rankSearch.addEventListener('keydown', e => { if (e.key === 'Enter') hud.rankSearchBtn.onclick(); });

// ---------------- Estado ----------------
const me = {
  id: null, name: '', color: '#3fc8b4', hp: 100, dead: false, team: null,
  pos: new THREE.Vector3(0, 0, 20), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, grounded: false, coyote: 0,
  sliding: false, slideT: 0, slideDir: new THREE.Vector2(),
  slideEnergy: 100, slideCooldownT: 0,
  eyeH: PLAYER.EYE, stepT: 0,
  kits: 0, usingKit: 0,
  nades: NADE.COUNT_START, smokes: SMOKE.COUNT_START
};
const SLIDE_MAX_ENERGY = 100, SLIDE_COST = 40, SLIDE_REGEN_DELAY = 1, SLIDE_REGEN_RATE = 30;
const KIT_USE_TIME = 1, KIT_HEAL = 50;
let lastKillTime = 0, multiKillCount = 0;
const MULTI_KILL_WINDOW = 4;

// times (TDM) — cores absolutas, iguais para todos
const TEAM_COLORS = ['#f0844c', '#5c9ce8'];
const TEAM_NAMES = ['LARANJA', 'AZUL'];
function teamOf(team, fallback) {
  return (roomInfo && roomInfo.gm === 'tdm' && (team === 0 || team === 1)) ? TEAM_COLORS[team] : fallback;
}
let playing = false, connected = false;
let inRoom = false, matchEnded = false;
let roomInfo = null;         // {code, mode, kl, end}
let lastInvite = null;       // {from, code}
let endCountTimer = null;
const remotes = new Map();   // id -> {model, meta, target, dead...}
const meta = new Map();      // id -> {name,color,k,d,bot}
const net = new Net();
const _qs = new URLSearchParams(location.search);
const SMOKEDEMO = _qs.has('smokedemo');
const TESTMODE = _qs.has('test') || SMOKEDEMO;   // smokedemo também ignora pointer lock

// medição de ping (RTT real via ping/pong no WebSocket)
net.on('pong', msg => {
  const rtt = performance.now() - msg.ts;
  ping = ping ? Math.round(ping * 0.6 + rtt * 0.4) : Math.round(rtt);
});
setInterval(() => { if (net.open) net.send({ t: 'ping', ts: performance.now() }); }, 2000);

// nascer olhando para o centro da arena
function faceCenter() {
  me.yaw = Math.atan2(me.pos.x, me.pos.z);
  me.pitch = 0;
}

// ---------------- Armas ----------------
// Índice da faca no arsenal (slot de corpo a corpo)
const KNIFE = 2;
const GRENADE = 3;   // viewmodel da granada de frag — ação overlay, não um "slot"
const SMOKE_VM = 4;  // viewmodel da granada de fumaça
const WEAPONS = [
  { name: 'FALCÃO-9', dmg: 16, head: 1.75, int: 0.115, mag: 26, reload: 1.35, spread: 0.012, auto: true, kick: 0.012, sniper: false },
  { name: 'FERRÃO-SR', dmg: 92, head: 2, int: 1.05, mag: 5, reload: 1.8, spread: 0.05, auto: false, kick: 0.05, sniper: true },
  // Faca: arma de oportunidade. Curtíssimo alcance, alto risco/recompensa.
  { name: 'PRESA-7', melee: true, sniper: false, auto: false,
    light: { dmg: 55, range: 2.5, arc: 0.62, cd: 0.5,  wind: 0.1,  lunge: 3.6, kick: 0.05 },   // arc = cos do meio-ângulo do cone
    heavy: { dmg: 80, range: 2.9, arc: 0.6,  cd: 0.85, wind: 0.22, lunge: 6.4, kick: 0.09 } }
];
const WEAPON_ICONS = ['⚡', '◎', '🗡', '💣'];
const ammo = [WEAPONS[0].mag, WEAPONS[1].mag];
let curW = 0, lastShot = 0, reloading = 0, zoomed = false, recoil = 0, swapT = 0, camShake = 0;

const vmAR = makeViewmodel('ar');
const vmSR = makeViewmodel('sr');
const vmKnife = makeViewmodel('knife');
const vmNade = makeViewmodel('nade');
const vmSmoke = makeViewmodel('smoke');
const vmRoot = new THREE.Group();
vmRoot.position.set(0.26, -0.24, -0.5);
vmRoot.add(vmAR.group, vmSR.group, vmKnife.group, vmNade.group, vmSmoke.group);
vmSR.group.visible = false;
vmKnife.group.visible = false;
vmNade.group.visible = false;
vmSmoke.group.visible = false;
vmRoot.visible = false; // oculto até entrar na partida
camera.add(vmRoot);
scene.add(camera);
const viewmodels = [vmAR, vmSR, vmKnife, vmNade, vmSmoke];

// mostra só a viewmodel do índice `i` (guns e faca)
function showViewmodel(i) {
  for (let k = 0; k < viewmodels.length; k++) viewmodels[k].group.visible = k === i;
}

// ---------------- Efeitos ----------------
const effects = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
const flashTex = spriteTex('#fff8e0', '#ffb040');
const dustTex = spriteTex('#e8cfa8', '#b08a5c');
const bloodTex = spriteTex('#ff7060', '#a02020');
const poofTex = spriteTex('#d0f0e8', '#3fc8b4');

// Material pools — evita criar+destruir material a cada tiro (reduz GC pressure)
const _tracerPool = [];
const _spritePool = [];
const _tracerMat = new THREE.MeshBasicMaterial({
  color: 0xffd9a0, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false
});
const _tracerMatAlt = new THREE.MeshBasicMaterial({
  color: 0xffc080, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false
});
const _flashMat = new THREE.SpriteMaterial({
  map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});

function getTracerMesh(color) {
  if (_tracerPool.length > 0) {
    const m = _tracerPool.pop();
    m.material = color === 0xffc080 ? _tracerMatAlt : _tracerMat;
    m.visible = true;
    return m;
  }
  return new THREE.Mesh(tracerGeo, color === 0xffc080 ? _tracerMatAlt : _tracerMat);
}

// Cache shared SpriteMaterials per texture to avoid per-particle allocation
const _particleMatCache = new Map();
function getParticleMat(texture) {
  if (!_particleMatCache.has(texture)) {
    _particleMatCache.set(texture, new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false
    }));
  }
  return _particleMatCache.get(texture);
}

function spawnTracer(a, b, color = 0xffd9a0) {
  const len = a.distanceTo(b);
  if (len < 0.5) return;
  const m = getTracerMesh(color);
  m.scale.set(0.03, 0.03, len);
  m.position.copy(a).lerp(b, 0.5);
  m.lookAt(b);
  scene.add(m);
  effects.push({ obj: m, ttl: 0.07, life: 0.07, kind: 'tracer' });
}

function spawnBurst(point, texture, n = 6, speed = 3, size = 0.14, up = 2) {
  if (settings.particles === 'off') return;
  const count = settings.particles === 'low' ? Math.ceil(n * 0.4) : n;
  const mat = getParticleMat(texture);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(mat);
    s.position.copy(point);
    s.scale.setScalar(size * (0.7 + Math.random() * 0.6));
    scene.add(s);
    effects.push({
      obj: s, ttl: 0.35, life: 0.35, kind: 'particle',
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * up,
        (Math.random() - 0.5) * speed)
    });
  }
}

function spawnFlash(pos) {
  const s = new THREE.Sprite(_flashMat);
  s.position.copy(pos);
  s.scale.setScalar(0.28 + Math.random() * 0.15);
  scene.add(s);
  effects.push({ obj: s, ttl: 0.05, life: 0.05, kind: 'fade' });
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.ttl -= dt;
    if (e.ttl <= 0) {
      scene.remove(e.obj);
      if (e.kind === 'tracer') {
        e.obj.visible = false;
        _tracerPool.push(e.obj); // recycle tracer mesh
      } else if (e.kind === 'shockwave') {
        e.obj.geometry.dispose(); e.obj.material.dispose(); // geometria/material únicos por explosão
      } else if (e.kind === 'nadeflash') {
        e.obj.material.dispose(); // sprite: geometria é compartilhada internamente pelo THREE, não descartar
      }
      // shared materials are NOT disposed — they're reused
      effects.splice(i, 1);
      continue;
    }
    if (e.kind === 'tracer' || e.kind === 'fade' || e.kind === 'nadeflash') {
      e.obj.material.opacity = e.ttl / e.life;
    } else if (e.kind === 'particle') {
      e.vel.y -= 9 * dt;
      e.obj.position.addScaledVector(e.vel, dt);
      e.obj.scale.setScalar(e.obj.scale.x * (0.92 + 0.08 * (e.ttl / e.life)));
    } else if (e.kind === 'shockwave') {
      const t = 1 - e.ttl / e.life;
      const scale = 1 + t * (NADE.DMG_RADIUS * 2.2);
      e.obj.scale.set(scale, scale, scale);
      e.obj.material.opacity = (1 - t) * 0.8;
    }
  }
}

// ---------------- Nametags ----------------
function makeNametag(name, color) {
  const sz = settings.texq === 'low' ? 128 : 256;
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz >> 2;
  const ctx = c.getContext('2d');
  const fs = sz === 128 ? 17 : 34;
  ctx.font = `bold ${fs}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = sz === 128 ? 3 : 6;
  ctx.strokeStyle = 'rgba(20,14,8,0.85)';
  ctx.strokeText(name, sz >> 1, c.height - (sz === 128 ? 6 : 22));
  ctx.fillStyle = color;
  ctx.fillText(name, sz >> 1, c.height - (sz === 128 ? 6 : 22));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.9, 0.48, 1);
  s.position.y = 2.35;
  return s;
}

// ---------------- Jogadores remotos ----------------
function addRemote(p) {
  if (p.id === me.id || remotes.has(p.id)) return;
  meta.set(p.id, { name: p.name, color: p.color, team: p.team, k: p.k || 0, d: p.d || 0, bot: p.bot });
  const col = teamOf(p.team, p.color);
  const model = makeCharacter(col);
  model.position.set(p.pos[0], p.pos[1], p.pos[2]);
  model.add(makeNametag(p.name, col));
  scene.add(model);
  remotes.set(p.id, {
    model, hp: p.hp, alive: p.hp > 0,
    target: new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]),
    yaw: 0, tYaw: 0, pitch: 0, anim: 0, walkT: 0, deadT: 0
  });
}

// reconstrói o modelo de um remoto (usado quando ele troca de time)
function rebuildRemoteModel(id) {
  const r = remotes.get(id), m = meta.get(id);
  if (!r || !m) return;
  const col = teamOf(m.team, m.color);
  scene.remove(r.model);
  const model = makeCharacter(col);
  model.position.copy(r.model.position);
  model.rotation.copy(r.model.rotation);
  model.add(makeNametag(m.name, col));
  scene.add(model);
  r.model = model;
}

function removeRemote(id) {
  const r = remotes.get(id);
  if (r) scene.remove(r.model);
  remotes.delete(id);
  meta.delete(id);
}

function updateRemotes(dt, t) {
  const smp = sampleSnapshots();
  for (const [id, r] of remotes) {
    const u = r.model.userData;
    if (!r.alive) {
      // animação de queda
      r.deadT += dt;
      r.model.rotation.x = Math.min(r.deadT * 5, 1) * -Math.PI / 2;
      r.model.position.y = Math.max(r.target.y - Math.min(r.deadT * 2, 1) * 0.4, r.target.y - 0.4);
      if (r.deadT > 1.4) r.model.visible = false;
      continue;
    }

    // posição/rotação interpoladas entre dois snapshots do servidor
    if (smp) {
      const a0 = smp.a.p[id];
      const a1 = smp.b ? smp.b.p[id] : null;
      let px, py, pz, yw, pt;
      if (a0 && a1) {
        // teleporte (respawn): não desliza pelo mapa
        if (Math.hypot(a1[0] - a0[0], a1[2] - a0[2]) > 12) {
          px = a1[0]; py = a1[1]; pz = a1[2]; yw = a1[3]; pt = a1[4];
        } else {
          const al = smp.alpha;
          px = a0[0] + (a1[0] - a0[0]) * al;
          py = a0[1] + (a1[1] - a0[1]) * al;
          pz = a0[2] + (a1[2] - a0[2]) * al;
          let dyw = a1[3] - a0[3];
          while (dyw > Math.PI) dyw -= Math.PI * 2;
          while (dyw < -Math.PI) dyw += Math.PI * 2;
          yw = a0[3] + dyw * al;
          pt = a0[4] + (a1[4] - a0[4]) * al;
        }
      } else if (a0 || a1) {
        const a = a0 || a1;
        px = a[0]; py = a[1]; pz = a[2]; yw = a[3]; pt = a[4];
      }
      if (px !== undefined) {
        r.model.position.set(px, py, pz);
        r.target.set(px, py, pz);
        r.yaw = yw;
        r.pitch = pt;
      }
    }
    r.model.rotation.y = r.yaw;
    const wsel = (r.anim >> 2) & 3;          // arma/faca em uso
    if (u.gun) u.gun.visible = wsel !== 2;
    if (u.knife) u.knife.visible = wsel === 2;
    u.arms.rotation.x = -r.pitch * 0.7;
    u.head.rotation.x = -r.pitch * 0.4;
    const moving = r.anim & 1, sliding = r.anim & 2;
    if (sliding) {
      r.model.rotation.x = -0.5;
      u.legL.rotation.x = u.legR.rotation.x = 1.2;
    } else if (moving) {
      r.model.rotation.x = 0;
      r.walkT += dt * 11;
      u.legL.rotation.x = Math.sin(r.walkT) * 0.7;
      u.legR.rotation.x = -Math.sin(r.walkT) * 0.7;
    } else {
      r.model.rotation.x = 0;
      u.legL.rotation.x *= 0.8;
      u.legR.rotation.x *= 0.8;
    }
  }
}

// ---------------- Input ----------------
const keys = {};
let mouseDown = false, wantJump = false;
const canvas = renderer.domElement;

addEventListener('keydown', e => {
  if (playing && e.code === binds.board) { e.preventDefault(); hud.board.classList.add('show'); rebuildBoard(); }
  if (e.repeat) return;
  keys[e.code] = true;
  // F durante a morte: pula o killcam e volta direto pro jogo
  if (playing && me.dead && e.code === 'KeyF') { requestRespawn(); return; }
  if (!playing || me.dead) return;
  if (e.code === binds.jump) wantJump = true;
  if (e.code === binds.reload) startReload();
  if (e.code === binds.kit) tryUseKit();
  if (e.code === binds.w1) switchWeapon(0);
  if (e.code === binds.w2) switchWeapon(1);
  if (e.code === binds.w3) switchWeapon(KNIFE);
  if (e.code === binds.melee) quickMelee();
  if (e.code === binds.nade) startNadeCook('frag');
  if (e.code === binds.smoke) startNadeCook('smoke');
  if (e.code === 'KeyF' && curW === KNIFE) startInspect();
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === binds.board) hud.board.classList.remove('show');
  if (e.code === binds.nade || e.code === binds.smoke) releaseNadeThrow();
});
addEventListener('wheel', () => { if (playing && !me.dead) switchWeapon(1 - curW); });
canvas.addEventListener('mousedown', e => {
  if (!playing) return;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (nadeState.cooking || nadeState.throwing) return;   // mãos ocupadas com a granada
  if (e.button === 0) {
    mouseDown = true;
    if (curW === KNIFE) startMelee(false); else tryFire();
  }
  if (e.button === 2) {
    if (curW === KNIFE) startMelee(true);
    else if (WEAPONS[curW].sniper && !reloading && !me.dead) setZoom(true);
  }
});
addEventListener('mouseup', e => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) setZoom(false);
});
addEventListener('contextmenu', e => e.preventDefault());
// perder o foco com a granada "puxada" nunca pode travar as outras ações —
// se o keyup nunca chegar (alt-tab), cancela o cook defensivamente
addEventListener('blur', () => cancelNadeCook());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || !playing || me.dead) return;
  const s = (+hud.sens.value) * (zoomed ? 0.35 : 1) * 0.0022;
  me.yaw -= e.movementX * s;
  me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - e.movementY * s));
});
document.addEventListener('pointerlockchange', () => {
  if (TESTMODE) return;
  if (document.pointerLockElement !== canvas && playing) {
    hud.menu.classList.remove('hidden');
    closeScreen();
    setMenuMode(true);
    mouseDown = false;
  } else if (playing) {
    hud.menu.classList.add('hidden');
  }
});

function setZoom(z) {
  zoomed = z && WEAPONS[curW].sniper;
  hud.scope.classList.toggle('show', zoomed);
  vmRoot.visible = playing && !zoomed;
}

function switchWeapon(i) {
  if (i === curW || reloading || me.dead || me.usingKit > 0) return;
  if (melee.active && melee.quick) return;   // não interromper um golpe rápido em curso
  if (nadeState.cooking || nadeState.throwing) return;   // mãos ocupadas com a granada
  curW = i;
  swapT = 0.25;
  setZoom(false);
  cancelMelee();
  showViewmodel(i);
  if (i === KNIFE) { SFX.knifeEquip(); knifeEquipT = 0.32; } else SFX.swap();
  updateAmmoHUD();
}

// ---------------- Movimentação ----------------
const R = PLAYER.R, H = PLAYER.H;

function collidesAt(x, feetY, z) {
  if (feetY < -0.001) return true;
  for (const b of BOUNDS) {
    if (x + R > b.minx && x - R < b.maxx &&
        z + R > b.minz && z - R < b.maxz &&
        feetY < b.maxy && feetY + H > b.miny) return true;
  }
  return false;
}

function stepTopAt(x, feetY, z) {
  let top = -1;
  for (const b of BOUNDS) {
    if (x + R > b.minx && x - R < b.maxx &&
        z + R > b.minz && z - R < b.maxz &&
        feetY < b.maxy && feetY + H > b.miny) {
      if (b.maxy - feetY <= 0.95 && b.maxy > top) top = b.maxy;
    }
  }
  return top;
}

function moveHoriz(axis, delta) {
  if (delta === 0) return;
  const nx = axis === 'x' ? me.pos.x + delta : me.pos.x;
  const nz = axis === 'z' ? me.pos.z + delta : me.pos.z;
  if (!collidesAt(nx, me.pos.y, nz)) {
    me.pos.x = nx; me.pos.z = nz;
    return;
  }
  // tentar subir degrau
  if (me.grounded) {
    const top = stepTopAt(nx, me.pos.y, nz);
    if (top >= 0 && !collidesAt(nx, top + 0.002, nz)) {
      me.pos.x = nx; me.pos.z = nz; me.pos.y = top + 0.002;
      return;
    }
  }
  if (axis === 'x') me.vel.x = 0; else me.vel.z = 0;
}

function updateMovement(dt) {
  const spd = 8.2, accG = 60, accA = 16, fric = me.sliding ? 1.6 : 10;
  // direção desejada
  let fx = 0, fz = 0;
  if (keys[binds.forward]) fz += 1;
  if (keys[binds.back]) fz -= 1;
  if (keys[binds.left]) fx -= 1;
  if (keys[binds.right]) fx += 1;
  const len = Math.hypot(fx, fz) || 1;
  fx /= len; fz /= len;
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  const wx = (-sy) * fz + cy * fx;
  const wz = (-cy) * fz + (-sy) * fx;

  // slide (com limite de energia — tipo sprint: gasta ao usar, recarrega parado)
  if (keys[binds.slide] && me.grounded && !me.sliding && (fx || fz) &&
      Math.hypot(me.vel.x, me.vel.z) > 4 && me.slideEnergy >= SLIDE_COST) {
    me.sliding = true;
    me.slideT = 0.85;
    me.slideEnergy -= SLIDE_COST;
    me.slideCooldownT = SLIDE_REGEN_DELAY;
    updateSlideHUD();
    const h = Math.hypot(me.vel.x, me.vel.z);
    const boost = Math.max(h, 12.6);
    const nx2 = me.vel.x / (h || 1), nz2 = me.vel.z / (h || 1);
    me.vel.x = nx2 * boost; me.vel.z = nz2 * boost;
    SFX.land(0.5);
  }
  if (me.sliding) {
    me.slideT -= dt;
    if (me.slideT <= 0 || !keys[binds.slide] || !me.grounded) me.sliding = false;
  }
  if (!me.sliding) {
    if (me.slideCooldownT > 0) me.slideCooldownT -= dt;
    else if (me.slideEnergy < SLIDE_MAX_ENERGY) {
      me.slideEnergy = Math.min(SLIDE_MAX_ENERGY, me.slideEnergy + SLIDE_REGEN_RATE * dt);
      updateSlideHUD();
    }
  }

  // fricção + aceleração
  if (me.grounded) {
    const f = Math.exp(-fric * dt);
    me.vel.x *= f; me.vel.z *= f;
  }
  const acc = (me.grounded ? accG : accA) * (me.sliding ? 0.25 : 1);
  me.vel.x += wx * acc * dt;
  me.vel.z += wz * acc * dt;
  // limitar velocidade horizontal
  const hv = Math.hypot(me.vel.x, me.vel.z);
  const maxV = me.sliding ? 13.5 : spd;
  if (hv > maxV && me.grounded && !me.sliding) {
    me.vel.x *= maxV / hv; me.vel.z *= maxV / hv;
  }

  // pulo (com coyote time)
  me.coyote = me.grounded ? 0.1 : Math.max(0, me.coyote - dt);
  if (wantJump && (me.grounded || me.coyote > 0)) {
    me.vel.y = 8.8;
    me.grounded = false;
    me.coyote = 0;
    me.sliding = false;
    SFX.jump();
  }
  wantJump = false;

  // gravidade
  me.vel.y -= 24 * dt;

  // mover eixo a eixo
  moveHoriz('x', me.vel.x * dt);
  moveHoriz('z', me.vel.z * dt);

  // vertical
  const oldY = me.pos.y;
  let ny = me.pos.y + me.vel.y * dt;
  const wasAir = !me.grounded;
  me.grounded = false;
  if (me.vel.y <= 0) {
    if (ny <= 0) { ny = 0; landOn(wasAir); }
    else if (collidesAt(me.pos.x, ny, me.pos.z)) {
      let landY = 0;
      for (const b of BOUNDS) {
        if (me.pos.x + R > b.minx && me.pos.x - R < b.maxx &&
            me.pos.z + R > b.minz && me.pos.z - R < b.maxz &&
            b.maxy <= oldY + 0.05 && b.maxy > landY) landY = b.maxy;
      }
      ny = landY;
      landOn(wasAir);
    }
  } else if (collidesAt(me.pos.x, ny, me.pos.z)) {
    me.vel.y = 0;
    ny = oldY;
  }
  me.pos.y = ny;
  // suporte logo abaixo mantém grounded
  if (!me.grounded && me.vel.y <= 0 &&
      (me.pos.y <= 0.001 || collidesAt(me.pos.x, me.pos.y - 0.05, me.pos.z))) {
    me.grounded = true;
  }

  function landOn(fromAir) {
    if (fromAir && me.vel.y < -9) SFX.land(Math.min(1, -me.vel.y / 16));
    me.vel.y = 0;
    me.grounded = true;
  }

  // passos
  if (me.grounded && hv > 3 && !me.sliding) {
    me.stepT -= dt * (hv / 8);
    if (me.stepT <= 0) { me.stepT = 0.36; SFX.step(); }
  }

  // altura do olho (slide abaixa a câmera)
  const targetEye = me.sliding ? 0.95 : PLAYER.EYE;
  me.eyeH += (targetEye - me.eyeH) * Math.min(1, 14 * dt);
}

// ---------------- Tiro ----------------
const _dir = new THREE.Vector3(), _origin = new THREE.Vector3(), _muzzleV = new THREE.Vector3();

function tryFire() {
  const w = WEAPONS[curW];
  if (w.melee) return;   // a faca ataca por startMelee, não por tryFire
  const now = performance.now() / 1000;
  if (!playing || matchEnded || me.dead || reloading > 0 || swapT > 0 || me.usingKit > 0) return;
  if (nadeState.cooking || nadeState.throwing) return;   // mãos ocupadas com a granada
  if (now - lastShot < w.int) return;
  if (ammo[curW] <= 0) { SFX.empty(); startReload(); return; }
  lastShot = now;
  ammo[curW]--;

  camera.getWorldDirection(_dir);
  const spread = w.sniper && zoomed ? 0 : w.spread;
  if (spread > 0) {
    _dir.x += (Math.random() - 0.5) * spread * 2;
    _dir.y += (Math.random() - 0.5) * spread * 2;
    _dir.z += (Math.random() - 0.5) * spread * 2;
    _dir.normalize();
  }
  _origin.copy(me.pos); _origin.y += me.eyeH;

  // raycast: mapa
  const tMap = raycastSolids(_origin.x, _origin.y, _origin.z, _dir.x, _dir.y, _dir.z);
  // raycast: jogadores
  let hitId = null, hitT = tMap, headshot = false;
  const tdm = roomInfo && roomInfo.gm === 'tdm';
  for (const [id, r] of remotes) {
    if (!r.alive) continue;
    if (tdm) { const m = meta.get(id); if (m && m.team === me.team) continue; } // sem fogo amigo
    const p = r.model.position;
    // cabeça (esfera)
    const hx = p.x - _origin.x, hy = p.y + PLAYER.HEAD_Y - _origin.y, hz = p.z - _origin.z;
    const tc = hx * _dir.x + hy * _dir.y + hz * _dir.z;
    if (tc > 0) {
      const d2 = hx * hx + hy * hy + hz * hz - tc * tc;
      if (d2 < PLAYER.HEAD_R * PLAYER.HEAD_R && tc < hitT) {
        hitT = tc; hitId = id; headshot = true;
        continue;
      }
    }
    // corpo (AABB)
    const bb = {
      minx: p.x - R, maxx: p.x + R,
      miny: p.y, maxy: p.y + PLAYER.BODY_H,
      minz: p.z - R, maxz: p.z + R
    };
    const tb = rayBoxLocal(_origin, _dir, bb);
    if (tb < hitT) { hitT = tb; hitId = id; headshot = false; }
  }

  const endPoint = _origin.clone().addScaledVector(_dir, Math.min(hitT, 150));

  // efeitos locais
  const vm = viewmodels[curW];
  if (vmRoot.visible) {
    vm.muzzle.getWorldPosition(_muzzleV);
    spawnFlash(_muzzleV);
    spawnTracer(_muzzleV.clone(), endPoint);
  } else {
    spawnTracer(_origin.clone().addScaledVector(_dir, 1.2), endPoint);
  }
  recoil += w.kick;
  vmKick = Math.min(vmKick + 0.06, 0.12);
  SFX.shot(w.sniper);

  if (hitId !== null) {
    spawnBurst(endPoint, bloodTex, 6, 2.5, 0.16);   // sangue previsto; o dano real vem do servidor
  } else if (hitT < 150) {
    spawnBurst(endPoint, dustTex, 5, 2, 0.13);
  }

  // O servidor é quem decide o acerto: enviamos direção + o instante do mundo
  // que estamos vendo (sv); ele rebobina e valida (lag compensation).
  const smp = sampleSnapshots();
  net.send({
    t: 'fire',
    o: [_origin.x, _origin.y, _origin.z],
    d: [_dir.x, _dir.y, _dir.z],
    w: curW,
    sv: smp && smp.sv ? smp.sv : undefined
  });
  updateAmmoHUD();
  if (ammo[curW] <= 0) startReload();
}

function rayBoxLocal(o, d, b) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [[o.x, d.x, b.minx, b.maxx], [o.y, d.y, b.miny, b.maxy], [o.z, d.z, b.minz, b.maxz]];
  for (const [ov, dv, mn, mx] of axes) {
    if (Math.abs(dv) < 1e-9) { if (ov < mn || ov > mx) return Infinity; continue; }
    let t1 = (mn - ov) / dv, t2 = (mx - ov) / dv;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
  }
  if (tmax < Math.max(tmin, 0)) return Infinity;
  return Math.max(tmin, 0);
}

function startReload() {
  const w = WEAPONS[curW];
  if (w.melee || reloading > 0 || ammo[curW] === w.mag || me.dead || me.usingKit > 0) return;
  if (nadeState.cooking || nadeState.throwing) return;   // mãos ocupadas com a granada
  reloading = w.reload;
  setZoom(false);
  SFX.reload();
  hud.wname.textContent = 'RECARREGANDO…';
}

// ============================================================
// FACA — combate corpo a corpo (Módulo 01)
// Slot próprio (tecla 3) + golpe rápido (V) com qualquer arma.
// Ataque leve (LMB) e ataque pesado/estocada (RMB). Servidor é
// autoritativo: o cliente só prevê efeitos e envia o golpe.
// ============================================================
const melee = {
  active: false,     // há um ataque em andamento
  heavy: false,      // ataque pesado (estocada) vs leve (corte)
  t: 0,              // tempo dentro do ataque
  dur: 0,            // duração total da animação
  wind: 0,          // wind-up antes do impacto
  struck: false,     // já resolveu o impacto deste ataque
  cd: 0,             // cooldown até o próximo ataque
  quick: false,      // golpe rápido: volta para a arma anterior ao fim
  prevW: 0,          // arma para restaurar após golpe rápido
  swingSeed: 1       // ±1 alterna o lado do corte (esq/dir) para variar
};
let knifeEquipT = 0;   // animação de sacar (>0)
let knifeInspectT = 0; // animação de inspeção (>0)
let knifeIdleT = 0;    // fase da respiração no idle

// origem/direção do golpe (reaproveitados)
const _mOrigin = new THREE.Vector3(), _mDir = new THREE.Vector3(), _mTmp = new THREE.Vector3();

function meleeStats(heavy) { return WEAPONS[KNIFE][heavy ? 'heavy' : 'light']; }

// Inicia um ataque com a faca. `quick` = golpe relâmpago com outra arma na mão.
function startMelee(heavy, quick = false) {
  if (!playing || matchEnded || me.dead || me.usingKit > 0) return;
  if (melee.active || melee.cd > 0 || reloading > 0 || swapT > 0) return;
  if (nadeState.cooking || nadeState.throwing) return;   // mãos ocupadas com a granada
  const st = meleeStats(heavy);
  melee.active = true;
  melee.heavy = heavy;
  melee.quick = quick;
  melee.t = 0;
  melee.wind = st.wind;
  melee.dur = st.wind + (heavy ? 0.42 : 0.32);
  melee.struck = false;
  melee.cd = melee.dur + (heavy ? 0.12 : 0.06);
  melee.swingSeed = -melee.swingSeed;
  knifeInspectT = 0;

  if (quick) {
    melee.prevW = curW;
    showViewmodel(KNIFE);
  }

  // pequena estocada para a frente (fecha distância — game feel)
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  me.vel.x += fx * st.lunge;
  me.vel.z += fz * st.lunge;

  SFX.knifeSwing();
}

// Golpe rápido (tecla V): saca a faca por um instante, ataca e volta.
function quickMelee() {
  if (curW === KNIFE) { startMelee(false, false); return; }
  startMelee(false, true);
}

function cancelMelee() {
  melee.active = false;
  melee.quick = false;
  melee.struck = true;
  knifeInspectT = 0;
}

function startInspect() {
  if (curW !== KNIFE || melee.active || me.dead) return;
  knifeInspectT = 0.001; // dispara a animação
}

// Momento do impacto: resolve o golpe (efeito local previsto + envio ao servidor).
function meleeStrike() {
  const st = meleeStats(melee.heavy);
  camera.getWorldDirection(_mDir);
  _mOrigin.copy(me.pos); _mOrigin.y += me.eyeH;

  // previsão local só para efeitos (o dano real vem do servidor)
  const hit = predictMeleeTarget(_mOrigin, _mDir, st.range, st.arc);
  if (hit) {
    const bp = hit.model.position;
    _mTmp.set(bp.x, bp.y + PLAYER.HEAD_Y * 0.7, bp.z);
    spawnBurst(_mTmp, bloodTex, melee.heavy ? 9 : 6, 2.6, 0.16, 2);
  } else {
    // acertou parede/obstáculo dentro do alcance? faísca curta
    const tMap = raycastSolids(_mOrigin.x, _mOrigin.y, _mOrigin.z, _mDir.x, _mDir.y, _mDir.z);
    if (tMap <= st.range) {
      _mTmp.copy(_mOrigin).addScaledVector(_mDir, tMap - 0.05);
      spawnBurst(_mTmp, dustTex, 4, 1.6, 0.1, 1);
    }
  }

  recoil += st.kick;
  camShake = Math.min(camShake + (melee.heavy ? 0.05 : 0.03), 0.08);

  // envia o golpe: servidor valida cadência, alcance, cone, rebobina e aplica dano
  const smp = sampleSnapshots();
  net.send({
    t: 'melee',
    o: [_mOrigin.x, _mOrigin.y, _mOrigin.z],
    d: [_mDir.x, _mDir.y, _mDir.z],
    h: melee.heavy ? 1 : 0,
    sv: smp && smp.sv ? smp.sv : undefined
  });
}

// Alvo mais próximo dentro do alcance e do cone frontal, com LOS livre.
// Usado só para PREVER efeitos no cliente (autoridade é do servidor).
function predictMeleeTarget(origin, dir, range, arc) {
  const tdm = roomInfo && roomInfo.gm === 'tdm';
  let best = null, bestD = range;
  for (const [id, r] of remotes) {
    if (!r.alive) continue;
    if (tdm) { const m = meta.get(id); if (m && m.team === me.team) continue; }
    const p = r.model.position;
    const cx = p.x - origin.x, cy = (p.y + PLAYER.BODY_H * 0.5) - origin.y, cz = p.z - origin.z;
    const d = Math.hypot(cx, cy, cz);
    if (d > range || d < 0.001) continue;
    const dot = (cx * dir.x + cy * dir.y + cz * dir.z) / d;
    if (dot < arc) continue;                                   // fora do cone frontal
    const tMap = raycastSolids(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
    if (tMap < d - 0.4) continue;                              // parede no caminho
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

// Anima a viewmodel da faca (idle, sacar, inspecionar e ataques leve/pesado).
function updateKnifeViewmodel(dt) {
  const hv = Math.hypot(me.vel.x, me.vel.z);
  knifeIdleT += dt;

  // pose base (offsets a partir da posição neutra da vmRoot)
  let px = 0.02, py = 0.01, pz = 0.02;   // ligeiramente mais próxima e alta que as armas
  let rx = 0, ry = 0, rz = 0;

  // respiração/idle
  py += Math.sin(knifeIdleT * 1.6) * 0.006;
  rz += Math.sin(knifeIdleT * 1.1) * 0.02;

  // bob ao andar
  if (me.grounded && hv > 1 && !me.sliding) {
    px += Math.sin(bobT) * 0.01;
    py += Math.abs(Math.sin(bobT)) * 0.012;
  }
  // pose de corrida (sprint): faca recolhida/inclinada
  const sprintK = Math.min(1, Math.max(0, (hv - 9) / 4));
  rx += sprintK * 0.5; ry += sprintK * 0.5; py -= sprintK * 0.05; pz += sprintK * 0.06;

  // sacar a faca
  if (knifeEquipT > 0) {
    knifeEquipT = Math.max(0, knifeEquipT - dt);
    const k = knifeEquipT / 0.32;   // 1→0
    py -= k * 0.22; rx += k * 1.1; rz += k * 0.5;
  }

  // inspeção (gira a lâmina para o jogador admirar)
  if (knifeInspectT > 0 && !melee.active) {
    knifeInspectT += dt;
    const dur = 2.0, k = knifeInspectT / dur;
    if (k >= 1) { knifeInspectT = 0; }
    else {
      const e = Math.sin(k * Math.PI);          // sobe e volta
      ry += e * 2.0; rx -= e * 0.5; py += e * 0.05; px -= e * 0.05; pz += e * 0.04;
    }
  }

  // ataque: wind-up → estocada/corte → recuperação
  if (melee.active) {
    const st = meleeStats(melee.heavy);
    const side = melee.swingSeed;
    const w = melee.wind;
    if (melee.t < w) {
      // wind-up: puxa a faca para trás/lado
      const k = melee.t / w;                    // 0→1
      rx -= k * 0.6; ry += side * k * 0.7; pz += k * 0.12; px -= side * k * 0.06;
    } else {
      // golpe: varre para frente cruzando a tela
      const gk = Math.min(1, (melee.t - w) / (melee.heavy ? 0.16 : 0.12)); // fase rápida do talho
      const rec = Math.max(0, 1 - (melee.t - w) / (melee.dur - w));         // recuperação
      const swing = Math.sin(gk * Math.PI * 0.5);   // 0→1 acelerando
      pz -= swing * (melee.heavy ? 0.34 : 0.24) * rec + 0.02;
      px += side * (0.12 - swing * 0.26) * rec;
      py -= swing * 0.05 * rec;
      rx += swing * (melee.heavy ? 0.9 : 0.7) * rec;
      rz += side * (0.5 - swing * 1.0) * rec;
      ry -= side * swing * 0.6 * rec;
    }
  }

  // aplica com suavização (a não ser no golpe, que é seco)
  const lerp = melee.active && melee.t >= melee.wind ? 1 : Math.min(1, 16 * dt);
  vmRoot.position.x += ((0.26 + px) - vmRoot.position.x) * lerp;
  vmRoot.position.y += ((-0.24 + py) - vmRoot.position.y) * lerp;
  vmRoot.position.z += ((-0.5 + pz) - vmRoot.position.z) * lerp;
  vmRoot.rotation.x += (rx - vmRoot.rotation.x) * lerp;
  vmRoot.rotation.y += (ry - vmRoot.rotation.y) * lerp;
  vmRoot.rotation.z += (rz - vmRoot.rotation.z) * lerp;
}

// Avança o ataque (impacto no tempo certo e término/retorno de arma).
function updateMeleeState(dt) {
  if (melee.cd > 0) melee.cd = Math.max(0, melee.cd - dt);
  if (!melee.active) return;
  melee.t += dt;
  if (!melee.struck && melee.t >= melee.wind) {
    melee.struck = true;
    meleeStrike();
  }
  if (melee.t >= melee.dur) {
    melee.active = false;
    if (melee.quick) {
      melee.quick = false;
      showViewmodel(curW);   // restaura a arma anterior
      vmRoot.rotation.set(0, 0, 0);
    }
  }
}

// ============================================================
// GRANADA DE FRAGMENTAÇÃO — Módulo 02
// Ação overlay (tecla G, padrão): segurar carrega a força do
// arremesso (com arco de mira previsto), soltar lança. Física
// server-authoritative (shared/nadephysics.js) — o cliente prevê
// o próprio lançamento para resposta instantânea; o servidor tem
// a palavra final sobre posição, quiques e dano (com bloqueio por
// cobertura). Ver server/game/grenades.js.
// ============================================================
const NADE_MAX_CHARGE_MS = 900;   // tempo até atingir força máxima
const NADE_MIN_POWER = 0.35;      // toque rápido ainda lança longe o bastante
const NADE_THROW_ANIM_MS = 0.3;   // duração da animação de arremesso (s)

const nadeState = { cooking: false, chargeT: 0, throwing: false, throwT: 0, kind: 'frag' };
// minha própria granada, ainda sem confirmação do servidor (previsão local)
let myNade = null;   // { mesh, phys, thrownAt, confirmedId, kind }
// granadas de todo mundo (a minha entra aqui assim que o servidor confirma
// o id) — posicionadas via o mesmo buffer de interpolação dos jogadores
const remoteNades = new Map();
// tipo de cada granada em voo (id -> 'frag'|'smoke') para desenhar o modelo
// certo mesmo para lançamentos de outros jogadores
const nadeKinds = new Map();

// pontinhos do arco previsto durante a carga (materiais individuais —
// cada um precisa da própria opacidade, por isso não usam o cache global)
const NADE_ARC_DOTS = 14;
const nadeArcDots = [];
const nadeDotTex = spriteTex('#eafff2', '#3fc8b4');
for (let i = 0; i < NADE_ARC_DOTS; i++) {
  const mat = new THREE.SpriteMaterial({ map: nadeDotTex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(0.05);
  s.visible = false;
  scene.add(s);
  nadeArcDots.push(s);
}
function hideNadeArc() { for (const d of nadeArcDots) d.visible = false; }

// origem + direção do lançamento: câmera com leve viés pra cima (arremesso
// natural mesmo mirando reto — senão a granada só cairia aos pés)
const _nOrigin = new THREE.Vector3(), _nDir = new THREE.Vector3();
function nadeThrowVector() {
  camera.getWorldDirection(_nDir);
  _nDir.y += 0.16;
  _nDir.normalize();
  _nOrigin.copy(me.pos); _nOrigin.y += me.eyeH;
  _nOrigin.addScaledVector(_nDir, 0.3);
  return { origin: _nOrigin, dir: _nDir };
}

// Simula a trajetória prevista (mesma física do servidor) e distribui os
// pontinhos até o primeiro impacto — leitura limpa de onde ela vai parar.
function updateNadeArc(power) {
  const { origin, dir } = nadeThrowVector();
  const phys = launchGrenade(origin, dir, power);
  const dt = 1 / 60;
  let shown = 0;
  for (let i = 0; i < 240 && shown < NADE_ARC_DOTS; i++) {
    const bounced = advanceGrenade(phys, dt);
    if (i % 4 === 3) {
      const dot = nadeArcDots[shown++];
      dot.position.set(phys.pos.x, phys.pos.y, phys.pos.z);
      dot.visible = true;
      dot.material.opacity = 1 - (shown / NADE_ARC_DOTS) * 0.55;
    }
    if (bounced) break;
  }
  for (let i = shown; i < NADE_ARC_DOTS; i++) nadeArcDots[i].visible = false;
}

function nadeCountOf(kind) { return kind === 'smoke' ? me.smokes : me.nades; }

function canStartNade(kind) {
  return playing && !matchEnded && !me.dead && me.usingKit <= 0 &&
    nadeCountOf(kind) > 0 && reloading <= 0 && swapT <= 0 &&
    !melee.active && !nadeState.cooking && !nadeState.throwing && !zoomed;
}

function startNadeCook(kind) {
  if (!canStartNade(kind)) return;
  nadeState.cooking = true;
  nadeState.kind = kind;
  nadeState.chargeT = 0;
  setZoom(false);
  showViewmodel(kind === 'smoke' ? SMOKE_VM : GRENADE);
  refreshNadeHUD();
  SFX.nadePin();
}

function releaseNadeThrow() {
  if (!nadeState.cooking) return;
  nadeState.cooking = false;
  hideNadeArc();
  const kind = nadeState.kind;
  const power = Math.max(NADE_MIN_POWER, Math.min(1, nadeState.chargeT / NADE_MAX_CHARGE_MS));
  const { origin, dir } = nadeThrowVector();

  // previsão local: a granada já sai voando antes do servidor confirmar
  const phys = launchGrenade(origin, dir, power);
  const mesh = kind === 'smoke' ? makeSmokeCanisterMesh() : makeGrenadeMesh();
  mesh.position.set(phys.pos.x, phys.pos.y, phys.pos.z);
  scene.add(mesh);
  myNade = { mesh, phys, thrownAt: performance.now(), confirmedId: null, kind };

  if (kind === 'smoke') me.smokes--; else me.nades--;
  refreshNadeHUD();
  net.send({ t: 'nade', kind, o: [origin.x, origin.y, origin.z], d: [dir.x, dir.y, dir.z], pw: power });

  nadeState.throwing = true;
  nadeState.throwT = 0;
  recoil += 0.02;
  camShake = Math.min(camShake + 0.02, 0.05);
  SFX.nadeThrow();
}

// segurança: nunca deixa o estado travado (perda de foco, morte, etc.)
function cancelNadeCook() {
  if (!nadeState.cooking) return;
  nadeState.cooking = false;
  hideNadeArc();
  showViewmodel(curW);
  vmRoot.rotation.set(0, 0, 0);
  refreshNadeHUD();
}

function updateNadeState(dt) {
  if (nadeState.cooking) {
    nadeState.chargeT = Math.min(NADE_MAX_CHARGE_MS, nadeState.chargeT + dt * 1000);
    updateNadeArc(Math.max(NADE_MIN_POWER, Math.min(1, nadeState.chargeT / NADE_MAX_CHARGE_MS)));
    refreshNadeHUD();
  }
  if (nadeState.throwing) {
    nadeState.throwT += dt;
    if (nadeState.throwT >= NADE_THROW_ANIM_MS) {
      nadeState.throwing = false;
      showViewmodel(curW);
      vmRoot.rotation.set(0, 0, 0);
    }
  }

  // previsão local do meu lançamento, até o servidor confirmar o id
  if (myNade && myNade.confirmedId === null) {
    const bounced = advanceGrenade(myNade.phys, dt);
    myNade.mesh.position.set(myNade.phys.pos.x, myNade.phys.pos.y, myNade.phys.pos.z);
    myNade.mesh.rotation.x += dt * 7; myNade.mesh.rotation.z += dt * 5;
    if (bounced) {
      SFX.nadeBounce(Math.max(0.05, 1 / (1 + me.pos.distanceTo(myNade.mesh.position) * 0.12)));
    }
    // salvaguarda: se o servidor nunca confirmar, resolve localmente mesmo
    // assim — nunca fica uma granada fantasma presa na cena
    const fuse = myNade.kind === 'smoke' ? SMOKE.FUSE_MS : NADE.FUSE_MS;
    if (performance.now() - myNade.thrownAt > fuse + 800) {
      if (myNade.kind === 'smoke') {
        const c = myNade.mesh.position;
        spawnSmokeCloud('local' + Math.random(), new THREE.Vector3(c.x, c.y + SMOKE.CENTER_UP, c.z), SMOKE_LIFE_MS);
      } else spawnNadeExplosionFX(myNade.mesh.position);
      scene.remove(myNade.mesh);
      myNade = null;
    }
  }

  // pulso do acento teal do FRAG — acelera perto da explosão ("vai estourar já")
  const now = performance.now();
  if (myNade && myNade.kind !== 'smoke') pulseNadeMesh(myNade.mesh, now - myNade.thrownAt);
  for (const [id, r] of remoteNades) {
    if (nadeKinds.get(id) !== 'smoke') pulseNadeMesh(r.mesh, now - r.spawnedAt);
  }
}

function pulseNadeMesh(mesh, elapsedMs) {
  const accent = mesh.userData.accent;
  if (!accent) return;
  const remain = Math.max(0, NADE.FUSE_MS - elapsedMs) / NADE.FUSE_MS;
  const rate = 2 + (1 - remain) * 14;
  accent.emissiveIntensity = 0.5 + (Math.sin(elapsedMs * 0.001 * rate * Math.PI * 2) * 0.5 + 0.5) * 1.6 * (1 - remain * 0.4);
}

// ---- granadas remotas: mesmo buffer/interpolação dos jogadores ----
function sampleNades(smp) {
  if (!smp) return null;
  const an = smp.a.n || {}, bn = smp.b ? (smp.b.n || {}) : null;
  const out = {};
  for (const id of Object.keys(an)) out[id] = an[id];
  if (bn) {
    for (const id of Object.keys(bn)) {
      const p0 = an[id], p1 = bn[id];
      out[id] = (p0 && p1)
        ? [p0[0] + (p1[0] - p0[0]) * smp.alpha, p0[1] + (p1[1] - p0[1]) * smp.alpha, p0[2] + (p1[2] - p0[2]) * smp.alpha]
        : p1;
    }
  }
  return out;
}

function updateRemoteNades(dt) {
  const positions = sampleNades(sampleSnapshots());
  if (!positions) return;
  const seen = new Set();
  for (const [id, pos] of Object.entries(positions)) {
    seen.add(id);
    if (myNade && myNade.confirmedId === id) continue;   // já é o mesmo mesh, tratado acima
    let r = remoteNades.get(id);
    if (!r) {
      const mesh = nadeKinds.get(id) === 'smoke' ? makeSmokeCanisterMesh() : makeGrenadeMesh();
      scene.add(mesh);
      r = { mesh, spawnedAt: performance.now() };
      remoteNades.set(id, r);
    }
    r.mesh.position.set(pos[0], pos[1], pos[2]);
    r.mesh.rotation.x += dt * 7; r.mesh.rotation.z += dt * 5;
  }
  for (const [id, r] of remoteNades) {
    if (!seen.has(id)) { scene.remove(r.mesh); remoteNades.delete(id); nadeKinds.delete(id); }   // limpeza defensiva
  }
}

function clearAllNadeMeshes() {
  if (myNade) { scene.remove(myNade.mesh); myNade = null; }
  for (const r of remoteNades.values()) scene.remove(r.mesh);
  remoteNades.clear();
  nadeKinds.clear();
  clearAllSmokeClouds();
  hideNadeArc();
}

// ============================================================
// GRANADA DE FUMAÇA — Módulo 03
// A nuvem é um aglomerado de sprites billboard (puffs) que expande do
// ponto de deploy, ganha densidade, respira (churn) e dissipa. Os puffs
// são "encostados" nas paredes por raycast (não atravessam). Posição e
// tempo de vida vêm do servidor (smokestart) — a geometria é determinística,
// então todos veem a MESMA nuvem no mesmo lugar (oclusão simétrica). O
// servidor também cega os bots que tentam mirar através dela.
// ============================================================
const smokeClouds = new Map();   // id -> { group, puffs, deployAt, dur }
const smokePuffTex = smokeTex();

function smokePuffCount() {
  // nunca 0 mesmo com partículas off — negar visão é gameplay, não enfeite
  return settings.particles === 'off' ? 15 : settings.particles === 'low' ? 22 : 32;
}

function spawnSmokeCloud(id, center, durMs) {
  id = String(id);
  if (smokeClouds.has(id)) return;
  const group = new THREE.Group();
  group.position.copy(center);
  scene.add(group);

  const n = smokePuffCount();
  const puffs = [];
  const WORLD_FLOOR = 0.18, WORLD_CEIL = 2.9;
  for (let i = 0; i < n; i++) {
    // direção num elipsoide achatado (espalha mais rente ao chão)
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    let dx = Math.sqrt(1 - u * u) * Math.cos(theta);
    let dz = Math.sqrt(1 - u * u) * Math.sin(theta);
    let dy = u * 0.5;
    const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;

    let dist = SMOKE.RADIUS * (0.4 + Math.random() * 0.62);
    const wall = raycastSolids(center.x, center.y, center.z, dx, dy, dz);
    if (wall < dist) dist = Math.max(0.15, wall - 0.35);   // encosta na parede, não atravessa

    let localY = dy * dist;
    localY = Math.max(WORLD_FLOOR - center.y, Math.min(WORLD_CEIL - center.y, localY));

    const mat = new THREE.SpriteMaterial({
      map: smokePuffTex, transparent: true, depthWrite: false,
      color: new THREE.Color().setHSL(0.09, 0.06, 0.66 + Math.random() * 0.14),
      opacity: 0
    });
    mat.rotation = Math.random() * Math.PI * 2;
    const spr = new THREE.Sprite(mat);
    group.add(spr);
    puffs.push({
      spr, mat,
      fx: dx * dist, fy: localY, fz: dz * dist,
      size: SMOKE.RADIUS * (1.05 + Math.random() * 0.55),
      baseOp: 0.52 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.5
    });
  }
  smokeClouds.set(id, { group, puffs, deployAt: performance.now(), dur: durMs || SMOKE_LIFE_MS });
  const dist = me.pos.distanceTo(center);
  SFX.smokeDeploy(Math.max(0.12, 1 / (1 + dist * 0.06)));
}

function updateSmokeClouds(dt) {
  if (smokeClouds.size === 0) return;
  const now = performance.now();
  for (const [id, cloud] of smokeClouds) {
    const el = now - cloud.deployAt;
    if (el >= cloud.dur) { removeSmokeCloud(id); continue; }
    const expand = Math.min(1, el / SMOKE.DEPLOY_MS);
    const eE = 1 - Math.pow(1 - expand, 3);                 // easeOutCubic
    const dissStart = cloud.dur - SMOKE.DISSIPATE_MS;
    const diss = el > dissStart ? Math.min(1, (el - dissStart) / SMOKE.DISSIPATE_MS) : 0;
    for (const p of cloud.puffs) {
      const churnX = Math.cos(el * 0.0009 + p.phase) * 0.1;
      const churnY = Math.sin(el * 0.0011 + p.phase) * 0.12;
      p.spr.position.set(p.fx * eE + churnX, p.fy * eE + churnY + diss * 1.3, p.fz * eE);
      p.spr.scale.setScalar(p.size * (0.35 + 0.65 * eE) * (1 - diss * 0.35));
      p.mat.opacity = p.baseOp * Math.min(1, eE * 1.4) * (1 - diss);
      p.mat.rotation += p.spin * dt;
    }
  }
}

function removeSmokeCloud(id) {
  const c = smokeClouds.get(String(id));
  if (!c) return;
  for (const p of c.puffs) p.mat.dispose();
  scene.remove(c.group);
  smokeClouds.delete(String(id));
}
function clearAllSmokeClouds() {
  for (const id of [...smokeClouds.keys()]) removeSmokeCloud(id);
}

// ---- explosão: flash, onda de choque, fragmentos, poeira, câmera ----
const nadeFlashTex = spriteTex('#fff8e0', '#ff9040');
const nadeFragTex = spriteTex('#3a2818', '#1a1006');
function spawnNadeExplosionFX(pos) {
  const flashMat = new THREE.SpriteMaterial({
    map: nadeFlashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const flash = new THREE.Sprite(flashMat);
  flash.position.copy(pos);
  flash.scale.setScalar(2.6);
  scene.add(flash);
  effects.push({ obj: flash, ttl: 0.16, life: 0.16, kind: 'nadeflash' });

  // onda de choque no chão (anel teal se expandindo)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.55, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6ee0c8, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.06, pos.z);
  scene.add(ring);
  effects.push({ obj: ring, ttl: 0.4, life: 0.4, kind: 'shockwave' });

  spawnBurst(pos, nadeFragTex, 16, 6.5, 0.14, 3.5);
  spawnBurst(pos, dustTex, 14, 2.4, 0.3, 2.2);

  const dist = me.pos.distanceTo(pos);
  camShake = Math.min(0.22, camShake + Math.max(0, 0.26 - dist * 0.018));
  SFX.nadeExplode(Math.max(0.15, 1 / (1 + dist * 0.05)));
}

// ---------------- HUD helpers ----------------
function updateAmmoHUD() {
  const w = WEAPONS[curW];
  if (w.melee) {
    hud.ammo.textContent = '🗡';
    hud.ammo.classList.add('melee');
  } else {
    hud.ammo.textContent = ammo[curW];
    hud.ammo.classList.remove('melee');
  }
  hud.wname.textContent = w.name;
}

function updateHpHUD() {
  hud.hpFill.style.width = Math.max(0, me.hp) + '%';
  hud.hpNum.textContent = Math.max(0, Math.ceil(me.hp));
  hud.hpFill.classList.toggle('low', me.hp <= 30);
}

function updateSlideHUD() {
  hud.stamFill.style.width = (me.slideEnergy / SLIDE_MAX_ENERGY * 100) + '%';
  hud.stamBox.classList.toggle('show', me.slideEnergy < SLIDE_MAX_ENERGY);
  hud.stamFill.classList.toggle('ready', me.slideEnergy >= SLIDE_COST);
}

function updateKitHUD() {
  hud.kitCount.textContent = me.kits;
  hud.kitBox.classList.toggle('show', me.kits > 0);
  hud.kitBar.style.width = me.usingKit > 0 ? (100 - me.usingKit / KIT_USE_TIME * 100) + '%' : '0%';
  hud.kitBox.classList.toggle('using', me.usingKit > 0);
}

// atualiza os dois contadores (frag e fumaça); a barra de carga só aparece
// na caixa do tipo que está sendo carregado
function refreshNadeHUD() {
  const chargePct = (Math.max(NADE_MIN_POWER, Math.min(1, nadeState.chargeT / NADE_MAX_CHARGE_MS)) * 100) + '%';
  const fragCook = nadeState.cooking && nadeState.kind === 'frag';
  hud.nadeCount.textContent = me.nades;
  hud.nadeBox.classList.toggle('show', me.nades > 0 || fragCook);
  hud.nadeBox.classList.toggle('using', fragCook);
  hud.nadeBar.style.width = fragCook ? chargePct : '0%';

  const smokeCook = nadeState.cooking && nadeState.kind === 'smoke';
  hud.smokeCount.textContent = me.smokes;
  hud.smokeBox.classList.toggle('show', me.smokes > 0 || smokeCook);
  hud.smokeBox.classList.toggle('using', smokeCook);
  hud.smokeBar.style.width = smokeCook ? chargePct : '0%';
}

let multiKillT = null;
const MULTI_KILL_LABEL = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 4: 'QUAD KILL' };
function showMultiKill(n) {
  hud.multiKill.textContent = MULTI_KILL_LABEL[n] || 'MULTI KILL';
  hud.multiKill.className = n >= 5 ? 'show t5' : n === 4 ? 'show t4' : n === 3 ? 'show t3' : 'show';
  clearTimeout(multiKillT);
  multiKillT = setTimeout(() => { hud.multiKill.className = ''; }, 1400);
  SFX.multiKill(n);
}

function tryUseKit() {
  if (!playing || matchEnded || me.dead || me.kits <= 0 || me.usingKit > 0 || me.hp >= 100) return;
  if (nadeState.cooking || nadeState.throwing) return;   // mãos ocupadas com a granada
  net.send({ t: 'usekit' });
  me.usingKit = KIT_USE_TIME;
  updateKitHUD();
}

let hitmarkerT = null;
function showHitmarker(head) {
  hud.hitmarker.classList.remove('show', 'head');
  void hud.hitmarker.offsetWidth;
  hud.hitmarker.classList.add('show');
  if (head) hud.hitmarker.classList.add('head');
  clearTimeout(hitmarkerT);
  hitmarkerT = setTimeout(() => hud.hitmarker.classList.remove('show', 'head'), 120);
}

function addFeed(killer, victim, head, isMe, weaponIndex, backstab) {
  const div = document.createElement('div');
  div.className = 'feed-item' + (isMe ? ' me' : '') + (head || backstab ? ' head' : '');
  const km = meta.get(killer) || (killer === me.id ? me : null);
  const vm2 = meta.get(victim) || (victim === me.id ? me : null);
  const kn = killer === me.id ? me.name : (km ? km.name : '?');
  const vn = victim === me.id ? me.name : (vm2 ? vm2.name : '?');
  const kc = killer === me.id ? me.color : (km ? km.color : '#fff');
  const vc = victim === me.id ? me.color : (vm2 ? vm2.color : '#fff');
  const wi = weaponIndex !== undefined ? weaponIndex : 0;
  const mid = backstab ? '☠' : (head ? '⌖' : '⚔');
  // granada: única arma que permite auto-dano (bullets/faca sempre excluem o
  // próprio atirador do alvo) — evita a leitura estranha de "Fulano ⚔ Fulano"
  div.innerHTML = killer === victim
    ? `<span class="fx w">${WEAPON_ICONS[wi] || '?'}</span> <b style="color:${vc}">${vn}</b> <span class="fx">se eliminou</span>`
    : `<b style="color:${kc}">${kn}</b> <span class="fx w">${WEAPON_ICONS[wi] || '?'}</span> <span class="fx">${mid}</span> <b style="color:${vc}">${vn}</b>`;
  hud.feed.prepend(div);
  setTimeout(() => div.classList.add('out'), 4200);
  setTimeout(() => div.remove(), 4700);
  while (hud.feed.children.length > 6) hud.feed.lastChild.remove();
}

function rebuildBoard() {
  const rows = [];
  const mine = { name: me.name + ' (você)', color: me.color, team: me.team, k: me.k || 0, d: me.d || 0 };
  rows.push(mine);
  for (const m of meta.values()) rows.push(m);
  rows.sort((a, b) => b.k - a.k);
  const rowHtml = r => {
    const col = (roomInfo && roomInfo.gm === 'tdm' && (r.team === 0 || r.team === 1)) ? TEAM_COLORS[r.team] : r.color;
    return `<tr><td><span class="dot" style="background:${col}"></span>${esc(r.name)}${r.bot ? ' <span class="bot">BOT</span>' : ''}</td><td>${r.k}</td><td>${r.d}</td></tr>`;
  };
  hud.boardRows.innerHTML = rows.map(rowHtml).join('');
}

function flashDamage() {
  hud.dmgFlash.classList.remove('show');
  void hud.dmgFlash.offsetWidth;
  hud.dmgFlash.classList.add('show');
}

function showKillPop() {
  hud.killPop.classList.remove('show');
  void hud.killPop.offsetWidth;
  hud.killPop.classList.add('show');
}

// ---------------- Rede ----------------
function clearRoomState() {
  for (const id of [...remotes.keys()]) removeRemote(id);
  meta.clear();
  snapBuf.length = 0;
  hud.feed.textContent = '';
  hud.death.classList.remove('show');
  hud.endscreen.classList.remove('show');
  if (endCountTimer) { clearInterval(endCountTimer); endCountTimer = null; }
  matchEnded = false;
  me.slideEnergy = SLIDE_MAX_ENERGY; me.slideCooldownT = 0;
  me.kits = 0; me.usingKit = 0;
  multiKillCount = 0; lastKillTime = 0;
  cancelMelee(); melee.cd = 0; knifeEquipT = 0; knifeInspectT = 0;
  curW = 0; showViewmodel(0); camShake = 0;
  cancelNadeCook(); nadeState.throwing = false;
  me.nades = NADE.COUNT_START; me.smokes = SMOKE.COUNT_START;
  clearAllNadeMeshes();
  updateSlideHUD(); updateKitHUD(); refreshNadeHUD();
}

net.on('init', msg => {
  clearRoomState();
  me.id = msg.id;
  me.team = msg.team ?? null;
  inRoom = true;
  roomInfo = { code: msg.code, mode: msg.mode, gm: msg.gm || 'ffa', kl: msg.kl, end: msg.end };
  for (const p of msg.players) {
    if (p.id === msg.id) {
      me.pos.set(p.pos[0], p.pos[1], p.pos[2]);
      me.color = p.color;
      me.hp = p.hp; me.k = 0; me.d = 0;
      me.nades = p.nades ?? NADE.COUNT_START;
      me.smokes = p.smokes ?? SMOKE.COUNT_START;
      faceCenter();
    } else addRemote(p);
  }
  refreshNadeHUD();
  startPlaying();
});
net.on('j', msg => addRemote(msg.p));
net.on('l', msg => removeRemote(msg.id));
// Buffer de snapshots para interpolação suave (estilo FPS grandes):
// renderizamos os remotos ~100ms no passado, interpolando entre dois
// estados conhecidos — movimento liso mesmo com ping alto/oscilante.
const SNAP_INTERP_MS = 100;
// cap alto o bastante para o killcam rebobinar ~5s (30 Hz → ~150 snapshots)
const SNAP_BUF_MAX = 200;
const snapBuf = []; // { t: performance.now() na chegada, sv: tempo do servidor, p: estados }

net.on('s', msg => {
  snapBuf.push({ t: performance.now(), sv: msg.sv, p: msg.p, n: msg.n });
  while (snapBuf.length > SNAP_BUF_MAX) snapBuf.shift();
  for (const [id, a] of Object.entries(msg.p)) {
    const r = remotes.get(+id);
    if (!r) continue;
    r.anim = a[5];
    r.hp = a[6];
  }
  if (typeof msg.tl === 'number') updateMatchBar(msg.tl, msg.ts);
});

// confirmação do meu lançamento: sincroniza a contagem e "adota" o mesh
// previsto sob o id real do servidor — dali em diante a posição vem do
// buffer de snapshots, igual a qualquer outra granada
net.on('nc', msg => {
  if (msg.kind === 'smoke') me.smokes = msg.n; else me.nades = msg.n;
  refreshNadeHUD();
  if (msg.id != null && myNade && myNade.confirmedId === null) {
    const id = String(msg.id);
    myNade.confirmedId = id;
    nadeKinds.set(id, myNade.kind);
    remoteNades.set(id, { mesh: myNade.mesh, spawnedAt: myNade.thrownAt });
    myNade = null;
  }
});

// aviso de que uma granada de outro jogador nasceu (id + tipo) — para
// desenharmos o modelo certo (frag vs canister de fumaça) já em voo
net.on('ng', msg => { nadeKinds.set(String(msg.id), msg.kind === 'smoke' ? 'smoke' : 'frag'); });

// quique de uma granada (minha ou de outro jogador) — som posicional
net.on('nb', msg => {
  const r = remoteNades.get(String(msg.id));
  const pos = r ? r.mesh.position : new THREE.Vector3(msg.o[0], msg.o[1], msg.o[2]);
  SFX.nadeBounce(Math.max(0.05, 1 / (1 + pos.distanceTo(me.pos) * 0.12)));
});

// explosão confirmada pelo servidor — remove o mesh e dispara o efeito.
// O dano de verdade chega em seguida via 'dmg'/'die' (mesmo pipeline das
// outras armas — ver damage() no servidor).
net.on('nadeboom', msg => {
  const id = String(msg.id);
  const r = remoteNades.get(id);
  const pos = r ? r.mesh.position.clone() : new THREE.Vector3(msg.o[0], msg.o[1], msg.o[2]);
  if (r) { scene.remove(r.mesh); remoteNades.delete(id); nadeKinds.delete(id); }
  spawnNadeExplosionFX(pos);
});

// deploy da fumaça: remove o canister em voo e materializa a nuvem no lugar
net.on('smokestart', msg => {
  const id = String(msg.id);
  const r = remoteNades.get(id);
  if (r) { scene.remove(r.mesh); remoteNades.delete(id); }
  if (myNade && myNade.confirmedId === id) { scene.remove(myNade.mesh); myNade = null; }
  nadeKinds.delete(id);
  spawnSmokeCloud(id, new THREE.Vector3(msg.o[0], msg.o[1], msg.o[2]), msg.dur || SMOKE_LIFE_MS);
});
net.on('smokeend', msg => removeSmokeCloud(String(msg.id)));

// Acha o par de snapshots que envolve o tempo de render (agora - atraso).
// `sv` = instante do SERVIDOR que está sendo renderizado — enviado junto com o
// tiro para o servidor rebobinar o mundo exatamente para o que o atirador via.
function sampleSnapshots() {
  if (!snapBuf.length) return null;
  const rt = performance.now() - SNAP_INTERP_MS;
  for (let i = snapBuf.length - 1; i >= 0; i--) {
    if (snapBuf[i].t <= rt) {
      const s0 = snapBuf[i], s1 = snapBuf[i + 1];
      if (!s1) return { a: s0, b: null, alpha: 0, sv: s0.sv };
      const alpha = Math.min(1, (rt - s0.t) / ((s1.t - s0.t) || 1));
      return { a: s0, b: s1, alpha, sv: s0.sv && s1.sv ? Math.round(s0.sv + (s1.sv - s0.sv) * alpha) : s0.sv };
    }
  }
  return { a: snapBuf[0], b: null, alpha: 0, sv: snapBuf[0].sv };
}

// ============================================================
// KILLCAM — replay dos últimos segundos pela visão de quem te matou.
// Tudo client-side: o servidor já nos manda posição + mira de todos a
// 30 Hz (guardado em snapBuf), então reconstruímos a cena e colocamos a
// câmera nos olhos do assassino. Estilo Black Ops 2.
// ============================================================
const KILLCAM_MS = 5000;        // quanto do passado reproduzir (~5s)
const KILLCAM_HOLD_MS = 900;    // pausa no instante da morte (queda da vítima)
const KILLCAM_AIM_MS = 1500;    // rampa do "abrir a mira" (ADS) antes do tiro final
const DEATH_FALLBACK_MS = 2200; // morte sem killcam: tempo até pedir respawn sozinho

const killcam = {
  active: false,
  frames: null,          // [{ sv, p }] copiados no instante da morte
  startSv: 0, endSv: 0,
  t0: 0,                 // performance.now() do início do replay
  deathWall: 0,          // performance.now() da morte (âncora p/ replay dos tiros)
  killerId: null,
  killerW: 0,            // arma que te matou (0 = SMG, 1 = sniper)
  killerHidden: false,   // escondemos o modelo do assassino (câmera fica dentro dele)
  victim: null,          // modelo temporário do seu corpo
  shots: null,           // disparos do assassino a reproduzir: [{ wall, o, d, w, played }]
  fallT: 0,              // progresso da queda da vítima (0..1)
  aim: 0,                // ADS simulado (0..1) — "abrindo a mira"
  recoil: 0, vmKick: 0, bobT: 0,
  respawnSent: false
};
let deathTimer = null;   // failsafe client-side para morte sem killcam
// disparos remotos recentes (p/ reproduzir no killcam): { wall, id, o:[3], d:[3], w }
const fireLog = [];

// interpola a entidade `id` entre dois frames do histórico
function kcLerp(a, b, alpha, id) {
  const p0 = a && a.p[id], p1 = b && b.p[id];
  if (p0 && p1) {
    // teleporte (respawn dentro da janela): não desliza pelo mapa
    if (Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 12) {
      return { x: p1[0], y: p1[1], z: p1[2], yaw: p1[3], pitch: p1[4], anim: p1[5] | 0 };
    }
    let dyw = p1[3] - p0[3];
    while (dyw > Math.PI) dyw -= Math.PI * 2;
    while (dyw < -Math.PI) dyw += Math.PI * 2;
    return {
      x: p0[0] + (p1[0] - p0[0]) * alpha,
      y: p0[1] + (p1[1] - p0[1]) * alpha,
      z: p0[2] + (p1[2] - p0[2]) * alpha,
      yaw: p0[3] + dyw * alpha,
      pitch: p0[4] + (p1[4] - p0[4]) * alpha,
      anim: (alpha < 0.5 ? p0[5] : p1[5]) | 0
    };
  }
  const p = p0 || p1;
  if (!p) return null;
  return { x: p[0], y: p[1], z: p[2], yaw: p[3], pitch: p[4], anim: p[5] | 0 };
}

// par de frames que envolve o tempo de servidor `sv`
function kcSample(frames, sv) {
  const last = frames[frames.length - 1];
  if (sv >= last.sv) return { a: last, b: null, alpha: 0 };
  if (sv <= frames[0].sv) return { a: frames[0], b: frames[1] || null, alpha: 0 };
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].sv <= sv) {
      const a = frames[i], b = frames[i + 1];
      const alpha = b ? Math.min(1, (sv - a.sv) / ((b.sv - a.sv) || 1)) : 0;
      return { a, b, alpha };
    }
  }
  return { a: frames[0], b: frames[1] || null, alpha: 0 };
}

// Decide entre killcam (assassino válido + histórico) ou morte simples.
function startDeathSequence(killerId, killerW) {
  clearTimeout(deathTimer); deathTimer = null;
  killcam.respawnSent = false;

  if (collectKillcamFrames(killerId)) {
    enterKillcam(killerId, killerW);
  } else {
    // sem killcam: card de morte + renasce sozinho (F também funciona)
    hud.death.classList.add('show');
    deathTimer = setTimeout(requestRespawn, DEATH_FALLBACK_MS);
  }
}

function collectKillcamFrames(killerId) {
  if (killerId == null || killerId === me.id) return false;   // suicídio/queda
  if (snapBuf.length < 4) return false;
  const endSv = snapBuf[snapBuf.length - 1].sv;
  if (!endSv) return false;
  const startSv = endSv - KILLCAM_MS;
  const frames = [];
  let killerSeen = 0;
  for (const s of snapBuf) {
    if (s.sv == null || s.sv < startSv - 200) continue; // margem p/ um frame antes do início
    frames.push({ sv: s.sv, p: s.p });
    if (s.p[killerId]) killerSeen++;
  }
  if (frames.length < 3 || killerSeen < 3) return false;
  killcam.startSv = startSv;
  killcam.endSv = endSv;
  killcam.frames = frames;
  return true;
}

function enterKillcam(killerId, killerW) {
  killcam.active = true;
  killcam.killerId = killerId;
  killcam.killerW = (killerW === 1 || killerW === 2) ? killerW : 0;
  killcam.t0 = performance.now();
  killcam.deathWall = killcam.t0;
  killcam.fallT = 0;
  killcam.aim = 0; killcam.recoil = 0; killcam.vmKick = 0; killcam.bobT = 0;

  // disparos do assassino dentro da janela do replay (p/ reproduzir os tiros)
  const w0 = killcam.deathWall - KILLCAM_MS - 300;
  killcam.shots = fireLog
    .filter(f => f.id === killerId && f.wall >= w0 && f.wall <= killcam.deathWall + 60)
    .map(f => ({ wall: f.wall, o: f.o, d: f.d, w: f.w, played: false }));

  // corpo temporário da vítima — para você se ver levando o tiro
  const vm = makeCharacter(teamOf(me.team, me.color));
  scene.add(vm);
  killcam.victim = vm;

  // esconde o modelo do assassino (a câmera fica dentro da cabeça dele)
  const kr = remotes.get(killerId);
  if (kr && kr.model) { kr.model.visible = false; killcam.killerHidden = true; }
  else killcam.killerHidden = false;

  // mostra a ARMA/faca de quem te matou (visão de primeira pessoa dele)
  showViewmodel(killcam.killerW);
  vmRoot.position.set(0.26, -0.24, -0.5);
  vmRoot.rotation.set(0, 0, 0);
  vmRoot.visible = true;

  hud.death.classList.remove('show');
  const killer = meta.get(killerId);
  hud.killcamBy.textContent = killer ? killer.name : '???';
  hud.killcamProgress.style.width = '0%';
  hud.killcam.classList.add('show');

  fadeCut();   // corte preto rápido de entrada
}

// preto instantâneo que desvanece → dá um "corte" limpo pra dentro do killcam
function fadeCut() {
  const f = hud.fade;
  f.style.transition = 'none';
  f.classList.add('on');
  void f.offsetWidth;      // força reflow
  f.style.transition = '';
  f.classList.remove('on');
}

// Pede o respawn ao servidor (fim do killcam ou tecla F). Só uma vez.
function requestRespawn() {
  if (!me.dead || killcam.respawnSent) return;
  killcam.respawnSent = true;
  clearTimeout(deathTimer); deathTimer = null;
  net.send({ t: 'respawn' });
  hud.killcam.classList.remove('show');
  hud.death.classList.remove('show');
  hud.fade.classList.add('on');   // fade pra preto enquanto o servidor confirma
}

// Desmonta o killcam (chamado no spawn / fim de partida).
function endKillcam() {
  if (killcam.victim) { scene.remove(killcam.victim); killcam.victim = null; }
  // restaura a visibilidade de todos os vivos (posicionamos modelos no histórico
  // durante o replay; quem não aparecia num frame ficou oculto)
  for (const r of remotes.values()) {
    if (r.alive && r.model) r.model.visible = true;
  }
  killcam.killerHidden = false;
  killcam.active = false;
  killcam.frames = null;
  killcam.killerId = null;
  killcam.shots = null;

  // devolve a viewmodel/FOV/scope pro estado do jogador local
  showViewmodel(curW);
  vmRoot.position.set(0.26, -0.24, -0.5);
  vmRoot.rotation.set(0, 0, 0);
  vmRoot.visible = true;
  hud.scope.classList.toggle('show', false);
  camera.fov = BASE_FOV; camera.updateProjectionMatrix();
  hud.killcam.classList.remove('show');
}

// posiciona um personagem no transform histórico com pose básica
function poseKillcamEntity(model, e, dt, fallT) {
  if (!model) return;
  if (!e) { model.visible = false; return; }
  model.visible = true;
  model.position.set(e.x, e.y, e.z);
  model.rotation.y = e.yaw;
  if (fallT > 0) {
    model.rotation.x = -Math.min(fallT * 1.3, 1) * Math.PI / 2 * 0.9;
    model.position.y = e.y - Math.min(fallT, 1) * 0.35;
  } else {
    model.rotation.x = 0;
  }
  const u = model.userData;
  if (!u || !u.arms) return;
  const wsel = (e.anim >> 2) & 3;          // arma/faca em uso
  if (u.gun) u.gun.visible = wsel !== 2;
  if (u.knife) u.knife.visible = wsel === 2;
  u.arms.rotation.x = -e.pitch * 0.7;
  u.head.rotation.x = -e.pitch * 0.4;
  const moving = e.anim & 1, sliding = e.anim & 2;
  if (sliding) {
    u.legL.rotation.x = u.legR.rotation.x = 1.2;
  } else if (moving) {
    model._kcWalk = (model._kcWalk || 0) + dt * 11;
    u.legL.rotation.x = Math.sin(model._kcWalk) * 0.7;
    u.legR.rotation.x = -Math.sin(model._kcWalk) * 0.7;
  } else {
    u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8;
  }
}

// reproduz um disparo do assassino durante o killcam (clarão + tracer + recuo)
const _kcMuzzle = new THREE.Vector3();
function replayKillerShot(shot) {
  const W = WEAPONS[shot.w] || WEAPONS[0];
  const [ox, oy, oz] = shot.o, [dx, dy, dz] = shot.d;
  const dist = Math.min(raycastSolids(ox, oy, oz, dx, dy, dz), 150);
  const end = new THREE.Vector3(ox + dx * dist, oy + dy * dist, oz + dz * dist);
  let start;
  if (vmRoot.visible) {
    viewmodels[shot.w].muzzle.getWorldPosition(_kcMuzzle);
    start = _kcMuzzle.clone();
  } else {
    start = new THREE.Vector3(ox + dx * 0.6, oy + dy * 0.6, oz + dz * 0.6);
  }
  spawnFlash(start);
  spawnTracer(start, end, 0xffc080);
  killcam.recoil += W.kick;
  killcam.vmKick = Math.min(killcam.vmKick + 0.06, 0.14);
  SFX.shot(shot.w === 1, 0.4);
}

// chamada todo frame enquanto o killcam roda
function updateKillcam(dt) {
  const frames = killcam.frames;
  const elapsed = performance.now() - killcam.t0;
  const replayMs = KILLCAM_MS;   // == endSv - startSv por construção

  let sv;
  if (elapsed <= replayMs) {
    sv = killcam.startSv + elapsed;               // fase 1: replay em tempo real
  } else {
    sv = killcam.endSv;                            // fase 2: segura no tiro + queda
    killcam.fallT = Math.min(1, (elapsed - replayMs) / KILLCAM_HOLD_MS);
  }

  hud.killcamProgress.style.width =
    (Math.min(1, elapsed / (replayMs + KILLCAM_HOLD_MS)) * 100).toFixed(1) + '%';

  // "abrir a mira" (ADS): rampa nos instantes finais antes do tiro e segura no fim
  const aimTarget = elapsed >= replayMs
    ? 1
    : Math.min(1, Math.max(0, (elapsed - (replayMs - KILLCAM_AIM_MS)) / KILLCAM_AIM_MS));
  killcam.aim += (aimTarget - killcam.aim) * Math.min(1, 6 * dt);

  // sniper mira → luneta (esconde a arma, mostra o scope); SMG → só estreita o FOV
  const scoped = killcam.killerW === 1 && killcam.aim > 0.55;
  hud.scope.classList.toggle('show', scoped);

  const smp = kcSample(frames, sv);

  // câmera nos olhos do assassino (+ recuo dos disparos)
  const k = kcLerp(smp.a, smp.b, smp.alpha, killcam.killerId);
  killcam.recoil *= Math.exp(-11 * dt);
  if (k) {
    camera.position.set(k.x, k.y + PLAYER.EYE, k.z);
    camera.rotation.set(k.pitch + killcam.recoil, k.yaw, 0);
  }

  // FOV do ADS (faca não mira: mantém o FOV base)
  const adsFov = killcam.killerW === 1 ? ZOOM_FOV : (killcam.killerW === 2 ? BASE_FOV : BASE_FOV * 0.72);
  const fov = BASE_FOV + (adsFov - BASE_FOV) * killcam.aim;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }

  // arma na mão do assassino: bob ao andar + recuo; some quando entra na luneta
  vmRoot.visible = !scoped;
  if (vmRoot.visible) {
    if (k && (k.anim & 1)) killcam.bobT += dt * 7;
    const vmY = -0.24 + Math.abs(Math.sin(killcam.bobT)) * 0.014;
    const vmX = 0.26 + Math.sin(killcam.bobT) * 0.008;
    vmRoot.position.x += (vmX - vmRoot.position.x) * Math.min(1, 10 * dt);
    vmRoot.position.y += (vmY - vmRoot.position.y) * Math.min(1, 10 * dt);
    vmRoot.position.z += ((-0.5 + killcam.vmKick) - vmRoot.position.z) * Math.min(1, 14 * dt);
    vmRoot.rotation.x = killcam.vmKick * 1.2;
  }
  killcam.vmKick *= Math.exp(-10 * dt);

  // reproduz os tiros do assassino no momento certo do replay
  const playbackWall = killcam.deathWall - KILLCAM_MS + Math.min(elapsed, replayMs);
  if (killcam.shots) {
    for (const s of killcam.shots) {
      if (!s.played && s.wall <= playbackWall) { s.played = true; replayKillerShot(s); }
    }
  }

  // corpo da vítima (você) — cai no fim
  poseKillcamEntity(killcam.victim, kcLerp(smp.a, smp.b, smp.alpha, me.id), dt, killcam.fallT);
  // demais jogadores (o assassino fica escondido)
  for (const [id, r] of remotes) {
    if (id === killcam.killerId) continue;
    poseKillcamEntity(r.model, kcLerp(smp.a, smp.b, smp.alpha, id), dt, 0);
  }

  // acabou → pede respawn (fade + servidor confirma)
  if (killcam.fallT >= 1 && !killcam.respawnSent) requestRespawn();
}

function computeTeamScores() {
  const s = [0, 0];
  if (me.team === 0 || me.team === 1) s[me.team] += me.k || 0;
  for (const m of meta.values()) if (m.team === 0 || m.team === 1) s[m.team] += m.k || 0;
  return s;
}

// cache dos últimos valores — evita reescrever o DOM 30x/segundo
let _mbTimeLast = '', _mbScoreLast = '';
function updateMatchBar(secondsLeft, teamScoresArr) {
  const m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
  const timeTxt = `${m}:${String(s).padStart(2, '0')}`;
  if (timeTxt !== _mbTimeLast) {
    _mbTimeLast = timeTxt;
    hud.mbTime.textContent = timeTxt;
    hud.mbTime.classList.toggle('low', secondsLeft <= 60 && secondsLeft > 0);
  }

  if (roomInfo && roomInfo.gm === 'tdm') {
    const ts = teamScoresArr || computeTeamScores();
    const mine = me.team === 1 ? 1 : 0, foe = 1 - mine;
    const scoreHtml =
      `<span style="color:${TEAM_COLORS[mine]};font-weight:bold">${ts[mine]}</span>` +
      ` <span style="opacity:.5">—</span> ` +
      `<span style="color:${TEAM_COLORS[foe]}">${ts[foe]}</span>` +
      ` <span style="opacity:.5;font-size:12px">/${roomInfo.kl}</span>`;
    if (scoreHtml !== _mbScoreLast) {
      _mbScoreLast = scoreHtml;
      hud.mbScore.innerHTML = scoreHtml;
    }
  } else {
    let lead = me.k || 0;
    for (const p of meta.values()) if (p.k > lead) lead = p.k;
    const scoreTxt = `${lead}/${roomInfo ? roomInfo.kl : '-'}`;
    if (scoreTxt !== _mbScoreLast) {
      _mbScoreLast = scoreTxt;
      hud.mbScore.textContent = scoreTxt;
    }
  }
}
net.on('fire', msg => {
  if (msg.id === me.id) return;
  const o = new THREE.Vector3(msg.o[0], msg.o[1], msg.o[2]);
  const d = new THREE.Vector3(msg.d[0], msg.d[1], msg.d[2]);
  const tHit = raycastSolids(o.x, o.y, o.z, d.x, d.y, d.z);
  spawnTracer(o.clone().addScaledVector(d, 0.5), o.clone().addScaledVector(d, Math.min(tHit, 150)), 0xffc080);
  spawnFlash(o);
  const dist = o.distanceTo(me.pos);
  SFX.shot(msg.w === 1, Math.max(0.06, 1 / (1 + dist * 0.09)));
  // grava p/ o killcam reproduzir os tiros de quem te matou
  const nowW = performance.now();
  fireLog.push({ wall: nowW, id: msg.id, o: [msg.o[0], msg.o[1], msg.o[2]], d: [msg.d[0], msg.d[1], msg.d[2]], w: msg.w | 0 });
  while (fireLog.length && fireLog[0].wall < nowW - (KILLCAM_MS + 800)) fireLog.shift();
});
net.on('dmg', msg => {
  if (msg.id === me.id) {
    me.hp = msg.hp;
    updateHpHUD();
    flashDamage();
    SFX.hurt();
  } else {
    const r = remotes.get(msg.id);
    if (r) r.hp = msg.hp;
  }
  // confirmação do servidor de que MEU ataque acertou → hitmarker/som
  if (msg.by === me.id && msg.id !== me.id) {
    const knifeHit = curW === KNIFE || (melee.active && melee.quick);
    showHitmarker(!!msg.h || !!msg.bs);
    if (msg.bs) SFX.backstab();
    else if (msg.h) SFX.headshot();
    else if (msg.w === 3) SFX.nadeHit();
    else if (knifeHit) SFX.knifeHit();
    else SFX.hit();
  }
});
// golpe de faca de um inimigo próximo → som do corte no ar
net.on('melee', msg => {
  if (msg.id === me.id) return;
  const r = remotes.get(msg.id);
  const src = r ? r.model.position : new THREE.Vector3(msg.o[0], msg.o[1], msg.o[2]);
  if (src.distanceTo(me.pos) < 13) SFX.knifeSwing();
});
net.on('kit', msg => {
  me.kits = msg.n;
  updateKitHUD();
  SFX.kitReady();
});
net.on('heal', msg => {
  if (msg.id !== me.id) { const r = remotes.get(msg.id); if (r) r.hp = msg.hp; return; }
  me.hp = msg.hp;
  updateHpHUD();
  SFX.heal();
});
net.on('die', msg => {
  // atualizar placar
  if (msg.id === me.id) { me.d = msg.vd; }
  else if (meta.has(msg.id)) meta.get(msg.id).d = msg.vd;
  if (msg.by === me.id) { me.k = msg.kk; }
  else if (meta.has(msg.by)) meta.get(msg.by).k = msg.kk;

  addFeed(msg.by, msg.id, msg.h, msg.by === me.id || msg.id === me.id, msg.w, msg.bs);

  if (msg.id === me.id) {
    me.dead = true;
    me.sliding = false;
    me.usingKit = 0;
    cancelMelee();
    cancelNadeCook(); nadeState.throwing = false;
    updateKitHUD();
    multiKillCount = 0;
    setZoom(false);
    mouseDown = false;
    const killer = meta.get(msg.by);
    hud.deathBy.textContent = msg.by === me.id ? 'própria granada' : (killer ? killer.name : '???');
    SFX.die();
    startDeathSequence(msg.by, msg.w | 0);
  } else {
    const r = remotes.get(msg.id);
    if (r) { r.alive = false; r.deadT = 0; }
    if (msg.by === me.id) {
      SFX.kill(); showKillPop();
      const now = performance.now();
      multiKillCount = (now - lastKillTime <= MULTI_KILL_WINDOW * 1000) ? multiKillCount + 1 : 1;
      lastKillTime = now;
      if (multiKillCount >= 2) showMultiKill(multiKillCount);
    }
  }
  if (hud.board.classList.contains('show')) rebuildBoard();
});
net.on('spawn', msg => {
  if (msg.id === me.id) {
    me.pos.set(msg.pos[0], msg.pos[1], msg.pos[2]);
    me.vel.set(0, 0, 0);
    me.hp = 100;
    me.dead = false;
    faceCenter();
    ammo[0] = WEAPONS[0].mag; ammo[1] = WEAPONS[1].mag;
    reloading = 0;
    me.nades = msg.nades ?? NADE.COUNT_START;
    me.smokes = msg.smokes ?? SMOKE.COUNT_START;
    cancelNadeCook(); nadeState.throwing = false;
    hud.death.classList.remove('show');
    endKillcam();
    clearTimeout(deathTimer); deathTimer = null;
    killcam.respawnSent = false;
    hud.fade.classList.remove('on');   // fade suave de volta ao jogo
    updateHpHUD(); updateAmmoHUD(); refreshNadeHUD();
    SFX.spawn();
  } else {
    const r = remotes.get(msg.id);
    if (r) {
      r.alive = true;
      r.model.visible = true;
      r.model.rotation.x = 0;
      r.target.set(msg.pos[0], msg.pos[1], msg.pos[2]);
      r.model.position.copy(r.target);
      spawnBurst(r.target.clone().setY(r.target.y + 1), poofTex, 10, 2.5, 0.22, 3);
    }
  }
});
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

net.on('end', msg => {
  matchEnded = true;
  mouseDown = false;
  setZoom(false);
  hud.death.classList.remove('show');
  endKillcam();
  clearTimeout(deathTimer); deathTimer = null;
  killcam.respawnSent = false;
  hud.fade.classList.remove('on');

  let won = false;
  if (msg.gm === 'tdm') {
    const wt = msg.winTeam;
    if (wt === null || wt === undefined) {
      hud.endWinnerName.textContent = 'EMPATE';
      hud.endWinnerName.style.color = '#f2e3c8';
    } else {
      const sc = msg.teamScores || [0, 0];
      hud.endWinnerName.textContent = `TIME ${TEAM_NAMES[wt]} — ${sc[wt]} × ${sc[1 - wt]}`;
      hud.endWinnerName.style.color = TEAM_COLORS[wt];
      won = wt === me.team;
    }
    hud.endRows.innerHTML = msg.board.map(r => {
      const nm = r.id === me.id ? `${esc(r.name)} (você)` : esc(r.name);
      const col = (r.team === 0 || r.team === 1) ? TEAM_COLORS[r.team] : r.color;
      return `<tr><td><span class="dot" style="background:${esc(col)}"></span>${nm}${r.bot ? ' <span class="bot">BOT</span>' : ''}</td><td>${r.k}</td><td>${r.d}</td></tr>`;
    }).join('');
  } else {
    const win = msg.winId === me.id ? { name: me.name + ' (você)', color: me.color } : meta.get(msg.winId);
    hud.endWinnerName.textContent = win ? win.name : '—';
    hud.endWinnerName.style.color = win ? win.color : '';
    won = msg.winId === me.id;
    hud.endRows.innerHTML = msg.board.map(r => {
      const nm = r.id === me.id ? `${esc(r.name)} (você)` : esc(r.name);
      return `<tr><td><span class="dot" style="background:${esc(r.color)}"></span>${nm}${r.bot ? ' <span class="bot">BOT</span>' : ''}</td><td>${r.k}</td><td>${r.d}</td></tr>`;
    }).join('');
  }

  hud.endscreen.classList.add('show');
  let count = msg.next || 10;
  hud.endCount.textContent = count;
  if (endCountTimer) clearInterval(endCountTimer);
  endCountTimer = setInterval(() => {
    count--;
    hud.endCount.textContent = Math.max(0, count);
    if (count <= 0) { clearInterval(endCountTimer); endCountTimer = null; }
  }, 1000);
  if (won) SFX.kill();
});

net.on('teamchg', msg => {
  if (msg.id === me.id) {
    me.team = msg.team;
    me.dead = true;   // servidor respawna em ~600ms
    endKillcam();
    clearTimeout(deathTimer); deathTimer = null;
    killcam.respawnSent = false;
    hud.death.classList.remove('show');
    hud.fade.classList.remove('on');
    setZoom(false);
    mouseDown = false;
    updateTeamButtons();
  } else if (meta.has(msg.id)) {
    meta.get(msg.id).team = msg.team;
    rebuildRemoteModel(msg.id);
  }
});

net.on('restart', msg => {
  matchEnded = false;
  hud.endscreen.classList.remove('show');
  if (endCountTimer) { clearInterval(endCountTimer); endCountTimer = null; }
  if (roomInfo) roomInfo.end = msg.end;
  me.k = 0; me.d = 0;
  for (const m of meta.values()) { m.k = 0; m.d = 0; }
  for (const p of msg.players) {
    if (p.id === me.id) {
      me.pos.set(p.pos[0], p.pos[1], p.pos[2]);
      me.vel.set(0, 0, 0);
      me.hp = 100; me.dead = false;
      faceCenter();
      ammo[0] = WEAPONS[0].mag; ammo[1] = WEAPONS[1].mag;
      reloading = 0;
      me.nades = p.nades ?? NADE.COUNT_START;
      me.smokes = p.smokes ?? SMOKE.COUNT_START;
      cancelNadeCook(); nadeState.throwing = false;
      updateHpHUD(); updateAmmoHUD(); refreshNadeHUD();
    } else {
      const r = remotes.get(p.id);
      if (r) {
        r.alive = true;
        r.model.visible = true;
        r.model.rotation.x = 0;
        r.target.set(p.pos[0], p.pos[1], p.pos[2]);
        r.model.position.copy(r.target);
      } else addRemote(p);
    }
  }
  hud.death.classList.remove('show');
  endKillcam();
  clearTimeout(deathTimer); deathTimer = null;
  killcam.respawnSent = false;
  hud.fade.classList.remove('on');
  SFX.spawn();
});

net.on('invited', msg => {
  lastInvite = { from: String(msg.from || '?'), code: String(msg.code || '') };
  hud.inviteText.textContent = '';
  const b = document.createElement('b');
  b.textContent = lastInvite.from;
  hud.inviteText.append(b, ` te convidou (sala ${lastInvite.code})`);
  hud.inviteBanner.classList.remove('hidden');
  SFX.hit();
});

const WS_ERRORS = {
  room_not_found: 'Sala não encontrada.',
  room_full: 'Sala cheia.',
  not_friends: 'Vocês não são amigos.',
  friend_offline: 'Esse amigo está offline.',
  not_in_custom_room: 'Crie uma sala personalizada para convidar.'
};
net.on('err', msg => {
  const txt = WS_ERRORS[msg.code] || 'Erro.';
  hud.menuStatus.textContent = txt;
  if (msg.code === 'not_friends' || msg.code === 'friend_offline' || msg.code === 'not_in_custom_room') {
    hud.friendStatus.style.color = '';
    hud.friendStatus.textContent = txt;
  }
});
net.on('invite_sent', () => {
  hud.friendStatus.style.color = '#6ee0c8';
  hud.friendStatus.textContent = 'Convite enviado!';
});

net.on('hello', () => {
  if (!playing) hud.menuStatus.textContent = '';
});

net.on('_open', () => {
  connected = true;
  net.send({ t: 'hello', token: auth ? auth.token : undefined });
  if (pendingPlay) { net.send(pendingPlay); pendingPlay = null; }
});

net.on('_close', () => {
  connected = false;
  if (playing) {
    playing = false;
    inRoom = false;
    roomInfo = null;
    vmRoot.visible = false;
    hud.game.classList.remove('show');
    clearRoomState();
    hud.menu.classList.remove('hidden');
    closeScreen();
    hud.menuStatus.textContent = 'Conexão perdida — reconectando…';
    setMenuMode(false);
    if (document.exitPointerLock) document.exitPointerLock();
  } else {
    hud.menuStatus.textContent = 'Reconectando…';
  }
});

net.on('_reconnect_status', ({ attempt, max }) => {
  hud.menuStatus.textContent = `Reconectando… (tentativa ${attempt}/${max})`;
});

net.on('_reconnect_failed', () => {
  hud.menuStatus.textContent = 'Não foi possível reconectar. Recarregue a página.';
});

// envio de estado a ~30Hz (menos delay percebido pelos outros jogadores)
setInterval(() => {
  if (!playing || !connected || me.dead) return;
  const anim = (Math.hypot(me.vel.x, me.vel.z) > 1.5 ? 1 : 0) | (me.sliding ? 2 : 0) | (curW << 2);
  net.send({
    t: 's',
    p: [+me.pos.x.toFixed(2), +me.pos.y.toFixed(2), +me.pos.z.toFixed(2)],
    r: [+me.yaw.toFixed(3), +me.pitch.toFixed(3)],
    a: anim
  });
}, 33);

// ---------------- Conta (login/registro) ----------------
let auth = null; // {token, username}
{
  const savedToken = localStorage.getItem('sf_token');
  const savedUser = localStorage.getItem('sf_username');
  if (savedToken && savedUser) auth = { token: savedToken, username: savedUser };
}

function renderFriendsScreen() {
  hud.friendsHint.classList.toggle('hidden', !!auth);
  hud.friendsBox.classList.toggle('hidden', !auth);
  if (!auth) hud.friendsList.textContent = '';
}

function renderAccountPanel() {
  hud.accountInfo.textContent = '';
  if (auth) {
    hud.accountBtns.classList.add('hidden');
    hud.accUser.classList.add('hidden');
    hud.accPass.classList.add('hidden');
    hud.accountInfo.classList.remove('hidden');
    hud.accountInfo.append(`Logado como ${auth.username} · `);
    const logout = document.createElement('a');
    logout.href = '#'; logout.textContent = 'Sair'; logout.style.color = '#f0806a';
    logout.onclick = e => {
      e.preventDefault();
      auth = null;
      localStorage.removeItem('sf_token'); localStorage.removeItem('sf_username');
      hud.accountStatus.textContent = '';
      renderAccountPanel();
      if (net.open) net.send({ t: 'hello' });
    };
    hud.accountInfo.appendChild(logout);
  } else {
    hud.accountBtns.classList.remove('hidden');
    hud.accUser.classList.remove('hidden');
    hud.accPass.classList.remove('hidden');
    hud.accountInfo.classList.add('hidden');
  }
  updateIdChip();
  renderFriendsScreen();
  if (currentScreen === 'profile') loadProfile();
  if (currentScreen === 'friends') refreshFriends();
}
renderAccountPanel();
hud.nameInput.addEventListener('input', () => { if (!auth) updateIdChip(); });

hud.tabGuest.addEventListener('click', () => {
  hud.tabGuest.classList.add('active'); hud.tabAccount.classList.remove('active');
  hud.guestPanel.classList.remove('hidden'); hud.accountPanel.classList.add('hidden');
});
hud.tabAccount.addEventListener('click', () => {
  hud.tabAccount.classList.add('active'); hud.tabGuest.classList.remove('active');
  hud.accountPanel.classList.remove('hidden'); hud.guestPanel.classList.add('hidden');
});

const AUTH_ERRORS = {
  invalid_input: 'Usuário (3-20) e senha (mín. 8) são obrigatórios.',
  username_taken: 'Esse usuário já existe.',
  invalid_credentials: 'Usuário ou senha incorretos.'
};

async function doAuth(path) {
  const username = hud.accUser.value.trim();
  const password = hud.accPass.value;
  hud.accountStatus.textContent = '';
  try {
    const data = await api(path, { username, password });
    auth = { token: data.token, username: data.user.username };
    localStorage.setItem('sf_token', auth.token);
    localStorage.setItem('sf_username', auth.username);
    hud.accPass.value = '';
    renderAccountPanel();
    if (net.open) net.send({ t: 'hello', token: auth.token });
  } catch (err) {
    hud.accountStatus.textContent = AUTH_ERRORS[err.code] || 'Falha na conexão. Tente novamente.';
  }
}
hud.loginBtn.addEventListener('click', () => doAuth('/auth/login'));
hud.registerBtn.addEventListener('click', () => doAuth('/auth/register'));

// ---------------- Amigos ----------------
const FRIEND_ERRORS = {
  user_not_found: 'Usuário não encontrado.',
  already_friends: 'Vocês já são amigos.',
  request_pending: 'Pedido já enviado.',
  cannot_add_self: 'Você não pode se adicionar.',
  invalid_input: 'Digite um nome de usuário.'
};

async function refreshFriends() {
  if (!auth) return;
  try {
    const data = await apiAuth('GET', '/friends', auth.token);
    renderFriends(data);
  } catch (err) {
    if (err.status === 401) {
      // token expirado — volta ao estado deslogado
      auth = null;
      localStorage.removeItem('sf_token'); localStorage.removeItem('sf_username');
      renderAccountPanel();
    }
  }
}

function friendAction(fn) {
  return async () => {
    hud.friendStatus.style.color = '';
    hud.friendStatus.textContent = '';
    try { await fn(); await refreshFriends(); }
    catch (err) { hud.friendStatus.textContent = FRIEND_ERRORS[err.code] || 'Falha na conexão.'; }
  };
}

function friendRow(u, kind) {
  const row = document.createElement('div');
  row.className = 'friend-row';

  const dot = document.createElement('span');
  dot.className = 'fdot' + (u.online ? ' on' : '');
  row.appendChild(dot);

  const name = document.createElement('span');
  name.className = 'fname';
  name.textContent = u.username;
  name.style.cursor = 'pointer';
  name.title = 'Ver perfil';
  name.onclick = () => openPlayerProfile(u.username);
  row.appendChild(name);

  if (kind === 'friend') {
    const lvl = document.createElement('span');
    lvl.className = 'flvl';
    lvl.textContent = `nv ${u.level}`;
    row.appendChild(lvl);
    if (u.online && inRoom && roomInfo && roomInfo.mode === 'custom') {
      const inv = document.createElement('button');
      inv.className = 'f-accept';
      inv.textContent = '✉';
      inv.title = 'Convidar para a sala';
      inv.onclick = () => net.send({ t: 'invite', userId: u.id });
      row.appendChild(inv);
    }
  } else {
    const tag = document.createElement('span');
    tag.className = 'ftag';
    tag.textContent = kind === 'incoming' ? 'PEDIDO' : 'ENVIADO';
    row.appendChild(tag);
  }

  if (kind === 'incoming') {
    const ok = document.createElement('button');
    ok.className = 'f-accept'; ok.textContent = '✓'; ok.title = 'Aceitar';
    ok.onclick = friendAction(() => apiAuth('POST', '/friends/accept', auth.token, { userId: u.id }));
    row.appendChild(ok);
  }
  const rm = document.createElement('button');
  rm.className = 'f-remove'; rm.textContent = '✕';
  rm.title = kind === 'friend' ? 'Remover amigo' : (kind === 'incoming' ? 'Recusar' : 'Cancelar pedido');
  rm.onclick = friendAction(() => apiAuth('DELETE', `/friends/${u.id}`, auth.token));
  row.appendChild(rm);

  return row;
}

function renderFriends({ friends, incoming, outgoing }) {
  hud.friendsList.textContent = '';
  for (const u of incoming) hud.friendsList.appendChild(friendRow(u, 'incoming'));
  for (const u of friends) hud.friendsList.appendChild(friendRow(u, 'friend'));
  for (const u of outgoing) hud.friendsList.appendChild(friendRow(u, 'outgoing'));
  if (!hud.friendsList.children.length) {
    const empty = document.createElement('div');
    empty.className = 'friend-row';
    empty.style.opacity = '.5';
    empty.textContent = 'Nenhum amigo ainda — adicione pelo nome de usuário.';
    hud.friendsList.appendChild(empty);
  }
}

hud.friendAddBtn.addEventListener('click', friendAction(async () => {
  const username = hud.friendName.value.trim();
  await apiAuth('POST', '/friends/request', auth.token, { username });
  hud.friendName.value = '';
}));
hud.friendName.addEventListener('keydown', e => {
  if (e.key === 'Enter') hud.friendAddBtn.click();
});

// atualiza status online enquanto a tela de amigos está aberta
setInterval(() => {
  if (auth && currentScreen === 'friends') refreshFriends();
}, 20000);

// ---------------- Menu / fluxo ----------------
let pendingPlay = null;

function connectPresence() {
  if (net.ws && (net.ws.readyState === 0 || net.ws.readyState === 1)) return;
  net.connect();
}

function playName() {
  const usingAccount = hud.tabAccount.classList.contains('active');
  if (usingAccount && auth) return auth.username;
  const name = (hud.nameInput.value.trim() || 'Recruta').slice(0, 14);
  localStorage.setItem('sf_name', name);
  return name;
}

function sendPlay(msg) {
  SFX.unlock();
  const usingAccount = hud.tabAccount.classList.contains('active');
  if (usingAccount && !auth) {
    hud.accountStatus.textContent = 'Faça login ou crie uma conta primeiro.';
    return;
  }
  msg.name = playName();
  me.name = msg.name;
  hud.menuStatus.textContent = 'Conectando…';
  if (net.open) net.send(msg);
  else { pendingPlay = msg; connectPresence(); }
}

hud.startBtn.addEventListener('click', () => { closeScreen(); sendPlay({ t: 'play', mode: 'public' }); });
hud.mpBtn.addEventListener('click', () => { closeScreen(); sendPlay({ t: 'play', mode: 'public' }); });
hud.createBtn.addEventListener('click', () => { closeScreen(); sendPlay({
  t: 'play', mode: 'create', gm: hud.cfgGm.value,
  bots: +hud.cfgBots.value, kl: +hud.cfgKl.value, tl: +hud.cfgTl.value
}); });
hud.joinBtn.addEventListener('click', () => {
  const code = hud.codeInput.value.trim().toUpperCase();
  if (code.length !== 4) { hud.menuStatus.textContent = 'O código tem 4 caracteres.'; return; }
  closeScreen();
  sendPlay({ t: 'play', mode: 'join', code });
});
hud.codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') hud.joinBtn.click(); });

hud.resumeBtn.addEventListener('click', () => { if (playing) canvas.requestPointerLock(); });
hud.leaveBtn.addEventListener('click', () => {
  net.send({ t: 'leave' });
  exitToMenu();
});

hud.inviteAccept.addEventListener('click', () => {
  if (!lastInvite) return;
  hud.inviteBanner.classList.add('hidden');
  sendPlay({ t: 'play', mode: 'join', code: lastInvite.code });
  lastInvite = null;
});
hud.inviteDismiss.addEventListener('click', () => {
  hud.inviteBanner.classList.add('hidden');
  lastInvite = null;
});

hud.team0.addEventListener('click', () => net.send({ t: 'team', team: 0 }));
hud.team1.addEventListener('click', () => net.send({ t: 'team', team: 1 }));

function updateTeamButtons() {
  hud.team0.classList.toggle('mine', me.team === 0);
  hud.team1.classList.toggle('mine', me.team === 1);
}

// alterna o lobby entre "menu inicial" e "pausa em partida"
function setMenuMode(paused) {
  hud.menu.classList.toggle('paused', paused);
  hud.pauseCard.classList.toggle('hidden', !paused);
  const isTdm = paused && roomInfo && roomInfo.gm === 'tdm';
  hud.teamSwitch.classList.toggle('hidden', !isTdm);
  if (isTdm) updateTeamButtons();
  // Se pausou (voltou ao lobby), inicia a música ambiente
  if (paused) Music.startLobbyMusic();
  else Music.stopLobbyMusic();
  if (paused && roomInfo && roomInfo.mode === 'custom') {
    hud.roomLine.classList.remove('hidden');
    hud.roomCode.textContent = roomInfo.code;
  } else {
    hud.roomLine.classList.add('hidden');
  }
}

function exitToMenu() {
  playing = false;
  inRoom = false;
  roomInfo = null;
  vmRoot.visible = false;
  hud.game.classList.remove('show');
  clearRoomState();
  hud.menuStatus.textContent = '';
  closeScreen();
  setMenuMode(false);
  hud.menu.classList.remove('hidden');
  if (document.exitPointerLock) document.exitPointerLock();
  renderAccountPanel();
}

function startPlaying() {
  playing = true;
  vmRoot.visible = true;
  hud.menu.classList.add('hidden');
  hud.game.classList.add('show');
  closeScreen();
  hud.menuStatus.textContent = '';
  updateHpHUD(); updateAmmoHUD();
  if (roomInfo) updateMatchBar(Math.max(0, Math.ceil((roomInfo.end - Date.now()) / 1000)));
  setMenuMode(true);
  canvas.requestPointerLock();
}

// presença: conecta ao abrir o site (amigos online + convites)
connectPresence();

// modo de teste automatizado (?test=1): entra direto no multiplayer
// (smokedemo faz sua própria entrada numa sala limpa — ver abaixo)
if (TESTMODE && !SMOKEDEMO) {
  addEventListener('load', () => {
    hud.nameInput.value = 'Tester';
    hud.startBtn.click();
  });
}

// atalho: ?armory abre direto o Arsenal (útil pra demonstrar/testar a tela)
if (new URLSearchParams(location.search).has('armory')) {
  addEventListener('load', () => showScreen('armory'));
}

// atalho de demonstração: ?smokedemo entra numa sala limpa (sem bots) e lança
// uma fumaça longe pra frente (útil pra ver/rever a forma da nuvem)
if (SMOKEDEMO) {
  addEventListener('load', () => {
    hud.nameInput.value = 'Demo';
    sendPlay({ t: 'play', mode: 'create', gm: 'ffa', bots: 0, kl: 30, tl: 10 });
  });
  let thrown = false;
  const iv = setInterval(() => {
    if (thrown || !playing || me.dead) return;
    thrown = true; clearInterval(iv);
    me.pitch = 0.05;                  // levemente pra baixo → cai no aberto à frente
    startNadeCook('smoke');
    setTimeout(() => releaseNadeThrow(), 380);   // força média
  }, 200);
}

// ---------------- Loop ----------------
let vmKick = 0, bobT = 0;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updatePerf(dt);
  world.update(t);
  updateEffects(dt);
  updateSmokeClouds(dt);   // nuvens evoluem sempre (mesmo morto/killcam)
  if (!killcam.active) { updateRemotes(dt, t); updateRemoteNades(dt); }   // durante o killcam quem posiciona é updateKillcam

  if (playing && killcam.active) {
    updateKillcam(dt);
  } else if (playing && !me.dead) {
    updateMovement(dt);

    // recarga
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) {
        reloading = 0;
        ammo[curW] = WEAPONS[curW].mag;
        SFX.reloadEnd();
        updateAmmoHUD();
      }
    }
    if (swapT > 0) swapT -= dt;
    if (me.usingKit > 0) {
      me.usingKit = Math.max(0, me.usingKit - dt);
      updateKitHUD();
    }
    if (mouseDown && WEAPONS[curW].auto) tryFire();
    updateMeleeState(dt);
    updateNadeState(dt);

    // câmera (+ tremor curto de impacto da faca)
    camera.position.set(me.pos.x, me.pos.y + me.eyeH, me.pos.z);
    recoil *= Math.exp(-12 * dt);
    camShake *= Math.exp(-16 * dt);
    const shX = camShake > 0.001 ? (Math.random() - 0.5) * camShake : 0;
    const shY = camShake > 0.001 ? (Math.random() - 0.5) * camShake : 0;
    camera.rotation.y = me.yaw + shY;
    camera.rotation.x = me.pitch + recoil + shX;
    camera.rotation.z = me.sliding ? 0.05 : 0;

    // FOV dinâmico
    const hv = Math.hypot(me.vel.x, me.vel.z);
    const targetFov = zoomed ? ZOOM_FOV : BASE_FOV + (me.sliding ? 6 : 0) + Math.max(0, (hv - 8.2)) * 0.5;
    const prevFov = camera.fov;
    camera.fov += (targetFov - camera.fov) * Math.min(1, 12 * dt);
    // só recalcula a projeção se o FOV de fato mudou (economiza CPU)
    if (Math.abs(camera.fov - prevFov) > 0.01) camera.updateProjectionMatrix();

    // bob compartilhado (armas e faca)
    if (me.grounded && hv > 1 && !me.sliding) bobT += dt * hv * 1.4;

    // viewmodel: faca (própria animação) ou arma (bob + recuo + troca)
    const knifeOut = curW === KNIFE || (melee.active && melee.quick);
    if (knifeOut) {
      updateKnifeViewmodel(dt);
    } else {
      const vmY = -0.24 + Math.abs(Math.sin(bobT)) * 0.014 + (reloading > 0 ? -0.12 : 0) + (swapT > 0 ? -swapT * 0.6 : 0);
      const vmX = 0.26 + Math.sin(bobT) * 0.008;
      vmRoot.position.x += (vmX - vmRoot.position.x) * Math.min(1, 10 * dt);
      vmRoot.position.y += (vmY - vmRoot.position.y) * Math.min(1, 10 * dt);
      vmRoot.position.z += ((-0.5 + vmKick) - vmRoot.position.z) * Math.min(1, 14 * dt);
      vmRoot.rotation.x = (reloading > 0 ? -0.5 : 0) + vmKick * 1.2;
      // zera resíduo de rotação da faca ao voltar para a arma
      vmRoot.rotation.y += (0 - vmRoot.rotation.y) * Math.min(1, 10 * dt);
      vmRoot.rotation.z += (0 - vmRoot.rotation.z) * Math.min(1, 10 * dt);
    }
    vmKick *= Math.exp(-10 * dt);
  } else if (playing && me.dead) {
    camera.position.set(me.pos.x, me.pos.y + 0.6, me.pos.z);
    camera.rotation.y = me.yaw;
    camera.rotation.x = -0.3;
    camera.rotation.z = 0.3;
  } else {
    // lobby: personagem em destaque girando devagar + câmera com leve deriva
    lobbyCharRef.g.visible = true;
    lobbyCharRef.g.rotation.y += dt * 0.4;
    const drift = Math.sin(t * 0.13) * 2.4;
    camera.position.set(drift, 3.0, 15.8);
    camera.lookAt(0, 1.45, 6.5);
    if (Math.abs(camera.fov - BASE_FOV) > 0.01) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
  }
  lobbyCharRef.g.visible = !playing;

  renderer.render(scene, camera);
}
frame();
