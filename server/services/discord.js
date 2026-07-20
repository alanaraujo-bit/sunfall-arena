// ============================================================
// SUNFALL ARENA — integração com Discord (webhook)
// Encaminha sugestões e reportes de bug para o canal interno da
// equipe. Configuração 100% por variável de ambiente
// (DISCORD_WEBHOOK_URL) — sem URL no código.
//
// Filosofia do formato: bater o olho e entender. Título direto,
// uma linha de contexto, corpo, e só depois os detalhes — campos
// vazios simplesmente não aparecem.
//
// Falha de envio nunca derruba a requisição: o registro no banco
// é a fonte da verdade; o Discord é notificação.
// ============================================================
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;                       // sugestões + bugs
const PATCHNOTES_WEBHOOK_URL = process.env.DISCORD_PATCHNOTES_WEBHOOK_URL; // anúncios de patch notes
const GAME_URL = process.env.GAME_URL || 'https://sunfall-arena.vercel.app';
let warnedOnce = false;

const COLORS = {
  suggestion: 0xf0c04c, // dourado
  low: 0x8ac850,        // verde
  medium: 0xf0c04c,     // âmbar
  high: 0xf08060,       // laranja
  critical: 0xe0554e    // vermelho
};
const SEV_EMOJI = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };

const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
const line = parts => parts.filter(Boolean).join('  ·  ');

async function postWebhook(url, embed) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions vazio: conteúdo de jogador nunca pinga @everyone/@cargo
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) console.error(`[discord] webhook respondeu ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error('[discord] falha no envio:', err.message);
    return false;
  }
}

export async function sendToDiscord(embed) {
  if (!WEBHOOK_URL) {
    if (!warnedOnce) { warnedOnce = true; console.warn('[discord] DISCORD_WEBHOOK_URL não configurado — envios serão apenas registrados no banco.'); }
    return false;
  }
  return postWebhook(WEBHOOK_URL, embed);
}

export function hasPatchWebhook() { return !!PATCHNOTES_WEBHOOK_URL; }

export async function sendPatchAnnouncement(embed) {
  if (!PATCHNOTES_WEBHOOK_URL) return false;
  return postWebhook(PATCHNOTES_WEBHOOK_URL, embed);
}

// 📜 Anúncio de patch note: versão resumida para o Discord — resumo,
// até 3 destaques e o convite para ler a nota completa dentro do jogo.
export function patchAnnounceEmbed(release, registry) {
  const type = registry?.types?.[release.type] || { label: 'ATUALIZAÇÃO', color: '#3fc8b4' };
  const color = parseInt(String(type.color).replace('#', ''), 16) || 0x3fc8b4;
  const cards = release.cards || [];
  const highlights = cards.slice(0, 3).map(c => {
    const cat = registry?.categories?.[c.category];
    return `${c.icon || cat?.emoji || '•'} ${c.title}`;
  });
  const extra = cards.length - highlights.length;
  const url = `${GAME_URL}/?patch=${encodeURIComponent(release.id)}`;

  const parts = [
    cut(release.summary, 350),
    highlights.length ? `**Destaques**\n${highlights.map(h => `• ${cut(h, 90)}`).join('\n')}${extra > 0 ? `\n_…e mais ${extra} mudança${extra === 1 ? '' : 's'}._` : ''}` : '',
    `🎮 **Nota completa dentro do jogo** — aba **NOVIDADES** no lobby\n🔗 [Abrir direto nesta nota](${url})`
  ];

  return {
    title: `📜 ${release.id} · ${cut(release.title, 200)}`,
    description: parts.filter(Boolean).join('\n\n'),
    color,
    footer: { text: line([`Sunfall Arena`, `build ${release.build}`, type.label, `${release.readMinutes || ''} min de leitura`.trim()]) },
    timestamp: new Date(`${release.date}T${release.time || '12:00'}:00-03:00`).toISOString()
  };
}

// 💡 Sugestão: título + mensagem + UMA linha de contexto. Nada mais.
export function suggestionEmbed({ categoryLabel, title, message, username, version, id }) {
  return {
    title: `💡 ${cut(title, 230)}`,
    description: `${cut(message, 3200)}\n\n${line([categoryLabel, `🎮 ${cut(username, 40)}`, version && `🏷️ ${version}`])}`,
    color: COLORS.suggestion,
    footer: { text: `Sugestão #${id} · Sunfall Arena` },
    timestamp: new Date().toISOString()
  };
}

// 🐛 Bug: gravidade no topo (cor + emoji), descrição, e detalhes
// apenas quando existem — passos, esperado/obtido, sistema, logs.
export function bugEmbed(b) {
  const head = line([
    `${SEV_EMOJI[b.severity] || '🟡'} **${b.severityLabel.toUpperCase()}**`,
    b.categoryLabel,
    `prioridade ${b.priorityLabel.toLowerCase()}`
  ]);

  const fields = [];
  if (b.steps) fields.push({ name: '👣 Passos para reproduzir', value: cut(b.steps, 1000), inline: false });
  if (b.expected || b.actual) fields.push({
    name: '✅ Esperado → ❌ Obtido',
    value: cut([b.expected && `**Esperado:** ${b.expected}`, b.actual && `**Obtido:** ${b.actual}`].filter(Boolean).join('\n'), 1000),
    inline: false
  });
  if (b.platform) fields.push({
    name: '🖥️ Sistema',
    value: cut(`${line([b.platform, b.resolution && `📐 ${b.resolution}`, b.fps && `📊 ${b.fps}`])}\n${b.hardware || ''}`.trim(), 1000),
    inline: false
  });
  if (b.logs) fields.push({ name: '📜 Logs', value: cut('```' + b.logs.slice(-900) + '```', 1000), inline: false });

  return {
    title: `🐛 ${cut(b.title, 230)}`,
    description: `${head}\n\n${cut(b.description, 2500)}`,
    color: COLORS[b.severity] || COLORS.medium,
    fields,
    footer: { text: line([`Bug #${b.id}`, `🎮 ${cut(b.username, 40)}`, b.version && `🏷️ ${b.version}`, 'Sunfall Arena']) },
    timestamp: new Date().toISOString()
  };
}
