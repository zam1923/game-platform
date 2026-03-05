import { useState, useEffect } from 'react';
import {
  loadSettings, saveSettings, startBgm, stopBgm, setBgmVolume, setSeVolume,
  BGM_TRACK_NAMES, SE_STYLE_NAMES,
  type SoundSettings,
} from '../utils/bgm';

const FONT = "'Press Start 2P', monospace";
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  @keyframes ssSlideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export function SoundSettings() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SoundSettings>(loadSettings);

  useEffect(() => {
    setSeVolume(settings.seVol);
    if (settings.bgmOn) {
      startBgm(settings.bgmVol, settings.bgmTrack);
    } else {
      stopBgm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<SoundSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);

    if ('bgmOn' in patch) {
      patch.bgmOn ? startBgm(next.bgmVol, next.bgmTrack) : stopBgm();
    }
    if ('bgmVol' in patch) {
      setBgmVolume(patch.bgmVol!);
    }
    if ('bgmTrack' in patch) {
      stopBgm();
      if (next.bgmOn) startBgm(next.bgmVol, patch.bgmTrack!);
    }
    if ('seVol' in patch) {
      setSeVolume(patch.seVol!);
    }
  }

  return (
    <>
      <style>{CSS}</style>

      {/* フローティングボタン */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 900,
          width: 42, height: 42,
          background: open ? 'rgba(196,122,42,0.25)' : 'rgba(18,9,2,0.85)',
          border: `2px solid ${open ? '#f0c060' : '#5a2d0a'}`,
          color: '#c8a06a',
          cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          boxShadow: open ? '0 0 16px rgba(240,192,96,0.3)' : 'none',
        }}
        title="サウンド設定"
      >
        🔊
      </button>

      {/* 設定パネル */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 890 }} />
          <div style={{
            position: 'fixed', bottom: 72, right: 20, zIndex: 901,
            width: 260,
            background: 'rgba(12,6,2,0.96)',
            border: '2px solid #5a2d0a',
            outline: '1px solid #2d1208',
            outlineOffset: 3,
            padding: '16px 18px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            animation: 'ssSlideUp 0.15s ease',
          }}>
            {/* タイトル */}
            <div style={{ fontFamily: FONT, fontSize: 8, color: '#f0c060', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid rgba(196,122,42,0.2)' }}>
              🔊 SOUND
            </div>

            {/* BGM */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#c8a06a', fontWeight: 700 }}>BGM</span>
                <Toggle value={settings.bgmOn} onChange={v => update({ bgmOn: v })} />
              </div>
              <input type="range" min={0} max={1} step={0.05}
                value={settings.bgmVol}
                onChange={e => update({ bgmVol: parseFloat(e.target.value) })}
                disabled={!settings.bgmOn}
                style={sliderStyle(settings.bgmOn)}
              />
              <div style={{ textAlign: 'right', fontSize: 9, color: '#5a3a18', marginTop: 2 }}>
                {Math.round(settings.bgmVol * 100)}%
              </div>
              {/* BGMトラック選択 */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: FONT, fontSize: 6, color: '#3d1f0a', marginBottom: 5 }}>TRACK</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {BGM_TRACK_NAMES.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => update({ bgmTrack: i })}
                      disabled={!settings.bgmOn}
                      style={{
                        flex: 1, padding: '5px 2px',
                        fontFamily: FONT, fontSize: 6, cursor: settings.bgmOn ? 'pointer' : 'not-allowed',
                        background: settings.bgmTrack === i ? 'rgba(196,122,42,0.2)' : 'rgba(30,15,4,0.6)',
                        border: `1px solid ${settings.bgmTrack === i ? '#c47a2a' : '#2d1208'}`,
                        color: settings.bgmTrack === i ? '#f0c060' : '#5a3a18',
                        opacity: settings.bgmOn ? 1 : 0.4,
                        transition: 'all 0.1s',
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(196,122,42,0.15)', marginBottom: 14 }} />

            {/* SE */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#c8a06a', fontWeight: 700 }}>効果音</span>
                <Toggle value={settings.seOn} onChange={v => update({ seOn: v })} />
              </div>
              <input type="range" min={0} max={1} step={0.05}
                value={settings.seVol}
                onChange={e => update({ seVol: parseFloat(e.target.value) })}
                disabled={!settings.seOn}
                style={sliderStyle(settings.seOn)}
              />
              <div style={{ textAlign: 'right', fontSize: 9, color: '#5a3a18', marginTop: 2 }}>
                {Math.round(settings.seVol * 100)}%
              </div>
              {/* SEスタイル選択 */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: FONT, fontSize: 6, color: '#3d1f0a', marginBottom: 5 }}>STYLE</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {SE_STYLE_NAMES.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => update({ seStyle: i })}
                      disabled={!settings.seOn}
                      style={{
                        flex: 1, padding: '5px 2px',
                        fontFamily: FONT, fontSize: 6, cursor: settings.seOn ? 'pointer' : 'not-allowed',
                        background: settings.seStyle === i ? 'rgba(196,122,42,0.2)' : 'rgba(30,15,4,0.6)',
                        border: `1px solid ${settings.seStyle === i ? '#c47a2a' : '#2d1208'}`,
                        color: settings.seStyle === i ? '#f0c060' : '#5a3a18',
                        opacity: settings.seOn ? 1 : 0.4,
                        transition: 'all 0.1s',
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 22,
        background: value ? 'rgba(196,122,42,0.3)' : 'rgba(30,15,4,0.8)',
        border: `2px solid ${value ? '#c47a2a' : '#3d1f0a'}`,
        cursor: 'pointer', padding: 0,
        position: 'relative', transition: 'all 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: value ? 'calc(100% - 18px)' : 2,
        width: 14, height: 14,
        background: value ? '#f0c060' : '#3d1f0a',
        transition: 'left 0.15s, background 0.15s',
      }} />
    </button>
  );
}

function sliderStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%', accentColor: '#c47a2a',
    opacity: enabled ? 1 : 0.3, cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
