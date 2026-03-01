import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { useStore } from '../store';
import { saveSession, loadSession, clearSession } from '../utils/session';

const GAME_TYPE_LABELS = {
  solo: { icon: '🎮', label: '一人でプレイ', color: '#6366f1' },
  multi: { icon: '👥', label: 'みんなでプレイ', color: '#10b981' },
} as const;

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
  rejoinBanner: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '16px 20px',
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
};

export default function Lobby() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedSession, setSavedSession] = useState<{ name: string; code: string } | null>(null);
  const { setMe, setRoom } = useStore();
  const pendingGameType = useStore((s) => s.pendingGameType);
  const pendingRoomCode = useStore((s) => s.pendingRoomCode);

  useEffect(() => {
    const session = loadSession();
    if (session) setSavedSession(session);
  }, []);

  // 招待リンクから来た場合: コードを入力欄に pre-fill
  useEffect(() => {
    if (pendingRoomCode) {
      setCode(pendingRoomCode);
      useStore.getState().setPendingRoomCode(null); // 使い終わったらクリア
    }
  }, [pendingRoomCode]);

  function goHome() {
    useStore.getState().setNavPage('home');
  }

  function connect() {
    if (!socket.connected) socket.connect();
  }

  async function createRoom() {
    if (!name.trim()) return setError('名前を入力してください');
    setLoading(true);
    setError('');
    connect();

    socket.emit('room:create', { playerName: name.trim(), gameType: pendingGameType ?? 'multi' }, (res: {
      ok: boolean; code?: string; apiKey?: string; error?: string;
    }) => {
      setLoading(false);
      if (!res.ok) return setError(res.error ?? 'エラーが発生しました');
      saveSession(name.trim(), res.code!);
      setMe({ id: socket.id!, name: name.trim(), isHost: true, joinedAt: Date.now() });
    });
  }

  async function joinRoom(joinName?: string, joinCode?: string) {
    const n = (joinName ?? name).trim();
    const c = (joinCode ?? code).trim();
    if (!n) return setError('名前を入力してください');
    if (!c) return setError('ルームコードを入力してください');
    setLoading(true);
    setError('');
    connect();

    socket.emit('room:join', { playerName: n, code: c }, (res: {
      ok: boolean; room?: object; apiKey?: string; error?: string;
    }) => {
      setLoading(false);
      if (!res.ok) {
        clearSession();
        setSavedSession(null);
        return setError(res.error ?? 'エラーが発生しました');
      }
      saveSession(n, c);
      setMe({ id: socket.id!, name: n, isHost: false, joinedAt: Date.now() });
      if (res.room) setRoom(res.room as Parameters<typeof setRoom>[0]);
    });
  }

  function rejoin() {
    if (!savedSession) return;
    joinRoom(savedSession.name, savedSession.code);
  }

  return (
    <div style={s.root}>
      {/* ホームに戻るボタン */}
      <button
        onClick={goHome}
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid #2a2a3a',
          background: 'transparent',
          color: '#888',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        ← ホーム
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={s.title}>🎮 Game Platform</div>
        {/* 選択されたモードの表示 */}
        {pendingGameType && (
          <div style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 20,
            background: `${GAME_TYPE_LABELS[pendingGameType].color}20`,
            border: `1px solid ${GAME_TYPE_LABELS[pendingGameType].color}60`,
            color: GAME_TYPE_LABELS[pendingGameType].color,
            fontSize: 13,
            fontWeight: 600,
          }}>
            {GAME_TYPE_LABELS[pendingGameType].icon} {GAME_TYPE_LABELS[pendingGameType].label}モード
          </div>
        )}
        <div style={s.sub}>AIで作ったゲームをみんなで遊ぼう</div>
      </div>

      {/* 前のセッションに戻るバナー */}
      {savedSession && (
        <div style={s.rejoinBanner}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            前回のセッション: <strong style={{ color: '#fff' }}>{savedSession.name}</strong> / ルーム <strong style={{ color: '#6366f1' }}>{savedSession.code}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...btn('#6366f1'), padding: '10px 16px', fontSize: 14 }}
              onClick={rejoin}
              disabled={loading}
            >
              🔄 このルームに戻る
            </button>
            <button
              style={{ ...btn('#374151'), padding: '10px 16px', fontSize: 14, width: 'auto' }}
              onClick={() => { clearSession(); setSavedSession(null); }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

        <button style={btn('#10b981')} onClick={() => joinRoom()} disabled={loading}>
          {loading ? '参加中...' : '👋 ルームに参加'}
        </button>

        {error && <div style={s.error}>⚠ {error}</div>}
      </div>
    </div>
  );
}
