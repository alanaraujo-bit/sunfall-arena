// ============================================================
// Texturas "hand-painted" geradas proceduralmente via canvas.
// Manchas suaves, pinceladas, AO falso nas bordas e contornos
// irregulares dão o aspecto de tinta pintada à mão.
// ============================================================
import * as THREE from 'three';

// RNG determinístico — todos os clientes veem a mesma pintura.
// Semente POR TEXTURA (nome+tamanho): o resultado não depende da ordem em
// que as texturas são pintadas (ex.: entrar no Ocaso antes do Cânion).
let _s = 987654321;
function R() {
  _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0;
  return _s / 4294967296;
}
const rr = (a, b) => a + R() * (b - a);
function seedFor(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h >>>= 0;
  return h || 987654321;
}

function hexA(hex, a) {
  const v = Math.round(a * 255).toString(16).padStart(2, '0');
  return hex + v;
}

function canvas(s) {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  return [c, c.getContext('2d')];
}

// Manchas radiais suaves — a base do look "pintado"
function blotches(ctx, s, n, colors, rMin, rMax, aMin, aMax) {
  for (let i = 0; i < n; i++) {
    const x = R() * s, y = R() * s, r = rr(rMin, rMax) * s;
    const col = colors[(R() * colors.length) | 0];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = rr(aMin, aMax);
    g.addColorStop(0, hexA(col, a));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Pinceladas finas diagonais
function strokes(ctx, s, n, color, alpha, ang = 0.7) {
  ctx.save();
  ctx.strokeStyle = hexA(color, alpha);
  for (let i = 0; i < n; i++) {
    const x = R() * s, y = R() * s, len = rr(0.06, 0.22) * s;
    const a = ang + rr(-0.3, 0.3);
    ctx.lineWidth = rr(1, 3.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function speckle(ctx, s, n, colors, size, alpha) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = hexA(colors[(R() * colors.length) | 0], rr(alpha * 0.5, alpha));
    const d = rr(size * 0.4, size);
    ctx.fillRect(R() * s, R() * s, d, d);
  }
}

// AO falso: escurece as bordas do tile
function edgeAO(ctx, s, k) {
  const w = s * 0.14;
  const sides = [
    [0, 0, w, s, w, 0], [s, 0, -w, s, s - w, 0],
    [0, 0, s, w, 0, w], [0, s, s, -w, 0, s - w]
  ];
  for (const [x, y, gw, gh] of sides) {
    let g;
    if (Math.abs(gw) < s) g = ctx.createLinearGradient(x, 0, x + gw, 0);
    else g = ctx.createLinearGradient(0, y, 0, y + gh);
    g.addColorStop(0, hexA('#2a1a10', k));
    g.addColorStop(1, hexA('#2a1a10', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
}

// Linha irregular (contorno "à mão")
function wobbly(ctx, x1, y1, x2, y2, seg, jit) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    ctx.lineTo(
      x1 + (x2 - x1) * t + rr(-jit, jit),
      y1 + (y2 - y1) * t + rr(-jit, jit)
    );
  }
  ctx.stroke();
}

// ---------------- Pintores ----------------
const PAINTERS = {
  sand(ctx, s) {
    ctx.fillStyle = '#dfb789'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 26, ['#f0d0a0', '#c69a6b', '#e8c090'], 0.08, 0.3, 0.1, 0.25);
    // ondulações de areia
    ctx.strokeStyle = hexA('#b98d5e', 0.12);
    for (let y = s * 0.06; y < s; y += s * 0.09) {
      ctx.lineWidth = rr(1.5, 3);
      wobbly(ctx, 0, y + rr(-8, 8), s, y + rr(-8, 8), 10, s * 0.012);
    }
    speckle(ctx, s, 130, ['#c09068', '#f2dcb4', '#a87c50'], 3, 0.35);
  },

  plaster(ctx, s) {
    ctx.fillStyle = '#efe0c4'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 22, ['#f8ecd4', '#d8c4a0', '#e4cfa8'], 0.1, 0.35, 0.12, 0.28);
    strokes(ctx, s, 40, '#c8b28c', 0.08);
    // faixa terracota na base (rodapé pintado)
    const bandY = s * 0.8;
    ctx.fillStyle = hexA('#c9714c', 0.9);
    ctx.beginPath();
    ctx.moveTo(0, s); ctx.lineTo(0, bandY);
    for (let x = 0; x <= s; x += s / 12) ctx.lineTo(x, bandY + rr(-4, 4));
    ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
    blotches(ctx, s, 8, ['#e08a60', '#a85838'], 0.05, 0.15, 0.15, 0.3);
    // rachaduras
    ctx.strokeStyle = hexA('#8a6a48', 0.3); ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++)
      wobbly(ctx, R() * s, R() * s * 0.5, R() * s, R() * s * 0.7 + s * 0.2, 7, s * 0.02);
    edgeAO(ctx, s, 0.18);
  },

  plaster2(ctx, s) {
    ctx.fillStyle = '#f2e6cc'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 20, ['#fbf2dc', '#dcc8a4'], 0.1, 0.3, 0.12, 0.25);
    strokes(ctx, s, 30, '#c8b28c', 0.07);
    edgeAO(ctx, s, 0.15);
  },

  stone(ctx, s) {
    ctx.fillStyle = '#857256'; ctx.fillRect(0, 0, s, s);
    const rows = 5, bh = s / rows;
    const tints = ['#c2b096', '#9c8a72', '#b8a68e', '#ab9878', '#c8b498'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (s / 6);
      const bw = s / 3;
      for (let cx = -bw; cx < s + bw; cx += bw) {
        const x = cx + off + rr(-3, 3), y = r * bh + rr(-2, 2);
        ctx.fillStyle = tints[(R() * tints.length) | 0];
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, bw - 6, bh - 6, 5);
        ctx.fill();
        // highlight superior + sombra inferior (volume pintado)
        ctx.strokeStyle = hexA('#e4d4b4', 0.5); ctx.lineWidth = 2;
        wobbly(ctx, x + 6, y + 6, x + bw - 8, y + 6, 5, 1.5);
        ctx.strokeStyle = hexA('#54452f', 0.5);
        wobbly(ctx, x + 6, y + bh - 7, x + bw - 8, y + bh - 7, 5, 1.5);
      }
    }
    blotches(ctx, s, 14, ['#d8c8a8', '#6e5c42'], 0.06, 0.2, 0.08, 0.18);
    edgeAO(ctx, s, 0.2);
  },

  stone2(ctx, s) {
    ctx.fillStyle = '#7c6e58'; ctx.fillRect(0, 0, s, s);
    const rows = 4, bh = s / rows;
    const tints = ['#b0a08c', '#948468', '#a89878'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (s / 5), bw = s / 2.5;
      for (let cx = -bw; cx < s + bw; cx += bw) {
        ctx.fillStyle = tints[(R() * tints.length) | 0];
        ctx.beginPath();
        ctx.roundRect(cx + off + 3, r * bh + 3, bw - 6, bh - 6, 6);
        ctx.fill();
      }
    }
    blotches(ctx, s, 16, ['#ccbc9c', '#5e5240'], 0.08, 0.22, 0.1, 0.2);
    edgeAO(ctx, s, 0.22);
  },

  wood(ctx, s) {
    const planks = 6, pw = s / planks;
    const tints = ['#a9713f', '#9a6536', '#b47a46', '#a06b3a'];
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = tints[(R() * tints.length) | 0];
      ctx.fillRect(p * pw, 0, pw, s);
      // veios
      ctx.strokeStyle = hexA('#7c4e28', 0.35);
      for (let v = 0; v < 3; v++) {
        ctx.lineWidth = rr(1, 2.2);
        wobbly(ctx, p * pw + rr(4, pw - 4), 0, p * pw + rr(4, pw - 4), s, 8, 3);
      }
      // frestas + highlight
      ctx.fillStyle = hexA('#5c3a20', 0.8);
      ctx.fillRect(p * pw, 0, 3, s);
      ctx.fillStyle = hexA('#d4a06a', 0.4);
      ctx.fillRect(p * pw + 3, 0, 2, s);
      // nós
      if (R() < 0.5) {
        const kx = p * pw + pw / 2, ky = R() * s;
        const g = ctx.createRadialGradient(kx, ky, 1, kx, ky, 8);
        g.addColorStop(0, '#5c3a20'); g.addColorStop(1, hexA('#5c3a20', 0));
        ctx.fillStyle = g; ctx.fillRect(kx - 9, ky - 9, 18, 18);
      }
    }
    blotches(ctx, s, 10, ['#c89058', '#6e4426'], 0.08, 0.2, 0.08, 0.16);
    edgeAO(ctx, s, 0.18);
  },

  wood2(ctx, s) {
    const planks = 5, pw = s / planks;
    const tints = ['#7c5433', '#6e4a2d', '#86603c'];
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = tints[(R() * tints.length) | 0];
      ctx.fillRect(p * pw, 0, pw, s);
      ctx.strokeStyle = hexA('#4a3018', 0.4);
      ctx.lineWidth = 1.6;
      wobbly(ctx, p * pw + pw / 2 + rr(-6, 6), 0, p * pw + pw / 2 + rr(-6, 6), s, 8, 3);
      ctx.fillStyle = hexA('#3e2814', 0.8);
      ctx.fillRect(p * pw, 0, 3, s);
    }
    blotches(ctx, s, 10, ['#a07648', '#4a3018'], 0.08, 0.2, 0.1, 0.18);
    edgeAO(ctx, s, 0.2);
  },

  crate(ctx, s) {
    // fundo: tábuas horizontais
    const planks = 5, ph = s / planks;
    const tints = ['#b47a46', '#a06b3a', '#ba824e'];
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = tints[(R() * tints.length) | 0];
      ctx.fillRect(0, p * ph, s, ph);
      ctx.strokeStyle = hexA('#7c4e28', 0.35); ctx.lineWidth = 1.5;
      wobbly(ctx, 0, p * ph + ph / 2, s, p * ph + ph / 2 + rr(-4, 4), 8, 2.5);
      ctx.fillStyle = hexA('#5c3a20', 0.7);
      ctx.fillRect(0, p * ph, s, 3);
    }
    // moldura
    const fw = s * 0.12;
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(0, 0, s, fw); ctx.fillRect(0, s - fw, s, fw);
    ctx.fillRect(0, 0, fw, s); ctx.fillRect(s - fw, 0, fw, s);
    ctx.strokeStyle = hexA('#d4a06a', 0.5); ctx.lineWidth = 2;
    ctx.strokeRect(fw * 0.3, fw * 0.3, s - fw * 0.6, s - fw * 0.6);
    ctx.strokeStyle = hexA('#4a3018', 0.6);
    ctx.strokeRect(fw, fw, s - fw * 2, s - fw * 2);
    // marca estampada (sol teal)
    ctx.save();
    ctx.translate(s / 2, s / 2); ctx.rotate(rr(-0.15, 0.15));
    ctx.strokeStyle = hexA('#2fa896', 0.55); ctx.lineWidth = s * 0.02;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2);
      ctx.lineTo(Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26);
      ctx.stroke();
    }
    ctx.restore();
    // pregos
    for (const [nx, ny] of [[fw / 2, fw / 2], [s - fw / 2, fw / 2], [fw / 2, s - fw / 2], [s - fw / 2, s - fw / 2]]) {
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.arc(nx, ny, 4, 0, 7); ctx.fill();
      ctx.fillStyle = hexA('#e8c890', 0.8);
      ctx.beginPath(); ctx.arc(nx - 1.3, ny - 1.3, 1.6, 0, 7); ctx.fill();
    }
    edgeAO(ctx, s, 0.16);
  },

  barrel(ctx, s) {
    // aduelas verticais
    const staves = 8, sw = s / staves;
    const tints = ['#8a5a34', '#7c4e2c', '#96643a'];
    for (let p = 0; p < staves; p++) {
      ctx.fillStyle = tints[(R() * tints.length) | 0];
      ctx.fillRect(p * sw, 0, sw, s);
      ctx.fillStyle = hexA('#4a3018', 0.7);
      ctx.fillRect(p * sw, 0, 2.5, s);
    }
    // aros de metal
    for (const y of [s * 0.18, s * 0.78]) {
      ctx.fillStyle = '#46525c';
      ctx.fillRect(0, y, s, s * 0.09);
      ctx.fillStyle = hexA('#8fa4b4', 0.6);
      ctx.fillRect(0, y + 2, s, 3);
      ctx.fillStyle = hexA('#20282e', 0.6);
      ctx.fillRect(0, y + s * 0.09 - 3, s, 3);
    }
    blotches(ctx, s, 10, ['#b08050', '#3e2814'], 0.06, 0.16, 0.1, 0.2);
  },

  awning(ctx, s) {
    const stripes = 8, sw = s / stripes;
    for (let p = 0; p < stripes; p++) {
      ctx.fillStyle = p % 2 ? '#f2e3c8' : '#d95350';
      ctx.fillRect(p * sw - 2, 0, sw + 4, s);
      // borda irregular entre listras
      ctx.strokeStyle = hexA(p % 2 ? '#d95350' : '#f2e3c8', 0.5);
      ctx.lineWidth = 2;
      wobbly(ctx, p * sw, 0, p * sw, s, 10, 2.5);
    }
    // sombreado de tecido (topo mais claro)
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, hexA('#fff4dc', 0.25));
    g.addColorStop(0.6, hexA('#fff4dc', 0));
    g.addColorStop(1, hexA('#6a3020', 0.25));
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    strokes(ctx, s, 25, '#a04038', 0.06, 0);
  },

  rock(ctx, s) {
    ctx.fillStyle = '#9b8b78'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 34, ['#b5a48c', '#7c6c5c', '#8f7f6e', '#c4b298'], 0.08, 0.3, 0.12, 0.3);
    strokes(ctx, s, 45, '#5e5240', 0.1);
    strokes(ctx, s, 25, '#d0c0a4', 0.09, -0.6);
    speckle(ctx, s, 60, ['#6a5c4a', '#c8b89c'], 3, 0.3);
  },

  rug(ctx, s) {
    ctx.fillStyle = '#a03c3c'; ctx.fillRect(0, 0, s, s);
    // borda creme com losangos teal
    const bw = s * 0.14;
    ctx.fillStyle = '#f2e3c8';
    ctx.fillRect(bw * 0.5, bw * 0.5, s - bw, bw * 0.8);
    ctx.fillRect(bw * 0.5, s - bw * 1.3, s - bw, bw * 0.8);
    ctx.fillStyle = '#3fa89a';
    for (let x = bw; x < s - bw; x += bw * 1.2) {
      for (const y of [bw * 0.9, s - bw * 0.9]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-bw * 0.22, -bw * 0.22, bw * 0.44, bw * 0.44);
        ctx.restore();
      }
    }
    // medalhão central
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2e3c8'; ctx.fillRect(-s * 0.12, -s * 0.12, s * 0.24, s * 0.24);
    ctx.fillStyle = '#3fa89a'; ctx.fillRect(-s * 0.07, -s * 0.07, s * 0.14, s * 0.14);
    ctx.restore();
    strokes(ctx, s, 60, '#5c1e1e', 0.1, 0);
    edgeAO(ctx, s, 0.2);
  },

  banner(ctx, s) {
    ctx.fillStyle = '#2fa896'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 12, ['#4cc4b0', '#1e8274'], 0.1, 0.3, 0.12, 0.25);
    // barra do mastro
    ctx.fillStyle = '#6e4a2d'; ctx.fillRect(0, 0, s, s * 0.07);
    // emblema: sol creme
    ctx.fillStyle = '#f2e3c8';
    ctx.beginPath(); ctx.arc(s / 2, s * 0.45, s * 0.16, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f2e3c8'; ctx.lineWidth = s * 0.03;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * s * 0.2, s * 0.45 + Math.sin(a) * s * 0.2);
      ctx.lineTo(s / 2 + Math.cos(a) * s * 0.26, s * 0.45 + Math.sin(a) * s * 0.26);
      ctx.stroke();
    }
    ctx.fillStyle = '#c9714c';
    ctx.beginPath(); ctx.arc(s / 2, s * 0.45, s * 0.07, 0, 7); ctx.fill();
    // dobras verticais do tecido
    for (let x = s * 0.15; x < s; x += s * 0.2) {
      const g = ctx.createLinearGradient(x, 0, x + s * 0.08, 0);
      g.addColorStop(0, hexA('#0e5248', 0.2)); g.addColorStop(1, hexA('#0e5248', 0));
      ctx.fillStyle = g; ctx.fillRect(x, 0, s * 0.08, s);
    }
  },

  window(ctx, s) {
    // moldura de madeira
    ctx.fillStyle = '#6e4a2d'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = hexA('#4a3018', 0.6); ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, s - 6, s - 6);
    const fw = s * 0.12;
    // vidro noturno com reflexo pintado
    ctx.fillStyle = '#223245';
    ctx.fillRect(fw, fw, s - fw * 2, s - fw * 2);
    ctx.fillStyle = hexA('#31485e', 0.9);
    ctx.beginPath();
    ctx.moveTo(fw, s - fw); ctx.lineTo(s - fw, fw);
    ctx.lineTo(s - fw, s - fw); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA('#cfe6f0', 0.5); ctx.lineWidth = s * 0.03;
    wobbly(ctx, fw * 1.6, s - fw * 1.8, s - fw * 1.8, fw * 1.6, 4, 2);
    // cruzeta
    ctx.fillStyle = '#6e4a2d';
    ctx.fillRect(s / 2 - fw * 0.25, fw, fw * 0.5, s - fw * 2);
    ctx.fillRect(fw, s / 2 - fw * 0.25, s - fw * 2, fw * 0.5);
    edgeAO(ctx, s, 0.25);
  },

  door(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    // porta em arco
    ctx.beginPath();
    ctx.moveTo(s * 0.08, s);
    ctx.lineTo(s * 0.08, s * 0.38);
    ctx.arc(s / 2, s * 0.38, s * 0.42, Math.PI, 0);
    ctx.lineTo(s * 0.92, s);
    ctx.closePath();
    ctx.save(); ctx.clip();
    const planks = 5, pw = s / planks;
    const tints = ['#7c5433', '#6e4a2d', '#86603c'];
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = tints[p % 3];
      ctx.fillRect(p * pw, 0, pw, s);
      ctx.fillStyle = hexA('#3e2814', 0.8);
      ctx.fillRect(p * pw, 0, 3, s);
    }
    blotches(ctx, s, 8, ['#a07648', '#4a3018'], 0.1, 0.25, 0.1, 0.2);
    // ferragens
    ctx.fillStyle = '#46525c';
    ctx.fillRect(s * 0.1, s * 0.5, s * 0.35, s * 0.05);
    ctx.fillRect(s * 0.55, s * 0.5, s * 0.35, s * 0.05);
    ctx.beginPath(); ctx.arc(s * 0.75, s * 0.62, s * 0.045, 0, 7); ctx.fill();
    ctx.restore();
    // contorno pintado
    ctx.strokeStyle = hexA('#3a2a1a', 0.9); ctx.lineWidth = s * 0.035;
    ctx.stroke();
  },

  leaf(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    // folha de palmeira alongada (horizontal)
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, '#3e7e3e'); g.addColorStop(0.5, '#5aa84e'); g.addColorStop(1, '#7cc86a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, s / 2);
    ctx.quadraticCurveTo(s * 0.5, s * 0.08, s, s * 0.42);
    ctx.quadraticCurveTo(s * 0.5, s * 0.5, s, s * 0.58);
    ctx.quadraticCurveTo(s * 0.5, s * 0.92, 0, s / 2);
    ctx.fill();
    // recortes da folha
    ctx.strokeStyle = hexA('#2e5e2e', 0.6); ctx.lineWidth = 3;
    for (let i = 1; i < 9; i++) {
      const x = (i / 9) * s;
      ctx.beginPath();
      ctx.moveTo(x, s / 2);
      ctx.lineTo(x + s * 0.06, s / 2 + (i % 2 ? -1 : 1) * s * 0.3);
      ctx.stroke();
    }
    ctx.strokeStyle = hexA('#2e5e2e', 0.9); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
  },

  grass(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 10; i++) {
      const x = rr(s * 0.12, s * 0.88), h = rr(s * 0.45, s * 0.9);
      const lean = rr(-s * 0.14, s * 0.14);
      const g = ctx.createLinearGradient(0, s, 0, s - h);
      g.addColorStop(0, '#6aa04e'); g.addColorStop(1, '#c8e088');
      ctx.strokeStyle = g; ctx.lineWidth = rr(9, 15); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, s);
      ctx.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h);
      ctx.stroke();
    }
  },

  metal(ctx, s) {
    ctx.fillStyle = '#4c5a66'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 18, ['#66788a', '#38444e', '#5a6c7c'], 0.08, 0.25, 0.12, 0.25);
    strokes(ctx, s, 30, '#8fa4b4', 0.1, -0.4);
    strokes(ctx, s, 20, '#242e36', 0.14, 0.5);
  },

  awningEdge(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    // babado com barras alternadas (para a borda do toldo)
    const n = 8, w = s / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#f2e3c8' : '#d95350';
      ctx.beginPath();
      ctx.moveTo(i * w, 0);
      ctx.lineTo((i + 1) * w, 0);
      ctx.lineTo((i + 1) * w, s * 0.5);
      ctx.arc(i * w + w / 2, s * 0.5, w / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, hexA('#6a3020', 0.2)); g.addColorStop(0.4, hexA('#6a3020', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  },

  plaza(ctx, s) {
    ctx.fillStyle = '#a08668'; ctx.fillRect(0, 0, s, s);
    const n = 4, tw = s / n;
    const tints = ['#cbb89a', '#bca888', '#c4b090', '#d2c0a2'];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = tints[(R() * tints.length) | 0];
      ctx.beginPath();
      ctx.roundRect(x * tw + 3 + rr(-1, 1), y * tw + 3 + rr(-1, 1), tw - 6, tw - 6, 6);
      ctx.fill();
    }
    blotches(ctx, s, 12, ['#e0d0b0', '#8a7458'], 0.06, 0.2, 0.08, 0.18);
    speckle(ctx, s, 40, ['#8a7458'], 3, 0.25);
  },

  // ============ MATERIAIS V2 (Ocaso) ============

  // arenito aparelhado: silhares em fiadas desencontradas, junta escura
  // funda, quina lascada, mancha de tempo — juntas escuras viram sulcos
  // no normal map derivado.
  sandstone(ctx, s) {
    ctx.fillStyle = '#63492e'; ctx.fillRect(0, 0, s, s);   // argamassa (funda)
    const rows = 4, bh = s / rows;
    const tints = ['#d8bd92', '#c4a273', '#cfae80', '#bd9a6b', '#d3b489'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (s / 6);
      const bw = s / 3.2;
      for (let cx = -bw; cx < s + bw; cx += bw) {
        const x = cx + off + rr(-2, 2), y = r * bh + rr(-1.5, 1.5);
        const col = tints[(R() * tints.length) | 0];
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, bw - 6, bh - 6, 4);
        ctx.fill();
        // topo iluminado + base sombreada (volume)
        ctx.strokeStyle = hexA('#f0e0b8', 0.55); ctx.lineWidth = 2;
        wobbly(ctx, x + 6, y + 6, x + bw - 8, y + 6, 5, 1.2);
        ctx.strokeStyle = hexA('#4e3a22', 0.55);
        wobbly(ctx, x + 6, y + bh - 7, x + bw - 8, y + bh - 7, 5, 1.2);
        // quina lascada de vez em quando
        if (R() < 0.35) {
          const chipX = R() < 0.5 ? x + 3 : x + bw - 12, chipY = R() < 0.5 ? y + 3 : y + bh - 12;
          ctx.fillStyle = hexA('#ecd9ae', 0.8);
          ctx.beginPath();
          ctx.moveTo(chipX, chipY + 9); ctx.lineTo(chipX + rr(6, 10), chipY); ctx.lineTo(chipX + 9, chipY + 9);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    blotches(ctx, s, 12, ['#e8d5a8', '#5e492e', '#8a6b44'], 0.05, 0.16, 0.08, 0.16);
    speckle(ctx, s, 50, ['#6a5236', '#e8d8b0'], 2.5, 0.3);
  },

  // reboco envelhecido: creme manchado com REMENDOS caídos expondo tijolo
  // (estilo HL2), rachaduras e rodapé terracota gasto na base.
  plasterOld(ctx, s) {
    ctx.fillStyle = '#e9dabc'; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 20, ['#f4e8cc', '#d4c09a', '#dcc9a4'], 0.1, 0.32, 0.12, 0.26);
    strokes(ctx, s, 35, '#c2ac84', 0.08);
    // remendos de reboco caído com tijolo exposto (mais perto da base)
    const patches = 3 + (R() * 2 | 0);
    for (let p = 0; p < patches; p++) {
      const px = R() * s, py = s * rr(0.35, 0.85), prx = s * rr(0.06, 0.14), pry = prx * rr(0.55, 0.9);
      ctx.save();
      ctx.beginPath();
      // contorno irregular do buraco
      for (let a = 0; a <= 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const rad = (a % 2 ? 1 : rr(0.75, 1)) * (ang < Math.PI ? prx : prx * 0.9);
        const xx = px + Math.cos(ang) * rad, yy = py + Math.sin(ang) * pry / prx * rad;
        a === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.closePath();
      // sombra do reboco em volta do buraco
      ctx.strokeStyle = hexA('#8a7050', 0.7); ctx.lineWidth = 4; ctx.stroke();
      ctx.clip();
      ctx.fillStyle = '#8e5a3a';
      ctx.fillRect(px - prx * 1.2, py - pry * 1.3, prx * 2.4, pry * 2.6);
      // tijolinhos dentro do remendo
      const bh2 = Math.max(7, s * 0.028);
      for (let ry = py - pry * 1.3, rowi = 0; ry < py + pry * 1.3; ry += bh2, rowi++) {
        ctx.fillStyle = hexA(rowi % 2 ? '#a5654a' : '#b0714e', 0.95);
        for (let rx = px - prx * 1.3 + (rowi % 2) * bh2; rx < px + prx * 1.3; rx += bh2 * 2.1) {
          ctx.fillRect(rx, ry, bh2 * 1.9, bh2 - 2);
        }
      }
      ctx.restore();
    }
    // rachaduras saindo dos remendos
    ctx.strokeStyle = hexA('#8a6a48', 0.4); ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++)
      wobbly(ctx, R() * s, R() * s * 0.6, R() * s, R() * s * 0.5 + s * 0.3, 7, s * 0.02);
    // rodapé terracota com topo gasto
    const bandY = s * 0.82;
    ctx.fillStyle = hexA('#c9714c', 0.92);
    ctx.beginPath();
    ctx.moveTo(0, s); ctx.lineTo(0, bandY);
    for (let x = 0; x <= s; x += s / 14) ctx.lineTo(x, bandY + rr(-5, 5));
    ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
    blotches(ctx, s, 7, ['#e08a60', '#9c4f32'], 0.04, 0.12, 0.15, 0.3);
    edgeAO(ctx, s, 0.15);
  },

  // telha de barro capa-e-canal: colunas com gradiente de curvatura,
  // fiadas com sombra de encaixe, variação de queima e poeira.
  roofTile(ctx, s) {
    const cols = 6, cw = s / cols, rows = 5, rh = s / rows;
    for (let c = 0; c < cols; c++) {
      const hot = rr(-14, 14);
      const g = ctx.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      g.addColorStop(0, `rgb(${110 + hot},${58 + hot * 0.5},${38})`);
      g.addColorStop(0.5, `rgb(${188 + hot},${106 + hot * 0.6},${66})`);
      g.addColorStop(1, `rgb(${104 + hot},${54 + hot * 0.5},${36})`);
      ctx.fillStyle = g;
      ctx.fillRect(c * cw, 0, cw, s);
    }
    // fiadas: sombra do encaixe + leve highlight abaixo
    for (let r = 1; r <= rows; r++) {
      const y = r * rh;
      ctx.fillStyle = hexA('#4e2a18', 0.55);
      ctx.fillRect(0, y - 5, s, 5);
      ctx.fillStyle = hexA('#e8a670', 0.35);
      ctx.fillRect(0, y, s, 3);
    }
    // telha trincada/deslocada ocasional
    for (let i = 0; i < 3; i++) {
      const c = (R() * cols) | 0, r = (R() * rows) | 0;
      ctx.fillStyle = hexA(R() < 0.5 ? '#8a4c30' : '#c98a58', 0.5);
      ctx.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh * 0.4);
    }
    speckle(ctx, s, 60, ['#e8c9a0', '#5e3520'], 2.5, 0.3);
    blotches(ctx, s, 8, ['#d8956a', '#6e3d26'], 0.06, 0.18, 0.08, 0.18);
  },

  // calçamento: LAJÕES irregulares claros (flagstones), junta fina escura,
  // leve rotação por pedra e polimento de tráfego.
  cobble(ctx, s) {
    ctx.fillStyle = '#8a7458'; ctx.fillRect(0, 0, s, s);   // junta
    const n = 4, cs = s / n;
    const tints = ['#cbb794', '#bda884', '#d3c1a0', '#b19c7a', '#c6b28e'];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx2 = x * cs + cs / 2 + rr(-2.5, 2.5), cy2 = y * cs + cs / 2 + rr(-2.5, 2.5);
      const w2 = cs * rr(0.82, 0.94), h2 = cs * rr(0.8, 0.92);
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(rr(-0.06, 0.06));
      ctx.fillStyle = tints[(R() * tints.length) | 0];
      ctx.beginPath();
      ctx.roundRect(-w2 / 2, -h2 / 2, w2, h2, cs * 0.14);
      ctx.fill();
      // canto superior sutilmente iluminado, base sombreada (bem discreto)
      ctx.strokeStyle = hexA('#e8dcc0', 0.28); ctx.lineWidth = 2;
      wobbly(ctx, -w2 / 2 + 4, -h2 / 2 + 4, w2 / 2 - 4, -h2 / 2 + 4, 4, 1);
      ctx.strokeStyle = hexA('#5e4c34', 0.3);
      wobbly(ctx, -w2 / 2 + 4, h2 / 2 - 4, w2 / 2 - 4, h2 / 2 - 4, 4, 1);
      ctx.restore();
    }
    // polimento de tráfego (centro mais claro)
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.7);
    g.addColorStop(0, hexA('#e8d8b4', 0.14));
    g.addColorStop(1, hexA('#e8d8b4', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, 10, ['#dcc9a4', '#7e6a4e'], 0.06, 0.18, 0.06, 0.14);
    speckle(ctx, s, 40, ['#6e5c42', '#dccaa6'], 2.5, 0.25);
  },

  // pedra clara do Templo: silhares grandes, junta fina, friso entalhado
  // na fiada do meio.
  templeStone(ctx, s) {
    ctx.fillStyle = '#a89272'; ctx.fillRect(0, 0, s, s);
    const rows = 3, bh = s / rows;
    const tints = ['#eee1c2', '#e6d6b4', '#f2e7ca', '#e9dcbc'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (s / 4), bw = s / 2;
      for (let cx = -bw; cx < s + bw; cx += bw) {
        ctx.fillStyle = tints[(R() * tints.length) | 0];
        ctx.beginPath();
        ctx.roundRect(cx + off + 2, r * bh + 2, bw - 4, bh - 4, 3);
        ctx.fill();
      }
    }
    // friso entalhado (sulco duplo) na fiada central
    const fy = s * 0.5;
    ctx.strokeStyle = hexA('#8a744f', 0.6); ctx.lineWidth = 3;
    wobbly(ctx, 0, fy - s * 0.04, s, fy - s * 0.04, 8, 1);
    wobbly(ctx, 0, fy + s * 0.04, s, fy + s * 0.04, 8, 1);
    ctx.strokeStyle = hexA('#f6ecd2', 0.5); ctx.lineWidth = 1.6;
    wobbly(ctx, 0, fy - s * 0.04 + 3, s, fy - s * 0.04 + 3, 8, 1);
    blotches(ctx, s, 10, ['#f6ecd2', '#9c8862'], 0.06, 0.2, 0.06, 0.14);
    speckle(ctx, s, 30, ['#9c8862'], 2, 0.2);
  },

  // ============ DECALQUES (alfa) ============

  // areia acumulada na base de paredes (metade de baixo, borda ondulada)
  sandDrift(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, s * 0.3, 0, s);
    g.addColorStop(0, hexA('#dfb789', 0));
    g.addColorStop(0.5, hexA('#dfb789', 0.75));
    g.addColorStop(1, hexA('#d8ad7c', 0.95));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(0, s * 0.62);
    for (let x = 0; x <= s; x += s / 9) ctx.lineTo(x, s * 0.62 + rr(-s * 0.16, s * 0.1));
    ctx.lineTo(s, s); ctx.closePath(); ctx.fill();
    speckle(ctx, s, 40, ['#c09068', '#f2dcb4'], 2.5, 0.4);
  },

  // escorrido de umidade (listras verticais que somem)
  dampStreak(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 7; i++) {
      const x = rr(s * 0.08, s * 0.92), w = rr(3, 10), len = rr(s * 0.4, s * 0.95);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, hexA('#3e3222', rr(0.3, 0.5)));
      g.addColorStop(1, hexA('#3e3222', 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, 0, w, len);
    }
  },

  // fuligem (mancha radial escura irregular)
  soot(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 5; i++) {
      const bx = s / 2 + rr(-s * 0.14, s * 0.14), by = s * rr(0.3, 0.6);
      const br = s * rr(0.2, 0.38);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, hexA('#1c140c', 0.5));
      g.addColorStop(1, hexA('#1c140c', 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  },

  // buganvília: folhagem escura com explosão de flores coral/magenta (alfa)
  bougain(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    // galhos finos
    ctx.strokeStyle = hexA('#5a4630', 0.8);
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = rr(2, 4);
      wobbly(ctx, s * rr(0.3, 0.7), s, s * rr(0.1, 0.9), s * rr(0.05, 0.4), 6, s * 0.04);
    }
    // folhas (densas — o alphaTest come as bordas suaves)
    for (let i = 0; i < 120; i++) {
      const x = rr(s * 0.05, s * 0.95), y = rr(s * 0.03, s * 0.92);
      ctx.fillStyle = ['#44603a', '#54744a', '#3a5232', '#4c6a40'][(R() * 4) | 0];
      ctx.beginPath();
      ctx.ellipse(x, y, rr(9, 17), rr(6, 11), rr(0, 3.1), 0, 7);
      ctx.fill();
    }
    // flores (aglomeradas em cachos densos)
    for (let c = 0; c < 9; c++) {
      const cx2 = rr(s * 0.12, s * 0.88), cy2 = rr(s * 0.08, s * 0.8);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = ['#d4527c', '#e06a8a', '#c94868', '#e8828c'][(R() * 4) | 0];
        ctx.beginPath();
        ctx.arc(cx2 + rr(-s * 0.08, s * 0.08), cy2 + rr(-s * 0.07, s * 0.07), rr(5, 9), 0, 7);
        ctx.fill();
      }
    }
  },

  // capim seco do deserto (dourado, alfa)
  dryGrass(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 12; i++) {
      const x = rr(s * 0.1, s * 0.9), h = rr(s * 0.4, s * 0.85);
      const lean = rr(-s * 0.16, s * 0.16);
      const g = ctx.createLinearGradient(0, s, 0, s - h);
      g.addColorStop(0, '#9a8248'); g.addColorStop(1, '#e6d29a');
      ctx.strokeStyle = g; ctx.lineWidth = rr(7, 13); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, s);
      ctx.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h);
      ctx.stroke();
    }
  },

  // trilha de carroça (faixa horizontal gasta, com falhas)
  wearLine(ctx, s) {
    ctx.clearRect(0, 0, s, s);
    for (let seg = 0; seg < 6; seg++) {
      const x0 = (seg / 6) * s, x1 = ((seg + 1) / 6) * s;
      if (R() < 0.18) continue;   // falha na trilha
      const g = ctx.createLinearGradient(0, s * 0.25, 0, s * 0.75);
      g.addColorStop(0, hexA('#4a3a26', 0));
      g.addColorStop(0.5, hexA('#4a3a26', rr(0.3, 0.45)));
      g.addColorStop(1, hexA('#4a3a26', 0));
      ctx.fillStyle = g;
      ctx.fillRect(x0, s * 0.25 + rr(-6, 6), x1 - x0, s * 0.5);
    }
  }
};

// ---------------- API ----------------
const cache = new Map();

// Quality settings (set by main.js via setTexQuality)
let _texSize = 512;
let _aniso = 8;

export function setTexQuality(quality) {
  if (quality === 'low') { _texSize = 256; _aniso = 1; }
  else if (quality === 'med') { _texSize = 384; _aniso = 4; }
  else { _texSize = 512; _aniso = 8; }
}

// canvases pintados por chave — fonte do texNormal/texRough (o mapa de
// relevo tem que casar PIXEL A PIXEL com a pintura de cor)
const canvases = new Map();

export function tex(name, size) {
  const s = size || _texSize;
  const key = name + s;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(s);
  _s = seedFor(key);
  PAINTERS[name](ctx, s);
  canvases.set(key, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = _aniso;
  cache.set(key, t);
  return t;
}

// Luminância (0..1) do canvas pintado, ponderada pelo alfa
function lumOf(key, s) {
  const src = canvases.get(key);
  if (!src) return null;
  const img = src.getContext('2d').getImageData(0, 0, s, s).data;
  const lum = new Float32Array(s * s);
  for (let i = 0; i < s * s; i++) {
    lum[i] = ((img[i * 4] * 0.299 + img[i * 4 + 1] * 0.587 + img[i * 4 + 2] * 0.114) / 255) * (img[i * 4 + 3] / 255);
  }
  return lum;
}

// ---- MATERIAIS V2: normal map derivado da própria pintura (Sobel na
// luminância — juntas escuras viram sulcos, pedras claras viram relevo).
// Devolve null em qualidade baixa (economia de GPU fraca).
export function texNormal(name, strength = 0.8, size) {
  const s = size || _texSize;
  if (_texSize <= 256) return null;
  const key = 'nrm:' + name + s + ':' + strength;
  if (cache.has(key)) return cache.get(key);
  tex(name, s);                      // garante o canvas de cor pintado
  const lum = lumOf(name + s, s);
  if (!lum) return null;
  const [c, ctx] = canvas(s);
  const out = ctx.createImageData(s, s);
  const k = strength * 5;
  const at = (x, y) => lum[((y + s) % s) * s + ((x + s) % s)];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const nx = -dx * k, ny = dy * k;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * s + x) * 4;
      out.data[o] = (nx * inv * 0.5 + 0.5) * 255;
      out.data[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out.data[o + 2] = (inv * 0.5 + 0.5) * 255;
      out.data[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);   // linear (sem SRGB): mapa de dados
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = _aniso;
  cache.set(key, t);
  return t;
}

// Roughness map da mesma pintura: áreas claras (pedra polida/gasta) ficam
// um pouco menos ásperas. `base` é o nível médio, `amp` a variação.
export function texRough(name, base = 0.9, amp = 0.25, size) {
  const s = size || _texSize;
  if (_texSize <= 256) return null;
  const key = 'rgh:' + name + s + ':' + base + ':' + amp;
  if (cache.has(key)) return cache.get(key);
  tex(name, s);
  const lum = lumOf(name + s, s);
  if (!lum) return null;
  const [c, ctx] = canvas(s);
  const out = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = Math.max(0, Math.min(1, base + (0.5 - lum[i]) * amp)) * 255;
    const o = i * 4;
    out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
    out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);   // linear
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

// Sprite radial suave (partículas / clarão de tiro)
export function spriteTex(inner = '#fff8e0', outer = '#ffb040') {
  const key = 'sprite' + inner + outer;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, hexA(outer, 0.8));
  g.addColorStop(1, hexA(outer, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

// Puff de fumaça: alfa branco suave e IRREGULAR (vários blobs sobrepostos +
// núcleo denso). O material tinge a cor e controla a opacidade — muitos
// destes sobrepostos formam a nuvem volumétrica. Alfa premultiplicado no
// branco para os puffs somarem densidade sem "quadrado" visível.
export function smokeTex() {
  if (cache.has('smoke')) return cache.get('smoke');
  const s = 128;
  const [c, ctx] = canvas(s);
  ctx.clearRect(0, 0, s, s);
  // borda irregular: blobs suaves deslocados
  for (let i = 0; i < 6; i++) {
    const bx = s * 0.5 + (R() - 0.5) * s * 0.3;
    const by = s * 0.5 + (R() - 0.5) * s * 0.3;
    const br = s * rr(0.26, 0.42);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  // núcleo denso central
  const g2 = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.5);
  g2.addColorStop(0, 'rgba(255,255,255,0.72)');
  g2.addColorStop(0.5, 'rgba(255,255,255,0.32)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('smoke', t);
  return t;
}

// Céu de fim de tarde pintado (gradiente + sol + nuvens)
export function skyTex() {
  if (cache.has('sky')) return cache.get('sky');
  const [c, ctx] = canvas(512);
  const s = 512;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#3e78ac');
  g.addColorStop(0.42, '#7fb2cf');
  g.addColorStop(0.55, '#f4d7a4');
  g.addColorStop(0.62, '#eec89a');
  g.addColorStop(1, '#e0b88c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  // sol
  const sx = s * 0.68, sy = s * 0.5;
  let rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 140);
  rg.addColorStop(0, '#fff6dc');
  rg.addColorStop(0.25, hexA('#ffe8b0', 0.9));
  rg.addColorStop(1, hexA('#ffd890', 0));
  ctx.fillStyle = rg; ctx.fillRect(sx - 150, sy - 150, 300, 300);
  // nuvens pintadas (elipses empilhadas)
  for (let i = 0; i < 9; i++) {
    const cx = R() * s, cy = rr(0.18, 0.46) * s, cw = rr(60, 170), ch = cw * 0.28;
    ctx.fillStyle = hexA('#fdf4e0', rr(0.25, 0.55));
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(cx + rr(-cw * 0.4, cw * 0.4), cy + rr(-ch * 0.4, ch * 0.4),
        cw * rr(0.4, 0.7), ch * rr(0.5, 0.9), 0, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = hexA('#d8a878', 0.18);
    ctx.beginPath();
    ctx.ellipse(cx, cy + ch * 0.5, cw * 0.6, ch * 0.4, 0, 0, 7);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('sky', t);
  return t;
}

// Céu do Ocaso (Fase 6 — "rig do poente"). Função PRÓPRIA (não reaproveita
// skyTex): o Cânion usa aquele céu como está desde a Fase 1 e não deve
// mudar — o mapa 1 fica congelado como referência. Mais dramático que o
// original: sol mais baixo e mais a oeste, nuvens com base AQUECIDA (luz
// rasante batendo por baixo, não só um brilho parelho) e uma faixa de bruma
// quente perto do horizonte, coerente com a regra do mapa (sol baixo a
// oeste = bússola natural do jogador).
export function skyTexOcaso() {
  if (cache.has('skyOcaso')) return cache.get('skyOcaso');
  const [c, ctx] = canvas(512);
  const s = 512;
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#2f5f8e');
  g.addColorStop(0.38, '#6fa0c4');
  g.addColorStop(0.5, '#e8c088');
  g.addColorStop(0.58, '#f2b878');
  g.addColorStop(0.68, '#e8a274');
  g.addColorStop(1, '#c8825c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);

  // faixa de bruma quente rente ao horizonte (poeira em suspensão no fim de tarde)
  const hazeY = s * 0.6;
  const haze = ctx.createLinearGradient(0, hazeY - s * 0.1, 0, hazeY + s * 0.06);
  haze.addColorStop(0, hexA('#f4c894', 0));
  haze.addColorStop(0.6, hexA('#f4c894', 0.35));
  haze.addColorStop(1, hexA('#e8a878', 0.5));
  ctx.fillStyle = haze; ctx.fillRect(0, hazeY - s * 0.1, s, s * 0.16);

  // sol baixo, bem a oeste (a "bússola" do mapa)
  const sx = s * 0.16, sy = s * 0.56;
  let rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 170);
  rg.addColorStop(0, '#fffaf0');
  rg.addColorStop(0.22, hexA('#ffe4ac', 0.95));
  rg.addColorStop(0.55, hexA('#ffc888', 0.4));
  rg.addColorStop(1, hexA('#ffb070', 0));
  ctx.fillStyle = rg; ctx.fillRect(sx - 180, sy - 180, 360, 360);

  // nuvens com base aquecida: sombra fria no topo, brilho quente por baixo
  // (luz rasante do poente batendo na barriga da nuvem)
  for (let i = 0; i < 10; i++) {
    const cx = R() * s, cy = rr(0.14, 0.48) * s, cw = rr(55, 165), ch = cw * 0.3;
    ctx.fillStyle = hexA('#e8dcc4', rr(0.2, 0.4));
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(cx + rr(-cw * 0.4, cw * 0.4), cy + rr(-ch * 0.45, ch * 0.15),
        cw * rr(0.4, 0.7), ch * rr(0.45, 0.75), 0, 0, 7);
      ctx.fill();
    }
    // barriga quente — só na metade inferior, mais forte perto do horizonte
    const warmth = 0.2 + (cy / s) * 0.5;
    ctx.fillStyle = hexA('#ffb878', rr(0.25, 0.5) * warmth + 0.1);
    ctx.beginPath();
    ctx.ellipse(cx, cy + ch * 0.55, cw * 0.62, ch * 0.42, 0, 0, 7);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set('skyOcaso', t);
  return t;
}
