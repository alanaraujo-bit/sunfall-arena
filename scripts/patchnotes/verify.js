// ============================================================
// SUNFALL ARENA — Patch Notes: verificador de consistência
//
// Garante a regra permanente do projeto: NENHUMA mudança existe
// sem patch note correspondente. Roda como:
//   • gate de deploy  → npm run deploy (via "predeploy"), exit 1 bloqueia
//   • aviso pós-commit → .githooks/post-commit (--hook, nunca bloqueia)
// ============================================================
import { loadRegistry, loadReleases, validateReleases, coverage, color } from './lib.js';

const hookMode = process.argv.includes('--hook');

const registry = await loadRegistry();
const releases = await loadReleases({ includeDrafts: true });

const problems = validateReleases(releases.filter(r => !r._draft), registry);
const drafts = releases.filter(r => r._draft);
const uncovered = coverage(releases);

let failed = false;

if (problems.length) {
  failed = true;
  console.error(color.red(color.bold('\n✖ Patch notes com problemas de formato:')));
  for (const p of problems) console.error(color.red(`  - ${p}`));
}

if (drafts.length) {
  failed = true;
  console.error(color.yellow(color.bold('\n✖ Rascunhos pendentes (escreva e renomeie para vX.Y.Z.json):')));
  for (const d of drafts) console.error(color.yellow(`  - patchnotes/releases/${d._file}`));
}

if (uncovered.length) {
  failed = true;
  console.error(color.red(color.bold('\n✖ Commits SEM patch note (inconsistência do projeto):')));
  for (const c of uncovered) console.error(color.red(`  - ${c.short} ${c.date}  ${c.subject}`));
  console.error(`\n  Para resolver: ${color.bold('npm run notes:new')} gera um rascunho com esses commits;`);
  console.error('  escreva o texto (linguagem de jogador, nunca copie o commit) e rode de novo.');
}

if (failed) {
  if (hookMode) {
    console.error(color.yellow(color.bold('\n⚠ AVISO: o deploy ficará BLOQUEADO até os patch notes serem atualizados.\n')));
    process.exit(0); // pós-commit nunca impede o commit — só avisa alto
  }
  console.error(color.red(color.bold('\n⛔ Deploy bloqueado: atualize os patch notes antes de publicar.\n')));
  process.exit(1);
}

console.log(color.green(`✔ Patch notes consistentes — ${releases.length} versões publicadas, nenhum commit descoberto.`));
