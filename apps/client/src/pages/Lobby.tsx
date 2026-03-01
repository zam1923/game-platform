import { useState } from 'react';
import { socket } from '../socket';
import { useStore } from '../store';

const btn = (color: string): React.CSSProperties => ({
  padding: '14px 24px',
  borderRadius: 10,
  border: 'none',
  background: color,
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  width: '100%',
});

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  title: { fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' },
  sub: { fontSize: 16, color: '#888', marginTop: 4 },
  card: {
    background: '#1a1a24',
    border: '1px solid #2a2a3a',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: { fontSize: 13, color: '#aaa', marginBottom: 4, display: 'block' },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #333',
    background: '#0f0f18',
    color: '#fff',
    fontSize: 16,
    outline: 'none',
  },
  divider: { display: 'flex', alignItems: 'center', gap: 12, color: '#444', fontSize: 13 },
  line: { flex: 1, height: 1, background: '#2a2a3a' },
  error: { color: '#f87171', fontSize: 14 },
};

export default function Lobby() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setMe, setRoom } = useStore();

  function connect() {
    if (!socket.connected) socket.connect();
  }

  async function createRoom() {
    if (!name.trim()) return setError('名前を入力してください');
    setLoading(true);
    setError('');
    connect();

    socket.emit('room:create', { playerName: name.trim() }, (res: {
      ok: boolean; code?: string; apiKey?: string; error?: string;
    }) => {
      setLoading(false);
      if (!res.ok) return setError(res.error ?? 'エラーが発生しました');
      // room:updatedで自動でstoreに反映されるが、meだけ先にセット
      setMe({ id: socket.id!, name: name.trim(), isHost: true, joinedAt: Date.now() });
    });
  }

  async function joinRoom() {
    if (!name.trim()) return setError('名前を入力してください');
    if (!code.trim()) return setError('ルームコードを入力してください');
    setLoading(true);
    setError('');
    connect();

    socket.emit('room:join', { playerName: name.trim(), code: code.trim() }, (res: {
      ok: boolean; room?: object; apiKey?: string; error?: string;
    }) => {
      setLoading(false);
      if (!res.ok) return setError(res.error ?? 'エラーが発生しました');
      setMe({ id: socket.id!, name: name.trim(), isHost: false, joinedAt: Date.now() });
      if (res.room) setRoom(res.room as Parameters<typeof setRoom>[0]);
    });
  }

  return (
    <div style={s.root}>
      <div style={{ textAlign: 'center' }}>
        <div style={s.title}>🎮 Game Platform</div>
        <div style={s.sub}>AIで作ったゲームをみんなで遊ぼう</div>
      </div>

      <div style={s.card}>
        <div>
          <span style={s.label}>あなたの名前</span>
          <input
            style={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            placeholder="例: たろう"
            maxLength={20}
          />
        </div>

        <button style={btn('#6366f1')} onClick={createRoom} disabled={loading}>
          {loading ? '接続中...' : '✨ ルームを作る'}
        </button>

        <div style={s.divider}>
          <div style={s.line} />
          <span>または</span>
          <div style={s.line} />
        </div>

        <div>
          <span style={s.label}>ルームコード（6文字）</span>
          <input
            style={{ ...s.input, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700 }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            placeholder="ABC123"
            maxLength={6}
          />
        </div>

        <button style={btn('#10b981')} onClick={joinRoom} disabled={loading}>
          {loading ? '参加中...' : '👋 ルームに参加'}
        </button>

        {error && <div style={s.error}>⚠ {error}</div>}
      </div>
    </div>
  );
}
