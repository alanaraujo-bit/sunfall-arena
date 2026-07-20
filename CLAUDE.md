# Sunfall Arena — regras do projeto

FPS multiplayer de navegador. Backend: Express + WebSocket no Fly.io (GRU) + Postgres (Railway). Frontend: vanilla JS servido pela Vercel. Deploy: `npm run deploy` (SEMPRE Fly E Vercel — push não deploya nada).

## 📜 REGRA PERMANENTE: Patch Notes obrigatórios

**Nenhuma mudança existe sem patch note.** Isso é memória permanente da arquitetura:

1. Toda alteração de código/conteúdo deve ser documentada em `patchnotes/releases/vX.Y.Z.json` — um arquivo por versão, cobrindo os hashes no campo `commits` (ou no mesmo commit da mudança, que se autodocumenta ao tocar `patchnotes/releases/`).
2. O texto é SEMPRE reescrito para o jogador, em PT-BR, tom de community manager (o que mudou, por que, como, impacto). **Nunca copiar mensagem de commit.**
3. `npm run notes:new` gera rascunho com os commits descobertos; `npm run notes:verify` valida; o **deploy é bloqueado** (`predeploy`) se houver commit sem patch note ou rascunho pendente.
4. Hook `.githooks/post-commit` avisa na hora (requer `git config core.hooksPath .githooks` após clonar).
5. Categorias/estados/tipos válidos: `patchnotes/registry.json`. Versionamento: MAJOR = novo mapa/pilar do jogo; MINOR = sistema/conteúdo novo; PATCH = correções/ajustes/técnico.
6. Atualizações **avançadas** (`tier: "advanced"`) = artigo completo (novos sistemas, mapas, reworks). **Básicas** (`tier: "basic"`) = compactas (fixes, ajustes, otimizações).

## Convenções

- Textos voltados ao jogador em PT-BR; nomes de armas/mapas em caixa alta (FALCÃO-9, Ocaso).
- Servidor é autoridade em tudo que afeta gameplay; validação e rate limit em toda rota pública.
- `shared/` é copiado para `public/shared/` no build; `public/patchnotes/data.js` é gerado no build (ambos fora do git).
- Segredos só via env (Fly secrets): `DATABASE_URL`, `JWT_SECRET`, `DISCORD_WEBHOOK_URL` (ver `.env.example`).
