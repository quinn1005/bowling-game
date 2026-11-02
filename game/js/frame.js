// Gutter Kings — frame flow (rolls, re-racks, bosses) on top of run state + Sim. No DOM, so a bot
// can play whole runs headless. The UI controller (main.js) calls these and animates the results.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  GK.laneFor = run => GK.alleyDef(run).lane || {};

  GK.beginFrame = function (run) {
    const rs = run.rs, fl = GK.flags(run, rs.stolen);
    const fi = rs.frameIdx;
    const rng = GK.stream(run.seed, 'phys:' + run.alley + ':' + run.round + ':' + fi);
    const sim = new GK.Sim({
      lane: GK.laneFor(run), rng, rack: run.rack,
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

  GK.needsCall = run => run.rs.boss === 'secretary' && run.rs.cur && run.rs.cur.rollIdx === 0 && !run.rs.cur.call;

  // prm: { aimX, aim, spin, speed, path }
  GK.launch = function (run, sim, ballIdx, prm) {
    const rs = run.rs, cur = rs.cur, fl = GK.flags(run, rs.stolen), eq = GK.equipMods(run);
    const ball = run.bag[ballIdx] || run.bag[0];
    cur.snap = sim.snapshot();
    cur.ballIdx = ballIdx;
    cur.ball = { type: ball.type, ed: ball.ed };
    const p = Object.assign({}, prm, { speed: GK.clamp(prm.speed * eq.speed, 120, 560) });
    sim.launch(ball, p, { wide: fl.wide, hook: eq.hook, wild: fl.wild, bumpers: fl.bumpers });
    run.stats.throws++;
  };

  // After the sim settles. Returns { next: 'aim'|'score', kind?, notes: [] }.
  GK.afterRoll = function (run, sim) {
    const rs = run.rs, cur = rs.cur, fl = GK.flags(run, rs.stolen), notes = [];
    const rec = sim.summarize();
    rec.ball = cur.ball.type; rec.edition = cur.ball.ed;
    run.stats.pins += rec.pins;

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
        notes.push({ t: 'shatter', text: GK.BALLS[cur.ball.type].full + ' shattered!' });
        cur.shattered = true;
      }
    }
    cur.rolls.push(rec);
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
      if (rs.boss === 'mechanic' && rec.down.length) {
        const rng = GK.stream(run.seed, 'mech:' + run.alley + ':' + rs.frameIdx + ':' + run.stats.throws);
        const pick = rng.shuffle(rec.down.map(d => d.n)).slice(0, 2);
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
      call: rs.boss === 'secretary' ? GK.callResult(cur.call, kind) : null
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
    if (rs.total >= rs.target) return { status: 'won', notes };
    if (rs.frameIdx >= rs.framesMax) return { status: 'lost', notes };
    return { status: 'next', notes };
  };
})();
