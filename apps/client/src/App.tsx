import { useStore } from './store';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';

export default function App() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);

  if (!room || !me) return <Lobby />;
  if (room.phase === 'playing' && room.activeGameId) return <Game />;
  return <Room />;
}
