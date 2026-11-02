// Unit tests for the headless logic. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const GK = require('./load');

const roll = (o = {}) => Object.assign({ ball: 'house', edition: null, down: [], pins: 0, carry: 0, late: 0, walls: 0, pit: 0, ballBounces: 0, explosions: 0, blasted: 0, swallowed: 0, firstPin: 1, fast: 0, rubber: 0 }, o);
const pins = (n, type = 'std') => Array.from({ length: n }, (_, i) => ({ n: i + 1, type, by: 'ball' }));

test('strike base score: (40 + 10×5) × 4', () => {
  const run = GK.newRun({ seed: 1 });
  const r = GK.scoreFrame({ kind: 'strike', rolls: [roll({ down: pins(10), pins: 10 })] }, run);
  assert.strictEqual(r.score, (40 + 50) * 4);
});

test('carry and late pins add bonus chips', () => {
  const run = GK.newRun({ seed: 1 });
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(7), pins: 7, carry: 2, late: 1 })] }, run);
  assert.strictEqual(r.chips, 35 + 6 + 4);
  assert.strictEqual(r.mult, 1);
});

test('gutter frames score zero unless levelled', () => {
  const run = GK.newRun({ seed: 1 });
  assert.strictEqual(GK.scoreFrame({ kind: 'gutter', rolls: [roll(), roll()] }, run).score, 0);
  run.levels.gutter = 1;
  assert.strictEqual(GK.scoreFrame({ kind: 'gutter', rolls: [roll(), roll()] }, run).score, 20 * 1);
});

test('charms trigger left to right: +Mult before ×Mult differs from after', () => {
  const a = GK.newRun({ seed: 1 }), b = GK.newRun({ seed: 1 });
  a.charms = [GK.charmInst('league_jacket'), GK.charmInst('tenth_frame')];
  b.charms = [GK.charmInst('tenth_frame'), GK.charmInst('league_jacket')];
  const f = { kind: 'spare', lastFrame: true, rolls: [roll({ down: pins(6), pins: 6 }), roll({ down: pins(4), pins: 4 })] };
  assert.strictEqual(GK.scoreFrame(f, a).mult, (3 + 4) * 3);
  assert.strictEqual(GK.scoreFrame(f, b).mult, 3 * 3 + 4);
});

test('Copycat copies the charm to its right', () => {
  const run = GK.newRun({ seed: 1 });
  run.charms = [GK.charmInst('copycat'), GK.charmInst('lucky_shoes')];
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(5), pins: 5 })] }, run);
  assert.strictEqual(r.chips, 25 + 30 + 30);
});

test('Lucky Seven retriggers charms on exactly 7 pins', () => {
  const run = GK.newRun({ seed: 1 });
  run.charms = [GK.charmInst('lucky_shoes')];
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ ball: 'lucky7', down: pins(7), pins: 7 })] }, run);
  assert.strictEqual(r.chips, 35 + 60);
});

test('ball editions and lead/golden ball rules', () => {
  const run = GK.newRun({ seed: 1 });
  const lead = GK.scoreFrame({ kind: 'open', rolls: [roll({ ball: 'lead', edition: 'foil', down: pins(8), pins: 8 })] }, run);
  assert.strictEqual(lead.chips, 20 + 50);
  const gold = GK.scoreFrame({ kind: 'open', rolls: [roll({ ball: 'golden', down: pins(6), pins: 6 })] }, run);
  assert.strictEqual(gold.chips, 0); assert.strictEqual(gold.money, 6);
});

test('stolen charm is skipped and its flags are ignored', () => {
  const run = GK.newRun({ seed: 1 });
  run.charms = [GK.charmInst('overtime'), GK.charmInst('lucky_shoes')];
  assert.strictEqual(GK.flags(run, 0).frames, 0);
  assert.strictEqual(GK.flags(run, -1).frames, 1);
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(5), pins: 5 })] }, run, { stolen: 1 });
  assert.strictEqual(r.chips, 25);
});

test('wrong call against the League Secretary voids the frame', () => {
  const run = GK.newRun({ seed: 1 });
  const f = { kind: 'strike', call: 'miss', rolls: [roll({ down: pins(10), pins: 10 })] };
  assert.strictEqual(GK.scoreFrame(f, run).score, 0);
  f.call = 'hit';
  assert.strictEqual(GK.scoreFrame(f, run).score, 90 * 8);
  assert.strictEqual(GK.callResult('spare', 'split'), 'hit');
  assert.strictEqual(GK.callResult('open', 'gutter'), 'hit');
  assert.strictEqual(GK.callResult('strike', 'spare'), 'miss');
});

test('classify: strikes chain into doubles and turkeys; splits convert', () => {
  const r1 = [roll({ pins: 10 })];
  assert.strictEqual(GK.classify(r1, true, false, 0), 'strike');
  assert.strictEqual(GK.classify(r1, true, false, 1), 'double');
  assert.strictEqual(GK.classify(r1, true, false, 4), 'turkey');
  assert.strictEqual(GK.classify([roll({ pins: 8 }), roll({ pins: 2 })], true, true, 0), 'split');
  assert.strictEqual(GK.classify([roll({ pins: 0 }), roll({ pins: 0 })], false, false, 0), 'gutter');
});

test('split detection: 7-10 is a split, 1-2 leave is not', () => {
  const sp = GK.spots();
  const mk = ns => ns.map(n => ({ n, sx: sp[n - 1][0], sz: sp[n - 1][1] }));
  assert.ok(GK.isSplitLeave(mk([7, 10])));
  assert.ok(!GK.isSplitLeave(mk([1, 2])));
  assert.ok(!GK.isSplitLeave(mk([4, 7])));
  assert.ok(GK.isSplitLeave(mk([4, 6])));
});

test('physics is deterministic for a seed', () => {
  const go = () => {
    const s = new GK.Sim({ rng: GK.makeRng(42), lane: {} });
    s.launch({ type: 'house' }, { aimX: 1.5, aim: 0.01, spin: 0.3, speed: 380 });
    s.simulate();
    return JSON.stringify(s.summarize());
  };
  assert.strictEqual(go(), go());
});

test('a pocket hit with the house ball knocks down most pins', () => {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const s = new GK.Sim({ rng: GK.makeRng(i), lane: {} });
    s.launch({ type: 'house' }, { aimX: 2.5, aim: 0, spin: 0, speed: 380 });
    s.simulate(); total += s.summarize().pins;
  }
  assert.ok(total / 20 >= 6, 'average ' + total / 20);
});

test('every ball type runs a roll without errors and settles', () => {
  for (const type of Object.keys(GK.BALLS)) {
    for (const lane of [{}, { ice: true }, { lowg: true }, { posts: true }, { warp: 42 }, { lhw: 16 }, { lhw: 18, magnet: true }]) {
      const s = new GK.Sim({ rng: GK.makeRng(7), lane, rack: ['std', 'gold', 'glass', 'lead', 'rubber', 'explosive', 'lucky', 'phantom', 'none', 'std'], winter: !!lane.ice });
      s.launch({ type }, { aimX: 0, aim: 0, spin: 0.2, speed: 400, path: [{ z: 0, x: 0 }, { z: 300, x: 3 }] }, { bumpers: true, wide: 1.35 });
      s.simulate();
      assert.strictEqual(s.rolling, false);
      const r = s.summarize();
      assert.ok(r.pins >= 0 && r.pins <= 9, type);
    }
  }
});

test('shop: buying, selling, rerolling and memberships keep money consistent', () => {
  const run = GK.newRun({ seed: 9 });
  run.money = 100;
  GK.openShop(run);
  const i = run.shop.items.findIndex(it => it.kind === 'charm');
  const price = run.shop.items[i].price;
  assert.ok(GK.buy(run, i).ok);
  assert.strictEqual(run.money, 100 - price);
  assert.strictEqual(GK.buy(run, i).ok, false);
  const before = run.money;
  GK.sellCharm(run, 0);
  assert.ok(run.money > before);
  const rc = GK.rerollCost(run), m = run.money;
  assert.ok(GK.reroll(run).ok);
  assert.strictEqual(run.money, m - rc);
  assert.strictEqual(GK.rerollCost(run), rc + 1);
  if (run.shop.member) { const mc = run.maxCharms; GK.buyMember(run); assert.ok(run.members.length === 1 || run.maxCharms === mc); }
});

test('consumables: scorecards level shots, tricks change pins and balls', () => {
  const run = GK.newRun({ seed: 3 });
  run.cons = ['card_strike', 't_gild', 't_neon', 'm_eraser'];
  run.maxCons = 4;
  assert.ok(GK.useCons(run, 0, null, false).ok);
  assert.strictEqual(run.levels.strike, 1);
  assert.deepStrictEqual(GK.shotBase('strike', run.levels), { chips: 55, mult: 6, lv: 1 });
  assert.ok(GK.useCons(run, 0, [1, 5], false).ok);
  assert.strictEqual(run.rack[0], 'gold'); assert.strictEqual(run.rack[4], 'gold');
  assert.ok(GK.useCons(run, 0, 1, false).ok);
  assert.strictEqual(run.bag[1].ed, 'neon');
  assert.ok(GK.useCons(run, 0, [10], false).ok);
  assert.strictEqual(run.rack[9], 'none');
  assert.strictEqual(run.cons.length, 0);
});

test('round flow: targets scale, payout includes unused frames and interest', () => {
  const run = GK.newRun({ seed: 5 });
  GK.startRound(run);
  assert.strictEqual(run.rs.target, 600);
  run.money = 12; run.rs.frameIdx = 3;
  const lines = GK.payout(run);
  const tot = lines.reduce((a, l) => a + l.v, 0);
  assert.strictEqual(tot, 3 + 2 + 2);
  GK.applyPayout(run, lines);
  assert.strictEqual(GK.advance(run), 'shop');
  assert.strictEqual(run.round, 1);
  assert.strictEqual(GK.roundTarget(run), 900);
  run.alley = 8; run.round = 0;
  assert.ok(GK.isChamp(run));
  GK.startRound(run);
  assert.ok(run.rs.king.length === run.rs.framesMax && run.rs.target === run.rs.kingTotal + 1);
});

test('a whole headless run completes (bot)', () => {
  const { playRun } = require('./bot');
  const r = playRun(4242, false);
  assert.ok(r && r.reached);
});
