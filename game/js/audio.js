// Gutter Kings — procedural WebAudio sound. Nothing loaded from files.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
GK.sfx = (() => {
  let ac = null, noiseBuf = null, rumbleGain = null, muted = false, lastClack = 0, master = null;
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
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
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
    roll(v) { if (ac && rumbleGain) rumbleGain.gain.setTargetAtTime(muted ? 0 : v * 0.35, ac.currentTime, 0.05); },
    gutter() { tone(90, 0, 0.35, 'sine', 0.25); tone(70, 0.08, 0.3, 'sine', 0.15); },
    strike() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.16)); },
    spare() { [523, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.14)); },
    tick(f) { tone(f, 0, 0.05, 'square', 0.035); },
    chip(i) { tone(330 * Math.pow(1.06, Math.min(i, 24)), 0, 0.06, 'square', 0.04); },
    mult(i) { tone(440 * Math.pow(1.06, Math.min(i, 24)), 0, 0.08, 'sawtooth', 0.035); },
    xmult() { tone(220, 0, 0.18, 'sawtooth', 0.06, 880); },
    coin() { tone(988, 0, 0.06, 'square', 0.05); tone(1319, 0.06, 0.12, 'square', 0.05); },
    boom() { noise(0, 0.5, 120, 0.7, 0.9, 'lowpass'); tone(80, 0, 0.4, 'sine', 0.3, 30); },
    shatter() { for (let i = 0; i < 5; i++) noise(i * 0.03, 0.12, 4000 + Math.random() * 3000, 6, 0.25); },
    crack() { noise(0, 0.08, 2500, 8, 0.3); },
    bounce() { tone(300, 0, 0.1, 'triangle', 0.12, 520); },
    ghost() { tone(700, 0, 0.25, 'sine', 0.05, 350); },
    swallow() { tone(400, 0, 0.3, 'sine', 0.1, 60); },
    buy() { [660, 880].forEach((f, i) => tone(f, i * 0.06, 0.08, 'square', 0.05)); },
    nope() { tone(160, 0, 0.12, 'square', 0.05); tone(120, 0.1, 0.15, 'square', 0.05); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.18, 'square', 0.05)); },
    lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.18, 0.28, 'triangle', 0.08)); },
    boss() { [110, 104, 98].forEach((f, i) => tone(f, i * 0.25, 0.4, 'sawtooth', 0.06)); }
  };
})();
