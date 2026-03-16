import { useState, useEffect } from 'react';
import { useAuthStore } from '../authStore';
import { useStore } from '../store';
import { supabase, type LibraryGame } from '../supabase';

const FONT = "'Press Start 2P', monospace";

const AI_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  claude:  { label: 'Claude',  emoji: '🟣', color: '#a78bfa' },
  openai:  { label: 'ChatGPT', emoji: '🟢', color: '#34d399' },
  gemini:  { label: 'Gemini', emoji: '🔵', color: '#60a5fa' },
  manual:  { label: 'Manual', emoji: '⚙️', color: '#c8a06a' },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  @keyframes torchFlicker {
    0%,100% { opacity:1; }
    20%      { opacity:0.82; }
    40%      { opacity:0.95; }
    60%      { opacity:0.88; }
    80%      { opacity:0.97; }
  }
  @keyframes torchGlow {
    0%,100% { box-shadow: 0 0 18px rgba(240,140,30,0.35); }
    50%      { box-shadow: 0 0 32px rgba(240,140,30,0.55); }
  }
  @keyframes libFadeIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes drip {
    0%   { transform: scaleY(0); opacity:0; transform-origin: top; }
    40%  { transform: scaleY(1); opacity:0.6; }
    100% { transform: scaleY(1); opacity:0.6; }
  }

  .cave-card {
    background: rgba(14,9,4,0.92);
    border: 1px solid #2a1a08;
    padding: 14px 16px;
    transition: border-color 0.15s, box-shadow 0.15s;
    animation: libFadeIn 0.3s ease both;
  }
  .cave-card:hover {
    border-color: #c07820;
    box-shadow: 0 0 20px rgba(192,120,32,0.12);
  }
  .cave-icon-btn {
    padding: 6px 9px;
    border: 1px solid #2a1a08;
    background: transparent;
    color: #7a5220;
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
    transition: border-color 0.1s, color 0.1s;
  }
  .cave-icon-btn:hover {
    border-color: #c07820;
    color: #f0c060;
  }
  .cave-filter-btn {
    padding: 7px 14px;
    border: 2px solid #2a1a08;
    background: transparent;
    color: #5a3818;
    cursor: pointer;
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    transition: all 0.1s;
  }
  .cave-filter-btn:hover {
    border-color: #c07820;
    color: #f0a030;
  }
  .cave-filter-btn.active {
    border-color: #c07820;
    background: rgba(192,120,32,0.12);
    color: #f0a030;
  }
`;

// 鍾乳石（天井から垂れ下がる）
function Stalactites() {
  const items = [
    { left: '4%',  h: 28 }, { left: '9%',  h: 18 }, { left: '14%', h: 36 },
    { left: '20%', h: 22 }, { left: '26%', h: 42 }, { left: '32%', h: 16 },
    { left: '38%', h: 30 }, { left: '44%', h: 24 }, { left: '50%', h: 38 },
    { left: '56%', h: 20 }, { left: '62%', h: 34 }, { left: '68%', h: 18 },
    { left: '74%', h: 44 }, { left: '80%', h: 26 }, { left: '86%', h: 32 },
    { left: '92%', h: 20 }, { left: '97%', h: 14 },
  ];
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: 48, pointerEvents: 'none', zIndex: 5 }}>
      {items.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: s.left,
          top: 0,
          width: 8,
          height: s.h,
          background: 'linear-gradient(to bottom, #1a1008, #0c0804)',
          clipPath: 'polygon(20% 0%, 80% 0%, 50% 100%)',
          opacity: 0.9,
        }} />
      ))}
    </div>
  );
}

// 松明コンポーネント
function Torch({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{
      position: 'absolute',
      top: '50%', transform: 'translateY(-50%)',
      [side]: 12,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      zIndex: 2,
    }}>
      {/* 炎 */}
      <div style={{
        fontSize: 20,
        animation: 'torchFlicker 2.3s ease infinite',
        filter: 'drop-shadow(0 0 6px rgba(255,160,32,0.8))',
        marginBottom: 2,
      }}>🔥</div>
      {/* 柄 */}
      <div style={{
        width: 6, height: 24,
        background: 'linear-gradient(to bottom, #5a3010, #2a1508)',
        borderRadius: 2,
      }} />
    </div>
  );
}

export default function Library() {
  const { user, signOut } = useAuthStore();
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'favorite'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  function goHome() {
    useStore.getState().setNavPage('home');
  }

  useEffect(() => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }
    loadGames();
  }, [user]);

  async function loadGames() {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setGames(data as LibraryGame[]);
    setLoading(false);
  }

  async function toggleFavorite(game: LibraryGame) {
    if (!supabase) return;
    const { data } = await supabase
      .from('games')
      .update({ is_favorite: !game.is_favorite })
      .eq('id', game.id)
      .select()
      .single();
    if (data) setGames(prev => prev.map(g => g.id === game.id ? data as LibraryGame : g));
  }

  async function deleteGame(id: string) {
    if (!supabase) return;
    if (!confirm('このゲームを削除しますか？')) return;
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (!error) setGames(prev => prev.filter(g => g.id !== id));
  }

  async function saveName(game: LibraryGame) {
    const trimmed = editName.trim();
    setEditingId(null);
    if (!supabase || !trimmed || trimmed === game.name) return;
    const { data } = await supabase
      .from('games')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', game.id)
      .select()
      .single();
    if (data) setGames(prev => prev.map(g => g.id === game.id ? data as LibraryGame : g));
  }

  const displayed = filter === 'favorite' ? games.filter(g => g.is_favorite) : games;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #150e06 0%, #0a0603 55%, #060402 100%)',
    }}>
      <style>{CSS}</style>

      {/* 壁面の松明グロウ */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: 220, height: '100vh', background: 'linear-gradient(to right, rgba(200,100,20,0.07), transparent)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, width: 220, height: '100vh', background: 'linear-gradient(to left, rgba(200,100,20,0.07), transparent)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ─── ヘッダー ─── */}
      <div style={{
        position: 'relative',
        background: '#100a04',
        borderBottom: '3px solid #2a1a08',
        padding: '18px 80px 22px',
        zIndex: 10,
        animation: 'torchGlow 3s ease infinite',
      }}>
        {/* 松明 */}
        <Torch side="left" />
        <Torch side="right" />

        {/* 天井グロウ */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(240,140,30,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              onClick={goHome}
              style={{
                fontFamily: FONT, fontSize: 7,
                padding: '9px 14px',
                background: 'rgba(6,4,2,0.8)',
                border: '2px solid #2a1a08',
                color: '#5a3818',
                cursor: 'pointer',
                transition: 'border-color 0.1s, color 0.1s',
              }}
            >
              ← BACK
            </button>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 'clamp(8px, 1.5vw, 13px)', color: '#f0a030', textShadow: '0 0 14px rgba(240,140,30,0.6), 2px 2px 0 #1a0a02' }}>
                ⚔️ DUNGEON ARCHIVES
              </div>
              <div style={{ fontFamily: FONT, fontSize: 7, color: '#3d2010', marginTop: 5 }}>
                ゲームライブラリ
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#3d2010', marginBottom: 4 }}>{user?.email}</div>
              <button
                onClick={signOut}
                style={{
                  fontFamily: FONT, fontSize: 7,
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid #2a1a08',
                  color: '#5a3818',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#c07820'; e.currentTarget.style.color = '#f0a030'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#2a1a08'; e.currentTarget.style.color = '#5a3818'; }}
              >
                SIGN OUT
              </button>
            </div>
          </div>
        </div>

        {/* 鍾乳石 */}
        <Stalactites />
      </div>

      {/* ─── コンテンツ ─── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '52px 24px 40px', position: 'relative', zIndex: 1 }}>

        {/* フィルターバー */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          marginBottom: 24,
          padding: '12px 16px',
          background: 'rgba(10,6,2,0.85)',
          border: '1px solid #1e1208',
          borderTop: '3px solid #3d2010',
        }}>
          <span style={{ fontFamily: FONT, fontSize: 6, color: '#3d2010', marginRight: 6 }}>🪨 FILTER</span>
          <button
            className={`cave-filter-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            ALL ({games.length})
          </button>
          <button
            className={`cave-filter-btn${filter === 'favorite' ? ' active' : ''}`}
            onClick={() => setFilter('favorite')}
          >
            ⭐ FAV ({games.filter(g => g.is_favorite).length})
          </button>
        </div>

        {/* リスト */}
        {loading ? (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            fontFamily: FONT, fontSize: 8, color: '#3d2010', lineHeight: 3,
          }}>
            🕯️ LOADING...
          </div>
        ) : displayed.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            border: '1px solid #1e1208',
            background: 'rgba(8,5,2,0.7)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗝️</div>
            <div style={{ fontFamily: FONT, fontSize: 8, color: '#3d2010', lineHeight: 3 }}>
              {filter === 'favorite' ? 'お気に入りはありません' : 'ライブラリが空です'}
            </div>
            {filter !== 'favorite' && (
              <div style={{ fontSize: 12, color: '#2a1508', marginTop: 8, lineHeight: 2 }}>
                ルームでゲームをデプロイして「💾 ライブラリに保存」しよう
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map((game, idx) => {
              const info = AI_INFO[game.provider] ?? AI_INFO.manual;
              return (
                <div
                  key={game.id}
                  className="cave-card"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    {/* ゲーム情報 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingId === game.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveName(game);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => saveName(game)}
                          style={{
                            padding: '5px 10px',
                            border: '1px solid #c07820',
                            background: '#080502',
                            color: '#d4a040',
                            fontSize: 15, fontWeight: 700,
                            width: '100%', outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <div style={{
                          fontSize: 15, fontWeight: 700,
                          color: '#d4a040',
                          marginBottom: 6,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {game.name}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px',
                          background: `${info.color}18`,
                          border: `1px solid ${info.color}40`,
                          color: info.color,
                        }}>
                          {info.emoji} {info.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#3d2010' }}>
                          {new Date(game.created_at).toLocaleDateString('ja-JP', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="cave-icon-btn"
                        onClick={() => setPreviewId(previewId === game.id ? null : game.id)}
                        title="プレビュー"
                        style={previewId === game.id ? { color: '#f0a030', borderColor: '#c07820' } : undefined}
                      >👁</button>
                      <button
                        className="cave-icon-btn"
                        onClick={() => toggleFavorite(game)}
                        title={game.is_favorite ? 'お気に入り解除' : 'お気に入りに追加'}
                        style={{ opacity: game.is_favorite ? 1 : 0.3 }}
                      >⭐</button>
                      <button
                        className="cave-icon-btn"
                        onClick={() => { setEditingId(game.id); setEditName(game.name); }}
                        title="名前を編集"
                      >✏️</button>
                      <button
                        className="cave-icon-btn"
                        onClick={() => deleteGame(game.id)}
                        title="削除"
                        style={{ color: '#c04040' }}
                      >🗑️</button>
                    </div>
                  </div>

                  {/* プレビュー iframe */}
                  {previewId === game.id && (
                    <div style={{
                      marginTop: 12,
                      border: '2px solid #2a1a08',
                      height: 400, overflow: 'hidden',
                    }}>
                      <iframe
                        srcDoc={game.html}
                        sandbox="allow-scripts"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title={game.name}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
