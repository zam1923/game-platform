import { useAuthStore } from '../authStore';
import { useStore } from '../store';
import { isSupabaseEnabled } from '../supabase';

export default function Home() {
  const { user, signInWithGoogle, signOut, loading } = useAuthStore();

  function goToLobby() {
    useStore.getState().setNavPage('lobby');
  }

  function goToLibrary() {
    useStore.getState().setNavPage('library');
  }

  if (loading) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      padding: 24,
      background: '#0f0f18',
      position: 'relative',
    }}>

      {/* ログイン情報（右上） */}
      {isSupabaseEnabled && (
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#666' }}>{user.email}</span>
              <button
                onClick={signOut}
                style={btnStyle('#1a1a24', '#888')}
              >
                ログアウト
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* タイトル */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: 8 }}>
          🎮 Game Platform
        </div>
        <div style={{ fontSize: 17, color: '#666' }}>
          AIで作ったゲームをみんなで遊ぼう
        </div>
      </div>

      {/* ボタン群 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}>

        {/* 遊ぶ（メインCTA） */}
        <button
          onClick={goToLobby}
          style={{
            padding: '18px 24px',
            borderRadius: 14,
            border: 'none',
            background: '#6366f1',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
            cursor: 'pointer',
            width: '100%',
            letterSpacing: '0.02em',
          }}
        >
          🎮 遊ぶ
        </button>

        {/* マイライブラリ（ログイン済み + Supabase設定済み） */}
        {isSupabaseEnabled && user && (
          <button
            onClick={goToLibrary}
            style={{
              padding: '14px 24px',
              borderRadius: 12,
              border: '1px solid #2a2a3a',
              background: '#1a1a24',
              color: '#fff',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            📚 マイライブラリ
          </button>
        )}

        {/* Google ログイン（未ログイン + Supabase設定済み） */}
        {isSupabaseEnabled && !user && (
          <button
            onClick={signInWithGoogle}
            style={{
              padding: '14px 24px',
              borderRadius: 12,
              border: '1px solid #2a2a3a',
              background: '#1a1a24',
              color: '#aaa',
              fontWeight: 500,
              fontSize: 15,
              cursor: 'pointer',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.3H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.51 10.51A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.03.25-1.51V5.42H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.5.85 3.58l2.68-2.07z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.42L4.51 7.49c.63-1.9 2.39-3.91 4.47-3.91z"/>
            </svg>
            Googleでログイン（ゲームを保存）
          </button>
        )}
      </div>

      {/* フッター説明 */}
      <div style={{ fontSize: 12, color: '#333', textAlign: 'center', maxWidth: 320 }}>
        {isSupabaseEnabled && !user && 'ログインするとゲームをライブラリに保存できます'}
        {!isSupabaseEnabled && '※ Supabaseを設定するとゲームライブラリ機能が使えます'}
      </div>
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid #2a2a3a',
    background: bg,
    color,
    cursor: 'pointer',
    fontSize: 13,
  };
}
