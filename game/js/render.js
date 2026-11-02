// Gutter Kings — pseudo-3D pixel rendering of the 2D sim. Draws into a 200×356 buffer that the
// page scales up pixelated. Static lane art is rebuilt per alley theme.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const C = GK.C, W = C.W, H = C.H, P = GK.P, S0 = C.S0;
  const PROF = [[0, 0.3], [0.3, 0.5], [0.62, 0.2], [0.82, 0.28], [0.97, 0.14], [1, 0.05]];
  function prof(t) {
    for (let i = 1; i < PROF.length; i++) if (t <= PROF[i][0]) { const [t0, r0] = PROF[i - 1], [t1, r1] = PROF[i]; return r0 + (r1 - r0) * (t - t0) / (t1 - t0); }
    return 0.05;
  }
  function quad(g, a, b, c, d, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill(); }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas; canvas.width = W; canvas.height = H;
      this.cx = canvas.getContext('2d'); this.cx.imageSmoothingEnabled = false;
      this.bg = document.createElement('canvas'); this.bg.width = W; this.bg.height = H;
      this.dark = document.createElement('canvas'); this.dark.width = W; this.dark.height = H;
      this.pops = []; this.shake = 0; this.flash = 0; this.parts = [];
      this.theme = null;
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
      g.imageSmoothingEnabled = false;
      g.fillStyle = T.carpet; g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < W; x += 10) {
        g.fillStyle = T.c1; g.fillRect(x + 3, y + 1, 4, 4);
        g.fillStyle = T.c2; g.fillRect(x + 4, y + 2, 2, 2);
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
        quad(g, P(s * (LHW + GUT * 0.38), 0), P(s * (LHW + GUT * 0.6), 0), P(s * (LHW + GUT * 0.6), C.ZBACK), P(s * (LHW + GUT * 0.38), C.ZBACK), '#2e2834');
      }
      for (let i = 0; i < nb; i++) {
        const x0 = -LHW + i * 2 * LHW / nb, x1 = x0 + 2 * LHW / nb;
        quad(g, P(x0, 0), P(x1, 0), P(x1, C.ZBACK), P(x0, C.ZBACK), T.wood[(i * 7) % T.wood.length]);
      }
      // grain flecks
      const rng = GK.makeRng(GK.hash(this.signText));
      for (let i = 0; i < 260; i++) { const x = (rng() * 2 - 1) * LHW, z = rng() * C.ZBACK, q = P(x, z); g.fillStyle = 'rgba(80,40,10,0.18)'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      quad(g, P(-LHW, C.ZH - 12), P(LHW, C.ZH - 12), P(LHW, C.ZBACK), P(-LHW, C.ZBACK), 'rgba(255,236,200,0.18)');
      this.drawOil(g, LHW, nb);
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
      g.fillStyle = T.mask; g.fillRect(0, 0, W, mb);
      g.fillStyle = shade(T.mask, 0.12); g.fillRect(0, mb - 2, W, 2);
      g.fillStyle = '#0a060c'; g.fillRect(0, mb, W, 1);
      g.textAlign = 'center';
      let fs = 17; g.font = '700 ' + fs + 'px "Pixelify Sans", sans-serif';
      while (g.measureText(this.signText).width > W - 50 && fs > 9) { fs--; g.font = '700 ' + fs + 'px "Pixelify Sans", sans-serif'; }
      g.fillStyle = T.signSh; g.fillText(this.signText, W / 2 + 1, 28);
      g.fillStyle = T.sign; g.fillText(this.signText, W / 2, 27);
      g.font = '8px "Silkscreen", monospace';
      g.fillStyle = T.subc; g.fillText(this.subText, W / 2, 37);
    }

    // Visible oil: a blue sheen board by board, strongest where the pattern is oiliest, with
    // lighter buffer streaks running down the lane like real conditioned lanes under the lights.
    drawOil(g, LHW, nb) {
      const pat = this.oil, len = Math.min(C.ZBACK, (GK.OIL[pat] || GK.OIL.house).len);
      const tones = [[70, 140, 255], [100, 170, 255], [55, 115, 225], [130, 190, 255]];
      const bw = 2 * LHW / nb, rng = GK.makeRng(GK.hash(pat + nb));
      for (let i = 0; i < nb; i++) {
        const x0 = -LHW + i * bw, x1 = x0 + bw, xm = (x0 + x1) / 2;
        const tone = tones[(i * 3 + (i >> 2)) % tones.length];
        for (let z = 0; z < len; z += 6) {
          const o = GK.oilAt(pat, xm, z + 3, LHW);
          if (o < 0.03) continue;
          const a = (0.07 + 0.3 * o) * (0.85 + rng() * 0.3);
          quad(g, P(x0, z), P(x1, z), P(x1, z + 6), P(x0, z + 6), 'rgba(' + tone[0] + ',' + tone[1] + ',' + tone[2] + ',' + a.toFixed(3) + ')');
        }
      }
      // buffer streaks and glints
      for (let k = 0; k < 9; k++) {
        const x = -LHW + (k + 0.5) * 2 * LHW / 9 + (rng() - 0.5) * 2;
        for (let z = 2; z < len - 4; z += 2) {
          const o = GK.oilAt(pat, x, z, LHW); if (o < 0.25) continue;
          const q = P(x, z); g.fillStyle = 'rgba(200,230,255,' + (0.08 + 0.18 * o).toFixed(3) + ')'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
        }
      }
      for (let k = 0; k < 120; k++) {
        const x = (rng() * 2 - 1) * LHW, z = rng() * len, o = GK.oilAt(pat, x, z, LHW);
        if (o < 0.4) continue;
        const q = P(x, z); g.fillStyle = 'rgba(235,248,255,' + (0.3 + 0.4 * o).toFixed(2) + ')'; g.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
    }

    // A few spectators in the front corners: they jump on strikes, clap spares, slump on gutters.
    drawCrowd(cr, time) {
      const cx = this.cx, mood = cr ? cr.mood : 'idle', t = cr ? cr.t : 0;
      const people = [[8, '#c84a5a', '#3a2a2a'], [21, '#4a7ac8', '#e8c39a'], [34, '#e0b028', '#6b4320'], [166, '#2fb36a', '#e8c39a'], [179, '#b06bff', '#3a2a2a'], [192, '#ff7a59', '#c8956a']];
      people.forEach(([x, shirt, skin], i) => {
        let dy = Math.round(Math.sin(time * 2 + i) * 0.6), arms = false, slump = false;
        if (mood === 'cheer') { dy = -Math.round(Math.abs(Math.sin(t * 11 + i * 1.3)) * 5); arms = true; }
        else if (mood === 'clap') { dy = -Math.round(Math.abs(Math.sin(t * 9 + i)) * 2); arms = Math.floor(t * 8 + i) % 2 === 0; }
        else if (mood === 'groan') { dy = 2; slump = true; }
        const by = H - 9 + dy;
        cx.fillStyle = '#140e16'; cx.fillRect(x - 5, by - 1, 11, 12);
        cx.fillStyle = slump ? GK.shade(shirt, -0.45) : shirt; cx.fillRect(x - 4, by, 9, 10);
        cx.fillStyle = skin; cx.fillRect(x - 2, by - 6 + (slump ? 2 : 0), 5, 5);
        cx.fillStyle = '#140e16'; cx.fillRect(x - 2, by - 7 + (slump ? 2 : 0), 5, 2);
        if (arms) { cx.fillStyle = skin; cx.fillRect(x - 6, by - 6, 2, 6); cx.fillRect(x + 5, by - 6, 2, 6); }
      });
      if (mood === 'cheer' && t < 1.6) { cx.font = '8px "Silkscreen", monospace'; cx.textAlign = 'center'; cx.fillStyle = '#ffd27a'; cx.fillText('YEAH!', 21, H - 24 - Math.round(t * 6)); cx.fillText('WOO!', 179, H - 24 - Math.round(t * 6)); }
      if (mood === 'groan' && t < 1.6) { cx.font = '8px "Silkscreen", monospace'; cx.textAlign = 'center'; cx.fillStyle = '#a8949f'; cx.fillText('ohh…', 21, H - 22); cx.fillText('ugh', 179, H - 22); }
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
      if (!glowOnly) { cx.fillStyle = 'rgba(30,15,10,0.28)'; cx.beginPath(); cx.ellipse(sh.x, sh.y, PW * S0 * sh.s * 0.6, 1.4 * sh.s * 2, 0, 0, Math.PI * 2); cx.fill(); }
      const pts = [], N = 14;
      for (let k = 0; k <= N; k++) { const t = k / N; const q = P(p.x + dir.x * L * sn * t, p.z + dir.z * L * sn * t, h0 + L * cs * t); pts.push([q.x, q.y, prof(t) * PW * S0 * q.s, t]); }
      const frozen = p.hp > 1 && p.standing;
      const outline = glowOnly ? '#ff4fd8' : '#2b1f24';
      for (const [x, y, r] of pts) this.circle(x, y, r + (glowOnly ? 1.2 : 0.7), outline);
      for (const [x, y, r] of pts) this.circle(x, y, r, frozen ? '#d8f4ff' : def.body);
      for (const [x, y, r, t] of pts) if (t > 0.1 && t < 0.45) this.circle(x + r * 0.35, y, r * 0.45, frozen ? '#9fd6ee' : def.shade);
      for (const [x, y, r, t] of pts) if (t > 0.12 && t < 0.4) this.circle(x - r * 0.4, y, r * 0.28, 'rgba(255,255,255,0.85)');
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
      if (ed === 'neon') this.circle(c.x, c.y, R + 2.2, 'rgba(182,255,92,0.35)');
      if (type === 'blackhole') this.circle(c.x, c.y, R + 2.5 + Math.sin(time * 9) * 0.8, 'rgba(176,107,255,0.35)');
      this.circle(c.x, c.y, R + 0.8, ed === 'foil' ? '#9fe8ff' : ed === 'holo' ? `hsl(${(time * 300) % 360},90%,70%)` : '#0e0a10');
      if (type === 'ghost' || type === 'glass') cx.globalAlpha = alpha * (type === 'ghost' ? 0.55 : 0.75);
      this.circle(c.x, c.y, R, t.col);
      if (type === 'mirror') { this.circle(c.x - R * 0.2, c.y - R * 0.2, R * 0.55, '#e8ecf2'); this.circle(c.x + R * 0.25, c.y + R * 0.25, R * 0.4, '#8a909a'); }
      if (type === 'snake') { cx.fillStyle = '#c8ff8a'; cx.fillRect(Math.round(c.x - R * 0.8), Math.round(c.y - 0.5), Math.round(R * 1.6), 1); }
      this.circle(c.x + R * 0.25, c.y + R * 0.2, R * 0.7, 'rgba(0,0,0,0.18)');
      this.circle(c.x - R * 0.35, c.y - R * 0.35, R * 0.26, t.hi);
      cx.globalAlpha = alpha;
      if (type === 'split' && !(b && b.didSplit)) { cx.fillStyle = '#5a3008'; cx.fillRect(Math.round(c.x - 0.5), Math.round(c.y - R), 1, Math.round(R * 2)); }
      if (type === 'bomb' && !(b && b.exploded)) { cx.fillStyle = (Math.floor(time * 10) % 2) ? '#ffd447' : '#ff6a3d'; cx.fillRect(Math.round(c.x + R * 0.4), Math.round(c.y - R - 1.5), 2, 2); }
      if (type === 'lucky7' && R > 3) { cx.font = '8px "Silkscreen", monospace'; cx.textAlign = 'center'; cx.fillStyle = '#ffe066'; cx.fillText('7', c.x, c.y + 3); }
      if (type === 'golden' && Math.floor(time * 3) % 3 === 0) { cx.fillStyle = '#fff'; cx.fillRect(Math.round(c.x - R * 0.5), Math.round(c.y - R * 0.5), 1, 1); }
      const ph = (b ? b.rot : 0.4) % (Math.PI * 2);
      if (R > 2.5 && type !== 'blackhole' && Math.cos(ph) > -0.1) {
        const oy = -Math.sin(ph) * R * 0.5;
        for (const [hx, hy] of [[-0.22, -0.1], [0.22, -0.1], [0, 0.28]]) this.circle(c.x + hx * R, c.y + oy + hy * R, Math.max(0.6, R * 0.12), '#07050a');
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
        cx.font = '8px "Silkscreen", monospace'; cx.textAlign = 'center'; cx.fillStyle = '#ffb547';
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
      for (let i = 0; i < 20; i++) { cx.fillStyle = (i % 2) === on ? '#ffd27a' : '#6b4320'; cx.fillRect(5 + i * 10, 6, 2, 2); }
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
      cx.setTransform(1, 0, 0, 1, 0, 0);
      const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0, sy = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
      cx.setTransform(1, 0, 0, 1, sx, sy);
      cx.drawImage(this.bg, 0, 0);
      if (!sim) return;
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
      for (const pt of this.parts) { const q = P(pt.x, pt.z, pt.h); cx.globalAlpha = Math.max(0, 1 - pt.t / pt.life); cx.fillStyle = pt.col; cx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      cx.globalAlpha = 1;

      if (st.dark) this.drawDark(st, time);
      if (st.pick) {
        for (const p of sim.pins) {
          const q = P(p.x, p.z, 20);
          cx.strokeStyle = st.pick.has(p.n) ? '#7be38a' : 'rgba(255,181,71,0.7)'; cx.lineWidth = 1;
          cx.strokeRect(Math.round(q.x - 4) + 0.5, Math.round(q.y - 4) + 0.5, 8, 8);
        }
      }
      this.drawMonitor(sim, time);
      this.drawCrowd(st.crowd, time);
      if (st.replay) { cx.font = '8px "Silkscreen", monospace'; cx.textAlign = 'left'; cx.fillStyle = (Math.floor(time * 2) % 2) ? '#ff5a6e' : '#ffd27a'; cx.fillText('● REPLAY', 6, 50); }

      cx.font = '8px "Silkscreen", monospace'; cx.textAlign = 'center';
      for (const p of this.pops) {
        const q = P(p.x, p.z, p.h + p.t * 20);
        cx.globalAlpha = GK.clamp(1.4 - p.t * 1.4, 0, 1);
        cx.fillStyle = '#140e16'; cx.fillText(p.text, q.x + 1, q.y + 1);
        cx.fillStyle = p.col; cx.fillText(p.text, q.x, q.y);
      }
      cx.globalAlpha = 1;
      if (this.flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.6) + ')'; cx.fillRect(0, 0, W, H); }
    }

    drawDark(st, time) {
      const g = this.dark.getContext('2d'), sim = st.sim;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.fillStyle = 'rgba(6,2,16,0.93)'; g.fillRect(0, Math.round(P(0, C.ZBACK + 18, 34).y) + 1, W, H);
      g.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
      const f = P(0, -20); hole(f.x, f.y, 34);
      for (const b of sim.balls) {
        if (b.gone || b.delay > 0) continue;
        if (st.strobe && b.z > 70 && Math.floor(time * 2.2) % 3 !== 0) continue;
        const q = P(b.x, b.z, 4); hole(q.x, q.y, 26 * q.s + 6);
      }
      for (const f2 of sim.fx) { const q = P(f2.x, f2.z); hole(q.x, q.y, 40 * q.s); }
      this.cx.drawImage(this.dark, 0, 0);
      if (st.glow) for (const p of sim.pins) if (st.glow.has(p.n) && !p.cleared && !p.gone) this.drawPin(p, sim, time, true);
    }

    tick(dt) {
      this.pops.forEach(p => { p.t += dt; }); this.pops = this.pops.filter(p => p.t < 1);
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
  GK.Renderer = Renderer;
})();
