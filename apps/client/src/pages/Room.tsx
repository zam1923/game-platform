import { useState } from 'react';
import { socket } from '../socket';
import { useStore, type CreationMode, type GameProvider, type DeployedGameMeta } from '../store';
import { clearSession } from '../utils/session';
import { useAuthStore } from '../authStore';
import { supabase, isSupabaseEnabled } from '../supabase';

const SERVER = window.location.origin;

// 各AIの表示情報
const AI_INFO: Record<GameProvider, { label: string; emoji: string; color: string }> = {
  claude:  { label: 'Claude',    emoji: '🟣', color: '#7c3aed' },
  openai:  { label: 'GPT-4o',   emoji: '🟢', color: '#059669' },
  gemini:  { label: 'Gemini',   emoji: '🔵', color: '#2563eb' },
  manual:  { label: 'Manual',   emoji: '⚙️', color: '#6b7280' },
};

// 自分のAIを使うモードのリンク（Custom GPT / Projects / Gems）
const AI_PLATFORM_LINKS: Array<{ key: string; label: string; emoji: string; color: string; url: string }> = [
  { key: 'chatgpt', label: 'ChatGPT',    emoji: '💬', color: '#10a37f', url: 'https://chatgpt.com/g/g-69a407cbcc8c819184071fc910df88ee-game-platform-creator' },
  { key: 'claude',  label: 'Claude',     emoji: '🟣', color: '#7c3aed', url: 'https://claude.ai/project/placeholder' },
  { key: 'gemini',  label: 'Gemini',     emoji: '🔵', color: '#2563eb', url: 'https://gemini.google.com/app/placeholder' },
  { key: 'perplexity', label: 'Perplexity', emoji: '⚡', color: '#f59e0b', url: 'https://www.perplexity.ai/spaces/placeholder' },
];

export default function Room() {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  const pendingChallenge = useStore((s) => s.pendingChallenge);
  const generatingGames = useStore((s) => s.generatingGames);
  const isDisconnected = useStore((s) => s.isDisconnected);
  const { user } = useAuthStore();

  const [gameDesc, setGameDesc] = useState(pendingChallenge ?? '');
  const [selectedProvider, setSelectedProvider] = useState<Exclude<GameProvider, 'manual'>>('claude');
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState('');
  const [challengeInput, setChallengeInput] = useState('');
  const [copiedConnection, setCopiedConnection] = useState(false);
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');

  const isHost = me?.isHost ?? false;

  if (!room || !me) return null;

  // Challenge モードのお題が来たらフォームに反映
  if (pendingChallenge && gameDesc !== pendingChallenge) {
    setGameDesc(pendingChallenge);
    useStore.getState().setChallengePrompt('');
  }

  function copyCode() {
    navigator.clipboard.writeText(room!.code);
  }

  // 接続情報（ルームコード + APIキー + URL + ゲーム説明）をまとめてコピー
  function copyConnectionInfo() {
    const parts = [
      `ルームコード: ${room!.code}`,
      `APIキー: ${room!.apiKey}`,
      `URL: ${SERVER}`,
    ];
    if (gameDesc.trim()) {
      parts.push(`ゲーム内容: ${gameDesc.trim()}`);
    }
    navigator.clipboard.writeText(parts.join('\n'));
    setCopiedConnection(true);
    setTimeout(() => setCopiedConnection(false), 2000);
  }

  function openAiPlatform(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // 一時退出（セッション保持、ロビーに戻る）
  function tempLeave() {
    socket.emit('room:leave');
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('lobby');
    setShowLeaveMenu(false);
  }

  // 退出（セッションリセット、ホームに戻る）
  function fullLeave() {
    socket.emit('room:leave');
    clearSession();
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('home');
    setShowLeaveMenu(false);
  }

  // プラットフォームのAIでゲームを生成
  async function generateGame() {
    const description = gameDesc.trim();
    if (!description) return setGenerateMsg('❌ ゲームの説明を入力してください');
    setGenerating(true);
    setGenerateMsg('');

    try {
      const res = await fetch(`${SERVER}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: room!.code,
          apiKey: room!.apiKey,
          description,
          playerName: me!.name,
          provider: selectedProvider,
          mode: room!.creationMode,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setGenerateMsg('');
        setGameDesc('');
      } else {
        setGenerateMsg('❌ ' + data.error);
      }
    } catch {
      setGenerateMsg('❌ 通信エラーが発生しました');
    } finally {
      setGenerating(false);
    }
  }

  // HTMLを直接貼り付けてデプロイ
  async function deployHtml() {
    const html = htmlCode.trim();
    if (!html) return setDeployMsg('❌ HTMLを貼り付けてください');
    setDeploying(true);
    setDeployMsg('');

    try {
      const res = await fetch(`${SERVER}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: room!.code,
          apiKey: room!.apiKey,
          name: gameDesc.trim() || '無名のゲーム',
          code: html,
          deployedBy: me!.name,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeployMsg('✅ ' + data.message);
        setHtmlCode('');
      } else {
        setDeployMsg('❌ ' + data.error);
      }
    } catch {
      setDeployMsg('❌ 通信エラーが発生しました');
    } finally {
      setDeploying(false);
    }
  }

  function selectGame(gameId: string) {
    if (!isHost) return;
    socket.emit('game:select', { gameId });
  }

  function sendChallenge() {
    if (!challengeInput.trim()) return;
    socket.emit('room:challenge', challengeInput.trim());
    setChallengeInput('');
  }

  function setMode(mode: CreationMode) {
    socket.emit('room:setMode', mode);
  }

  // ゲームをライブラリに保存（Supabase）
  async function saveToLibrary(game: DeployedGameMeta) {
    if (!supabase || !user) return;
    setSavingGameId(game.id);
    setSaveMsg('');
    try {
      // サーバーからゲームHTMLを取得
      const res = await fetch(`${SERVER}/game/${room!.code}/${game.id}`);
      if (!res.ok) throw new Error('HTML取得失敗');
      const html = await res.text();

      const { error } = await supabase.from('games').insert({
        user_id: user.id,
        name: game.name,
        html,
        provider: game.provider,
        is_favorite: false,
      });

      if (error) {
        setSaveMsg('❌ 保存に失敗しました');
      } else {
        setSaveMsg(`✅ 「${game.name}」をライブラリに保存しました`);
      }
    } catch {
      setSaveMsg('❌ 通信エラー');
    } finally {
      setSavingGameId(null);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  const modeLabels: Record<CreationMode, string> = {
    solo: '1人が作る',
    free: '各自が自由に',
    challenge: '全員同じ指示で',
  };

  return (
    <div style={{ minHeight: '100vh', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      {/* 再接続中バナー */}
      {isDisconnected && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: '#78350f',
          borderBottom: '1px solid #92400e',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          fontSize: 14,
          color: '#fef3c7',
        }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</span>
          再接続中... しばらくお待ちください
        </div>
      )}

      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        {/* 左: ホームに戻るボタン（ドロップダウン） */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLeaveMenu(!showLeaveMenu)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #2a2a3a',
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← ホーム <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>

          {showLeaveMenu && (
            <>
              {/* 背景クリックで閉じる */}
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
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
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

        {/* 中央: ルームコード */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#888' }}>ルームコード</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '0.15em', color: '#6366f1' }}>
              {room.code}
            </span>
            <button onClick={copyCode} style={btnStyle('#2a2a3a')}>コピー</button>
          </div>
        </div>

        {/* 右: 参加者 */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#888' }}>参加者 {room.players.length}人</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
            {room.players.map(p => (
              <span key={p.id} style={{
                padding: '4px 10px', borderRadius: 20,
                background: p.isHost ? '#6366f1' : '#1a1a24',
                border: '1px solid #2a2a3a',
                fontSize: 13,
              }}>
                {p.isHost ? '👑 ' : ''}{p.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ライブラリ保存メッセージ */}
      {saveMsg && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          background: saveMsg.startsWith('✅') ? '#052e16' : '#1a0a0a',
          border: `1px solid ${saveMsg.startsWith('✅') ? '#166534' : '#7f1d1d'}`,
          borderRadius: 10,
          fontSize: 13,
          color: saveMsg.startsWith('✅') ? '#86efac' : '#fca5a5',
        }}>
          {saveMsg}
        </div>
      )}

      {/* 生成中バナー */}
      {generatingGames.length > 0 && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          background: '#1a1220',
          border: '1px solid #4c1d95',
          borderRadius: 12,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 13, color: '#a78bfa' }}>🔄 生成中:</div>
          {generatingGames.map((g, i) => (
            <div key={i} style={{
              fontSize: 13,
              color: '#e0e0e0',
              background: '#2a1850',
              padding: '4px 10px',
              borderRadius: 16,
            }}>
              {AI_INFO[g.provider]?.emoji ?? '🤖'} {g.playerName}が{AI_INFO[g.provider]?.label ?? g.provider}でゲームを生成中...
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* 左: ゲーム作成パネル */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🎮 ゲームを作る</div>

          {/* モード選択（ホストのみ） */}
          {isHost && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>作成モード</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['solo', 'free', 'challenge'] as CreationMode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    ...btnStyle(room.creationMode === m ? '#6366f1' : '#1a1a24'),
                    flex: 1, fontSize: 12, padding: '8px 4px',
                  }}>
                    {modeLabels[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Challenge モード: ホストがお題を送信 */}
          {room.creationMode === 'challenge' && isHost && (
            <div style={{ marginBottom: 16, padding: 12, background: '#12121e', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8 }}>📢 全員にお題を送信</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={challengeInput}
                  onChange={e => setChallengeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChallenge()}
                  placeholder="例: 爆弾ワードゲーム"
                />
                <button onClick={sendChallenge} style={btnStyle('#f59e0b')}>送信</button>
              </div>
            </div>
          )}

          {room.creationMode === 'challenge' && room.challengePrompt && !isHost && (
            <div style={{ marginBottom: 12, padding: 10, background: '#1a1612', borderRadius: 8, fontSize: 13, color: '#f59e0b' }}>
              📢 お題: <strong>{room.challengePrompt}</strong>
            </div>
          )}

          {/* ゲームの説明入力（共通） */}
          <div style={{ marginBottom: 12 }}>
            <input
              style={inputStyle}
              value={gameDesc}
              onChange={e => setGameDesc(e.target.value)}
              placeholder="例: 爆弾ワードゲーム、マルバツゲーム..."
            />
          </div>

          {/* ─── 自分のAIで作る（無料） ─── */}
          <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>
              🆓 自分のAIで作る（無料）
            </div>

            {/* 接続情報をコピー */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                ① ルームコード・APIキー・ゲーム内容をまとめてコピー
              </div>
              <button
                onClick={copyConnectionInfo}
                style={{
                  ...btnStyle(copiedConnection ? '#059669' : '#1f2937'),
                  width: '100%',
                  fontSize: 12,
                  padding: '8px 12px',
                  border: '1px solid #374151',
                }}
              >
                {copiedConnection
                  ? '✅ コピーしました！'
                  : gameDesc.trim()
                    ? `📋 「${gameDesc.trim()}」+ 接続情報をコピー`
                    : `📋 ルームコード「${room.code}」と接続情報をコピー`}
              </button>
              {!gameDesc.trim() && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                  ↑ 上のテキストボックスにゲーム内容を入れるとまとめてコピーできます
                </div>
              )}
            </div>

            {/* AI選択 */}
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
              ② どのAIを使う？（専用ゲーム作成環境が開きます）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {AI_PLATFORM_LINKS.map(ai => (
                <button
                  key={ai.key}
                  onClick={() => openAiPlatform(ai.url)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${ai.color}40`,
                    background: `${ai.color}15`,
                    color: '#e0e0e0',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    justifyContent: 'center',
                  }}
                >
                  {ai.emoji} {ai.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── プラットフォームのAIで作る（有料） ─── */}
          <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>
              ✨ プラットフォームのAIで作る
            </div>

            {/* AIセレクタ */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['claude', 'openai', 'gemini'] as const).map(p => {
                const info = AI_INFO[p];
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedProvider(p)}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      borderRadius: 8,
                      border: `2px solid ${selectedProvider === p ? info.color : '#2a2a3a'}`,
                      background: selectedProvider === p ? `${info.color}20` : '#12121e',
                      color: selectedProvider === p ? info.color : '#888',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {info.emoji} {info.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={generateGame}
              disabled={generating}
              style={{
                ...btnStyle(generating ? '#374151' : AI_INFO[selectedProvider].color),
                width: '100%',
                padding: '10px 0',
                fontSize: 14,
              }}
            >
              {generating ? '⏳ 生成中...' : `🎮 ${AI_INFO[selectedProvider].emoji} ${AI_INFO[selectedProvider].label}でゲームを作る`}
            </button>
            {generateMsg && (
              <div style={{ fontSize: 13, marginTop: 8, color: '#f87171' }}>{generateMsg}</div>
            )}
          </div>

          {/* HTMLを直接デプロイ（折りたたみ） */}
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 12, color: '#555', cursor: 'pointer', padding: '4px 0' }}>
              🔧 AIが生成したHTMLを直接貼り付けてデプロイ
            </summary>
            <div style={{ marginTop: 10, background: '#0d1117', border: '1px solid #1f2937', borderRadius: 10, padding: 12 }}>
              <textarea
                style={{ ...inputStyle, height: 80, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                value={htmlCode}
                onChange={e => setHtmlCode(e.target.value)}
                placeholder={'<!DOCTYPE html>\n<html>...\n</html>'}
              />
              <button
                onClick={deployHtml}
                disabled={deploying}
                style={{ ...btnStyle('#10b981'), width: '100%', marginTop: 8 }}
              >
                {deploying ? 'デプロイ中...' : '🚀 デプロイ！'}
              </button>
              {deployMsg && <div style={{ fontSize: 13, marginTop: 8, color: deployMsg.startsWith('✅') ? '#10b981' : '#f87171' }}>{deployMsg}</div>}
            </div>
          </details>
        </div>

        {/* 右: デプロイされたゲーム一覧 */}
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            🕹️ ゲーム一覧 ({room.games.length})
          </div>

          {room.games.length === 0 ? (
            <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
              まだゲームがありません。<br />
              左のパネルからゲームを作ってデプロイしよう！
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...room.games].reverse().map(game => {
                const providerInfo = AI_INFO[game.provider] ?? AI_INFO.manual;
                const isSaving = savingGameId === game.id;
                return (
                  <div key={game.id} style={{
                    padding: 14,
                    background: '#12121e',
                    border: '1px solid #2a2a3a',
                    borderRadius: 10,
                    cursor: isHost ? 'pointer' : 'default',
                    transition: 'border-color 0.15s',
                  }} onMouseEnter={e => isHost && ((e.currentTarget as HTMLElement).style.borderColor = '#6366f1')}
                     onMouseLeave={e => isHost && ((e.currentTarget as HTMLElement).style.borderColor = '#2a2a3a')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{game.name}</div>
                      {/* AI バッジ */}
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: `${providerInfo.color}20`,
                        border: `1px solid ${providerInfo.color}40`,
                        color: providerInfo.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {providerInfo.emoji} {providerInfo.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      by {game.deployedBy} · {new Date(game.deployedAt).toLocaleTimeString('ja-JP')}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {isHost && (
                        <button
                          onClick={() => selectGame(game.id)}
                          style={{ ...btnStyle('#6366f1'), flex: 1, padding: '8px 0' }}
                        >
                          ▶ このゲームで遊ぶ
                        </button>
                      )}

                      {/* ライブラリに保存（ログイン済み + Supabase設定済みのみ） */}
                      {isSupabaseEnabled && user && (
                        <button
                          onClick={() => saveToLibrary(game)}
                          disabled={isSaving}
                          title="ライブラリに保存"
                          style={{
                            ...btnStyle(isSaving ? '#374151' : '#1e293b'),
                            padding: '8px 12px',
                            fontSize: 13,
                            border: '1px solid #334155',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isSaving ? '...' : '💾'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* API情報（折りたたみ） */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 12, color: '#555', cursor: 'pointer' }}>
              API情報（上級者向け）
            </summary>
            <div style={{ marginTop: 8, padding: 10, background: '#0a0a12', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: '#888', wordBreak: 'break-all' }}>
              <div>URL: {SERVER}/api/deploy</div>
              <div>Room: {room.code}</div>
              <div>Key: {room.apiKey}</div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid #2a2a3a',
  borderRadius: 16,
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #333',
  background: '#0f0f18',
  color: '#e0e0e0',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: bg,
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  };
}
