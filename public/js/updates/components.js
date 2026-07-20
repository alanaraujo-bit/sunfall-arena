// ============================================================
// NOVIDADES — utilitários de interface compartilhados
// ============================================================

// Escapa texto para uso seguro em templates HTML
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// Cria um elemento a partir de um template HTML
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "2026-07-18" → "18 de julho de 2026"
export function fmtDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

// "2026-07-18" → "18/07/2026"
export function fmtDateShort(iso) {
  const [y, m, d] = String(iso).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Toast flutuante dentro da tela NOVIDADES
let toastTimer = null;
export function toast(message, ok = true) {
  let node = document.getElementById('up-toast');
  if (!node) {
    node = el(`<div id="up-toast"></div>`);
    document.querySelector('.updates')?.appendChild(node);
  }
  node.textContent = message;
  node.classList.toggle('err', !ok);
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

// Contador de caracteres ao vivo para inputs/textareas
export function attachCounter(input, counterNode, max) {
  const update = () => {
    counterNode.textContent = `${input.value.length}/${max}`;
    counterNode.classList.toggle('warn', input.value.length > max * 0.9);
  };
  input.addEventListener('input', update);
  update();
}
