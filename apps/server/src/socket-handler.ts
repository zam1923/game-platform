import type { Server, Socket } from 'socket.io';
import { RoomManager, toSnapshot, type CreationMode, type GameType, RANDOM_TOPICS_FALLBACK } from './room-manager.js';

async function fetchWikipediaRandomTitle(): Promise<string> {
  const res = await fetch('https://ja.wikipedia.org/api/rest_v1/page/random/summary', {
    headers: { 'User-Agent': 'GamePlatform/1.0' },
  });
  if (!res.ok) throw new Error('Wikipedia API error');
  const data = await res.json() as { title: string };
  return data.title;
}

async function getRandomTopic(): Promise<string> {
  try {
    return await fetchWikipediaRandomTitle();
  } catch {
    const fallback = RANDOM_TOPICS_FALLBACK;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
}

export function registerSocketHandlers(io: Server, rooms: RoomManager): void {
  io.on('connection', (socket: Socket) => {
    const playerId = socket.id;

    // ─── ルーム作成 ───────────────────────────────
    socket.on('room:create', (
      payload: { playerName: string; gameType?: GameType },
      cb: (res: { ok: boolean; code?: string; apiKey?: string; error?: string }) => void,
    ) => {
      const name = payload.playerName?.trim();
      if (!name) return cb({ ok: false, error: '名前を入力してください' });

      const gameType: GameType = payload.gameType === 'solo' ? 'solo' : 'multi';
      const player = { id: playerId, name, isHost: true, joinedAt: Date.now() };
      const room = rooms.createRoom(player, gameType);
      socket.join(room.code);

      cb({ ok: true, code: room.code, apiKey: room.apiKey });
      io.to(room.code).emit('room:updated', toSnapshot(room));
    });

    // ─── ルーム参加 ───────────────────────────────
    socket.on('room:join', (
      payload: { playerName: string; code: string },
      cb: (res: { ok: boolean; room?: ReturnType<typeof toSnapshot>; apiKey?: string; error?: string }) => void,
    ) => {
      const name = payload.playerName?.trim();
      if (!name) return cb({ ok: false, error: '名前を入力してください' });

      const result = rooms.joinRoom(payload.code, {
        id: playerId,
        name,
        isHost: false,
        joinedAt: Date.now(),
      });

      if ('error' in result) return cb({ ok: false, error: result.error });

      socket.join(result.code);
      cb({ ok: true, room: toSnapshot(result), apiKey: result.apiKey });

      // 他のメンバーに通知
      const player = result.players.get(playerId)!;
      socket.to(result.code).emit('player:joined', player);
      io.to(result.code).emit('room:updated', toSnapshot(result));
    });

    // ─── ゲーム選択（ホストのみ） ─────────────────
    socket.on('game:select', (
      payload: { gameId: string },
      cb: (res: { ok: boolean; error?: string }) => void,
    ) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return cb?.({ ok: false, error: 'ルームに参加していません' });

      const player = room.players.get(playerId);
      if (!player?.isHost) return cb?.({ ok: false, error: 'ホストのみ操作できます' });

      const ok = rooms.selectGame(room, payload.gameId);
      if (!ok) return cb?.({ ok: false, error: 'ゲームが見つかりません' });

      cb?.({ ok: true });
      io.to(room.code).emit('game:selected', payload.gameId);
      io.to(room.code).emit('room:updated', toSnapshot(room));
    });

    // ─── アクション送信（全員 → サーバー → ホストへ）───
    socket.on('game:action', (action: unknown) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room || room.phase !== 'playing') return;

      // ホストのソケットIDを探してそこにだけ転送
      const host = [...room.players.values()].find(p => p.isHost);
      if (!host) return;
      io.to(host.id).emit('game:action', action, playerId);
    });

    // ─── ホストが全員に状態をブロードキャスト ────────
    socket.on('game:broadcast', (state: unknown) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player?.isHost) return;  // ホストのみ
      io.to(room.code).emit('game:state', state);
    });

    // ─── ホストが全員にイベントをブロードキャスト ─────
    socket.on('game:broadcastEvent', (event: unknown) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player?.isHost) return;
      io.to(room.code).emit('game:event', event);
    });

    // ─── ホストが特定プレイヤーにイベント送信 ────────
    socket.on('game:sendTo', (targetId: string, event: unknown) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player?.isHost) return;
      io.to(targetId).emit('game:event', event);
    });

    // ─── 作成モード変更（ホストのみ）─────────────────
    socket.on('room:setMode', (mode: CreationMode) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player?.isHost) return;
      rooms.setMode(room, mode);
      io.to(room.code).emit('room:updated', toSnapshot(room));
    });

    // ─── Challenge モードのお題送信（ホストのみ）──────
    socket.on('room:challenge', (prompt: string) => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player?.isHost) return;
      rooms.setChallenge(room, prompt);
      io.to(room.code).emit('room:challenge', prompt);
      io.to(room.code).emit('room:updated', toSnapshot(room));
    });

    // ─── ランダムお題（ホストのみ）────────────────────
    socket.on('room:randomChallenge', async () => {
      const room = rooms.getRoomByPlayer(playerId);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player?.isHost) return;

      const topic = await getRandomTopic();
      rooms.setChallenge(room, topic);
      io.to(room.code).emit('room:challenge', topic);
      io.to(room.code).emit('room:updated', toSnapshot(room));
    });

    // ─── 退出 ─────────────────────────────────────
    socket.on('room:leave', () => cleanup(socket, playerId, rooms, io));
    socket.on('disconnect', () => cleanup(socket, playerId, rooms, io));
  });
}

function cleanup(
  socket: Socket,
  playerId: string,
  rooms: RoomManager,
  io: Server,
): void {
  const result = rooms.removePlayer(playerId);
  if (!result) return;
  const { room } = result;
  socket.leave(room.code);
  io.to(room.code).emit('player:left', playerId);
  io.to(room.code).emit('room:updated', toSnapshot(room));
}
