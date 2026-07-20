// ============================================================
// SUNFALL ARENA — metadados dos patch notes no servidor
// Carrega registry + releases direto de patchnotes/ (mesma fonte
// da verdade do frontend) para: validar reações/favoritos e
// alimentar o anunciador de novidades no Discord.
// ============================================================
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';

const PATCH_DIR = fileURLToPath(new URL('../../patchnotes', import.meta.url));

export const patchIds = new Set();
export const validReactions = new Set();
export let releases = [];   // ordenadas da mais antiga à mais nova (build asc)
export let registry = null;

// mesmo cálculo do build do frontend (~180 palavras/min em PT-BR)
function readMinutes(r) {
  const text = [
    r.title, r.subtitle, r.summary, ...(r.body || []), r.motivation, r.impact,
    r.notes, r.techNotes, r.footer,
    ...(r.cards || []).flatMap(c => [c.title, c.desc, c.impact])
  ].filter(Boolean).join(' ');
  return Math.max(1, Math.round(text.split(/\s+/).length / 180));
}

export async function loadPatchMeta() {
  try {
    registry = JSON.parse(await readFile(join(PATCH_DIR, 'registry.json'), 'utf8'));
    for (const r of registry.reactions || []) validReactions.add(r);

    const files = (await readdir(join(PATCH_DIR, 'releases')))
      .filter(f => f.endsWith('.json') && !f.startsWith('DRAFT'));
    const list = [];
    for (const file of files) {
      const data = JSON.parse(await readFile(join(PATCH_DIR, 'releases', file), 'utf8'));
      data.readMinutes = readMinutes(data);
      list.push(data);
      patchIds.add(data.id);
    }
    list.sort((a, b) => (a.build || 0) - (b.build || 0));
    releases = list;
    console.log(`[patchmeta] ${patchIds.size} versões, ${validReactions.size} reações válidas`);
  } catch (err) {
    // Sem patchnotes/ no disco (ex.: imagem antiga) o jogo continua de pé;
    // as rotas de reação apenas recusam ids desconhecidos.
    console.error('[patchmeta] falha ao carregar patchnotes/:', err.message);
  }
}
