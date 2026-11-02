// Headless bot that plays like a skilled human with the real controls: it aims at the pocket,
// times the power bar with human-sized error (so PERFECT throws are hit-or-miss), picks a hook,
// and shops greedily. Used to check difficulty. Usage: node tests/bot.js [runs] [skill] [v]
//   skill: 'good' (default) or 'great' (tighter timing and aim).
const GK = require('./load');

const SKILL = {
  good: { aim: 1.6, ang: 0.006, power: 0.045, hook: 0.25 },
  great: { aim: 0.9, ang: 0.004, power: 0.028, hook: 0.15 }
};
const gauss = rng => { let u = 0; for (let i = 0; i < 6; i++) u += rng(); return (u - 3) / Math.sqrt(0.5); };

// Mirrors main.js: zone, perfect check and the wobble on overpowered throws.
function timedThrow(run, rng, sk, aimX, aim, spinWant) {
  const eq = GK.equipMods(run);
  const mid = 0.86, half = 0.03 * eq.zone, z = [mid - half, mid + half];
  const p = GK.clamp(mid + gauss(rng) * sk.power / Math.sqrt(eq.bar), 0, 1);
  const perfect = p >= z[0] && p <= z[1];
  let spin = GK.clamp(spinWant + gauss(rng) * sk.hook / Math.sqrt(eq.dial), -1, 1);
  if (p > z[1] && !eq.noWobble) { const k = (p - z[1]) / (1 - z[1]); aim += (rng() - 0.5) * 0.05 * (0.4 + k); spin += (rng() - 0.5) * 0.6 * (0.4 + k); }
  return { aimX, aim, spin, speed: 170 + p * 300, perfect, power: p, path: GK.snakePath(aimX, aim, GK.laneFor(run).lhw) };
}

function botThrow(run, sim, rng, sk) {
  const st = sim.standing();
  const first = run.rs.cur.rollIdx === 0 && st.length >= 9;
  let tx;
  if (first) tx = 3; // the 1-3 pocket
  else tx = st.reduce((a, p) => a + p.x, 0) / Math.max(1, st.length);
  const aimX = GK.clamp(tx * 0.3 + gauss(rng) * sk.aim, -14, 14);
  const aim = GK.clamp((tx - aimX) / 310 + gauss(rng) * sk.ang, -0.085, 0.085);
  return timedThrow(run, rng, sk, aimX, aim, first ? 0.18 : 0);
}

const VALUE = { xmult: 5, scaling: 4, mult: 3, rule: 2, chips: 1, economy: 1 };
function shopPolicy(run) {
  for (let pass = 0; pass < 3; pass++) {
    run.shop.items.forEach((it, i) => {
      if (it.sold) return;
      const keep = run.alley < 1 ? 0 : 3; // keep a little for interest
      if (run.money - it.price < keep) return;
      if (it.kind === 'charm') {
        if (run.charms.length >= run.maxCharms) {
          // swap out the weakest charm for a clearly better one
          let wi = -1, wv = 99;
          run.charms.forEach((c, j) => { const v = VALUE[GK.CHARMS[c.id].tag] || 1; if (v < wv) { wv = v; wi = j; } });
          if (wi >= 0 && (VALUE[GK.CHARMS[it.id].tag] || 1) > wv + 1) GK.sellCharm(run, wi); else return;
        }
        GK.buy(run, i);
      }
      if (it.kind === 'cons' && GK.CONS[it.id].kind === 'card' && ['strike', 'spare', 'double', 'turkey', 'split'].includes(GK.CONS[it.id].shot) && run.cons.length < run.maxCons) {
        if (GK.buy(run, i).ok) GK.useCons(run, run.cons.length - 1, null, false);
      }
      if (it.kind === 'equip' && run.money - it.price >= 6) GK.buy(run, i);
    });
  }
  if (run.shop.member && run.money >= GK.price(run, GK.MEMBERSHIPS[run.shop.member].cost) + 5) GK.buyMember(run);
}

function playRun(seed, verbose, skill = 'good', opts = {}) {
  const sk = SKILL[skill] || SKILL.good;
  const run = GK.newRun(Object.assign({ seed, bag: 'classic' }, opts));
  const rng = GK.makeRng(seed ^ 0xabc);
  let frames = 0, scoreSum = 0, perfects = 0, throws = 0;
  while (!run.over && !run.won) {
    GK.startRound(run);
    let status = 'next';
    while (status === 'next') {
      const sim = GK.beginFrame(run);
      if (GK.needsCall(run)) run.rs.cur.call = 'spare';
      let out;
      for (;;) {
        const bi = run.rs.cur.rollIdx === 0 ? 0 : Math.min(run.bag.length - 1, 1);
        const prm = botThrow(run, sim, rng, sk);
        throws++; if (prm.perfect) perfects++;
        GK.launch(run, sim, bi, prm);
        sim.simulate();
        out = GK.afterRoll(run, sim);
        if (out.next === 'score') break;
        // re-rack a really bad first roll
        if (run.rs.cur && run.rs.cur.rollIdx === 1 && out.rec.pins <= 4 && GK.canRerack(run)) GK.rerack(run, sim);
      }
      const res = GK.scoreCurrent(run, out.kind);
      frames++; scoreSum += res.score;
      status = GK.commitFrame(run, out.kind, res).status;
    }
    const where = GK.isChamp(run) ? 'CHAMP' : 'A' + (run.alley + 1) + 'R' + (run.round + 1);
    if (verbose) console.log(where, 'target', run.rs.target, 'got', run.rs.total, status, '$' + run.money, run.charms.map(c => c.id).join(','));
    if (status === 'lost') { run.over = true; return { reached: where, alley: run.alley, round: run.round, avgFrame: scoreSum / frames, perfectRate: perfects / throws }; }
    GK.applyPayout(run, GK.payout(run));
    if (GK.advance(run) === 'won') return { reached: 'WON', alley: 8, round: 3, avgFrame: scoreSum / frames, perfectRate: perfects / throws };
    GK.openShop(run); shopPolicy(run);
  }
}

module.exports = { playRun };
if (require.main === module) {
  const N = +process.argv[2] || 30, skill = process.argv[3] || 'good', verbose = process.argv[4] === 'v';
  const hist = {}; let af = 0, pr = 0, alleySum = 0;
  for (let i = 0; i < N; i++) {
    const r = playRun(1000 + i, verbose, skill);
    hist[r.reached] = (hist[r.reached] || 0) + 1; af += r.avgFrame; pr += r.perfectRate; alleySum += r.alley * 3 + r.round;
  }
  const order = Object.keys(hist).sort((a, b) => (a === 'WON') - (b === 'WON') || a.localeCompare(b));
  console.log('skill', skill, '| runs', N, '| avg frame', Math.round(af / N), '| perfect rate', (pr / N * 100).toFixed(0) + '%', '| avg rounds cleared', (alleySum / N).toFixed(1));
  console.log('where runs ended:', order.map(k => k + ':' + hist[k]).join('  '));
}
