// ============================================================
// SUNFALL ARENA — Patch Notes: gerador de rascunho
//
// Lê o histórico do Git, encontra commits ainda não documentados
// e cria um rascunho estruturado em patchnotes/releases/DRAFT-*.json
// com os metadados prontos (data, hora, build, hashes).
//
// O rascunho NUNCA copia a mensagem de commit para o texto final:
// os commits entram como matéria-prima em "_rawCommits" e o texto
// deve ser reescrito em linguagem de jogador (tom de community
// manager) antes de renomear o arquivo para vX.Y.Z.json.
// ============================================================
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { RELEASES_DIR, loadReleases, coverage, color } from './lib.js';

const releases = await loadReleases({ includeDrafts: true });
const uncovered = coverage(releases);

if (!uncovered.length) {
  console.log(color.green('✔ Nada a fazer: todos os commits já possuem patch note.'));
  process.exit(0);
}

const maxBuild = Math.max(0, ...releases.map(r => r.build || 0));
const last = uncovered[uncovered.length - 1];
const [date, time] = [last.date.slice(0, 10), last.date.slice(11)];

const draft = {
  id: 'vX.Y.Z',
  version: 'X.Y.Z',
  build: maxBuild + 1,
  title: 'TODO — título voltado ao jogador',
  subtitle: 'TODO — subtítulo em uma frase',
  date,
  time,
  author: 'Equipe Sunfall',
  type: 'feature',
  tier: 'basic',
  pinned: false,
  summary: 'TODO — resumo de 1 a 2 frases do que esta atualização traz.',
  body: ['TODO — descrição geral em parágrafos, explicando o que mudou, por que mudou e como mudou.'],
  motivation: 'TODO — por que fizemos esta mudança.',
  impact: 'TODO — o que muda na prática para quem joga.',
  notes: '',
  techNotes: '',
  footer: 'Nos vemos na arena! — Equipe Sunfall',
  media: [],
  commits: uncovered.map(c => c.short),
  cards: uncovered.map(c => ({
    category: 'improvements',
    state: 'improved',
    title: 'TODO — reescreva para o jogador',
    desc: 'TODO — explique a mudança e o porquê, sem jargão.',
    impact: 'TODO — efeito prático em uma frase.',
    tags: []
  })),
  _rawCommits: uncovered.map(c => `${c.short} ${c.date} ${c.subject}`)
};

const file = `DRAFT-${date}-build${maxBuild + 1}.json`;
await writeFile(join(RELEASES_DIR, file), JSON.stringify(draft, null, 2) + '\n', 'utf8');

console.log(color.bold(`\n📝 Rascunho criado: patchnotes/releases/${file}`));
console.log(`   Commits incluídos (${uncovered.length}):`);
for (const c of uncovered) console.log(`   - ${c.short}  ${c.subject}`);
console.log(`\n   Próximos passos:`);
console.log(`   1. Escreva título, resumo, corpo e cards em linguagem de jogador.`);
console.log(`   2. Defina a versão (vX.Y.Z) e renomeie o arquivo para ela.`);
console.log(`   3. Remova o campo "_rawCommits" e rode ${color.bold('npm run notes:verify')}.`);
