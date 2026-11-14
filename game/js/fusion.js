// Ball fusion: at the Fusion Lab, melt a second ball into one of yours. The donor is gone; the
// kept ball still rolls the way it always did, but becomes a fusion of the two.
// Every pair has its own fusion, and order matters (Ghost + Bomb isn't Bomb + Ghost):
//  - the kept ball brings a TRIGGER (what it counts on its roll),
//  - the melted ball brings a PAYOFF (what each count is worth),
//  - the name is the kept ball's adjective + the melted ball's noun.
// All 44 triggers and all 44 payoffs differ, so all 1,892 pairings are different.
(function () {
  const GK = globalThis.GK;
  const strike = k => GK.isStrikeKind(k), spare = k => GK.isSpareKind(k);
  const special = r => (r.down || []).filter(d => d.type && d.type !== 'std').length;
  const CAP = 12; // a payoff applies at most 12 times per roll (6 for multipliers)

  // [adjective, trigger text, count(roll, frame ctx, roll index)]
  GK.FUSE_TRIGGER = {
    house: ['Classic', 'Every pin it knocks down', r => r.pins],
    split: ['Forked', '4 times on a Split conversion', (r, c) => c.kind === 'split' ? 4 : 0],
    ghost: ['Spectral', 'Each of its first 3 pins', r => Math.min(3, r.pins)],
    feather: ['Airy', 'Every pin-on-pin knockdown', r => r.carry],
    lead: ['Leaden', '3 times if 8 or more pins fall', r => r.pins >= 8 ? 3 : 0],
    bouncer: ['Springy', 'Every time it bounces off a gutter edge', r => r.ballBounces],
    bomb: ['Volatile', 'Every pin blasted', r => r.blasted],
    ice: ['Frozen', '4 times on a strike', (r, c) => strike(c.kind) ? 4 : 0],
    mirror: ['Mirrored', 'Twice if an even number of pins fall', r => r.pins > 0 && r.pins % 2 === 0 ? 2 : 0],
    echo: ['Echoing', 'Every pin your second ball knocks down', (r, c, ri) => ri > 0 ? r.pins : 0],
    glass: ['Crystal', '3 times on a PERFECT throw', r => r.perfect ? 3 : 0],
    golden: ['Gilded', 'Every $10 you hold', (r, c) => Math.floor(Math.max(0, c.run.money) / 10)],
    cluster: ['Scattered', 'Every pin, if 9 or more fall', r => r.pins >= 9 ? r.pins : 0],
    blackhole: ['Void', 'Every pin it swallows', r => r.swallowed],
    snake: ['Slithering', 'Every 4 boards it crosses', r => Math.floor((r.boards || 0) / 4)],
    lucky7: ['Lucky', '7 times if exactly 7 pins fall', r => r.pins === 7 ? 7 : 0],
    magnet: ['Magnetic', 'Every pin it hits directly', r => r.direct || 0],
    tiny: ['Pocket', '3 times if it hits the headpin first', r => r.firstPin === 1 ? 3 : 0],
    giant: ['Colossal', 'Every 2 pins it knocks down', r => Math.floor(r.pins / 2)],
    pinball: ['Tumbling', 'Every wall bang', r => r.walls],
    disco: ['Groovy', 'Every pin that falls late', r => r.late],
    boomerang: ['Returning', 'Every pin past the 5th', r => Math.max(0, r.pins - 5)],
    sticky: ['Sticky', 'Each of its first 3 pin-on-pin knockdowns', r => Math.min(3, r.carry)],
    rubber: ['Rubbery', 'Every bounce off a pin', r => r.rubber || 0],
    paint: ['Painted', 'Every special pin it knocks down', r => special(r)],
    pendulum: ['Swinging', 'Every PERFECT throw in your current streak', (r, c) => c.run.stats ? c.run.stats.pstreak || 0 : 0],
    twin: ['Twin', 'Twice if 5 or more pins fall', r => r.pins >= 5 ? 2 : 0],
    lightning: ['Electric', 'Every pin that falls within half a second', r => r.fast],
    snowball: ['Rolling', 'Every frame bowled so far this round', (r, c) => c.frameIdx + 1],
    wrecking: ['Wrecking', '4 times on the last frame of a round', (r, c) => c.lastFrame ? 4 : 0],
    duster: ['Dusty', '3 times on a Spare or Split conversion', (r, c) => spare(c.kind) ? 3 : 0],
    bubble: ['Floating', 'Every board it crosses past 10', r => Math.max(0, (r.boards || 0) - 10)],
    jelly: ['Wobbly', 'Every pin that wobbled this frame', (r, c) => c.wobbles || 0],
    chain: ['Chained', 'Every charm you hold', (r, c) => c.run.charms ? c.run.charms.length : 0],
    spiked: ['Spiked', 'Every pin it knocks down in an Open frame', (r, c) => c.kind === 'open' ? r.pins : 0],
    neonball: ['Neon', 'Every pin that ends up in a gutter', r => r.gutterPins || 0],
    moon: ['Lunar', 'Every pin that flies into the pit', r => r.pit],
    twohander: ['Two-Fisted', '3 times on a pocket hit', r => r.pocket ? 3 : 0],
    loftduck: ['Lofted', 'Every strike in your current streak', (r, c) => c.run.rs ? c.run.rs.streak || 0 : 0],
    wideswing: ['Wide', 'Every ball in your bag', (r, c) => c.run.bag ? c.run.bag.length : 0],
    anchor: ['Anchored', 'Twice on every roll', () => 2],
    gyro: ['Spinning', 'Every 3 strikes you\'ve rolled this run', (r, c) => Math.floor((c.run.stats ? c.run.stats.strikes : 0) / 3)],
    black_pearl: ['Abyssal', 'Every 10% of hook on the dial', (r, c) => Math.round((c.maxHook || 0) * 10)],
    grenade: ['Explosive', '3 times per explosion', r => 3 * (r.explosions || 0)]
  };
  // [noun, payoff text, apply(s, n)]
  const P = (v, u) => ['chips', v, '+' + v + ' Points'];
  const PM = v => ['mult', v, '+' + v + ' Mult'];
  const PX = v => ['xmult', v, '×' + v + ' Mult'];
  const PAY = {
    house: ['Standard', P(8)], split: ['Splitter', PM(2)], ghost: ['Phantom', P(20)], feather: ['Plume', PM(1)],
    lead: ['Anvil', PX(1.1)], bouncer: ['Pogo', P(15)], bomb: ['Blast', PX(1.06)], ice: ['Glacier', P(12)],
    mirror: ['Reflection', PM(3)], echo: ['Reverb', P(10)], glass: ['Prism', PX(1.12)], golden: ['Nugget', ['money', 3, '$1 for every 3']],
    cluster: ['Swarm', P(5)], blackhole: ['Singularity', PX(1.2)], snake: ['Viper', P(6)], lucky7: ['Jackpot', PX(1.07)],
    magnet: ['Lodestone', P(25)], tiny: ['Atom', PM(0.5)], giant: ['Titan', P(30)], pinball: ['Flipper', PX(1.04)],
    disco: ['Fever', PM(4)], boomerang: ['Return', P(18)], sticky: ['Tar Pit', ['both', [1, 5], '+1 Mult and +5 Points']], rubber: ['Superball', P(14)],
    paint: ['Masterpiece', PX(1.15)], pendulum: ['Metronome', PX(1.03)], twin: ['Gemini', ['both', [1, 10], '+1 Mult and +10 Points']], lightning: ['Bolt', PX(1.08)],
    snowball: ['Avalanche', P(9)], wrecking: ['Demolisher', P(40)], duster: ['Sweeper', P(11)], bubble: ['Balloon', PM(1.5)],
    jelly: ['Gummy', P(16)], chain: ['Shackle', ['money', 4, '$1 for every 4']], spiked: ['Porcupine', P(22)], neonball: ['Blacklight', PM(2.5)],
    moon: ['Eclipse', P(35)], twohander: ['Outsider', PX(1.25)], loftduck: ['Goose', PM(5)], wideswing: ['Hurricane', P(13)],
    anchor: ['Dreadnought', P(50)], gyro: ['Tornado', PX(1.09)], black_pearl: ['Kraken', PM(0.75)], grenade: ['Shrapnel', PX(1.18)]
  };
  GK.FUSE_PAYOFF = PAY;
  const apply = (p, s, n, label) => {
    const [kind, v] = p;
    if (kind === 'chips') s.chips(v * n, label);
    else if (kind === 'mult') s.mult(Math.round(v * n * 100) / 100, label);
    else if (kind === 'xmult') s.xmult(Math.round(Math.pow(v, n) * 1000) / 1000, label);
    else if (kind === 'money') { const m = Math.floor(n / v); if (m) s.money(m, label); }
    else if (kind === 'both') { s.mult(v[0] * n, label); s.chips(v[1] * n, label); }
  };
  // The fusion of a kept ball and a melted one.
  GK.fusionOf = function (base, donor) {
    const T = GK.FUSE_TRIGGER[base], D = PAY[donor];
    if (!T || !D) return null;
    const name = T[0] + ' ' + D[0], cap = D[1][0] === 'xmult' ? 6 : CAP; // multipliers compound, so they stop sooner
    const open = /^Every/.test(T[1]); // a count that can run high gets its cap spelled out
    return {
      name,
      desc: T[1] + ': ' + D[1][2] + (D[1][0] === 'money' ? '' : ' each') + (open ? ' (up to ' + cap + ' times a roll)' : '') + '.',
      score: (r, s, c, ri) => { const n = Math.min(cap, Math.max(0, Math.floor(T[2](r, c, ri) || 0))); if (n) apply(D[1], s, n, 'Fused ' + name + ' ×' + n); }
    };
  };
  // Kept for the Collection and older saves: every ball can be fused.
  GK.FUSION = GK.FUSE_TRIGGER;
  GK.FUSE_COST = 8;
  GK.fuseCost = (run, free) => free ? 0 : GK.price(run, GK.FUSE_COST);
  GK.fusedName = b => { const f = b && b.fused && GK.fusionOf(b.type, b.donor || 'house'); return f ? f.name : null; };
  GK.fusedDesc = b => { const f = b && b.fused && GK.fusionOf(b.type, b.donor || 'house'); return f ? f.desc : null; };
  // Melt bag[donor] into bag[base].
  GK.fuseBalls = function (run, base, donor, free) {
    const a = run.bag[base], b = run.bag[donor];
    if (!a || !b || base === donor) return { ok: false, msg: 'Pick two different balls.' };
    if (a.fused) return { ok: false, msg: 'That ball is already fused.' };
    const F = GK.fusionOf(a.type, b.type);
    if (!F) return { ok: false, msg: 'Those two won\'t fuse.' };
    const cost = GK.fuseCost(run, free);
    if (!GK.canAfford(run, cost)) return { ok: false, msg: 'Not enough money.' };
    run.money -= cost;
    a.fused = true; a.donor = b.type;
    if (!a.ed && b.ed) a.ed = b.ed; // a donor's edition carries over
    run.bag.splice(donor, 1);
    if (run.rs && run.rs.stuck) run.rs.stuck = null;
    return { ok: true, fusion: a.type + '+' + b.type, msg: GK.BALLS[b.type].full + ' melted into your ' + GK.BALLS[a.type].full + ': it\'s now the ' + F.name + '!' };
  };
  GK.FUSION_COUNT = () => { const k = Object.keys(GK.FUSE_TRIGGER); return k.length * (k.length - 1); };

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
