// Exercises the v1.3 features in the browser: title tips, the Combo Book, bounties, combo glow,
// the Tape Shelf, the Fusion Lab, run stats, and Head to Head ranks with trash talk.
// Usage: node tests/v13.e2e.js [shotsDir]
const { open } = require('./serve');
const path = require('path');
const shots = process.argv[2];
const must = (c, m) => { if (!c) throw new Error(m); };
(async () => {
  const { page, errors, close } = await open({ width: 390, height: 844 });
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const phase = () => page.evaluate(() => GK.debug.phase);
  await page.evaluate(() => { const m = GK.meta(); m.hintsOff = true; m.runs = 6; m.feats = { strike: 1 }; GK.saveMeta(m); localStorage.removeItem('gk-tapes'); });
  await page.reload();

  // 1) a tip on the title screen; tap for another
  await page.waitForSelector('#layer .tip');
  const tip1 = await page.$eval('#layer .tip span', e => e.textContent);
  must(tip1.length > 5, 'no tip');
  await snap('v13-title-tip');
  for (let i = 0; i < 6; i++) await page.click('#layer .tip');
  must((await page.$eval('#layer .tip span', e => e.textContent)).length > 5, 'tip vanished');

  // 2) the Combo Book and an empty Tape Shelf
  await page.click('[data-a=collection]');
  await page.click('#modal [data-a=combos]');
  await page.waitForSelector('#modal .combo-row');
  await snap('v13-combo-book');
  await page.click('#modal [data-a=ok]');
  await page.evaluate(() => GK.debug.title());
  await page.click('[data-a=collection]');
  await page.click('#modal [data-a=tapes]');
  await page.waitForSelector('#modal .tapes');
  await page.click('#modal [data-a=ok]');
  await page.evaluate(() => GK.debug.title());

  // 3) a run: bounties on the intro, a combo in the charm row, a frame for the tape shelf
  await page.click('[data-a=new]');
  await page.click('[data-a=go]');
  await page.waitForSelector('#layer .bounty');
  must((await page.$$('#layer .bounty')).length === 2, 'expected 2 bounties');
  await snap('v13-bounties');
  await page.evaluate(() => { const r = GK.debug.run; r.charms = [GK.charmInst('strike_out'), GK.charmInst('hot_streak')]; });
  await page.click('#layer [data-a=go]');
  for (let i = 0; i < 40 && await phase() !== 'aim'; i++) { if (await phase() === 'call') await page.click('#callbar [data-call=strike]'); await page.waitForTimeout(150); }
  await page.evaluate(() => GK.debug.refresh && GK.debug.refresh());
  must((await page.$$('#charms .charm.combo')).length === 2, 'combo pair does not glow');
  await snap('v13-combo-glow');
  await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => ({ p: GK.debug.phase, f: GK.debug.run && GK.debug.run.rs ? GK.debug.run.rs.frameIdx : 0 }));
    if (st.f >= 1 && st.p === 'aim') break;
    if (st.p === 'aim') await page.evaluate(() => GK.debug.throw({ aimX: 0, aim: 0, speed: 400, spin: 0 }));
    if (st.p === 'replay') await page.evaluate(() => GK.debug.skipReplay());
    await page.waitForTimeout(500);
  }
  const tapes = await page.evaluate(() => JSON.parse(localStorage.getItem('gk-tapes') || '[]').length);
  must(tapes >= 1, 'no tape saved after a scoring frame');

  // 4) the Fusion Lab in the shop
  await page.evaluate(() => { const r = GK.debug.run; r.money = 50; r.bag = [{ type: 'wrecking', ed: null }, { type: 'glass', ed: 'holo' }]; GK.openShop(r); GK.debug.showShop(); });
  await page.waitForSelector('#layer [data-a=fuse]:not([disabled])');
  await page.click('#layer [data-a=fuse]');
  await page.click('#modal [data-o="0"]');
  await page.waitForTimeout(150);
  await page.click('#modal [data-o="1"]');
  await page.waitForTimeout(400);
  const fused = await page.evaluate(() => GK.debug.run.bag.map(b => (b.fused ? 'F:' : '') + b.type + ':' + b.ed).join(','));
  must(fused === 'F:wrecking:holo', 'fusion failed: ' + fused);
  must((await page.$eval('#layerInner', e => e.textContent)).includes('Demolisher'), 'fused name not shown in the shop');
  await snap('v13-fusion-shop');

  // 5) run stats on the end screen
  await page.evaluate(() => GK.debug.showEnd(false));
  await page.waitForSelector('#layer .statgrid');
  must((await page.$$('#layer .statgrid > div')).length === 8, 'stat tiles missing');
  await snap('v13-run-stats');

  // 6) play a tape from the shelf
  await page.evaluate(() => GK.debug.title());
  await page.click('[data-a=collection]');
  await page.click('#modal [data-a=tapes]');
  await page.waitForSelector('#modal [data-tape="0"]');
  await snap('v13-tape-shelf');
  await page.click('#modal [data-tape="0"]');
  await page.waitForTimeout(700);
  must(await phase() === 'replay', 'tape did not play, phase ' + await phase());
  await snap('v13-tape-play');
  await page.evaluate(() => GK.debug.skipReplay());
  await page.waitForSelector('[data-a=new]');

  // 7) Head to Head ranks: Silver is locked until Bronze is beaten; Gold has trash talk
  await page.click('[data-a=h2h]');
  await page.waitForSelector('#layer [data-o=quinn][data-r="1"]');
  must(await page.$eval('#layer [data-o=quinn][data-r="1"]', b => b.disabled), 'Silver should start locked');
  await page.waitForTimeout(300);
  await snap('v13-h2h-ranks');
  await page.evaluate(() => { const m = GK.meta(); m.h2hRank = { quinn: 2 }; GK.saveMeta(m); GK.debug.title(); });
  await page.reload();
  await page.click('[data-a=h2h]');
  await page.waitForSelector('#layer [data-o=quinn][data-r="2"]:not([disabled])');
  await page.click('#layer [data-o=quinn][data-r="2"]');
  await page.waitForSelector('#speech.show', { timeout: 5000 });
  must(await page.evaluate(() => GK.debug.run.h2h.rank === 2 && GK.debug.run.h2h.ai.charms.length === 1), 'Gold rank not applied');
  await snap('v13-trash-talk');

  console.log('OK: tips, combo book, bounties, combos, tapes, fusion, run stats, ranks and trash talk');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
