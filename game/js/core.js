// Gutter Kings — core constants, projection, seeded RNG, small helpers.
// Every module attaches to the global GK namespace so the game runs from file:// with plain <script> tags
// and the logic modules (core, data, physics, scoring, run) also load headless in Node for tests.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // Lane canvas (pixel buffer). Scaled up with integer-ish pixelated scaling by the page.
  const W = 200, H = 356;
  // World units are inches. The lane is compressed: foul line z=0 → headpin z=ZH.
  const C = {
    W, H,
    S0: W / 60, K: 330, Y0: 328, YK: (328 - 88) / 360,
    LHW: 20.75, GUT: 9.25, ZH: 300, ZBACK: 358, ZOIL: 200, ROW: 10.392,
    PIN_R: 2.4, BALL_R: 4.25, PIN_M: 1.5, BALL_Z0: -8,
    FRAMES: 5, RERACKS: 2
  };
  GK.C = C;

  // Standard pin spots relative to the headpin; x scaled for narrow lanes.
  const SPOT_REL = [[0, 0], [-6, 1], [6, 1], [-12, 2], [0, 2], [12, 2], [-18, 3], [-6, 3], [6, 3], [18, 3]];
  GK.spots = function (lhw) {
    const k = Math.min(1, (lhw || C.LHW) / C.LHW);
    return SPOT_REL.map(([x, r]) => [x * k, C.ZH + r * C.ROW]);
  };

  GK.sc = z => 1 / (1 + z / C.K);
  GK.P = (x, z, h = 0) => { const s = GK.sc(z); return { x: W / 2 + x * C.S0 * s, y: C.Y0 - z * C.YK - h * C.S0 * s * 0.7, s }; };
  GK.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  GK.fmt = n => {
    n = Math.round(n);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e7) return (n / 1e6).toFixed(1) + 'M';
    return n.toLocaleString('en-US');
  };
  GK.money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n));

  // mulberry32-style generator. rng() → [0,1). State is a single uint32 so it can be saved.
  GK.makeRng = function (seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6D2B79F5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.state = () => s;
    r.int = n => Math.floor(r() * n);
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    r.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return r;
  };
  GK.hash = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // Derive an independent stream for a purpose ("shop", "phys:3:1:2", ...) from the run seed.
  GK.stream = (seed, tag) => GK.makeRng(GK.hash(seed + ':' + tag));

  GK.seedCode = n => (n >>> 0).toString(36).toUpperCase().padStart(7, '0');
  GK.parseSeed = s => { const n = parseInt(String(s).trim().toLowerCase(), 36); return Number.isFinite(n) ? n >>> 0 : null; };
  GK.dailySeed = (d = new Date()) => GK.hash('daily-' + d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate());

  GK.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})();
