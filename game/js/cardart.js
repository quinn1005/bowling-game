// Achievement card art: one small pixel-art icon per feat, drawn to match its name.
// Each icon draws inside the round medallion of a 48×64 card (centre 24,26, radius about 15).
(function () {
  const GK = globalThis.GK;
  const INK = '#140e18', WHITE = '#f8f4ec', PIN = '#f2ebe0', RED = '#d03a3a', GOLD = '#ffd447', GOLD2 = '#c8932a',
    BROWN = '#7a4a24', BROWN2 = '#4a2a14', GREY = '#8a8a9a', GREY2 = '#4a4a5a', BLUE = '#5ab4ff', GREEN = '#4ac46a', ORANGE = '#ff8a2a';
  const FONT = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
    K: '101110100110101', '-': '000000111000000', '!': '010010010000010', Z: '111001010100111', $: '011110010011110', '%': '101001010100101', '?': '111001011000010'
  };

  GK.cardKit = function (ctx) {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const p = (x, y, c) => r(x, y, 1, 1, c);
    const disc = (cx, cy, rad, c) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad * 0.6) p(cx + x, cy + y, c); };
    const ell = (cx, cy, rx, ry, c) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) p(cx + x, cy + y, c); };
    const ring = (cx, cy, rad, c, t = 1) => { for (let y = -rad - 1; y <= rad + 1; y++) for (let x = -rad - 1; x <= rad + 1; x++) { const d = Math.sqrt(x * x + y * y); if (d <= rad + 0.4 && d > rad - t + 0.4) p(cx + x, cy + y, c); } };
    const line = (x0, y0, x1, y1, c, t = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) r(Math.round(x0 + (x1 - x0) * i / n) - (t >> 1), Math.round(y0 + (y1 - y0) * i / n) - (t >> 1), t, t, c); };
    const oline = (x0, y0, x1, y1, c, t = 2) => { line(x0, y0, x1, y1, INK, t + 2); line(x0, y0, x1, y1, c, t); };
    const text = (s, x, y, sc, c) => {
      String(s).split('').forEach((ch, i) => { const g = FONT[ch]; if (!g) return; for (let k = 0; k < 15; k++) if (g[k] === '1') { r(x + i * 4 * sc + (k % 3) * sc + 1, y + Math.floor(k / 3) * sc + 1, sc, sc, INK); } });
      String(s).split('').forEach((ch, i) => { const g = FONT[ch]; if (!g) return; for (let k = 0; k < 15; k++) if (g[k] === '1') r(x + i * 4 * sc + (k % 3) * sc, y + Math.floor(k / 3) * sc, sc, sc, c); });
    };
    const textW = (s, sc) => String(s).length * 4 * sc - sc;
    const ctext = (s, cx, y, sc, c) => text(s, Math.round(cx - textW(s, sc) / 2), y, sc, c);
    // a bowling pin, `h` pixels tall, standing with its top at y
    const PROF = [1, 2, 2, 2, 1.5, 1.2, 1.2, 1.6, 2.4, 3, 3.4, 3.6, 3.6, 3.6, 3.4, 3.1, 2.8, 2.4, 2.1, 1.8];
    const pin = (cx, top, h, col = PIN, stripe = RED, shade) => {
      const row = i => PROF[Math.min(19, Math.floor(i * 20 / h))] * h / 20;
      for (let i = -1; i <= h; i++) { const w = Math.max(1, Math.round(row(Math.max(0, Math.min(h - 1, i))))); r(cx - w - 1, top + i, 2 * w + 2, 1, INK); }
      for (let i = 0; i < h; i++) {
        const k = Math.floor(i * 20 / h), w = Math.max(1, Math.round(row(i)));
        r(cx - w, top + i, 2 * w, 1, k === 5 || k === 6 ? stripe : col);
        if (w > 1 && k !== 5 && k !== 6) { p(cx - w + 1, top + i, '#ffffff'); p(cx + w - 1, top + i, shade || GK.shade(col, -0.25)); }
      }
    };
    const ball = (cx, cy, rad, col, holes = true) => {
      disc(cx, cy, rad + 1, INK); disc(cx, cy, rad, GK.shade(col, -0.3)); disc(cx - 1, cy - 1, rad - 1, col);
      disc(cx - Math.round(rad / 3), cy - Math.round(rad / 3), Math.max(1, Math.round(rad / 3)), GK.shade(col, 0.3)); p(cx - Math.round(rad / 2), cy - Math.round(rad / 2), '#ffffff');
      if (holes && rad >= 4) { p(cx - 1, cy - 1, INK); p(cx + 1, cy - 1, INK); p(cx, cy + 1, INK); }
    };
    const X = (x0, y0, x1, y1, c = RED, t = 3) => { oline(x0, y0, x1, y1, c, t); oline(x1, y0, x0, y1, c, t); };
    const star = (cx, cy, rad, c) => {
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? rad * 0.45 : rad; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      const inside = (x, y) => { let o = false; for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; } return o; };
      for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
        if (inside(x + 0.5, y + 0.5)) p(x, y, c); else if (inside(x + 1.5, y + 0.5) || inside(x - 0.5, y + 0.5) || inside(x + 0.5, y + 1.5) || inside(x + 0.5, y - 0.5)) p(x, y, INK);
      }
    };
    const sparkle = (x, y, c = '#ffffff') => { p(x, y, c); p(x - 1, y, c); p(x + 1, y, c); p(x, y - 1, c); p(x, y + 1, c); };
    const poly = (pts, c, outline = true) => {
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const inside = (x, y) => { let o = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; } return o; };
      for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.max(...ys) + 1; y++) for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.max(...xs) + 1; x++) {
        if (inside(x + 0.5, y + 0.5)) p(x, y, c);
        else if (outline && (inside(x + 1.5, y + 0.5) || inside(x - 0.5, y + 0.5) || inside(x + 0.5, y + 1.5) || inside(x + 0.5, y - 0.5))) p(x, y, INK);
      }
    };
    const box = (x, y, w, h, c) => { r(x - 1, y - 1, w + 2, h + 2, INK); r(x, y, w, h, c); };
    return { r, p, disc, ell, ring, line, oline, text, ctext, pin, ball, X, star, sparkle, poly, box };
  };

  const crown = (k, cx, top, s = 1) => {
    const w = 18 * s, h = 10 * s, x = cx - w / 2;
    k.poly([[x, top + h], [x, top + 2 * s], [x + w * 0.25, top + h * 0.55], [cx, top], [x + w * 0.75, top + h * 0.55], [x + w, top + 2 * s], [x + w, top + h]], GOLD);
    k.r(x + 1, top + h - 3 * s, w - 2, s * 2, GOLD2); k.p(cx, top + h * 0.6, RED); k.p(x + 4 * s, top + h * 0.7, BLUE); k.p(x + w - 4 * s, top + h * 0.7, GREEN);
  };
  const skull = (k, cx, cy, s = 1) => {
    k.ell(cx, cy, 5 * s + 1, 4 * s + 1, INK); k.ell(cx, cy, 5 * s, 4 * s, WHITE); k.r(cx - 3 * s, cy + 3 * s, 6 * s, 3 * s, WHITE); k.r(cx - 3 * s - 1, cy + 6 * s, 6 * s + 2, 1, INK);
    k.r(cx - 3 * s, cy - s, 2 * s, 2 * s, INK); k.r(cx + s, cy - s, 2 * s, 2 * s, INK); k.p(cx, cy + 2 * s, INK); k.p(cx - s, cy + 5 * s, INK); k.p(cx + s, cy + 5 * s, INK);
  };
  const stopwatch = (k, cx, cy, hand) => {
    k.box(cx - 2, cy - 14, 4, 3, GREY); k.ring(cx, cy, 11, INK, 2); k.disc(cx, cy, 9, WHITE); k.ring(cx, cy, 9, GREY2);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; k.p(cx + Math.round(Math.cos(a) * 7), cy + Math.round(Math.sin(a) * 7), GREY2); }
    k.line(cx, cy, cx + Math.round(Math.cos(hand) * 7), cy + Math.round(Math.sin(hand) * 7), RED, 2); k.disc(cx, cy, 1, INK);
  };
  const lane = (k, x0, x1) => { k.r(x0 - 1, 10, x1 - x0 + 2, 32, INK); k.r(x0, 10, x1 - x0, 32, '#e0a860'); for (let x = x0 + 2; x < x1; x += 3) k.r(x, 10, 1, 32, '#c88a48'); k.r(x0, 10, x1 - x0, 1, '#f2c48a'); };
  const tri = (k, cx, top, n, sz, c) => { for (let row = 0; row < n; row++) for (let i = 0; i <= row; i++) k.disc(cx - row * sz / 2 + i * sz, top + row * sz * 0.85, Math.max(1, Math.round(sz / 3)), c); };

  // Each feat's icon. k is the drawing kit, col the card's own two colours.
  const ICON = {
    strike: k => k.X(13, 15, 35, 37, RED, 4),
    double: k => { k.X(9, 19, 20, 32, RED, 2); k.X(28, 19, 39, 32, RED, 2); },
    turkey: k => { // a roast turkey on a plate, with three little strike marks for steam
      k.ell(24, 36, 15, 4, INK); k.ell(24, 36, 14, 3, WHITE); k.ell(24, 36, 10, 2, '#d8d0c4');
      k.ell(24, 29, 11, 7, INK); k.ell(24, 29, 10, 6, '#b8642a'); k.ell(22, 27, 6, 3, '#d88a44'); k.ell(20, 26, 2, 1, '#f2b070');
      for (const sx of [-1, 1]) { k.line(24 + sx * 8, 26, 24 + sx * 12, 19, INK, 4); k.line(24 + sx * 8, 26, 24 + sx * 12, 19, '#c8783a', 2); k.disc(24 + sx * 12, 18, 2, INK); k.disc(24 + sx * 12, 18, 1, WHITE); }
      for (let i = 0; i < 3; i++) { const x = 18 + i * 6; k.line(x - 1, 10, x + 1, 13, RED); k.line(x + 1, 10, x - 1, 13, RED); }
    },
    pocket: k => { // a rocket
      k.poly([[24, 9], [29, 17], [29, 33], [19, 33], [19, 17]], WHITE); k.poly([[24, 9], [29, 17], [19, 17]], RED);
      k.disc(24, 22, 2, BLUE); k.ring(24, 22, 2, INK); k.poly([[19, 26], [14, 34], [19, 33]], RED); k.poly([[29, 26], [34, 34], [29, 33]], RED);
      k.poly([[20, 34], [28, 34], [24, 42]], ORANGE, false); k.poly([[22, 34], [26, 34], [24, 39]], GOLD, false);
    },
    big_hook: k => { // a ball and its big hooking path
      let prev = null; for (let t = 0; t <= 1.0001; t += 0.05) { const x = 14 + 22 * Math.sin(t * 1.5) - 14 * t * t * t, y = 38 - 26 * t; if (prev) k.line(prev[0], prev[1], Math.round(x), Math.round(y), WHITE, 2); prev = [Math.round(x), Math.round(y)]; }
      k.poly([[prev[0] - 6, prev[1] - 1], [prev[0] + 1, prev[1] - 4], [prev[0] - 2, prev[1] + 4]], WHITE);
      k.ball(14, 38, 4, '#2a5ad0');
    },
    straight: k => { k.oline(24, 40, 24, 15, WHITE, 2); k.poly([[18, 17], [24, 9], [30, 17]], RED); k.poly([[20, 36], [24, 32], [28, 36], [28, 41], [24, 37], [20, 41]], GOLD); },
    clutch: k => { // the 10th box of a scorecard with a strike in it
      k.box(11, 12, 26, 28, WHITE); k.r(11, 19, 26, 1, INK); k.r(24, 12, 1, 7, INK); k.ctext('10', 17, 14, 1, INK); k.X(15, 23, 33, 37, RED, 3);
    },
    full_house: k => { // a house with pins in the windows
      k.poly([[9, 22], [24, 10], [39, 22]], RED); k.box(12, 22, 24, 18, '#e8d8b8'); k.box(21, 30, 6, 10, BROWN);
      k.pin(16, 25, 9); k.pin(32, 25, 9);
    },
    clean_up: k => { // a broom sweeping up pins
      k.oline(34, 10, 20, 30, BROWN, 2); k.poly([[18, 27], [24, 32], [18, 41], [11, 36]], GOLD); for (let i = 0; i < 4; i++) k.line(13 + i * 2, 36 + (i % 2), 19 + i, 30, GOLD2);
      k.pin(33, 31, 9); k.p(29, 39, GREY); k.p(37, 40, GREY);
    },
    sharpshooter: k => { k.ring(24, 26, 13, INK, 3); k.ring(24, 26, 12, RED, 1); k.ring(24, 26, 7, RED, 1); for (const [x, y, w, h] of [[23, 10, 2, 8], [23, 34, 2, 8], [8, 25, 8, 2], [32, 25, 8, 2]]) k.r(x, y, w, h, RED); k.pin(24, 20, 12); },
    comeback: k => { // a heart with a bandage: never say die
      k.poly([[24, 40], [10, 26], [10, 18], [14, 13], [20, 13], [24, 18], [28, 13], [34, 13], [38, 18], [38, 26]], RED); k.r(13, 16, 3, 3, '#ff8a8a');
      k.poly([[15, 31], [31, 17], [34, 20], [18, 34]], '#f2d8b0'); k.p(23, 25, BROWN); k.p(25, 26, BROWN); k.p(24, 27, BROWN);
    },
    lucky_seven: k => { // a four-leaf clover and a big 7
      for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { k.disc(17 + dx, 25 + dy, 5, INK); } for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) k.disc(17 + dx, 25 + dy, 4, GREEN);
      k.disc(17, 25, 2, '#2a8a4a'); k.oline(18, 30, 20, 40, '#2a8a4a', 1); k.text('7', 26, 16, 3, GOLD);
    },
    split: k => { k.pin(12, 15, 22); k.pin(36, 15, 22); k.line(24, 11, 21, 19, GOLD, 2); k.line(21, 19, 27, 26, GOLD, 2); k.line(27, 26, 22, 34, GOLD, 2); k.line(22, 34, 25, 41, GOLD, 2); },
    seven_ten: k => { k.pin(12, 12, 20); k.pin(36, 12, 20); k.ctext('7', 12, 35, 1, WHITE); k.ctext('10', 36, 35, 1, WHITE); k.ctext('-', 24, 22, 2, GOLD); },
    gutter: k => { k.r(8, 30, 32, 10, INK); k.r(9, 31, 30, 8, GREY2); k.r(9, 37, 30, 2, '#2a2a3a'); k.ball(24, 33, 4, '#6a6a7a'); crown(k, 24, 12); },
    carry: k => { // dominoes toppling into each other
      k.poly([[9, 22], [14, 22], [14, 40], [9, 40]], WHITE); k.p(11, 27, INK); k.p(11, 35, INK); k.r(9, 31, 5, 1, INK);
      k.poly([[19, 21], [24, 20], [29, 39], [24, 40]], WHITE); k.p(22, 26, INK); k.p(25, 34, INK);
      k.poly([[31, 36], [40, 33], [41, 37], [32, 40]], WHITE); k.p(35, 37, INK);
    },
    slow_burn: k => { k.poly([[24, 8], [33, 22], [34, 32], [29, 41], [19, 41], [14, 32], [15, 22], [20, 26]], ORANGE); k.poly([[24, 18], [30, 30], [27, 39], [21, 39], [18, 31]], GOLD, false); k.poly([[24, 28], [27, 35], [24, 39], [21, 35]], WHITE, false); },
    statue: k => { k.box(14, 36, 20, 4, GREY); k.box(16, 33, 16, 3, '#b8b8c8'); k.pin(24, 11, 22, '#d8d8e0', '#9a9aaa', '#9a9aaa'); },
    off_wall: k => { k.r(36, 9, 4, 34, INK); k.r(37, 9, 2, 34, BROWN); for (let y = 11; y < 42; y += 4) k.r(37, y, 2, 1, BROWN2); k.oline(12, 40, 34, 22, WHITE, 1); k.oline(34, 22, 18, 12, WHITE, 1); k.sparkle(34, 22, GOLD); k.ball(14, 38, 4, '#2a5ad0'); },
    pit_stop: k => { // a checkered flag
      k.oline(13, 10, 13, 42, GREY, 2); k.box(14, 11, 22, 15, WHITE); for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) if ((x + y) % 2) k.r(14 + x * 3 + (x > 6 ? 0 : 0), 11 + y * 3, 3, 3, INK);
    },
    demolition: k => { k.poly([[24, 8], [28, 18], [39, 14], [32, 24], [41, 30], [30, 31], [32, 42], [24, 34], [16, 42], [18, 31], [7, 30], [16, 24], [9, 14], [20, 18]], ORANGE); k.poly([[24, 15], [27, 22], [34, 22], [28, 27], [31, 35], [24, 30], [17, 35], [20, 27], [14, 22], [21, 22]], GOLD, false); k.disc(24, 26, 3, WHITE); },
    heavy_metal: k => { // a lead pin with lightning
      k.pin(24, 10, 30, '#6a6a7a', '#3a3a4a', '#4a4a5a'); k.poly([[36, 9], [31, 19], [35, 19], [30, 29], [40, 16], [36, 16], [39, 9]], GOLD); k.p(22, 24, '#ffffff');
    },
    gold_fever: k => { k.pin(15, 18, 20, GOLD, GOLD2, GOLD2); k.pin(33, 18, 20, GOLD, GOLD2, GOLD2); k.pin(24, 12, 26, GOLD, GOLD2, GOLD2); k.sparkle(10, 12); k.sparkle(38, 13); k.sparkle(39, 36, GOLD); },
    broken_glass: k => {
      k.pin(22, 10, 26, '#bfe8ff', '#5ab4ff', '#7ac8ff'); k.line(20, 14, 24, 22, INK); k.line(24, 22, 19, 28, INK); k.line(24, 22, 27, 30, INK); k.line(19, 28, 22, 34, INK);
      k.poly([[33, 30], [37, 32], [34, 36]], '#bfe8ff'); k.poly([[36, 38], [40, 40], [35, 42]], '#bfe8ff'); k.poly([[30, 39], [32, 41], [28, 42]], '#bfe8ff');
    },
    thunder: k => k.poly([[27, 8], [14, 27], [23, 27], [18, 43], [35, 21], [26, 21], [32, 8]], GOLD),
    big_frame: k => { k.ctext('5000', 24, 18, 2, GOLD); k.r(9, 32, 30, 2, GOLD2); k.sparkle(11, 13); k.sparkle(37, 38); },
    monster_frame: k => { // a monster eating a number
      k.poly([[10, 40], [10, 20], [14, 11], [34, 11], [38, 20], [38, 40], [34, 36], [30, 40], [26, 36], [22, 40], [18, 36], [14, 40]], '#6ac44a');
      k.disc(18, 20, 4, WHITE); k.disc(30, 20, 4, WHITE); k.disc(19, 21, 2, INK); k.disc(29, 21, 2, INK);
      k.r(15, 27, 18, 6, INK); for (let x = 16; x < 33; x += 3) { k.r(x, 27, 2, 2, WHITE); k.r(x + 1, 31, 2, 2, WHITE); }
      k.poly([[13, 11], [11, 5], [17, 11]], '#d8c890'); k.poly([[31, 11], [37, 5], [35, 11]], '#d8c890');
    },
    groove: k => { // two beamed music notes
      k.ell(15, 37, 4, 3, INK); k.ell(15, 37, 3, 2, GOLD); k.ell(32, 33, 4, 3, INK); k.ell(32, 33, 3, 2, GOLD);
      k.oline(18, 36, 18, 14, GOLD, 2); k.oline(35, 32, 35, 10, GOLD, 2); k.poly([[17, 12], [36, 8], [36, 13], [17, 17]], GOLD);
    },
    perfectionist: k => { k.star(24, 26, 15, GOLD); k.ctext('10', 24, 24, 1, BROWN2); },
    regular: k => { // a two-tone bowling shoe
      k.poly([[9, 30], [12, 18], [24, 18], [27, 25], [38, 28], [40, 34], [38, 38], [9, 38]], RED); k.poly([[12, 18], [24, 18], [27, 25], [20, 30], [11, 30]], WHITE, false);
      k.r(9, 38, 31, 3, INK); k.r(9, 37, 31, 1, '#3a2a1a'); for (let i = 0; i < 3; i++) k.r(16 + i * 3, 21 + i, 2, 1, INK); k.ctext('40', 32, 13, 1, WHITE);
    },
    fumble: k => { // the pinsetter claw dropping a pin
      k.box(10, 9, 28, 5, GREY2); k.r(10, 9, 28, 1, GREY); k.oline(16, 14, 14, 22, GREY, 2); k.oline(32, 14, 34, 22, GREY, 2);
      k.pin(26, 20, 16); k.line(14, 26, 14, 31, WHITE); k.line(36, 25, 36, 29, WHITE); k.line(19, 37, 19, 41, WHITE); k.text('!', 8, 29, 2, GOLD);
    },
    jammed: k => { // a ball stuck in the return pipe
      k.r(7, 20, 34, 14, INK); k.r(8, 21, 32, 12, GREY2); k.r(8, 22, 32, 2, GREY); k.ball(23, 27, 6, '#2a5ad0');
      k.r(7, 18, 3, 18, GREY); k.r(38, 18, 3, 18, GREY); k.text('!', 31, 9, 2, RED); k.text('!', 36, 9, 2, RED);
    },
    rich: k => { // a money bag
      k.poly([[19, 10], [29, 10], [27, 16], [34, 22], [37, 32], [33, 41], [15, 41], [11, 32], [14, 22], [21, 16]], '#c8a060'); k.r(19, 16, 10, 2, BROWN);
      k.text('$', 19, 24, 3, '#2a8a3a');
    },
    broke: k => { // an empty wallet with a moth
      k.box(9, 22, 30, 18, BROWN); k.r(9, 22, 30, 3, '#9a6a3a'); k.r(10, 28, 28, 1, BROWN2); k.ctext('$0', 24, 31, 1, '#f2d8b0');
      k.ell(24, 13, 1, 3, GREY2); k.ell(20, 12, 3, 2, '#c8c0b0'); k.ell(28, 12, 3, 2, '#c8c0b0'); k.p(22, 18, WHITE); k.p(26, 19, WHITE);
    },
    window: k => { // a shop window with a striped awning and reroll arrows
      k.box(10, 18, 28, 22, '#8ad0ff'); k.line(12, 37, 22, 22, '#c8eaff'); k.r(23, 18, 2, 22, INK);
      k.poly([[8, 18], [11, 10], [37, 10], [40, 18]], RED); for (let x = 14; x < 36; x += 6) k.poly([[x, 10], [x + 3, 10], [x + 3, 18], [x - 1, 18]], WHITE, false);
      k.ring(17, 30, 4, GOLD); k.ring(31, 30, 4, GOLD); k.p(21, 28, GOLD); k.p(27, 32, GOLD);
    },
    full_bag: k => { // a bowling bag
      k.ring(24, 17, 7, INK, 3); k.ring(24, 17, 6, GREY2, 1); k.box(9, 18, 30, 21, '#8a3ad0'); k.r(9, 18, 30, 4, '#a85ae8'); k.r(9, 27, 30, 2, GOLD);
      k.ball(17, 34, 3, '#2a5ad0', false); k.ball(31, 34, 3, RED, false);
    },
    bracelet: k => { // a chain bracelet with charms hanging off it
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; k.disc(24 + Math.round(Math.cos(a) * 12), 22 + Math.round(Math.sin(a) * 7), 1, i % 2 ? GOLD : GOLD2); }
      const cols = [RED, BLUE, GREEN, '#ff7ac8', GOLD]; cols.forEach((c, i) => { const x = 13 + i * 5.5; k.line(x, 28, x, 31, GOLD2); k.disc(Math.round(x), 34, 2, INK); k.disc(Math.round(x), 34, 1, c); });
    },
    shiny: k => { // three gleaming gems
      const gem = (cx, cy, c) => { k.poly([[cx - 5, cy - 2], [cx - 2, cy - 6], [cx + 2, cy - 6], [cx + 5, cy - 2], [cx, cy + 6]], c); k.line(cx - 4, cy - 2, cx + 4, cy - 2, GK.shade(c, 0.4)); k.p(cx - 2, cy - 4, '#ffffff'); };
      gem(14, 31, '#c8c8d8'); gem(34, 31, '#ff7ac8'); gem(24, 20, '#5affd0'); k.sparkle(12, 14); k.sparkle(37, 16); k.sparkle(24, 40, GOLD);
    },
    dressed: k => { // a bowling glove
      k.poly([[14, 41], [14, 24], [16, 13], [19, 13], [20, 22], [21, 11], [24, 11], [25, 22], [26, 12], [29, 12], [30, 23], [31, 16], [34, 16], [35, 27], [32, 34], [32, 41]], '#2a2a3a');
      k.r(14, 35, 18, 6, RED); k.r(14, 37, 18, 1, WHITE); k.poly([[14, 24], [9, 20], [8, 24], [14, 31]], '#2a2a3a');
    },
    custom: k => { // a drill boring into a ball
      k.ball(15, 31, 8, '#2a5ad0'); k.box(25, 12, 13, 7, '#d0a020'); k.box(29, 19, 5, 9, GREY2); k.oline(31, 28, 23, 32, GREY, 1); k.p(22, 32, WHITE);
      k.p(30, 14, '#ffffff'); k.sparkle(20, 25, GOLD);
    },
    shady: k => { // fedora and sunglasses
      k.disc(24, 31, 9, '#c8946a'); k.ell(24, 21, 15, 2, INK); k.poly([[15, 21], [17, 11], [31, 11], [33, 21]], '#2a2a3a'); k.r(16, 18, 16, 2, RED);
      k.r(15, 27, 8, 4, INK); k.r(25, 27, 8, 4, INK); k.r(22, 28, 4, 1, INK); k.p(17, 28, GREY); k.p(27, 28, GREY); k.r(21, 36, 6, 1, BROWN2);
    },
    skipper: k => { k.poly([[10, 15], [22, 26], [10, 37]], WHITE); k.poly([[22, 15], [34, 26], [22, 37]], WHITE); k.box(35, 15, 3, 22, WHITE); },
    purist: k => { k.pin(24, 14, 26); k.ell(24, 10, 8, 2, GOLD); k.ell(24, 10, 6, 1, col0); k.sparkle(12, 18); k.sparkle(36, 18); },
    lean: k => { // a feather
      k.oline(16, 41, 32, 10, WHITE, 1); k.poly([[32, 10], [37, 14], [34, 24], [27, 32], [20, 36], [22, 28], [26, 19]], '#e8f4ff'); k.line(33, 13, 22, 33, '#9ac0e0');
      for (let i = 0; i < 4; i++) k.line(27 + i * 2, 18 + i * 3, 31 + i * 2, 15 + i * 3, '#9ac0e0');
    },
    boss_rush: k => { skull(k, 13, 30, 1); skull(k, 35, 30, 1); skull(k, 24, 18, 1.4); },
    secretary: k => { // a clipboard with a check mark
      k.box(12, 12, 24, 30, BROWN); k.box(15, 15, 18, 25, WHITE); k.box(19, 9, 10, 5, GREY); for (let y = 19; y < 38; y += 4) k.r(17, y, 14, 1, '#c8c0b0');
      k.oline(18, 30, 22, 35, GREEN, 2); k.oline(22, 35, 32, 21, GREEN, 2);
    },
    mechanic: k => { // a wrench
      k.oline(14, 38, 30, 20, GREY, 4); k.disc(32, 17, 7, INK); k.disc(32, 17, 6, GREY); k.disc(34, 15, 3, col1); k.r(33, 10, 6, 6, col1); k.disc(13, 39, 3, INK); k.disc(13, 39, 2, GREY);
    },
    strobe: k => { // a disco ball with a switched-off bulb glint
      k.line(24, 7, 24, 12, GREY); k.disc(24, 25, 12, INK); k.disc(24, 25, 11, '#9aa8c8');
      for (let y = 15; y < 37; y += 3) for (let x = 14; x < 35; x += 3) if ((x - 24) ** 2 + (y - 25) ** 2 < 110) k.r(x, y, 2, 2, ((x + y) % 2) ? '#d8e4ff' : '#6a7aa0');
      k.sparkle(18, 19); k.sparkle(31, 30, '#ff7ac8');
    },
    basement: k => { // stairs going down
      for (let i = 0; i < 5; i++) k.box(9 + i * 6, 14 + i * 5, 30 - i * 6 + 1, 5, i % 2 ? '#9a7a5a' : '#7a5a3a');
      k.oline(14, 30, 14, 40, WHITE, 2); k.poly([[10, 37], [18, 37], [14, 42]], WHITE);
    },
    cosmic: k => { // a night owl
      k.ell(24, 28, 11, 12, INK); k.ell(24, 28, 10, 11, '#8a5a3a'); k.ell(24, 32, 6, 6, '#c8a07a'); k.poly([[14, 18], [16, 11], [20, 17]], '#8a5a3a'); k.poly([[34, 18], [32, 11], [28, 17]], '#8a5a3a');
      k.disc(19, 23, 4, WHITE); k.disc(29, 23, 4, WHITE); k.disc(19, 23, 2, INK); k.disc(29, 23, 2, INK); k.p(18, 22, WHITE); k.p(28, 22, WHITE); k.poly([[22, 27], [26, 27], [24, 30]], GOLD);
      k.disc(38, 11, 3, '#fff6c8'); k.disc(39, 10, 2, col1);
    },
    frostbite: k => { // a shoe with icicles: cold feet
      k.poly([[9, 30], [12, 16], [24, 16], [27, 24], [38, 27], [40, 33], [38, 36], [9, 36]], '#8ad0ff'); k.r(9, 36, 31, 3, INK);
      for (let i = 0; i < 5; i++) k.poly([[11 + i * 6, 39], [15 + i * 6, 39], [13 + i * 6, 44 - (i % 2) * 2]], '#e8f8ff'); k.sparkle(18, 22); k.sparkle(32, 30);
    },
    snowed_in: k => { // a snowflake
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, dx = Math.cos(a) * 14, dy = Math.sin(a) * 14; k.oline(24 - dx, 26 - dy, 24 + dx, 26 + dy, WHITE, 2); }
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = 24 + Math.cos(a) * 9, y = 26 + Math.sin(a) * 9; k.line(x, y, x + Math.cos(a + 0.8) * 4, y + Math.sin(a + 0.8) * 4, WHITE); k.line(x, y, x + Math.cos(a - 0.8) * 4, y + Math.sin(a - 0.8) * 4, WHITE); }
      k.disc(24, 26, 2, BLUE);
    },
    carnival: k => { // a striped circus tent
      k.poly([[8, 40], [10, 24], [24, 10], [38, 24], [40, 40]], WHITE); for (let i = 0; i < 4; i++) { const x = 11 + i * 8; k.poly([[x, 40], [x + 3, 26], [24, 11], [x + 5, 26], [x + 4, 40]], RED, false); }
      k.poly([[19, 40], [24, 28], [29, 40]], INK); k.line(24, 10, 24, 5, INK); k.poly([[24, 5], [30, 7], [24, 9]], GOLD);
    },
    lunar: k => { // a crescent moon and footprints
      k.disc(21, 22, 11, '#f2ebc8'); k.disc(27, 18, 10, col1); k.disc(15, 22, 1, '#c8c0a0'); k.disc(18, 28, 2, '#c8c0a0');
      for (let i = 0; i < 3; i++) { k.ell(28 + i * 4, 40 - i * 5, 1, 2, WHITE); }
    },
    drain: k => { // a drain grate with a swirl
      k.disc(24, 26, 14, INK); k.disc(24, 26, 13, GREY2); for (let x = 14; x < 35; x += 4) k.r(x, 15, 2, 22, INK);
      let prev = null; for (let t = 0; t < 12; t += 0.4) { const rr = 11 - t * 0.85, x = 24 + Math.cos(t) * rr, y = 26 + Math.sin(t) * rr; if (prev) k.line(prev[0], prev[1], Math.round(x), Math.round(y), BLUE); prev = [Math.round(x), Math.round(y)]; }
    },
    champion: k => { crown(k, 24, 14, 1.5); k.sparkle(10, 12); k.sparkle(38, 12); },
    quinn: k => { lane(k, 14, 34); k.r(14, 10, 2, 32, '#4a3a2a'); k.r(32, 10, 2, 32, '#4a3a2a'); for (let y = 38; y > 13; y -= 3) k.p(30, y, WHITE); k.ball(30, 38, 3, '#e8c040'); tri(k, 24, 12, 3, 4, PIN); },
    levi: k => { // a lofted ball high over the lane, with a THUD below
      k.ell(24, 39, 10, 2, '#00000066'); let prev = null; for (let t = 0; t <= 1; t += 0.1) { const x = 10 + t * 28, y = 38 - Math.sin(t * Math.PI) * 26; if (prev) k.line(prev[0], prev[1], Math.round(x), Math.round(y), WHITE); prev = [Math.round(x), Math.round(y)]; }
      k.ball(24, 14, 5, '#c84a4a'); k.line(36, 34, 40, 31, GOLD); k.line(37, 38, 41, 38, GOLD); k.line(34, 40, 36, 43, GOLD);
    },
    kaleb: k => { lane(k, 10, 38); let prev = null; for (let t = 0; t <= 1.001; t += 0.08) { const x = 34 - 26 * Math.sin(t * Math.PI * 0.8) + 4 * t, y = 40 - 27 * t; if (prev) k.line(prev[0], prev[1], Math.round(x), Math.round(y), WHITE); prev = [Math.round(x), Math.round(y)]; } k.ball(34, 38, 3, '#3a9a4a'); tri(k, 24, 12, 3, 4, PIN); },
    regulars: k => { k.ball(13, 31, 6, '#e8c040'); k.ball(35, 31, 6, '#3a9a4a'); k.ball(24, 19, 6, '#c84a4a'); },
    glass_jaw: k => { // a shield: no open frames got through
      k.poly([[24, 9], [37, 14], [36, 28], [24, 42], [12, 28], [11, 14]], GREY); k.poly([[24, 12], [34, 16], [33, 27], [24, 38]], '#c8c8d8', false); k.X(18, 20, 30, 32, RED, 2);
    },
    slow_roller: k => { // a snail with a bowling ball for a shell
      k.poly([[8, 40], [10, 34], [36, 34], [40, 40]], '#b8d070'); k.line(12, 34, 10, 26, INK); k.line(15, 34, 15, 26, INK); k.disc(10, 25, 1, INK); k.disc(15, 25, 1, INK);
      k.ball(27, 27, 8, '#2a5ad0'); k.line(38, 38, 42, 38, WHITE);
    },
    pinball_wizard: k => { // a wizard hat with stars
      k.poly([[10, 38], [22, 9], [30, 12], [26, 18], [36, 38]], '#4a3ad0'); k.ell(23, 38, 15, 3, '#4a3ad0'); k.r(13, 33, 21, 3, GOLD);
      k.star(22, 24, 4, GOLD); k.sparkle(29, 29, GOLD); k.sparkle(16, 30); k.sparkle(38, 18, GOLD);
    },
    bargain_hunter: k => { // a price tag
      k.poly([[10, 22], [20, 12], [38, 12], [38, 32], [20, 32]], '#f2d8a0'); k.disc(16, 22, 2, INK); k.line(11, 18, 7, 12, INK); k.ctext('-$', 29, 17, 2, RED); k.ctext('3', 34, 35, 1, WHITE);
    },
    flawless: k => { // a diamond
      k.poly([[12, 20], [18, 12], [30, 12], [36, 20], [24, 40]], '#bfe8ff'); k.poly([[12, 20], [36, 20], [24, 40]], '#8ad0ff', false); k.line(18, 12, 21, 20, WHITE); k.line(30, 12, 27, 20, WHITE); k.line(21, 20, 24, 40, '#5ab4ff'); k.line(27, 20, 24, 40, '#5ab4ff');
      k.sparkle(36, 11); k.sparkle(11, 34);
    },
    insomniac: k => { // a mug of coffee at night
      k.box(13, 22, 18, 18, WHITE); k.r(13, 22, 18, 3, '#6a3a1a'); k.ring(33, 30, 4, INK, 3); k.ring(33, 30, 3, WHITE, 1);
      for (const x of [17, 22, 27]) { k.line(x, 19, x + 1, 16, '#c8c0d8'); k.line(x + 1, 16, x, 13, '#c8c0d8'); }
      k.text('Z', 33, 9, 1, '#c8c0d8'); k.text('Z', 37, 13, 1, '#c8c0d8');
    },
    packed_house: k => tri(k, 24, 12, 5, 6, PIN),
    curator: k => { // trophies on a shelf
      k.box(8, 36, 32, 3, BROWN); const cup = (cx, h, c) => { k.poly([[cx - 4, 36 - h], [cx + 4, 36 - h], [cx + 2, 36 - h + 6], [cx - 2, 36 - h + 6]], c); k.r(cx - 1, 36 - h + 6, 2, h - 8, c); k.r(cx - 3, 34, 6, 2, c); };
      cup(13, 14, '#c8c8d8'); cup(24, 20, GOLD); cup(35, 12, '#d8884a'); k.sparkle(24, 11);
    },
    down_to_wire: k => stopwatch(k, 24, 28, -Math.PI / 2 - 0.15),
    steady: k => { // an anchor
      k.ring(24, 13, 3, INK, 3); k.ring(24, 13, 2, GREY, 1); k.oline(24, 16, 24, 40, GREY, 2); k.oline(17, 21, 31, 21, GREY, 2);
      let prev = null; for (let a = 0.2; a <= Math.PI - 0.2; a += 0.2) { const x = 24 + Math.cos(a) * 12, y = 30 + Math.sin(a) * 10; if (prev) k.oline(prev[0], prev[1], Math.round(x), Math.round(y), GREY, 2); prev = [Math.round(x), Math.round(y)]; }
      k.poly([[9, 30], [14, 29], [11, 34]], GREY); k.poly([[39, 30], [34, 29], [37, 34]], GREY);
    },
    spin_doctor: k => { // a spinning tornado
      for (let i = 0; i < 7; i++) { const w = 15 - i * 2, y = 12 + i * 4, x = 24 + Math.sin(i * 0.9) * 3; k.ell(Math.round(x), y, w, 2, INK); k.ell(Math.round(x), y, w - 1, 1, '#c8d0e0'); }
      k.pin(37, 30, 10); k.pin(10, 26, 10);
    },
    pearl_diver: k => { // an open clam with a pearl
      k.poly([[9, 30], [24, 41], [39, 30], [36, 26], [12, 26]], '#e8a0b0'); k.poly([[11, 24], [14, 12], [24, 9], [34, 12], [37, 24]], '#f2c0c8');
      for (const x of [18, 24, 30]) k.line(24, 22, x, 11, '#d08898'); k.disc(24, 29, 5, INK); k.disc(24, 29, 4, '#f8f4ff'); k.p(22, 27, '#ffffff');
    },
    bomb_squad: k => { // a bomb with a lit fuse
      k.disc(21, 29, 11, INK); k.disc(21, 29, 10, '#2a2a3a'); k.disc(17, 25, 3, '#5a5a6a'); k.box(25, 15, 6, 5, GREY2);
      k.line(30, 14, 34, 9, BROWN, 2); k.sparkle(36, 8, GOLD); k.p(38, 6, ORANGE); k.p(34, 5, ORANGE);
    },
    sweat_it_out: k => { // a sweating ball
      k.ball(22, 28, 10, '#d0a020', false); k.r(17, 26, 3, 2, INK); k.r(24, 26, 3, 2, INK); k.r(18, 33, 8, 1, INK); k.r(17, 22, 4, 1, INK); k.r(24, 21, 4, 1, INK);
      for (const [x, y] of [[34, 15], [37, 25], [10, 17]]) { k.poly([[x, y - 4], [x + 3, y + 1], [x, y + 3], [x - 3, y + 1]], BLUE); k.p(x - 1, y, '#ffffff'); }
    }
  };
  let col0 = '#000', col1 = '#000';
  // Draw a feat's icon if it has one. Returns false so the caller can fall back to the generic icon.
  GK.drawFeatIcon = function (ctx, featId, colors) {
    const fn = ICON[featId]; if (!fn) return false;
    col0 = colors[0]; col1 = colors[1];
    fn(GK.cardKit(ctx), colors);
    return true;
  };
  GK.FEAT_ICONS = ICON;
})();
