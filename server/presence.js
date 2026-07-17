// ============================================================
// SUNFALL ARENA — presença: conexões autenticadas (menu ou partida).
// Usada para status online de amigos e entrega de convites.
// ============================================================
export const presence = new Map(); // accountId (string) -> { ws, username }

export function setPresence(accountId, ws, username) {
  presence.set(String(accountId), { ws, username });
}

export function clearPresence(accountId, ws) {
  const cur = presence.get(String(accountId));
  if (cur && cur.ws === ws) presence.delete(String(accountId));
}

export function getPresence(accountId) {
  return presence.get(String(accountId)) || null;
}

export function onlineAccountIds() {
  return new Set(presence.keys());
}
