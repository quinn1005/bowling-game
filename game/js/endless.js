// Gutter Kings — endless mode (v1.1): seven endless-only alleys with nastier lanes and much
// harder bosses, Endless Medals, corrupted charms and the Regulars' depth board.
// Loaded after progress.js; overrides alleyDef/bossFor for endless alleys.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- bosses ----------
  Object.assign(GK.BOSSES, {
    foreman: { name: 'The Demolition Foreman', desc: 'Knocks a new hole in the lane every frame. Balls that roll over a hole are gone.', endless: true },
    scrapper: { name: 'The Scrapper', desc: 'Every pin you knock down has a 1 in 3 chance to be hauled off before it scores.', endless: true },
    kraken: { name: 'The Kraken', desc: 'Three tentacles on each side take turns slamming down across the lane, reaching past the middle. At least one is always down. Watch the shadows and thread your ball through the gap on the far side.', endless: true },
    angler: { name: 'The Angler', desc: 'Pitch black. Only a wandering lure light shows part of the deck.', endless: true },
    poltergeist: { name: 'The Poltergeist', desc: 'After your first roll, the pins left standing are flung to new spots on the deck.', endless: true },
    banshee: { name: 'The Banshee', desc: 'Her scream scrambles the order of your charms every frame.', endless: true },
    magma: { name: 'The Magma King', desc: 'The lane heats up every frame: the oil burns away and your ball hooks harder and harder.', endless: true },
    ash: { name: 'The Ash Cloud', desc: 'Ash covers the lane. You can\'t see the oil pattern, on the lane or on the lane map.', endless: true },
    wind: { name: 'The Wind Spirit', desc: 'Strong side gusts sweep across the lane, changing direction as your ball rolls.', endless: true },
    thunderbird: { name: 'The Thunderbird', desc: 'After your first roll, lightning strikes 2 of your knocked pins back up.', endless: true },
    clockmaker: { name: 'The Clockmaker', desc: 'All four sliders run twice as fast, and speed up every frame.', endless: true },
    fathertime: { name: 'Old Father Time', desc: 'A 6-second shot clock on every throw: when it runs out, the ball rolls as the sliders stand. And each frame one of your charms falls asleep and does nothing.', endless: true },
    hollow: { name: 'The Hollow King', desc: 'Steals your two most valuable charms and one of your trophies for this match.', endless: true },
    echo: { name: 'The Echo', desc: 'Repeats your best frame from the last round. Any frame that doesn\'t beat it scores half.', endless: true }
  });

  // ---------- endless alleys ----------
  // After the Gutter King: the first six in order, then The Void forever.
  GK.ENDLESS_ALLEYS = [
    { name: 'The Bowl-o-Rama Wreck', sub: 'CONDEMNED · ENTER AT OWN RISK', lane: { holeCount: 3, oil: 'sport' },
      theme: { carpet: '#14110e', c1: '#2a221a', c2: '#3e3226', mask: '#1a1510', sign: '#ff9a3c', signSh: '#3a1a08', subc: '#a88a6a', wood: ['#8a6a48', '#7e6142', '#94724e', '#76593c', '#866646'] },
      laneDesc: 'Half the lane has caved in. Roll over a hole and your ball is gone.', bosses: ['foreman', 'scrapper'] },
    { name: 'Deep Sea Lanes', sub: '20,000 LEAGUES UNDER THE ALLEY', lane: { deep: true, oil: 'long' },
      theme: { carpet: '#04121a', c1: '#08283a', c2: '#0e4058', mask: '#061a26', sign: '#5ae0ff', signSh: '#04283a', subc: '#5aa8c8', wood: ['#5a8a8a', '#548484', '#609090', '#4e7e7e', '#588888'] },
      laneDesc: 'Underwater: your throws are slower and a current pushes the pins around.', bosses: ['kraken', 'angler'] },
    { name: 'The Haunted Hall', sub: 'NOBODY LEAVES · NOBODY BOWLS', lane: { haunted: true, dark: true, oil: 'shark' },
      theme: { carpet: '#0e0a14', c1: '#1e1428', c2: '#2e1e3e', mask: '#140e1c', sign: '#b8ffb0', signSh: '#1a3a1a', subc: '#8a7aa8', wood: ['#6a5a7a', '#645474', '#706080', '#5e4e6e', '#685878'] },
      laneDesc: 'Ghost pins phase in and out: some of your pins are Phantom pins every frame.', bosses: ['poltergeist', 'banshee'] },
    { name: 'Volcano Lanes', sub: 'MIND THE LAVA · NO REFUNDS', lane: { lava: true, oil: 'short' },
      theme: { carpet: '#1a0804', c1: '#3a1006', c2: '#6a1a08', mask: '#240a04', sign: '#ff6a2a', signSh: '#4a0a00', subc: '#ffb05a', wood: ['#5a3a2a', '#543626', '#603e2e', '#4e3222', '#583828'] },
      laneDesc: 'Lava gutters: a ball that falls in burns up for the rest of the round.', bosses: ['magma', 'ash'] },
    { name: 'Sky Lanes', sub: 'MIND THE EDGE · 30,000 FT', lane: { sky: true, oil: 'house' },
      theme: { carpet: '#0a1a2e', c1: '#1a3a5e', c2: '#3a6a9e', mask: '#10243e', sign: '#ffffff', signSh: '#1a3a6a', subc: '#bfe4ff', wood: ['#e8d8c0', '#e2d2ba', '#eedec6', '#dccbb4', '#e6d6be'] },
      laneDesc: 'A lane on a floating island. No gutters: off the edge, the ball is gone.', bosses: ['wind', 'thunderbird'] },
    { name: 'The Clockwork Tower', sub: 'TICK · TOCK · STRIKE', lane: { posts: true, gears: true, oil: 'sport' },
      theme: { carpet: '#120e06', c1: '#2a2010', c2: '#5a4418', mask: '#1a1408', sign: '#ffd46a', signSh: '#3a2a08', subc: '#c8a05a', wood: ['#a8844a', '#a07e46', '#b08a4e', '#987842', '#a48248'] },
      laneDesc: 'Brass gears turn across the lane.', bosses: ['clockmaker', 'fathertime'] },
    { name: 'The Void', sub: 'THERE IS NO LANE 8', lane: { voidPull: true, dark: true, lhw: 18, oil: 'shark' },
      theme: { carpet: '#000000', c1: '#06030c', c2: '#140a24', mask: '#030106', sign: '#c88aff', signSh: '#1a0a3a', subc: '#7a5aa8', wood: ['#1a1428', '#161224', '#1e182c', '#141020', '#1c1628'] },
      laneDesc: 'The edges of the lane pull your ball outward, toward nothing.', bosses: ['hollow', 'echo'] }
  ];
  GK.endlessIndex = run => run.alley - GK.ALLEY_COUNT - 1;
  GK.endlessAlley = run => GK.ENDLESS_ALLEYS[Math.min(GK.endlessIndex(run), GK.ENDLESS_ALLEYS.length - 1)];
  const baseDef = GK.alleyDef, baseBoss = GK.bossFor;
  GK.alleyDef = function (run) {
    if (!GK.isEndless(run)) return baseDef(run);
    const a = GK.endlessAlley(run);
    return Object.assign({}, a, { name: 'Endless ' + (run.alley - GK.ALLEY_COUNT) + ': ' + a.name, endlessIdx: Math.min(GK.endlessIndex(run), GK.ENDLESS_ALLEYS.length - 1) });
  };
  GK.bossFor = function (run) {
    if (!GK.isEndless(run) || (run.bossOverride && run.bossOverride.alley === run.alley)) return baseBoss(run);
    const a = GK.endlessAlley(run);
    return a.bosses[GK.stream(run.seed, 'eboss:' + run.alley).int(a.bosses.length)];
  };
  // Endless targets climb hard: these alleys are meant for builds that already beat the King.
  GK.ENDLESS_TARGET = { base: 0.8, growth: 1.85 };

  // The Kraken's tentacles: 3 per side, each slamming across the lane on its own random schedule.
  // A slam winds up (the tentacle rears back and its shadow darkens the lane), comes down and lies
  // across the lane as a wall for a moment, then pulls back into the gutter.
  GK.TENTACLE = { wind: 0.5, down: 1.5, back: 0.45, thick: 2.2 };
  // One shared schedule: each slam lands before the one before it lifts, so there is never a
  // moment with every tentacle up. Which tentacle slams next is random (never one that is still
  // busy), and a downed tentacle reaches past the middle of the lane: the only way through is the
  // far side.
  GK.makeTentacles = function (rng, lhw) {
    const T = GK.TENTACLE, out = [];
    [[-1, [90, 160, 230]], [1, [125, 195, 262]]].forEach(([side, zs]) => zs.forEach(z => out.push({ side, z, reach: lhw * (1.2 + rng() * 0.15), ph: rng() * 6.28, slams: [] })));
    const busyUntil = out.map(() => -99);
    let s = -0.6; // already down when the frame starts
    while (s < 180) {
      const free = out.map((tn, k) => k).filter(k => busyUntil[k] <= s - T.wind);
      const k = free.length ? free[Math.floor(rng() * free.length)] : busyUntil.indexOf(Math.min(...busyUntil));
      out[k].slams.push(+s.toFixed(2));
      busyUntil[k] = s + T.down + T.back;
      s += 0.6 + rng() * 0.7; // always sooner than T.down, so the next one lands before this one lifts
    }
    return out;
  };
  // { phase: 'idle' | 'wind' | 'down' | 'back', k: 0..1 progress through that phase, since: seconds since impact }
  GK.tentacleState = function (tn, t) {
    const T = GK.TENTACLE;
    for (const s of tn.slams) {
      if (t < s - T.wind) break;
      if (t < s) return { phase: 'wind', k: (t - (s - T.wind)) / T.wind };
      if (t < s + T.down) return { phase: 'down', k: (t - s) / T.down, since: t - s };
      if (t < s + T.down + T.back) return { phase: 'back', k: (t - s - T.down) / T.back };
    }
    return { phase: 'idle', k: 0 };
  };

  // Lane holes for the Bowl-o-Rama Wreck (and one more every frame against the Foreman).
  GK.makeHoles = function (run, n, tag) {
    const r = GK.stream(run.seed, 'holes:' + run.alley + ':' + run.round + ':' + tag), L = (GK.laneFor(run).lhw || GK.C.LHW) - 4;
    const out = [];
    for (let i = 0; i < n; i++) out.push({ x: +((r() * 2 - 1) * L).toFixed(1), z: Math.round(70 + r() * 170), r: 3.4 });
    return out;
  };

  // ---------- Endless Medals ----------
  // Every 3 endless alleys reached earns a permanent medal: XP, and medal-only cosmetics.
  GK.medalsFor = run => GK.isEndless(run) ? Math.floor((run.alley - GK.ALLEY_COUNT - 1) / 3) : 0;
  GK.checkMedal = function (meta, run) {
    const m = GK.medalsFor(run), have = meta.medals || 0;
    if (m <= have) return null;
    meta.medals = m;
    const xp = GK.addXP(meta, 150 * (m - have));
    return { medals: m, xp };
  };
  GK.COSMETICS.push(
    { kind: 'trail', id: 'void', name: 'Void swirl', level: 1, medals: 1 },
    { kind: 'pins', id: 'obsidian', name: 'Obsidian Trim', level: 1, medals: 2, body: '#f0eef4', shade: '#c8c4d0', band: '#2a1a4a' },
    { kind: 'lane', id: 'void', name: 'Void', level: 1, medals: 3, tint: 'rgba(90,40,160,0.45)', mode: 'color', grid: '#c88aff' }
  );
  const canWear = GK.canWear;
  GK.canWear = (meta, c) => c.medals ? (meta.medals || 0) >= c.medals : canWear(meta, c);

  // ---------- corrupted charms ----------
  // Endless shops sometimes sell a corrupted charm: it triggers twice every frame, but costs $1
  // a frame to keep, and sells for nothing.
  GK.CORRUPT_CHANCE = 0.3;

  // ---------- the Regulars' depth board ----------
  GK.REGULARS_DEPTH = [
    { who: 'kaleb', name: 'Kaleb', depth: 2 },
    { who: 'levi', name: 'Levi', depth: 4 },
    { who: 'quinn', name: 'Quinn', depth: 7 }
  ];
  GK.beatDepth = function (meta, depth) {
    meta.beatDepth = meta.beatDepth || {};
    const out = GK.REGULARS_DEPTH.filter(r => depth > r.depth && !meta.beatDepth[r.who]);
    out.forEach(r => { meta.beatDepth[r.who] = 1; });
    return out;
  };
})();
