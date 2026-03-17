import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';
import { useStore } from '../store';
import { clearSession } from '../utils/session';

const SERVER = import.meta.env.VITE_SERVER_URL || window.location.origin;

export default function Game() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  const gameState = useStore((s) => s.gameState);
  const lastAction = useStore((s) => s.lastAction);
  const lastEvent = useStore((s) => s.lastEvent);
  const isDisconnected = useStore((s) => s.isDisconnected);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isHost = me?.isHost ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  if (!room || !me || !room.activeGameId) return null;

  const activeGame = room.games.find(g => g.id === room.activeGameId);

  // iframeにメッセージを送るヘルパー
  const sendToIframe = useCallback((msg: object) => {
    iframeRef.current?.contentWindow?.postMessage(
      { _platform: true, ...msg },
      '*',
    );
  }, []);

  // iframe → サーバー: postMessageを受け取り転送
  useEffect(() => {
    function handler(e: MessageEvent) {
      const data = e.data;
      if (!data?._p) return;
      if (e.source !== iframeRef.current?.contentWindow) return;

      switch (data.type) {
        case 'dispatch':
          socket.emit('game:action', data.action);
          break;
        case 'broadcast':
          if (isHost) socket.emit('game:broadcast', data.state);
          break;
        case 'broadcastEvent':
          if (isHost) socket.emit('game:broadcastEvent', data.event);
          break;
        case 'sendTo':
          if (isHost) socket.emit('game:sendTo', data.playerId, data.event);
          break;
      }
    }

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isHost, sendToIframe]);

  function reloadGame() {
    setIframeKey(k => k + 1);
    setMenuOpen(false);
  }

  // iframeロード完了時: 初期化メッセージを送信
  function onIframeLoad() {
    sendToIframe({
      type: 'init',
      isHost,
      me: { id: me!.id, name: me!.name },
      players: room!.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
    });

    const state = useStore.getState().gameState;
    if (state !== null) {
      sendToIframe({ type: 'state', state });
    }
  }

  useEffect(() => {
    if (gameState !== null) sendToIframe({ type: 'state', state: gameState });
  }, [gameState, sendToIframe]);

  useEffect(() => {
    if (lastAction && isHost) {
      sendToIframe({ type: 'action', action: lastAction.action, playerId: lastAction.playerId });
    }
  }, [lastAction, isHost, sendToIframe]);

  useEffect(() => {
    if (lastEvent !== null) sendToIframe({ type: 'event', event: lastEvent });
  }, [lastEvent, sendToIframe]);

  function backToRoom() {
    useStore.getState().setActiveGame('');
    useStore.setState((s) => ({
      room: s.room ? { ...s.room, activeGameId: null, phase: 'waiting' } : null,
      gameState: null,
      lastAction: null,
      lastEvent: null,
    }));
  }

  function tempLeave() {
    socket.emit('room:leave');
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('lobby');
    setMenuOpen(false);
    setShowLeaveConfirm(false);
  }

  function fullLeave() {
    socket.emit('room:leave');
    clearSession();
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('home');
    setMenuOpen(false);
    setShowLeaveConfirm(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f0f13' }}>
      {/* ゲーム iframe（全画面） */}
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={`${SERVER}/game/${room.code}/${room.activeGameId}`}
        onLoad={onIframeLoad}
        sandbox="allow-scripts"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        title={activeGame?.name ?? 'Game'}
      />

      {/* 再接続中バナー（最前面） */}
      {isDisconnected && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          background: 'rgba(120,53,15,0.95)',
          borderBottom: '1px solid #92400e',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, fontSize: 13, color: '#fef3c7',
        }}>
          🔄 再接続中... しばらくお待ちください
        </div>
      )}

      {/* ─── 左上メニューボタン ─── */}
      <button
        onClick={() => { setMenuOpen(v => !v); setShowLeaveConfirm(false); }}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 300,
          width: 36,
          height: 36,
          background: menuOpen ? 'rgba(99,102,241,0.85)' : 'rgba(0,0,0,0.55)',
          border: `1.5px solid ${menuOpen ? '#6366f1' : 'rgba(255,255,255,0.18)'}`,
          borderRadius: 8,
          color: '#fff',
          fontSize: 15,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(6px)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        title="メニュー"
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      {/* ─── メニューパネル ─── */}
      {menuOpen && (
        <>
          {/* 背景タップで閉じる */}
          <div
            onClick={() => { setMenuOpen(false); setShowLeaveConfirm(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 290 }}
          />

          <div style={{
            position: 'fixed',
            top: 56,
            left: 12,
            zIndex: 300,
            minWidth: 230,
            background: 'rgba(15,15,22,0.97)',
            border: '1px solid #2a2a3a',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}>
            {/* ゲーム名 */}
            <div style={{
              padding: '12px 16px 10px',
              borderBottom: '1px solid #1e1e2e',
            }}>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 13, marginBottom: 2 }}>
                {activeGame?.name ?? 'ゲーム'}
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>by {activeGame?.deployedBy}</div>
            </div>

            {/* プレイヤー一覧 */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid #1e1e2e',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}>
              {room.players.map(p => (
                <span key={p.id} style={{
                  padding: '3px 8px', borderRadius: 12, fontSize: 11,
                  background: p.isHost ? '#6366f1' : '#2a2a3a',
                  color: p.id === me.id ? '#fff' : '#aaa',
                }}>
                  {p.name}
                </span>
              ))}
            </div>

            {/* アクション */}
            <MenuBtn onClick={reloadGame}>🔄 ゲームをリロード</MenuBtn>
            <MenuBtn onClick={() => { backToRoom(); setMenuOpen(false); }}>← ルームに戻る</MenuBtn>

            <div style={{ height: 1, background: '#1e1e2e' }} />

            {!showLeaveConfirm ? (
              <MenuBtn onClick={() => setShowLeaveConfirm(true)} dimmed>
                🚪 退出する
              </MenuBtn>
            ) : (
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>どちらで退出しますか？</div>
                <button onClick={tempLeave} style={leaveBtn}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 12 }}>一時退出</div>
                  <div style={{ fontSize: 10, color: '#666' }}>セッション保持（ルームに戻れる）</div>
                </button>
                <button onClick={fullLeave} style={{ ...leaveBtn, border: '1px solid #7f1d1d' }}>
                  <div style={{ fontWeight: 600, color: '#f87171', fontSize: 12 }}>完全退出</div>
                  <div style={{ fontSize: 10, color: '#666' }}>セッションをリセット</div>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuBtn({ onClick, children, dimmed }: {
  onClick: () => void;
  children: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '12px 16px', background: 'none',
        border: 'none', color: dimmed ? '#666' : '#ccc',
        cursor: 'pointer', textAlign: 'left', fontSize: 13,
        display: 'block',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a2e')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  );
}

const leaveBtn: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid #2a2a3a',
  borderRadius: 8, cursor: 'pointer',
  textAlign: 'left',
};
