// ============================================================
// NOVIDADES — aba SUGESTÕES
// Canal de ideias, melhorias, elogios e opiniões. Validação ao
// vivo, contadores de caracteres e confirmação com animação.
// ============================================================
import { el, esc, toast, attachCounter } from './components.js';
import * as api from './api.js';

const CATEGORIES = [
  { key: 'ideia', emoji: '💡', label: 'Ideia nova', desc: 'Algo que ainda não existe no jogo' },
  { key: 'melhoria', emoji: '📈', label: 'Melhoria', desc: 'Algo que existe mas pode ficar melhor' },
  { key: 'elogio', emoji: '❤️', label: 'Elogio', desc: 'Conte o que você está amando' },
  { key: 'opiniao', emoji: '💬', label: 'Opinião', desc: 'Sua visão sobre o rumo do jogo' },
  { key: 'experiencia', emoji: '🎮', label: 'Experiência', desc: 'Como foi jogar — o bom e o ruim' },
  { key: 'outro', emoji: '📦', label: 'Outro', desc: 'Qualquer outra coisa' }
];

export function initIdeasPage(container, ctx) {
  container.innerHTML = `
    <div class="fb-layout">
      <aside class="fb-side">
        <div class="fb-side-ico">💡</div>
        <h3>Sua ideia pode virar<br>a próxima atualização</h3>
        <p>Boa parte do que existe no jogo nasceu de sugestões de quem joga — as correções da v1.12.1 vieram todas de vocês.</p>
        <ul>
          <li>Seja específico: “a VESPA-C1 podia ter…” ajuda mais que “melhorem as armas”.</li>
          <li>Um envio por assunto facilita a triagem.</li>
          <li>Elogio também é feedback — a gente lê tudo.</li>
        </ul>
        <div class="fb-side-note">Cada envio chega na hora para a equipe, com seu nome e a versão do jogo.</div>
      </aside>
      <form class="fb-form" id="fb-form" novalidate>
        <div class="fb-field">
          <label>CATEGORIA</label>
          <div class="fb-cats" id="fb-cats">
            ${CATEGORIES.map((c, i) => `
              <button type="button" class="fb-cat${i === 0 ? ' active' : ''}" data-cat="${c.key}" title="${esc(c.desc)}">
                <span>${c.emoji}</span>${esc(c.label)}
              </button>`).join('')}
          </div>
        </div>
        <div class="fb-field">
          <label for="fb-title">TÍTULO <span class="fb-counter" id="fb-title-count"></span></label>
          <input id="fb-title" type="text" maxlength="80" placeholder="Resuma sua sugestão em uma frase" autocomplete="off">
        </div>
        <div class="fb-field">
          <label for="fb-msg">SUA SUGESTÃO <span class="fb-counter" id="fb-msg-count"></span></label>
          <textarea id="fb-msg" rows="7" maxlength="2000" placeholder="Conte em detalhes: o que, por que e como você imagina funcionando…"></textarea>
        </div>
        <div class="fb-field" id="fb-nick-field">
          <label for="fb-nick">SEU NOME (OPCIONAL)</label>
          <input id="fb-nick" type="text" maxlength="20" placeholder="Como podemos te chamar" autocomplete="off">
        </div>
        <div class="fb-error hidden" id="fb-error"></div>
        <button type="submit" class="fb-send" id="fb-send">ENVIAR SUGESTÃO</button>
      </form>
      <div class="fb-success hidden" id="fb-success">
        <div class="fb-success-ico">🎉</div>
        <h3>Sugestão enviada!</h3>
        <p>Obrigado por ajudar a construir a Sunfall Arena.<br>A equipe já recebeu — tudo é lido, de verdade.</p>
        <button type="button" class="fb-again" id="fb-again">ENVIAR OUTRA</button>
      </div>
    </div>`;

  const $form = container.querySelector('#fb-form');
  const $title = container.querySelector('#fb-title');
  const $msg = container.querySelector('#fb-msg');
  const $nick = container.querySelector('#fb-nick');
  const $nickField = container.querySelector('#fb-nick-field');
  const $error = container.querySelector('#fb-error');
  const $send = container.querySelector('#fb-send');
  const $success = container.querySelector('#fb-success');
  let category = CATEGORIES[0].key;

  attachCounter($title, container.querySelector('#fb-title-count'), 80);
  attachCounter($msg, container.querySelector('#fb-msg-count'), 2000);

  container.querySelectorAll('.fb-cat').forEach(btn => {
    btn.onclick = () => {
      category = btn.dataset.cat;
      container.querySelectorAll('.fb-cat').forEach(b => b.classList.toggle('active', b === btn));
    };
  });

  function fail(msg) {
    $error.textContent = msg;
    $error.classList.remove('hidden');
  }

  $form.onsubmit = async e => {
    e.preventDefault();
    $error.classList.add('hidden');
    const title = $title.value.trim();
    const message = $msg.value.trim();
    if (title.length < 4) return fail('O título precisa de pelo menos 4 caracteres.');
    if (message.length < 10) return fail('Conte um pouco mais — a mensagem precisa de pelo menos 10 caracteres.');

    $send.disabled = true;
    $send.textContent = 'ENVIANDO…';
    try {
      await api.sendSuggestion({
        category, title, message,
        version: ctx.data.currentVersion,
        nickname: $nick.value.trim() || undefined
      });
      $form.classList.add('hidden');
      $success.classList.remove('hidden');
    } catch (err) {
      fail(err.code === 'rate_limited'
        ? 'Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo.'
        : 'Não foi possível enviar agora. Verifique sua conexão e tente novamente.');
    } finally {
      $send.disabled = false;
      $send.textContent = 'ENVIAR SUGESTÃO';
    }
  };

  container.querySelector('#fb-again').onclick = () => {
    $form.reset();
    $form.classList.remove('hidden');
    $success.classList.add('hidden');
    $title.dispatchEvent(new Event('input'));
    $msg.dispatchEvent(new Event('input'));
  };

  // logado: o servidor usa o nome da conta; escondemos o campo opcional
  function refreshAuth() {
    const auth = ctx.getAuth();
    $nickField.classList.toggle('hidden', !!auth);
  }

  return { refreshAuth };
}
