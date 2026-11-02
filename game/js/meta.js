// Gutter Kings — run modifiers and long-term progression: leagues (picked before a run),
// ascension levels (unlocked by beating the Gutter King) and feats that unlock balls, charms
// and leagues. Pure logic; main.js stores the meta object in localStorage.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- leagues ----------
  GK.LEAGUES = {
    open: { name: 'Open League', desc: 'The standard rules.' },
    bumper: { name: 'Bumper League', desc: 'Bumpers are always up. Every target is 50% higher.', bumpers: true, target: 1.5 },
    senior: { name: 'Senior League', desc: 'Throws are 20% slower. +2 Mult every frame.', speed: 0.8, mult: 2 },
    speed: { name: 'Speed League', desc: 'The power bar and hook dial move 30% faster. Everything in the shop costs $1 less.', bar: 0.7, priceOff: 1 },
    cosmic: { name: 'Cosmic League', desc: 'Every alley is dark. +$2 for every round you clear.', dark: true, pay: 2 },
    pro: { name: 'Pro Tour', desc: 'Targets 30% higher. Every PERFECT throw earns $1.', target: 1.3, perfectPay: 1 }
  };
  GK.LEAGUE_ORDER = ['open', 'bumper', 'senior', 'speed', 'cosmic', 'pro'];

  // ---------- ascension (cumulative) ----------
  GK.ASCENSION = [
    { desc: 'Standard difficulty.' },
    { desc: 'Targets +20%.', target: 1.2 },
    { desc: 'Everything in the shop costs $1 more.', priceUp: 1 },
    { desc: 'One fewer re-rack every round.', reracks: -1 },
    { desc: 'The Mechanic stands 1 pin back up after your first roll in every Heat.', heatMech: true },
    { desc: 'Interest is capped at $3.', interestCap: 3 },
    { desc: 'The PERFECT zone is 25% smaller.', zone: 0.75 },
    { desc: 'Boss Match targets +25%.', bossTarget: 1.25 },
    { desc: 'One fewer frame every round.', frames: -1 }
  ];
  GK.MAX_ASC = GK.ASCENSION.length - 1;

  // Merged league + ascension rules for a run.
  GK.rules = function (run) {
    const L = GK.LEAGUES[run && run.league] || GK.LEAGUES.open;
    const r = { target: L.target || 1, bossTarget: 1, priceDelta: -(L.priceOff || 0), reracks: 0, frames: 0, heatMech: false, interestCap: 99, zone: 1, bar: L.bar || 1, speed: L.speed || 1, mult: L.mult || 0, pay: L.pay || 0, perfectPay: L.perfectPay || 0, bumpers: !!L.bumpers, dark: !!L.dark };
    const asc = Math.max(0, Math.min(GK.MAX_ASC, (run && run.asc) || 0));
    for (let i = 1; i <= asc; i++) {
      const a = GK.ASCENSION[i];
      if (a.target) r.target *= a.target;
      if (a.bossTarget) r.bossTarget *= a.bossTarget;
      if (a.priceUp) r.priceDelta += a.priceUp;
      if (a.reracks) r.reracks += a.reracks;
      if (a.frames) r.frames += a.frames;
      if (a.heatMech) r.heatMech = true;
      if (a.interestCap) r.interestCap = Math.min(r.interestCap, a.interestCap);
      if (a.zone) r.zone *= a.zone;
    }
    return r;
  };

  // ---------- unlocks ----------
  // Most balls, charms, equipment, Lane Tricks and Black Market items start locked. Each feat is a
  // themed achievement that unlocks items matching its theme for future runs. Anything not listed
  // in a feat's `unlocks` (the starter set, every Scorecard but one, all memberships) is open
  // from the first run.
  const F = [];
  const feat = (id, name, desc, unlocks, check) => F.push({ id, name, desc, unlocks, check });
  const fr = e => e.t === 'frame';
  const strike = e => fr(e) && GK.isStrikeKind(e.kind);
  const spare = e => fr(e) && GK.isSpareKind(e.kind);
  const downOf = (e, type) => e.ctx.rolls.reduce((a, r) => a + r.down.filter(d => d.type === type).length, 0);
  const alleyAt = (e, n) => e.run && !e.run.practice && (e.run.alley >= n || GK.isChamp(e.run));
  const noteOf = (e, t) => e.t === 'roll' && e.notes.some(n => n.t === t);

  // Strikes and frames
  feat('strike', 'First Strike', 'Roll a strike.', ['ball:ghost', 'charm:clean_deck'], strike);
  feat('double', 'Double Trouble', 'Roll a Double (2 strikes in a row).', ['ball:twin', 'charm:double_down'], e => fr(e) && e.kind === 'double');
  feat('turkey', 'Turkey Dinner', 'Roll a Turkey (3 strikes in a row).', ['charm:hot_streak', 'charm:crowd_pleaser', 'charm:tv_star'], e => fr(e) && e.kind === 'turkey');
  feat('pocket', 'Pocket Rocket', 'Roll a strike by hitting the headpin in the pocket.', ['charm:corner_pocket', 'equip:hook_glove'], e => strike(e) && e.ctx.pocket);
  feat('big_hook', 'Big Hook', 'Roll a strike with more than 70% hook on the dial.', ['charm:hook_artist', 'equip:snap_wrist', 'equip:lucky_wristband'], e => strike(e) && e.ctx.maxHook > 0.7);
  feat('straight', 'Straight Arrow', 'Roll a strike with almost no hook.', ['equip:slide_shoes', 'equip:rosin_bag'], e => strike(e) && e.ctx.throws > 0 && e.ctx.maxHook < 0.1);
  feat('clutch', 'Clutch', 'Roll a strike in the last frame of a Boss Match.', ['charm:tenth_frame', 'charm:refs_eye'], e => strike(e) && e.ctx.lastFrame && e.ctx.boss);
  feat('full_house', 'Full House', 'Roll a strike with 13 or more pins in your rack.', ['charm:back_row_boss', 'cons:card_fullrack', 'cons:t_spring'], e => strike(e) && GK.padRack(e.run.rack).filter(t => t !== 'none').length >= 13);
  // Spares and splits
  feat('clean_up', 'Clean-Up Crew', 'Pick up 3 spares in one round.', ['cons:t_backrow', 'cons:t_shrink', 'charm:spare_tire'], e => fr(e) && e.run.rs && e.run.rs.frames.filter(f => GK.isSpareKind(f.kind)).length >= 3);
  feat('sharpshooter', 'Sharpshooter', 'Leave exactly one pin, then pick it up.', ['charm:last_pin', 'equip:tape_measure'], e => spare(e) && e.ctx.leftOne);
  feat('comeback', 'Never Say Die', 'Pick up a spare after your first ball knocks down 3 pins or fewer.', ['charm:pin_magnet', 'cons:t_looking'], e => spare(e) && e.ctx.rolls[0] && e.ctx.rolls[0].pins <= 3);
  feat('lucky_seven', 'Lucky Seven', 'Knock down exactly 7 pins with your first ball, then pick up the spare.', ['cons:t_clover', 'charm:raffle'], e => spare(e) && e.ctx.rolls[0] && e.ctx.rolls[0].pins === 7);
  feat('split', 'Split Decision', 'Convert a split.', ['charm:split_personality', 'charm:sniper', 'charm:splitsville'], e => fr(e) && e.kind === 'split');
  feat('seven_ten', 'The 7-10', 'Convert the 7-10 split.', ['charm:seven_ten', 'charm:scrapbook'], e => fr(e) && e.kind === 'split' && e.leave710);
  feat('gutter', 'Gutter Royalty', 'Bowl a gutter frame (no pins at all).', ['charm:gutter_punk', 'charm:snowball_charm', 'charm:bumper_season'], e => fr(e) && e.kind === 'gutter');
  // Pin action
  feat('carry', 'Domino Effect', 'Have 6 pins knocked down by other pins in one frame.', ['charm:chain_gang', 'ball:chain'], e => fr(e) && e.ctx.carry >= 6);
  feat('slow_burn', 'Slow Burn', 'Have 3 pins fall late in one frame.', ['charm:late_bloomer', 'charm:pin_whisperer', 'ball:disco'], e => fr(e) && e.ctx.late >= 3);
  feat('statue', 'Statue', 'Knock down 9 or more pins in a frame without a single pin wobbling.', ['charm:statue', 'charm:odd_pins'], e => fr(e) && e.ctx.pins >= 9 && !e.ctx.wobbles);
  feat('off_wall', 'Off the Wall', 'Bang pins off the side walls 3 times in one frame.', ['charm:rebound', 'ball:boomerang'], e => fr(e) && e.ctx.walls >= 3);
  feat('pit_stop', 'Pit Stop', 'Send 4 pins into the gutters in one frame.', ['charm:pit_crew', 'charm:wide_load', 'ball:duster'], e => fr(e) && e.ctx.gutterPins >= 4);
  feat('demolition', 'Demolition Derby', 'Blast 5 pins with explosions in one frame.', ['charm:pyromaniac', 'ball:bomb', 'cons:t_keg'], e => fr(e) && e.ctx.blasted >= 5);
  feat('heavy_metal', 'Heavy Metal', 'Knock down 3 Lead pins in one frame.', ['charm:scrap_metal', 'ball:spiked', 'ball:wrecking'], e => fr(e) && downOf(e, 'lead') >= 3);
  feat('gold_fever', 'Gold Fever', 'Knock down 3 Gold pins in one frame.', ['ball:golden', 'charm:gold_rush', 'cons:m_blood_money'], e => fr(e) && downOf(e, 'gold') >= 3);
  feat('broken_glass', 'Broken Glass', 'Break a Glass pin.', ['ball:glass', 'charm:graveyard', 'cons:t_seance'], e => fr(e) && e.breaks && e.breaks.length > 0);
  // Big scores
  feat('thunder', 'Thunderstruck', 'Score 2,000 in one frame.', ['ball:lightning', 'cons:m_weighted'], e => fr(e) && e.score >= 2000);
  feat('big_frame', 'Big Frame', 'Score 5,000 in one frame.', ['ball:blackhole', 'charm:moon_shot'], e => fr(e) && e.score >= 5000);
  feat('monster_frame', 'Monster Frame', 'Score 100,000 in one frame.', ['charm:copycat', 'charm:collectors'], e => fr(e) && e.score >= 100000);
  // Timing
  feat('groove', 'In the Groove', 'Throw 5 PERFECT throws in a row.', ['charm:shoes_destiny', 'charm:perfect_form', 'equip:headband', 'league:speed'], e => e.t === 'throw' && e.streak >= 5);
  feat('perfectionist', 'Perfectionist', 'Throw 10 PERFECT throws in a row.', ['charm:groove_master', 'charm:slow_motion', 'equip:knee_pad'], e => e.t === 'throw' && e.streak >= 10);
  feat('regular', 'Lane Regular', 'Throw 40 balls in one run.', ['charm:lane_regular', 'charm:oil_rig', 'cons:m_stolen_oil'], e => e.run && e.run.stats.throws >= 40);
  // Alley mishaps
  feat('fumble', 'Butterfingers', 'See the pinsetter fumble and drop pins.', ['charm:pinsetters_cut', 'charm:butterfingers', 'cons:m_pin_thief'], e => noteOf(e, 'respot'));
  feat('jammed', 'Jammed', 'Get a ball stuck in the ball return.', ['charm:return_tips', 'charm:second_return', 'cons:m_ball_swap'], e => noteOf(e, 'stuck'));
  // Money and shopping
  feat('rich', 'Deep Pockets', 'Hold $30 at once.', ['charm:high_roller', 'charm:resale', 'cons:m_insurance'], e => e.run && e.run.money >= 30);
  feat('broke', 'Flat Broke', 'Spend all your money in a shop, down to $0.', ['charm:loan_shark', 'cons:m_bribe'], e => e.t === 'shop' && e.run.money <= 0);
  feat('window', 'Window Shopper', 'Reroll the same shop 3 times.', ['charm:coupon_book', 'charm:arcade', 'charm:pro_shop_pass'], e => e.run && e.run.shop && e.run.shop.rerolls >= 3);
  feat('full_bag', 'Bag Lady', 'Carry 4 balls at once (you\'ll need a bigger bag).', ['ball:paint', 'ball:pinball', 'cons:m_smuggled'], e => e.run && e.run.bag.length >= 4);
  feat('bracelet', 'Charm Bracelet', 'Fill every charm slot.', ['charm:echo_chamber', 'charm:lucky_coin'], e => e.run && e.run.charms.length >= e.run.maxCharms);
  feat('shiny', 'Shiny Collection', 'Own 3 Foil, Holo or Neon balls and charms at once.', ['cons:t_foil', 'cons:t_holo', 'cons:t_neon'], e => e.run && e.run.charms.filter(c => c.ed).length + e.run.bag.filter(b => b.ed).length >= 3);
  feat('dressed', 'Fully Equipped', 'Wear equipment in 3 slots at once.', ['equip:spinning_shoes', 'cons:m_bootleg'], e => e.run && Object.values(e.run.equip || {}).filter(Boolean).length >= 3);
  feat('custom', 'Custom Job', 'Re-drill a ball.', ['equip:fingerless', 'cons:m_illegal_drill'], e => e.run && e.run.bag.some(b => b.drill && b.drill !== 'stock'));
  feat('shady', 'Shady Dealings', 'Use 3 Black Market items in one run.', ['cons:m_dupe', 'cons:m_fake_id', 'cons:m_fixed'], e => e.run && (e.run.stats.market || 0) >= 3);
  feat('skipper', 'Skipper', 'Skip a round.', ['charm:bake_sale', 'cons:m_snake_oil'], e => e.run && (e.run.history || []).some(h => h.skipped));
  // Bosses and rounds
  feat('purist', 'Purist', 'Win a Boss Match without using a consumable that round.', ['charm:ironman', 'charm:rookie_card'], e => e.t === 'round' && e.boss && !e.run.rs.usedCons);
  feat('lean', 'Travel Light', 'Win a Boss Match with 2 or fewer charms.', ['charm:third_roll', 'charm:underdog'], e => e.t === 'round' && e.boss && e.run.charms.length <= 2);
  feat('boss_rush', 'Boss Rush', 'Beat 3 Boss Matches in one run.', ['charm:trophy_case', 'charm:league_dues', 'cons:m_hot_charm'], e => e.t === 'round' && (e.run.history || []).filter(h => h.won && h.round === 2).length >= 3);
  feat('secretary', 'Minutes Approved', 'Beat the League Secretary.', ['ball:lucky7', 'charm:hecklers_jacket'], e => e.t === 'round' && e.boss === 'secretary');
  feat('mechanic', 'Grease Monkey', 'Beat The Mechanic.', ['ball:magnet', 'ball:cluster', 'equip:wrist_computer'], e => e.t === 'round' && e.boss === 'mechanic');
  feat('strobe', 'Lights Out', 'Beat DJ Strobe.', ['league:cosmic', 'charm:night_shift', 'equip:glasses'], e => e.t === 'round' && e.boss === 'strobe');
  // Alleys
  feat('basement', 'Basement Dweller', 'Reach The Basement.', ['ball:sticky', 'charm:thunderclap'], e => alleyAt(e, 1));
  feat('cosmic', 'Night Owl', 'Reach Cosmic Bowl.', ['ball:echo', 'ball:neonball', 'league:senior'], e => alleyAt(e, 2));
  feat('frostbite', 'Cold Feet', 'Reach Frostbite Rink.', ['ball:mirror', 'ball:giant', 'ball:ice'], e => alleyAt(e, 4));
  feat('snowed_in', 'Snowed In', 'Roll a strike at Frostbite Rink.', ['ball:snowball', 'equip:lucky_socks'], e => strike(e) && !GK.isChamp(e.run) && GK.baseAlley(e.run) === 4);
  feat('carnival', 'Step Right Up', 'Reach Midway Carnival.', ['ball:snake', 'cons:t_loose'], e => alleyAt(e, 5));
  feat('lunar', 'Moonwalker', 'Reach Lunar Lanes.', ['ball:moon', 'ball:bubble'], e => alleyAt(e, 6));
  feat('drain', 'Down the Drain', 'Reach The Gutter.', ['charm:overtime', 'cons:m_debt'], e => alleyAt(e, 7));
  feat('champion', 'Gutter King', 'Beat the Championship.', ['league:pro', 'charm:fourth_ball', 'charm:shadow_bowler'], e => e.t === 'run' && e.won);
  GK.FEATS = F;

  GK.LOCKED = new Set(F.flatMap(f => f.unlocks));
  // Unlocked ids for a meta object; with no meta (tests, bots) everything is open.
  GK.unlockedFor = function (meta) {
    const done = (meta && meta.feats) || {};
    const s = new Set();
    F.forEach(f => { if (done[f.id]) f.unlocks.forEach(u => s.add(u)); });
    return s;
  };
  GK.isUnlocked = function (kind, id) {
    const key = kind + ':' + id;
    if (!GK.LOCKED.has(key)) return true;
    if (!GK._meta) return true;
    return GK.unlockedFor(GK._meta).has(key);
  };
  // Check an event against every unfinished feat. Returns the feats just completed.
  GK.checkFeats = function (meta, e) {
    if (!meta) return [];
    meta.feats = meta.feats || {};
    const out = [];
    for (const f of F) {
      if (meta.feats[f.id]) continue;
      let ok = false;
      try { ok = !!f.check(e); } catch (err) { ok = false; }
      if (ok) { meta.feats[f.id] = true; out.push(f); }
    }
    return out;
  };
  // How much of the locked content a meta object has opened up.
  GK.unlockProgress = function (meta) {
    const u = GK.unlockedFor(meta);
    return { have: [...GK.LOCKED].filter(k => u.has(k)).length, total: GK.LOCKED.size };
  };
  GK.unlockName = function (key) {
    const [k, id] = key.split(':');
    if (k === 'ball') return GK.BALLS[id].full;
    if (k === 'charm') return GK.CHARMS[id].name;
    if (k === 'league') return GK.LEAGUES[id].name;
    if (k === 'equip') return GK.EQUIP[id].name;
    if (k === 'cons') return GK.CONS[id].name;
    return id;
  };
})();
