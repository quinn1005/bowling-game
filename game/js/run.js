// Gutter Kings — run state: rounds, targets, economy, shop, inventory, consumables, saves.
// Pure logic (no DOM) so it can be tested headless. The run object is plain JSON for saving.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const SAVE_KEY = 'gk-run-v1', META_KEY = 'gk-meta-v1';
  GK.ALLEY_COUNT = GK.ALLEYS.length;

  GK.newRun = function ({ seed, bag = 'classic', daily = false, league = 'open', asc = 0 } = {}) {
    seed = (seed == null ? (Date.now() ^ (Math.random() * 0xffffffff)) : seed) >>> 0;
    const sb = GK.STARTER_BAGS.find(b => b.id === bag) || GK.STARTER_BAGS[0];
    const run = {
      v: 1, seed, daily, bagId: sb.id, league: GK.LEAGUES && GK.LEAGUES[league] ? league : 'open', asc: Math.max(0, asc | 0),
      alley: 0, round: 0, money: 4 + (sb.money || 0),
      bag: sb.balls.map(type => ({ type, ed: null })), maxBag: 3,
      charms: [], maxCharms: 5, cons: [], maxCons: 2, trophies: [],
      rack: GK.padRack(), levels: {}, members: [], equip: {},
      stats: { pins: 0, strikes: 0, spares: 0, splits: 0, gutters: 0, frames: 0, bestFrame: 0, throws: 0, score: 0, perfects: 0, pstreak: 0, bestPStreak: 0 },
      history: [], best: null, bosses: GK.pickBosses(seed), tags: [], practice: false, endless: false,
      nextTargetMul: 1, shopCount: 0, memberOffer: null, memberAlley: -1,
      phase: 'intro', rs: null, shop: null, over: false, won: false
    };
    return run;
  };

  // Alleys 0-7, then the Championship (index 8). Endless mode continues past it (9, 10, ...),
  // cycling the 8 alleys with targets that keep growing.
  GK.isChamp = run => run.alley === GK.ALLEY_COUNT;
  GK.isEndless = run => run.alley > GK.ALLEY_COUNT;
  GK.baseAlley = run => GK.isEndless(run) ? (run.alley - GK.ALLEY_COUNT - 1) % GK.ALLEY_COUNT : run.alley;
  GK.alleyDef = function (run) {
    if (GK.isChamp(run)) return GK.CHAMPIONSHIP;
    const a = GK.ALLEYS[GK.baseAlley(run)];
    if (!GK.isEndless(run)) return a;
    return Object.assign({}, a, { name: 'Endless ' + (run.alley - GK.ALLEY_COUNT) + ': ' + a.name });
  };
  GK.roundName = run => GK.isChamp(run) ? 'Championship' : GK.ROUND_NAMES[run.round];
  GK.isBoss = run => GK.isChamp(run) || run.round === 2;
  // One boss per alley is picked when the run starts.
  GK.pickBosses = function (seed) {
    const rng = GK.stream(seed, 'bosses');
    return GK.ALLEYS.map(a => a.bosses[rng.int(a.bosses.length)]);
  };
  GK.bossFor = run => GK.isChamp(run) ? 'champion' : (run.bossOverride && run.bossOverride.alley === run.alley) ? run.bossOverride.id : (run.bosses || GK.pickBosses(run.seed))[GK.baseAlley(run)];
  GK.bossId = run => GK.isBoss(run) ? GK.bossFor(run) : null;
  GK.bossDef = run => GK.BOSSES[GK.bossFor(run)];
  // v1.0 rebalance: trophies, bonus balls and evolutions make later alleys stronger, so targets
  // climb a little faster alley by alley. Tuned with tests/bot.js.
  GK.ALLEY_SCALE = [1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5];
  GK.CHAMP_SCALE = 2.5;
  GK.roundTarget = function (run) {
    const ru = GK.rules(run);
    if (GK.isChamp(run)) return Math.round(GK.CHAMPIONSHIP.target * GK.CHAMP_SCALE * run.nextTargetMul * ru.target * ru.bossTarget / 50) * 50;
    let t;
    if (GK.isEndless(run)) { const E = GK.ENDLESS_TARGET || { base: 0.6, growth: 1.7 }; t = GK.CHAMPIONSHIP.target * E.base * Math.pow(E.growth, run.alley - GK.ALLEY_COUNT - 1) * GK.ROUND_MULT[run.round]; }
    else t = GK.ALLEYS[run.alley].base * GK.ROUND_MULT[run.round] * GK.ALLEY_SCALE[run.alley];
    t *= run.nextTargetMul * ru.target * (run.round === 2 ? ru.bossTarget : 1);
    return Math.round(t / 50) * 50;
  };

  // Passive rule changes from charms and memberships.
  GK.flags = function (run, stolen) {
    const f = { frames: 0, reracks: 0, bumpers: false, wide: 1, wild: false, retake: false, third: false, debt: 0, interestCap: 4, discount: 0, rerollOff: 0 };
    const sources = (run.charms || []).map((c, i) => {
      if (stolen === i) return null;
      let def = GK.CHARMS[c.id];
      if (def.copy) { const nb = run.charms[i + 1]; def = nb && stolen !== i + 1 && !GK.CHARMS[nb.id].copy ? GK.CHARMS[nb.id] : null; }
      return def;
    }).concat((run.trophies || []).map(t => GK.TROPHIES[t.id]));
    sources.forEach(def => {
      const fl = def && def.flags; if (!fl) return;
      if (fl.frames) f.frames += fl.frames;
      if (fl.reracks) f.reracks += fl.reracks;
      if (fl.bumpers) f.bumpers = true;
      if (fl.wide) f.wide = Math.max(f.wide, fl.wide);
      if (fl.wild) f.wild = true;
      if (fl.retake) f.retake = true;
      if (fl.third) f.third = true;
      if (fl.debt) f.debt = Math.max(f.debt, fl.debt);
      // everything else: booleans switch on, numbers add up
      for (const [k, v] of Object.entries(fl)) {
        if (['frames', 'reracks', 'bumpers', 'wide', 'wild', 'retake', 'third', 'debt'].includes(k)) continue;
        if (v === true) f[k] = true; else if (typeof v === 'number') f[k] = (f[k] || 0) + v;
      }
    });
    Object.values(run.equip || {}).forEach(id => { const e = GK.EQUIP[id]; if (e && e.reracks) f.reracks += e.reracks; });
    const m = run.members || [];
    if (m.includes('reservation')) f.frames++;
    if (m.includes('oil_pass')) f.reracks++;
    if (m.includes('rewards')) f.interestCap = 8;
    if (m.includes('clearance')) f.discount = 0.25;
    if (m.includes('reroll_club')) f.rerollOff = 2;
    if (m.includes('mechanic_call')) f.noJam = true;
    if (m.includes('season_ticket')) f.grooveStart = (f.grooveStart || 0) + 1;
    if (m.includes('vip_lounge')) f.vip = true;
    const ru = GK.rules(run);
    f.frames += ru.frames; f.reracks += ru.reracks;
    f.interestCap = Math.min(f.interestCap, ru.interestCap);
    if (ru.bumpers) f.bumpers = true;
    f.priceDelta = ru.priceDelta;
    return f;
  };
  GK.equipMods = function (run) {
    const m = { hook: 1, speed: 1, aim: 1, bar: 1, dial: 1, zone: 1, angRange: 1, angSpeed: 1, posSlow: 1, groove: 0, noWobble: false };
    const MUL = ['speed', 'aim', 'bar', 'dial', 'zone', 'angRange', 'angSpeed', 'posSlow'];
    Object.values(run.equip || {}).map(id => GK.EQUIP[id]).concat((run.trophies || []).map(t => (GK.TROPHIES[t.id] || {}).eq)).forEach(e => {
      if (!e) return;
      for (const [k, v] of Object.entries(e)) {
        if (MUL.includes(k)) m[k] *= v; else if (k === 'groove') m.groove += v; else if (v === true) m[k] = true;
      }
    });
    const ru = GK.rules(run);
    m.bar *= ru.bar; m.dial *= ru.bar; m.zone *= ru.zone; m.speed *= ru.speed;
    return m;
  };
  GK.maxBag = run => run.maxBag + (GK.flags(run).bagPlus || 0);
  GK.canAfford = (run, price) => run.money - price >= -GK.flags(run).debt;

  // Most valuable charm (by cost, then rarity) – the Gutter King steals it.
  GK.mostValuableCharm = function (run) {
    let best = -1, bv = -1;
    run.charms.forEach((c, i) => { const d = GK.CHARMS[c.id]; const v = d.cost * 10 + (c.ed ? 5 : 0); if (v > bv) { bv = v; best = i; } });
    return best;
  };

  // ---------- rounds ----------
  GK.startRound = function (run) {
    const boss = GK.bossId(run);
    const stolen = (boss === 'king' || boss === 'champion') ? GK.mostValuableCharm(run) : -1;
    const fl = GK.flags(run, stolen);
    const framesMax = GK.C.FRAMES + fl.frames;
    const rs = {
      target: GK.roundTarget(run), total: 0, frames: [], frameIdx: 0, streak: 0, groove: 0, wear: GK.newWear(), stuck: null,
      framesMax, reracks: GK.C.RERACKS + fl.reracks, stolen, loadedNext: false,
      boss, tilts: [], king: null, kingTotal: 0
    };
    const eq = GK.equipMods(run);
    rs.groove = (eq.groove || 0) + (fl.grooveStart || 0) + (run.grooveNext || 0);
    run.grooveNext = 0;
    if (run.oilNext) { rs.oil = run.oilNext; run.oilNext = null; }
    if (boss && run.fixed === run.alley) { rs.target = Math.round(rs.target * 0.6 / 50) * 50; rs.fixed = true; }
    run.nextTargetMul = 1;
    if (run.loadedPending) { rs.loadedNext = true; run.loadedPending = false; }
    const rng = GK.stream(run.seed, 'round:' + run.alley + ':' + run.round);
    if (boss === 'ringmaster' || boss === 'strongman') for (let i = 0; i < 12; i++) rs.tilts.push((rng() < 0.5 ? -1 : 1) * (12 + rng() * 12));
    rs.reracksStart = rs.reracks;
    const lane = GK.alleyDef(run).lane || {};
    if (lane.holeCount) rs.holes = GK.makeHoles(run, lane.holeCount, 'start');
    if (boss === 'banshee') rs.charmOrder = run.charms.slice();
    if (boss === 'echo') rs.echo = Math.round((run.lastBest || 0) * 0.8);
    if (boss === 'hollow') {
      // The Hollow King takes the two most valuable charms and a trophy until the match ends.
      const taken = [];
      for (let k = 0; k < 2 && run.charms.length; k++) { const i = GK.mostValuableCharm(run); taken.push(run.charms.splice(i, 1)[0]); }
      rs.hollow = { charms: taken, trophy: (run.trophies || []).length ? run.trophies.splice(rng.int(run.trophies.length), 1)[0] : null };
    }
    if (boss === 'champion') {
      // The King's frames: pre-rolled so the match is fair and replayable from the seed.
      const w = []; for (let i = 0; i < framesMax; i++) w.push(0.6 + rng() * 0.9);
      const tot = w.reduce((a, b) => a + b, 0);
      rs.king = w.map(x => Math.round(rs.target * x / tot / 10) * 10);
      rs.kingTotal = rs.king.reduce((a, b) => a + b, 0);
      rs.target = rs.kingTotal + 1;
    }
    run.rs = rs; run.phase = 'round';
    return rs;
  };

  // End-of-round payout breakdown (applied by applyPayout).
  const fmtX = r => '×' + (Math.floor(r * 10) / 10);
  GK.payout = function (run) {
    const rs = run.rs, fl = GK.flags(run, rs ? rs.stolen : -1);
    const lines = [];
    if (!GK.isChamp(run)) lines.push({ label: GK.roundName(run) + ' cleared' + (rs && rs.fixed ? ' (fixed: no pay)' : ''), v: rs && rs.fixed ? 0 : GK.ROUND_PAY[run.round] });
    const ru = GK.rules(run);
    if (ru.pay) lines.push({ label: GK.LEAGUES[run.league].name, v: ru.pay });
    const unused = rs ? Math.max(0, rs.framesMax - rs.frameIdx) : 0;
    if (rs && rs.bonusThrown) lines.push({ label: 'Bonus balls: ' + rs.bonusPins + ' gold pins', v: rs.bonusPay || 0 });
    else if (unused) lines.push({ label: unused + ' unused frame' + (unused > 1 ? 's' : ''), v: unused });
    const ok = GK.overkill(rs);
    if (ok && !run.practice) lines.push({ label: ok.label + ' (' + fmtX(rs.total / rs.target) + ' the target)', v: ok.v });
    (run.trophies || []).forEach(t => { const d = GK.TROPHIES[t.id]; if (d && d.round) { const v = d.round(run, t); if (v) lines.push({ label: d.name + ' (trophy)', v }); } });
    run.charms.forEach((c, i) => {
      if (rs && rs.stolen === i) return;
      const d = GK.CHARMS[c.id]; if (d.round) { const v = d.round(run, c); if (v) lines.push({ label: d.name, v }); }
    });
    const interest = Math.min(fl.interestCap, Math.floor(Math.max(0, run.money) / 5));
    if (interest) lines.push({ label: 'Interest ($1 per $5, max $' + fl.interestCap + ')', v: interest });
    return lines;
  };
  GK.applyPayout = function (run, lines) { lines.forEach(l => { run.money += l.v; }); };

  GK.endRoundCleanup = function (run) {
    const rs = run.rs; if (!rs) return;
    if (rs.hollow) { run.charms.push(...rs.hollow.charms); if (rs.hollow.trophy) run.trophies.push(rs.hollow.trophy); rs.hollow = null; }
    if (rs.charmOrder) { const keep = rs.charmOrder.filter(c => run.charms.includes(c)); run.charms = keep.concat(run.charms.filter(c => !keep.includes(c))); rs.charmOrder = null; }
    if (rs.bestFrame) run.lastBest = rs.bestFrame;
  };
  // After a won round: move on. Returns 'shop' | 'won'.
  GK.advance = function (run) {
    // round-reset scaling charms
    const wasBoss = GK.isBoss(run), oldAlley = run.alley;
    GK.endRoundCleanup(run);
    run.charms.forEach(c => { const d = GK.CHARMS[c.id]; if (d.roundReset) { c.v = 0; if (c.p != null) c.p = 0; } if (d.roundWin) d.roundWin(c, wasBoss); });
    // Hot Charms burn out
    run.charms = run.charms.filter(c => c.expires == null || --c.expires > 0);
    if (wasBoss && run.fixed === oldAlley) run.fixed = null;
    if (GK.isChamp(run) && !run.endless) { run.won = true; run.phase = 'won'; return 'won'; }
    run.round++;
    if (run.round > 2) { run.round = 0; run.alley++; }
    run.betNotes = GK.settleBets ? GK.settleBets(run, wasBoss, oldAlley) : [];
    if (run.alley !== oldAlley && run.fakeIdSlot) { run.maxCharms++; run.fakeIdSlot = false; run.bossOverride = null; }
    run.phase = 'shop';
    return 'shop';
  };

  // ---------- inventory ----------
  GK.charmInst = (id, ed) => Object.assign({ id, ed: ed || null }, JSON.parse(JSON.stringify(GK.CHARMS[id].init || {})));
  GK.sellValue = item => Math.max(1, Math.floor(item.cost / 2) + (item.ed ? 1 : 0));
  // Resale Shop: everything sells at full price. Bake Sale: +$2 per round kept.
  const resale = () => GK._run && GK.flags(GK._run).resale;
  GK.charmSell = c => c.corrupt ? 0 : (resale() ? GK.CHARMS[c.id].cost + (c.ed ? 2 : 0) : GK.sellValue({ cost: GK.CHARMS[c.id].cost, ed: c.ed })) + (c.id === 'bake_sale' ? 2 * (c.v || 0) : 0);
  GK.ballSell = b => resale() ? GK.BALLS[b.type].cost + (b.ed ? 2 : 0) : GK.sellValue({ cost: GK.BALLS[b.type].cost, ed: b.ed });
  GK.consSell = id => resale() ? GK.CONS[id].cost : Math.max(1, Math.floor(GK.CONS[id].cost / 2));

  GK.charmDesc = function (c) {
    const d = GK.charmDef ? GK.charmDef(c) : GK.CHARMS[c.id];
    let s = d.desc.replace('{v}', GK.fmt(c.v || 0)).replace('{s}', GK.charmSell(c));
    if (c.expires) s += ' Burns out in ' + c.expires + ' round' + (c.expires > 1 ? 's' : '') + '.';
    if (s.includes('{x}')) s = s.replace('{x}', d.show ? d.show(c) : '1');
    const E = GK.EVOLVE && GK.EVOLVE[c.id];
    if (c.corrupt) s = 'CORRUPTED: triggers twice every frame, but costs $1 a frame and sells for nothing. ' + s;
    if (E && c.evolved) s = 'EVOLVED from ' + GK.CHARMS[c.id].name + '. ' + s;
    else if (E) s += ' Evolves into ' + E.name + ': ' + E.need + ' (' + Math.min(E.n, c.evo || 0) + '/' + E.n + ').';
    return s;
  };

  // ---------- shop ----------
  function weightedRarity(rng) {
    const r = rng() * 100;
    return r < GK.RARITY.common.w ? 'common' : r < GK.RARITY.common.w + GK.RARITY.uncommon.w ? 'uncommon' : 'rare';
  }
  function rollEdition(rng, boost = 1) {
    const r = rng();
    if (r < 0.02 * boost) return 'neon';
    if (r < 0.07 * boost) return 'holo';
    if (r < 0.15 * boost) return 'foil';
    return null;
  }
  GK.price = function (run, base, ed) {
    const fl = GK.flags(run);
    const p = base + (ed === 'foil' ? 2 : ed === 'holo' ? 3 : ed === 'neon' ? 5 : 0) + (fl.priceDelta || 0);
    return Math.max(1, Math.round(p * (1 - fl.discount)));
  };
  function pickCharm(run, rng, exclude) {
    const owned = new Set(run.charms.map(c => c.id).concat(exclude));
    for (let t = 0; t < 30; t++) {
      const rar = weightedRarity(rng);
      const pool = GK.CHARM_LIST.filter(c => c.rarity === rar && !owned.has(c.id) && GK.isUnlocked('charm', c.id));
      if (pool.length) return rng.pick(pool).id;
    }
    const pool = GK.CHARM_LIST.filter(c => !owned.has(c.id) && GK.isUnlocked('charm', c.id));
    return pool.length ? rng.pick(pool).id : null;
  }
  function pickBall(run, rng, exclude) {
    const owned = new Set(run.bag.map(b => b.type).concat(exclude));
    const pool = Object.keys(GK.BALLS).filter(k => k !== 'house' && !owned.has(k) && GK.isUnlocked('ball', k));
    return pool.length ? rng.pick(pool) : null;
  }
  function pickGood(run, rng, exclude) {
    const r = rng();
    if (r < 0.1) {
      const pool = Object.keys(GK.EQUIP).filter(k => !Object.values(run.equip).includes(k) && !exclude.includes(k) && GK.isUnlocked('equip', k));
      if (pool.length) { const id = rng.pick(pool); return { kind: 'equip', id, price: GK.price(run, GK.EQUIP[id].cost) }; }
    }
    let kind = r < 0.5 ? 'card' : r < 0.88 ? 'trick' : 'market';
    const pool = GK.CONS_LIST.filter(k => k.kind === kind && !exclude.includes(k.id) && GK.isUnlocked('cons', k.id));
    const k = rng.pick(pool);
    return { kind: 'cons', id: k.id, price: GK.price(run, k.cost) };
  }
  GK.rollShop = function (run, rng, keepMember) {
    const shop = { items: [], rerolls: run.shop && keepMember ? run.shop.rerolls : 0, member: null };
    const ex = [];
    for (let i = 0; i < 2; i++) {
      const id = pickCharm(run, rng, ex); if (!id) continue; ex.push(id);
      const ed = rollEdition(rng);
      shop.items.push({ kind: 'charm', id, ed, price: GK.price(run, GK.CHARMS[id].cost, ed) });
    }
    const b = pickBall(run, rng, []);
    if (b) { const ed = rollEdition(rng, 0.7); shop.items.push({ kind: 'ball', id: b, ed, price: GK.price(run, GK.BALLS[b].cost, ed) }); }
    const gx = [];
    for (let i = 0; i < 2 + (GK.flags(run).shopExtra || 0); i++) { const g = pickGood(run, rng, gx); gx.push(g.id); shop.items.push(g); }
    // endless shops sometimes sell a corrupted charm
    if (GK.isEndless(run)) shop.items.forEach(it => { if (it.kind === 'charm' && rng() < GK.CORRUPT_CHANCE) { it.corrupt = true; it.price = Math.max(1, Math.round(it.price * 0.75)); } });
    // One membership offer per alley; it stays until bought.
    if (run.memberAlley !== run.alley) {
      const pool = Object.keys(GK.MEMBERSHIPS).filter(k => !run.members.includes(k));
      run.memberOffer = pool.length ? rng.pick(pool) : null; run.memberAlley = run.alley;
    }
    shop.member = run.memberOffer;
    return shop;
  };
  GK.openShop = function (run) {
    run.shopCount++;
    const rng = GK.stream(run.seed, 'shop:' + run.shopCount);
    run.shop = GK.rollShop(run, rng, false);
    run.shop.rerolls = 0;
    if (run.shopSmall) { run.shop.items = run.shop.items.slice(0, 2); run.shopSmall = false; }
    if (run.saleNext) { run.shop.items = run.shop.items.slice(0, 3); run.shop.items.forEach(it => { it.price = Math.max(1, Math.ceil(it.price / 2)); }); run.shop.sale = true; run.saleNext = false; }
    run.phase = 'shop';
    return run.shop;
  };
  const tokenCharm = run => run.charms.find(c => c.id === 'arcade' && (c.v || 0) >= 3);
  GK.rerollCost = run => {
    const fl = GK.flags(run);
    if (fl.freeReroll && run.shop && !run.shop.rerolls) return 0;
    if (tokenCharm(run)) return 0;
    return Math.max(1, 6 + (run.shop ? run.shop.rerolls : 0) * 2 - fl.rerollOff);
  };
  GK.reroll = function (run) {
    const cost = GK.rerollCost(run);
    if (!GK.canAfford(run, cost)) return { ok: false, msg: 'Not enough money' };
    if (cost === 0 && !(GK.flags(run).freeReroll && !run.shop.rerolls)) { const t = tokenCharm(run); if (t) t.v -= 3; }
    run.money -= cost;
    const n = (run.shop.rerolls || 0) + 1;
    const rng = GK.stream(run.seed, 'shop:' + run.shopCount + ':r' + n);
    run.shop = GK.rollShop(run, rng, true);
    run.shop.rerolls = n;
    return { ok: true };
  };

  // Buy shop item i. For balls with a full bag pass replaceIdx.
  GK.buy = function (run, i, replaceIdx) {
    const it = run.shop.items[i];
    if (!it || it.sold) return { ok: false, msg: 'Sold out' };
    if (!GK.canAfford(run, it.price)) return { ok: false, msg: 'Not enough money' };
    if (it.kind === 'charm') {
      if (run.charms.length >= run.maxCharms) return { ok: false, msg: 'Charm slots full. Sell one first.' };
      const inst = GK.charmInst(it.id, it.ed); if (it.corrupt) inst.corrupt = true;
      run.charms.push(inst);
    } else if (it.kind === 'ball') {
      if (run.bag.length >= GK.maxBag(run)) {
        if (replaceIdx == null) return { ok: false, need: 'replace', msg: 'Bag is full. Pick a ball to swap out.' };
        run.bag.splice(replaceIdx, 1, { type: it.id, ed: it.ed });
      } else run.bag.push({ type: it.id, ed: it.ed });
    } else if (it.kind === 'cons') {
      if (run.cons.length >= run.maxCons) return { ok: false, msg: 'Consumable slots full. Use or sell one first.' };
      run.cons.push(it.id);
    } else if (it.kind === 'equip') {
      run.equip[GK.EQUIP[it.id].slot] = it.id;
    }
    run.money -= it.price; it.sold = true; run.shop.bought = (run.shop.bought || 0) + 1;
    return { ok: true };
  };
  GK.buyMember = function (run) {
    const id = run.shop && run.shop.member; if (!id) return { ok: false, msg: 'Nothing on offer' };
    const price = GK.price(run, GK.MEMBERSHIPS[id].cost);
    if (!GK.canAfford(run, price)) return { ok: false, msg: 'Not enough money' };
    run.money -= price; run.members.push(id); run.shop.member = null; run.memberOffer = null;
    if (id === 'gold_card') run.maxCharms++;
    if (id === 'locker') run.maxCons++;
    if (id === 'pro_bag') run.maxBag++;
    return { ok: true };
  };
  GK.sellCharm = function (run, i) { const c = run.charms[i]; if (!c) return; GK._run = run; run.money += GK.charmSell(c); run.charms.splice(i, 1); };
  GK.sellCons = function (run, i) { const id = run.cons[i]; if (!id) return; GK._run = run; run.money += GK.consSell(id); run.cons.splice(i, 1); };
  GK.sellBall = function (run, i) {
    if (run.bag.length <= 1) return { ok: false, msg: 'You need at least one ball.' };
    const b = run.bag[i]; GK._run = run; run.money += GK.ballSell(b); run.bag.splice(i, 1); return { ok: true };
  };
  GK.moveCharm = function (run, i, d) {
    const j = i + d; if (j < 0 || j >= run.charms.length) return;
    [run.charms[i], run.charms[j]] = [run.charms[j], run.charms[i]];
  };

  // ---------- consumables ----------
  // target: pin numbers array | ball index | null. inRound: whether a round is in progress.
  GK.consNeeds = id => GK.CONS[id].target;
  GK.useCons = function (run, i, target, inRound) {
    const id = run.cons[i], k = GK.CONS[id];
    if (!k) return { ok: false };
    if (k.inRound && !inRound) return { ok: false, msg: 'Use this during a round.' };
    const rng = GK.stream(run.seed, 'cons:' + run.stats.throws + ':' + run.shopCount + ':' + i + ':' + run.money);
    let msg = '';
    if (k.kind === 'card') {
      run.levels[k.shot] = (run.levels[k.shot] || 0) + 1;
      msg = GK.SHOTS[k.shot].name + ' is now Lv.' + (run.levels[k.shot] + 1);
    } else if (k.target === 'pin') {
      if (!Array.isArray(target) || !target.length) return { ok: false, msg: 'Pick pins first.' };
      if (k.pinType === 'none' && run.rack.filter(t => t !== 'none').length <= 1) return { ok: false, msg: 'You need at least one pin.' };
      run.rack = GK.padRack(run.rack);
      const picks = target.slice(0, k.picks);
      if (k.backRow ? picks.some(n => n < 11 || run.rack[n - 1] !== 'none') : picks.some(n => run.rack[n - 1] === 'none')) return { ok: false, msg: k.backRow ? 'Pick an empty back-row spot (11-15).' : 'Pick spots that have a pin.' };
      picks.forEach(n => { run.rack[n - 1] = k.pinType; });
      if (k.backRow) msg = 'Pin ' + picks[0] + ' added to your rack';
      else msg = k.pinType === 'none' ? 'Pin ' + target[0] + ' erased' : 'Pins ' + target.slice(0, k.picks).join(' & ') + ' are now ' + GK.PINS[k.pinType].name + 's';
    } else if (k.target === 'ball' && k.edition) {
      const b = run.bag[target]; if (!b) return { ok: false, msg: 'Pick a ball first.' };
      b.ed = k.edition; msg = GK.BALLS[b.type].full + ' is now ' + GK.EDITIONS[k.edition].name;
    } else if (id === 't_frame') { run.rs.framesMax++; msg = '+1 Frame this round'; }
    else if (id === 't_rerack') { run.rs.reracks++; msg = '+1 Re-rack this round'; }
    else if (id === 'm_bribe') {
      if (run.rs.framesMax - run.rs.frameIdx <= 1) return { ok: false, msg: 'Not enough frames left to bribe.' };
      run.rs.target = Math.round(run.rs.target * 0.75); run.rs.framesMax--; msg = 'Target cut to ' + GK.fmt(run.rs.target);
    } else if (id === 'm_loaded') {
      if (inRound) run.rs.loadedNext = true; else run.loadedPending = true;
      if (run.charms.length) { const j = rng.int(run.charms.length); msg = GK.CHARMS[run.charms[j].id].name + ' was destroyed. '; run.charms.splice(j, 1); }
      msg += 'Next frame ×3 Mult';
    } else if (id === 'm_counterfeit') { run.money += 12; run.nextTargetMul *= 1.35; msg = '+$12. Next target +35%'; }
    else if (id === 'm_dupe') {
      if (!run.charms.length) return { ok: false, msg: 'You have no charms to copy.' };
      if (run.charms.length >= run.maxCharms) return { ok: false, msg: 'No free charm slot.' };
      const c = run.charms[rng.int(run.charms.length)];
      run.charms.push(JSON.parse(JSON.stringify(c))); run.money = Math.min(run.money, 0) ; msg = 'Copied ' + GK.CHARMS[c.id].name;
    }
    else if (id === 'm_stolen_oil') {
      if (!GK.OIL[target]) return { ok: false, msg: 'Pick an oil pattern.' };
      run.oilNext = target; run.nextTargetMul *= 1.15; msg = 'Next round is on ' + GK.OIL[target].name + '. Target +15%';
    } else if (id === 'm_fake_id') {
      if (!GK.BOSSES[target] || target === 'champion') return { ok: false, msg: 'Pick a boss.' };
      if (GK.isChamp(run) || GK.isEndless(run) && false) return { ok: false, msg: 'Not in the Championship.' };
      if (run.charms.length >= run.maxCharms) return { ok: false, msg: 'Fake ID needs a free charm slot to give up.' };
      run.bossOverride = { alley: run.alley, id: target }; run.maxCharms--; run.fakeIdSlot = true;
      msg = 'This alley\'s Boss Match: ' + GK.BOSSES[target].name;
    } else if (id === 'm_ball_swap') {
      const b = run.bag[target]; if (!b) return { ok: false, msg: 'Pick a ball first.' };
      const pool = Object.keys(GK.BALLS).filter(k => GK.BALLS[k].cost >= 8 && !run.bag.some(x => x.type === k) && GK.isUnlocked('ball', k));
      if (!pool.length) return { ok: false, msg: 'No rare balls left to swap for.' };
      const nb = rng.pick(pool); run.bag[target] = { type: nb, ed: null, borrowed: true };
      msg = 'Swapped for the ' + GK.BALLS[nb].full + '. It leaves with your next jam';
    } else if (id === 'm_bootleg') {
      if (!GK.SHOTS[target]) return { ok: false, msg: 'Pick a shot.' };
      run.levels[target] = (run.levels[target] || 0) + 3;
      const others = GK.SHOT_ORDER.filter(k => k !== target && (run.levels[k] || 0) > 0);
      if (others.length) { const k = rng.pick(others); run.levels[k]--; msg = GK.SHOTS[target].name + ' +3 levels, ' + GK.SHOTS[k].name + ' -1'; }
      else msg = GK.SHOTS[target].name + ' +3 levels';
    } else if (id === 'm_hot_charm') {
      if (run.charms.length >= run.maxCharms) return { ok: false, msg: 'No free charm slot.' };
      const pool = GK.CHARM_LIST.filter(c => c.rarity === 'rare' && !run.charms.some(x => x.id === c.id) && GK.isUnlocked('charm', c.id));
      if (!pool.length) return { ok: false, msg: 'No Rare charms unlocked yet.' };
      const c = GK.charmInst(rng.pick(pool).id, 'neon'); c.expires = 2; run.charms.push(c);
      msg = 'Hot ' + GK.CHARMS[c.id].name + ' (Neon). Burns out in 2 rounds';
    } else if (id === 'm_insurance') {
      if (run.bag.length <= 1) return { ok: false, msg: 'You need at least 2 balls to fake an accident.' };
      const j = rng.int(run.bag.length), lost = run.bag[j]; run.bag.splice(j, 1); run.money += 20;
      msg = '+$20. Your ' + GK.BALLS[lost.type].full + ' "shattered"';
    } else if (id === 'm_weighted') { run.rs.weighted = true; msg = 'Every pin is Lead this round, and scores double'; }
    else if (id === 'm_snake_oil') { run.rs.groove = (run.rs.groove || 0) + 3; run.rs.snakeOil = true; msg = '+3 Groove. Misses cost $2 this round'; }
    else if (id === 'm_debt') {
      if (!run.rs.boss || run.rs.boss === 'champion') return { ok: false, msg: 'Use this during a Boss Match (not the Championship).' };
      run.rs.boss = null; run.rs.stolen = -1; msg = 'The boss has been paid off for this round';
    } else if (id === 'm_pin_thief') { run.rs.thief = true; msg = 'A pin goes missing from every rack this round'; }
    else if (id === 'm_fixed') {
      if (GK.isChamp(run)) return { ok: false, msg: 'The Gutter King can\'t be bought.' };
      run.fixed = run.alley; msg = 'This alley\'s Boss Match target is 40% lower, and pays nothing';
    } else if (id === 'm_blood_money') { run.rs.bloodMoney = true; run.shopSmall = true; msg = '$1 per pin this round. Your next shop has 2 items'; }
    else if (id === 'm_illegal_drill') {
      const b = run.bag[target]; if (!b) return { ok: false, msg: 'Pick a ball first.' };
      b.drill = 'illegal'; msg = GK.BALLS[b.type].full + ' now has an illegal layout';
    } else if (id === 'm_smuggled') {
      const pool = Object.keys(GK.BALLS).filter(k => k !== 'house' && !run.bag.some(x => x.type === k) && GK.isUnlocked('ball', k));
      const nb = rng.pick(pool);
      if (run.bag.length < GK.maxBag(run)) run.bag.push({ type: nb, ed: null }); else run.bag[run.bag.length - 1] = { type: nb, ed: null };
      run.rs.smuggled = run.bag.findIndex(x => x.type === nb);
      msg = 'Smuggled in a ' + GK.BALLS[nb].full + '. Every first roll this round uses it';
    }
    run.charms.forEach(c => { if (c.id === 'ironman') c.v = 0; });
    if (run.rs && run.phase !== 'shop') run.rs.usedCons = true;
    if (k.kind === 'market') run.stats.market = (run.stats.market || 0) + 1;
    run.cons.splice(i, 1);
    return { ok: true, msg };
  };

  // ---------- skipping rounds ----------
  // Skip a Qualifier or Heat: no score, no pay, no shop, but you take the round's reward tag.
  GK.TAGS = {
    cash: { name: 'Cash Tag', desc: '+$6 right now.' },
    coupon: { name: 'Coupon Tag', desc: 'Everything in your next shop is half price.' },
    charm: { name: 'Charm Tag', desc: 'Your next shop has an extra Uncommon charm, free.' },
    levels: { name: 'Scorecard Tag', desc: 'Level up two random shots right now.' },
    trick: { name: 'Trick Tag', desc: 'Get a random Lane Trick right now (needs a free consumable slot).' },
    drill: { name: 'Drill Tag', desc: 'Your next re-drill at the Pro Shop is free.' }
  };
  GK.canSkip = run => !run.practice && !GK.isBoss(run) && !GK.isChamp(run);
  GK.skipTag = run => GK.stream(run.seed, 'skip:' + run.alley + ':' + run.round).pick(Object.keys(GK.TAGS));
  GK.skipRound = function (run) {
    const tag = GK.skipTag(run), rng = GK.stream(run.seed, 'skipfx:' + run.alley + ':' + run.round);
    let msg = GK.TAGS[tag].name + ': ' + GK.TAGS[tag].desc;
    if (tag === 'cash') run.money += 6;
    else if (tag === 'levels') { const a = rng.pick(GK.SHOT_ORDER.slice(0, 5)), b = rng.pick(GK.SHOT_ORDER.slice(0, 5)); [a, b].forEach(k => { run.levels[k] = (run.levels[k] || 0) + 1; }); msg = 'Scorecard Tag: ' + GK.SHOTS[a].name + ' and ' + GK.SHOTS[b].name + ' levelled up.'; }
    else if (tag === 'trick') {
      if (run.cons.length < run.maxCons) { const k = rng.pick(GK.CONS_LIST.filter(c => c.kind === 'trick' && GK.isUnlocked('cons', c.id))); run.cons.push(k.id); msg = 'Trick Tag: you got ' + k.name + '.'; }
      else { run.money += 4; msg = 'Trick Tag: no free slot, so you got $4 instead.'; }
    } else run.tags.push(tag);
    if (run.rs) run.history.push({ alley: run.alley, round: run.round, champ: false, target: run.rs.target, total: 0, won: true, skipped: true, frames: 0 });
    run.round++;
    if (run.round > 2) { run.round = 0; run.alley++; }
    run.rs = null; run.phase = 'intro';
    return { tag, msg };
  };
  // Apply pending tags when a shop opens.
  GK.applyShopTags = function (run) {
    const shop = run.shop, rng = GK.stream(run.seed, 'tags:' + run.shopCount);
    run.tags = (run.tags || []).filter(tag => {
      if (tag === 'coupon') { shop.items.forEach(it => { it.price = Math.max(1, Math.ceil(it.price / 2)); }); shop.coupon = true; return false; }
      if (tag === 'charm') {
        const pool = GK.CHARM_LIST.filter(c => c.rarity === 'uncommon' && !run.charms.some(x => x.id === c.id) && GK.isUnlocked('charm', c.id));
        if (pool.length) shop.items.unshift({ kind: 'charm', id: rng.pick(pool).id, ed: null, price: 0, free: true });
        return false;
      }
      if (tag === 'drill') { shop.freeDrill = true; return false; }
      return true;
    });
  };

  // ---------- ball drilling ----------
  GK.DRILL_COST = 4;
  GK.drillCost = run => run.shop && run.shop.freeDrill ? 0 : GK.price(run, GK.DRILL_COST);
  GK.redrill = function (run, ballIdx, drillId, free) {
    const b = run.bag[ballIdx];
    if (!b || !GK.DRILLS[drillId] || GK.DRILLS[drillId].hidden) return { ok: false, msg: 'Pick a ball and a layout.' };
    const cost = free ? 0 : GK.drillCost(run);
    if (!GK.canAfford(run, cost)) return { ok: false, msg: 'Not enough money' };
    run.money -= cost; b.drill = drillId;
    if (!free && run.shop) run.shop.freeDrill = false;
    return { ok: true, msg: GK.BALLS[b.type].full + ' re-drilled: ' + GK.DRILLS[drillId].name };
  };

  // ---------- events between rounds ----------
  GK.EVENTS = {
    lost_found: { name: 'Lost & Found', desc: 'Someone left a ball in the Lost & Found. Nobody is coming back for it.' },
    vending: { name: 'Vending Machine', desc: 'The old vending machine hums. $3 gets you a mystery item.' },
    shady: { name: 'A Shady Bowler', desc: '"Psst. Rare charm, no charge. Just don\'t ask where it came from." Your next round\'s target goes up 20%.' },
    lane_mech: { name: 'The Lane Mechanic', desc: 'The lane mechanic owes you a favour: one free re-drill.' }
  };
  GK.EVENT_CHANCE = 0.35;
  GK.rollEvent = function (run) {
    if (run.practice) return null;
    const rng = GK.stream(run.seed, 'event:' + run.shopCount);
    if (rng() >= GK.EVENT_CHANCE * (GK.flags(run).vip ? 2 : 1)) return null;
    const id = rng.pick(Object.keys(GK.EVENTS)), ev = { id };
    if (id === 'lost_found') {
      const pool = Object.keys(GK.BALLS).filter(k => k !== 'house' && !run.bag.some(b => b.type === k) && GK.isUnlocked('ball', k));
      if (!pool.length) return null;
      ev.ball = rng.pick(pool);
    }
    if (id === 'shady') {
      // a Rare charm if you've unlocked any, otherwise an Uncommon one
      const open = r => GK.CHARM_LIST.filter(c => c.rarity === r && !run.charms.some(x => x.id === c.id) && GK.isUnlocked('charm', c.id));
      const pool = open('rare').length ? open('rare') : open('uncommon');
      if (!pool.length) return null;
      ev.charm = rng.pick(pool).id;
    }
    if (id === 'vending') ev.item = rng.pick(GK.CONS_LIST.filter(c => GK.isUnlocked('cons', c.id))).id;
    if (id === 'regular') Object.assign(ev, GK.regularVisit(run, rng));
    if (GK.eventExtras) return GK.eventExtras(run, ev, rng);
    return ev;
  };
  // Accept an event's offer. arg: bag slot to replace (lost_found) or { ball, drill } (lane_mech).
  GK.takeEvent = function (run, ev, arg) {
    if (ev.id === 'lost_found') {
      if (run.bag.length < GK.maxBag(run)) run.bag.push({ type: ev.ball, ed: null });
      else if (arg != null && run.bag[arg]) run.bag[arg] = { type: ev.ball, ed: null };
      else return { ok: false, need: 'replace', msg: 'Your bag is full. Pick a ball to leave behind.' };
      return { ok: true, msg: 'You took the ' + GK.BALLS[ev.ball].full + '.' };
    }
    if (ev.id === 'vending') {
      if (run.cons.length >= run.maxCons) return { ok: false, msg: 'No free consumable slot.' };
      if (!GK.canAfford(run, 3)) return { ok: false, msg: 'Not enough money.' };
      run.money -= 3; run.cons.push(ev.item);
      return { ok: true, msg: 'Clunk! Out drops ' + GK.CONS[ev.item].name + '.' };
    }
    if (ev.id === 'shady') {
      if (run.charms.length >= run.maxCharms) return { ok: false, msg: 'No free charm slot.' };
      run.charms.push(GK.charmInst(ev.charm)); run.nextTargetMul *= 1.2;
      return { ok: true, msg: 'You pocket ' + GK.CHARMS[ev.charm].name + '. Next target +20%.' };
    }
    if (ev.id === 'lane_mech') return GK.redrill(run, arg.ball, arg.drill, true);
    if (ev.id === 'regular') return GK.takeRegular(run, ev);
    const r2 = GK.takeEvent2 ? GK.takeEvent2(run, ev, arg) : null;
    if (r2) return r2;
    return { ok: false };
  };

  // ---------- endless mode ----------
  // After beating the Gutter King, keep going: alleys repeat with fast-growing targets.
  GK.startEndless = function (run) {
    run.won = false; run.endless = true;
    run.alley = GK.ALLEY_COUNT + 1; run.round = 0;
    run.phase = 'shop';
  };

  // ---------- persistence ----------
  GK.save = function (run) {
    try { if (run && !run.over && !run.won && !run.practice) localStorage.setItem(SAVE_KEY, JSON.stringify(run, (k, v) => k === 'snap' ? undefined : v)); else if (!run || !run.practice) localStorage.removeItem(SAVE_KEY); } catch (e) {}
  };
  GK.load = function () {
    try { const s = localStorage.getItem(SAVE_KEY); if (!s) return null; const r = JSON.parse(s); if (!r || r.v !== 1) return null; r.rack = GK.padRack(r.rack); if (r.rs && !r.rs.wear) r.rs.wear = GK.newWear(); r.league = r.league || 'open'; r.bosses = r.bosses || GK.pickBosses(r.seed); r.tags = r.tags || []; r.asc = r.asc || 0; r.history = r.history || []; r.stats = Object.assign({ perfects: 0, pstreak: 0, bestPStreak: 0 }, r.stats); return r; } catch (e) { return null; }
  };
  GK.clearSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  GK.meta = function () {
    let m = null;
    try { m = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) {}
    return Object.assign({ runs: 0, wins: 0, bestAlley: 0, bestFrame: 0, bestRound: 0, muted: false, daily: {} }, m || {});
  };
  GK.saveMeta = function (m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} };
})();
