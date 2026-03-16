import type { FastifyInstance } from 'fastify';
import type { RoomManager } from '../room-manager.js';
import type { Server as SocketServer } from 'socket.io';
import { toSnapshot } from '../room-manager.js';
import { getRoomByApiKeyFromDb } from '../db.js';

interface DeployBody {
  roomCode: string;
  apiKey: string;
  name: string;
  code: string;        // HTML content
  deployedBy?: string; // optional player name override
}

export function registerDeployRoute(
  app: FastifyInstance,
  rooms: RoomManager,
  io: SocketServer,
): void {
  app.post<{ Body: DeployBody }>('/api/deploy', {
    schema: {
      body: {
        type: 'object',
        required: ['roomCode', 'apiKey', 'name', 'code'],
        properties: {
          roomCode: { type: 'string' },
          apiKey:   { type: 'string' },
          name:     { type: 'string', maxLength: 100 },
          code:     { type: 'string', maxLength: 500_000 }, // 500KB limit
          deployedBy: { type: 'string', maxLength: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const { roomCode, apiKey, name, code, deployedBy } = request.body;

    let room = rooms.getRoomByApiKey(apiKey);
    if (!room) {
      // メモリにない場合はDBから復元を試みる（サーバー再起動後対策）
      const persisted = await getRoomByApiKeyFromDb(apiKey);
      if (persisted) {
        room = rooms.restoreRoom({
          code: persisted.code,
          apiKey: persisted.api_key,
          gameType: persisted.type,
          ownerId: persisted.owner_id ?? undefined,
          name: persisted.name ?? undefined,
        });
      }
    }
    if (!room) {
      return reply.status(401).send({ ok: false, error: 'APIキーが無効です' });
    }
    if (room.code !== roomCode.toUpperCase()) {
      return reply.status(400).send({ ok: false, error: 'ルームコードが一致しません' });
    }

    const sanitizedName = name.trim() || '無名のゲーム';
    const game = rooms.deployGame(room, {
      name: sanitizedName,
      html: code,
      deployedBy: deployedBy?.trim() || 'AI',
      provider: 'manual',
    });

    // 全員にデプロイ通知
    io.to(room.code).emit('game:deployed', {
      id: game.id,
      name: game.name,
      deployedBy: game.deployedBy,
    });

    return reply.send({
      ok: true,
      gameId: game.id,
      message: `「${sanitizedName}」をデプロイしました！`,
    });
  });
}
