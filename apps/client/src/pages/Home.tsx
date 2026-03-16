import { useState } from 'react';
import { useAuthStore } from '../authStore';
import { useStore } from '../store';
import type { GameType } from '../store';
import { isSupabaseEnabled } from '../supabase';
import { playClick, playHover } from '../utils/sound';
import { LibraryCanvas } from '../components/LibraryCanvas';

const FONT = "'Press Start 2P', monospace";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  @keyframes titleFlicker {
    0%, 88%, 100% { opacity: 1; }
    90%, 94% { opacity: 0.75; }
    92% { opacity: 0.9; }
  }
  @keyframes cardGlow {
    0%, 100% { box-shadow: 0 0 8px rgba(160,90,20,0.25), inset 0 0 20px rgba(0,0,0,0.5); }
    50%       { box-shadow: 0 0 20px rgba(196,120,30,0.4), inset 0 0 20px rgba(0,0,0,0.5); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes btnPulse {
    0%, 100% { border-color: #c47a2a; box-shadow: 0 0 8px rgba(196,122,42,0.3); }
    50%       { border-color: #f59e0b; box-shadow: 0 0 20px rgba(245,158,11,0.5); }
  }
`;

export default function Home() {
  const { user, signInWithGoogle, signOut, loading } = useAuthStore();
  const [guestMode, setGuestMode] = useState(false);

  function goToLobby(gameType: GameType) {
    playClick();
    useStore.getState().setPendingGameType(gameType);
    useStore.getState().setNavPage('lobby');
  }

  function goToLibrary() {
    playClick();
    useStore.getState().setNavPage('library');
  }

  if (loading) return null;

  return (
    <>
      <style>{CSS}</style>

      {/* キャンバス背景アニメーション */}
      <LibraryCanvas />

      {/* UI レイヤー */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: 24,
      }}>

        {/* ログアウトボタン（右上・ログイン済み） */}
        {isSupabaseEnabled && user && (
          <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                style={{
                  width: 26, height: 26, borderRadius: 2,
                  border: '2px solid #5a2d0a',
                  imageRendering: 'pixelated',
                }}
              />
            )}
            <PixelBtn onClick={() => { playClick(); signOut(); }} size="sm" variant="ghost">
              LOGOUT
            </PixelBtn>
          </div>
        )}

        {/* タイトル */}
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.6s ease' }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 'clamp(13px, 2.5vw, 20px)',
            color: '#f0c060',
            letterSpacing: '0.06em',
            marginBottom: 10,
            animation: 'titleFlicker 10s ease-in-out infinite',
            textShadow: '0 0 12px rgba(240,192,96,0.55), 2px 2px 0 #2d1208',
          }}>
            📖 GAME PLATFORM
          </div>
          <div style={{
            fontFamily: FONT,
            fontSize: 'clamp(6px, 1vw, 8px)',
            color: '#6b4420',
            letterSpacing: '0.1em',
          }}>
            ― 魔法図書館の挑戦 ―
          </div>
        </div>

        {/* カード */}
        <div style={{
          background: 'rgba(6, 3, 1, 0.88)',
          border: '3px solid #5a2d0a',
          outline: '1px solid #2d1208',
          outlineOffset: 4,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'fadeUp 0.6s ease 0.1s both, cardGlow 4s ease-in-out infinite',
        }}>

          {/* === ログイン済み === */}
          {user ? (
            <>
              <div style={{
                fontFamily: FONT,
                fontSize: 8,
                color: '#c8a06a',
                textAlign: 'center',
                lineHeight: 2,
                borderBottom: '1px solid #2d1208',
                paddingBottom: 12,
                marginBottom: 4,
              }}>
                WELCOME BACK
                <br />
                <span style={{ color: '#f0c060', fontSize: 10 }}>
                  {(user.user_metadata?.full_name || user.user_metadata?.name || 'ADVENTURER')
                    .toUpperCase().slice(0, 16)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <ModeCard
                  icon="🎮" label="SOLO" sub="一人でプレイ"
                  accentColor="#6366f1"
                  onClick={() => goToLobby('solo')}
                />
                <ModeCard
                  icon="👥" label="MULTI" sub="みんなでプレイ"
                  accentColor="#10b981"
                  onClick={() => goToLobby('multi')}
                />
              </div>

              {isSupabaseEnabled && (
                <PixelBtn onClick={goToLibrary} variant="ghost">
                  📚 MY LIBRARY
                </PixelBtn>
              )}
            </>

          /* === 未ログイン：入り口選択 === */
          ) : !guestMode ? (
            <>
              <div style={{
                fontFamily: FONT, fontSize: 8,
                color: '#5a3a18', textAlign: 'center', marginBottom: 4,
              }}>
                — ENTER THE LIBRARY —
              </div>

              {isSupabaseEnabled && (
                <PixelBtn
                  onClick={() => { playClick(); signInWithGoogle(); }}
                  variant="primary"
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <GoogleSVG />
                    GOOGLE SIGN IN
                  </span>
                </PixelBtn>
              )}

              <PixelBtn onClick={() => { playClick(); setGuestMode(true); }} variant="ghost">
                👤 GUEST PLAY
              </PixelBtn>
            </>

          /* === ゲスト選択後：モード選択 === */
          ) : (
            <>
              <div style={{
                fontFamily: FONT, fontSize: 8,
                color: '#5a3a18', textAlign: 'center', marginBottom: 4,
              }}>
                — SELECT MODE —
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <ModeCard
                  icon="🎮" label="SOLO" sub="一人でプレイ"
                  accentColor="#6366f1"
                  onClick={() => goToLobby('solo')}
                />
                <ModeCard
                  icon="👥" label="MULTI" sub="みんなでプレイ"
                  accentColor="#10b981"
                  onClick={() => goToLobby('multi')}
                />
              </div>

              <button
                onClick={() => { playClick(); setGuestMode(false); }}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#4a2a10', fontFamily: FONT, fontSize: 7,
                  cursor: 'pointer', padding: '8px', textAlign: 'center',
                }}
              >
                ← BACK
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ===== サブコンポーネント =====

type PixelBtnProps = {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
};

function PixelBtn({ onClick, children, variant = 'ghost', size = 'md' }: PixelBtnProps) {
  const isPrimary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT,
        fontSize: size === 'sm' ? 7 : 9,
        cursor: 'pointer',
        width: '100%',
        padding: size === 'sm' ? '8px 12px' : '14px 18px',
        background: isPrimary ? 'rgba(18, 9, 2, 0.9)' : 'transparent',
        border: `2px solid ${isPrimary ? '#c47a2a' : '#3d1f0a'}`,
        color: isPrimary ? '#fcd34d' : '#7c5a30',
        letterSpacing: '0.05em',
        lineHeight: 1.8,
        transition: 'border-color 0.1s, color 0.1s, box-shadow 0.1s',
        animation: isPrimary ? 'btnPulse 2.5s ease-in-out infinite' : 'none',
      }}
    >
      {children}
    </button>
  );
}

type ModeCardProps = {
  icon: string;
  label: string;
  sub: string;
  accentColor: string;
  onClick: () => void;
};

function ModeCard({ icon, label, sub, accentColor, onClick }: ModeCardProps) {
  return (
    <button
      onClick={() => { playClick(); onClick(); }}
      style={{
        background: 'rgba(8, 4, 1, 0.7)',
        border: '2px solid #3d1f0a',
        cursor: 'pointer',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <span style={{ fontFamily: FONT, fontSize: 8, color: '#f0c060' }}>{label}</span>
      <span style={{ fontFamily: FONT, fontSize: 6, color: '#4a2a10', lineHeight: 1.6 }}>{sub}</span>
    </button>
  );
}

function GoogleSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.3H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.51 10.51A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.03.25-1.51V5.42H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.5.85 3.58l2.68-2.07z"/>
      <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.42L4.51 7.49c.63-1.9 2.39-3.91 4.47-3.91z"/>
    </svg>
  );
}
