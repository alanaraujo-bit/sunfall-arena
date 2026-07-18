// ============================================================
// SUNFALL ARENA — ARSENAL (Armory)
// Tela premium de equipamento: visualizador 3D girável, ficha
// técnica das armas e loadout. Renderer próprio, isolado do jogo,
// que só roda enquanto a tela está aberta.
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { tex } from './textures.js';
import { ARSENAL, ATTACH_SLOTS, byId } from './arsenal-data.js';

// ------------------------------------------------------------
// Modelo 3D detalhado — CORVO-A4 (fuzil de assalto, arma-herói)
// Comprimento no eixo X (cano p/ -X, coronha p/ +X). Estilizado
// e legível, com receiver, trilho, luneta ponto-vermelho, cano
// com quebra-chamas, carregador curvo, punho, coronha e acentos.
// ------------------------------------------------------------
function buildCorvoA4() {
  const g = new THREE.Group();

  const gun = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x8b9299, roughness: 0.42, metalness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c2c9, roughness: 0.28, metalness: 0.95 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x21262b, roughness: 0.72, metalness: 0.15 });
  const poly2 = new THREE.MeshStandardMaterial({ color: 0x30373d, roughness: 0.6, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121519, roughness: 0.85, metalness: 0.1 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3fc8b4, roughness: 0.4, metalness: 0.5, emissive: 0x123f39, emissiveIntensity: 0.6 });
  const dot = new THREE.MeshStandardMaterial({ color: 0x8affe6, emissive: 0x35e0c8, emissiveIntensity: 3.2, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1a1c, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.55 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ---- receiver (corpo) ----
  add(rbox(0.62, 0.135, 0.1), gun, 0.0, 0, 0);                 // lower receiver
  add(rbox(0.66, 0.075, 0.092), poly2, -0.02, 0.095, 0);       // upper receiver
  add(rbox(0.2, 0.05, 0.088), gun, 0.16, 0.06, 0);             // traseira do upper (junto à coronha)
  // tampa de ejeção + acento teal na lateral
  add(new THREE.BoxGeometry(0.16, 0.05, 0.006), dark, -0.02, 0.05, 0.049);
  add(new THREE.BoxGeometry(0.34, 0.022, 0.004), accent, 0.02, -0.03, 0.051);
  add(new THREE.BoxGeometry(0.34, 0.022, 0.004), accent, 0.02, -0.03, -0.051);
  // ferrolho/charging handle
  add(cyl(0.016, 0.016, 0.05, 12), steel, 0.2, 0.11, 0.055, Math.PI / 2, 0, 0);

  // ---- trilho superior (Picatinny) ----
  add(rbox(0.66, 0.02, 0.05), dark, -0.02, 0.14, 0);
  for (let i = 0; i < 13; i++) {
    add(new THREE.BoxGeometry(0.012, 0.028, 0.052), poly, -0.32 + i * 0.05, 0.145, 0);
  }

  // ---- luneta ponto-vermelho ----
  const optic = new THREE.Group();
  optic.position.set(0.02, 0.2, 0);
  g.add(optic);
  const oadd = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); optic.add(m); return m;
  };
  oadd(rbox(0.02, 0.06, 0.05), dark, -0.06, -0.03, 0);        // suporte frontal
  oadd(rbox(0.02, 0.06, 0.05), dark, 0.06, -0.03, 0);         // suporte traseiro
  oadd(cyl(0.045, 0.045, 0.14, 20), poly, 0, 0.01, 0, 0, 0, Math.PI / 2); // tubo
  oadd(cyl(0.05, 0.05, 0.02, 20), dark, -0.07, 0.01, 0, 0, 0, Math.PI / 2); // aro frontal
  oadd(cyl(0.05, 0.05, 0.02, 20), dark, 0.07, 0.01, 0, 0, 0, Math.PI / 2);  // aro traseiro
  oadd(cyl(0.042, 0.042, 0.006, 20), glass, -0.066, 0.01, 0, 0, 0, Math.PI / 2); // lente
  oadd(new THREE.SphereGeometry(0.01, 10, 10), dot, -0.06, 0.01, 0);         // ponto vermelho (teal)

  // ---- guarda-mão + trilhos laterais ----
  add(rbox(0.4, 0.1, 0.088), poly, -0.44, 0.0, 0);
  for (let i = 0; i < 6; i++) {
    add(new THREE.BoxGeometry(0.03, 0.014, 0.09), dark, -0.6 + i * 0.055, -0.045, 0);  // ranhuras de ventilação
  }
  add(new THREE.BoxGeometry(0.02, 0.02, 0.004), accent, -0.44, 0.0, 0.045);

  // ---- cano + quebra-chamas ----
  add(cyl(0.026, 0.026, 0.36, 18), steel, -0.78, 0.02, 0, 0, 0, Math.PI / 2);
  add(cyl(0.034, 0.03, 0.09, 16), dark, -0.98, 0.02, 0, 0, 0, Math.PI / 2);       // quebra-chamas
  for (let i = 0; i < 4; i++) {                                                    // fendas do quebra-chamas
    add(new THREE.BoxGeometry(0.06, 0.01, 0.07), gun, -0.98, 0.02, 0, 0, i * Math.PI / 4, 0);
  }
  add(cyl(0.03, 0.03, 0.02, 16), poly2, -0.62, 0.02, 0, 0, 0, Math.PI / 2);       // bloco de gás
  add(new THREE.BoxGeometry(0.012, 0.05, 0.012), steel, -0.66, 0.075, 0);         // massa de mira dobrável

  // ---- carregador curvo (aprox. por segmentos) ----
  const mag = new THREE.Group();
  mag.position.set(-0.12, -0.14, 0);
  mag.rotation.z = 0.18;
  g.add(mag);
  const madd = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; mag.add(m); return m; };
  madd(rbox(0.11, 0.14, 0.07), poly, 0, 0, 0);
  madd(rbox(0.1, 0.12, 0.066), poly2, 0.03, -0.14, 0, 0.24);
  madd(rbox(0.09, 0.06, 0.06), dark, 0.06, -0.24, 0, 0.24);
  madd(new THREE.BoxGeometry(0.008, 0.24, 0.05), accent, -0.05, -0.02, 0.0, 0.05);

  // ---- punho de pistola + guarda-gatilho ----
  add(rbox(0.09, 0.16, 0.075), poly, 0.14, -0.13, 0, 0, 0, -0.32);
  add(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), dark, 0.02, -0.11, 0, Math.PI, 0, 0);
  add(new THREE.BoxGeometry(0.014, 0.04, 0.02), steel, 0.02, -0.1, 0);           // gatilho

  // ---- coronha ajustável ----
  add(cyl(0.02, 0.02, 0.18, 12), poly2, 0.34, 0.03, 0, 0, 0, Math.PI / 2);        // tubo
  add(rbox(0.06, 0.15, 0.085), poly, 0.44, 0.0, 0);                               // corpo da coronha
  add(rbox(0.03, 0.17, 0.088), dark, 0.47, 0.0, 0);                               // apoio de ombro
  add(rbox(0.05, 0.05, 0.08), poly2, 0.4, -0.09, 0, 0, 0, 0.5);                    // apoio inferior
  add(new THREE.BoxGeometry(0.02, 0.02, 0.004), accent, 0.44, 0.06, 0.044);

  // ---- parafusos/detalhes ----
  for (const [px, py] of [[0.08, 0.03], [-0.1, 0.03], [0.24, 0.04]]) {
    add(cyl(0.008, 0.008, 0.104, 8), steel, px, py, 0, Math.PI / 2, 0, 0);
  }

  // centraliza aproximadamente na origem (o comprimento pende p/ -X)
  g.position.x = 0.12;
  g.scale.setScalar(1.15);
  return g;
}

const MODEL_BUILDERS = { corvo: buildCorvoA4 };

// ------------------------------------------------------------
// Visualizador 3D
// ------------------------------------------------------------
function makeViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0.15, 0.35, 3.0);

  // luzes de estúdio (quente/fria/contorno)
  const key = new THREE.DirectionalLight(0xfff0d8, 2.6); key.position.set(2, 3, 2.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x6fe6d4, 1.1); fill.position.set(-3, 0.5, 1.5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 2.2); rim.position.set(-1.5, 2, -3); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // pedestal: brilho suave sob a arma
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(63,200,180,0.5)');
    gr.addColorStop(0.5, 'rgba(63,200,180,0.12)');
    gr.addColorStop(1, 'rgba(63,200,180,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.6),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.9 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.55;
  scene.add(glow);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const state = { model: null, yaw: -0.5, pitch: 0.12, dist: 3.0, idle: 0, dragging: false };

  function setModel(key) {
    if (state.model) { pivot.remove(state.model); state.model = null; }
    const build = key && MODEL_BUILDERS[key];
    if (build) { state.model = build(); pivot.add(state.model); }
    state.yaw = -0.5; state.pitch = 0.12; state.dist = 3.0; state.idle = 0;
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(dt) {
    state.idle += dt;
    if (!state.dragging && state.idle > 2.5) state.yaw += dt * 0.35;  // auto-rotação quando ocioso
    pivot.rotation.y = state.yaw;
    pivot.rotation.x = state.pitch;
    camera.position.set(0.1, 0.32, state.dist);
    camera.lookAt(0, 0.02, 0);
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, state, setModel, resize, render, pmrem };
}

// ------------------------------------------------------------
// Tela do Arsenal
// ------------------------------------------------------------
const LOADOUT_KEY = 'sf_loadout';
function loadLoadout() {
  try { return { primary: 'corvo', secondary: null, ...JSON.parse(localStorage.getItem(LOADOUT_KEY) || '{}') }; }
  catch { return { primary: 'corvo', secondary: null }; }
}

export function initArmory() {
  const $ = id => document.getElementById(id);
  const listEl = $('arm-list');
  const infoEl = $('arm-info');
  const stageName = $('arm-stage-name');
  const lockEl = $('arm-lock');
  const canvas = $('arm-canvas');
  const equipBtn = $('arm-equip');
  const slotPrimary = $('arm-slot-primary');
  if (!listEl || !canvas) return { open() {}, close() {} };

  let viewer = null;
  let selectedId = 'corvo';
  let loadout = loadLoadout();
  let raf = 0, lastT = 0, open = false, ro = null;

  // ---- cards da lista ----
  const cards = new Map();
  for (const w of ARSENAL) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'arm-card' + (w.locked ? ' locked' : '');
    card.style.setProperty('--acc', w.accent);
    card.innerHTML = `
      <span class="ac-ico">${w.icon}</span>
      <span class="ac-txt">
        <span class="ac-name">${w.name}</span>
        <span class="ac-cls">${w.cls}</span>
      </span>
      <span class="ac-badges"></span>`;
    card.onclick = () => select(w.id);
    listEl.appendChild(card);
    cards.set(w.id, card);
  }

  function barRow(k, v, acc) {
    return `<div class="st-row"><span class="st-k">${k}</span>
      <span class="st-bar"><i style="width:${v}%;background:${acc}"></i></span>
      <span class="st-v">${v}</span></div>`;
  }

  function renderInfo(w) {
    const core = w.core.map(a => barRow(a.k, a.v, w.accent)).join('');
    const spec = w.spec.map(s => `<div class="sp-row"><span>${s.k}</span><b>${s.d}</b></div>`).join('');
    const trivia = w.trivia.map(t => `<li>${t}</li>`).join('');
    const attach = ATTACH_SLOTS.map(a =>
      `<div class="at-slot" title="${a.k} — em breve"><span>${a.icon}</span><b>${a.k}</b><i class="at-lock">🔒</i></div>`).join('');
    infoEl.innerHTML = `
      <div class="ai-head" style="--acc:${w.accent}">
        <div class="ai-cls">${w.cls}</div>
        <h3 class="ai-name">${w.name}</h3>
        <div class="ai-meta">${w.internal} · <span>${w.maker}</span> · ${w.year}</div>
        <div class="ai-role">${w.role}</div>
      </div>
      <p class="ai-desc">${w.desc}</p>
      <div class="ai-section-t">ATRIBUTOS</div>
      <div class="ai-stats">${core}</div>
      <div class="ai-section-t">FICHA TÉCNICA</div>
      <div class="ai-spec">${spec}</div>
      <div class="ai-section-t">FILOSOFIA DE CONSTRUÇÃO</div>
      <p class="ai-philo">${w.philosophy}</p>
      <div class="ai-section-t">CURIOSIDADES</div>
      <ul class="ai-trivia">${trivia}</ul>
      <div class="ai-section-t">PERSONALIZAÇÃO <span class="ai-soon">EM BREVE</span></div>
      <div class="ai-attach">${attach}</div>`;
  }

  function updateBadges() {
    for (const w of ARSENAL) {
      const card = cards.get(w.id);
      const b = card.querySelector('.ac-badges');
      let html = '';
      if (w.locked) html += '<i class="bd lock">🔒</i>';
      if (loadout.primary === w.id) html += '<i class="bd eq">EQUIPADA</i>';
      b.innerHTML = html;
      card.classList.toggle('equipped', loadout.primary === w.id);
    }
    const pw = byId(loadout.primary);
    slotPrimary.querySelector('.arm-slot-name').textContent = pw ? pw.name : '—';
    slotPrimary.style.setProperty('--acc', pw ? pw.accent : '#3fc8b4');
  }

  function updateEquipBtn(w) {
    if (w.locked) { equipBtn.textContent = 'BLOQUEADA'; equipBtn.disabled = true; equipBtn.className = 'arm-equip locked'; }
    else if (loadout.primary === w.id) { equipBtn.textContent = 'EQUIPADA ✓'; equipBtn.disabled = true; equipBtn.className = 'arm-equip done'; }
    else { equipBtn.textContent = 'EQUIPAR'; equipBtn.disabled = false; equipBtn.className = 'arm-equip'; }
  }

  function select(id) {
    selectedId = id;
    const w = byId(id);
    for (const [cid, c] of cards) c.classList.toggle('active', cid === id);
    renderInfo(w);
    updateEquipBtn(w);
    stageName.innerHTML = `<b>${w.name}</b><span>${w.cls}</span>`;
    stageName.style.setProperty('--acc', w.accent);
    lockEl.classList.toggle('show', !w.model);
    canvas.style.opacity = w.model ? '1' : '0';
    if (viewer) {
      // transição suave: fade + troca de modelo
      canvas.classList.remove('swap'); void canvas.offsetWidth; canvas.classList.add('swap');
      viewer.setModel(w.model);
    }
  }

  equipBtn.onclick = () => {
    const w = byId(selectedId);
    if (w.locked || loadout.primary === w.id) return;
    loadout.primary = w.id;
    try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout)); } catch { /* ignore */ }
    updateBadges();
    updateEquipBtn(w);
    equipBtn.classList.remove('pulse'); void equipBtn.offsetWidth; equipBtn.classList.add('pulse');
  };

  // ---- interação do visualizador (arrastar / zoom) ----
  function wireCanvas() {
    let px = 0, py = 0;
    canvas.addEventListener('pointerdown', e => {
      if (!viewer || !viewer.state.model) return;
      viewer.state.dragging = true; viewer.state.idle = 0;
      px = e.clientX; py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!viewer || !viewer.state.dragging) return;
      viewer.state.yaw += (e.clientX - px) * 0.01;
      viewer.state.pitch = Math.max(-0.7, Math.min(0.7, viewer.state.pitch + (e.clientY - py) * 0.008));
      px = e.clientX; py = e.clientY;
    });
    const end = () => { if (viewer) { viewer.state.dragging = false; viewer.state.idle = 0; } };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => {
      if (!viewer) return;
      e.preventDefault();
      viewer.state.dist = Math.max(1.7, Math.min(5, viewer.state.dist + e.deltaY * 0.002));
      viewer.state.idle = 0;
    }, { passive: false });
    $('arm-reset').onclick = () => {
      if (!viewer) return;
      viewer.state.yaw = -0.5; viewer.state.pitch = 0.12; viewer.state.dist = 3.0; viewer.state.idle = 0;
    };
  }
  wireCanvas();

  function loop(t) {
    if (!open) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    viewer.render(dt);
    raf = requestAnimationFrame(loop);
  }

  return {
    open() {
      if (!viewer) { viewer = makeViewer(canvas); }
      open = true;
      loadout = loadLoadout();
      viewer.resize();
      updateBadges();
      select(loadout.primary && byId(loadout.primary) ? loadout.primary : 'corvo');
      if (!ro && 'ResizeObserver' in window) {
        ro = new ResizeObserver(() => { if (open && viewer) viewer.resize(); });
        ro.observe(canvas);
      }
      lastT = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    close() {
      open = false;
      cancelAnimationFrame(raf);
    }
  };
}
