// Gutter Kings — the Wall of Fame: framed pixel portraits of the Regulars (Kaleb, Quinn, Levi),
// shown after you beat the Gutter King, with an empty frame below for the new champion.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const W = 32, H = 40;
  // Draws one 32×40 portrait. who: 'quinn' | 'levi' | 'kaleb' | 'you'.
  GK.drawPortrait = function (ctx, who) {
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const disc = (cx, cy, rad, c) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + rad * 0.6) r(cx + x, cy + y, 1, 1, c); };
    ctx.clearRect(0, 0, W, H);
    if (who === 'quinn') {
      const hair = '#3a2618', hairL = '#5a3c26', skin = '#f2d2bc', skinD = '#dcb49c', beard = '#8a4a2a', sw = '#7a1f35', swD = '#5e1628';
      r(0, 0, W, H, '#3a2434');
      r(7, 7, 18, 29, hair); r(5, 14, 4, 22, hair); r(23, 14, 4, 22, hair); // long hair behind
      r(2, 31, 28, 9, sw); r(21, 31, 9, 9, swD); r(2, 31, 2, 9, swD);
      for (let i = 0; i < 4; i++) r(12 + i, 31 + i, 8 - 2 * i, 1, skin); // V-neck
      r(11, 31, 1, 1, swD); r(20, 31, 1, 1, swD); r(12, 32, 1, 1, swD); r(19, 32, 1, 1, swD);
      r(5, 30, 4, 7, hair); r(23, 30, 4, 7, hair); r(6, 36, 2, 2, hairL); // hair over the shoulders
      r(13, 24, 6, 7, skin); r(13, 24, 6, 2, skinD); // neck
      r(10, 9, 12, 15, skin); r(11, 24, 10, 1, skin); r(19, 11, 3, 12, skinD);
      r(9, 6, 14, 4, hair); r(9, 9, 2, 14, hair); r(21, 9, 2, 14, hair); r(13, 7, 3, 1, hairL); r(16, 6, 1, 4, '#2a1a10'); // centre part
      r(12, 14, 3, 1, '#4a2e1e'); r(17, 14, 3, 1, '#4a2e1e'); // brows
      r(12, 16, 3, 1, '#ffffff'); r(17, 16, 3, 1, '#ffffff'); r(13, 16, 1, 1, '#3a2418'); r(18, 16, 1, 1, '#3a2418');
      r(15, 17, 2, 3, skinD); // nose
      r(12, 20, 8, 1, beard); r(13, 21, 6, 1, '#c88a80'); r(14, 22, 4, 3, beard); r(15, 25, 2, 1, beard); // moustache, goatee
      r(13, 28, 1, 1, '#e8c860'); r(14, 29, 1, 1, '#e8c860'); r(15, 30, 1, 1, '#e8c860'); r(16, 31, 1, 1, '#e8c860'); r(16, 32, 1, 1, '#222'); // chain
      // round shades hooked on the sweater
      // round shades hooked on the sweater: two dark lenses, thin silver rims, a glint each
      r(20, 31, 1, 1, '#c8ccd4');
      disc(21, 34, 2, '#111014'); r(19, 34, 1, 1, '#9aa0ac'); r(23, 34, 1, 1, '#9aa0ac'); r(20, 33, 1, 1, '#5a6070');
      r(21, 36, 1, 1, '#c8ccd4');
      disc(21, 38, 2, '#111014'); r(19, 38, 1, 1, '#9aa0ac'); r(23, 38, 1, 1, '#9aa0ac'); r(20, 37, 1, 1, '#5a6070');
    } else if (who === 'kaleb') {
      const hair = '#6a4528', hairL = '#8a6038', skin = '#f0cdb0', skinD = '#d8b094', sh = '#8fb48f', shD = '#7a9e7a';
      r(0, 0, W, H, '#24382a');
      r(2, 31, 28, 9, sh); for (let x = 4; x < 30; x += 3) r(x, 32, 1, 8, shD); r(22, 31, 8, 9, shD);
      r(10, 29, 5, 3, '#a8c8a8'); r(17, 29, 5, 3, '#a8c8a8'); r(14, 31, 4, 3, skin); // collar and open placket
      for (let i = 0; i < 6; i++) r(4 + i, 29 + i * 2, 2, 2, '#8a5a2a'); // bag strap
      r(13, 24, 6, 7, skin); r(13, 24, 6, 2, skinD);
      for (let i = 0; i < 7; i++) r(12 + i, 29 + (i % 2), 1, 1, i % 2 ? '#3a3a4a' : '#8a6a5a'); // beaded necklace
      r(10, 10, 12, 14, skin); r(11, 24, 10, 1, skin); r(19, 12, 3, 10, skinD);
      // big curly hair
      for (const [x, y, rad, c] of [[10, 9, 3, hair], [14, 6, 3, hair], [19, 6, 3, hair], [23, 9, 3, hair], [8, 13, 2, hair], [24, 13, 2, hair], [8, 17, 2, hair], [24, 17, 2, hair], [9, 21, 2, hair], [23, 20, 2, hair], [12, 8, 2, hair], [17, 8, 2, hair], [21, 8, 2, hair]]) disc(x, y, rad, c);
      for (const [x, y] of [[13, 5], [18, 5], [9, 9], [23, 8], [7, 14], [25, 16], [11, 7], [20, 9]]) r(x, y, 1, 1, hairL);
      r(12, 11, 2, 1, hair); r(17, 11, 3, 1, hair); // curls on the forehead
      r(12, 15, 3, 1, '#4a2e1e'); r(17, 15, 3, 1, '#4a2e1e');
      r(12, 17, 3, 1, '#2a1a10'); r(17, 17, 3, 1, '#2a1a10'); // smiling eyes
      r(15, 18, 2, 2, skinD);
      r(11, 20, 10, 3, '#5a1a1a'); r(11, 20, 10, 1, '#ffffff'); r(12, 22, 8, 1, '#ffffff'); r(10, 19, 1, 1, skinD); r(21, 19, 1, 1, skinD); // the grin
      r(9, 18, 1, 1, '#d0d8f0'); // earring
    } else if (who === 'levi') {
      const hair = '#2a1c14', hairL = '#3e2c20', skin = '#f0d0b8', skinD = '#d8b49c', sh = '#3a8ad0', shD = '#2e70ac', tee = '#4aa0e0';
      r(0, 0, W, H, '#1e2a44');
      r(1, 30, 30, 10, sh); r(23, 30, 8, 10, shD); r(12, 29, 8, 11, tee); r(11, 29, 1, 11, shD); r(20, 29, 1, 11, shD);
      for (const [x, y] of [[3, 32], [7, 36], [4, 38], [23, 33], [27, 37], [25, 31], [8, 31]]) { r(x, y, 2, 2, '#ffd23a'); r(x + 2, y + 1, 1, 1, '#ff8a1a'); r(x, y, 1, 1, '#fff3a8'); } // rubber ducks
      r(12, 24, 8, 6, skin); r(12, 24, 8, 2, skinD);
      r(9, 10, 14, 15, skin); r(10, 25, 12, 1, skin); r(20, 12, 3, 12, skinD);
      for (let y = 21; y < 26; y++) for (let x = 10; x < 22; x++) if ((x + y) % 2 === 0) r(x, y, 1, 1, skinD); // stubble
      r(9, 7, 14, 4, hair); r(9, 10, 2, 4, hair); r(21, 10, 2, 4, hair); r(12, 8, 6, 1, hairL);
      disc(16, 4, 3, hair); r(15, 3, 2, 1, hairL); // top bun
      r(8, 11, 1, 6, hair); r(23, 11, 1, 5, hair); // loose strands
      r(12, 15, 3, 1, hair); r(17, 15, 3, 1, hair);
      r(12, 17, 3, 1, '#ffffff'); r(17, 17, 3, 1, '#ffffff'); r(13, 17, 1, 1, '#3a2418'); r(18, 17, 1, 1, '#3a2418');
      r(15, 18, 2, 3, skinD);
      r(14, 22, 4, 1, '#b0786e'); r(18, 21, 1, 1, '#b0786e'); // half smile
    } else {
      // the empty frame waiting for the player
      r(0, 0, W, H, '#1a1420');
      ctx.fillStyle = '#2e2438';
      disc(16, 15, 6, '#2e2438'); r(6, 26, 20, 14, '#2e2438'); disc(16, 27, 9, '#2e2438');
      r(15, 11, 3, 1, '#6a5a78'); r(17, 12, 1, 2, '#6a5a78'); r(16, 14, 1, 2, '#6a5a78'); r(16, 17, 1, 1, '#6a5a78'); // ?
    }
  };
  GK.PORTRAIT = { W, H };
})();
