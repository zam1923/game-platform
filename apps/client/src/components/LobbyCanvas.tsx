import { useEffect, useRef } from 'react';

const BOOK_COLORS = [
  '#1a4e8a', '#145a32', '#6e1f0a', '#4a1a7a',
  '#7c4a10', '#1a3a5c', '#5c1a1a', '#1a5c4a',
  '#3d0d3d', '#5a4a1a', '#1a2d5a', '#2d4a00',
];

// 棚1列分の本を描画（FPS大スケール）
function drawShelfRow(
  ctx: CanvasRenderingContext2D,
  rowX: number, rowY: number,
  rowW: number, rowH: number,
  seed: number
) {
  let x = rowX;
  let s = seed;
  while (x < rowX + rowW) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const colorIdx = s % BOOK_COLORS.length;
    const bw = 18 + (s >> 8) % 32;          // 18-50px幅
    const bh = Math.floor(rowH * (0.68 + ((s >> 16) % 32) / 100));
    const by = rowY + rowH - bh;            // 下揃え

    ctx.fillStyle = BOOK_COLORS[colorIdx];
    ctx.fillRect(x, by, bw - 1, bh);

    // 左端を暗く（影）
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, by, 2, bh);

    // 上端をうっすら明るく
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, by, bw - 1, 2);

    // タイトル帯（一部の本）
    if ((s >> 20) % 3 === 0) {
      ctx.fillStyle = 'rgba(255,215,80,0.18)';
      const bandY = by + Math.floor(bh * 0.28);
      ctx.fillRect(x + 2, bandY, bw - 4, Math.max(2, Math.floor(bh * 0.07)));
    }

    x += bw + (s >> 24) % 3;
  }
}

export function LobbyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    let rafId: number;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // キャンドル位置（画面比率）
    const CANDLES: [number, number][] = [
      [0.1, 0.15], [0.35, 0.35], [0.6, 0.15], [0.82, 0.45],
      [0.2, 0.65], [0.5, 0.75], [0.78, 0.8], [0.45, 0.55],
    ];

    function draw(t: number) {
      const w = canvas!.width;
      const h = canvas!.height;

      // ダーク背景
      ctx.fillStyle = '#080401';
      ctx.fillRect(0, 0, w, h);

      const ROWS = 5;
      const shelfH = h / ROWS;
      const plankH = Math.max(5, Math.floor(shelfH * 0.065));
      const divW = Math.max(6, Math.floor(w * 0.008));

      // 棚の描画
      for (let row = 0; row < ROWS; row++) {
        const topY = row * shelfH;
        const bookH = shelfH - plankH;

        // 棚の奥の壁（木目）
        ctx.fillStyle = '#120802';
        ctx.fillRect(0, topY, w, shelfH);

        // 本を描く
        drawShelfRow(ctx, 0, topY, w, bookH, row * 29 + 3);

        // 棚板（厚めの木材）
        ctx.fillStyle = '#4a2408';
        ctx.fillRect(0, topY + bookH, w, plankH);
        // 棚板ハイライト
        ctx.fillStyle = 'rgba(180,120,50,0.18)';
        ctx.fillRect(0, topY + bookH, w, 1);
        // 棚板影
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, topY + bookH + plankH - 1, w, 2);

        // 縦仕切り（棚の柱）
        let divX = 80 + (row * 37 % 60);
        while (divX < w) {
          ctx.fillStyle = '#2a1204';
          ctx.fillRect(divX, topY, divW, shelfH);
          ctx.fillStyle = 'rgba(160,90,30,0.12)';
          ctx.fillRect(divX, topY, 1, shelfH);
          divX += 120 + (row * 43 + divX * 7) % 100;
        }
      }

      // キャンドルの揺らぎ光
      CANDLES.forEach(([cx, cy], i) => {
        const flicker = 0.72 + Math.sin(t * 0.0022 + i * 1.9) * 0.28;
        const gx = w * cx;
        const gy = h * cy;
        const r = Math.min(w, h) * (0.18 + flicker * 0.06);

        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        glow.addColorStop(0, `rgba(255,170,50,${0.42 * flicker})`);
        glow.addColorStop(0.35, `rgba(180,80,15,${0.13 * flicker})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);

        // 炎の点
        ctx.fillStyle = `rgba(255,230,100,${0.85 * flicker})`;
        ctx.fillRect(gx - 1, gy - 2, 2, 3);
        ctx.fillStyle = `rgba(255,255,200,${0.7 * flicker})`;
        ctx.fillRect(gx, gy - 3, 1, 2);
      });

      // 周辺をさらに暗く（フォーカス感）
      const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }

    function loop(t: number) {
      draw(t);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        imageRendering: 'pixelated',
      }}
    />
  );
}
