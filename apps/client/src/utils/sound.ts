// Web Audio APIによるSE（外部ライブラリなし）
import { loadSettings, getSeVolume } from './bgm';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function seEnabled(): boolean {
  return loadSettings().seOn;
}

function seVol(): number {
  return getSeVolume();
}

function seStyle(): number {
  return loadSettings().seStyle ?? 0;
}

// 短い電子ビープ音（ボタンクリック用）
export function playClick() {
  if (!seEnabled()) return;
  try {
    const c = getCtx();
    const style = seStyle();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    if (style === 1) {
      // チップチューン: square wave
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, c.currentTime);
      osc.frequency.setValueAtTime(440, c.currentTime + 0.04);
      gain.gain.setValueAtTime(0.07 * seVol(), c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.1);
    } else {
      // ソフト: sine wave
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15 * seVol(), c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.08);
    }
  } catch (_) { /* 無視 */ }
}

// 成功音（ルーム作成など）
export function playSuccess() {
  if (!seEnabled()) return;
  try {
    const c = getCtx();
    const style = seStyle();

    if (style === 1) {
      // チップチューン: square wave アルペジオ
      const notes = [262, 330, 392, 523];
      notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'square';
        const t = c.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.07 * seVol(), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } else {
      // ソフト: sine wave コード
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = 'sine';
        const t = c.currentTime + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.12 * seVol(), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }
  } catch (_) { /* 無視 */ }
}

// ホバー音（極小）
export function playHover() {
  if (!seEnabled()) return;
  try {
    const c = getCtx();
    const style = seStyle();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    if (style === 1) {
      osc.type = 'square';
      osc.frequency.setValueAtTime(330, c.currentTime);
      gain.gain.setValueAtTime(0.03 * seVol(), c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.04);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, c.currentTime);
      gain.gain.setValueAtTime(0.04 * seVol(), c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.05);
    }
  } catch (_) { /* 無視 */ }
}
