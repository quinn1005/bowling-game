// Gutter Kings — run state: rounds, targets, economy, shop, inventory, consumables, saves.
// Pure logic (no DOM) so it can be tested headless. The run object is plain JSON for saving.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const SAVE_KEY = 'gk-run-v1', META_KEY = 'gk-meta-v1';
  GK.ALLEY_COUNT = GK.ALLEYS.length;

  GK.newRun = function ({ seed, bag = 'classic', daily = false } = {}) {
    seed = (seed == null ? (Date.now() ^ (Math.random() * 0xffffffff)) : seed) >>> 0;
    const sb = GK.STARTER_BAGS.find(b => b.id === bag) || GK.STARTER_BAGS[0];
    const run = {
      v: 1, seed, daily, bagId: sb.id,
      alley: 0, round: 0, money: 4 + (sb.money || 0),
      bag: sb.balls.map(type => ({ type, ed: null })), maxBag: 3,
      charms: [], maxCharms: 5, cons: [], maxCons: 2,
      rack: new Array(10).fill('std'), levels: {}, members: [], equip: {},
      stats: { pins: 0, strikes: 0, spares: 0, splits: 0, gutters: 0, frames: 0, bestFrame: 0, throws: 0, score: 0 },
      nextTargetMul: 1, shopCount: 0, memberOffer: null, memberAlley: -1,
      phase: 'intro', rs: null, shop: null, over: false, won: false
    };
    return run;
  };

  GK.isChamp = run => run.alley >= GK.ALLEY_COUNT;
  GK.alleyDef = run => GK.isChamp(run) ? GK.CHAMPIONSHIP : GK.ALLEYS[run.alley];
  GK.roundName = run => GK.isChamp(run) ? 'Championship' : GK.ROUND_NAMES[run.round];
  GK.isBoss = run => GK.isChamp(run) || run.round === 2;
  GK.bossId = run => GK.isBoss(run) ? GK.alleyDef(run).boss.id : null;
  GK.roundTarget = function (run) {
    if (GK.isChamp(run)) return Math.round(GK.CHAMPIONSHIP.target * run.nextTargetMul);
    const a = GK.ALLEYS[run.alley];
    const t = a.base * GK.ROUND_MULT[run.round] * run.nextTargetMul;
    return Math.round(t / 50) * 50;
  };

  // Passive rule changes from charms and memberships.
  GK.flags = function (run, stolen) {
    const f = { frames: 0, reracks: 0, bumpers: false, wide: 1, wild: false, retake: false, third: false, debt: 0, interestCap: 5, discount: 0, rerollOff: 0 };
    (run.charms || []).forEach((c, i) => {
      if (stolen === i) return;
      let def = GK.CHARMS[c.id];
      if (def.copy) { const nb = run.charms[i + 1]; def = nb && stolen !== i + 1 && !GK.CHARMS[nb.id].copy ? GK.CHARMS[nb.id] : null; }
      const fl = def && def.flags; if (!fl) return;
      if (fl.frames) f.frames += fl.frames;
      if (fl.reracks) f.reracks += fl.reracks;
      if (fl.bumpers) f.bumpers = true;
      if (fl.wide) f.wide = Math.max(f.wide, fl.wide);
      if (fl.wild) f.wild = true;
      if (fl.retake) f.retake = true;
      if (fl.third) f.third = true;
      if (fl.debt) f.debt = Math.max(f.debt, fl.debt);
    });
    const m = run.members || [];
    if (m.includes('reservation')) f.frames++;
    if (m.includes('oil_pass')) f.reracks++;
    if (m.includes('rewards')) f.interestCap = 10;
    if (m.includes('clearance')) f.discount = 0.25;
    if (m.includes('reroll_club')) f.rerollOff = 2;
    return f;
  };
  GK.equipMods = function (run) {
    const m = { hook: 1, speed: 1, aim: 1, spin: 1 };
    Object.values(run.equip || {}).forEach(id => { const e = GK.EQUIP[id]; if (!e) return; ['hook', 'speed', 'aim', 'spin'].forEach(k => { if (e[k]) m[k] *= e[k]; }); });
    return m;
  };
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
      target: GK.roundTarget(run), total: 0, frames: [], frameIdx: 0, streak: 0,
      framesMax, reracks: GK.C.RERACKS + fl.reracks, stolen, loadedNext: false,
      boss, tilts: [], king: null, kingTotal: 0
    };
    run.nextTargetMul = 1;
    if (run.loadedPending) { rs.loadedNext = true; run.loadedPending = false; }
    const rng = GK.stream(run.seed, 'round:' + run.alley + ':' + run.round);
    if (boss === 'ringmaster') for (let i = 0; i < 12; i++) rs.tilts.push((rng() < 0.5 ? -1 : 1) * (35 + rng() * 45));
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
  GK.payout = function (run) {
    const rs = run.rs, fl = GK.flags(run, rs ? rs.stolen : -1);
    const lines = [];
    if (!GK.isChamp(run)) lines.push({ label: GK.roundName(run) + ' cleared', v: GK.ROUND_PAY[run.round] });
    const unused = rs ? Math.max(0, rs.framesMax - rs.frameIdx) : 0;
    if (unused) lines.push({ label: unused + ' unused frame' + (unused > 1 ? 's' : ''), v: unused });
    run.charms.forEach((c, i) => {
      if (rs && rs.stolen === i) return;
      const d = GK.CHARMS[c.id]; if (d.round) { const v = d.round(run, c); if (v) lines.push({ label: d.name, v }); }
    });
    const interest = Math.min(fl.interestCap, Math.floor(Math.max(0, run.money) / 5));
    if (interest) lines.push({ label: 'Interest ($1 per $5, max $' + fl.interestCap + ')', v: interest });
    return lines;
  };
  GK.applyPayout = function (run, lines) { lines.forEach(l => { run.money += l.v; }); };

  // After a won round: move on. Returns 'shop' | 'won'.
  GK.advance = function (run) {
    // round-reset scaling charms
    run.charms.forEach(c => { if (GK.CHARMS[c.id].roundReset) c.v = 0; });
    if (GK.isChamp(run)) { run.won = true; run.phase = 'won'; return 'won'; }
    run.round++;
    if (run.round > 2) { run.round = 0; run.alley++; }
    run.phase = 'shop';
    return 'shop';
  };

  // ---------- inventory ----------
  GK.charmInst = (id, ed) => Object.assign({ id, ed: ed || null }, JSON.parse(JSON.stringify(GK.CHARMS[id].init || {})));
  GK.sellValue = item => Math.max(1, Math.floor(item.cost / 2) + (item.ed ? 1 : 0));
  GK.charmSell = c => GK.sellValue({ cost: GK.CHARMS[c.id].cost, ed: c.ed });
  GK.ballSell = b => GK.sellValue({ cost: GK.BALLS[b.type].cost, ed: b.ed });

  GK.charmDesc = function (c) {
    const d = GK.CHARMS[c.id];
    let s = d.desc.replace('{v}', GK.fmt(c.v || 0));
    if (s.includes('{x}')) s = s.replace('{x}', d.show ? d.show(c) : '1');
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
    const p = base + (ed === 'foil' ? 2 : ed === 'holo' ? 3 : ed === 'neon' ? 5 : 0);
    return Math.max(1, Math.round(p * (1 - fl.discount)));
  };
  function pickCharm(run, rng, exclude) {
    const owned = new Set(run.charms.map(c => c.id).concat(exclude));
    for (let t = 0; t < 30; t++) {
      const rar = weightedRarity(rng);
      const pool = GK.CHARM_LIST.filter(c => c.rarity === rar && !owned.has(c.id));
      if (pool.length) return rng.pick(pool).id;
    }
    const pool = GK.CHARM_LIST.filter(c => !owned.has(c.id));
    return pool.length ? rng.pick(pool).id : null;
  }
  function pickBall(run, rng, exclude) {
    const owned = new Set(run.bag.map(b => b.type).concat(exclude));
    const pool = Object.keys(GK.BALLS).filter(k => k !== 'house' && !owned.has(k));
    return pool.length ? rng.pick(pool) : null;
  }
  function pickGood(run, rng, exclude) {
    const r = rng();
    if (r < 0.1) {
      const pool = Object.keys(GK.EQUIP).filter(k => !Object.values(run.equip).includes(k) && !exclude.includes(k));
      if (pool.length) { const id = rng.pick(pool); return { kind: 'equip', id, price: GK.price(run, GK.EQUIP[id].cost) }; }
    }
    let kind = r < 0.5 ? 'card' : r < 0.88 ? 'trick' : 'market';
    const pool = GK.CONS_LIST.filter(k => k.kind === kind && !exclude.includes(k.id));
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
    for (let i = 0; i < 2; i++) { const g = pickGood(run, rng, gx); gx.push(g.id); shop.items.push(g); }
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
    run.phase = 'shop';
    return run.shop;
  };
  GK.rerollCost = run => Math.max(1, 5 + (run.shop ? run.shop.rerolls : 0) - GK.flags(run).rerollOff);
  GK.reroll = function (run) {
    const cost = GK.rerollCost(run);
    if (!GK.canAfford(run, cost)) return { ok: false, msg: 'Not enough money' };
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
      run.charms.push(GK.charmInst(it.id, it.ed));
    } else if (it.kind === 'ball') {
      if (run.bag.length >= run.maxBag) {
        if (replaceIdx == null) return { ok: false, need: 'replace', msg: 'Bag is full. Pick a ball to swap out.' };
        run.bag.splice(replaceIdx, 1, { type: it.id, ed: it.ed });
      } else run.bag.push({ type: it.id, ed: it.ed });
    } else if (it.kind === 'cons') {
      if (run.cons.length >= run.maxCons) return { ok: false, msg: 'Consumable slots full. Use or sell one first.' };
      run.cons.push(it.id);
    } else if (it.kind === 'equip') {
      run.equip[GK.EQUIP[it.id].slot] = it.id;
    }
    run.money -= it.price; it.sold = true;
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
  GK.sellCharm = function (run, i) { const c = run.charms[i]; if (!c) return; run.money += GK.charmSell(c); run.charms.splice(i, 1); };
  GK.sellCons = function (run, i) { const id = run.cons[i]; if (!id) return; run.money += Math.max(1, Math.floor(GK.CONS[id].cost / 2)); run.cons.splice(i, 1); };
  GK.sellBall = function (run, i) {
    if (run.bag.length <= 1) return { ok: false, msg: 'You need at least one ball.' };
    const b = run.bag[i]; run.money += GK.ballSell(b); run.bag.splice(i, 1); return { ok: true };
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
      target.slice(0, k.picks).forEach(n => { run.rack[n - 1] = k.pinType; });
      msg = k.pinType === 'none' ? 'Pin ' + target[0] + ' erased' : 'Pins ' + target.slice(0, k.picks).join(' & ') + ' are now ' + GK.PINS[k.pinType].name + 's';
    } else if (k.target === 'ball') {
      const b = run.bag[target]; if (!b) return { ok: false, msg: 'Pick a ball first.' };
      b.ed = k.edition; msg = GK.BALLS[b.type].full + ' is now ' + GK.EDITIONS[k.edition].name;
    } else if (id === 't_frame') { run.rs.framesMax++; msg = '+1 Frame this round'; }
    else if (id === 't_rerack') { run.rs.reracks++; msg = '+1 Re-rack this round'; }
    else if (id === 'm_bribe') {
      if (run.rs.framesMax - run.rs.frameIdx <= 1) return { ok: false, msg: 'Not enough frames left to bribe.' };
      run.rs.target = Math.round(run.rs.target * 0.7); run.rs.framesMax--; msg = 'Target cut to ' + GK.fmt(run.rs.target);
    } else if (id === 'm_loaded') {
      if (inRound) run.rs.loadedNext = true; else run.loadedPending = true;
      if (run.charms.length) { const j = rng.int(run.charms.length); msg = GK.CHARMS[run.charms[j].id].name + ' was destroyed. '; run.charms.splice(j, 1); }
      msg += 'Next frame ×3 Mult';
    } else if (id === 'm_counterfeit') { run.money += 15; run.nextTargetMul *= 1.25; msg = '+$15. Next target +25%'; }
    else if (id === 'm_dupe') {
      if (!run.charms.length) return { ok: false, msg: 'You have no charms to copy.' };
      if (run.charms.length >= run.maxCharms) return { ok: false, msg: 'No free charm slot.' };
      const c = run.charms[rng.int(run.charms.length)];
      run.charms.push(JSON.parse(JSON.stringify(c))); run.money = Math.min(run.money, 0) ; msg = 'Copied ' + GK.CHARMS[c.id].name;
    }
    run.cons.splice(i, 1);
    return { ok: true, msg };
  };

  // ---------- persistence ----------
  GK.save = function (run) {
    try { if (run && !run.over && !run.won) localStorage.setItem(SAVE_KEY, JSON.stringify(run)); else localStorage.removeItem(SAVE_KEY); } catch (e) {}
  };
  GK.load = function () {
    try { const s = localStorage.getItem(SAVE_KEY); if (!s) return null; const r = JSON.parse(s); return r && r.v === 1 ? r : null; } catch (e) { return null; }
  };
  GK.clearSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  GK.meta = function () {
    let m = null;
    try { m = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) {}
    return Object.assign({ runs: 0, wins: 0, bestAlley: 0, bestFrame: 0, bestRound: 0, muted: false, daily: {} }, m || {});
  };
  GK.saveMeta = function (m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} };
})();
