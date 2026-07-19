// ============================================================
// Construção visual do mundo: geometria estilizada, iluminação
// de fim de tarde, decoração e modelos de personagem/armas.
//
// Performance: toda a geometria estática é FUNDIDA por material
// (BufferGeometryUtils.mergeGeometries) — o mapa inteiro vira
// ~30 draw calls em vez de centenas, e a passada de sombra idem.
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { BARREL_W, BARREL_H } from '/shared/mapdata.js';
import { getMap, DEFAULT_MAP } from '/shared/maps/index.js';
import { buildOcasoWorld } from './world-ocaso.js';
import { tex, skyTex } from './textures.js';

const TEAL = 0x3fc8b4, CORAL = 0xd95350, CREAM = 0xf2e3c8;

// Materiais compartilhados por chave — 1 material por textura/cor
// significa 1 draw call por bucket depois do merge. Limpo a cada
// buildWorld para acompanhar mudanças de qualidade de textura.
const _mats = new Map();
function cmat(key, make) {
  let m = _mats.get(key);
  if (!m) { m = make(); _mats.set(key, m); }
  return m;
}

function mat(name) {
  return cmat('tex:' + name, () => new THREE.MeshStandardMaterial({
    map: tex(name), roughness: 0.95, metalness: 0
  }));
}

// Multiplica as UVs da geometria — substitui clones de textura com
// repeat próprio (permite compartilhar material e fundir geometria).
// (exportado para os builders de outros mapas)
export function scaleUV(geo, rx, ry) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
  return geo;
}

// Deslocamento pseudo-aleatório determinístico p/ rochas
// (exportado para os builders de outros mapas)
export function jitterGeo(geo, amp, ampY = amp * 0.6, keepBottom = true) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const bMin = geo.boundingBox.min.y;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (keepBottom && y <= bMin + 0.01) continue;
    const n1 = Math.sin(x * 1.7 + z * 2.3 + y * 0.9);
    const n2 = Math.cos(z * 1.3 - x * 0.8 + y * 1.9);
    const n3 = Math.sin(x * 3.1 + y * 2.2);
    pos.setXYZ(i,
      x + n1 * n2 * amp,
      y + n3 * n1 * ampY,
      z + n2 * n3 * amp
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------- Construtores de props ----------------

function makeCrate(s) {
  const g = new RoundedBoxGeometry(s.w, s.h, s.d, 3, 0.07);
  const m = new THREE.Mesh(g, mat('crate'));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function makeBarrel(s) {
  const grp = new THREE.Group();
  const r = s.w / 2;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.95, r * 0.88, s.h, 14),
    mat('barrel')
  );
  body.castShadow = body.receiveShadow = true;
  grp.add(body);
  const ringMat = cmat('barrel-ring', () =>
    new THREE.MeshStandardMaterial({ color: 0x46525c, roughness: 0.6, metalness: 0.4 }));
  for (const y of [-s.h * 0.3, s.h * 0.3]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * 1.0, 0.09, 14), ringMat);
    ring.position.y = y;
    ring.castShadow = true;
    grp.add(ring);
  }
  const lidMat = cmat('barrel-lid', () =>
    new THREE.MeshStandardMaterial({ color: 0x6e4a2d, roughness: 0.9 }));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.05, 14), lidMat);
  lid.position.y = s.h / 2;
  grp.add(lid);
  return grp;
}

// Destroço do barril depois de explodir: casco baixo e chamuscado + estilhaços
// espalhados. Fica escondido até o servidor confirmar o estouro (ver 'barrelboom').
export function makeBarrelWreck(s) {
  const grp = new THREE.Group();
  const r = s.w / 2;
  const scorchMat = cmat('barrel-scorch', () =>
    new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1 }));
  const husk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.9, s.h * 0.3, 12), scorchMat);
  husk.position.y = s.h * 0.15;
  husk.rotation.z = 0.35;
  husk.castShadow = husk.receiveShadow = true;
  grp.add(husk);
  const shardMat = cmat('barrel-shard', () =>
    new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.9, metalness: 0.2 }));
  for (let i = 0; i < 4; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.32, s.h * 0.1, 0.05), shardMat);
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    shard.position.set(Math.cos(ang) * r * 0.9, s.h * 0.04, Math.sin(ang) * r * 0.9);
    shard.rotation.set((Math.random() - 0.5) * 0.6, ang, (Math.random() - 0.5) * 0.8);
    grp.add(shard);
  }
  return grp;
}

function makePalm(s) {
  const grp = new THREE.Group();
  const woodM = mat('wood2');
  let ox = 0, oy = 0;
  const lean = 0.22;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 - i * 0.014, 0.19 - i * 0.014, 0.85, 8), woodM);
    seg.position.set(ox, oy + 0.42, 0);
    seg.rotation.z = -lean * 0.5;
    seg.castShadow = true;
    grp.add(seg);
    ox += lean * 0.8 * (i + 1) * 0.22;
    oy += 0.8;
  }
  // copa
  const leafM = cmat('leaf', () => new THREE.MeshStandardMaterial({
    map: tex('leaf'), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.9
  }));
  const crown = new THREE.Group();
  crown.position.set(ox, oy + 0.2, 0);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), leafM);
    const holder = new THREE.Group();
    holder.rotation.y = (i / 7) * Math.PI * 2 + 0.3;
    leaf.position.x = 1.15;
    leaf.rotation.z = -0.55 - (i % 2) * 0.25;
    holder.add(leaf);
    crown.add(holder);
  }
  const cocoM = cmat('coco', () =>
    new THREE.MeshStandardMaterial({ color: 0x7c5433, roughness: 0.85 }));
  for (const [cx, cz] of [[0.2, 0.12], [-0.15, -0.18]]) {
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), cocoM);
    coco.position.set(cx, -0.15, cz);
    coco.castShadow = true;
    crown.add(coco);
  }
  grp.add(crown);
  return grp;
}

const rockFlatM = () => cmat('rock-flat', () => new THREE.MeshStandardMaterial({
  map: tex('rock'), roughness: 1, flatShading: true
}));

function makeCliff(s) {
  const geo = new THREE.BoxGeometry(
    s.w + 1.5, s.h + 3, s.d + 1.5,
    Math.max(2, Math.ceil(s.w / 4)), 3, Math.max(2, Math.ceil(s.d / 4))
  );
  jitterGeo(geo, 1.1, 0.8);
  scaleUV(geo, Math.max(s.w, s.d) / 8, s.h / 8);
  const m = new THREE.Mesh(geo, rockFlatM());
  m.castShadow = m.receiveShadow = true;
  return m;
}

function makeRock(s) {
  const geo = new THREE.BoxGeometry(s.w, s.h + 0.6, s.d, 3, 3, 3);
  jitterGeo(geo, 0.35, 0.3);
  const m = new THREE.Mesh(geo, rockFlatM());
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Bloco de construção com repeat de textura embutido nas UVs
function makeBlock(s) {
  const geo = s.w < 3 && s.h < 3 && s.d < 3
    ? new RoundedBoxGeometry(s.w, s.h, s.d, 2, 0.05)
    : new THREE.BoxGeometry(s.w, s.h, s.d);
  // plaster não repete na vertical (o rodapé terracota fica só na base)
  const plaster = s.mat.startsWith('plaster');
  const ry = plaster ? 1 : Math.max(1, s.h / 2.6);
  const rx = plaster ? Math.max(1, Math.round(Math.max(s.w, s.d) / 4)) : Math.max(1, Math.max(s.w, s.d) / 2.6);
  scaleUV(geo, rx, ry);
  const m = new THREE.Mesh(geo, mat(s.mat));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Fachada: janelas, porta, cornija e toldo para blocos 'plaster' grandes
function decorateBuilding(staticRoot, s) {
  const grp = new THREE.Group();
  // cornija no topo
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(s.w + 0.35, 0.24, s.d + 0.35), mat('wood2'));
  trim.position.set(s.x, s.y + s.h / 2 + 0.02, s.z);
  trim.castShadow = true;
  grp.add(trim);

  // face voltada para o centro da arena
  const faceX = Math.abs(s.x) > Math.abs(s.z);
  const sign = faceX ? -Math.sign(s.x) : -Math.sign(s.z);
  const half = (faceX ? s.w : s.d) / 2 + 0.02;
  const winM = cmat('window', () =>
    new THREE.MeshStandardMaterial({ map: tex('window'), roughness: 0.8 }));
  const doorM = cmat('door', () => new THREE.MeshStandardMaterial({
    map: tex('door'), alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide
  }));

  const place = (mesh, along, up) => {
    if (faceX) {
      mesh.position.set(s.x + sign * half, up, s.z + along);
      mesh.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      mesh.position.set(s.x + along, up, s.z + sign * half);
      mesh.rotation.y = sign > 0 ? 0 : Math.PI;
    }
    grp.add(mesh);
  };

  const span = (faceX ? s.d : s.w);
  for (const off of [-span * 0.28, span * 0.28]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.5), winM);
    place(win, off, s.y + 0.4);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), doorM);
  place(door, 0, 1.16);

  // toldo listrado sobre a porta
  const awnGrp = new THREE.Group();
  const awnM = cmat('awning', () =>
    new THREE.MeshStandardMaterial({ map: tex('awning'), side: THREE.DoubleSide, roughness: 0.9 }));
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), awnM);
  awn.rotation.x = -Math.PI / 2 + 0.5;
  awn.position.y = -0.28;
  awn.position.z = 0.55;
  awn.castShadow = true;
  awnGrp.add(awn);
  const edgeM = cmat('awning-edge', () =>
    new THREE.MeshStandardMaterial({ map: tex('awningEdge'), alphaTest: 0.4, side: THREE.DoubleSide }));
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.3), edgeM);
  edge.position.set(0, -0.62, 1.12);
  awnGrp.add(edge);
  const poleM = cmat('pole', () =>
    new THREE.MeshStandardMaterial({ color: 0x6e4a2d, roughness: 0.9 }));
  for (const px of [-1.2, 1.2]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.0, 6), poleM);
    pole.position.set(px, -1.55, 1.1);
    awnGrp.add(pole);
  }
  if (faceX) {
    awnGrp.position.set(s.x + sign * half, 3.1, s.z);
    awnGrp.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    awnGrp.position.set(s.x, 3.1, s.z + sign * half);
    awnGrp.rotation.y = sign > 0 ? 0 : Math.PI;
  }
  grp.add(awnGrp);
  staticRoot.add(grp);
}

// Funde toda a geometria de um grupo em 1 mesh por material.
// IMPORTANTE: mergeGeometries exige geometrias todas indexed OU todas
// non-indexed — RoundedBoxGeometry é non-indexed e Box/Cylinder/Plane são
// indexed, então normalizamos tudo para non-indexed antes de fundir.
// (exportado: world-ocaso.js reusa — import circular seguro, só usa em runtime)
export function mergeStatics(srcRoot, dstRoot) {
  srcRoot.updateMatrixWorld(true);
  const buckets = new Map(); // material -> { geos, cast, recv }
  srcRoot.traverse(o => {
    if (!o.isMesh) return;
    let b = buckets.get(o.material);
    if (!b) { b = { geos: [], cast: false, recv: false }; buckets.set(o.material, b); }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    b.geos.push(g.applyMatrix4(o.matrixWorld));
    b.cast = b.cast || o.castShadow;
    b.recv = b.recv || o.receiveShadow;
    o.geometry.dispose();
  });
  const place = (geo, material, b) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = b.cast;
    m.receiveShadow = b.recv;
    m.matrixAutoUpdate = false; // estático: nunca recalcular matriz
    dstRoot.add(m);
  };
  for (const [material, b] of buckets) {
    const merged = b.geos.length === 1
      ? b.geos[0]
      : BufferGeometryUtils.mergeGeometries(b.geos, false);
    if (merged) {
      if (b.geos.length > 1) for (const g of b.geos) g.dispose();
      place(merged, material, b);
    } else {
      // fusão falhou (atributos incompatíveis): NUNCA descartar —
      // adiciona os meshes individualmente para manter tudo visível
      console.warn('[world] merge falhou para um material; usando meshes individuais');
      for (const g of b.geos) place(g, material, b);
    }
  }
}

// ---------------- Mundo ----------------

export function buildWorld(scene, opts = {}) {
  const map = opts.map || getMap(DEFAULT_MAP);
  // Cada mapa tem seu próprio builder visual; este arquivo constrói o Cânion
  // (mapa 1). O Ocaso (mapa 2) mora em world-ocaso.js.
  if (map.KEY === 'ocaso') return buildOcasoWorld(scene, map, opts);

  const decor = opts.decor !== false;
  const animated = [];

  _mats.clear(); // materiais novos por build (texturas podem ter trocado de tamanho)

  const root = new THREE.Group();        // tudo do mundo (removível p/ rebuild)
  const staticRoot = new THREE.Group();  // temporário: vira meshes fundidos
  const liveRoot = new THREE.Group();    // luzes, céu e objetos animados
  root.add(liveRoot);

  // Céu + névoa quente — raio pequeno o bastante p/ caber no far plane
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })
  );
  sky.frustumCulled = false;
  liveRoot.add(sky);
  scene.fog = new THREE.Fog(0xecca9c, 70, 260);

  // Iluminação de fim de tarde
  liveRoot.add(new THREE.HemisphereLight(0xbcd8e8, 0xd8a86a, 0.85));
  if (decor) liveRoot.add(new THREE.AmbientLight(0xffe8c8, 0.25));
  const sun = new THREE.DirectionalLight(0xffe3b0, decor ? 2.4 : 2.8);
  sun.position.set(45, 55, 18);
  sun.castShadow = false; // ligado depois via applyGraphics conforme a config
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -52; sun.shadow.camera.right = 52;
  sun.shadow.camera.top = 52; sun.shadow.camera.bottom = -52;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0008;
  liveRoot.add(sun);

  // Chão de areia
  const groundM = cmat('ground', () => {
    const t = tex('sand').clone();
    t.needsUpdate = true;
    t.repeat.set(18, 18);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  staticRoot.add(ground);

  // Praça central em pedra
  const plazaM = cmat('plaza-m', () => {
    const t = tex('plaza').clone();
    t.needsUpdate = true;
    t.repeat.set(4, 4);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 28), plazaM);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  staticRoot.add(plaza);

  // Trilhas de areia escura ligando os pontos de interesse
  if (decor) {
    const pathM = cmat('path', () => {
      const t = tex('sand').clone();
      t.needsUpdate = true;
      t.repeat.set(3, 10);
      return new THREE.MeshStandardMaterial({ map: t, color: 0xbfa070, roughness: 1 });
    });
    const paths = [
      [0, 0, -22, -18, 3.2], [0, 0, 20, -20, 3.2],
      [0, 0, 0, 22, 3.4], [0, 0, -27, 6, 3], [0, 0, 24, 8, 3]
    ];
    for (const [ax, az, bx, bz, w] of paths) {
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), pathM);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = -Math.atan2(dx, dz);
      p.position.set((ax + bx) / 2, 0.012, (az + bz) / 2);
      p.receiveShadow = true;
      staticRoot.add(p);
    }
  }

  // Sólidos do mapa
  for (const s of map.SOLIDS) {
    // barris ficam FORA do merge: cada um precisa ser escondido/trocado por
    // destroço individualmente quando explode (ver loop dedicado abaixo)
    if (s.mat === 'barrel') continue;
    let m;
    switch (s.mat) {
      case 'cliff': m = makeCliff(s); break;
      case 'rock': m = makeRock(s); break;
      case 'crate': m = makeCrate(s); break;
      case 'palm': m = makePalm(s); break;
      default: m = makeBlock(s);
    }
    if (s.mat === 'palm') m.position.set(s.x, s.y - s.h / 2, s.z);
    else m.position.set(s.x, s.y, s.z);
    staticRoot.add(m);
    // fachada nas casas grandes (só com decoração ligada — visual puro)
    if (decor && s.mat === 'plaster' && s.h >= 4) decorateBuilding(staticRoot, s);
  }

  // Barris explosivos — individuais (não fundidos): cada um alterna entre o
  // corpo intacto e o destroço conforme o servidor confirma dano/reset.
  const barrelDims = { w: BARREL_W, h: BARREL_H, d: BARREL_W };
  const barrels = map.BARRELS.map(b => {
    const intact = makeBarrel(barrelDims);
    const wreck = makeBarrelWreck(barrelDims);
    // wreck.position compensa: makeBarrelWreck() assume origem no CHÃO
    // (destroço baixo, perto de y=0), enquanto makeBarrel() assume origem no
    // CENTRO do barril (corpo de -h/2 a +h/2) — o grupo abaixo usa a
    // convenção do intacto, então o destroço precisa descer de volta ao chão
    wreck.position.y = -BARREL_H / 2;
    wreck.visible = false;
    const grp = new THREE.Group();
    // sem levantar o grupo pra h/2, metade do barril intacto fica enterrada
    // no chão (quase invisível, fácil de não notar — foi o bug reportado).
    // b.y = piso do terraço onde o barril está (0 = chão).
    grp.position.set(b.x, (b.y || 0) + BARREL_H / 2, b.z);
    grp.add(intact, wreck);
    liveRoot.add(grp);
    return { id: b.id, group: grp, intact, wreck, alive: true };
  });

  // ---- Decoração ----

  // Cristal do obelisco central (animado — fica fora do merge)
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55),
    cmat('crystal', () => new THREE.MeshStandardMaterial({
      color: TEAL, emissive: 0x35e0c8, emissiveIntensity: 1.3, roughness: 0.3
    }))
  );
  crystal.position.set(0, 4.15, 0);
  liveRoot.add(crystal);
  if (decor) {
    const crystalLight = new THREE.PointLight(0x35e0c8, 26, 14, 2);
    crystalLight.position.set(0, 4.2, 0);
    liveRoot.add(crystalLight);
  }
  animated.push(t => {
    crystal.rotation.y = t * 0.8;
    crystal.position.y = 4.15 + Math.sin(t * 1.6) * 0.12;
  });

  // Estandartes (torre + obelisco) — animados, fora do merge
  if (decor) {
    const banM = cmat('banner', () => new THREE.MeshStandardMaterial({
      map: tex('banner'), side: THREE.DoubleSide, roughness: 0.95
    }));
    const rodM = cmat('rod', () => new THREE.MeshStandardMaterial({ color: 0x6e4a2d }));
    const banners = [[16.4, 9.4, -20, Math.PI / 2], [0, 3.4, 1.36, 0], [0, 3.4, -1.36, Math.PI], [23.6, 8.9, -20, -Math.PI / 2]];
    for (const [bx, by, bz, ry] of banners) {
      const pivot = new THREE.Group();
      pivot.position.set(bx, by, bz);
      pivot.rotation.y = ry;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), banM);
      cloth.position.y = -1.05;
      cloth.castShadow = true;
      pivot.add(cloth);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6), rodM);
      rod.rotation.z = Math.PI / 2;
      pivot.add(rod);
      liveRoot.add(pivot);
      const phase = bx + bz;
      animated.push(t => { pivot.rotation.x = Math.sin(t * 1.3 + phase) * 0.06; });
    }
  }

  // ---- Decoração visual pura (pula inteira com decoração desligada) ----
  if (decor) {
    // Tapetes na praça
    const rugM = cmat('rug', () => new THREE.MeshStandardMaterial({ map: tex('rug'), roughness: 1 }));
    for (const [rx, rz, rot, sc] of [[2.8, 3.4, 0.4, 1], [-3.4, -2.6, -0.9, 0.85], [4.2, 21.4, 0.15, 0.9]]) {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * sc, 1.7 * sc), rugM);
      rug.rotation.x = -Math.PI / 2;
      rug.rotation.z = rot;
      rug.position.set(rx, 0.035, rz);
      rug.receiveShadow = true;
      staticRoot.add(rug);
    }

    // Bandeirolas no mercado
    const buntColors = [CORAL, CREAM, TEAL, 0xf0c060];
    const from = new THREE.Vector3(-7, 3.3, 19.4), to = new THREE.Vector3(7, 3.3, 19.4);
    const linePts = [];
    const buntG = new THREE.PlaneGeometry(0.3, 0.36);
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const p = from.clone().lerp(to, t);
      p.y -= Math.sin(t * Math.PI) * 0.75;
      linePts.push(p.clone());
      if (i > 0 && i < 14) {
        const col = buntColors[i % 4];
        const pen = new THREE.Mesh(buntG.clone(), cmat('bunt' + col, () =>
          new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.9 })));
        pen.position.copy(p);
        pen.position.y -= 0.2;
        staticRoot.add(pen);
      }
    }
    liveRoot.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(linePts),
      cmat('bunt-line', () => new THREE.LineBasicMaterial({ color: 0x4a3018 }))
    ));

    // Frutas nas bancadas do mercado
    const fruitCols = [CORAL, 0xf0c060, TEAL, 0xe08a40];
    let fi = 0;
    for (const [tx, tz] of [[-3.5, 22], [3.5, 22]]) {
      for (const [ox, oz] of [[-0.6, -0.25], [0.1, 0.3], [0.65, -0.15]]) {
        const col = fruitCols[fi++ % 4];
        const fruit = new THREE.Mesh(
          new RoundedBoxGeometry(0.34, 0.3, 0.34, 2, 0.1),
          cmat('fruit' + col, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })));
        fruit.position.set(tx + ox, 1.22, tz + oz);
        fruit.castShadow = true;
        staticRoot.add(fruit);
      }
    }

    // Tufos de grama
    const grassM = cmat('grass', () => new THREE.MeshStandardMaterial({
      map: tex('grass'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1
    }));
    const grassSpots = [
      [-8, 20], [11, 10], [-20, -4], [17, -12], [-28, -14], [6, -20],
      [-14, 24], [26, 20], [30, -14], [-32, 10], [3, -7], [-25, -24]
    ];
    for (const [gx, gz] of grassSpots) {
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55), grassM);
        blade.position.set(gx + (i - 1) * 0.1, 0.27, gz);
        blade.rotation.y = i * 1.05;
        staticRoot.add(blade);
      }
    }

    // Vasos de terracota com plantas
    const potM = cmat('pot', () => new THREE.MeshStandardMaterial({ color: 0xc9714c, roughness: 0.95 }));
    const bushM = cmat('bush', () => new THREE.MeshStandardMaterial({ color: 0x5aa84e, roughness: 1, flatShading: true }));
    for (const [px, pz] of [[-17.5, -13.4], [21.2, 4.2], [-1.8, 24.8], [-23.8, 9.8]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 10), potM);
      pot.position.set(px, 0.25, pz);
      pot.castShadow = true;
      staticRoot.add(pot);
      const bushGeo = jitterGeo(new THREE.SphereGeometry(0.34, 7, 6), 0.09, 0.09, false);
      const bush = new THREE.Mesh(bushGeo, bushM);
      bush.position.set(px, 0.68, pz);
      bush.castShadow = true;
      staticRoot.add(bush);
    }

    // Pedrinhas espalhadas
    for (let i = 0; i < 10; i++) {
      const a = i * 2.7, r = 12 + (i * 7) % 22;
      const st = new THREE.Mesh(
        jitterGeo(new THREE.BoxGeometry(0.5, 0.3, 0.4, 2, 2, 2), 0.1, 0.08, false),
        rockFlatM());
      st.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      st.rotation.y = a * 2;
      st.castShadow = true;
      staticRoot.add(st);
    }
  }

  // Funde tudo que é estático em ~1 draw call por material
  mergeStatics(staticRoot, root);

  scene.add(root);

  return {
    group: root,
    sun,
    barrels,
    update(t) { for (const fn of animated) fn(t); },
    dispose() {
      const seenM = new Set();
      root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m && !seenM.has(m)) { seenM.add(m); m.dispose(); } // texturas ficam no cache
      });
    }
  };
}

// ---------------- Personagem ----------------

export function makeCharacter(colorHex) {
  const grp = new THREE.Group();
  const col = new THREE.Color(colorHex);
  const dark = col.clone().multiplyScalar(0.55);
  const cloth = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 });
  const clothD = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.9 });
  const gear = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.6 });

  const add = (mesh, x, y, z, parent = grp) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // torso + quadril
  add(new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.9, 0.46, 3, 0.12), cloth), 0, 1.15, 0);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.4, 2, 0.1), clothD), 0, 0.62, 0);
  // detalhe no peito
  add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.14, 0.06, 2, 0.03), accent), 0, 1.32, -0.24);

  // pernas (pivot no quadril p/ animação)
  const legG = new RoundedBoxGeometry(0.24, 0.62, 0.28, 2, 0.08);
  const legL = new THREE.Group(); legL.position.set(-0.18, 0.55, 0);
  const legR = new THREE.Group(); legR.position.set(0.18, 0.55, 0);
  add(new THREE.Mesh(legG, clothD), 0, -0.28, 0, legL);
  add(new THREE.Mesh(legG, clothD), 0, -0.28, 0, legR);
  grp.add(legL, legR);

  // cabeça + visor
  const head = new THREE.Group(); head.position.y = 1.78;
  add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), cloth), 0, 0, 0, head);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.16, 0.1, 2, 0.04), gear), 0, 0.02, -0.26, head);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, 0.9), clothD), 0, 0.05, 0, head);
  grp.add(head);

  // mochila
  add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.55, 0.24, 2, 0.08), clothD), 0, 1.2, 0.34);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.1, 0.06, 2, 0.03), accent), 0, 1.35, 0.48);

  // braços + arma (grupo que inclina com o pitch)
  const arms = new THREE.Group(); arms.position.y = 1.45;
  const armG = new RoundedBoxGeometry(0.18, 0.46, 0.2, 2, 0.06);
  const armR = add(new THREE.Mesh(armG, cloth), 0.44, -0.15, -0.2, arms);
  armR.rotation.x = -1.2;
  const armL = add(new THREE.Mesh(armG, cloth), -0.35, -0.18, -0.32, arms);
  armL.rotation.x = -1.35; armL.rotation.z = 0.5;
  // arma
  const gun = new THREE.Group();
  const gm = new THREE.MeshStandardMaterial({ color: 0x33404a, roughness: 0.6, metalness: 0.3 });
  add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.62), gm), 0, 0, 0, gun);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), gm), 0, 0.02, -0.45, gun)
    .rotation.x = Math.PI / 2;
  gun.position.set(0.3, -0.3, -0.42);
  arms.add(gun);

  // faca na mão (oculta até o jogador sacá-la — alternada em updateRemotes)
  const knife = new THREE.Group();
  const kBladeM = new THREE.MeshStandardMaterial({ color: 0xccd2d8, roughness: 0.4, metalness: 0.8 });
  const kGripM = new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: 0.9 });
  const kGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.15), kGripM);
  knife.add(kGrip);
  const kBlade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.36), kBladeM);
  kBlade.position.z = -0.26;
  knife.add(kBlade);
  knife.position.set(0.33, -0.34, -0.42);
  knife.rotation.set(0.3, 0, 0);
  knife.visible = false;
  arms.add(knife);
  grp.add(arms);

  grp.userData = { legL, legR, head, arms, gun, knife };
  return grp;
}

// ---------------- Granada em voo/rolando (mundo) ----------------
// Corpo livre (sem alavanca — já foi lançada). O acento teal pulsa mais
// rápido perto da explosão (ver updateNadeMesh em main.js) — leitura
// visual clara de "vai explodir logo".
export function makeGrenadeMesh() {
  const grp = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x3a4a34, roughness: 0.75, metalness: 0.15 });
  const groove = new THREE.MeshStandardMaterial({ color: 0x22301f, roughness: 0.85, metalness: 0.1 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x8a8f88, roughness: 0.4, metalness: 0.8 });
  const accentM = new THREE.MeshStandardMaterial({
    color: TEAL, roughness: 0.5, emissive: 0x35e0c8, emissiveIntensity: 0.6
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), body);
  core.scale.set(1, 1.15, 1);
  core.castShadow = true;
  grp.add(core);
  for (const gy of [-0.03, 0.005, 0.04]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.004, 6, 16), groove);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = gy;
    grp.add(ring);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0535, 0.006, 6, 16), accentM);
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.058;
  grp.add(band);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.03, 10), capM);
  cap.position.y = 0.075;
  cap.castShadow = true;
  grp.add(cap);

  grp.userData.accent = accentM;
  return grp;
}

// Canister de fumaça em voo/rolando (mundo) — cilíndrico, cinza com faixa teal.
export function makeSmokeCanisterMesh() {
  const grp = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x9aa0a2, roughness: 0.45, metalness: 0.7 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x50575a, roughness: 0.55, metalness: 0.6 });
  const bandM = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5, emissive: 0x35e0c8, emissiveIntensity: 0.6 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 14), bodyM);
  body.castShadow = true;
  grp.add(body);
  for (const by of [0.04, -0.02]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0455, 0.0455, 0.012, 14), bandM);
    band.position.y = by;
    grp.add(band);
  }
  for (const [cy, r1, r2] of [[0.093, 0.046, 0.046], [-0.093, 0.043, 0.046]]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 0.018, 14), capM);
    cap.position.y = cy;
    grp.add(cap);
  }
  grp.userData.accent = bandM;
  return grp;
}

// ---------------- Armas em primeira pessoa ----------------

export function makeViewmodel(kind) {
  const grp = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    map: tex('metal'), roughness: 0.55, metalness: 0.35
  });
  const wood = new THREE.MeshStandardMaterial({ map: tex('wood2'), roughness: 0.85 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5, emissive: 0x0e4a42, emissiveIntensity: 0.5 });

  const add = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    grp.add(mesh);
    return mesh;
  };

  let muzzle;
  if (kind === 'smoke') {
    // ---------------- Granada de fumaça "VÉU-3" ----------------
    // Cilindro de aço com tampa perfurada (por onde a fumaça sai), corpo
    // liso, faixa de identificação teal, alavanca e pino. Silhueta
    // deliberadamente diferente da fragmentação (cilíndrica vs ovoide).
    const bodyM = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x9aa0a2, roughness: 0.45, metalness: 0.7 });
    const capM = new THREE.MeshStandardMaterial({ color: 0x50575a, roughness: 0.55, metalness: 0.6 });
    const holeM = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.9 });
    const leverM = new THREE.MeshStandardMaterial({ color: 0xb8bcb6, roughness: 0.35, metalness: 0.85 });
    const pinM = new THREE.MeshStandardMaterial({ color: 0xe0c060, roughness: 0.3, metalness: 0.7 });
    const bandM = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5, emissive: 0x0e4a42, emissiveIntensity: 0.55 });

    const holder = new THREE.Group();
    holder.rotation.set(0.12, 0.2, -0.08);
    holder.position.set(0, 0, 0.05);

    // corpo cilíndrico
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 16), bodyM);
    holder.add(body);
    // faixas teal de identificação
    for (const by of [0.04, -0.02]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0455, 0.0455, 0.012, 16), bandM);
      band.position.y = by;
      holder.add(band);
    }
    // tampa perfurada (topo)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 16), capM);
    top.position.y = 0.095;
    holder.add(top);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.022, 8), holeM);
      hole.position.set(Math.cos(a) * 0.022, 0.096, Math.sin(a) * 0.022);
      holder.add(hole);
    }
    const centerHole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.022, 8), holeM);
    centerHole.position.y = 0.096;
    holder.add(centerHole);
    // fundo
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.043, 0.016, 16), capM);
    bottom.position.y = -0.093;
    holder.add(bottom);
    // alavanca de segurança (some ao lançar) + pino
    const lever = new THREE.Mesh(new RoundedBoxGeometry(0.013, 0.11, 0.02, 2, 0.006), leverM);
    lever.position.set(0.05, 0.02, 0);
    lever.rotation.z = -0.06;
    holder.add(lever);
    const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0035, 6, 14), pinM);
    pinRing.position.set(0.062, 0.085, 0);
    pinRing.rotation.y = Math.PI / 2;
    holder.add(pinRing);

    grp.add(holder);
    grp.userData.lever = lever;
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.06, -0.15);
    grp.add(muzzle);
    return { group: grp, muzzle };
  } else if (kind === 'nade') {
    // ---------------- Granada de fragmentação "ROSCA-4" ----------------
    // Corpo ovoide com sulcos de fragmentação, capuz da espoleta,
    // alavanca de segurança e anel do pino — segurada na mão, pronta
    // para o arremesso. A alavanca "voa" no lançamento (ver main.js).
    const body = new THREE.MeshStandardMaterial({ color: 0x3a4a34, roughness: 0.75, metalness: 0.15 });
    const groove = new THREE.MeshStandardMaterial({ color: 0x22301f, roughness: 0.85, metalness: 0.1 });
    const capM = new THREE.MeshStandardMaterial({ color: 0x8a8f88, roughness: 0.4, metalness: 0.8 });
    const leverM = new THREE.MeshStandardMaterial({ color: 0xb8bcb6, roughness: 0.35, metalness: 0.85 });
    const pinM = new THREE.MeshStandardMaterial({ color: 0xe0c060, roughness: 0.3, metalness: 0.7 });
    const accentM = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5, emissive: 0x0e4a42, emissiveIntensity: 0.6 });

    const holder = new THREE.Group();
    holder.rotation.set(0.1, 0.2, -0.1);
    holder.position.set(0, 0, 0.05);

    // corpo (levemente ovoide)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 14), body);
    core.scale.set(1, 1.15, 1);
    holder.add(core);
    // sulcos horizontais e verticais (fragmentação clássica)
    for (const gy of [-0.03, 0.005, 0.04]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.004, 6, 20), groove);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = gy;
      holder.add(ring);
    }
    for (let i = 0; i < 4; i++) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.0035, 6, 20, Math.PI), groove);
      seam.rotation.y = (i / 4) * Math.PI * 2;
      holder.add(seam);
    }
    // detalhe teal (faixa de identificação)
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.0535, 0.006, 6, 20), accentM);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.058;
    holder.add(band);
    // capuz da espoleta
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.03, 12), capM);
    cap.position.y = 0.075;
    holder.add(cap);
    // alavanca de segurança (spoon) — some ao lançar
    const lever = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.09, 0.02, 2, 0.006), leverM);
    lever.position.set(0.045, 0.045, 0);
    lever.rotation.z = -0.12;
    holder.add(lever);
    // anel do pino
    const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 14), pinM);
    pinRing.position.set(0.06, 0.09, 0);
    pinRing.rotation.y = Math.PI / 2;
    holder.add(pinRing);

    grp.add(holder);
    grp.userData.lever = lever;   // main.js esconde ao "puxar o pino"
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.06, -0.15);
    grp.add(muzzle);
    return { group: grp, muzzle };
  } else if (kind === 'knife') {
    // ---------------- Faca de combate "PRESA-7" ----------------
    // Lâmina de aço com ponta clip-point (silhueta marcante), guarda,
    // cabo emborrachado com sulcos de pegada, pomo e detalhe teal.
    const steel = new THREE.MeshStandardMaterial({
      map: tex('metal'), color: 0xd6dde3, roughness: 0.32, metalness: 0.9
    });
    const satin = new THREE.MeshStandardMaterial({ color: 0xaab4bd, roughness: 0.45, metalness: 0.8 });
    const keen = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.18, metalness: 0.95 });
    const gripM = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.95 });
    const guardM = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.45, metalness: 0.75 });

    // segura a faca na diagonal, típica de porte em primeira pessoa
    const holder = new THREE.Group();
    holder.rotation.set(-0.12, 0.34, 0.16);
    holder.position.set(-0.02, 0.01, 0.06);

    // cabo emborrachado
    const grip = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.044, 0.2, 3, 0.016), gripM);
    grip.position.set(0, -0.004, 0.16);
    holder.add(grip);
    // sulcos de pegada (linhas teal discretas)
    for (const gz of [0.1, 0.145, 0.19]) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.014), accent);
      ridge.position.set(0, 0.02, gz);
      holder.add(ridge);
    }
    // pomo (contrapeso)
    const pommel = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.05, 0.04, 2, 0.016), guardM);
    pommel.position.set(0, -0.004, 0.27);
    holder.add(pommel);
    // guarda (crossguard)
    const guard = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.03, 0.032, 2, 0.012), guardM);
    guard.position.set(0, 0.004, 0.045);
    holder.add(guard);
    // colar teal entre guarda e lâmina
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 12), accent);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.008, 0.028);
    holder.add(collar);

    // lâmina com ponta clip-point via Shape extrudada (comprimento no -Z)
    const bs = new THREE.Shape();
    bs.moveTo(0.02, -0.048);
    bs.lineTo(0.30, -0.056);
    bs.lineTo(0.44, -0.004);   // ponta
    bs.lineTo(0.30, 0.05);
    bs.lineTo(0.02, 0.052);
    bs.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bs, {
      depth: 0.02, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1, steps: 1
    });
    bladeGeo.translate(0, 0, -0.01);   // centraliza a espessura
    bladeGeo.rotateY(Math.PI / 2);     // comprimento (shape-x) → -Z
    const blade = new THREE.Mesh(bladeGeo, steel);
    blade.position.set(0, 0.006, 0.01);
    holder.add(blade);
    // fio afiado (quina inferior mais clara)
    const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.02, 0.34), keen);
    edgeMesh.position.set(0, -0.036, -0.15);
    holder.add(edgeMesh);
    // sulco/fuller escuro na face
    for (const fx of [0.009, -0.009]) {
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.26), satin);
      fuller.position.set(fx, 0.014, -0.14);
      holder.add(fuller);
    }

    grp.add(holder);
    muzzle = new THREE.Object3D();       // "ponta" da lâmina (usado por efeitos genéricos)
    muzzle.position.set(0, 0.02, -0.42);
    grp.add(muzzle);
    return { group: grp, muzzle };
  } else if (kind === 'ar') {
    add(new RoundedBoxGeometry(0.075, 0.11, 0.44, 2, 0.015), metal, 0, 0, 0);              // corpo
    const barrel = add(new THREE.CylinderGeometry(0.021, 0.021, 0.32, 10), metal, 0, 0.015, -0.36);
    barrel.rotation.x = Math.PI / 2;
    add(new RoundedBoxGeometry(0.05, 0.05, 0.07, 2, 0.012), darkM, 0, 0.015, -0.52);       // quebra-chama
    add(new RoundedBoxGeometry(0.062, 0.07, 0.2, 2, 0.015), wood, 0, -0.02, -0.28);        // guarda-mão
    const mag = add(new RoundedBoxGeometry(0.048, 0.17, 0.09, 2, 0.012), darkM, 0, -0.12, 0.02);
    mag.rotation.x = 0.22;
    const grip = add(new RoundedBoxGeometry(0.05, 0.13, 0.07, 2, 0.012), wood, 0, -0.1, 0.16);
    grip.rotation.x = -0.35;
    add(new RoundedBoxGeometry(0.055, 0.09, 0.17, 2, 0.015), wood, 0, -0.005, 0.3);        // coronha
    add(new THREE.BoxGeometry(0.012, 0.035, 0.012), metal, 0, 0.075, -0.4);                // massa de mira
    add(new RoundedBoxGeometry(0.05, 0.04, 0.05, 2, 0.01), metal, 0, 0.075, 0.12);         // alça
    add(new THREE.BoxGeometry(0.078, 0.02, 0.1), accent, 0, 0.045, -0.08);                 // detalhe teal
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.015, -0.56);
    grp.add(muzzle);
  } else if (kind === 'sentinela') {
    // ---------------- Fuzil tático "SENTINELA-DR" ----------------
    // Meio-termo entre o FALCÃO (curto, ágil) e a FERRÃO (longa, pesada):
    // corpo alongado, ação semiautomática sem ferrolho exposto, e uma
    // luneta MÉDIA — bem mais curta que a da sniper (silhueta reconhecível
    // de longe, sem confundir as duas).
    add(new RoundedBoxGeometry(0.078, 0.115, 0.5, 2, 0.015), metal, 0, 0, 0.02);              // corpo alongado
    const barrel = add(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 12), metal, 0, 0.018, -0.42);
    barrel.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.028, 0.025, 0.06, 12), darkM, 0, 0.018, -0.63)
      .rotation.x = Math.PI / 2;                                                              // freio de boca curto
    // luneta média — bem mais curta que a da FERRÃO
    const scope = add(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), darkM, 0, 0.088, -0.1);
    scope.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.033, 0.033, 0.016, 12), accent, 0, 0.088, -0.165)
      .rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.033, 0.033, 0.016, 12), accent, 0, 0.088, -0.035)
      .rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.016, 0.045, 0.016), metal, 0, 0.048, -0.1);                   // suporte da luneta
    add(new RoundedBoxGeometry(0.06, 0.06, 0.22, 2, 0.015), wood, 0, -0.02, -0.24);           // guarda-mão
    const mag = add(new RoundedBoxGeometry(0.05, 0.19, 0.09, 2, 0.012), darkM, 0, -0.13, 0.02);
    mag.rotation.x = 0.16;
    const grip = add(new RoundedBoxGeometry(0.05, 0.13, 0.07, 2, 0.012), wood, 0, -0.1, 0.16);
    grip.rotation.x = -0.32;
    add(new RoundedBoxGeometry(0.06, 0.1, 0.2, 2, 0.018), wood, 0, -0.01, 0.34);              // coronha
    add(new THREE.BoxGeometry(0.078, 0.02, 0.1), accent, 0, 0.05, -0.06);                     // detalhe teal
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.018, -0.66);
    grp.add(muzzle);
  } else if (kind === 'brecha') {
    // ---------------- Escopeta bomba "BRECHA-12" ----------------
    // Silhueta curta e grossa (calibre 12), bem diferente do fuzil/sniper:
    // cano largo, tubo de munição visível sob o cano, bomba (fore-end) que
    // desliza pra trás após o tiro — grp.userData.pump é essa peça, animada
    // por main.js (pumpT) a cada disparo.
    add(new RoundedBoxGeometry(0.095, 0.1, 0.28, 2, 0.016), metal, 0, 0, 0.04);              // receiver curto e largo
    const barrel = add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 12), darkM, 0, 0.03, -0.32);
    barrel.rotation.x = Math.PI / 2;
    const magTube = add(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 10), metal, 0, -0.015, -0.26);
    magTube.rotation.x = Math.PI / 2;                                                        // tubo de munição
    add(new THREE.SphereGeometry(0.011, 8, 8), accent, 0, 0.046, -0.49);                     // massa de mira (bead)
    add(new THREE.BoxGeometry(0.09, 0.018, 0.1), accent, 0, 0.04, -0.02);                    // detalhe teal

    // bomba/fore-end: grupo próprio p/ animar o recuo do pump em main.js
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(0, -0.015, -0.2);
    grp.add(pumpGroup);
    const pumpMesh = new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.078, 0.16, 2, 0.015), wood);
    pumpGroup.add(pumpMesh);
    for (const gz of [-0.05, 0, 0.05]) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.006, 0.014), darkM);
      ridge.position.set(0, 0.03, gz);
      pumpGroup.add(ridge);
    }
    grp.userData.pump = pumpGroup;

    add(new RoundedBoxGeometry(0.055, 0.11, 0.2, 2, 0.016), wood, 0, -0.005, 0.34);          // coronha curta
    const grip = add(new RoundedBoxGeometry(0.055, 0.12, 0.06, 2, 0.012), wood, 0, -0.09, 0.16);
    grip.rotation.x = -0.3;
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.03, -0.5);
    grp.add(muzzle);
  } else {
    add(new RoundedBoxGeometry(0.07, 0.1, 0.5, 2, 0.015), metal, 0, 0, 0.02);              // corpo
    const barrel = add(new THREE.CylinderGeometry(0.019, 0.019, 0.55, 10), metal, 0, 0.012, -0.5);
    barrel.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), darkM, 0, 0.012, -0.74)
      .rotation.x = Math.PI / 2;                                                            // supressor
    // luneta
    const scope = add(new THREE.CylinderGeometry(0.034, 0.034, 0.2, 12), darkM, 0, 0.085, -0.05);
    scope.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.037, 0.037, 0.02, 12), accent, 0, 0.085, -0.16)
      .rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.02, 0.05, 0.02), metal, 0, 0.045, -0.05);                  // suporte
    const bolt = add(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 8), metal, 0.06, 0.02, 0.1);
    bolt.rotation.z = Math.PI / 2.6;
    add(new RoundedBoxGeometry(0.055, 0.08, 0.16, 2, 0.015), wood, 0, -0.09, 0.14);        // empunhadura
    add(new RoundedBoxGeometry(0.06, 0.1, 0.24, 2, 0.02), wood, 0, -0.01, 0.38);           // coronha
    add(new RoundedBoxGeometry(0.05, 0.12, 0.07, 2, 0.012), darkM, 0, -0.13, -0.02);       // carregador
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.012, -0.8);
    grp.add(muzzle);
  }
  return { group: grp, muzzle };
}
