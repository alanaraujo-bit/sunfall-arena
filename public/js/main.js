// ============================================================
// SUNFALL ARENA — cliente principal
// Movimentação rápida (slide/bunny-hop), hitscan, efeitos,
// interpolação de jogadores remotos e HUD.
// ============================================================
import * as THREE from 'three';
import { BOUNDS, PLAYER, raycastSolids } from '/shared/mapdata.js';
import { buildWorld, makeCharacter, makeViewmodel } from './world.js';
import { tex, spriteTex } from './textures.js';
import { Net, api, apiAuth, apiPublicGet } from './net.js';
import { SFX } from './audio.js';

// Log de erros visível no DOM (debug em headless)
const errlog = document.getElementById('errlog');
window.addEventListener('error', e => { errlog.textContent += e.message + '\n'; });

// ---------------- Setup básico ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

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

const world = buildWorld(scene);

// ---------------- HUD ----------------
const $ = id => document.getElementById(id);
const hud = {
  menu: $('menu'), nameInput: $('name-input'),
  mpBtn: $('mp-btn'), customBtn: $('custom-btn'), customPanel: $('custom-panel'),
  cfgGm: $('cfg-gm'), cfgBots: $('cfg-bots'), cfgKl: $('cfg-kl'), cfgTl: $('cfg-tl'),
  createBtn: $('create-btn'), codeInput: $('code-input'), joinBtn: $('join-btn'),
  modeBtns: $('mode-btns'), pauseBtns: $('pause-btns'),
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
  killPop: $('kill-pop'),
  tabGuest: $('tab-guest'), tabAccount: $('tab-account'),
  guestPanel: $('guest-panel'), accountPanel: $('account-panel'),
  accUser: $('acc-user'), accPass: $('acc-pass'), accountStatus: $('account-status'),
  accountInfo: $('account-info'), accountBtns: $('account-btns'),
  loginBtn: $('login-btn'), registerBtn: $('register-btn'),
  friendsBox: $('friends-box'), friendName: $('friend-name'),
  friendAddBtn: $('friend-add-btn'), friendStatus: $('friend-status'),
  friendsList: $('friends-list'),
  navPlay: $('nav-play'), navProfile: $('nav-profile'), navConfig: $('nav-config'),
  panelPlay: $('panel-play'), panelProfile: $('panel-profile'), panelConfig: $('panel-config'),
  profileHint: $('profile-hint'), profileContent: $('profile-content'),
  pfName: $('pf-name'), pfLevel: $('pf-level'), pfXpFill: $('pf-xpfill'), pfXpText: $('pf-xptext'),
  stWins: $('st-wins'), stMatches: $('st-matches'), stKills: $('st-kills'),
  stDeaths: $('st-deaths'), stKd: $('st-kd'), stHs: $('st-hs'),
  setQuality: $('set-quality'), setFov: $('set-fov'), setFovVal: $('set-fov-val'),
  setVol: $('set-vol'), setVolVal: $('set-vol-val'),
  bindsList: $('binds-list'), bindsReset: $('binds-reset'),
  navRank: $('nav-rank'), panelRank: $('panel-rank'),
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

// ---------------- Configurações ----------------
const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', slide: 'ShiftLeft', reload: 'KeyR',
  w1: 'Digit1', w2: 'Digit2', board: 'Tab'
};
const BIND_LABELS = {
  forward: 'Andar — frente', back: 'Andar — trás', left: 'Andar — esquerda', right: 'Andar — direita',
  jump: 'Pular', slide: 'Deslizar', reload: 'Recarregar',
  w1: 'Arma 1', w2: 'Arma 2', board: 'Placar'
};

let settings = { quality: 'high', fov: 78, vol: 50, binds: { ...DEFAULT_BINDS } };
try {
  const saved = JSON.parse(localStorage.getItem('sf_settings') || '{}');
  settings = { ...settings, ...saved, binds: { ...DEFAULT_BINDS, ...(saved.binds || {}) } };
} catch { /* settings corrompidas: usa padrão */ }
const binds = settings.binds;
const saveSettings = () => localStorage.setItem('sf_settings', JSON.stringify(settings));

function applyGraphics() {
  if (settings.quality === 'low') {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 0.85));
    world.sun.castShadow = false;
  } else if (settings.quality === 'med') {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.3));
    world.sun.castShadow = true;
  } else {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    world.sun.castShadow = true;
  }
  BASE_FOV = settings.fov;
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

hud.setQuality.value = settings.quality;
hud.setQuality.onchange = () => { settings.quality = hud.setQuality.value; applyGraphics(); saveSettings(); };
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
SFX.setVolume(settings.vol / 100);
applyGraphics();
buildBindsUI();

// ---------------- Navegação do menu ----------------
function showPanel(name) {
  hud.navPlay.classList.toggle('active', name === 'play');
  hud.navProfile.classList.toggle('active', name === 'profile');
  hud.navRank.classList.toggle('active', name === 'rank');
  hud.navConfig.classList.toggle('active', name === 'config');
  hud.panelPlay.classList.toggle('hidden', name !== 'play');
  hud.panelProfile.classList.toggle('hidden', name !== 'profile');
  hud.panelRank.classList.toggle('hidden', name !== 'rank');
  hud.panelConfig.classList.toggle('hidden', name !== 'config');
  if (name === 'profile') loadProfile();
  if (name === 'rank') loadLeaderboard();
}
hud.navPlay.onclick = () => showPanel('play');
hud.navProfile.onclick = () => showPanel('profile');
hud.navRank.onclick = () => showPanel('rank');
hud.navConfig.onclick = () => showPanel('config');

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
  eyeH: PLAYER.EYE, stepT: 0
};

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
const TESTMODE = new URLSearchParams(location.search).has('test');

// nascer olhando para o centro da arena
function faceCenter() {
  me.yaw = Math.atan2(me.pos.x, me.pos.z);
  me.pitch = 0;
}

// ---------------- Armas ----------------
const WEAPONS = [
  { name: 'FALCÃO-9', dmg: 16, head: 1.75, int: 0.115, mag: 26, reload: 1.35, spread: 0.012, auto: true, kick: 0.012, sniper: false },
  { name: 'FERRÃO-SR', dmg: 92, head: 2, int: 1.05, mag: 5, reload: 1.8, spread: 0.05, auto: false, kick: 0.05, sniper: true }
];
const ammo = [WEAPONS[0].mag, WEAPONS[1].mag];
let curW = 0, lastShot = 0, reloading = 0, zoomed = false, recoil = 0, swapT = 0;

const vmAR = makeViewmodel('ar');
const vmSR = makeViewmodel('sr');
const vmRoot = new THREE.Group();
vmRoot.position.set(0.26, -0.24, -0.5);
vmRoot.add(vmAR.group, vmSR.group);
vmSR.group.visible = false;
vmRoot.visible = false; // oculto até entrar na partida
camera.add(vmRoot);
scene.add(camera);
const viewmodels = [vmAR, vmSR];

// ---------------- Efeitos ----------------
const effects = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
const flashTex = spriteTex('#fff8e0', '#ffb040');
const dustTex = spriteTex('#e8cfa8', '#b08a5c');
const bloodTex = spriteTex('#ff7060', '#a02020');
const poofTex = spriteTex('#d0f0e8', '#3fc8b4');

function spawnTracer(a, b, color = 0xffd9a0) {
  const len = a.distanceTo(b);
  if (len < 0.5) return;
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  m.scale.set(0.03, 0.03, len);
  m.position.copy(a).lerp(b, 0.5);
  m.lookAt(b);
  scene.add(m);
  effects.push({ obj: m, ttl: 0.07, life: 0.07, kind: 'fade' });
}

function spawnBurst(point, texture, n = 6, speed = 3, size = 0.14, up = 2) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false
    }));
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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    rotation: Math.random() * Math.PI
  }));
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
      e.obj.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    const k = e.ttl / e.life;
    e.obj.material.opacity = k;
    if (e.kind === 'particle') {
      e.vel.y -= 9 * dt;
      e.obj.position.addScaledVector(e.vel, dt);
    }
  }
}

// ---------------- Nametags ----------------
function makeNametag(name, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(20,14,8,0.85)';
  ctx.strokeText(name, 128, 42);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 42);
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
  for (const r of remotes.values()) {
    const u = r.model.userData;
    if (!r.alive) {
      // animação de queda
      r.deadT += dt;
      r.model.rotation.x = Math.min(r.deadT * 5, 1) * -Math.PI / 2;
      r.model.position.y = Math.max(r.target.y - Math.min(r.deadT * 2, 1) * 0.4, r.target.y - 0.4);
      if (r.deadT > 1.4) r.model.visible = false;
      continue;
    }
    const k = 1 - Math.exp(-14 * dt);
    r.model.position.lerp(r.target, k);
    // yaw pelo caminho mais curto
    let dy = r.tYaw - r.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    r.yaw += dy * k;
    r.model.rotation.y = r.yaw;
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
  if (!playing || me.dead) return;
  if (e.code === binds.jump) wantJump = true;
  if (e.code === binds.reload) startReload();
  if (e.code === binds.w1) switchWeapon(0);
  if (e.code === binds.w2) switchWeapon(1);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === binds.board) hud.board.classList.remove('show');
});
addEventListener('wheel', () => { if (playing && !me.dead) switchWeapon(1 - curW); });
canvas.addEventListener('mousedown', e => {
  if (!playing) return;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) { mouseDown = true; tryFire(); }
  if (e.button === 2 && WEAPONS[curW].sniper && !reloading && !me.dead) setZoom(true);
});
addEventListener('mouseup', e => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) setZoom(false);
});
addEventListener('contextmenu', e => e.preventDefault());
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
    hud.menuTitle.textContent = 'PAUSADO';
    showPanel('play');
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
  if (i === curW || reloading || me.dead) return;
  curW = i;
  swapT = 0.25;
  setZoom(false);
  viewmodels[0].group.visible = i === 0;
  viewmodels[1].group.visible = i === 1;
  SFX.swap();
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

  // slide
  if (keys[binds.slide] && me.grounded && !me.sliding && (fx || fz) &&
      Math.hypot(me.vel.x, me.vel.z) > 4) {
    me.sliding = true;
    me.slideT = 0.85;
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
  const now = performance.now() / 1000;
  if (!playing || matchEnded || me.dead || reloading > 0 || swapT > 0) return;
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
    spawnBurst(endPoint, bloodTex, 6, 2.5, 0.16);
    const dmg = Math.round(w.dmg * (headshot ? w.head : 1));
    net.send({ t: 'hit', id: hitId, dmg, h: headshot });
    showHitmarker(headshot);
    if (headshot) SFX.headshot(); else SFX.hit();
  } else if (hitT < 150) {
    spawnBurst(endPoint, dustTex, 5, 2, 0.13);
  }

  net.send({ t: 'fire', o: [_origin.x, _origin.y, _origin.z], d: [_dir.x, _dir.y, _dir.z], w: curW });
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
  if (reloading > 0 || ammo[curW] === w.mag || me.dead) return;
  reloading = w.reload;
  setZoom(false);
  SFX.reload();
  hud.wname.textContent = 'RECARREGANDO…';
}

// ---------------- HUD helpers ----------------
function updateAmmoHUD() {
  hud.ammo.textContent = ammo[curW];
  hud.wname.textContent = WEAPONS[curW].name;
}

function updateHpHUD() {
  hud.hpFill.style.width = Math.max(0, me.hp) + '%';
  hud.hpNum.textContent = Math.max(0, Math.ceil(me.hp));
  hud.hpFill.classList.toggle('low', me.hp <= 30);
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

function addFeed(killer, victim, head, isMe) {
  const div = document.createElement('div');
  div.className = 'feed-item' + (isMe ? ' me' : '');
  const km = meta.get(killer) || (killer === me.id ? me : null);
  const vm2 = meta.get(victim) || (victim === me.id ? me : null);
  const kn = killer === me.id ? me.name : (km ? km.name : '?');
  const vn = victim === me.id ? me.name : (vm2 ? vm2.name : '?');
  const kc = killer === me.id ? me.color : (km ? km.color : '#fff');
  const vc = victim === me.id ? me.color : (vm2 ? vm2.color : '#fff');
  div.innerHTML = `<b style="color:${kc}">${kn}</b> <span class="fx">${head ? '⌖' : '⚔'}</span> <b style="color:${vc}">${vn}</b>`;
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
  hud.feed.textContent = '';
  hud.death.classList.remove('show');
  hud.endscreen.classList.remove('show');
  if (endCountTimer) { clearInterval(endCountTimer); endCountTimer = null; }
  matchEnded = false;
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
      faceCenter();
    } else addRemote(p);
  }
  startPlaying();
});
net.on('j', msg => addRemote(msg.p));
net.on('l', msg => removeRemote(msg.id));
net.on('s', msg => {
  for (const [id, a] of Object.entries(msg.p)) {
    const r = remotes.get(+id);
    if (!r) continue;
    r.target.set(a[0], a[1], a[2]);
    r.tYaw = a[3];
    r.pitch = a[4];
    r.anim = a[5];
    r.hp = a[6];
  }
  if (typeof msg.tl === 'number') updateMatchBar(msg.tl, msg.ts);
});

function computeTeamScores() {
  const s = [0, 0];
  if (me.team === 0 || me.team === 1) s[me.team] += me.k || 0;
  for (const m of meta.values()) if (m.team === 0 || m.team === 1) s[m.team] += m.k || 0;
  return s;
}

function updateMatchBar(secondsLeft, teamScoresArr) {
  const m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
  hud.mbTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
  hud.mbTime.classList.toggle('low', secondsLeft <= 60 && secondsLeft > 0);

  if (roomInfo && roomInfo.gm === 'tdm') {
    const ts = teamScoresArr || computeTeamScores();
    const mine = me.team === 1 ? 1 : 0, foe = 1 - mine;
    hud.mbScore.innerHTML =
      `<span style="color:${TEAM_COLORS[mine]};font-weight:bold">${ts[mine]}</span>` +
      ` <span style="opacity:.5">—</span> ` +
      `<span style="color:${TEAM_COLORS[foe]}">${ts[foe]}</span>` +
      ` <span style="opacity:.5;font-size:12px">/${roomInfo.kl}</span>`;
  } else {
    let lead = me.k || 0;
    for (const p of meta.values()) if (p.k > lead) lead = p.k;
    hud.mbScore.textContent = `${lead}/${roomInfo ? roomInfo.kl : '-'}`;
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
});
net.on('die', msg => {
  // atualizar placar
  if (msg.id === me.id) { me.d = msg.vd; }
  else if (meta.has(msg.id)) meta.get(msg.id).d = msg.vd;
  if (msg.by === me.id) { me.k = msg.kk; }
  else if (meta.has(msg.by)) meta.get(msg.by).k = msg.kk;

  addFeed(msg.by, msg.id, msg.h, msg.by === me.id || msg.id === me.id);

  if (msg.id === me.id) {
    me.dead = true;
    me.sliding = false;
    setZoom(false);
    mouseDown = false;
    const killer = meta.get(msg.by);
    hud.deathBy.textContent = killer ? killer.name : '???';
    hud.death.classList.add('show');
    SFX.die();
  } else {
    const r = remotes.get(msg.id);
    if (r) { r.alive = false; r.deadT = 0; }
    if (msg.by === me.id) { SFX.kill(); showKillPop(); }
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
    hud.death.classList.remove('show');
    updateHpHUD(); updateAmmoHUD();
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
      updateHpHUD(); updateAmmoHUD();
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
  const wasPlaying = playing;
  if (playing) {
    playing = false;
    inRoom = false;
    roomInfo = null;
    vmRoot.visible = false;
    hud.game.classList.remove('show');
    clearRoomState();
    hud.menu.classList.remove('hidden');
    hud.menuTitle.textContent = 'CONEXÃO PERDIDA';
    hud.menuStatus.textContent = 'Reconectando…';
    setMenuMode(false);
    if (document.exitPointerLock) document.exitPointerLock();
  }
  setTimeout(connectPresence, wasPlaying ? 1500 : 3000);
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

function renderAccountPanel() {
  hud.accountInfo.textContent = '';
  if (auth) {
    hud.accountBtns.classList.add('hidden');
    hud.accUser.classList.add('hidden');
    hud.accPass.classList.add('hidden');
    hud.accountInfo.classList.remove('hidden');
    hud.friendsBox.classList.remove('hidden');
    refreshFriends();
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
    hud.friendsBox.classList.add('hidden');
    hud.friendsList.textContent = '';
  }
  if (!hud.panelProfile.classList.contains('hidden')) loadProfile();
}
renderAccountPanel();

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

// atualiza status online enquanto o menu (ou pausa) está aberto
setInterval(() => {
  if (auth && !hud.menu.classList.contains('hidden') && !hud.accountPanel.classList.contains('hidden')) refreshFriends();
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

hud.mpBtn.addEventListener('click', () => sendPlay({ t: 'play', mode: 'public' }));
hud.customBtn.addEventListener('click', () => hud.customPanel.classList.toggle('hidden'));
hud.createBtn.addEventListener('click', () => sendPlay({
  t: 'play', mode: 'create', gm: hud.cfgGm.value,
  bots: +hud.cfgBots.value, kl: +hud.cfgKl.value, tl: +hud.cfgTl.value
}));
hud.joinBtn.addEventListener('click', () => {
  const code = hud.codeInput.value.trim().toUpperCase();
  if (code.length !== 4) { hud.menuStatus.textContent = 'O código tem 4 caracteres.'; return; }
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

function setMenuMode(paused) {
  hud.modeBtns.classList.toggle('hidden', paused);
  hud.customPanel.classList.add('hidden');
  hud.pauseBtns.classList.toggle('hidden', !paused);
  const isTdm = paused && roomInfo && roomInfo.gm === 'tdm';
  hud.teamSwitch.classList.toggle('hidden', !isTdm);
  if (isTdm) updateTeamButtons();
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
  hud.menuTitle.innerHTML = 'SUNFALL<span>ARENA</span>';
  hud.menuStatus.textContent = '';
  showPanel('play');
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
  hud.menuTitle.textContent = 'PAUSADO';
  document.getElementById('menu-form').classList.add('compact');
  hud.menuStatus.textContent = '';
  updateHpHUD(); updateAmmoHUD();
  if (roomInfo) updateMatchBar(Math.max(0, Math.ceil((roomInfo.end - Date.now()) / 1000)));
  setMenuMode(true);
  canvas.requestPointerLock();
}

// presença: conecta ao abrir o site (amigos online + convites)
connectPresence();

// modo de teste automatizado (?test=1): entra direto no multiplayer
if (TESTMODE) {
  addEventListener('load', () => {
    hud.nameInput.value = 'Tester';
    hud.mpBtn.click();
  });
}

// ---------------- Loop ----------------
let vmKick = 0, bobT = 0;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  world.update(t);
  updateEffects(dt);
  updateRemotes(dt, t);

  if (playing && !me.dead) {
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
    if (mouseDown && WEAPONS[curW].auto) tryFire();

    // câmera
    camera.position.set(me.pos.x, me.pos.y + me.eyeH, me.pos.z);
    recoil *= Math.exp(-12 * dt);
    camera.rotation.y = me.yaw;
    camera.rotation.x = me.pitch + recoil;
    camera.rotation.z = me.sliding ? 0.05 : 0;

    // FOV dinâmico
    const hv = Math.hypot(me.vel.x, me.vel.z);
    const targetFov = zoomed ? ZOOM_FOV : BASE_FOV + (me.sliding ? 6 : 0) + Math.max(0, (hv - 8.2)) * 0.5;
    camera.fov += (targetFov - camera.fov) * Math.min(1, 12 * dt);
    camera.updateProjectionMatrix();

    // viewmodel: bob + recuo + troca
    if (me.grounded && hv > 1 && !me.sliding) bobT += dt * hv * 1.4;
    const vmY = -0.24 + Math.abs(Math.sin(bobT)) * 0.014 + (reloading > 0 ? -0.12 : 0) + (swapT > 0 ? -swapT * 0.6 : 0);
    const vmX = 0.26 + Math.sin(bobT) * 0.008;
    vmRoot.position.x += (vmX - vmRoot.position.x) * Math.min(1, 10 * dt);
    vmRoot.position.y += (vmY - vmRoot.position.y) * Math.min(1, 10 * dt);
    vmRoot.position.z += ((-0.5 + vmKick) - vmRoot.position.z) * Math.min(1, 14 * dt);
    vmRoot.rotation.x = (reloading > 0 ? -0.5 : 0) + vmKick * 1.2;
    vmKick *= Math.exp(-10 * dt);
  } else if (playing && me.dead) {
    camera.position.set(me.pos.x, me.pos.y + 0.6, me.pos.z);
    camera.rotation.y = me.yaw;
    camera.rotation.x = -0.3;
    camera.rotation.z = 0.3;
  } else {
    // câmera orbital do menu
    const a = t * 0.06;
    camera.position.set(Math.cos(a) * 33, 17, Math.sin(a) * 33);
    camera.lookAt(0, 2.5, 0);
    if (camera.fov !== BASE_FOV) { camera.fov = BASE_FOV; camera.updateProjectionMatrix(); }
  }

  renderer.render(scene, camera);
}
frame();
