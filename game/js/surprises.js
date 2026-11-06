// Gutter Kings — surprises (v1.0): the rare jackpot pin, the Regulars dropping by between rounds,
// and a few weird lane events. Pure logic, loaded after frame.js.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- jackpot pin ----------
  // About 1 rack in 150 (never in Boss Matches), one standard pin turns into a sparkling jackpot
  // pin. Knock it down and the lane TV spins a slot machine for a prize.
  GK.PINS.jackpot = { name: 'Jackpot Pin', desc: 'Knock it down to spin the slot machine on the lane TV. 10 Points.', chips: 10, body: '#fff2b0', shade: '#e0b830', band: '#ff4a8a' };
  GK.JACKPOT_CHANCE = 1 / 150;
  GK.jackpotPin = function (run, fi, rack) {
    if (run.practice || run.rs.boss) return -1;
    const r = GK.stream(run.seed, 'jackpot:' + run.alley + ':' + run.round + ':' + fi);
    if (r() >= GK.JACKPOT_CHANCE) return -1;
    const std = rack.map((t, i) => t === 'std' ? i : -1).filter(i => i >= 0);
    return std.length ? r.pick(std) : -1;
  };
  // The slot machine. Returns { reels: [3 symbols], text }.
  GK.jackpotSpin = function (run) {
    const r = GK.stream(run.seed, 'spin:' + run.stats.throws + ':' + run.alley + ':' + run.round), x = r();
    const give = (reels, text, fn) => { fn(); return { reels, text }; };
    if (x < 0.06) return give(['7', '7', '7'], 'JACKPOT! 7-7-7: +$20', () => { run.money += 20; });
    if (x < 0.36) return give(['$', '$', '$'], 'Cash line: +$8', () => { run.money += 8; });
    if (x < 0.56 && run.cons.length < run.maxCons) {
      const pool = GK.CONS_LIST.filter(c => c.kind !== 'market' && GK.isUnlocked('cons', c.id));
      const k = r.pick(pool);
      return give(['?', '?', '?'], 'Mystery line: ' + k.name, () => { run.cons.push(k.id); });
    }
    if (x < 0.72 && run.charms.length < run.maxCharms) {
      const pool = GK.CHARM_LIST.filter(c => c.rarity === 'uncommon' && !run.charms.some(o => o.id === c.id) && GK.isUnlocked('charm', c.id));
      if (pool.length) { const c = r.pick(pool); return give(['♣', '♣', '♣'], 'Charm line: ' + c.name, () => { run.charms.push(GK.charmInst(c.id)); }); }
    }
    return give(['$', '$', '7'], 'Almost! +$5', () => { run.money += 5; });
  };

  // ---------- lane events ----------
  Object.assign(GK.LANE_EVENTS, {
    party: { name: 'Birthday party', desc: 'The next lane over lent you their balloons. Every pin knocked down this frame is worth +4 Points.' },
    blackout: { name: 'Blackout bowling', desc: 'The lights are out and only the pins glow. ×1.5 Mult this frame.' },
    runaway: { name: 'Runaway pin', desc: 'One pin won\'t stand still! It slides back and forth until your ball reaches it. Knock it down for $2.' }
  });

  // ---------- the Regulars drop by ----------
  // Quinn, Kaleb or Levi turns up between rounds with a gift, a dare or a tip.
  GK.EVENTS.regular = { name: 'A regular drops by', desc: '' };
  const WHO = { quinn: 'Quinn', kaleb: 'Kaleb', levi: 'Levi' };
  const TIPS = {
    quinn: 'Let the ball do the work. Start out wide and trust the hook to bring it back.',
    kaleb: 'Use the whole lane! Out to the edge, then let it swing all the way back.',
    levi: 'Throw it like you mean it. Commit to the shot.'
  };
  GK.regularVisit = function (run, rng) {
    const who = rng.pick(Object.keys(WHO)), kind = rng.pick(['gift', 'gift', 'dare', 'tip']), name = WHO[who];
    const ev = { who, kind };
    if (kind === 'gift') {
      ev.title = name + ' drops by';
      if (who === 'quinn') { ev.say = '"Lane fees are on me tonight."'; ev.offer = '$6'; ev.take = 'Thanks, ' + name + '!'; }
      if (who === 'kaleb') {
        const pool = GK.CHARM_LIST.filter(c => c.rarity === 'uncommon' && !run.charms.some(o => o.id === c.id) && GK.isUnlocked('charm', c.id));
        ev.charm = pool.length ? rng.pick(pool).id : null;
        ev.say = '"Found this in my bag. I think it\'s lucky. Probably."'; ev.offer = ev.charm ? GK.CHARMS[ev.charm].name : '$5'; ev.take = 'Thanks, ' + name + '!';
      }
      if (who === 'levi') {
        const pool = GK.CONS_LIST.filter(c => c.kind === 'trick' && GK.isUnlocked('cons', c.id));
        ev.item = rng.pick(pool).id;
        ev.say = '"Here, take this. The ducks told me you\'d need it."'; ev.offer = GK.CONS[ev.item].name; ev.take = 'Thanks, ' + name + '!';
      }
    } else if (kind === 'dare') {
      ev.title = name + ' has a dare';
      ev.say = '"Bet you can\'t strike on your very first frame next round. Do it and I\'ll pay you $10."';
      ev.offer = '$10 for a first-frame strike'; ev.take = 'You\'re on!';
    } else {
      ev.title = name + ' has a tip';
      ev.say = '"' + TIPS[who] + '"';
      ev.offer = '+2 Groove at the start of next round'; ev.take = 'Good tip';
    }
    return ev;
  };
  GK.takeRegular = function (run, ev) {
    const name = WHO[ev.who];
    if (ev.kind === 'gift') {
      if (ev.who === 'quinn') { run.money += 6; return { ok: true, msg: name + ' covers your lane fees: +$6' }; }
      if (ev.who === 'kaleb') {
        if (ev.charm && run.charms.length < run.maxCharms) { run.charms.push(GK.charmInst(ev.charm)); return { ok: true, msg: name + ' gave you ' + GK.CHARMS[ev.charm].name }; }
        run.money += 5; return { ok: true, msg: 'No room for a charm, so ' + name + ' gives you $5 instead' };
      }
      if (ev.who === 'levi') {
        if (run.cons.length < run.maxCons) { run.cons.push(ev.item); return { ok: true, msg: name + ' gave you ' + GK.CONS[ev.item].name }; }
        run.money += 4; return { ok: true, msg: 'Your pockets are full, so ' + name + ' gives you $4 instead' };
      }
    }
    if (ev.kind === 'dare') { run.dare = { who: ev.who, pay: 10 }; return { ok: true, msg: 'Dare accepted: strike on your first frame next round' }; }
    run.grooveNext = (run.grooveNext || 0) + 2;
    return { ok: true, msg: 'You\'ll start next round with +2 Groove' };
  };
  // A dare is settled on the first frame of the next round.
  GK.settleDare = function (run, kind) {
    const d = run.dare; if (!d) return null;
    run.dare = null;
    const name = WHO[d.who];
    if (GK.isStrikeKind(kind)) { run.money += d.pay; return { t: 'dare', won: true, who: d.who, text: name + ' pays up: +$' + d.pay + '!' }; }
    return { t: 'dare', won: false, who: d.who, text: 'Dare failed. ' + name + ' will never let you forget it.' };
  };
})();
