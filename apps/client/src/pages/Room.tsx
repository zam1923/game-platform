import { useState } from 'react';
import { socket } from '../socket';
import { useStore, type CreationMode, type GameProvider, type DeployedGameMeta } from '../store';
import { clearSession } from '../utils/session';
import { useAuthStore } from '../authStore';
import { supabase, isSupabaseEnabled } from '../supabase';

const FONT = "'Press Start 2P', monospace";
const SERVER = window.location.origin;

const AI_INFO: Record<GameProvider, { label: string; emoji: string; color: string }> = {
  claude:  { label: 'Claude',  emoji: '🟣', color: '#a78bfa' },
  openai:  { label: 'ChatGPT', emoji: '🟢', color: '#34d399' },
  gemini:  { label: 'Gemini', emoji: '🔵', color: '#60a5fa' },
  manual:  { label: 'Manual', emoji: '⚙️', color: '#c8a06a' },
};

const CUSTOM_GPT_URL = 'https://chatgpt.com/g/g-69a407cbcc8c819184071fc910df88ee-game-platform-creator';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(196,122,42,0.3); }
    50%       { box-shadow: 0 0 18px rgba(196,122,42,0.6); }
  }
  .room-btn-gold {
    padding: 9px 16px;
    border: 2px solid #c47a2a;
    background: rgba(196,122,42,0.12);
    color: #f0d090;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    font-family: 'Press Start 2P', monospace;
  }
  .room-btn-gold:hover {
    background: rgba(196,122,42,0.26);
    border-color: #f0c060;
    box-shadow: 0 0 14px rgba(240,192,96,0.35);
  }
  .room-btn-ghost {
    padding: 9px 16px;
    border: 1px solid #3d1f0a;
    background: rgba(30,15,4,0.6);
    color: #7c5a30;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .room-btn-ghost:hover {
    border-color: #c47a2a;
    color: #f0d090;
  }
  .game-card {
    padding: 14px;
    background: rgba(30,15,4,0.7);
    border: 1px solid #3d1f0a;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .game-card:hover {
    border-color: #c47a2a;
    box-shadow: 0 0 12px rgba(196,122,42,0.2);
  }
`;

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
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({});
  const [ratingLoading, setRatingLoading] = useState<string | null>(null);

  const isHost = me?.isHost ?? false;

  if (!room || !me) return null;

  if (pendingChallenge && gameDesc !== pendingChallenge) {
    setGameDesc(pendingChallenge);
    useStore.getState().setChallengePrompt('');
  }

  function copyCode() { navigator.clipboard.writeText(room!.code); }
  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/?room=${room!.code}`);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }
  function openAiPlatform(url: string) { window.open(url, '_blank', 'noopener,noreferrer'); }

  function copyGamePrompt() {
    const desc = gameDesc.trim() || '（ここにゲーム内容を入力してください）';
    const isSolo = room!.gameType === 'solo';
    const lines = isSolo
      ? [`【依頼】1人用ブラウザゲームを作成してください。`, ``, `ゲーム内容: ${desc}`, ``,
         `■ 技術条件`, `- HTML1ファイルで自己完結（外部CDN使用はOK）`, `- platform.js は絶対に使わない（不要）`,
         `- キーボード・マウス・タップ操作に対応`, `- スコア・クリア条件など1人用として完結した設計`, ``,
         `■ デプロイ情報`, `URL: ${SERVER}/api/deploy`, `ルームコード: ${room!.code}`, `APIキー: ${room!.apiKey}`]
      : [`【依頼】マルチプレイゲームを作成してください。`, ``, `ゲーム内容: ${desc}`, ``,
         `■ 技術条件（必須）`, `- <script src="/platform.js"></script> をheadに含める`,
         `- 全員が同時にプレイできる構造（1人用は禁止）`, `- 対戦 or 協力のどちらかで設計`,
         `- platform.broadcast / platform.onAction でゲームロジックを実装`, ``,
         `■ デプロイ情報`, `URL: ${SERVER}/api/deploy`, `ルームコード: ${room!.code}`, `APIキー: ${room!.apiKey}`];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  function tempLeave() {
    socket.emit('room:leave');
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('lobby');
    setShowLeaveMenu(false);
  }
  function fullLeave() {
    socket.emit('room:leave');
    clearSession();
    useStore.getState().clearRoom();
    useStore.getState().setNavPage('home');
    setShowLeaveMenu(false);
  }

  async function generateGame() {
    const description = gameDesc.trim();
    if (!description) return setGenerateMsg('❌ ゲームの説明を入力してください');
    setGenerating(true); setGenerateMsg('');
    try {
      const res = await fetch(`${SERVER}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: room!.code, apiKey: room!.apiKey, description, playerName: me!.name, provider: selectedProvider, mode: room!.creationMode }),
      });
      const data = await res.json();
      if (data.ok) {
        if (supabase && user && data.gameId) {
          supabase.from('deployed_games').insert({ id: data.gameId, creator_id: user.id, name: gameDesc.trim() || '無名のゲーム', provider: selectedProvider, game_type: room!.gameType });
          supabase.rpc('increment_games_created', { uid: user.id });
        }
        setGameDesc('');
      } else { setGenerateMsg('❌ ' + data.error); }
    } catch { setGenerateMsg('❌ 通信エラーが発生しました'); }
    finally { setGenerating(false); }
  }

  async function deployHtml() {
    const html = htmlCode.trim();
    if (!html) return setDeployMsg('❌ HTMLを貼り付けてください');
    setDeploying(true); setDeployMsg('');
    try {
      const res = await fetch(`${SERVER}/api/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: room!.code, apiKey: room!.apiKey, name: gameDesc.trim() || '無名のゲーム', code: html, deployedBy: me!.name }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeployMsg('✅ ' + data.message); setHtmlCode('');
        if (supabase && user && data.gameId) {
          supabase.from('deployed_games').insert({ id: data.gameId, creator_id: user.id, name: gameDesc.trim() || '無名のゲーム', provider: 'manual', game_type: room!.gameType });
          supabase.rpc('increment_games_created', { uid: user.id });
        }
      } else { setDeployMsg('❌ ' + data.error); }
    } catch { setDeployMsg('❌ 通信エラー'); }
    finally { setDeploying(false); }
  }

  function selectGame(gameId: string) { if (isHost) socket.emit('game:select', { gameId }); }

  async function rateGame(gameId: string, rating: number) {
    if (!supabase || !user) return;
    setRatingLoading(gameId);
    await supabase.from('game_ratings').upsert({ game_id: gameId, rater_id: user.id, rating }, { onConflict: 'game_id,rater_id' });
    setRatingMap(prev => ({ ...prev, [gameId]: rating }));
    setRatingLoading(null);
  }

  function sendChallenge() { if (challengeInput.trim()) { socket.emit('room:challenge', challengeInput.trim()); setChallengeInput(''); } }
  function setMode(mode: CreationMode) { socket.emit('room:setMode', mode); }
  function pickRandomTopic() { socket.emit('room:randomChallenge'); }

  async function saveToLibrary(game: DeployedGameMeta) {
    if (!supabase || !user) return;
    setSavingGameId(game.id); setSaveMsg('');
    try {
      const res = await fetch(`${SERVER}/game/${room!.code}/${game.id}`);
      if (!res.ok) throw new Error('HTML取得失敗');
      const html = await res.text();
      const { error } = await supabase.from('games').insert({ user_id: user.id, name: game.name, html, provider: game.provider, is_favorite: false });
      setSaveMsg(error ? '❌ 保存に失敗しました' : `✅ 「${game.name}」を保存しました`);
    } catch { setSaveMsg('❌ 通信エラー'); }
    finally { setSavingGameId(null); setTimeout(() => setSaveMsg(''), 3000); }
  }

  const modeLabels: Record<CreationMode, string> = { free: '各自が自由に', challenge: 'ホストがお題', random: 'ランダムお題' };
  const isChallengeMode = room.creationMode === 'challenge' || room.creationMode === 'random';

  return (
    <>
      <style>{CSS}</style>

      {/* ─── 暗い背景 ─── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 0%, #1a0c04 0%, #0d0806 60%, #080503 100%)',
      }} />
      {/* 燭台グロウ（左下・右下） */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 300, height: 300, background: 'radial-gradient(circle, rgba(196,100,20,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle, rgba(196,100,20,0.08) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ minHeight: '100vh', padding: '28px 24px', maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1, color: '#f0d090' }}>

        {/* 再接続バナー */}
        {isDisconnected && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
            background: '#5a2d0a', borderBottom: '2px solid #c47a2a',
            padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontSize: 10, color: '#f0d090', fontFamily: FONT,
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</span>
            再接続中...
          </div>
        )}

        {/* ─── ヘッダー ─── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 32, paddingBottom: 20,
          borderBottom: '1px solid rgba(196,122,42,0.2)',
        }}>

          {/* 左: 退出 */}
          <div style={{ position: 'relative' }}>
            <button
              className="room-btn-ghost"
              onClick={() => setShowLeaveMenu(v => !v)}
              style={{ fontFamily: FONT, fontSize: 8 }}
            >
              ← LEAVE ▾
            </button>

            {showLeaveMenu && (
              <>
                <div onClick={() => setShowLeaveMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                  zIndex: 999,
                  background: '#1a0e05',
                  border: '2px solid #5a2d0a',
                  minWidth: 240,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  animation: 'fadeUp 0.15s ease',
                }}>
                  <button
                    onClick={tempLeave}
                    style={{
                      width: '100%', padding: '14px 18px', background: 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', display: 'block',
                      color: '#f0d090',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,122,42,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>🔄 一時退出</div>
                    <div style={{ fontSize: 11, color: '#7c5a30', marginTop: 3 }}>セッション保持（後で戻れる）</div>
                  </button>
                  <div style={{ height: 1, background: 'rgba(196,122,42,0.2)' }} />
                  <button
                    onClick={fullLeave}
                    style={{
                      width: '100%', padding: '14px 18px', background: 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', display: 'block',
                      color: '#f87171',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,50,30,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>🚪 退出</div>
                    <div style={{ fontSize: 11, color: '#7c5a30', marginTop: 3 }}>セッションをリセット</div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 中央: ルームコード */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: FONT, fontSize: 7, color: '#7c5a30', marginBottom: 6 }}>
              {room.gameType === 'solo' ? '🎮 SOLO ROOM' : '👥 MULTI ROOM'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: FONT, fontSize: 'clamp(20px, 3.5vw, 34px)',
                color: '#f0c060',
                textShadow: '0 0 20px rgba(240,192,96,0.5), 2px 2px 0 #2d1208',
                letterSpacing: '0.2em',
              }}>
                {room.code}
              </span>
              <button className="room-btn-ghost" onClick={copyCode} style={{ fontFamily: FONT, fontSize: 7 }}>COPY</button>
              <button
                className="room-btn-ghost"
                onClick={copyInviteLink}
                style={{
                  fontFamily: FONT, fontSize: 7,
                  borderColor: copiedInvite ? '#34d399' : undefined,
                  color: copiedInvite ? '#34d399' : undefined,
                }}
              >
                {copiedInvite ? '✅ OK' : '🔗 招待'}
              </button>
            </div>
          </div>

          {/* 右: 参加者 */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONT, fontSize: 7, color: '#7c5a30', marginBottom: 8 }}>
              PLAYERS · {room.players.length}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {room.players.map(p => (
                <span key={p.id} style={{
                  padding: '5px 12px',
                  background: p.isHost ? 'rgba(196,122,42,0.18)' : 'rgba(30,15,4,0.8)',
                  border: `1px solid ${p.isHost ? '#c47a2a' : '#3d1f0a'}`,
                  fontSize: 12, color: p.isHost ? '#f0c060' : '#c8a06a',
                  fontWeight: p.isHost ? 700 : 400,
                }}>
                  {p.isHost ? '👑 ' : ''}{p.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 保存メッセージ */}
        {saveMsg && (
          <div style={{
            marginBottom: 16, padding: '10px 16px',
            background: saveMsg.startsWith('✅') ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${saveMsg.startsWith('✅') ? '#34d399' : '#f87171'}`,
            fontSize: 13, color: saveMsg.startsWith('✅') ? '#34d399' : '#f87171',
            animation: 'fadeUp 0.2s ease',
          }}>{saveMsg}</div>
        )}

        {/* 生成中バナー */}
        {generatingGames.length > 0 && (
          <div style={{
            marginBottom: 20, padding: '12px 16px',
            background: 'rgba(30,15,4,0.8)', border: '1px solid #c47a2a',
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            animation: 'glowPulse 2s ease infinite',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 7, color: '#f0c060' }}>⚗ GENERATING</div>
            {generatingGames.map((g, i) => (
              <div key={i} style={{
                fontSize: 12, color: '#c8a06a',
                background: 'rgba(196,122,42,0.1)', padding: '4px 12px',
                border: '1px solid rgba(196,122,42,0.3)',
              }}>
                {AI_INFO[g.provider]?.emoji ?? '🤖'} {g.playerName} が {AI_INFO[g.provider]?.label ?? g.provider} で生成中...
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* ─── 左: ゲーム作成 ─── */}
          <div style={cardStyle}>
            <SectionTitle>{room.gameType === 'solo' ? '🎮 1人用ゲームを作る' : '🎮 みんなで遊ぶゲームを作る'}</SectionTitle>
            <p style={{ fontSize: 12, color: '#7c5a30', margin: '0 0 18px', lineHeight: 1.8 }}>
              {room.gameType === 'multi' ? '協力・対戦のマルチプレイゲームのみ作成できます' : '1人でプレイできるブラウザゲームを作成します'}
            </p>

            {/* モード選択 */}
            {isHost && (
              <div style={{ marginBottom: 18 }}>
                <FieldLabel>作成モード</FieldLabel>
                <div style={{ display: 'flex', gap: 6 }}>
                  {((['free', ...(room.gameType === 'multi' ? ['challenge'] : []), 'random']) as CreationMode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      flex: 1, padding: '9px 4px', fontSize: 9, fontFamily: FONT, cursor: 'pointer',
                      background: room.creationMode === m ? 'rgba(196,122,42,0.2)' : 'rgba(30,15,4,0.6)',
                      border: `2px solid ${room.creationMode === m ? '#c47a2a' : '#3d1f0a'}`,
                      color: room.creationMode === m ? '#f0c060' : '#7c5a30',
                      transition: 'all 0.1s',
                    }}>
                      {modeLabels[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Challenge: お題送信 */}
            {room.creationMode === 'challenge' && isHost && (
              <InnerSection style={{ marginBottom: 16 }}>
                <FieldLabel>📢 全員にお題を送信</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={challengeInput}
                    onChange={e => setChallengeInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChallenge()}
                    placeholder="例: 爆弾ワードゲーム" />
                  <button className="room-btn-gold" style={{ fontFamily: FONT, fontSize: 8 }} onClick={sendChallenge}>送信</button>
                </div>
              </InnerSection>
            )}

            {/* Random: ランダムお題 */}
            {room.creationMode === 'random' && isHost && (
              <InnerSection style={{ marginBottom: 16 }}>
                <FieldLabel>🎲 ランダムお題</FieldLabel>
                <button className="room-btn-gold" onClick={pickRandomTopic} style={{ width: '100%', fontFamily: FONT, fontSize: 8 }}>
                  🎲 ランダムでお題を決める
                </button>
                {room.challengePrompt && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#f0c060' }}>
                    決定: <strong style={{ color: '#f0d090' }}>{room.challengePrompt}</strong>
                  </div>
                )}
              </InnerSection>
            )}

            {/* 非ホスト向けお題 */}
            {isChallengeMode && room.challengePrompt && !isHost && (
              <InnerSection style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: '#f0c060', fontWeight: 600 }}>
                  📢 お題: <strong style={{ color: '#f0d090' }}>{room.challengePrompt}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#7c5a30', marginTop: 4 }}>↑ このお題でゲームを作ってください</div>
              </InnerSection>
            )}

            {/* ゲーム説明入力 */}
            {!isChallengeMode && (
              <div style={{ marginBottom: 16 }}>
                <FieldLabel>ゲーム内容</FieldLabel>
                <input style={inputStyle} value={gameDesc} onChange={e => setGameDesc(e.target.value)}
                  placeholder={room.gameType === 'solo' ? '例: ブロック崩し、神経衰弱...' : '例: 爆弾ワードゲーム、マルバツ...'}
                />
              </div>
            )}

            {/* 自分のAIで作る */}
            <InnerSection style={{ marginBottom: 14 }}>
              <FieldLabel>🆓 自分のAIで作る（無料）</FieldLabel>
              <div style={{ fontSize: 11, color: '#5a3a18', marginBottom: 8 }}>
                ① 作成指示をコピー → ② ChatGPT / Claude に貼り付け
              </div>
              <button onClick={copyGamePrompt} className="room-btn-ghost" style={{
                width: '100%', fontSize: 12, padding: '10px 12px',
                borderColor: copiedPrompt ? '#34d399' : undefined,
                color: copiedPrompt ? '#34d399' : undefined,
              }}>
                {copiedPrompt ? '✅ コピーしました！' : gameDesc.trim() ? `📋 「${gameDesc.trim()}」の作成指示をコピー` : '📋 作成指示をコピー'}
              </button>
              <button onClick={() => openAiPlatform(CUSTOM_GPT_URL)} style={{
                marginTop: 8, padding: '9px 12px', border: '1px solid rgba(16,163,127,0.4)',
                background: 'rgba(16,163,127,0.1)', color: '#c8a06a',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%',
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,163,127,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,163,127,0.1)')}
              >
                💬 Game Platform GPT を開く
              </button>
              <div style={{ fontSize: 11, color: '#5a3a18', marginTop: 8, lineHeight: 1.7 }}>
                Claude・Gemini の場合は、生成されたHTMLを下の「デプロイ」欄に貼ってください
              </div>
            </InnerSection>

            {/* プラットフォームのAI */}
            <InnerSection style={{ marginBottom: 14 }}>
              <FieldLabel>✨ {room.gameType === 'solo' ? 'AIが自動生成（有料）' : 'プラットフォームのAIで作る'}</FieldLabel>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['claude', 'openai', 'gemini'] as const).map(p => {
                  const info = AI_INFO[p];
                  const sel = selectedProvider === p;
                  return (
                    <button key={p} onClick={() => setSelectedProvider(p)} style={{
                      flex: 1, padding: '8px 4px',
                      border: `2px solid ${sel ? info.color : '#3d1f0a'}`,
                      background: sel ? `${info.color}15` : 'rgba(30,15,4,0.6)',
                      color: sel ? info.color : '#7c5a30',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}>
                      {info.emoji} {info.label}
                    </button>
                  );
                })}
              </div>
              <button onClick={generateGame} disabled={generating} style={{
                width: '100%', padding: '11px 0', fontSize: 12, fontWeight: 700,
                cursor: generating ? 'not-allowed' : 'pointer',
                border: `2px solid ${generating ? '#3d1f0a' : AI_INFO[selectedProvider].color}`,
                background: generating ? 'rgba(30,15,4,0.4)' : `${AI_INFO[selectedProvider].color}18`,
                color: generating ? '#5a3a18' : AI_INFO[selectedProvider].color,
                fontFamily: FONT,
                transition: 'all 0.15s',
              }}>
                {generating ? '⏳ GENERATING...' : `🎮 ${AI_INFO[selectedProvider].emoji} ${AI_INFO[selectedProvider].label}で作る`}
              </button>
              {generateMsg && <div style={{ fontSize: 12, marginTop: 8, color: '#f87171' }}>{generateMsg}</div>}
            </InnerSection>

            {/* HTMLデプロイ */}
            {room.gameType === 'solo' ? (
              <InnerSection>
                <FieldLabel>🔧 生成されたHTMLを貼り付けてデプロイ</FieldLabel>
                <textarea style={{ ...inputStyle, height: 100, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  value={htmlCode} onChange={e => setHtmlCode(e.target.value)}
                  placeholder={'<!DOCTYPE html>\n<html>...\n</html>'} />
                <button onClick={deployHtml} disabled={deploying} className="room-btn-gold" style={{ width: '100%', marginTop: 8, padding: '10px 0', fontFamily: FONT, fontSize: 8 }}>
                  {deploying ? 'DEPLOYING...' : '🚀 DEPLOY!'}
                </button>
                {deployMsg && <div style={{ fontSize: 12, marginTop: 8, color: deployMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{deployMsg}</div>}
              </InnerSection>
            ) : (
              <details>
                <summary style={{ fontSize: 12, color: '#7c5a30', cursor: 'pointer', padding: '6px 0', fontWeight: 600 }}>
                  🔧 AIが生成したHTMLを直接デプロイ
                </summary>
                <InnerSection style={{ marginTop: 8 }}>
                  <textarea style={{ ...inputStyle, height: 80, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                    value={htmlCode} onChange={e => setHtmlCode(e.target.value)}
                    placeholder={'<!DOCTYPE html>\n<html>...\n</html>'} />
                  <button onClick={deployHtml} disabled={deploying} className="room-btn-gold" style={{ width: '100%', marginTop: 8, fontFamily: FONT, fontSize: 8 }}>
                    {deploying ? 'DEPLOYING...' : '🚀 DEPLOY!'}
                  </button>
                  {deployMsg && <div style={{ fontSize: 12, marginTop: 8, color: deployMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{deployMsg}</div>}
                </InnerSection>
              </details>
            )}
          </div>

          {/* ─── 右: ゲーム一覧 ─── */}
          <div style={cardStyle}>
            <SectionTitle>🕹️ GAMES ({room.games.length})</SectionTitle>

            {room.games.length === 0 ? (
              <div style={{ color: '#5a3a18', fontSize: 13, textAlign: 'center', padding: '40px 0', lineHeight: 2.5 }}>
                まだゲームがありません。<br />
                左のパネルからゲームを作ってデプロイしよう！
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...room.games].reverse().map(game => {
                  const pInfo = AI_INFO[game.provider] ?? AI_INFO.manual;
                  const isSaving = savingGameId === game.id;
                  return (
                    <div key={game.id} className="game-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, color: '#f0d090', fontSize: 14 }}>{game.name}</div>
                        <span style={{
                          fontSize: 10, padding: '3px 8px',
                          background: `${pInfo.color}15`, border: `1px solid ${pInfo.color}40`,
                          color: pInfo.color, whiteSpace: 'nowrap',
                        }}>
                          {pInfo.emoji} {pInfo.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#5a3a18', marginBottom: 10 }}>
                        by {game.deployedBy} · {new Date(game.deployedAt).toLocaleTimeString('ja-JP')}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {isHost && (
                          <button onClick={() => selectGame(game.id)} className="room-btn-gold" style={{ flex: 1, padding: '8px 0', fontSize: 11, fontFamily: FONT }}>
                            ▶ PLAY
                          </button>
                        )}
                        {isSupabaseEnabled && user && (
                          <button onClick={() => saveToLibrary(game)} disabled={isSaving}
                            className="room-btn-ghost" style={{ padding: '8px 12px', fontSize: 13, opacity: isSaving ? 0.5 : 1 }}>
                            {isSaving ? '...' : '💾'}
                          </button>
                        )}
                      </div>

                      {isSupabaseEnabled && user && (
                        <div style={{ display: 'flex', gap: 1, alignItems: 'center', marginTop: 8 }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={star} onClick={() => rateGame(game.id, star)}
                              disabled={ratingLoading === game.id}
                              style={{
                                background: 'none', border: 'none',
                                cursor: ratingLoading === game.id ? 'default' : 'pointer',
                                fontSize: 18, padding: '2px 1px',
                                opacity: ratingLoading === game.id ? 0.5 : 1,
                                color: (ratingMap[game.id] ?? 0) >= star ? '#f0c060' : '#3d1f0a',
                                transition: 'color 0.1s',
                              }}
                            >★</button>
                          ))}
                          {ratingMap[game.id] && (
                            <span style={{ fontSize: 11, color: '#7c5a30', marginLeft: 4 }}>
                              {ratingMap[game.id]}/5
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <details style={{ marginTop: 20 }}>
              <summary style={{ fontSize: 11, color: '#5a3a18', cursor: 'pointer', fontWeight: 600 }}>
                API情報（上級者向け）
              </summary>
              <div style={{
                marginTop: 8, padding: 12,
                background: 'rgba(8,4,1,0.8)', border: '1px solid #3d1f0a',
                fontSize: 11, fontFamily: 'monospace', color: '#7c5a30',
                wordBreak: 'break-all', lineHeight: 1.8,
              }}>
                <div>URL: {SERVER}/api/deploy</div>
                <div>Room: {room.code}</div>
                <div>Key: {room.apiKey}</div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── サブコンポーネント ───────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 9, color: '#f0c060',
      marginBottom: 14, paddingBottom: 10,
      borderBottom: '1px solid rgba(196,122,42,0.25)',
      textShadow: '0 0 8px rgba(240,192,96,0.4)',
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: '#7c5a30', fontWeight: 600, marginBottom: 7, letterSpacing: '0.03em' }}>
      {children}
    </div>
  );
}

function InnerSection({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: '14px',
      background: 'rgba(8,4,1,0.5)',
      border: '1px solid #3d1f0a',
      borderLeft: '3px solid #5a2d0a',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── 共通スタイル ─────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'rgba(18,9,2,0.88)',
  border: '2px solid #5a2d0a',
  outline: '1px solid #2d1208',
  outlineOffset: 3,
  padding: 22,
  boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
  position: 'relative',
  zIndex: 1,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '2px solid #3d1f0a',
  background: 'rgba(8,4,1,0.7)',
  color: '#c8a06a', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
