// Gutter Kings — frame flow (rolls, re-racks, bosses) on top of run state + Sim. No DOM, so a bot
// can play whole runs headless. The UI controller (main.js) calls these and animates the results.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  GK.laneFor = run => Object.assign({}, GK.alleyDef(run).lane || {}, GK.rules(run).dark ? { dark: true } : {});

  GK.beginFrame = function (run) {
    const rs = run.rs, fl = GK.flags(run, rs.stolen);
    const fi = rs.frameIdx;
    const rng = GK.stream(run.seed, 'phys:' + run.alley + ':' + run.round + ':' + fi);
    const sim = new GK.Sim({
      lane: GK.laneFor(run), rng, rack: run.rack, wear: rs.wear || (rs.wear = GK.newWear()),
      layout: rs.boss === 'astronaut' ? 'random' : 'std',
      winter: rs.boss === 'winter',
      tilt: rs.boss === 'ringmaster' ? rs.tilts[fi % rs.tilts.length] : 0
    });
    sim.rememberLayout();
    rs.cur = { rolls: [], rollIdx: 0, splitLeave: false, leave710: false, retakeUsed: false, call: null, bet: 0, maxRolls: fl.third ? 3 : 2, throwN: 0 };
    if (rs.boss === 'bookie') {
      const bet = Math.floor(Math.max(0, run.money) / 2);
      rs.cur.bet = bet; run.money -= bet;
    }
    return sim;
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
    ballIdx = GK.firstFreeBall(run, ballIdx);
    const ball = run.bag[ballIdx] || run.bag[0];
    cur.snap = sim.snapshot();
    cur.ballIdx = ballIdx;
    cur.ball = { type: ball.type, ed: ball.ed };
    cur.perfect = prm.perfect;
    const p = Object.assign({}, prm, { speed: GK.clamp(prm.speed * eq.speed, 120, 560) });
    sim.launch(ball, p, { wide: fl.wide, hook: eq.hook, wild: fl.wild, bumpers: fl.bumpers, rebound: fl.rebound });
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
    rec.ball = cur.ball.type; rec.edition = cur.ball.ed; rec.perfect = cur.perfect;
    run.stats.pins += rec.pins;
    // Groove: consecutive PERFECT throws this round.
    if (cur.perfect === true) {
      rs.groove = (rs.groove || 0) + 1; run.stats.perfects++; run.stats.pstreak++;
      run.stats.bestPStreak = Math.max(run.stats.bestPStreak || 0, run.stats.pstreak);
      const pay = GK.rules(run).perfectPay;
      if (pay) { run.money += pay; notes.push({ t: 'pay', text: 'Pro Tour: +$' + pay + ' for a PERFECT throw' }); }
    } else if (cur.perfect === false) { rs.groove = 0; run.stats.pstreak = 0; }

    if (fl.retake && rec.gutterBall && !cur.retakeUsed) {
      cur.retakeUsed = true;
      sim.restore(cur.snap);
      notes.push({ t: 'retake', text: 'Ref looked away. Retake!' });
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
    if (!rs.stuck && run.bag.length > 1 && !cur.shattered) {
      const rr = GK.stream(run.seed, 'stuck:' + run.stats.throws);
      if (rr() < GK.MISHAPS.stuck) { rs.stuck = { idx: cur.ballIdx }; notes.push({ t: 'stuck', text: GK.BALLS[cur.ball.type].full + ' is stuck in the ball return! Throw a different ball first.', idx: cur.ballIdx }); }
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
    if (cur.freeSpare) {
      cur.rolls.push(cur.freeSpare); cur.freeSpare = null;
      return { next: 'score', kind: 'spare', notes, rec };
    }
    const standing = sim.standing();
    if (standing.length === 0) {
      const kind = GK.classify(cur.rolls, true, cur.splitLeave, rs.streak);
      return { next: 'score', kind, notes, rec };
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
      cur.rollIdx = 1;
      return { next: 'aim', notes, rec };
    }
    if (cur.rollIdx + 1 < cur.maxRolls) {
      sim.sweep(); cur.rollIdx++;
      notes.push({ t: 'third', text: 'Third Roll!' });
      return { next: 'aim', notes, rec };
    }
    const kind = GK.classify(cur.rolls, false, cur.splitLeave, rs.streak);
    return { next: 'score', kind, notes, rec };
  };

  GK.canRerack = run => run.rs && run.rs.cur && run.rs.cur.rollIdx > 0 && run.rs.reracks > 0;
  GK.rerack = function (run, sim) {
    if (!GK.canRerack(run)) return false;
    const rs = run.rs, cur = rs.cur;
    rs.reracks--;
    run.stats.pins -= cur.rolls.reduce((a, r) => a + r.pins, 0);
    cur.rolls = []; cur.rollIdx = 0; cur.splitLeave = false; cur.leave710 = false;
    sim.rack = run.rack.slice();
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
      kind, rolls: cur.rolls, frameIdx: rs.frameIdx, lastFrame: rs.frameIdx === rs.framesMax - 1,
      leftSplit: cur.splitLeave, leave710: cur.leave710, loaded: rs.loadedNext,
      call: rs.boss === 'secretary' ? GK.callResult(cur.call, kind) : null,
      groove: rs.groove || 0, leagueMult: GK.rules(run).mult, leagueName: GK.LEAGUES[run.league || 'open'].name
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
    res.breaks.forEach(n => { if (run.rack[n - 1] === 'glass') { run.rack[n - 1] = 'std'; notes.push({ t: 'break', text: 'Glass pin ' + n + ' broke' }); } });
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
