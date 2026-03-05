import { useEffect, useState } from 'react';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  @keyframes btOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes btBookAppear {
    0%   { opacity: 0; transform: scale(0.3) translateY(60px) rotate(-4deg); }
    70%  { opacity: 1; transform: scale(1.05) translateY(-6px) rotate(1deg); }
    100% { opacity: 1; transform: scale(1) translateY(0) rotate(0deg); }
  }
  @keyframes btGlow {
    0%, 100% { filter: drop-shadow(0 0 12px rgba(200,140,40,0.6)) drop-shadow(0 0 30px rgba(200,140,40,0.2)); }
    50%       { filter: drop-shadow(0 0 28px rgba(240,190,60,1))   drop-shadow(0 0 60px rgba(240,190,60,0.5)); }
  }
  @keyframes btCoverLeft {
    0%   { transform: perspective(900px) rotateY(0deg); }
    100% { transform: perspective(900px) rotateY(-170deg); }
  }
  @keyframes btCoverRight {
    0%   { transform: perspective(900px) rotateY(0deg); }
    100% { transform: perspective(900px) rotateY(170deg); }
  }
  @keyframes btZoomIn {
    0%   { transform: scale(1);   opacity: 1; }
    60%  { transform: scale(8);   opacity: 1; }
    100% { transform: scale(30);  opacity: 0; }
  }
  @keyframes btFlash {
    0%   { background: rgba(6,3,1,0.95); }
    50%  { background: rgba(255,240,200,1); }
    100% { background: rgba(240,224,185,1); }
  }
  @keyframes btSparkle {
    0%   { transform: translate(0, 0) scale(1);   opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
  }
  @keyframes btPageFan {
    0%   { transform: perspective(900px) rotateY(0deg) scaleX(1); opacity: 0.9; }
    100% { transform: perspective(900px) rotateY(-20deg) scaleX(0.85); opacity: 0; }
  }
  @keyframes btTextBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes btRunes {
    0%   { opacity: 0; transform: translateY(0); }
    20%  { opacity: 0.7; }
    100% { opacity: 0; transform: translateY(-40px); }
  }
  @keyframes btLightBurst {
    0%   { opacity: 0; transform: scale(0.5); }
    50%  { opacity: 0.8; }
    100% { opacity: 0; transform: scale(3); }
  }
`;

type Phase = 'appear' | 'pulse' | 'open' | 'zoom' | 'flash';

const SPARKLES = [
  { dx: '-80px', dy: '-90px' }, { dx: '90px',  dy: '-80px' },
  { dx: '-110px', dy: '-30px' }, { dx: '110px', dy: '-40px' },
  { dx: '-60px', dy: '80px'  }, { dx: '70px',  dy: '90px'  },
  { dx: '-120px', dy: '20px' }, { dx: '120px', dy: '10px'  },
  { dx: '0px',   dy: '-120px'}, { dx: '30px',  dy: '-100px'},
  { dx: '-40px', dy: '-110px'}, { dx: '50px',  dy: '70px'  },
];

export function BookTransition({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>('appear');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('pulse'), 500);
    const t2 = setTimeout(() => setPhase('open'),  1000);
    const t3 = setTimeout(() => setPhase('zoom'),  1700);
    const t4 = setTimeout(() => setPhase('flash'), 2200);
    const t5 = setTimeout(() => onComplete(),      2700);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  const W = 220, H = 290;

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        animation: phase === 'flash'
          ? 'btFlash 0.5s ease forwards'
          : 'btOverlayIn 0.3s ease forwards',
        background: 'rgba(6,3,1,0.95)',
        pointerEvents: 'none',
      }}>

        {/* 背景の光の柱 */}
        {(phase === 'open' || phase === 'zoom') && (
          <div style={{
            position: 'absolute',
            width: 2,
            height: '100%',
            background: 'linear-gradient(to bottom, transparent, rgba(240,190,60,0.6), transparent)',
            animation: 'btLightBurst 0.6s ease forwards',
          }} />
        )}

        {/* 本全体 */}
        <div style={{
          position: 'relative', width: W, height: H,
          animation:
            phase === 'appear' ? 'btBookAppear 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' :
            phase === 'pulse'  ? 'btGlow 0.8s ease infinite' :
            phase === 'zoom'   ? 'btZoomIn 0.6s ease forwards' :
            phase === 'flash'  ? 'btZoomIn 0.1s ease forwards' :
            'btGlow 0.8s ease infinite',
        }}>

          {/* スパークル（本が開いた瞬間） */}
          {(phase === 'open' || phase === 'zoom') && SPARKLES.map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: i % 3 === 0 ? 10 : 6,
              height: i % 3 === 0 ? 10 : 6,
              background: i % 2 === 0 ? '#f0c060' : '#fff8d0',
              borderRadius: '50%',
              '--dx': s.dx, '--dy': s.dy,
              animation: `btSparkle ${0.5 + (i % 3) * 0.15}s ease-out ${i * 30}ms forwards`,
              boxShadow: '0 0 6px rgba(240,190,60,0.9)',
            } as React.CSSProperties} />
          ))}

          {/* ページ（表紙の下） */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(160deg, #faf3e0 0%, #f0e5c8 40%, #e8d8b0 100%)',
            zIndex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 0,
            overflow: 'hidden',
          }}>
            {/* ページ縁の影 */}
            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 20px rgba(100,60,20,0.15)' }} />
            {/* 本文ライン */}
            <div style={{ position: 'absolute', top: 28, left: 0, right: 0, bottom: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {Array.from({ length: 22 }, (_, i) => (
                <div key={i} style={{
                  height: 1,
                  margin: '7px 22px',
                  background: `rgba(100,60,20,${0.06 + (i % 4 === 0 ? 0.06 : 0)})`,
                  width: i % 5 === 0 ? '60%' : i % 3 === 0 ? '80%' : '75%',
                  marginLeft: i % 5 === 0 ? '10%' : 22,
                }} />
              ))}
            </div>
            {/* 中央挿絵 */}
            <div style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 44, opacity: 0.12 }}>⚜️</div>
            {/* ルーン文字演出 */}
            {(phase === 'open' || phase === 'zoom') && (
              <div style={{
                position: 'absolute', fontSize: 13, color: 'rgba(160,100,40,0.6)',
                animation: 'btRunes 0.8s ease forwards',
                letterSpacing: '0.3em',
                fontFamily: 'serif',
              }}>✦ ✧ ✦ ✧ ✦</div>
            )}
          </div>

          {/* 左の表紙 */}
          <div style={{
            position: 'absolute',
            width: W / 2, height: H, left: 0,
            background: 'linear-gradient(160deg, #6e380a 0%, #4a200a 50%, #3d1a04 80%, #5a2d0a 100%)',
            transformOrigin: 'right center',
            transformStyle: 'preserve-3d',
            animation: phase === 'open' || phase === 'zoom' || phase === 'flash'
              ? 'btCoverLeft 0.6s cubic-bezier(0.4,0,0.2,1) forwards' : undefined,
            zIndex: 3,
            boxShadow: 'inset -6px 0 12px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)',
          }}>
            {/* 外枠 */}
            <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(220,170,60,0.35)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', inset: 12, border: '1px solid rgba(220,170,60,0.2)', borderRadius: 1 }} />
            {/* タイトル飾り */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, opacity: 0.55 }}>📖</div>
              <div style={{ fontSize: 7, color: 'rgba(220,170,60,0.5)', fontFamily: "'Press Start 2P', monospace", marginTop: 6, lineHeight: 1.8 }}>
                GAME<br/>BOOK
              </div>
            </div>
            {/* 角の飾り */}
            {[{t:6,l:6},{t:6,r:6},{b:6,l:6},{b:6,r:6}].map((pos, i) => (
              <div key={i} style={{
                position: 'absolute', width: 8, height: 8,
                ...pos as React.CSSProperties,
                background: 'rgba(220,170,60,0.4)',
                borderRadius: '50%',
              }} />
            ))}
          </div>

          {/* 右の表紙 */}
          <div style={{
            position: 'absolute',
            width: W / 2, height: H, right: 0,
            background: 'linear-gradient(200deg, #5a2d0a 0%, #3d1a04 50%, #4a200a 80%, #6e380a 100%)',
            transformOrigin: 'left center',
            transformStyle: 'preserve-3d',
            animation: phase === 'open' || phase === 'zoom' || phase === 'flash'
              ? 'btCoverRight 0.6s cubic-bezier(0.4,0,0.2,1) forwards' : undefined,
            zIndex: 3,
            boxShadow: 'inset 6px 0 12px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)',
          }}>
            <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(220,170,60,0.35)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', inset: 12, border: '1px solid rgba(220,170,60,0.2)', borderRadius: 1 }} />
            {[{t:6,l:6},{t:6,r:6},{b:6,l:6},{b:6,r:6}].map((pos, i) => (
              <div key={i} style={{
                position: 'absolute', width: 8, height: 8,
                ...pos as React.CSSProperties,
                background: 'rgba(220,170,60,0.4)',
                borderRadius: '50%',
              }} />
            ))}
          </div>

          {/* 背表紙（中央の綴じ） */}
          <div style={{
            position: 'absolute', left: '50%', top: 0,
            width: 8, height: H,
            background: 'linear-gradient(to right, #1a0c02, #3d1a04, #1a0c02)',
            transform: 'translateX(-50%)',
            zIndex: 4,
            boxShadow: '0 0 8px rgba(0,0,0,0.8)',
          }} />
        </div>

        {/* テキスト */}
        {(phase === 'appear' || phase === 'pulse') && (
          <div style={{
            position: 'absolute',
            bottom: '28%',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            color: 'rgba(220,170,60,0.75)',
            letterSpacing: '0.12em',
            animation: 'btTextBlink 1s ease infinite',
          }}>
            ENTERING THE BOOK...
          </div>
        )}
        {phase === 'open' && (
          <div style={{
            position: 'absolute',
            bottom: '28%',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            color: 'rgba(240,200,80,0.9)',
            letterSpacing: '0.12em',
            animation: 'btRunes 0.6s ease forwards',
          }}>
            ✦ WELCOME ✦
          </div>
        )}
      </div>
    </>
  );
}
