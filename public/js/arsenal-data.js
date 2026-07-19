// ============================================================
// SUNFALL ARENA — Catálogo do Arsenal
// Identidade e ficha técnica das armas. Fonte única de verdade
// para a tela do Arsenal (vitrine).
//
// COERÊNCIA: FALCÃO-9 e FERRÃO-SR são as armas REAIS já jogáveis —
// seus números batem com a tabela de combate (main.js / server/ws.js):
//   FALCÃO-9 : dano 16 (x1.75 cabeça), ~520 disp/min, carregador 26,
//              recarga 1.35 s, automático, hitscan.
//   FERRÃO-SR: dano 92 (x2 cabeça = 184), ~57 disp/min, carregador 5,
//              recarga 1.8 s, ferrolho, luneta.
// As outras 4 classes são projeções (bloqueadas / "em breve").
// ============================================================

// Cada arma:
//   id, name, internal, maker, year, cls, role, icon, accent, model|null,
//   locked, desc / philosophy / trivia[],
//   core[] (6 atributos com barra v:0..100), spec[] (ficha técnica em texto)

export const ARSENAL = [
  {
    id: 'falcao',
    name: 'FALCÃO-9',
    internal: 'AD-F9 “Falcão”',
    maker: 'Atlas Dynamics',
    year: 2231,
    cls: 'Fuzil de Assalto',
    role: 'Versátil · todas as distâncias',
    icon: '🦅',
    accent: '#3fc8b4',
    model: 'falcao',
    locked: false,
    desc: 'O fuzil padrão de Sunfall. A Atlas Dynamics projetou o FALCÃO-9 para não ter fraqueza: cadência alta, recuo baixíssimo e precisão confiável a qualquer distância. Não domina nenhuma especialidade — domina o campo inteiro.',
    philosophy: 'Confiabilidade acima de espetáculo. Recuo previsível e controle absoluto: onde a mira aponta, o FALCÃO acerta — mesmo em rajadas longas.',
    trivia: [
      'É a arma com que todo operador de Sunfall aprende a atirar.',
      'O recuo quase nulo o torna letal mesmo segurando o gatilho.',
      'Nome em homenagem ao falcão-peregrino: rápido, preciso, implacável.'
    ],
    core: [
      { k: 'Dano', v: 40 }, { k: 'Cadência', v: 74 }, { k: 'Alcance', v: 62 },
      { k: 'Precisão', v: 78 }, { k: 'Controle', v: 86 }, { k: 'Mobilidade', v: 66 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '1.35 s' },
      { k: 'Carregador', d: '26' },
      { k: 'Cadência', d: '~520 disp/min' },
      { k: 'Dano por tiro', d: '16' },
      { k: 'Dano na cabeça', d: '28' },
      { k: 'Disparo', d: 'Automático' },
      { k: 'Projétil', d: 'Hitscan (instantâneo)' },
      { k: 'Tempo p/ sacar', d: '0.25 s' }
    ]
  },
  {
    id: 'ferrao',
    name: 'FERRÃO-SR',
    internal: 'MD-SR “Ferrão”',
    maker: 'Meridian Defense',
    year: 2229,
    cls: 'Fuzil de Precisão',
    role: 'Longa distância · um tiro',
    icon: '🦂',
    accent: '#f0b34c',
    model: 'ferrao',
    locked: false,
    desc: 'Um tiro, uma sentença. O FERRÃO-SR derruba qualquer alvo com um acerto limpo no tronco — e é instantâneo na cabeça. O preço é a lentidão entre disparos e o carregador curto: errar custa caríssimo.',
    philosophy: 'A Meridian construiu o FERRÃO em torno de um único disparo perfeito. Ferrolho pesado, luneta longa e um cano que não perdoa a menor hesitação — sua ou do alvo.',
    trivia: [
      'O dano de tronco é alto o bastante para eliminar com um só acerto.',
      'Na luneta, a dispersão vai a zero: é mira ou nada.',
      '“Ferrão” como o do escorpião — um golpe decide o duelo.'
    ],
    core: [
      { k: 'Dano', v: 96 }, { k: 'Cadência', v: 12 }, { k: 'Alcance', v: 96 },
      { k: 'Precisão', v: 94 }, { k: 'Controle', v: 40 }, { k: 'Mobilidade', v: 34 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '1.8 s' },
      { k: 'Carregador', d: '5' },
      { k: 'Cadência', d: '~57 disp/min' },
      { k: 'Dano por tiro', d: '92' },
      { k: 'Dano na cabeça', d: '184' },
      { k: 'Disparo', d: 'Ferrolho (semi)' },
      { k: 'Mira', d: 'Luneta (zoom)' },
      { k: 'Tempo p/ sacar', d: '0.25 s' }
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
    accent: '#f0844c',
    model: 'vespa',
    locked: false,
    desc: 'Leve, faminta e barulhenta. A VESPA despeja um enxame de projéteis a menos de dez metros — feita para quem entra na sala antes de pensar. Passou disso, cada disparo vira desperdício.',
    philosophy: 'Velocidade é sobrevivência. A Kestrel abriu mão de alcance e dano por grama de peso: sacar, mirar e correr com a VESPA é mais rápido do que com qualquer outra arma.',
    trivia: [
      'A cadência é tão alta que o carregador esvazia em pouco mais de um segundo.',
      'Operadores apelidaram o som do disparo de “serra”.',
      'É a arma mais rápida de sacar do arsenal — e a que deixa quem carrega mais ágil no chão.'
    ],
    core: [
      { k: 'Dano', v: 34 }, { k: 'Cadência', v: 94 }, { k: 'Alcance', v: 32 },
      { k: 'Precisão', v: 50 }, { k: 'Controle', v: 46 }, { k: 'Mobilidade', v: 92 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '1.9 s' },
      { k: 'Carregador', d: '25' },
      { k: 'Cadência', d: '~820 disp/min' },
      { k: 'Dano por tiro', d: '17' },
      { k: 'Dano na cabeça', d: '29' },
      { k: 'Disparo', d: 'Automático' },
      { k: 'Mobilidade', d: 'Altíssima (anda mais rápido, saca mais rápido)' },
      { k: 'Precisão parado', d: 'Média' }
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
    model: 'sentinela',
    locked: false,
    desc: 'Meio-termo entre o fuzil e a sniper. A SENTINELA-DR premia quem mira na cabeça: cada disparo semiautomático castiga a média-longa distância com estabilidade rara. Lenta nas mãos erradas; implacável nas certas.',
    philosophy: 'A Veyra acredita que precisão é escolha, não sorte. A SENTINELA foi calibrada para que dois toques limpos derrubem qualquer alvo — desde que você acerte.',
    trivia: [
      'O gatilho tem curso ajustável de fábrica em três estágios.',
      'Favorita de quem “segura” pontos-chave da arena.',
      'A luneta é deliberadamente mais curta que a da FERRÃO-SR: aproxima sem fechar o campo de visão inteiro.'
    ],
    core: [
      { k: 'Dano', v: 80 }, { k: 'Cadência', v: 44 }, { k: 'Alcance', v: 82 },
      { k: 'Precisão', v: 88 }, { k: 'Controle', v: 62 }, { k: 'Mobilidade', v: 48 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '2.7 s' },
      { k: 'Carregador', d: '12' },
      { k: 'Cadência', d: '~300 disp/min' },
      { k: 'Dano por tiro', d: '50' },
      { k: 'Dano na cabeça', d: '100 (letal)' },
      { k: 'Disparo', d: 'Semiautomático' },
      { k: 'Mira', d: 'Luneta média (ADS)' },
      { k: 'Precisão parado', d: 'Muito alta (spread zerado na mira)' }
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
    accent: '#d95350',
    model: 'brecha',
    locked: false,
    desc: 'A resposta da Talon Works para portas trancadas e corredores estreitos. A BRECHA-12 apaga qualquer coisa a um braço de distância — e vira enfeite a partir de dez metros. Recarrega devagar: cada tiro precisa contar.',
    philosophy: 'Dano bruto, sem desculpas. A Talon nunca escondeu que a BRECHA é uma ferramenta de um único propósito: dominar o espaço fechado.',
    trivia: [
      'O nome vem do uso original: abrir passagem em estruturas.',
      'É recarregada cartucho por cartucho — e o gatilho interrompe a recarga a qualquer momento.',
      'Os 9 bagos de cada cartucho se espalham num leque: quanto mais perto, mais bagos conectam.'
    ],
    core: [
      { k: 'Dano', v: 96 }, { k: 'Cadência', v: 30 }, { k: 'Alcance', v: 16 },
      { k: 'Precisão', v: 24 }, { k: 'Controle', v: 40 }, { k: 'Mobilidade', v: 56 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '0.6 s / cartucho (interrompível)' },
      { k: 'Carregador', d: '6' },
      { k: 'Disparo', d: 'Bomba (pump), 1 por gatilho' },
      { k: 'Bagos por disparo', d: '9' },
      { k: 'Dano por bago', d: '15 (perto) → 2 (11 m)' },
      { k: 'Dano máx. (ponto-cego)', d: '135' },
      { k: 'Alcance efetivo', d: '~11 m' },
      { k: 'Dispersão', d: 'Alta (leque de bagos)' },
      { k: 'Mobilidade', d: 'Média' }
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
    model: 'muralha',
    locked: false,
    desc: 'Um muro de fogo portátil. A MURALHA-M carrega munição para durar e não para de cuspir — mas é pesada, sobe muito no recuo e transforma quem a segura em alvo lento. Domina corredores; sofre em duelos rápidos.',
    philosophy: 'A Solmark projetou a MURALHA para negar terreno. Não é sobre acertar todo tiro — é sobre o inimigo não conseguir levantar a cabeça.',
    trivia: [
      'O cano aguenta 200 disparos contínuos antes de precisar esfriar.',
      'É a arma mais antiga do arsenal ainda em serviço ativo.',
      'A dispersão encolhe numa rajada longa — segurar o gatilho premia quem aguenta o recuo inicial.'
    ],
    core: [
      { k: 'Dano', v: 62 }, { k: 'Cadência', v: 74 }, { k: 'Alcance', v: 60 },
      { k: 'Precisão', v: 44 }, { k: 'Controle', v: 30 }, { k: 'Mobilidade', v: 20 }
    ],
    spec: [
      { k: 'Tempo de recarga', d: '5.4 s' },
      { k: 'Carregador', d: '100' },
      { k: 'Cadência', d: '~640 disp/min' },
      { k: 'Dano por tiro', d: '22' },
      { k: 'Dano na cabeça', d: '40' },
      { k: 'Disparo', d: 'Automático' },
      { k: 'Mobilidade', d: 'Baixa (anda mais devagar, saca mais devagar)' },
      { k: 'Precisão parado', d: 'Média (encolhe segurando o gatilho)' }
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
