// Gutter Kings — all content as data: shots, balls, charms, pin types, consumables, equipment,
// memberships, alleys and bosses. Behaviour lives in physics.js (ball/pin physics flags) and
// scoring.js (score hooks). Charms subscribe to frame data built from the physics event log.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- shots ----------
  GK.SHOTS = {
    strike: { name: 'Strike', c: 30, m: 3, lv: [10, 1] },
    double: { name: 'Double', c: 45, m: 4, lv: [15, 1] },
    turkey: { name: 'Turkey', c: 70, m: 5, lv: [20, 2] },
    spare: { name: 'Spare', c: 15, m: 2, lv: [10, 1] },
    split: { name: 'Split conversion', c: 40, m: 4, lv: [20, 1] },
    open: { name: 'Open frame', c: 0, m: 1, lv: [8, 1] },
    gutter: { name: 'Gutter', c: 0, m: 0, lv: [15, 1] }
  };
  GK.SHOT_ORDER = ['strike', 'double', 'turkey', 'spare', 'split', 'open', 'gutter'];
  GK.isStrikeKind = k => k === 'strike' || k === 'double' || k === 'turkey';
  GK.isSpareKind = k => k === 'spare' || k === 'split';

  // Bonus chips from physics events (the "physics events are score" rule).
  GK.BONUS = { carry: 2, late: 3, wall: 1 };

  // ---------- editions (balls and charms) ----------
  GK.EDITIONS = {
    foil: { name: 'Foil', desc: '+30 Points', col: '#9fe8ff', chips: 30 },
    holo: { name: 'Holo', desc: '+6 Mult', col: '#ff9ef0', mult: 6 },
    neon: { name: 'Neon', desc: '×1.4 Mult', col: '#b6ff5c', xmult: 1.4 }
  };

  // ---------- balls ----------
  // m = mass, r = radius scale. Physics behaviour keyed by id in physics.js.
  GK.BALLS = {
    house: { name: 'House', full: 'House Ball', cost: 3, m: 6, col: '#2b4fb8', hi: '#86a6ff', desc: 'Standard weight and hook. The baseline every throw is tuned around.' },
    split: { name: 'Split', full: 'Split Ball', cost: 6, m: 6, col: '#d98a22', hi: '#ffd590', desc: 'Splits into two half-size balls on first contact.' },
    ghost: { name: 'Ghost', full: 'Ghost Ball', cost: 7, m: 6, col: '#b9c7d6', hi: '#ffffff', desc: 'Passes straight through the first 3 pins it touches.' },
    feather: { name: 'Feather', full: 'Featherweight', cost: 6, m: 2.4, col: '#d9609a', hi: '#ffc2dd', desc: 'Very light. +1 Mult every time a pin knocks over another pin.' },
    lead: { name: 'Lead', full: 'Lead Ball', cost: 6, m: 11, col: '#59626d', hi: '#c9d2dc', desc: 'Flattens every pin it touches. Points from its roll ×0.5.' },
    bouncer: { name: 'Bouncer', full: 'Bouncer', cost: 7, m: 5, col: '#2fb36a', hi: '#a6ffcb', desc: 'Bounces off the gutter edges instead of falling in. +6 Points per wall bounce.' },
    bomb: { name: 'Bomb', full: 'Bomb Ball', cost: 8, m: 6, col: '#2a2228', hi: '#ff6a3d', desc: 'Explodes on its 3rd pin contact, blasting everything nearby.' },
    ice: { name: 'Ice', full: 'Ice Ball', cost: 7, m: 6, col: '#7fd6ff', hi: '#e8fbff', desc: 'Never hooks. Bursts into 3 ice shards on first contact.' },
    mirror: { name: 'Mirror', full: 'Mirror Ball', cost: 9, m: 5, col: '#c0c6d0', hi: '#ffffff', desc: 'Rolls with a mirrored twin on the other side of the lane.' },
    echo: { name: 'Echo', full: 'Echo Ball', cost: 8, m: 6, col: '#7b5cff', hi: '#cbbdff', desc: 'A half-weight echo replays your exact throw a moment later.' },
    glass: { name: 'Glass', full: 'Glass Ball', cost: 7, m: 5, col: '#9be3e0', hi: '#ffffff', desc: '×2 Mult for its roll. 1 in 4 chance to shatter after the roll.', glass: true },
    golden: { name: 'Golden', full: 'Golden Ball', cost: 8, m: 7, col: '#e0b028', hi: '#fff1a8', desc: 'Earns $1 per pin knocked down. Its roll scores no pin Points.' },
    cluster: { name: 'Cluster', full: 'Cluster', cost: 9, m: 6, col: '#e2584a', hi: '#ffc1a8', desc: 'Throws 5 marbles in a spread instead of one ball.' },
    blackhole: { name: 'Black Hole', full: 'Black Hole', cost: 10, m: 8, col: '#120a1c', hi: '#b06bff', desc: 'Swallows pins it touches and pulls nearby pins in. Swallowed pins give ×2 Points.' },
    snake: { name: 'Snake', full: 'Snake Ball', cost: 8, m: 6, col: '#3d9b3a', hi: '#c8ff8a', desc: 'Slithers in an S-curve along your aim line, sweeping across extra boards until it hits a pin.' },
    lucky7: { name: 'Lucky 7', full: 'Lucky Seven', cost: 8, m: 6, col: '#1e8a4f', hi: '#ffe066', desc: 'If its roll knocks down exactly 7 pins, every charm triggers twice this frame.' },
    magnet: { name: 'Magnet', full: 'Magnet Ball', cost: 8, m: 6, col: '#c83a3a', hi: '#ff9a9a', desc: 'Steers itself toward the nearest standing pins until it hits one.' },
    tiny: { name: 'Tiny', full: 'Tiny Ball', cost: 6, m: 4, rs: 0.6, col: '#e8d24a', hi: '#fff7b0', desc: 'Small and light. +1 Mult for every pin it hits directly.' },
    giant: { name: 'Giant', full: 'Giant Ball', cost: 7, m: 10, rs: 1.45, col: '#7a3fb0', hi: '#d1a8ff', desc: 'Covers far more boards. Points from its roll ×0.6.' }
  };

  GK.STARTER_BAGS = [
    { id: 'classic', name: 'Classic Bag', balls: ['house', 'feather', 'lead'], desc: 'House, Featherweight and Lead. Chain reactions or brute force.' },
    { id: 'trick', name: 'Trick Bag', balls: ['house', 'split', 'bouncer'], desc: 'House, Split and Bouncer. Bank shots and wide coverage.' },
    { id: 'demo', name: 'Demolition Bag', balls: ['house', 'bomb', 'lead'], desc: 'House, Bomb and Lead. Blow up the rack, then flatten what is left.' },
    { id: 'gambler', name: 'Gambler\'s Bag', balls: ['house', 'glass', 'golden'], desc: 'House, Glass and Golden, plus $3 extra. High risk, high pay.', money: 3 }
  ];

  // ---------- pin types ----------
  GK.PINS = {
    std: { name: 'Standard', desc: '5 Points when knocked down.', chips: 5, body: '#f2ebe0', shade: '#d9cfc2', band: '#c4243a' },
    gold: { name: 'Gold Pin', desc: '5 Points and $1 when knocked down.', chips: 5, body: '#f2c94c', shade: '#c8932a', band: '#fff3b0' },
    glass: { name: 'Glass Pin', desc: '×1.25 Mult when knocked down. 1 in 4 breaks for good.', chips: 5, body: '#bfeff3', shade: '#7fc8d0', band: '#e8ffff', alpha: 0.78 },
    lead: { name: 'Lead Pin', desc: 'Heavy and hard to topple. 15 Points when knocked down.', chips: 15, body: '#8a929c', shade: '#5f666e', band: '#3a3f45', m: 4, topple: 1.8 },
    rubber: { name: 'Rubber Pin', desc: 'Super bouncy. +3 Points for each pin it bounces off.', chips: 5, body: '#ff7a59', shade: '#c9502f', band: '#2a1d22', e: 1.0 },
    explosive: { name: 'Explosive Pin', desc: 'Explodes when it falls, blasting nearby pins. 12 Points.', chips: 12, body: '#ff4d4d', shade: '#b52a2a', band: '#ffd447' },
    lucky: { name: 'Lucky Pin', desc: 'When knocked down: 1 in 4 for +5 Mult, 1 in 8 for $3.', chips: 5, body: '#7be38a', shade: '#3fa85a', band: '#ffffff' },
    phantom: { name: 'Phantom Pin', desc: 'Pins pass through it, only balls can hit it. +3 Mult when knocked down.', chips: 5, body: '#b58cff', shade: '#7c55c9', band: '#efe3ff', alpha: 0.65 },
    tiny: { name: 'Tiny Pin', desc: 'Small and hard to hit. 15 Points when knocked down.', chips: 15, body: '#f2ebe0', shade: '#c9bfb2', band: '#3a7bd5', r: 0.7 },
    wobbly: { name: 'Wobbly Pin', desc: 'Topples at the lightest touch. +2 Mult when it falls late.', chips: 5, body: '#f5d0e6', shade: '#d39aba', band: '#8a2be2', topple: 0.55 },
    none: { name: 'Empty Spot', desc: 'This spot has no pin.', chips: 0 }
  };

  // ---------- charms ----------
  // score(ctx, s, self): add effects via s.chips/s.mult/s.xmult/s.money.
  // after(ctx, self): runs once per frame after scoring (scaling counters).
  // round(run, self): end of a won round (economy), returns money.
  // flags: passive rule changes read by the game (frames, reracks, bumpers, wide, wild, retake, third, debt).
  const C = [];
  const add = (id, name, rarity, cost, tag, desc, o) => C.push(Object.assign({ id, name, rarity, cost, tag, desc }, o || {}));
  // Balance notes: flat +Points stay small, +Mult is the main lever, ×Mult is rare and conditional,
  // and scaling charms grow slowly. Costs rose so a full row of 5 charms takes most of a run.
  // +Points
  add('lucky_shoes', 'Lucky Shoes', 'common', 4, 'chips', '+20 Points every frame.', { score: (c, s) => s.chips(20) });
  add('chalk_bag', 'Chalk Bag', 'common', 5, 'chips', '+3 Points for every pin knocked down this frame.', { score: (c, s) => c.pins && s.chips(3 * c.pins) });
  add('corner_office', 'Corner Office', 'common', 5, 'chips', '+35 Points for each corner pin (7 or 10) knocked down.', { score: (c, s) => { const n = (c.down.has(7) ? 1 : 0) + (c.down.has(10) ? 1 : 0); if (n) s.chips(35 * n); } });
  add('headpin_hunter', 'Headpin Hunter', 'common', 5, 'chips', '+40 Points if the first pin your ball touches is the headpin.', { score: (c, s) => c.firstPin === 1 && s.chips(40) });
  add('domino', 'Domino Theory', 'common', 5, 'chips', '+5 Points for every pin that knocks over another pin.', { score: (c, s) => c.carry && s.chips(5 * c.carry) });
  add('bumper_kid', 'Bumper Kid', 'uncommon', 7, 'rule', 'Bumpers up: balls bounce off the gutters. +6 Points per ball bounce.', { flags: { bumpers: true }, score: (c, s) => c.ballBounces && s.chips(6 * c.ballBounces) });
  add('rail_rider', 'Rail Rider', 'uncommon', 6, 'chips', '+10 Points each time a pin bangs off a kickback wall.', { score: (c, s) => c.walls && s.chips(10 * c.walls) });
  add('pin_collector', 'Pin Collector', 'uncommon', 7, 'scaling', 'Gains +1 Point for every pin you knock down. (Currently +{v} Points)', { init: { v: 0 }, score: (c, s, me) => me.v && s.chips(me.v), after: (c, me) => { me.v += c.pins; } });
  // +Mult
  add('league_jacket', 'League Jacket', 'common', 5, 'mult', '+3 Mult every frame.', { score: (c, s) => s.mult(3) });
  add('spare_parts', 'Spare Parts', 'common', 5, 'mult', '+5 Mult on a Spare or Split conversion.', { score: (c, s) => GK.isSpareKind(c.kind) && s.mult(5) });
  add('strike_out', 'Strike Out', 'common', 5, 'mult', '+4 Mult on any Strike, Double or Turkey.', { score: (c, s) => GK.isStrikeKind(c.kind) && s.mult(4) });
  add('open_mic', 'Open Mic', 'common', 4, 'mult', '+6 Mult on an Open frame.', { score: (c, s) => c.kind === 'open' && s.mult(6) });
  add('gutter_punk', 'Gutter Punk', 'common', 4, 'mult', 'Gutter frames get +30 Points and +3 Mult.', { score: (c, s) => { if (c.kind === 'gutter') { s.chips(30); s.mult(3); } } });
  add('split_personality', 'Split Personality', 'uncommon', 6, 'mult', '+8 Mult on a Split conversion. +2 Mult whenever you leave a split.', { score: (c, s) => { if (c.kind === 'split') s.mult(8); else if (c.leftSplit) s.mult(2); } });
  add('thunderclap', 'Thunderclap', 'uncommon', 6, 'mult', '+1 Mult for each pin that falls within half a second of first contact.', { score: (c, s) => c.fast && s.mult(c.fast) });
  add('moon_shot', 'Moon Shot', 'uncommon', 6, 'mult', '+2 Mult for every pin that flies into the pit.', { score: (c, s) => c.pit && s.mult(2 * c.pit) });
  add('late_bloomer', 'Late Bloomer', 'uncommon', 6, 'mult', '+3 Mult for each pin that wobbles and falls late.', { score: (c, s) => c.late && s.mult(3 * c.late) });
  add('practice', 'Practice Lane', 'uncommon', 7, 'scaling', 'Gains +1 Mult each time you convert a Spare or Split. (Currently +{v} Mult)', { init: { v: 0 }, score: (c, s, me) => me.v && s.mult(me.v), after: (c, me) => { if (GK.isSpareKind(c.kind)) me.v += 1; } });
  add('graveyard', 'Graveyard Shift', 'uncommon', 7, 'scaling', '+1 Mult for every 3 pins knocked down earlier this round. (Currently +{v} Mult)', { init: { v: 0, p: 0 }, roundReset: true, score: (c, s, me) => me.v && s.mult(me.v), after: (c, me) => { me.p = (me.p || 0) + c.pins; me.v = Math.floor(me.p / 3); } });
  add('high_roller', 'High Roller', 'uncommon', 6, 'mult', '+1 Mult for every $5 you hold.', { score: (c, s) => { const n = Math.floor(Math.max(0, c.run.money) / 5); if (n) s.mult(n); } });
  // ×Mult
  add('tenth_frame', 'Tenth Frame', 'rare', 9, 'xmult', '×2 Mult on the last frame of each round.', { score: (c, s) => c.lastFrame && s.xmult(2) });
  add('hot_streak', 'Hot Streak', 'rare', 9, 'scaling', 'Gains ×0.25 Mult for each strike in a row; resets on anything else. (Currently ×{x})', { init: { v: 0 }, score: (c, s, me) => { const x = 1 + 0.25 * (me.v + (GK.isStrikeKind(c.kind) ? 1 : 0)); if (x > 1) s.xmult(x); }, after: (c, me) => { me.v = GK.isStrikeKind(c.kind) ? me.v + 1 : 0; }, show: me => (1 + 0.25 * me.v).toFixed(2) });
  add('pyromaniac', 'Pyromaniac', 'rare', 8, 'xmult', '×1.5 Mult if anything exploded this frame. +6 Points per pin blasted.', { score: (c, s) => { if (c.blasted) s.chips(6 * c.blasted); if (c.explosions) s.xmult(1.5); } });
  add('sniper', 'Sniper', 'rare', 8, 'xmult', '×2 Mult when you convert a spare by knocking down exactly one pin.', { score: (c, s) => GK.isSpareKind(c.kind) && c.lastRollPins === 1 && s.xmult(2) });
  add('seven_ten', '7-10 Club', 'rare', 8, 'xmult', '×1.5 Mult on Split conversions. Converting the 7-10 is ×4 and pays $6.', { score: (c, s) => { if (c.kind !== 'split') return; if (c.leave710) { s.xmult(4); s.money(6); } else s.xmult(1.5); } });
  add('butterfingers', 'Butterfingers', 'rare', 8, 'rule', 'Every throw gets a random wild hook. ×1.5 Mult.', { flags: { wild: true }, score: (c, s) => s.xmult(1.5) });
  add('copycat', 'Copycat', 'rare', 10, 'rule', 'Copies the charm to its right.', { copy: true });
  // Economy
  add('tip_jar', 'Tip Jar', 'common', 4, 'economy', 'Earn $1 for every Spare or Split conversion.', { score: (c, s) => GK.isSpareKind(c.kind) && s.money(1) });
  add('piggy_bank', 'Piggy Bank', 'common', 4, 'economy', 'Earn $1 for every Strike.', { score: (c, s) => GK.isStrikeKind(c.kind) && s.money(1) });
  add('pro_shop_pass', 'Pro Shop Pass', 'uncommon', 6, 'economy', 'Earn $2 at the end of every round you clear.', { round: () => 2 });
  add('loan_shark', 'Loan Shark', 'uncommon', 5, 'economy', 'You can spend down to -$15. Pay $2 at the end of each round.', { flags: { debt: 15 }, round: () => -2 });
  // Rule-breakers
  add('mulligan', 'Mulligan', 'uncommon', 7, 'rule', '+1 Re-rack every round.', { flags: { reracks: 1 } });
  add('refs_eye', 'Ref\'s Blind Eye', 'uncommon', 6, 'rule', 'Your first gutter ball each frame is retaken.', { flags: { retake: true } });
  add('wide_load', 'Wide Load', 'uncommon', 7, 'rule', 'Your balls are 30% wider.', { flags: { wide: 1.3 } });
  add('rebound', 'Rebound', 'uncommon', 6, 'rule', 'Your ball bounces back out of the gutter once per roll. That roll scores half Points.', { flags: { rebound: true } });
  add('pin_whisperer', 'Pin Whisperer', 'uncommon', 7, 'rule', 'After each roll, the first pin that wobbled but stayed up falls over.', { flags: { whisper: true } });
  add('chain_gang', 'Chain Gang', 'uncommon', 7, 'scaling', '+1 Mult for every 2 pins knocked down by other pins this round, growing as you go. (Currently +{v} Mult)', { init: { v: 0, p: 0 }, roundReset: true, score: (c, s, me) => { const n = Math.floor(((me.p || 0) + c.carry) / 2); if (n) s.mult(n); }, after: (c, me) => { me.p = (me.p || 0) + c.carry; me.v = Math.floor(me.p / 2); } });
  add('shoes_destiny', 'Shoes of Destiny', 'uncommon', 6, 'mult', '+4 Mult for each PERFECT throw this frame, -4 Mult for each throw that misses the zone.', { score: (c, s) => { const n = 4 * (c.perfects - c.misses); if (n) s.mult(n); } });
  add('overtime', 'Overtime', 'rare', 10, 'rule', '+1 Frame every round.', { flags: { frames: 1 } });
  add('third_roll', 'Third Roll', 'rare', 11, 'rule', 'Each frame gets a third roll if pins are still standing. Clearing on roll 3 still counts as a Spare.', { flags: { third: true } });
  GK.CHARMS = {}; C.forEach(c => { GK.CHARMS[c.id] = c; });
  GK.CHARM_LIST = C;
  GK.RARITY = { common: { w: 60, col: '#8fb3d9', name: 'Common' }, uncommon: { w: 30, col: '#7be38a', name: 'Uncommon' }, rare: { w: 10, col: '#ff5a6e', name: 'Rare' } };
  GK.TAG_GLYPH = { chips: '+P', mult: '+M', xmult: '×M', scaling: '↑', economy: '$', rule: '!' };

  // ---------- consumables ----------
  // kind: card (levels a shot), trick (targets pins/balls or the round), market (black market).
  // target: 'pin' | 'ball' | 'round' | 'charm' | null
  const K = [];
  const kadd = (id, name, kind, cost, desc, o) => K.push(Object.assign({ id, name, kind, cost, desc }, o || {}));
  GK.SHOT_ORDER.forEach(k => {
    const s = GK.SHOTS[k];
    kadd('card_' + k, s.name + ' Card', 'card', 4, 'Level up ' + s.name + ': +' + s.lv[0] + ' Points and +' + s.lv[1] + ' Mult.', { shot: k });
  });
  const pinTrick = (id, name, type) => kadd(id, name, 'trick', 5, 'Turn up to 2 pins in your rack into ' + GK.PINS[type].name + 's. ' + GK.PINS[type].desc, { target: 'pin', pinType: type, picks: 2 });
  pinTrick('t_gild', 'Gilder', 'gold');
  pinTrick('t_glaze', 'Glazier', 'glass');
  pinTrick('t_foundry', 'Foundry', 'lead');
  pinTrick('t_rubber', 'Rubberizer', 'rubber');
  pinTrick('t_keg', 'Powder Keg', 'explosive');
  pinTrick('t_clover', 'Four-Leaf', 'lucky');
  pinTrick('t_seance', 'Séance', 'phantom');
  kadd('t_foil', 'Foil Wrap', 'trick', 6, 'Give a ball the Foil edition: +30 Points on its rolls.', { target: 'ball', edition: 'foil' });
  kadd('t_holo', 'Holo Wrap', 'trick', 6, 'Give a ball the Holo edition: +6 Mult on its rolls.', { target: 'ball', edition: 'holo' });
  kadd('t_neon', 'Neon Paint', 'trick', 7, 'Give a ball the Neon edition: ×1.4 Mult on its rolls.', { target: 'ball', edition: 'neon' });
  kadd('t_frame', 'Extra Frame', 'trick', 6, '+1 Frame this round. Use during a round.', { target: 'round', inRound: true });
  kadd('t_rerack', 'Re-rack Token', 'trick', 4, '+1 Re-rack this round. Use during a round.', { target: 'round', inRound: true });
  kadd('t_backrow', 'Back-Row Pin', 'trick', 5, 'Add a standard pin to an empty back-row spot (11, 12 or 13). Bigger racks score more Points but strikes need every pin.', { target: 'pin', picks: 1, pinType: 'std', backRow: true });
  kadd('t_shrink', 'Shrink Ray', 'trick', 5, 'Turn up to 2 pins into Tiny Pins. ' + GK.PINS.tiny.desc, { target: 'pin', pinType: 'tiny', picks: 2 });
  kadd('t_loose', 'Loose Screws', 'trick', 5, 'Turn up to 2 pins into Wobbly Pins. ' + GK.PINS.wobbly.desc, { target: 'pin', pinType: 'wobbly', picks: 2 });
  kadd('m_eraser', 'Pin Eraser', 'market', 6, 'Black market. Remove a pin from your rack for good. Strikes get easier, frames earn fewer Points.', { target: 'pin', picks: 1, pinType: 'none' });
  kadd('m_loaded', 'Loaded Ball', 'market', 5, 'Black market. Your next frame gets ×3 Mult. Destroys a random charm.', { target: null });
  kadd('m_counterfeit', 'Counterfeit Bills', 'market', 4, 'Black market. Gain $12. The next round\'s target is 35% higher.', { target: null });
  kadd('m_bribe', 'Bribe the Ref', 'market', 7, 'Black market. This round\'s target drops 25%, but you lose a frame. Use during a round.', { target: 'round', inRound: true });
  kadd('m_dupe', 'Duplicator', 'market', 6, 'Black market. Copy a random charm you own (needs a free slot). Your money drops to $0.', { target: null });
  GK.CONS = {}; K.forEach(k => { GK.CONS[k.id] = k; });
  GK.CONS_LIST = K;
  GK.CONS_KIND = { card: { name: 'Scorecard', col: '#39c6d6' }, trick: { name: 'Lane Trick', col: '#ffb547' }, market: { name: 'Black Market', col: '#b06bff' } };

  // ---------- equipment (feel, not rules) ----------
  GK.EQUIP = {
    steady_glove: { slot: 'gloves', name: 'Steady Glove', cost: 6, desc: 'The power bar moves 35% slower.', bar: 1.35 },
    power_glove: { slot: 'gloves', name: 'Power Glove', cost: 6, desc: 'Throws are 12% faster.', speed: 1.12 },
    anchor_shoes: { slot: 'shoes', name: 'Anchor Shoes', cost: 6, desc: 'The angle slider swings 40% slower.', aim: 0.6 },
    slide_shoes: { slot: 'shoes', name: 'Slide Shoes', cost: 6, desc: 'A longer slide: the angle slider reaches 40% wider angles.', aim: 1.4 },
    wrist_brace: { slot: 'wrist', name: 'Wrist Brace', cost: 6, desc: 'The PERFECT zone on the power bar is 60% wider.', zone: 1.6 },
    snap_wrist: { slot: 'wrist', name: 'Snap Wrist', cost: 6, desc: 'Throws past the PERFECT zone stay on line instead of wobbling.', noWobble: true },
    hook_glove: { slot: 'gloves', name: 'Hook Glove', cost: 6, desc: 'The hook dial swings 35% slower.', dial: 1.35 }
  };

  // ---------- alley memberships (permanent run upgrades) ----------
  GK.MEMBERSHIPS = {
    gold_card: { name: 'Gold Card', cost: 12, desc: '+1 Charm slot.' },
    locker: { name: 'Locker Rental', cost: 12, desc: '+1 Consumable slot.' },
    pro_bag: { name: 'Pro Bag', cost: 12, desc: '+1 Ball slot in your bag.' },
    rewards: { name: 'Rewards Club', cost: 12, desc: 'Interest cap raised from $4 to $8.' },
    reservation: { name: 'Lane Reservation', cost: 12, desc: '+1 Frame every round.' },
    oil_pass: { name: 'Oil Pass', cost: 12, desc: '+1 Re-rack every round.' },
    clearance: { name: 'Clearance Rack', cost: 12, desc: 'Everything in the shop costs 25% less.' },
    reroll_club: { name: 'Reroll Club', cost: 12, desc: 'Shop rerolls cost $2 less.' }
  };

  // ---------- alleys and bosses ----------
  // lane: physics modifiers. theme: rendering palette.
  GK.ALLEYS = [
    {
      name: 'Lucky Strike Lanes', sub: 'EST. 1974 · LANE 7', base: 500, lane: { oil: 'house' },
      theme: { carpet: '#1c1220', c1: '#2b1a2f', c2: '#4a2a3c', mask: '#231825', sign: '#ffb547', signSh: '#5a2a1a', subc: '#c88f6a', wood: ['#d8a56b', '#d5a268', '#d9a76d', '#d3a066', '#d7a46a'] },
      laneDesc: 'A friendly house lane. Nothing weird. Yet.',
      boss: { id: 'secretary', name: 'The League Secretary', desc: 'Call your shot before each frame: Strike, Spare or Open. Called right: ×2 Mult. Called wrong: ×0.5 Mult.' }
    },
    {
      name: 'The Basement', sub: 'WARPED BOARDS · MIND THE DRIP', base: 1300, lane: { warp: 42, oil: 'short' },
      theme: { carpet: '#14161a', c1: '#1f2329', c2: '#2c333b', mask: '#181b20', sign: '#9fd36b', signSh: '#26361a', subc: '#7f8c80', wood: ['#b88e5c', '#a8814f', '#c09563', '#9e7748', '#b38a58'] },
      laneDesc: 'Warped boards push the ball left and right as it rolls.',
      boss: { id: 'mechanic', name: 'The Mechanic', desc: 'After your first roll, he stands 2 of your knocked pins back up.' }
    },
    {
      name: 'Cosmic Bowl', sub: 'BLACKLIGHT NIGHT · 2 FOR 1', base: 4000, lane: { dark: true, oil: 'shark' },
      theme: { carpet: '#0b0618', c1: '#1b0f3a', c2: '#3b1a6b', mask: '#0e0820', sign: '#ff4fd8', signSh: '#2a0a4a', subc: '#5ce1ff', wood: ['#3a2a5c', '#35265a', '#3d2d61', '#322357', '#38295d'] },
      laneDesc: 'Lights out. Only glowing pins and whatever your ball lights up are visible.',
      boss: { id: 'strobe', name: 'DJ Strobe', desc: 'Your ball turns invisible once it passes the arrows, except in strobe flashes.' }
    },
    {
      name: 'The Back Room', sub: 'MEMBERS ONLY · NO REFUNDS', base: 9500, lane: { lhw: 16, oil: 'sport' },
      theme: { carpet: '#1a0f0c', c1: '#2e1a14', c2: '#4a2a1c', mask: '#20120d', sign: '#e8c27a', signSh: '#3a2410', subc: '#a57a5a', wood: ['#9a6a3e', '#94653a', '#a06f42', '#8f6036', '#996a3d'] },
      laneDesc: 'A narrow private lane. The pins sit closer together.',
      boss: { id: 'bookie', name: 'The Bookie', desc: 'Each frame he takes half your money as a bet. Strike or Spare: you win it back doubled. Anything else: it is gone.' }
    },
    {
      name: 'Frostbite Rink', sub: 'SKATE · BOWL · REGRET', base: 21000, lane: { ice: true, oil: 'ice' },
      theme: { carpet: '#0c1620', c1: '#16283a', c2: '#244058', mask: '#0f1c28', sign: '#bff4ff', signSh: '#1a3a52', subc: '#7fb8d0', wood: ['#cfe9f5', '#c6e3f1', '#d6eef8', '#c0dfee', '#cbe7f3'] },
      laneDesc: 'Frictionless ice. No hook, and fallen pins slide forever.',
      boss: { id: 'winter', name: 'Old Man Winter', desc: 'Pins are frozen: each one needs two solid hits to fall.' }
    },
    {
      name: 'Midway Carnival', sub: 'STEP RIGHT UP · 3 BALLS $1', base: 45000, lane: { posts: true, oil: 'long' },
      theme: { carpet: '#1d0d10', c1: '#3a1418', c2: '#e8c547', mask: '#2a0f14', sign: '#ffdf5c', signSh: '#7a1020', subc: '#ff8a8a', wood: ['#e0a96a', '#dba465', '#e4ae70', '#d69f60', '#dea767'] },
      laneDesc: 'Two carnival posts slide back and forth across the lane.',
      boss: { id: 'ringmaster', name: 'The Ringmaster', desc: 'The whole lane tilts in a new direction every frame.' }
    },
    {
      name: 'Lunar Lanes', sub: 'ONE SMALL STRIKE FOR MAN', base: 85000, lane: { lowg: true, oil: 'shark' },
      theme: { carpet: '#07070f', c1: '#14142a', c2: '#2a2a4a', mask: '#0b0b18', sign: '#d8d8ff', signSh: '#20204a', subc: '#9a9ac8', wood: ['#9a9aa8', '#9494a2', '#a0a0ae', '#8e8e9c', '#9797a5'] },
      laneDesc: 'Low gravity. Pins topple easily and float a long way.',
      boss: { id: 'astronaut', name: 'The Astronaut', desc: 'Every frame the rack respawns in random positions on the pin deck.' }
    },
    {
      name: 'The Gutter', sub: 'WHERE BALLS GO TO DIE', base: 150000, lane: { lhw: 18, magnet: true, oil: 'sport' },
      theme: { carpet: '#0a0a08', c1: '#1a1a12', c2: '#2e2a14', mask: '#10100a', sign: '#c8ff3a', signSh: '#2a3a08', subc: '#8a9a5a', wood: ['#7a6a4a', '#746445', '#806f4e', '#6e5f41', '#776748'] },
      laneDesc: 'A narrow lane with magnetic gutters that tug at your ball near the edges.',
      boss: { id: 'king', name: 'The Gutter King', desc: 'He steals your most valuable charm for this match.' }
    }
  ];
  GK.CHAMPIONSHIP = {
    name: 'The Championship', sub: 'GUTTER KING · FINAL MATCH', target: 420000,
    lane: { lhw: 18, magnet: true, oil: 'long' },
    theme: { carpet: '#120a02', c1: '#2a1a06', c2: '#5a3a0a', mask: '#1a1004', sign: '#ffd700', signSh: '#4a2a00', subc: '#ffb547', wood: ['#e0b070', '#dbab6b', '#e4b574', '#d6a666', '#deae6e'] },
    laneDesc: 'Head to head against the Gutter King on his own lane.',
    boss: { id: 'champion', name: 'The Gutter King', desc: 'Head to head: beat his total over 5 frames. He also steals your most valuable charm.' }
  };
  GK.ROUND_NAMES = ['Qualifier', 'Heat', 'Boss Match'];
  GK.ROUND_MULT = [1, 1.5, 2];
  GK.ROUND_PAY = [2, 3, 4];
})();
