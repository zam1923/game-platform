import { useState } from 'react';
import { socket } from '../socket';
import { useStore, type CreationMode, type GameProvider, type DeployedGameMeta } from '../store';
import { clearSession } from '../utils/session';
import { useAuthStore } from '../authStore';
import { supabase, isSupabaseEnabled } from '../supabase';
import { Browser } from '@capacitor/browser';

const FONT = "'Press Start 2P', monospace";
const SERVER = import.meta.env.VITE_SERVER_URL || window.location.origin;

const AI_INFO: Record<GameProvider, { label: string; emoji: string; color: string }> = {
  claude:  { label: 'Claude',  emoji: '🟣', color: '#a78bfa' },
  openai:  { label: 'ChatGPT', emoji: '🟢', color: '#34d399' },
  gemini:  { label: 'Gemini', emoji: '🔵', color: '#60a5fa' },
  manual:  { label: 'Manual', emoji: '⚙️', color: '#c8a06a' },
};


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
  .room-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(196,122,42,0.2);
  }
  .room-header-center {
    text-align: center;
  }
  .room-header-right {
    text-align: right;
  }
  .play-btn {
    min-height: 44px;
    padding: 10px 0;
    font-size: 14px;
  }
  @media (max-width: 640px) {
    .room-grid {
      grid-template-columns: 1fr;
    }
    .room-header {
      flex-wrap: wrap;
      gap: 12px;
    }
    .room-header-center {
      order: -1;
      width: 100%;
      text-align: center;
    }
    .room-header-right {
      text-align: left;
    }
    .play-btn {
      min-height: 52px;
      font-size: 16px;
    }
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
  const [copiedPrompt, setCopiedPrompt] = useState<'chatgpt' | 'claude' | null>(null);
  const [showLeaveMenu, setShowLeaveMenu] = useState(false);
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({});
  const [ratingLoading, setRatingLoading] = useState<string | null>(null);
  const [renamingGameId, setRenamingGameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isHost = me?.isHost ?? false;

  if (!room || !me) return null;

  if (pendingChallenge && gameDesc !== pendingChallenge) {
    setGameDesc(pendingChallenge);
    useStore.getState().setChallengePrompt('');
  }

  function copyCode() { navigator.clipboard.writeText(room!.code); }
  function copyInviteLink() {
    navigator.clipboard.writeText(room!.code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }
  async function openAiPlatform(url: string) {
    try {
      await Browser.open({ url });
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // スマホWebView共通の必須技術条件
  const MOBILE_WEBVIEW_BASE = [
    `【絶対に守る技術条件】`,
    `- HTMLファイル1つで完全自己完結（外部CDN・外部フォント・外部画像は一切使わない）`,
    `- <head>に必ず含める: <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">`,
    `- CSS・JSはすべてインライン（styleタグ・scriptタグ内に書く）`,
    `- document.writeは使わない`,
    `- 画面サイズは 100vw × 100vh で埋める（スクロール不要な1画面設計）`,
    `- タッチ操作必須: touchstart/touchmove/touchendイベントを実装（clickは補助で可）`,
    `- ボタン・操作UIは最低 48px × 48px 以上のタップ領域を確保`,
    `- body margin/paddingは0、overflow:hidden`,
  ];

  function copyGamePrompt() {
    const desc = gameDesc.trim() || '（ここにゲーム内容を入力してください）';
    const isSolo = room!.gameType === 'solo';
    const gameSpecific = isSolo
      ? [
          `【ゲーム内容】`, desc, ``,
          `【ゲーム仕様】`,
          `- 1人用スタンドアロンゲーム（platform.jsは使わない）`,
          `- スコア表示・難易度上昇・ゲームオーバー・クリアを実装`,
          `- Canvasを使う場合はwidth/heightをwindow.innerWidth/innerHeightに合わせる`,
        ]
      : [
          `【ゲーム内容】`, desc, ``,
          `【ゲーム仕様】`,
          `- マルチプレイヤーゲーム（1人用は禁止）`,
          `- <head>内に <script src="/platform.js"></script> を含める`,
          `- platform.broadcast/onState/onActionでゲームロジックを実装`,
          `- 全員が同時にプレイできる対戦または協力形式`,
        ];
    const lines = [
      `スマートフォン専用ブラウザゲームを作ってください。`, ``,
      ...gameSpecific, ``,
      ...MOBILE_WEBVIEW_BASE, ``,
      `HTMLコードブロック（\`\`\`html....\`\`\`）のみ出力。説明文は不要。`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedPrompt('chatgpt');
    setTimeout(() => setCopiedPrompt(null), 2000);
  }

  function copyClaudePrompt() {
    const desc = gameDesc.trim() || '（ここにゲーム内容を入力してください）';
    const isSolo = room!.gameType === 'solo';
    const gameSpecific = isSolo
      ? [
          `【ゲーム内容】`, desc, ``,
          `【ゲーム仕様】`,
          `- 1人用スタンドアロンゲーム（platform.jsは使わない）`,
          `- スコア・ハイスコア・難易度上昇（時間経過で加速）・ゲームオーバー・リトライを実装`,
          `- Canvasを使う場合はwidth=window.innerWidth、height=window.innerHeightで初期化、resizeイベントにも対応`,
          `- パーティクルエフェクト・スコア加算アニメーション・演出を豊富に入れる`,
          `- 最低3分遊べる作り込みと、繰り返し遊びたくなるゲーム性`,
        ]
      : [
          `【ゲーム内容】`, desc, ``,
          `【ゲーム仕様】`,
          `- マルチプレイヤーゲーム（1人用は禁止）`,
          `- <head>内に <script src="/platform.js"></script> を含める`,
          `- platform.broadcast/onState/onActionでゲームロジックを実装`,
          `- 全員が同時にプレイできる対戦または協力形式`,
          `- ゲーム開始前のロビー（参加者確認）・プレイ中・結果発表の3フェーズを実装`,
          `- アニメーション・演出を豊富に入れて盛り上がる体験にする`,
          `- プレイヤー数が2〜8人に変わっても壊れない堅牢な実装`,
        ];
    const qualityLines = [
      `【デザイン・品質要件】`,
      `- ゲームジャンルに合ったテーマのUIデザイン（ネオン・ドット絵・RPG・近未来など）`,
      `- 背景・キャラ・エフェクトはCSSアニメーションかCanvas描画で豪華にする`,
      `- 効果音の代わりにビジュアルフィードバック（フラッシュ・振動演出・色変化）を入れる`,
      `- ゲームとして完成度が高く、初めて遊ぶ人でも直感的に操作できる`,
    ];
    const lines = [
      `スマートフォン専用ブラウザゲームを作ってください。`, ``,
      ...gameSpecific, ``,
      ...MOBILE_WEBVIEW_BASE, ``,
      ...qualityLines, ``,
      `HTMLコードブロック（\`\`\`html....\`\`\`）のみ出力。前後の説明文は一切不要。`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedPrompt('claude');
    setTimeout(() => setCopiedPrompt(null), 2000);
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

  function selectGame(gameId: string) {
    if (room!.gameType === 'solo') {
      // ソロ: 自分のstoreのみ更新（他のプレイヤーに影響しない）
      useStore.getState().setActiveGame(gameId);
    } else {
      // マルチ: ホストのみsocket送信（全員のゲームが変わる）
      if (isHost) socket.emit('game:select', { gameId });
    }
  }

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

  function startRename(game: DeployedGameMeta) {
    setRenamingGameId(game.id);
    setRenameValue(game.name);
    setDeleteConfirmId(null);
  }

  function submitRename(gameId: string) {
    const name = renameValue.trim();
    if (name) socket.emit('game:rename', { gameId, name });
    setRenamingGameId(null);
  }

  function deleteGame(gameId: string) {
    socket.emit('game:delete', { gameId });
    setDeleteConfirmId(null);
  }

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

      <div style={{ minHeight: '100vh', padding: '28px 16px', maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1, color: '#f0d090' }}>

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
        <div className="room-header">

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
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>🚪 退出</div>
                    <div style={{ fontSize: 11, color: '#7c5a30', marginTop: 3 }}>セッションをリセット</div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 中央: ルームコード */}
          <div className="room-header-center">
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
          <div className="room-header-right">
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

        <div className="room-grid">

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
                <textarea
                  style={{ ...inputStyle, height: 110, resize: 'vertical', lineHeight: 1.7, fontFamily: 'inherit' }}
                  value={gameDesc}
                  onChange={e => setGameDesc(e.target.value)}
                  placeholder={room.gameType === 'solo'
                    ? '例: 障害物を避けながら進むランナーゲーム。ジャンプで回避、スコアが上がるほど速くなる。'
                    : '例: 全員でお題のワードを当て合うゲーム。ヒントを1つずつ出し合い、先に正解したチームが勝ち。'}
                />
              </div>
            )}

            {/* 自分のAIで作る */}
            <InnerSection style={{ marginBottom: 14 }}>
              <FieldLabel>🆓 自分のAIで作る</FieldLabel>
              <div style={{ fontSize: 11, color: '#5a3a18', marginBottom: 10, lineHeight: 1.8 }}>
                ① ゲーム内容を入力 → ② AIを選んでプロンプトをコピー<br />
                ③ AIに貼り付け → ④ 出力HTMLを下のエリアに貼ってDEPLOY
              </div>
              {/* Claude ボタン（高品質） */}
              <button onClick={() => { copyClaudePrompt(); openAiPlatform('https://claude.ai/projects'); }} style={{
                width: '100%', padding: '11px 12px', marginBottom: 8,
                border: '1px solid rgba(212,160,90,0.5)',
                background: copiedPrompt === 'claude' ? 'rgba(212,160,90,0.2)' : 'rgba(212,160,90,0.08)',
                color: copiedPrompt === 'claude' ? '#34d399' : '#d4a05a',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              >
                {copiedPrompt === 'claude' ? '✅ コピー済み！Claudeを開きます' : '🟠 Claudeで作る（高品質）'}
              </button>
              {/* ChatGPT ボタン */}
              <button onClick={() => { copyGamePrompt(); openAiPlatform('https://chatgpt.com/'); }} style={{
                width: '100%', padding: '11px 12px',
                border: '1px solid rgba(16,163,127,0.4)',
                background: copiedPrompt === 'chatgpt' ? 'rgba(16,163,127,0.2)' : 'rgba(16,163,127,0.08)',
                color: copiedPrompt === 'chatgpt' ? '#34d399' : '#c8a06a',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              >
                {copiedPrompt === 'chatgpt' ? '✅ コピー済み！ChatGPTを開きます' : '🟢 ChatGPTで作る'}
              </button>
            </InnerSection>

            {/* プラットフォームのAI（クレジット制・準備中） */}
            <InnerSection style={{ marginBottom: 14 }}>
              <FieldLabel>✨ AIで自動生成</FieldLabel>
              <div style={{
                padding: '18px 16px',
                border: '1px dashed #3d1f0a',
                background: 'rgba(8,4,1,0.5)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>🔒</div>
                <div style={{ fontFamily: FONT, fontSize: 7, color: '#c8a06a', marginBottom: 6 }}>
                  クレジットが必要です
                </div>
                <div style={{ fontSize: 11, color: '#5a3a18', marginBottom: 16, lineHeight: 1.8 }}>
                  1回の生成 = 1クレジット<br />
                  現在の残高: <span style={{ color: '#f87171' }}>0 cr</span>
                </div>
                <button
                  className="room-btn-gold"
                  style={{ fontFamily: FONT, fontSize: 8, width: '100%', padding: '11px 0' }}
                  onClick={() => {/* TODO: Stripe購入フロー */}}
                >
                  💳 クレジットを購入
                </button>
              </div>
            </InnerSection>

            {/* HTMLデプロイ（manual） */}
            <InnerSection>
              <FieldLabel>🔧 HTMLを貼り付けてデプロイ</FieldLabel>
              <textarea style={{ ...inputStyle, height: 90, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                value={htmlCode} onChange={e => setHtmlCode(e.target.value)}
                placeholder={'<!DOCTYPE html>\n<html>...\n</html>'} />
              <button onClick={deployHtml} disabled={deploying} className="room-btn-gold" style={{ width: '100%', marginTop: 8, padding: '10px 0', fontFamily: FONT, fontSize: 8 }}>
                {deploying ? 'DEPLOYING...' : '🚀 DEPLOY!'}
              </button>
              {deployMsg && <div style={{ fontSize: 12, marginTop: 8, color: deployMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{deployMsg}</div>}
            </InnerSection>
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
                  const isRenaming = renamingGameId === game.id;
                  const isDeleteConfirm = deleteConfirmId === game.id;
                  const canEdit = isHost || room.gameType === 'solo';
                  return (
                    <div key={game.id} className="game-card">
                      {/* タイトル行 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                        {isRenaming ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitRename(game.id);
                              if (e.key === 'Escape') setRenamingGameId(null);
                            }}
                            onBlur={() => submitRename(game.id)}
                            style={{
                              ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 13,
                              fontWeight: 700, color: '#f0d090',
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 700, color: '#f0d090', fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {game.name}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <span style={{
                            fontSize: 10, padding: '3px 8px',
                            background: `${pInfo.color}15`, border: `1px solid ${pInfo.color}40`,
                            color: pInfo.color, whiteSpace: 'nowrap',
                          }}>
                            {pInfo.emoji} {pInfo.label}
                          </span>
                          {canEdit && !isRenaming && (
                            <button
                              onClick={() => startRename(game)}
                              title="名前を変更"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', color: '#5a3a18', lineHeight: 1 }}
                            >✏️</button>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: '#5a3a18', marginBottom: 10 }}>
                        by {game.deployedBy} · {new Date(game.deployedAt).toLocaleTimeString('ja-JP')}
                      </div>

                      {/* アクションボタン行 */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(isHost || room.gameType === 'solo') && (
                          <button onClick={() => selectGame(game.id)} className="room-btn-gold play-btn" style={{ flex: 1, fontFamily: FONT }}>
                            ▶ PLAY
                          </button>
                        )}
                        {isSupabaseEnabled && user && (
                          <button onClick={() => saveToLibrary(game)} disabled={isSaving}
                            className="room-btn-ghost" style={{ padding: '8px 12px', fontSize: 13, opacity: isSaving ? 0.5 : 1 }}>
                            {isSaving ? '...' : '💾'}
                          </button>
                        )}
                        {/* 削除ボタン */}
                        {canEdit && (
                          isDeleteConfirm ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => deleteGame(game.id)}
                                style={{ padding: '6px 10px', background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                              >削除確認</button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ padding: '6px 8px', background: 'none', border: '1px solid #3d1f0a', color: '#5a3a18', cursor: 'pointer', fontSize: 11 }}
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setDeleteConfirmId(game.id); setRenamingGameId(null); }}
                              title="削除"
                              className="room-btn-ghost"
                              style={{ padding: '8px 10px', fontSize: 13 }}
                            >🗑</button>
                          )
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

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 10, color: '#7c5a30', fontWeight: 600, marginBottom: 7, letterSpacing: '0.03em', ...style }}>
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
