// ============================================================
// SUNFALL ARENA — Patch Notes: biblioteca compartilhada
// Fonte da verdade: patchnotes/releases/*.json (um arquivo por
// versão). Estes helpers são usados pelo verificador (gate de
// deploy), pelo gerador de rascunhos e pelo build do frontend.
// ============================================================
import { execFileSync } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join } from 'path';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const RELEASES_DIR = join(ROOT, 'patchnotes', 'releases');
export const REGISTRY_PATH = join(ROOT, 'patchnotes', 'registry.json');

// Commits que só tocam nestes caminhos não precisam de patch note
// próprio (documentação, arte conceitual, o próprio sistema de notas).
export const EXEMPT_PATHS = [
  'patchnotes/',
  'docs/',
  'design/',
  'Direção de Arte/',
  '.githooks/',
  '.gitignore',
  'README.md',
  'CLAUDE.md',
  'MEMORY.md'
];

const REQUIRED_FIELDS = [
  'id', 'version', 'build', 'title', 'subtitle', 'date', 'time',
  'author', 'type', 'tier', 'summary', 'body', 'impact', 'commits', 'cards'
];
const CARD_REQUIRED = ['category', 'state', 'title', 'desc'];

export async function loadRegistry() {
  return JSON.parse(await readFile(REGISTRY_PATH, 'utf8'));
}

export async function loadReleases({ includeDrafts = false } = {}) {
  const files = (await readdir(RELEASES_DIR))
    .filter(f => f.endsWith('.json'))
    .filter(f => includeDrafts || !f.startsWith('DRAFT'));
  const releases = [];
  for (const file of files) {
    const raw = await readFile(join(RELEASES_DIR, file), 'utf8');
    let data;
    try { data = JSON.parse(raw); }
    catch (err) { throw new Error(`JSON inválido em patchnotes/releases/${file}: ${err.message}`); }
    releases.push({ ...data, _file: file, _draft: file.startsWith('DRAFT') });
  }
  releases.sort((a, b) => (b.build || 0) - (a.build || 0));
  return releases;
}

// Valida o schema de todas as releases; retorna lista de problemas (vazia = ok).
export function validateReleases(releases, registry) {
  const problems = [];
  const seenVersions = new Set();
  const seenBuilds = new Set();
  for (const r of releases) {
    const where = `patchnotes/releases/${r._file}`;
    for (const f of REQUIRED_FIELDS) {
      if (r[f] === undefined || r[f] === null || r[f] === '') problems.push(`${where}: campo obrigatório ausente: "${f}"`);
    }
    if (r.id && !/^v\d+\.\d+\.\d+$/.test(r.id)) problems.push(`${where}: id deve ter formato vX.Y.Z (recebido "${r.id}")`);
    if (r.id && seenVersions.has(r.id)) problems.push(`${where}: versão duplicada ${r.id}`);
    seenVersions.add(r.id);
    if (r.build && seenBuilds.has(r.build)) problems.push(`${where}: build duplicado ${r.build}`);
    seenBuilds.add(r.build);
    if (r.tier && !['advanced', 'basic'].includes(r.tier)) problems.push(`${where}: tier inválido "${r.tier}"`);
    if (r.type && registry && !registry.types[r.type]) problems.push(`${where}: type inválido "${r.type}"`);
    if (!Array.isArray(r.body)) problems.push(`${where}: "body" deve ser um array de parágrafos`);
    if (!Array.isArray(r.commits)) problems.push(`${where}: "commits" deve ser um array de hashes`);
    for (const [i, c] of (r.cards || []).entries()) {
      for (const f of CARD_REQUIRED) {
        if (!c[f]) problems.push(`${where}: card #${i + 1} sem campo "${f}"`);
      }
      if (registry && c.category && !registry.categories[c.category]) problems.push(`${where}: card #${i + 1} categoria desconhecida "${c.category}"`);
      if (registry && c.state && !registry.states[c.state]) problems.push(`${where}: card #${i + 1} estado desconhecido "${c.state}"`);
    }
  }
  return problems;
}

// execFileSync (sem shell): imune a diferenças de quoting entre
// cmd.exe, PowerShell e sh — o formato do git contém "|" e "%".
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

// Todos os commits do repositório (mais antigo primeiro), com os
// arquivos tocados por cada um.
export function gitCommits() {
  const out = git(['log', '--reverse', '--name-only', '--pretty=format:@@%h|%H|%ad|%s', '--date=format:%Y-%m-%d %H:%M']);
  const commits = [];
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      const [short, full, date, ...subj] = line.slice(2).split('|');
      current = { short, full, date, subject: subj.join('|'), files: [] };
      commits.push(current);
    } else if (line.trim() && current) {
      current.files.push(line.trim());
    }
  }
  return commits;
}

function isExempt(commit) {
  if (!commit.files.length) return true; // merges sem diff próprio
  return commit.files.every(f => EXEMPT_PATHS.some(p => f === p || f.startsWith(p)));
}

function touchesReleases(commit) {
  return commit.files.some(f => f.startsWith('patchnotes/releases/'));
}

// Regra de cobertura — um commit está documentado quando:
//  a) o hash consta no campo "commits" de alguma release; ou
//  b) o próprio commit alterou patchnotes/releases/ (se autodocumenta); ou
//  c) só toca em caminhos isentos (docs, arte, o próprio sistema de notas).
export function coverage(releases) {
  const covered = new Set();
  for (const r of releases) for (const h of r.commits || []) covered.add(String(h).slice(0, 7));
  const uncovered = [];
  for (const c of gitCommits()) {
    if (covered.has(c.short) || covered.has(c.full.slice(0, 7))) continue;
    if (touchesReleases(c)) continue;
    if (isExempt(c)) continue;
    uncovered.push(c);
  }
  return uncovered;
}

export const color = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`
};
