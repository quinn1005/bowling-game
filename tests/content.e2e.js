// Exercises the v0.7 content in the browser: a full 15-pin rack with Bouncy and Mirror pins,
// the new equipment overlays (Tape Measure, Wrist Computer, Bowling Glasses), the Black Market
// pickers (oil pattern, boss, shot), and a throw with each new ball.
// Usage: node tests/content.e2e.js [shotsDir]
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
      const modal = await page.evaluate(() => !document.getElementById('modal').hidden);
      if (modal) await page.click('#modal .btn.alt').catch(() => {});
      await page.waitForTimeout(120);
    }
    throw new Error('timeout waiting for ' + want + ', phase ' + await phase());
  };

  await page.click('[data-a=new]'); await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]');
  // full back row, new pin types, new equipment and charms, then restart the round so they apply
  await page.evaluate(() => {
    const r = GK.debug.run;
    r.rack = ['std', 'bouncy', 'mirror', 'std', 'std', 'std', 'std', 'std', 'std', 'std', 'bouncy', 'std', 'std', 'std', 'mirror'];
    r.equip = { gloves: 'tape_measure', wrist: 'wrist_computer', head: 'glasses' };
    r.charms = ['shadow_bowler', 'fourth_ball', 'slow_motion', 'back_row_boss', 'hook_artist'].map(id => GK.charmInst(id));
    r.money = 40;
    GK.debug.jump(0, 0);
  });
  await page.waitForSelector('#layer [data-a=go]');
  await page.click('#layer [data-a=go]');
  await waitPhase(['aim']);
  await page.evaluate(() => { document.getElementById('coach').hidden = true; });
  must(await page.evaluate(() => GK.debug.sim.pins.length === 15), 'rack is not 15 pins');
  await snap('c1-rack15-boards');

  // step through the sliders by hand: start (Tape Measure), angle, power, hook (Wrist Computer)
  await page.click('#setBtn'); await page.waitForTimeout(250);
  await page.click('#setBtn'); await page.waitForTimeout(500);
  await page.click('#setBtn'); await page.waitForTimeout(300);
  await snap('c2-hook-preview');
  await page.click('#setBtn');
  await waitPhase(['aim', 'shop', 'menu']);

  // Black Market pickers
  for (const [id, pick, check] of [['m_stolen_oil', 'shark', 'r.oilNext === "shark"'], ['m_bootleg', 'spare', '(r.levels.spare || 0) >= 3'], ['m_fake_id', 'janitor', 'r.bossOverride && r.bossOverride.id === "janitor"']]) {
    await waitPhase(['aim']);
    await page.evaluate(id => { const r = GK.debug.run; r.cons = [id]; if (id === 'm_fake_id') r.charms.pop(); GK.debug.select(0); }, id);
    await page.click('#cons .slot:not(.empty)');
    await page.click('#modal [data-i="0"]');
    await page.waitForSelector('#modal [data-o="' + pick + '"]');
    if (id === 'm_fake_id') await snap('c3-boss-picker');
    await page.click('#modal [data-o="' + pick + '"]');
    must(await page.evaluate(c => { const r = GK.debug.run; return eval(c); }, check), id + ' did not apply');
  }

  // a throw with each new ball
  const balls = ['pinball', 'disco', 'boomerang', 'sticky', 'rubber', 'paint', 'pendulum', 'twin', 'lightning', 'snowball', 'wrecking', 'duster', 'bubble', 'jelly', 'chain', 'spiked', 'neonball', 'moon'];
  for (let i = 0; i < balls.length; i++) {
    const p = await waitPhase(['aim', 'shop', 'menu']);
    if (p !== 'aim') {
      // round over: start a fresh round on the same alley
      await page.evaluate(() => { const r = GK.debug.run; r.money = 40; GK.debug.jump(0, 0); });
      await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
      await waitPhase(['aim']);
    }
    await page.evaluate(t => { const r = GK.debug.run; r.bag[0] = { type: t, ed: null }; GK.debug.select(0); }, balls[i]);
    await page.evaluate(() => GK.debug.throw({ aimX: 3, aim: -0.01, speed: 380, spin: 0.3, phase: 1.2 }));
    await page.waitForTimeout(650);
    if (['disco', 'lightning', 'chain', 'twin', 'pendulum', 'sticky'].includes(balls[i])) await snap('c4-' + balls[i]);
  }
  await waitPhase(['aim', 'shop', 'menu']);
  console.log('OK: 15-pin rack, equipment overlays, Black Market pickers and every new ball work');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
