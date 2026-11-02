// Gutter Kings — the Wall of Fame: framed pixel portraits of the Regulars (Kaleb, Quinn, Levi),
// shown after you beat the Gutter King, with an empty frame below for the new champion.
// Portraits are 64×80 pixel art, lit from the upper left.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const W = 64, H = 80;

  GK.drawPortrait = function (ctx, who) {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const p = (x, y, c) => r(x, y, 1, 1, c);
    // filled ellipse, pixel-exact
    const ell = (cx, cy, rx, ry, c) => {
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
        const k = 1 - ((y - cy) / ry) ** 2; if (k < 0) continue;
        const hw = rx * Math.sqrt(k), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
        r(x0, y, Math.max(1, x1 - x0), 1, c);
      }
    };
    const dith = (x, y, w, h, c, on = 0) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((x + i + y + j) % 2 === on) p(x + i, y + j, c); };
    // backdrop: soft studio light behind the head
    const backdrop = (c0, c1) => {
      r(0, 0, W, H, c1);
      ell(32, 32, 30, 36, GK.shadeMix ? c0 : c0);
      ctx.globalAlpha = 0.5; ell(32, 32, 34, 40, c0); ctx.globalAlpha = 1;
      ell(32, 30, 26, 30, c0);
    };
    // A face: egg-shaped, lit from the upper left, with a soft cheek light.
    const face = (o) => {
      const { cx, top, bot, rx, skin, skinD, skinL, chin = 0.5 } = o;
      const mid = top + (bot - top) * 0.42, rows = {};
      for (let y = top; y <= bot; y++) {
        let hw;
        if (y <= mid) hw = rx * Math.sqrt(Math.max(0, 1 - ((mid - y) / (mid - top + 0.8)) ** 2));
        else { const u = (y - mid) / (bot - mid); hw = rx * (1 - (1 - chin) * u * u) * Math.sqrt(Math.max(0.2, 1 - u * u * 0.2)); }
        hw = Math.max(1.5, hw); rows[y] = hw;
        const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw), xs = Math.round(cx + hw * 0.38);
        r(x0, y, x1 - x0, 1, skin); r(xs, y, x1 - xs, 1, skinD);
      }
      ell(cx - rx * 0.45, mid + 4, 2.5, 3.5, skinL);
      return rows;
    };
    // eyes: white, iris, pupil, a catchlight, lid line and brow
    const eye = (x, y, iris, o = {}) => {
      if (o.smile) { r(x, y + 1, 5, 1, '#2a1a12'); p(x - 1, y + 2, '#2a1a12'); p(x + 5, y + 2, '#2a1a12'); r(x + 1, y, 3, 1, '#2a1a12'); return; }
      r(x, y, 5, 3, '#f4f0ec'); r(x + 1, y, 3, 3, iris); r(x + 2, y + 1, 1, 1, '#120c0a'); p(x + 1, y, '#ffffff');
      r(x - 1, y - 1, 7, 1, '#3a2418'); if (o.heavy) r(x, y, 5, 1, o.lid || '#c89a84');
    };
    const brow = (x, y, w, c, tilt = 0) => { r(x, y, w, 2, c); if (tilt) p(tilt > 0 ? x + w - 1 : x, y - 1, c); };
    // torso: shoulders as a wide rounded shape
    const torso = (cx, y, hw, c, cD, cL) => {
      for (let j = 0; y + j < H; j++) {
        const w2 = Math.min(hw, hw * 0.72 + j * 2.4), x0 = Math.round(cx - w2), x1 = Math.round(cx + w2);
        r(x0, y + j, x1 - x0, 1, c); r(Math.round(cx + w2 * 0.5), y + j, x1 - Math.round(cx + w2 * 0.5), 1, cD);
        if (cL) r(x0 + 2, y + j, Math.round(w2 * 0.35), 1, cL);
      }
    };
    const neck = (cx, y0, y1, hw, skin, skinD) => { r(cx - hw, y0, hw * 2, y1 - y0, skin); r(cx + 2, y0, hw - 2, y1 - y0, skinD); };
    const chinShadow = (cx, y, hw, skinD) => { r(cx - hw, y, hw * 2, 2, skinD); };

    ctx.clearRect(0, 0, W, H);

    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (who === 'quinn') {
      const hair = '#3a2418', hairD = '#25160d', hairL = '#5a3a24', skin = '#f3d4c0', skinD = '#ddb39d', skinL = '#fbe6d8';
      const beard = '#83462a', beardD = '#5e2f1a', beardL = '#a35e38', sw = '#7a1f35', swD = '#5a1426', swL = '#943047';
      backdrop('#4a2c3e', '#2e1a28');
      // long straight hair behind the head, falling past the shoulders with uneven ends
      ell(32, 28, 16, 17, hair);
      for (let x = 14; x < 24; x++) r(x, 26, 1, 46 + (hash(x, 1) % 5), hair);
      for (let x = 41; x < 51; x++) r(x, 26, 1, 45 + (hash(x, 2) % 5), hair);
      torso(32, 60, 30, sw, swD, swL);
      // ribbed V-neck
      for (let i = 0; i < 12; i++) { const hw = Math.max(0, 7 - i * 0.62); r(Math.round(32 - hw), 60 + i, Math.round(hw * 2), 1, skin); p(Math.round(32 - hw) - 1, 60 + i, swL); p(Math.round(32 + hw), 60 + i, swD); }
      // hair in front of the shoulders
      for (let x = 15; x < 23; x++) r(x, 52, 1, 22 + (hash(x, 3) % 5), hair);
      for (let x = 42; x < 50; x++) r(x, 52, 1, 21 + (hash(x, 4) % 5), hair);
      neck(32, 46, 61, 6, skin, skinD);
      face({ cx: 32, top: 17, bot: 53, rx: 10.5, skin, skinD, skinL, chin: 0.42 });
      chinShadow(32, 54, 5, skinD);
      // hair parted in the middle, sweeping down both sides of the face
      ell(32, 17, 12, 6, hair);
      for (let y = 18; y < 48; y++) {
        const fw = Math.min(8.5, 1 + (y - 17) * 1.35); // the forehead opens up below the part
        const l = Math.round(32 - fw), rr = Math.round(32 + fw);
        if (y < 30) { r(20, y, l - 20, 1, hair); r(rr, y, 44 - rr, 1, hair); }
        else { r(20, y, 3, 1, hair); r(42, y, 3, 1, hair); }
      }
      r(32, 11, 1, 7, hairD);
      for (const [x, y, l] of [[24, 14, 12], [27, 13, 6], [37, 13, 6], [40, 14, 12], [17, 30, 34], [21, 34, 30], [44, 31, 33], [47, 36, 28]]) r(x, y, 1, l, hairL);
      for (const [x, y, l] of [[19, 40, 30], [45, 42, 26], [23, 22, 14], [41, 22, 14]]) r(x, y, 1, l, hairD);
      // brows and relaxed, slightly heavy-lidded eyes
      brow(25, 28, 6, '#4a2c1c'); brow(34, 28, 6, '#4a2c1c');
      eye(25, 31, '#5a3420', { heavy: true }); eye(34, 31, '#5a3420', { heavy: true, lid: skinD });
      // nose
      r(32, 32, 1, 7, skinD); r(30, 39, 5, 1, skinD); p(30, 38, skinD); p(34, 38, '#c89a84'); p(31, 31, skinL);
      for (const [x, y] of [[26, 36], [28, 37], [37, 36], [39, 37], [36, 38]]) p(x, y, '#e0ae96'); // freckles
      // full goatee: the moustache runs down both corners of the mouth into the chin beard,
      // one connected ring of hair with skin showing on the cheeks
      r(28, 41, 9, 2, beard); r(29, 41, 3, 1, beardL); p(27, 42, beardD); p(37, 42, beardD);
      r(27, 43, 2, 4, beard); r(36, 43, 2, 4, beardD);
      r(27, 47, 11, 2, beard);
      r(28, 49, 9, 2, beard); r(29, 51, 7, 2, beard); r(30, 53, 5, 1, beardD); r(31, 54, 3, 1, beardD);
      r(34, 47, 3, 6, beardD); r(29, 47, 3, 2, beardL); p(30, 50, beardL);
      // mouth inside the ring
      r(29, 44, 7, 1, '#9a5650'); r(30, 45, 5, 1, '#d4908a'); p(29, 45, beard); p(35, 45, beard); r(29, 46, 7, 1, beard);
      // gold chain with a dark pendant
      for (const [x, y] of [[27, 58], [28, 60], [29, 62], [30, 64], [31, 66], [34, 64], [35, 62], [36, 60], [37, 58]]) p(x, y, '#e8c860');
      r(31, 67, 2, 2, '#1c1418'); p(31, 67, '#6a5a6a');
      // round sunglasses hooked into the collar, hanging
      const lens = (cx, cy) => { ell(cx, cy, 4, 4, '#b8bcc6'); ell(cx, cy, 3, 3, '#121014'); p(cx - 1, cy - 2, '#6a7080'); p(cx - 2, cy - 1, '#4a5060'); };
      r(38, 63, 1, 3, '#c8ccd4'); lens(39, 69); r(39, 73, 1, 1, '#c8ccd4'); lens(39, 77);
    } else if (who === 'kaleb') {
      const hair = '#6a4528', hairD = '#4a2e18', hairL = '#9a6a40', skin = '#f2cfb4', skinD = '#dab096', skinL = '#fbe2d0';
      const sh = '#8fb48f', shD = '#749a74', shL = '#a8caa8';
      backdrop('#2e4a34', '#1c2e22');
      // the mass of curly hair behind the head
      ell(32, 22, 18, 15, hair); ell(18, 34, 6, 13, hair); ell(46, 34, 6, 13, hair);
      torso(32, 60, 30, sh, shD, shL);
      for (let x = 6; x < 60; x += 3) r(x, 64, 1, 16, shD); // ribbed knit
      // open polo collar and placket
      for (let i = 0; i < 9; i++) { const hw = Math.max(0, 5 - i * 0.6); r(Math.round(32 - hw), 61 + i, Math.round(hw * 2), 1, skin); }
      for (let i = 0; i < 6; i++) { r(22 + i, 58 + i, 5, 1, shL); r(37 - i, 58 + i, 5, 1, sh); }
      neck(32, 46, 62, 6, skin, skinD);
      face({ cx: 32, top: 19, bot: 52, rx: 10.5, skin, skinD, skinL, chin: 0.45 });
      chinShadow(32, 53, 5, skinD);
      // beaded necklace
      for (let i = 0; i < 11; i++) p(27 + i, 58 + Math.round(((i - 5) / 5) ** 2 * -2 + 2), i % 2 ? '#2e2e3e' : '#9a7a6a');
      // ears and a stud earring
      ell(21, 36, 2, 3.5, skin); ell(43, 36, 2, 3.5, skinD); p(21, 40, '#e8f0ff'); p(20, 40, '#a8b8d8');
      // big, loose curls around the outline and over the forehead
      const curl = (x, y, rad) => {
        ell(x, y, rad, rad, hair);
        ell(x + rad * 0.3, y + rad * 0.35, rad * 0.55, rad * 0.45, hairD);
        r(Math.round(x - rad * 0.6), Math.round(y - rad * 0.55), Math.max(1, Math.round(rad * 0.8)), 1, hairL);
        p(Math.round(x - rad * 0.75), Math.round(y - rad * 0.2), hairL);
      };
      for (const [x, y, rad] of [[20, 18, 4.5], [26, 13, 4.5], [33, 11, 4.5], [40, 13, 4.5], [45, 19, 4.5], [16, 25, 4], [48, 26, 4], [15, 33, 3.5], [49, 33, 3.5], [16, 41, 3.5], [48, 41, 3.5], [18, 48, 3], [46, 48, 3], [30, 16, 3.5], [37, 17, 3.5], [23, 21, 3.5], [42, 22, 3.5], [27, 21, 3], [34, 21, 3]]) curl(x, y, rad);
      // smiling, squinting eyes and raised cheeks
      brow(24, 27, 6, '#4a2e1c', -1); brow(34, 27, 6, '#4a2e1c', 1);
      eye(24, 31, '#4a6a5a', { smile: true }); eye(35, 31, '#4a6a5a', { smile: true });
      ell(25, 37, 2.5, 1.5, skinL); r(38, 37, 4, 1, skinD);
      r(32, 31, 1, 7, skinD); r(30, 38, 5, 1, skinD); p(29, 37, skinD); p(31, 31, skinL);
      // the big toothy grin
      r(25, 41, 15, 1, '#8a4a40');
      r(25, 42, 15, 5, '#5a1a1a');
      r(25, 42, 15, 2, '#fbfbf6'); for (const x of [28, 31, 34, 37]) p(x, 43, '#d8d4cc');
      r(27, 46, 11, 1, '#f0ece4');
      p(24, 41, skinD); p(40, 41, skinD); r(26, 47, 13, 1, '#d09088');
    } else if (who === 'levi') {
      const hair = '#2a1c14', hairD = '#1a110c', hairL = '#4a3424', skin = '#f2d4bc', skinD = '#dab49c', skinL = '#fbe4d2', stub = '#c4a08a';
      const sh = '#3a8ad0', shD = '#2c6eaa', shL = '#5aa4e4', tee = '#4aa8e6', teeD = '#3a8ccc';
      backdrop('#24345a', '#162038');
      torso(32, 59, 32, sh, shD, shL);
      // blue tee under the open shirt
      for (let j = 0; j < 21; j++) { const hw = 9 + j * 0.2; r(Math.round(32 - hw), 59 + j, Math.round(hw * 2), 1, tee); r(33, 59 + j, Math.round(hw) - 1, 1, teeD); }
      r(26, 59, 13, 2, teeD);
      // shirt lapels
      for (let i = 0; i < 14; i++) { r(18 + Math.round(i * 0.35), 60 + i, 5, 1, i < 5 ? shL : sh); r(41 - Math.round(i * 0.35), 60 + i, 5, 1, i < 5 ? shD : sh); }
      // rubber ducks all over the shirt
      const duck = (x, y) => { r(x, y + 1, 4, 2, '#ffd23a'); r(x + 2, y, 2, 2, '#ffd23a'); p(x + 3, y, '#1a1a1a'); p(x + 4, y + 1, '#ff8a1a'); p(x, y + 1, '#fff3a8'); p(x + 1, y + 3, '#d8a820'); };
      for (const [x, y] of [[4, 66], [10, 72], [5, 76], [15, 64], [44, 64], [50, 70], [55, 64], [47, 76], [56, 75]]) duck(x, y);
      neck(32, 47, 61, 7, skin, skinD);
      // hair: a tight cap behind the head
      ell(32, 22, 13.5, 11, hair);
      const rows = face({ cx: 32, top: 18, bot: 53, rx: 12, skin, skinD, skinL, chin: 0.55 });
      chinShadow(32, 54, 6, skinD);
      ell(19.5, 35, 2, 4, skin); ell(44.5, 35, 2, 4, skinD);
      // light stubble along the jaw, chin and upper lip
      for (let y = 40; y < 54; y++) for (let x = 22; x < 43; x++) {
        const inFace = rows[y] != null && Math.abs(x - 32 + 0.5) < rows[y] - 0.5;
        const zone = y >= 47 || x < 25 || x > 39 || (y >= 41 && y <= 42 && x > 27 && x < 37);
        if (inFace && zone && hash(x, y) % 5 < 2) p(x, y, stub);
      }
      // pulled back tight into a top bun: the hairline sits high, a few loose strands at the temples
      for (let y = 14; y < 24; y++) {
        const hw = 12.5 * Math.sqrt(Math.max(0, 1 - ((y - 22) / 9) ** 2));
        const fw = y < 20 ? 0 : Math.min(10, (y - 19) * 3.2);
        r(Math.round(32 - hw), y, Math.round(hw - fw), 1, hair); r(Math.round(32 + fw), y, Math.round(hw - fw), 1, hair);
      }
      r(20, 22, 2, 9, hair); r(43, 22, 2, 9, hair);
      for (const [x, y, l] of [[24, 15, 6], [28, 14, 5], [36, 14, 5], [40, 15, 6]]) r(x, y, 1, l, hairL);
      ell(32, 9, 6, 5, hair); ell(30.5, 7.5, 2.5, 1.5, hairL); r(29, 13, 7, 2, hairD); // bun and tie
      r(21, 25, 1, 8, hairD); p(22, 33, hair); r(43, 26, 1, 6, hairD);
      brow(25, 28, 6, '#2a1c14'); brow(35, 28, 6, '#2a1c14');
      eye(25, 31, '#4a3020', { heavy: true, lid: skinD }); eye(35, 31, '#4a3020', { heavy: true, lid: skinD });
      r(32, 32, 1, 7, skinD); r(30, 39, 6, 1, skinD); p(29, 38, skinD); p(31, 31, skinL);
      // a little smirk
      r(28, 45, 7, 1, '#a8685e'); p(35, 44, '#a8685e'); r(29, 46, 5, 1, '#e0a49a');
    } else {
      // the empty frame waiting for the player
      backdrop('#241c2e', '#18121e');
      ell(32, 30, 11, 13, '#30263c'); torso(32, 54, 26, '#30263c', '#2a2134');
      const q = '#7a6a8a';
      r(28, 22, 8, 2, q); r(35, 24, 2, 4, q); r(32, 28, 3, 2, q); r(32, 30, 2, 3, q); r(32, 35, 2, 2, q);
    }
    // a soft vignette inside the frame
    for (let i = 0; i < 2; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (0.18 - i * 0.08) + ')'; ctx.fillRect(i, i, W - 2 * i, 1); ctx.fillRect(i, H - 1 - i, W - 2 * i, 1); ctx.fillRect(i, i, 1, H - 2 * i); ctx.fillRect(W - 1 - i, i, 1, H - 2 * i); }
  };
  GK.PORTRAIT = { W, H };
})();
