import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { useStore } from '../store';
import { useAuthStore } from '../authStore';
import { saveSession, loadSession, clearSession } from '../utils/session';
import { LobbyCanvas } from '../components/LobbyCanvas';
import { BookTransition } from '../components/BookTransition';
import { playClick, playSuccess } from '../utils/sound';

const FONT = "'Press Start 2P', monospace";

const GAME_TYPE_LABELS = {
  solo:  { icon: '🎮', label: 'SOLO',  color: '#6366f1' },
  multi: { icon: '👥', label: 'MULTI', color: '#10b981' },
} as const;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @keyframes lobbyFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lobbySpin { to { transform: rotate(360deg); } }
`;

type SavedRoom = { code: string; name: string | null };

export default function Lobby() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedSession, setSavedSession] = useState<{ name: string; code: string } | null>(null);
  const [savedMultiRooms, setSavedMultiRooms] = useState<SavedRoom[]>([]);
  // BookTransitionを表示するか + 完了後に実行するコールバック
  const [pendingComplete, setPendingComplete] = useState<(() => void) | null>(null);
  const soloAutoTriggered = useRef(false);

  const { setMe, setRoom } = useStore();
  const pendingGameType = useStore((s) => s.pendingGameType);
  const pendingRoomCode = useStore((s) => s.pendingRoomCode);
  const { user } = useAuthStore();

  const displayName = user
    ? (user.user_metadata?.full_name || user.user_metadata?.name || 'Player')
    : name;

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setSavedSession(session);
      if (!pendingGameType && session.gameType) {
        useStore.getState().setPendingGameType(session.gameType);
      }
    }
  }, []);

  useEffect(() => {
    if (user && !name) {
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      if (googleName) setName(googleName);
    }
  }, [user]);

  useEffect(() => {
    if (pendingRoomCode) {
      setCode(pendingRoomCode);
      useStore.getState().setPendingRoomCode(null);
    }
  }, [pendingRoomCode]);

  // ソロ + ログイン済み: マウント時に自動でソロルームへ
  useEffect(() => {
    if (pendingGameType === 'solo' && user && displayName && !soloAutoTriggered.current) {
      soloAutoTriggered.current = true;
      enterSoloRoom();
    }
  }, [pendingGameType, user?.id, displayName]);

  // マルチ + ログイン済み: 保存済みルーム一覧を取得
  useEffect(() => {
    if (pendingGameType === 'multi' && user) {
      connect();
      socket.emit('room:get-saved', { userId: user.id }, (res: { ok: boolean; rooms?: SavedRoom[] }) => {
        if (res.ok && res.rooms) setSavedMultiRooms(res.rooms);
      });
    }
  }, [pendingGameType, user?.id]);

  function goHome() {
    playClick();
    useStore.getState().setNavPage('home');
  }

  function connect() {
    if (!socket.connected) socket.connect();
  }

  function triggerTransition(fn: () => void) {
    setPendingComplete(() => fn);
  }

  function onTransitionComplete() {
    if (pendingComplete) {
      pendingComplete();
      setPendingComplete(null);
    }
  }

  // ─── ソロルーム（常に同じルームを使用）────────────────────
  function enterSoloRoom() {
    if (!displayName.trim()) return setError('名前を入力してください');
    setLoading(true);
    setError('');
    connect();

    socket.emit('room:get-or-create-solo', {
      playerName: displayName.trim(),
      userId: user!.id,
    }, (res: { ok: boolean; code?: string; apiKey?: string; room?: object; error?: string }) => {
      setLoading(false);
      if (!res.ok) return setError(res.error ?? 'エラーが発生しました');
      playSuccess();
      const c = res.code!;
      triggerTransition(() => {
        saveSession(displayName.trim(), c, 'solo');
        setMe({ id: socket.id!, name: displayName.trim(), isHost: true, joinedAt: Date.now() });
        if (res.room) setRoom(res.room as Parameters<typeof setRoom>[0]);
      });
    });
  }

  // ─── マルチルーム作成 ──────────────────────────────────
  async function createRoom() {
    if (!displayName.trim()) return setError('名前を入力してください');
    setLoading(true);
    setError('');
    connect();

    socket.emit('room:create', {
      playerName: displayName.trim(),
      gameType: pendingGameType ?? 'multi',
      userId: user?.id,
      roomName: roomName.trim() || undefined,
    }, (res: { ok: boolean; code?: string; apiKey?: string; error?: string }) => {
      setLoading(false);
      if (!res.ok) return setError(res.error ?? 'エラーが発生しました');
      playSuccess();
      const n = displayName.trim();
      const c = res.code!;
      triggerTransition(() => {
        saveSession(n, c, pendingGameType ?? 'multi');
        setMe({ id: socket.id!, name: n, isHost: true, joinedAt: Date.now() });
      });
    });
  }

  // ─── ルーム参加 ────────────────────────────────────────
  async function joinRoom(joinName?: string, joinCode?: string) {
    const n = (joinName ?? displayName).trim();
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
      playSuccess();
      triggerTransition(() => {
        const roomData = res.room as Parameters<typeof setRoom>[0] | undefined;
        saveSession(n, c, roomData?.gameType ?? pendingGameType ?? 'multi');
        setMe({ id: socket.id!, name: n, isHost: false, joinedAt: Date.now() });
        if (roomData) setRoom(roomData);
      });
    });
  }

  function rejoin() {
    if (!savedSession) return;
    joinRoom(user ? displayName : savedSession.name, savedSession.code);
  }

  const modeInfo = pendingGameType ? GAME_TYPE_LABELS[pendingGameType] : null;
  const isSolo = pendingGameType === 'solo';

  return (
    <>
      <style>{CSS}</style>
      <LobbyCanvas />

      {pendingComplete && (
        <BookTransition onComplete={onTransitionComplete} />
      )}

      <div style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
      }}>
        {/* 左上: ホームに戻る */}
        <button
          onClick={goHome}
          style={{
            position: 'fixed', top: 20, left: 20,
            fontFamily: FONT, fontSize: 8,
            padding: '10px 14px',
            background: 'rgba(8,4,1,0.8)',
            border: '2px solid #3d1f0a',
            color: '#7c5a30',
            cursor: 'pointer',
            zIndex: 20,
          }}
        >
          ← BACK
        </button>

        {/* タイトル */}
        <div style={{ textAlign: 'center', animation: 'lobbyFadeIn 0.5s ease' }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 'clamp(11px, 2vw, 16px)',
            color: '#f0c060',
            textShadow: '0 0 10px rgba(240,192,96,0.5), 2px 2px 0 #2d1208',
            marginBottom: 8,
          }}>
            📖 ENTER THE BOOK
          </div>
          {modeInfo && (
            <div style={{
              fontFamily: FONT, fontSize: 8,
              color: modeInfo.color,
              padding: '4px 12px',
              border: `1px solid ${modeInfo.color}60`,
              background: `${modeInfo.color}15`,
              display: 'inline-block',
              marginTop: 4,
            }}>
              {modeInfo.icon} {modeInfo.label} MODE
            </div>
          )}
        </div>

        {/* 前のセッションに戻るバナー */}
        {savedSession && !isSolo && (
          <div style={{
            background: 'rgba(8,4,1,0.88)',
            border: '2px solid #3d1f0a',
            padding: '14px 18px',
            width: '100%', maxWidth: 400,
            animation: 'lobbyFadeIn 0.4s ease',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 7, color: '#7c5a30', marginBottom: 10, lineHeight: 2 }}>
              LAST SESSION: <span style={{ color: '#f0c060' }}>{savedSession.name}</span>
              {' / '}<span style={{ color: '#c47a2a' }}>{savedSession.code}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <LobbyBtn onClick={rejoin} disabled={loading} variant="primary">
                🔄 REJOIN
              </LobbyBtn>
              <button
                onClick={() => { clearSession(); setSavedSession(null); }}
                style={{
                  background: 'transparent', border: '2px solid #3d1f0a',
                  color: '#5a3a18', fontFamily: FONT, fontSize: 8,
                  padding: '10px 14px', cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* メインカード */}
        <div style={{
          background: 'rgba(6,3,1,0.9)',
          border: '3px solid #5a2d0a',
          outline: '1px solid #2d1208',
          outlineOffset: 4,
          padding: '28px 24px',
          width: '100%', maxWidth: 400,
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'lobbyFadeIn 0.5s ease 0.1s both',
        }}>

          {/* 名前フィールド */}
          <div>
            <div style={{ fontFamily: FONT, fontSize: 7, color: '#5a3a18', marginBottom: 8 }}>
              YOUR NAME
            </div>
            {user ? (
              <div style={{
                padding: '12px 14px',
                border: '2px solid #3d1f0a',
                background: 'rgba(20,10,2,0.6)',
                color: '#c8a06a',
                fontFamily: FONT, fontSize: 9,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {user.user_metadata?.avatar_url && (
                  <img src={user.user_metadata.avatar_url} alt=""
                    style={{ width: 20, height: 20, borderRadius: 2, border: '1px solid #5a2d0a' }} />
                )}
                {displayName}
                <span style={{ fontSize: 6, color: '#3d1f0a', marginLeft: 4 }}>（Google）</span>
              </div>
            ) : (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createRoom()}
                placeholder="例: たろう"
                maxLength={20}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '2px solid #3d1f0a',
                  background: 'rgba(20,10,2,0.6)',
                  color: '#c8a06a',
                  fontFamily: FONT, fontSize: 10,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* ─── ソロモード（ログイン済み）: 固定ルーム ─── */}
          {isSolo && user ? (
            <LobbyBtn
              onClick={() => { playClick(); enterSoloRoom(); }}
              disabled={loading}
              variant="primary"
            >
              {loading
                ? <><span style={{ display: 'inline-block', animation: 'lobbySpin 0.8s linear infinite' }}>◌</span> LOADING...</>
                : '🎮 ENTER MY ROOM'}
            </LobbyBtn>

          ) : isSolo ? (
            /* ソロ・ゲスト: 通常のCREATE ROOM */
            <LobbyBtn
              onClick={() => { playClick(); createRoom(); }}
              disabled={loading}
              variant="primary"
            >
              {loading
                ? <><span style={{ display: 'inline-block', animation: 'lobbySpin 0.8s linear infinite' }}>◌</span> LOADING...</>
                : '✨ CREATE ROOM'}
            </LobbyBtn>

          ) : (
            /* ─── マルチモード ─── */
            <>
              {/* ルーム名（任意） */}
              <div>
                <div style={{ fontFamily: FONT, fontSize: 7, color: '#5a3a18', marginBottom: 8 }}>
                  ROOM NAME <span style={{ color: '#3d1f0a' }}>(任意)</span>
                </div>
                <input
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="例: 友達グループ"
                  maxLength={30}
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '2px solid #3d1f0a',
                    background: 'rgba(20,10,2,0.6)',
                    color: '#c8a06a',
                    fontFamily: FONT, fontSize: 9,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <LobbyBtn
                onClick={() => { playClick(); createRoom(); }}
                disabled={loading}
                variant="primary"
              >
                {loading
                  ? <><span style={{ display: 'inline-block', animation: 'lobbySpin 0.8s linear infinite' }}>◌</span> LOADING...</>
                  : '✨ CREATE ROOM'}
              </LobbyBtn>

              {/* 保存済みマルチルーム一覧（ログイン済みのみ） */}
              {user && savedMultiRooms.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: FONT, fontSize: 7, color: '#5a3a18', marginBottom: 4 }}>
                    MY ROOMS
                  </div>
                  {savedMultiRooms.map(r => (
                    <div key={r.code} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      border: '1px solid #2d1208',
                      padding: '8px 12px',
                      background: 'rgba(20,10,2,0.4)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT, fontSize: 7, color: '#c8a06a' }}>
                          {r.name ?? '(無名)'}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 6, color: '#5a3a18', marginTop: 3 }}>
                          {r.code}
                        </div>
                      </div>
                      <button
                        onClick={() => { playClick(); joinRoom(displayName, r.code); }}
                        disabled={loading}
                        style={{
                          fontFamily: FONT, fontSize: 7,
                          padding: '6px 10px',
                          background: 'transparent',
                          border: '1px solid #3d1f0a',
                          color: '#7c5a30',
                          cursor: 'pointer',
                        }}
                      >
                        REJOIN
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 区切り */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: '#2a1208' }} />
                <span style={{ fontFamily: FONT, fontSize: 7, color: '#3d1f0a' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: '#2a1208' }} />
              </div>

              <div>
                <div style={{ fontFamily: FONT, fontSize: 7, color: '#5a3a18', marginBottom: 8 }}>
                  ROOM CODE
                </div>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && joinRoom()}
                  placeholder="ABC123"
                  maxLength={6}
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '2px solid #3d1f0a',
                    background: 'rgba(20,10,2,0.6)',
                    color: '#f0c060',
                    fontFamily: FONT, fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                    textTransform: 'uppercase', letterSpacing: '0.25em',
                    textAlign: 'center',
                  }}
                />
              </div>

              <LobbyBtn
                onClick={() => { playClick(); joinRoom(); }}
                disabled={loading}
                variant="ghost"
              >
                👋 JOIN ROOM
              </LobbyBtn>
            </>
          )}

          {error && (
            <div style={{ fontFamily: FONT, fontSize: 7, color: '#c0392b', lineHeight: 2 }}>
              ⚠ {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ===== ボタンコンポーネント =====
type LobbyBtnProps = {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
};

function LobbyBtn({ onClick, children, disabled, variant = 'ghost' }: LobbyBtnProps) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONT, fontSize: 9,
        width: '100%', padding: '14px 18px',
        background: isPrimary ? 'rgba(18,9,2,0.9)' : 'transparent',
        border: `2px solid ${isPrimary ? '#c47a2a' : '#3d1f0a'}`,
        color: isPrimary ? '#fcd34d' : '#7c5a30',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        letterSpacing: '0.05em', lineHeight: 1.8,
        transition: 'border-color 0.1s, color 0.1s, box-shadow 0.1s',
      }}
    >
      {children}
    </button>
  );
}
