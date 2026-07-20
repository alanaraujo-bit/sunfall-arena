// ============================================================
// NOVIDADES — aba PATCH NOTES
// Feed de cards (avançados = artigo, básicos = compactos), leitor
// em tela cheia, linha do tempo de versões, busca, filtros,
// fixados, favoritos, reações com contador e compartilhamento.
// ============================================================
import { esc, el, fmtDate, fmtDateShort, toast } from './components.js';
import * as api from './api.js';
import { markRead, getReadSet } from './store.js';

const TYPE_FILTERS = [
  { key: 'all', label: 'TODAS' },
  { key: 'fav', label: '★ FAVORITAS' },
  { key: 'major', label: 'GRANDES' },
  { key: 'feature', label: 'ATUALIZAÇÕES' },
  { key: 'patch', label: 'AJUSTES' },
  { key: 'hotfix', label: 'CORREÇÕES' },
  { key: 'tech', label: 'TÉCNICAS' }
];

export function initNotesPage(container, ctx) {
  const { data, social, onUnreadChange } = ctx;
  const reg = data.registry;
  const releases = data.releases;
  const byId = new Map(releases.map(r => [r.id, r]));

  const state = { q: '', type: 'all', cat: 'all', read: getReadSet(), articleId: null };

  // ---------------- esqueleto da página ----------------
  container.innerHTML = `
    <div class="pn-layout">
      <aside class="pn-rail">
        <div class="pn-rail-head">LINHA DO TEMPO <span>${releases.length} versões</span></div>
        <div class="pn-rail-list" id="pn-rail-list"></div>
      </aside>
      <div class="pn-main">
        <div class="pn-toolbar">
          <div class="pn-search">
            <span class="pn-search-ico">🔍</span>
            <input id="pn-search-input" type="text" placeholder="Buscar por palavra, versão, arma, categoria…" autocomplete="off">
            <button id="pn-search-clear" class="hidden" title="Limpar">✕</button>
          </div>
          <div class="pn-filter-row">
            <div class="pn-chips" id="pn-type-chips"></div>
            <select id="pn-cat-select" title="Filtrar por categoria">
              <option value="all">📂 Todas as categorias</option>
              ${Object.entries(reg.categories).map(([k, c]) =>
                `<option value="${k}">${c.emoji} ${esc(c.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="pn-feed" id="pn-feed"></div>
      </div>
      <div class="pn-reader" id="pn-reader"></div>
    </div>`;

  const $feed = container.querySelector('#pn-feed');
  const $rail = container.querySelector('#pn-rail-list');
  const $reader = container.querySelector('#pn-reader');
  const $search = container.querySelector('#pn-search-input');
  const $searchClear = container.querySelector('#pn-search-clear');
  const $chips = container.querySelector('#pn-type-chips');
  const $catSel = container.querySelector('#pn-cat-select');

  // ---------------- helpers ----------------
  const typeInfo = t => reg.types[t] || { label: t.toUpperCase(), color: '#b8b0a0' };
  const catInfo = c => reg.categories[c] || { label: c, emoji: '•', color: '#b8b0a0' };
  const stateInfo = s => reg.states[s] || { label: s.toUpperCase(), color: '#b8b0a0' };
  const isFav = id => social.favorites.has(id);
  const isUnread = id => !state.read.has(id);
  const myReacts = id => social.mine[id] || [];
  const countsOf = id => social.reactions[id] || {};
  const totalReacts = id => Object.values(countsOf(id)).reduce((a, b) => a + b, 0);

  function haystack(r) {
    return [
      r.id, r.version, r.title, r.subtitle, r.summary, r.motivation, r.impact,
      r.notes, r.techNotes, ...(r.body || []),
      ...(r.cards || []).flatMap(c => [c.title, c.desc, c.impact, catInfo(c.category).label, ...(c.tags || [])])
    ].filter(Boolean).join(' ').toLowerCase();
  }
  const search = new Map(releases.map(r => [r.id, haystack(r)]));

  function matches(r) {
    if (state.type === 'fav') { if (!isFav(r.id)) return false; }
    else if (state.type !== 'all' && r.type !== state.type) return false;
    if (state.cat !== 'all' && !(r.cards || []).some(c => c.category === state.cat)) return false;
    if (state.q && !search.get(r.id).includes(state.q)) return false;
    return true;
  }

  // ---------------- filtros (chips + select + busca) ----------------
  for (const f of TYPE_FILTERS) {
    const chip = el(`<button type="button" class="pn-chip${f.key === 'all' ? ' active' : ''}" data-type="${f.key}">${f.label}</button>`);
    chip.onclick = () => {
      state.type = f.key;
      $chips.querySelectorAll('.pn-chip').forEach(c => c.classList.toggle('active', c === chip));
      renderFeed();
    };
    $chips.appendChild(chip);
  }
  $catSel.onchange = () => { state.cat = $catSel.value; renderFeed(); };

  let searchTimer = null;
  $search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = $search.value.trim().toLowerCase();
      $searchClear.classList.toggle('hidden', !state.q);
      renderFeed();
    }, 140);
  });
  $searchClear.onclick = () => { $search.value = ''; state.q = ''; $searchClear.classList.add('hidden'); renderFeed(); };

  // ---------------- linha do tempo ----------------
  function renderRail() {
    $rail.innerHTML = '';
    for (const r of releases) {
      const t = typeInfo(r.type);
      const item = el(`
        <button type="button" class="pn-tl${r.type === 'major' ? ' major' : ''}${isUnread(r.id) ? ' unread' : ''}${state.articleId === r.id ? ' active' : ''}" data-id="${r.id}">
          <span class="pn-tl-dot" style="--tc:${t.color}"></span>
          <span class="pn-tl-ver">${esc(r.id)}</span>
          <span class="pn-tl-date">${fmtDateShort(r.date).slice(0, 5)}</span>
        </button>`);
      item.onclick = () => openArticle(r.id);
      $rail.appendChild(item);
    }
  }

  // ---------------- feed de cards ----------------
  function reactSummary(id) {
    const counts = countsOf(id);
    const top = Object.entries(counts).filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return '';
    return top.map(([e, n]) => `${e} ${n}`).join(' · ');
  }

  function cardNode(r) {
    const t = typeInfo(r.type);
    const compact = r.tier === 'basic';
    const cats = [...new Set((r.cards || []).map(c => c.category))].slice(0, 6);
    const node = el(`
      <article class="pn-card${compact ? ' compact' : ''}${r.pinned ? ' pinned' : ''}${isUnread(r.id) ? ' unread' : ''}" data-id="${r.id}" style="--tc:${t.color}">
        <div class="pn-card-top">
          <span class="pn-type">${esc(t.label)}</span>
          <span class="pn-ver">${esc(r.id)} · build ${r.build}</span>
          ${r.pinned ? '<span class="pn-pin">📌 FIXADO</span>' : ''}
          ${isUnread(r.id) ? '<span class="pn-new">NOVO</span>' : ''}
          <span class="pn-card-date">${fmtDateShort(r.date)}</span>
          <button type="button" class="pn-fav${isFav(r.id) ? ' on' : ''}" title="Favoritar">${isFav(r.id) ? '★' : '☆'}</button>
        </div>
        <h3 class="pn-card-title">${esc(r.title)}</h3>
        ${compact ? '' : `<p class="pn-card-sub">${esc(r.subtitle)}</p>`}
        ${compact ? '' : `<p class="pn-card-summary">${esc(r.summary)}</p>`}
        <div class="pn-card-meta">
          <span>🕐 ${r.readMinutes} min</span>
          <span>${(r.cards || []).length} mudança${(r.cards || []).length === 1 ? '' : 's'}</span>
          <span class="pn-card-cats">${cats.map(c => catInfo(c).emoji).join(' ')}</span>
          <span class="pn-card-reacts">${reactSummary(r.id)}</span>
          <span class="pn-card-open">LER NOTA →</span>
        </div>
      </article>`);
    node.onclick = () => openArticle(r.id);
    const favBtn = node.querySelector('.pn-fav');
    favBtn.onclick = e => { e.stopPropagation(); toggleFav(r.id); };
    return node;
  }

  function renderFeed() {
    $feed.innerHTML = '';
    const visible = releases.filter(matches);
    const pinned = visible.filter(r => r.pinned);
    const rest = visible.filter(r => !r.pinned);
    if (!visible.length) {
      $feed.appendChild(el(`
        <div class="pn-empty">
          <div class="pn-empty-ico">🔭</div>
          <b>Nenhuma atualização encontrada</b>
          <span>Tente outra palavra ou limpe os filtros.</span>
        </div>`));
      return;
    }
    if (pinned.length) {
      $feed.appendChild(el(`<div class="pn-feed-sep">📌 FIXADAS</div>`));
      for (const r of pinned) $feed.appendChild(cardNode(r));
      if (rest.length) $feed.appendChild(el(`<div class="pn-feed-sep">HISTÓRICO</div>`));
    }
    for (const r of rest) $feed.appendChild(cardNode(r));
  }

  // ---------------- favoritos ----------------
  async function toggleFav(id) {
    const on = !isFav(id);
    if (on) social.favorites.add(id); else social.favorites.delete(id);
    ctx.persistFavs();
    refreshSocial();
    try { await api.favorite(id, on); }
    catch {
      if (on) social.favorites.delete(id); else social.favorites.add(id);
      ctx.persistFavs();
      refreshSocial();
      toast('Não foi possível salvar o favorito. Tente de novo.', false);
    }
  }

  // ---------------- reações ----------------
  async function toggleReact(id, emoji, btn) {
    const mine = myReacts(id);
    const on = !mine.includes(emoji);
    const counts = (social.reactions[id] ??= {});
    // otimista: atualiza na hora, servidor confirma com o total real
    if (on) { mine.push(emoji); counts[emoji] = (counts[emoji] || 0) + 1; }
    else { social.mine[id] = mine.filter(e => e !== emoji); counts[emoji] = Math.max(0, (counts[emoji] || 1) - 1); }
    social.mine[id] ??= mine;
    updateReactionBar(id);
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 300);
    try {
      const res = await api.react(id, emoji, on);
      counts[emoji] = res.count;
      updateReactionBar(id);
    } catch (err) {
      if (on) { social.mine[id] = myReacts(id).filter(e => e !== emoji); counts[emoji] = Math.max(0, counts[emoji] - 1); }
      else { myReacts(id).push(emoji); counts[emoji] = (counts[emoji] || 0) + 1; }
      updateReactionBar(id);
      toast(err.code === 'rate_limited' ? 'Calma, campeão — muitas reações por minuto.' : 'Não foi possível reagir agora.', false);
    }
  }

  function reactionBarHtml(id) {
    const counts = countsOf(id);
    const mine = myReacts(id);
    return reg.reactions.map(e => {
      const n = counts[e] || 0;
      return `<button type="button" class="pn-react${mine.includes(e) ? ' on' : ''}" data-emoji="${e}">
        <span class="pn-react-e">${e}</span><span class="pn-react-n${n ? '' : ' zero'}">${n}</span>
      </button>`;
    }).join('');
  }

  function updateReactionBar(id) {
    if (state.articleId !== id) return;
    const bar = $reader.querySelector('.pn-reactions-bar');
    if (!bar) return;
    bar.innerHTML = reactionBarHtml(id);
    bindReactionBar(id, bar);
  }

  function bindReactionBar(id, bar) {
    bar.querySelectorAll('.pn-react').forEach(btn => {
      btn.onclick = () => toggleReact(id, btn.dataset.emoji, btn);
    });
  }

  // ---------------- compartilhar ----------------
  function patchUrl(id) {
    return `${location.origin}${location.pathname}?patch=${encodeURIComponent(id)}`;
  }
  async function copyLink(id) {
    try {
      await navigator.clipboard.writeText(patchUrl(id));
      toast('Link copiado! Cole onde quiser. 🔗');
    } catch {
      toast('Não consegui copiar — copie da barra de endereço.', false);
    }
  }
  async function shareLink(r) {
    if (navigator.share) {
      try { await navigator.share({ title: `Sunfall Arena — ${r.title}`, text: r.summary, url: patchUrl(r.id) }); } catch {}
    } else copyLink(r.id);
  }

  // ---------------- anexos (imagens/vídeos/antes-depois) ----------------
  function mediaHtml(media) {
    if (!media?.length) return '';
    const items = media.map(m => {
      if (m.type === 'video') return `<figure class="pn-media"><video src="${esc(m.src)}" controls preload="none"></video>${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
      if (m.type === 'compare') return `
        <figure class="pn-media pn-compare">
          <div><img src="${esc(m.before)}" alt="Antes" loading="lazy"><span>ANTES</span></div>
          <div><img src="${esc(m.after)}" alt="Depois" loading="lazy"><span>DEPOIS</span></div>
          ${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}
        </figure>`;
      return `<figure class="pn-media"><img src="${esc(m.src)}" alt="${esc(m.caption || '')}" loading="lazy">${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
    }).join('');
    return `<h2 class="pn-h2">📷 MÍDIA</h2><div class="pn-media-grid">${items}</div>`;
  }

  // ---------------- leitor (artigo) ----------------
  function changeCardHtml(c) {
    const cat = catInfo(c.category);
    const st = stateInfo(c.state);
    return `
      <div class="pn-chg" style="--cc:${cat.color}">
        <div class="pn-chg-head">
          <span class="pn-chg-ico">${c.icon || cat.emoji}</span>
          <span class="pn-chg-cat">${esc(cat.label)}</span>
          <span class="pn-chg-state" style="--sc:${st.color}">${esc(st.label)}</span>
        </div>
        <b class="pn-chg-title">${esc(c.title)}</b>
        <p class="pn-chg-desc">${esc(c.desc)}</p>
        ${c.impact ? `<p class="pn-chg-impact">▸ ${esc(c.impact)}</p>` : ''}
        ${c.tags?.length ? `<div class="pn-chg-tags">${c.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>`;
  }

  function openArticle(id) {
    const r = byId.get(id);
    if (!r) { toast(`Versão ${id} não encontrada.`, false); return; }
    state.articleId = id;
    if (markRead(id)) { state.read.add(id); onUnreadChange?.(); }
    const t = typeInfo(r.type);

    $reader.innerHTML = `
      <div class="pn-reader-bar">
        <button type="button" class="pn-back">← VOLTAR</button>
        <div class="pn-reader-actions">
          <button type="button" class="pn-act pn-act-copy" title="Copiar link">🔗 COPIAR LINK</button>
          <button type="button" class="pn-act pn-act-share" title="Compartilhar">📤 COMPARTILHAR</button>
          <button type="button" class="pn-act pn-act-fav${isFav(id) ? ' on' : ''}">${isFav(id) ? '★ FAVORITADA' : '☆ FAVORITAR'}</button>
        </div>
      </div>
      <div class="pn-article">
        <header class="pn-art-head" style="--tc:${t.color}">
          <div class="pn-art-badges">
            <span class="pn-type">${esc(t.label)}</span>
            ${r.pinned ? '<span class="pn-pin">📌 FIXADO</span>' : ''}
            <span class="pn-tier">${r.tier === 'advanced' ? 'NOTA COMPLETA' : 'NOTA RÁPIDA'}</span>
          </div>
          <h1>${esc(r.title)}</h1>
          <p class="pn-art-sub">${esc(r.subtitle)}</p>
          <div class="pn-art-meta">
            <span title="Versão">🏷️ ${esc(r.id)}</span>
            <span title="Build">🔧 build ${r.build}</span>
            <span title="Data">📅 ${fmtDate(r.date)}</span>
            <span title="Horário">🕐 ${esc(r.time)}</span>
            <span title="Autor">✍️ ${esc(r.author)}</span>
            <span title="Tempo de leitura">📖 ${r.readMinutes} min de leitura</span>
          </div>
        </header>
        <div class="pn-summary"><span>RESUMO</span>${esc(r.summary)}</div>
        <div class="pn-body">${(r.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        <h2 class="pn-h2">⚡ O QUE MUDOU</h2>
        <div class="pn-chg-grid">${(r.cards || []).map(changeCardHtml).join('')}</div>
        ${mediaHtml(r.media)}
        ${r.motivation ? `<div class="pn-block"><h4>🎯 POR QUE MUDAMOS</h4><p>${esc(r.motivation)}</p></div>` : ''}
        ${r.impact ? `<div class="pn-block impact"><h4>🎮 IMPACTO PARA VOCÊ</h4><p>${esc(r.impact)}</p></div>` : ''}
        ${r.notes ? `<div class="pn-block"><h4>📝 OBSERVAÇÕES</h4><p>${esc(r.notes)}</p></div>` : ''}
        ${r.techNotes ? `<div class="pn-block tech"><h4>💻 NOTAS TÉCNICAS</h4><p>${esc(r.techNotes)}</p></div>` : ''}
        ${r.footer ? `<div class="pn-quote">${esc(r.footer)}</div>` : ''}
        <div class="pn-reactions">
          <div class="pn-reactions-title">O QUE VOCÊ ACHOU DESTA ATUALIZAÇÃO?</div>
          <div class="pn-reactions-bar">${reactionBarHtml(id)}</div>
        </div>
        <div class="pn-art-end">Sunfall Arena · ${esc(r.id)} · build ${r.build} · publicada em ${fmtDateShort(r.date)} às ${esc(r.time)}</div>
      </div>`;

    $reader.querySelector('.pn-back').onclick = closeArticle;
    $reader.querySelector('.pn-act-copy').onclick = () => copyLink(id);
    $reader.querySelector('.pn-act-share').onclick = () => shareLink(r);
    $reader.querySelector('.pn-act-fav').onclick = async e => {
      const btn = e.currentTarget; // capturado antes do await (depois vira null)
      await toggleFav(id);
      btn.classList.toggle('on', isFav(id));
      btn.textContent = isFav(id) ? '★ FAVORITADA' : '☆ FAVORITAR';
    };
    bindReactionBar(id, $reader.querySelector('.pn-reactions-bar'));

    $reader.classList.add('show');
    $reader.querySelector('.pn-article').scrollTop = 0;
    renderRail();
    renderFeed();
  }

  function closeArticle() {
    state.articleId = null;
    $reader.classList.remove('show');
    renderRail();
  }

  // contadores/estrelas mudaram (login, resposta do servidor…): redesenha
  function refreshSocial() {
    renderFeed();
    if (state.articleId) {
      updateReactionBar(state.articleId);
      const favBtn = $reader.querySelector('.pn-act-fav');
      if (favBtn) {
        favBtn.classList.toggle('on', isFav(state.articleId));
        favBtn.textContent = isFav(state.articleId) ? '★ FAVORITADA' : '☆ FAVORITAR';
      }
    }
  }

  function render() { renderRail(); renderFeed(); }

  return { render, openArticle, closeArticle, refreshSocial };
}
