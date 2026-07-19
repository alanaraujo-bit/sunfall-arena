// ============================================================
// SUNFALL ARENA — estado de salas públicas (sem autenticação)
// Dado em memória (registry de salas), não passa pelo banco.
// ============================================================
import { Router } from 'express';
import { MAP_LIST } from '../../shared/maps/index.js';
import { publicRoomCounts } from '../game/rooms.js';

const router = Router();

// Quantos jogadores REAIS estão em salas públicas agora, por mapa — o
// seletor de mapa do lobby usa isto pra o jogador escolher onde tem
// partida rolando de verdade, em vez de entrar às cegas.
router.get('/public-rooms', (req, res) => {
  const counts = publicRoomCounts();
  res.json({
    maps: MAP_LIST.map(m => ({ key: m.key, name: m.name, players: counts[m.key] || 0 }))
  });
});

export default router;
