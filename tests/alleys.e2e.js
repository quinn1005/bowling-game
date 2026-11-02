// Visits every alley's boss match (and the Championship), throws every ball type and uses
// consumables, failing on any page error. Usage: node tests/alleys.e2e.js [shotsDir]
const { open } = require('./serve');
const path = require('path');
const shots = process.argv[2];
(async () => {
  const { page, errors, close } = await open();
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  await page.waitForSelector('[data-a=new]');
  await page.click('[data-a=new]');
  await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]');
  await page.click('#layer [data-a=go]');
  const balls = Object.keys(await page.evaluate(() => GK.BALLS));
  let bi = 0;
  const waitPhase = async (want, ms = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const p = await page.evaluate(() => GK.debug.phase);
      if (want.includes(p)) return p;
      if (p === 'replay') await page.evaluate(() => GK.debug.skipReplay());
      const modal = await page.evaluate(() => !document.getElementById('modal').hidden);
      if (modal) await page.click('#modal .btn.alt').catch(() => {});
      await page.waitForTimeout(150);
    }
    throw new Error('timeout waiting for ' + want + ' (phase ' + await page.evaluate(() => GK.debug.phase) + ')');
  };
  for (let alley = 0; alley <= 8; alley++) {
    await page.evaluate(a => {
      const r = GK.debug.run; r.money = 50;
      // give a spread of charms so their hooks run in each alley
      const ids = GK.CHARM_LIST.map(c => c.id);
      r.charms = [0, 1, 2, 3, 4].map(i => GK.charmInst(ids[(a * 5 + i) % ids.length], ['foil', 'holo', 'neon', null][i % 4]));
      r.cons = ['t_frame', 'card_strike'];
      const types = ['std', 'gold', 'glass', 'lead', 'rubber', 'explosive', 'lucky', 'phantom', 'std', 'std'];
      r.rack = types.map((t, i) => types[(i + a) % 10]);
      GK.debug.jump(a, a === 8 ? 0 : 2);
    }, alley);
    await page.waitForSelector('#layer [data-a=go]');
    await snap('alley' + (alley + 1) + '-intro');
    await page.click('#layer [data-a=go]');
    for (let f = 0; f < 3; f++) {
      const p = await waitPhase(['aim', 'call', 'menu', 'shop']);
      if (p === 'menu' || p === 'shop') break;
      if (p === 'call') { await page.click('#callbar [data-call=strike]'); await waitPhase(['aim']); }
      if (f === 0) { // use a consumable during the round
        await page.click('#cons .slot:not(.empty)');
        await page.click('#modal [data-i="0"]');
      }
      await page.evaluate(i => { const r = GK.debug.run; r.bag[0] = { type: i, ed: ['foil', 'holo', 'neon', null][Math.floor(Math.random() * 4)] }; GK.debug.select(0); }, balls[bi++ % balls.length]);
      await page.evaluate(() => GK.debug.throw({ aimX: (Math.random() - 0.5) * 6, speed: 360, spin: 0.2, path: [{ z: 0, x: 0 }, { z: 150, x: 6 }, { z: 300, x: -2 }] }));
      await page.waitForTimeout(700);
      if (f === 0) await snap('alley' + (alley + 1) + '-roll');
      let q = await waitPhase(['aim', 'menu', 'shop', 'call'], 30000);
      if (q === 'aim' && await page.evaluate(() => GK.debug.run.rs && GK.debug.run.rs.cur && GK.debug.run.rs.cur.rollIdx > 0)) {
        if (f === 1) { const lt = await page.evaluate(() => document.getElementById('layer').hidden ? null : document.getElementById('layerInner').innerText); if (lt) throw new Error('layer open during aim: ' + lt); await page.click('#rerackBtn'); } // exercise re-rack once per alley
        await page.evaluate(i => { const r = GK.debug.run; r.bag[0] = { type: i, ed: null }; GK.debug.select(0); }, balls[bi++ % balls.length]);
        await page.evaluate(() => GK.debug.throw({ aimX: 0, speed: 400 }));
        await waitPhase(['aim', 'menu', 'shop', 'call'], 30000);
      }
    }
    console.log('alley', alley + 1, 'ok', errors.length ? 'ERRORS' : '');
  }
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('OK: all alleys, balls and bosses ran without page errors');
})().catch(e => { console.error(e); process.exit(1); });
