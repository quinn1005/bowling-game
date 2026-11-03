// Exercises the v1.0 features in the browser: bonus balls, overkill, boss trophies, charm
// evolution, the jackpot pin, a visiting regular, a party lane, the locker and collection,
// and the end screen with XP, highlights and the challenge link.
// Usage: node tests/v1.e2e.js [shotsDir]
const { open } = require('./serve');
const path = require('path');
const shots = process.argv[2];
const must = (c, m) => { if (!c) throw new Error(m); };
(async () => {
  const { page, errors, close } = await open({ width: 390, height: 844 });
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const phase = () => page.evaluate(() => GK.debug.phase);
  const waitFor = async (fn, ms = 30000, what = 'condition') => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(fn)) return;
      if (await phase() === 'replay') await page.evaluate(() => GK.debug.skipReplay());
      await page.waitForTimeout(120);
    }
    throw new Error('timeout waiting for ' + what + ' (phase ' + await phase() + ')');
  };
  const waitPhase = (want, ms) => waitFor(new Function('return ' + JSON.stringify(want) + '.includes(GK.debug.phase)'), ms, want.join('/'));

  // a bowler with plenty of XP so the locker has things to wear
  await page.evaluate(() => { localStorage.setItem('gk-hints-v1', '{}'); const m = GK.meta(); m.xp = 30000; m.hintsOff = true; GK.saveMeta(m); });
  await page.reload();
  await page.waitForSelector('[data-a=locker]');
  await page.click('[data-a=locker]');
  await page.waitForSelector('#modal .locker');
  for (const [k, id] of [['trail', 'fire'], ['pins', 'duck'], ['lane', 'cherry'], ['hats', 'party']]) await page.click(`#modal [data-k="${k}"][data-id="${id}"]`);
  await snap('v1-locker');
  await page.click('#modal [data-a=ok]');
  await page.click('[data-a=book]');
  await page.waitForSelector('#modal .book');
  await page.click('#modal [data-a=ok]');

  await page.click('[data-a=new]'); await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  await page.evaluate(() => { document.getElementById('coach').hidden = true; });

  // party lane: balloons on the pins
  await page.evaluate(() => { GK.debug.run.rs.cur.laneEvent = 'party'; });
  await page.waitForTimeout(300);
  await snap('v1-party');
  await page.evaluate(() => { GK.debug.run.rs.cur.laneEvent = null; });

  // win the round on the first frame: overkill, then 3 bonus balls at a gold rack
  await page.evaluate(() => { GK.debug.run.rs.target = 10; GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }); });
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ p: GK.debug.phase, inFrame: !!GK.debug.run.rs.cur }));
    if (st.p === 'aim' && st.inFrame) await page.evaluate(() => GK.debug.throw({ aimX: 0, aim: 0, speed: 400, spin: 0 }));
    if (st.p === 'aim' && !st.inFrame) break;
  }
  await waitFor(() => GK.debug.phase === 'aim' && !GK.debug.run.rs.cur, 30000, 'bonus ball');
  await page.waitForTimeout(500);
  await snap('v1-bonus');
  for (let i = 0; i < 3; i++) {
    await waitPhase(['aim']);
    await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('#layer .lines', { timeout: 30000 });
  const pay = await page.$eval("#layer .panel", e => e.innerText);
  must(/Bonus balls/.test(pay) && /verkill/i.test(pay), 'payout is missing bonus balls or overkill: ' + pay);
  await snap('v1-payout');
  await page.click('#layer [data-a=go]');
  if (await page.$('#layer [data-a=leave]')) await page.click('#layer [data-a=leave]');
  await page.waitForSelector('#layer .shop');

  // a regular drops by
  await page.evaluate(() => { const r = GK.debug.run; const ev = Object.assign({ id: 'regular' }, GK.regularVisit(r, GK.makeRng(4))); r.event = ev; GK.debug.showEvent(ev); });
  await page.waitForSelector('#layer .visit canvas');
  await page.waitForTimeout(400);
  await snap('v1-regular');
  await page.click('#layer [data-a=take]');
  await page.waitForSelector('#layer .shop');

  // jump to the Boss Match, win it: trophy pick (and evolve a charm on the way)
  await page.evaluate(() => {
    const r = GK.debug.run; r.charms = [GK.charmInst('league_jacket')]; r.charms[0].evo = 11;
    GK.debug.jump(0, 2);
  });
  await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
  await waitPhase(['aim', 'call']);
  if (await phase() === 'call') { await page.click('#callbar [data-call=strike]'); await waitPhase(['aim']); }
  await page.evaluate(() => { GK.debug.run.rs.target = 50; GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }); });
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ p: GK.debug.phase, inFrame: !!(GK.debug.run.rs && GK.debug.run.rs.cur), evo: !!(GK.debug.run.charms[0] && GK.debug.run.charms[0].evolved) }));
    if (st.evo) break;
    if (st.p === 'aim' && st.inFrame) await page.evaluate(() => GK.debug.throw({ aimX: 0, aim: 0, speed: 400, spin: 0 }));
  }
  await waitFor(() => GK.debug.run.charms[0] && GK.debug.run.charms[0].evolved, 30000, 'evolution');
  await page.waitForTimeout(400);
  await snap('v1-evolved');
  for (let i = 0; i < 40; i++) {
    const p = await phase();
    if (p === 'aim') await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: 0, speed: 400, spin: 0.15 }));
    if (await page.$('#layer [data-a=go]')) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForSelector('#layer [data-a=go]', { timeout: 30000 });
  await page.click('#layer [data-a=go]');
  await page.waitForSelector('#layer [data-t]');
  await snap('v1-trophy');
  await page.click('#layer [data-t]');
  must(await page.evaluate(() => GK.debug.run.trophies.length === 1), 'trophy not taken');
  must(!(await page.$eval('#trophyBtn', e => e.hidden)), 'trophy shelf button hidden');

  // the jackpot pin: force one into the next rack and knock it down
  if (await page.$('#layer [data-a=leave]')) await page.click('#layer [data-a=leave]');
  await page.waitForSelector('#layer .shop');
  await page.evaluate(() => { GK.JACKPOT_CHANCE = 1; GK.debug.jump(1, 0); });
  await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  must(await page.evaluate(() => GK.debug.sim.pins.some(p => p.type === 'jackpot')), 'no jackpot pin in the rack');
  await snap('v1-jackpot-pin');
  await page.evaluate(() => { GK.debug.run.rs.target = 1e9; GK.debug.throw({ aimX: 3, aim: 0, speed: 420, spin: 0.15 }); });
  await waitPhase(['aim'], 40000);
  await page.evaluate(() => GK.debug.throw({ aimX: 0, aim: 0, speed: 420, spin: 0 }));
  await waitPhase(['aim'], 40000);

  // the end screen: XP, level, highlights and the challenge link
  await page.evaluate(() => { const r = GK.debug.run; r.won = true; GK.debug.showEnd(true); });
  await page.waitForSelector('#layer [data-a=challenge]');
  await snap('v1-end');
  must(await page.$('#layer .lvl-row'), 'no level bar on the end screen');

  console.log('OK: bonus balls, overkill, trophies, evolution, jackpot, regulars, party, locker, collection and end screen');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
