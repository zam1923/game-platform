import { io, Socket } from 'socket.io-client';
import { useStore, type GeneratingInfo, type RoomSnapshot } from './store';
import { loadSession, clearSession } from './utils/session';

// DEV時はViteプロキシ経由で接続（空文字 = 同じオリジン）
// Capacitor(Android)ビルド時は VITE_SERVER_URL に Railway.app の URL を設定
const URL = import.meta.env.VITE_SERVER_URL ?? '';

export const socket: Socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

// ─── 接続時: セッションがあれば自動でルームに再参加 ───────────
socket.on('connect', () => {
  useStore.getState().setDisconnected(false);

  const session = loadSession();
  if (!session) {
    useStore.getState().setReconnecting(false);
    return;
  }

  // セッションがある → 必ず再参加してサーバーのルーム状態を同期（サーバー再起動対策）
  useStore.getState().setReconnecting(true);
  socket.emit(
    'room:join',
    { playerName: session.name, code: session.code },
    (res: { ok: boolean; room?: RoomSnapshot; error?: string }) => {
      useStore.getState().setReconnecting(false);
      if (res.ok && res.room) {
        // 成功: me と room を最新状態に更新（apiKeyも最新になる）
        const isHost = res.room.players.find(p => p.name === session.name)?.isHost ?? false;
        useStore.getState().setMe({
          id: socket.id!,
          name: session.name,
          isHost,
          joinedAt: Date.now(),
        });
        useStore.getState().setRoom(res.room);
        useStore.getState().setPendingGameType(res.room.gameType);
      } else {
        // ルームが消えていた（サーバー再起動など）→ ホームへ
        clearSession();
        useStore.getState().clearRoom();
        useStore.getState().setNavPage('home');
      }
    },
  );
});

// ─── 切断時: clearRoom しない（再接続で自動復帰できるかもしれない）─
socket.on('disconnect', () => {
  useStore.getState().setDisconnected(true);
  // ★ clearRoom() は呼ばない ← 最大の変更点
});

// ─── サーバーからのイベントを Zustand ストアに接続 ────────────
socket.on('room:updated', (room) => {
  useStore.getState().setRoom(room);
});

socket.on('game:deployed', (game) => {
  useStore.getState().addDeployedGame(game);
});

socket.on('game:selected', (gameId: string) => {
  useStore.getState().setActiveGame(gameId);
});

socket.on('game:state', (state: unknown) => {
  useStore.getState().setGameState(state);
});

socket.on('game:action', (action: unknown, playerId: string) => {
  useStore.getState().setLastAction({ action, playerId });
});

socket.on('game:event', (event: unknown) => {
  useStore.getState().setLastEvent(event);
});

socket.on('player:joined', (player) => {
  useStore.getState().addPlayer(player);
});

socket.on('player:left', (playerId: string) => {
  useStore.getState().removePlayer(playerId);
});

socket.on('room:challenge', (prompt: string) => {
  useStore.getState().setChallengePrompt(prompt);
});

// ゲーム生成中通知（全員が見られる）
socket.on('game:generating', (info: GeneratingInfo) => {
  useStore.getState().addGenerating(info);
});

// 生成失敗通知
socket.on('game:generateFailed', ({ playerName }: { playerName: string; error: string }) => {
  useStore.getState().removeGenerating(playerName);
});

