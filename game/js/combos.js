// Combo charms: certain pairs of charms unlock a hidden bonus when they sit next to each other
// in your charm row (either order). Each one you find goes in the Combo Book.
(function () {
  const GK = globalThis.GK;
  const strike = k => GK.isStrikeKind(k), spare = k => GK.isSpareKind(k);
  const C = (id, a, b, name, desc, score) => ({ id, a, b, name, desc, score });
  GK.COMBOS = [
    C('strike_engine', 'strike_out', 'hot_streak', 'Strike Engine', '×1.5 Mult on any Strike, Double or Turkey.', (c, s) => strike(c.kind) && s.xmult(1.5)),
    C('spare_room', 'spare_parts', 'practice', 'Spare Room', '+15 Mult on a Spare or Split conversion.', (c, s) => spare(c.kind) && s.mult(15)),
    C('savings', 'piggy_bank', 'tip_jar', 'Savings Account', 'Earn $1 on every Strike or Spare.', (c, s) => (strike(c.kind) || spare(c.kind)) && s.money(1)),
    C('ritual', 'chalk_bag', 'lucky_shoes', 'Pre-Game Ritual', '+100 Points every frame.', (c, s) => s.chips(100)),
    C('domino_rally', 'domino', 'chain_gang', 'Domino Rally', '+3 Mult for every pin that knocks over another pin.', (c, s) => c.carry && s.mult(3 * c.carry)),
    C('fireworks', 'pyromaniac', 'moon_shot', 'Fireworks', '×2 Mult if something exploded and a pin reached the pit.', (c, s) => c.explosions && c.pit && s.xmult(2)),
    C('late_show', 'late_bloomer', 'pocket_watch', 'The Late Show', '+4 Mult for each pin that falls late.', (c, s) => c.late && s.mult(4 * c.late)),
    C('lightning_rod', 'thunderclap', 'rail_rider', 'Lightning Rod', '+2 Mult for each quick pin and each wall bang.', (c, s) => { const n = c.fast + c.walls; if (n) s.mult(2 * n); }),
    C('mixed_signals', 'hook_artist', 'straight_shooter', 'Mixed Signals', 'They cancel out into +10 Mult every frame. Nobody knows why.', (c, s) => s.mult(10)),
    C('bad_influence', 'high_roller', 'loan_shark', 'Bad Influence', '×1.5 Mult while you\'re in debt.', (c, s) => c.run.money < 0 && s.xmult(1.5)),
    C('museum_piece', 'statue', 'perfect_form', 'Museum Piece', '×2 Mult if no pin wobbled and every throw was PERFECT.', (c, s) => !c.wobbles && c.perfects > 0 && !c.misses && s.xmult(2)),
    C('nothing_to_lose', 'underdog', 'glass_cannon', 'Nothing to Lose', '×2 Mult every frame.', (c, s) => s.xmult(2)),
    C('closing_time', 'tenth_frame', 'late_night', 'Closing Time', '×3 Mult on the last frame of a round.', (c, s) => c.lastFrame && s.xmult(3)),
    C('splitting_headache', 'split_personality', 'seven_ten', 'Splitting Headache', '×3 Mult on a Split conversion.', (c, s) => c.kind === 'split' && s.xmult(3)),
    C('marksman', 'sniper', 'spare_tire', 'Marksman', '×2 Mult on a spare picked up with a single pin left.', (c, s) => spare(c.kind) && c.lastRollPins === 1 && s.xmult(2)),
    C('bone_collector', 'graveyard', 'pin_collector', 'Bone Collector', '+2 Mult for every pin knocked down this frame.', (c, s) => c.pins && s.mult(2 * c.pins)),
    C('prime_time', 'crowd_pleaser', 'tv_star', 'Prime Time', '×1.5 Mult on any Strike or Spare.', (c, s) => (strike(c.kind) || spare(c.kind)) && s.xmult(1.5)),
    C('table_for_four', 'bowling_buddy', 'regulars', 'Table for Four', '+8 Mult for every ball in your bag.', (c, s) => s.mult(8 * c.run.bag.length)),
    C('corner_suite', 'corner_office', 'back_row_boss', 'Corner Suite', '+60 Points for each corner pin (7, 10) and back-row pin knocked down.', (c, s) => { const n = (c.down.has(7) ? 1 : 0) + (c.down.has(10) ? 1 : 0) + c.backRow; if (n) s.chips(60 * n); }),
    C('odd_couple', 'odd_pins', 'lucky_coin', 'The Odd Couple', '×1.5 Mult more if an odd number of pins fell.', (c, s) => c.pins % 2 && s.xmult(1.5)),
    C('in_the_pocket', 'groove_master', 'slow_motion', 'In the Pocket', '+2 Mult for every stack of Groove.', (c, s) => { const g = c.run.rs ? c.run.rs.groove || 0 : 0; if (g) s.mult(2 * g); }),
    C('heavy_rack', 'scrap_metal', 'rack_attack', 'Heavy Rack', '+25 Points for each Lead pin knocked down, plus +3 Mult.', (c, s) => { if (c.leadDown) s.chips(25 * c.leadDown); s.mult(3); })
  ];
  GK.COMBO = {}; GK.COMBOS.forEach(c => { GK.COMBO[c.id] = c; });
  // Which combos are live in this charm row: [{ id, i }] where i is the left charm of the pair.
  GK.activeCombos = function (charms, stolen) {
    const out = [];
    for (let i = 0; i + 1 < (charms || []).length; i++) {
      if (stolen === i || stolen === i + 1) continue;
      const a = charms[i].id, b = charms[i + 1].id;
      const k = GK.COMBOS.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
      if (k && !out.some(o => o.id === k.id)) out.push({ id: k.id, i });
    }
    return out;
  };
  // A hint for an undiscovered combo in the book: one of the two charms.
  GK.comboHint = c => 'Something happens when ' + GK.CHARMS[c.a].name + ' sits next to the right charm.';
})();
