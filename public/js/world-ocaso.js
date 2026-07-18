// ============================================================
// OCASO (mapa 2) — builder visual.
// >>> FASE 2: BLOCKOUT <<< : todos os colisores do layout com
// materiais placeholder, geometria fundida por material (mesma
// técnica do Cânion, ~8 draw calls). A arquitetura de verdade
// (vãos, arcos, telhados, kit modular, materiais v2) entra nas
// Fases 3–6.
//
// Contrato: mesmo retorno de buildWorld do Cânion —
// { group, sun, barrels, update(t), dispose() }.
// ============================================================
import * as THREE from 'three';
import { BARREL_W, BARREL_H } from '/shared/mapdata.js';
import { tex, skyTex } from './textures.js';
import { mergeStatics, makeBarrel, makeBarrelWreck } from './world.js';

export function buildOcasoWorld(scene, map, opts = {}) {
  const animated = [];
  const root = new THREE.Group();        // resultado final (meshes fundidos + vivos)
  const staticRoot = new THREE.Group();  // temporário: vira meshes fundidos
  const liveRoot = new THREE.Group();    // céu, luzes, barris, cristal
  root.add(liveRoot);
  const mats = new Map();

  function mat(name, extra = {}) {
    const key = name + JSON.stringify(extra);
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: tex(name), roughness: 0.95, metalness: 0, ...extra });
      mats.set(key, m);
    }
    return m;
  }

  // Céu + névoa do poente
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(130, 24, 14),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })
  );
  sky.frustumCulled = false;
  liveRoot.add(sky);
  scene.fog = new THREE.Fog(0xe8bd8c, 70, 260);

  // Iluminação: sol BAIXO NO OESTE (regra do mapa — sombras apontam pro leste)
  liveRoot.add(new THREE.HemisphereLight(0xb8cede, 0xd8a065, 0.8));
  liveRoot.add(new THREE.AmbientLight(0xffdfb8, 0.22));
  const sun = new THREE.DirectionalLight(0xffc98a, 2.5);
  sun.position.set(-55, 24, 6);
  sun.castShadow = false; // ligado via applyGraphics conforme a config
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -58; sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 58; sun.shadow.camera.bottom = -58;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0008;
  liveRoot.add(sun);

  // Chão de areia
  const groundT = tex('sand').clone();
  groundT.needsUpdate = true;
  groundT.repeat.set(20, 20);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ map: groundT, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  staticRoot.add(ground);

  // Sólidos do blockout: caixas com material pelo tipo (tudo fundido depois)
  const matFor = s => {
    switch (s.mat) {
      case 'cliff': return mat('rock');
      case 'stone2': return mat('stone2');
      case 'wood': return mat('wood');
      case 'wood2': return mat('wood2');
      case 'plaster': return mat('plaster');
      case 'crate': return mat('crate');
      default: return mat('stone');
    }
  };
  for (const s of map.SOLIDS) {
    // barris ficam FORA do merge (cada um vira destroço individualmente)
    if (s.mat === 'barrel') continue;
    const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
    // repeat de textura embutido nas UVs (mesma técnica do Cânion)
    const uv = geo.attributes.uv;
    const rx = Math.max(1, Math.max(s.w, s.d) / 3), ry = Math.max(1, s.h / 3);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
    const m = new THREE.Mesh(geo, matFor(s));
    m.position.set(s.x, s.y, s.z);
    m.castShadow = m.receiveShadow = true;
    staticRoot.add(m);
  }

  // Barris explosivos — individuais: alternam entre corpo e destroço
  const barrelDims = { w: BARREL_W, h: BARREL_H, d: BARREL_W };
  const barrels = map.BARRELS.map(b => {
    const intact = makeBarrel(barrelDims);
    const wreck = makeBarrelWreck(barrelDims);
    wreck.position.y = -BARREL_H / 2;   // destroço assume origem no chão
    wreck.visible = false;
    const grp = new THREE.Group();
    grp.position.set(b.x, (b.y || 0) + BARREL_H / 2, b.z);
    grp.add(intact, wreck);
    liveRoot.add(grp);
    return { id: b.id, group: grp, intact, wreck, alive: true };
  });

  // Farol do mapa: cristal teal sobre o plinto do Altar (orientação norte)
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshStandardMaterial({ color: 0x3fc8b4, emissive: 0x35e0c8, emissiveIntensity: 1.2, roughness: 0.3 })
  );
  crystal.position.set(0, 9.4, -35);
  liveRoot.add(crystal);
  if (opts.decor !== false) {
    const crystalLight = new THREE.PointLight(0x35e0c8, 30, 16, 2);
    crystalLight.position.set(0, 9.4, -35);
    liveRoot.add(crystalLight);
  }
  animated.push(t => {
    crystal.rotation.y = t * 0.7;
    crystal.position.y = 9.4 + Math.sin(t * 1.4) * 0.15;
  });

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
