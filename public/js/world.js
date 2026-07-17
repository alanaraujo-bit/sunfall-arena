// ============================================================
// Construção visual do mundo: geometria estilizada, iluminação
// de fim de tarde, decoração e modelos de personagem/armas.
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SOLIDS } from '/shared/mapdata.js';
import { tex, skyTex } from './textures.js';

const TEAL = 0x3fc8b4, CORAL = 0xd95350, CREAM = 0xf2e3c8;

function mat(name, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex(name), roughness: 0.95, metalness: 0, ...opts
  });
}

function texRepeat(name, rx, ry) {
  const t = tex(name).clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}

// Deslocamento pseudo-aleatório determinístico p/ rochas
function jitterGeo(geo, amp, ampY = amp * 0.6, keepBottom = true) {
  const pos = geo.attributes.position;
  const minY = geo.boundingBox ? geo.boundingBox.min.y : -Infinity;
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

function makeBarrel(s) {
  const grp = new THREE.Group();
  const r = s.w / 2;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.95, r * 0.88, s.h, 14),
    mat('barrel')
  );
  body.castShadow = body.receiveShadow = true;
  grp.add(body);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x46525c, roughness: 0.6, metalness: 0.4 });
  for (const y of [-s.h * 0.3, s.h * 0.3]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * 1.0, 0.09, 14), ringMat);
    ring.position.y = y;
    ring.castShadow = true;
    grp.add(ring);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0x6e4a2d, roughness: 0.9 }));
  lid.position.y = s.h / 2;
  grp.add(lid);
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
  const leafT = tex('leaf');
  const leafM = new THREE.MeshStandardMaterial({
    map: leafT, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.9
  });
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
  const cocoM = new THREE.MeshStandardMaterial({ color: 0x7c5433, roughness: 0.85 });
  for (const [cx, cz] of [[0.2, 0.12], [-0.15, -0.18]]) {
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), cocoM);
    coco.position.set(cx, -0.15, cz);
    coco.castShadow = true;
    crown.add(coco);
  }
  grp.add(crown);
  return grp;
}

function makeCliff(s) {
  const geo = new THREE.BoxGeometry(
    s.w + 1.5, s.h + 3, s.d + 1.5,
    Math.max(2, Math.ceil(s.w / 4)), 3, Math.max(2, Math.ceil(s.d / 4))
  );
  jitterGeo(geo, 1.1, 0.8);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: texRepeat('rock', Math.max(s.w, s.d) / 8, s.h / 8),
    roughness: 1, flatShading: true
  }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function makeRock(s) {
  const geo = new THREE.BoxGeometry(s.w, s.h + 0.6, s.d, 3, 3, 3);
  jitterGeo(geo, 0.35, 0.3);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: tex('rock'), roughness: 1, flatShading: true
  }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Bloco de construção com textura repetida conforme dimensão
function makeBlock(s) {
  const geo = s.w < 3 && s.h < 3 && s.d < 3
    ? new RoundedBoxGeometry(s.w, s.h, s.d, 2, 0.05)
    : new THREE.BoxGeometry(s.w, s.h, s.d);
  // plaster não repete na vertical (o rodapé terracota fica só na base)
  const plaster = s.mat.startsWith('plaster');
  const ry = plaster ? 1 : Math.max(1, s.h / 2.6);
  const rx = plaster ? Math.max(1, Math.round(Math.max(s.w, s.d) / 4)) : Math.max(1, Math.max(s.w, s.d) / 2.6);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: texRepeat(s.mat, rx, ry),
    roughness: 0.95
  }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Fachada: janelas, porta, cornija e toldo para blocos 'plaster' grandes
function decorateBuilding(scene, s) {
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
  const winM = new THREE.MeshStandardMaterial({ map: tex('window'), roughness: 0.8 });
  const doorM = new THREE.MeshStandardMaterial({
    map: tex('door'), alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide
  });

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
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshStandardMaterial({ map: tex('awning'), side: THREE.DoubleSide, roughness: 0.9 }));
  awn.rotation.x = -Math.PI / 2 + 0.5;
  awn.position.y = -0.28;
  awn.position.z = 0.55;
  awn.castShadow = true;
  awnGrp.add(awn);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.3),
    new THREE.MeshStandardMaterial({ map: tex('awningEdge'), alphaTest: 0.4, side: THREE.DoubleSide }));
  edge.position.set(0, -0.62, 1.12);
  awnGrp.add(edge);
  const poleM = new THREE.MeshStandardMaterial({ color: 0x6e4a2d, roughness: 0.9 });
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
  scene.add(grp);
}

// ---------------- Mundo ----------------

export function buildWorld(scene) {
  const animated = [];

  // Céu + névoa quente
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xecca9c, 70, 260);

  // Iluminação de fim de tarde
  scene.add(new THREE.HemisphereLight(0xbcd8e8, 0xd8a86a, 0.85));
  scene.add(new THREE.AmbientLight(0xffe8c8, 0.25));
  const sun = new THREE.DirectionalLight(0xffe3b0, 2.4);
  sun.position.set(45, 55, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -52; sun.shadow.camera.right = 52;
  sun.shadow.camera.top = 52; sun.shadow.camera.bottom = -52;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // Chão de areia
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ map: texRepeat('sand', 18, 18), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Praça central em pedra
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(9, 28),
    new THREE.MeshStandardMaterial({ map: texRepeat('plaza', 4, 4), roughness: 1 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  scene.add(plaza);

  // Trilhas de areia escura ligando os pontos de interesse
  const pathM = new THREE.MeshStandardMaterial({
    map: texRepeat('sand', 3, 10), color: 0xbfa070, roughness: 1
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
    scene.add(p);
  }

  // Sólidos do mapa
  for (const s of SOLIDS) {
    let m;
    switch (s.mat) {
      case 'cliff': m = makeCliff(s); break;
      case 'rock': m = makeRock(s); break;
      case 'crate': m = makeCrate(s); break;
      case 'barrel': m = makeBarrel(s); break;
      case 'palm': m = makePalm(s); break;
      default: m = makeBlock(s);
    }
    if (s.mat === 'palm') m.position.set(s.x, s.y - s.h / 2, s.z);
    else m.position.set(s.x, s.y, s.z);
    scene.add(m);
    // fachada nas casas grandes
    if (s.mat === 'plaster' && s.h >= 4) decorateBuilding(scene, s);
  }

  // ---- Decoração ----

  // Cristal do obelisco central
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55),
    new THREE.MeshStandardMaterial({
      color: TEAL, emissive: 0x35e0c8, emissiveIntensity: 1.3, roughness: 0.3
    })
  );
  crystal.position.set(0, 4.15, 0);
  scene.add(crystal);
  const crystalLight = new THREE.PointLight(0x35e0c8, 26, 14, 2);
  crystalLight.position.set(0, 4.2, 0);
  scene.add(crystalLight);
  animated.push(t => {
    crystal.rotation.y = t * 0.8;
    crystal.position.y = 4.15 + Math.sin(t * 1.6) * 0.12;
  });

  // Tapetes na praça
  const rugM = new THREE.MeshStandardMaterial({ map: tex('rug'), roughness: 1 });
  for (const [rx, rz, rot, sc] of [[2.8, 3.4, 0.4, 1], [-3.4, -2.6, -0.9, 0.85], [4.2, 21.4, 0.15, 0.9]]) {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * sc, 1.7 * sc), rugM);
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = rot;
    rug.position.set(rx, 0.035, rz);
    rug.receiveShadow = true;
    scene.add(rug);
  }

  // Estandartes (torre + obelisco)
  const banM = new THREE.MeshStandardMaterial({
    map: tex('banner'), side: THREE.DoubleSide, roughness: 0.95
  });
  const banners = [[16.4, 9.4, -20, Math.PI / 2], [0, 3.4, 1.36, 0], [0, 3.4, -1.36, Math.PI], [23.6, 8.9, -20, -Math.PI / 2]];
  for (const [bx, by, bz, ry] of banners) {
    const pivot = new THREE.Group();
    pivot.position.set(bx, by, bz);
    pivot.rotation.y = ry;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), banM);
    cloth.position.y = -1.05;
    cloth.castShadow = true;
    pivot.add(cloth);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6),
      new THREE.MeshStandardMaterial({ color: 0x6e4a2d }));
    rod.rotation.z = Math.PI / 2;
    pivot.add(rod);
    scene.add(pivot);
    const phase = bx + bz;
    animated.push(t => { pivot.rotation.x = Math.sin(t * 1.3 + phase) * 0.06; });
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
      const pen = new THREE.Mesh(buntG, new THREE.MeshStandardMaterial({
        color: buntColors[i % 4], side: THREE.DoubleSide, roughness: 0.9
      }));
      pen.position.copy(p);
      pen.position.y -= 0.2;
      scene.add(pen);
    }
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: 0x4a3018 })
  ));

  // Frutas nas bancadas do mercado
  const fruitCols = [CORAL, 0xf0c060, TEAL, 0xe08a40];
  let fi = 0;
  for (const [tx, tz] of [[-3.5, 22], [3.5, 22]]) {
    for (const [ox, oz] of [[-0.6, -0.25], [0.1, 0.3], [0.65, -0.15]]) {
      const fruit = new THREE.Mesh(
        new RoundedBoxGeometry(0.34, 0.3, 0.34, 2, 0.1),
        new THREE.MeshStandardMaterial({ color: fruitCols[fi++ % 4], roughness: 0.7 }));
      fruit.position.set(tx + ox, 1.22, tz + oz);
      fruit.castShadow = true;
      scene.add(fruit);
    }
  }

  // Tufos de grama
  const grassM = new THREE.MeshStandardMaterial({
    map: tex('grass'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1
  });
  const grassSpots = [
    [-8, 20], [11, 10], [-20, -4], [17, -12], [-28, -14], [6, -20],
    [-14, 24], [26, 20], [30, -14], [-32, 10], [3, -7], [-25, -24]
  ];
  for (const [gx, gz] of grassSpots) {
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55), grassM);
      blade.position.set(gx + (i - 1) * 0.1, 0.27, gz);
      blade.rotation.y = i * 1.05;
      scene.add(blade);
    }
  }

  // Vasos de terracota com plantas
  const potM = new THREE.MeshStandardMaterial({ color: 0xc9714c, roughness: 0.95 });
  const bushM = new THREE.MeshStandardMaterial({ color: 0x5aa84e, roughness: 1, flatShading: true });
  for (const [px, pz] of [[-17.5, -13.4], [21.2, 4.2], [-1.8, 24.8], [-23.8, 9.8]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 10), potM);
    pot.position.set(px, 0.25, pz);
    pot.castShadow = true;
    scene.add(pot);
    const bushGeo = jitterGeo(new THREE.SphereGeometry(0.34, 7, 6), 0.09, 0.09, false);
    const bush = new THREE.Mesh(bushGeo, bushM);
    bush.position.set(px, 0.68, pz);
    bush.castShadow = true;
    scene.add(bush);
  }

  // Pedrinhas espalhadas
  for (let i = 0; i < 10; i++) {
    const a = i * 2.7, r = 12 + (i * 7) % 22;
    const st = new THREE.Mesh(
      jitterGeo(new THREE.BoxGeometry(0.5, 0.3, 0.4, 2, 2, 2), 0.1, 0.08, false),
      new THREE.MeshStandardMaterial({ map: tex('rock'), flatShading: true, roughness: 1 }));
    st.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    st.rotation.y = a * 2;
    st.castShadow = true;
    scene.add(st);
  }

  return {
    sun,
    update(t) { for (const fn of animated) fn(t); }
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
  grp.add(arms);

  grp.userData = { legL, legR, head, arms };
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
  if (kind === 'ar') {
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
