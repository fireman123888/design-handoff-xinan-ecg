// variants.jsx — five different design directions for the ECG patient app
// Each exports a top-level component that renders into an AndroidDevice.

(function () {
  const { useState, useMemo, useEffect, useRef } = React;
  const { AndroidDevice, AndroidStatusBar, AndroidNavBar } = window;
  const { useEcgSim, EcgWaveform, formatTime, formatDuration, COMMANDS } = window;

  // ─────────────────────────────────────────────────────────────
  // Shared: bottom command sheet (slide-up)
  // Each variant passes its own theme tokens.
  // ─────────────────────────────────────────────────────────────
  function CommandSheet({ open, onClose, onSend, theme }) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 50,
        }}
      >
        <div
          onClick={onClose}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.36)',
            opacity: open ? 1 : 0,
            transition: 'opacity 240ms ease',
          }}
        />
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: theme.sheetBg, color: theme.sheetFg,
            borderRadius: '24px 24px 0 0',
            transform: open ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)',
            padding: '14px 18px 26px',
            boxShadow: '0 -16px 40px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: theme.sheetGrip, margin: '0 auto 14px',
          }} />
          <div style={{
            fontSize: 13, letterSpacing: 2,
            color: theme.sheetMuted, marginBottom: 14,
            fontFamily: theme.mono,
          }}>
            COMMAND PANEL · 5d7f9e61
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {COMMANDS.map((c) => (
              <button
                key={c.op}
                onClick={() => { onSend(c.op); }}
                style={{
                  appearance: 'none', border: theme.cmdBorder,
                  background: c.tone === 'danger' ? theme.dangerBg
                    : c.tone === 'go' ? theme.goBg
                    : c.tone === 'stop' ? theme.stopBg
                    : theme.cmdBg,
                  color: c.tone === 'danger' ? theme.dangerFg
                    : c.tone === 'go' ? theme.goFg
                    : c.tone === 'stop' ? theme.stopFg
                    : theme.sheetFg,
                  padding: '12px 14px',
                  borderRadius: theme.cmdRadius,
                  textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: theme.sans, fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 500 }}>{c.label}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.7, marginTop: 2 }}>{c.hint}</span>
                </span>
                <span style={{ fontFamily: theme.mono, fontSize: 12, opacity: 0.6 }}>
                  0x{c.op.toString(16).padStart(2, '0').toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Shared: packet log peek (bottom-up sheet)
  // ─────────────────────────────────────────────────────────────
  function PacketLog({ open, onClose, packets, theme }) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 60,
        }}
      >
        <div
          onClick={onClose}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            opacity: open ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, top: '20%',
          background: theme.logBg, color: theme.logFg,
          borderRadius: '20px 20px 0 0',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: theme.logDivider,
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.6, fontFamily: theme.mono }}>
                BLE FRAME LOG
              </div>
              <div style={{ fontSize: 14, marginTop: 2 }}>实时数据包预览</div>
            </div>
            <button onClick={onClose} style={{
              appearance: 'none', border: 'none', background: 'transparent',
              color: theme.logFg, fontSize: 18, cursor: 'pointer', opacity: 0.7,
            }}>×</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 14px 18px', fontFamily: theme.mono, fontSize: 11, lineHeight: 1.55 }}>
            {packets.length === 0 && (
              <div style={{ opacity: 0.4, padding: 12 }}>等待数据包…</div>
            )}
            {packets.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: theme.logRowDivider }}>
                <span style={{ opacity: 0.45, width: 60, flexShrink: 0 }}>{formatTime(p.t)}</span>
                <span style={{
                  width: 38, flexShrink: 0,
                  color: p.kind === 'ECG' ? theme.logEcg
                    : p.kind === 'CMD→' ? theme.logCmd
                    : theme.logRsp,
                }}>{p.kind}</span>
                <span style={{ opacity: 0.85, wordBreak: 'break-all' }}>{p.hex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // V1 — CLINICAL MINIMAL
  // Pure white, hairline grid, single accent (oklch teal-ish),
  // ultra-restrained type, hospital-monitor restraint.
  // ════════════════════════════════════════════════════════════
  function V1ClinicalMinimal() {
    const sim = useEcgSim();
    const [sheet, setSheet] = useState(false);
    const [log, setLog] = useState(false);
    const accent = 'oklch(0.55 0.07 200)';
    const ink = '#0c1116';
    const muted = '#6c7682';
    const hairline = '#e6e9ec';

    const theme = {
      sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      mono: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
      sheetBg: '#ffffff', sheetFg: ink, sheetGrip: hairline, sheetMuted: muted,
      cmdBg: '#f6f7f8', cmdBorder: `1px solid ${hairline}`, cmdRadius: 8,
      dangerBg: '#fff', dangerFg: '#b1242b',
      goBg: accent, goFg: '#fff',
      stopBg: '#f6f7f8', stopFg: ink,
      logBg: '#0c1116', logFg: '#e6e9ec',
      logDivider: '1px solid rgba(255,255,255,0.08)',
      logRowDivider: '1px solid rgba(255,255,255,0.04)',
      logEcg: '#79e0c1', logCmd: '#ffd479', logRsp: '#a3c8ff',
    };

    const elec = sim.status.electrode;
    const elecLabel = elec === 0 ? '正常' : elec === 1 ? '左极脱落' : '右极脱落';

    return (
      <AndroidDevice width={412} height={892}>
        <div style={{
          height: '100%', position: 'relative', overflow: 'hidden',
          background: '#ffffff', color: ink,
          fontFamily: theme.sans, display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: '8px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: muted }}>ECG · LEAD I</div>
              <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4, letterSpacing: -0.4 }}>实时监测</div>
            </div>
            <div style={{ fontFamily: theme.mono, fontSize: 11, color: muted, textAlign: 'right' }}>
              <div>{formatTime(sim.status.rtc_ms)}</div>
              <div style={{ marginTop: 2 }}>{formatDuration(sim.status.stored_frames / 250)}</div>
            </div>
          </div>

          {/* HR + waveform card */}
          <div style={{ padding: '20px 22px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{
                fontFamily: theme.sans, fontSize: 88, fontWeight: 200, lineHeight: 0.9,
                letterSpacing: -3, color: ink,
              }}>{sim.hr}</div>
              <div style={{ paddingBottom: 14 }}>
                <div style={{ fontSize: 12, color: muted, letterSpacing: 1 }}>BPM</div>
                <div style={{ fontSize: 11, color: accent, marginTop: 4, fontFamily: theme.mono }}>
                  ▲ {Math.round(sim.hr * 0.014)}  ▼ {Math.round(sim.hr * 0.010)}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <PulseDot color={accent} />
            </div>

            <div style={{
              marginTop: 14, border: `1px solid ${hairline}`, borderRadius: 4,
              padding: '8px 4px', background: '#fbfcfc',
            }}>
              <EcgWaveform sim={sim} width={356} height={150}
                color={ink} gridColor="rgba(12,17,22,0.06)"
                lineWidth={1.4} />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: theme.mono, fontSize: 10, color: muted,
                padding: '0 8px',
              }}>
                <span>25 mm/s</span><span>10 mm/mV</span><span>500 Hz</span>
              </div>
            </div>
          </div>

          {/* metric grid */}
          <div style={{ padding: '20px 22px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: hairline, border: `1px solid ${hairline}` }}>
            <Cell label="电池" value={`${sim.status.battery}%`} unit={`${(sim.status.battery_mv/1000).toFixed(2)} V`} ink={ink} muted={muted} />
            <Cell label="信号" value={`${Math.round(sim.status.rssi)}`} unit="dBm" ink={ink} muted={muted} />
            <Cell label="电极" value={elecLabel} unit={`code ${elec}`} ink={elec===0?ink:'#b1242b'} muted={muted} />
            <Cell label="速率" value={`${(sim.status.tx_rate/1024).toFixed(1)}`} unit="KB/s" ink={ink} muted={muted} />
          </div>

          {/* log row */}
          <div style={{ padding: '14px 22px 0', flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: muted, marginBottom: 6 }}>事件流</div>
            <div style={{ fontFamily: theme.mono, fontSize: 11, lineHeight: 1.7 }}>
              {sim.events.slice(0, 5).map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, color: i === 0 ? ink : muted }}>
                  <span style={{ width: 50, opacity: 0.55 }}>{formatTime(e.t)}</span>
                  <span style={{
                    width: 6, height: 6, borderRadius: 3, marginTop: 6,
                    background: e.kind === 'warn' ? '#b1242b' : e.kind === 'cmd' ? accent : muted,
                  }} />
                  <span>{e.text}</span>
                </div>
              ))}
              {sim.events.length === 0 && <div style={{ opacity: 0.5 }}>— 无事件 —</div>}
            </div>
          </div>

          {/* Footer toolbar */}
          <div style={{
            display: 'flex', borderTop: `1px solid ${hairline}`,
            background: '#fff',
          }}>
            <FooterBtn ink={ink} muted={muted} onClick={() => setLog(true)}>数据包</FooterBtn>
            <FooterBtn ink={ink} muted={muted} primary accent={accent} onClick={() => setSheet(true)}>命令</FooterBtn>
            <FooterBtn ink={ink} muted={muted} onClick={() => sim.send(sim.recording ? 0x03 : 0x02)}>
              {sim.recording ? '暂停' : '开始'}
            </FooterBtn>
          </div>

          <CommandSheet open={sheet} onClose={() => setSheet(false)} onSend={(op) => { sim.send(op); setSheet(false); }} theme={theme} />
          <PacketLog open={log} onClose={() => setLog(false)} packets={sim.packets} theme={theme} />
        </div>
      </AndroidDevice>
    );
  }

  function Cell({ label, value, unit, ink, muted }) {
    return (
      <div style={{ background: '#fff', padding: '12px 14px' }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: muted }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 22, fontWeight: 400, marginTop: 4, color: ink, letterSpacing: -0.5 }}>{value}</div>
        <div style={{ fontSize: 11, color: muted, marginTop: 2, fontFamily: '"SF Mono", monospace' }}>{unit}</div>
      </div>
    );
  }

  function FooterBtn({ children, onClick, primary, accent, ink, muted }) {
    return (
      <button onClick={onClick} style={{
        flex: 1, padding: '14px 0', appearance: 'none', border: 'none',
        background: primary ? accent : 'transparent',
        color: primary ? '#fff' : ink,
        fontSize: 14, letterSpacing: 1, fontWeight: primary ? 500 : 400,
        cursor: 'pointer',
      }}>{children}</button>
    );
  }

  function PulseDot({ color, size = 10 }) {
    return (
      <div style={{ position: 'relative', width: size * 2.4, height: size * 2.4, paddingBottom: 14 }}>
        <span style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%,-50%)',
          width: size, height: size, borderRadius: size,
          background: color,
          boxShadow: `0 0 0 6px ${color}22`,
          animation: 'pulseRing 1.2s ease-out infinite',
        }} />
        <style>{`@keyframes pulseRing { 0%{box-shadow:0 0 0 0 ${color}55;} 100%{box-shadow:0 0 0 14px ${color}00;} }`}</style>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // V2 — CALM WELLNESS
  // Soft warm off-white, generous whitespace, rounded cards,
  // friendly conversational copy, pastel single accent.
  // ════════════════════════════════════════════════════════════
  function V2CalmWellness() {
    const sim = useEcgSim();
    const [sheet, setSheet] = useState(false);
    const [log, setLog] = useState(false);
    const bg = '#f3efe9';
    const card = '#faf7f2';
    const ink = '#2a2622';
    const muted = '#857d72';
    const accent = 'oklch(0.65 0.09 25)'; // warm coral
    const accent2 = 'oklch(0.78 0.08 145)'; // soft sage

    const theme = {
      sans: 'ui-rounded, "SF Pro Rounded", "Hiragino Sans GB", system-ui, sans-serif',
      mono: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
      sheetBg: card, sheetFg: ink, sheetGrip: '#ddd6cb', sheetMuted: muted,
      cmdBg: '#fff', cmdBorder: '1px solid #e6dfd2', cmdRadius: 16,
      dangerBg: '#fff5f4', dangerFg: '#a73c33',
      goBg: accent, goFg: '#fff',
      stopBg: '#fff', stopFg: ink,
      logBg: '#23211e', logFg: '#f0ebe1',
      logDivider: '1px solid rgba(255,255,255,0.08)',
      logRowDivider: '1px solid rgba(255,255,255,0.04)',
      logEcg: '#a4d4a8', logCmd: '#f3c886', logRsp: '#bcd0e8',
    };

    const elec = sim.status.electrode;

    return (
      <AndroidDevice width={412} height={892}>
        <div style={{
          height: '100%', position: 'relative', overflow: 'hidden',
          background: bg, color: ink, fontFamily: theme.sans,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Greeting */}
          <div style={{ padding: '10px 22px 0' }}>
            <div style={{ fontSize: 14, color: muted }}>下午好，</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.3, marginTop: 2 }}>
              ⼼跳很平稳 · 继续保持
            </div>
          </div>

          {/* Hero card */}
          <div style={{ margin: '16px 18px 0', background: card, borderRadius: 24, padding: '20px 22px', boxShadow: '0 2px 0 rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: muted, letterSpacing: 1 }}>当前⼼率</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1, color: accent, letterSpacing: -2 }}>{sim.hr}</div>
                  <div style={{ fontSize: 14, color: muted }}>次 / 分钟</div>
                </div>
                <div style={{ fontSize: 12, color: muted, marginTop: 8 }}>
                  ⽐过去 1 ⼩时平均 <span style={{ color: ink, fontWeight: 600 }}>+{Math.max(1, Math.round(sim.hr*0.04-2))}</span>
                </div>
              </div>
              <Heart accent={accent} hr={sim.hr} />
            </div>
            <div style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden', background: '#fdfbf7', border: '1px solid #ece5d6' }}>
              <EcgWaveform sim={sim} width={336} height={120} color={accent} gridColor="rgba(133,125,114,0.10)" lineWidth={1.8} />
            </div>
          </div>

          {/* Three pill metrics */}
          <div style={{ padding: '16px 18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Pill label="电极" value={elec === 0 ? '贴合' : '调整'} accent={elec === 0 ? accent2 : accent} card={card} muted={muted} />
            <Pill label="电量" value={`${sim.status.battery}%`} accent={accent2} card={card} muted={muted} />
            <Pill label="信号" value={`${Math.round(sim.status.rssi)}`} accent={accent2} card={card} muted={muted} />
          </div>

          {/* Today summary card */}
          <div style={{ margin: '14px 18px 0', background: card, borderRadius: 20, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>今⽇记录</div>
              <div style={{ fontSize: 12, color: muted }}>{formatDuration(sim.status.stored_frames / 250)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56, marginTop: 10 }}>
              {Array.from({ length: 24 }).map((_, i) => {
                const h = 14 + Math.abs(Math.sin(i * 0.7 + sim.tick * 0.0003)) * 38;
                return <div key={i} style={{ flex: 1, height: h, background: i === 23 ? accent : '#e8e1d3', borderRadius: 3 }} />;
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: muted, marginTop: 6 }}>
              <span>00</span><span>06</span><span>12</span><span>18</span><span>现在</span>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Footer */}
          <div style={{ padding: '0 18px 14px', display: 'flex', gap: 10 }}>
            <button onClick={() => setLog(true)} style={{
              flex: 1, appearance: 'none', border: '1px solid #e6dfd2', background: card,
              borderRadius: 18, padding: '14px 0', fontFamily: theme.sans, fontSize: 14, color: ink,
              cursor: 'pointer',
            }}>数据包</button>
            <button onClick={() => setSheet(true)} style={{
              flex: 2, appearance: 'none', border: 'none', background: accent, color: '#fff',
              borderRadius: 18, padding: '14px 0', fontFamily: theme.sans, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}>{sim.recording ? '正在记录 · 命令' : '开始记录'}</button>
          </div>

          <CommandSheet open={sheet} onClose={() => setSheet(false)} onSend={(op) => { sim.send(op); setSheet(false); }} theme={theme} />
          <PacketLog open={log} onClose={() => setLog(false)} packets={sim.packets} theme={theme} />
        </div>
      </AndroidDevice>
    );
  }

  function Pill({ label, value, accent, card, muted }) {
    return (
      <div style={{ background: card, borderRadius: 14, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: muted }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: accent }}>{value}</div>
      </div>
    );
  }

  function Heart({ accent, hr }) {
    const beatLen = 60 / hr;
    return (
      <div style={{ width: 56, height: 56, position: 'relative' }}>
        <svg viewBox="0 0 32 32" width="56" height="56" style={{
          animation: `heartBeat ${beatLen}s ease-in-out infinite`,
          color: accent,
        }}>
          <path d="M16 27s-9-6-9-13.5C7 9.4 9.9 7 13 7c1.8 0 3.4 1 4 2.4C17.6 8 19.2 7 21 7c3.1 0 6 2.4 6 6.5C27 21 16 27 16 27z" fill="currentColor" />
        </svg>
        <style>{`@keyframes heartBeat {0%,55%,100%{transform:scale(1)} 18%{transform:scale(1.15)} 28%{transform:scale(0.94)} 40%{transform:scale(1.05)}}`}</style>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // V3 — DARK MONITOR
  // Black background, phosphor-green trace, dense readouts.
  // Reads like an ICU bedside monitor at home.
  // ════════════════════════════════════════════════════════════
  function V3DarkMonitor() {
    const sim = useEcgSim();
    const [sheet, setSheet] = useState(false);
    const [log, setLog] = useState(false);
    const bg = '#05080a';
    const card = '#0c1216';
    const trace = '#3df5b3';
    const amber = '#f5b73d';
    const ink = '#e8edee';
    const muted = '#5f6e74';

    const theme = {
      sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
      sheetBg: '#0c1216', sheetFg: ink, sheetGrip: '#2a373d', sheetMuted: muted,
      cmdBg: '#121a1f', cmdBorder: '1px solid #1c272d', cmdRadius: 4,
      dangerBg: '#1f0c0d', dangerFg: '#ff6b6b',
      goBg: trace, goFg: '#05080a',
      stopBg: '#121a1f', stopFg: ink,
      logBg: '#000', logFg: trace,
      logDivider: '1px solid #1c272d',
      logRowDivider: '1px solid #0d141a',
      logEcg: trace, logCmd: amber, logRsp: '#74b8ff',
    };

    const elec = sim.status.electrode;
    const elecLabel = elec === 0 ? 'CONNECTED' : elec === 1 ? 'L-OFF' : 'R-OFF';

    return (
      <AndroidDevice width={412} height={892} dark>
        <div style={{
          height: '100%', position: 'relative', overflow: 'hidden',
          background: bg, color: ink, fontFamily: theme.mono,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Top bar */}
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1c272d' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: trace, boxShadow: `0 0 8px ${trace}` }} />
              <span style={{ fontSize: 11, color: muted, letterSpacing: 1.5 }}>ECG MON · LEAD I</span>
            </div>
            <div style={{ fontSize: 11, color: muted, fontFamily: theme.mono }}>
              {formatTime(sim.status.rtc_ms)}
            </div>
          </div>

          {/* HR mega readout */}
          <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: muted, letterSpacing: 2 }}>HR · BPM</div>
              <div style={{
                fontFamily: theme.mono, fontSize: 84, lineHeight: 0.9, color: trace,
                fontWeight: 700, letterSpacing: -2,
                textShadow: `0 0 14px ${trace}66`,
              }}>{String(sim.hr).padStart(3, '0')}</div>
            </div>
            <div style={{ flex: 1 }}>
              <Stat label="STORED" value={(sim.status.stored_frames).toString()} muted={muted} ink={trace} mono={theme.mono} />
              <Stat label="DURATION" value={formatDuration(sim.status.stored_frames / 250)} muted={muted} ink={ink} mono={theme.mono} />
              <Stat label="RTC SYNC" value="OK" muted={muted} ink={trace} mono={theme.mono} />
              <Stat label="GAIN" value={`x${sim.status.gain_id}`} muted={muted} ink={ink} mono={theme.mono} />
            </div>
          </div>

          {/* Trace */}
          <div style={{ background: '#000', margin: '4px 16px 0', borderRadius: 2, border: `1px solid #142025` }}>
            <EcgWaveform sim={sim} width={344} height={170}
              color={trace} gridColor="rgba(61,245,179,0.07)"
              lineWidth={1.6} bg="#000" glow />
          </div>

          {/* Bar of vitals */}
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Tile color={amber} bg={card} mono={theme.mono} muted={muted}
              label="LEAD" value={elecLabel} alarm={elec !== 0} />
            <Tile color={trace} bg={card} mono={theme.mono} muted={muted}
              label="BATT" value={`${sim.status.battery}%`} sub={`${sim.status.battery_mv} mV`} />
            <Tile color="#74b8ff" bg={card} mono={theme.mono} muted={muted}
              label="RSSI" value={`${Math.round(sim.status.rssi)} dBm`} />
            <Tile color="#74b8ff" bg={card} mono={theme.mono} muted={muted}
              label="TX" value={`${Math.round(sim.status.tx_rate)} B/s`} />
          </div>

          <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px' }}>
            <div style={{ fontSize: 10, color: muted, letterSpacing: 2 }}>EVENT LOG</div>
            <div style={{ fontFamily: theme.mono, fontSize: 11, lineHeight: 1.7, marginTop: 4 }}>
              {sim.events.slice(0, 4).map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: muted, width: 50 }}>{formatTime(e.t).slice(3)}</span>
                  <span style={{ color: e.kind === 'warn' ? amber : e.kind === 'cmd' ? '#74b8ff' : trace }}>
                    {e.kind === 'warn' ? '!' : e.kind === 'cmd' ? '→' : e.kind === 'rsp' ? '✓' : '·'}
                  </span>
                  <span style={{ color: ink, opacity: 0.85 }}>{e.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid #1c272d' }}>
            <DarkBtn onClick={() => setLog(true)}>FRAMES</DarkBtn>
            <DarkBtn onClick={() => setSheet(true)} accent={trace}>CMD</DarkBtn>
            <DarkBtn onClick={() => sim.send(sim.recording ? 0x03 : 0x02)}>
              {sim.recording ? 'STOP' : 'START'}
            </DarkBtn>
          </div>

          <CommandSheet open={sheet} onClose={() => setSheet(false)} onSend={(op) => { sim.send(op); setSheet(false); }} theme={theme} />
          <PacketLog open={log} onClose={() => setLog(false)} packets={sim.packets} theme={theme} />
        </div>
      </AndroidDevice>
    );
  }

  function Stat({ label, value, muted, ink, mono }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #1c272d', padding: '4px 0', fontFamily: mono, fontSize: 12 }}>
        <span style={{ color: muted, letterSpacing: 1 }}>{label}</span>
        <span style={{ color: ink }}>{value}</span>
      </div>
    );
  }
  function Tile({ label, value, sub, color, bg, mono, muted, alarm }) {
    return (
      <div style={{
        background: bg, padding: '8px 12px', borderRadius: 2,
        borderLeft: `3px solid ${color}`,
        animation: alarm ? 'tileAlarm 1s ease-in-out infinite' : undefined,
      }}>
        <div style={{ fontSize: 10, color: muted, letterSpacing: 1.5 }}>{label}</div>
        <div style={{ fontSize: 18, color, fontFamily: mono, fontWeight: 700, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{sub}</div>}
        <style>{`@keyframes tileAlarm {0%,100%{background:${bg}} 50%{background:#2a1004}}`}</style>
      </div>
    );
  }
  function DarkBtn({ children, onClick, accent }) {
    return (
      <button onClick={onClick} style={{
        flex: 1, padding: '12px 0', appearance: 'none', border: 'none',
        background: accent || 'transparent',
        color: accent ? '#05080a' : '#e8edee',
        fontSize: 12, letterSpacing: 2, fontWeight: 700,
        fontFamily: '"JetBrains Mono", monospace',
        cursor: 'pointer',
      }}>{children}</button>
    );
  }

  // ════════════════════════════════════════════════════════════
  // V4 — PAPER CHART
  // Cream background, faint pink ECG graph paper, monospace data,
  // echoes a printed ECG strip.
  // ════════════════════════════════════════════════════════════
  function V4PaperChart() {
    const sim = useEcgSim();
    const [sheet, setSheet] = useState(false);
    const [log, setLog] = useState(false);
    const cream = '#f6f0e1';
    const ink = '#1f1a13';
    const muted = '#7a6e58';
    const pink = '#e89aa3';
    const accent = 'oklch(0.4 0.16 25)'; // deep red

    const theme = {
      sans: '"Iowan Old Style", "Songti SC", Georgia, serif',
      mono: '"Courier New", "JetBrains Mono", monospace',
      sheetBg: cream, sheetFg: ink, sheetGrip: '#cdbfa3', sheetMuted: muted,
      cmdBg: '#fdf9ee', cmdBorder: '1px solid #d6c8a8', cmdRadius: 0,
      dangerBg: '#fdf9ee', dangerFg: accent,
      goBg: accent, goFg: cream,
      stopBg: '#fdf9ee', stopFg: ink,
      logBg: '#1f1a13', logFg: cream,
      logDivider: '1px solid rgba(246,240,225,0.1)',
      logRowDivider: '1px solid rgba(246,240,225,0.05)',
      logEcg: '#e89aa3', logCmd: '#e3c46d', logRsp: '#9bbce8',
    };

    return (
      <AndroidDevice width={412} height={892}>
        <div style={{
          height: '100%', position: 'relative', overflow: 'hidden',
          background: cream, color: ink, fontFamily: theme.sans,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Letterhead */}
          <div style={{ padding: '12px 22px 0', borderBottom: `1px solid ${pink}55`, paddingBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 22, letterSpacing: -0.5 }}>⼼电图记录</div>
              <div style={{ fontFamily: theme.mono, fontSize: 11, color: muted }}>NO. {String(Math.floor(sim.status.stored_frames/100)).padStart(5,'0')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted, marginTop: 6, fontFamily: theme.mono }}>
              <span>{new Date(sim.status.rtc_ms).toLocaleDateString('zh-CN')}</span>
              <span>LEAD I · 25mm/s · 10mm/mV</span>
              <span>{formatTime(sim.status.rtc_ms)}</span>
            </div>
          </div>

          {/* HR strip + waveform */}
          <div style={{ padding: '14px 22px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: muted, fontFamily: theme.mono, letterSpacing: 1 }}>HEART RATE</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <div style={{ fontFamily: theme.mono, fontSize: 56, lineHeight: 1, color: accent, fontWeight: 700 }}>{sim.hr}</div>
                  <div style={{ fontFamily: theme.mono, fontSize: 12, color: muted }}>BPM</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: theme.mono, fontSize: 11, color: muted }}>
                <div>RR ≈ {(60000/sim.hr).toFixed(0)} ms</div>
                <div>QRS ≈ 0.08 s</div>
                <div>QT ≈ {(0.4 - sim.hr*0.001).toFixed(2)} s</div>
              </div>
            </div>
          </div>

          {/* paper trace */}
          <div style={{ margin: '10px 14px 0', background: '#fdfbf0', border: `1px solid ${pink}88`, padding: 6, position: 'relative' }}>
            <EcgWaveform sim={sim} width={356} height={170}
              color={ink} gridColor={`rgba(232,154,163,0.55)`}
              lineWidth={1.6} gridStyle="paper" />
            {/* tick marks */}
            <div style={{ position: 'absolute', left: 6, bottom: 6, fontFamily: theme.mono, fontSize: 9, color: muted, opacity: 0.7 }}>
              t = {(sim.status.stored_frames/250).toFixed(2)}s
            </div>
          </div>

          {/* clinical stats list */}
          <div style={{ padding: '14px 22px 0', fontFamily: theme.mono, fontSize: 12 }}>
            <Row k="电极接触" v={sim.status.electrode === 0 ? '正常 (OK)' : sim.status.electrode === 1 ? '左电极脱落 ⚠' : '右电极脱落 ⚠'} ink={ink} muted={muted} alert={sim.status.electrode!==0} />
            <Row k="ADC 增益" v={`gain_id = ${sim.status.gain_id}`} ink={ink} muted={muted} />
            <Row k="电池" v={`${sim.status.battery}% · ${sim.status.battery_mv} mV`} ink={ink} muted={muted} />
            <Row k="蓝牙信号" v={`${Math.round(sim.status.rssi)} dBm`} ink={ink} muted={muted} />
            <Row k="发送速率" v={`${Math.round(sim.status.tx_rate)} B/s`} ink={ink} muted={muted} />
            <Row k="已存储帧" v={`${sim.status.stored_frames.toLocaleString()}`} ink={ink} muted={muted} />
          </div>

          <div style={{ flex: 1 }} />

          {/* signature row */}
          <div style={{ padding: '10px 22px 6px', display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 11, color: muted, borderTop: `1px solid ${pink}55` }}>
            <span>记录 · {formatDuration(sim.status.stored_frames/250)}</span>
            <span style={{ fontStyle: 'italic' }}>— 自动记录中</span>
          </div>

          <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${pink}55` }}>
            <PaperBtn onClick={() => setLog(true)} muted={muted} ink={ink}>FRAMES</PaperBtn>
            <PaperBtn onClick={() => setSheet(true)} accent={accent} ink={cream}>COMMAND ▸</PaperBtn>
            <PaperBtn onClick={() => sim.send(sim.recording ? 0x03 : 0x02)} muted={muted} ink={ink}>
              {sim.recording ? 'STOP' : 'START'}
            </PaperBtn>
          </div>

          <CommandSheet open={sheet} onClose={() => setSheet(false)} onSend={(op) => { sim.send(op); setSheet(false); }} theme={theme} />
          <PacketLog open={log} onClose={() => setLog(false)} packets={sim.packets} theme={theme} />
        </div>
      </AndroidDevice>
    );
  }
  function Row({ k, v, ink, muted, alert }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #cdbfa3', padding: '4px 0' }}>
        <span style={{ color: muted }}>{k}</span>
        <span style={{ color: alert ? '#a73c33' : ink }}>{v}</span>
      </div>
    );
  }
  function PaperBtn({ children, onClick, ink, muted, accent }) {
    return (
      <button onClick={onClick} style={{
        flex: 1, padding: '14px 0', appearance: 'none', border: 'none',
        background: accent || 'transparent',
        color: accent ? ink : (muted || ink),
        fontFamily: '"Courier New", monospace',
        fontSize: 12, letterSpacing: 2, fontWeight: 700,
        cursor: 'pointer',
        borderRight: '1px solid #cdbfa3',
      }}>{children}</button>
    );
  }

  // ════════════════════════════════════════════════════════════
  // V5 — STATUS-FIRST (large HR for elderly users)
  // Big single number, waveform secondary, glanceable, friendly.
  // ════════════════════════════════════════════════════════════
  function V5StatusFirst() {
    const sim = useEcgSim();
    const [sheet, setSheet] = useState(false);
    const [log, setLog] = useState(false);
    const bg = '#f5f7f9';
    const ink = '#15212e';
    const muted = '#6a7a8c';
    const accent = 'oklch(0.55 0.13 165)'; // calm green-teal
    const warn = 'oklch(0.6 0.16 35)';
    const card = '#ffffff';

    const theme = {
      sans: '"Helvetica Neue", "PingFang SC", system-ui, sans-serif',
      mono: '"SF Mono", monospace',
      sheetBg: card, sheetFg: ink, sheetGrip: '#dde5ec', sheetMuted: muted,
      cmdBg: '#f5f7f9', cmdBorder: '1px solid #e3eaf0', cmdRadius: 14,
      dangerBg: '#fef2f2', dangerFg: '#b1242b',
      goBg: accent, goFg: '#fff',
      stopBg: '#f5f7f9', stopFg: ink,
      logBg: '#15212e', logFg: '#e3eaf0',
      logDivider: '1px solid rgba(255,255,255,0.08)',
      logRowDivider: '1px solid rgba(255,255,255,0.04)',
      logEcg: '#80e0c1', logCmd: '#ffd479', logRsp: '#a3c8ff',
    };

    const ok = sim.status.electrode === 0;

    return (
      <AndroidDevice width={412} height={892}>
        <div style={{
          height: '100%', position: 'relative', overflow: 'hidden',
          background: bg, color: ink, fontFamily: theme.sans,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Big status banner */}
          <div style={{
            margin: '14px 14px 0', borderRadius: 22,
            background: ok ? accent : warn, color: '#fff', padding: '20px 22px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 14, opacity: 0.85 }}>当前状态</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: -0.3 }}>
                {ok ? '⼀切正常' : '需要调整电极'}
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                {ok ? '设备正在记录您的⼼跳' : '请将贴⽚重新按压贴合⽪肤'}
              </div>
            </div>
            <BigCheck color="#fff" ok={ok} />
          </div>

          {/* HR mega */}
          <div style={{ margin: '14px 14px 0', borderRadius: 22, background: card, padding: '24px 22px' }}>
            <div style={{ fontSize: 14, color: muted }}>⼼率</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{
                fontFamily: theme.sans, fontSize: 132, fontWeight: 700, lineHeight: 0.85,
                letterSpacing: -5, color: accent,
              }}>{sim.hr}</div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 18, color: muted }}>次 / 分</div>
                <div style={{ fontSize: 13, color: accent, marginTop: 4 }}>正常范围</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <EcgWaveform sim={sim} width={344} height={84} color={accent} gridColor="transparent" lineWidth={2.2} showGrid={false} />
            </div>
          </div>

          {/* Two big tiles */}
          <div style={{ margin: '12px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <BigTile icon="🔋" label="电池" value={`${sim.status.battery}%`} hint={`${(sim.status.battery_mv/1000).toFixed(2)} V`} card={card} ink={ink} muted={muted} accent={accent} warn={warn} alarm={sim.status.battery < 20} />
            <BigTile icon="📶" label="信号" value={sim.status.rssi > -65 ? '良好' : '⼀般'} hint={`${Math.round(sim.status.rssi)} dBm`} card={card} ink={ink} muted={muted} accent={accent} />
          </div>

          {/* Single-line summary */}
          <div style={{ margin: '12px 14px 0', borderRadius: 14, background: card, padding: '14px 18px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: muted, fontSize: 14 }}>已记录</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{formatDuration(sim.status.stored_frames/250)}</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Big buttons */}
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => sim.send(sim.recording ? 0x03 : 0x02)} style={{
              width: '100%', appearance: 'none', border: 'none', borderRadius: 16,
              background: sim.recording ? '#fff' : accent, color: sim.recording ? ink : '#fff',
              padding: '18px 0', fontSize: 18, fontWeight: 700, fontFamily: theme.sans,
              boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
              cursor: 'pointer',
            }}>{sim.recording ? '暂停记录' : '开始记录'}</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSheet(true)} style={{
                flex: 1, appearance: 'none', border: 'none', borderRadius: 14,
                background: '#fff', color: ink, padding: '14px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>更多操作</button>
              <button onClick={() => setLog(true)} style={{
                flex: 1, appearance: 'none', border: 'none', borderRadius: 14,
                background: '#fff', color: muted, padding: '14px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>数据包</button>
            </div>
          </div>

          <CommandSheet open={sheet} onClose={() => setSheet(false)} onSend={(op) => { sim.send(op); setSheet(false); }} theme={theme} />
          <PacketLog open={log} onClose={() => setLog(false)} packets={sim.packets} theme={theme} />
        </div>
      </AndroidDevice>
    );
  }
  function BigTile({ icon, label, value, hint, card, ink, muted, accent, warn, alarm }) {
    return (
      <div style={{ background: card, borderRadius: 18, padding: '16px 18px' }}>
        <div style={{ fontSize: 22 }}>{icon}</div>
        <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: alarm ? warn : ink, marginTop: 2 }}>{value}</div>
        <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{hint}</div>
      </div>
    );
  }
  function BigCheck({ ok }) {
    return (
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, color: '#fff',
      }}>{ok ? '✓' : '!'}</div>
    );
  }

  Object.assign(window, {
    V1ClinicalMinimal, V2CalmWellness, V3DarkMonitor, V4PaperChart, V5StatusFirst,
  });
})();
