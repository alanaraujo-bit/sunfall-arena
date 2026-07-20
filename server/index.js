// ============================================================
// SUNFALL ARENA — servidor (API REST + WebSocket)
// Relay de estado, dano/kills autoritativos, bots com patrulha,
// contas de jogador (JWT), XP/nível e estatísticas persistidas.
// ============================================================
import express from 'express';
import cors from 'cors';
import http from 'http';
import { migrate } from './db.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import friendsRoutes from './routes/friends.routes.js';
import playersRoutes from './routes/players.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
import communityRoutes from './routes/community.routes.js';
import { loadPatchMeta } from './services/patchmeta.js';
import { announceNewPatchNotes } from './services/announcer.js';
import { attachWs, startGameLoop } from './ws.js';
import { staticMiddleware } from './static.js';

// disponibilidade acima de tudo: erro inesperado é logado, não derruba o jogo
process.on('uncaughtException', err => console.error('[fatal] uncaughtException:', err));
process.on('unhandledRejection', err => console.error('[fatal] unhandledRejection:', err));

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: false }));
app.use(express.json());
app.get('/healthz', (req, res) => res.send('ok'));
app.use('/api/auth', authRoutes);
app.use('/api', profileRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api', playersRoutes);
app.use('/api', roomsRoutes);
app.use('/api', communityRoutes);

// Em produção o frontend é servido pelo Vercel; localmente, `npm start`
// continua servindo public/ direto deste processo por conveniência.
if (process.env.NODE_ENV !== 'production') {
  app.use(staticMiddleware);
}

const server = http.createServer(app);
attachWs(server);
startGameLoop();

await migrate();
await loadPatchMeta();
// anuncia patch notes novos no Discord (não bloqueia o boot se falhar)
announceNewPatchNotes().catch(err => console.error('[announcer]', err.message));

server.listen(PORT, () => {
  console.log('==========================================');
  console.log('  SUNFALL ARENA');
  console.log(`  porta ${PORT}`);
  console.log('==========================================');
});
