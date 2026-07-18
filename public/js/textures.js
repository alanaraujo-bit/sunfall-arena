// ============================================================
// Texturas "hand-painted" geradas proceduralmente via canvas.
// Manchas suaves, pinceladas, AO falso nas bordas e contornos
// irregulares dão o aspecto de tinta pintada à mão.
// ============================================================
import * as THREE from 'three';

// RNG determinístico — todos os clientes veem a mesma pintura
let _s = 987654321;
function R() {
  _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0;
  return _s / 4294967296;
}
const rr = (a, b) => a + R() * (b - a);

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

export function tex(name, size) {
  const s = size || _texSize;
  const key = name + s;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(s);
  PAINTERS[name](ctx, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = _aniso;
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
