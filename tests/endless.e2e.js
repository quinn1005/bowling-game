// Visits every endless alley with both of its bosses, lets Old Father Time's shot clock run out,
// opens the v1.1 events, and checks for page errors. Usage: node tests/endless.e2e.js [shotsDir]
const { open } = require('./serve');
const path = require('path');
const shots = process.argv[2];
const must = (c, m) => { if (!c) throw new Error(m); };
(async () => {
  const { page, errors, close } = await open({ width: 390, height: 844 });
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const phase = () => page.evaluate(() => GK.debug.phase);
  const waitPhase = async (want, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const p = await phase();
      if (want.includes(p)) return p;
      if (p === 'replay') await page.evaluate(() => GK.debug.skipReplay());
      if (await page.evaluate(() => !document.getElementById('modal').hidden)) await page.click('#modal .btn.alt').catch(() => {});
      await page.waitForTimeout(120);
    }
    throw new Error('timeout waiting for ' + want + ', phase ' + await phase());
  };
  await page.evaluate(() => { const m = GK.meta(); m.hintsOff = true; GK.saveMeta(m); });
  await page.reload();
  await page.click('[data-a=new]'); await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]');

  const n = await page.evaluate(() => GK.ENDLESS_ALLEYS.length);
  for (let i = 0; i < n; i++) {
    const bosses = await page.evaluate(i => GK.ENDLESS_ALLEYS[i].bosses, i);
    for (const boss of bosses) {
      await page.evaluate(({ i, boss }) => {
        const r = GK.debug.run, a = GK.ALLEY_COUNT + 1 + i;
        r.charms = ['lucky_shoes', 'league_jacket', 'chalk_bag', 'tip_jar'].map(id => GK.charmInst(id));
        r.trophies = [{ id: 'deed' }];
        r.bag = [{ type: 'house' }, { type: 'anchor' }, { type: 'gyro' }];
        r.lastBest = 500;
        r.bossOverride = { alley: a, id: boss };
        GK.debug.jump(a, 2);
      }, { i, boss });
      await page.waitForSelector('#layer [data-a=go]');
      await page.click('#layer [data-a=go]');
      await waitPhase(['aim', 'call']);
      if (boss === 'fathertime') {
        // don't touch anything: the shot clock throws for you
        await page.waitForTimeout(6800);
        must(await phase() !== 'aim' || await page.evaluate(() => GK.debug.run.stats.throws > 0), 'the shot clock did not throw');
        await snap('e-' + boss);
      }
      for (let k = 0; k < 3; k++) {
        const p = await waitPhase(['aim', 'menu', 'shop'], 40000);
        if (p !== 'aim') break;
        await page.evaluate(k => { const r = GK.debug.run; r.rs.target = 1e12; GK.debug.select(k % r.bag.length); GK.debug.throw({ aimX: k === 1 ? 15 : 2, aim: k === 1 ? 0.03 : 0, speed: 380, spin: 0.2 }); }, k);
        await page.waitForTimeout(600);
        if (k === 0 && boss !== 'fathertime') await snap('e-' + boss);
      }
      console.log('endless', i + 1, boss, 'ok');
    }
  }

  // the v1.1 events
  for (const id of ['sale', 'fountain', 'lost_bowler', 'regulars_bet', 'card_game']) {
    await page.evaluate(id => {
      const r = GK.debug.run; r.money = 30; r.charms = [GK.charmInst('lucky_shoes')];
      GK.openShop(r);
      const ev = GK.eventExtras(r, { id }, GK.makeRng(3)); r.event = ev; GK.debug.showEvent(ev);
    }, id);
    await page.waitForSelector('#layer [data-a=take]');
    if (id === 'regulars_bet') await snap('e-event-bet');
    await page.click('#layer [data-a=take]');
    if (id === 'lost_bowler') await page.click('#modal [data-b="0"]');
    if (id === 'card_game') await page.click('#modal [data-o="0"]');
    await page.waitForSelector('#layer .shop');
  }
  // a corrupted charm in an endless shop
  await page.evaluate(() => { const r = GK.debug.run; r.alley = GK.ALLEY_COUNT + 2; GK.CORRUPT_CHANCE = 1; GK.openShop(r); GK.debug.showShop(); });
  await page.waitForSelector('#layer .item.corrupt');
  await snap('e-corrupt-shop');

  console.log('OK: every endless alley and boss, the shot clock, the v1.1 events and corrupted charms');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
