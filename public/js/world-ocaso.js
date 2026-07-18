// ============================================================
// OCASO (mapa 2) — builder visual.
// >>> FASE 3: ARQUITETURA <<<
// Kit modular sobre os colisores validados da Fase 2: telhados de
// barro com empenas e beirais, cornijas, vãos com moldura, colunas
// cilíndricas com base/capitel, arcos, contrafortes e capeamento
// nas faces dos terraços, madeiramento e veios de cristal na Mina,
// relevo de arcos + água no canal do Aqueduto, forja do Ferreiro,
// sino na Torre. Regra: o visual segue o colisor (nada de parede
// falsa nem passagem visual que não exista de verdade).
// Materiais v2 (normal maps) chegam na Fase 4; props/vida na 5.
// ============================================================
import * as THREE from 'three';
import { BARREL_W, BARREL_H } from '/shared/mapdata.js';
import { tex, texNormal, texRough, skyTex } from './textures.js';
import { mergeStatics, makeBarrel, makeBarrelWreck, scaleUV, jitterGeo } from './world.js';

const TEAL = 0x3fc8b4;

export function buildOcasoWorld(scene, map, opts = {}) {
  const decor = opts.decor !== false;
  const animated = [];
  const root = new THREE.Group();
  const staticRoot = new THREE.Group();
  const liveRoot = new THREE.Group();
  root.add(liveRoot);
  const mats = new Map();

  function cmat(key, make) {
    let m = mats.get(key);
    if (!m) { m = make(); mats.set(key, m); }
    return m;
  }

  // MATERIAIS V2: cada nome de colisor mapeia um painter (Ocaso usa o set
  // novo: arenito, reboco velho, telha…) + normal map (Sobel da pintura)
  // + roughness map. Em qualidade baixa texNormal/texRough devolvem null
  // e o material cai no comportamento simples.
  const V2 = {
    stone: { t: 'sandstone', n: 0.9, rb: 0.92, ra: 0.25 },
    stone2: { t: 'sandstone', tint: 0xbfae92, n: 0.9, rb: 0.93, ra: 0.2 },
    plaster: { t: 'plasterOld', n: 0.55, rb: 0.9, ra: 0.2 },
    wood: { t: 'wood', n: 0.5, rb: 0.87, ra: 0.2 },
    wood2: { t: 'wood2', n: 0.5, rb: 0.88, ra: 0.2 },
    crate: { t: 'crate', n: 0.6, rb: 0.87, ra: 0.2 }
  };
  function mat(name) {
    const cfg = V2[name] || { t: name, n: 0.6, rb: 0.92, ra: 0.15 };
    return cmat('t:' + name, () => {
      const m = new THREE.MeshStandardMaterial({
        map: tex(cfg.t), metalness: 0, color: cfg.tint ?? 0xffffff
      });
      const nm = texNormal(cfg.t, cfg.n);
      if (nm) m.normalMap = nm;
      const rm = texRough(cfg.t, cfg.rb, cfg.ra);
      if (rm) { m.roughnessMap = rm; m.roughness = 1; } else m.roughness = cfg.rb;
      return m;
    });
  }
  const flat = (key, color, extra = {}) => cmat('f:' + key, () => new THREE.MeshStandardMaterial({
    color, roughness: 0.9, ...extra
  }));
  const rockM = () => cmat('rock-flat', () => {
    const m = new THREE.MeshStandardMaterial({ map: tex('rock'), roughness: 1, flatShading: true });
    const nm = texNormal('rock', 0.7);
    if (nm) m.normalMap = nm;
    return m;
  });
  const roofM = () => cmat('roof', () => {
    const m = new THREE.MeshStandardMaterial({ map: tex('roofTile'), metalness: 0 });
    const nm = texNormal('roofTile', 0.9);
    if (nm) m.normalMap = nm;
    const rm = texRough('roofTile', 0.82, 0.2);
    if (rm) { m.roughnessMap = rm; m.roughness = 1; } else m.roughness = 0.82;
    return m;
  });
  const roofFlatM = () => flat('roofFlat', 0xa85a3a, { roughness: 0.85, flatShading: true });

  // mesh de caixa com UV proporcional, já no staticRoot.
  // plasterUV: reboco não repete na vertical (o rodapé terracota fica na base)
  function boxAt(cx, cy, cz, w, h, d, material, plasterUV = false) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (plasterUV) scaleUV(geo, Math.max(1, Math.round(Math.max(w, d) / 4)), 1);
    else scaleUV(geo, Math.max(1, Math.max(w, d) / 3), Math.max(1, h / 3));
    const m = new THREE.Mesh(geo, material);
    m.position.set(cx, cy, cz);
    m.castShadow = m.receiveShadow = true;
    staticRoot.add(m);
    return m;
  }
  // por cantos (mesma convenção do ocaso.js)
  function boxR(x1, z1, x2, z2, y, h, material) {
    return boxAt((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2, x2 - x1, h, z2 - z1, material);
  }

  // ---------------- Céu, luz, chão ----------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(130, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })
  );
  sky.frustumCulled = false;
  liveRoot.add(sky);
  scene.fog = new THREE.Fog(0xe8bd8c, 70, 260);

  liveRoot.add(new THREE.HemisphereLight(0xb8cede, 0xd8a065, 0.8));
  liveRoot.add(new THREE.AmbientLight(0xffdfb8, 0.22));
  const sun = new THREE.DirectionalLight(0xffc98a, 2.5);
  sun.position.set(-55, 24, 6);
  sun.castShadow = false;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -58; sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0008;
  liveRoot.add(sun);

  const groundM = cmat('ground', () => {
    const t = tex('sand').clone();
    t.needsUpdate = true;
    t.repeat.set(20, 20);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  staticRoot.add(ground);

  // pisos por zona (identidade de material — orientação sem minimapa)
  // repeat PROPORCIONAL às dimensões (tile quadrado — sem esticar em "tábua"),
  // com normal/roughness (piso reage à luz rasante do poente)
  function overlay(x1, z1, x2, z2, y, texName, tint, scale = 4.5, ns = 0.5) {
    const key = 'ov:' + texName + tint + ':' + (x2 - x1).toFixed(0) + 'x' + (z2 - z1).toFixed(0);
    const m = cmat(key, () => {
      const t = tex(texName).clone();
      t.needsUpdate = true;
      t.repeat.set((x2 - x1) / scale, (z2 - z1) / scale);
      const mm = new THREE.MeshStandardMaterial({ map: t, color: tint, roughness: 1 });
      const nm = texNormal(texName, ns);
      if (nm) {
        mm.normalMap = nm.clone();
        mm.normalMap.needsUpdate = true;
        mm.normalMap.repeat.copy(t.repeat);
      }
      const rm = texRough(texName, 0.9, 0.2);
      if (rm) {
        mm.roughnessMap = rm.clone();
        mm.roughnessMap.needsUpdate = true;
        mm.roughnessMap.repeat.copy(t.repeat);
      }
      return mm;
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), m);
    p.rotation.x = -Math.PI / 2;
    p.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    p.receiveShadow = true;
    staticRoot.add(p);
  }
  overlay(-38, 18, 34, 27, 0.02, 'cobble', 0xf2e2c4, 3.6);           // rua do Mercado
  overlay(-43, -15.9, 2.6, 9.9, 2.62, 'sandstone', 0xd8c8a8, 4.5);   // Vila oeste
  overlay(5.4, -15.9, 36.5, 9.9, 2.62, 'sandstone', 0xd8c8a8, 4.5);  // Vila leste
  overlay(2.7, -15.9, 5.3, -4.1, 2.62, 'sandstone', 0xd8c8a8, 4.5);  // faixa do Beco
  overlay(-43, -43.5, -36.5, -16.1, 5.22, 'templeStone', 0xfff2d2, 5.5); // Templo oeste
  overlay(-27.3, -43.5, 43, -16.1, 5.22, 'templeStone', 0xfff2d2, 5.5);  // Templo leste
  overlay(-36.3, -28.5, -33.7, -16.1, 5.22, 'templeStone', 0xfff2d2, 5.5); // teto do corredor
  overlay(-36.3, -43.5, -27.5, -28.7, 5.22, 'templeStone', 0xfff2d2, 5.5); // bloco norte
  overlay(-33.7, -25.9, -27.5, -16.1, 5.22, 'templeStone', 0xfff2d2, 5.5); // bloco sul da trincheira
  overlay(-29.4, -28.5, -27.5, -26, 5.22, 'templeStone', 0xfff2d2, 2);     // patamar de saída

  // ---------------- Kit ----------------

  // telhado de duas águas com beiral, cumeeira e empenas
  function gableRoof(x1, z1, x2, z2, topY, mat_, pitch = 1.0, over = 0.4) {
    const alongX = (x2 - x1) >= (z2 - z1);
    const L = (alongX ? x2 - x1 : z2 - z1) + over * 2;
    const half = (alongX ? z2 - z1 : x2 - x1) / 2 + over;
    const slope = Math.hypot(half, pitch);
    const ang = Math.atan2(pitch, half);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    for (const s of [-1, 1]) {
      const pGeo = new THREE.BoxGeometry(alongX ? L : slope, 0.1, alongX ? slope : L);
      scaleUV(pGeo, Math.max(1, (alongX ? L : slope) / 2.4), Math.max(1, (alongX ? slope : L) / 2.4));
      const panel = new THREE.Mesh(pGeo, mat_);
      if (alongX) {
        panel.rotation.x = s * ang;
        panel.position.set(cx, topY + pitch / 2, cz + s * half / 2);
      } else {
        panel.rotation.z = -s * ang;
        panel.position.set(cx + s * half / 2, topY + pitch / 2, cz);
      }
      panel.castShadow = panel.receiveShadow = true;
      staticRoot.add(panel);
    }
    // cumeeira
    boxAt(cx, topY + pitch, cz, alongX ? L : 0.24, 0.14, alongX ? 0.24 : L, mat('wood2'));
    // empenas (triângulo fechando o sótão)
    const tri = new THREE.Shape();
    tri.moveTo(-half + over, 0); tri.lineTo(half - over, 0); tri.lineTo(0, pitch); tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
    for (const e of [-1, 1]) {
      // material liso: UV de extrude vem em metros e estraga painter com remendo
      const emp = new THREE.Mesh(triGeo.clone(), flat('empena', 0xe8dabc));
      if (alongX) {
        emp.rotation.y = Math.PI / 2;
        emp.position.set(e > 0 ? x2 - 0.01 : x1 - 0.11, topY, cz);
      } else {
        emp.position.set(cx, topY, e > 0 ? z2 - 0.11 : z1 - 0.01);
      }
      emp.castShadow = true;
      staticRoot.add(emp);
    }
  }

  // telhado de uma água (depósitos)
  function shedRoof(x1, z1, x2, z2, topY, pitch = 0.6, over = 0.35) {
    const w = x2 - x1 + over * 2, d = z2 - z1 + over * 2;
    const slope = Math.hypot(d, pitch);
    const sGeo = new THREE.BoxGeometry(w, 0.09, slope);
    scaleUV(sGeo, Math.max(1, w / 2.4), Math.max(1, slope / 2.4));
    const panel = new THREE.Mesh(sGeo, roofM());
    panel.rotation.x = Math.atan2(pitch, d);
    panel.position.set((x1 + x2) / 2, topY + pitch / 2, (z1 + z2) / 2);
    panel.castShadow = true;
    staticRoot.add(panel);
  }

  // cornija: lábio saliente no topo do corpo da casa
  function cornice(x1, z1, x2, z2, y) {
    boxR(x1 - 0.14, z1 - 0.14, x2 + 0.14, z2 + 0.14, y - 0.2, 0.2, mat('wood2'));
  }

  // orientação: devolve posição/rotação p/ um plano encostado na face
  function onFace(c, face, along, up, offset = 0.02) {
    if (face === 'N') return { x: (c.x1 + c.x2) / 2 + along, y: up, z: c.z1 - offset, ry: Math.PI };
    if (face === 'S') return { x: (c.x1 + c.x2) / 2 + along, y: up, z: c.z2 + offset, ry: 0 };
    if (face === 'W') return { x: c.x1 - offset, y: up, z: (c.z1 + c.z2) / 2 + along, ry: -Math.PI / 2 };
    return { x: c.x2 + offset, y: up, z: (c.z1 + c.z2) / 2 + along, ry: Math.PI / 2 };
  }
  function placePlane(w, h, material, p) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.y = p.ry;
    staticRoot.add(mesh);
    return mesh;
  }
  // moldura 3D saliente em volta de um vão (ombreiras + verga + peitoril)
  function frame(c, face, along, cy, w, h, material, sill = false) {
    const t = 0.12, d = 0.1;
    const horiz = face === 'N' || face === 'S';
    for (const s of [-1, 1]) {   // ombreiras
      const p = onFace(c, face, along + s * (w / 2 + t / 2), cy, 0.001);
      boxAt(p.x, p.y, p.z, horiz ? t : d, h + t * 2, horiz ? d : t, material);
    }
    const pv = onFace(c, face, along, cy + h / 2 + t / 2, 0.001);   // verga
    boxAt(pv.x, pv.y, pv.z, horiz ? w + t * 2 : d, t, horiz ? d : w + t * 2, material);
    if (sill) {
      const ps = onFace(c, face, along, cy - h / 2 - 0.05, 0.001);
      boxAt(ps.x, ps.y, ps.z, horiz ? w + 0.3 : 0.16, 0.1, horiz ? 0.16 : w + 0.3, material);
    }
  }
  const doorM = () => cmat('door', () => new THREE.MeshStandardMaterial({
    map: tex('door'), alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide
  }));
  const doorTealM = () => cmat('doorT', () => new THREE.MeshStandardMaterial({
    map: tex('door'), color: 0x7fc4b2, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide
  }));
  const winM = () => cmat('window', () => new THREE.MeshStandardMaterial({ map: tex('window'), roughness: 0.8 }));

  function nicheDoor(c, face, along, teal) {
    const base = c.y;
    placePlane(1.5, 2.3, teal ? doorTealM() : doorM(), onFace(c, face, along, base + 1.16));
    frame(c, face, along, base + 1.2, 1.5, 2.3, mat('stone2'));
  }
  function nicheWindow(c, face, along, cy, shutters) {
    placePlane(1.15, 1.4, winM(), onFace(c, face, along, cy));
    frame(c, face, along, cy, 1.15, 1.4, mat('wood2'), true);
    if (shutters && decor) {
      for (const s of [-1, 1]) {
        const p = onFace(c, face, along + s * 1.0, cy, 0.03);
        boxAt(p.x, p.y, p.z, (face === 'N' || face === 'S') ? 0.5 : 0.06, 1.35, (face === 'N' || face === 'S') ? 0.06 : 0.5, mat('wood2'));
      }
    }
  }
  // pontas de viga atravessando a fachada (profundidade barata e honesta)
  function beams(c, face, y, count) {
    const horiz = face === 'N' || face === 'S';
    const span = (horiz ? c.x2 - c.x1 : c.z2 - c.z1) - 1.2;
    for (let i = 0; i < count; i++) {
      const along = -span / 2 + (span * i) / (count - 1);
      const p = onFace(c, face, along, y, 0.14);
      boxAt(p.x, p.y, p.z, horiz ? 0.18 : 0.3, 0.18, horiz ? 0.3 : 0.18, mat('wood2'));
    }
  }
  // toldo listrado (mercado)
  function awning(c, face, along, y) {
    const awnM = cmat('awning', () => new THREE.MeshStandardMaterial({ map: tex('awning'), side: THREE.DoubleSide, roughness: 0.9 }));
    const p = onFace(c, face, along, y, 0.65);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), awnM);
    awn.position.set(p.x, p.y, p.z);
    awn.rotation.y = p.ry;
    awn.rotateX(-Math.PI / 2 + 0.5);
    awn.castShadow = true;
    staticRoot.add(awn);
    const edgeM = cmat('awnEdge', () => new THREE.MeshStandardMaterial({ map: tex('awningEdge'), alphaTest: 0.4, side: THREE.DoubleSide }));
    const pe = onFace(c, face, along, y - 0.36, 1.22);
    placePlane(2.6, 0.3, edgeM, pe);
  }

  // coluna cilíndrica com base e capitel (substitui o visual da caixa).
  // UV do fuste escalado — sem isso a textura embrulha 1x e os rejuntes
  // grandes fazem o cilindro parecer uma caixa de perto.
  function column(cx, cz, baseY, h, r) {
    boxAt(cx, baseY + 0.14, cz, r * 2.3, 0.28, r * 2.3, mat('stone'));
    const geo = new THREE.CylinderGeometry(r * 0.88, r, h - 0.55, 12);
    scaleUV(geo, 3, Math.max(1, (h - 0.55) / 2.2));
    const shaft = new THREE.Mesh(geo, mat('stone'));
    shaft.position.set(cx, baseY + 0.28 + (h - 0.55) / 2, cz);
    shaft.castShadow = true;
    staticRoot.add(shaft);
    boxAt(cx, baseY + h - 0.14, cz, r * 2.2, 0.24, r * 2.2, mat('stone'));
  }
  // arco entre dois pontos, no plano X ou Z. `sy` achata a meia-volta
  // (arco abatido) para caber sob vergas/telhados.
  function arch(cx, cy, cz, span, axisX, material, tube = 0.11, sy = 1) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(span / 2, tube, 8, 20, Math.PI), material);
    a.position.set(cx, cy, cz);
    if (!axisX) a.rotation.y = Math.PI / 2;
    a.scale.y = sy;
    a.castShadow = true;
    staticRoot.add(a);
  }
  // contraforte encostado numa face (terraços)
  function buttress(cx, cz, baseY, h, dir) {   // dir: 'S' face p/ +z, 'N' p/ -z
    const s = dir === 'S' ? 1 : -1;
    boxAt(cx, baseY + h / 2, cz + s * 0.24, 0.6, h, 0.48, mat('stone'));
    boxAt(cx, baseY + h + 0.1, cz + s * 0.18, 0.7, 0.2, 0.42, mat('stone2'));
  }

  // ---------------- Terreno / terraços ----------------
  for (const s of map.SOLIDS) {
    if (s.mat === 'barrel') continue;
    if (s.mat === 'cliff') {
      const geo = new THREE.BoxGeometry(
        s.w + 1.5, s.h + 3, s.d + 1.5,
        Math.max(2, Math.ceil(s.w / 4)), 3, Math.max(2, Math.ceil(s.d / 4))
      );
      jitterGeo(geo, 1.1, 0.8);
      scaleUV(geo, Math.max(s.w, s.d) / 8, s.h / 8);
      const m = new THREE.Mesh(geo, rockM());
      m.position.set(s.x, s.y, s.z);
      m.castShadow = m.receiveShadow = true;
      staticRoot.add(m);
      continue;
    }
    // demais sólidos: caixa com material do tipo (a decoração vem por cima)
    const material = ({
      stone: mat('stone'), stone2: mat('stone2'), wood: mat('wood'),
      wood2: mat('wood2'), plaster: mat('plaster'), crate: mat('crate'),
      rock: rockM()
    })[s.mat] || mat('stone');
    if (s.mat === 'pillar') continue;   // visual vem do kit (coluna cilíndrica)
    if (s.mat === 'rock') {
      const geo = new THREE.BoxGeometry(s.w, s.h + 0.6, s.d, 3, 3, 3);
      jitterGeo(geo, 0.35, 0.3);
      const m = new THREE.Mesh(geo, rockM());
      m.position.set(s.x, s.y, s.z);
      m.castShadow = m.receiveShadow = true;
      staticRoot.add(m);
    } else {
      boxAt(s.x, s.y, s.z, s.w, s.h, s.d, material, s.mat === 'plaster');
    }
  }

  // capeamento das faces dos terraços (lábio de pedra na borda)
  boxR(-43.5, 9.9, 2.6, 10.14, 2.6, 0.14, mat('stone2'));     // Vila oeste
  boxR(5.4, 9.9, 36.6, 10.14, 2.6, 0.14, mat('stone2'));      // Vila leste
  boxR(-36.4, -16.14, -33.6, -15.9, 5.2, 0.14, mat('stone2')); // verga da Mina
  boxR(-43.5, -16.14, -36.3, -15.9, 5.2, 0.14, mat('stone2'));
  boxR(-33.7, -16.14, 36.6, -15.9, 5.2, 0.14, mat('stone2'));
  // contrafortes nas faces (fora dos vãos/conectores)
  for (const bx of [-38, -33, -20, -10, -4]) buttress(bx, 10.24, 0, 2.3, 'S');
  for (const bx of [9, 16, 24, 31]) buttress(bx, 10.24, 0, 2.3, 'S');
  for (const bx of [-42, -31, -22, -12, -4, 6, 14, 22, 30]) buttress(bx, -16.24, 2.6, 2.3, 'N');

  // ---------------- Casas (decoração de fachada) ----------------
  for (const c of map.CASAS) {
    const topY = c.y + c.h;
    if (c.shed) shedRoof(c.x1, c.z1, c.x2, c.z2, topY);
    else gableRoof(c.x1, c.z1, c.x2, c.z2, topY, roofM(), 0.85 + (c.h % 1) * 0.4);
    cornice(c.x1, c.z1, c.x2, c.z2, topY);
    if (!decor) continue;
    const teal = c.zone === 'vila';
    const width = (c.face === 'N' || c.face === 'S') ? c.x2 - c.x1 : c.z2 - c.z1;
    nicheDoor(c, c.face, -width * 0.22, teal);
    nicheWindow(c, c.face, width * 0.22, c.y + 1.55, true);
    if (c.h >= 4.4) nicheWindow(c, c.face, -width * 0.22, c.y + c.h - 1.15, false);
    // vigas na lateral + janela cega nos fundos dão volume por todos os lados
    const side = (c.face === 'N' || c.face === 'S') ? 'W' : 'N';
    beams(c, side, c.y + c.h - 0.55, 3);
    if (c.zone === 'mercado') awning(c, c.face, -width * 0.22, c.y + 2.75);
  }

  // ---------------- Ferreiro (vãos reais — molduras, telhado e detalhes) ----------------
  const FER = { x1: -16, z1: 10, x2: -8, z2: 16.5 };
  gableRoof(FER.x1, FER.z1, FER.x2, FER.z2, 5.4, roofM(), 0.7, 0.35);
  if (decor) {
    const fc = FER;
    // portas reais nos vãos (centro dos vãos: x -12 = centro da casa → along 0)
    frame(fc, 'S', 0, 1.1, 1.8, 2.2, mat('wood2'));    // porta térrea (rua)
    frame(fc, 'S', 0, 3.7, 1.8, 2.2, mat('wood2'));    // porta da varanda
    frame(fc, 'N', 0, 3.7, 1.8, 2.2, mat('wood2'));    // porta da Vila
    // balaústres da varanda
    for (let i = 0; i < 6; i++) {
      boxAt(-13.3 + i * 0.55, 3.05, 17.62, 0.09, 0.85, 0.09, mat('wood2'));
    }
    // mãos-francesas sob a varanda
    for (const bx of [-13.2, -10.8]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), mat('wood2'));
      br.position.set(bx, 1.85, 17.1);
      br.rotation.x = 0.7;
      staticRoot.add(br);
    }
    // chaminé da forja atravessando o telhado
    boxAt(-9.25, 5.9, 11.35, 0.8, 2.2, 0.8, mat('stone2'));
    boxAt(-9.25, 7.06, 11.35, 1.0, 0.14, 1.0, mat('stone2'));
    // bigorna sobre um toco (visual)
    boxAt(-11, 0.25, 13, 0.5, 0.5, 0.5, mat('wood2'));
    boxAt(-11, 0.62, 13, 0.66, 0.24, 0.3, cmat('anvil', () => new THREE.MeshStandardMaterial({ map: tex('metal'), roughness: 0.5, metalness: 0.5 })));
    // brasa da forja (luz quente dentro da casa)
    const forge = new THREE.PointLight(0xff7a30, 14, 7, 2);
    forge.position.set(-9.2, 1.7, 11.3);
    liveRoot.add(forge);
    animated.push(t => { forge.intensity = 12 + Math.sin(t * 7) * 2 + Math.sin(t * 13) * 1.2; });
  }

  // ---------------- Portão (arco abatido + bandeiras) ----------------
  arch(-39.7, 2.7, 22.5, 6.2, false, mat('stone'), 0.16, 0.26);
  boxAt(-39.7, 3.55, 22.5, 1.9, 0.5, 0.7, mat('stone2'));   // fecho do arco
  boxR(-40.72, 17.5, -38.68, 27.5, 4.6, 0.22, mat('stone2'));  // capeamento da verga
  if (decor) {
    const banM = cmat('banner', () => new THREE.MeshStandardMaterial({ map: tex('banner'), side: THREE.DoubleSide, roughness: 0.95 }));
    for (const [bx, by, bz, ry] of [[-38.7, 3.3, 20.1, Math.PI / 2], [-38.7, 3.3, 24.9, Math.PI / 2], [26.2, 8.6, -32.85, 0]]) {
      const pivot = new THREE.Group();
      pivot.position.set(bx, by, bz);
      pivot.rotation.y = ry;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), banM);
      cloth.position.y = -0.95;
      cloth.castShadow = true;
      pivot.add(cloth);
      liveRoot.add(pivot);
      const phase = bx + bz;
      animated.push(t => { pivot.rotation.x = Math.sin(t * 1.3 + phase) * 0.07; });
    }
  }

  // ---------------- Arcos (arcada do mercado) ----------------
  {
    const A = map.ARCOS;
    for (const cx of A.front) column(cx, A.zf, 0, A.h, 0.3);
    for (const cx of A.back) column(cx, A.zb, 0, A.h, 0.3);
    if (decor) {
      for (let i = 0; i < A.front.length - 1; i++) {
        const a = A.front[i], b = A.front[i + 1];
        arch((a + b) / 2, 2.6, A.zf, (b - a) - 0.7, true, mat('stone2'), 0.09, 0.34);
      }
    }
    // telhadinho de barro inclinado sobre a laje da arcada
    shedRoof(A.roof[0], A.roof[1], A.roof[2], A.roof[3], A.h + 0.4, 0.5, 0.3);
  }

  // ---------------- Bancas (toldos listrados) ----------------
  if (decor) {
    const awnM = cmat('awning', () => new THREE.MeshStandardMaterial({ map: tex('awning'), side: THREE.DoubleSide, roughness: 0.9 }));
    for (const [cx, cz] of map.BANCAS) {
      const awn = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), awnM);
      awn.position.set(cx, 2.35, cz);
      awn.rotation.x = -Math.PI / 2 + 0.16;
      awn.castShadow = true;
      staticRoot.add(awn);
    }
  }

  // ---------------- Fonte e cisterna (água) ----------------
  const waterM = cmat('water', () => new THREE.MeshStandardMaterial({
    color: 0x2e8577, roughness: 0.25, metalness: 0.1, emissive: 0x123f38, emissiveIntensity: 0.35
  }));
  {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.05, 0.95, 8), mat('stone2'));
    rim.position.set(33, 0.475, 22);
    rim.castShadow = true;
    staticRoot.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.7, 16), waterM);
    water.rotation.x = -Math.PI / 2;
    water.position.set(33, 0.88, 22);
    staticRoot.add(water);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.6, 8), mat('stone'));
    spout.position.set(33, 1.65, 22);
    spout.castShadow = true;
    staticRoot.add(spout);
  }
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), waterM);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 3.44, -6);
    staticRoot.add(water);
  }
  // água no canal do aqueduto
  {
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 19.2), waterM);
    canal.rotation.x = -Math.PI / 2;
    canal.position.set(39, 5.26, -6.3);
    staticRoot.add(canal);
  }

  // ---------------- Aqueduto: relevo de arcos na face leste (a visível do chão) ----------------
  if (decor) {
    const insetM = flat('inset', 0x6b5138, { roughness: 1 });
    for (const az of [-13, -8.4, -3.8, 0.8]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.6), insetM);
      panel.position.set(41.32, 2.1, az);
      panel.rotation.y = Math.PI / 2;
      staticRoot.add(panel);
      arch(41.32, 3.9, az, 3.0, false, mat('stone2'), 0.1, 0.6);
    }
  }

  // ---------------- Mina: madeiramento + veios de cristal ----------------
  for (const tz of [-18.5, -22, -25.5]) {
    for (const px of [-36.15, -33.85]) boxAt(px, 2.6 + 1.15, tz, 0.24, 2.3, 0.24, mat('wood2'));
    boxAt(-35, 4.85, tz, 2.6, 0.22, 0.3, mat('wood2'));
  }
  if (decor) {
    const veinM = cmat('vein', () => new THREE.MeshStandardMaterial({
      color: TEAL, emissive: 0x35e0c8, emissiveIntensity: 0.9, roughness: 0.4
    }));
    for (const [vx, vy, vz, s] of [[-36.2, 3.3, -19.6, 0.16], [-33.8, 4.1, -23.2, 0.2], [-36.2, 3.0, -26.4, 0.13], [-31.5, 3.4, -27.5, 0.17]]) {
      const v = new THREE.Mesh(new THREE.OctahedronGeometry(s), veinM);
      v.position.set(vx, vy, vz);
      v.rotation.set(vx, vz, vy);
      staticRoot.add(v);
    }
    const veinLight = new THREE.PointLight(0x35e0c8, 8, 9, 2);
    veinLight.position.set(-35, 3.8, -23);
    liveRoot.add(veinLight);
  }

  // ---------------- Templo: colunata, Altar, Torre ----------------
  for (const cx of map.COLUNAS_LONGA) column(cx, -21.6, 5.2, 4.2, 0.34);
  // lábios de cornija nos degraus do Altar
  boxR(-4.64, -39.64, 4.64, -30.36, 5.56, 0.14, mat('stone2'));
  boxR(-3.34, -38.34, 3.34, -31.66, 6.06, 0.14, mat('stone2'));
  if (decor) {
    // disco solar no plinto (face sul, voltada à Longa)
    const sunM = flat('sundisc', 0xe0b23c, { roughness: 0.5, metalness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 20), sunM);
    ring.position.set(0, 7.6, -34.27);
    staticRoot.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), flat('suncore', 0xc9714c));
    disc.position.set(0, 7.6, -34.26);
    staticRoot.add(disc);
  }
  // Torre: pilastras de canto, campanário com sino e coruchéu
  for (const [px, pz] of [[24.15, -38.05], [28.25, -38.05], [24.15, -33.95], [28.25, -33.95]]) {
    boxAt(px, 5.2 + 1.7, pz, 0.5, 3.4, 0.5, mat('stone2'));
  }
  {
    for (const [px, pz] of [[24.4, -37.8], [28, -37.8], [24.4, -34.2], [28, -34.2]]) {
      boxAt(px, 9.95 + 0.9, pz, 0.35, 1.8, 0.35, mat('wood2'));
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), roofFlatM());
    cap.position.set(26.2, 12.4, -36);
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    staticRoot.add(cap);
    if (decor) {
      const bellM = cmat('bell', () => new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0xc8a860, roughness: 0.4, metalness: 0.8 }));
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.55, 10), bellM);
      bell.position.set(26.2, 11.1, -36);
      staticRoot.add(bell);
    }
  }

  // ---------------- Decalques de desgaste (o que mata a cara de protótipo) ----------------
  if (decor) {
    function decalMat(name, rx = 1) {
      return cmat('dc:' + name + rx, () => {
        let t = tex(name);
        if (rx !== 1) {
          t = t.clone();
          t.needsUpdate = true;
          t.repeat.set(rx, 1);
        }
        return new THREE.MeshStandardMaterial({
          map: t, transparent: true, depthWrite: false, roughness: 1,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
        });
      });
    }
    const wallDecal = (name, w, h, x, y, z, ry, rx = 1) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decalMat(name, rx));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      staticRoot.add(p);
    };
    const floorDecal = (name, w, d, x, z, y, rx = 1) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), decalMat(name, rx));
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, y, z);
      staticRoot.add(p);
    };

    // trilhas de carroça na rua (entram pelo Portão)
    floorDecal('wearLine', 62, 1.0, -4, 21.3, 0.045, 8);
    floorDecal('wearLine', 62, 1.0, -4, 23.9, 0.045, 8);

    // areia acumulada nas bases (paredes viradas pro vento oeste/norte)
    wallDecal('sandDrift', 8, 1.1, -25, 0.55, 27.96, Math.PI);      // casa A
    wallDecal('sandDrift', 9, 1.1, -6, 0.55, 28.96, Math.PI);       // casa B
    wallDecal('sandDrift', 8, 1.1, 14, 0.55, 27.96, Math.PI);       // casa C
    wallDecal('sandDrift', 7, 1.0, -34, 0.5, 9.96, 0);              // face da Vila oeste
    wallDecal('sandDrift', 6, 1.0, -20, 0.5, 9.96, 0);
    wallDecal('sandDrift', 8, 1.0, 28, 0.5, 9.96, 0);               // face da Vila leste
    wallDecal('sandDrift', 9, 1.0, -8, 3.15, -16.04, 0);            // face do Templo
    wallDecal('sandDrift', 8, 1.0, 20, 3.15, -16.04, 0);
    wallDecal('sandDrift', 1.9, 0.8, -38.77, 0.4, 18.5, Math.PI / 2); // pilar do Portão
    wallDecal('sandDrift', 1.9, 0.8, -38.77, 0.4, 26.5, Math.PI / 2);

    // escorrido de umidade: face leste do Aqueduto (o canal respinga)
    wallDecal('dampStreak', 3.4, 2.8, 41.34, 3.6, -10, Math.PI / 2);
    wallDecal('dampStreak', 3.4, 2.8, 41.34, 3.6, -2, Math.PI / 2);
    wallDecal('dampStreak', 2.4, 0.85, 0, 3.05, -4.66, 0);          // cisterna

    // fuligem da forja (parede interna + chaminé)
    wallDecal('soot', 1.7, 1.7, -8.53, 2.1, 11.3, -Math.PI / 2);
    wallDecal('soot', 0.9, 1.1, -9.25, 6.5, 11.78, 0);
  }

  // ---------------- Barris ----------------
  const barrelDims = { w: BARREL_W, h: BARREL_H, d: BARREL_W };
  const barrels = map.BARRELS.map(b => {
    const intact = makeBarrel(barrelDims);
    const wreck = makeBarrelWreck(barrelDims);
    wreck.position.y = -BARREL_H / 2;
    wreck.visible = false;
    const grp = new THREE.Group();
    grp.position.set(b.x, (b.y || 0) + BARREL_H / 2, b.z);
    grp.add(intact, wreck);
    liveRoot.add(grp);
    return { id: b.id, group: grp, intact, wreck, alive: true };
  });

  // ---------------- Cristal do Altar (farol do mapa) ----------------
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    cmat('crystal', () => new THREE.MeshStandardMaterial({
      color: TEAL, emissive: 0x35e0c8, emissiveIntensity: 1.2, roughness: 0.3
    }))
  );
  crystal.position.set(0, 9.4, -35);
  liveRoot.add(crystal);
  if (decor) {
    const crystalLight = new THREE.PointLight(0x35e0c8, 30, 16, 2);
    crystalLight.position.set(0, 9.4, -35);
    liveRoot.add(crystalLight);
  }
  animated.push(t => {
    crystal.rotation.y = t * 0.7;
    crystal.position.y = 9.4 + Math.sin(t * 1.4) * 0.15;
  });

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
        if (m && !seenM.has(m)) { seenM.add(m); m.dispose(); }
      });
    }
  };
}
