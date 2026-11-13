// Exercises the v1.2 features in the browser: the Daily Boss Rush, Head to Head, the card gallery,
// cursed charms, the ghost race from a challenge link, and camera follow while rolling.
// Usage: node tests/v12.e2e.js [shotsDir]
const { open } = require('./serve');
const path = require('path');
const shots = process.argv[2];
const must = (c, m) => { if (!c) throw new Error(m); };
(async () => {
  const { page, errors, close } = await open({ width: 390, height: 844 });
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const phase = () => page.evaluate(() => GK.debug.phase);
  const waitPhase = async (want, ms = 40000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const p = await phase();
      if (want.includes(p)) return p;
      if (p === 'replay') await page.evaluate(() => GK.debug.skipReplay());
      await page.waitForTimeout(120);
    }
    throw new Error('timeout waiting for ' + want + ', phase ' + await phase());
  };
  await page.evaluate(() => { const m = GK.meta(); m.hintsOff = true; m.feats = { strike: 1, turkey: 1, quinn: 1 }; GK.saveMeta(m); });
  await page.reload();

  // 1) the card gallery
  await page.click('[data-a=collection]');
  await page.click('#modal [data-a=cards]');
  await page.waitForSelector('#modal .cardgrid canvas');
  await page.waitForTimeout(300);
  await snap('v12-cards');
  await page.click('#modal [data-a=ok]');

  // 2) the Daily Boss Rush: same build each time, straight into a boss
  await page.click('[data-a=rush]');
  await page.waitForSelector('#layer [data-a=go]');
  const rush1 = await page.evaluate(() => ({ boss: GK.debug.run.rs.boss, round: GK.debug.run.round, charms: GK.debug.run.charms.map(c => c.id).join(','), all: GK._allUnlocked }));
  must(rush1.boss && rush1.round === 2 && rush1.all, 'rush did not start on a boss: ' + JSON.stringify(rush1));
  await snap('v12-rush-intro');
  await page.click('#layer [data-a=go]');
  await waitPhase(['aim', 'call']);
  if (await phase() === 'call') { await page.click('#callbar [data-call=strike]'); await waitPhase(['aim']); }
  await page.evaluate(() => { GK.debug.run.rs.target = 10; GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }); });
  for (let i = 0; i < 60; i++) {
    if (await page.$('#layer [data-a=go]')) break;
    if (await page.$('#layer [data-t]')) break;
    const p = await phase();
    if (p === 'aim') await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
    if (p === 'replay') await page.evaluate(() => GK.debug.skipReplay());
    await page.waitForTimeout(700);
  }
  if (await page.$('#layer [data-a=go]')) await page.click('#layer [data-a=go]');
  if (await page.$('#layer [data-t]')) await page.click('#layer [data-t]');
  if (await page.$('#layer [data-a=leave]')) await page.click('#layer [data-a=leave]');
  await page.waitForSelector('#layer .shop');
  must(await page.evaluate(() => GK.debug.run.alley === 1 && GK.debug.run.round === 2), 'rush did not move to the next boss');
  // a cursed charm in the shop: it can't be sold once bought
  await page.evaluate(() => { const r = GK.debug.run; r.money = 99; r.charms = []; GK.CURSE_CHANCE = 1; for (let i = 0; i < 60; i++) { GK.openShop(r); if (r.shop.items.some(it => it.curse)) break; } GK.debug.showShop(); });
  await page.waitForSelector('#layer .item.cursed');
  await snap('v12-cursed-shop');
  await page.click('#layer .item.cursed [data-buy]');
  must(await page.evaluate(() => GK.debug.run.charms.some(c => c.curse && GK.HEX[c.id] && GK.charmName(c) === GK.HEX[c.id].name)), 'cursed charm not bought in its hexed form');
  await page.click('#layerInner [data-charm="0"]');
  must(await page.$eval('#modal .btn.danger', b => b.disabled), 'cursed charm sell button not disabled');
  await page.click('#modal button:has-text("Close")');

  // 3) Head to Head against Kaleb
  await page.click('#menuBtn').catch(() => {});
  await page.evaluate(() => GK.debug.title());
  await page.waitForSelector('[data-a=h2h]');
  await page.click('[data-a=h2h]');
  await page.waitForSelector('#layer [data-o=kaleb]');
  await page.waitForTimeout(300);
  await snap('v12-h2h-pick');
  await page.click('#layer [data-o=kaleb]');
  // the draft: take turns with Kaleb until each has 3 picks
  const draft = async (shot) => {
    await page.waitForSelector('#layer .draft');
    let snapped = false;
    for (let i = 0; i < 80; i++) {
      if (!(await page.$('#layer .draft'))) break;
      if (await page.$('#modal [data-o]')) { await page.click('#modal [data-o]'); continue; }
      const b = await page.$('#layer .draft [data-pick]:not([disabled])');
      if (b) { if (shot && !snapped) { await snap(shot); snapped = true; } await b.click(); }
      await page.waitForTimeout(250);
    }
    await page.waitForSelector('#layer [data-a=go]');
  };
  await draft('v12-h2h-draft');
  const d1 = await page.evaluate(() => ({ round: GK.debug.run.h2h.round, mine: GK.debug.run.charms.length + GK.debug.run.cons.length + GK.debug.run.bag.length, ai: GK.debug.run.h2h.ai.charms.length + GK.debug.run.h2h.ai.cons.length + GK.debug.run.h2h.ai.bag.length }));
  must(d1.round === 1 && d1.ai >= 2, 'draft did not give the AI its picks: ' + JSON.stringify(d1));
  await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
  await page.waitForTimeout(500);
  await snap('v12-camera');
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ p: GK.debug.phase, f: GK.debug.run.h2h.frames.length, inFrame: !!GK.debug.run.rs.cur }));
    if (st.f >= 1 && st.p === 'aim') break;
    if (st.p === 'replay' && st.f === 0) { await page.waitForTimeout(900); await snap('v12-h2h-opp'); await page.evaluate(() => GK.debug.skipReplay()); }
    if (st.p === 'aim' && st.inFrame) await page.evaluate(() => GK.debug.throw({ aimX: 0, aim: 0, speed: 400, spin: 0 }));
    await page.waitForTimeout(700);
  }
  must(await page.evaluate(() => GK.debug.run.h2h.frames.length >= 1 && GK.debug.run.h2h.ai.frameIdx >= 1), 'the opponent did not bowl');
  await snap('v12-h2h-score');
  const bowlUntil = async sel => {
    for (let i = 0; i < 80; i++) {
      if (await page.$(sel)) return;
      const p = await phase();
      if (p === 'aim') await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
      if (p === 'replay') await page.evaluate(() => GK.debug.skipReplay());
      await page.waitForTimeout(600);
    }
    await page.waitForSelector(sel, { timeout: 5000 });
  };
  // jump to the end of round 1: both bowl their last frame, then the round 2 draft
  await page.evaluate(() => { const r = GK.debug.run; r.rs.frameIdx = r.rs.framesMax - 1; r.h2h.ai.frameIdx = Math.max(r.h2h.ai.frameIdx, r.h2h.ai.framesMax - 1); });
  await bowlUntil('#layer .draft');
  must(await page.evaluate(() => GK.debug.run.h2h.round === 2 && GK.debug.run.h2h.myRounds.length === 1), 'round 2 draft did not start');
  // make this the last round and finish the match
  await page.evaluate(() => { GK.debug.run.h2h.round = 3; });
  await draft();
  await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  await page.evaluate(() => { const r = GK.debug.run; r.rs.frameIdx = r.rs.framesMax - 1; r.h2h.ai.frameIdx = r.h2h.ai.framesMax - 1; });
  await bowlUntil('#layer .vs');
  must(await page.evaluate(() => GK.debug.run.h2h.myRounds.length === 2), 'match did not end after the last round');
  await snap('v12-h2h-end');

  // 4) the ghost race: open a challenge link and race the friend's frames
  const base = page.url().split('?')[0];
  await page.goto(base + '?nosw&seed=00ABCDE&g=1e-2s-3c.10');
  await page.waitForSelector('[data-a=new]');
  await page.click('[data-a=new]');
  must(await page.$eval('#seedIn', e => e.value) === '00ABCDE', 'seed not prefilled');
  await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  must(await page.evaluate(() => !!GK.debug.run.ghost), 'ghost not loaded');
  await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => GK.debug.run.rs.frameIdx >= 1)) break; const p = await phase(); if (p === 'aim') await page.evaluate(() => GK.debug.throw({ aimX: 0, aim: 0, speed: 400, spin: 0 })); if (p === 'replay') await page.evaluate(() => GK.debug.skipReplay()); await page.waitForTimeout(600); }
  await waitPhase(['aim']);
  must(!(await page.$eval('#ghostLbl', e => e.hidden)), 'ghost pill hidden');
  await snap('v12-ghost');

  console.log('OK: boss rush, curses, head to head, cards, ghost race and camera follow');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
