import { useEffect } from 'react';
import { useStore } from './store';
import { useAuthStore } from './authStore';
import { socket } from './socket';
import { loadSession } from './utils/session';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Home from './pages/Home';
import Library from './pages/Library';
import { SoundSettings } from './components/SoundSettings';

export default function App() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  const navPage = useStore((s) => s.navPage);
  const isReconnecting = useStore((s) => s.isReconnecting);
  const { loading } = useAuthStore();

  // 初回マウント時: socketを接続してセッション復帰を試みる
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      useStore.getState().setPendingRoomCode(roomCode.toUpperCase());
      useStore.getState().setNavPage('lobby');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // セッションがある場合、即座に接続してセッション復帰
    if (!socket.connected) {
      const session = loadSession();
      if (session) useStore.getState().setReconnecting(true);
      socket.connect();
    }
  }, []);

  // Supabase セッション読み込み中 or セッション復帰中
  if (loading || isReconnecting) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0703',
        color: '#5a3a18',
        fontSize: 13,
        fontFamily: "'Press Start 2P', monospace",
      }}>
        LOADING...
      </div>
    );
  }

  // ゲームプレイ中
  if (room && me && room.phase === 'playing' && room.activeGameId) return <><Game /><SoundSettings /></>;
  // ルーム参加中
  if (room && me) return <><Room /><SoundSettings /></>;
  // ロビー（ルーム作成・参加）
  if (navPage === 'lobby') return <><Lobby /><SoundSettings /></>;
  // ゲームライブラリ
  if (navPage === 'library') return <><Library /><SoundSettings /></>;
  // ホーム（デフォルト）
  return <><Home /><SoundSettings /></>;
}
