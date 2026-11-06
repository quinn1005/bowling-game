// Gutter Kings — expansion content (v0.7): more charms, balls, equipment, Black Market items,
// pin types, memberships and a Scorecard. Loaded after data.js; behaviour hooks live in
// physics.js (ball/pin physics), scoring.js (frame context), frame.js / run.js (rules).
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- charms ----------
  const add = (id, name, rarity, cost, tag, desc, o) => {
    const c = Object.assign({ id, name, rarity, cost, tag, desc }, o || {});
    GK.CHARM_LIST.push(c); GK.CHARMS[id] = c;
  };
  const strike = k => GK.isStrikeKind(k), spare = k => GK.isSpareKind(k);

  // +Points
  add('back_row_boss', 'Back Row Boss', 'common', 5, 'chips', '+25 Points for each back-row pin (11 to 15) knocked down.', { score: (c, s) => c.backRow && s.chips(25 * c.backRow) });
  add('pit_crew', 'Pit Crew', 'common', 4, 'chips', '+12 Points for every pin that ends up in a gutter.', { score: (c, s) => c.gutterPins && s.chips(12 * c.gutterPins) });
  add('clean_deck', 'Clean Deck', 'uncommon', 6, 'chips', '+60 Points on a strike that leaves no fallen pins lying on the deck.', { score: (c, s) => strike(c.kind) && c.deckLeft === 0 && s.chips(60) });
  add('spare_tire', 'Spare Tire', 'common', 4, 'chips', '+30 Points on any spare picked up with a single pin left.', { score: (c, s) => spare(c.kind) && c.lastRollPins === 1 && s.chips(30) });
  add('corner_pocket', 'Corner Pocket', 'uncommon', 5, 'chips', '+25 Points if your first ball hits the headpin in the pocket (just off its side).', { score: (c, s) => c.pocket && s.chips(25) });
  add('lane_hog', 'Lane Hog', 'common', 4, 'chips', '+2 Points for every board your ball crosses on the way down.', { score: (c, s) => c.boards && s.chips(2 * c.boards) });
  add('scrap_metal', 'Scrap Metal', 'uncommon', 5, 'chips', '+10 Points per Lead pin knocked down, and Lead pins are easier to topple.', { flags: { lightLead: true }, score: (c, s) => c.leadDown && s.chips(10 * c.leadDown) });
  add('echo_chamber', 'Echo Chamber', 'uncommon', 6, 'chips', 'Each roll repeats the previous roll\'s bonus Points (carries, late falls, wall bangs) at half value.', { score: (c, s) => { let n = 0; for (let i = 1; i < c.rolls.length; i++) { const r = c.rolls[i - 1]; n += (r.carry * GK.BONUS.carry + r.late * GK.BONUS.late + r.walls * GK.BONUS.wall) / 2; } if (n >= 1) s.chips(Math.round(n)); } });

  // +Mult
  add('crowd_pleaser', 'Crowd Pleaser', 'uncommon', 6, 'scaling', '+1 Mult every time the crowd cheers (strikes and the 7-10), growing all round. (Currently +{v} Mult)', { init: { v: 0 }, roundReset: true, score: (c, s, me) => { const n = me.v + (c.cheer ? 1 : 0); if (n) s.mult(n); }, after: (c, me) => { if (c.cheer) me.v++; } });
  add('late_night', 'Late Night Special', 'common', 5, 'mult', '+6 Mult in the last 2 frames of a round.', { score: (c, s) => c.framesLeft <= 2 && s.mult(6) });
  add('perfect_form', 'Perfect Form', 'uncommon', 5, 'mult', '+3 Mult if every throw this frame was PERFECT.', { score: (c, s) => c.perfects > 0 && c.misses === 0 && s.mult(3) });
  add('hook_artist', 'Hook Artist', 'common', 5, 'mult', '+1 Mult for every 10% of hook on the dial (your biggest hook this frame).', { score: (c, s) => { const n = Math.floor(c.maxHook * 10); if (n) s.mult(n); } });
  add('straight_shooter', 'Straight Shooter', 'common', 5, 'mult', '+8 Mult if every throw this frame had almost no hook.', { score: (c, s) => c.throws > 0 && c.maxHook < 0.1 && s.mult(8) });
  add('underdog', 'Underdog', 'common', 4, 'mult', '+1 Mult for every empty charm slot.', { score: (c, s) => { const n = c.run.maxCharms - c.run.charms.length; if (n > 0) s.mult(n); } });
  add('night_shift', 'Night Shift', 'uncommon', 5, 'mult', '+5 Mult on dark lanes (Cosmic, power flickers, the Fog Machine).', { score: (c, s) => c.dark && s.mult(5) });
  add('spare_change', 'Spare Change', 'common', 4, 'mult', '+1 Mult for every $1 under $5 you hold.', { score: (c, s) => { const n = 5 - Math.max(0, c.run.money); if (n > 0) s.mult(n); } });
  add('hecklers_jacket', 'Heckler\'s Jacket', 'common', 5, 'mult', '+6 Mult in Boss Matches.', { score: (c, s) => c.boss && s.mult(6) });
  add('bowling_buddy', 'Bowling Buddy', 'common', 5, 'mult', '+3 Mult for every ball in your bag.', { score: (c, s) => s.mult(3 * c.run.bag.length) });

  // ×Mult
  add('odd_pins', 'Odd Pins', 'uncommon', 6, 'xmult', '×1.5 Mult if an odd number of pins fell this frame, ×0.75 if even.', { score: (c, s) => s.xmult(c.pins % 2 ? 1.5 : 0.75) });
  add('groove_master', 'Groove Master', 'rare', 9, 'xmult', 'Each Groove stack gives ×0.1 Mult instead of +1 Mult.', { flags: { grooveX: true } });
  add('tv_star', 'TV Star', 'uncommon', 7, 'xmult', '×1.5 Mult whenever the lane TV plays a cartoon (strikes, spares, splits).', { score: (c, s) => (strike(c.kind) || spare(c.kind)) && s.xmult(1.5) });
  add('double_down', 'Double Down', 'rare', 8, 'xmult', '×2 Mult, but an Open or Gutter frame costs you $3.', { score: (c, s) => { s.xmult(2); if (c.kind === 'open' || c.kind === 'gutter') s.money(-3); } });
  add('statue', 'Statue', 'uncommon', 6, 'xmult', '×1.5 Mult if no pin wobbled this frame: every pin fell clean or stood firm.', { score: (c, s) => !c.wobbles && s.xmult(1.5) });
  add('splitsville', 'Splitsville', 'uncommon', 6, 'scaling', '×1.25 Mult for each split you\'ve left this round, converted or not. (Currently {v})', { init: { v: 0 }, roundReset: true, score: (c, s, me) => { const n = me.v + (c.leftSplit ? 1 : 0); if (n) s.xmult(Math.pow(1.25, n)); }, after: (c, me) => { if (c.leftSplit) me.v++; } });
  add('gold_rush', 'Gold Rush', 'uncommon', 6, 'xmult', '×1.1 Mult for every Gold pin in your rack.', { score: (c, s) => { const n = c.run.rack.filter(t => t === 'gold').length; if (n) s.xmult(Math.pow(1.1, n)); } });
  add('last_pin', 'Last Pin Standing', 'rare', 8, 'xmult', 'If exactly one pin is left after your first roll: ×3 Mult when you convert it, ×0.5 when you miss it.', { score: (c, s) => { if (c.leftOne) s.xmult(spare(c.kind) ? 3 : 0.5); } });

  // Scaling
  add('rookie_card', 'Rookie Card', 'uncommon', 6, 'scaling', 'Starts at +1 Mult and gains +1 Mult each round you clear without skipping. (Currently +{v} Mult)', { init: { v: 1 }, score: (c, s, me) => s.mult(me.v), roundWin: me => { me.v++; } });
  add('lane_regular', 'Lane Regular', 'uncommon', 6, 'scaling', 'Gains +2 Points for every throw on the same oil pattern; resets when the pattern changes. (Currently +{v} Points)', { init: { v: 0, pat: null }, score: (c, s, me) => me.v && s.chips(me.v), after: (c, me) => { if (me.pat !== c.oil) { me.pat = c.oil; me.v = 0; } me.v += 2 * c.throws; } });
  add('scrapbook', 'Scrapbook', 'rare', 8, 'scaling', 'Gains ×0.1 Mult every time you convert a split. (Currently ×{x})', { init: { v: 0 }, score: (c, s, me) => { const n = me.v + (c.kind === 'split' ? 1 : 0); if (n) s.xmult(1 + 0.1 * n); }, after: (c, me) => { if (c.kind === 'split') me.v++; }, show: me => (1 + 0.1 * me.v).toFixed(1) });
  add('trophy_case', 'Trophy Case', 'rare', 8, 'scaling', 'Gains +2 Mult each time you beat a boss. (Currently +{v} Mult)', { init: { v: 0 }, score: (c, s, me) => me.v && s.mult(me.v), roundWin: (me, boss) => { if (boss) me.v += 2; } });
  add('collectors', 'Collector\'s Edition', 'rare', 9, 'scaling', '×0.2 Mult for every Foil, Holo or Neon charm and ball you own.', { score: (c, s) => { const n = c.run.charms.filter(x => x.ed).length + c.run.bag.filter(x => x.ed).length; if (n) s.xmult(1 + 0.2 * n); } });
  add('snowball_charm', 'Snowball', 'uncommon', 5, 'scaling', 'Gains +5 Points every frame; resets on a gutter ball. (Currently +{v} Points)', { init: { v: 0 }, score: (c, s, me) => me.v && s.chips(me.v), after: (c, me) => { me.v = c.gutterBall ? 0 : me.v + 5; } });
  add('ironman', 'Ironman', 'uncommon', 6, 'scaling', 'Gains +2 Mult every frame you bowl without using a consumable; using one resets it. (Currently +{v} Mult)', { init: { v: 0 }, score: (c, s, me) => me.v && s.mult(me.v), after: (c, me) => { me.v += 2; } });

  // Economy
  add('pinsetters_cut', 'Pinsetter\'s Cut', 'common', 4, 'economy', 'Earn $2 every time the pinsetter fumbles.', { score: (c, s) => c.fumbles && s.money(2 * c.fumbles) });
  add('return_tips', 'Ball Return Tips', 'common', 4, 'economy', 'Earn $1 every time a ball jams in the return.', { score: (c, s) => c.jams && s.money(c.jams) });
  add('sponsorship', 'Sponsorship', 'common', 4, 'economy', '+$1 for every strike, -$1 for every gutter frame.', { score: (c, s) => { if (strike(c.kind)) s.money(1); if (c.kind === 'gutter') s.money(-1); } });
  add('coupon_book', 'Coupon Book', 'uncommon', 6, 'economy', 'Your first reroll in every shop is free.', { flags: { freeReroll: true } });
  add('bake_sale', 'Bake Sale', 'common', 3, 'economy', 'Sells for $2 more for every round you\'ve kept it. (Sells for ${s})', { init: { v: 0 }, roundWin: me => { me.v++; } });
  add('raffle', 'Raffle Ticket', 'common', 4, 'economy', 'Every round you clear: 1 in 10 chance to win $15.', { round: run => GK.stream(run.seed, 'raffle:' + run.alley + ':' + run.round)() < 0.1 ? 15 : 0 });
  add('league_dues', 'League Dues', 'uncommon', 5, 'economy', 'Pay $1 every frame. Earn $8 whenever you clear a Boss Match.', { score: (c, s) => s.money(-1), round: run => GK.isBoss(run) ? 8 : 0 });
  add('resale', 'Resale Shop', 'uncommon', 6, 'economy', 'Everything you sell goes for full price.', { flags: { resale: true } });
  add('arcade', 'Arcade Tokens', 'uncommon', 6, 'economy', 'Every strike earns a token. 3 tokens pay for a shop reroll. (Tokens: {v})', { init: { v: 0 }, after: (c, me) => { if (strike(c.kind)) me.v++; }, flags: { tokens: true } });

  // Rule-breakers
  add('bumper_season', 'Bumper Season', 'common', 5, 'rule', 'Bumpers are up for the first frame of every round.', { flags: { bumperFirst: true } });
  add('second_return', 'Second Ball Return', 'uncommon', 7, 'rule', '+1 ball slot in your bag, and balls never jam in the return.', { flags: { bagPlus: 1, noJam: true } });
  add('oil_rig', 'Oil Rig', 'uncommon', 6, 'rule', 'Your lane never dries out: your line stays oily all round.', { flags: { noWear: true } });
  add('lucky_coin', 'Lucky Coin', 'rare', 8, 'rule', 'The first throw of every round always counts as PERFECT.', { flags: { luckyCoin: true } });
  add('fourth_ball', 'Fourth Frame Ball', 'rare', 9, 'rule', 'Like a real 10th frame: a Strike or Spare in the last frame of a round earns a bonus ball at a fresh rack. Its pins add to that frame.', { flags: { bonusBall: true } });
  add('shadow_bowler', 'Shadow Bowler', 'rare', 9, 'rule', 'A shadow ball replays your previous throw half a second after each new one.', { flags: { shadow: true } });
  add('slow_motion', 'Slow Motion', 'uncommon', 6, 'rule', 'While you have Groove, the power bar moves 30% slower.', { flags: { slowmo: true } });
  add('pin_magnet', 'Pin Magnet', 'uncommon', 6, 'rule', 'Between rolls, standing pins drift toward the headpin spot, making spares easier.', { flags: { pinMagnet: true } });

  // ---------- balls ----------
  const ball = (id, o) => { GK.BALLS[id] = o; };
  ball('pinball', { name: 'Pin Ball', full: 'Bowling Pin Ball', cost: 6, m: 4, rs: 0.8, col: '#f2ebe0', hi: '#ffffff', desc: 'A bowling pin you throw. It tumbles end over end and bounces off course unpredictably.' });
  ball('disco', { name: 'Disco', full: 'Disco Ball', cost: 7, m: 5, col: '#b9c0d6', hi: '#ffffff', desc: 'Throws sparkles that make nearby pins wobble, and some fall late. Glows in the dark.' });
  ball('boomerang', { name: 'Boomerang', full: 'Boomerang Ball', cost: 8, m: 5, col: '#ff8a3d', hi: '#ffd2a8', desc: 'Swings back off the back of the deck for a second pass through the pins.' });
  ball('sticky', { name: 'Sticky', full: 'Sticky Ball', cost: 7, m: 6, col: '#5fbf3a', hi: '#c8ff9a', desc: 'Pins it hits stick to it and get dragged along, knocking over more (up to 3).' });
  ball('rubber', { name: 'Rubber', full: 'Rubber Ball', cost: 6, m: 4, col: '#e8455a', hi: '#ffb0bc', desc: 'Bounces off pins instead of driving through them, ricocheting around the deck.' });
  ball('paint', { name: 'Paint', full: 'Paint Ball', cost: 8, m: 6, col: '#7a4adf', hi: '#ffe066', desc: 'Standard pins it touches turn into a random special pin for the rest of the round.' });
  ball('pendulum', { name: 'Pendulum', full: 'Pendulum Ball', cost: 6, m: 6, col: '#8a6a3a', hi: '#e8c890', desc: 'Swings left and right as it rolls. Where the swing is when you let go decides its path.' });
  ball('twin', { name: 'Twin', full: 'Twin Ball', cost: 8, m: 6, col: '#3a9ad9', hi: '#bfe6ff', desc: 'Splits into two half-weight balls the moment you release it.' });
  ball('lightning', { name: 'Lightning', full: 'Lightning Ball', cost: 8, m: 6, col: '#f2d43a', hi: '#ffffff', desc: 'On its first hit, a bolt zaps the 2 nearest standing pins over.' });
  ball('snowball', { name: 'Snowball', full: 'Snowball', cost: 7, m: 4, rs: 0.75, col: '#e8f4ff', hi: '#ffffff', desc: 'Starts small and grows bigger and heavier as it rolls down the lane.' });
  ball('wrecking', { name: 'Wrecking', full: 'Wrecking Ball', cost: 8, m: 16, rs: 1.2, col: '#4a4a52', hi: '#9a9aa8', desc: 'Enormously heavy, slow and unstoppable. It can\'t hook at all.' });
  ball('duster', { name: 'Duster', full: 'Feather Duster', cost: 6, m: 2, col: '#f0c8e0', hi: '#ffffff', desc: 'Very light, but it sweeps fallen pins along in front of it into the standing ones.' });
  ball('bubble', { name: 'Bubble', full: 'Bubble Ball', cost: 6, m: 5, col: '#8fe0f0', hi: '#ffffff', desc: 'Floats straight over the oil, then drops hard and hooks twice as much on dry boards.' });
  ball('jelly', { name: 'Jelly', full: 'Jelly Ball', cost: 6, m: 4, col: '#ff6fb0', hi: '#ffd0e8', desc: 'Wobbly and soft: pins it hits shiver and fall late instead of flying.' });
  ball('chain', { name: 'Chain', full: 'Chain Ball', cost: 8, m: 6, col: '#6a6a7a', hi: '#d0d0e0', desc: 'Drags a second small ball behind it on a chain.' });
  ball('spiked', { name: 'Spiked', full: 'Spiked Ball', cost: 7, m: 6, col: '#3a2a2a', hi: '#d0b090', desc: 'Every pin it touches falls, but each hit slows it down hard.' });
  ball('neonball', { name: 'Neon', full: 'Neon Ball', cost: 7, m: 6, col: '#39ff8a', hi: '#e0ffe8', desc: 'Pins it knocks down glow: +1 Mult for each one.' });
  ball('moon', { name: 'Moon', full: 'Moon Ball', cost: 7, m: 6, col: '#c8c8d0', hi: '#ffffff', desc: 'Brings low gravity with it: pins topple easily and float away when hit.' });

  // ---------- The Regulars: signature balls of Quinn, Levi and Kaleb ----------
  // Unlocked by secret feats. Each one plays like its owner bowls.
  ball('twohander', { name: 'Two-Hander', full: 'Quinn\'s Two-Hander', cost: 9, m: 6, col: '#7a1f35', hi: '#d86a86', regular: 'Quinn',
    desc: 'Quinn\'s ball. Thrown two-handed with low revs while the aggressive coverstock does the work: it skids clean through the oil, then hooks strongly toward the pocket on dry boards, more as the lane breaks down. Starts right on the gutter edge. A strike from the outside boards into the pocket: ×2 Mult.' });
  ball('loftduck', { name: 'Loft Duck', full: 'Levi\'s Loft Duck', cost: 9, m: 7, col: '#ffd23a', hi: '#fff3a8', regular: 'Levi',
    desc: 'Levi\'s ball. Lofted way out onto the lane: it flies over the first third with no hook, then lands with a THUD that shakes the whole deck. Squeaks on every pin. +15 Points for every pin that falls late.' });
  ball('wideswing', { name: 'Wide Swing', full: 'Kaleb\'s Wide Swing', cost: 9, m: 6, col: '#7fae84', hi: '#d4f0cf', regular: 'Kaleb',
    desc: 'Kaleb\'s ball. Plays the whole lane: the angle slider swings twice as wide and it hooks back hard on the backend. +5 Points for every board it crosses, ×1.5 Mult if it crosses 25 or more.' });
  add('regulars', 'The Regulars', 'rare', 10, 'xmult', 'Quinn, Levi and Kaleb\'s usual table. ×1.5 Mult for each of their signature balls in your bag.', { score: (c, s) => { const n = c.run.bag.filter(b => GK.BALLS[b.type] && GK.BALLS[b.type].regular).length; if (n) s.xmult(Math.pow(1.5, n)); } });

  // ---------- pin types ----------
  GK.PINS.bouncy = { name: 'Bouncy Pin', desc: 'When it falls it springs forward, knocking over pins on the far side. 5 Points.', chips: 5, body: '#ffd447', shade: '#d0a020', band: '#2a6ad9' };
  GK.PINS.mirror = { name: 'Mirror Pin', desc: 'Copies its partner across the rack: when the mirrored pin falls, it falls too. 8 Points.', chips: 8, body: '#d8e0ea', shade: '#9aa6b4', band: '#5a6a80' };
  GK.MIRROR = { 2: 3, 3: 2, 4: 6, 6: 4, 7: 10, 10: 7, 8: 9, 9: 8, 11: 15, 15: 11, 12: 14, 14: 12 };

  // ---------- consumables ----------
  const cons = (id, name, kind, cost, desc, o) => { const k = Object.assign({ id, name, kind, cost, desc }, o || {}); GK.CONS_LIST.push(k); GK.CONS[id] = k; };
  GK.SHOTS.fullrack = { name: 'Full Rack', c: 0, m: 0, lv: [30, 3], bonusOnly: true };
  cons('card_fullrack', 'Full Rack Card', 'card', 4, 'Strikes with 13 or more pins in your rack get +30 Points and +3 Mult per level.', { shot: 'fullrack' });
  cons('t_spring', 'Spring Loader', 'trick', 5, 'Turn up to 2 pins into Bouncy Pins. ' + GK.PINS.bouncy.desc, { target: 'pin', pinType: 'bouncy', picks: 2 });
  cons('t_looking', 'Looking Glass', 'trick', 5, 'Turn up to 2 pins into Mirror Pins. ' + GK.PINS.mirror.desc, { target: 'pin', pinType: 'mirror', picks: 2 });
  // Black Market
  cons('m_stolen_oil', 'Stolen Oil', 'market', 5, 'Black market. Pick the oil pattern for your next round. Its target is 15% higher.', { target: 'oil' });
  cons('m_fake_id', 'Fake ID', 'market', 6, 'Black market. Pick which boss you face in this alley\'s Boss Match. Costs a charm slot until the alley ends.', { target: 'boss' });
  cons('m_ball_swap', 'Ball Swap', 'market', 6, 'Black market. Trade a ball for a random rare ball. The rare ball leaves with the next jam.', { target: 'ball' });
  cons('m_bootleg', 'Bootleg Scorecard', 'market', 5, 'Black market. Level up a shot of your choice 3 times. Another random shot drops a level.', { target: 'shot' });
  cons('m_hot_charm', 'Hot Charm', 'market', 6, 'Black market. Get a random Rare charm with the Neon edition. It disappears after 2 rounds.', { target: null });
  cons('m_insurance', 'Insurance Fraud', 'market', 4, 'Black market. Gain $20. A random ball in your bag shatters.', { target: null });
  cons('m_weighted', 'Weighted Pins', 'market', 6, 'Black market. This round every pin is a Lead pin, and Lead pins score double Points. Use during a round.', { target: 'round', inRound: true });
  cons('m_snake_oil', 'Snake Oil', 'market', 5, 'Black market. +3 Groove now, but every throw that misses the PERFECT zone this round costs $2. Use during a round.', { target: 'round', inRound: true });
  cons('m_debt', 'Debt Collector', 'market', 12, 'Black market. Pay off this round\'s boss: the boss rule stops for the rest of the round. Use during a Boss Match.', { target: 'round', inRound: true });
  cons('m_pin_thief', 'Pin Thief', 'market', 5, 'Black market. One random pin is missing from every rack this round. Strikes come easier, Points lower. Use during a round.', { target: 'round', inRound: true });
  cons('m_fixed', 'Fixed Match', 'market', 6, 'Black market. Your next Boss Match target is 40% lower, but it pays nothing.', { target: null });
  cons('m_blood_money', 'Blood Money', 'market', 5, 'Black market. Earn $1 per pin knocked down this round. Your next shop only has 2 items. Use during a round.', { target: 'round', inRound: true });
  cons('m_illegal_drill', 'Unlicensed Drill', 'market', 6, 'Black market. Re-drill a ball with an illegal layout: it hooks twice as hard but jams twice as often.', { target: 'ball' });
  cons('m_smuggled', 'Smuggled Ball', 'market', 5, 'Black market. Get a free random ball, but you must throw it on every first roll this round. Use during a round.', { target: 'round', inRound: true });

  // ---------- equipment ----------
  Object.assign(GK.EQUIP, {
    lucky_socks: { slot: 'shoes', name: 'Lucky Socks', cost: 6, desc: 'The PERFECT zone lands in a random spot each throw, but it\'s 30% wider.', zone: 1.3, wander: true },
    spinning_shoes: { slot: 'shoes', name: 'Spinning Shoes', cost: 6, desc: 'The angle slider swings 30% faster but reaches 40% wider angles.', angRange: 1.4, angSpeed: 0.7 },
    rosin_bag: { slot: 'gloves', name: 'Rosin Bag', cost: 6, desc: 'The start slider moves 25% slower.', posSlow: 1.25 },
    tape_measure: { slot: 'gloves', name: 'Tape Measure', cost: 5, desc: 'Shows the board number under your ball while you pick your start.', boards: true },
    fingerless: { slot: 'gloves', name: 'Fingerless Gloves', cost: 6, desc: 'Throws are 10% faster, but the power bar jitters.', speed: 1.1, jitter: true },
    wrist_computer: { slot: 'wrist', name: 'Wrist Computer', cost: 7, desc: 'Shows a dotted preview of your hook while the dial swings.', preview: true },
    lucky_wristband: { slot: 'wrist', name: 'Lucky Wristband', cost: 6, desc: 'Once per round, a wild hook (past 70% on the dial) is pulled back to half.', tame: true },
    headband: { slot: 'head', name: 'Headband', cost: 6, desc: 'Start every round with at least 1 Groove.', groove: 1 },
    glasses: { slot: 'head', name: 'Bowling Glasses', cost: 5, desc: 'The oil pattern shows twice as clearly on the lane.', clearOil: true },
    knee_pad: { slot: 'legs', name: 'Knee Pad', cost: 6, desc: 'Missing the PERFECT zone only costs 1 Groove instead of all of it.', kneePad: true }
  });

  // ---------- memberships ----------
  Object.assign(GK.MEMBERSHIPS, {
    season_ticket: { name: 'Season Ticket', cost: 12, desc: 'Start every round with at least 1 Groove.' },
    vip_lounge: { name: 'VIP Lounge', cost: 12, desc: 'Events between rounds happen twice as often.' },
    mechanic_call: { name: 'Mechanic on Call', cost: 12, desc: 'Balls never jam in the ball return.' }
  });
})();
