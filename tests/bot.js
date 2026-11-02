// Headless bot: plays whole runs with a simple aiming policy and a greedy shop policy.
// Usage: node tests/bot.js [runs] [verbose]
const GK = require('./load');

function botThrow(run, sim, rng) {
  const st = sim.standing();
  // Aim at the centroid of standing pins with some human-like noise.
  const cx = st.length ? st.reduce((a, p) => a + p.x, 0) / st.length : 0;
  const noise = +(process.env.NOISE || 6);
  const aimX = GK.clamp(cx * 0.35 + (rng() - 0.5) * noise, -15, 15);
  const aim = GK.clamp((cx - aimX) / 300 + (rng() - 0.5) * 0.03, -0.085, 0.085);
  return { aimX, aim, spin: (rng() - 0.5) * 0.4, speed: 260 + rng() * 180, path: [{ z: 0, x: aimX }, { z: 300, x: cx }] };
}

function shopPolicy(run) {
  for (let pass = 0; pass < 3; pass++) {
    run.shop.items.forEach((it, i) => {
      if (it.sold || it.kind === 'ball') return;
      if (run.money - it.price < 0) return;
      if (it.kind === 'charm' && run.charms.length < run.maxCharms) GK.buy(run, i);
      if (it.kind === 'cons' && GK.CONS[it.id].kind === 'card' && run.cons.length < run.maxCons) {
        if (GK.buy(run, i).ok) GK.useCons(run, run.cons.length - 1, null, false);
      }
    });
  }
  if (run.shop.member && run.money >= 14) GK.buyMember(run);
}

function playRun(seed, verbose) {
  const run = GK.newRun({ seed, bag: 'classic' });
  const rng = GK.makeRng(seed ^ 0xabc);
  while (!run.over && !run.won) {
    GK.startRound(run);
    let status = 'next';
    while (status === 'next') {
      const sim = GK.beginFrame(run);
      if (GK.needsCall(run)) run.rs.cur.call = 'open';
      let out;
      for (;;) {
        const bi = run.rs.cur.rollIdx === 0 ? 0 : Math.min(run.bag.length - 1, 1);
        GK.launch(run, sim, bi, botThrow(run, sim, rng));
        sim.simulate();
        out = GK.afterRoll(run, sim);
        if (out.next === 'score') break;
      }
      const res = GK.scoreCurrent(run, out.kind);
      status = GK.commitFrame(run, out.kind, res).status;
    }
    const where = (GK.isChamp(run) ? 'CHAMP' : 'A' + (run.alley + 1) + 'R' + (run.round + 1));
    if (verbose) console.log(where, 'target', run.rs.target, 'got', run.rs.total, status, '$' + run.money, run.charms.map(c => c.id).join(','));
    if (status === 'lost') { run.over = true; return { reached: where, alley: run.alley, round: run.round }; }
    GK.applyPayout(run, GK.payout(run));
    if (GK.advance(run) === 'won') return { reached: 'WON', alley: 9 };
    GK.openShop(run); shopPolicy(run);
  }
}

module.exports = { playRun };
if (require.main === module) {
  const N = +process.argv[2] || 20, verbose = process.argv[3] === 'v';
  const hist = {};
  for (let i = 0; i < N; i++) { const r = playRun(1000 + i, verbose); hist[r.reached] = (hist[r.reached] || 0) + 1; }
  console.log('where runs ended:', JSON.stringify(hist));
}
