// Gutter Kings — procedural WebAudio sound. Nothing loaded from files.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
GK.sfx = (() => {
  let ac = null, noiseBuf = null, rumbleGain = null, muted = false, lastClack = 0, master = null, rumbleLp = null, rollMul = 1, rollAcc = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      rumbleGain = ac.createGain(); rumbleGain.gain.value = 0;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; rumbleLp = lp;
      const rumble = ac.createBufferSource(); rumble.buffer = noiseBuf; rumble.loop = true;
      rumble.connect(lp).connect(rumbleGain).connect(master); rumble.start();
    } catch (e) { ac = null; }
  }
  const ok = () => ac && !muted;
  function noise(start, dur, freq, q, vol, type = 'bandpass') {
    if (!ok()) return;
    const t = ac.currentTime + start;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function tone(freq, start, dur, type = 'square', vol = 0.06, slide) {
    if (!ok()) return;
    const t = ac.currentTime + start, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    init,
    get muted() { return muted; },
    setMuted(m) { muted = m; if (master && ac) master.gain.setValueAtTime(m ? 0 : 1, ac.currentTime); },
    clack(v) {
      if (!ok()) return;
      const now = ac.currentTime; if (now - lastClack < 0.012) return; lastClack = now;
      v = clamp(v, 0.05, 1);
      noise(0, 0.09, 1700 + Math.random() * 1800, 2.5, v * 0.5);
      tone(650 + Math.random() * 700, 0, 0.06, 'triangle', v * 0.12);
    },
    roll(v) { if (ac && rumbleGain) rumbleGain.gain.setTargetAtTime(muted ? 0 : v * 0.35 * rollMul, ac.currentTime, 0.05); },
    // Each kind of ball rolls differently: heavy balls rumble low and loud, light ones hiss,
    // glass rings, the duck squeaks, chains clank.
    rollStyle(kind) {
      const S = { heavy: [70, 1.6], light: [420, 0.45], glass: [320, 0.55], squeak: [220, 0.7], clank: [190, 0.9], normal: [150, 1] }[kind] || [150, 1];
      rollMul = S[1]; rollAcc = 0;
      if (ac && rumbleLp) rumbleLp.frequency.setTargetAtTime(S[0], ac.currentTime, 0.05);
    },
    rollTick(kind, speed, dt) {
      if (!ok()) return;
      rollAcc += dt * Math.min(2, speed / 300);
      const every = { heavy: 0.42, light: 0.6, glass: 0.32, squeak: 0.55, clank: 0.28 }[kind];
      if (!every || rollAcc < every) return;
      rollAcc = 0;
      if (kind === 'heavy') tone(48, 0, 0.18, 'sine', 0.22, 38);
      if (kind === 'light') noise(0, 0.12, 5200, 1.2, 0.05, 'highpass');
      if (kind === 'glass') { tone(2200 + Math.random() * 600, 0, 0.18, 'sine', 0.035); tone(3300, 0.01, 0.12, 'sine', 0.018); }
      if (kind === 'squeak') tone(1300 + Math.random() * 300, 0, 0.08, 'square', 0.025, 1900);
      if (kind === 'clank') { noise(0, 0.05, 3200, 6, 0.12); tone(900, 0, 0.05, 'square', 0.02); }
    },
    gutter() { tone(90, 0, 0.35, 'sine', 0.25); tone(70, 0.08, 0.3, 'sine', 0.15); },
    strike() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.16)); },
    spare() { [523, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.14)); },
    tick(f) { tone(f, 0, 0.05, 'square', 0.035); },
    chip(i) { tone(330 * Math.pow(1.06, Math.min(i, 24)), 0, 0.06, 'square', 0.04); },
    mult(i) { tone(440 * Math.pow(1.06, Math.min(i, 24)), 0, 0.08, 'sawtooth', 0.035); },
    xmult() { tone(220, 0, 0.18, 'sawtooth', 0.06, 880); tone(65, 0, 0.32, 'sine', 0.35, 40); noise(0, 0.12, 180, 1, 0.35, 'lowpass'); },
    // a deep impact for pocket hits
    thump() { tone(55, 0, 0.3, 'sine', 0.5, 30); noise(0, 0.1, 400, 1, 0.5, 'lowpass'); },
    // the tension heartbeat while the last pin wobbles
    heart() { tone(60, 0, 0.12, 'sine', 0.35, 45); tone(58, 0.16, 0.12, 'sine', 0.25, 42); },
    // streak fanfares climb higher and longer with every strike in a row
    streak(n) {
      const k = Math.min(n, 9), base = 523 * Math.pow(1.06, k);
      for (let i = 0; i < 3 + Math.min(k, 6); i++) tone(base * Math.pow(1.122, i), i * 0.06, 0.14, 'square', 0.045);
      if (n >= 4) tone(base / 2, 0, 0.5, 'sawtooth', 0.05, base);
      if (n >= 6) noise(0.05, 0.4, 3000, 2, 0.12);
    },
    roar() { noise(0, 0.9, 900, 0.6, 0.35); noise(0.1, 0.7, 1800, 0.8, 0.2); },
    taunt() { tone(392, 0, 0.12, 'square', 0.05); tone(311, 0.14, 0.2, 'square', 0.05); },
    levelUp() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.07, 0.2, 'square', 0.05)); },
    slot() { tone(880 + Math.random() * 400, 0, 0.04, 'square', 0.035); },
    coin() { tone(988, 0, 0.06, 'square', 0.05); tone(1319, 0.06, 0.12, 'square', 0.05); },
    boom() { noise(0, 0.5, 120, 0.7, 0.9, 'lowpass'); tone(80, 0, 0.4, 'sine', 0.3, 30); },
    shatter() { for (let i = 0; i < 5; i++) noise(i * 0.03, 0.12, 4000 + Math.random() * 3000, 6, 0.25); },
    crack() { noise(0, 0.08, 2500, 8, 0.3); },
    bounce() { tone(300, 0, 0.1, 'triangle', 0.12, 520); },
    ghost() { tone(700, 0, 0.25, 'sine', 0.05, 350); },
    swallow() { tone(400, 0, 0.3, 'sine', 0.1, 60); },
    squeak() { tone(1400, 0, 0.09, 'square', 0.04, 2100); tone(1900, 0.07, 0.08, 'square', 0.03, 1300); },
    thud() { tone(70, 0, 0.35, 'sine', 0.4, 35); noise(0, 0.18, 300, 1, 0.5, 'lowpass'); },
    buy() { [660, 880].forEach((f, i) => tone(f, i * 0.06, 0.08, 'square', 0.05)); },
    nope() { tone(160, 0, 0.12, 'square', 0.05); tone(120, 0.1, 0.15, 'square', 0.05); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.18, 'square', 0.05)); },
    lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.18, 0.28, 'triangle', 0.08)); },
    boss() { [110, 104, 98].forEach((f, i) => tone(f, i * 0.25, 0.4, 'sawtooth', 0.06)); },
    ctx: () => ac
  };
})();

// Background music: a small generated chiptune loop per alley (bass, arpeggio, hats). Boss
// Matches switch to a faster minor loop and play louder. Scheduled ahead with a lookahead timer.
GK.music = (() => {
  // [tempo, root midi note, scale steps, chord degrees per bar]
  const STYLES = [
    [104, 48, [0, 2, 4, 7, 9], [0, 3, 4, 0]],      // Lucky Strike: sunny major pentatonic
    [92, 45, [0, 3, 5, 7, 10], [0, 0, 3, 4]],      // Basement: grimy minor
    [122, 50, [0, 2, 3, 7, 8], [0, 5, 3, 4]],      // Cosmic: disco minor
    [88, 43, [0, 3, 5, 6, 7, 10], [0, 3, 0, 4]],   // Back Room: smoky blues
    [100, 52, [0, 2, 4, 7, 11], [0, 4, 5, 3]],     // Frostbite: icy major 7
    [132, 48, [0, 2, 4, 5, 7, 9], [0, 4, 5, 4]],   // Carnival: oom-pah
    [84, 46, [0, 2, 7, 9], [0, 2, 3, 2]],          // Lunar: floaty
    [96, 41, [0, 1, 5, 7, 8], [0, 1, 0, 4]]        // The Gutter: sinister
  ];
  let timer = null, next = 0, beat = 0, cfg = null, on = true, vol = 0.5, gain = null, layers = 0;
  function kick(ac, t, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(gain); o.start(t); o.stop(t + 0.2);
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function note(ac, f, t, dur, type, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(gain); o.start(t); o.stop(t + dur + 0.02);
  }
  function hat(ac, t, v) {
    const len = 0.04, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = v;
    src.connect(f).connect(g).connect(gain); src.start(t);
  }
  function tick() {
    const ac = GK.sfx.ctx(); if (!ac || !cfg) return;
    const [tempo, root, scale, chords] = cfg.style, spb = 60 / (tempo * (cfg.boss ? 1.15 : 1)) / 2;
    while (next < ac.currentTime + 0.25) {
      const bar = Math.floor(beat / 8) % chords.length, step = beat % 8, deg = chords[bar];
      const base = root + scale[deg % scale.length];
      if (step % 4 === 0) note(ac, hz(base - 12), next, spb * 3.5, 'triangle', 0.16);
      if (step % 4 === 2) note(ac, hz(base - 5), next, spb * 1.5, 'triangle', 0.09);
      const arp = [0, 2, 4, 2, 1, 3, 4, 3][step], m = root + 12 + scale[(deg + arp) % scale.length] + 12 * Math.floor((deg + arp) / scale.length);
      if (cfg.boss || step % 2 === 0) note(ac, hz(m), next, spb * 0.9, 'square', 0.035);
      if (step % 2 === 1 || cfg.boss) hat(ac, next, cfg.boss ? 0.05 : 0.03);
      // Groove layers: the hotter your PERFECT streak, the fuller the band
      if (layers >= 1 && step % 4 === 0) kick(ac, next, 0.32);
      if (layers >= 2 && step % 2 === 1) note(ac, hz(base - 12 + [0, 7, 12, 7][(step >> 1) % 4]), next, spb * 0.8, 'triangle', 0.1);
      if (layers >= 3) { const lead = [4, 2, 0, 2, 4, 4, 4, 2][step], ml = root + 24 + scale[(deg + lead) % scale.length]; if (step % 2 === 0 || step === 7) note(ac, hz(ml), next, spb * 1.6, 'square', 0.03); }
      next += spb; beat++;
    }
  }
  return {
    get on() { return on; },
    // Groove 3+ adds drums, 5+ a walking bass, 8+ a lead melody.
    setGroove(g) { layers = g >= 8 ? 3 : g >= 5 ? 2 : g >= 3 ? 1 : 0; },
    setOn(v) { on = v; if (!v) this.stop(); },
    play(alleyIdx, boss) {
      const ac = GK.sfx.ctx(); if (!ac || !on || GK.sfx.muted) { this.stop(); return; }
      const key = alleyIdx + ':' + !!boss;
      if (cfg && cfg.key === key && timer) return;
      this.stop();
      if (!gain) { gain = ac.createGain(); gain.connect(ac.destination); }
      gain.gain.setValueAtTime(boss ? vol * 1.5 : vol, ac.currentTime);
      cfg = { key, style: STYLES[((alleyIdx % 8) + 8) % 8], boss: !!boss };
      next = ac.currentTime + 0.1; beat = 0;
      timer = setInterval(tick, 60); tick();
    },
    stop() {
      if (timer) clearInterval(timer); timer = null;
      if (gain) { try { const ac = GK.sfx.ctx(); gain.gain.setTargetAtTime(0, ac.currentTime, 0.1); gain.disconnect(); } catch (e) {} gain = null; }
      cfg = null;
    }
  };
})();

// Vibration: Capacitor's Haptics plugin inside the Android app, the Vibration API in browsers.
GK.haptic = (() => {
  let on = true;
  const ms = { light: 12, medium: 28, heavy: 60, success: [30, 40, 60] };
  const fn = kind => {
    if (!on) return;
    try {
      const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (H) { if (kind === 'success') H.notification({ type: 'SUCCESS' }); else H.impact({ style: kind.toUpperCase() }); return; }
      if (navigator.vibrate) navigator.vibrate(ms[kind] || 20);
    } catch (e) {}
  };
  fn.setOn = v => { on = v; };
  Object.defineProperty(fn, 'on', { get: () => on });
  return fn;
})();
