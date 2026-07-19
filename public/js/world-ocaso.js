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
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BARREL_W, BARREL_H, raycastSolids } from '/shared/mapdata.js';
import { tex, texNormal, texRough, skyTexOcaso } from './textures.js';
import { mergeStatics, makeBarrel, makeBarrelWreck, scaleUV, jitterGeo } from './world.js';

const TEAL = 0x3fc8b4;

// RNG determinística local (mesmo princípio do textures.js: todo cliente
// vê a mesma coisa) — usada só pelo desfiladeiro distante (dressing puro,
// sem física, mas ainda assim consistente entre telas/capturas).
let _rs = 445566778;
function rrand() {
  _rs ^= _rs << 13; _rs ^= _rs >>> 17; _rs ^= _rs << 5; _rs >>>= 0;
  return _rs / 4294967296;
}
const rr = (a, b) => a + rrand() * (b - a);

export function buildOcasoWorld(scene, map, opts = {}) {
  _rs = 445566778;   // reseta a cada build — mesmo desfiladeiro sempre, mesmo após rebuild de qualidade
  const decor = opts.decor !== false;
  const animated = [];
  const root = new THREE.Group();
  const staticRoot = new THREE.Group();
  const liveRoot = new THREE.Group();
  root.add(liveRoot);
  const mats = new Map();

  // ---------------- AO por vértice (Fase 6) ----------------
  // Cor branca uniforme (sem tingimento) — usada em TODA geometria que não
  // recebe AO real, só para garantir que o atributo 'color' exista em todo
  // mundo. mergeGeometries() (ver world.js) exige que geometrias do MESMO
  // material tenham exatamente os mesmos atributos, e várias peças cruas
  // (colunas, arcos, telhados…) compartilham material com paredes que TÊM
  // AO baked via boxAt — sem isso a fusão quebraria silenciosamente e cada
  // peça viraria 1 draw call a mais.
  function paintUniform(geo, v = 1) {
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3).fill(v);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
  // Interceptor: qualquer mesh que chegue ao staticRoot sem 'color' ganha
  // branco uniforme automaticamente — rede de segurança pro merge nunca
  // quebrar, mesmo em call sites que criam geometria crua (cilindros,
  // torus, plane) fora do boxAt().
  const _staticAdd = staticRoot.add.bind(staticRoot);
  staticRoot.add = (...objs) => {
    for (const o of objs) {
      if (o && o.isMesh && o.geometry && !o.geometry.attributes.color) paintUniform(o.geometry);
    }
    return _staticAdd(...objs);
  };

  // Oclusão ambiente amostrada num CANTO do mundo: lança raios curtos nas
  // 3 direções do octante externo daquele canto (as combinações de 2 eixos
  // do sinal do canto — a diagonal pura fica implícita, é a soma vetorial)
  // contra os colisores do mapa. Alcance curto (0.55m) — isto é sombra de
  // CONTATO (parede∼chão, cornija∼parede), não sombra projetada distante.
  const AO_RANGE = 0.55, AO_STRENGTH = 0.55;
  function sampleCornerAO(bounds, px, py, pz, sx, sy, sz) {
    const dirs = [[sx, sy, 0], [sx, 0, sz], [0, sy, sz]];
    let hits = 0;
    for (const [dx0, dy0, dz0] of dirs) {
      const len = Math.hypot(dx0, dy0, dz0) || 1;
      const dx = dx0 / len, dy = dy0 / len, dz = dz0 / len;
      // nudge ao longo da própria direção de amostra: como o canto é vértice
      // de uma caixa convexa, mover-se nessa direção já escapa da própria
      // caixa — não precisa excluir nada explicitamente.
      const t = raycastSolids(bounds, px + dx * 0.03, py + dy * 0.03, pz + dz * 0.03, dx, dy, dz, AO_RANGE);
      if (t < AO_RANGE) hits++;
    }
    return 1 - (hits / dirs.length) * AO_STRENGTH;   // 1 = aberto, mais escuro = mais encravado
  }
  // Assa AO nos 8 cantos de uma caixa (mundo: cx,cy,cz = centro; w,h,d =
  // dimensões) e escreve num atributo 'color' por vértice. BoxGeometry não
  // rotacionada: o SINAL da posição local de cada vértice já indica a qual
  // canto ele pertence (mesmo sinal em x/y/z = mesmo octante).
  function bakeBoxAO(geo, cx, cy, cz, w, h, d, bounds) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const corner = {};   // 'sx,sy,sz' -> luminosidade 0..1
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      corner[`${sx},${sy},${sz}`] = sampleCornerAO(bounds, cx + sx * hw, cy + sy * hh, cz + sz * hd, sx, sy, sz);
    }
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const sx = pos.getX(i) < 0 ? -1 : 1, sy = pos.getY(i) < 0 ? -1 : 1, sz = pos.getZ(i) < 0 ? -1 : 1;
      const v = corner[`${sx},${sy},${sz}`];
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }

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
        map: tex(cfg.t), metalness: 0, color: cfg.tint ?? 0xffffff, vertexColors: true
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
  // ao: assa oclusão ambiente real nos 8 cantos — mas só vale a pena (e só
  // fica bonito) em peças de escala arquitetônica de DETALHE: moldura,
  // cornija, contraforte, viga, caixote. Uma caixa GIGANTE (laje de terraço
  // de 80m, corpo inteiro de uma casa de 12m) só tem 8 vértices no total —
  // "assar AO nos cantos" nela criaria um gradiente esticado ao longo de
  // dezenas de metros (iluminação errada), não sombra de contato. Por isso
  // o AO real só liga quando a maior dimensão horizontal cabe num "canto"
  // de verdade; peças grandes caem no branco uniforme (a `paintUniform`
  // dentro do interceptor de staticRoot.add cuida disso sozinha).
  const AO_MAX_SPAN = 8;
  function boxAt(cx, cy, cz, w, h, d, material, plasterUV = false, ao = true) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (plasterUV) scaleUV(geo, Math.max(1, Math.round(Math.max(w, d) / 4)), 1);
    else scaleUV(geo, Math.max(1, Math.max(w, d) / 3), Math.max(1, h / 3));
    if (ao && Math.max(w, d) <= AO_MAX_SPAN) bakeBoxAO(geo, cx, cy, cz, w, h, d, map.BOUNDS);
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

  // ---------------- Céu, luz, chão (Fase 6 — rig do poente) ----------------
  // Céu PRÓPRIO do Ocaso (skyTexOcaso, não skyTex): o Cânion fica congelado
  // como referência, não pode herdar mudança nenhuma daqui. Domo maior
  // (260, casa com o alcance da névoa) pra sobrar espaço pro desfiladeiro
  // distante mais adiante sem ficar por fora dele.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(260, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTexOcaso(), side: THREE.BackSide, fog: false })
  );
  sky.frustumCulled = false;
  liveRoot.add(sky);
  scene.fog = new THREE.Fog(0xe8b488, 65, 260);

  // luz ambiente: céu frio por cima, chão quente por baixo (bounce genérico)
  liveRoot.add(new THREE.HemisphereLight(0xb0c4d8, 0xd8a065, 0.78));
  liveRoot.add(new THREE.AmbientLight(0xffdfb8, 0.2));
  // sol: baixo e bem a oeste — é A bússola do mapa (sombras sempre apontam
  // pro leste). Mais rasante que o rig provisório da Fase 3.
  const sun = new THREE.DirectionalLight(0xffb878, 2.65);
  sun.position.set(-58, 17, 8);
  sun.castShadow = false;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -58; sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0008;
  liveRoot.add(sun);
  // "bounce falso": luz fria e fraca vindo do leste, sem sombra própria —
  // só pra tirar o breu total do lado de trás de quem olha pro sol.
  const eastFill = new THREE.DirectionalLight(0x7fa0c8, 0.4);
  eastFill.position.set(48, 12, -14);
  eastFill.castShadow = false;
  liveRoot.add(eastFill);

  // ---------------- Desfiladeiro distante (2 camadas, fora da área jogável) ----------------
  // Silhuetas jitteradas (mesma técnica dos paredões do perímetro) mais
  // altas e mais longe, tingidas pra bruma — dão profundidade além do que
  // o jogador alcança sem física nem custo extra de física, e cada camada
  // vira só 1 draw call (mesmo material, funde no staticRoot).
  if (decor) {
    // picos ESTREITOS e NUMEROSOS (não poucos painéis largos!) — largura
    // pequena o bastante pra cada caixa virar um "pico" distinto, com
    // segmentação escalando com o tamanho (mesma fórmula do 'cliff' do
    // perímetro: s.w/4) pra o jitter conseguir quebrar a silhueta de
    // verdade em vez de só amassar levemente uma face enorme e quase lisa.
    function ridgeLayer(radius, count, minH, maxH, color, opacity) {
      const m = flat('ridge' + color, color, { flatShading: true, transparent: opacity < 1, opacity });
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rr(-0.05, 0.05);
        const w = radius * rr(0.11, 0.19), h = rr(minH, maxH), d = w * rr(0.55, 0.85);
        const segX = Math.max(3, Math.ceil(w / 4)), segZ = Math.max(3, Math.ceil(d / 4));
        const geo = new THREE.BoxGeometry(w, h, d, segX, 4, segZ);
        jitterGeo(geo, w * 0.3, h * 0.35);
        const mesh = new THREE.Mesh(geo, m);
        // raio com jitter próprio: picos não ficam todos num círculo perfeito
        const r = radius * rr(0.94, 1.08);
        mesh.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r);
        mesh.rotation.y = a + rr(-0.3, 0.3);
        mesh.castShadow = mesh.receiveShadow = false;
        staticRoot.add(mesh);
      }
    }
    ridgeLayer(120, 30, 16, 34, 0xc4926e, 0.9);    // camada próxima — picos que se sobrepõem
    ridgeLayer(172, 26, 26, 54, 0xa8846e, 0.6);    // camada distante, mais alta e mais hazy
  }

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
    if (s.mat === 'clip') continue;   // bloqueio de colisão puro — sem visual (Mirante)
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
    if (s.mat === 'olive') continue;    // visual vem do kit (oliveira)
    if (s.mat === 'fonte') continue;    // visual vem do kit (fonte octogonal)
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
    // aro octogonal (UV escalado — senão a pedra "embrulha" e vira tábua)
    const rimGeo = new THREE.CylinderGeometry(2.0, 2.08, 0.95, 8);
    scaleUV(rimGeo, 5, 1);
    const rim = new THREE.Mesh(rimGeo, mat('stone2'));
    rim.position.set(33, 0.475, 22);
    rim.castShadow = true;
    staticRoot.add(rim);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.12, 8), mat('stone'));
    lip.position.set(33, 0.95, 22);
    staticRoot.add(lip);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.85, 16), waterM);
    water.rotation.x = -Math.PI / 2;
    water.position.set(33, 0.9, 22);
    staticRoot.add(water);
    const colGeo = new THREE.CylinderGeometry(0.34, 0.44, 1.5, 9);
    scaleUV(colGeo, 3, 1);
    const spout = new THREE.Mesh(colGeo, mat('stone'));
    spout.position.set(33, 1.7, 22);
    spout.castShadow = true;
    staticRoot.add(spout);
    // taça no topo com espelho d'água
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.4, 0.28, 9), mat('stone'));
    bowl.position.set(33, 2.52, 22);
    bowl.castShadow = true;
    staticRoot.add(bowl);
    const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.52, 12), waterM);
    bowlWater.rotation.x = -Math.PI / 2;
    bowlWater.position.set(33, 2.63, 22);
    staticRoot.add(bowlWater);
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

  // ---------------- Props e vida (Fase 5) ----------------

  // Oliveiras (tronco = colisor em ocaso.js; aqui só o visual)
  const foliageM = cmat('foliage', () => new THREE.MeshStandardMaterial({
    color: 0x77875c, roughness: 1, flatShading: true
  }));
  for (const [ox, oz, oy] of (map.OLIVEIRAS || [])) {
    let cy = oy;
    for (const [seg, lean] of [[1.1, 0.06], [1.0, 0.16], [0.9, 0.28]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, seg, 7), mat('wood2'));
      t.position.set(ox + lean, cy + seg / 2, oz);
      t.rotation.z = -lean * 0.8;
      t.castShadow = true;
      staticRoot.add(t);
      cy += seg * 0.92;
    }
    for (const [fx, fy, fz, fr] of [[0.5, 3.4, 0, 1.0], [-0.3, 3.1, 0.4, 0.75], [0.2, 3.0, -0.5, 0.7], [0.9, 2.9, 0.3, 0.6]]) {
      const geo = jitterGeo(new THREE.SphereGeometry(fr, 7, 6), fr * 0.22, fr * 0.22, false);
      const f = new THREE.Mesh(geo, foliageM);
      f.position.set(ox + fx, oy + fy, oz + fz);
      f.castShadow = true;
      staticRoot.add(f);
    }
  }

  if (decor) {
    const TER = flat('terracotta', 0xb3714c, { roughness: 0.9 });
    const ROPE = cmat('rope-line', () => new THREE.LineBasicMaterial({ color: 0x4a3820 }));

    // --- mercadorias nas bancas: frutas + rolos de tecido ---
    const fruitCols = [0xd95350, 0xf0c04c, 0x3fa89a, 0xe08a40];
    let fi = 0;
    for (const [bx, bz] of map.BANCAS) {
      for (const [ox2, oz2] of [[-0.6, -0.2], [0.05, 0.28], [0.62, -0.12]]) {
        const col = fruitCols[fi++ % 4];
        const fruit = new THREE.Mesh(
          new RoundedBoxGeometry(0.3, 0.27, 0.3, 2, 0.09),
          cmat('fruit' + col, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })));
        fruit.position.set(bx + ox2, 1.2, bz + oz2);
        fruit.castShadow = true;
        staticRoot.add(fruit);
      }
      // rolo de tecido encostado no poste
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 8),
        cmat('roll' + (fi % 2), () => new THREE.MeshStandardMaterial({ color: fi % 2 ? 0x8fb6a8 : 0xc9714c, roughness: 0.95 })));
      roll.position.set(bx - 1.35, 0.55, bz + 0.95);
      roll.rotation.x = 0.12;
      staticRoot.add(roll);
    }

    // --- sacos de grão (pilhas de 2+1) ---
    const sackM = cmat('sack', () => new THREE.MeshStandardMaterial({ color: 0xc0a87e, roughness: 1 }));
    const sack = (x, y, z, ry) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.36, 0.4, 2, 0.13), sackM);
      m.position.set(x, y + 0.18, z);
      m.rotation.y = ry;
      m.castShadow = true;
      staticRoot.add(m);
    };
    for (const [sx, sz, sy] of [[-6.4, 23.3, 0], [9.2, 27.1, 0], [34.7, 19.5, 0], [-33.2, -14.5, 2.6]]) {
      sack(sx, sy, sz, 0.3);
      sack(sx + 0.5, sy, sz + 0.25, -0.4);
      sack(sx + 0.22, sy + 0.36, sz + 0.1, 0.9);
    }

    // --- caixotes abertos com mercadoria ---
    for (const [cx2, cz2, cy2] of [[-22.4, 27.3, 0], [25.2, -7.1, 2.6]]) {
      boxAt(cx2, cy2 + 0.3, cz2, 0.95, 0.6, 0.95, mat('crate'));
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.78), flat('crateIn', 0x2e2418));
      inner.position.set(cx2, cy2 + 0.56, cz2);
      staticRoot.add(inner);
      for (let i = 0; i < 3; i++) {
        const g = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6),
          cmat('goods' + i, () => new THREE.MeshStandardMaterial({ color: [0xe0a84c, 0xc9714c, 0x9aa578][i], roughness: 0.8 })));
        g.position.set(cx2 + (i - 1) * 0.2, cy2 + 0.62, cz2 + (i % 2 ? 0.14 : -0.12));
        staticRoot.add(g);
      }
    }

    // --- ânforas de cerâmica (LatheGeometry) ---
    const amphoraGeo = (() => {
      const pts = [];
      for (const [r, y] of [[0.001, 0], [0.13, 0.02], [0.21, 0.28], [0.17, 0.5], [0.08, 0.62], [0.1, 0.7]]) {
        pts.push(new THREE.Vector2(r, y));
      }
      return new THREE.LatheGeometry(pts, 9);
    })();
    for (const [ax2, az2, ay2, n2] of [[-2.6, -9.7, 2.6, 3], [7.1, -5.6, 2.6, 2], [31.1, 24.5, 0, 2], [-13.2, 19.5, 0, 2], [-25.7, -20.5, 5.2, 3], [22.4, -20.3, 5.2, 2]]) {
      for (let i = 0; i < n2; i++) {
        const a = new THREE.Mesh(amphoraGeo, TER);
        const sc = 0.85 + (i * 0.17) % 0.4;
        a.scale.set(sc, sc, sc);
        a.position.set(ax2 + i * 0.42 - 0.2, ay2, az2 + (i % 2) * 0.34);
        if (i === n2 - 1 && n2 > 2) { a.rotation.z = Math.PI / 2.15; a.position.y = ay2 + 0.16; } // uma caída
        a.castShadow = true;
        staticRoot.add(a);
      }
    }

    // --- lanternas (emissivas — sem custo de luz dinâmica) ---
    const lampFrameM = cmat('lampF', () => new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.6, metalness: 0.5 }));
    const lampGlowM = cmat('lampG', () => new THREE.MeshStandardMaterial({
      color: 0xffc266, emissive: 0xff9c3a, emissiveIntensity: 1.6, roughness: 0.5
    }));
    const lantern = (x, y, z) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.17), lampFrameM);
      f.position.set(x, y, z);
      staticRoot.add(f);
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), lampGlowM);
      g.position.set(x, y - 0.01, z);
      staticRoot.add(g);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 4), lampFrameM);
      cap.position.set(x, y + 0.17, z);
      staticRoot.add(cap);
    };
    const lampPost = (x, z, y) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.5, 7), mat('wood2'));
      p.position.set(x, y + 1.25, z);
      p.castShadow = true;
      staticRoot.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), mat('wood2'));
      arm.position.set(x + 0.2, y + 2.42, z);
      staticRoot.add(arm);
      lantern(x + 0.42, y + 2.24, z);
    };
    lampPost(30.6, 19.9, 0);            // Fonte
    lampPost(-24.6, 6.2, 2.6);          // patamar da Escadaria
    lampPost(-3.2, -3.4, 2.6);          // Pátio
    lantern(-38.7, 3.1, 19.65);         // Portão (pilar norte)
    lantern(-38.7, 3.1, 25.35);         // Portão (pilar sul)
    lantern(-10.6, 2.5, 16.75);         // porta do Ferreiro
    lantern(-36.05, 4.35, -18.5);       // dentro da Mina (brilha no escuro)
    lantern(4.9, 4.9, 6.6);             // Beco

    // --- braseiros do Templo (tigela + brasas emissivas) ---
    for (const [bx2, bz2] of [[-6.5, -31.3], [6.5, -31.3]]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.28, 9), lampFrameM);
      bowl.position.set(bx2, 5.2 + 0.85, bz2);
      bowl.castShadow = true;
      staticRoot.add(bowl);
      for (const [lx, lz] of [[-0.12, 0], [0.1, 0.08], [0, -0.11]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5), lampFrameM);
        leg.position.set(bx2 + lx * 2.2, 5.2 + 0.45, bz2 + lz * 2.2);
        staticRoot.add(leg);
      }
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 6), lampGlowM);
      ember.position.set(bx2, 5.2 + 1.0, bz2);
      staticRoot.add(ember);
    }

    // --- poço com sarilho sobre a cisterna ---
    for (const px2 of [-1.05, 1.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), mat('wood2'));
      post.position.set(px2, 2.6 + 1.1, -6);
      post.castShadow = true;
      staticRoot.add(post);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 7), mat('wood2'));
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, 4.62, -6);
    staticRoot.add(beam);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 8), mat('wood'));
    bucket.position.set(0.3, 3.95, -6);
    staticRoot.add(bucket);
    {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.3, 4.6, -6), new THREE.Vector3(0.3, 4.06, -6)
      ]);
      liveRoot.add(new THREE.Line(g, ROPE));
    }

    // --- bandeirolas cruzando a rua (2 vãos) + varal de tecidos no Beco ---
    const buntColors = [0xd95350, 0xf2e3c8, 0x3fc8b4, 0xf0c060];
    function bunting(ax2, ay2, az2, bx2, by2, bz2) {
      const from = new THREE.Vector3(ax2, ay2, az2), to = new THREE.Vector3(bx2, by2, bz2);
      const pts = [];
      const buntG = new THREE.PlaneGeometry(0.28, 0.34);
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const p = from.clone().lerp(to, t);
        p.y -= Math.sin(t * Math.PI) * 0.6;
        pts.push(p.clone());
        if (i > 0 && i < 12) {
          const col = buntColors[i % 4];
          const pen = new THREE.Mesh(buntG.clone(), cmat('bunt' + col, () =>
            new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.9 })));
          pen.position.copy(p);
          pen.position.y -= 0.17;
          pen.rotation.y = Math.atan2(bx2 - ax2, bz2 - az2) + Math.PI / 2;
          staticRoot.add(pen);
        }
      }
      liveRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ROPE));
    }
    bunting(1, 3.25, 17.6, -2, 3.6, 28.9);      // arcada -> casa B
    bunting(14.5, 3.25, 17.6, 11, 3.7, 27.9);   // arcada -> casa C

    // varal de tecidos sobre o Beco (balança com o vento)
    {
      const clothCols = [0xf2e3c8, 0x8fb6a8, 0xc9714c];
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(2.75, 5.9, 4.6), new THREE.Vector3(5.25, 5.7, 4.2)
      ]);
      liveRoot.add(new THREE.Line(g, ROPE));
      clothCols.forEach((col, i) => {
        const pivot = new THREE.Group();
        const t = (i + 1) / 4;
        pivot.position.set(2.75 + 2.5 * t, 5.9 - 0.2 * t, 4.6 - 0.4 * t);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), cmat('cloth' + col, () =>
          new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 1 })));
        cloth.position.y = -0.4;
        cloth.castShadow = true;
        pivot.add(cloth);
        liveRoot.add(pivot);
        animated.push(tt => { pivot.rotation.x = Math.sin(tt * 1.6 + i * 1.4) * 0.12; });
      });
    }

    // --- carrinho de mão encostado na casa A ---
    {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 1.5), mat('wood'));
      bed.position.set(-30.28, 1.05, 31.5);
      bed.rotation.z = 1.18;
      staticRoot.add(bed);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10), mat('wood2'));
      wheel.rotation.z = Math.PI / 2 - 1.18;
      wheel.position.set(-30.55, 0.42, 30.9);
      staticRoot.add(wheel);
    }

    // --- buganvílias e trepadeiras ---
    const bougM = cmat('bougain', () => new THREE.MeshStandardMaterial({
      map: tex('bougain'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1
    }));
    const bplane = (w, h, x, y, z, ry) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bougM);
      p.position.set(x, y, z);
      p.rotation.y = ry;
      staticRoot.add(p);
    };
    bplane(2.2, 2.6, -9, 2.4, 28.94, Math.PI);        // casa B (rua)
    bplane(1.8, 2.6, -16.05, 3.6, 13.5, -Math.PI / 2); // lateral do Ferreiro
    bplane(2.0, 2.2, 8, 4.6, 9.06, 0);                 // casa do Beco (Vila)
    bplane(2.6, 2.2, 41.36, 4.4, -6, Math.PI / 2);     // trepadeira do Aqueduto
    bplane(2.2, 2.0, 41.36, 4.3, -12.5, Math.PI / 2);

    // --- capim seco ---
    const dryM = cmat('dry', () => new THREE.MeshStandardMaterial({
      map: tex('dryGrass'), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1
    }));
    const drySpots = [
      [-18, 37.5, 0], [12, 38.5, 0], [28, 37, 0], [-32, 33, 0], [-28.5, 18.6, 0], [20.5, 26.8, 0],
      [-10, -15.3, 2.6], [12, -14.6, 2.6], [-26, 3.4, 2.6], [24, -13.5, 2.6],
      [-38.5, -20, 5.2], [10, -41.5, 5.2], [30, -41, 5.2], [38, -22, 5.2], [36, 14.5, 0]
    ];
    for (const [gx, gz, gy] of drySpots) {
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.52), dryM);
        blade.position.set(gx + (i - 1) * 0.12, gy + 0.26, gz + (i % 2) * 0.1);
        blade.rotation.y = i * 1.07;
        staticRoot.add(blade);
      }
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
