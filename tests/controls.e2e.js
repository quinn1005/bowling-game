// Plays throws with real pointer input: drag to set the start, tap; drag the angle, tap;
// tap to stop the power bar. Usage: node tests/controls.e2e.js [shotsDir]
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
    if (!/Drag to set your start/.test(await label())) throw new Error('expected start step, got ' + await label());
    await drag(t === 0 ? 30 : -10);
    if (t === 0) await snap('c1-start');
    await tap();
    if (!/angle/.test(await label())) throw new Error('expected angle step');
    await drag(-25);
    if (t === 0) await snap('c2-angle');
    await tap();
    const barShown = await page.$eval('#pbar', e => !e.hidden);
    if (!barShown) throw new Error('power bar not shown');
    await page.waitForTimeout(500 + t * 250);
    if (t === 0) await snap('c3-power');
    await tap();
    const st = await page.evaluate(() => ({ phase: GK.debug.phase, ball: GK.debug.sim.balls[0] && { x: +GK.debug.sim.balls[0].x.toFixed(1), vx: Math.round(GK.debug.sim.balls[0].vx), vz: Math.round(GK.debug.sim.balls[0].vz) } }));
    if (st.phase !== 'rolling') throw new Error('throw did not start: ' + JSON.stringify(st));
    results.push(st.ball);
    if (t === 0) { await page.waitForTimeout(900); await snap('c4-rolling'); }
    await page.waitForFunction(() => GK.debug.phase !== 'rolling', null, { timeout: 30000 });
  }
  // keyboard path + back button
  await page.waitForFunction(() => GK.debug.phase === 'aim', null, { timeout: 30000 });
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
  await page.click('#backBtn');
  if (!/start/.test(await label())) throw new Error('back did not return to start step');
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Space');
  await page.waitForTimeout(300); await page.keyboard.press('Space');
  if (await page.evaluate(() => GK.debug.phase) !== 'rolling') throw new Error('keyboard throw failed');
  console.log('throws', JSON.stringify(results));
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('OK: start/angle/power controls work with pointer and keyboard');
})().catch(e => { console.error(e); process.exit(1); });
