// Browser play-test: serves game/, plays through rounds with the debug hook, visits the shop,
// and fails on any page error. Usage: node tests/e2e.js [shotsDir]
const { open } = require("./serve");
const path = require('path');
const shots = process.argv[2];
(async () => {
  const { page, errors, close } = await open();
  const snap = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  await page.waitForSelector('[data-a=new]');
  await snap('01-title');
  await page.click('[data-a=new]');
  await page.click('[data-b=demo]');
  await snap('02-bag');
  await page.fill('#seedIn', 'TEST1');
  await page.click('[data-a=go]');
  await page.waitForSelector('#layer [data-a=go]');
  await snap('03-intro');
  await page.click('#layer [data-a=go]');
  let shopVisits = 0, frames = 0;
  for (let guard = 0; guard < 400; guard++) {
    const st = await page.evaluate(() => ({ phase: GK.debug.phase, layer: !document.getElementById('layer').hidden, modal: !document.getElementById('modal').hidden, over: GK.debug.run && (GK.debug.run.over || GK.debug.run.won) }));
    if (st.over) break;
    if (st.modal) { await page.click('#modal .btn.alt'); continue; }
    if (st.phase === 'replay') { await page.evaluate(() => GK.debug.skipReplay()); continue; }
    if (st.phase === 'call') { await page.click('#callbar [data-call=open]'); continue; }
    if (st.phase === 'aim') {
      frames++;
      if (frames === 2) await snap('04-aim');
      await page.evaluate(() => GK.debug.throw({ aimX: (Math.random() - 0.5) * 6, speed: 320 + Math.random() * 100, spin: (Math.random() - 0.5) * 0.4 }));
      await page.waitForTimeout(600);
      if (frames === 2) await snap('05-rolling');
      continue;
    }
    if (st.layer) {
      const what = await page.evaluate(() => {
        const L = document.getElementById('layerInner');
        if (L.querySelector('.shop')) return 'shop';
        if (L.querySelector('[data-a=go]')) return 'go';
        if (L.querySelector('[data-a=again]')) return 'end';
        return 'other';
      });
      if (what === 'shop') {
        shopVisits++;
        if (shopVisits === 1) await snap('06-shop');
        // buy whatever is affordable, use scorecards, then continue
        const n = await page.$$eval('#layerInner [data-buy]:not([disabled])', els => els.length);
        if (n) { await page.click('#layerInner [data-buy]:not([disabled])'); await page.waitForTimeout(100); if (!(await page.$('#modal[hidden]'))) await page.click('#modal [data-a=no], #modal .btn.alt').catch(() => {}); continue; }
        await page.click('#layerInner [data-a=next]');
        continue;
      }
      if (what === 'go') { await page.click('#layerInner [data-a=go]'); continue; }
      if (what === 'end') { await snap('09-end'); break; }
    }
    await page.waitForTimeout(250);
    if (frames === 3 && guard % 10 === 0) await snap('07-scoring');
  }
  const run = await page.evaluate(() => GK.debug.run && { alley: GK.debug.run.alley, round: GK.debug.run.round, over: GK.debug.run.over, charms: GK.debug.run.charms.map(c => c.id), money: GK.debug.run.money });
  console.log('frames thrown', frames, 'shop visits', shopVisits, 'run', JSON.stringify(run));
  // menu + run info
  await snap('10-final');
  await close();
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('OK: no page errors');
})().catch(e => { console.error(e); process.exit(1); });
