// Gutter Kings — round payoffs (v1.0): boss trophies, charm evolutions, overkill and bonus balls.
// Pure logic, loaded after content.js; run.js, scoring.js and frame.js call into it.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const strike = k => GK.isStrikeKind(k), spare = k => GK.isSpareKind(k);

  // ---------- boss trophies ----------
  // Beat a boss, then pick 1 of its 3 trophies. Trophies sit on their own shelf: they never use a
  // charm slot, can't be sold and can't be stolen. Hooks match charms: score, flags, eq
  // (equipment-style mods), round (money at the end of a won round) and onGain.
  GK.TROPHIES = {};
  const T = (boss, id, name, desc, o) => { GK.TROPHIES[id] = Object.assign({ id, boss, name, desc }, o || {}); };

  T('secretary', 'gavel', 'The Gavel', '×1.5 Mult on the first frame of every round. Meeting called to order.', { score: (c, s) => c.frameIdx === 0 && s.xmult(1.5) });
  T('secretary', 'minutes', 'The Minutes Book', '+1 Mult for every frame already bowled this round.', { score: (c, s) => c.frameIdx && s.mult(c.frameIdx) });
  T('secretary', 'stamp', 'Rubber Stamp', '×1.5 Mult on every Spare. Approved.', { score: (c, s) => spare(c.kind) && s.xmult(1.5) });

  T('janitor', 'mop_bucket', 'Mop Bucket', 'Your line never dries out, and +20 Points every frame.', { flags: { noWear: true }, score: (c, s) => s.chips(20) });
  T('janitor', 'wet_floor', 'Wet Floor Sign', '+4 Mult when your first ball hits the headpin first.', { score: (c, s) => c.firstPin === 1 && s.mult(4) });
  T('janitor', 'master_key', 'Master Key', '+1 Re-rack every round.', { flags: { reracks: 1 } });

  T('mechanic', 'torque_wrench', 'Torque Wrench', '+25 Points for every pin you pick up on your spare ball.', { score: (c, s) => spare(c.kind) && c.lastRollPins && s.chips(25 * c.lastRollPins) });
  T('mechanic', 'grease_gun', 'Grease Gun', 'Balls never jam in the return, and earn $1 every round you clear.', { flags: { noJam: true }, round: () => 1 });
  T('mechanic', 'parts_bin', 'Spare Parts Bin', '+4 Mult on every Spare.', { score: (c, s) => spare(c.kind) && s.mult(4) });

  T('landlord', 'deed', 'Property Deed', 'Earn $3 at the end of every round you clear.', { round: () => 3 });
  T('landlord', 'rent_check', 'Rent Check', '+1 Mult for every $4 you hold.', { score: (c, s) => { const n = Math.floor(Math.max(0, c.run.money) / 4); if (n) s.mult(n); } });
  T('landlord', 'eviction', 'Eviction Notice', '×1.4 Mult on any frame that clears the deck: Strikes and Spares.', { score: (c, s) => (strike(c.kind) || spare(c.kind)) && s.xmult(1.4) });

  T('strobe', 'disco_trophy', 'Mirrorball Trophy', '×1.3 Mult on every Strike.', { score: (c, s) => strike(c.kind) && s.xmult(1.3) });
  T('strobe', 'turntable', 'Golden Turntable', '+3 Groove at the start of every round, on top of the Groove you carry over.', { flags: { grooveAdd: 3 } });
  T('strobe', 'glowsticks', 'Glowsticks', '+5 Mult on dark lanes and in Boss Matches.', { score: (c, s) => (c.dark || c.boss) && s.mult(5) });

  T('fog', 'fog_lamp', 'Fog Lamp', 'The oil shows twice as clearly, and +15 Points every frame.', { eq: { clearOil: true }, score: (c, s) => s.chips(15) });
  T('fog', 'smoke_machine', 'Smoke Machine', '+3 Mult for every pin that falls late.', { score: (c, s) => c.late && s.mult(3 * c.late) });
  T('fog', 'lighthouse', 'Lighthouse', '×1.2 Mult every frame.', { score: (c, s) => s.xmult(1.2) });

  T('bookie', 'loaded_dice', 'Loaded Dice', 'Earn $2 for every Strike.', { score: (c, s) => strike(c.kind) && s.money(2) });
  T('bookie', 'betting_slip', 'Winning Slip', '×1.5 Mult while you hold $15 or more.', { score: (c, s) => c.run.money >= 15 && s.xmult(1.5) });
  T('bookie', 'lucky_chip', 'Lucky Chip', 'Earn $1 for every Strike and every Spare.', { score: (c, s) => (strike(c.kind) || spare(c.kind)) && s.money(1) });

  T('enforcer', 'brass_knuckles', 'Brass Knuckles', '+8 Mult on Open frames. Make them pay.', { score: (c, s) => c.kind === 'open' && s.mult(8) });
  T('enforcer', 'protection', 'Protection Money', 'Earn $4 at the end of every round you clear.', { round: () => 4 });
  T('enforcer', 'muscle', 'Hired Muscle', '+1 Mult for every pin knocked down by another pin.', { score: (c, s) => c.carry && s.mult(c.carry) });

  T('winter', 'ice_crown', 'Ice Crown', '+10 Points for every pin knocked down.', { score: (c, s) => c.pins && s.chips(10 * c.pins) });
  T('winter', 'snow_globe', 'Snow Globe', '×1.5 Mult in the last 2 frames of every round.', { score: (c, s) => c.framesLeft <= 2 && s.xmult(1.5) });
  T('winter', 'frost_boots', 'Frost Boots', 'The PERFECT zone is 20% wider.', { eq: { zone: 1.2 } });

  T('golem', 'ice_fist', 'Ice Fist', 'Lead pins topple easier, and +15 Points for every Lead pin knocked down.', { flags: { lightLead: true }, score: (c, s) => c.leadDown && s.chips(15 * c.leadDown) });
  T('golem', 'snowman_head', 'Snowman Head', '+6 Mult on every Strike.', { score: (c, s) => strike(c.kind) && s.mult(6) });
  T('golem', 'avalanche', 'Avalanche', '+1 Mult for every 2 pins knocked down.', { score: (c, s) => c.pins >= 2 && s.mult(Math.floor(c.pins / 2)) });

  T('ringmaster', 'top_hat', 'Ringmaster\'s Top Hat', '×2 Mult on Split conversions.', { score: (c, s) => c.kind === 'split' && s.xmult(2) });
  T('ringmaster', 'whip', 'The Whip', 'The hook dial swings 25% slower.', { eq: { dial: 1.25 } });
  T('ringmaster', 'big_top', 'Big Top', '+30 Points and +2 Mult every frame.', { score: (c, s) => { s.chips(30); s.mult(2); } });

  T('strongman', 'barbell', 'Barbell', '+50 Points on every Strike.', { score: (c, s) => strike(c.kind) && s.chips(50) });
  T('strongman', 'lifting_belt', 'Lifting Belt', '+2 Mult for every ball bounce.', { score: (c, s) => c.ballBounces && s.mult(2 * c.ballBounces) });
  T('strongman', 'iron_will', 'Iron Will', 'Your throws are 10% faster.', { eq: { speed: 1.1 } });

  T('astronaut', 'moon_rock', 'Moon Rock', '+2 Mult for every pin that flies into the pit.', { score: (c, s) => c.pit && s.mult(2 * c.pit) });
  T('astronaut', 'space_helmet', 'Space Helmet', 'The power bar moves 20% slower.', { eq: { bar: 1.2 } });
  T('astronaut', 'zero_g', 'Zero-G Patch', '+6 Mult on Doubles, Turkeys and longer streaks.', { score: (c, s) => (c.kind === 'double' || c.kind === 'turkey') && s.mult(6) });

  T('comet', 'comet_tail', 'Comet Tail', '+2 Mult for every pin that falls within half a second of first contact.', { score: (c, s) => c.fast && s.mult(2 * c.fast) });
  T('comet', 'stardust', 'Stardust', 'Earn $1 for every PERFECT throw.', { score: (c, s) => c.perfects && s.money(c.perfects) });
  T('comet', 'meteor', 'Meteor', '×2 Mult on a Strike thrown PERFECT.', { score: (c, s) => strike(c.kind) && c.perfects > 0 && c.misses === 0 && s.xmult(2) });

  T('king', 'stolen_crown', 'The Stolen Crown', '+1 charm slot for the rest of the run.', { onGain: run => { run.maxCharms++; } });
  T('king', 'scepter', 'Royal Scepter', '×1.5 Mult in Boss Matches.', { score: (c, s) => c.boss && s.xmult(1.5) });
  T('king', 'throne', 'Gutter Throne', '+50 Points and +5 Mult on Open and Gutter frames.', { score: (c, s) => { if (c.kind === 'open' || c.kind === 'gutter') { s.chips(50); s.mult(5); } } });

  T('rats', 'rat_king', 'Rat King', 'Earn $1 for every pin that ends up in a gutter.', { score: (c, s) => c.gutterPins && s.money(c.gutterPins) });
  T('rats', 'cheese_wheel', 'Cheese Wheel', '+30 Points every frame.', { score: (c, s) => s.chips(30) });
  T('rats', 'sewer_map', 'Sewer Map', 'Bumpers are up for the first frame of every round, and +2 Mult every frame.', { flags: { bumperFirst: true }, score: (c, s) => s.mult(2) });

  GK.trophyChoices = function (run, boss) {
    const owned = new Set((run.trophies || []).map(t => t.id));
    return Object.values(GK.TROPHIES).filter(t => t.boss === boss && !owned.has(t.id)).map(t => t.id);
  };
  GK.takeTrophy = function (run, id) {
    const d = GK.TROPHIES[id]; if (!d) return { ok: false };
    run.trophies = run.trophies || [];
    run.trophies.push({ id });
    if (d.onGain) d.onGain(run);
    return { ok: true, msg: d.name + ' added to your trophy shelf' };
  };

  // ---------- charm evolutions ----------
  // Some charms evolve once you've done their thing enough while holding them. when(ctx, self)
  // returns how much progress a frame makes. Evolved charms keep their slot and sell value.
  GK.EVOLVE = {
    lucky_shoes: { name: 'Golden Shoes', desc: '+60 Points every frame.', need: 'Bowl 8 Strikes or Spares', n: 8, when: c => strike(c.kind) || spare(c.kind) ? 1 : 0, score: (c, s) => s.chips(60) },
    chalk_bag: { name: 'Chalk Cloud', desc: '+6 Points for every pin knocked down this frame.', need: 'Knock down 60 pins', n: 60, when: c => c.pins, score: (c, s) => c.pins && s.chips(6 * c.pins) },
    headpin_hunter: { name: 'Headhunter', desc: '+120 Points if the first pin your ball touches is the headpin.', need: 'Hit the headpin first 8 times', n: 8, when: c => c.firstPin === 1 ? 1 : 0, score: (c, s) => c.firstPin === 1 && s.chips(120) },
    domino: { name: 'Domino Effect', desc: '+12 Points for every pin that knocks over another pin.', need: 'Get 25 pin-on-pin knockdowns', n: 25, when: c => c.carry, score: (c, s) => c.carry && s.chips(12 * c.carry) },
    league_jacket: { name: 'Varsity Jacket', desc: '+7 Mult every frame.', need: 'Bowl 12 frames', n: 12, when: () => 1, score: (c, s) => s.mult(7) },
    strike_out: { name: 'Strike Force', desc: '+10 Mult on any Strike, Double or Turkey.', need: 'Roll 5 Strikes', n: 5, when: c => strike(c.kind) ? 1 : 0, score: (c, s) => strike(c.kind) && s.mult(10) },
    spare_parts: { name: 'Spare Machine', desc: '+12 Mult on a Spare or Split conversion.', need: 'Pick up 6 Spares', n: 6, when: c => spare(c.kind) ? 1 : 0, score: (c, s) => spare(c.kind) && s.mult(12) },
    open_mic: { name: 'Headliner', desc: '+15 Mult on an Open frame.', need: 'Bowl 6 Open frames', n: 6, when: c => c.kind === 'open' ? 1 : 0, score: (c, s) => c.kind === 'open' && s.mult(15) },
    shoes_destiny: { name: 'Shoes of Fate', desc: '+8 Mult for each PERFECT throw this frame, -2 Mult for each miss.', need: 'Throw 15 PERFECT throws', n: 15, when: c => c.perfects, score: (c, s) => { const n = 8 * c.perfects - 2 * c.misses; if (n) s.mult(n); } },
    practice: { name: 'Pro Practice', desc: 'Gains +2 Mult each time you convert a Spare or Split. (Currently +{v} Mult)', need: 'Pick up 8 Spares', n: 8, when: c => spare(c.kind) ? 1 : 0, after: (c, me) => { if (spare(c.kind)) me.v += 2; } },
    hot_streak: { name: 'Inferno', desc: 'Gains ×0.5 Mult for each strike in a row; resets on anything else. (Currently ×{x})', need: 'Roll 3 Turkeys', n: 3, when: c => c.kind === 'turkey' ? 1 : 0,
      score: (c, s, me) => { const x = 1 + 0.5 * (me.v + (strike(c.kind) ? 1 : 0)); if (x > 1) s.xmult(x); }, show: me => (1 + 0.5 * me.v).toFixed(2) },
    tenth_frame: { name: 'Final Frame', desc: '×3 Mult on the last frame of each round.', need: 'Bowl 4 last frames', n: 4, when: c => c.lastFrame ? 1 : 0, score: (c, s) => c.lastFrame && s.xmult(3) },
    piggy_bank: { name: 'Bank Vault', desc: 'Earn $2 for every Strike.', need: 'Roll 6 Strikes', n: 6, when: c => strike(c.kind) ? 1 : 0, score: (c, s) => strike(c.kind) && s.money(2) },
    tip_jar: { name: 'Tip Bucket', desc: 'Earn $2 for every Spare or Split conversion.', need: 'Pick up 6 Spares', n: 6, when: c => spare(c.kind) ? 1 : 0, score: (c, s) => spare(c.kind) && s.money(2) }
  };
  // The charm definition to use for an instance (its evolved form once it has evolved).
  GK.charmDef = function (inst) {
    const d = GK.CHARMS[inst.id], E = inst.evolved && GK.EVOLVE[inst.id];
    const X = GK.hexOf && GK.hexOf(inst);
    if (X) return Object.assign({}, d, { name: X.name, desc: inst.curse ? X.up + ' Drawback: ' + X.down : X.up, score: (c, s, me) => { X.u(c, s, me); if (me.curse) X.d(c, s, me); } });
    if (!E) return d;
    return Object.assign({}, d, { name: E.name, desc: E.desc, score: E.score || d.score, after: E.after || d.after, show: E.show || d.show });
  };
  GK.charmName = inst => GK.charmDef(inst).name;
  // Advance evolution progress after a frame. Returns the instances that just evolved.
  GK.evolveCharms = function (ctx, run, stolen) {
    const out = [];
    (run.charms || []).forEach((inst, i) => {
      if (stolen === i) return;
      const E = GK.EVOLVE[inst.id]; if (!E || inst.evolved || (GK.hexOf && GK.hexOf(inst))) return;
      inst.evo = (inst.evo || 0) + (E.when(ctx, inst) || 0);
      if (inst.evo >= E.n) { inst.evolved = true; out.push({ idx: i, from: GK.CHARMS[inst.id].name, to: E.name }); }
    });
    return out;
  };

  // ---------- overkill ----------
  // Beat the target by a lot and get paid for it.
  GK.overkill = function (rs) {
    if (!rs || !isFinite(rs.target) || rs.target <= 0) return null;
    const r = rs.total / rs.target;
    if (r >= 3) return { tier: 3, label: 'OVERKILL ×3', v: 4 };
    if (r >= 2) return { tier: 2, label: 'OVERKILL ×2', v: 2 };
    if (r >= 1.5) return { tier: 1, label: 'Overkill ×1.5', v: 1 };
    return null;
  };

  // ---------- bonus balls ----------
  // Win a round with frames to spare and each unused frame (up to 3) becomes a bonus ball at a
  // fresh rack of gold pins. Every 4 pins pay $1, and a strike pays $1 more.
  GK.BONUS_MAX = 3;
  GK.bonusCount = run => (run.practice || !run.rs) ? 0 : Math.min(GK.BONUS_MAX, Math.max(0, run.rs.framesMax - run.rs.frameIdx));
  GK.bonusPay = pins => Math.floor(pins / 4) + (pins >= 10 ? 1 : 0);
  GK.bonusSim = function (run, i) {
    const rs = run.rs;
    return new GK.Sim({ lane: GK.laneFor(run), rng: GK.stream(run.seed, 'bonus:' + run.alley + ':' + run.round + ':' + i), rack: Array(10).fill('gold'), wear: rs.wear || GK.newWear() });
  };
  GK.bonusLaunch = function (run, sim, ballIdx, prm) {
    const eq = GK.equipMods(run), ball = run.bag[ballIdx] || run.bag[0];
    const dr = GK.DRILLS[ball.drill || 'stock'] || GK.DRILLS.stock;
    sim.launch(ball, Object.assign({}, prm, { speed: GK.clamp(prm.speed * eq.speed, 120, 560) }), { hook: eq.hook * (dr.hook || 1), flare: !!dr.flare });
  };
  // After a bonus ball settles: count the gold pins and bank the cash for the payout screen.
  GK.bonusResult = function (run, sim) {
    const pins = sim.pins.filter(p => !p.standing).length, pay = GK.bonusPay(pins);
    const rs = run.rs;
    rs.bonusPay = (rs.bonusPay || 0) + pay; rs.bonusPins = (rs.bonusPins || 0) + pins; rs.bonusThrown = (rs.bonusThrown || 0) + 1;
    return { pins, pay, strike: pins >= 10 };
  };
})();
