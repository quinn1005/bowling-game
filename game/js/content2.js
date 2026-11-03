// Gutter Kings — v1.1 content: new charms, balls, equipment and between-round events, each item
// unlocked by a themed feat. Loaded after endless.js.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const strike = k => GK.isStrikeKind(k);
  const add = (id, name, rarity, cost, tag, desc, o) => { const c = Object.assign({ id, name, rarity, cost, tag, desc }, o || {}); GK.CHARM_LIST.push(c); GK.CHARMS[id] = c; };

  // ---------- charms ----------
  add('glass_cannon', 'Glass Cannon', 'rare', 9, 'xmult', '×4 Mult. Shatters the first time you bowl an Open or Gutter frame.',
    { score: (c, s) => s.xmult(4), after: (c, me) => { if (c.kind === 'open' || c.kind === 'gutter') me.broken = true; } });
  add('pocket_watch', 'Pocket Watch', 'uncommon', 6, 'mult', '+1 Mult for every tenth of a second your first ball takes to reach the pins past 0.6 s. Slow and steady.',
    { score: (c, s) => { const n = Math.floor(((c.travel || 0) - 0.6) * 10); if (n > 0) s.mult(n); } });
  add('ricochet_king', 'Ricochet King', 'rare', 8, 'xmult', '×1.1 Mult for every wall bang and every pin knocked down by another pin this frame.',
    { score: (c, s) => { const n = Math.min(25, c.walls + c.carry); if (n) s.xmult(Math.pow(1.1, n)); } });
  add('bargain_bin', 'Bargain Bin', 'uncommon', 6, 'economy', 'Everything in the shop costs $1 less, and every shop has one extra item.', { flags: { priceDelta: -1, shopExtra: 1 } });
  add('perfectionists_curse', 'Perfectionist\'s Curse', 'rare', 8, 'xmult', '×3 Mult if every throw this frame was PERFECT. ×0.5 Mult if any throw missed.',
    { score: (c, s) => { if (c.misses) s.xmult(0.5); else if (c.perfects) s.xmult(3); } });
  add('night_owl_pass', 'Night Owl Pass', 'uncommon', 6, 'mult', '+2 Mult for every endless alley you\'ve reached.',
    { score: (c, s) => { const n = GK.isEndless(c.run) ? c.run.alley - GK.ALLEY_COUNT : 0; if (n > 0) s.mult(2 * n); } });
  add('rack_attack', 'Rack Attack', 'common', 5, 'chips', '+5 Points for every pin in your rack.',
    { score: (c, s) => s.chips(5 * GK.padRack(c.run.rack).filter(t => t !== 'none').length) });
  add('taxidermy', 'Taxidermy Trophy', 'uncommon', 7, 'mult', '+3 Mult for every trophy on your shelf.',
    { score: (c, s) => { const n = (c.run.trophies || []).length; if (n) s.mult(3 * n); } });
  add('second_wind', 'Second Wind', 'rare', 9, 'rule', 'Once per round, if you\'re about to lose, you get one more frame.', { flags: { secondWind: true } });

  // ---------- balls ----------
  const ball = (id, o) => { GK.BALLS[id] = o; };
  ball('anchor', { name: 'Anchor', full: 'Anchor Ball', cost: 8, m: 9, col: '#3a4a5a', hi: '#9ab0c4', desc: 'Sinks to the lane after the arrows: from there nothing can knock it off line. No posts, no wind, no tilt, no magnets.' });
  ball('gyro', { name: 'Gyro', full: 'Gyro Ball', cost: 8, m: 6, col: '#2ad0a0', hi: '#c8fff0', desc: 'Stops at the pins and spins in place for a second, sweeping everything around it.' });
  ball('black_pearl', { name: 'Black Pearl', full: 'Black Pearl', cost: 8, m: 6, col: '#1a1420', hi: '#d8c8f0', desc: 'A deep-sea ball: it hooks hard in the oil and goes straight on dry boards. The opposite of every other ball.' });
  ball('grenade', { name: 'Grenade', full: 'Grenade Ball', cost: 8, m: 5, col: '#4a6a2a', hi: '#a8c870', desc: 'Explodes 3 seconds after you let go, wherever it is.' });

  // ---------- equipment ----------
  GK.EQUIP.lucky_sweatband = { slot: 'head', name: 'Lucky Sweatband', cost: 6, desc: '+1 re-rack every round, but the PERFECT zone is 10% smaller.', reracks: 1, zone: 0.9 };

  // ---------- between-round events ----------
  Object.assign(GK.EVENTS, {
    sale: { name: 'Pro Shop Sale', desc: 'Everything in the next shop is half price, but the shelves are thin: only 3 items.' },
    fountain: { name: 'The Lucky Fountain', desc: 'An old fountain by the shoe rental. Toss in $5 for a 1 in 3 chance at a Rare charm.' },
    lost_bowler: { name: 'The Lost Bowler', desc: 'A stranger offers to trade you a ball from their bag for one of yours. They won\'t say which.' },
    regulars_bet: { name: 'The Regulars\' Bet', desc: 'Quinn, Kaleb and Levi are betting on how far you\'ll get. Kaleb: you clear the next round ($4). Levi: you reach the next alley ($8). Quinn: you beat the next Boss Match ($12).' },
    card_game: { name: 'The Back Room Card Game', desc: 'Stake a charm on a coin flip. Win: you get a copy of it. Lose: it\'s gone.' }
  });
  GK.eventExtras = function (run, ev, rng) {
    if (ev.id === 'lost_bowler') {
      const pool = Object.keys(GK.BALLS).filter(k => k !== 'house' && !run.bag.some(b => b.type === k) && GK.isUnlocked('ball', k));
      if (!pool.length) return null;
      ev.ball = rng.pick(pool);
    }
    if (ev.id === 'card_game' && !run.charms.length) return null;
    if (ev.id === 'fountain') ev.roll = rng();
    if (ev.id === 'card_game') ev.flip = rng() < 0.5;
    return ev;
  };
  GK.takeEvent2 = function (run, ev, arg) {
    if (ev.id === 'sale') { run.saleNext = true; return { ok: true, msg: 'Your next shop is half price (3 items).' }; }
    if (ev.id === 'fountain') {
      if (!GK.canAfford(run, 5)) return { ok: false, msg: 'You need $5.' };
      run.money -= 5;
      if (ev.roll >= 1 / 3) return { ok: true, msg: 'Splash. Nothing happens. The fountain keeps your $5.' };
      const pool = GK.CHARM_LIST.filter(c => c.rarity === 'rare' && !run.charms.some(o => o.id === c.id) && GK.isUnlocked('charm', c.id));
      if (!pool.length || run.charms.length >= run.maxCharms) { run.money += 8; return { ok: true, msg: 'The fountain coughs up $8.' }; }
      const c = pool[Math.floor(ev.roll * 3 * pool.length) % pool.length];
      run.charms.push(GK.charmInst(c.id));
      return { ok: true, msg: 'The fountain glows: you got ' + c.name + '!' };
    }
    if (ev.id === 'lost_bowler') {
      const b = run.bag[arg]; if (!b) return { ok: false, need: 'ball', msg: 'Pick a ball to trade.' };
      const old = GK.BALLS[b.type].full;
      run.bag[arg] = { type: ev.ball, ed: null };
      return { ok: true, msg: 'You gave away your ' + old + ' and got... the ' + GK.BALLS[ev.ball].full + '!' };
    }
    if (ev.id === 'regulars_bet') {
      run.regBets = [{ who: 'Kaleb', kind: 'round', pay: 4 }, { who: 'Levi', kind: 'alley', alley: run.alley + 1, pay: 8 }, { who: 'Quinn', kind: 'boss', alley: run.alley, pay: 12 }];
      return { ok: true, msg: 'Bets are on.' };
    }
    if (ev.id === 'card_game') {
      const c = run.charms[arg]; if (!c) return { ok: false, need: 'charm', msg: 'Pick a charm to stake.' };
      const name = GK.charmName(c);
      if (ev.flip) {
        if (run.charms.length < run.maxCharms) { run.charms.push(Object.assign(JSON.parse(JSON.stringify(c)), { corrupt: false })); return { ok: true, msg: 'Heads! You win a second ' + name + '.' }; }
        const v = GK.charmSell(c); run.money += v; return { ok: true, msg: 'Heads! No room for a copy, so you take $' + v + '.' };
      }
      run.charms.splice(arg, 1);
      return { ok: true, msg: 'Tails. Your ' + name + ' is gone.' };
    }
    return null;
  };
  // The Regulars' bets settle as you go.
  GK.settleBets = function (run, wasBoss, oldAlley) {
    const out = [];
    (run.regBets || []).forEach(b => {
      if (b.paid) return;
      if (b.kind === 'round') { b.paid = true; }
      if (b.kind === 'alley' && run.alley >= b.alley) b.paid = true;
      if (b.kind === 'boss' && wasBoss && oldAlley === b.alley) b.paid = true;
      if (b.kind === 'boss' && run.alley > b.alley && !b.paid) b.lost = true;
      if (b.paid) { run.money += b.pay; out.push(b.who + ' pays up: +$' + b.pay); }
    });
    run.regBets = (run.regBets || []).filter(b => !b.paid && !b.lost);
    return out;
  };

  // ---------- themed feats for every new item ----------
  const fr = e => e.t === 'frame';
  const newFeat = (id, name, desc, unlocks, check) => { GK.FEATS.push({ id, name, desc, unlocks, check }); unlocks.forEach(u => GK.LOCKED.add(u)); };
  newFeat('glass_jaw', 'Glass Jaw', 'Win a round without a single Open or Gutter frame.', ['charm:glass_cannon'],
    e => e.t === 'round' && e.run.rs && e.run.rs.frames.length && e.run.rs.frames.every(f => f.kind !== 'open' && f.kind !== 'gutter'));
  newFeat('slow_roller', 'Slow Roller', 'Roll a strike with a ball that takes over 1.3 seconds to reach the pins.', ['charm:pocket_watch'],
    e => fr(e) && GK.isStrikeKind(e.kind) && (e.ctx.travel || 0) > 1.3);
  newFeat('pinball_wizard', 'Pinball Wizard', 'Get 10 wall bangs and pin-on-pin knockdowns in one frame.', ['charm:ricochet_king'], e => fr(e) && e.ctx.walls + e.ctx.carry >= 10);
  newFeat('bargain_hunter', 'Bargain Hunter', 'Buy 3 things in one shop visit.', ['charm:bargain_bin'], e => e.run && e.run.shop && (e.run.shop.bought || 0) >= 3);
  newFeat('flawless', 'Flawless', 'Bowl 3 frames in a row where every throw is PERFECT.', ['charm:perfectionists_curse'], e => e.run && (e.run.stats.flawless || 0) >= 3);
  newFeat('insomniac', 'Insomniac', 'Reach the third endless alley.', ['charm:night_owl_pass'], e => e.run && e.run.alley >= GK.ALLEY_COUNT + 3);
  newFeat('packed_house', 'Packed House', 'Have all 15 pin spots filled in your rack.', ['charm:rack_attack'], e => e.run && GK.padRack(e.run.rack).every(t => t !== 'none'));
  newFeat('curator', 'Curator', 'Have 4 trophies on your shelf at once.', ['charm:taxidermy'], e => e.run && (e.run.trophies || []).length >= 4);
  newFeat('down_to_wire', 'Down to the Wire', 'Win a round on its very last frame.', ['charm:second_wind'],
    e => e.t === 'round' && e.run.rs && e.run.rs.frameIdx >= e.run.rs.framesMax);
  newFeat('steady', 'Steady as She Goes', 'Roll a strike in Deep Sea Lanes.', ['ball:anchor'], e => fr(e) && GK.isStrikeKind(e.kind) && GK.isEndless(e.run) && !!GK.alleyDef(e.run).lane.deep);
  newFeat('spin_doctor', 'Spin Doctor', 'Have 8 pins fall within half a second of first contact.', ['ball:gyro'], e => fr(e) && e.ctx.fast >= 8);
  newFeat('pearl_diver', 'Pearl Diver', 'Beat The Kraken.', ['ball:black_pearl'], e => e.t === 'round' && e.boss === 'kraken');
  newFeat('bomb_squad', 'Bomb Squad', 'Set off 3 explosions in one frame.', ['ball:grenade'], e => fr(e) && e.ctx.explosions >= 3);
  newFeat('sweat_it_out', 'Sweat It Out', 'Use every re-rack in a round and still win it.', ['equip:lucky_sweatband'],
    e => e.t === 'round' && e.run.rs && e.run.rs.reracks === 0 && e.run.rs.reracksStart > 0);
})();
