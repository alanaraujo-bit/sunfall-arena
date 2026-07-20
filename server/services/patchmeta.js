// ============================================================
// SUNFALL ARENA — metadados dos patch notes no servidor
// Carrega os ids de versão e a lista de reações válidas direto
// de patchnotes/ (mesma fonte da verdade do frontend) para
// validar reações/favoritos sem duplicar listas no código.
// ============================================================
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';

const PATCH_DIR = fileURLToPath(new URL('../../patchnotes', import.meta.url));

export const patchIds = new Set();
export const validReactions = new Set();

export async function loadPatchMeta() {
  try {
    const registry = JSON.parse(await readFile(join(PATCH_DIR, 'registry.json'), 'utf8'));
    for (const r of registry.reactions || []) validReactions.add(r);
    for (const file of await readdir(join(PATCH_DIR, 'releases'))) {
      if (file.endsWith('.json') && !file.startsWith('DRAFT')) patchIds.add(file.replace(/\.json$/, ''));
    }
    console.log(`[patchmeta] ${patchIds.size} versões, ${validReactions.size} reações válidas`);
  } catch (err) {
    // Sem patchnotes/ no disco (ex.: imagem antiga) o jogo continua de pé;
    // as rotas de reação apenas recusam ids desconhecidos.
    console.error('[patchmeta] falha ao carregar patchnotes/:', err.message);
  }
}
