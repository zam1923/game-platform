import { useEffect, useRef } from 'react';

// ピクセルスケール（1ピクセルアートpx = S actual px）
const S = 4;

const BOOK_COLORS = [
  '#1a4e8a', '#145a32', '#6e1f0a', '#4a1a7a',
  '#7c4a10', '#1a3a5c', '#5c1a1a', '#1a5c4a', '#3d0d3d',
];

// 棚の本の描画（決定論的ランダム）
function drawShelfBooks(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number,
  seed: number
) {
  let bx = x + 2;
  let s = seed;
  while (bx < x + width - 5) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const colorIdx = s % BOOK_COLORS.length;
    const bw = 4 + (s >> 8) % 5;
    const bh = 12 + (s >> 16) % 12;
    ctx.fillStyle = BOOK_COLORS[colorIdx];
    ctx.fillRect(bx, y - bh, bw, bh);
    // ページの白い端
    ctx.fillStyle = 'rgba(240,230,200,0.15)';
    ctx.fillRect(bx, y - bh, 1, bh);
    bx += bw + 1 + (s >> 20) % 3;
  }
}

// ピクセルアートキャラクター描画（司書）
function drawChar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,       // 足元の中心座標
  frame: number,                // 歩行フレーム 0 or 1
  facingLeft: boolean,          // 向き
  hasBook: boolean,
  bookColor: string,
  scale: number                 // ピクセルスケール
) {
  const p = (col: number, row: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(cx + (col - 3) * scale),
      Math.round(cy - 12 * scale + row * scale),
      scale, scale
    );
  };

  const SKIN = '#c8a06a';
  const HAIR = '#2d1208';
  const ROBE = '#8c5020';
  const DARK = '#5a3010';
  const LEG  = '#3d1f0a';
  const BOOT = '#1a0d04';

  // 頭 (row 0-2)
  p(2, 0, HAIR); p(3, 0, HAIR); p(4, 0, HAIR);
  p(1, 1, HAIR); p(2, 1, SKIN); p(3, 1, SKIN); p(4, 1, SKIN); p(5, 1, HAIR);
  p(1, 2, SKIN); p(2, 2, SKIN); p(3, 2, SKIN); p(4, 2, SKIN); p(5, 2, SKIN);
  // 目
  p(facingLeft ? 2 : 4, 2, HAIR);

  // 体 (row 3-7)
  p(0, 3, DARK); p(1, 3, ROBE); p(2, 3, ROBE); p(3, 3, ROBE); p(4, 3, ROBE); p(5, 3, ROBE); p(6, 3, DARK);
  p(0, 4, DARK); p(1, 4, ROBE); p(2, 4, ROBE); p(3, 4, ROBE); p(4, 4, ROBE); p(5, 4, ROBE); p(6, 4, DARK);
  p(1, 5, HAIR); p(2, 5, HAIR); p(3, 5, HAIR); p(4, 5, HAIR); p(5, 5, HAIR); // ベルト
  p(1, 6, ROBE); p(2, 6, ROBE); p(3, 6, ROBE); p(4, 6, ROBE); p(5, 6, ROBE);
  p(1, 7, DARK); p(2, 7, DARK); p(3, 7, DARK); p(4, 7, DARK); p(5, 7, DARK);

  // 脚 (row 8-11, 歩行アニメ)
  if (frame === 0) {
    p(1, 8, LEG); p(2, 8, LEG); p(4, 8, LEG); p(5, 8, LEG);
    p(1, 9, LEG); p(2, 9, LEG); p(4, 9, LEG); p(5, 9, LEG);
    p(1, 10, BOOT); p(2, 10, BOOT); p(4, 10, BOOT); p(5, 10, BOOT);
    p(0, 11, BOOT); p(1, 11, BOOT); p(2, 11, BOOT); p(4, 11, BOOT); p(5, 11, BOOT);
  } else {
    p(1, 8, LEG); p(2, 8, LEG); p(4, 8, LEG); p(5, 8, LEG);
    p(2, 9, LEG); p(3, 9, LEG); p(4, 9, LEG); p(5, 9, LEG);
    p(2, 10, BOOT); p(3, 10, BOOT); p(5, 10, BOOT);
    p(2, 11, BOOT); p(3, 11, BOOT); p(4, 11, BOOT); p(5, 11, BOOT);
  }

  // 本（持っている時）
  if (hasBook) {
    const bx = facingLeft ? -3 : 7;
    p(bx, 3, bookColor); p(bx + 1, 3, bookColor);
    p(bx, 4, bookColor); p(bx + 1, 4, '#f0ead8');
    p(bx, 5, bookColor); p(bx + 1, 5, bookColor);
    p(bx, 6, bookColor); p(bx + 1, 6, bookColor);
  }
}

// キャンドルの炎描画
function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  flicker: number
) {
  // 外炎
  ctx.fillStyle = `rgba(255, 130, 20, ${0.25 * flicker})`;
  ctx.fillRect(x - 2, y - 4, 4, 4);
  // 内炎
  ctx.fillStyle = `rgba(255, 210, 60, ${0.7 * flicker})`;
  ctx.fillRect(x - 1, y - 3, 2, 3);
  // 芯
  ctx.fillStyle = `rgba(255, 250, 200, ${0.9 * flicker})`;
  ctx.fillRect(x, y - 4, 1, 2);
}

interface Char {
  x: number;
  y: number;
  scale: number;
  state: 'toBooks' | 'pause' | 'toShelf' | 'pause2';
  pileX: number;
  shelfX: number;
  speed: number;
  frame: number;
  frameTimer: number;
  hasBook: boolean;
  bookColor: string;
  pauseTimer: number;
  bobOffset: number;
}

export function LibraryCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // キャンドル位置（画面比率で指定）
    const CANDLES: [number, number][] = [
      [0.06, 0.2], [0.06, 0.45], [0.06, 0.7],
      [0.94, 0.2], [0.94, 0.45], [0.94, 0.7],
      [0.3,  0.12], [0.5, 0.1], [0.7, 0.12],
    ];

    function makeChars(): Char[] {
      const w = canvas!.width;
      const h = canvas!.height;
      return Array.from({ length: 6 }, (_, i) => {
        const laneT = 0.35 + (i / 5) * 0.55; // Y位置 (画面の35%〜90%)
        const laneY = h * laneT;
        const perspScale = S * (0.6 + laneT * 0.8); // 奥は小さく・手前は大きく
        const side = i % 2;
        const shelfX = side === 0 ? w * 0.07 : w * 0.93;
        const pileX = w * (0.3 + Math.random() * 0.4);
        return {
          x: pileX,
          y: laneY,
          scale: perspScale,
          state: 'toBooks' as const,
          pileX,
          shelfX,
          speed: 35 + Math.random() * 25,
          frame: Math.random() > 0.5 ? 1 : 0,
          frameTimer: Math.random() * 400,
          hasBook: false,
          bookColor: BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)],
          pauseTimer: Math.random() * 2500, // スタートをずらす
          bobOffset: Math.random() * Math.PI * 2,
        };
      });
    }

    let chars = makeChars();

    function drawBackground(t: number) {
      const w = canvas!.width;
      const h = canvas!.height;

      // 暗い背景
      ctx.fillStyle = '#0d0703';
      ctx.fillRect(0, 0, w, h);

      // 中央の暖かい光（キャンドル雰囲気）
      const ambient = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.55);
      ambient.addColorStop(0, 'rgba(90, 45, 8, 0.22)');
      ambient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, w, h);

      const lsW = Math.floor(w * 0.15); // 左棚幅
      const rsX = Math.floor(w * 0.85); // 右棚開始X

      // === 左の本棚 ===
      ctx.fillStyle = '#1e0d04';
      ctx.fillRect(0, 0, lsW, h);
      // 棚板
      const shelfRows = 7;
      for (let i = 0; i < shelfRows; i++) {
        const sy = h * 0.07 + i * (h * 0.135);
        // 棚板
        ctx.fillStyle = '#5a2d0a';
        ctx.fillRect(0, sy, lsW, 3);
        // 棚板上の本
        drawShelfBooks(ctx, 2, sy, lsW - 4, i * 17 + 3);
      }
      // 右端の区切り線
      ctx.fillStyle = '#5a2d0a';
      ctx.fillRect(lsW - 2, 0, 2, h);

      // === 右の本棚 ===
      ctx.fillStyle = '#1e0d04';
      ctx.fillRect(rsX, 0, w - rsX, h);
      ctx.fillStyle = '#5a2d0a';
      ctx.fillRect(rsX, 0, 2, h);
      for (let i = 0; i < shelfRows; i++) {
        const sy = h * 0.07 + i * (h * 0.135);
        ctx.fillStyle = '#5a2d0a';
        ctx.fillRect(rsX, sy, w - rsX, 3);
        drawShelfBooks(ctx, rsX + 4, sy, w - rsX - 6, i * 17 + 11);
      }

      // === 床（中央エリア）===
      const floorGrad = ctx.createLinearGradient(0, h * 0.35, 0, h);
      floorGrad.addColorStop(0, 'rgba(50,25,8,0)');
      floorGrad.addColorStop(1, 'rgba(30,15,4,0.35)');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(lsW, h * 0.35, rsX - lsW, h * 0.65);

      // 床タイル（ピクセルグリッド）
      ctx.strokeStyle = 'rgba(80,40,10,0.08)';
      ctx.lineWidth = 1;
      const tile = Math.round(w / 24);
      for (let gx = lsW; gx < rsX; gx += tile) {
        ctx.beginPath(); ctx.moveTo(gx, h * 0.35); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = h * 0.35; gy < h; gy += tile) {
        ctx.beginPath(); ctx.moveTo(lsW, gy); ctx.lineTo(rsX, gy); ctx.stroke();
      }

      // === キャンドルの光 ===
      CANDLES.forEach(([cx, cy], i) => {
        const flicker = 0.82 + Math.sin(t * 0.0023 + i * 1.57) * 0.18;
        const gx = w * cx;
        const gy = h * cy;
        const radius = (55 + flicker * 35) * Math.min(w, h) / 800;

        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
        glow.addColorStop(0, `rgba(255, 170, 50, ${0.38 * flicker})`);
        glow.addColorStop(0.4, `rgba(180, 90, 20, ${0.12 * flicker})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);

        // 炎
        drawFlame(ctx, gx, gy, flicker);
      });

      // 上部からの暗いグラデーション（奥行き感）
      const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.35);
      topGrad.addColorStop(0, 'rgba(5,2,0,0.6)');
      topGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, w, h * 0.35);
    }

    function drawPile(c: Char) {
      // 本の山（拾う場所）
      const count = c.hasBook ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const bx = c.pileX + (i - 1) * 9 - 4;
        const by = c.y + 2;
        ctx.fillStyle = BOOK_COLORS[(i + Math.floor(c.pileX / 10)) % BOOK_COLORS.length];
        ctx.fillRect(bx, by, 8, 5);
        ctx.fillStyle = 'rgba(240,230,200,0.12)';
        ctx.fillRect(bx + 7, by + 1, 1, 3);
      }
    }

    function update(dt: number) {
      chars.forEach(c => {
        // スタートのずらし（初期遅延）
        if (c.pauseTimer > 0 && c.state === 'toBooks') {
          c.pauseTimer -= dt;
          return;
        }

        // 歩行フレーム
        c.frameTimer += dt;
        if (c.frameTimer > 340) {
          c.frame = 1 - c.frame;
          c.frameTimer = 0;
        }

        const dist = c.speed * (dt / 1000);

        switch (c.state) {
          case 'toBooks': {
            const dx = c.pileX - c.x;
            if (Math.abs(dx) < dist + 1) {
              c.x = c.pileX;
              c.state = 'pause';
              c.pauseTimer = 500 + Math.random() * 700;
            } else {
              c.x += Math.sign(dx) * dist;
            }
            break;
          }
          case 'pause': {
            c.pauseTimer -= dt;
            if (c.pauseTimer <= 0) {
              c.hasBook = true;
              c.bookColor = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
              c.state = 'toShelf';
            }
            break;
          }
          case 'toShelf': {
            const dx = c.shelfX - c.x;
            if (Math.abs(dx) < dist + 1) {
              c.x = c.shelfX;
              c.state = 'pause2';
              c.pauseTimer = 400 + Math.random() * 600;
            } else {
              c.x += Math.sign(dx) * dist;
            }
            break;
          }
          case 'pause2': {
            c.pauseTimer -= dt;
            if (c.pauseTimer <= 0) {
              c.hasBook = false;
              c.state = 'toBooks';
            }
            break;
          }
        }
      });
    }

    function render(t: number) {
      drawBackground(t);

      // 本の山を先に描画
      chars.forEach(c => drawPile(c));

      // Y値でソート（奥から手前の順に描画）
      const sorted = [...chars].sort((a, b) => a.y - b.y);

      sorted.forEach(c => {
        const isWalking = c.state === 'toBooks' || c.state === 'toShelf';
        // 歩行時のボブ（上下揺れ）
        const bobY = isWalking
          ? Math.sin(t * 0.009 + c.bobOffset) * c.scale * 0.35
          : 0;

        // 向き: 棚に向かって歩いているか、棚にいる間は棚側を向く
        const goingToShelf = c.state === 'toShelf' || c.state === 'pause2';
        const facingLeft = goingToShelf
          ? (c.shelfX < c.pileX)
          : (c.shelfX >= c.pileX);

        drawChar(
          ctx,
          c.x,
          c.y + bobY,
          isWalking ? c.frame : 0,
          facingLeft,
          c.hasBook,
          c.bookColor,
          c.scale
        );
      });
    }

    let prevT = 0;
    function loop(t: number) {
      const dt = Math.min(t - prevT, 50);
      prevT = t;
      update(dt);
      render(t);
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
