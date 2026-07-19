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
// Modelo 3D detalhado — FALCÃO-9 (fuzil de assalto real do jogo)
// Comprimento no eixo X (cano p/ -X, coronha p/ +X). Estilizado
// e legível, com receiver, trilho, luneta ponto-vermelho, cano
// com quebra-chamas, carregador curvo, punho, coronha e acentos.
// ------------------------------------------------------------
function buildFalcao9() {
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

// ------------------------------------------------------------
// Modelo 3D detalhado — FERRÃO-SR (fuzil de precisão real do jogo)
// Cano longo, luneta grande com sino de objetiva, ferrolho lateral,
// coronha com apoio de face, bipé recolhido e acentos âmbar.
// ------------------------------------------------------------
function buildFerraoSR() {
  const g = new THREE.Group();

  const gun = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x7f868c, roughness: 0.4, metalness: 0.92 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc2cace, roughness: 0.24, metalness: 0.96 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.74, metalness: 0.12 });
  const poly2 = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.6, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.85, metalness: 0.1 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xf0b34c, roughness: 0.4, metalness: 0.55, emissive: 0x3a2606, emissiveIntensity: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c22, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.5 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ---- receiver comprido ----
  add(rbox(0.66, 0.12, 0.1), gun, 0.02, 0, 0);
  add(rbox(0.4, 0.06, 0.092), poly2, 0.2, 0.085, 0);           // trilho traseiro elevado
  add(rbox(0.5, 0.05, 0.05), dark, -0.02, 0.12, 0);            // base da luneta
  add(new THREE.BoxGeometry(0.3, 0.02, 0.004), amber, 0.04, -0.028, 0.051);
  add(new THREE.BoxGeometry(0.3, 0.02, 0.004), amber, 0.04, -0.028, -0.051);

  // ---- cano longo + freio de boca ----
  add(cyl(0.024, 0.024, 0.66, 18), steel, -0.62, 0.01, 0, 0, 0, Math.PI / 2);
  add(cyl(0.03, 0.03, 0.03, 16), poly2, -0.42, 0.01, 0, 0, 0, Math.PI / 2);   // bloco de gás
  add(cyl(0.036, 0.032, 0.12, 18), dark, -0.98, 0.01, 0, 0, 0, Math.PI / 2);  // freio de boca
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.08, 0.008, 0.05), gun, -0.96 + i * 0.03, 0.03, 0);

  // ---- luneta grande ----
  const sc = new THREE.Group(); sc.position.set(0.06, 0.2, 0); g.add(sc);
  const sadd = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); sc.add(m); return m;
  };
  sadd(rbox(0.024, 0.07, 0.05), dark, -0.12, -0.04, 0);        // anel dianteiro
  sadd(rbox(0.024, 0.07, 0.05), dark, 0.12, -0.04, 0);         // anel traseiro
  sadd(cyl(0.05, 0.05, 0.28, 22), poly, 0, 0.01, 0, 0, 0, Math.PI / 2);       // tubo principal
  sadd(cyl(0.066, 0.055, 0.1, 22), poly2, -0.2, 0.01, 0, 0, 0, Math.PI / 2);  // sino da objetiva
  sadd(cyl(0.06, 0.06, 0.008, 22), glass, -0.253, 0.01, 0, 0, 0, Math.PI / 2); // lente objetiva
  sadd(cyl(0.046, 0.046, 0.05, 20), dark, 0.17, 0.01, 0, 0, 0, Math.PI / 2);   // ocular
  sadd(cyl(0.048, 0.048, 0.006, 20), glass, 0.197, 0.01, 0, 0, 0, Math.PI / 2);
  sadd(cyl(0.02, 0.02, 0.05, 12), amber, 0, 0.06, 0);                          // torre de elevação
  sadd(cyl(0.02, 0.02, 0.05, 12), poly2, 0, 0.01, 0.06, Math.PI / 2, 0, 0);    // torre lateral

  // ---- ferrolho lateral ----
  add(cyl(0.014, 0.014, 0.07, 10), steel, 0.24, 0.03, 0.07, 0, 0, Math.PI / 2.4);
  add(new THREE.SphereGeometry(0.022, 12, 10), steel, 0.285, 0.055, 0.09);

  // ---- carregador curto ----
  add(rbox(0.09, 0.13, 0.07), poly, -0.06, -0.13, 0, 0, 0, 0.06);
  add(new THREE.BoxGeometry(0.008, 0.12, 0.05), amber, -0.1, -0.13, 0);

  // ---- punho + guarda-gatilho ----
  add(rbox(0.08, 0.16, 0.075), poly, 0.16, -0.13, 0, 0, 0, -0.28);
  add(new THREE.TorusGeometry(0.05, 0.011, 8, 16, Math.PI), dark, 0.06, -0.11, 0, Math.PI, 0, 0);
  add(new THREE.BoxGeometry(0.014, 0.04, 0.02), steel, 0.06, -0.1, 0);

  // ---- coronha com apoio de face ----
  add(rbox(0.28, 0.09, 0.08), poly, 0.42, -0.01, 0);          // corpo
  add(rbox(0.16, 0.05, 0.075), poly2, 0.42, 0.075, 0);        // apoio de face
  add(rbox(0.04, 0.19, 0.09), dark, 0.57, -0.02, 0);          // apoio de ombro
  add(rbox(0.12, 0.05, 0.075), poly2, 0.44, -0.09, 0, 0, 0, 0.35); // apoio inferior
  add(new THREE.BoxGeometry(0.02, 0.02, 0.004), amber, 0.42, 0.05, 0.041);

  // ---- bipé recolhido sob o cano ----
  for (const sgn of [1, -1]) {
    add(cyl(0.008, 0.008, 0.22, 8), dark, -0.6, -0.06, sgn * 0.03, 0.5, 0, 0);
  }

  // centraliza e ajusta o tamanho na cena (arma mais longa)
  g.position.x = 0.08;
  g.scale.setScalar(1.02);
  return g;
}

// ------------------------------------------------------------
// Modelo 3D detalhado — BRECHA-12 (escopeta bomba real do jogo)
// Silhueta curta e grossa (calibre 12): cano largo, tubo de munição
// visível sob o cano, bomba (fore-end) estriada, coronha curta e
// porta de ejeção lateral. Acentos vermelhos (identidade própria,
// diferente do teal/âmbar das outras duas).
// ------------------------------------------------------------
function buildBrecha12() {
  const g = new THREE.Group();

  const gun = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x83898f, roughness: 0.46, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4bcc2, roughness: 0.3, metalness: 0.92 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x22201d, roughness: 0.76, metalness: 0.1 });
  const wood = new THREE.MeshStandardMaterial({ map: tex('wood2'), color: 0x8a5a34, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.85, metalness: 0.1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd95350, roughness: 0.4, metalness: 0.5, emissive: 0x3a0e0c, emissiveIntensity: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc79a4a, roughness: 0.35, metalness: 0.8 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ---- receiver curto e largo ----
  add(rbox(0.46, 0.16, 0.13), gun, 0.06, 0, 0);
  add(rbox(0.14, 0.09, 0.12), poly, -0.14, 0.01, 0);            // bloco frontal (onde o cano entra)
  add(new THREE.BoxGeometry(0.014, 0.09, 0.006), dark, 0.06, 0.01, 0.066);    // porta de ejeção
  add(new THREE.BoxGeometry(0.3, 0.02, 0.005), red, 0.08, -0.05, 0.067);
  add(new THREE.BoxGeometry(0.3, 0.02, 0.005), red, 0.08, -0.05, -0.067);

  // ---- cano largo + tubo de munição ----
  add(cyl(0.038, 0.038, 0.42, 18), steel, -0.42, 0.05, 0, 0, 0, Math.PI / 2);
  add(cyl(0.041, 0.038, 0.02, 18), dark, -0.63, 0.05, 0, 0, 0, Math.PI / 2);      // boca
  add(new THREE.SphereGeometry(0.012, 8, 8), red, -0.635, 0.05, 0);               // massa de mira (bead)
  add(cyl(0.024, 0.024, 0.5, 14), gun, -0.36, -0.01, 0, 0, 0, Math.PI / 2);        // tubo de munição
  add(cyl(0.027, 0.027, 0.03, 14), dark, -0.6, -0.01, 0, 0, 0, Math.PI / 2);       // tampa do tubo

  // ---- bomba / fore-end estriado ----
  const pump = new THREE.Group(); pump.position.set(-0.28, -0.01, 0); g.add(pump);
  const padd = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); pump.add(m); return m;
  };
  padd(rbox(0.2, 0.09, 0.09), wood, 0, 0, 0);
  for (let i = 0; i < 7; i++) padd(new THREE.BoxGeometry(0.012, 0.096, 0.096), poly, -0.08 + i * 0.026, 0, 0);

  // ---- carregador/tubo interno + parafusos ----
  add(rbox(0.05, 0.05, 0.1), brass, -0.1, -0.09, 0);

  // ---- punho + guarda-gatilho ----
  add(rbox(0.085, 0.15, 0.075), poly, 0.16, -0.12, 0, 0, 0, -0.3);
  add(new THREE.TorusGeometry(0.048, 0.011, 8, 16, Math.PI), dark, 0.06, -0.1, 0, Math.PI, 0, 0);
  add(new THREE.BoxGeometry(0.014, 0.038, 0.02), steel, 0.06, -0.09, 0);

  // ---- coronha curta ----
  add(rbox(0.26, 0.1, 0.09), wood, 0.4, -0.01, 0);
  add(rbox(0.035, 0.2, 0.1), dark, 0.53, -0.01, 0);              // apoio de ombro
  add(new THREE.BoxGeometry(0.02, 0.02, 0.005), red, 0.4, 0.05, 0.046);

  // ---- parafusos ----
  for (const [px, py] of [[0.02, 0.04], [0.14, 0.04]]) {
    add(cyl(0.008, 0.008, 0.135, 8), steel, px, py, 0, Math.PI / 2, 0, 0);
  }

  g.position.x = 0.1;
  g.scale.setScalar(1.1);
  return g;
}

// ------------------------------------------------------------
// Modelo 3D detalhado — SENTINELA-DR (fuzil tático real do jogo)
// Meio-termo visual entre o FALCÃO e a FERRÃO: corpo alongado,
// ação semiautomática sem ferrolho exposto, luneta MÉDIA (bem mais
// curta que a da FERRÃO) e coronha ajustável. Acentos azuis —
// identidade própria, diferente do teal/âmbar/vermelho das outras três.
// ------------------------------------------------------------
function buildSentinelaDR() {
  const g = new THREE.Group();

  const gun = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x84898f, roughness: 0.42, metalness: 0.88 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8c0c6, roughness: 0.26, metalness: 0.94 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x1f242a, roughness: 0.73, metalness: 0.14 });
  const poly2 = new THREE.MeshStandardMaterial({ color: 0x2d333a, roughness: 0.6, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121519, roughness: 0.85, metalness: 0.1 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x5c9ce8, roughness: 0.4, metalness: 0.5, emissive: 0x14335c, emissiveIntensity: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1620, roughness: 0.1, metalness: 0.45, transparent: true, opacity: 0.55 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ---- receiver alongado ----
  add(rbox(0.64, 0.13, 0.1), gun, 0.02, 0, 0);
  add(rbox(0.44, 0.06, 0.092), poly2, 0.2, 0.08, 0);            // trilho traseiro elevado
  add(new THREE.BoxGeometry(0.3, 0.02, 0.004), blue, 0.06, -0.03, 0.051);
  add(new THREE.BoxGeometry(0.3, 0.02, 0.004), blue, 0.06, -0.03, -0.051);
  add(cyl(0.014, 0.014, 0.045, 12), steel, 0.24, 0.1, 0.055, Math.PI / 2, 0, 0);   // manopla de rearme

  // ---- cano médio + freio de boca curto ----
  add(cyl(0.024, 0.024, 0.44, 18), steel, -0.66, 0.015, 0, 0, 0, Math.PI / 2);
  add(cyl(0.03, 0.027, 0.08, 16), dark, -0.9, 0.015, 0, 0, 0, Math.PI / 2);        // freio de boca
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.06, 0.008, 0.045), gun, -0.885 + i * 0.024, 0.033, 0);
  add(cyl(0.03, 0.03, 0.025, 16), poly2, -0.44, 0.015, 0, 0, 0, Math.PI / 2);      // bloco de gás

  // ---- luneta MÉDIA — bem mais curta que a da FERRÃO ----
  const sc = new THREE.Group(); sc.position.set(0.06, 0.19, 0); g.add(sc);
  const sadd = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); sc.add(m); return m;
  };
  sadd(rbox(0.02, 0.06, 0.045), dark, -0.075, -0.03, 0);
  sadd(rbox(0.02, 0.06, 0.045), dark, 0.075, -0.03, 0);
  sadd(cyl(0.042, 0.042, 0.17, 20), poly, 0, 0.008, 0, 0, 0, Math.PI / 2);         // tubo curto
  sadd(cyl(0.05, 0.045, 0.05, 20), poly2, -0.11, 0.008, 0, 0, 0, Math.PI / 2);     // sino objetiva pequeno
  sadd(cyl(0.048, 0.048, 0.006, 20), glass, -0.134, 0.008, 0, 0, 0, Math.PI / 2);
  sadd(cyl(0.038, 0.038, 0.03, 20), dark, 0.1, 0.008, 0, 0, 0, Math.PI / 2);       // ocular
  sadd(cyl(0.04, 0.04, 0.006, 20), glass, 0.115, 0.008, 0, 0, 0, Math.PI / 2);
  sadd(cyl(0.016, 0.016, 0.04, 12), blue, 0, 0.05, 0);                            // torre de elevação

  // ---- guarda-mão + carregador ----
  add(rbox(0.4, 0.09, 0.085), poly, -0.42, -0.005, 0);
  add(new THREE.BoxGeometry(0.02, 0.02, 0.004), blue, -0.42, -0.005, 0.044);
  add(rbox(0.1, 0.15, 0.075), poly, -0.08, -0.14, 0, 0, 0, 0.05);
  add(new THREE.BoxGeometry(0.008, 0.13, 0.05), blue, -0.12, -0.14, 0);

  // ---- punho + guarda-gatilho ----
  add(rbox(0.085, 0.16, 0.075), poly, 0.15, -0.13, 0, 0, 0, -0.3);
  add(new THREE.TorusGeometry(0.05, 0.011, 8, 16, Math.PI), dark, 0.04, -0.11, 0, Math.PI, 0, 0);
  add(new THREE.BoxGeometry(0.014, 0.04, 0.02), steel, 0.04, -0.1, 0);

  // ---- coronha ajustável ----
  add(cyl(0.02, 0.02, 0.15, 12), poly2, 0.38, 0.01, 0, 0, 0, Math.PI / 2);
  add(rbox(0.05, 0.14, 0.08), poly, 0.47, -0.01, 0);
  add(rbox(0.03, 0.16, 0.084), dark, 0.5, -0.01, 0);
  add(new THREE.BoxGeometry(0.02, 0.02, 0.004), blue, 0.47, 0.05, 0.041);

  g.position.x = 0.1;
  g.scale.setScalar(1.08);
  return g;
}

// ------------------------------------------------------------
// Modelo 3D detalhado — VESPA-C1 (submetralhadora real do jogo)
// A menor e mais compacta arma do arsenal: corpo curto, carregador
// reto grande, coronha tubular retrátil (2 hastes, sem madeira) e
// cano quase sem projeção. Acentos laranja — identidade "leve e
// agressiva", nada a ver com o peso visual das outras três.
// ------------------------------------------------------------
function buildVespaC1() {
  const g = new THREE.Group();

  const gun = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x808689, roughness: 0.44, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4bcc2, roughness: 0.3, metalness: 0.9 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x232729, roughness: 0.72, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x131515, roughness: 0.85, metalness: 0.1 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xf0844c, roughness: 0.4, metalness: 0.5, emissive: 0x4a2408, emissiveIntensity: 0.6 });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ---- receiver curto e compacto ----
  add(rbox(0.34, 0.13, 0.11), gun, 0.05, 0, 0);
  add(new THREE.BoxGeometry(0.2, 0.02, 0.004), orange, 0.05, -0.035, 0.056);
  add(new THREE.BoxGeometry(0.2, 0.02, 0.004), orange, 0.05, -0.035, -0.056);
  add(cyl(0.014, 0.014, 0.05, 10), steel, 0.14, 0.075, 0.06, Math.PI / 2, 0, 0);   // manopla de rearme

  // ---- cano curto + boca ----
  add(cyl(0.02, 0.02, 0.16, 14), steel, -0.24, 0.01, 0, 0, 0, Math.PI / 2);
  add(cyl(0.026, 0.023, 0.05, 14), dark, -0.335, 0.01, 0, 0, 0, Math.PI / 2);
  add(rbox(0.16, 0.1, 0.1), poly, -0.1, -0.01, 0);                                 // guarda-mão curto

  // ---- carregador reto e grande (marca registrada da VESPA) ----
  const mag = new THREE.Group(); mag.position.set(-0.02, -0.2, 0); g.add(mag);
  const madd = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; mag.add(m); return m; };
  madd(rbox(0.075, 0.28, 0.09), poly, 0, 0, 0, 0.03);
  madd(new THREE.BoxGeometry(0.01, 0.24, 0.05), orange, -0.045, 0.01, 0);
  madd(rbox(0.07, 0.03, 0.086), dark, 0.006, -0.15, 0);

  // ---- punho + guarda-gatilho ----
  add(rbox(0.08, 0.13, 0.07), poly, 0.12, -0.11, 0, 0, 0, -0.26);
  add(new THREE.TorusGeometry(0.045, 0.01, 8, 16, Math.PI), dark, 0.04, -0.09, 0, Math.PI, 0, 0);
  add(new THREE.BoxGeometry(0.012, 0.03, 0.018), steel, 0.04, -0.08, 0);

  // ---- coronha tubular retrátil (2 hastes finas, sem madeira) ----
  for (const sz of [0.022, -0.022]) {
    add(cyl(0.008, 0.008, 0.24, 8), steel, 0.24, 0.01, sz, 0, 0, Math.PI / 2);
  }
  add(rbox(0.07, 0.11, 0.025), dark, 0.36, 0.01, 0);          // placa de ombro
  add(new THREE.BoxGeometry(0.02, 0.02, 0.004), orange, 0.36, 0.06, 0.014);

  // ---- miras minimalistas ----
  add(new THREE.BoxGeometry(0.01, 0.03, 0.01), steel, -0.16, 0.075, 0);
  add(rbox(0.03, 0.03, 0.025), steel, 0.02, 0.075, 0);

  g.position.x = 0.14;
  g.scale.setScalar(1.2);   // compensa o corpo curto — mesma presença visual na vitrine
  return g;
}

// ------------------------------------------------------------
// Modelo 3D detalhado — MURALHA-M (metralhadora real do jogo)
// A arma mais volumosa e pesada do arsenal: cano espesso com
// blindagem perfurada, caixa de munição retangular (100 tiros),
// bipé estendido e alça de transporte. Acentos verdes — identidade
// "industrial/robusta", nada a ver com a leveza da VESPA.
// ------------------------------------------------------------
function buildMuralhaM() {
  const g = new THREE.Group();

  const gun = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x767c80, roughness: 0.46, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8b0b4, roughness: 0.3, metalness: 0.9 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x1e2320, roughness: 0.72, metalness: 0.16 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111412, roughness: 0.85, metalness: 0.12 });
  const wood = new THREE.MeshStandardMaterial({ map: tex('wood2'), color: 0x5c4a30, roughness: 0.75 });
  const green = new THREE.MeshStandardMaterial({ color: 0x8ac850, roughness: 0.42, metalness: 0.5, emissive: 0x1e3a0c, emissiveIntensity: 0.6 });
  const shieldMat = new THREE.MeshStandardMaterial({ map: tex('metal'), color: 0x24292a, roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ---- receiver grande ----
  add(rbox(0.62, 0.15, 0.12), gun, 0.02, 0, 0);
  add(new THREE.BoxGeometry(0.36, 0.022, 0.005), green, 0.06, -0.04, 0.061);
  add(new THREE.BoxGeometry(0.36, 0.022, 0.005), green, 0.06, -0.04, -0.061);
  add(new THREE.TorusGeometry(0.05, 0.007, 6, 16), steel, -0.02, 0.11, 0, Math.PI / 2, 0, 0);   // alça de transporte

  // ---- cano grosso + blindagem perfurada (heat shield) ----
  add(cyl(0.028, 0.028, 0.42, 16), steel, -0.7, 0.02, 0, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.042, 0.042, 0.36, 16, 1, true), shieldMat, -0.66, 0.02, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    add(cyl(0.009, 0.009, 0.05, 8), dark, -0.5 - i * 0.06, 0.02, 0, 0, 0, 0).rotation.z = Math.PI / 2;
  }
  add(cyl(0.034, 0.03, 0.04, 16), dark, -0.92, 0.02, 0, 0, 0, Math.PI / 2);                      // boca

  // ---- bipé estendido sob o cano ----
  for (const sgn of [1, -1]) {
    add(cyl(0.009, 0.009, 0.26, 8), steel, -0.52, -0.13, sgn * 0.14, 0.6 * sgn, 0, 0);
    add(cyl(0.014, 0.014, 0.03, 8), dark, -0.52, -0.245, sgn * 0.25);   // pé do bipé
  }
  add(cyl(0.032, 0.032, 0.02, 12), dark, -0.52, 0.02, 0, 0, 0, Math.PI / 2);                     // dobradiça do bipé

  // ---- caixa de munição (100 tiros) — bem maior que qualquer carregador ----
  const box = new THREE.Group(); box.position.set(-0.05, -0.19, 0); g.add(box);
  const badd = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); box.add(m); return m; };
  badd(rbox(0.16, 0.16, 0.13), poly, 0, 0, 0);
  badd(new THREE.BoxGeometry(0.02, 0.13, 0.008), green, -0.09, 0.01, 0);
  badd(rbox(0.05, 0.03, 0.05), dark, 0.05, 0.09, 0);      // guia da correia até o receiver

  // ---- punho + guarda-gatilho ----
  add(rbox(0.09, 0.16, 0.08), poly, 0.16, -0.13, 0, 0, 0, -0.28);
  add(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), dark, 0.06, -0.11, 0, Math.PI, 0, 0);
  add(new THREE.BoxGeometry(0.014, 0.04, 0.02), steel, 0.06, -0.1, 0);

  // ---- guarda-mão + coronha ----
  add(rbox(0.24, 0.09, 0.085), wood, -0.28, -0.02, 0);
  add(rbox(0.07, 0.11, 0.24), wood, 0.42, -0.01, 0);
  add(rbox(0.035, 0.19, 0.09), dark, 0.55, -0.02, 0);      // apoio de ombro

  g.position.x = 0.16;
  g.scale.setScalar(1.1);
  return g;
}

const MODEL_BUILDERS = {
  falcao: buildFalcao9, ferrao: buildFerraoSR, brecha: buildBrecha12,
  sentinela: buildSentinelaDR, vespa: buildVespaC1, muralha: buildMuralhaM
};

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
  // luzes quentes (pôr do sol) com um contorno teal — identidade do jogo
  const key = new THREE.DirectionalLight(0xffe6bf, 2.7); key.position.set(2, 3, 2.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.9); fill.position.set(-3, 0.5, 1.5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x6fe6d4, 2.0); rim.position.set(-1.5, 2, -3); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffe8cf, 0.28));

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
    state.baseDist = key === 'ferrao' ? 3.45 : 3.0;   // sniper é mais longa
    state.yaw = -0.5; state.pitch = 0.12; state.dist = state.baseDist; state.idle = 0;
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
  try { return { primary: 'falcao', secondary: null, ...JSON.parse(localStorage.getItem(LOADOUT_KEY) || '{}') }; }
  catch { return { primary: 'falcao', secondary: null }; }
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
  let selectedId = 'falcao';
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
      viewer.state.yaw = -0.5; viewer.state.pitch = 0.12;
      viewer.state.dist = viewer.state.baseDist || 3.0; viewer.state.idle = 0;
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
      // ?armory=<id> abre direto numa arma; senão, na primária equipada
      const deep = new URLSearchParams(location.search).get('armory');
      const startId = deep && byId(deep) ? deep
        : (loadout.primary && byId(loadout.primary) ? loadout.primary : 'falcao');
      select(startId);
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
