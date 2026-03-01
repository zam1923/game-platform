import { io, Socket } from 'socket.io-client';
import { useStore, type GeneratingInfo } from './store';

// DEV時もViteプロキシ経由で接続（空文字 = 同じオリジン）
const URL = '';

export const socket: Socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

// サーバーからのイベントを Zustand ストアに接続
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

socket.on('disconnect', () => {
  // サーバーが再起動したらルーム状態をクリア
  useStore.getState().clearRoom();
});
