import { useStore } from './store';
import { useAuthStore } from './authStore';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Home from './pages/Home';
import Library from './pages/Library';

export default function App() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  const navPage = useStore((s) => s.navPage);
  const { loading } = useAuthStore();

  // Supabase セッション読み込み中
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f18',
        color: '#555',
        fontSize: 15,
      }}>
        読み込み中...
      </div>
    );
  }

  // ゲームプレイ中
  if (room && me && room.phase === 'playing' && room.activeGameId) return <Game />;
  // ルーム参加中
  if (room && me) return <Room />;
  // ロビー（ルーム作成・参加）
  if (navPage === 'lobby') return <Lobby />;
  // ゲームライブラリ
  if (navPage === 'library') return <Library />;
  // ホーム（デフォルト）
  return <Home />;
}
