// ============================================================
// SUNFALL ARENA — Patch Notes: build do bundle do frontend
//
// Compila patchnotes/releases/*.json + registry.json no módulo
// public/patchnotes/data.js consumido pelo lobby. Roda dentro de
// `npm run build` (Vercel) e localmente antes de `npm start`.
// Calcula tempo de leitura e ordena da versão mais nova à mais
// antiga. Falha alto em dados inválidos — melhor quebrar o build
// do que publicar patch notes quebrados.
// ============================================================
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ROOT, loadRegistry, loadReleases, validateReleases, color } from './lib.js';

const registry = await loadRegistry();
const releases = await loadReleases();

const problems = validateReleases(releases, registry);
if (problems.length) {
  console.error(color.red(color.bold('✖ Build de patch notes abortado:')));
  for (const p of problems) console.error(color.red(`  - ${p}`));
  process.exit(1);
}

// ~180 palavras/min é leitura confortável em PT-BR
function readMinutes(r) {
  const text = [
    r.title, r.subtitle, r.summary, ...(r.body || []), r.motivation, r.impact,
    r.notes, r.techNotes, r.footer,
    ...(r.cards || []).flatMap(c => [c.title, c.desc, c.impact])
  ].filter(Boolean).join(' ');
  return Math.max(1, Math.round(text.split(/\s+/).length / 180));
}

const out = {
  generatedAt: new Date().toISOString(),
  currentVersion: releases[0]?.id || 'v0.0.0',
  registry,
  releases: releases.map(({ _file, _draft, _rawCommits, ...r }) => ({ ...r, readMinutes: readMinutes(r) }))
};

await mkdir(join(ROOT, 'public', 'patchnotes'), { recursive: true });
const js = `// GERADO AUTOMATICAMENTE por scripts/patchnotes/build.js — não edite à mão.
// Fonte: patchnotes/releases/*.json
export const PATCH_DATA = ${JSON.stringify(out, null, 2)};
`;
await writeFile(join(ROOT, 'public', 'patchnotes', 'data.js'), js, 'utf8');
console.log(color.green(`[build] patch notes: ${out.releases.length} versões → public/patchnotes/data.js (atual: ${out.currentVersion})`));
