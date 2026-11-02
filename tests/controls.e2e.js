// Plays throws with real pointer input: four timed taps (start slider, angle slider, power bar,
// hook dial), checking each step's slider shows and that the ball actually moves between taps. Usage: node tests/controls.e2e.js [shotsDir]
const { open } = require('./serve');
const path = require('path');
const shots = process.argv[2];
(async () => {
  const { page, errors, close } = await open();
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  await page.click('[data-a=new]'); await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]'); await page.click('#layer [data-a=go]');
  await page.waitForFunction(() => GK.debug.phase === 'aim');
  const box = await page.$eval('#lane', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cx = box.x + box.w / 2, cy = box.y + box.h * 0.8;
  const drag = async dx => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dx, cy, { steps: 6 }); await page.mouse.up(); };
  const tap = async () => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up(); };
  const label = () => page.$eval('#stepLbl', e => e.textContent);
  const results = [];
  for (let t = 0; t < 3; t++) {
    await page.waitForFunction(() => GK.debug.phase === 'aim', null, { timeout: 30000 });
    if (!/start slider/.test(await label())) throw new Error('expected start step, got ' + await label());
    if (await page.$eval('#sbar', e => e.hidden)) throw new Error('start slider not shown');
    const x1 = await page.evaluate(() => GK.debug.aimX); await page.waitForTimeout(120); const x2 = await page.evaluate(() => GK.debug.aimX);
    if (x1 === x2) throw new Error('start slider is not moving');
    await page.waitForTimeout(150 + t * 170);
    if (t === 0) await snap('c1-start');
    await tap();
    const lockedX = await page.evaluate(() => GK.debug.aimX); await page.waitForTimeout(150);
    if (lockedX !== await page.evaluate(() => GK.debug.aimX)) throw new Error('start did not lock');
    if (!/angle/.test(await label())) throw new Error('expected angle step');
    await page.waitForTimeout(200 + t * 90);
    if (t === 0) await snap('c2-angle');
    await tap();
    const barShown = await page.$eval('#pbar', e => !e.hidden);
    if (!barShown) throw new Error('power bar not shown');
    await page.waitForTimeout(500 + t * 250);
    if (t === 0) await snap('c3-power');
    await tap();
    if (!/Throw/.test(await page.$eval('#setBtn', e => e.textContent))) throw new Error('expected hook step after power');
    if (await page.$eval('#hbar', e => e.hidden)) throw new Error('hook dial not shown');
    await page.waitForTimeout(150 + t * 100);
    if (t === 0) await snap('c3b-hook');
    await tap();
    const st = await page.evaluate(() => ({ phase: GK.debug.phase, ball: GK.debug.sim.balls[0] && { x: +GK.debug.sim.balls[0].x.toFixed(1), vx: Math.round(GK.debug.sim.balls[0].vx), vz: Math.round(GK.debug.sim.balls[0].vz) } }));
    if (st.phase !== 'rolling') throw new Error('throw did not start: ' + JSON.stringify(st));
    results.push(st.ball);
    if (t === 0) { await page.waitForTimeout(900); await snap('c4-rolling'); }
    await page.waitForFunction(() => GK.debug.phase !== 'rolling', null, { timeout: 30000 });
    if (await page.evaluate(() => GK.debug.phase) === 'replay') await page.evaluate(() => GK.debug.skipReplay());
  }
  // keyboard path + back button
  await page.waitForFunction(() => GK.debug.phase === 'aim', null, { timeout: 30000 });
  await page.keyboard.press('Space');
  await page.click('#backBtn');
  if (!/start/.test(await label())) throw new Error('back did not return to start step');
  await page.keyboard.press('Space'); await page.waitForTimeout(150); await page.keyboard.press('Space');
  await page.waitForTimeout(300); await page.keyboard.press('Space');
  await page.waitForTimeout(200); await page.keyboard.press('Space');
  if (await page.evaluate(() => GK.debug.phase) !== 'rolling') throw new Error('keyboard throw failed');
  console.log('throws', JSON.stringify(results));
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('OK: start/angle/power/hook sliders work with pointer and keyboard');
})().catch(e => { console.error(e); process.exit(1); });
