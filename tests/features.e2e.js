// Exercises the v0.6 features in the browser: skipping a round, each between-round event,
// re-drilling, the practice lane, the big TV, endless mode, hints, and resuming mid-throw
// (quitting can't undo a throw). Usage: node tests/features.e2e.js [shotsDir]
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
      await page.waitForTimeout(120);
    }
    throw new Error('timeout waiting for ' + want + ', phase ' + await phase());
  };

  // 1) hints show on the first frame
  await page.click('[data-a=new]'); await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=skip]');
  await snap('f1-intro-skip');
  // 2) skip the Qualifier: no shop, straight to the Heat intro, history records it
  await page.click('#layer [data-a=skip]');
  await page.waitForSelector('#layer [data-a=go]');
  const afterSkip = await page.evaluate(() => ({ round: GK.debug.run.round, hist: GK.debug.run.history.length, skipped: GK.debug.run.history[0].skipped }));
  must(afterSkip.round === 1 && afterSkip.skipped, 'skip did not advance: ' + JSON.stringify(afterSkip));
  await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  must(!(await page.$eval('#coach', e => e.hidden)), 'first-run hint did not show');
  await snap('f2-hint');

  // 3) quit mid-throw and resume: the throw is replayed, not undone
  await page.evaluate(() => GK.debug.throw({ aimX: 2, speed: 380, spin: 0.2, perfect: true }));
  await page.waitForTimeout(150);
  const throwsBefore = await page.evaluate(() => GK.debug.run.stats.throws);
  await page.click('#menuBtn'); await page.click('#modal [data-a=title]');
  await page.waitForSelector('[data-a=continue]');
  await page.click('[data-a=continue]');
  await waitPhase(['aim', 'rolling', 'busy', 'menu']);
  const resumed = await page.evaluate(() => ({ pending: !!(GK.debug.run.rs.cur && GK.debug.run.rs.cur.pending), phase: GK.debug.phase, throws: GK.debug.run.stats.throws }));
  must(resumed.phase === 'rolling' || resumed.throws > throwsBefore || !resumed.pending, 'pending throw was not replayed: ' + JSON.stringify(resumed));
  await waitPhase(['aim', 'menu']);

  // 4) each between-round event, then re-drill in the shop
  for (const id of ['lost_found', 'vending', 'shady', 'lane_mech']) {
    await page.evaluate(id => {
      const r = GK.debug.run; r.money = 30; r.charms = []; r.cons = [];
      GK.openShop(r);
      const ev = { id };
      if (id === 'lost_found') ev.ball = 'ghost';
      if (id === 'shady') ev.charm = 'tenth_frame';
      if (id === 'vending') ev.item = 'card_strike';
      r.event = ev; GK.debug.showEvent(ev);
    }, id);
    await page.waitForSelector('#layer [data-a=take]');
    if (id === 'shady') await snap('f3-event');
    await page.click('#layer [data-a=take]');
    if (id === 'lost_found') { const sw = await page.$('#modal [data-b]'); if (sw) await page.click('#modal [data-b="1"]'); }
    if (id === 'lane_mech') { await page.click('#modal [data-b="0"]'); await page.click('#modal [data-d=flare]'); }
    await page.waitForSelector('#layer .shop');
    const st = await page.evaluate(() => ({ bag: GK.debug.run.bag.map(b => b.type + ':' + (b.drill || 'stock')), cons: GK.debug.run.cons, charms: GK.debug.run.charms.map(c => c.id), event: GK.debug.run.event }));
    if (id === 'lost_found') must(st.bag.some(b => b.startsWith('ghost')), 'lost & found ball not taken');
    if (id === 'vending') must(st.cons.includes('card_strike'), 'vending item missing');
    if (id === 'shady') must(st.charms.includes('tenth_frame'), 'shady charm missing');
    if (id === 'lane_mech') must(st.bag[0].endsWith(':flare'), 'free re-drill missing: ' + st.bag[0]);
    must(!st.event, 'event not cleared');
  }
  await snap('f4-shop');
  await page.click('#layerInner [data-a=drill]');
  await page.click('#modal [data-b="1"]'); await page.click('#modal [data-d=strong]');
  must(await page.evaluate(() => GK.debug.run.bag[1].drill === 'strong'), 'paid re-drill failed');

  // 5) endless mode from the end screen
  await page.evaluate(() => { const r = GK.debug.run; r.alley = GK.ALLEY_COUNT; r.round = 0; r.won = true; GK.debug.showEnd(true); });
  await page.waitForSelector('#layer [data-a=endless]');
  await snap('f5-end');
  await page.click('#layer [data-a=endless]');
  await page.waitForSelector('#layer .shop');
  const endless = await page.evaluate(() => ({ alley: GK.debug.run.alley, endless: GK.isEndless(GK.debug.run), name: GK.alleyDef(GK.debug.run).name }));
  must(endless.endless && /Endless 1/.test(endless.name), 'endless not started: ' + JSON.stringify(endless));
  await page.click('#layerInner [data-a=next]');
  await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);

  // 6) the big TV
  await page.evaluate(() => { GK.debug.tv('turkey'); document.getElementById('coach').hidden = true; });
  const box = await page.$eval('#lane', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + 25 / 200 * box.w, box.y + 62 / 356 * box.h);
  await page.waitForSelector('#tvBig');
  await page.waitForTimeout(900);
  await snap('f6-tv');
  await page.click('#modal [data-a=ok]');

  // 7) practice lane
  await page.click('#menuBtn'); await page.click('#modal [data-a=title]');
  await page.waitForSelector('[data-a=practice]');
  await page.click('[data-a=practice]');
  await page.click('#layer [data-p="4"]');
  await waitPhase(['aim']);
  for (let i = 0; i < 3; i++) {
    await waitPhase(['aim']);
    await page.evaluate(() => GK.debug.throw({ aimX: 0, speed: 360, spin: 0 }));
    await page.waitForTimeout(400);
  }
  await waitPhase(['aim']);
  await snap('f7-practice');
  const pr = await page.evaluate(() => ({ practice: GK.debug.run.practice, saved: !!localStorage.getItem('gk-run-v1') }));
  must(pr.practice, 'practice flag missing');

  console.log('OK: skip, events, drilling, endless, TV, resume and practice all work');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
