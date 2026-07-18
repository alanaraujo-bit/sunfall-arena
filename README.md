# 🌅 Sunfall Arena

FPS multiplayer competitivo para navegador, inspirado em **krunker.io**, com direção de arte estilizada (hand-painted): vila desértica ao entardecer, texturas pintadas proceduralmente, iluminação quente e alta legibilidade.

## Como rodar

```bash
npm install
npm start
```

Abra **http://localhost:3000** no navegador (requer internet para o CDN do Three.js).

- **Multiplayer local:** abra várias abas/janelas.
- **Multiplayer em rede:** compartilhe `http://SEU_IP:3000` com quem estiver na mesma rede.
- A arena já tem **3 bots** patrulhando para a partida nunca ficar vazia.

## Controles

| Tecla | Ação |
|---|---|
| WASD | Mover |
| Espaço | Pular |
| Shift | Deslizar (mantém velocidade, pode encadear com pulo) |
| Botão esq. | Atirar |
| Botão dir. | Luneta (sniper) |
| 1 / 2 / roda | Trocar arma (FALCÃO-9 / FERRÃO-SR) |
| R | Recarregar |
| Tab | Placar |
| Esc | Pausar |

## Arquitetura

```
server/              servidor HTTP + WebSocket, dano/kills autoritativos, bots
shared/mapdata.js    física genérica de mapa (AABB, raycast) — cliente/servidor
shared/maps/         registry de mapas: canion (mapa 1) e ocaso (mapa 2, em obras)
public/js/main.js    loop do jogo, movimentação, tiro, HUD, rede
public/js/world.js   construção visual do Cânion, personagens, armas
public/js/world-ocaso.js construção visual do Ocaso (blockout em progresso)
public/js/textures.js texturas hand-painted geradas via canvas
public/js/audio.js   SFX procedural via WebAudio
design/              documentos de level design (mapa-02-ocaso.md)
```

Cada sala roda um mapa (`room.map`); salas personalizadas escolhem o mapa no lobby.

Sem assets externos: todas as texturas e sons são gerados em tempo de execução.
