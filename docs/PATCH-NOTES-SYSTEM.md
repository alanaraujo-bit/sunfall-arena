# 📜 Central da Comunidade — Patch Notes, Sugestões e Reporte de Bugs

Documentação completa do sistema introduzido na **v2.4.0**. Cobre arquitetura, fluxos, operação diária e manutenção.

---

## 1. Visão geral

A aba **NOVIDADES** do lobby é um hub com três áreas:

| Aba | O que faz |
|---|---|
| 📜 **Patch Notes** | Histórico completo de versões com leitor em artigo, timeline, busca, filtros, fixados, favoritos, reações com contador e link compartilhável |
| 💡 **Sugestões** | Formulário de ideias/melhorias/elogios → banco + Discord |
| 🐛 **Reportar Bug** | Formulário profissional com coleta automática de dados técnicos → banco + Discord |

**Regra permanente do projeto:** nenhuma mudança existe sem patch note. O deploy é **bloqueado** se houver commit não documentado (ver §4).

---

## 2. Arquitetura

```
patchnotes/
  registry.json            categorias, estados, tipos e reações válidas (fonte única)
  releases/vX.Y.Z.json     UMA release por arquivo — a fonte da verdade do conteúdo
scripts/patchnotes/
  lib.js                   helpers: git log, cobertura, validação de schema
  new.js                   gera rascunho (DRAFT-*.json) dos commits descobertos
  verify.js                gate de deploy + aviso pós-commit (--hook)
  build.js                 compila tudo → public/patchnotes/data.js (gerado, fora do git)
.githooks/post-commit      avisa na hora se o commit ficou sem patch note
server/
  routes/community.routes.js  reações, favoritos, sugestões, bugs (validação + rate limit)
  services/discord.js         embeds do webhook (DISCORD_WEBHOOK_URL)
  services/patchmeta.js       carrega ids/reações válidas de patchnotes/ p/ validação
  ratelimit.js                janela deslizante em memória
public/js/updates/
  index.js                 controlador do hub (abas, estado social, selo NOVO)
  patchnotes.view.js       feed, leitor, timeline, filtros, busca, reações, favoritos
  feedback.view.js         formulário de sugestões
  bugreport.view.js        formulário de bug + coleta de dados técnicos
  api.js / store.js / components.js  cliente HTTP, localStorage/sysinfo, utilitários
```

**Banco (Postgres/Railway)** — criadas automaticamente por `migrate()`:

- `patch_reactions (patch_id, emoji, actor)` — reação única por pessoa/emoji/versão
- `patch_favorites (patch_id, actor)` — favoritos
- `community_submissions (kind, user_id, username, payload JSONB, …)` — sugestões e bugs

`actor` = `u:<id>` (conta) ou `a:<uuid>` (convidado — UUID gerado no navegador, header `x-sf-anon`). Assim **todo mundo** pode reagir/favoritar, sem duplicar.

---

## 3. Fluxo dos dados

```
git commit ──► .githooks/post-commit ──► verify.js --hook (aviso)
                                              │
escreve/edita patchnotes/releases/vX.Y.Z.json │
                                              ▼
npm run deploy ──► predeploy: verify.js (BLOQUEIA se inconsistente)
                             + build.js  ──► public/patchnotes/data.js
                   fly deploy (backend + patchnotes/ na imagem)
                   vercel deploy --prod (frontend + data.js)
```

No cliente: `data.js` é importado estaticamente; reações/favoritos chegam do servidor em **uma** chamada (`GET /api/patchnotes/social`) quando o hub abre.

---

## 4. Como publicar uma nova versão (fluxo diário)

1. Faça a mudança no código e o commit normalmente.
2. O hook avisa: *"commits SEM patch note"*. Rode:
   ```bash
   npm run notes:new
   ```
   Isso cria `patchnotes/releases/DRAFT-<data>-buildN.json` com os commits descobertos em `_rawCommits`.
3. Escreva a nota **em linguagem de jogador** (nunca copie o commit): título, subtítulo, resumo, corpo, motivação, impacto, cards. Defina `id`/`version` e **renomeie o arquivo** para `vX.Y.Z.json`. Remova `_rawCommits`.
4. Valide e publique:
   ```bash
   npm run notes:verify   # deve ficar verde
   npm run deploy         # bloqueia sozinho se algo estiver inconsistente
   ```

Alternativa (fluxo preferido): escreva o `vX.Y.Z.json` **no mesmo commit** da mudança — commits que tocam `patchnotes/releases/` se autodocumentam.

**Versionamento:** MAJOR = novo mapa/pilar do jogo · MINOR = sistema/conteúdo novo · PATCH = correções/ajustes/técnico. `build` é sequencial e único.

**Isenções:** commits que só tocam `patchnotes/`, `docs/`, `design/`, `Direção de Arte/`, `.githooks/`, `README.md`, `CLAUDE.md` não exigem nota.

---

## 5. Schema de uma release

```jsonc
{
  "id": "v2.5.0",            // vX.Y.Z — também é o id público (deep-link ?patch=)
  "version": "2.5.0",
  "build": 29,                // sequencial, único
  "title": "…",              "subtitle": "…",
  "date": "2026-07-21",      "time": "18:30",
  "author": "Equipe Sunfall",
  "type": "major|feature|patch|hotfix|tech",
  "tier": "advanced|basic",  // advanced = artigo completo; basic = nota compacta
  "pinned": false,            // true = fixada no topo do feed
  "summary": "…",            // caixa RESUMO do artigo
  "body": ["parágrafo 1", "parágrafo 2"],
  "motivation": "…",         "impact": "…",
  "notes": "",                "techNotes": "",   // opcionais
  "footer": "…",             // assinatura no fim do artigo
  "media": [                  // anexos (opcional)
    { "type": "image", "src": "/img/x.jpg", "caption": "…" },
    { "type": "video", "src": "/img/x.mp4" },
    { "type": "compare", "before": "/img/a.jpg", "after": "/img/b.jpg" }
  ],
  "commits": ["abc1234"],    // hashes cobertos (curtos)
  "cards": [{
    "category": "gameplay",  // chave de registry.json → categories
    "state": "new",          // new|improved|fixed|removed|balanced|optimized|experimental
    "title": "…", "desc": "…",
    "impact": "…",           // opcional — linha em itálico
    "tags": ["tag1"],        // opcionais
    "icon": "🗡️"             // opcional — sobrepõe o emoji da categoria
  }]
}
```

O tempo de leitura (`readMinutes`) é **calculado no build** (~180 palavras/min).

---

## 6. Personalizar categorias, estados e reações

Edite `patchnotes/registry.json`:

- `categories` — chave, `label`, `emoji`, `color` (cor do card/filtro)
- `states` — selo do card (NOVO, CORRIGIDO…)
- `types` — selo da release (GRANDE ATUALIZAÇÃO…)
- `reactions` — lista de emojis aceitos (o servidor valida contra esta lista)

Frontend e backend leem o mesmo arquivo — mudou aqui, mudou em todo lugar após `npm run build` + deploy.

## 7. Editar estilos

Todo o CSS vive em `public/style.css`, seção **"NOVIDADES — Central da Comunidade"** (final do arquivo). Prefixos: `.up-*` (hub), `.pn-*` (patch notes), `.fb-*` (formulários), `.bg-*` (bug report). Paleta: fundo `#1a120c`, texto `#f2e3c8`, dourado `#f0c04c`, teal `#3fc8b4`.

---

## 8. Configurar o webhook do Discord

1. No Discord: *Configurações do canal → Integrações → Webhooks → Novo webhook* → copie a URL.
2. No Fly:
   ```bash
   fly secrets set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/…" -a sunfall-arena
   ```
3. Local (opcional): copie `.env.example` para `.env`.

Sem a variável, o jogo funciona normalmente — envios ficam **apenas no banco** (`community_submissions`) e o servidor loga um aviso único. As mensagens usam embeds com cor por gravidade, campos organizados e `allowed_mentions` vazio (conteúdo de jogador nunca pinga @everyone).

### Anúncios automáticos de patch notes (segundo webhook)

`DISCORD_PATCHNOTES_WEBHOOK_URL` aponta para o canal de **anúncios**. A cada boot do servidor (todo deploy reinicia a máquina), `server/services/announcer.js` compara as releases de `patchnotes/` com a tabela `patch_announcements` e anuncia o que for novo — resumo, até 3 destaques e link `?patch=` para ler a nota completa no jogo (`GAME_URL`, padrão vercel.app).

- **Dedupe no banco**: cada versão anuncia UMA vez, mesmo com N reinícios.
- **Primeiro uso**: o histórico é selado sem postar (sem flood); só a versão mais recente é anunciada.
- **Falha do Discord**: a reserva é desfeita e o próximo boot tenta de novo.
- Fluxo normal: escreveu a release → `npm run deploy` → anúncio sai sozinho. Nada manual.

---

## 9. Segurança e antispam

- **Validação** de todos os campos no servidor (enums, tamanhos mínimo/máximo, formato de versão).
- **Sanitização**: remoção de caracteres de controle + limites de tamanho por campo.
- **Rate limit** em memória: 40 ações sociais/min por IP; 5 envios/10 min por IP (HTTP 429 com mensagem amigável na UI).
- Reações só aceitam emojis do registry e ids de versão existentes.
- `ip_hash` (SHA-256) é armazenado para auditoria antiabuso — nunca o IP puro.

## 10. Manutenção

- **Novo clone do repositório:** rode `git config core.hooksPath .githooks` (documentado no CLAUDE.md).
- **`npm run notes:verify` falhou no deploy:** leia a lista de commits descobertos e siga §4.
- **Selo NOVO não some:** o estado de leitura fica em `localStorage` (`sf_pn_read`); limpar dados do site zera.
- **Dados sociais:** agregados por versão; deletar uma release do repositório não apaga reações no banco (ficam órfãs e inofensivas).
- **Imagem Docker:** o Dockerfile copia `patchnotes/` — necessário para o servidor validar ids/reações.
