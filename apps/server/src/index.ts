import { createServer } from 'http';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './room-manager.js';
import { registerSocketHandlers } from './socket-handler.js';
import { registerDeployRoute } from './api/deploy.js';
import { registerGenerateRoute } from './api/generate.js';
import { registerGameServeRoute } from './api/game-serve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';
const PORT = Number(process.env.PORT) || 3000;

// 1. 生のHTTPサーバーを先に作る
const httpServer = createServer();

// 2. Socket.io をHTTPサーバーにアタッチ（Fastifyより先）
const io = new SocketServer(httpServer, {
  cors: {
    origin: isDev ? ['http://localhost:5173', 'http://localhost:3000'] : false,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// 3. Fastify は serverFactory でHTTPサーバーを共有
const app = Fastify({
  logger: false,
  serverFactory: (handler) => {
    httpServer.on('request', handler);
    return httpServer;
  },
});

const rooms = new RoomManager();

// CORS: Custom GPT Actions等の外部クライアントからAPIを呼べるようにする
await app.register(fastifyCors, {
  origin: true,  // 全オリジン許可（/api/deploy と /api/generate はAPIキーで認証）
  methods: ['GET', 'POST', 'OPTIONS'],
});

// API ルート
await app.register(async (fastify) => {
  registerDeployRoute(fastify, rooms, io);
  registerGenerateRoute(fastify, rooms, io);
  registerGameServeRoute(fastify, rooms);
});

// 本番環境: ビルド済みクライアントと public/ を静的配信
if (!isDev) {
  const clientDist = path.join(__dirname, '../../../apps/client/dist');
  const publicDir = path.join(__dirname, '../../../public');

  await app.register(fastifyStatic, {
    root: [publicDir, clientDist],
    prefix: '/',
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/game') || req.url.startsWith('/platform')) {
      reply.status(404).send('Not found');
    } else {
      reply.sendFile('index.html', clientDist);
    }
  });
}

// ヘルスチェック
app.get('/health', async () => ({ status: 'ok' }));

// Keep-alive ping（UptimeRobotなどから5分ごとに叩いてもらう）
app.get('/api/ping', async () => ({ status: 'ok', timestamp: Date.now() }));

// Socket.io ハンドラ
registerSocketHandlers(io, rooms);

// 定期GC
setInterval(() => rooms.cleanup(), 30 * 60 * 1000);

// 起動
await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`🎮 Game Platform running on http://localhost:${PORT}`);
