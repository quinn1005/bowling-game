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
  assert.strictEqual(GK.useCons(run, 0, [5], false).ok, false, 'back-row pins only go on spots 11-15');
  assert.ok(GK.useCons(run, 0, [12], false).ok);
  assert.strictEqual(run.rack[11], 'std');
  assert.strictEqual(run.cons.length, 0);
});

test('round flow: targets scale, payout includes unused frames and interest', () => {
  const run = GK.newRun({ seed: 5 });
  GK.startRound(run);
  assert.strictEqual(run.rs.target, Math.round(GK.ALLEYS[0].base * GK.ALLEY_SCALE[0] / 50) * 50);
  run.money = 12; run.rs.frameIdx = 3;
  const lines = GK.payout(run);
  const tot = lines.reduce((a, l) => a + l.v, 0);
  assert.strictEqual(tot, 2 + 2 + 2);
  GK.applyPayout(run, lines);
  assert.strictEqual(GK.advance(run), 'shop');
  assert.strictEqual(run.round, 1);
  assert.strictEqual(GK.roundTarget(run), Math.round(GK.ALLEYS[0].base * GK.ALLEY_SCALE[0] * 1.5 / 50) * 50);
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
  const t0 = GK.ALLEYS[0].base * GK.ALLEY_SCALE[0]; assert.strictEqual(GK.roundTarget(base), Math.round(t0 / 50) * 50);
  assert.strictEqual(GK.roundTarget(hard), Math.round(t0 * 1.3 * 1.2 / 50) * 50);
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
        if (it.kind === 'equip') assert.ok(GK.isUnlocked('equip', it.id), it.id + ' is locked');
        if (it.kind === 'cons') assert.ok(GK.isUnlocked('cons', it.id), it.id + ' is locked');
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

test('boss pools: each alley picks one boss per run, fixed by the seed', () => {
  const a = GK.newRun({ seed: 77 }), b = GK.newRun({ seed: 77 });
  assert.deepStrictEqual(a.bosses, b.bosses);
  a.bosses.forEach((id, i) => assert.ok(GK.ALLEYS[i].bosses.includes(id)));
  const seen = new Set(); for (let s = 0; s < 40; s++) seen.add(GK.newRun({ seed: s }).bosses[0]);
  assert.strictEqual(seen.size, 2, 'both Alley 1 bosses show up across seeds');
  a.round = 2; assert.strictEqual(GK.bossId(a), a.bosses[0]);
});

test('skipping a round: tag applied, no pay, straight to the next round', () => {
  const run = GK.newRun({ seed: 3 });
  GK.startRound(run);
  const money = run.money, r = GK.skipRound(run);
  assert.ok(GK.TAGS[r.tag]);
  assert.strictEqual(run.round, 1);
  assert.ok(run.history[0].skipped);
  if (r.tag === 'cash') assert.strictEqual(run.money, money + 6);
  run.round = 2; assert.strictEqual(GK.canSkip(run), false, 'boss rounds cannot be skipped');
});

test('shop tags: coupon halves prices and the charm tag adds a free charm', () => {
  const run = GK.newRun({ seed: 3 });
  run.tags = ['coupon', 'charm'];
  GK.openShop(run);
  const before = run.shop.items.map(i => i.price);
  GK.applyShopTags(run);
  assert.strictEqual(run.shop.items[0].price, 0);
  assert.ok(run.shop.items.slice(1).every((it, i) => it.price === Math.max(1, Math.ceil(before[i] / 2))));
  assert.deepStrictEqual(run.tags, []);
});

test('events: each offer can be taken', () => {
  const run = GK.newRun({ seed: 5 }); run.money = 20;
  assert.ok(GK.takeEvent(run, { id: 'vending', item: 'card_spare' }).ok);
  assert.strictEqual(run.money, 17);
  assert.ok(GK.takeEvent(run, { id: 'shady', charm: 'sniper' }).ok);
  assert.ok(run.nextTargetMul > 1.19);
  const lf = GK.takeEvent(run, { id: 'lost_found', ball: 'ghost' });
  assert.strictEqual(lf.need, 'replace');
  assert.ok(GK.takeEvent(run, { id: 'lost_found', ball: 'ghost' }, 2).ok);
  assert.strictEqual(run.bag[2].type, 'ghost');
  assert.ok(GK.takeEvent(run, { id: 'lane_mech' }, { ball: 0, drill: 'strong' }).ok);
  assert.strictEqual(run.bag[0].drill, 'strong');
});

test('drilling changes how a ball hooks', () => {
  const finalX = (drill) => {
    const run = GK.newRun({ seed: 9 }); GK.startRound(run);
    run.bag[0].drill = drill; run.rack = GK.padRack(new Array(10).fill('none'));
    const sim = GK.beginFrame(run);
    GK.launch(run, sim, 0, { aimX: 6, aim: 0, spin: -0.4, speed: 330 });
    for (let i = 0; i < 240 * 1.3; i++) sim.step();
    return sim.balls[0].x;
  };
  const stock = finalX('stock'), strong = finalX('strong'), control = finalX('control');
  assert.ok(strong < stock - 1 && control > stock + 1, [stock, strong, control].join(' '));
});

test('endless mode continues past the Championship with growing targets', () => {
  const run = GK.newRun({ seed: 1 });
  run.alley = GK.ALLEY_COUNT; GK.startRound(run); GK.advance(run);
  assert.ok(run.won);
  GK.startEndless(run);
  assert.ok(GK.isEndless(run) && !run.won);
  const t1 = GK.roundTarget(run); run.alley++; const t2 = GK.roundTarget(run);
  assert.ok(t2 > t1 * 1.5);
  assert.ok(/Endless 2/.test(GK.alleyDef(run).name));
});

test('resuming a saved frame keeps its rolls and standing pins', () => {
  const run = GK.newRun({ seed: 12 }); GK.startRound(run);
  let sim = GK.beginFrame(run);
  GK.launch(run, sim, 0, { aimX: 10, aim: 0, spin: 0, speed: 300 });
  sim.simulate();
  const out = GK.afterRoll(run, sim);
  if (out.next !== 'aim') return; // strike: nothing to resume
  const saved = JSON.parse(JSON.stringify(run));
  const sim2 = GK.beginFrame(saved, true);
  const standing = sim2.standing().map(p => p.n).sort((a, b) => a - b);
  assert.deepStrictEqual(standing, sim.standing().map(p => p.n).sort((a, b) => a - b));
  assert.strictEqual(saved.rs.cur.rollIdx, 1);
  assert.strictEqual(saved.rs.cur.rolls.length, 1);
});

test('back row: a 15-pin rack sets up a full back row of 5', () => {
  assert.strictEqual(GK.RACK_SIZE, 15);
  const rack = GK.padRack(); for (let i = 10; i < 15; i++) rack[i] = 'std';
  const s = new GK.Sim({ rng: GK.makeRng(2), lane: {}, rack });
  assert.strictEqual(s.pins.length, 15);
  const back = s.pins.filter(p => p.n >= 11);
  assert.strictEqual(new Set(back.map(p => Math.round(p.z))).size, 1, 'back row pins share one row');
  assert.ok(s.pins.every(p => p.z < GK.C.ZBACK && Math.abs(p.x) < s.lhw));
});

test('v0.7 content: every new ball rolls on every lane, with new pin types in the rack', () => {
  const rack = ['std', 'bouncy', 'mirror', 'lead', 'std', 'mirror', 'std', 'std', 'std', 'std', 'mirror', 'std', 'bouncy', 'std', 'mirror'];
  for (const type of ['pinball', 'disco', 'boomerang', 'sticky', 'rubber', 'paint', 'pendulum', 'twin', 'lightning', 'snowball', 'wrecking', 'duster', 'bubble', 'jelly', 'chain', 'spiked', 'neonball', 'moon']) {
    assert.ok(GK.BALLS[type], type);
    for (const lane of [{}, { ice: true }, { lowg: true }, { posts: true }, { lhw: 16 }]) {
      const s = new GK.Sim({ rng: GK.makeRng(9), lane, rack, lightLead: true });
      s.launch({ type }, { aimX: 1, aim: 0, spin: 0.3, speed: 400, phase: 1 }, { shadowPrm: { aimX: -3, aim: 0, spin: 0, speed: 380 } });
      s.simulate();
      assert.strictEqual(s.rolling, false, type);
      const r = s.summarize();
      assert.ok(r.pins >= 0 && r.pins <= 15, type);
      assert.ok(Number.isFinite(r.boards) && Number.isFinite(r.gutterPins), type);
    }
  }
});

test('v0.7 content: every new charm scores without errors', () => {
  const run = GK.newRun({ seed: 3 });
  const ids = GK.CHARM_LIST.map(c => c.id);
  for (let i = 0; i < ids.length; i += 5) {
    run.charms = ids.slice(i, i + 5).map(id => GK.charmInst(id));
    for (const kind of ['strike', 'spare', 'split', 'open', 'gutter']) {
      const f = { kind, leftSplit: kind === 'split', framesLeft: 2, maxHook: 0.45, throws: 2, dark: true, boss: true, oil: 'house', fumbles: 1, jams: 1, leftOne: true, rackSize: 15,
        rolls: [roll({ down: pins(9), pins: 9, gutterPins: 2, boards: 6, wobbles: 0, leadDown: 1, deckLeft: 0, pocket: true, perfect: true }), roll({ down: [{ n: 12, type: 'std', by: 'ball' }], pins: 1, perfect: true })] };
      const r = GK.scoreFrame(f, run);
      assert.ok(Number.isFinite(r.score) && r.score >= 0, run.charms.map(c => c.id).join(',') + ' ' + kind);
      GK.afterFrame(r.ctx, run);
    }
  }
});

test('v0.7 content: charm effects (Back Row Boss, Groove Master, Neon ball, Full Rack, Weighted pins)', () => {
  const run = GK.newRun({ seed: 3 });
  const f = { kind: 'strike', rolls: [roll({ down: pins(10).concat([{ n: 11, type: 'std', by: 'ball' }, { n: 15, type: 'std', by: 'ball' }]), pins: 12 })] };
  const base = GK.scoreFrame(f, run);
  run.charms = [GK.charmInst('back_row_boss')];
  assert.strictEqual(GK.scoreFrame(f, run).chips, base.chips + 50);
  run.charms = [];
  // Groove Master turns Groove into ×Mult
  assert.strictEqual(GK.scoreFrame(Object.assign({ groove: 5 }, f), run).mult, base.mult + 5);
  assert.ok(Math.abs(GK.scoreFrame(Object.assign({ groove: 5, grooveX: true }, f), run).mult - base.mult * 1.5) < 1e-9);
  // Neon ball: +1 Mult per pin
  const nf = { kind: 'open', rolls: [roll({ ball: 'neonball', down: pins(4), pins: 4 })] };
  assert.strictEqual(GK.scoreFrame(nf, run).mult, 1 + 4);
  // Full Rack needs 13+ pins in the rack and a level
  run.levels.fullrack = 1;
  assert.strictEqual(GK.scoreFrame(Object.assign({ rackSize: 13 }, f), run).chips, base.chips + 30);
  assert.strictEqual(GK.scoreFrame(Object.assign({ rackSize: 12 }, f), run).chips, base.chips);
  // Weighted Pins: lead pins score double Points
  const lf = { kind: 'open', rolls: [roll({ down: pins(3, 'lead'), pins: 3 })] };
  assert.strictEqual(GK.scoreFrame(Object.assign({ weighted: true }, lf), run).chips, 2 * GK.scoreFrame(lf, run).chips);
});

test('v0.7 Black Market: every item can be used and does what it says', () => {
  const run = GK.newRun({ seed: 12 });
  run.bag.push({ type: 'feather', ed: null });
  const use = (id, target, inRound) => { run.cons = [id]; return GK.useCons(run, 0, target, inRound); };
  assert.ok(use('m_stolen_oil', 'shark').ok); assert.strictEqual(run.oilNext, 'shark');
  GK.startRound(run); assert.strictEqual(run.rs.oil, 'shark'); assert.strictEqual(GK.laneFor(run).oil, 'shark');
  const slots = run.maxCharms;
  assert.ok(use('m_fake_id', 'janitor').ok); assert.strictEqual(run.maxCharms, slots - 1);
  run.round = 2; assert.strictEqual(GK.bossFor(run), 'janitor'); run.round = 0;
  assert.ok(use('m_ball_swap', 1).ok); assert.ok(run.bag[1].borrowed);
  const lv = run.levels.spare || 0; assert.ok(use('m_bootleg', 'spare').ok); assert.strictEqual(run.levels.spare, lv + 3);
  assert.ok(use('m_hot_charm').ok); const hot = run.charms[run.charms.length - 1]; assert.strictEqual(hot.ed, 'neon'); assert.strictEqual(hot.expires, 2);
  const m = run.money, bags = run.bag.length; assert.ok(use('m_insurance').ok); assert.strictEqual(run.money, m + 20); assert.strictEqual(run.bag.length, bags - 1);
  assert.ok(use('m_fixed').ok); assert.strictEqual(run.fixed, run.alley);
  assert.ok(use('m_illegal_drill', 0).ok); assert.strictEqual(run.bag[0].drill, 'illegal');
  GK.startRound(run);
  assert.ok(use('m_weighted', null, true).ok); assert.ok(GK.frameRack(run, 0).filter(t => t !== 'none').every(t => t === 'lead'));
  run.rs.weighted = false;
  assert.ok(use('m_pin_thief', null, true).ok); assert.strictEqual(GK.frameRack(run, 0).filter(t => t !== 'none').length, 9);
  const g = run.rs.groove || 0; assert.ok(use('m_snake_oil', null, true).ok); assert.strictEqual(run.rs.groove, g + 3);
  assert.ok(use('m_blood_money', null, true).ok); assert.ok(run.shopSmall);
  assert.ok(use('m_smuggled', null, true).ok); assert.ok(run.bag[run.rs.smuggled]);
  assert.strictEqual(use('m_debt', null, true).ok, false, 'debt collector only works in a Boss Match');
});

test('v0.7 equipment and rules: flags and equipment mods combine', () => {
  const run = GK.newRun({ seed: 4 });
  run.equip = { shoes: 'spinning_shoes', gloves: 'rosin_bag', head: 'headband' };
  const eq = GK.equipMods(run);
  assert.strictEqual(eq.angRange, 1.4); assert.strictEqual(eq.posSlow, 1.25); assert.strictEqual(eq.groove, 1);
  run.members = ['season_ticket', 'mechanic_call'];
  run.charms = [GK.charmInst('second_return')];
  assert.strictEqual(GK.maxBag(run), run.maxBag + 1);
  assert.ok(GK.flags(run).noJam);
  GK.startRound(run);
  assert.strictEqual(run.rs.groove, 2, 'headband + season ticket');
});

test('Fourth Frame Ball: a strike in the last frame earns a bonus ball at a fresh rack', () => {
  const run = GK.newRun({ seed: 8 });
  run.charms = [GK.charmInst('fourth_ball')];
  GK.startRound(run);
  run.rs.frameIdx = run.rs.framesMax - 1;
  const prev = [GK.MISHAPS.respot, GK.MISHAPS.stuck]; GK.MISHAPS.respot = 0; GK.MISHAPS.stuck = 0;
  try {
    const sim = GK.beginFrame(run);
    sim.pins.forEach(p => { if (p.standing) { sim.topple(p, { x: 0, z: 1 }, 'ball'); p.counted = false; } });
    GK.launch(run, sim, 0, { aimX: 0, aim: 0, spin: 0, speed: 380 });
    sim.simulate();
    const out = GK.afterRoll(run, sim);
    assert.strictEqual(out.next, 'aim', 'bonus ball offered');
    assert.ok(run.rs.cur.bonusKind && GK.isStrikeKind(run.rs.cur.bonusKind));
    assert.strictEqual(sim.standing().length, 10, 'fresh rack');
    assert.strictEqual(GK.canRerack(run), false);
    GK.launch(run, sim, 0, { aimX: 2, aim: 0, spin: 0, speed: 380 });
    sim.simulate();
    const out2 = GK.afterRoll(run, sim);
    assert.strictEqual(out2.next, 'score'); assert.strictEqual(out2.kind, run.rs.cur.bonusKind);
    assert.strictEqual(run.rs.cur.rolls.length, 2);
  } finally { [GK.MISHAPS.respot, GK.MISHAPS.stuck] = prev; }
});

test('unlocks: most content starts locked, every locked item has a feat, themed feats fire', () => {
  const all = [...Object.keys(GK.BALLS).filter(k => k !== 'house').map(k => 'ball:' + k), ...GK.CHARM_LIST.map(c => 'charm:' + c.id),
    ...Object.keys(GK.EQUIP).map(k => 'equip:' + k), ...GK.CONS_LIST.map(c => 'cons:' + c.id)];
  const locked = all.filter(k => GK.LOCKED.has(k));
  assert.ok(locked.length > all.length * 0.6, 'most items are locked: ' + locked.length + '/' + all.length);
  for (const k of GK.LOCKED) assert.ok(k.startsWith('league:') || all.includes(k), 'unknown unlock ' + k);
  const seen = new Set(); GK.FEATS.forEach(f => f.unlocks.forEach(u => { assert.ok(!seen.has(u), 'unlocked twice: ' + u); seen.add(u); }));
  // the starter set still fills every shop slot type
  GK._meta = { feats: {} };
  try {
    for (const kind of ['card', 'trick', 'market']) assert.ok(GK.CONS_LIST.some(c => c.kind === kind && GK.isUnlocked('cons', c.id)), kind);
    assert.ok(Object.keys(GK.EQUIP).some(k => GK.isUnlocked('equip', k)));
    assert.ok(GK.CHARM_LIST.filter(c => GK.isUnlocked('charm', c.id)).length >= 15);
    const run = GK.newRun({ seed: 5 });
    const meta = GK._meta;
    const did = ev => GK.checkFeats(meta, Object.assign({ run }, ev)).map(f => f.id);
    assert.ok(did({ t: 'roll', notes: [{ t: 'stuck' }] }).includes('jammed'));
    assert.ok(GK.isUnlocked('charm', 'second_return') && GK.isUnlocked('cons', 'm_ball_swap'));
    const ctx = { rolls: [{ pins: 9, down: [] }, { pins: 1, down: [] }], pocket: false, maxHook: 0, throws: 2, leftOne: true, walls: 0, wobbles: 1, pins: 10, carry: 0, late: 0 };
    assert.ok(did({ t: 'frame', kind: 'spare', score: 100, ctx }).includes('sharpshooter'));
    run.bag = [{ type: 'house', ed: null, drill: 'strong' }];
    assert.ok(did({ t: 'shop' }).includes('custom'));
    assert.ok(GK.isUnlocked('cons', 'm_illegal_drill'));
    assert.strictEqual(GK.unlockProgress(meta).have, GK.FEATS.filter(f => meta.feats[f.id]).reduce((a, f) => a + f.unlocks.filter(u => !u.startsWith('league:')).length, 0));
  } finally { GK._meta = undefined; }
});

test('The Regulars: signature balls play like their owners and their feats are secret', () => {
  const sim = (type, prm) => { const s = new GK.Sim({ rng: GK.makeRng(3), lane: { oil: 'house' }, rack: GK.padRack(), wear: GK.newWear() }); s.launch({ type }, Object.assign({ aim: 0, spin: 0, speed: 400 }, prm), {}); let lift = 0; while (s.rolling) { s.step(); if (s.balls[0]) lift = Math.max(lift, s.balls[0].lift || 0); } return { r: s.summarize(), lift }; };
  // Quinn's Two-Hander hooks into the pocket from the outside boards with no hook on the dial
  const q = sim('twohander', { aimX: 17 }).r;
  assert.ok(q.pocket && q.pins >= 9, 'two-hander finds the pocket: ' + JSON.stringify(q.pins));
  assert.ok(!sim('house', { aimX: 16 }).r.pocket, 'a house ball from out there does not');
  // Levi's Loft Duck flies, then lands with a thud
  const l = sim('loftduck', { aimX: 2, spin: 0.8 });
  assert.ok(l.lift > 10 && l.r.thuds === 1);
  // Kaleb's Wide Swing: points per board crossed
  const run = GK.newRun({ seed: 2 });
  const f = { kind: 'open', rolls: [roll({ ball: 'wideswing', down: pins(5), pins: 5, boards: 26 })] };
  const base = GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(5), pins: 5, boards: 26 })] }, run);
  const ws = GK.scoreFrame(f, run);
  assert.strictEqual(ws.chips, base.chips + 130); assert.ok(Math.abs(ws.mult - base.mult * 1.5) < 1e-9);
  for (const t of ['twohander', 'loftduck', 'wideswing']) assert.ok(/Quinn|Levi|Kaleb/.test(GK.BALLS[t].full + GK.BALLS[t].desc));
  // The Regulars charm: ×1.5 per signature ball in the bag
  run.bag = [{ type: 'twohander' }, { type: 'loftduck' }, { type: 'house' }];
  run.charms = [GK.charmInst('regulars')];
  assert.ok(Math.abs(GK.scoreFrame({ kind: 'open', rolls: [roll({ down: pins(5), pins: 5 })] }, run).mult - 2.25) < 1e-9);
  // secret feats
  const meta = { feats: {} };
  const ctx = r0 => ({ rolls: [Object.assign({ pins: 10, down: [], lhw: GK.C.LHW }, r0)], maxHook: 0.1, throws: 1, pins: 10 });
  const fire = (r0, extra) => GK.checkFeats(meta, Object.assign({ t: 'frame', kind: 'strike', score: 10, ctx: Object.assign(ctx(r0), extra || {}), run }));
  assert.ok(fire({ startX: 16 }).some(x => x.id === 'quinn'));
  assert.ok(fire({ power: 0.97 }).some(x => x.id === 'levi'));
  const last = fire({ boards: 22 }).map(x => x.id);
  assert.ok(last.includes('kaleb') && last.includes('regulars'), 'all three earn The Regulars: ' + last);
  for (const id of ['quinn', 'levi', 'kaleb', 'regulars']) assert.ok(GK.FEATS.find(x => x.id === id).secret);
});

test('v1.0 boss trophies: 3 per boss, their own shelf, flags and scoring', () => {
  const bosses = Object.keys(GK.BOSSES).filter(b => b !== 'champion');
  for (const b of bosses) assert.strictEqual(Object.values(GK.TROPHIES).filter(t => t.boss === b).length, 3, b);
  const run = GK.newRun({ seed: 6 });
  const slots = run.maxCharms;
  assert.deepStrictEqual(GK.trophyChoices(run, 'king').sort(), ['scepter', 'stolen_crown', 'throne']);
  GK.takeTrophy(run, 'stolen_crown');
  assert.strictEqual(run.maxCharms, slots + 1, 'the Stolen Crown adds a charm slot');
  assert.ok(!GK.trophyChoices(run, 'king').includes('stolen_crown'));
  GK.takeTrophy(run, 'master_key'); GK.takeTrophy(run, 'frost_boots');
  assert.strictEqual(run.charms.length, 0, 'trophies never use charm slots');
  assert.strictEqual(GK.flags(run).reracks, GK.flags(GK.newRun({ seed: 6 })).reracks + 1);
  assert.ok(Math.abs(GK.equipMods(run).zone - GK.equipMods(GK.newRun({ seed: 6 })).zone * 1.2) < 1e-9);
  run.trophies.push({ id: 'snowman_head' });
  const f = { kind: 'strike', rolls: [roll({ down: pins(10), pins: 10 })] };
  const base = GK.scoreFrame(f, GK.newRun({ seed: 6 }));
  assert.strictEqual(GK.scoreFrame(f, run).mult, base.mult + 6);
});

test('v1.0 charm evolution: progress, evolved form, description', () => {
  const run = GK.newRun({ seed: 7 });
  run.charms = [GK.charmInst('strike_out')];
  const ctx = { kind: 'strike', pins: 10, carry: 0, perfects: 0, misses: 0, firstPin: 1, lastFrame: false };
  for (let i = 0; i < 4; i++) assert.strictEqual(GK.evolveCharms(ctx, run).length, 0);
  assert.ok(/Strike Force: Roll 5 Strikes \(4\/5\)/.test(GK.charmDesc(run.charms[0])));
  const ev = GK.evolveCharms(ctx, run);
  assert.strictEqual(ev.length, 1); assert.ok(run.charms[0].evolved);
  assert.strictEqual(GK.charmName(run.charms[0]), 'Strike Force');
  const f = { kind: 'strike', rolls: [roll({ down: pins(10), pins: 10 })] };
  assert.strictEqual(GK.scoreFrame(f, run).mult, GK.scoreFrame(f, GK.newRun({ seed: 7 })).mult + 10);
});

test('v1.0 overkill, bonus balls and jackpot', () => {
  assert.strictEqual(GK.overkill({ total: 100, target: 100 }), null);
  assert.strictEqual(GK.overkill({ total: 160, target: 100 }).tier, 1);
  assert.strictEqual(GK.overkill({ total: 350, target: 100 }).tier, 3);
  assert.strictEqual(GK.bonusPay(3), 0); assert.strictEqual(GK.bonusPay(8), 2); assert.strictEqual(GK.bonusPay(10), 3);
  const run = GK.newRun({ seed: 9 });
  GK.startRound(run);
  run.rs.frameIdx = 1;
  assert.strictEqual(GK.bonusCount(run), 3);
  const s = GK.bonusSim(run, 0);
  assert.ok(s.pins.every(p => p.type === 'gold'));
  GK.bonusLaunch(run, s, 0, { aimX: 3, aim: 0, spin: 0.15, speed: 400 });
  s.simulate();
  const r = GK.bonusResult(run, s);
  assert.strictEqual(run.rs.bonusPay, GK.bonusPay(r.pins));
  assert.ok(GK.payout(run).some(l => /Bonus balls/.test(l.label)));
  // jackpot pin shows up when forced, and the spin always pays something
  const prev = GK.JACKPOT_CHANCE; GK.JACKPOT_CHANCE = 1;
  try { assert.ok(GK.frameRack(run, 2).includes('jackpot')); } finally { GK.JACKPOT_CHANCE = prev; }
  const m0 = run.money, c0 = run.cons.length, h0 = run.charms.length;
  const sp = GK.jackpotSpin(run);
  assert.strictEqual(sp.reels.length, 3);
  assert.ok(run.money > m0 || run.cons.length > c0 || run.charms.length > h0);
});

test('v1.0 the Regulars drop by: gifts, dares and tips', () => {
  const run = GK.newRun({ seed: 10 });
  for (let i = 0; i < 30; i++) {
    const ev = Object.assign({ id: 'regular' }, GK.regularVisit(run, GK.makeRng(i + 1)));
    assert.ok(['quinn', 'kaleb', 'levi'].includes(ev.who) && ev.say && ev.take);
    assert.ok(GK.takeEvent(run, ev).ok);
  }
  run.dare = { who: 'levi', pay: 10 };
  const m = run.money;
  assert.ok(GK.settleDare(run, 'strike').won); assert.strictEqual(run.money, m + 10); assert.strictEqual(run.dare, null);
  run.grooveNext = 2; GK.startRound(run);
  assert.ok(run.rs.groove >= 2 && run.grooveNext === 0);
});

test('v1.0 progress: XP, levels, cosmetics, collection and the Regulars board', () => {
  assert.strictEqual(GK.levelOf(0).level, 1);
  assert.strictEqual(GK.levelOf(GK.xpStep(1)).level, 2);
  assert.strictEqual(GK.levelOf(1e9).level, GK.MAX_LEVEL);
  const meta = { xp: 0 };
  const res = GK.addXP(meta, GK.xpStep(1) + GK.xpStep(2));
  assert.strictEqual(res.to, 3); assert.ok(res.unlocked.length >= 1);
  assert.ok(GK.COSMETICS.length >= 40);
  for (const k of Object.keys(GK.COSMETIC_KINDS)) assert.ok(GK.COSMETICS.some(c => c.kind === k && c.level === 1), 'a default ' + k);
  // pin skins keep special pins readable: light bodies only
  for (const c of GK.COSMETICS.filter(c => c.kind === 'pins')) { const n = parseInt(c.body.slice(1), 16); assert.ok(((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3 > 200, c.id); }
  const run = GK.newRun({ seed: 11 });
  run.stats.frames = 10; run.stats.strikes = 2; run.history = [{ won: true, round: 0 }, { won: true, round: 2 }];
  assert.strictEqual(GK.runXP(run).total, 20 + 6 + 30 + 25);
  const m2 = {};
  assert.ok(GK.markSeen(m2, run));
  assert.ok(GK.collectionProgress(m2).have > 0);
  const beat = GK.beatRegulars(m2, 30000);
  assert.deepStrictEqual(beat.map(r => r.who), ['kaleb', 'levi']);
  assert.strictEqual(GK.beatRegulars(m2, 30000).length, 0, 'each regular is beaten once');
});
