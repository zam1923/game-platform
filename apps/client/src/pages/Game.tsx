import { useEffect, useRef } from 'react';
import { socket } from '../socket';
import { useStore } from '../store';

const SERVER = window.location.origin;

export default function Game() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  const gameState = useStore((s) => s.gameState);
  const lastAction = useStore((s) => s.lastAction);
  const lastEvent = useStore((s) => s.lastEvent);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isHost = me?.isHost ?? false;

  if (!room || !me || !room.activeGameId) return null;

  const activeGame = room.games.find(g => g.id === room.activeGameId);

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
  }, [isHost]);

  // iframeにメッセージを送るヘルパー
  function sendToIframe(msg: object) {
    iframeRef.current?.contentWindow?.postMessage(
      { _platform: true, ...msg },
      SERVER, // origin を限定（セキュリティ）
    );
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
  }, [gameState]);

  // サーバーからのアクション（ホストのみ受け取る）をiframeへ転送
  useEffect(() => {
    if (lastAction && isHost) {
      sendToIframe({ type: 'action', action: lastAction.action, playerId: lastAction.playerId });
    }
  }, [lastAction, isHost]);

  // サーバーからのイベントをiframeへ転送
  useEffect(() => {
    if (lastEvent !== null) {
      sendToIframe({ type: 'event', event: lastEvent });
    }
  }, [lastEvent]);

  function backToRoom() {
    useStore.getState().setActiveGame('');
    // ストアのactiveGameIdをリセット
    useStore.setState((s) => ({
      room: s.room ? { ...s.room, activeGameId: null, phase: 'waiting' } : null,
      gameState: null,
      lastAction: null,
      lastEvent: null,
    }));
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f13' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        </div>
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
