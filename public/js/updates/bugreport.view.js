// ============================================================
// NOVIDADES — aba REPORTAR BUG
// Formulário profissional com gravidade/prioridade, passos de
// reprodução e coleta automática de dados técnicos (versão,
// plataforma, resolução, FPS medido na hora, GPU e logs).
// ============================================================
import { el, esc, toast, attachCounter } from './components.js';
import * as api from './api.js';
import { collectSysInfo, measureFps, getErrorLogs } from './store.js';

const CATEGORIES = [
  { key: 'gameplay', emoji: '🎮', label: 'Gameplay' },
  { key: 'interface', emoji: '🎨', label: 'Interface' },
  { key: 'rede', emoji: '📡', label: 'Rede / Conexão' },
  { key: 'audio', emoji: '🔊', label: 'Áudio' },
  { key: 'grafico', emoji: '🖼️', label: 'Gráficos' },
  { key: 'conta', emoji: '👤', label: 'Conta / Perfil' },
  { key: 'outro', emoji: '📦', label: 'Outro' }
];
const SEVERITIES = [
  { key: 'low', label: 'Baixa', desc: 'Detalhe visual, nada quebra' },
  { key: 'medium', label: 'Média', desc: 'Incomoda, mas dá pra jogar' },
  { key: 'high', label: 'Alta', desc: 'Atrapalha seriamente a partida' },
  { key: 'critical', label: 'Crítica', desc: 'Impede de jogar / trava tudo' }
];
const PRIORITIES = [
  { key: 'low', label: 'Baixa' },
  { key: 'medium', label: 'Média' },
  { key: 'high', label: 'Alta' }
];

export function initBugsPage(container, ctx) {
  container.innerHTML = `
    <div class="bg-layout">
      <form class="bg-form" id="bg-form" novalidate>
        <div class="bg-row">
          <div class="fb-field">
            <label for="bg-cat">CATEGORIA *</label>
            <select id="bg-cat">${CATEGORIES.map(c => `<option value="${c.key}">${c.emoji} ${esc(c.label)}</option>`).join('')}</select>
          </div>
          <div class="fb-field">
            <label for="bg-sev">GRAVIDADE *</label>
            <select id="bg-sev">${SEVERITIES.map(s => `<option value="${s.key}"${s.key === 'medium' ? ' selected' : ''}>${esc(s.label)} — ${esc(s.desc)}</option>`).join('')}</select>
          </div>
          <div class="fb-field">
            <label for="bg-pri">PRIORIDADE *</label>
            <select id="bg-pri">${PRIORITIES.map(p => `<option value="${p.key}"${p.key === 'medium' ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="fb-field">
          <label for="bg-title">TÍTULO DO BUG * <span class="fb-counter" id="bg-title-count"></span></label>
          <input id="bg-title" type="text" maxlength="80" placeholder="Ex.: Granada atravessa a parede do mercado no Ocaso" autocomplete="off">
        </div>
        <div class="fb-field">
          <label for="bg-desc">DESCRIÇÃO * <span class="fb-counter" id="bg-desc-count"></span></label>
          <textarea id="bg-desc" rows="4" maxlength="2000" placeholder="Descreva o problema com o máximo de detalhes…"></textarea>
        </div>
        <div class="fb-field">
          <label for="bg-steps">PASSOS PARA REPRODUZIR</label>
          <textarea id="bg-steps" rows="3" maxlength="1500" placeholder="1. Entre numa sala personalizada no Ocaso&#10;2. Vá até o mercado&#10;3. Arremesse a granada na parede norte…"></textarea>
        </div>
        <div class="bg-row two">
          <div class="fb-field">
            <label for="bg-expected">RESULTADO ESPERADO</label>
            <textarea id="bg-expected" rows="2" maxlength="500" placeholder="O que deveria acontecer"></textarea>
          </div>
          <div class="fb-field">
            <label for="bg-actual">RESULTADO OBTIDO</label>
            <textarea id="bg-actual" rows="2" maxlength="500" placeholder="O que acontece de fato"></textarea>
          </div>
        </div>
        <div class="bg-sysinfo">
          <div class="bg-sys-head">
            <span>🛰️ DADOS TÉCNICOS <i>coletados automaticamente</i></span>
            <label class="bg-sys-toggle"><input type="checkbox" id="bg-include-sys" checked> incluir no reporte</label>
          </div>
          <div class="bg-sys-grid" id="bg-sys-grid"><span class="bg-sys-loading">coletando…</span></div>
        </div>
        <div class="fb-field" id="bg-nick-field">
          <label for="bg-nick">SEU NOME (OPCIONAL)</label>
          <input id="bg-nick" type="text" maxlength="20" placeholder="Como podemos te chamar" autocomplete="off">
        </div>
        <div class="fb-error hidden" id="bg-error"></div>
        <button type="submit" class="fb-send" id="bg-send">🐛 ENVIAR REPORTE</button>
      </form>
      <div class="fb-success hidden" id="bg-success">
        <div class="fb-success-ico">🛠️</div>
        <h3>Reporte enviado!</h3>
        <p>Obrigado, caçador de bugs. A equipe recebeu tudo — inclusive os<br>dados técnicos que ajudam a reproduzir o problema.</p>
        <button type="button" class="fb-again" id="bg-again">REPORTAR OUTRO</button>
      </div>
    </div>`;

  const $ = sel => container.querySelector(sel);
  const $form = $('#bg-form');
  const $error = $('#bg-error');
  const $send = $('#bg-send');
  const $success = $('#bg-success');
  const $sysGrid = $('#bg-sys-grid');

  attachCounter($('#bg-title'), $('#bg-title-count'), 80);
  attachCounter($('#bg-desc'), $('#bg-desc-count'), 2000);

  // ---- coleta automática de dados técnicos ----
  let sys = null;
  async function collect() {
    const base = collectSysInfo();
    const fps = await measureFps(1000);
    sys = {
      version: ctx.data.currentVersion,
      platform: base.platform,
      resolution: base.resolution,
      monitor: base.monitor,
      fps: `${fps} FPS (lobby)`,
      hardware: base.hardware,
      logs: getErrorLogs()
    };
    $sysGrid.innerHTML = [
      ['🏷️ Versão', sys.version],
      ['🖥️ Plataforma', sys.platform],
      ['📐 Resolução', sys.resolution],
      ['🖵 Monitor', sys.monitor],
      ['📊 FPS agora', sys.fps],
      ['🧰 Hardware', sys.hardware],
      ['📜 Logs', sys.logs ? `${sys.logs.split('\n').length} linha(s) de erro` : 'nenhum erro registrado']
    ].map(([k, v]) => `<div class="bg-sys-item"><span>${k}</span><b>${esc(v)}</b></div>`).join('');
  }

  function fail(msg) {
    $error.textContent = msg;
    $error.classList.remove('hidden');
    $error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $form.onsubmit = async e => {
    e.preventDefault();
    $error.classList.add('hidden');
    const title = $('#bg-title').value.trim();
    const description = $('#bg-desc').value.trim();
    if (title.length < 4) return fail('O título precisa de pelo menos 4 caracteres.');
    if (description.length < 10) return fail('Descreva um pouco mais o problema (mínimo de 10 caracteres).');

    const includeSys = $('#bg-include-sys').checked && sys;
    $send.disabled = true;
    $send.textContent = 'ENVIANDO…';
    try {
      await api.sendBug({
        category: $('#bg-cat').value,
        severity: $('#bg-sev').value,
        priority: $('#bg-pri').value,
        title, description,
        steps: $('#bg-steps').value.trim(),
        expected: $('#bg-expected').value.trim(),
        actual: $('#bg-actual').value.trim(),
        version: ctx.data.currentVersion,
        platform: includeSys ? sys.platform : '',
        resolution: includeSys ? sys.resolution : '',
        monitor: includeSys ? sys.monitor : '',
        fps: includeSys ? sys.fps : '',
        hardware: includeSys ? sys.hardware : '',
        logs: includeSys ? sys.logs : '',
        nickname: $('#bg-nick').value.trim() || undefined
      });
      $form.classList.add('hidden');
      $success.classList.remove('hidden');
    } catch (err) {
      fail(err.code === 'rate_limited'
        ? 'Você enviou muitos reportes em pouco tempo. Aguarde alguns minutos.'
        : 'Não foi possível enviar agora. Verifique sua conexão e tente novamente.');
    } finally {
      $send.disabled = false;
      $send.textContent = '🐛 ENVIAR REPORTE';
    }
  };

  $('#bg-again').onclick = () => {
    $form.reset();
    $form.classList.remove('hidden');
    $success.classList.add('hidden');
    $('#bg-title').dispatchEvent(new Event('input'));
    $('#bg-desc').dispatchEvent(new Event('input'));
    collect();
  };

  function refreshAuth() {
    $('#bg-nick-field').classList.toggle('hidden', !!ctx.getAuth());
  }

  // coleta quando a aba abre (FPS medido no momento real)
  let collected = false;
  function onShow() {
    if (!collected) { collected = true; collect(); }
    refreshAuth();
  }

  return { onShow, refreshAuth };
}
