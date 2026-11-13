// Gutter Kings — frame evaluation. Builds a context from the roll records the physics produced,
// then runs the pipeline: shot base → each roll (pins, pin types, ball, ball edition) → charms
// left to right (with editions, Copycat, Lucky Seven retriggers) → round modifiers.
// Every effect becomes a step the UI animates one by one, Balatro-style.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // Two or more separate groups of standing pins with the headpin down = a split.
  GK.isSplitLeave = function (standingPins, lhw) {
    if (standingPins.some(p => p.n === 1) || standingPins.length < 2) return false;
    const lim = 12.2 * Math.min(1, (lhw || GK.C.LHW) / GK.C.LHW);
    const seen = new Set(); let comps = 0;
    for (const s of standingPins) {
      if (seen.has(s)) continue; comps++;
      const q = [s]; seen.add(s);
      while (q.length) {
        const c = q.pop();
        for (const o of standingPins) {
          if (seen.has(o)) continue;
          if (Math.hypot(c.sx - o.sx, c.sz - o.sz) < lim) { seen.add(o); q.push(o); }
        }
      }
    }
    return comps >= 2;
  };

  // Classify a finished frame from its rolls. strikeStreak is the streak before this frame.
  GK.classify = function (rolls, cleared, splitLeave, strikeStreak) {
    if (cleared && rolls.length === 1) {
      const st = strikeStreak + 1;
      return st >= 3 ? 'turkey' : st === 2 ? 'double' : 'strike';
    }
    if (cleared) return splitLeave ? 'split' : 'spare';
    const pins = rolls.reduce((a, r) => a + r.pins, 0);
    return pins === 0 ? 'gutter' : 'open';
  };

  GK.shotBase = function (kind, levels) {
    const s = GK.SHOTS[kind], lv = (levels && levels[kind]) || 0;
    return { chips: s.c + lv * s.lv[0], mult: s.m + lv * s.lv[1], lv };
  };

  GK.buildCtx = function (f, run) {
    const rolls = f.rolls;
    const sum = k => rolls.reduce((a, r) => a + (r[k] || 0), 0);
    const down = new Set(); rolls.forEach(r => r.down.forEach(d => down.add(d.n)));
    return {
      kind: f.kind, rolls, run, pins: sum('pins'), down,
      carry: sum('carry'), late: sum('late'), walls: sum('walls'), pit: sum('pit'), ballBounces: sum('ballBounces'),
      explosions: sum('explosions'), blasted: sum('blasted'), swallowed: sum('swallowed'), fast: sum('fast'),
      firstPin: rolls[0] ? rolls[0].firstPin : 0,
      lastRollPins: rolls.length ? rolls[rolls.length - 1].pins : 0,
      leftSplit: !!f.leftSplit, leave710: !!f.leave710,
      frameIdx: f.frameIdx || 0, lastFrame: !!f.lastFrame,
      perfects: rolls.filter(r => r.perfect === true).length, misses: rolls.filter(r => r.perfect === false).length,
      backRow: [...down].filter(n => n >= 11).length,
      gutterPins: sum('gutterPins'), boards: sum('boards'), wobbles: sum('wobbles'), leadDown: sum('leadDown'),
      deckLeft: rolls.length ? rolls[rolls.length - 1].deckLeft || 0 : 0,
      pocket: !!(rolls[0] && rolls[0].pocket),
      gutterBall: rolls.some(r => r.gutterBall),
      cheer: GK.isStrikeKind(f.kind) || (!!f.leave710 && GK.isSpareKind(f.kind)),
      framesLeft: f.framesLeft != null ? f.framesLeft : 99,
      maxHook: f.maxHook || 0, throws: f.throws != null ? f.throws : rolls.length,
      dark: !!f.dark, boss: !!f.boss, oil: f.oil || 'house',
      fumbles: f.fumbles || 0, jams: f.jams || 0, leftOne: !!f.leftOne,
      travel: rolls[0] ? rolls[0].travel || 0 : 0
    };
  };

  // f: { kind, rolls, frameIdx, lastFrame, leftSplit, leave710, loaded, call: 'hit'|'miss'|null }
  // run: needs levels, charms, money; opts: { rng, stolen (charm index disabled) }
  GK.scoreFrame = function (f, run, opts = {}) {
    const rng = opts.rng || GK.makeRng(1);
    const ctx = GK.buildCtx(f, run);
    const steps = [];
    let chips = 0, mult = 0, money = 0;
    const breaks = [];
    const push = (st) => {
      if (st.op === 'chips') chips += st.v;
      else if (st.op === 'mult') mult += st.v;
      else if (st.op === 'xmult') mult *= st.v;
      else if (st.op === 'money') money += st.v;
      st.chips = chips; st.mult = mult;
      steps.push(st);
    };
    const mk = (src, idx) => ({
      chips: (v, label) => v && push({ src, idx, op: 'chips', v: Math.round(v), label }),
      mult: (v, label) => v && push({ src, idx, op: 'mult', v, label }),
      xmult: (v, label) => v !== 1 && push({ src, idx, op: 'xmult', v, label }),
      money: (v, label) => v && push({ src, idx, op: 'money', v, label })
    });

    // 1. shot base
    const base = GK.shotBase(f.kind, run.levels);
    chips = base.chips; mult = base.mult;
    steps.push({ src: 'shot', op: 'set', chips, mult, label: GK.SHOTS[f.kind].name + (base.lv ? ' Lv.' + (base.lv + 1) : '') });
    // Full Rack: strikes with 13+ pins in the rack, levelled by the Full Rack Card.
    const frLv = (run.levels && run.levels.fullrack) || 0;
    if (frLv && GK.isStrikeKind(f.kind) && (f.rackSize || 0) >= 13) {
      const fs = mk('shot', 0), lv = GK.SHOTS.fullrack.lv;
      fs.chips(lv[0] * frLv, 'Full Rack Lv.' + (frLv + 1)); fs.mult(lv[1] * frLv, 'Full Rack Lv.' + (frLv + 1));
    }

    // 2. rolls
    let retrigger = false;
    f.rolls.forEach((r, ri) => {
      const s = mk('roll', ri);
      const bt = r.ball, ed = r.edition;
      let pinChips = 0;
      for (const d of r.down) {
        const def = GK.PINS[d.type] || GK.PINS.std;
        let c = def.chips;
        if (d.swallowed) c *= 2;
        if (f.weighted && d.type === 'lead') c *= 2;
        pinChips += c;
      }
      const bonus = r.carry * GK.BONUS.carry + r.late * GK.BONUS.late + r.walls * GK.BONUS.wall;
      let rc = bt === 'golden' ? bonus : pinChips + bonus;
      if (bt === 'lead') rc *= 0.5;
      if (bt === 'giant') rc *= 0.6;
      if (r.rebounded) rc *= 0.5;
      const parts = [r.pins + ' pin' + (r.pins === 1 ? '' : 's')];
      if (r.carry) parts.push(r.carry + ' carry');
      if (r.late) parts.push(r.late + ' late');
      if (r.walls) parts.push(r.walls + ' wall');
      if (r.swallowed) parts.push(r.swallowed + ' swallowed');
      if (rc) s.chips(rc, (bt === 'pinsetter' ? 'Pinsetter' : 'Roll ' + (ri + 1)) + ': ' + parts.join(', ') + (bt === 'lead' || r.rebounded ? ' (×0.5)' : bt === 'giant' ? ' (×0.6)' : ''));
      // pin types
      const ps = mk('pin', ri);
      for (const d of r.down) {
        if (d.type === 'gold') ps.money(1, 'Gold pin ' + d.n);
        if (d.type === 'glass') { ps.xmult(1.25, 'Glass pin ' + d.n); if (rng() < 0.25) breaks.push(d.n); }
        if (d.type === 'lucky') {
          if (rng() < 1 / 4) ps.mult(5, 'Lucky pin ' + d.n);
          if (rng() < 1 / 8) ps.money(3, 'Lucky pin ' + d.n);
        }
        if (d.type === 'phantom') ps.mult(3, 'Phantom pin ' + d.n);
        if (d.type === 'wobbly' && d.by === 'late') ps.mult(2, 'Wobbly pin ' + d.n);
        if (d.type === 'rubber' && d.rubber) ps.chips(3 * d.rubber, 'Rubber pin ' + d.n);
      }
      // ball
      const bs = mk('ball', ri), bname = GK.BALLS[bt] ? GK.BALLS[bt].full : bt;
      if (bt === 'feather' && r.carry) bs.mult(r.carry, bname + ': ' + r.carry + ' carry');
      if (bt === 'bouncer' && r.ballBounces) bs.chips(6 * r.ballBounces, bname + ': ' + r.ballBounces + ' bounce');
      if (bt === 'golden' && r.pins) bs.money(r.pins, bname);
      if (bt === 'glass') bs.xmult(2, bname);
      if (bt === 'twohander' && GK.isStrikeKind(f.kind) && f.rolls.length === 1 && r.pocket && Math.abs(r.startX || 0) >= (r.lhw || GK.C.LHW) - 5.3) bs.xmult(2, bname + ': outside line into the pocket');
      if (bt === 'loftduck' && r.late) bs.chips(15 * r.late, bname + ': ' + r.late + ' late pin' + (r.late > 1 ? 's' : ''));
      if (bt === 'wideswing' && r.boards) { bs.chips(5 * r.boards, bname + ': ' + r.boards + ' boards'); if (r.boards >= 25) bs.xmult(1.5, bname + ': the whole lane'); }
      if (bt === 'neonball' && r.pins) bs.mult(r.pins, bname + ': ' + r.pins + ' glowing pin' + (r.pins > 1 ? 's' : ''));
      if (bt === 'tiny' && r.direct) bs.mult(r.direct, bname + ': ' + r.direct + ' direct hit' + (r.direct > 1 ? 's' : ''));
      if (bt === 'lucky7' && r.pins === 7) { retrigger = true; push({ src: 'ball', idx: ri, op: 'note', v: 0, label: 'Lucky Seven! Charms trigger twice' }); }
      if (ed === 'foil') bs.chips(GK.EDITIONS.foil.chips, 'Foil ' + bname);
      if (ed === 'holo') bs.mult(GK.EDITIONS.holo.mult, 'Holo ' + bname);
      if (ed === 'neon') bs.xmult(GK.EDITIONS.neon.xmult, 'Neon ' + bname);
    });

    // 3. charms
    const charms = run.charms || [];
    charms.forEach((inst, i) => {
      if (opts.stolen === i) { push({ src: 'charm', idx: i, op: 'note', v: 0, label: opts.asleep ? 'Asleep (Old Father Time)' : 'Stolen by the Gutter King' }); return; }
      let def = GK.charmDef(inst), data = inst;
      if (def && def.copy) {
        const nb = charms[i + 1];
        if (nb && opts.stolen !== i + 1 && !GK.CHARMS[nb.id].copy) { def = GK.charmDef(nb); data = nb; } else def = null;
      }
      const s = mk('charm', i);
      if (def && def.score) {
        const ctxC = Object.assign({}, ctx, { run: Object.assign({}, run, { money: run.money + money }) });
        def.score(ctxC, s, data);
        if (retrigger) def.score(ctxC, s, data);
        if (inst.corrupt) def.score(ctxC, s, data); // corrupted: triggers twice...
        if (inst.curse || inst.blessed) def.score(ctxC, s, data); // cursed charms trigger twice too
      }
      if (inst.corrupt) s.money(-1, 'Corruption'); // ...and costs $1 a frame
      if (inst.curse && inst.curse.id === 'leaky') s.money(-1, 'Leaky Pockets (curse)');
      if (inst.curse && inst.curse.id === 'jinx') s.mult(-3, 'Jinx (curse)');
      const ed = inst.ed;
      if (ed === 'foil') s.chips(GK.EDITIONS.foil.chips, 'Foil');
      if (ed === 'holo') s.mult(GK.EDITIONS.holo.mult, 'Holo');
      if (ed === 'neon') s.xmult(GK.EDITIONS.neon.xmult, 'Neon');
    });

    // 3b. boss trophies: their own shelf, never stolen
    (run.trophies || []).forEach((inst, i) => {
      const d = GK.TROPHIES[inst.id]; if (!d || !d.score) return;
      d.score(Object.assign({}, ctx, { run: Object.assign({}, run, { money: run.money + money }) }), mk('trophy', i), inst);
    });

    // 4. round modifiers
    const bs = mk('boss', 0);
    if (f.rentMiss) bs.mult(-2, 'Missed rent (The Landlord)');
    if (f.leagueMult) bs.mult(f.leagueMult, f.leagueName || 'League');
    if (f.party && ctx.pins) bs.chips(4 * ctx.pins, 'Birthday party: ' + ctx.pins + ' balloons popped');
    if (f.blackout) bs.xmult(1.5, 'Blackout bowling');
    if (f.runaway != null && ctx.down.has(f.runaway)) bs.money(2, 'Caught the runaway pin');
    if (f.groove) { if (f.grooveX) bs.xmult(1 + 0.1 * f.groove, 'Groove Master ×' + f.groove); else bs.mult(f.groove, 'Groove ×' + f.groove); }
    if (f.loaded) bs.xmult(3, 'Loaded Ball');
    if (f.call === 'hit') bs.xmult(2, 'Called it!');
    if (f.call === 'miss') bs.xmult(0.5, 'Wrong call');

    // The Echo: a frame that doesn't beat your echoed best scores half.
    if (f.echo && chips * mult <= f.echo) bs.xmult(0.5, 'The Echo (' + Math.round(f.echo).toLocaleString('en-US') + ' to beat)');
    mult = Math.max(0, mult); chips = Math.max(0, chips);
    const score = Math.floor(chips * mult);
    return { steps, chips, mult, score, money, breaks, retrigger, ctx };
  };

  // Scaling charms update after the frame is scored (once, even with retriggers).
  GK.afterFrame = function (ctx, run, stolen) {
    (run.charms || []).forEach((inst, i) => {
      if (stolen === i) return;
      const def = GK.charmDef(inst);
      if (def && def.after) def.after(ctx, inst);
    });
  };

  // Rough live chip count shown while pins are still falling.
  GK.liveChips = function (rolls, sim) {
    let c = 0;
    for (const r of rolls) c += r.pins * 5 + r.carry * 3;
    if (sim && sim.roll) {
      const down = sim.pins.filter(p => !p.standing && !p.counted).length;
      c += down * 5 + sim.roll.carry * 3 + sim.roll.late * 4 + sim.roll.walls * 2;
    }
    return c;
  };
})();
