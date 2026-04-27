// ecg-engine.jsx — shared ECG simulation + command sheet + packet log
// Provides: useEcgSim() hook, CommandSheet component, PacketLog component,
// and small helpers (formatTime, padNum, etc.)

(function () {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ─────────────────────────────────────────────────────────────
  // Real ECG samples loader — fetches uploaded waveform data
  // and exposes a global sampleAt(idx) once loaded.
  // ─────────────────────────────────────────────────────────────
  let REAL_SAMPLES = null;
  let REAL_SR = 545; // estimated from data: 60k samples / 132 beats ≈ 454 samples/beat at ~72bpm
  let REAL_LOADED = false;
  // Data source: 'real' | 'synth' | 'flat'
  // Defaults to 'real' but falls back to 'synth' if real samples haven't loaded yet.
  if (typeof window.__ECG_SOURCE === 'undefined') window.__ECG_SOURCE = 'real';
  fetch('ecg-samples.json').then(r => r.json()).then(arr => {
    // normalize so R-peak ~ 1.0 for our renderer scale
    const peak = arr.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    if (peak > 0) {
      const norm = 1.0 / peak;
      REAL_SAMPLES = arr.map(v => v * norm);
    } else {
      REAL_SAMPLES = arr;
    }
    REAL_LOADED = true;
    window.dispatchEvent(new Event('ecg-source-ready'));
  }).catch(() => {});

  // Expose helpers for the debug switcher UI
  window.__ECG = {
    setSource(s) {
      window.__ECG_SOURCE = s;
      window.dispatchEvent(new Event('ecg-source-changed'));
    },
    getSource() { return window.__ECG_SOURCE; },
    isRealLoaded() { return REAL_LOADED; },
    getRealSampleCount() { return REAL_SAMPLES ? REAL_SAMPLES.length : 0; },
  };

  // ─────────────────────────────────────────────────────────────
  // ECG waveform generator — synthesizes a clean PQRST cycle
  // sampleRate ~250 Hz, beats/min from heartRate
  // Returns a function ecgAt(t_seconds) -> mV (range ~ -0.4 .. +1.2)
  // ─────────────────────────────────────────────────────────────
  function ecgAt(t, hr = 72) {
    const beatLen = 60 / hr; // seconds per beat
    let phase = (t % beatLen) / beatLen; // 0..1
    if (phase < 0) phase += 1;

    // P wave at ~0.12, QRS at ~0.30, T at ~0.55
    const gauss = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

    let v = 0;
    v += 0.12 * gauss(phase, 0.13, 0.025);    // P
    v += -0.10 * gauss(phase, 0.27, 0.012);   // Q
    v += 1.10 * gauss(phase, 0.30, 0.013);    // R
    v += -0.22 * gauss(phase, 0.34, 0.018);   // S
    v += 0.28 * gauss(phase, 0.55, 0.045);    // T

    // tiny baseline wander
    v += 0.012 * Math.sin(t * 0.7);
    return v;
  }

  // ─────────────────────────────────────────────────────────────
  // useEcgSim — simulates a streaming ECG + status + IMU
  // Consumers read .samples (rolling buffer), .hr, .status, .events
  // and call .send(cmd) to dispatch a command (gets a fake response).
  // ─────────────────────────────────────────────────────────────
  function useEcgSim({ sampleRate = 250, windowSec = 6, running = true, baseHr = 72 } = {}) {
    const bufLen = sampleRate * windowSec;
    const bufRef = useRef(new Float32Array(bufLen));
    const writeRef = useRef(0);
    const tRef = useRef(0);
    const seqRef = useRef(0);

    const [tick, setTick] = useState(0);
    const [hr, setHr] = useState(baseHr);
    const [status, setStatus] = useState({
      battery: 86,
      battery_mv: 3940,
      rssi: -54,
      tx_rate: 12480,
      stored_frames: 0,
      gain_id: 2,
      electrode: 0, // 0 ok, 1 left off, 2 right off
      device_state: 'recording',
      rtc_ms: Date.now(),
    });
    const [events, setEvents] = useState([]); // {t, kind, text}
    const [packets, setPackets] = useState([]); // last N hex frames
    const [recording, setRecording] = useState(true);

    const pushEvent = useCallback((kind, text) => {
      setEvents((prev) => [{ t: Date.now(), kind, text }, ...prev].slice(0, 20));
    }, []);

    const pushPacket = useCallback((p) => {
      setPackets((prev) => [p, ...prev].slice(0, 40));
    }, []);

    // HR drift — slow random walk around baseHr; if real samples are loaded,
    // we mostly track the data's natural rhythm (~72 bpm baseline) with small drift.
    useEffect(() => {
      const id = setInterval(() => {
        setHr((h) => {
          const target = baseHr + 4 * Math.sin(Date.now() / 12000);
          const next = h + (target - h) * 0.18 + (Math.random() - 0.5) * 0.8;
          return Math.max(58, Math.min(96, next));
        });
      }, 900);
      return () => clearInterval(id);
    }, [baseHr]);

    // Status drift
    useEffect(() => {
      const id = setInterval(() => {
        setStatus((s) => ({
          ...s,
          rssi: Math.max(-85, Math.min(-40, s.rssi + (Math.random() - 0.5) * 3)),
          tx_rate: Math.max(8000, Math.min(16000, s.tx_rate + (Math.random() - 0.5) * 800)),
          battery_mv: Math.max(3500, s.battery_mv - (Math.random() < 0.05 ? 1 : 0)),
          battery: Math.max(0, s.battery - (Math.random() < 0.02 ? 1 : 0)),
          stored_frames: s.stored_frames + (recording ? Math.round(sampleRate / 4) : 0),
          rtc_ms: Date.now(),
        }));
      }, 1000);
      return () => clearInterval(id);
    }, [recording, sampleRate]);

    // Sample loop — runs even when not recording, but doesn't advance buffer
    const realIdxRef = useRef(0);
    useEffect(() => {
      if (!running) return;
      let raf;
      let last = performance.now();
      const dt = 1 / sampleRate;
      const step = (now) => {
        const elapsed = (now - last) / 1000;
        last = now;
        const n = Math.min(sampleRate / 4, Math.round(elapsed * sampleRate));
        if (recording) {
          const source = window.__ECG_SOURCE || 'real';
          for (let i = 0; i < n; i++) {
            tRef.current += dt;
            let v;
            if (source === 'flat') {
              v = (Math.random() - 0.5) * 0.02;
            } else if (source === 'real' && REAL_SAMPLES && REAL_SAMPLES.length > 0) {
              const speed = (hr / 72) * (REAL_SR / sampleRate);
              realIdxRef.current = (realIdxRef.current + speed) % REAL_SAMPLES.length;
              const idx = Math.floor(realIdxRef.current);
              v = REAL_SAMPLES[idx] + (Math.random() - 0.5) * 0.008;
            } else {
              // synth or real-not-yet-loaded
              v = ecgAt(tRef.current, hr) + (Math.random() - 0.5) * 0.015;
            }
            bufRef.current[writeRef.current % bufLen] = v;
            writeRef.current++;
          }
          // synth packet entry every ~250ms (4 frames/sec from spec)
          if (Math.random() < 0.06) {
            seqRef.current++;
            const seq = seqRef.current;
            pushPacket({
              t: Date.now(),
              seq,
              kind: 'ECG',
              hex: synthEcgHex(seq, hr),
            });
          }
        }
        setTick((x) => (x + 1) % 1e9);
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [running, recording, hr, sampleRate, bufLen, pushPacket]);

    // command dispatcher
    const send = useCallback((opcode, name) => {
      const labels = {
        0x01: '关机',
        0x02: '开始采集',
        0x03: '停⽌采集',
        0x04: '同步 RTC 时间',
        0x05: '绑定⽤户 ID',
      };
      const label = name || labels[opcode] || `0x${opcode.toString(16)}`;
      pushEvent('cmd', `→ ${label}`);
      pushPacket({ t: Date.now(), kind: 'CMD→', hex: synthCmdHex(opcode) });
      setTimeout(() => {
        pushEvent('rsp', `✓ ${label} 成功`);
        pushPacket({ t: Date.now(), kind: 'RSP', hex: synthRspHex(opcode) });
        if (opcode === 0x02) setRecording(true);
        if (opcode === 0x03) setRecording(false);
        if (opcode === 0x04) setStatus((s) => ({ ...s, rtc_ms: Date.now() }));
      }, 280 + Math.random() * 120);
    }, [pushEvent, pushPacket]);

    // simulate occasional electrode events
    useEffect(() => {
      const id = setInterval(() => {
        if (Math.random() < 0.05) {
          const next = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? 1 : 2);
          setStatus((s) => {
            if (s.electrode === next) return s;
            const txt = next === 0 ? '电极接触正常' : next === 1 ? '左电极脱落' : '右电极脱落';
            pushEvent(next === 0 ? 'ok' : 'warn', txt);
            return { ...s, electrode: next };
          });
        }
      }, 4000);
      return () => clearInterval(id);
    }, [pushEvent]);

    return {
      buffer: bufRef.current,
      writeIndex: writeRef.current,
      bufLen,
      sampleRate,
      tick,
      hr: Math.round(hr),
      status,
      events,
      packets,
      recording,
      setRecording,
      send,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Hex synthesizers (pretty-print only — NOT real protocol bytes)
  // ─────────────────────────────────────────────────────────────
  function synthEcgHex(seq, hr) {
    const seqLo = (seq & 0xff).toString(16).padStart(2, '0');
    const seqHi = ((seq >> 8) & 0xff).toString(16).padStart(2, '0');
    const hrHex = Math.round(hr).toString(16).padStart(2, '0');
    return `AA AA 55 55 0E ${seqLo} ${seqHi} 6F 4C 22 01 ${hrHex} 00 23 00 ` +
           rndHex(8) + ' B3 7C';
  }
  function synthCmdHex(op) {
    const o = op.toString(16).padStart(2, '0');
    return `AA AA 55 55 04 ${o} 00 00 00 4F 1A`;
  }
  function synthRspHex(op) {
    const o = op.toString(16).padStart(2, '0');
    return `AA AA 55 55 06 ${o} 00 00 00 00 00 91 D2`;
  }
  function rndHex(n) {
    let s = '';
    for (let i = 0; i < n; i++) {
      s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      if (i < n - 1) s += ' ';
    }
    return s;
  }

  // ─────────────────────────────────────────────────────────────
  // EcgWaveform — canvas-based scrolling ECG renderer
  // Props: sim, color, gridColor, bg, lineWidth, height, width, showGrid
  // ─────────────────────────────────────────────────────────────
  function EcgWaveform({
    sim, color = '#0f1a2b', gridColor = 'rgba(15,26,43,0.08)', bg = 'transparent',
    lineWidth = 1.6, height = 160, width = 360, showGrid = true, gridStyle = 'fine',
    glow = false,
  }) {
    const canvasRef = useRef(null);
    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = width * dpr;
      c.height = height * dpr;
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (bg && bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
      }
      // grid
      if (showGrid) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const small = gridStyle === 'paper' ? 8 : 16;
        const big = small * 5;
        ctx.beginPath();
        for (let x = 0; x < width; x += small) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y < height; y += small) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
        if (gridStyle === 'paper') {
          ctx.strokeStyle = gridColor.replace(/[\d.]+\)$/, '0.18)');
          ctx.beginPath();
          for (let x = 0; x < width; x += big) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
          for (let y = 0; y < height; y += big) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
          ctx.stroke();
        }
      }
      // waveform
      const buf = sim.buffer;
      const w = sim.writeIndex;
      const len = sim.bufLen;
      const samplesPerPx = len / width;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      const midY = height / 2;
      const scale = (height * 0.38);
      for (let x = 0; x < width; x++) {
        const idx = (w - len + Math.floor(x * samplesPerPx) + len * 4) % len;
        const v = buf[idx] || 0;
        const y = midY - v * scale;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }, [sim.tick, sim.writeIndex, color, gridColor, bg, lineWidth, height, width, showGrid, gridStyle, glow]);

    return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />;
  }

  // ─────────────────────────────────────────────────────────────
  // formatTime — HH:MM:SS from ms
  // ─────────────────────────────────────────────────────────────
  function formatTime(ms) {
    const d = new Date(ms);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0')).join(':');
  }

  function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Command list (used by every variant's command sheet)
  // ─────────────────────────────────────────────────────────────
  const COMMANDS = [
    { op: 0x02, label: '开始采集', hint: '启动 ECG 数据流', tone: 'go' },
    { op: 0x03, label: '停⽌采集', hint: '暂停记录但保持连接', tone: 'stop' },
    { op: 0x04, label: '同步 RTC 时间', hint: '将设备时间对齐⼿机', tone: 'neutral' },
    { op: 0x05, label: '绑定⽤户 ID', hint: '记录归属当前账户', tone: 'neutral' },
    { op: 0x01, label: '关机', hint: '断开并下电', tone: 'danger' },
  ];

  Object.assign(window, {
    useEcgSim, EcgWaveform, ecgAt,
    formatTime, formatDuration, COMMANDS,
  });
})();
