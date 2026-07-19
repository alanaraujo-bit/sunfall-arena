// ============================================================
// SUNFALL ARENA — Classes salvas (Create-a-Class)
// Armazenamento em localStorage, compartilhado entre a tela do
// Arsenal (armory.js, edita) e o jogo (main.js, lê pra entrar na
// partida e pro seletor de respawn).
// ============================================================
import { CLASS_SLOTS, defaultClasses } from '/shared/loadout.js';

const CLASSES_KEY = 'sf_classes';
const ACTIVE_KEY = 'sf_activeClass';
const OLD_LOADOUT_KEY = 'sf_loadout';   // formato antigo (loadout único) — migrado uma vez

export function loadClasses() {
  try {
    const raw = localStorage.getItem(CLASSES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === CLASS_SLOTS && arr.every(c => c && typeof c.primary === 'string')) {
        return arr;
      }
    }
  } catch { /* localStorage corrompido: recria abaixo */ }

  // primeira vez OU dado corrompido: migra o loadout único antigo (se
  // existir) pra Classe 1, o resto sai no padrão (FALCÃO-9)
  const classes = defaultClasses();
  try {
    const old = JSON.parse(localStorage.getItem(OLD_LOADOUT_KEY) || 'null');
    if (old && typeof old.primary === 'string') classes[0].primary = old.primary;
  } catch { /* ignore */ }
  saveClasses(classes);
  return classes;
}

export function saveClasses(classes) {
  try { localStorage.setItem(CLASSES_KEY, JSON.stringify(classes)); } catch { /* localStorage indisponível: segue só em memória */ }
}

export function getActiveIndex() {
  const raw = localStorage.getItem(ACTIVE_KEY);
  const i = raw === null ? 0 : (+raw | 0);
  return i >= 0 && i < CLASS_SLOTS ? i : 0;
}

export function setActiveIndex(i) {
  try { localStorage.setItem(ACTIVE_KEY, String(i)); } catch { /* ignore */ }
}

export function getActiveClass() {
  const classes = loadClasses();
  return classes[getActiveIndex()] || classes[0];
}
