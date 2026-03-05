// ルーム画面の背景: 羊皮紙 / 本のページ質感

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  @keyframes parchFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ページのランダムノイズ風テクスチャ（SVGフィルタ） */
  .parch-noise {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-color: #f0e0b8;
    animation: parchFadeIn 0.6s ease;
  }
  .parch-noise::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 28px,
        rgba(160,100,40,0.06) 28px,
        rgba(160,100,40,0.06) 29px
      );
    pointer-events: none;
  }
  .parch-noise::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 50% 50%, rgba(200,150,60,0.06) 0%, transparent 70%),
      radial-gradient(ellipse at 0% 0%, rgba(100,50,10,0.12) 0%, transparent 40%),
      radial-gradient(ellipse at 100% 0%, rgba(100,50,10,0.1) 0%, transparent 40%),
      radial-gradient(ellipse at 0% 100%, rgba(100,50,10,0.1) 0%, transparent 40%),
      radial-gradient(ellipse at 100% 100%, rgba(100,50,10,0.1) 0%, transparent 40%);
    pointer-events: none;
  }
`;

// 薄い挿絵イラスト（SVGで描画）
function FaintIllustrations() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* 左上: 羽根ペン */}
      <svg
        style={{ position: 'absolute', top: 40, left: 40, opacity: 0.055 }}
        width="120" height="180" viewBox="0 0 120 180"
      >
        <path d="M60 170 Q55 120 20 10 Q50 40 70 70 Q90 100 60 170Z"
          fill="#5a3010" />
        <path d="M60 170 Q65 120 100 20 Q70 50 55 80 Q40 110 60 170Z"
          fill="#7c4a20" />
        <line x1="60" y1="10" x2="60" y2="170" stroke="#3d1a08" strokeWidth="1.5" />
        <path d="M60 165 Q58 168 55 172" stroke="#3d1a08" strokeWidth="1" fill="none" />
      </svg>

      {/* 右上: 開いた本のシルエット */}
      <svg
        style={{ position: 'absolute', top: 30, right: 50, opacity: 0.05 }}
        width="160" height="110" viewBox="0 0 160 110"
      >
        <path d="M80 95 Q40 80 10 90 L10 20 Q40 10 80 25Z" fill="#5a3010" />
        <path d="M80 95 Q120 80 150 90 L150 20 Q120 10 80 25Z" fill="#5a3010" />
        <line x1="80" y1="25" x2="80" y2="95" stroke="#3d1a08" strokeWidth="2" />
        {[30, 45, 60, 75].map(y => (
          <line key={y} x1="18" y1={y} x2="74" y2={y - 2} stroke="#7c4a20" strokeWidth="0.8" opacity="0.7" />
        ))}
        {[30, 45, 60, 75].map(y => (
          <line key={y} x1="86" y1={y - 2} x2="142" y2={y} stroke="#7c4a20" strokeWidth="0.8" opacity="0.7" />
        ))}
      </svg>

      {/* 左下: キャンドル */}
      <svg
        style={{ position: 'absolute', bottom: 60, left: 60, opacity: 0.05 }}
        width="60" height="130" viewBox="0 0 60 130"
      >
        {/* 炎 */}
        <ellipse cx="30" cy="18" rx="8" ry="16" fill="#c47a2a" />
        <ellipse cx="30" cy="20" rx="4" ry="10" fill="#f0c060" />
        {/* ろうそく本体 */}
        <rect x="18" y="30" width="24" height="70" rx="2" fill="#5a3010" />
        <rect x="20" y="30" width="4" height="70" rx="1" fill="rgba(255,255,255,0.1)" />
        {/* 台座 */}
        <ellipse cx="30" cy="100" rx="18" ry="6" fill="#3d1a08" />
        {/* 溶けたロウ */}
        <path d="M18 35 Q14 50 16 60 L18 60 Q17 50 20 37Z" fill="rgba(200,160,80,0.4)" />
      </svg>

      {/* 右下: 砂時計 */}
      <svg
        style={{ position: 'absolute', bottom: 50, right: 60, opacity: 0.045 }}
        width="70" height="120" viewBox="0 0 70 120"
      >
        <path d="M10 10 L60 10 L35 60 L60 110 L10 110 L35 60 Z" fill="none" stroke="#5a3010" strokeWidth="2.5" />
        <path d="M15 10 L55 10 L35 50Z" fill="#7c4a20" opacity="0.5" />
        <path d="M35 70 L55 110 L15 110Z" fill="#7c4a20" opacity="0.3" />
        {/* 枠 */}
        <rect x="8" y="6" width="54" height="8" rx="2" fill="#5a3010" />
        <rect x="8" y="106" width="54" height="8" rx="2" fill="#5a3010" />
        <rect x="31" y="14" width="8" height="92" rx="1" fill="#3d1a08" opacity="0.3" />
      </svg>

      {/* 中央上部: 装飾的な仕切り線 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 2,
        height: '100%',
        background: 'linear-gradient(to bottom, transparent, rgba(140,80,30,0.06) 20%, rgba(140,80,30,0.06) 80%, transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

export function ParchmentBackground() {
  return (
    <>
      <style>{CSS}</style>
      <div className="parch-noise" />
      <FaintIllustrations />
    </>
  );
}
