import { useState, useEffect } from 'react';
import { useAuthStore } from '../authStore';
import { useStore } from '../store';
import { supabase, type LibraryGame } from '../supabase';

const AI_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  claude:  { label: 'Claude',  emoji: '🟣', color: '#7c3aed' },
  openai:  { label: 'GPT-4o', emoji: '🟢', color: '#059669' },
  gemini:  { label: 'Gemini', emoji: '🔵', color: '#2563eb' },
  manual:  { label: 'Manual', emoji: '⚙️', color: '#6b7280' },
};

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
    if (!window.confirm('このゲームを削除しますか？')) return;
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
  const previewGame = previewId ? games.find(g => g.id === previewId) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f18' }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        background: '#1a1a24',
        borderBottom: '1px solid #2a2a3a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={goHome}
            style={btn('#0f0f18', '#888')}
          >
            ← ホーム
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
            📚 マイライブラリ
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#555' }}>{user?.email}</span>
          <button onClick={signOut} style={btn('#0f0f18', '#666')}>
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px' }}>

        {/* フィルター */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['all', 'favorite'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: `1px solid ${filter === f ? '#6366f1' : '#2a2a3a'}`,
                background: filter === f ? '#6366f115' : 'transparent',
                color: filter === f ? '#818cf8' : '#666',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {f === 'all'
                ? `すべて (${games.length})`
                : `⭐ お気に入り (${games.filter(g => g.is_favorite).length})`}
            </button>
          ))}
        </div>

        {/* リスト */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 64 }}>読み込み中...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 64, lineHeight: 2 }}>
            {filter === 'favorite'
              ? 'お気に入りはありません'
              : 'ライブラリが空です。\nルームでゲームをデプロイして「💾 ライブラリに保存」しよう！'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map(game => {
              const info = AI_INFO[game.provider] ?? AI_INFO.manual;
              return (
                <div
                  key={game.id}
                  style={{
                    background: '#1a1a24',
                    border: '1px solid #2a2a3a',
                    borderRadius: 12,
                    padding: '14px 16px',
                  }}
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
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid #6366f1',
                            background: '#0f0f18',
                            color: '#fff',
                            fontSize: 15,
                            fontWeight: 700,
                            width: '100%',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {game.name}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: `${info.color}20`,
                          border: `1px solid ${info.color}40`,
                          color: info.color,
                        }}>
                          {info.emoji} {info.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#555' }}>
                          {new Date(game.created_at).toLocaleDateString('ja-JP', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {/* プレビュー */}
                      <button
                        onClick={() => setPreviewId(previewId === game.id ? null : game.id)}
                        title="プレビュー"
                        style={iconBtn(previewId === game.id ? '#6366f1' : '#2a2a3a')}
                      >
                        👁
                      </button>
                      {/* お気に入り */}
                      <button
                        onClick={() => toggleFavorite(game)}
                        title={game.is_favorite ? 'お気に入り解除' : 'お気に入りに追加'}
                        style={{ ...iconBtn('#2a2a3a'), opacity: game.is_favorite ? 1 : 0.35 }}
                      >
                        ⭐
                      </button>
                      {/* 名前編集 */}
                      <button
                        onClick={() => { setEditingId(game.id); setEditName(game.name); }}
                        title="名前を編集"
                        style={iconBtn('#2a2a3a')}
                      >
                        ✏️
                      </button>
                      {/* 削除 */}
                      <button
                        onClick={() => deleteGame(game.id)}
                        title="削除"
                        style={{ ...iconBtn('#2a2a3a'), color: '#f87171' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* プレビュー iframe */}
                  {previewId === game.id && (
                    <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a3a', height: 400 }}>
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

      {/* HTML プレビューモーダル（fullscreen） */}
      {previewGame && false /* 将来使うかも */ && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', background: '#1a1a24', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>{previewGame.name}</span>
            <button onClick={() => setPreviewId(null)} style={btn('#374151', '#fff')}>✕ 閉じる</button>
          </div>
          <iframe
            srcDoc={previewGame.html}
            sandbox="allow-scripts"
            style={{ flex: 1, border: 'none' }}
            title={previewGame.name}
          />
        </div>
      )}
    </div>
  );
}

function btn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid #2a2a3a',
    background: bg,
    color,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  };
}

function iconBtn(bg: string): React.CSSProperties {
  return {
    padding: '6px 9px',
    borderRadius: 8,
    border: `1px solid ${bg}`,
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 15,
    lineHeight: 1,
  };
}
