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
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  if (!room || !me || !room.activeGameId) return null;

  const activeGame = room.games.find(g => g.id === room.activeGameId);

  // iframeにメッセージを送るヘルパー
  // sandboxed iframe は origin が null になるため "*" を使用
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
      // セキュリティ: iframeからのメッセージのみ受け入れる
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
  }

  // iframeロード完了時: 初期化メッセージを送信
  function onIframeLoad() {
    sendToIframe({
      type: 'init',
      isHost,
      me: { id: me!.id, name: me!.name },
      players: room!.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })),
    });

    // 既存のゲーム状態がある場合は送信（途中参加対応）
    const state = useStore.getState().gameState;
    if (state !== null) {
      sendToIframe({ type: 'state', state });
    }
  }

  // サーバーからのゲーム状態をiframeへ転送
  useEffect(() => {
    if (gameState !== null) {
      sendToIframe({ type: 'state', state: gameState });
    }
  }, [gameState, sendToIframe]);

  // サーバーからのアクション（ホストのみ受け取る）をiframeへ転送
  useEffect(() => {
    if (lastAction && isHost) {
      sendToIframe({ type: 'action', action: lastAction.action, playerId: lastAction.playerId });
    }
  }, [lastAction, isHost, sendToIframe]);

  // サーバーからのイベントをiframeへ転送
  useEffect(() => {
    if (lastEvent !== null) {
      sendToIframe({ type: 'event', event: lastEvent });
    }
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

  // 一時退出（セッション保持、ロビーへ）
  function tempLeave() {
    socket.emit('room:leave');
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('lobby');
    setShowLeaveMenu(false);
  }

  // 退出（セッションリセット、ホームへ）
  function fullLeave() {
    socket.emit('room:leave');
    clearSession();
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('home');
    setShowLeaveMenu(false);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f13' }}>
      {/* 再接続中バナー */}
      {isDisconnected && (
        <div style={{
          background: '#78350f',
          borderBottom: '1px solid #92400e',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          fontSize: 13,
          color: '#fef3c7',
          flexShrink: 0,
        }}>
          <span>🔄</span>
          再接続中... しばらくお待ちください
        </div>
      )}

      {/* ゲームヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#1a1a24',
        borderBottom: '1px solid #2a2a3a',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* ルームに戻る */}
          <button onClick={backToRoom} style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #333',
            background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 13,
          }}>
            ← 戻る
          </button>

          <span style={{ fontWeight: 700, color: '#fff' }}>
            {activeGame?.name ?? 'ゲーム'}
          </span>
          <span style={{ fontSize: 12, color: '#666' }}>
            by {activeGame?.deployedBy}
          </span>

          {/* リロードボタン */}
          <button onClick={reloadGame} style={{
            padding: '5px 10px', borderRadius: 8, border: '1px solid #333',
            background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 13,
          }} title="ゲームをリロード">
            🔄
          </button>

          {/* ─── ホームに戻るドロップダウン ─── */}
          <div style={{ position: 'relative', marginLeft: 4 }}>
            <button
              onClick={() => setShowLeaveMenu(!showLeaveMenu)}
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                border: '1px solid #2a2a3a',
                background: 'transparent',
                color: '#666',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ← ホーム <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
            </button>

            {showLeaveMenu && (
              <>
                <div
                  onClick={() => setShowLeaveMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                />
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 100,
                  background: '#1a1a24',
                  border: '1px solid #2a2a3a',
                  borderRadius: 12,
                  overflow: 'hidden',
                  minWidth: 230,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                }}>
                  <button
                    onClick={tempLeave}
                    style={{
                      width: '100%', padding: '14px 16px', background: 'none',
                      border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left', display: 'block',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2a2a3a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>🔄 一時退出</div>
                    <div style={{ fontSize: 12, color: '#888' }}>セッション保持（後でルームに戻れる）</div>
                  </button>
                  <div style={{ height: 1, background: '#2a2a3a' }} />
                  <button
                    onClick={fullLeave}
                    style={{
                      width: '100%', padding: '14px 16px', background: 'none',
                      border: 'none', color: '#f87171', cursor: 'pointer', textAlign: 'left', display: 'block',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2a2a3a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>🚪 退出</div>
                    <div style={{ fontSize: 12, color: '#888' }}>セッションをリセット</div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 右: プレイヤー一覧 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {room.players.map(p => (
            <span key={p.id} style={{
              padding: '3px 8px', borderRadius: 12, fontSize: 12,
              background: p.isHost ? '#6366f1' : '#2a2a3a',
              color: p.id === me.id ? '#fff' : '#aaa',
            }}>
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* ゲーム iframe */}
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={`${SERVER}/game/${room.code}/${room.activeGameId}`}
        onLoad={onIframeLoad}
        sandbox="allow-scripts"
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={activeGame?.name ?? 'Game'}
      />
    </div>
  );
}
