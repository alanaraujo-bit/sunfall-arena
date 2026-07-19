// ============================================================
// SUNFALL ARENA — Sistema de classes (Create-a-Class)
// Fonte única de verdade do mapa arma↔índice, compartilhada entre
// cliente e servidor (evita duas cópias que podem divergir).
// ============================================================

// Deve bater exatamente com os índices reais de public/js/main.js
// (WEAPONS[]) e server/ws.js (WEAPONS[]).
export const PRIMARY_WEAPONS = {
  falcao: 0, ferrao: 1, brecha: 5, sentinela: 6, vespa: 7, muralha: 8
};

export const CLASS_SLOTS = 5;

// Resolve um id de arma (string, potencialmente inválido/ausente) pro
// índice numérico real — nunca lança, sempre cai pro FALCÃO-9 se o id
// não existir no mapa. Único ponto de validação usado tanto no join
// quanto no respawn.
export function resolvePrimary(id) {
  return Object.prototype.hasOwnProperty.call(PRIMARY_WEAPONS, id)
    ? PRIMARY_WEAPONS[id]
    : PRIMARY_WEAPONS.falcao;
}

export function defaultClasses() {
  return Array.from({ length: CLASS_SLOTS }, (_, i) => ({ name: `Classe ${i + 1}`, primary: 'falcao' }));
}
