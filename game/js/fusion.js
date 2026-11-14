// Ball fusion: at the Fusion Lab, melt a second ball into one of yours. The donor is gone; the
// base keeps how it rolls and becomes its fused form, which every ball has one of, each with its
// own name and bonus. A fused ball can't be fused again.
(function () {
  const GK = globalThis.GK;
  const strike = k => GK.isStrikeKind(k), spare = k => GK.isSpareKind(k);
  const special = r => r.down.filter(d => d.type && d.type !== 'std').length;
  // id: [fused name, what it adds, score(roll, s, frame ctx)]
  GK.FUSION = {
    house: ['Pro Stock', '+40 Points and +4 Mult on its roll.', (r, s) => { s.chips(40); s.mult(4); }],
    split: ['Splitter Supreme', '+2 Mult per pin it knocks down, ×2 Mult on a Split conversion.', (r, s, c) => { if (r.pins) s.mult(2 * r.pins); if (c.kind === 'split') s.xmult(2); }],
    ghost: ['Poltergeist', '+90 Points on its roll, ×1.5 Mult if it knocks down 7 or more.', (r, s) => { s.chips(90); if (r.pins >= 7) s.xmult(1.5); }],
    feather: ['Phoenix Feather', '+3 Mult for every pin-on-pin knockdown on its roll.', (r, s) => r.carry && s.mult(3 * r.carry)],
    lead: ['Tungsten', '×2 Mult on its roll, which more than cancels its ×0.5 Points.', (r, s) => s.xmult(2)],
    bouncer: ['Super Bouncer', '+20 Points and +1 Mult for every wall bounce.', (r, s) => { if (r.ballBounces) { s.chips(20 * r.ballBounces); s.mult(r.ballBounces); } }],
    bomb: ['Nuke', '×2 Mult if it exploded, and +10 Points per pin blasted.', (r, s) => { if (r.blasted) s.chips(10 * r.blasted); if (r.explosions) s.xmult(2); }],
    ice: ['Glacier', '+15 Points per pin it knocks down, ×1.5 Mult on a strike.', (r, s, c) => { if (r.pins) s.chips(15 * r.pins); if (strike(c.kind)) s.xmult(1.5); }],
    mirror: ['Looking Glass', '×1.5 Mult if an even number of pins fell on its roll (perfect symmetry).', (r, s) => r.pins && !(r.pins % 2) && s.xmult(1.5)],
    echo: ['Resonance', '+20 Points per pin it knocks down.', (r, s) => r.pins && s.chips(20 * r.pins)],
    glass: ['Crystal', 'Never shatters, and ×1.5 Mult more on its roll.', (r, s) => s.xmult(1.5)],
    golden: ['Midas', 'Also scores pin Points again: +10 Points per pin, and $1 more on a strike.', (r, s, c) => { if (r.pins) s.chips(10 * r.pins); if (strike(c.kind)) s.money(1); }],
    cluster: ['Meteor Shower', '+2 Mult per pin its marbles knock down.', (r, s) => r.pins && s.mult(2 * r.pins)],
    blackhole: ['Singularity', '×1.25 Mult for every pin it swallows.', (r, s) => r.swallowed && s.xmult(Math.pow(1.25, r.swallowed))],
    snake: ['Viper', '+3 Points per board it crosses, ×1.5 Mult on a strike.', (r, s, c) => { if (r.boards) s.chips(3 * r.boards); if (strike(c.kind)) s.xmult(1.5); }],
    lucky7: ['Jackpot 777', '×3 Mult if its roll knocks down exactly 7 pins.', (r, s) => r.pins === 7 && s.xmult(3)],
    magnet: ['Lodestone', '+2 Mult per pin it hits directly.', (r, s) => r.direct && s.mult(2 * r.direct)],
    tiny: ['Atom', '+3 Mult per pin it hits directly.', (r, s) => r.direct && s.mult(3 * r.direct)],
    giant: ['Titan', '×1.7 Mult on its roll, which more than cancels its ×0.6 Points.', (r, s) => s.xmult(1.7)],
    pinball: ['Tilt', '+1 Mult for every wall bang and pin-on-pin knockdown.', (r, s) => { const n = r.walls + r.carry; if (n) s.mult(n); }],
    disco: ['Saturday Night', '+4 Mult per pin that falls late, doubled on dark lanes.', (r, s, c) => r.late && s.mult(4 * r.late * (c.dark ? 2 : 1))],
    boomerang: ['Return to Sender', '+30 Points on its roll, ×1.5 Mult on a strike.', (r, s, c) => { s.chips(30); if (strike(c.kind)) s.xmult(1.5); }],
    sticky: ['Fly Paper', '+30 Points for every pin-on-pin knockdown.', (r, s) => r.carry && s.chips(30 * r.carry)],
    rubber: ['Superball', '+15 Points and +1 Mult every time it bounces off a pin.', (r, s) => { if (r.rubber) { s.chips(15 * r.rubber); s.mult(r.rubber); } }],
    paint: ['Masterpiece', '+40 Points for each special pin it knocks down.', (r, s) => { const n = special(r); if (n) s.chips(40 * n); }],
    pendulum: ['Metronome', '+2 Mult for every PERFECT throw in your current streak.', (r, s, c) => { const n = c.run.stats ? c.run.stats.pstreak || 0 : 0; if (n) s.mult(2 * n); }],
    twin: ['Triplets', '+50 Points and +1 Mult per pin on its roll.', (r, s) => { s.chips(50); if (r.pins) s.mult(r.pins); }],
    lightning: ['Thunderbolt', '+3 Mult for each pin that falls within half a second.', (r, s) => r.fast && s.mult(3 * r.fast)],
    snowball: ['Avalanche', '+4 Points per pin for every frame bowled so far this round.', (r, s, c) => r.pins && s.chips(4 * r.pins * (c.frameIdx + 1))],
    wrecking: ['Demolisher', '×2 Mult on a strike.', (r, s, c) => strike(c.kind) && s.xmult(2)],
    duster: ['Street Sweeper', '+15 Points per pin-on-pin knockdown, ×1.25 Mult on a spare.', (r, s, c) => { if (r.carry) s.chips(15 * r.carry); if (spare(c.kind)) s.xmult(1.25); }],
    bubble: ['Hot Air', '+1 Mult for every board it crosses past 10.', (r, s) => r.boards > 10 && s.mult(r.boards - 10)],
    jelly: ['Gummy', '+25 Points and +1 Mult for every pin that falls late.', (r, s) => { if (r.late) { s.chips(25 * r.late); s.mult(r.late); } }],
    chain: ['Shackles', '+2 Mult per pin-on-pin knockdown.', (r, s) => r.carry && s.mult(2 * r.carry)],
    spiked: ['Porcupine', '+10 Points per pin, ×1.5 Mult if 6 or more fall on its roll.', (r, s) => { if (r.pins) s.chips(10 * r.pins); if (r.pins >= 6) s.xmult(1.5); }],
    neonball: ['Blacklight', 'Glowing pins give +3 Mult each instead of +1.', (r, s) => r.pins && s.mult(2 * r.pins)],
    moon: ['Full Moon', '+30 Points for every pin that floats into the pit.', (r, s) => r.pit && s.chips(30 * r.pit)],
    twohander: ['Two-Hander Prime', '×1.5 Mult on any strike, from any line.', (r, s, c) => strike(c.kind) && s.xmult(1.5)],
    loftduck: ['Golden Goose', '+2 Mult for every pin that falls late.', (r, s) => r.late && s.mult(2 * r.late)],
    wideswing: ['Haymaker', '+1 Mult for every 3 boards it crosses.', (r, s) => r.boards >= 3 && s.mult(Math.floor(r.boards / 3))],
    anchor: ['Dreadnought', '+5 Mult on its roll, every roll.', (r, s) => s.mult(5)],
    gyro: ['Tornado', '+20 Points per pin, ×1.25 Mult on a strike.', (r, s, c) => { if (r.pins) s.chips(20 * r.pins); if (strike(c.kind)) s.xmult(1.25); }],
    black_pearl: ['Davy Jones', '×1.5 Mult when your hook is over 50%.', (r, s, c) => c.maxHook > 0.5 && s.xmult(1.5)],
    grenade: ['Cluster Bomb', '+15 Points per pin blasted and +3 Mult per explosion.', (r, s) => { if (r.blasted) s.chips(15 * r.blasted); if (r.explosions) s.mult(3 * r.explosions); }]
  };
  GK.FUSE_COST = 8;
  GK.fuseCost = (run, free) => free ? 0 : GK.price(run, GK.FUSE_COST);
  GK.fusedName = b => b && b.fused && GK.FUSION[b.type] ? GK.FUSION[b.type][0] : null;
  // Melt bag[donor] into bag[base].
  GK.fuseBalls = function (run, base, donor, free) {
    const a = run.bag[base], b = run.bag[donor];
    if (!a || !b || base === donor) return { ok: false, msg: 'Pick two different balls.' };
    if (a.fused) return { ok: false, msg: 'That ball is already fused.' };
    if (!GK.FUSION[a.type]) return { ok: false, msg: 'That ball can\'t be fused.' };
    const cost = GK.fuseCost(run, free);
    if (!GK.canAfford(run, cost)) return { ok: false, msg: 'Not enough money.' };
    run.money -= cost;
    a.fused = true; a.donor = b.type;
    if (!a.ed && b.ed) a.ed = b.ed; // a donor's edition carries over
    run.bag.splice(donor, 1);
    if (run.rs && run.rs.stuck) run.rs.stuck = null;
    return { ok: true, msg: GK.BALLS[b.type].full + ' melted into your ' + GK.BALLS[a.type].full + ': it\'s now ' + GK.FUSION[a.type][0] + '!' };
  };

  // The Mad Scientist: a free fusion between rounds.
  GK.EVENTS.fusion_lab = { name: 'The Mad Scientist', desc: 'A lab coat, a blowtorch and no safety goggles. "Give me two balls and I\'ll make you one. Free of charge. Mostly legal."' };
  const prevExtras = GK.eventExtras, prevTake = GK.takeEvent2;
  GK.eventExtras = function (run, ev, rng) {
    if (ev.id === 'fusion_lab' && (run.bag.length < 2 || !run.bag.some(b => !b.fused))) return null;
    return prevExtras ? prevExtras(run, ev, rng) : ev;
  };
  GK.takeEvent2 = function (run, ev, arg) {
    if (ev.id === 'fusion_lab') return GK.fuseBalls(run, arg.base, arg.donor, true);
    return prevTake ? prevTake(run, ev, arg) : null;
  };
})();
