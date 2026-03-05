// BGM（背景音楽）Web Audio API 実装 - 外部ファイル不要

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let melodyGain: GainNode | null = null;
let droneGain: GainNode | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let droneOscs: OscillatorNode[] = [];

let isPlaying = false;
let nextNoteTime = 0;
let melodyIdx = 0;
let currentTrack = 0;

// ─── 設定（永続化） ────────────────────────────────────
const STORAGE_KEY = 'sound-settings';

export interface SoundSettings {
  bgmOn: boolean;
  seOn: boolean;
  bgmVol: number;  // 0–1
  seVol: number;   // 0–1
  bgmTrack: number; // 0=ファンタジー, 1=ダーク, 2=アドベンチャー
  seStyle: number;  // 0=ソフト, 1=チップ
}

const defaults: SoundSettings = { bgmOn: true, seOn: true, bgmVol: 0.3, seVol: 0.7, bgmTrack: 0, seStyle: 0 };

export function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch (_) { /* ignore */ }
  return { ...defaults };
}

export function saveSettings(s: SoundSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) { /* ignore */ }
}

// ─── BGMトラック名 ─────────────────────────────────────
export const BGM_TRACK_NAMES = ['ファンタジー', 'ダーク', 'アドベンチャー'];
export const SE_STYLE_NAMES = ['ソフト', 'チップ'];

// ─── メロディ定義（3トラック） ──────────────────────────

// Track 0: ファンタジー（Aマイナーペンタトニック）
const MELODY_0 = [
  { freq: 220.0, dur: 0.6 }, // A3
  { freq: 261.6, dur: 0.4 }, // C4
  { freq: 329.6, dur: 0.6 }, // E4
  { freq: 392.0, dur: 0.4 }, // G4
  { freq: 329.6, dur: 0.5 }, // E4
  { freq: 261.6, dur: 0.4 }, // C4
  { freq: 293.7, dur: 0.6 }, // D4
  { freq: 220.0, dur: 0.8 }, // A3
  { freq: 196.0, dur: 0.5 }, // G3
  { freq: 220.0, dur: 0.4 }, // A3
  { freq: 261.6, dur: 0.6 }, // C4
  { freq: 246.9, dur: 0.4 }, // B3
  { freq: 220.0, dur: 1.0 }, // A3
  { freq: 0,     dur: 0.8 }, // 休符
];

// Track 1: ダーク（低音ドリーミー、スロー）
const MELODY_1 = [
  { freq: 146.8, dur: 1.0 }, // D3
  { freq: 164.8, dur: 0.6 }, // E3
  { freq: 174.6, dur: 0.8 }, // F3
  { freq: 146.8, dur: 1.2 }, // D3
  { freq: 0,     dur: 0.6 }, // 休符
  { freq: 130.8, dur: 0.8 }, // C3
  { freq: 146.8, dur: 0.6 }, // D3
  { freq: 164.8, dur: 1.0 }, // E3
  { freq: 174.6, dur: 0.6 }, // F3
  { freq: 164.8, dur: 0.8 }, // E3
  { freq: 146.8, dur: 1.5 }, // D3 長め
  { freq: 0,     dur: 1.0 }, // 休符
];

// Track 2: アドベンチャー（明るめ、やや速め）
const MELODY_2 = [
  { freq: 261.6, dur: 0.3 }, // C4
  { freq: 329.6, dur: 0.3 }, // E4
  { freq: 392.0, dur: 0.3 }, // G4
  { freq: 523.2, dur: 0.5 }, // C5
  { freq: 440.0, dur: 0.3 }, // A4
  { freq: 392.0, dur: 0.4 }, // G4
  { freq: 329.6, dur: 0.3 }, // E4
  { freq: 293.7, dur: 0.3 }, // D4
  { freq: 329.6, dur: 0.5 }, // E4
  { freq: 261.6, dur: 0.3 }, // C4
  { freq: 293.7, dur: 0.3 }, // D4
  { freq: 329.6, dur: 0.3 }, // E4
  { freq: 261.6, dur: 0.8 }, // C4
  { freq: 0,     dur: 0.5 }, // 休符
];

const MELODIES = [MELODY_0, MELODY_1, MELODY_2];

function getOrCreateCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function scheduleMelodyNote(freq: number, startTime: number, dur: number, vol: number) {
  if (!ctx || !melodyGain || freq === 0) return;

  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(melodyGain);

  osc.type = 'sine';
  osc.frequency.value = freq;

  const attack = 0.04;
  const release = Math.min(dur * 0.4, 0.3);
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(vol, startTime + attack);
  g.gain.setValueAtTime(vol, startTime + dur - release);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

  osc.start(startTime);
  osc.stop(startTime + dur + 0.01);
}

function scheduler() {
  if (!ctx || !isPlaying) return;
  const melody = MELODIES[currentTrack] ?? MELODIES[0];
  const LOOKAHEAD = 0.15;

  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    const note = melody[melodyIdx % melody.length];
    scheduleMelodyNote(note.freq, nextNoteTime, note.dur, 0.22);
    nextNoteTime += note.dur;
    melodyIdx++;
  }
}

function startDrone() {
  if (!ctx || !masterGain) return;

  droneGain = ctx.createGain();
  droneGain.connect(masterGain);

  // トラックによってドローンのルート音を変える
  const baseFreqs: Record<number, number[]> = {
    0: [110, 165, 220, 277.2],  // A2 E3 A3 C#4
    1: [73.4, 110, 146.8, 196], // D2 A2 D3 G3（ダーク）
    2: [130.8, 196, 261.6, 329.6], // C3 G3 C4 E4（アドベンチャー）
  };
  const droneFreqs = baseFreqs[currentTrack] ?? baseFreqs[0];
  droneGain.gain.value = 0.08;

  droneFreqs.forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const lfo = ctx!.createOscillator();
    const lfoGain = ctx!.createGain();
    const oscGain = ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    lfo.type = 'sine';
    lfo.frequency.value = 0.08 + i * 0.02;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(oscGain.gain);

    oscGain.gain.value = 0.04 - i * 0.005;
    osc.connect(oscGain);
    oscGain.connect(droneGain!);

    osc.start();
    lfo.start();
    droneOscs.push(osc, lfo);
  });
}

function startMelody() {
  if (!ctx || !masterGain) return;

  melodyGain = ctx.createGain();
  melodyGain.connect(masterGain);
  melodyGain.gain.value = 1.0;

  nextNoteTime = ctx.currentTime + 0.5;
  melodyIdx = 0;

  schedulerTimer = setInterval(scheduler, 50);
}

// ─── 公開API ──────────────────────────────────────────
export function startBgm(vol = 0.3, track = 0) {
  if (isPlaying) return;
  currentTrack = track;
  try {
    getOrCreateCtx();
    if (masterGain) masterGain.gain.value = vol;
    isPlaying = true;
    startDrone();
    startMelody();
  } catch (_) { /* AudioContext非対応環境は無視 */ }
}

export function stopBgm() {
  if (!isPlaying) return;
  isPlaying = false;
  if (schedulerTimer !== null) { clearInterval(schedulerTimer); schedulerTimer = null; }
  droneOscs.forEach(o => { try { o.stop(); } catch (_) { /* ignore */ } });
  droneOscs = [];
  if (droneGain) { droneGain.disconnect(); droneGain = null; }
  if (melodyGain) { melodyGain.disconnect(); melodyGain = null; }
}

export function setBgmVolume(vol: number) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, vol));
}

export function isBgmPlaying() { return isPlaying; }

// SE音量制御用
let seVolMultiplier = 0.7;
export function setSeVolume(vol: number) { seVolMultiplier = Math.max(0, Math.min(1, vol)); }
export function getSeVolume() { return seVolMultiplier; }
