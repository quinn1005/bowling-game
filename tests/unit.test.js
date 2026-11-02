// Unit tests for the headless logic. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const GK = require('./load');

const roll = (o = {}) => Object.assign({ ball: 'house', edition: null, down: [], pins: 0, carry: 0, late: 0, walls: 0, pit: 0, ballBounces: 0, explosions: 0, blasted: 0, swallowed: 0, firstPin: 1, fast: 0, rubber: 0 }, o);
const pins = (n, type = 'std') => Array.from({ length: n }, (_, i) => ({ n: i + 1, type, by: 'ball' }));

test('strike base score: (30 + 10×5) × 3', () => {
  const run = GK.newRun({ seed: 1 });
  const r = GK.scoreFrame({ kind: 'strike', rolls: [roll({ down: pins(10), pins: 10 })] }, run);
  assert.strictEqual(r.score, (30 + 50) * 3);
});

test('carry and late pins add bonus chips', () => {
  const run = GK.newRun({ seed: 1 });
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(7), pins: 7, carry: 2, late: 1 })] }, run);
  assert.strictEqual(r.chips, 35 + 2 * 2 + 3);
  assert.strictEqual(r.mult, 1);
});

test('gutter frames score zero unless levelled', () => {
  const run = GK.newRun({ seed: 1 });
  assert.strictEqual(GK.scoreFrame({ kind: 'gutter', rolls: [roll(), roll()] }, run).score, 0);
  run.levels.gutter = 1;
  assert.strictEqual(GK.scoreFrame({ kind: 'gutter', rolls: [roll(), roll()] }, run).score, 15 * 1);
});

test('charms trigger left to right: +Mult before ×Mult differs from after', () => {
  const a = GK.newRun({ seed: 1 }), b = GK.newRun({ seed: 1 });
  a.charms = [GK.charmInst('league_jacket'), GK.charmInst('tenth_frame')];
  b.charms = [GK.charmInst('tenth_frame'), GK.charmInst('league_jacket')];
  const f = { kind: 'spare', lastFrame: true, rolls: [roll({ down: pins(6), pins: 6 }), roll({ down: pins(4), pins: 4 })] };
  assert.strictEqual(GK.scoreFrame(f, a).mult, (2 + 3) * 2);
  assert.strictEqual(GK.scoreFrame(f, b).mult, 2 * 2 + 3);
});

test('Copycat copies the charm to its right', () => {
  const run = GK.newRun({ seed: 1 });
  run.charms = [GK.charmInst('copycat'), GK.charmInst('lucky_shoes')];
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(5), pins: 5 })] }, run);
  assert.strictEqual(r.chips, 25 + 20 + 20);
});

test('Lucky Seven retriggers charms on exactly 7 pins', () => {
  const run = GK.newRun({ seed: 1 });
  run.charms = [GK.charmInst('lucky_shoes')];
  const r = GK.scoreFrame({ kind: 'open', rolls: [roll({ ball: 'lucky7', down: pins(7), pins: 7 })] }, run);
  assert.strictEqual(r.chips, 35 + 40);
});

test('ball editions and lead/golden ball rules', () => {
  const run = GK.newRun({ seed: 1 });
  const lead = GK.scoreFrame({ kind: 'open', rolls: [roll({ ball: 'lead', edition: 'foil', down: pins(8), pins: 8 })] }, run);
  assert.strictEqual(lead.chips, 20 + 30);
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

test('League Secretary: a right call doubles Mult, a wrong one halves it', () => {
  const run = GK.newRun({ seed: 1 });
  const f = { kind: 'strike', call: 'miss', rolls: [roll({ down: pins(10), pins: 10 })] };
  assert.strictEqual(GK.scoreFrame(f, run).score, Math.floor(80 * 1.5));
  f.call = 'hit';
  assert.strictEqual(GK.scoreFrame(f, run).score, 80 * 6);
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
  assert.strictEqual(GK.rerollCost(run), rc + 2);
  if (run.shop.member) { const mc = run.maxCharms; GK.buyMember(run); assert.ok(run.members.length === 1 || run.maxCharms === mc); }
});

test('consumables: scorecards level shots, tricks change pins and balls', () => {
  const run = GK.newRun({ seed: 3 });
  run.cons = ['card_strike', 't_gild', 't_neon', 'm_eraser', 't_backrow'];
  run.maxCons = 5;
  assert.ok(GK.useCons(run, 0, null, false).ok);
  assert.strictEqual(run.levels.strike, 1);
  assert.deepStrictEqual(GK.shotBase('strike', run.levels), { chips: 40, mult: 4, lv: 1 });
  assert.ok(GK.useCons(run, 0, [1, 5], false).ok);
  assert.strictEqual(run.rack[0], 'gold'); assert.strictEqual(run.rack[4], 'gold');
  assert.ok(GK.useCons(run, 0, 1, false).ok);
  assert.strictEqual(run.bag[1].ed, 'neon');
  assert.ok(GK.useCons(run, 0, [10], false).ok);
  assert.strictEqual(run.rack[9], 'none');
  assert.strictEqual(GK.useCons(run, 0, [5], false).ok, false, 'back-row pins only go on spots 11-13');
  assert.ok(GK.useCons(run, 0, [12], false).ok);
  assert.strictEqual(run.rack[11], 'std');
  assert.strictEqual(run.cons.length, 0);
});

test('round flow: targets scale, payout includes unused frames and interest', () => {
  const run = GK.newRun({ seed: 5 });
  GK.startRound(run);
  assert.strictEqual(run.rs.target, 500);
  run.money = 12; run.rs.frameIdx = 3;
  const lines = GK.payout(run);
  const tot = lines.reduce((a, l) => a + l.v, 0);
  assert.strictEqual(tot, 2 + 2 + 2);
  GK.applyPayout(run, lines);
  assert.strictEqual(GK.advance(run), 'shop');
  assert.strictEqual(run.round, 1);
  assert.strictEqual(GK.roundTarget(run), 750);
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

test('oil patterns: oily lanes skid, dry boards hook', () => {
  assert.strictEqual(GK.oilAt('house', 0, 50), 1);
  assert.ok(GK.oilAt('house', 18, 50) < 0.6, 'house shot is drier outside');
  assert.strictEqual(GK.oilAt('short', 0, 200), 0);
  assert.ok(GK.oilAt('long', 0, 250) > 0);
  const hookAt = pat => {
    const s = new GK.Sim({ rng: GK.makeRng(5), lane: { oil: pat }, rack: new Array(10).fill('none') });
    s.launch({ type: 'house' }, { aimX: 0, aim: 0, spin: 0.6, speed: 300 });
    for (let i = 0; i < 240 * 1.2; i++) s.step();
    return s.balls[0].x;
  };
  assert.ok(hookAt('short') > hookAt('long') + 1, 'short oil hooks more than long oil');
});

test('back-row pins: a 13-pin rack sets up and needs every pin for a strike', () => {
  const rack = GK.padRack(); rack[10] = rack[11] = rack[12] = 'std';
  const s = new GK.Sim({ rng: GK.makeRng(2), lane: {}, rack });
  assert.strictEqual(s.pins.length, 13);
  assert.ok(s.pins.every(p => p.z < GK.C.ZBACK));
});

test('Groove builds on PERFECT throws and adds Mult; misses reset it', () => {
  const run = GK.newRun({ seed: 11 });
  GK.startRound(run);
  let sim = GK.beginFrame(run);
  GK.launch(run, sim, 0, { aimX: 3, aim: 0, spin: 0.2, speed: 400, perfect: true });
  sim.simulate(); GK.afterRoll(run, sim);
  assert.strictEqual(run.rs.groove, 1);
  const res = GK.scoreFrame({ kind: 'open', groove: 2, rolls: [roll({ down: pins(5), pins: 5 })] }, run);
  assert.strictEqual(res.mult, 1 + 2);
  if (run.rs.cur && run.rs.cur.rollIdx === 1) {
    GK.launch(run, sim, 0, { aimX: 0, aim: 0, spin: 0, speed: 300, perfect: false });
    sim.simulate(); GK.afterRoll(run, sim);
    assert.strictEqual(run.rs.groove, 0);
  }
});

test('leagues and ascension change targets, re-racks and prices', () => {
  const base = GK.newRun({ seed: 1 }), hard = GK.newRun({ seed: 1, league: 'pro', asc: 3 });
  assert.strictEqual(GK.roundTarget(base), 500);
  assert.strictEqual(GK.roundTarget(hard), Math.round(500 * 1.3 * 1.2 / 50) * 50);
  assert.strictEqual(GK.flags(hard).reracks, -1);
  assert.strictEqual(GK.price(hard, 5), 6);
});

test('feats unlock items; locked items never appear in the shop', () => {
  GK._meta = { feats: {} };
  try {
    const run = GK.newRun({ seed: 99 });
    for (let i = 0; i < 40; i++) {
      GK.openShop(run);
      for (const it of run.shop.items) {
        if (it.kind === 'charm') assert.ok(GK.isUnlocked('charm', it.id), it.id + ' is locked');
        if (it.kind === 'ball') assert.ok(GK.isUnlocked('ball', it.id), it.id + ' is locked');
      }
    }
    const got = GK.checkFeats(GK._meta, { t: 'frame', kind: 'turkey', score: 10, ctx: { carry: 0, late: 0, blasted: 0 }, run });
    assert.ok(got.some(f => f.id === 'turkey') && got.some(f => f.id === 'strike'));
    assert.ok(GK.isUnlocked('charm', 'hot_streak'));
  } finally { GK._meta = undefined; }
});

test('new charms: Shoes of Destiny, Chain Gang and Rebound', () => {
  const run = GK.newRun({ seed: 1 });
  run.charms = [GK.charmInst('shoes_destiny'), GK.charmInst('chain_gang')];
  const f = { kind: 'spare', rolls: [roll({ down: pins(6), pins: 6, carry: 4, perfect: true }), roll({ down: pins(4), pins: 4, perfect: false })] };
  const r = GK.scoreFrame(f, run);
  assert.strictEqual(r.mult, 2 + 0 + 2);
  const rb = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(6), pins: 6, rebounded: true })] }, GK.newRun({ seed: 1 }));
  assert.strictEqual(rb.chips, 15);
});

test('reactive oil: throwing the same line dries it out and the ball hooks more', () => {
  const wear = GK.newWear(), xs = [];
  for (let t = 0; t < 6; t++) {
    const s = new GK.Sim({ rng: GK.makeRng(1), lane: { oil: 'house' }, rack: new Array(10).fill('none'), wear });
    s.launch({ type: 'house' }, { aimX: 6, aim: 0, spin: -0.35, speed: 330 });
    for (let i = 0; i < 240 * 1.3; i++) s.step();
    xs.push(s.balls[0].x);
  }
  assert.ok(xs[5] < xs[0] - 2, 'later throws hook further: ' + xs.map(x => x.toFixed(1)).join(' '));
  assert.ok(wear.some(w => w > 0) && wear.some(w => w < 0), 'oil is stripped and carried down');
  assert.ok(GK.oilEff('house', wear, 6, 100) < GK.oilAt('house', 6, 100));
});

test('ball return: a stuck ball cannot be thrown until another ball is', () => {
  const run = GK.newRun({ seed: 21 });
  GK.startRound(run);
  run.rs.stuck = { idx: 0 };
  assert.ok(GK.isStuck(run, 0));
  assert.strictEqual(GK.firstFreeBall(run, 0), 1);
  const sim = GK.beginFrame(run);
  GK.launch(run, sim, 0, { aimX: 2, aim: 0, spin: 0, speed: 380 });
  assert.strictEqual(run.rs.cur.ballIdx, 1, 'launch swaps away from the stuck ball');
  sim.simulate();
  const prev = GK.MISHAPS.stuck; GK.MISHAPS.stuck = 0;
  try { GK.afterRoll(run, sim); } finally { GK.MISHAPS.stuck = prev; }
  assert.strictEqual(run.rs.stuck, null, 'the stuck ball comes back after another ball is thrown');
});

test('pinsetter fumble: drops leftover pins after the first roll and counts them', () => {
  const run = GK.newRun({ seed: 5 });
  GK.startRound(run);
  const prev = GK.MISHAPS.respot; GK.MISHAPS.respot = 1;
  try {
    const sim = GK.beginFrame(run);
    GK.launch(run, sim, 0, { aimX: 14, aim: 0, spin: 0, speed: 250 });
    sim.simulate();
    const out = GK.afterRoll(run, sim);
    const note = out.notes.find(n => n.t === 'respot');
    assert.ok(note, 'fumble happened');
    assert.ok(out.rec.dropped >= 1 && out.rec.down.filter(d => d.by === 'drop').length === out.rec.dropped);
  } finally { GK.MISHAPS.respot = prev; }
});

test('pinsetter fumble that drops the last standing pin is a free spare, not a strike', () => {
  const run = GK.newRun({ seed: 8 });
  run.rack = GK.padRack(['none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'std']);
  GK.startRound(run);
  const prev = GK.MISHAPS.respot; GK.MISHAPS.respot = 1;
  try {
    const sim = GK.beginFrame(run);
    GK.launch(run, sim, 0, { aimX: -14, aim: -0.02, spin: 0, speed: 300 });
    sim.simulate();
    const out = GK.afterRoll(run, sim);
    assert.strictEqual(out.next, 'score');
    assert.strictEqual(out.kind, 'spare');
    assert.strictEqual(run.rs.cur.rolls.length, 2);
    assert.strictEqual(run.rs.cur.rolls[0].pins, 0);
    assert.strictEqual(run.rs.cur.rolls[1].ball, 'pinsetter');
    const res = GK.scoreCurrent(run, out.kind);
    assert.ok(res.score > 0);
  } finally { GK.MISHAPS.respot = prev; }
});
