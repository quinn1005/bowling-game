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
  // Everything not listed in a feat's `unlocks` is available from the first run.
  const F = [];
  const feat = (id, name, desc, unlocks, check) => F.push({ id, name, desc, unlocks, check });
  feat('strike', 'First Strike', 'Roll a strike.', ['ball:ghost'], e => e.t === 'frame' && GK.isStrikeKind(e.kind));
  feat('turkey', 'Turkey Dinner', 'Roll a Turkey (3 strikes in a row).', ['charm:hot_streak'], e => e.t === 'frame' && e.kind === 'turkey');
  feat('split', 'Split Decision', 'Convert a split.', ['charm:split_personality', 'charm:sniper'], e => e.t === 'frame' && e.kind === 'split');
  feat('seven_ten', 'The 7-10', 'Convert the 7-10 split.', ['charm:seven_ten'], e => e.t === 'frame' && e.kind === 'split' && e.leave710);
  feat('gutter', 'Gutter Royalty', 'Bowl a gutter frame (no pins at all).', ['charm:gutter_punk'], e => e.t === 'frame' && e.kind === 'gutter');
  feat('big_frame', 'Big Frame', 'Score 5,000 Points in one frame.', ['ball:blackhole', 'charm:moon_shot'], e => e.t === 'frame' && e.score >= 5000);
  feat('monster_frame', 'Monster Frame', 'Score 100,000 Points in one frame.', ['charm:copycat'], e => e.t === 'frame' && e.score >= 100000);
  feat('groove', 'In the Groove', 'Throw 5 PERFECT throws in a row.', ['charm:shoes_destiny', 'league:speed'], e => e.t === 'throw' && e.streak >= 5);
  feat('carry', 'Domino Effect', 'Have 6 pins knocked down by other pins in one frame.', ['charm:chain_gang'], e => e.t === 'frame' && e.ctx.carry >= 6);
  feat('slow_burn', 'Slow Burn', 'Have 3 pins fall late in one frame.', ['charm:late_bloomer', 'charm:pin_whisperer'], e => e.t === 'frame' && e.ctx.late >= 3);
  feat('demolition', 'Demolition Derby', 'Blast 5 pins with explosions in one frame.', ['charm:pyromaniac'], e => e.t === 'frame' && e.ctx.blasted >= 5);
  feat('rich', 'Deep Pockets', 'Hold $30 at once.', ['charm:high_roller'], e => e.run && e.run.money >= 30);
  feat('secretary', 'Minutes Approved', 'Beat the League Secretary.', ['ball:lucky7'], e => e.t === 'round' && e.boss === 'secretary');
  feat('mechanic', 'Grease Monkey', 'Beat The Mechanic.', ['ball:magnet', 'ball:cluster'], e => e.t === 'round' && e.boss === 'mechanic');
  feat('cosmic', 'Night Owl', 'Reach Cosmic Bowl.', ['ball:echo', 'league:senior'], e => e.run && e.run.alley >= 2);
  feat('strobe', 'Lights Out', 'Beat DJ Strobe.', ['league:cosmic'], e => e.t === 'round' && e.boss === 'strobe');
  feat('frostbite', 'Cold Feet', 'Reach Frostbite Rink.', ['ball:mirror', 'ball:giant'], e => e.run && e.run.alley >= 4);
  feat('lean', 'Travel Light', 'Win a Boss Match with 2 or fewer charms.', ['charm:third_roll'], e => e.t === 'round' && e.boss && e.run.charms.length <= 2);
  feat('champion', 'Gutter King', 'Beat the Championship.', ['league:pro'], e => e.t === 'run' && e.won);
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
  GK.unlockName = function (key) {
    const [k, id] = key.split(':');
    if (k === 'ball') return GK.BALLS[id].full;
    if (k === 'charm') return GK.CHARMS[id].name;
    if (k === 'league') return GK.LEAGUES[id].name;
    return id;
  };
})();
