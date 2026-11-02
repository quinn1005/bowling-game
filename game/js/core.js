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
  // Spots 1-10 are the standard rack; 11-13 are the optional back row bought as Back-Row Pins.
  const SPOT_REL = [[0, 0], [-6, 1], [6, 1], [-12, 2], [0, 2], [12, 2], [-18, 3], [-6, 3], [6, 3], [18, 3], [-12, 4], [0, 4], [12, 4]];
  GK.RACK_SIZE = SPOT_REL.length;
  GK.spots = function (lhw) {
    const k = Math.min(1, (lhw || C.LHW) / C.LHW);
    return SPOT_REL.map(([x, r]) => [x * k, C.ZH + r * C.ROW]);
  };

  // Oil patterns: how oily the lane is at (x, z), 0 = dry (hook bites) .. 1 = full oil (ball skids).
  // len = where the oil ends; shape changes the cross-lane profile like real house/sport/shark patterns.
  GK.OIL = {
    house: { name: 'House Shot', len: 200, desc: 'Oily down the middle, drier on the outside. The outside line hooks back.' },
    short: { name: 'Short Oil', len: 140, desc: 'The oil ends early, so the ball hooks early and hard.' },
    long: { name: 'Long Oil', len: 270, desc: 'Oil almost to the pins. The ball barely hooks.' },
    sport: { name: 'Sport Flat', len: 215, desc: 'Even oil from edge to edge. No help from the lane.' },
    shark: { name: 'Shark Stripes', len: 235, desc: 'Stripes of oil and dry boards. The hook changes board by board.' },
    ice: { name: 'Black Ice', len: 400, desc: 'The whole lane is slick. Nothing hooks.' }
  };
  GK.oilAt = function (pat, x, z, lhw) {
    const P = GK.OIL[pat] || GK.OIL.house;
    if (pat === 'ice') return 1;
    if (z < 0) return 1;
    if (z > P.len) return 0;
    const taper = z > P.len * 0.75 ? 1 - (z - P.len * 0.75) / (P.len * 0.25) : 1;
    const u = Math.min(1, Math.abs(x) / (lhw || C.LHW));
    let across = 1;
    if (pat === 'house') across = 1 - 0.6 * u * u;
    else if (pat === 'short') across = 1 - 0.3 * u * u;
    else if (pat === 'shark') across = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(x * Math.PI / 4.2));
    else if (pat === 'long') across = 1 - 0.2 * u;
    return Math.max(0, Math.min(1, taper * across));
  };
  // Racks are always RACK_SIZE long: spots 1-10 default to standard pins, 11-13 to empty.
  GK.padRack = function (rack) {
    const r = (rack || []).slice(0, GK.RACK_SIZE);
    while (r.length < GK.RACK_SIZE) r.push(r.length < 10 ? 'std' : 'none');
    return r;
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
