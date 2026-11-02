// Gutter Kings — all content as data: shots, balls, charms, pin types, consumables, equipment,
// memberships, alleys and bosses. Behaviour lives in physics.js (ball/pin physics flags) and
// scoring.js (score hooks). Charms subscribe to frame data built from the physics event log.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- shots ----------
  GK.SHOTS = {
    strike: { name: 'Strike', c: 40, m: 4, lv: [15, 2] },
    double: { name: 'Double', c: 60, m: 6, lv: [20, 2] },
    turkey: { name: 'Turkey', c: 100, m: 8, lv: [30, 3] },
    spare: { name: 'Spare', c: 20, m: 3, lv: [15, 2] },
    split: { name: 'Split conversion', c: 50, m: 5, lv: [25, 2] },
    open: { name: 'Open frame', c: 0, m: 1, lv: [10, 1] },
    gutter: { name: 'Gutter', c: 0, m: 0, lv: [20, 1] }
  };
  GK.SHOT_ORDER = ['strike', 'double', 'turkey', 'spare', 'split', 'open', 'gutter'];
  GK.isStrikeKind = k => k === 'strike' || k === 'double' || k === 'turkey';
  GK.isSpareKind = k => k === 'spare' || k === 'split';

  // Bonus chips from physics events (the "physics events are score" rule).
  GK.BONUS = { carry: 3, late: 4, wall: 2 };

  // ---------- editions (balls and charms) ----------
  GK.EDITIONS = {
    foil: { name: 'Foil', desc: '+50 Chips', col: '#9fe8ff' },
    holo: { name: 'Holo', desc: '+10 Mult', col: '#ff9ef0' },
    neon: { name: 'Neon', desc: '×1.5 Mult', col: '#b6ff5c' }
  };

  // ---------- balls ----------
  // m = mass, r = radius scale. Physics behaviour keyed by id in physics.js.
  GK.BALLS = {
    house: { name: 'House', full: 'House Ball', cost: 3, m: 6, col: '#2b4fb8', hi: '#86a6ff', desc: 'Standard weight and hook. The baseline every throw is tuned around.' },
    split: { name: 'Split', full: 'Split Ball', cost: 5, m: 6, col: '#d98a22', hi: '#ffd590', desc: 'Splits into two half-size balls on first contact.' },
    ghost: { name: 'Ghost', full: 'Ghost Ball', cost: 6, m: 6, col: '#b9c7d6', hi: '#ffffff', desc: 'Passes straight through the first 3 pins it touches.' },
    feather: { name: 'Feather', full: 'Featherweight', cost: 5, m: 2.4, col: '#d9609a', hi: '#ffc2dd', desc: 'Very light. +2 Mult every time a pin knocks over another pin.' },
    lead: { name: 'Lead', full: 'Lead Ball', cost: 5, m: 11, col: '#59626d', hi: '#c9d2dc', desc: 'Flattens every pin it touches. Chips from its roll ×0.5.' },
    bouncer: { name: 'Bouncer', full: 'Bouncer', cost: 6, m: 5, col: '#2fb36a', hi: '#a6ffcb', desc: 'Bounces off the gutter edges instead of falling in. +10 Chips per wall bounce.' },
    bomb: { name: 'Bomb', full: 'Bomb Ball', cost: 7, m: 6, col: '#2a2228', hi: '#ff6a3d', desc: 'Explodes on its 3rd pin contact, blasting everything nearby.' },
    ice: { name: 'Ice', full: 'Ice Ball', cost: 6, m: 6, col: '#7fd6ff', hi: '#e8fbff', desc: 'Never hooks. Bursts into 3 ice shards on first contact.' },
    mirror: { name: 'Mirror', full: 'Mirror Ball', cost: 8, m: 5, col: '#c0c6d0', hi: '#ffffff', desc: 'Rolls with a mirrored twin on the other side of the lane.' },
    echo: { name: 'Echo', full: 'Echo Ball', cost: 7, m: 6, col: '#7b5cff', hi: '#cbbdff', desc: 'A half-weight echo replays your exact throw a moment later.' },
    glass: { name: 'Glass', full: 'Glass Ball', cost: 6, m: 5, col: '#9be3e0', hi: '#ffffff', desc: '×3 Mult for its roll. 1 in 4 chance to shatter after the roll.', glass: true },
    golden: { name: 'Golden', full: 'Golden Ball', cost: 7, m: 7, col: '#e0b028', hi: '#fff1a8', desc: 'Earns $1 per pin knocked down. Its roll scores no pin Chips.' },
    cluster: { name: 'Cluster', full: 'Cluster', cost: 8, m: 6, col: '#e2584a', hi: '#ffc1a8', desc: 'Throws 5 marbles in a spread instead of one ball.' },
    blackhole: { name: 'Black Hole', full: 'Black Hole', cost: 9, m: 8, col: '#120a1c', hi: '#b06bff', desc: 'Swallows pins it touches and pulls nearby pins in. Swallowed pins give ×2 Chips.' },
    snake: { name: 'Snake', full: 'Snake Ball', cost: 7, m: 6, col: '#3d9b3a', hi: '#c8ff8a', desc: 'Draw its path: the ball follows the shape of your swipe until it hits a pin.' },
    lucky7: { name: 'Lucky 7', full: 'Lucky Seven', cost: 7, m: 6, col: '#1e8a4f', hi: '#ffe066', desc: 'If its roll knocks down exactly 7 pins, every charm triggers twice this frame.' }
  };

  GK.STARTER_BAGS = [
    { id: 'classic', name: 'Classic Bag', balls: ['house', 'feather', 'lead'], desc: 'House, Featherweight and Lead. Chain reactions or brute force.' },
    { id: 'trick', name: 'Trick Bag', balls: ['house', 'split', 'bouncer'], desc: 'House, Split and Bouncer. Bank shots and wide coverage.' },
    { id: 'demo', name: 'Demolition Bag', balls: ['house', 'bomb', 'lead'], desc: 'House, Bomb and Lead. Blow up the rack, then flatten what is left.' },
    { id: 'gambler', name: 'Gambler\'s Bag', balls: ['house', 'glass', 'golden'], desc: 'House, Glass and Golden, plus $4 extra. High risk, high pay.', money: 4 }
  ];

  // ---------- pin types ----------
  GK.PINS = {
    std: { name: 'Standard', desc: '5 Chips when knocked down.', chips: 5, body: '#f2ebe0', shade: '#d9cfc2', band: '#c4243a' },
    gold: { name: 'Gold Pin', desc: '5 Chips and $1 when knocked down.', chips: 5, body: '#f2c94c', shade: '#c8932a', band: '#fff3b0' },
    glass: { name: 'Glass Pin', desc: '×1.5 Mult when knocked down. 1 in 4 breaks for good.', chips: 5, body: '#bfeff3', shade: '#7fc8d0', band: '#e8ffff', alpha: 0.78 },
    lead: { name: 'Lead Pin', desc: 'Heavy and hard to topple. 20 Chips when knocked down.', chips: 20, body: '#8a929c', shade: '#5f666e', band: '#3a3f45', m: 4, topple: 1.8 },
    rubber: { name: 'Rubber Pin', desc: 'Super bouncy. +5 Chips for each pin it bounces off.', chips: 5, body: '#ff7a59', shade: '#c9502f', band: '#2a1d22', e: 1.0 },
    explosive: { name: 'Explosive Pin', desc: 'Explodes when it falls, blasting nearby pins. +15 Chips.', chips: 20, body: '#ff4d4d', shade: '#b52a2a', band: '#ffd447' },
    lucky: { name: 'Lucky Pin', desc: 'When knocked down: 1 in 3 for +8 Mult, 1 in 6 for $4.', chips: 5, body: '#7be38a', shade: '#3fa85a', band: '#ffffff' },
    phantom: { name: 'Phantom Pin', desc: 'Pins pass through it, only balls can hit it. +4 Mult when knocked down.', chips: 5, body: '#b58cff', shade: '#7c55c9', band: '#efe3ff', alpha: 0.65 },
    none: { name: 'Empty Spot', desc: 'This spot has no pin.', chips: 0 }
  };

  // ---------- charms ----------
  // score(ctx, s, self): add effects via s.chips/s.mult/s.xmult/s.money.
  // after(ctx, self): runs once per frame after scoring (scaling counters).
  // round(run, self): end of a won round (economy), returns money.
  // flags: passive rule changes read by the game (frames, reracks, bumpers, wide, wild, retake, third, debt).
  const C = [];
  const add = (id, name, rarity, cost, tag, desc, o) => C.push(Object.assign({ id, name, rarity, cost, tag, desc }, o || {}));
  // +Chips
  add('lucky_shoes', 'Lucky Shoes', 'common', 4, 'chips', '+30 Chips every frame.', { score: (c, s) => s.chips(30) });
  add('chalk_bag', 'Chalk Bag', 'common', 4, 'chips', '+4 Chips for every pin knocked down this frame.', { score: (c, s) => c.pins && s.chips(4 * c.pins) });
  add('corner_office', 'Corner Office', 'common', 5, 'chips', '+50 Chips for each corner pin (7 or 10) knocked down.', { score: (c, s) => { const n = (c.down.has(7) ? 1 : 0) + (c.down.has(10) ? 1 : 0); if (n) s.chips(50 * n); } });
  add('headpin_hunter', 'Headpin Hunter', 'common', 5, 'chips', '+60 Chips if the first pin your ball touches is the headpin.', { score: (c, s) => c.firstPin === 1 && s.chips(60) });
  add('domino', 'Domino Theory', 'common', 5, 'chips', '+8 Chips for every pin that knocks over another pin.', { score: (c, s) => c.carry && s.chips(8 * c.carry) });
  add('bumper_kid', 'Bumper Kid', 'uncommon', 6, 'rule', 'Bumpers up: balls bounce off the gutters. +10 Chips per ball bounce.', { flags: { bumpers: true }, score: (c, s) => c.ballBounces && s.chips(10 * c.ballBounces) });
  add('rail_rider', 'Rail Rider', 'uncommon', 6, 'chips', '+15 Chips each time a pin bangs off a kickback wall.', { score: (c, s) => c.walls && s.chips(15 * c.walls) });
  add('pin_collector', 'Pin Collector', 'uncommon', 6, 'scaling', 'Gains +1 Chip for every pin you knock down. (Currently +{v} Chips)', { init: { v: 0 }, score: (c, s, me) => me.v && s.chips(me.v), after: (c, me) => { me.v += c.pins; } });
  // +Mult
  add('league_jacket', 'League Jacket', 'common', 4, 'mult', '+4 Mult every frame.', { score: (c, s) => s.mult(4) });
  add('spare_parts', 'Spare Parts', 'common', 5, 'mult', '+8 Mult on a Spare or Split conversion.', { score: (c, s) => GK.isSpareKind(c.kind) && s.mult(8) });
  add('strike_out', 'Strike Out', 'common', 5, 'mult', '+6 Mult on any Strike, Double or Turkey.', { score: (c, s) => GK.isStrikeKind(c.kind) && s.mult(6) });
  add('open_mic', 'Open Mic', 'common', 4, 'mult', '+12 Mult on an Open frame.', { score: (c, s) => c.kind === 'open' && s.mult(12) });
  add('gutter_punk', 'Gutter Punk', 'common', 4, 'mult', 'Gutter frames get +40 Chips and +5 Mult.', { score: (c, s) => { if (c.kind === 'gutter') { s.chips(40); s.mult(5); } } });
  add('split_personality', 'Split Personality', 'uncommon', 6, 'mult', '+12 Mult on a Split conversion. +4 Mult whenever you leave a split.', { score: (c, s) => { if (c.kind === 'split') s.mult(12); else if (c.leftSplit) s.mult(4); } });
  add('thunderclap', 'Thunderclap', 'uncommon', 6, 'mult', '+2 Mult for each pin that falls within half a second of first contact.', { score: (c, s) => c.fast && s.mult(2 * c.fast) });
  add('moon_shot', 'Moon Shot', 'uncommon', 6, 'mult', '+3 Mult for every pin that flies into the pit.', { score: (c, s) => c.pit && s.mult(3 * c.pit) });
  add('late_bloomer', 'Late Bloomer', 'uncommon', 6, 'mult', '+5 Mult for each pin that wobbles and falls late.', { score: (c, s) => c.late && s.mult(5 * c.late) });
  add('practice', 'Practice Lane', 'uncommon', 6, 'scaling', 'Gains +1 Mult each time you convert a Spare or Split. (Currently +{v} Mult)', { init: { v: 0 }, score: (c, s, me) => me.v && s.mult(me.v), after: (c, me) => { if (GK.isSpareKind(c.kind)) me.v += 1; } });
  add('graveyard', 'Graveyard Shift', 'uncommon', 7, 'scaling', '+1 Mult for every pin knocked down earlier this round. (Currently +{v} Mult)', { init: { v: 0 }, roundReset: true, score: (c, s, me) => me.v && s.mult(me.v), after: (c, me) => { me.v += c.pins; } });
  add('high_roller', 'High Roller', 'uncommon', 6, 'mult', '+1 Mult for every $3 you hold.', { score: (c, s) => { const n = Math.floor(Math.max(0, c.run.money) / 3); if (n) s.mult(n); } });
  // ×Mult
  add('tenth_frame', 'Tenth Frame', 'rare', 8, 'xmult', '×3 Mult on the last frame of each round.', { score: (c, s) => c.lastFrame && s.xmult(3) });
  add('hot_streak', 'Hot Streak', 'rare', 8, 'scaling', 'Gains ×0.5 Mult for each strike in a row; resets on anything else. (Currently ×{x})', { init: { v: 0 }, score: (c, s, me) => { const x = 1 + 0.5 * (me.v + (GK.isStrikeKind(c.kind) ? 1 : 0)); if (x > 1) s.xmult(x); }, after: (c, me) => { me.v = GK.isStrikeKind(c.kind) ? me.v + 1 : 0; }, show: me => (1 + 0.5 * me.v).toFixed(1) });
  add('pyromaniac', 'Pyromaniac', 'rare', 8, 'xmult', '×2 Mult if anything exploded this frame. +10 Chips per pin blasted.', { score: (c, s) => { if (c.blasted) s.chips(10 * c.blasted); if (c.explosions) s.xmult(2); } });
  add('sniper', 'Sniper', 'rare', 7, 'xmult', '×3 Mult when you convert a spare by knocking down exactly one pin.', { score: (c, s) => GK.isSpareKind(c.kind) && c.lastRollPins === 1 && s.xmult(3) });
  add('seven_ten', '7-10 Club', 'rare', 8, 'xmult', '×2 Mult on Split conversions. Converting the 7-10 is ×5 and pays $10.', { score: (c, s) => { if (c.kind !== 'split') return; if (c.leave710) { s.xmult(5); s.money(10); } else s.xmult(2); } });
  add('butterfingers', 'Butterfingers', 'rare', 7, 'rule', 'Every throw gets a random wild hook. ×2 Mult.', { flags: { wild: true }, score: (c, s) => s.xmult(2) });
  add('copycat', 'Copycat', 'rare', 9, 'rule', 'Copies the charm to its right.', { copy: true });
  // Economy
  add('tip_jar', 'Tip Jar', 'common', 4, 'economy', 'Earn $1 for every Spare or Split conversion.', { score: (c, s) => GK.isSpareKind(c.kind) && s.money(1) });
  add('piggy_bank', 'Piggy Bank', 'common', 4, 'economy', 'Earn $1 for every Strike.', { score: (c, s) => GK.isStrikeKind(c.kind) && s.money(1) });
  add('pro_shop_pass', 'Pro Shop Pass', 'uncommon', 6, 'economy', 'Earn $3 at the end of every round you clear.', { round: () => 3 });
  add('loan_shark', 'Loan Shark', 'uncommon', 5, 'economy', 'You can spend down to -$20. Pay $1 at the end of each round.', { flags: { debt: 20 }, round: () => -1 });
  // Rule-breakers
  add('mulligan', 'Mulligan', 'uncommon', 6, 'rule', '+1 Re-rack every round.', { flags: { reracks: 1 } });
  add('refs_eye', 'Ref\'s Blind Eye', 'uncommon', 6, 'rule', 'Your first gutter ball each frame is retaken.', { flags: { retake: true } });
  add('wide_load', 'Wide Load', 'uncommon', 6, 'rule', 'Your balls are 35% wider.', { flags: { wide: 1.35 } });
  add('overtime', 'Overtime', 'rare', 9, 'rule', '+1 Frame every round.', { flags: { frames: 1 } });
  add('third_roll', 'Third Roll', 'rare', 9, 'rule', 'Each frame gets a third roll if pins are still standing. Clearing on roll 3 still counts as a Spare.', { flags: { third: true } });
  GK.CHARMS = {}; C.forEach(c => { GK.CHARMS[c.id] = c; });
  GK.CHARM_LIST = C;
  GK.RARITY = { common: { w: 60, col: '#8fb3d9', name: 'Common' }, uncommon: { w: 30, col: '#7be38a', name: 'Uncommon' }, rare: { w: 10, col: '#ff5a6e', name: 'Rare' } };
  GK.TAG_GLYPH = { chips: '+C', mult: '+M', xmult: '×M', scaling: '↑', economy: '$', rule: '!' };

  // ---------- consumables ----------
  // kind: card (levels a shot), trick (targets pins/balls or the round), market (black market).
  // target: 'pin' | 'ball' | 'round' | 'charm' | null
  const K = [];
  const kadd = (id, name, kind, cost, desc, o) => K.push(Object.assign({ id, name, kind, cost, desc }, o || {}));
  GK.SHOT_ORDER.forEach(k => {
    const s = GK.SHOTS[k];
    kadd('card_' + k, s.name + ' Card', 'card', 3, 'Level up ' + s.name + ': +' + s.lv[0] + ' Chips and +' + s.lv[1] + ' Mult.', { shot: k });
  });
  const pinTrick = (id, name, type) => kadd(id, name, 'trick', 4, 'Turn up to 2 pins in your rack into ' + GK.PINS[type].name + 's. ' + GK.PINS[type].desc, { target: 'pin', pinType: type, picks: 2 });
  pinTrick('t_gild', 'Gilder', 'gold');
  pinTrick('t_glaze', 'Glazier', 'glass');
  pinTrick('t_foundry', 'Foundry', 'lead');
  pinTrick('t_rubber', 'Rubberizer', 'rubber');
  pinTrick('t_keg', 'Powder Keg', 'explosive');
  pinTrick('t_clover', 'Four-Leaf', 'lucky');
  pinTrick('t_seance', 'Séance', 'phantom');
  kadd('t_foil', 'Foil Wrap', 'trick', 5, 'Give a ball the Foil edition: +50 Chips on its rolls.', { target: 'ball', edition: 'foil' });
  kadd('t_holo', 'Holo Wrap', 'trick', 5, 'Give a ball the Holo edition: +10 Mult on its rolls.', { target: 'ball', edition: 'holo' });
  kadd('t_neon', 'Neon Paint', 'trick', 6, 'Give a ball the Neon edition: ×1.5 Mult on its rolls.', { target: 'ball', edition: 'neon' });
  kadd('t_frame', 'Extra Frame', 'trick', 4, '+1 Frame this round. Use during a round.', { target: 'round', inRound: true });
  kadd('t_rerack', 'Re-rack Token', 'trick', 3, '+1 Re-rack this round. Use during a round.', { target: 'round', inRound: true });
  kadd('m_eraser', 'Pin Eraser', 'market', 6, 'Black market. Remove a pin from your rack for good. Strikes get easier, frames earn fewer Chips.', { target: 'pin', picks: 1, pinType: 'none' });
  kadd('m_loaded', 'Loaded Ball', 'market', 5, 'Black market. Your next frame gets ×3 Mult. Destroys a random charm.', { target: null });
  kadd('m_counterfeit', 'Counterfeit Bills', 'market', 4, 'Black market. Gain $15. The next round\'s target is 25% higher.', { target: null });
  kadd('m_bribe', 'Bribe the Ref', 'market', 6, 'Black market. This round\'s target drops 30%, but you lose a frame. Use during a round.', { target: 'round', inRound: true });
  kadd('m_dupe', 'Duplicator', 'market', 6, 'Black market. Copy a random charm you own (needs a free slot). Your money drops to $0.', { target: null });
  GK.CONS = {}; K.forEach(k => { GK.CONS[k.id] = k; });
  GK.CONS_LIST = K;
  GK.CONS_KIND = { card: { name: 'Scorecard', col: '#39c6d6' }, trick: { name: 'Lane Trick', col: '#ffb547' }, market: { name: 'Black Market', col: '#b06bff' } };

  // ---------- equipment (feel, not rules) ----------
  GK.EQUIP = {
    hook_glove: { slot: 'gloves', name: 'Hook Glove', cost: 5, desc: 'Your hook bites 35% harder.', hook: 1.35 },
    power_glove: { slot: 'gloves', name: 'Power Glove', cost: 5, desc: 'Throws are 12% faster.', speed: 1.12 },
    anchor_shoes: { slot: 'shoes', name: 'Anchor Shoes', cost: 5, desc: 'Steadier aim: your flick angle is 40% less sensitive.', aim: 0.6 },
    slide_shoes: { slot: 'shoes', name: 'Slide Shoes', cost: 5, desc: 'A longer slide: your aim reaches 40% wider angles.', aim: 1.4 },
    wrist_brace: { slot: 'wrist', name: 'Wrist Brace', cost: 5, desc: 'Gentler hooks: curve sensitivity ×0.6.', spin: 0.6 },
    snap_wrist: { slot: 'wrist', name: 'Snap Wrist', cost: 5, desc: 'Sharper hooks: curve sensitivity ×1.5.', spin: 1.5 }
  };

  // ---------- alley memberships (permanent run upgrades) ----------
  GK.MEMBERSHIPS = {
    gold_card: { name: 'Gold Card', cost: 10, desc: '+1 Charm slot.' },
    locker: { name: 'Locker Rental', cost: 10, desc: '+1 Consumable slot.' },
    pro_bag: { name: 'Pro Bag', cost: 10, desc: '+1 Ball slot in your bag.' },
    rewards: { name: 'Rewards Club', cost: 10, desc: 'Interest cap raised from $5 to $10.' },
    reservation: { name: 'Lane Reservation', cost: 10, desc: '+1 Frame every round.' },
    oil_pass: { name: 'Oil Pass', cost: 10, desc: '+1 Re-rack every round.' },
    clearance: { name: 'Clearance Rack', cost: 10, desc: 'Everything in the shop costs 25% less.' },
    reroll_club: { name: 'Reroll Club', cost: 10, desc: 'Shop rerolls cost $2 less.' }
  };

  // ---------- alleys and bosses ----------
  // lane: physics modifiers. theme: rendering palette.
  GK.ALLEYS = [
    {
      name: 'Lucky Strike Lanes', sub: 'EST. 1974 · LANE 7', base: 600, lane: {},
      theme: { carpet: '#1c1220', c1: '#2b1a2f', c2: '#4a2a3c', mask: '#231825', sign: '#ffb547', signSh: '#5a2a1a', subc: '#c88f6a', wood: ['#d8a56b', '#d5a268', '#d9a76d', '#d3a066', '#d7a46a'] },
      laneDesc: 'A friendly house lane. Nothing weird. Yet.',
      boss: { id: 'secretary', name: 'The League Secretary', desc: 'Call your shot before each frame: Strike, Spare or Open. Called right: ×2 Mult. Called wrong: the frame scores nothing.' }
    },
    {
      name: 'The Basement', sub: 'WARPED BOARDS · MIND THE DRIP', base: 1500, lane: { warp: 42 },
      theme: { carpet: '#14161a', c1: '#1f2329', c2: '#2c333b', mask: '#181b20', sign: '#9fd36b', signSh: '#26361a', subc: '#7f8c80', wood: ['#b88e5c', '#a8814f', '#c09563', '#9e7748', '#b38a58'] },
      laneDesc: 'Warped boards push the ball left and right as it rolls.',
      boss: { id: 'mechanic', name: 'The Mechanic', desc: 'After your first roll, he stands 2 of your knocked pins back up.' }
    },
    {
      name: 'Cosmic Bowl', sub: 'BLACKLIGHT NIGHT · 2 FOR 1', base: 3500, lane: { dark: true },
      theme: { carpet: '#0b0618', c1: '#1b0f3a', c2: '#3b1a6b', mask: '#0e0820', sign: '#ff4fd8', signSh: '#2a0a4a', subc: '#5ce1ff', wood: ['#3a2a5c', '#35265a', '#3d2d61', '#322357', '#38295d'] },
      laneDesc: 'Lights out. Only glowing pins and whatever your ball lights up are visible.',
      boss: { id: 'strobe', name: 'DJ Strobe', desc: 'Your ball turns invisible once it passes the arrows, except in strobe flashes.' }
    },
    {
      name: 'The Back Room', sub: 'MEMBERS ONLY · NO REFUNDS', base: 7500, lane: { lhw: 16 },
      theme: { carpet: '#1a0f0c', c1: '#2e1a14', c2: '#4a2a1c', mask: '#20120d', sign: '#e8c27a', signSh: '#3a2410', subc: '#a57a5a', wood: ['#9a6a3e', '#94653a', '#a06f42', '#8f6036', '#996a3d'] },
      laneDesc: 'A narrow private lane. The pins sit closer together.',
      boss: { id: 'bookie', name: 'The Bookie', desc: 'Each frame he takes half your money as a bet. Strike or Spare: you win it back doubled. Anything else: it is gone.' }
    },
    {
      name: 'Frostbite Rink', sub: 'SKATE · BOWL · REGRET', base: 15000, lane: { ice: true },
      theme: { carpet: '#0c1620', c1: '#16283a', c2: '#244058', mask: '#0f1c28', sign: '#bff4ff', signSh: '#1a3a52', subc: '#7fb8d0', wood: ['#cfe9f5', '#c6e3f1', '#d6eef8', '#c0dfee', '#cbe7f3'] },
      laneDesc: 'Frictionless ice. No hook, and fallen pins slide forever.',
      boss: { id: 'winter', name: 'Old Man Winter', desc: 'Pins are frozen: each one needs two solid hits to fall.' }
    },
    {
      name: 'Midway Carnival', sub: 'STEP RIGHT UP · 3 BALLS $1', base: 28000, lane: { posts: true },
      theme: { carpet: '#1d0d10', c1: '#3a1418', c2: '#e8c547', mask: '#2a0f14', sign: '#ffdf5c', signSh: '#7a1020', subc: '#ff8a8a', wood: ['#e0a96a', '#dba465', '#e4ae70', '#d69f60', '#dea767'] },
      laneDesc: 'Two carnival posts slide back and forth across the lane.',
      boss: { id: 'ringmaster', name: 'The Ringmaster', desc: 'The whole lane tilts in a new direction every frame.' }
    },
    {
      name: 'Lunar Lanes', sub: 'ONE SMALL STRIKE FOR MAN', base: 48000, lane: { lowg: true },
      theme: { carpet: '#07070f', c1: '#14142a', c2: '#2a2a4a', mask: '#0b0b18', sign: '#d8d8ff', signSh: '#20204a', subc: '#9a9ac8', wood: ['#9a9aa8', '#9494a2', '#a0a0ae', '#8e8e9c', '#9797a5'] },
      laneDesc: 'Low gravity. Pins topple easily and float a long way.',
      boss: { id: 'astronaut', name: 'The Astronaut', desc: 'Every frame the rack respawns in random positions on the pin deck.' }
    },
    {
      name: 'The Gutter', sub: 'WHERE BALLS GO TO DIE', base: 80000, lane: { lhw: 18, magnet: true },
      theme: { carpet: '#0a0a08', c1: '#1a1a12', c2: '#2e2a14', mask: '#10100a', sign: '#c8ff3a', signSh: '#2a3a08', subc: '#8a9a5a', wood: ['#7a6a4a', '#746445', '#806f4e', '#6e5f41', '#776748'] },
      laneDesc: 'A narrow lane with magnetic gutters that tug at your ball near the edges.',
      boss: { id: 'king', name: 'The Gutter King', desc: 'He steals your most valuable charm for this match.' }
    }
  ];
  GK.CHAMPIONSHIP = {
    name: 'The Championship', sub: 'GUTTER KING · FINAL MATCH', target: 220000,
    lane: { lhw: 18, magnet: true },
    theme: { carpet: '#120a02', c1: '#2a1a06', c2: '#5a3a0a', mask: '#1a1004', sign: '#ffd700', signSh: '#4a2a00', subc: '#ffb547', wood: ['#e0b070', '#dbab6b', '#e4b574', '#d6a666', '#deae6e'] },
    laneDesc: 'Head to head against the Gutter King on his own lane.',
    boss: { id: 'champion', name: 'The Gutter King', desc: 'Head to head: beat his total over 5 frames. He also steals your most valuable charm.' }
  };
  GK.ROUND_NAMES = ['Qualifier', 'Heat', 'Boss Match'];
  GK.ROUND_MULT = [1, 1.5, 2];
  GK.ROUND_PAY = [3, 4, 5];
})();
