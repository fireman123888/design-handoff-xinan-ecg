// elderly-app.jsx — full multi-screen ECG patient app, 适老化 focus
// Screens: pairing (3 steps) → home → history → detail → family → settings → alarm overlay

(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;
  const { AndroidDevice } = window;
  const { useEcgSim, EcgWaveform, formatTime, formatDuration, COMMANDS } = window;

  // ── design tokens (large, calm, high-contrast) ─────────────
  const T = {
    bg: '#f3f6f8',
    card: '#ffffff',
    ink: '#15212e',
    inkSoft: '#3a4856',
    muted: '#6a7a8c',
    line: '#e3eaf0',
    accent: 'oklch(0.55 0.13 165)',     // calm green-teal
    accentSoft: 'oklch(0.94 0.04 165)',
    warn: 'oklch(0.62 0.18 35)',
    warnSoft: 'oklch(0.96 0.05 35)',
    danger: '#b1242b',
    sans: '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif',
    mono: '"SF Mono", "JetBrains Mono", monospace',
  };

  // ── Screen frame ────────────────────────────────────────────
  function Screen({ children, scroll = true, bg = T.bg }) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: bg, color: T.ink, fontFamily: T.sans,
        overflow: scroll ? 'auto' : 'hidden',
      }}>{children}</div>
    );
  }

  function NavBar({ title, onBack, right }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 6px 8px 6px',
        gap: 4, background: T.bg, position: 'sticky', top: 0, zIndex: 5,
      }}>
        <button onClick={onBack} disabled={!onBack} style={{
          appearance: 'none', border: 'none', background: 'transparent',
          width: 56, height: 56, fontSize: 28, color: onBack ? T.ink : 'transparent',
          cursor: onBack ? 'pointer' : 'default',
        }}>‹</button>
        <div style={{ flex: 1, fontSize: 22, fontWeight: 700, letterSpacing: -0.3, textAlign: 'center' }}>{title}</div>
        <div style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{right}</div>
      </div>
    );
  }

  function TabBar({ tab, setTab }) {
    const items = [
      { id: 'home', label: '主页', icon: HomeIcon },
      { id: 'history', label: '记录', icon: HistoryIcon },
      { id: 'family', label: '家⼈', icon: FamilyIcon },
      { id: 'settings', label: '设置', icon: SettingsIcon },
    ];
    return (
      <div style={{
        display: 'flex', background: '#fff', borderTop: `1px solid ${T.line}`,
        padding: '6px 4px 8px',
      }}>
        {items.map(it => {
          const active = tab === it.id;
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{
              flex: 1, appearance: 'none', border: 'none', background: 'transparent',
              padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, cursor: 'pointer',
              color: active ? T.accent : T.muted,
            }}>
              <Icon active={active} color={active ? T.accent : T.muted} />
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Icons (simple, large, monochromatic) ────────────────────
  function HomeIcon({ color }) {
    return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 13L14 5l10 8v10a2 2 0 0 1-2 2h-5v-7h-6v7H6a2 2 0 0 1-2-2V13z" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>;
  }
  function HistoryIcon({ color }) {
    return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke={color} strokeWidth="2" /><path d="M14 8v6l4 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  function FamilyIcon({ color }) {
    return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="10" cy="10" r="3.5" stroke={color} strokeWidth="2" /><circle cx="19" cy="11" r="3" stroke={color} strokeWidth="2" /><path d="M3 23c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke={color} strokeWidth="2" strokeLinecap="round" /><path d="M16 23c0-2.6 2.2-5 5-5s5 2.4 5 5" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  function SettingsIcon({ color }) {
    return <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="3.5" stroke={color} strokeWidth="2" /><path d="M14 3v3M14 22v3M3 14h3M22 14h3M6 6l2 2M20 20l2 2M6 22l2-2M20 8l2-2" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
  }
  function HeartIcon({ color = T.accent, size = 28 }) {
    return <svg width={size} height={size} viewBox="0 0 32 32" fill={color}><path d="M16 27s-9-6-9-13.5C7 9.4 9.9 7 13 7c1.8 0 3.4 1 4 2.4C17.6 8 19.2 7 21 7c3.1 0 6 2.4 6 6.5C27 21 16 27 16 27z" /></svg>;
  }
  function BluetoothIcon({ color = T.accent, size = 28 }) {
    // Friendly, legible Bluetooth indicator: a rounded badge with "B" inside
    // and small "wave" arcs to its right, suggesting wireless. Avoids the
    // hard-to-read runic glyph for elderly users.
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect x="3" y="6" width="18" height="20" rx="4" fill={color} />
        <text x="12" y="22" textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="700" fontSize="16" fill="#fff">B</text>
        <path d="M24 12 Q28 16 24 20" stroke={color} strokeWidth="2.4"
          strokeLinecap="round" fill="none" />
        <path d="M27 9 Q32 16 27 23" stroke={color} strokeWidth="2.4"
          strokeLinecap="round" fill="none" opacity="0.7" />
      </svg>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Pairing flow — 3 steps
  // ─────────────────────────────────────────────────────────────
  function Pairing({ onDone }) {
    const [step, setStep] = useState(0);
    const [scanning, setScanning] = useState(true);
    useEffect(() => {
      if (step === 1 && scanning) {
        const t = setTimeout(() => setScanning(false), 1800);
        return () => clearTimeout(t);
      }
    }, [step, scanning]);

    const next = () => setStep(s => s + 1);
    const back = () => setStep(s => Math.max(0, s - 1));

    if (step === 0) {
      // Welcome
      return (
        <Screen>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', textAlign: 'center' }}>
            <div style={{ width: 120, height: 120, borderRadius: 60, background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
              <HeartIcon size={64} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.2 }}>欢迎使⽤</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.2, color: T.accent }}>⼼安⼼电</div>
            <div style={{ fontSize: 17, color: T.inkSoft, marginTop: 18, lineHeight: 1.6 }}>
              ⼀台贴⼼的⼼电监测设备，<br/>陪伴您每⼀次⼼跳。
            </div>
          </div>
          <div style={{ padding: '0 18px 22px' }}>
            <BigButton onClick={next}>开始连接设备</BigButton>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 15, color: T.muted }}>已经配对过？<span style={{ color: T.accent, fontWeight: 600 }}>直接进⼊</span></div>
          </div>
        </Screen>
      );
    }
    if (step === 1) {
      return (
        <Screen>
          <NavBar title="搜索设备" onBack={back} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 28px' }}>
            <div style={{ position: 'relative', width: 200, height: 200, marginTop: 10 }}>
              {scanning && [0, 1, 2].map(i => (
                <div key={i} style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `2px solid ${T.accent}`, opacity: 0,
                  animation: `scanRing 2.4s ease-out ${i * 0.8}s infinite`,
                }} />
              ))}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                width: 120, height: 120, borderRadius: 60,
                background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BluetoothIcon color="#fff" size={60} />
              </div>
              <style>{`@keyframes scanRing { 0%{transform:scale(0.6); opacity:0.6} 100%{transform:scale(1.4); opacity:0} }`}</style>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 24 }}>
              {scanning ? '正在搜索附近设备…' : '已找到 1 台设备'}
            </div>
            <div style={{ fontSize: 15, color: T.muted, marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
              请确认设备已开机，<br/>蓝灯正在缓慢闪烁。
            </div>

            {!scanning && (
              <div style={{ width: '100%', marginTop: 28, background: T.card, borderRadius: 18, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HeartIcon size={28} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>⼼安 ECG · 设备 03</div>
                  <div style={{ fontSize: 13, color: T.muted, marginTop: 2, fontFamily: T.mono }}>5d:7f:9e:51 · 信号良好</div>
                </div>
                <div style={{ fontSize: 14, color: T.accent, fontWeight: 700 }}>连接</div>
              </div>
            )}
          </div>
          <div style={{ padding: '0 18px 22px' }}>
            <BigButton disabled={scanning} onClick={next}>{scanning ? '搜索中…' : '连接此设备'}</BigButton>
          </div>
        </Screen>
      );
    }
    // step 2 — electrode placement guide
    return (
      <Screen>
        <NavBar title="贴⽚位置" onBack={back} />
        <div style={{ flex: 1, padding: '6px 22px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>
            将设备贴在胸前
          </div>
          <div style={{ fontSize: 16, color: T.inkSoft, marginTop: 8, lineHeight: 1.6 }}>
            按图⽰位置，将设备的两个⾦属电极贴紧⽪肤。如有⽑发请尽量避开。
          </div>
          <div style={{ background: T.card, borderRadius: 22, padding: '18px 14px', marginTop: 18, display: 'flex', justifyContent: 'center' }}>
            <BodyPlacement />
          </div>
          <div style={{ background: T.accentSoft, borderRadius: 18, padding: '16px 18px', marginTop: 16, display: 'flex', gap: 12 }}>
            <div style={{ fontSize: 22 }}>💡</div>
            <div style={{ flex: 1, fontSize: 15, color: T.ink, lineHeight: 1.55 }}>
              ⼩贴⼠：贴⽚最好贴在⼲燥、清洁的⽪肤上。出汗较多时可先擦⼲。
            </div>
          </div>
        </div>
        <div style={{ padding: '18px 18px 22px' }}>
          <BigButton onClick={onDone}>已贴好，开始记录</BigButton>
        </div>
      </Screen>
    );
  }

  function BodyPlacement() {
    return (
      <svg width="200" height="240" viewBox="0 0 200 240">
        {/* torso silhouette */}
        <path d="M70 30 Q70 14 100 14 Q130 14 130 30 L138 60 Q160 70 162 100 L160 200 Q160 224 140 226 L60 226 Q40 224 40 200 L38 100 Q40 70 62 60 Z"
          fill="#eef3f6" stroke={T.line} strokeWidth="1.5" />
        {/* head */}
        <circle cx="100" cy="-2" r="22" fill="#eef3f6" stroke={T.line} strokeWidth="1.5" />
        {/* electrode positions */}
        <g>
          <circle cx="80" cy="100" r="14" fill={T.accent} />
          <circle cx="80" cy="100" r="20" fill="none" stroke={T.accent} strokeOpacity="0.3" strokeWidth="2" />
          <text x="80" y="105" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">L</text>
        </g>
        <g>
          <circle cx="124" cy="120" r="14" fill={T.accent} />
          <circle cx="124" cy="120" r="20" fill="none" stroke={T.accent} strokeOpacity="0.3" strokeWidth="2" />
          <text x="124" y="125" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">R</text>
        </g>
        {/* heart hint */}
        <path d="M100 150 q-3 -8 -10 -8 q-10 0 -10 8 q0 10 20 22 q20 -12 20 -22 q0 -8 -10 -8 q-7 0 -10 8z"
          fill="none" stroke={T.warn} strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // BigButton — 56px+ touch target, large copy
  // ─────────────────────────────────────────────────────────────
  function BigButton({ children, onClick, variant = 'primary', disabled }) {
    const styles = {
      primary: { bg: T.accent, fg: '#fff' },
      secondary: { bg: '#fff', fg: T.ink, border: `1px solid ${T.line}` },
      danger: { bg: T.warnSoft, fg: T.danger },
      ghost: { bg: 'transparent', fg: T.accent },
    }[variant];
    return (
      <button onClick={onClick} disabled={disabled} style={{
        width: '100%', appearance: 'none',
        border: styles.border || 'none',
        background: disabled ? '#cfd8de' : styles.bg,
        color: disabled ? '#fff' : styles.fg,
        borderRadius: 18, padding: '20px 0',
        fontSize: 19, fontWeight: 700, fontFamily: T.sans,
        letterSpacing: 0.2,
        cursor: disabled ? 'default' : 'pointer',
      }}>{children}</button>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // DataSourceBadge — debug switcher to verify which data is feeding the trace
  // ─────────────────────────────────────────────────────────────
  function DataSourceBadge() {
    const [src, setSrc] = useState(window.__ECG_SOURCE || 'real');
    const [open, setOpen] = useState(false);
    const [realLoaded, setRealLoaded] = useState(window.__ECG && window.__ECG.isRealLoaded());
    useEffect(() => {
      const h = () => setRealLoaded(true);
      window.addEventListener('ecg-source-ready', h);
      return () => window.removeEventListener('ecg-source-ready', h);
    }, []);
    const choose = (s) => {
      window.__ECG.setSource(s);
      setSrc(s);
      setOpen(false);
    };
    const labels = {
      real: { label: '真实样本', sub: 'ecg-samples.json', dot: T.accent },
      synth: { label: '合成 PQRST', sub: '数学⽣成', dot: '#f5a623' },
      flat: { label: '平线', sub: '验证开关', dot: '#888' },
    };
    const cur = labels[src] || labels.real;
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          appearance: 'none', border: `1px solid ${T.line}`, background: '#fff',
          borderRadius: 14, padding: '8px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.mono,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 4, background: cur.dot,
            boxShadow: `0 0 6px ${cur.dot}`,
          }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1 }}>数据源 · DEBUG</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginTop: 2 }}>{cur.label}</div>
          </div>
          <span style={{ fontSize: 10, color: T.muted }}>▾</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 30,
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200,
            overflow: 'hidden',
          }}>
            {['real', 'synth', 'flat'].map(k => {
              const opt = labels[k];
              const active = src === k;
              const disabled = k === 'real' && !realLoaded;
              return (
                <button key={k} onClick={() => !disabled && choose(k)} disabled={disabled} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  appearance: 'none', border: 'none',
                  background: active ? T.accentSoft : '#fff',
                  padding: '10px 12px',
                  cursor: disabled ? 'default' : 'pointer',
                  borderBottom: `1px solid ${T.line}`,
                  fontFamily: T.sans,
                  opacity: disabled ? 0.4 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: opt.dot }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{opt.label}</span>
                    {active && <span style={{ marginLeft: 'auto', color: T.accent, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontFamily: T.mono, paddingLeft: 16 }}>
                    {disabled ? '加载中…' : opt.sub}
                  </div>
                </button>
              );
            })}
            <div style={{ padding: '8px 12px', fontSize: 10, color: T.muted, fontFamily: T.mono, background: T.bg }}>
              {realLoaded ? `已加载 ${window.__ECG.getRealSampleCount().toLocaleString()} 个样本` : '正在获取 ecg-samples.json…'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // HOME — refined, with status banner, mega HR, and clear CTA
  // ─────────────────────────────────────────────────────────────
  function Home({ sim, onAlarm, goHistory, goCommands }) {
    const ok = sim.status.electrode === 0;
    useEffect(() => {
      if (!ok) onAlarm();
    }, [ok, onAlarm]);

    return (
      <Screen>
        {/* greeting */}
        <div style={{ padding: '14px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, color: T.muted }}>下午好，王奶奶</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2, letterSpacing: -0.3 }}>
              今天的⼼跳很稳定
            </div>
          </div>
          <DataSourceBadge />
        </div>

        {/* big status banner */}
        <div style={{
          margin: '14px 14px 0', borderRadius: 22,
          background: ok ? T.accent : T.warn, color: '#fff', padding: '20px 22px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>设备状态</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, letterSpacing: -0.3 }}>
              {ok ? '⼀切正常' : '需要调整电极'}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
              {ok ? `已连续记录 ${formatDuration(sim.status.stored_frames/250)}` : '请按压贴⽚使其贴合⽪肤'}
            </div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 28,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: '#fff', fontWeight: 700,
          }}>{ok ? '✓' : '!'}</div>
        </div>

        {/* HR mega card */}
        <div style={{ margin: '12px 14px 0', borderRadius: 22, background: T.card, padding: '22px 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, color: T.muted }}>当前⼼率</div>
              <div style={{
                fontSize: 116, fontWeight: 700, lineHeight: 0.85,
                letterSpacing: -4, color: T.accent, marginTop: 4,
              }}>{sim.hr}</div>
            </div>
            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontSize: 17, color: T.muted }}>次/分</div>
              <div style={{ fontSize: 14, color: T.accent, marginTop: 4, fontWeight: 600 }}>正常</div>
            </div>
            <div style={{ flex: 1 }} />
            <PulseHeart color={T.accent} hr={sim.hr} />
          </div>
          <div style={{ marginTop: 6 }}>
            <EcgWaveform sim={sim} width={344} height={84} color={T.accent} gridColor="transparent" lineWidth={2.4} showGrid={false} />
          </div>
        </div>

        {/* status grid */}
        <div style={{ margin: '12px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <BigTile icon="🔋" label="设备电量" value={`${sim.status.battery}%`} hint={`${(sim.status.battery_mv/1000).toFixed(2)} V`} ok={sim.status.battery > 20} />
          <BigTile icon="📶" label="蓝⽛信号" value={sim.status.rssi > -65 ? '良好' : '⼀般'} hint={`${Math.round(sim.status.rssi)} dBm`} ok={sim.status.rssi > -75} />
        </div>

        {/* primary CTA */}
        <div style={{ padding: '14px 14px 0' }}>
          <button onClick={() => sim.send(sim.recording ? 0x03 : 0x02)} style={{
            width: '100%', appearance: 'none', border: 'none',
            background: sim.recording ? T.card : T.accent,
            color: sim.recording ? T.ink : '#fff',
            borderRadius: 18, padding: '20px 0',
            fontSize: 19, fontWeight: 700, fontFamily: T.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer',
          }}>
            <span style={{
              width: 12, height: 12, borderRadius: 6,
              background: sim.recording ? T.warn : '#fff',
              animation: sim.recording ? 'recDot 1.4s ease-in-out infinite' : undefined,
            }} />
            {sim.recording ? '正在记录 · 点击暂停' : '开始记录'}
            <style>{`@keyframes recDot { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          </button>
        </div>

        {/* shortcut row */}
        <div style={{ padding: '12px 14px 18px', display: 'flex', gap: 10 }}>
          <ShortcutButton onClick={goHistory} icon="📋" label="历史记录" />
          <ShortcutButton onClick={goCommands} icon="⚙️" label="更多操作" />
        </div>
      </Screen>
    );
  }

  function PulseHeart({ color, hr }) {
    const beatLen = 60 / hr;
    return (
      <div style={{ width: 64, height: 64, paddingBottom: 14, color }}>
        <svg viewBox="0 0 32 32" width="64" height="64" style={{ animation: `pulseHeart ${beatLen}s ease-in-out infinite` }}>
          <path d="M16 27s-9-6-9-13.5C7 9.4 9.9 7 13 7c1.8 0 3.4 1 4 2.4C17.6 8 19.2 7 21 7c3.1 0 6 2.4 6 6.5C27 21 16 27 16 27z" fill="currentColor" />
        </svg>
        <style>{`@keyframes pulseHeart {0%,55%,100%{transform:scale(1)} 18%{transform:scale(1.2)} 28%{transform:scale(0.92)} 40%{transform:scale(1.08)}}`}</style>
      </div>
    );
  }

  function BigTile({ icon, label, value, hint, ok = true }) {
    return (
      <div style={{ background: T.card, borderRadius: 18, padding: '14px 16px' }}>
        <div style={{ fontSize: 22 }}>{icon}</div>
        <div style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: ok ? T.ink : T.warn }}>{value}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{hint}</div>
      </div>
    );
  }

  function ShortcutButton({ onClick, icon, label }) {
    return (
      <button onClick={onClick} style={{
        flex: 1, appearance: 'none', border: 'none',
        background: T.card, borderRadius: 16, padding: '14px 16px',
        fontFamily: T.sans, fontSize: 16, color: T.ink, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span>{label}</span>
      </button>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // HISTORY — 7 days, big rows
  // ─────────────────────────────────────────────────────────────
  function History({ onOpen }) {
    const days = useMemo(() => {
      const today = new Date();
      return Array.from({ length: 8 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const avg = 70 + Math.round(Math.sin(i * 1.4) * 6);
        const dur = 22000 + Math.round(Math.cos(i) * 4000) + i * 200;
        return {
          id: `d${i}`,
          date: d,
          isToday: i === 0,
          isYesterday: i === 1,
          avgHr: avg,
          minHr: avg - 8,
          maxHr: avg + 14,
          duration: dur,
          flag: i === 2 ? 'warn' : i === 5 ? 'note' : null,
        };
      });
    }, []);

    return (
      <Screen>
        <NavBar title="我的记录" />
        {/* week summary */}
        <div style={{ margin: '0 14px 0', borderRadius: 22, background: T.card, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, color: T.muted }}>本周平均⼼率</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: T.accent, letterSpacing: -2, lineHeight: 1 }}>74</div>
            <div style={{ fontSize: 16, color: T.muted }}>次/分</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 13, color: T.accent, fontWeight: 600 }}>⽐上周稳定</div>
          </div>
          {/* mini bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56, marginTop: 14 }}>
            {[68,72,71,74,76,73,74].map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ height: (v - 60) * 2.4, width: '100%', background: i === 6 ? T.accent : '#dde6ec', borderRadius: 4 }} />
                <div style={{ fontSize: 11, color: T.muted }}>{['⼀','⼆','三','四','五','六','⽇'][i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 22px 6px', fontSize: 13, color: T.muted, letterSpacing: 1 }}>每⽇记录</div>
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {days.map(d => (
            <button key={d.id} onClick={() => onOpen(d)} style={{
              appearance: 'none', border: 'none', background: T.card,
              borderRadius: 18, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              textAlign: 'left', fontFamily: T.sans, cursor: 'pointer',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: d.isToday ? T.accent : T.bg,
                color: d.isToday ? '#fff' : T.ink,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{d.date.getDate()}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>{['⽇','⼀','⼆','三','四','五','六'][d.date.getDay()]}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {d.isToday ? '今天' : d.isYesterday ? '昨天' : `${d.date.getMonth()+1}⽉${d.date.getDate()}⽇`}
                  {d.flag === 'warn' && <span style={{ marginLeft: 8, fontSize: 12, color: T.warn, fontWeight: 700 }}>· 有提醒</span>}
                </div>
                <div style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>
                  平均 <span style={{ color: T.ink, fontWeight: 600 }}>{d.avgHr}</span>
                  · 最低 {d.minHr} · 最⾼ {d.maxHr}
                </div>
                <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
                  记录 {Math.floor(d.duration/3600)}⼩时{Math.floor((d.duration%3600)/60)}分钟
                </div>
              </div>
              <div style={{ fontSize: 28, color: T.muted }}>›</div>
            </button>
          ))}
        </div>
      </Screen>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // DETAIL — recording detail with HR trend + sample strip
  // ─────────────────────────────────────────────────────────────
  function Detail({ day, sim, onBack, onShare }) {
    return (
      <Screen>
        <NavBar title="记录详情" onBack={onBack} />
        <div style={{ padding: '0 22px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3 }}>
            {day.isToday ? '今天' : day.isYesterday ? '昨天' : `${day.date.getMonth()+1}⽉${day.date.getDate()}⽇`}
          </div>
          <div style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>记录时⻓ {Math.floor(day.duration/3600)}⼩时{Math.floor((day.duration%3600)/60)}分钟</div>
        </div>

        {/* Big stats */}
        <div style={{ margin: '14px 14px 0', borderRadius: 22, background: T.card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Stat3 label="平均⼼率" value={day.avgHr} unit="次/分" big />
            <Stat3 label="最低" value={day.minHr} unit="次/分" />
            <Stat3 label="最⾼" value={day.maxHr} unit="次/分" />
          </div>
        </div>

        {/* 24h HR trend */}
        <div style={{ margin: '12px 14px 0', borderRadius: 22, background: T.card, padding: '18px 20px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>全天⼼率</div>
          <HRChart day={day} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginTop: 4 }}>
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
          </div>
        </div>

        {/* sample ECG strip */}
        <div style={{ margin: '12px 14px 0', borderRadius: 22, background: T.card, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>⼼电波形 · 14:23</div>
            <div style={{ fontSize: 12, color: T.muted }}>10 秒⽚段</div>
          </div>
          <EcgWaveform sim={sim} width={336} height={120} color={T.ink} gridColor="rgba(232,154,163,0.4)" lineWidth={1.6} gridStyle="paper" />
        </div>

        {day.flag === 'warn' && (
          <div style={{ margin: '12px 14px 0', borderRadius: 18, background: T.warnSoft, padding: '14px 18px', display: 'flex', gap: 12 }}>
            <div style={{ fontSize: 22 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.warn }}>检测到 1 次⼼率偏⾼</div>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>15:42 · 短暂达到 108 次/分，持续约 2 分钟。建议告知医⽣。</div>
            </div>
          </div>
        )}

        <div style={{ padding: '18px 14px 22px', display: 'flex', gap: 10 }}>
          <BigButton variant="secondary" onClick={onBack}>返回</BigButton>
          <BigButton onClick={onShare}>分享给家⼈</BigButton>
        </div>
      </Screen>
    );
  }
  function Stat3({ label, value, unit, big }) {
    return (
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 12, color: T.muted }}>{label}</div>
        <div style={{ fontSize: big ? 36 : 24, fontWeight: 700, color: big ? T.accent : T.ink, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{unit}</div>
      </div>
    );
  }
  function HRChart({ day }) {
    const w = 320, h = 120;
    const points = useMemo(() => {
      const arr = [];
      for (let i = 0; i < 96; i++) {
        const hourFrac = i / 96 * 24;
        let v = 70 + 8 * Math.sin(hourFrac / 24 * Math.PI * 2 - 1.2);
        v += Math.sin(i * 0.7) * 3;
        if (i > 60 && i < 66) v += 30; // spike
        v += day.avgHr - 72;
        arr.push(v);
      }
      return arr;
    }, [day.avgHr]);
    const min = 50, max = 120;
    const path = points.map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        {/* normal band 60-90 */}
        <rect x="0" y={h - ((90-min)/(max-min))*h} width={w} height={((90-60)/(max-min))*h} fill={T.accentSoft} opacity="0.6" />
        <path d={path} fill="none" stroke={T.accent} strokeWidth="2" />
      </svg>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FAMILY — emergency contact + share
  // ─────────────────────────────────────────────────────────────
  function Family() {
    const [shared, setShared] = useState(false);
    return (
      <Screen>
        <NavBar title="家⼈" />
        <div style={{ padding: '0 22px' }}>
          <div style={{ fontSize: 16, color: T.inkSoft, lineHeight: 1.55 }}>
            您的家⼈可以收到⼼率提醒和每⽇报告。
          </div>
        </div>

        <div style={{ margin: '14px 14px 0', borderRadius: 22, background: T.card, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 10 }}>紧急联系⼈</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28, background: T.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700,
            }}>女</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>⼥⼉ · 王⼩明</div>
              <div style={{ fontSize: 14, color: T.muted, marginTop: 2, fontFamily: T.mono }}>138 ****  4521</div>
            </div>
            <button style={{
              appearance: 'none', border: 'none',
              background: T.accent, color: '#fff', borderRadius: 28, padding: '10px 18px',
              fontSize: 15, fontWeight: 700, fontFamily: T.sans, cursor: 'pointer',
            }}>呼叫</button>
          </div>
        </div>

        <div style={{ margin: '12px 14px 0', borderRadius: 22, background: T.card, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 10 }}>已加⼊家庭</div>
          {[
            { name: '⼥⼉ · 王⼩明', tag: '管理员' },
            { name: '⼉⼦ · 王⼤伟', tag: '可查看' },
            { name: '⽼伴 · 张爷爷', tag: '可查看' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {p.name[0]}
              </div>
              <div style={{ flex: 1, fontSize: 16 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: T.muted, background: T.bg, padding: '4px 10px', borderRadius: 12 }}>{p.tag}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '18px 14px' }}>
          <BigButton onClick={() => setShared(true)}>{shared ? '✓ 已分享今⽇报告' : '分享今⽇报告'}</BigButton>
        </div>

        <div style={{ padding: '0 22px 22px', fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
          家⼈会在以下情况收到通知：⼼率超过 110 或低于 50、电极脱落超过 5 分钟、电池低于 10%。
        </div>
      </Screen>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SETTINGS — text size, alarms, device commands
  // ─────────────────────────────────────────────────────────────
  function Settings({ sim, onCommand, textScale, setTextScale }) {
    return (
      <Screen>
        <NavBar title="设置" />
        <Section label="显⽰">
          <Row title="字号" sub="正在使⽤ 加⼤" right={
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { k: 1, l: '标准' },
                { k: 1.15, l: '加⼤' },
                { k: 1.3, l: '特⼤' },
              ].map(s => (
                <button key={s.k} onClick={() => setTextScale(s.k)} style={{
                  appearance: 'none', border: 'none',
                  background: textScale === s.k ? T.accent : T.bg,
                  color: textScale === s.k ? '#fff' : T.ink,
                  padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{s.l}</button>
              ))}
            </div>
          } />
        </Section>

        <Section label="提醒">
          <Row title="⼼率超出范围提醒" sub="高于 110 或低于 50" right={<Toggle on />} />
          <Row title="电极脱落提醒" sub="持续超过 1 分钟" right={<Toggle on />} />
          <Row title="电量提醒" sub="低于 20%" right={<Toggle on />} />
        </Section>

        <Section label="设备 · ⼼安 ECG 03">
          <Row title="设备状态" sub={`电量 ${sim.status.battery}% · 信号 ${Math.round(sim.status.rssi)} dBm`} right={
            <span style={{ fontSize: 13, color: T.accent, fontWeight: 700 }}>已连接</span>
          } />
          <Row title="同步设备时间" sub={`当前 ${formatTime(sim.status.rtc_ms)}`} right={
            <button onClick={() => onCommand(0x04)} style={cmdBtnStyle}>同步</button>
          } />
          <Row title="绑定⽤户" sub="王奶奶 · ID 8821" right={
            <button onClick={() => onCommand(0x05)} style={cmdBtnStyle}>重新绑定</button>
          } />
          <Row title="关机" sub="将断开连接并下电" right={
            <button onClick={() => onCommand(0x01)} style={{ ...cmdBtnStyle, background: T.warnSoft, color: T.danger }}>关机</button>
          } />
        </Section>

        <div style={{ padding: '24px 22px', textAlign: 'center', fontSize: 12, color: T.muted, fontFamily: T.mono }}>
          ⼼安⼼电 v1.0.0 · BLE 5d7f9e51-…
        </div>
      </Screen>
    );
  }
  const cmdBtnStyle = {
    appearance: 'none', border: 'none',
    background: T.accentSoft, color: T.accent,
    padding: '10px 14px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  };
  function Section({ label, children }) {
    return (
      <div style={{ margin: '8px 14px 0' }}>
        <div style={{ fontSize: 13, color: T.muted, padding: '14px 8px 6px', letterSpacing: 1 }}>{label}</div>
        <div style={{ background: T.card, borderRadius: 18, overflow: 'hidden' }}>{children}</div>
      </div>
    );
  }
  function Row({ title, sub, right }) {
    return (
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderTop: `1px solid ${T.line}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
    );
  }
  function Toggle({ on }) {
    return (
      <div style={{
        width: 50, height: 30, borderRadius: 15,
        background: on ? T.accent : '#cfd8de',
        position: 'relative', transition: '0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: on ? 23 : 3, width: 24, height: 24,
          borderRadius: 12, background: '#fff', transition: '0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ALARM overlay — full-screen warn with big actions
  // ─────────────────────────────────────────────────────────────
  function AlarmOverlay({ open, onClose, onCall }) {
    if (!open) return null;
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 80,
        background: T.warn, color: '#fff',
        display: 'flex', flexDirection: 'column',
        animation: 'alarmIn 240ms ease-out',
      }}>
        <style>{`@keyframes alarmIn { from { opacity:0; transform:scale(0.96)} to { opacity:1; transform:scale(1)} }
        @keyframes alarmPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0.6)} 50%{box-shadow:0 0 0 24px rgba(255,255,255,0)} }`}</style>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', textAlign: 'center' }}>
          <div style={{
            width: 120, height: 120, borderRadius: 60,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 70, animation: 'alarmPulse 1.4s ease-out infinite',
          }}>!</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 30, letterSpacing: -0.4 }}>电极脱落</div>
          <div style={{ fontSize: 18, marginTop: 12, opacity: 0.9, lineHeight: 1.55 }}>
            设备已暂停记录。<br/>请将贴⽚重新按压贴合⽪肤。
          </div>
        </div>
        <div style={{ padding: '0 18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={onClose} style={{
            width: '100%', appearance: 'none', border: 'none',
            background: '#fff', color: T.warn, borderRadius: 18, padding: '20px 0',
            fontSize: 19, fontWeight: 700, cursor: 'pointer',
          }}>我已贴好</button>
          <button onClick={onCall} style={{
            width: '100%', appearance: 'none', border: '1.5px solid rgba(255,255,255,0.5)',
            background: 'transparent', color: '#fff', borderRadius: 18, padding: '18px 0',
            fontSize: 17, fontWeight: 600, cursor: 'pointer',
          }}>呼叫家⼈帮忙</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Command sheet — large rows, friendly copy
  // ─────────────────────────────────────────────────────────────
  function ElderlyCmdSheet({ open, onClose, onSend }) {
    const items = [
      { op: 0x02, label: '开始记录', hint: '让设备开始采集⼼电', tone: 'go' },
      { op: 0x03, label: '暂停记录', hint: '保持连接但不再记录', tone: 'neutral' },
      { op: 0x04, label: '同步时间', hint: '让设备时间和⼿机⼀致', tone: 'neutral' },
      { op: 0x01, label: '关机', hint: '断开并关闭设备', tone: 'danger' },
    ];
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 60,
        pointerEvents: open ? 'auto' : 'none',
      }}>
        <div onClick={onClose} style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
          opacity: open ? 1 : 0, transition: 'opacity 200ms ease',
        }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: '#fff', borderRadius: '24px 24px 0 0',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)',
          padding: '14px 14px 22px',
          boxShadow: '0 -16px 40px rgba(0,0,0,0.18)',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line, margin: '0 auto 14px' }} />
          <div style={{ fontSize: 20, fontWeight: 700, padding: '0 8px 12px' }}>设备操作</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(it => (
              <button key={it.op} onClick={() => { onSend(it.op); onClose(); }} style={{
                appearance: 'none', border: 'none',
                background: it.tone === 'danger' ? T.warnSoft : T.bg,
                color: it.tone === 'danger' ? T.danger : T.ink,
                padding: '16px 18px', borderRadius: 16,
                textAlign: 'left', fontFamily: T.sans, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{it.label}</div>
                <div style={{ fontSize: 13, color: it.tone === 'danger' ? T.danger : T.muted, marginTop: 4, opacity: 0.85 }}>{it.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // App shell
  // ═════════════════════════════════════════════════════════════
  function ElderlyApp({ initialScreen = 'welcome' }) {
    const sim = useEcgSim();
    const [screen, setScreen] = useState(initialScreen);
    const [tab, setTab] = useState('home');
    const [openDay, setOpenDay] = useState(null);
    const [cmdSheet, setCmdSheet] = useState(false);
    const [alarm, setAlarm] = useState(false);
    const [textScale, setTextScale] = useState(1.15);

    // ensure when on settings/family tab we leave 'app' screen state intact
    const main = (() => {
      if (tab === 'home') return <Home sim={sim} onAlarm={() => setAlarm(true)} goHistory={() => setTab('history')} goCommands={() => setCmdSheet(true)} />;
      if (tab === 'history') {
        if (openDay) return <Detail day={openDay} sim={sim} onBack={() => setOpenDay(null)} onShare={() => setTab('family')} />;
        return <History onOpen={(d) => setOpenDay(d)} />;
      }
      if (tab === 'family') return <Family />;
      if (tab === 'settings') return <Settings sim={sim} onCommand={sim.send} textScale={textScale} setTextScale={setTextScale} />;
    })();

    return (
      <AndroidDevice width={412} height={892}>
        <div style={{
          height: '100%', position: 'relative', overflow: 'hidden',
          fontSize: `${textScale * 100}%`,
        }}>
          {screen === 'welcome' && <Pairing onDone={() => setScreen('app')} />}
          {screen === 'app' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{main}</div>
              <TabBar tab={tab} setTab={(t) => { setOpenDay(null); setTab(t); }} />
            </div>
          )}
          <ElderlyCmdSheet open={cmdSheet} onClose={() => setCmdSheet(false)} onSend={sim.send} />
          <AlarmOverlay open={alarm} onClose={() => setAlarm(false)} onCall={() => { setAlarm(false); setTab('family'); setScreen('app'); }} />
        </div>
      </AndroidDevice>
    );
  }

  // ── pre-built single-screen demos for the canvas tour ──────
  function ScreenDemo({ which }) {
    const sim = useEcgSim();
    const [textScale] = useState(1.15);
    const wrap = (node) => (
      <AndroidDevice width={412} height={892}>
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden', fontSize: `${textScale * 100}%`, display: 'flex', flexDirection: 'column' }}>
          {node}
          <TabBar tab={which.tab || 'home'} setTab={() => {}} />
        </div>
      </AndroidDevice>
    );
    if (which === 'welcome') return (
      <AndroidDevice width={412} height={892}>
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden', fontSize: `${textScale * 100}%` }}>
          <Pairing onDone={() => {}} />
        </div>
      </AndroidDevice>
    );
    if (which === 'home') return wrap(<Home sim={sim} onAlarm={() => {}} goHistory={() => {}} goCommands={() => {}} />);
    if (which === 'history') return wrap(<History onOpen={() => {}} />);
    if (which === 'detail') {
      const day = { id: 'today', date: new Date(), isToday: true, avgHr: 74, minHr: 62, maxHr: 108, duration: 28800, flag: 'warn' };
      return wrap(<Detail day={day} sim={sim} onBack={() => {}} onShare={() => {}} />);
    }
    if (which === 'family') return wrap(<Family />);
    if (which === 'settings') return wrap(<Settings sim={sim} onCommand={() => {}} textScale={textScale} setTextScale={() => {}} />);
    if (which === 'alarm') return (
      <AndroidDevice width={412} height={892}>
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
          <Home sim={sim} onAlarm={() => {}} goHistory={() => {}} goCommands={() => {}} />
          <TabBar tab="home" setTab={() => {}} />
          <AlarmOverlay open={true} onClose={() => {}} onCall={() => {}} />
        </div>
      </AndroidDevice>
    );
    return null;
  }

  Object.assign(window, { ElderlyApp, ElderlyScreenDemo: ScreenDemo });
})();
