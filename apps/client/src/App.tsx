import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useStore } from './store';
import { useAuthStore, OAUTH_REDIRECT_SCHEME } from './authStore';
import { supabase } from './supabase';
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

    // Android: OAuthコールバックのディープリンクを処理
    if (Capacitor.isNativePlatform() && supabase) {
      const handleAppUrl = CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (url.startsWith(OAUTH_REDIRECT_SCHEME.replace('://auth/callback', ''))) {
          // URLフラグメントからトークンを取得
          const urlWithHash = url.replace('com.gameplatform.app://', 'https://placeholder.com/');
          const parsed = new URL(urlWithHash);
          const hashParams = new URLSearchParams(parsed.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
          await Browser.close();
        }
      });
      return () => { handleAppUrl.then((h) => h.remove()); };
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
