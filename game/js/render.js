// Gutter Kings — pseudo-3D pixel rendering of the 2D sim. Draws into a 200×356 buffer that the
// page scales up pixelated. Static lane art is rebuilt per alley theme.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const C = GK.C, W = C.W, H = C.H, P = GK.P, S0 = C.S0;
  // Pixel art on a 400×712 grid: the lane is laid out in 200×356 "lane units" and drawn at RS = 2
  // art pixels per unit. Every shape is snapped to whole art pixels (no anti-aliasing) and the
  // canvas is scaled up with nearest-neighbour, so pixels stay hard-edged squares.
  const RS = 2;
  let SNAP = RS; // art pixels per lane unit for the pixel primitives (the big TV uses 1)
  const sp = v => Math.round(v * SNAP) / SNAP;
  // Filled pixel disc, row by row.
  function pdisc(g, x, y, r, fill) {
    g.fillStyle = fill;
    if (r * SNAP < 0.75) { g.fillRect(Math.floor(x * SNAP) / SNAP, Math.floor(y * SNAP) / SNAP, 1 / SNAP, 1 / SNAP); return; }
    const y0 = Math.round((y - r) * SNAP), y1 = Math.round((y + r) * SNAP);
    for (let yi = y0; yi < y1; yi++) {
      const dy = (yi + 0.5) / SNAP - y; if (Math.abs(dy) > r) continue;
      const hw = Math.sqrt(r * r - dy * dy);
      let x0 = Math.round((x - hw) * SNAP), x1 = Math.round((x + hw) * SNAP); if (x1 <= x0) x1 = x0 + 1;
      g.fillRect(x0 / SNAP, yi / SNAP, (x1 - x0) / SNAP, 1 / SNAP);
    }
  }
  // Filled pixel ellipse (top half only with half = 'top').
  function pell(g, x, y, rx, ry, fill, half) {
    g.fillStyle = fill;
    const y0 = Math.round((y - ry) * SNAP), y1 = half === 'top' ? Math.round(y * SNAP) : Math.round((y + ry) * SNAP);
    for (let yi = y0; yi < y1; yi++) {
      const dy = ((yi + 0.5) / SNAP - y) / ry; if (Math.abs(dy) > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      let x0 = Math.round((x - hw) * SNAP), x1 = Math.round((x + hw) * SNAP); if (x1 <= x0) x1 = x0 + 1;
      g.fillRect(x0 / SNAP, yi / SNAP, (x1 - x0) / SNAP, 1 / SNAP);
    }
  }
  // Pixel line (stepped), w art pixels thick.
  function pline(g, x0, y0, x1, y1, fill, w = 1) {
    g.fillStyle = fill;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * SNAP));
    for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round((x0 + (x1 - x0) * t) * SNAP) / SNAP, Math.round((y0 + (y1 - y0) * t) * SNAP) / SNAP, w / SNAP, w / SNAP); }
  }
  // Crisp text: rendered once, alpha thresholded to hard pixels, with an optional 1-pixel outline.
  const textCache = new Map();
  function ptext(g, text, x, y, font, col, align, outline) {
    text = String(text);
    const key = SNAP + '|' + font + '|' + col + '|' + (outline || '') + '|' + text;
    let c = textCache.get(key);
    if (!c) {
      const size = parseFloat((/([\d.]+)px/.exec(font) || [0, 7])[1]);
      const m = document.createElement('canvas').getContext('2d'); m.font = font;
      const w = Math.ceil((m.measureText(text).width + 4) * SNAP), h = Math.ceil((size * 1.5 + 4) * SNAP);
      c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
      const t = c.getContext('2d'); t.setTransform(SNAP, 0, 0, SNAP, 0, 0); t.font = font; t.fillStyle = col; t.textBaseline = 'alphabetic';
      t.fillText(text, 2, size + 2);
      const id = t.getImageData(0, 0, c.width, c.height), d = id.data, W2 = c.width, H2 = c.height;
      const solid = new Uint8Array(W2 * H2);
      for (let i = 0; i < W2 * H2; i++) solid[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
      const n = parseInt(col.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
      const on = outline ? parseInt(outline.slice(1), 16) : 0;
      for (let i = 0; i < W2 * H2; i++) {
        const o = i * 4;
        if (solid[i]) { d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255; continue; }
        d[o + 3] = 0;
        if (outline) {
          const xx = i % W2, yy = (i / W2) | 0;
          for (let k = 0; k < 8; k++) { const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dy = [0, 0, 1, -1, 1, -1, 1, -1][k]; const nx = xx + dx, ny = yy + dy; if (nx >= 0 && ny >= 0 && nx < W2 && ny < H2 && solid[ny * W2 + nx]) { d[o] = on >> 16; d[o + 1] = (on >> 8) & 255; d[o + 2] = on & 255; d[o + 3] = 255; break; } }
        }
      }
      t.putImageData(id, 0, 0);
      c.size = size;
      if (textCache.size > 400) textCache.clear();
      textCache.set(key, c);
    }
    const w = c.width / SNAP, h = c.height / SNAP;
    const ox = align === 'center' ? w / 2 : align === 'right' ? w - 2 : 2;
    g.drawImage(c, sp(x - ox), sp(y - c.size - 2), w, h);
  }
  // Dither pass for static layers: posterizes colour (and alpha) with a 4×4 Bayer matrix, so soft
  // gradients become stepped, dithered pixel shading.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function pixelize(canvas, step, astep) {
    const g = canvas.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const id = g.getImageData(0, 0, canvas.width, canvas.height), d = id.data, w = canvas.width;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const t = (BAYER[((p / w | 0) & 3) * 4 + ((p % w) & 3)] + 0.5) / 16 - 0.5;
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((d[i + k] + t * step) / step) * step));
      if (astep) { const a = d[i + 3]; if (a > 0 && a < 255) d[i + 3] = Math.max(0, Math.min(255, Math.round((a + t * astep) / astep) * astep)); }
    }
    g.putImageData(id, 0, 0); g.restore();
  }
  const FONT_S = '700 7px Rubik, system-ui, sans-serif';
  const PROF = [[0, 0.3], [0.3, 0.5], [0.62, 0.2], [0.82, 0.28], [0.97, 0.14], [1, 0.05]];
  function prof(t) {
    for (let i = 1; i < PROF.length; i++) if (t <= PROF[i][0]) { const [t0, r0] = PROF[i - 1], [t1, r1] = PROF[i]; return r0 + (r1 - r0) * (t - t0) / (t1 - t0); }
    return 0.05;
  }
  // Convex polygon filled scanline by scanline on the art-pixel grid (no anti-aliased edges).
  function quad(g, a, b, c, d, fill) { ppoly(g, [a, b, c, d], fill); }
  function ppoly(g, pts, fill) {
    g.fillStyle = fill;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const y0 = Math.round(minY * SNAP), y1 = Math.round(maxY * SNAP);
    for (let yi = y0; yi < y1; yi++) {
      const yc = (yi + 0.5) / SNAP; let xl = Infinity, xr = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        if ((yc < p.y) === (yc < q.y)) continue;
        const x = p.x + (q.x - p.x) * (yc - p.y) / (q.y - p.y);
        xl = Math.min(xl, x); xr = Math.max(xr, x);
      }
      if (xl > xr) continue;
      const a0 = Math.round(xl * SNAP), a1 = Math.max(a0 + 1, Math.round(xr * SNAP));
      g.fillRect(a0 / SNAP, yi / SNAP, (a1 - a0) / SNAP, 1 / SNAP);
    }
  }

  // ---------- TV cartoons (screen is ~38×26 px) ----------
  // Each scene draws frame t (seconds) of a short loop. v picks a variant.
  const px = (cx, x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), w, h); };
  function caption(cx, sx, sy, sw, sh, txt, col, t) {
    if (t < 0.25) return;
    const y = sy + sh - 2, x = sx + sw / 2 + (t < 0.4 ? (0.4 - t) * 60 : 0);
    ptext(cx, txt, x, y, FONT_S, col, 'center', '#000000');
  }
  // A tiny pin: 3×8 with a red band. lean in radians.
  function tinyPin(cx, x, y, lean, face) {
    cx.save(); cx.translate(x, y); cx.rotate(lean || 0);
    px(cx, -1, -8, 3, 3, '#f2ebe0'); px(cx, -1, -5, 3, 1, '#c4243a'); px(cx, -2, -4, 5, 4, '#f2ebe0');
    if (face) { px(cx, -1, -7, 1, 1, '#000'); px(cx, 1, -7, 1, 1, '#000'); }
    cx.restore();
  }
  function bowler(cx, x, y, pose, shirt) {
    px(cx, x - 1, y - 12, 3, 3, '#e8c39a');
    px(cx, x - 2, y - 9, 5, 5, shirt);
    px(cx, x - 2, y - 4, 2, 4, '#2a2a4a'); px(cx, x + 1, y - 4, 2, 4, '#2a2a4a');
    if (pose === 0) { px(cx, x - 4, y - 12, 2, 4, '#e8c39a'); px(cx, x + 3, y - 12, 2, 4, '#e8c39a'); }
    else if (pose === 1) { px(cx, x - 5, y - 8, 3, 2, '#e8c39a'); px(cx, x + 3, y - 12, 2, 4, '#e8c39a'); }
    else { px(cx, x - 4, y - 12, 2, 4, '#e8c39a'); px(cx, x + 3, y - 8, 3, 2, '#e8c39a'); }
  }
  // The Regulars as tiny TV characters (about 6×14 px). pose: 0 idle, 1 throw, 2 cheer.
  const REG = {
    quinn: { shirt: '#7a1f35', skin: '#f2d2bc', hair: '#3a2618' },
    levi: { shirt: '#3a8ad0', skin: '#f0d0b8', hair: '#2a1c14' },
    kaleb: { shirt: '#8fb48f', skin: '#f0cdb0', hair: '#6a4528' }
  };
  function regular(cx, x, y, who, pose, t) {
    const c = REG[who];
    // legs and body
    px(cx, x - 2, y - 4, 2, 4, '#2a2a3a'); px(cx, x + 1, y - 4, 2, 4, '#2a2a3a');
    px(cx, x - 2, y - 9, 5, 5, c.shirt);
    if (who === 'levi') { px(cx, x, y - 9, 1, 5, '#5ab0f0'); px(cx, x - 2, y - 8, 1, 1, '#ffd23a'); px(cx, x + 2, y - 6, 1, 1, '#ffd23a'); }
    if (who === 'kaleb') px(cx, x - 2, y - 9, 1, 1, '#8a5a2a'), px(cx, x - 1, y - 8, 1, 1, '#8a5a2a'), px(cx, x, y - 7, 1, 1, '#8a5a2a');
    // head
    px(cx, x - 1, y - 13, 3, 4, c.skin);
    if (who === 'quinn') {
      px(cx, x - 2, y - 14, 5, 1, c.hair); px(cx, x - 2, y - 13, 1, 6, c.hair); px(cx, x + 2, y - 13, 1, 6, c.hair);
      px(cx, x, y - 10, 1, 1, '#8a4a2a');
      px(cx, x - 1, y - 12, 1, 1, '#111'); px(cx, x + 1, y - 12, 1, 1, '#111'); // shades
    } else if (who === 'levi') {
      px(cx, x - 1, y - 14, 3, 1, c.hair); px(cx, x, y - 16, 1, 2, c.hair); px(cx, x - 2, y - 13, 1, 2, c.hair);
      px(cx, x - 1, y - 12, 1, 1, '#000'); px(cx, x + 1, y - 12, 1, 1, '#000');
    } else {
      // messy curls: uneven bumps on top, loose curls down the sides
      px(cx, x - 2, y - 15, 5, 2, c.hair); px(cx, x - 2, y - 16, 1, 1, c.hair); px(cx, x + 1, y - 16, 2, 1, c.hair);
      px(cx, x - 3, y - 14, 1, 2, c.hair); px(cx, x - 2, y - 12, 1, 1, c.hair); px(cx, x - 3, y - 11, 1, 1, c.hair);
      px(cx, x + 3, y - 15, 1, 2, c.hair); px(cx, x + 2, y - 12, 1, 1, c.hair); px(cx, x + 3, y - 11, 1, 1, c.hair);
      px(cx, x, y - 16, 1, 1, '#8a6038');
      px(cx, x - 1, y - 12, 1, 1, '#000'); px(cx, x + 1, y - 12, 1, 1, '#000'); px(cx, x - 1, y - 10, 3, 1, '#ffffff');
    }
    // arms
    if (pose === 1) {
      if (who === 'quinn') { px(cx, x + 2, y - 8, 3, 1, c.skin); px(cx, x + 2, y - 7, 3, 1, c.skin); } // both hands on the ball
      else px(cx, x + 3, y - 8, 3, 1, c.skin);
    } else if (pose === 2) { px(cx, x - 3, y - 13 - (Math.floor(t * 8) % 2), 1, 4, c.skin); px(cx, x + 3, y - 13 - (Math.floor(t * 8 + 1) % 2), 1, 4, c.skin); }
    else { px(cx, x - 3, y - 9, 1, 4, c.skin); px(cx, x + 3, y - 9, 1, 4, c.skin); }
  }
  // Top-down mini lane for the hook cartoons: lane across the screen, pins on the right.
  function miniLane(cx, sx, sy, sw, t, hitT) {
    px(cx, sx + 8, sy + 6, sw - 8, 1, '#2a1416'); px(cx, sx + 8, sy + 18, sw - 8, 1, '#2a1416');
    px(cx, sx + 8, sy + 7, sw - 8, 11, '#d8a56b');
    for (let i = 0; i < 4; i++) px(cx, sx + 14 + i * 4, sy + 9 + i * 2 % 6, 1, 1, '#8a6a3a');
    const spots = [[30, 12], [32, 11], [32, 13], [34, 10], [34, 12], [34, 14], [36, 9], [36, 11], [36, 13], [36, 15]];
    spots.forEach(([x, y], i) => {
      if (t < hitT) { px(cx, sx + x, sy + y, 1, 1, '#ffffff'); }
      else { const k = t - hitT, a = i * 0.9; px(cx, sx + x + Math.cos(a) * k * 14, sy + y + Math.sin(a) * k * 9, 1, 1, '#ffffff'); }
    });
  }
  const TV_SCENES = {
    jackpot(cx, sx, sy, sw, sh, t, v, R) {
      px(cx, sx, sy, sw, sh, '#2a0a2a');
      const reels = (R && R.tvReels) || ['7', '7', '7'], syms = ['7', '$', '?', '♣', '★'];
      for (let i = 0; i < 3; i++) {
        const x = sx + 4 + i * 11, stop = 0.5 + i * 0.3, spinning = t < stop;
        px(cx, x, sy + 5, 9, 12, '#fff6e0'); px(cx, x, sy + 5, 9, 1, '#c8932a'); px(cx, x, sy + 16, 9, 1, '#c8932a');
        const s = spinning ? syms[Math.floor(t * 30 + i * 2) % syms.length] : reels[i];
        ptext(cx, s, x + 4.5, sy + 14, FONT_S, spinning ? '#8a6a8a' : (s === '7' ? '#ff3a5a' : '#2a8a3a'), 'center');
      }
      if (t > 1.1 && Math.floor(t * 6) % 2) for (let k = 0; k < 6; k++) px(cx, sx + (k * 7 + 3) % sw, sy + 2 + (k % 2) * 17, 1, 1, '#ffd447');
      caption(cx, sx, sy, sw, sh, t > 1.1 ? 'WINNER!' : 'SPIN!', '#ffd447', t);
    },
    // Quinn: two hands, outside line up the gutter, the ball hooks itself into the pocket.
    quinn(cx, sx, sy, sw, sh, t) {
      px(cx, sx, sy, sw, sh, '#2a0e18');
      miniLane(cx, sx, sy, sw, t, 1.35);
      const u = Math.min(1, t / 1.35), bx = sx + 10 + u * 20, by = sy + 17 - 4.5 * Math.pow(u, 2.6);
      if (t < 1.6) pdisc(cx, bx, by, 1.5, '#7a1f35');
      regular(cx, sx + 4, sy + 24, 'quinn', t < 0.25 ? 1 : 0, t);
      if (t > 1.4) ptext(cx, 'POCKET!', sx + sw / 2 + 2, sy + 5, FONT_S, '#ffd447', 'center', '#000000');
      caption(cx, sx, sy, sw, sh, 'QUINN', '#d86a86', t);
    },
    // Levi: the ball goes up, up... THUD. The screen shakes, the duck squeaks into the pins.
    levi(cx, sx, sy, sw, sh, t) {
      const shake = t > 0.7 && t < 1.0 ? Math.round(Math.sin(t * 90) * 1.5) : 0;
      sy += shake;
      px(cx, sx, sy - shake, sw, sh, '#10243a');
      px(cx, sx, sy + 19, sw, 2, '#d8a56b');
      for (let i = 0; i < 3; i++) tinyPin(cx, sx + 30 + i * 3, sy + 19, t > 1.5 ? (i - 1) * 1.2 : 0, true);
      let bx, by;
      if (t < 0.7) { const u = t / 0.7; bx = sx + 7 + u * 11; by = sy + 16 - 14 * 4 * u * (1 - u) * 0.8; }
      else { const u = Math.min(1, (t - 0.7) / 0.8); bx = sx + 18 + u * 12; by = sy + 17; }
      pdisc(cx, bx, by, 2, '#ffd23a'); px(cx, bx + 1, by - 1, 1, 1, '#000'); px(cx, bx + 2, by, 1, 1, '#ff8a1a');
      if (t > 0.7 && t < 1.2) { ptext(cx, 'THUD', sx + 19, sy + 7, FONT_S, '#ffd23a', 'center', '#000000'); px(cx, sx + 15, sy + 18, 1, 1, '#e8c890'); px(cx, sx + 21, sy + 18, 1, 1, '#e8c890'); }
      if (t > 1.5 && t < 2.2) ptext(cx, 'SQUEAK', sx + 22, sy + 7, FONT_S, '#ffffff', 'center', '#000000');
      regular(cx, sx + 4, sy + 21, 'levi', t < 0.3 ? 1 : t > 1.6 ? 2 : 0, t);
      caption(cx, sx, sy - shake, sw, sh, 'LEVI', '#ffd23a', t);
    },
    // Kaleb: out wide to one side, then the hook brings it all the way back across.
    kaleb(cx, sx, sy, sw, sh, t) {
      px(cx, sx, sy, sw, sh, '#14281a');
      miniLane(cx, sx, sy, sw, t, 1.45);
      const u = Math.min(1, t / 1.45), bx = sx + 10 + u * 20, by = sy + 12 + 5.2 * Math.sin(u * Math.PI * 1.15) * (1 - u * 0.15);
      if (t < 1.7) { pdisc(cx, bx, by, 1.5, '#7fae84'); for (let k = 1; k < 5; k++) { const uu = Math.max(0, u - k * 0.05); px(cx, sx + 10 + uu * 20, sy + 12 + 5.2 * Math.sin(uu * Math.PI * 1.15) * (1 - uu * 0.15), 1, 1, 'rgba(255,255,255,0.35)'); } }
      regular(cx, sx + 4, sy + 24, 'kaleb', t < 0.25 ? 1 : t > 1.6 ? 2 : 0, t);
      if (t > 0.3 && t < 1.2) ptext(cx, 'WIDE!', sx + sw / 2 + 2, sy + 5, FONT_S, '#ffffff', 'center', '#000000');
      if (t > 1.5) ptext(cx, 'BACK!', sx + sw / 2 + 2, sy + 5, FONT_S, '#ffd447', 'center', '#000000');
      caption(cx, sx, sy, sw, sh, 'KALEB', '#a8e0a8', t);
    },
    strike(cx, sx, sy, sw, sh, t, v) {
      px(cx, sx, sy, sw, sh, v % 2 ? '#2a1446' : '#14324a');
      if (v % 2 === 0) {
        // ball smashes three pins that fly off spinning
        px(cx, sx, sy + 17, sw, 2, '#d8a56b');
        const bx = sx - 6 + Math.min(t, 0.7) / 0.7 * 26;
        pdisc(cx, bx, sy + 14, 3, '#2b4fb8');
        [[24, -1], [28, 0.4], [32, 1]].forEach(([x, d], i) => {
          if (t < 0.65) tinyPin(cx, sx + x, sy + 17, 0, true);
          else { const k = t - 0.65; tinyPin(cx, sx + x + d * 18 * k, sy + 17 - 40 * k + 35 * k * k, k * 9 * (d || 1), true); }
        });
        if (t > 0.7 && t < 1.2) { cx.fillStyle = '#fff'; for (let k = 0; k < 8; k++) { const a = k * 0.8; px(cx, sx + 26 + Math.cos(a) * (t - 0.7) * 30, sy + 12 + Math.sin(a) * (t - 0.7) * 20, 1, 1, '#ffd447'); } }
        caption(cx, sx, sy, sw, sh, 'STRIKE!', '#ffd447', t);
      } else {
        // the bowler's victory dance
        const pose = Math.floor(t * 6) % 3, hop = Math.abs(Math.sin(t * 9)) * 3;
        bowler(cx, sx + sw / 2, sy + 19 - hop, pose, '#ff5a6e');
        for (let k = 0; k < 5; k++) px(cx, sx + ((k * 9 + t * 40) % sw), sy + ((k * 7 + t * 25) % 14), 1, 1, ['#ffd447', '#7be38a', '#39c6d6'][k % 3]);
        caption(cx, sx, sy, sw, sh, 'X X X', '#ffd447', t);
      }
    },
    double(cx, sx, sy, sw, sh, t) {
      px(cx, sx, sy, sw, sh, '#1d3a2a');
      // two balls roll in and bump: high five!
      const k = Math.min(1, t / 0.8), off = (1 - k) * 16;
      pdisc(cx, sx + sw / 2 - 5 - off, sy + 12, 4, '#2b4fb8');
      pdisc(cx, sx + sw / 2 + 5 + off, sy + 12, 4, '#d9609a');
      if (t > 0.8) { px(cx, sx + sw / 2 - 1, sy + 4 - (t - 0.8) * 4, 2, 2, '#fff'); px(cx, sx + sw / 2 - 4, sy + 6, 1, 1, '#ffd447'); px(cx, sx + sw / 2 + 3, sy + 6, 1, 1, '#ffd447'); }
      caption(cx, sx, sy, sw, sh, 'DOUBLE!', '#7be38a', t);
    },
    turkey(cx, sx, sy, sw, sh, t) {
      px(cx, sx, sy, sw, sh, '#3a2410');
      // a turkey struts across, gobbling
      const x = sx + 4 + ((t * 14) % (sw - 6)), bob = Math.floor(t * 8) % 2;
      ['#c4243a', '#ffb547', '#7be38a', '#c4243a'].forEach((c, i) => px(cx, x - 6 + i * 2, sy + 6 - (i % 2), 2, 6, c));
      px(cx, x - 4, sy + 9, 8, 6, '#8a5a2a'); px(cx, x + 3, sy + 6 - bob, 3, 4, '#8a5a2a');
      px(cx, x + 5, sy + 7 - bob, 2, 1, '#ffb547'); px(cx, x + 5, sy + 8 - bob, 1, 2, '#c4243a');
      px(cx, x - 2, sy + 15, 1, 3, '#ffb547'); px(cx, x + 1, sy + 15, 1, 3, '#ffb547');
      if (Math.floor(t * 3) % 2) ptext(cx, 'GOBBLE', sx + 1, sy + 7, FONT_S, '#ffffff', 'left');
      caption(cx, sx, sy, sw, sh, 'TURKEY!', '#ffb547', t);
    },
    spare(cx, sx, sy, sw, sh, t, v) {
      px(cx, sx, sy, sw, sh, '#2a2a3a');
      px(cx, sx, sy + 18, sw, 2, '#d8a56b');
      if (v % 2 === 0) {
        // the last pin waves a white flag, then faints
        const faint = t > 1.6 ? Math.min(1.5, (t - 1.6) * 3) : 0;
        tinyPin(cx, sx + sw / 2, sy + 18, faint, true);
        if (!faint) { const wv = Math.sin(t * 10) * 2; px(cx, sx + sw / 2 + 3, sy + 4, 1, 10, '#a8949f'); px(cx, sx + sw / 2 + 4, sy + 4 + wv * 0.3, 6, 4, '#fff'); }
        else ptext(cx, 'x_x', sx + sw / 2 + 8, sy + 9, FONT_S, '#ffffff', 'center');
      } else {
        // the bowler fist-pumps
        const pose = Math.floor(t * 5) % 2 ? 1 : 2;
        bowler(cx, sx + sw / 2, sy + 18, pose, '#39c6d6');
      }
      caption(cx, sx, sy, sw, sh, 'SPARE /', '#39c6d6', t);
    },
    split(cx, sx, sy, sw, sh, t) {
      px(cx, sx, sy, sw, sh, '#3a1430');
      px(cx, sx, sy + 18, sw, 2, '#d8a56b');
      // a pin does the splits (and regrets it)
      const k = Math.min(1, t / 0.7), x = sx + sw / 2, y = sy + 15 + k * 2;
      px(cx, x - 1, y - 9, 3, 3, '#f2ebe0'); px(cx, x - 1, y - 6, 3, 1, '#c4243a'); px(cx, x - 2, y - 5, 5, 4, '#f2ebe0');
      px(cx, x - 2 - k * 7, y - 1, 3 + k * 7, 2, '#f2ebe0'); px(cx, x + 1, y - 1, 3 + k * 7, 2, '#f2ebe0');
      px(cx, x - 1, y - 8, 1, 1, '#000'); px(cx, x + 1, y - 8, 1, 1, '#000');
      if (t > 0.8) { px(cx, x - 1, y - 5 + 1, 3, 1, '#000'); if (Math.floor(t * 4) % 2) ptext(cx, 'OUCH', x, sy + 6, FONT_S, '#ffd447', 'center'); }
      caption(cx, sx, sy, sw, sh, 'SPLIT!', '#ff9ef0', t);
    },
    seven10(cx, sx, sy, sw, sh, t) {
      px(cx, sx, sy, sw, sh, '#140a2a');
      px(cx, sx, sy + 18, sw, 2, '#d8a56b');
      // the 7 and 10 pins run to each other and hug, hearts pop
      const k = Math.min(1, t / 0.9);
      tinyPin(cx, sx + 4 + k * 13, sy + 18, Math.sin(t * 20) * 0.2 * (1 - k), true);
      tinyPin(cx, sx + sw - 4 - k * 13, sy + 18, Math.sin(t * 20 + 1) * 0.2 * (1 - k), true);
      if (t > 0.9) for (let i = 0; i < 3; i++) { const yy = sy + 8 - ((t - 0.9) * 10 + i * 4) % 10, xx = sx + sw / 2 - 3 + i * 3; px(cx, xx, yy, 1, 1, '#ff5a6e'); px(cx, xx + 2, yy, 1, 1, '#ff5a6e'); px(cx, xx, yy + 1, 3, 1, '#ff5a6e'); px(cx, xx + 1, yy + 2, 1, 1, '#ff5a6e'); }
      for (let i = 0; i < 6; i++) { const a = i + t * 2; px(cx, sx + sw / 2 + Math.cos(a) * 15, sy + 9 + Math.sin(a) * 7, 1, 1, '#ffd447'); }
      caption(cx, sx, sy, sw, sh, '7-10!!', '#ffd447', t);
    }
  };

  class Renderer {
    constructor(canvas) {
      this.cv = canvas; canvas.width = W * RS; canvas.height = H * RS;
      this.cx = canvas.getContext('2d'); this.cx.imageSmoothingEnabled = false;
      const mk = () => { const c = document.createElement('canvas'); c.width = W * RS; c.height = H * RS; return c; };
      this.bg = mk(); this.dark = mk(); this.oilCv = mk(); this.vig = mk();
      this.buildVignette();
      this.pops = []; this.shake = 0; this.flash = 0; this.parts = [];
      this.theme = null;
    }
    // Vignette baked as dithered steps so it stays pixel art.
    buildVignette() {
      const g = this.vig.getContext('2d'); g.setTransform(RS, 0, 0, RS, 0, 0);
      const gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.28, W / 2, H * 0.55, H * 0.78);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.4)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      pixelize(this.vig, 255, 34);
    }
    circle(x, y, r, fill) { pdisc(this.cx, x, y, Math.max(0.3, r), fill); }
    pop(x, z, h, text, col) { this.pops.push({ x, z, h, text, col, t: 0 }); if (this.pops.length > 40) this.pops.shift(); }
    // Endless lanes: holes, tentacles, ash, wind, the Void's pull.
    drawEndlessLane(st, L, time) {
      const cx = this.cx, lhw = this.lhw;
      for (const h of Array.isArray(L.holes) ? L.holes : []) {
        const q = P(h.x, h.z), rx = h.r * S0 * q.s, ry = rx * 0.42;
        pell(cx, q.x, q.y, rx + 1, ry + 1, '#4a3a2a'); pell(cx, q.x, q.y, rx, ry, '#0a0604'); pell(cx, q.x, q.y + ry * 0.3, rx * 0.7, ry * 0.5, '#000000');
      }
      if (L.ash) for (let i = 0; i < 70; i++) { const x = ((i * 37.7) % (2 * lhw)) - lhw, z = (i * 53.3 + time * 4) % 300; const q = P(x, z); cx.fillStyle = i % 3 ? 'rgba(90,90,90,0.55)' : 'rgba(150,140,130,0.5)'; cx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      // the Kraken's warning shadows: the lane darkens where a tentacle is about to land
      if (L.kraken && st.sim && st.sim.tentacles) for (const tn of st.sim.tentacles) {
        const s = GK.tentacleState(tn, st.sim.time);
        if (s.phase !== 'wind') continue;
        const x0 = tn.side * lhw, x1 = tn.side * (lhw - tn.reach);
        cx.globalAlpha = 0.15 + 0.4 * s.k;
        ppoly(cx, [P(x0, tn.z - 5), P(x1, tn.z - 3), P(x1, tn.z + 3), P(x0, tn.z + 5)], '#140818');
        cx.globalAlpha = 1;
      }
      if (L.wind && st.sim) {
        const dir = Math.sign(Math.sin(st.sim.time * 0.9 + (st.sim.windPh || 0))) || 1;
        for (let i = 0; i < 9; i++) { const z = 30 + i * 30, x = (((time * 40 * dir + i * 13) % (2 * lhw + 10)) + 2 * lhw + 10) % (2 * lhw + 10) - lhw - 5; const a = P(x, z, 6), b = P(x - dir * 6, z, 6); pline(cx, a.x, a.y, b.x, b.y, 'rgba(230,245,255,0.55)', 1); }
      }
      if (L.voidPull) for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, z = (i * 23 + time * 30) % 300, x = side * (lhw - 2 + ((time * 6 + i) % 4)); const q = P(x, z); cx.fillStyle = i % 3 ? '#c88aff' : '#ffffff'; cx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
    }
    // A Kraken tentacle. Idle: it sways in the gutter, curling and uncurling. Wind-up: it rears up
    // high. Down: it lies across the lane, writhing (with a squash and a splash as it lands).
    // Back: it peels off the lane into the gutter.
    drawTentacle(tn, simT, time) {
      const cx = this.cx, lhw = this.lhw, N = 12, side = tn.side, s = GK.tentacleState(tn, simT);
      const baseX = side * (lhw + this.gut * 0.55);
      const idle = u => ({
        x: baseX - side * u * 3 + Math.sin(time * 2 + tn.ph + u * 3) * 1.6 * u,
        z: tn.z + Math.sin(time * 1.3 + tn.ph + u * 2) * 2.2 * u,
        h: u * 15 + Math.sin(time * 2.4 + tn.ph + u * 4) * 2.4 * u + (u > 0.75 ? Math.sin((u - 0.75) * 12 + time * 3) * 2 : 0)
      });
      const reared = (u, k) => { const a = idle(u), shake = k > 0.7 ? Math.sin(time * 40) * 0.6 : 0; return { x: a.x + side * u * 6 * k + shake, z: a.z - u * 6 * k, h: a.h + u * u * 38 * k }; };
      const lying = u => {
        const since = s.since || 0, squash = since < 0.15 ? 1 - since / 0.15 : 0;
        return {
          x: baseX - side * u * (tn.reach + this.gut * 0.55),
          z: tn.z + Math.sin(time * 9 + u * 6 + tn.ph) * 0.7 * u,
          h: (u < 0.15 ? (0.15 - u) * 14 : 0) + 1.4 + Math.abs(Math.sin(time * 7 + u * 8)) * 0.6 * u + squash * 3 * Math.sin(u * Math.PI)
        };
      };
      const pt = u => {
        if (s.phase === 'wind') return reared(u, s.k);
        if (s.phase === 'down') return lying(u);
        if (s.phase === 'back') { const a = lying(u), b = idle(u), k = s.k * s.k; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: a.h + (b.h - a.h) * k }; }
        return idle(u);
      };
      const pts = []; for (let j = 0; j <= N; j++) { const u = j / N, p = pt(u); pts.push({ u, q: P(p.x, p.z, p.h), p }); }
      // shadow on the lane when it lies across it
      if (s.phase === 'down') { const a = P(pts[0].p.x, tn.z + 1.5), b = P(pts[N].p.x, tn.z + 1.5); pline(cx, a.x, a.y, b.x, b.y, 'rgba(10,4,14,0.35)', 3); }
      const body = '#7a3a8a', dark = '#4e1c5c', light = '#b46ac4', sucker = '#f2c4ea';
      const rad = u => (2.7 * (1 - u) + 0.6) * S0;
      for (const { u, q } of pts) this.circle(q.x, q.y, rad(u) * q.s + 0.7, dark);
      for (const { u, q } of pts) { this.circle(q.x, q.y, rad(u) * q.s, body); this.circle(q.x - rad(u) * q.s * 0.3, q.y - rad(u) * q.s * 0.35, rad(u) * q.s * 0.45, light); }
      // suckers along the underside
      for (let j = 1; j < N; j += 2) { const { u, q } = pts[j], r = rad(u) * q.s; this.circle(q.x + r * 0.15, q.y + r * 0.45, Math.max(0.6, r * 0.32), sucker); }
      // the splash as it hits the lane
      if (s.phase === 'down' && s.since < 0.35) {
        const k = s.since / 0.35;
        cx.globalAlpha = 1 - k;
        for (let i = 0; i < 10; i++) { const u = i / 9, p = lying(u), q = P(p.x + Math.sin(i * 2.3) * 3 * k, tn.z + Math.cos(i * 1.7) * 4 * k, 2 + 10 * k * (1 - k) * 4); this.circle(q.x, q.y, 1, i % 2 ? '#bff0ff' : '#ffffff'); }
        cx.globalAlpha = 1;
      }
    }

    // Cosmetics from the Locker: trail, pin skin, lane finish, crowd hats.
    setCosmetics(c) {
      this.cosm = c || {};
      const sk = GK.cosmetic && GK.cosmetic('pins', this.cosm.pins);
      this.pinSkin = sk && sk.id !== 'classic' ? Object.assign({}, GK.PINS.std, { body: sk.body, shade: sk.shade, band: sk.band }) : null;
      this.laneFin = GK.cosmetic && GK.cosmetic('lane', this.cosm.lane);
      this.trail = [];
    }
    // Lane finish: a colour wash over the lane and deck.
    drawLaneFinish() {
      const f = this.laneFin; if (!f || !f.tint) return;
      const cx = this.cx, L = this.lhw;
      const pts = [P(-L, -12), P(L, -12), P(L, C.ZH + 34), P(-L, C.ZH + 34)];
      cx.save(); cx.globalCompositeOperation = f.mode || 'color';
      ppoly(cx, pts, f.tint);
      cx.restore();
      if (f.grid) { cx.globalAlpha = 0.22; for (let z = 0; z < C.ZH + 30; z += 24) { const a = P(-L, z), b = P(L, z); pline(cx, a.x, a.y, b.x, b.y, f.grid, 1); } for (let x = -L; x <= L; x += L / 4) { const a = P(x, -12), b = P(x, C.ZH + 30); pline(cx, a.x, a.y, b.x, b.y, f.grid, 1); } cx.globalAlpha = 1; }
    }
    // Ball trails: remember where the main ball has been and draw a style behind it.
    drawTrail(st) {
      const style = this.cosm && this.cosm.trail, sim = st.sim;
      if (!style || style === 'none' || !sim) { this.trail = []; return; }
      const b = sim.balls.find(q => q.kind === 'main' && !q.gone && !(q.delay > 0));
      const now = st.time;
      if (b && (st.phase === 'rolling' || st.phase === 'replay')) {
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(b.x - last.x, b.z - last.z) > 2.2) this.trail.push({ x: b.x, z: b.z, h: (b.r || 4) + (b.lift || 0), t: now, r: b.r || 4 });
      }
      const life = style === 'comet' ? 0.9 : 0.6;
      this.trail = this.trail.filter(p => now - p.t < life && now >= p.t);
      const cx = this.cx, n = this.trail.length;
      this.trail.forEach((p, i) => {
        const k = 1 - (now - p.t) / life, q = P(p.x, p.z, p.h * 0.7), s = q.s * S0, R0 = p.r * s;
        if (k <= 0) return;
        cx.globalAlpha = Math.min(1, k * 1.2);
        switch (style) {
          case 'sparkle': {
            // bright four-point glints scattered around the path, twinkling on and off
            const on = (i * 7 + Math.floor(now * 14)) % 4;
            if (on < 2) {
              const ox = Math.round(q.x + Math.sin(i * 7.3) * R0 * 1.3), oy = Math.round(q.y + Math.cos(i * 5.1) * R0 * 0.9), big = on === 0 && k > 0.4;
              cx.fillStyle = i % 3 ? '#ffffff' : '#bfe8ff';
              cx.fillRect(ox, oy - (big ? 3 : 2), 1, big ? 7 : 5); cx.fillRect(ox - (big ? 3 : 2), oy, big ? 7 : 5, 1);
              if (big) { cx.fillRect(ox - 1, oy - 1, 3, 3); }
            }
            break;
          }
          case 'fire': this.circle(q.x, q.y, R0 * 0.75 * k, k > 0.6 ? '#ffd447' : k > 0.3 ? '#ff8a2a' : '#c83a1a'); break;
          case 'bubbles': if (i % 2 === 0) { pdisc(cx, q.x + Math.sin(i) * R0 * 0.5, q.y - (1 - k) * 6, R0 * 0.35 + 0.8, '#bff4ff'); pdisc(cx, q.x + Math.sin(i) * R0 * 0.5, q.y - (1 - k) * 6, R0 * 0.35, 'rgba(60,140,180,0.5)'); } break;
          case 'smoke': this.circle(q.x, q.y - (1 - k) * 5, R0 * (1.1 - k * 0.5), 'rgba(150,150,165,' + (0.35 * k) + ')'); break;
          case 'rainbow': this.circle(q.x, q.y, R0 * 0.6, 'hsl(' + ((i * 25 + now * 200) % 360) + ',90%,62%)'); break;
          case 'stars': {
            // a soft gold dust streak along the path...
            if (i > 0) { const a = this.trail[i - 1], qa = P(a.x, a.z, a.h * 0.7); pline(cx, qa.x, qa.y, q.x, q.y, k > 0.5 ? '#ffd447' : '#c8932a', Math.max(1, Math.round(R0 * 0.5 * k))); }
            // ...and every few points a big five-point star that floats up and spins
            if (i % 5 === 0) {
              const sx2 = q.x + Math.sin(i * 1.7) * R0 * 0.8, sy2 = q.y - (1 - k) * 14, sz = 2.6 + k * 1.6, rot = (1 - k) * 3 + i;
              const pts = [];
              for (let j = 0; j < 10; j++) { const ang = rot + j * Math.PI / 5 - Math.PI / 2, rr = j % 2 ? sz * 0.45 : sz; pts.push({ x: sx2 + Math.cos(ang) * rr, y: sy2 + Math.sin(ang) * rr }); }
              ppoly(cx, pts, '#ffe066');
              cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(sx2), Math.round(sy2), 1, 1);
            }
            break;
          }
          case 'hearts': if (i % 3 === 0) { cx.fillStyle = '#ff5a8a'; const ox = Math.round(q.x), oy = Math.round(q.y - (1 - k) * 6); cx.fillRect(ox - 2, oy, 2, 2); cx.fillRect(ox + 1, oy, 2, 2); cx.fillRect(ox - 1, oy + 2, 3, 1); cx.fillRect(ox, oy + 3, 1, 1); } break;
          case 'pixels': { cx.fillStyle = ['#39c6d6', '#ff5a6e', '#ffd447', '#7be38a'][i % 4]; const z = Math.max(1, Math.round(R0 * 0.6 * k)); cx.fillRect(Math.round(q.x - z / 2), Math.round(q.y - z / 2), z, z); break; }
          case 'lightning': if (i > 0) {
            // a crackling bolt: jagged, with a blue glow under a white core
            const a = this.trail[i - 1], jx = Math.sin(i * 3.3 + Math.floor(now * 18)) * 2.2;
            const qa = P(a.x + jx, a.z, a.h * 0.7), qb = P(p.x - jx, p.z, p.h * 0.7);
            pline(cx, qa.x, qa.y, qb.x, qb.y, '#6ab8ff', 3);
            pline(cx, qa.x, qa.y, qb.x, qb.y, k > 0.5 ? '#ffffff' : '#fff6a0', 1);
          } break;
          case 'ducks': if (i % 4 === 0) { const ox = Math.round(q.x), oy = Math.round(q.y); cx.fillStyle = '#ffd23a'; cx.fillRect(ox - 2, oy, 4, 2); cx.fillRect(ox, oy - 2, 2, 2); cx.fillStyle = '#ff8a1a'; cx.fillRect(ox + 2, oy - 1, 1, 1); } break;
          case 'void': { const a = now * 6 + i; pdisc(cx, q.x + Math.cos(a) * R0 * 0.7, q.y + Math.sin(a) * R0 * 0.4, Math.max(0.6, R0 * 0.35 * k), i % 2 ? '#c88aff' : '#4a2a8a'); break; }
          case 'comet': if (i > 0) { const a = this.trail[i - 1], qa = P(a.x, a.z, a.h * 0.7); pline(cx, qa.x, qa.y, q.x, q.y, k > 0.5 ? '#ffffff' : '#9fd8ff', Math.max(1, Math.round(R0 * k))); } break;
        }
      });
      cx.globalAlpha = 1;
    }
    // Crowd hats for Kaleb, Quinn and Levi. (x, hy) is the centre of the head.
    drawHat(style, x, hy, i, time) {
      const cx = this.cx, r = (a, b, w, h, c) => { cx.fillStyle = c; cx.fillRect(sp(a), sp(b), w, h); };
      const top = hy - 3.6 - (i === 0 ? 2.2 : 0);
      switch (style) {
        case 'party': ppoly(cx, [{ x: x - 2.6, y: top + 1 }, { x: x + 2.6, y: top + 1 }, { x: x, y: top - 7 }], ['#ff5a6e', '#39c6d6', '#7be38a'][i]); cx.fillStyle = '#ffffff'; cx.fillRect(sp(x - 1.6), sp(top - 2), 3, 1); this.circle(x, top - 7.5, 1, '#ffd447'); break;
        case 'beanie': pell(cx, x, top + 1, 3.6, 3.4, ['#c84a5a', '#3a6ad9', '#e0b028'][i], 'top'); cx.fillStyle = '#f2ebe0'; cx.fillRect(sp(x - 3.6), sp(top), 7, 1); this.circle(x, top - 3, 1.2, '#f2ebe0'); break;
        case 'cowboy': pell(cx, x, top + 1, 6, 1.4, '#6a4224'); r(x - 2.6, top - 3, 5.2, 4, '#7a4e2a'); cx.fillStyle = '#3a2414'; cx.fillRect(sp(x - 2.6), sp(top), 5, 1); break;
        case 'tophat': pell(cx, x, top + 1, 4.6, 1.2, '#141018'); r(x - 2.6, top - 6, 5.2, 7, '#141018'); cx.fillStyle = '#c4243a'; cx.fillRect(sp(x - 2.6), sp(top - 1), 5, 1); break;
        case 'propeller': { pell(cx, x, top + 1, 3.6, 3, '#3a6ad9', 'top'); cx.fillStyle = '#ffd447'; cx.fillRect(sp(x - 0.5), sp(top - 3), 1, 2); const a = Math.sin(time * 30) * 4; pline(cx, x - a, top - 3.5, x + a, top - 3.5, '#ff5a6e', 1); break; }
        case 'chef': for (const [dx, dy] of [[-2, -3], [0, -4.5], [2, -3]]) this.circle(x + dx, top + dy, 2.2, '#ffffff'); r(x - 3, top - 1, 6, 2, '#ece8e0'); break;
        case 'viking': pell(cx, x, top + 1.5, 3.8, 3.4, '#8a8a96', 'top'); pline(cx, x - 3.4, top, x - 5.5, top - 4, '#f2ebe0', 2); pline(cx, x + 3.4, top, x + 5.5, top - 4, '#f2ebe0', 2); cx.fillStyle = '#c8932a'; cx.fillRect(sp(x - 3.6), sp(top + 1), 7, 1); break;
        case 'bunny': for (const d of [-1.6, 1.6]) { pell(cx, x + d, top - 4, 1.2, 4, '#f4f0f4'); pell(cx, x + d, top - 4, 0.6, 3, '#ffb0c8'); } break;
        case 'halo': pell(cx, x, top - 3 + Math.sin(time * 3 + i) * 0.6, 3.4, 1.1, '#ffe066'); pell(cx, x, top - 3 + Math.sin(time * 3 + i) * 0.6, 2.2, 0.5, 'rgba(0,0,0,0)'); break;
        case 'crown': ppoly(cx, [{ x: x - 3, y: top + 1 }, { x: x + 3, y: top + 1 }, { x: x + 3, y: top - 3 }, { x: x + 1.5, y: top - 1 }, { x: x, y: top - 4 }, { x: x - 1.5, y: top - 1 }, { x: x - 3, y: top - 3 }], '#f2c94c'); cx.fillStyle = '#ff5a6e'; cx.fillRect(sp(x - 0.5), sp(top - 0.5), 1, 1); break;
      }
    }
    // confetti raining down over the pin deck
    confetti(n = 40) {
      const cols = ['#ffd447', '#ff5a6e', '#39c6d6', '#7be38a', '#b58cff', '#ffffff'];
      for (let i = 0; i < n; i++) this.parts.push({ x: (Math.random() * 2 - 1) * 26, z: C.ZH - 30 + Math.random() * 60, h: 30 + Math.random() * 30, vx: (Math.random() - 0.5) * 30, vz: (Math.random() - 0.5) * 20, vh: 10 + Math.random() * 40, col: cols[i % cols.length], t: 0, life: 1.1 + Math.random() * 0.8, conf: true });
    }
    burst(x, z, col, n = 8, sp = 40) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random()); this.parts.push({ x, z, h: 6, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: 30 + Math.random() * 40, col, t: 0, life: 0.5 + Math.random() * 0.4 }); }
    }

    setTheme(def, lhw, gut, oil) {
      this.theme = def.theme; this.lhw = lhw; this.gut = gut; this.oil = oil || (def.lane && def.lane.oil) || 'house';
      this.signText = def.name.toUpperCase(); this.subText = def.sub;
      this.buildStatic();
    }

    buildStatic() {
      const g = this.bg.getContext('2d'), T = this.theme, LHW = this.lhw, GUT = this.gut;
      g.setTransform(RS, 0, 0, RS, 0, 0); g.clearRect(0, 0, W, H);
      // retro alley carpet: diamonds and dots
      g.fillStyle = T.carpet; g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) {
        g.fillStyle = T.c1; g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + 11, y + 6); g.lineTo(x + 6, y + 12); g.lineTo(x + 1, y + 6); g.closePath(); g.fill();
        pdisc(g, x + 6, y + 6, 1.4, T.c2);
      }
      const E = LHW + GUT;
      quad(g, P(-E, -60), P(E, -60), P(E, 0), P(-E, 0), shade(T.wood[0], -0.12));
      const nb = Math.round(LHW * 2 / 1.064);
      for (let i = 0; i < nb; i++) { const x0 = -LHW + i * 2 * LHW / nb; if (i % 2) quad(g, P(x0, -60), P(x0 + 1.06, -60), P(x0 + 1.06, 0), P(x0, 0), shade(T.wood[0], -0.17)); }
      for (const zz of [-14, -32]) for (const bd of [3, 5, 8, 11, 14]) for (const s of [-1, 1]) { const q = P(s * (LHW - bd * 1.064), zz); g.fillStyle = '#3c2416'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      quad(g, P(-E, C.ZBACK), P(E, C.ZBACK), P(E, C.ZBACK + 18), P(-E, C.ZBACK + 18), '#0a070b');
      quad(g, P(-E, C.ZBACK + 18), P(E, C.ZBACK + 18), P(E, C.ZBACK + 18, 34), P(-E, C.ZBACK + 18, 34), '#1a1320');
      for (let i = -28; i <= 28; i += 4) { const a = P(i, C.ZBACK + 18), b = P(i, C.ZBACK + 18, 34); g.fillStyle = '#251b2b'; g.fillRect(Math.round(a.x), Math.round(b.y), 1, Math.round(a.y - b.y)); }
      for (const s of [-1, 1]) {
        quad(g, P(s * LHW, 0), P(s * E, 0), P(s * E, C.ZBACK), P(s * LHW, C.ZBACK), '#1f1b24');
        quad(g, P(s * (LHW + GUT * 0.15), 0), P(s * (LHW + GUT * 0.85), 0), P(s * (LHW + GUT * 0.85), C.ZBACK), P(s * (LHW + GUT * 0.15), C.ZBACK), '#2a2531');
        quad(g, P(s * (LHW + GUT * 0.35), 0), P(s * (LHW + GUT * 0.65), 0), P(s * (LHW + GUT * 0.65), C.ZBACK), P(s * (LHW + GUT * 0.35), C.ZBACK), '#15121a');
        quad(g, P(s * (LHW + GUT * 0.12), 0), P(s * (LHW + GUT * 0.2), 0), P(s * (LHW + GUT * 0.2), C.ZBACK), P(s * (LHW + GUT * 0.12), C.ZBACK), 'rgba(255,255,255,0.08)');
      }
      for (let i = 0; i < nb; i++) {
        const x0 = -LHW + i * 2 * LHW / nb, x1 = x0 + 2 * LHW / nb;
        quad(g, P(x0, 0), P(x1, 0), P(x1, C.ZBACK), P(x0, C.ZBACK), T.wood[(i * 7) % T.wood.length]);
      }
      // grain flecks
      const rng = GK.makeRng(GK.hash(this.signText));
      // wood grain: short dark streaks along the boards
      for (let i = 0; i < 420; i++) { const x = (rng() * 2 - 1) * LHW, z = rng() * C.ZBACK, q = P(x, z), q2 = P(x, z + 3 + rng() * 6); pline(g, q.x, q.y, q2.x, q2.y, rng() < 0.5 ? 'rgba(80,40,10,0.22)' : 'rgba(255,235,200,0.12)'); }
      quad(g, P(-LHW, C.ZH - 12), P(LHW, C.ZH - 12), P(LHW, C.ZBACK), P(-LHW, C.ZBACK), 'rgba(255,236,200,0.18)');
      // lane lighting: a soft gloss down the middle and a warm pool of light on the pin deck
      g.save(); g.beginPath(); const l0 = P(-LHW, 0), l1 = P(LHW, 0), l2 = P(LHW, C.ZBACK), l3 = P(-LHW, C.ZBACK);
      g.moveTo(l0.x, l0.y); g.lineTo(l1.x, l1.y); g.lineTo(l2.x, l2.y); g.lineTo(l3.x, l3.y); g.closePath(); g.clip();
      const gl = g.createLinearGradient(l0.x, 0, l1.x, 0);
      gl.addColorStop(0, 'rgba(0,0,0,0.18)'); gl.addColorStop(0.35, 'rgba(255,245,225,0.06)'); gl.addColorStop(0.5, 'rgba(255,250,235,0.14)'); gl.addColorStop(0.65, 'rgba(255,245,225,0.06)'); gl.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = gl; g.fillRect(0, 0, W, H);
      const dk = P(0, C.ZH + 15), pool = g.createRadialGradient(dk.x, dk.y, 2, dk.x, dk.y, 70);
      pool.addColorStop(0, 'rgba(255,230,180,0.22)'); pool.addColorStop(1, 'rgba(255,230,180,0)');
      g.fillStyle = pool; g.fillRect(0, 0, W, H);
      const near = g.createLinearGradient(0, P(0, 0).y, 0, P(0, 120).y);
      near.addColorStop(0, 'rgba(255,255,255,0.08)'); near.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = near; g.fillRect(0, 0, W, H);
      g.restore();
      this.rebuildOil();
      for (const s of [-1, 1]) quad(g, P(s * LHW - 0.3, 0), P(s * LHW + 0.3, 0), P(s * LHW + 0.3, C.ZBACK), P(s * LHW - 0.3, C.ZBACK), '#5a3a22');
      for (const bd of [3, 5, 8, 11, 14]) for (const s of [-1, 1]) { const q = P(s * (LHW - (bd - 0.5) * 1.064), 22); g.fillStyle = '#4a2c18'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      [5, 10, 15, 20, 25, 30, 35].forEach((bd, i) => {
        const x = LHW - (bd - 0.5) * 1.064 * LHW / C.LHW, zb = 64 + (3 - Math.abs(i - 3)) * 5;
        const p1 = P(x - 0.8, zb), p2 = P(x + 0.8, zb), p3 = P(x, zb + 6);
        ppoly(g, [p1, p2, p3], '#4a2c18');
      });
      GK.spots(LHW).forEach(([x, z], i) => { const q = P(x, z); g.fillStyle = i < 10 ? 'rgba(90,50,25,0.55)' : 'rgba(90,50,25,0.25)'; g.fillRect(Math.round(q.x - 1), Math.round(q.y), 2, 1); });
      quad(g, P(-E, -0.6), P(E, -0.6), P(E, 0.6), P(-E, 0.6), '#2a1416');
      for (const s of [-1, 1]) {
        quad(g, P(s * E, C.ZH - 16), P(s * E, C.ZBACK + 18), P(s * E, C.ZBACK + 18, 24), P(s * E, C.ZH - 16, 24), '#3d2a2c');
        const t1 = P(s * E, C.ZH - 16, 24), t2 = P(s * E, C.ZBACK + 18, 24);
        pline(g, t1.x, t1.y, t2.x, t2.y, '#7a5444');
      }
      // masking unit + marquee
      const mb = Math.round(P(0, C.ZBACK + 18, 34).y);
      const mg = g.createLinearGradient(0, 0, 0, mb);
      mg.addColorStop(0, shade(T.mask, -0.25)); mg.addColorStop(1, shade(T.mask, 0.08));
      g.fillStyle = mg; g.fillRect(0, 0, W, mb);
      this.drawMaskArt(g, mb);
      g.fillStyle = shade(T.mask, 0.18); g.fillRect(0, mb - 2, W, 2);
      g.fillStyle = '#0a060c'; g.fillRect(0, mb, W, 1);
      let fs = 15; g.font = fs + 'px Bungee, Rubik, sans-serif';
      while (g.measureText(this.signText).width > W - 56 && fs > 8) { fs -= 0.5; g.font = fs + 'px Bungee, Rubik, sans-serif'; }
      const sf = fs + 'px Bungee, Rubik, sans-serif';
      this.pixelBg = true;
      this.signDraw = () => {
        // neon tube: dark drop shadow, a glow halo (outline), then the bright tube
        ptext(g, this.signText, W / 2 + 1, 28.5, sf, T.signSh, 'center');
        ptext(g, this.signText, W / 2, 27, sf, T.sign, 'center', shade(T.sign, -0.45));
        ptext(g, this.subText, W / 2, 37, '600 6.5px Rubik, system-ui, sans-serif', T.subc, 'center');
      };
      // Turn the soft lighting into stepped, dithered pixel shading, then draw the sign on top.
      pixelize(this.bg, 14);
      this.signDraw();
    }

    // Visible oil, redrawn after every roll from the round's wear grid: a blue sheen board by
    // board, buffer streaks and glints, and a faint brown track where the ball has dried the line.
    // Little scenes on the masking unit above the pins, one per alley theme.
    drawMaskArt(g, mb) {
      const T = this.theme, name = this.signText || '', rng = GK.makeRng(GK.hash(name + 'mask'));
      g.save(); g.beginPath(); g.rect(0, 0, W, mb); g.clip();
      const dots = (n, col, r) => { for (let i = 0; i < n; i++) pdisc(g, rng() * W, rng() * mb, r * (0.5 + rng()), col); };
      if (/COSMIC|LUNAR/.test(name)) { dots(40, 'rgba(255,255,255,0.7)', 0.45); pdisc(g, 22, 14, 8, 'rgba(255,79,216,0.35)'); pdisc(g, 19, 11, 3, 'rgba(255,200,240,0.3)'); pdisc(g, 178, 22, 5, 'rgba(92,225,255,0.35)'); }
      if (/FROSTBITE/.test(name)) { for (let x = 0; x < W; x += 7) ppoly(g, [{ x, y: 0 }, { x: x + 4, y: 0 }, { x: x + 2, y: 5 + rng() * 6 }], 'rgba(220,245,255,0.55)'); dots(18, 'rgba(255,255,255,0.6)', 0.5); }
      if (/CARNIVAL/.test(name)) { for (let x = 0; x < W; x += 12) ppoly(g, [{ x, y: 0 }, { x: x + 12, y: 0 }, { x: x + 6, y: 10 }], (x / 12) % 2 ? 'rgba(255,74,90,0.35)' : 'rgba(255,243,224,0.18)'); }
      if (/BASEMENT|GUTTER/.test(name)) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 6, W, 3); g.fillRect(0, mb - 9, W, 2); for (let x = 14; x < W; x += 46) { g.fillStyle = 'rgba(150,170,120,0.25)'; g.fillRect(x, 4, 3, mb - 8); } }
      if (/BACK ROOM/.test(name)) { for (let x = 0; x < W; x += 6) { g.fillStyle = x % 12 ? 'rgba(120,20,30,0.25)' : 'rgba(60,8,16,0.3)'; g.fillRect(x, 0, 6, mb); } }
      if (/LUCKY|CHAMPIONSHIP/.test(name)) { for (let x = 6; x < W; x += 16) { pdisc(g, x, mb - 7, 1.6, 'rgba(255,210,122,0.25)'); g.fillStyle = 'rgba(255,210,122,0.25)'; g.fillRect(x - 3, mb - 7.5, 6, 1); g.fillRect(x - 0.5, mb - 10, 1, 6); } }
      g.restore();
    }
    setWear(wear) { this.wear = wear || null; this.rebuildOil(); }
    // Lane map: a top-down strip beside the lane with the live oil (blue = oil, wood = dry, darker
    // wood = boards your ball has dried out), the arrows, the pins, the ball as it rolls and the
    // line of your last shot.
    drawMini(cv, st) {
      if (!cv || !cv.width) return;
      const g = cv.getContext('2d'), w = cv.width, h = cv.height, d = w / 34;
      const lhw = this.lhw || C.LHW, gut = 3 * d, lw = w - 2 * gut;
      const zMin = -8, zMax = C.ZH + 42, top = 6 * d, bot = 6 * d;
      const X = x => gut + (x + lhw) / (2 * lhw) * lw, Y = z => h - bot - (z - zMin) / (zMax - zMin) * (h - top - bot);
      const key = this.oilVer + ':' + w + 'x' + h + ':' + !!this.ash;
      if (this.miniKey !== key) {
        this.miniKey = key;
        const c = this.miniCv || (this.miniCv = document.createElement('canvas'));
        c.width = w; c.height = h;
        const q = c.getContext('2d');
        q.fillStyle = '#140e16'; q.fillRect(0, 0, w, h);
        q.fillStyle = '#231a26'; q.fillRect(0, 0, gut, h); q.fillRect(w - gut, 0, gut, h);
        const W = GK.WEAR, NB = W.NB, wood = [200, 146, 90], worn = [150, 96, 52], oilC = [58, 128, 220];
        for (let zi = 0; zi * W.DZ < zMax; zi++) {
          const z0 = zi * W.DZ, z1 = Math.min(zMax, z0 + W.DZ), y0 = Math.round(Y(z1)), y1 = Math.round(Y(Math.max(zMin, z0 === 0 ? zMin : z0)));
          for (let b = 0; b < NB; b++) {
            const xc = -lhw + (b + 0.5) / NB * 2 * lhw, zc = z0 + W.DZ / 2;
            const o = zc > C.ZH - 10 || this.ash ? 0 : GK.oilEff(this.oil, this.wear, xc, zc, lhw);
            const wi = this.wear ? GK.wearIdx(xc, zc, lhw) : -1, wv = wi >= 0 ? Math.max(0, this.wear[wi]) : 0;
            const base = wood.map((v, k) => v + (worn[k] - v) * Math.min(1, wv * 3));
            const col = base.map((v, k) => Math.round(v + (oilC[k] - v) * Math.min(1, o * 1.1)));
            const deck = zc > C.ZH - 10;
            q.fillStyle = deck ? '#d8b07a' : 'rgb(' + col.join(',') + ')';
            const x0 = Math.round(X(-lhw + b / NB * 2 * lhw)), x1 = Math.round(X(-lhw + (b + 1) / NB * 2 * lhw));
            q.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
          }
        }
        // foul line and the targeting arrows
        q.fillStyle = '#ff5a6e'; q.fillRect(gut, Math.round(Y(0)), lw, Math.max(1, Math.round(d)));
        q.fillStyle = 'rgba(30,16,12,0.85)';
        for (let i = 1; i <= 7; i++) { const x = X(-lhw + i * 5 / 40 * 2 * lhw), y = Y(60 + Math.abs(4 - i) * 6); q.beginPath(); q.moveTo(x, y - 3 * d); q.lineTo(x - 1.4 * d, y + 1.5 * d); q.lineTo(x + 1.4 * d, y + 1.5 * d); q.fill(); }
        q.fillStyle = 'rgba(255,255,255,0.75)'; q.font = '700 ' + Math.round(7 * d) + 'px Rubik, system-ui, sans-serif'; q.textAlign = 'center';
        q.fillText('LANE', w / 2, h - 0.5 * d);
      }
      g.drawImage(this.miniCv, 0, 0);
      const line = (pts, col, lwid) => {
        if (!pts || pts.length < 2) return;
        g.strokeStyle = col; g.lineWidth = lwid; g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); pts.forEach((p, i) => { const x = X(GK.clamp(p.x, -lhw - 3, lhw + 3)), y = Y(Math.min(p.z, zMax)); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
      };
      line(st.last, 'rgba(20,10,16,0.6)', 3 * d); line(st.last, '#ffb547', 1.6 * d);
      line(st.live, '#ffffff', 1.6 * d);
      const sim = st.sim;
      if (sim) {
        for (const p of sim.pins) {
          if (p.gone || p.cleared) continue;
          g.fillStyle = p.standing ? '#ffffff' : 'rgba(255,255,255,0.35)';
          g.beginPath(); g.arc(X(p.x), Y(p.z), 1.3 * d, 0, Math.PI * 2); g.fill();
        }
        if (st.live) for (const b of sim.balls) {
          if (b.gone || b.delay > 0 || b.kind === 'shard') continue;
          g.fillStyle = b.kind === 'main' ? '#ffd447' : 'rgba(255,212,71,0.6)';
          g.beginPath(); g.arc(X(b.x), Y(Math.min(b.z, zMax)), 2 * d, 0, Math.PI * 2); g.fill();
        }
      }
    }

    rebuildOil() {
      this.oilVer = (this.oilVer || 0) + 1;
      const g = this.oilCv.getContext('2d'); g.setTransform(RS, 0, 0, RS, 0, 0); g.clearRect(0, 0, W, H);
      this.drawOil(g, this.lhw || C.LHW, Math.round((this.lhw || C.LHW) * 2 / 1.064));
      pixelize(this.oilCv, 16, 28);
    }
    drawOil(g, LHW, nb) {
      const pat = this.oil, wear = this.wear;
      const tones = [[70, 140, 255], [100, 170, 255], [55, 115, 225], [130, 190, 255]];
      const bw = 2 * LHW / nb, rng = GK.makeRng(GK.hash(pat + nb));
      const oil = (x, z) => GK.oilEff(pat, wear, x, z, LHW);
      for (let i = 0; i < nb; i++) {
        const x0 = -LHW + i * bw, x1 = x0 + bw, xm = (x0 + x1) / 2;
        const tone = tones[(i * 3 + (i >> 2)) % tones.length];
        for (let z = 0; z < C.ZH - 6; z += 6) {
          const o = oil(xm, z + 3), jit = 0.85 + rng() * 0.3;
          if (o >= 0.03) quad(g, P(x0, z), P(x1, z), P(x1, z + 6), P(x0, z + 6), 'rgba(' + tone[0] + ',' + tone[1] + ',' + tone[2] + ',' + ((0.07 + 0.3 * o) * jit).toFixed(3) + ')');
          const wi = wear ? GK.wearIdx(xm, z + 3, LHW) : -1, wv = wi >= 0 ? wear[wi] : 0;
          if (wv > 0.12) quad(g, P(x0, z), P(x1, z), P(x1, z + 6), P(x0, z + 6), 'rgba(150,90,40,' + Math.min(0.32, wv * 0.6).toFixed(3) + ')');
        }
      }
      for (let k = 0; k < 9; k++) {
        const x = -LHW + (k + 0.5) * 2 * LHW / 9 + (rng() - 0.5) * 2;
        for (let z = 2; z < C.ZH - 10; z += 2) {
          const o = oil(x, z); if (o < 0.25) continue;
          const q = P(x, z); g.fillStyle = 'rgba(200,230,255,' + (0.08 + 0.18 * o).toFixed(3) + ')'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
        }
      }
      for (let k = 0; k < 120; k++) {
        const x = (rng() * 2 - 1) * LHW, z = rng() * (C.ZH - 10), o = oil(x, z);
        if (o < 0.4) continue;
        const q = P(x, z); g.fillStyle = 'rgba(235,248,255,' + (0.3 + 0.4 * o).toFixed(2) + ')'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
    }

    // Ball return on the right of the approach: the bag's balls sit on the rails; tap one to pick it.
    drawReturn(ret, time) {
      if (!ret) return;
      const cx = this.cx, n = ret.balls.length;
      const hx = 168, hy = 286, bottom = 348;
      this.retPos = [];
      // rails
      cx.fillStyle = '#2a2230'; cx.fillRect(hx + 3, hy + 12, 26, bottom - hy - 4);
      cx.fillStyle = '#6a5a70'; cx.fillRect(hx + 4, hy + 12, 2, bottom - hy - 4); cx.fillRect(hx + 26, hy + 12, 2, bottom - hy - 4);
      cx.fillStyle = '#4a3e52'; cx.fillRect(hx + 3, bottom + 6, 26, 3);
      // hood
      cx.fillStyle = '#140e16'; cx.fillRect(hx - 1, hy - 1, 34, 16);
      cx.fillStyle = '#5a2a3a'; cx.fillRect(hx, hy, 32, 14);
      cx.fillStyle = '#8a3a4e'; cx.fillRect(hx, hy, 32, 3);
      cx.fillStyle = '#0a060c'; cx.fillRect(hx + 6, hy + 6, 20, 8);
      let slot = 0;
      for (let i = 0; i < n; i++) {
        const b = ret.balls[i], def = GK.BALLS[b.type] || GK.BALLS.house;
        const stuck = ret.stuck === i, inPlay = ret.inPlay === i;
        if (inPlay) continue;
        let x = hx + 16, y = bottom - slot * 12, r = 5;
        if (stuck) { x = hx + 16 + Math.round(Math.sin(time * 20) * 0.6); y = hy + 11; r = 4; }
        else slot++;
        if (ret.sel === i && !stuck) { this.circle(x, y, r + 2.2, (Math.floor(time * 3) % 2) ? '#ffd27a' : '#ffb547'); }
        this.circle(x, y, r + 0.8, '#0e0a10');
        if (b.ed === 'holo') this.circle(x, y, r + 0.8, `hsl(${(time * 300) % 360},90%,70%)`);
        this.circle(x, y, r, def.col);
        this.circle(x - r * 0.35, y - r * 0.35, r * 0.3, def.hi);
        if (!stuck) this.retPos.push({ i, x, y, r: r + 3 });
        else {
          ptext(cx, 'STUCK', hx + 16, hy - 3, FONT_S, (Math.floor(time * 4) % 2) ? '#ff5a6e' : '#ffd27a', 'center', '#140e16');
        }
      }
    }
    tvHit(px, py) { const r = this.tvRect; return !!r && px >= r.X - 2 && px <= r.X + r.w + 2 && py >= r.Y - 2 && py <= r.Y + r.h + 2; }
    returnHit(px, py) {
      for (const p of this.retPos || []) if (Math.hypot(px - p.x, py - p.y) <= p.r) return p.i;
      return -1;
    }

    // TV beside the lane. Idle it shows the alley's channel; after a strike, spare or split it
    // plays a short pixel cartoon.
    drawTV(tv, time) {
      const cx = this.cx, X = 3, Y = 47, w = 44, h = 32;
      this.tvRect = { X, Y, w, h: h + 6 };
      cx.fillStyle = '#0a060c'; cx.fillRect(X + 18, Y + h, 8, 5); cx.fillRect(X + 12, Y + h + 4, 20, 2);
      cx.fillStyle = '#3a2f36'; cx.fillRect(X, Y, w, h);
      cx.fillStyle = '#5a4a52'; cx.fillRect(X, Y, w, 2);
      const sx = X + 3, sy = Y + 3, sw = w - 6, sh = h - 6;
      cx.save(); cx.beginPath(); cx.rect(sx, sy, sw, sh); cx.clip();
      const t = tv ? tv.t : 0, kind = tv && t < 3.2 ? tv.kind : null;
      if (!kind) {
        cx.fillStyle = '#1a2a3a'; cx.fillRect(sx, sy, sw, sh);
        cx.fillStyle = this.theme ? this.theme.sign : '#ffb547';
        const tc = this.theme ? this.theme.sign : '#ffb547';
        ptext(cx, 'LANE', sx + sw / 2, sy + 11, FONT_S, tc, 'center'); ptext(cx, 'TV', sx + sw / 2, sy + 20, FONT_S, tc, 'center');
        if (Math.floor(time * 1.3) % 6 === 0) for (let k = 0; k < 60; k++) { cx.fillStyle = Math.random() < 0.5 ? '#fff' : '#555'; cx.fillRect(sx + Math.floor(Math.random() * sw), sy + Math.floor(Math.random() * sh), 1, 1); }
      } else {
        this.tvReels = tv.reels || this.tvReels;
        TV_SCENES[kind](cx, sx, sy, sw, sh, t, tv.v || 0, this);
      }
      // scanlines + glass glare
      cx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = sy; y < sy + sh; y += 2) cx.fillRect(sx, y, sw, 1);
      cx.fillStyle = 'rgba(255,255,255,0.08)'; cx.fillRect(sx + 1, sy + 1, sw - 2, 3);
      cx.restore();
      cx.fillStyle = (tv && tv.t < 3.2) ? '#ff3a3a' : '#3a5a3a'; cx.fillRect(X + w - 4, Y + h - 2, 2, 1);
    }

    // The Regulars watch from the front-left corner: Kaleb, Quinn and Levi.
    // They jump on strikes, clap spares and slump on gutters. On dark lanes Quinn's shades go on.
    drawCrowd(cr, time, dark) {
      const cx = this.cx, mood = cr ? cr.mood : 'idle', t = cr ? cr.t : 0;
      const people = [
        { x: 9, who: 'kaleb', shirt: '#8fb48f', skin: '#f0cdb0', hair: '#6a4528', w: 6.2 },
        { x: 24, who: 'quinn', shirt: '#7a1f35', skin: '#f2d2bc', hair: '#3a2618', w: 6.2 },
        { x: 39, who: 'levi', shirt: '#3a8ad0', skin: '#f0d0b8', hair: '#2a1c14', w: 7.2 }
      ];
      people.forEach(({ x, who, shirt, skin, hair, w }, i) => {
        let dy = Math.sin(time * 2 + i) * 0.5, arms = 0, slump = false;
        if (mood === 'cheer') { dy = -Math.abs(Math.sin(t * 10 + i * 1.3)) * 5; arms = 2; }
        else if (mood === 'clap') { dy = -Math.abs(Math.sin(t * 9 + i)) * 1.5; arms = 1; }
        else if (mood === 'groan') { dy = 1.5; slump = true; }
        const by = H - 8 + dy, sh = slump ? GK.shade(shirt, -0.45) : shirt;
        const hy = by - 4 + (slump ? 2 : 0);
        // Quinn's long hair falls behind the shoulders
        if (who === 'quinn') { pell(cx, x, hy + 3, 4.6, 6.5, '#0c0810', 'top'); pell(cx, x, hy + 3, 4.1, 6, hair, 'top'); }
        // shoulders and body
        pell(cx, x, by + 6, w + 1, 7.5, '#0c0810', 'top');
        pell(cx, x, by + 6, w, 6.6, sh, 'top'); cx.fillRect(sp(x - w - 0.3), sp(by + 6), Math.round((w + 0.3) * 2), 4);
        pell(cx, x + 2, by + 6, 3.4, 5.2, GK.shade(sh, -0.28), 'top');
        pell(cx, x - 2.6, by + 4, 1.6, 2.6, GK.shade(sh, 0.2), 'top');
        if (who === 'levi') {
          // open rubber-duck shirt over a blue tee
          cx.fillStyle = slump ? '#2a5a88' : '#5ab0f0'; cx.fillRect(sp(x - 1), sp(by + 1), 2, 9);
          cx.fillStyle = '#ffd23a';
          for (const [dx, dz] of [[-4.5, 3], [-3, 6], [3.5, 2.5], [4.5, 6], [-5.5, 8], [5.5, 8.5]]) cx.fillRect(sp(x + dx), sp(by + dz), 1, 1);
        }
        if (who === 'kaleb') { pline(cx, x - 5, by + 1, x + 3, by + 9, '#8a5a2a', 1); }
        if (who === 'quinn') {
          // gold chain, and the round shades hooked on the sweater (or worn when it's dark)
          cx.fillStyle = '#e8c860'; cx.fillRect(sp(x), sp(by + 3), 1, 1);
          if (!dark) { this.circle(x - 1.2, by + 5.2, 1, '#111014'); this.circle(x - 1.2, by + 7.6, 1, '#111014'); }
        }
        if (arms === 2) { pline(cx, x - 5, by + 2, x - 8, by - 6, skin, 3); pline(cx, x + 5, by + 2, x + 8, by - 6, skin, 3); }
        if (arms === 1) { const k = Math.floor(t * 8 + i) % 2 ? 1.5 : 3.5; cx.fillStyle = skin; this.circle(x - k, by + 1, 1.3, skin); this.circle(x + k, by + 1, 1.3, skin); }
        // head
        this.circle(x, hy, 3.6, '#0c0810');
        this.circle(x, hy, 3.1, skin);
        if (who === 'kaleb') {
          // big curly hair
          for (const [dx, dz, r] of [[-3, -1.2, 1.8], [3, -1.2, 1.8], [-2, -2.8, 1.9], [0.4, -3.4, 2], [2.6, -2.6, 1.8], [-3.4, 1, 1.4], [3.4, 1, 1.4]]) this.circle(x + dx, hy + dz, r, hair);
          this.circle(x - 0.8, hy - 3, 0.7, GK.shade(hair, 0.3));
          // the grin (wider when cheering)
          cx.fillStyle = '#ffffff'; cx.fillRect(sp(x - (arms === 2 ? 2 : 1)), sp(hy + 1), arms === 2 ? 4 : 3, 1);
        } else if (who === 'levi') {
          pell(cx, x, hy - 0.8, 3.3, 2.2, hair, 'top');
          this.circle(x, hy - 3.8, 1.4, hair); // top bun
          cx.fillStyle = GK.shade(skin, -0.12); cx.fillRect(sp(x - 1.5), sp(hy + 1.5), 3, 1);
        } else {
          pell(cx, x, hy - 0.8, 3.4, 2.3, hair, 'top');
          cx.fillStyle = hair; cx.fillRect(sp(x - 3.4), sp(hy - 1), 1, 5); cx.fillRect(sp(x + 2.6), sp(hy - 1), 1, 5);
          cx.fillStyle = '#8a4a2a'; cx.fillRect(sp(x - 0.5), sp(hy + 1.8), 1, 1); // goatee
          if (dark) { cx.fillStyle = '#111014'; cx.fillRect(sp(x - 2), sp(hy - 0.6), 2, 1); cx.fillRect(sp(x + 0.5), sp(hy - 0.6), 2, 1); }
        }
        if (who !== 'kaleb') { cx.fillStyle = GK.shade(skin, -0.25); cx.fillRect(sp(x + 1.5), sp(hy - 0.5), 1, 2); }
        if (this.cosm && this.cosm.hats && this.cosm.hats !== 'none') this.drawHat(this.cosm.hats, x, hy, i, time);
      });
      if (mood === 'cheer' && t < 1.8) ptext(cx, 'YEAH!', 24, H - 26 - Math.round(t * 6), '800 7px Rubik, system-ui, sans-serif', '#ffd27a', 'center', '#140e16');
      if (mood === 'groan' && t < 1.8) ptext(cx, 'ohh…', 24, H - 24, '800 7px Rubik, system-ui, sans-serif', '#c9b7d3', 'center', '#140e16');
    }

    drawPin(p, sim, time, glowOnly) {
      if (p.gone && !p.swallowed) return;
      if (p.gone) return;
      const cx = this.cx, def = p.type === 'std' && this.pinSkin ? this.pinSkin : (GK.PINS[p.type] || GK.PINS.std);
      let alpha = def.alpha || 1;
      if (p.cleared) { alpha *= 1 - p.clearT / 0.35; if (alpha <= 0) return; }
      let th, dir;
      if (p.fallen) { const f = Math.min(1, p.fallT / 0.22); th = (1 - (1 - f) * (1 - f)) * Math.PI / 2 * 0.96; dir = p.fd; }
      else { const lean = p.wob * 0.3 * Math.sin(time * 28 + p.n * 1.7); th = Math.abs(lean); dir = lean >= 0 ? p.wobDir : { x: -p.wobDir.x, z: -p.wobDir.z }; }
      const h0 = p.standing ? (1 - p.drop) * (1 - p.drop) * 30 : 0;
      const ps = (p.r || C.PIN_R) / C.PIN_R, L = 15 * (0.6 + 0.4 * ps), sn = Math.sin(th), cs = Math.cos(th), PW = 4.77 * ps;
      cx.globalAlpha = alpha;
      const sh = P(p.x, p.z);
      if (!glowOnly) {
        const rr = PW * S0 * sh.s * 0.75;
        pell(cx, sh.x, sh.y, rr, rr * 0.4, 'rgba(20,10,8,0.2)'); pell(cx, sh.x, sh.y, rr * 0.6, rr * 0.25, 'rgba(20,10,8,0.25)');
      }
      const pts = [], N = 16;
      for (let k = 0; k <= N; k++) { const t = k / N; const q = P(p.x + dir.x * L * sn * t, p.z + dir.z * L * sn * t, h0 + L * cs * t); pts.push([q.x, q.y, prof(t) * PW * S0 * q.s, t]); }
      const frozen = p.hp > 1 && p.standing;
      const outline = glowOnly ? '#ff4fd8' : '#2b1f24';
      for (const [x, y, r] of pts) this.circle(x, y, r + (glowOnly ? 1.2 : 0.45), outline);
      for (const [x, y, r] of pts) this.circle(x, y, r, frozen ? '#d8f4ff' : def.body);
      for (const [x, y, r, t] of pts) if (t > 0.1 && t < 0.45) this.circle(x + r * 0.35, y, r * 0.45, frozen ? '#9fd6ee' : def.shade);
      for (const [x, y, r, t] of pts) if (t > 0.05 && t < 0.95) this.circle(x + r * 0.42, y, r * 0.5, 'rgba(0,0,0,0.07)');
      for (const [x, y, r, t] of pts) if (t > 0.12 && t < 0.42) this.circle(x - r * 0.42, y, r * 0.24, 'rgba(255,255,255,0.9)');
      for (const [x, y, r, t] of pts) if (t > 0.78 && t < 0.92) this.circle(x - r * 0.35, y, r * 0.22, 'rgba(255,255,255,0.75)');
      // Two thin red stripes around the neck with white between them, drawn across the pin's
      // axis so they stay horizontal when it stands and turn with it when it falls.
      const at = tt => P(p.x + dir.x * L * sn * tt, p.z + dir.z * L * sn * tt, h0 + L * cs * tt);
      for (const tt of [0.56, 0.68]) {
        const q = at(tt), q2 = at(tt + 0.04);
        let ax = q2.x - q.x, ay = q2.y - q.y; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        const r = prof(tt) * PW * S0 * q.s, w = q.s > 0.62 ? 2 : 1;
        pline(cx, q.x - ay * r, q.y + ax * r, q.x + ay * r, q.y - ax * r, def.band, w);
      }
      if (p.type === 'explosive' && p.standing) { const q = P(p.x, p.z, h0 + L + 1.5); cx.fillStyle = (Math.floor(time * 8) % 2) ? '#ffd447' : '#ff6a3d'; cx.fillRect(Math.round(q.x), Math.round(q.y - 1), 1, 2); }
      if (this.party && p.standing && !p.cleared) {
        const top = P(p.x, p.z, h0 + L + 1), sway = Math.sin(time * 2 + p.n) * 1.5, b = P(p.x + sway, p.z, h0 + L + 12), cols = ['#ff5a6e', '#39c6d6', '#ffd447', '#7be38a', '#b58cff'];
        pline(cx, top.x, top.y, b.x, b.y + 2, '#e8e0f0', 1);
        pell(cx, b.x, b.y, 2.4 * b.s * 1.6, 3 * b.s * 1.6, cols[p.n % cols.length]);
        cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(b.x - 1), Math.round(b.y - 2), 1, 1);
      }
      if ((p.type === 'jackpot') && p.standing && Math.floor(time * 6 + p.n) % 3 === 0) { const q = P(p.x + (Math.random() - 0.5) * 3, p.z, h0 + 4 + Math.random() * 10); cx.fillStyle = Math.random() < 0.5 ? '#fff' : '#ffd447'; cx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      if (p.type === 'gold' && p.standing && Math.floor(time * 2 + p.n) % 5 === 0) { const q = P(p.x, p.z, h0 + 9); cx.fillStyle = '#fff'; cx.fillRect(Math.round(q.x - 1), Math.round(q.y), 1, 1); }
      if (frozen) { const q = P(p.x, p.z, h0 + 4); cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(q.x + 1), Math.round(q.y), 1, 1); }
      cx.globalAlpha = 1;
    }

    drawBall(b, x, z, r, type, ed, time, alpha = 1) {
      const t = GK.BALLS[type] || GK.BALLS.house, cx = this.cx;
      const lift = (b && b.lift) || 0;
      const c = P(x, z, r + lift), R = r * S0 * c.s, s2 = P(x, z);
      cx.globalAlpha = alpha;
      pell(cx, s2.x, s2.y, R * (1 - lift / 40), R * 0.32 * (1 - lift / 40), 'rgba(15,8,10,0.35)');
      // reflection on the glossy lane
      cx.globalAlpha = alpha * 0.22; pell(cx, s2.x, s2.y + R * 0.35, R * 0.75, R * 0.3, t.col); cx.globalAlpha = alpha;
      if (ed === 'neon') this.circle(c.x, c.y, R + 2.2, 'rgba(182,255,92,0.35)');
      if (type === 'blackhole') this.circle(c.x, c.y, R + 2.5 + Math.sin(time * 9) * 0.8, 'rgba(176,107,255,0.35)');
      this.circle(c.x, c.y, R + 0.8, ed === 'foil' ? '#9fe8ff' : ed === 'holo' ? `hsl(${(time * 300) % 360},90%,70%)` : '#0e0a10');
      if (type === 'neonball') this.circle(c.x, c.y, R + 1.8 + Math.sin(time * 7) * 0.5, 'rgba(57,255,138,0.35)');
      if (type === 'spiked' && R > 2) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + (b ? b.rot : 0); cx.fillStyle = '#d0b090'; cx.fillRect(Math.round(c.x + Math.cos(a) * (R + 1)), Math.round(c.y + Math.sin(a) * (R + 1)), 1, 1); }
      if (type === 'ghost' || type === 'glass' || type === 'bubble' || type === 'jelly') cx.globalAlpha = alpha * (type === 'ghost' ? 0.55 : type === 'bubble' ? 0.6 : 0.8);
      // pixel shading: dark rim, base colour, a lit cap toward the top-left
      this.circle(c.x, c.y, R, GK.shade(t.col, -0.45));
      this.circle(c.x - R * 0.12, c.y - R * 0.12, R * 0.86, t.col);
      this.circle(c.x - R * 0.3, c.y - R * 0.32, R * 0.5, GK.shade(t.col, 0.22));
      if (type === 'mirror') { this.circle(c.x - R * 0.2, c.y - R * 0.2, R * 0.55, '#e8ecf2'); this.circle(c.x + R * 0.25, c.y + R * 0.25, R * 0.4, '#8a909a'); }
      if (type === 'snake') { cx.fillStyle = '#c8ff8a'; cx.fillRect(Math.round(c.x - R * 0.8), Math.round(c.y - 0.5), Math.round(R * 1.6), 1); }
      this.ballMarks(type, c, R, time, b);
      this.circle(c.x - R * 0.38, c.y - R * 0.4, R * 0.22, 'rgba(255,255,255,0.75)');
      this.circle(c.x - R * 0.2, c.y - R * 0.5, R * 0.1, t.hi);
      cx.globalAlpha = alpha;
      if (type === 'split' && !(b && b.didSplit)) { cx.fillStyle = '#5a3008'; cx.fillRect(Math.round(c.x - 0.5), Math.round(c.y - R), 1, Math.round(R * 2)); }
      if (type === 'bomb' && !(b && b.exploded)) { cx.fillStyle = (Math.floor(time * 10) % 2) ? '#ffd447' : '#ff6a3d'; cx.fillRect(Math.round(c.x + R * 0.4), Math.round(c.y - R - 1.5), 2, 2); }
      if (type === 'lucky7' && R > 3) ptext(cx, '7', c.x, c.y + 3, FONT_S, '#ffe066', 'center');
      if (type === 'golden' && Math.floor(time * 3) % 3 === 0) { cx.fillStyle = '#fff'; cx.fillRect(Math.round(c.x - R * 0.5), Math.round(c.y - R * 0.5), 1, 1); }
      const ph = (b ? b.rot : 0.4) % (Math.PI * 2);
      if (R > 2.5 && type !== 'blackhole' && Math.cos(ph) > -0.1) {
        const oy = -Math.sin(ph) * R * 0.5;
        for (const [hx, hy] of [[-0.22, -0.1], [0.22, -0.1], [0, 0.28]]) { this.circle(c.x + hx * R, c.y + oy + hy * R, Math.max(0.6, R * 0.13), 'rgba(255,255,255,0.18)'); this.circle(c.x + hx * R + 0.15, c.y + oy + hy * R + 0.15, Math.max(0.5, R * 0.11), '#07050a'); }
      }
      cx.globalAlpha = 1;
    }

    // Small pixel details that tell the v0.7 balls apart.
    ballMarks(type, c, R, time, b) {
      const cx = this.cx, px = (x, y, col, w = 1, h = 1) => { cx.fillStyle = col; cx.fillRect(Math.round(c.x + x * R), Math.round(c.y + y * R), w, h); };
      if (R < 2) return;
      switch (type) {
        case 'pinball': px(-0.7, -0.35, '#d8283a', Math.round(R * 1.4), 1); px(-0.7, -0.1, '#d8283a', Math.round(R * 1.4), 1); break;
        case 'disco': for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if ((i + j + Math.floor(time * 6)) % 3 === 0 && i * i + j * j < 6) px(i * 0.3, j * 0.3, (i + j) % 2 ? '#ffffff' : '#8a90a8'); break;
        case 'boomerang': px(-0.5, -0.1, '#7a2a08', 2, 1); px(-0.25, 0.1, '#7a2a08', 2, 1); px(0.05, 0.1, '#7a2a08', 2, 1); px(0.3, -0.1, '#7a2a08', 2, 1); break;
        case 'sticky': px(-0.4, 0.3, '#2a7a1a', 1, 2); px(0.2, 0.45, '#2a7a1a', 1, 2); px(0.5, 0.1, '#c8ff9a'); break;
        case 'paint': px(-0.4, -0.2, '#ff4a5a', 2, 2); px(0.25, 0.15, '#3ad9ff', 2, 2); px(-0.1, 0.4, '#ffe066', 1, 1); break;
        case 'pendulum': px(-0.05, -0.8, '#3a2a10', 1, Math.round(R * 1.6)); break;
        case 'lightning': px(-0.2, -0.6, '#ffffff'); px(0, -0.3, '#ffffff'); px(-0.25, 0, '#ffffff', 2, 1); px(0.05, 0.25, '#ffffff'); px(-0.1, 0.5, '#ffffff'); break;
        case 'wrecking': px(-0.1, -1.05, '#9a9aa8', 2, 2); break;
        case 'duster': for (let i = 0; i < 5; i++) px(-0.8 + i * 0.4, -0.9 + Math.sin(time * 9 + i) * 0.08, '#ff9ad0', 1, 2); break;
        case 'bubble': px(0.3, 0.3, '#ffffff'); break;
        case 'chain': px(-0.5, -0.1, '#d0d0e0', 2, 1); px(0.1, -0.1, '#d0d0e0', 2, 1); break;
        case 'moon': px(-0.3, 0.2, '#8a8a96', 2, 2); px(0.3, -0.2, '#8a8a96', 1, 1); px(0.2, 0.45, '#8a8a96', 1, 1); break;
        case 'twin': px(-0.05, -0.7, '#0e3a5a', 1, Math.round(R * 1.4)); break;
        case 'anchor': px(-0.05, -0.6, '#d8e4f0', 1, Math.round(R * 1.1)); px(-0.35, -0.45, '#d8e4f0', Math.max(1, Math.round(R * 0.7)), 1); px(-0.45, 0.35, '#d8e4f0', 1, 1); px(0.35, 0.35, '#d8e4f0', 1, 1); px(-0.3, 0.45, '#d8e4f0', Math.max(1, Math.round(R * 0.6)), 1); break;
        case 'gyro': { const a = (b ? b.rot : 0) * 2; for (let k = 0; k < 6; k++) { const t = a + k * Math.PI / 3; px(Math.cos(t) * 0.7, Math.sin(t) * 0.7, k % 2 ? '#ffffff' : '#0a6a50'); } break; }
        case 'black_pearl': px(-0.4, -0.4, '#f0e8ff', 2, 2); px(0.2, 0.2, '#6a5a8a', 1, 1); break;
        case 'grenade': px(-0.6, -0.15, '#2a3a1a', Math.max(1, Math.round(R * 1.2)), 1); px(-0.6, 0.25, '#2a3a1a', Math.max(1, Math.round(R * 1.2)), 1); px(-0.05, -0.6, '#2a3a1a', 1, Math.round(R * 1.2)); px(0.2, -1.05, '#c8c8c8', 2, 2); break;
        // The Regulars
        case 'twohander': { // Quinn's round shades
          const L = Math.max(1, Math.round(R * 0.32));
          this.circle(c.x - R * 0.36, c.y - R * 0.1, L, '#111014'); this.circle(c.x + R * 0.36, c.y - R * 0.1, L, '#111014');
          px(-0.36, -0.1 - 0.05, '#c8ccd4', Math.max(1, Math.round(R * 0.72)), 1);
          px(-0.45, -0.25, '#6a6f7a'); px(0.27, -0.25, '#6a6f7a');
          break;
        }
        case 'loftduck': // Levi's rubber duck: eye, beak, wing
          px(0.15, -0.35, '#111014'); px(0.45, -0.15, '#ff8a1a', 2, 1); px(0.5, -0.05, '#e06a10', 2, 1); px(-0.45, 0.15, '#e8b420', 3, 2); break;
        case 'wideswing': // Kaleb's big grin
          px(-0.35, 0.05, '#ffffff', 1, 1); px(-0.25, 0.2, '#ffffff', Math.max(1, Math.round(R * 0.5)), 1); px(0.35, 0.05, '#ffffff', 1, 1);
          px(-0.25, -0.35, '#2a3a2a'); px(0.2, -0.35, '#2a3a2a'); break;
      }
    }

    drawPost(q, time) {
      const cx = this.cx, base = P(q.x, q.z), top = P(q.x, q.z, 22), R = q.r * S0 * base.s;
      if (this.gears) {
        const c = P(q.x, q.z, 6), Rg = R * 2.2, rot = time * 2 * (q.w || 1);
        pell(cx, base.x, base.y, Rg, Rg * 0.4, 'rgba(15,8,10,0.35)');
        for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; pdisc(cx, c.x + Math.cos(a) * Rg, c.y + Math.sin(a) * Rg * 0.9, Math.max(1, R * 0.45), '#a8843a'); }
        pdisc(cx, c.x, c.y, Rg, '#c8a04a'); pdisc(cx, c.x, c.y, Rg * 0.55, '#7a5a20'); pdisc(cx, c.x, c.y, Rg * 0.25, '#e8c870');
        return;
      }
      pell(cx, base.x, base.y, R * 1.2, R * 0.4, 'rgba(15,8,10,0.35)');
      for (let y = Math.round(top.y); y < Math.round(base.y); y++) {
        cx.fillStyle = (Math.floor((y + time * 20) / 3) % 2) ? '#ff4a5a' : '#fff3e0';
        cx.fillRect(Math.round(base.x - R), y, Math.round(R * 2), 1);
      }
      this.circle(top.x, top.y, R + 0.5, '#ffdf5c');
    }

    drawGuide(st) {
      const cx = this.cx, t = st.time, ang = st.aimAng || 0;
      if (st.step === 'pos') {
        // Start marker: arrows either side of the ball and a short straight line ahead.
        const q = P(st.aimX, C.BALL_Z0, 4), bob = Math.round(Math.sin(t * 6) * 1.5);
        cx.fillStyle = '#ffb547';
        for (const d of [-1, 1]) {
          const x0 = Math.round(q.x + d * (19 + bob)), y0 = Math.round(q.y);
          for (let i = 0; i < 4; i++) cx.fillRect(x0 + d * i, y0 - 3 + i, 1, 7 - i * 2);
        }
        for (let z = 14; z < 70; z += 9) { const p = P(st.aimX, z); cx.fillStyle = '#2a1416'; cx.fillRect(Math.round(p.x), Math.round(p.y) + 1, 2, 1); cx.fillStyle = 'rgba(255,210,122,0.8)'; cx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 2, 1); }
        if (st.boards) {
          // Tape Measure: boards are counted from the right gutter like a right-hander's target.
          const bd = GK.clamp(Math.round((this.lhw - st.aimX) / (2 * this.lhw) * 39 + 0.5), 1, 39);
          const tq = P(st.aimX, 40);
          ptext(cx, 'BOARD ' + bd, tq.x, tq.y - 4, FONT_S, '#ffe066', 'center', '#2a1416');
        }
        return;
      }
      const lineX = z => st.aimX + Math.tan(ang) * (z - C.BALL_Z0);
      if (st.preview && st.preview.type === 'snake') {
        const path = GK.snakePath(st.aimX, ang, this.lhw);
        for (let z = 6; z < 220; z += 6) { const p = P(GK.pathX(path, z), z), x = Math.round(p.x), y = Math.round(p.y); cx.fillStyle = '#1a2a10'; cx.fillRect(x + 1, y + 1, 2, 2); cx.fillStyle = '#c8ff8a'; cx.fillRect(x, y, 2, 2); }
      } else {
        // Marching dots along the aim line out past the arrows.
        const off = (t * 30) % 9;
        for (let z = 10 + off; z < 210; z += 9) {
          const p = P(lineX(z), z), w = z < 140 ? 2 : 1, x = Math.round(p.x - w / 2), y = Math.round(p.y);
          cx.fillStyle = '#2a1416'; cx.fillRect(x + 1, y + 1, w, w);
          cx.fillStyle = '#ffd27a'; cx.fillRect(x, y, w, w);
        }
      }
      if (st.hookPreview != null) {
        // Wrist Computer: a dotted guess at the hook, breaking once the oil runs out.
        for (let z = 20; z < 300; z += 7) {
          const k = Math.max(0, (z - 120) / 180), p = P(GK.clamp(lineX(z) + st.hookPreview * 22 * k * k, -this.lhw, this.lhw), z);
          const w = z < 160 ? 2 : 1; cx.fillStyle = '#0a2a3a'; cx.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, w, w); cx.fillStyle = '#5ae0ff'; cx.fillRect(Math.round(p.x), Math.round(p.y), w, w);
        }
      }
      // arrowhead at the end of the line
      const e1 = P(lineX(214), 214), e0 = P(lineX(200), 200);
      const dx = e1.x - e0.x, dy = e1.y - e0.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      pline(cx, e1.x - ux * 5 - uy * 3, e1.y - uy * 5 + ux * 3, e1.x, e1.y, '#ffd27a', 2);
      pline(cx, e1.x - ux * 5 + uy * 3, e1.y - uy * 5 - ux * 3, e1.x, e1.y, '#ffd27a', 2);
      if (st.step === 'angle') {
        const deg = ang * 180 / Math.PI;
        ptext(cx, (deg >= 0 ? '+' : '') + deg.toFixed(1) + '°', e1.x, e1.y - 6, FONT_S, '#ffd27a', 'center', '#2a1416');
      }
    }

    drawMonitor(sim, time) {
      const cx = this.cx, ox = 182, oy = 62;
      cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.fillRect(ox - 13, oy - 22, 26, 26);
      for (const p of sim.pins) {
        const sx = ox + (p.origX != null ? p.origX : p.sx) * 0.55, sy = oy - ((p.origZ != null ? p.origZ : p.sz) - C.ZH) * 0.55;
        const up = p.standing && !p.cleared && !p.gone;
        cx.fillStyle = up ? (p.type === 'std' ? '#ffb547' : GK.PINS[p.type].body) : '#4a3046';
        cx.fillRect(Math.round(sx - 1), Math.round(sy - 1), 3, 3);
      }
      const on = Math.floor(time * 3) % 2;
      for (let i = 0; i < 20; i++) { const lit = (i % 2) === on; if (lit) this.circle(6 + i * 10, 7, 2.6, 'rgba(255,210,122,0.25)'); this.circle(6 + i * 10, 7, 1.1, lit ? '#ffe9b0' : '#6b4320'); }
    }

    drawTilt(tilt, time) {
      if (!tilt) return;
      const cx = this.cx, q = P(0, 150), d = Math.sign(tilt), len = 8 + Math.abs(tilt) / 8;
      cx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 6);
      cx.fillStyle = '#ffdf5c';
      cx.fillRect(Math.round(q.x - len), Math.round(q.y), Math.round(len * 2), 1);
      for (let i = 0; i < 4; i++) cx.fillRect(Math.round(q.x + d * (len - i)), Math.round(q.y - i), 1, i * 2 + 1);
      cx.globalAlpha = 1;
    }

    // st: { sim, phase, aimX, guide, preview:{type,ed,r}, time, dark, strobe, tilt, glow:Set, pick:Set(pins chosen) }
    draw(st) {
      const cx = this.cx, sim = st.sim, time = st.time;
      this.party = !!st.party;
      this.gears = !!(st.lane && st.lane.gears);
      const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      cx.setTransform(RS, 0, 0, RS, sx * RS, sy * RS);
      cx.imageSmoothingEnabled = true;
      cx.drawImage(this.bg, 0, 0, W, H);
      this.drawLaneFinish(); // under the oil, so the oil keeps its true colours
      const L0 = st.lane || {};
      this.ash = !!L0.ash;
      if (!L0.ash) cx.drawImage(this.oilCv, 0, 0, W, H);
      this.drawEndlessLane(st, L0, time);
      if (st.clearOil) cx.drawImage(this.oilCv, 0, 0, W, H); // Bowling Glasses
      if (!sim) { cx.drawImage(this.vig, 0, 0, W, H); return; }
      this.drawTilt(st.tilt, time);
      if (st.phase === 'aim') this.drawGuide(st);
      this.drawTrail(st);
      const items = [];
      for (const p of sim.pins) items.push({ z: p.z, f: () => this.drawPin(p, sim, time) });
      for (const q of sim.posts) items.push({ z: q.z, f: () => this.drawPost(q, time) });
      if (sim.tentacles) for (const tn of sim.tentacles) items.push({ z: tn.z, f: () => this.drawTentacle(tn, sim.time, time) });
      const strobeOn = Math.floor(time * 2.2) % 3 === 0;
      for (const b of sim.balls) {
        if (b.gone || b.delay > 0) continue;
        let a = b.kind === 'echo' ? 0.6 : b.kind === 'shadow' ? 0.4 : 1;
        if (b.kind === 'link' && sim.balls[b.chainTo] && !sim.balls[b.chainTo].gone) {
          const m = sim.balls[b.chainTo];
          items.push({ z: (b.z + m.z) / 2, f: () => { const p0 = P(b.x, b.z, b.r), p1 = P(m.x, m.z, m.r); pline(cx, p0.x, p0.y, p1.x, p1.y, '#9a9aa8', 1); } });
        }
        if (st.strobe && b.z > 70) a = strobeOn ? 1 : 0;
        if (a > 0) items.push({ z: b.z, f: () => this.drawBall(b, b.x, b.z, b.r, b.shard ? 'ice' : b.type, b.kind === 'main' || b.kind === 'twin' ? st.preview.ed : null, time, a) });
      }
      if (st.phase === 'aim' && st.preview) {
        const pv = st.preview;
        items.push({ z: C.BALL_Z0, f: () => this.drawBall(null, st.aimX, C.BALL_Z0, pv.r, pv.type, pv.ed, time) });
        if (pv.type === 'mirror') items.push({ z: C.BALL_Z0, f: () => this.drawBall(null, -st.aimX, C.BALL_Z0, pv.r, pv.type, pv.ed, time, 0.5) });
      }
      items.sort((a, b) => b.z - a.z).forEach(i => i.f());

      for (const f of sim.fx) {
        if (f.k === 'sparkle') { const q = P(f.x, f.z, 6 + f.t * 20); cx.globalAlpha = 1 - f.t / 0.6; cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(q.x), Math.round(q.y) - 1, 1, 3); cx.fillRect(Math.round(q.x) - 1, Math.round(q.y), 3, 1); cx.globalAlpha = 1; continue; }
        if (f.k === 'zap') {
          const a = P(f.x, f.z, 6), z2 = P(f.x2, f.z2, 6), n = 5;
          cx.globalAlpha = 1 - f.t / 0.6;
          let lx = a.x, ly = a.y;
          for (let i = 1; i <= n; i++) { const k = i / n, jx = i < n ? (Math.random() - 0.5) * 6 : 0, nx = a.x + (z2.x - a.x) * k + jx, ny = a.y + (z2.y - a.y) * k; pline(cx, lx, ly, nx, ny, i % 2 ? '#fff6a0' : '#ffffff', 1); lx = nx; ly = ny; }
          cx.globalAlpha = 1; continue;
        }
        if (f.k !== 'boom') continue;
        const q = P(f.x, f.z, 4), k = f.t / 0.6, R = f.r * S0 * q.s * (0.4 + k);
        cx.globalAlpha = 1 - k;
        this.circle(q.x, q.y, R, '#ff6a3d'); this.circle(q.x, q.y, R * 0.6, '#ffd447'); this.circle(q.x, q.y, R * 0.3, '#ffffff');
        cx.globalAlpha = 1;
      }
      for (const pt of this.parts) { const q = P(pt.x, pt.z, pt.h); cx.globalAlpha = Math.max(0, 1 - pt.t / pt.life); this.circle(q.x, q.y, 0.8, pt.col); }
      cx.globalAlpha = 1;

      if (st.dark) this.drawDark(st, time);
      if (st.pick) {
        for (const p of sim.pins) {
          const q = P(p.x, p.z, 20);
          cx.strokeStyle = st.pick.has(p.n) ? '#7be38a' : 'rgba(255,181,71,0.7)'; cx.lineWidth = 1;
          cx.strokeRect(Math.round(q.x - 4) + 0.5, Math.round(q.y - 4) + 0.5, 8, 8);
        }
      }
      cx.drawImage(this.vig, 0, 0, W, H);
      this.drawMonitor(sim, time);
      this.drawCrowd(st.crowd, time, st.dark);
      this.drawReturn(st.ret, time);
      this.drawTV(st.tv, time);
      if (st.replay) ptext(cx, '● REPLAY', 6, 96, FONT_S, (Math.floor(time * 2) % 2) ? '#ff5a6e' : '#ffd27a', 'left', '#140e16');

      // Floating score pops: ease out upward, hold, then fade (they live ~1.8s so they can be read).
      for (const p of this.pops) {
        const k = Math.min(1, p.t / 0.6), rise = Math.round((1 - (1 - k) * (1 - k)) * 14);
        const q = P(p.x, p.z, p.h + rise);
        // blink out at the end instead of fading (pixel-art style)
        if (p.t > 1.35 && Math.floor(p.t * 12) % 2) continue;
        ptext(cx, p.text, q.x, q.y, '800 7.5px Rubik, system-ui, sans-serif', p.col, 'center', '#140e12');
      }
      if (this.flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.6) + ')'; cx.fillRect(0, 0, W, H); }
      // undersea tint and rising bubbles
      if (st.lane && st.lane.deep) {
        cx.fillStyle = 'rgba(20,110,150,0.16)'; cx.fillRect(0, 0, W, H);
        for (let i = 0; i < 14; i++) { const x = (i * 29.3) % W, y = H - ((time * 22 + i * 47) % H); cx.fillStyle = 'rgba(200,240,255,0.5)'; cx.fillRect(Math.round(x), Math.round(y), 1, 1); }
      }
      // Old Father Time's shot clock
      if (this.shotClock != null) {
        const s = Math.ceil(this.shotClock), urgent = this.shotClock < 2;
        ptext(cx, s + '', W / 2, 74, '800 18px Rubik, system-ui, sans-serif', urgent ? (Math.floor(st.time * 6) % 2 ? '#ff3a4a' : '#ffffff') : '#ffd447', 'center', '#140e12');
        ptext(cx, 'SHOT CLOCK', W / 2, 82, '800 6px Rubik, system-ui, sans-serif', '#e8dcc8', 'center', '#140e12');
      }
      // "will it fall?": the edges close in and pulse with the heartbeat
      if (this.tension) {
        const k = 0.35 + 0.15 * Math.sin(st.time * 11);
        for (let i = 0; i < 14; i++) { cx.fillStyle = 'rgba(40,0,10,' + (k * (1 - i / 14) * 0.5) + ')'; cx.fillRect(i * 2, 0, 2, H); cx.fillRect(W - (i + 1) * 2, 0, 2, H); cx.fillRect(0, i * 2, W, 2); cx.fillRect(0, H - (i + 1) * 2, W, 2); }
        if (Math.floor(st.time * 3) % 2) ptext(cx, 'WILL IT FALL?', W / 2, 40, '800 9px Rubik, system-ui, sans-serif', '#ffd447', 'center', '#140e12');
      }
    }

    drawDark(st, time) {
      const g = this.dark.getContext('2d'), sim = st.sim;
      g.setTransform(RS, 0, 0, RS, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(6,2,16,0.93)'; g.fillRect(0, Math.round(P(0, C.ZBACK + 18, 34).y) + 1, W, H);
      g.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r) => { pdisc(g, x, y, r, 'rgba(0,0,0,0.35)'); pdisc(g, x, y, r * 0.8, 'rgba(0,0,0,0.5)'); pdisc(g, x, y, r * 0.6, 'rgba(0,0,0,1)'); };
      const f = P(0, -20); hole(f.x, f.y, 34);
      if (st.lane && st.lane.angler) { const lq = P(Math.sin(time * 0.7) * this.lhw * 0.7, 230 + 70 * Math.sin(time * 0.43)); hole(lq.x, lq.y, 30 * lq.s + 8); }
      for (const b of sim.balls) {
        if (b.gone || b.delay > 0) continue;
        if (st.strobe && b.z > 70 && Math.floor(time * 2.2) % 3 !== 0) continue;
        const q = P(b.x, b.z, 4); hole(q.x, q.y, (st.fog ? 12 : 26) * q.s + (st.fog ? 3 : 6));
      }
      for (const f2 of sim.fx) { const q = P(f2.x, f2.z); hole(q.x, q.y, 40 * q.s); }
      this.cx.drawImage(this.dark, 0, 0, W, H);
      if (st.glow) for (const p of sim.pins) if (st.glow.has(p.n) && !p.cleared && !p.gone) this.drawPin(p, sim, time, true);
    }

    tick(dt) {
      this.pops.forEach(p => { p.t += dt; }); this.pops = this.pops.filter(p => p.t < 1.8);
      for (const pt of this.parts) { pt.t += dt; pt.x += pt.vx * dt; pt.z += pt.vz * dt; pt.vh -= (pt.conf ? 40 : 160) * dt; if (pt.conf) pt.vh = Math.max(pt.vh, -18); pt.h = Math.max(0, pt.h + pt.vh * dt); }
      this.parts = this.parts.filter(p => p.t < p.life);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 18);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    }
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.round(GK.clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }
  GK.shade = shade;
  // Paint one frame of a TV cartoon (or the idle channel) into any context, scaled to fit w×h.
  GK.drawTVScene = function (ctx, w, h, kind, t, v, theme) {
    const k = Math.min(w / 38, h / 26), prevSnap = SNAP;
    SNAP = 2; ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.setTransform(k, 0, 0, k, (w - 38 * k) / 2, (h - 26 * k) / 2);
    ctx.beginPath(); ctx.rect(0, 0, 38, 26); ctx.clip();
    if (kind && TV_SCENES[kind]) TV_SCENES[kind](ctx, 0, 0, 38, 26, t, v || 0);
    else {
      ctx.fillStyle = '#1a2a3a'; ctx.fillRect(0, 0, 38, 26);
      ptext(ctx, 'LANE TV', 19, 12, '700 7px Rubik, system-ui, sans-serif', theme ? theme.sign : '#ffb547', 'center');
      ptext(ctx, 'waiting for a strike…', 19, 19, '600 4px Rubik, system-ui, sans-serif', '#a99bb5', 'center');
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < 26; y += 1) ctx.fillRect(0, y, 38, 0.5);
    ctx.restore(); SNAP = prevSnap;
  };
  GK.Renderer = Renderer;
})();
