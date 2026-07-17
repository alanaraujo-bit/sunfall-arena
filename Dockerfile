# Servidor do jogo (API REST + WebSocket) — Fly.io região GRU (São Paulo)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.js"]
