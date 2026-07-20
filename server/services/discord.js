// ============================================================
// SUNFALL ARENA — integração com Discord (webhook)
// Encaminha sugestões e reportes de bug para o canal interno da
// equipe em embeds organizados. Configuração 100% por variável
// de ambiente (DISCORD_WEBHOOK_URL) — sem URL no código.
// Falha de envio nunca derruba a requisição: o registro no banco
// é a fonte da verdade; o Discord é notificação.
// ============================================================
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
let warnedOnce = false;

const COLORS = {
  suggestion: 0xf0c04c, // dourado
  low: 0x8ac850,        // verde
  medium: 0xf0c04c,     // âmbar
  high: 0xf08060,       // laranja
  critical: 0xe0554e    // vermelho
};

const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '—');

export async function sendToDiscord(embed) {
  if (!WEBHOOK_URL) {
    if (!warnedOnce) { warnedOnce = true; console.warn('[discord] DISCORD_WEBHOOK_URL não configurado — envios serão apenas registrados no banco.'); }
    return false;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(WEBHOOK_URL, {
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

export function suggestionEmbed({ category, title, message, username, version, id }) {
  return {
    title: `💡 Sugestão — ${cut(title, 200)}`,
    description: cut(message, 3500),
    color: COLORS.suggestion,
    fields: [
      { name: '📂 Categoria', value: cut(category, 100), inline: true },
      { name: '🎮 Jogador', value: cut(username, 100), inline: true },
      { name: '🏷️ Versão', value: cut(version, 20), inline: true }
    ],
    footer: { text: `Sunfall Arena · Sugestão #${id}` },
    timestamp: new Date().toISOString()
  };
}

export function bugEmbed(b) {
  const fields = [
    { name: '📂 Categoria', value: cut(b.category, 100), inline: true },
    { name: '💥 Gravidade', value: cut(b.severityLabel, 40), inline: true },
    { name: '⏫ Prioridade', value: cut(b.priorityLabel, 40), inline: true },
    { name: '🎮 Jogador', value: cut(b.username, 100), inline: true },
    { name: '🏷️ Versão', value: cut(b.version, 20), inline: true },
    { name: '🖥️ Plataforma', value: cut(b.platform, 120), inline: true },
    { name: '📐 Resolução / Monitor', value: cut(`${b.resolution || '—'} · ${b.monitor || '—'}`, 120), inline: true },
    { name: '📊 FPS', value: cut(b.fps, 30), inline: true },
    { name: '🧰 Hardware', value: cut(b.hardware, 200), inline: true },
    { name: '👣 Passos para reproduzir', value: cut(b.steps, 1000), inline: false },
    { name: '✅ Resultado esperado', value: cut(b.expected, 500), inline: false },
    { name: '❌ Resultado obtido', value: cut(b.actual, 500), inline: false }
  ];
  if (b.logs) fields.push({ name: '📜 Logs', value: cut('```' + b.logs + '```', 1000), inline: false });
  return {
    title: `🐛 Bug — ${cut(b.title, 200)}`,
    description: cut(b.description, 2000),
    color: COLORS[b.severity] || COLORS.medium,
    fields,
    footer: { text: `Sunfall Arena · Bug #${b.id}` },
    timestamp: new Date().toISOString()
  };
}
