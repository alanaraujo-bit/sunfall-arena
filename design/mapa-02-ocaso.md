# OCASO — Mapa 02 de Sunfall Arena

> **Status:** proposta de level design — aguardando aprovação do layout.
> **Documento-irmão:** `Direção de Arte` (raiz do projeto) — este design aplica aquelas diretrizes.

---

## 1. Identidade

**Ocaso** é uma antiga vila de peregrinos construída em **três terraços na encosta de um
desfiladeiro**, no caminho do Templo do Sol Poente. Quando veios de cristal-de-sol foram
descobertos sob o templo, a vila virou entreposto de minério: o mercado cresceu na parte
baixa, o aqueduto foi reativado para lavar o cristal, e a mina abriu um túnel por baixo do
santuário. Com o colapso da mina, a vila foi abandonada — e a Arena a ocupou.

Cada construção existe por um motivo: casas de peregrino, a oficina do ferreiro, o mercado,
a cisterna, a capela, a torre do sino, o aqueduto. Nada é "caixa de arena".

**Hora do dia:** poente. O sol está baixo no **oeste**, as sombras apontam para o leste —
bússola natural do jogador. O cristal do altar brilha teal acima dos telhados — farol
visível de quase todo o mapa.

**Não copiamos layout de nenhum mapa clássico.** O que trazemos deles são princípios:
- 3 faixas de combate com conectores (controle de meio = controle de mapa);
- um marco visual por zona + material dominante por zona (orientação instantânea);
- linhas longas **quebradas** por geometria (seguráveis, mas escapáveis);
- verticalidade com risco (posição alta = acesso exposto);
- fluxo em anel, sem becos mortos (essencial para FFA/TDM, nossos modos).

---

## 2. Convenções

- Norte = **−Z**, leste = **+X** (mesma convenção do mapa 1).
- Área jogável ≈ **92×92 m** (x, z ∈ [−44, 44]), borda de paredões orgânicos (nada de arena quadrada).
- Física atual respeitada: degrau máx. 0,95 m; pulo ≈ 1,6 m; velocidade 8,2 m/s.
- Rampas = colisores em degraus finos (0,30 × 0,42) cobertos por malha visual inclinada → sensação de rampa lisa.

## 3. Os três terraços

| Terraço | Faixa Z | Piso (Y) | Papel de combate | Alcance dominante |
|---|---|---|---|---|
| **Mercado** (baixa) | z ∈ [10, 44] | 0,0 | rua principal, trocas médias | médio-longo |
| **Vila** (média) | z ∈ [−16, 10] | 2,6 | casario denso, CQC, hub central | curto-médio |
| **Templo** (alta) | z ∈ [−44, −16] | 5,2 | colunata longa, controle de sniper | longo |
| Torre do Sino | (26, −36) | 8,8 | posição de poder, acesso exposto | longo |

Os muros de arrimo entre terraços (2,6 m) são intransponíveis por pulo — a circulação
vertical acontece **apenas** nos conectores projetados (seção 5).

## 4. Pontos de interesse (chamadas naturais)

| Chamada | Centro aprox. (x, z) | Nível | O que é |
|---|---|---|---|
| **Portão** | (−38, 26) | 0 | arco de entrada oeste da vila, spawn oeste |
| **Mercado** | rua em z ≈ 22, x −36→30 | 0 | rua principal com bancas e toldos |
| **Arcos** | z ≈ 16, x −20→18 | 0 | arcada coberta no lado norte da rua |
| **Fonte** | (33, 22) | 0 | praça leste com poço/fonte |
| **Aqueduto** | canal x ≈ 39, z 14→−18 | 0→5,2 | rampa leste jogável dentro do canal (muretas 0,9) |
| **Escadaria** | x −30→−24, z 16→−16 | 0→5,2 | escadaria monumental oeste, artéria de rotação |
| **Beco** | x 2→6, z 12→−4 | 0→2,6 | viela em zigue-zague, choke de CQC |
| **Ferreiro** | (−12, 4) | 0 e 2,6 | casa com interior: térreo na rua, andar na Vila, varanda sobre o Mercado |
| **Pátio** | (0, −6) | 2,6 | pátio da cisterna, hub central do mapa |
| **Longa** | colunata z ≈ −22, x −34→34 | 5,2 | lane longa do Templo, colunas a cada ~7 m |
| **Altar** | (0, −35) | 5,2 | altar do cristal — marco central do mapa |
| **Torre** | (26, −36) | 8,8 | torre do sino, ninho de sniper |
| **Mina** | boca (−35, −4) → saída (−31, −27) | 2,6→5,2 | túnel sob o templo, flanco escuro |
| **Mirante** | borda norte, atrás do Altar | 5,2 | abertura no paredão com vista do desfiladeiro (neblina) |

## 5. Conectores verticais (a alma do fluxo)

1. **Escadaria** (oeste) — larga, 2 lances com patamares. Rotação principal Mercado↔Vila↔Templo.
2. **Aqueduto** (leste) — rampa contínua dentro do canal, muretas na altura do joelho como
   cobertura. Flanco leste; quem sobe aparece na ponta leste da Longa.
3. **Beco** (centro) — degraus apertados Mercado→Pátio. Choke curto, ideal para granada/fumaça.
4. **Ferreiro** (centro-oeste) — rota **interna**: porta no Mercado, escada dentro da casa,
   saída na Vila + janela/varanda dominando a rua (posição forte com contra-jogo por 2 lados).
5. **Mina** (oeste-norte) — túnel com escoras de madeira e veios de cristal; sai por escada
   no flanco oeste da Longa. Rota de surpresa, som de passos denuncia.
6. **Torre** — único "beco sem saída" do mapa, de propósito: escada externa exposta na face
   oeste. Poder de fogo em troca de vulnerabilidade ao subir/descer.

**Anel externo:** Portão → Mercado → Fonte → Aqueduto → Longa → Escadaria → Portão.
**Cruzes internas:** Beco, Ferreiro, Mina. Toda zona tem ≥ 3 saídas (exceto Torre).

## 6. Linhas de visão e timing

| Linha | Comprimento | Quebra |
|---|---|---|
| Longa do Templo | ~68 m | colunas a cada ~7 m + altar no centro-norte |
| Rua do Mercado | ~66 m nominais | bancas, toldos e arco central → efetivos ~40 m |
| Escadaria | ~25 m em diagonal | patamares e muretas |
| Aqueduto | ~30 m em canal | curvatura leve + muretas |
| Pátio | ~20 m abertos | cisterna central + arcos |

- **Assimetria de sol (regra do mapa):** quem mira para o **oeste** na Longa ou na rua olha
  contra o poente (leve glare no céu) — segurar ângulo de costas para o sol é mais forte.
  Decisão tática de graça, custo zero de performance.
- **Torre** vê a Longa e uma fatia do Pátio; **não** vê o Mercado (linha de telhados bloqueia).
- Travessia diagonal completa ≈ 11 s; spawn→primeiro contato ≈ 4–7 s; zona→zona 3–6 s.

## 7. Spawns, barris e patrulha

**Spawns (10)** — perímetro das três faixas, nenhum dentro de linha longa
(formato `[x, z, y]` — spawns em terraço têm altura!):

```
(−38, 29, 0)   Portão            (35, 27, 0)   Fonte
(14, 27, 0)    Mercado-leste     (39, 10, 0)   base do Aqueduto
(−19, −1, 2.6) Vila-oeste        (3, 3, 2.6)   Pátio-sul
(−36, −8, 2.6) boca da Mina      (−36, −32, 5.2) Templo-oeste
(0, −41, 5.2)  atrás do Altar    (33, −20, 5.2)  Templo-leste
```

**Barris explosivos (4):** entre bancas do Mercado (−6, 24); canto do Pátio (8, −11);
dentro da Mina (−33, −14); topo do Aqueduto (38, −15).

**Patrulha de bots:** waypoints por terraço + conectores, com altura de piso por ponto
(bots precisam saber o Y do chão — ver Fase 1).

## 8. Direção de arte aplicada (resumo executável)

Identidade de material **por zona** (leitura instantânea de onde estou):

| Zona | Material dominante | Acento |
|---|---|---|
| Mercado | reboco envelhecido c/ tijolo exposto, calçamento | toldos coral/creme |
| Vila | arenito aparelhado + madeira escura | portas e cerâmica teal |
| Templo | pedra clara monumental c/ entalhes | frisos dourado + cristal teal |

Saltos técnicos vs. mapa 1 (o fim do visual "brinquedo"):

1. **Normal maps + roughness maps procedurais** (canvas altura→normal). Maior upgrade
   visual individual — junta de pedra, veio de madeira e reboco descascado passam a
   reagir à luz.
2. **Kit modular de arquitetura** (funções: parede c/ abertura real, arco, janela com
   moldura recuada, porta em vão, beiral com caibros, sacada com mãos-francesas, telhado
   de telha de barro, colunata, lance de escada). Portas e janelas são **vãos de verdade**,
   não decalques colados na parede.
3. **AO por vértice pré-calculado** no load (raycast contra colisores) — profundidade de
   sombra em cantos e frestas, custo zero em runtime.
4. **Decalques de transição** (areia acumulada na base das paredes, escorrido de umidade
   sob o aqueduto, fuligem, trilhas de carroça) — o que mata a cara de protótipo.
5. **Céu v2 do poente** + silhueta de desfiladeiro distante em camadas + neblina quente;
   sol direcional baixo do oeste + luz fria fraca de leste (bounce falso).
6. **Vegetação integrada:** buganvília nas paredes, capim seco entre pedras, oliveiras
   pequenas no Pátio, trepadeiras no aqueduto — nunca árvore aleatória no meio do caminho.

**Performance:** mesma estratégia do mapa 1 (merge por material) — alvo ≤ 60 draw calls;
texturas 512/1024 conforme qualidade; sombra 1024/2048; máx. 2–3 point lights (cristal,
forja, lanterna) só em qualidade alta.

## 9. Plano de fases (cada uma aprovada e em produção antes da próxima)

| Fase | Entrega | Critério de "pronto" |
|---|---|---|
| **1. Infra multi-mapa** | registry de mapas (`shared/maps/`), sala com campo `map`, `buildWorld(scene, mapKey)`, física/bots/spawns parametrizados (spawn com Y!), seletor de mapa em sala personalizada | mapa 1 continua 100% jogável; sala custom escolhe mapa |
| **2. Blockout do Ocaso** | todos os colisores, spawns, patrulha, barris; materiais placeholder | fluxo testável em produção, timings conferidos |
| **3. Arquitetura** | kit modular + todas as construções com profundidade real, interiores | nenhuma "caixa" à vista |
| **4. Materiais v2** | texturas novas c/ normal/roughness, decalques | materiais lêem como reais |
| **5. Props e vida** | mercado, cordas, lanternas, cisterna, vegetação | densidade sem poluir gameplay |
| **6. Luz e atmosfera** | rig do poente, AO por vértice, céu v2, Mirante | screenshot digna de divulgação |
| **7. Polimento** | auditoria de draw calls, tuning de playtest, ajustes finos | 60 fps em máquina intermediária |

### Notas técnicas da Fase 1 (o que muda no código)

- `shared/mapdata.js` → só física genérica (`PLAYER`, `rayBox`, `raycastSolids(bounds, …)`,
  `pushOut(bounds, LIM, …)`).
- `shared/maps/canion.js` (mapa 1 extraído como está) + `shared/maps/ocaso.js` +
  `shared/maps/index.js` (`MAPS = { canion, ocaso }`, cada um com `SOLIDS/BOUNDS/SPAWNS/
  PATROL/BARRELS/LIM/nome`).
- `spawnPos` deixa de assumir `y: 0` (spawns `[x, z, y]`).
- `rooms.js`: sala ganha `map` (públicas → `ocaso`; custom → seletor no lobby).
- Cliente: `world.js` vira dispatcher; visual do mapa 1 intocado; `world-ocaso.js` novo.
- `scripts/copy-shared.js` passa a copiar a pasta `maps/`.
