// ============================================================
// SUNFALL ARENA — anunciador de patch notes no Discord
//
// Roda a cada boot do servidor (todo deploy reinicia a máquina):
// compara as releases de patchnotes/ com a tabela
// patch_announcements e anuncia no canal de novidades tudo que
// ainda não foi anunciado — em resumo, com convite para ler a
// nota completa dentro do jogo.
//
// Regras:
//  • dedupe no banco (INSERT ... ON CONFLICT): cada versão é
//    anunciada UMA vez, mesmo com reinícios seguidos;
//  • primeiro boot (tabela vazia): marca o histórico inteiro como
//    anunciado SEM postar (nada de flood com 29 versões) e anuncia
//    só a versão mais recente;
//  • se o Discord falhar, a "reserva" é desfeita e a próxima
//    inicialização tenta de novo.
// ============================================================
import { query } from '../db.js';
import { releases, registry } from './patchmeta.js';
import { hasPatchWebhook, sendPatchAnnouncement, patchAnnounceEmbed } from './discord.js';

async function claim(patchId) {
  const { rows } = await query(
    `INSERT INTO patch_announcements (patch_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING patch_id`,
    [patchId]
  );
  return rows.length > 0;
}

export async function announceNewPatchNotes() {
  if (!releases.length) return;
  if (!hasPatchWebhook()) {
    console.log('[announcer] DISCORD_PATCHNOTES_WEBHOOK_URL não configurado — anúncios desativados.');
    return;
  }

  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM patch_announcements`);
  const bootstrap = rows[0].n === 0;

  if (bootstrap) {
    // primeiro uso: sela o histórico sem postar; só a mais nova é anunciada
    const latest = releases[releases.length - 1];
    for (const r of releases) {
      if (r.id !== latest.id) await query(
        `INSERT INTO patch_announcements (patch_id) VALUES ($1) ON CONFLICT DO NOTHING`, [r.id]
      );
    }
    console.log(`[announcer] bootstrap: ${releases.length - 1} versões seladas sem anúncio`);
  }

  let sent = 0;
  for (const r of releases) { // ordem cronológica (build asc)
    if (!(await claim(r.id))) continue;
    const ok = await sendPatchAnnouncement(patchAnnounceEmbed(r, registry));
    if (ok) {
      sent++;
      console.log(`[announcer] anunciado no Discord: ${r.id} — ${r.title}`);
    } else {
      // desfaz a reserva para tentar de novo no próximo boot
      await query(`DELETE FROM patch_announcements WHERE patch_id = $1`, [r.id]).catch(() => {});
      console.error(`[announcer] falha ao anunciar ${r.id} — tentará no próximo boot`);
    }
  }
  if (!sent && !bootstrap) console.log('[announcer] nenhuma versão nova para anunciar');
}
