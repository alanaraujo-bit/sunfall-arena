// ============================================================
// SUNFALL ARENA — Catálogo do Arsenal
// Identidade e ficha técnica das armas. Fonte única de verdade
// para a tela do Arsenal (vitrine). O combate ainda usa a tabela
// própria em main.js/ws.js — a integração de loadout virá depois.
// ============================================================

// Cada arma:
//   id, name (comercial), internal, maker, year, cls (classe), role,
//   icon, accent (cor de destaque), model (chave do modelo 3D | null),
//   locked (não equipável ainda),
//   desc / philosophy / trivia[] (identidade),
//   core[]  — 6 atributos com barra (v: 0..100),
//   spec[]  — ficha técnica em texto (d: valor exibido)

export const ARSENAL = [
  {
    id: 'corvo',
    name: 'CORVO-A4',
    internal: 'AD-A4 “Corvo”',
    maker: 'Atlas Dynamics',
    year: 2231,
    cls: 'Fuzil de Assalto',
    role: 'Versátil · todas as distâncias',
    icon: '🦅',
    accent: '#3fc8b4',
    model: 'corvo',
    locked: false,
    desc: 'Desenvolvido pela Atlas Dynamics para operações urbanas prolongadas, o CORVO-A4 virou referência entre as tropas da Orla Solar pelo equilíbrio quase perfeito entre controle, alcance e mobilidade. Não é o mais letal em nenhuma categoria — é o melhor em não ter fraqueza nenhuma.',
    philosophy: 'Confiabilidade acima de espetáculo. Cada peça foi projetada para funcionar coberta de poeira, sob sol de 50°C, depois de mil disparos sem manutenção.',
    trivia: [
      'O nome vem do corvo-do-deserto, única ave que os engenheiros da Atlas viam sobreviver no campo de testes.',
      'É a arma padrão de recrutas em Sunfall — dominar o CORVO é o primeiro passo de qualquer operador.',
      'A tampa de ejeção fecha sozinha por mola: nenhum grão de areia entra com a arma guardada.'
    ],
    core: [
      { k: 'Dano', v: 58 }, { k: 'Cadência', v: 66 }, { k: 'Alcance', v: 64 },
      { k: 'Precisão', v: 72 }, { k: 'Controle', v: 70 }, { k: 'Mobilidade', v: 60 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '2.3 s' },
      { k: 'Carregador', d: '30' },
      { k: 'Vel. do projétil', d: '880 m/s' },
      { k: 'Penetração', d: 'Média' },
      { k: 'Tempo p/ sacar', d: '0.50 s' },
      { k: 'Tempo p/ mirar (ADS)', d: '240 ms' },
      { k: 'Precisão parado', d: 'Alta' },
      { k: 'Precisão em movimento', d: 'Média' }
    ]
  },
  {
    id: 'vespa',
    name: 'VESPA-C1',
    internal: 'KO-C1 “Vespa”',
    maker: 'Kestrel Ordnance',
    year: 2233,
    cls: 'Submetralhadora',
    role: 'Curta distância · agressivo',
    icon: '🐝',
    accent: '#f0c04c',
    model: null,
    locked: true,
    desc: 'Leve, faminta e barulhenta. A VESPA despeja um enxame de projéteis a menos de dez metros — feita para quem entra na sala antes de pensar. Passou disso, cada disparo vira desperdício.',
    philosophy: 'Velocidade é sobrevivência. A Kestrel abriu mão de alcance e dano por grama de peso: sacar, mirar e correr com a VESPA é mais rápido do que com qualquer outra arma do arsenal.',
    trivia: [
      'A cadência é tão alta que o carregador de 25 esvazia em pouco mais de um segundo.',
      'Operadores apelidaram o som do disparo de "serra".'
    ],
    core: [
      { k: 'Dano', v: 40 }, { k: 'Cadência', v: 92 }, { k: 'Alcance', v: 34 },
      { k: 'Precisão', v: 52 }, { k: 'Controle', v: 48 }, { k: 'Mobilidade', v: 90 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '1.9 s' },
      { k: 'Carregador', d: '25' },
      { k: 'Vel. do projétil', d: '640 m/s' },
      { k: 'Penetração', d: 'Baixa' },
      { k: 'Tempo p/ sacar', d: '0.35 s' },
      { k: 'Tempo p/ mirar (ADS)', d: '170 ms' },
      { k: 'Precisão parado', d: 'Média' },
      { k: 'Precisão em movimento', d: 'Alta' }
    ]
  },
  {
    id: 'viuva',
    name: 'VIÚVA-XR',
    internal: 'MD-XR “Viúva”',
    maker: 'Meridian Defense',
    year: 2229,
    cls: 'Fuzil de Precisão',
    role: 'Longa distância · um tiro',
    icon: '🕷️',
    accent: '#b07ce0',
    model: null,
    locked: true,
    desc: 'Um disparo, uma decisão. A VIÚVA-XR entrega dano letal a qualquer distância que o olho alcance, mas cobra caro: entre um tiro e o próximo, você está exposto e lento. É a arma do jogador que erra pouco.',
    philosophy: 'A Meridian construiu a VIÚVA em torno do cano, não o contrário. Tudo — peso, ferrolho, luneta — existe para que o primeiro tiro seja o único necessário.',
    trivia: [
      'O ferrolho é polido à mão; cada VIÚVA leva o número de série gravado no interior da câmara.',
      'Dizem que a mira tem alcance maior que a própria arena.'
    ],
    core: [
      { k: 'Dano', v: 98 }, { k: 'Cadência', v: 14 }, { k: 'Alcance', v: 96 },
      { k: 'Precisão', v: 96 }, { k: 'Controle', v: 30 }, { k: 'Mobilidade', v: 26 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '3.2 s' },
      { k: 'Carregador', d: '5' },
      { k: 'Vel. do projétil', d: '1120 m/s' },
      { k: 'Penetração', d: 'Alta' },
      { k: 'Tempo p/ sacar', d: '0.75 s' },
      { k: 'Tempo p/ mirar (ADS)', d: '420 ms' },
      { k: 'Precisão parado', d: 'Extrema' },
      { k: 'Precisão em movimento', d: 'Baixa' }
    ]
  },
  {
    id: 'brecha',
    name: 'BRECHA-12',
    internal: 'TW-12 “Brecha”',
    maker: 'Talon Works',
    year: 2230,
    cls: 'Escopeta',
    role: 'Curtíssima distância · demolidora',
    icon: '💥',
    accent: '#f0844c',
    model: null,
    locked: true,
    desc: 'A resposta da Talon Works para portas trancadas e corredores estreitos. A BRECHA-12 apaga qualquer coisa a um braço de distância — e vira enfeite a partir de dez metros. Recarrega devagar: cada tiro precisa contar.',
    philosophy: 'Dano bruto, sem desculpas. A Talon nunca escondeu que a BRECHA é uma ferramenta de um único propósito: dominar o espaço fechado.',
    trivia: [
      'O nome "Brecha" vem do uso original: abrir passagem em estruturas.',
      'É a única arma do arsenal recarregada cartucho por cartucho.'
    ],
    core: [
      { k: 'Dano', v: 96 }, { k: 'Cadência', v: 30 }, { k: 'Alcance', v: 16 },
      { k: 'Precisão', v: 24 }, { k: 'Controle', v: 40 }, { k: 'Mobilidade', v: 56 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '0.6 s / cartucho' },
      { k: 'Carregador', d: '6' },
      { k: 'Vel. do projétil', d: '460 m/s' },
      { k: 'Penetração', d: 'Baixa' },
      { k: 'Tempo p/ sacar', d: '0.55 s' },
      { k: 'Tempo p/ mirar (ADS)', d: '260 ms' },
      { k: 'Precisão parado', d: 'Baixa (dispersão)' },
      { k: 'Precisão em movimento', d: 'Baixa (dispersão)' }
    ]
  },
  {
    id: 'muralha',
    name: 'MURALHA-M',
    internal: 'SI-M “Muralha”',
    maker: 'Solmark Industries',
    year: 2228,
    cls: 'Metralhadora (LMG)',
    role: 'Supressão · dano sustentado',
    icon: '🛡️',
    accent: '#8ac850',
    model: null,
    locked: true,
    desc: 'Um muro de fogo portátil. A MURALHA-M carrega munição para durar e não para de cuspir — mas é pesada, sobe muito no recuo e transforma quem a segura em alvo lento. Domina corredores; sofre em duelos rápidos.',
    philosophy: 'A Solmark projetou a MURALHA para negar terreno. Não se trata de acertar todo tiro — trata-se de fazer o inimigo não conseguir nem levantar a cabeça.',
    trivia: [
      'O cano aguenta 200 disparos contínuos antes de precisar esfriar.',
      'É a arma mais antiga do arsenal ainda em serviço ativo.'
    ],
    core: [
      { k: 'Dano', v: 62 }, { k: 'Cadência', v: 74 }, { k: 'Alcance', v: 60 },
      { k: 'Precisão', v: 44 }, { k: 'Controle', v: 30 }, { k: 'Mobilidade', v: 20 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '5.4 s' },
      { k: 'Carregador', d: '100' },
      { k: 'Vel. do projétil', d: '840 m/s' },
      { k: 'Penetração', d: 'Alta' },
      { k: 'Tempo p/ sacar', d: '0.95 s' },
      { k: 'Tempo p/ mirar (ADS)', d: '380 ms' },
      { k: 'Precisão parado', d: 'Média (aquece)' },
      { k: 'Precisão em movimento', d: 'Baixa' }
    ]
  },
  {
    id: 'sentinela',
    name: 'SENTINELA-DR',
    internal: 'VA-DR “Sentinela”',
    maker: 'Veyra Arms',
    year: 2232,
    cls: 'Fuzil Tático (DMR)',
    role: 'Média-longa · precisão',
    icon: '🎯',
    accent: '#5c9ce8',
    model: null,
    locked: true,
    desc: 'Meio-termo entre o fuzil e a sniper. A SENTINELA-DR premia quem mira na cabeça: cada disparo semiautomático castiga a média-longa distância com estabilidade rara. Nas mãos erradas, é lenta demais; nas certas, implacável.',
    philosophy: 'A Veyra acredita que precisão é uma escolha, não sorte. A SENTINELA foi calibrada para que dois toques limpos derrubem qualquer alvo — desde que você acerte.',
    trivia: [
      'O gatilho tem curso ajustável de fábrica em três estágios.',
      'Favorita dos jogadores que "seguram" pontos-chave da arena.'
    ],
    core: [
      { k: 'Dano', v: 80 }, { k: 'Cadência', v: 44 }, { k: 'Alcance', v: 82 },
      { k: 'Precisão', v: 88 }, { k: 'Controle', v: 62 }, { k: 'Mobilidade', v: 48 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '2.7 s' },
      { k: 'Carregador', d: '12' },
      { k: 'Vel. do projétil', d: '980 m/s' },
      { k: 'Penetração', d: 'Alta' },
      { k: 'Tempo p/ sacar', d: '0.6 s' },
      { k: 'Tempo p/ mirar (ADS)', d: '320 ms' },
      { k: 'Precisão parado', d: 'Muito alta' },
      { k: 'Precisão em movimento', d: 'Média' }
    ]
  }
];

// Slots de personalização (bloqueados nesta fase — só a moldura).
export const ATTACH_SLOTS = [
  { k: 'Mira', icon: '🔭' },
  { k: 'Cano', icon: '🧿' },
  { k: 'Bocal', icon: '🔇' },
  { k: 'Empunhadura', icon: '✊' },
  { k: 'Coronha', icon: '🪝' },
  { k: 'Carregador', icon: '🔋' },
  { k: 'Munição', icon: '🅰️' },
  { k: 'Pintura', icon: '🎨' },
  { k: 'Pingente', icon: '🔗' }
];

export const byId = id => ARSENAL.find(w => w.id === id) || null;
