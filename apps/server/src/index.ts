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
import { loadAllRoomsFromDb } from './db.js';

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
// Socket.io のリクエスト（/socket.io/）はFastifyに渡さない（二重応答クラッシュ防止）
const app = Fastify({
  logger: false,
  serverFactory: (handler) => {
    httpServer.on('request', (req, res) => {
      if (req.url?.startsWith('/socket.io')) return;
      handler(req, res);
    });
    return httpServer;
  },
});

const rooms = new RoomManager();

// DBからルームを復元（サーバー再起動後もAPIキーが有効になる）
const persistedRooms = await loadAllRoomsFromDb();
for (const r of persistedRooms) {
  rooms.restoreRoom({
    code: r.code,
    apiKey: r.api_key,
    gameType: r.type,
    ownerId: r.owner_id ?? undefined,
    name: r.name ?? undefined,
  });
}
if (persistedRooms.length > 0) {
  console.log(`📦 Restored ${persistedRooms.length} rooms from DB`);
}

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

// public/ のみ配信（platform.js など）。Webクライアントは配信しない（アプリ専用）
if (!isDev) {
  const publicDir = path.join(__dirname, '../../../public');

  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });

  app.setNotFoundHandler((req, reply) => {
    const url = req.url.split('?')[0];
    if (url.startsWith('/api') || url.startsWith('/game') || url.startsWith('/socket.io')) {
      reply.status(404).send('Not found');
    } else {
      // Webブラウザからのアクセスにはアプリ案内を返す
      reply.type('text/html').send(`<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Game Platform</title>
<style>body{margin:0;background:#0a0500;color:#c8a06a;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;box-sizing:border-box}h1{font-size:20px;margin-bottom:16px}p{color:#7c5a30;line-height:1.8}</style>
</head>
<body><div><h1>📱 Game Platform</h1><p>このサービスはスマートフォンアプリ専用です。<br>アプリをインストールしてご利用ください。</p></div></body>
</html>`);
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
