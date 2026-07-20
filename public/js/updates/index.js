// ============================================================
// NOVIDADES — controlador do hub (Central da Comunidade)
// Orquestra as três abas (Patch Notes / Sugestões / Reportar
// Bug), o estado social compartilhado (reações + favoritos) e o
// selo de não lidas exibido na navegação do lobby.
// ============================================================
import { PATCH_DATA } from '../../patchnotes/data.js';
import * as api from './api.js';
import { getReadSet, getLocalFavs, setLocalFavs } from './store.js';
import { initNotesPage } from './patchnotes.view.js';
import { initIdeasPage } from './feedback.view.js';
import { initBugsPage } from './bugreport.view.js';

// Quantas notas ainda não foram lidas — usado pelo selo "NOVO" da nav
// (funciona antes mesmo do hub ser aberto pela primeira vez).
export function unreadCount() {
  const read = getReadSet();
  return PATCH_DATA.releases.filter(r => !read.has(r.id)).length;
}

export function initUpdatesHub({ getAuth, onUnreadChange }) {
  api.bindAuth(getAuth);

  // estado social compartilhado: contadores públicos + o que EU marquei.
  // Nasce do cache local (favoritos) e é corrigido pelo servidor ao abrir.
  const social = {
    reactions: {},
    mine: {},
    favorites: new Set(getLocalFavs())
  };

  const ctx = {
    data: PATCH_DATA,
    social,
    getAuth,
    onUnreadChange,
    persistFavs: () => setLocalFavs([...social.favorites])
  };

  const pages = {
    notes: initNotesPage(document.getElementById('up-page-notes'), ctx),
    ideas: initIdeasPage(document.getElementById('up-page-ideas'), ctx),
    bugs: initBugsPage(document.getElementById('up-page-bugs'), ctx)
  };

  // ---- abas internas ----
  const tabs = document.querySelectorAll('#up-tabs .up-tab');
  const pageEls = document.querySelectorAll('.up-page');
  let current = 'notes';
  function switchTab(name) {
    current = name;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.uptab === name));
    pageEls.forEach(p => p.classList.toggle('hidden', p.dataset.uppage !== name));
    if (name === 'bugs') pages.bugs.onShow();
    if (name === 'ideas') pages.ideas.refreshAuth();
  }
  tabs.forEach(t => { t.onclick = () => switchTab(t.dataset.uptab); });

  // ---- estado social do servidor (uma chamada, todas as versões) ----
  let socialRequested = false;
  async function loadSocial() {
    try {
      const s = await api.fetchSocial();
      social.reactions = s.reactions || {};
      social.mine = s.mine || {};
      social.favorites = new Set(s.favorites || []);
      ctx.persistFavs();
      pages.notes.refreshSocial();
    } catch {
      // sem rede: contadores ficam zerados e favoritos seguem o cache local
    }
  }

  function open() {
    if (!socialRequested) { socialRequested = true; loadSocial(); }
    pages.notes.render();
    switchTab(current);
    onUnreadChange?.();
  }

  function openArticle(id) {
    switchTab('notes');
    pages.notes.openArticle(String(id));
  }

  return { open, openArticle, unread: unreadCount };
}
