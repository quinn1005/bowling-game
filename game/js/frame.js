// Gutter Kings — frame flow (rolls, re-racks, bosses) on top of run state + Sim. No DOM, so a bot
// can play whole runs headless. The UI controller (main.js) calls these and animates the results.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  GK.laneFor = function (run) {
    const L = Object.assign({}, GK.alleyDef(run).lane || {});
    const rs = run.rs;
    if (GK.rules(run).dark) L.dark = true;
    if (rs && rs.oil) L.oil = rs.oil;
    if (rs && rs.boss === 'fog') { L.dark = true; L.fog = true; }
    if (rs && rs.cur && (rs.cur.laneEvent === 'flicker' || rs.cur.laneEvent === 'blackout')) L.dark = true;
    return L;
  };

  // Rare lane-condition surprises at the start of a frame (never in Boss Matches).
  GK.LANE_EVENTS = {
    flicker: { name: 'Power flicker', desc: 'The lights cut out for this frame. Only a few pins glow.' },
    sticky: { name: 'Sticky approach', desc: 'Someone spilled soda on the approach. The start slider jitters this frame.' },
    topup: { name: 'Oil top-up', desc: 'The lane machine ran early: your lane is freshly oiled again.' }
  };
  GK.LANE_EVENT_CHANCE = 0.1;

  // Start a frame. With resume=true, rebuild the frame saved mid-way (same rolls, same standing
  // pins) without re-applying start-of-frame costs, so quitting can't undo a throw.
  GK.beginFrame = function (run, resume) {
    const rs = run.rs, fl = GK.flags(run, rs.stolen);
    const fi = rs.frameIdx;
    const rng = GK.stream(run.seed, 'phys:' + run.alley + ':' + run.round + ':' + fi);
    const keep = resume && rs.cur ? rs.cur : null;
    if (!keep) {
      rs.cur = { rolls: [], rollIdx: 0, splitLeave: false, leave710: false, retakeUsed: false, call: null, bet: 0, maxRolls: fl.third ? 3 : 2, throwN: 0, laneEvent: null, pinState: null, pending: null };
      const cur = rs.cur;
      if (!run.practice && !rs.boss && fi > 0) {
        const er = GK.stream(run.seed, 'laneev:' + run.alley + ':' + run.round + ':' + fi);
        if (er() < GK.LANE_EVENT_CHANCE) cur.laneEvent = er.pick(Object.keys(GK.LANE_EVENTS));
      }
      if (cur.laneEvent === 'topup') rs.wear = GK.newWear();
      if (rs.boss === 'janitor' && fi > 0) rs.wear = rs.wear.map(w => w > 0.04 ? -0.2 : w);
      if (rs.boss === 'bookie') { const bet = Math.floor(Math.max(0, run.money) / 2); cur.bet = bet; run.money -= bet; }
      if (rs.boss === 'landlord') { if (run.money >= 2) { run.money -= 2; cur.rent = 2; } else cur.rentMiss = true; }
      cur.rack = GK.frameRack(run, fi);
      cur.maxHook = 0; cur.throws = 0; cur.jams = 0; cur.fumbles = 0;
    }
    const rack = (keep && keep.rack) || GK.frameRack(run, fi);
    const sim = new GK.Sim({
      lane: GK.laneFor(run), rng, rack, lightLead: !!fl.lightLead, noWear: !!fl.noWear, wear: rs.wear || (rs.wear = GK.newWear()),
      layout: rs.boss === 'astronaut' ? 'random' : 'std',
      winter: rs.boss === 'winter', heavyStd: rs.boss === 'golem',
      posts3: rs.boss === 'strongman', magnetK: rs.boss === 'rats' ? 2 : 1,
      tilt: rs.boss === 'ringmaster' ? rs.tilts[fi % rs.tilts.length] : 0
    });
    sim.rememberLayout();
    if (keep && keep.pinState) sim.applyPinState(keep.pinState);
    // Runaway pin: one standing pin slides back and forth until the ball gets to it.
    if (rs.cur.laneEvent === 'runaway') {
      if (rs.cur.runaway == null) { const up = sim.pins.filter(p => p.standing && p.type !== 'none'); rs.cur.runaway = up.length ? GK.stream(run.seed, 'runaway:' + run.alley + ':' + run.round + ':' + fi).pick(up).n : -1; }
      sim.runaway = rs.cur.runaway;
    }
    return sim;
  };
  // This frame's rack: Paint Ball conversions, Weighted Pins and the Pin Thief applied on top of
  // the run's rack (the run's own rack is never changed by these round-only effects).
  GK.PAINT_TYPES = ['gold', 'glass', 'lucky', 'phantom', 'wobbly', 'rubber', 'explosive', 'bouncy', 'mirror'];
  GK.frameRack = function (run, fi) {
    const rs = run.rs;
    let rack = GK.padRack(run.rack).slice();
    if (rs.paint) rack = rack.map((t, i) => t === 'std' && rs.paint[i + 1] ? rs.paint[i + 1] : t);
    if (rs.weighted) rack = rack.map(t => t === 'none' ? t : 'lead');
    if (rs.thief) {
      const have = rack.map((t, i) => t === 'none' ? -1 : i).filter(i => i >= 0);
      if (have.length > 1) rack[GK.stream(run.seed, 'thief:' + run.alley + ':' + run.round + ':' + fi).pick(have)] = 'none';
    }
    const jp = GK.jackpotPin ? GK.jackpotPin(run, fi, rack) : -1;
    if (jp >= 0) rack[jp] = 'jackpot';
    return rack;
  };
  // Standing pins after a roll, so a saved frame can be rebuilt exactly.
  GK.capturePins = sim => sim.pins.filter(p => p.standing && !p.cleared && !p.gone).map(p => ({ n: p.n, x: +p.x.toFixed(2), z: +p.z.toFixed(2) }));

  // Ball drilling (re-drill at the shop or from the lane mechanic event).
  GK.DRILLS = {
    stock: { name: 'Stock layout', desc: 'The factory drilling.' },
    strong: { name: 'Strong layout', desc: 'Hooks 40% harder everywhere.', hook: 1.4 },
    control: { name: 'Control layout', desc: 'Hooks 40% less. Easier to keep on your line.', hook: 0.6 },
    flare: { name: 'Skid-flare layout', desc: 'Skids straight through the oil, then snaps hard on the dry boards.', flare: true },
    // Only from the Black Market's Unlicensed Drill; never offered at the shop.
    illegal: { name: 'Illegal layout', desc: 'Hooks twice as hard, but jams in the return twice as often.', hook: 2, jam: 2, hidden: true }
  };

  // Chances for the alley's machinery to act up.
  GK.MISHAPS = { respot: 0.05, stuck: 0.06 };
  // A ball stuck in the return can't be thrown until you throw a different ball.
  GK.isStuck = (run, i) => !!(run.rs && run.rs.stuck && run.rs.stuck.idx === i && run.bag.length > 1);
  GK.firstFreeBall = (run, pref) => {
    if (!GK.isStuck(run, pref) && run.bag[pref]) return pref;
    for (let i = 0; i < run.bag.length; i++) if (!GK.isStuck(run, i)) return i;
    return 0;
  };

  GK.needsCall = run => run.rs.boss === 'secretary' && run.rs.cur && run.rs.cur.rollIdx === 0 && !run.rs.cur.call;

  // prm: { aimX, aim, spin, speed, path }
  GK.launch = function (run, sim, ballIdx, prm) {
    const rs = run.rs, cur = rs.cur, fl = GK.flags(run, rs.stolen), eq = GK.equipMods(run);
    if (rs.smuggled != null && cur.rollIdx === 0 && run.bag[rs.smuggled] && !GK.isStuck(run, rs.smuggled)) ballIdx = rs.smuggled;
    ballIdx = GK.firstFreeBall(run, ballIdx);
    const ball = run.bag[ballIdx] || run.bag[0];
    cur.snap = sim.snapshot();
    cur.ballIdx = ballIdx;
    cur.ball = { type: ball.type, ed: ball.ed };
    // Lucky Coin: the first throw of every round counts as PERFECT.
    if (fl.luckyCoin && !rs.coinUsed) { rs.coinUsed = true; if (prm.perfect === false) cur.coin = true; prm = Object.assign({}, prm, { perfect: true }); }
    cur.perfect = prm.perfect;
    cur.power = prm.power;
    // Lucky Wristband: once per round, a wild hook is pulled back to half.
    if (eq.tame && !rs.tamed && Math.abs(prm.spin) > 0.7) { rs.tamed = true; cur.tamed = true; prm = Object.assign({}, prm, { spin: prm.spin * 0.5 }); }
    cur.maxHook = Math.max(cur.maxHook || 0, Math.abs(prm.spin || 0));
    cur.throws = (cur.throws || 0) + 1;
    let speed = GK.clamp(prm.speed * eq.speed, 120, 560);
    if (rs.boss === 'comet') speed = Math.min(speed, 380 * eq.speed);
    const p = Object.assign({}, prm, { speed });
    const dr = GK.DRILLS[ball.drill || 'stock'] || GK.DRILLS.stock;
    cur.pending = { ballIdx, prm: Object.assign({}, prm, { path: null }) };
    const shadowPrm = fl.shadow && rs.lastPrm ? rs.lastPrm : null;
    sim.launch(ball, p, { wide: fl.wide, hook: eq.hook * (dr.hook || 1), flare: !!dr.flare, wild: fl.wild, bumpers: fl.bumpers || (fl.bumperFirst && rs.frameIdx === 0), rebound: fl.rebound, shadowPrm });
    rs.lastPrm = { aimX: p.aimX, aim: p.aim, spin: p.spin * eq.hook * (dr.hook || 1), speed };
    run.stats.throws++;
  };

  // After the sim settles. Returns { next: 'aim'|'score', kind?, notes: [] }.
  GK.afterRoll = function (run, sim) {
    const rs = run.rs, cur = rs.cur, fl = GK.flags(run, rs.stolen), notes = [];
    if (fl.whisper) {
      const n = sim.whisper();
      if (n) notes.push({ t: 'whisper', text: 'Pin Whisperer tips over pin ' + n, pin: n });
    }
    const rec = sim.summarize();
    cur.pending = null;
    rec.ball = cur.ball.type; rec.edition = cur.ball.ed; rec.perfect = cur.perfect; rec.power = cur.power;
    run.stats.pins += rec.pins;
    // Groove: consecutive PERFECT throws this round.
    if (cur.perfect === true) {
      rs.groove = (rs.groove || 0) + 1; run.stats.perfects++; run.stats.pstreak++;
      run.stats.bestPStreak = Math.max(run.stats.bestPStreak || 0, run.stats.pstreak);
      const pay = GK.rules(run).perfectPay;
      if (pay) { run.money += pay; notes.push({ t: 'pay', text: 'Pro Tour: +$' + pay + ' for a PERFECT throw' }); }
    } else if (cur.perfect === false) {
      rs.groove = GK.equipMods(run).kneePad ? Math.max(0, (rs.groove || 0) - 1) : 0; run.stats.pstreak = 0;
      if (rs.snakeOil) { run.money -= 2; notes.push({ t: 'pay', text: 'Snake Oil: -$2 for missing the PERFECT zone' }); }
    }
    if (rs.bloodMoney && rec.pins) { run.money += rec.pins; notes.push({ t: 'pay', text: 'Blood Money: +$' + rec.pins }); }
    if (rec.painted && rec.painted.length) {
      rs.paint = rs.paint || {};
      const pr = GK.stream(run.seed, 'paint:' + run.stats.throws);
      rec.painted.forEach(n => { rs.paint[n] = pr.pick(GK.PAINT_TYPES); });
      notes.push({ t: 'paint', text: 'Painted ' + rec.painted.length + ' pin' + (rec.painted.length > 1 ? 's' : '') + ' for the rest of the round' });
    }

    if (fl.retake && rec.gutterBall && !cur.retakeUsed) {
      cur.retakeUsed = true;
      sim.restore(cur.snap);
      notes.push({ t: 'retake', text: 'Ref looked away. Retake!' });
      cur.pinState = GK.capturePins(sim);
      return { next: 'aim', notes, rec };
    }
    if (GK.BALLS[cur.ball.type].glass) {
      const rng = GK.stream(run.seed, 'glass:' + run.stats.throws);
      if (rng() < 0.25) {
        const i = cur.ballIdx;
        if (run.bag.length > 1) run.bag.splice(i, 1); else run.bag[0] = { type: 'house', ed: null };
        if (rs.stuck) { if (rs.stuck.idx === i) rs.stuck = null; else if (rs.stuck.idx > i) rs.stuck.idx--; }
        notes.push({ t: 'shatter', text: GK.BALLS[cur.ball.type].full + ' shattered!' });
        cur.shattered = true;
      }
    }
    // Ball return: the stuck ball comes back once another ball has been thrown;
    // otherwise there's a small chance this ball jams.
    if (rs.stuck && rs.stuck.idx !== cur.ballIdx) { notes.push({ t: 'unstuck', text: GK.BALLS[run.bag[rs.stuck.idx] ? run.bag[rs.stuck.idx].type : 'house'].full + ' is back in the ball return' }); rs.stuck = null; }
    if (!rs.stuck && run.bag.length > 1 && !cur.shattered && !fl.noJam) {
      const rr = GK.stream(run.seed, 'stuck:' + run.stats.throws);
      const thrown = run.bag[cur.ballIdx], jamK = thrown && GK.DRILLS[thrown.drill] && GK.DRILLS[thrown.drill].jam || 1;
      if (rr() < GK.MISHAPS.stuck * jamK) {
        cur.jams = (cur.jams || 0) + 1;
        const bi = run.bag.findIndex(b => b.borrowed);
        if (bi >= 0) {
          // Ball Swap: the borrowed rare ball leaves with the first jam.
          const gone = run.bag[bi]; run.bag.splice(bi, 1);
          if (rs.smuggled != null) { if (rs.smuggled === bi) rs.smuggled = null; else if (rs.smuggled > bi) rs.smuggled--; }
          notes.push({ t: 'stuck', text: 'The return jammed and the ' + GK.BALLS[gone.type].full + ' went back to its owner' });
        } else { rs.stuck = { idx: cur.ballIdx }; notes.push({ t: 'stuck', text: GK.BALLS[cur.ball.type].full + ' is stuck in the ball return! Throw a different ball first.', idx: cur.ballIdx }); }
      }
    }
    // Pinsetter fumble: after the first roll it sometimes drops pins it was meant to respot.
    if (cur.rollIdx === 0) {
      const left = sim.standing();
      const rr = GK.stream(run.seed, 'respot:' + run.alley + ':' + run.round + ':' + rs.frameIdx + ':' + run.stats.throws);
      if (left.length && rr() < GK.MISHAPS.respot) {
        const n = Math.min(left.length, 1 + (rr() < 0.4 ? 1 : 0));
        const drop = rr.shuffle(left.slice()).slice(0, n);
        drop.forEach(p => { sim.topple(p, { x: rr() - 0.5, z: 1 }, 'drop'); p.fallT = 0.3; p.counted = true; });
        const downs = drop.map(p => ({ n: p.n, type: p.type, by: 'drop' }));
        cur.fumbles = (cur.fumbles || 0) + 1;
        run.stats.pins += drop.length;
        if (drop.length === left.length) {
          // It dropped everything that was left: no strike, it's a free spare. The dropped pins
          // go on a second "roll" by the pinsetter so the scorecard reads 9 /.
          cur.freeSpare = { ball: 'pinsetter', edition: null, down: downs, pins: drop.length, carry: 0, late: 0, walls: 0, pit: 0, ballBounces: 0, explosions: 0, blasted: 0, swallowed: 0, firstPin: 0, fast: 0, rubber: 0, gutterBall: false, dropped: drop.length, standing: [] };
          notes.push({ t: 'respot', text: 'The pinsetter dropped the last ' + (n > 1 ? n + ' pins' : 'pin') + '. Free spare!', pins: drop.map(p => p.n) });
        } else {
          rec.down.push(...downs);
          rec.pins += drop.length; rec.dropped = drop.length;
          notes.push({ t: 'respot', text: 'The pinsetter fumbled and dropped ' + (n > 1 ? n + ' pins' : 'a pin') + '!', pins: drop.map(p => p.n) });
        }
      }
    }
    cur.rolls.push(rec);
    if (cur.bonusKind) return { next: 'score', kind: cur.bonusKind, notes, rec };
    if (cur.freeSpare) {
      cur.rolls.push(cur.freeSpare); cur.freeSpare = null;
      return GK.bonusBall(run, sim, { next: 'score', kind: 'spare', notes, rec });
    }
    const standing = sim.standing();
    if (standing.length === 0) {
      const kind = GK.classify(cur.rolls, true, cur.splitLeave, rs.streak);
      return GK.bonusBall(run, sim, { next: 'score', kind, notes, rec });
    }
    if (cur.rollIdx === 0) {
      cur.splitLeave = GK.isSplitLeave(standing, sim.lhw);
      const nums = standing.map(p => p.n).sort((a, b) => a - b);
      cur.leave710 = nums.length === 2 && nums[0] === 7 && nums[1] === 10;
      if (cur.splitLeave) notes.push({ t: 'split', text: cur.leave710 ? 'The 7-10! Convert it for ×5' : 'Split leave · convert it for ×5' });
      sim.sweep();
      const heatMech = run.round === 1 && !GK.isChamp(run) && GK.rules(run).heatMech;
      if ((rs.boss === 'mechanic' || heatMech) && rec.down.length) {
        const rng = GK.stream(run.seed, 'mech:' + run.alley + ':' + rs.frameIdx + ':' + run.stats.throws);
        const pick = rng.shuffle(rec.down.map(d => d.n)).slice(0, rs.boss === 'mechanic' ? 2 : 1);
        sim.standUp(pick);
        cur.splitLeave = GK.isSplitLeave(sim.standing(), sim.lhw);
        notes.push({ t: 'mechanic', text: 'The Mechanic resets ' + pick.length + ' pin' + (pick.length > 1 ? 's' : ''), pins: pick });
      }
      if (fl.pinMagnet) {
        const head = sim.pins.find(q => q.n === 1), hx = head ? head.origX : 0, hz = head ? head.origZ : GK.C.ZH;
        sim.standing().forEach(q => { q.x = q.sx = q.x + (hx - q.x) * 0.2; q.z = q.sz = q.z + (hz - q.z) * 0.2; });
        cur.splitLeave = GK.isSplitLeave(sim.standing(), sim.lhw);
      }
      cur.leftOne = sim.standing().length === 1;
      cur.rollIdx = 1;
      cur.pinState = GK.capturePins(sim);
      return { next: 'aim', notes, rec };
    }
    if (cur.rollIdx + 1 < cur.maxRolls) {
      sim.sweep(); cur.rollIdx++;
      notes.push({ t: 'third', text: 'Third Roll!' });
      cur.pinState = GK.capturePins(sim);
      return { next: 'aim', notes, rec };
    }
    const kind = GK.classify(cur.rolls, false, cur.splitLeave, rs.streak);
    return { next: 'score', kind, notes, rec };
  };

  // Fourth Frame Ball: a strike or spare in a round's last frame earns one more ball at a fresh
  // rack. The frame keeps its kind; the bonus pins just add to it.
  GK.bonusBall = function (run, sim, res) {
    const rs = run.rs, cur = rs.cur;
    if (!GK.flags(run, rs.stolen).bonusBall || cur.bonusKind || rs.frameIdx !== rs.framesMax - 1) return res;
    if (!GK.isStrikeKind(res.kind) && !GK.isSpareKind(res.kind)) return res;
    cur.bonusKind = res.kind;
    sim.rack = (cur.rack || run.rack).slice();
    sim.setupPins(rs.boss === 'astronaut' ? 'random' : 'std');
    sim.rememberLayout();
    sim.balls = []; sim.blasts = [];
    cur.rollIdx++; cur.maxRolls = Math.max(cur.maxRolls, cur.rollIdx + 1);
    cur.pinState = GK.capturePins(sim);
    res.notes.push({ t: 'third', text: 'Fourth Frame Ball: a bonus ball at a fresh rack!' });
    return { next: 'aim', notes: res.notes, rec: res.rec };
  };

  GK.canRerack = run => run.rs && run.rs.cur && run.rs.cur.rollIdx > 0 && run.rs.reracks > 0 && !run.rs.cur.bonusKind;
  GK.rerack = function (run, sim) {
    if (!GK.canRerack(run)) return false;
    const rs = run.rs, cur = rs.cur;
    rs.reracks--;
    run.stats.pins -= cur.rolls.reduce((a, r) => a + r.pins, 0);
    cur.rolls = []; cur.rollIdx = 0; cur.splitLeave = false; cur.leave710 = false;
    sim.rack = (cur.rack || run.rack).slice();
    sim.setupPins(rs.boss === 'astronaut' ? 'random' : 'std');
    sim.rememberLayout();
    sim.balls = []; sim.blasts = [];
    return true;
  };

  GK.callResult = function (call, kind) {
    if (!call) return null;
    const ok = call === 'strike' ? GK.isStrikeKind(kind) : call === 'spare' ? GK.isSpareKind(kind) : (kind === 'open' || kind === 'gutter');
    return ok ? 'hit' : 'miss';
  };

  GK.scoreCurrent = function (run, kind) {
    const rs = run.rs, cur = rs.cur;
    const f = {
      rentMiss: !!cur.rentMiss,
      kind, rolls: cur.rolls, frameIdx: rs.frameIdx, lastFrame: rs.frameIdx === rs.framesMax - 1,
      leftSplit: cur.splitLeave, leave710: cur.leave710, loaded: rs.loadedNext,
      call: rs.boss === 'secretary' ? GK.callResult(cur.call, kind) : null,
      party: cur.laneEvent === 'party', blackout: cur.laneEvent === 'blackout', runaway: cur.laneEvent === 'runaway' ? cur.runaway : null,
      groove: rs.groove || 0, grooveX: !!GK.flags(run, rs.stolen).grooveX, weighted: !!rs.weighted,
      framesLeft: rs.framesMax - rs.frameIdx, maxHook: cur.maxHook || 0, throws: cur.throws || cur.rolls.length,
      dark: !!GK.laneFor(run).dark, boss: !!rs.boss, oil: GK.laneFor(run).oil || 'house',
      fumbles: cur.fumbles || 0, jams: cur.jams || 0, leftOne: !!cur.leftOne,
      rackSize: (cur.rack || run.rack).filter(t => t !== 'none').length,
      leagueMult: GK.rules(run).mult, leagueName: GK.LEAGUES[run.league || 'open'].name
    };
    const rng = GK.stream(run.seed, 'score:' + run.alley + ':' + run.round + ':' + rs.frameIdx + ':' + run.stats.throws);
    return GK.scoreFrame(f, run, { rng, stolen: rs.stolen });
  };

  // Apply a scored frame. Returns 'won' | 'lost' | 'next' and any notes.
  GK.commitFrame = function (run, kind, res) {
    const rs = run.rs, cur = rs.cur, notes = [];
    rs.total += res.score;
    run.money += res.money;
    rs.streak = GK.isStrikeKind(kind) ? rs.streak + 1 : 0;
    const st = run.stats;
    st.frames++; st.score += res.score; st.bestFrame = Math.max(st.bestFrame, res.score);
    if (GK.isStrikeKind(kind)) st.strikes++;
    if (kind === 'spare') st.spares++;
    if (kind === 'split') st.splits++;
    if (kind === 'gutter') st.gutters++;
    GK.afterFrame(res.ctx, run, rs.stolen);
    GK.evolveCharms(res.ctx, run, rs.stolen).forEach(e => notes.push({ t: 'evolve', idx: e.idx, text: e.from + ' evolved into ' + e.to + '!' }));
    if (cur.rolls.some(r => r.down.some(d => d.type === 'jackpot'))) { const sp = GK.jackpotSpin(run); notes.push({ t: 'jackpot', reels: sp.reels, text: sp.text }); }
    if (run.dare && rs.frameIdx === 0 && !run.practice) { const d = GK.settleDare(run, kind); if (d) notes.push(d); }
    res.breaks.forEach(n => { if (run.rack[n - 1] === 'glass') { run.rack[n - 1] = 'std'; notes.push({ t: 'break', text: 'Glass pin ' + n + ' broke' }); } });
    if (rs.boss === 'enforcer' && (kind === 'open' || kind === 'gutter')) { const take = Math.min(3, Math.max(0, run.money)); run.money -= take; notes.push({ t: 'bet', text: take ? 'The Enforcer collects $' + take + ' for that open frame' : 'The Enforcer finds your pockets empty' }); }
    if (rs.boss === 'bookie' && cur.bet) {
      if (GK.isStrikeKind(kind) || GK.isSpareKind(kind)) { run.money += cur.bet * 2; notes.push({ t: 'bet', text: 'Bookie pays out ' + GK.money(cur.bet * 2) }); }
      else notes.push({ t: 'bet', text: 'Bookie keeps your ' + GK.money(cur.bet) });
    }
    rs.frames.push({ r: cur.rolls.map(r => r.pins), kind, score: res.score, king: rs.king ? rs.king[rs.frameIdx] || 0 : null });
    rs.frameIdx++;
    rs.loadedNext = false;
    rs.cur = null;
    if (!run.best || res.score > run.best.score) run.best = { score: res.score, kind, alley: run.alley, round: run.round, frame: rs.frameIdx, champ: GK.isChamp(run) };
    const done = rs.total >= rs.target ? 'won' : rs.frameIdx >= rs.framesMax ? 'lost' : null;
    if (done) {
      run.history = run.history || [];
      run.history.push({ alley: run.alley, round: run.round, champ: GK.isChamp(run), target: rs.target, total: rs.total, won: done === 'won', frames: rs.frameIdx });
      return { status: done, notes };
    }
    return { status: 'next', notes };
  };
})();
