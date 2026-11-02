// Gutter Kings — pseudo-3D pixel rendering of the 2D sim. Draws into a 200×356 buffer that the
// page scales up pixelated. Static lane art is rebuilt per alley theme.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const C = GK.C, W = C.W, H = C.H, P = GK.P, S0 = C.S0;
  // The lane is drawn in 200×356 "lane pixels" but rendered at RS× resolution: pixel-art layout,
  // crisp edges, smooth curves and readable text on phones.
  const RS = 3;
  const FONT_S = '700 7px Rubik, system-ui, sans-serif';
  const PROF = [[0, 0.3], [0.3, 0.5], [0.62, 0.2], [0.82, 0.28], [0.97, 0.14], [1, 0.05]];
  function prof(t) {
    for (let i = 1; i < PROF.length; i++) if (t <= PROF[i][0]) { const [t0, r0] = PROF[i - 1], [t1, r1] = PROF[i]; return r0 + (r1 - r0) * (t - t0) / (t1 - t0); }
    return 0.05;
  }
  function quad(g, a, b, c, d, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill(); }

  // ---------- TV cartoons (screen is ~38×26 px) ----------
  // Each scene draws frame t (seconds) of a short loop. v picks a variant.
  const px = (cx, x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), w, h); };
  function caption(cx, sx, sy, sw, sh, txt, col, t) {
    if (t < 0.25) return;
    cx.font = FONT_S; cx.textAlign = 'center';
    const y = sy + sh - 2, x = sx + sw / 2 + (t < 0.4 ? (0.4 - t) * 60 : 0);
    cx.fillStyle = '#000'; cx.fillText(txt, x + 1, y + 1); cx.fillStyle = col; cx.fillText(txt, x, y);
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
  const TV_SCENES = {
    strike(cx, sx, sy, sw, sh, t, v) {
      px(cx, sx, sy, sw, sh, v % 2 ? '#2a1446' : '#14324a');
      if (v % 2 === 0) {
        // ball smashes three pins that fly off spinning
        px(cx, sx, sy + 17, sw, 2, '#d8a56b');
        const bx = sx - 6 + Math.min(t, 0.7) / 0.7 * 26;
        cx.fillStyle = '#2b4fb8'; cx.beginPath(); cx.arc(bx, sy + 14, 3, 0, 7); cx.fill();
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
      cx.fillStyle = '#2b4fb8'; cx.beginPath(); cx.arc(sx + sw / 2 - 5 - off, sy + 12, 4, 0, 7); cx.fill();
      cx.fillStyle = '#d9609a'; cx.beginPath(); cx.arc(sx + sw / 2 + 5 + off, sy + 12, 4, 0, 7); cx.fill();
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
      if (Math.floor(t * 3) % 2) { cx.font = FONT_S; cx.textAlign = 'left'; cx.fillStyle = '#fff'; cx.fillText('GOBBLE', sx + 1, sy + 7); }
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
        else { cx.font = FONT_S; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.fillText('x_x', sx + sw / 2 + 8, sy + 9); }
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
      if (t > 0.8) { px(cx, x - 1, y - 5 + 1, 3, 1, '#000'); cx.font = FONT_S; cx.textAlign = 'center'; cx.fillStyle = '#ffd447'; if (Math.floor(t * 4) % 2) cx.fillText('OUCH', x, sy + 6); }
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
      this.cx = canvas.getContext('2d');
      const mk = () => { const c = document.createElement('canvas'); c.width = W * RS; c.height = H * RS; return c; };
      this.bg = mk(); this.dark = mk(); this.oilCv = mk(); this.vig = mk();
      this.buildVignette();
      this.pops = []; this.shake = 0; this.flash = 0; this.parts = [];
      this.theme = null;
    }
    buildVignette() {
      const g = this.vig.getContext('2d'); g.setTransform(RS, 0, 0, RS, 0, 0);
      const gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    circle(x, y, r, fill) { const cx = this.cx; cx.fillStyle = fill; cx.beginPath(); cx.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2); cx.fill(); }
    pop(x, z, h, text, col) { this.pops.push({ x, z, h, text, col, t: 0 }); if (this.pops.length > 40) this.pops.shift(); }
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
        g.fillStyle = T.c2; g.beginPath(); g.arc(x + 6, y + 6, 1.4, 0, Math.PI * 2); g.fill();
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
      for (let i = 0; i < 260; i++) { const x = (rng() * 2 - 1) * LHW, z = rng() * C.ZBACK, q = P(x, z); g.fillStyle = 'rgba(80,40,10,0.18)'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
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
        g.fillStyle = '#4a2c18'; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.fill();
      });
      GK.spots(LHW).forEach(([x, z], i) => { const q = P(x, z); g.fillStyle = i < 10 ? 'rgba(90,50,25,0.55)' : 'rgba(90,50,25,0.25)'; g.fillRect(Math.round(q.x - 1), Math.round(q.y), 2, 1); });
      quad(g, P(-E, -0.6), P(E, -0.6), P(E, 0.6), P(-E, 0.6), '#2a1416');
      for (const s of [-1, 1]) {
        quad(g, P(s * E, C.ZH - 16), P(s * E, C.ZBACK + 18), P(s * E, C.ZBACK + 18, 24), P(s * E, C.ZH - 16, 24), '#3d2a2c');
        const t1 = P(s * E, C.ZH - 16, 24), t2 = P(s * E, C.ZBACK + 18, 24);
        g.strokeStyle = '#7a5444'; g.lineWidth = 1; g.beginPath(); g.moveTo(t1.x, t1.y); g.lineTo(t2.x, t2.y); g.stroke();
      }
      // masking unit + marquee
      const mb = Math.round(P(0, C.ZBACK + 18, 34).y);
      const mg = g.createLinearGradient(0, 0, 0, mb);
      mg.addColorStop(0, shade(T.mask, -0.25)); mg.addColorStop(1, shade(T.mask, 0.08));
      g.fillStyle = mg; g.fillRect(0, 0, W, mb);
      this.drawMaskArt(g, mb);
      g.fillStyle = shade(T.mask, 0.18); g.fillRect(0, mb - 2, W, 2);
      g.fillStyle = '#0a060c'; g.fillRect(0, mb, W, 1);
      g.textAlign = 'center';
      g.shadowColor = T.sign; g.shadowBlur = 8;
      let fs = 15; g.font = fs + 'px Bungee, Rubik, sans-serif';
      while (g.measureText(this.signText).width > W - 56 && fs > 8) { fs -= 0.5; g.font = fs + 'px Bungee, Rubik, sans-serif'; }
      g.fillStyle = T.signSh; g.fillText(this.signText, W / 2 + 1, 28);
      g.fillStyle = T.sign; g.fillText(this.signText, W / 2, 27);
      g.shadowBlur = 0;
      g.font = '600 6.5px Rubik, system-ui, sans-serif';
      g.fillStyle = T.subc; g.fillText(this.subText, W / 2, 37);
    }

    // Visible oil, redrawn after every roll from the round's wear grid: a blue sheen board by
    // board, buffer streaks and glints, and a faint brown track where the ball has dried the line.
    // Little scenes on the masking unit above the pins, one per alley theme.
    drawMaskArt(g, mb) {
      const T = this.theme, name = this.signText || '', rng = GK.makeRng(GK.hash(name + 'mask'));
      g.save(); g.beginPath(); g.rect(0, 0, W, mb); g.clip();
      const dots = (n, col, r) => { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.arc(rng() * W, rng() * mb, r * (0.5 + rng()), 0, 7); g.fill(); } };
      if (/COSMIC|LUNAR/.test(name)) { dots(40, 'rgba(255,255,255,0.7)', 0.45); g.fillStyle = 'rgba(255,79,216,0.35)'; g.beginPath(); g.arc(22, 14, 8, 0, 7); g.fill(); g.fillStyle = 'rgba(92,225,255,0.35)'; g.beginPath(); g.arc(178, 22, 5, 0, 7); g.fill(); }
      if (/FROSTBITE/.test(name)) { for (let x = 0; x < W; x += 7) { g.fillStyle = 'rgba(220,245,255,0.55)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, 0); g.lineTo(x + 2, 5 + rng() * 6); g.closePath(); g.fill(); } dots(18, 'rgba(255,255,255,0.6)', 0.5); }
      if (/CARNIVAL/.test(name)) { for (let x = 0; x < W; x += 12) { g.fillStyle = (x / 12) % 2 ? 'rgba(255,74,90,0.35)' : 'rgba(255,243,224,0.18)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 12, 0); g.lineTo(x + 6, 10); g.closePath(); g.fill(); } }
      if (/BASEMENT|GUTTER/.test(name)) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 6, W, 3); g.fillRect(0, mb - 9, W, 2); for (let x = 14; x < W; x += 46) { g.fillStyle = 'rgba(150,170,120,0.25)'; g.fillRect(x, 4, 3, mb - 8); } }
      if (/BACK ROOM/.test(name)) { for (let x = 0; x < W; x += 6) { g.fillStyle = x % 12 ? 'rgba(120,20,30,0.25)' : 'rgba(60,8,16,0.3)'; g.fillRect(x, 0, 6, mb); } }
      if (/LUCKY|CHAMPIONSHIP/.test(name)) { for (let x = 6; x < W; x += 16) { g.fillStyle = 'rgba(255,210,122,0.18)'; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI * 2 / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 3, mb - 7 + Math.sin(a) * 3); } g.closePath(); g.fill(); } }
      g.restore();
    }
    setWear(wear) { this.wear = wear || null; this.rebuildOil(); }
    rebuildOil() {
      const g = this.oilCv.getContext('2d'); g.setTransform(RS, 0, 0, RS, 0, 0); g.clearRect(0, 0, W, H);
      this.drawOil(g, this.lhw || C.LHW, Math.round((this.lhw || C.LHW) * 2 / 1.064));
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
      cx.font = FONT_S; cx.textAlign = 'center'; cx.fillStyle = '#ffd27a';
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
          cx.fillStyle = (Math.floor(time * 4) % 2) ? '#ff5a6e' : '#ffd27a';
          cx.fillText('STUCK', hx + 16, hy - 3);
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
        cx.font = FONT_S; cx.textAlign = 'center';
        cx.fillText('LANE', sx + sw / 2, sy + 11); cx.fillText('TV', sx + sw / 2, sy + 20);
        if (Math.floor(time * 1.3) % 6 === 0) for (let k = 0; k < 60; k++) { cx.fillStyle = Math.random() < 0.5 ? '#fff' : '#555'; cx.fillRect(sx + Math.floor(Math.random() * sw), sy + Math.floor(Math.random() * sh), 1, 1); }
      } else {
        TV_SCENES[kind](cx, sx, sy, sw, sh, t, tv.v || 0, this);
      }
      // scanlines + glass glare
      cx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = sy; y < sy + sh; y += 2) cx.fillRect(sx, y, sw, 1);
      cx.fillStyle = 'rgba(255,255,255,0.08)'; cx.fillRect(sx + 1, sy + 1, sw - 2, 3);
      cx.restore();
      cx.fillStyle = (tv && tv.t < 3.2) ? '#ff3a3a' : '#3a5a3a'; cx.fillRect(X + w - 4, Y + h - 2, 2, 1);
    }

    // A few spectators in the front-left corner: they jump on strikes, clap spares, slump on gutters.
    drawCrowd(cr, time) {
      const cx = this.cx, mood = cr ? cr.mood : 'idle', t = cr ? cr.t : 0;
      const people = [[9, '#c84a5a', '#e8c39a', '#3a2418'], [24, '#4a7ac8', '#c8956a', '#1a1a22'], [39, '#e0b028', '#f0d0a8', '#8a4a20']];
      people.forEach(([x, shirt, skin, hair], i) => {
        let dy = Math.sin(time * 2 + i) * 0.5, arms = 0, slump = false;
        if (mood === 'cheer') { dy = -Math.abs(Math.sin(t * 10 + i * 1.3)) * 5; arms = 2; }
        else if (mood === 'clap') { dy = -Math.abs(Math.sin(t * 9 + i)) * 1.5; arms = 1; }
        else if (mood === 'groan') { dy = 1.5; slump = true; }
        const by = H - 8 + dy, sh = slump ? GK.shade(shirt, -0.45) : shirt;
        // shoulders and body
        cx.fillStyle = '#0c0810'; cx.beginPath(); cx.ellipse(x, by + 6, 7.2, 7.5, 0, Math.PI, 0); cx.fill();
        const gb = cx.createLinearGradient(x - 6, 0, x + 6, 0); gb.addColorStop(0, GK.shade(sh, 0.15)); gb.addColorStop(1, GK.shade(sh, -0.3));
        cx.fillStyle = gb; cx.beginPath(); cx.ellipse(x, by + 6, 6.2, 6.6, 0, Math.PI, 0); cx.fill(); cx.fillRect(x - 6.2, by + 6, 12.4, 4);
        if (arms === 2) { cx.strokeStyle = skin; cx.lineWidth = 1.8; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x - 5, by + 2); cx.lineTo(x - 8, by - 6); cx.moveTo(x + 5, by + 2); cx.lineTo(x + 8, by - 6); cx.stroke(); }
        if (arms === 1) { const k = Math.floor(t * 8 + i) % 2 ? 1.5 : 3.5; cx.fillStyle = skin; this.circle(x - k, by + 1, 1.3, skin); this.circle(x + k, by + 1, 1.3, skin); }
        // head
        const hy = by - 4 + (slump ? 2 : 0);
        this.circle(x, hy, 3.6, '#0c0810');
        this.circle(x, hy, 3.1, skin);
        cx.fillStyle = hair; cx.beginPath(); cx.arc(x, hy - 0.6, 3.2, Math.PI * 1.05, Math.PI * 1.95); cx.fill();
      });
      cx.font = '800 7px Rubik, system-ui, sans-serif'; cx.textAlign = 'center';
      if (mood === 'cheer' && t < 1.8) { cx.globalAlpha = Math.min(1, (1.8 - t) * 2); cx.fillStyle = '#ffd27a'; cx.fillText('YEAH!', 24, H - 26 - t * 6); cx.globalAlpha = 1; }
      if (mood === 'groan' && t < 1.8) { cx.globalAlpha = Math.min(1, (1.8 - t) * 2); cx.fillStyle = '#c9b7d3'; cx.fillText('ohh…', 24, H - 24); cx.globalAlpha = 1; }
    }

    drawPin(p, sim, time, glowOnly) {
      if (p.gone && !p.swallowed) return;
      if (p.gone) return;
      const cx = this.cx, def = GK.PINS[p.type] || GK.PINS.std;
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
        const rr = PW * S0 * sh.s * 0.75, gsh = cx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, rr);
        gsh.addColorStop(0, 'rgba(20,10,8,0.38)'); gsh.addColorStop(1, 'rgba(20,10,8,0)');
        cx.fillStyle = gsh; cx.beginPath(); cx.ellipse(sh.x, sh.y, rr, rr * 0.4, 0, 0, Math.PI * 2); cx.fill();
      }
      const pts = [], N = 22;
      for (let k = 0; k <= N; k++) { const t = k / N; const q = P(p.x + dir.x * L * sn * t, p.z + dir.z * L * sn * t, h0 + L * cs * t); pts.push([q.x, q.y, prof(t) * PW * S0 * q.s, t]); }
      const frozen = p.hp > 1 && p.standing;
      const outline = glowOnly ? '#ff4fd8' : '#2b1f24';
      for (const [x, y, r] of pts) this.circle(x, y, r + (glowOnly ? 1.2 : 0.45), outline);
      for (const [x, y, r] of pts) this.circle(x, y, r, frozen ? '#d8f4ff' : def.body);
      for (const [x, y, r, t] of pts) if (t > 0.1 && t < 0.45) this.circle(x + r * 0.35, y, r * 0.45, frozen ? '#9fd6ee' : def.shade);
      for (const [x, y, r, t] of pts) if (t > 0.05 && t < 0.95) this.circle(x + r * 0.42, y, r * 0.5, 'rgba(0,0,0,0.07)');
      for (const [x, y, r, t] of pts) if (t > 0.12 && t < 0.42) this.circle(x - r * 0.42, y, r * 0.24, 'rgba(255,255,255,0.9)');
      for (const [x, y, r, t] of pts) if (t > 0.78 && t < 0.92) this.circle(x - r * 0.35, y, r * 0.22, 'rgba(255,255,255,0.75)');
      for (const tt of [0.58, 0.67]) { const q = P(p.x + dir.x * L * sn * tt, p.z + dir.z * L * sn * tt, h0 + L * cs * tt); this.circle(q.x, q.y, prof(tt) * PW * S0 * q.s * 0.95, def.band); }
      if (p.type === 'explosive' && p.standing) { const q = P(p.x, p.z, h0 + L + 1.5); cx.fillStyle = (Math.floor(time * 8) % 2) ? '#ffd447' : '#ff6a3d'; cx.fillRect(Math.round(q.x), Math.round(q.y - 1), 1, 2); }
      if (p.type === 'gold' && p.standing && Math.floor(time * 2 + p.n) % 5 === 0) { const q = P(p.x, p.z, h0 + 9); cx.fillStyle = '#fff'; cx.fillRect(Math.round(q.x - 1), Math.round(q.y), 1, 1); }
      if (frozen) { const q = P(p.x, p.z, h0 + 4); cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(q.x + 1), Math.round(q.y), 1, 1); }
      cx.globalAlpha = 1;
    }

    drawBall(b, x, z, r, type, ed, time, alpha = 1) {
      const t = GK.BALLS[type] || GK.BALLS.house, cx = this.cx;
      const c = P(x, z, r), R = r * S0 * c.s, s2 = P(x, z);
      cx.globalAlpha = alpha;
      cx.fillStyle = 'rgba(15,8,10,0.35)'; cx.beginPath(); cx.ellipse(s2.x, s2.y, R, R * 0.32, 0, 0, Math.PI * 2); cx.fill();
      // reflection on the glossy lane
      cx.globalAlpha = alpha * 0.18; cx.fillStyle = t.col; cx.beginPath(); cx.ellipse(s2.x, s2.y + R * 0.35, R * 0.8, R * 0.35, 0, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = alpha;
      if (ed === 'neon') this.circle(c.x, c.y, R + 2.2, 'rgba(182,255,92,0.35)');
      if (type === 'blackhole') this.circle(c.x, c.y, R + 2.5 + Math.sin(time * 9) * 0.8, 'rgba(176,107,255,0.35)');
      this.circle(c.x, c.y, R + 0.8, ed === 'foil' ? '#9fe8ff' : ed === 'holo' ? `hsl(${(time * 300) % 360},90%,70%)` : '#0e0a10');
      if (type === 'ghost' || type === 'glass') cx.globalAlpha = alpha * (type === 'ghost' ? 0.55 : 0.75);
      { const gb = cx.createRadialGradient(c.x - R * 0.4, c.y - R * 0.45, R * 0.1, c.x, c.y, R * 1.05); gb.addColorStop(0, GK.shade(t.col, 0.35)); gb.addColorStop(0.55, t.col); gb.addColorStop(1, GK.shade(t.col, -0.55)); this.circle(c.x, c.y, R, gb); }
      if (type === 'mirror') { this.circle(c.x - R * 0.2, c.y - R * 0.2, R * 0.55, '#e8ecf2'); this.circle(c.x + R * 0.25, c.y + R * 0.25, R * 0.4, '#8a909a'); }
      if (type === 'snake') { cx.fillStyle = '#c8ff8a'; cx.fillRect(Math.round(c.x - R * 0.8), Math.round(c.y - 0.5), Math.round(R * 1.6), 1); }
      this.circle(c.x - R * 0.38, c.y - R * 0.4, R * 0.22, 'rgba(255,255,255,0.75)');
      this.circle(c.x - R * 0.2, c.y - R * 0.5, R * 0.1, t.hi);
      cx.globalAlpha = alpha;
      if (type === 'split' && !(b && b.didSplit)) { cx.fillStyle = '#5a3008'; cx.fillRect(Math.round(c.x - 0.5), Math.round(c.y - R), 1, Math.round(R * 2)); }
      if (type === 'bomb' && !(b && b.exploded)) { cx.fillStyle = (Math.floor(time * 10) % 2) ? '#ffd447' : '#ff6a3d'; cx.fillRect(Math.round(c.x + R * 0.4), Math.round(c.y - R - 1.5), 2, 2); }
      if (type === 'lucky7' && R > 3) { cx.font = FONT_S; cx.textAlign = 'center'; cx.fillStyle = '#ffe066'; cx.fillText('7', c.x, c.y + 3); }
      if (type === 'golden' && Math.floor(time * 3) % 3 === 0) { cx.fillStyle = '#fff'; cx.fillRect(Math.round(c.x - R * 0.5), Math.round(c.y - R * 0.5), 1, 1); }
      const ph = (b ? b.rot : 0.4) % (Math.PI * 2);
      if (R > 2.5 && type !== 'blackhole' && Math.cos(ph) > -0.1) {
        const oy = -Math.sin(ph) * R * 0.5;
        for (const [hx, hy] of [[-0.22, -0.1], [0.22, -0.1], [0, 0.28]]) { this.circle(c.x + hx * R, c.y + oy + hy * R, Math.max(0.6, R * 0.13), 'rgba(255,255,255,0.18)'); this.circle(c.x + hx * R + 0.15, c.y + oy + hy * R + 0.15, Math.max(0.5, R * 0.11), '#07050a'); }
      }
      cx.globalAlpha = 1;
    }

    drawPost(q, time) {
      const cx = this.cx, base = P(q.x, q.z), top = P(q.x, q.z, 22), R = q.r * S0 * base.s;
      cx.fillStyle = 'rgba(15,8,10,0.35)'; cx.beginPath(); cx.ellipse(base.x, base.y, R * 1.2, R * 0.4, 0, 0, Math.PI * 2); cx.fill();
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
      // arrowhead at the end of the line
      const e1 = P(lineX(214), 214), e0 = P(lineX(200), 200);
      const dx = e1.x - e0.x, dy = e1.y - e0.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      cx.strokeStyle = '#ffd27a'; cx.lineWidth = 1.5; cx.beginPath();
      cx.moveTo(e1.x - ux * 5 - uy * 3, e1.y - uy * 5 + ux * 3); cx.lineTo(e1.x, e1.y); cx.lineTo(e1.x - ux * 5 + uy * 3, e1.y - uy * 5 - ux * 3); cx.stroke();
      if (st.step === 'angle') {
        cx.font = FONT_S; cx.textAlign = 'center'; cx.fillStyle = '#ffb547';
        const deg = ang * 180 / Math.PI;
        cx.fillText((deg >= 0 ? '+' : '') + deg.toFixed(1) + '°', e1.x, e1.y - 6);
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
      const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      cx.setTransform(RS, 0, 0, RS, sx * RS, sy * RS);
      cx.imageSmoothingEnabled = true;
      cx.drawImage(this.bg, 0, 0, W, H);
      cx.drawImage(this.oilCv, 0, 0, W, H);
      if (!sim) { cx.drawImage(this.vig, 0, 0, W, H); return; }
      this.drawTilt(st.tilt, time);
      if (st.phase === 'aim') this.drawGuide(st);
      const items = [];
      for (const p of sim.pins) items.push({ z: p.z, f: () => this.drawPin(p, sim, time) });
      for (const q of sim.posts) items.push({ z: q.z, f: () => this.drawPost(q, time) });
      const strobeOn = Math.floor(time * 2.2) % 3 === 0;
      for (const b of sim.balls) {
        if (b.gone || b.delay > 0) continue;
        let a = b.kind === 'echo' ? 0.6 : 1;
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
      this.drawCrowd(st.crowd, time);
      this.drawReturn(st.ret, time);
      this.drawTV(st.tv, time);
      if (st.replay) { cx.font = FONT_S; cx.textAlign = 'left'; cx.fillStyle = (Math.floor(time * 2) % 2) ? '#ff5a6e' : '#ffd27a'; cx.fillText('● REPLAY', 6, 96); }

      // Floating score pops: ease out upward, hold, then fade (they live ~1.8s so they can be read).
      cx.font = '800 7.5px Rubik, system-ui, sans-serif'; cx.textAlign = 'center';
      for (const p of this.pops) {
        const k = Math.min(1, p.t / 0.6), rise = (1 - (1 - k) * (1 - k)) * 14;
        const q = P(p.x, p.z, p.h + rise);
        const sc = p.t < 0.15 ? 0.7 + 2 * p.t : 1;
        cx.globalAlpha = p.t < 1.3 ? 1 : GK.clamp(1 - (p.t - 1.3) / 0.5, 0, 1);
        cx.save(); cx.translate(q.x, q.y); cx.scale(sc, sc);
        cx.lineWidth = 2.2; cx.strokeStyle = 'rgba(14,8,18,0.9)'; cx.lineJoin = 'round'; cx.strokeText(p.text, 0, 0);
        cx.fillStyle = p.col; cx.fillText(p.text, 0, 0);
        cx.restore();
      }
      cx.globalAlpha = 1;
      if (this.flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.6) + ')'; cx.fillRect(0, 0, W, H); }
    }

    drawDark(st, time) {
      const g = this.dark.getContext('2d'), sim = st.sim;
      g.setTransform(RS, 0, 0, RS, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(6,2,16,0.93)'; g.fillRect(0, Math.round(P(0, C.ZBACK + 18, 34).y) + 1, W, H);
      g.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
      const f = P(0, -20); hole(f.x, f.y, 34);
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
      for (const pt of this.parts) { pt.t += dt; pt.x += pt.vx * dt; pt.z += pt.vz * dt; pt.vh -= 160 * dt; pt.h = Math.max(0, pt.h + pt.vh * dt); }
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
    const k = Math.min(w / 38, h / 26);
    ctx.save(); ctx.setTransform(k, 0, 0, k, (w - 38 * k) / 2, (h - 26 * k) / 2);
    ctx.beginPath(); ctx.rect(0, 0, 38, 26); ctx.clip();
    if (kind && TV_SCENES[kind]) TV_SCENES[kind](ctx, 0, 0, 38, 26, t, v || 0);
    else {
      ctx.fillStyle = '#1a2a3a'; ctx.fillRect(0, 0, 38, 26);
      ctx.fillStyle = theme ? theme.sign : '#ffb547'; ctx.font = '700 7px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('LANE TV', 19, 12); ctx.font = '600 4px Rubik, system-ui, sans-serif'; ctx.fillStyle = '#a99bb5'; ctx.fillText('waiting for a strike…', 19, 19);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let y = 0; y < 26; y += 1) ctx.fillRect(0, y, 38, 0.3);
    ctx.restore();
  };
  GK.Renderer = Renderer;
})();
