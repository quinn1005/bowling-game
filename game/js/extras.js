// Bounties (two optional goals per alley), the Tape Shelf (your best throws, kept as compact
// recordings) and the Regulars' trash talk in Head to Head.
(function () {
  const GK = globalThis.GK;

  // ---------- bounties ----------
  // count(ctx, kind, run) is a frame's progress. round: progress when a round is won instead.
  // alley: judged when the alley's last round is won (fail(ctx) can rule it out before then).
  GK.BOUNTIES = {
    strikes: { n: 4, pay: 5, desc: n => 'Roll ' + n + ' strikes', count: (c, k) => GK.isStrikeKind(k) ? 1 : 0 },
    spares: { n: 4, pay: 5, desc: n => 'Pick up ' + n + ' spares or splits', count: (c, k) => GK.isSpareKind(k) ? 1 : 0 },
    split: { n: 1, pay: 7, desc: () => 'Convert a split', count: (c, k) => k === 'split' ? 1 : 0 },
    double: { n: 1, pay: 5, desc: () => 'Roll a Double or better', count: (c, k) => k === 'double' || k === 'turkey' ? 1 : 0 },
    perfect: { n: 10, pay: 4, desc: n => 'Throw ' + n + ' PERFECT throws', count: c => c.perfects || 0 },
    headpin: { n: 6, pay: 4, desc: n => 'Hit the headpin first ' + n + ' times', count: c => c.firstPin === 1 ? 1 : 0 },
    carry: { n: 20, pay: 4, desc: n => 'Get ' + n + ' pin-on-pin knockdowns', count: c => c.carry || 0 },
    bigframe: { pay: 6, desc: n => 'Score ' + GK.fmt(n) + ' in one frame', count: (c, k, run, res) => res && res.score >= run.bounty.big ? 1 : 0, n: 1 },
    spare_time: { n: 1, pay: 6, desc: () => 'Win a round with 2 or more frames to spare', round: rs => rs.framesMax - rs.frameIdx >= 2 ? 1 : 0 },
    no_rerack: { n: 1, pay: 4, desc: () => 'Win a round without a re-rack', round: rs => (rs.reracksStart || 0) - (rs.reracks || 0) <= 0 ? 1 : 0 },
    clean: { n: 1, pay: 8, desc: () => 'Finish the alley without a single gutter ball', alley: true, fail: c => !!c.gutterBall }
  };
  const bountyText = b => { const B = GK.BOUNTIES[b.id]; return B.desc(b.id === 'bigframe' ? b.big : b.n); };
  GK.bountyText = bountyText;
  // Two bounties for the alley you're in, seeded so a seed always posts the same ones.
  GK.rollBounties = function (run) {
    if (run.practice || run.h2h) return null;
    if (run.bounty && run.bounty.alley === run.alley) return run.bounty;
    const r = GK.stream(run.seed, 'bounty:' + run.alley), ids = r.shuffle(Object.keys(GK.BOUNTIES)).slice(0, 2);
    const target = GK.roundTarget ? GK.roundTarget(Object.assign({}, run, { round: 0 })) : 1000;
    const big = Math.max(300, Math.round(target * 0.45 / 50) * 50);
    run.bounty = {
      alley: run.alley, big,
      list: ids.map(id => ({ id, n: GK.BOUNTIES[id].n, big, have: 0, done: false, failed: false, reward: r() < 0.33 ? 'trick' : 'cash' }))
    };
    return run.bounty;
  };
  const payBounty = (run, b) => {
    const B = GK.BOUNTIES[b.id]; b.done = true;
    if (b.reward === 'trick' && run.cons.length < run.maxCons) {
      const pool = GK.CONS_LIST.filter(c => c.kind === 'trick' && GK.isUnlocked('cons', c.id)), k = GK.stream(run.seed, 'bountyitem:' + run.alley + b.id).pick(pool);
      run.cons.push(k.id); return 'Bounty done: ' + bountyText(b) + '! You get ' + k.name + '.';
    }
    const pay = B.pay + (b.reward === 'trick' ? 2 : 0);
    run.money += pay; return 'Bounty done: ' + bountyText(b) + '! +$' + pay;
  };
  // After a frame. Returns notes for anything completed.
  GK.progressBounties = function (run, ctx, kind, res) {
    const out = []; if (!run.bounty || run.bounty.alley !== run.alley) return out;
    run.bounty.list.forEach(b => {
      const B = GK.BOUNTIES[b.id]; if (b.done || b.failed) return;
      if (B.fail && B.fail(ctx)) { b.failed = true; out.push({ t: 'bountyfail', text: 'Bounty failed: ' + bountyText(b) }); return; }
      if (!B.count) return;
      b.have += B.count(ctx, kind, run, res) || 0;
      if (b.have >= b.n) out.push({ t: 'bounty', text: payBounty(run, b) });
    });
    return out;
  };
  // After a won round (before the alley moves on). Returns texts for anything completed.
  GK.bountyRound = function (run) {
    const out = []; if (!run.bounty || run.bounty.alley !== run.alley || !run.rs) return out;
    const lastRound = run.rush || run.round >= 2 || GK.isChamp(run);
    run.bounty.list.forEach(b => {
      const B = GK.BOUNTIES[b.id]; if (b.done || b.failed) return;
      if (B.round) { b.have += B.round(run.rs) || 0; if (b.have >= b.n) out.push(payBounty(run, b)); }
      if (B.alley && lastRound) { b.have = 1; out.push(payBounty(run, b)); }
    });
    return out;
  };

  // ---------- the Tape Shelf ----------
  // A tape keeps the 3 seconds around impact, sampled at 30 per second with values rounded,
  // then smoothed back out on playback. Your 10 best frames are kept.
  GK.TAPE_MAX = 10;
  const q = v => v == null ? null : typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  const PIN_DYN = ['x', 'z', 'sx', 'sz', 'fallT', 'fd', 'wob', 'wobDir', 'clearT', 'hp'];
  const PIN_FLAGS = ['standing', 'fallen', 'gone', 'cleared', 'swallowed'];
  const BALL_DYN = ['x', 'z', 'r', 'rot', 'delay'];
  const BALL_FLAGS = ['gone', 'shard', 'didSplit', 'exploded'];
  const bits = (o, keys) => keys.reduce((a, k, i) => a | (o[k] ? 1 << i : 0), 0);
  const unbits = (n, keys, o) => { keys.forEach((k, i) => { o[k] = !!(n & (1 << i)); }); return o; };
  GK.encodeTape = function (frames, info) {
    if (!frames || frames.length < 4) return null;
    let start = frames.findIndex(f => f.balls.some(b => !b.gone && b.z > GK.C.ZH - 30));
    if (start < 0) start = 0;
    const t0 = frames[start].time - 0.6;
    let fr = frames.filter(f => f.time >= t0).filter((f, i) => i % 2 === 0).slice(0, 95);
    if (fr.length < 4) fr = frames.slice(-60);
    const pins0 = fr[0].pins, types = [];
    const tIdx = t => { let i = types.indexOf(t); if (i < 0) { types.push(t); i = types.length - 1; } return i; };
    return Object.assign({
      v: 1, types,
      pins: pins0.map(p => [p.n, tIdx(p.type), q(p.origX), q(p.origZ), q(p.r)]),
      f: fr.map(f => [q(f.time),
        f.pins.map(p => PIN_DYN.map(k => q(p[k])).concat(bits(p, PIN_FLAGS))),
        f.balls.map(b => BALL_DYN.map(k => q(b[k])).concat(bits(b, BALL_FLAGS), tIdx(b.type), tIdx(b.kind))),
        f.posts.map(o => [q(o.x), q(o.z), q(o.r)])])
    }, info || {});
  };
  // Back into replay frames, with an in-between frame added for smooth slow motion.
  GK.decodeTape = function (tape) {
    if (!tape || !tape.f) return null;
    const T = tape.types, P = tape.pins;
    const one = row => ({
      time: row[0],
      pins: row[1].map((d, i) => { const o = { n: P[i][0], type: T[P[i][1]], origX: P[i][2], origZ: P[i][3], r: P[i][4], drop: 1 }; PIN_DYN.forEach((k, j) => { if (d[j] != null) o[k] = d[j]; }); return unbits(d[PIN_DYN.length], PIN_FLAGS, o); }),
      balls: row[2].map(d => { const o = { type: T[d[BALL_DYN.length + 1]], kind: T[d[BALL_DYN.length + 2]] }; BALL_DYN.forEach((k, j) => { if (d[j] != null) o[k] = d[j]; }); return unbits(d[BALL_DYN.length], BALL_FLAGS, o); }),
      posts: row[3].map(d => ({ x: d[0], z: d[1], r: d[2] })), fx: []
    });
    const base = tape.f.map(one), out = [];
    const mix = (a, b, k) => (typeof a === 'number' && typeof b === 'number') ? a + (b - a) * k : a;
    base.forEach((a, i) => {
      out.push(a);
      const b = base[i + 1]; if (!b) return;
      out.push({
        time: mix(a.time, b.time, 0.5),
        pins: a.pins.map((p, j) => { const pb = b.pins[j]; if (!pb) return p; const o = Object.assign({}, p); ['x', 'z', 'sx', 'sz', 'fallT', 'wob', 'clearT'].forEach(k => { o[k] = mix(p[k], pb[k], 0.5); }); return o; }),
        balls: a.balls.map((p, j) => { const pb = b.balls[j]; if (!pb) return p; const o = Object.assign({}, p); ['x', 'z', 'r', 'rot'].forEach(k => { o[k] = mix(p[k], pb[k], 0.5); }); return o; }),
        posts: a.posts, fx: []
      });
    });
    return { frames: out, preview: { type: tape.ball || 'house', ed: tape.ed || null } };
  };
  // Keep a tape if it's one of your 10 best. shelf: the stored list. Returns the new list.
  GK.shelveTape = function (shelf, tape) {
    const list = (shelf || []).slice();
    if (!tape) return list;
    if (list.length >= GK.TAPE_MAX && list[list.length - 1].score >= tape.score) return list;
    list.push(tape); list.sort((a, b) => b.score - a.score);
    return list.slice(0, GK.TAPE_MAX);
  };
  GK.tapeWorthy = (shelf, score) => score > 0 && (!shelf || shelf.length < GK.TAPE_MAX || score > shelf[shelf.length - 1].score);

  // ---------- trash talk ----------
  // The Regulars talk during Head to Head. Rage bait included at no extra charge.
  GK.TRASH = {
    quinn: {
      start: ['Two hands, one goal: your humiliation.', 'Take your time. I\'ll be winning either way.', 'I warmed up by watching your last game. Very relaxing.'],
      myStrike: ['Cute. Do it again and I might notice.', 'Even a broken clock hits the pocket twice a day.', 'Wow. Frame that one. You won\'t see another.'],
      mySpare: ['A spare. How responsible of you.', 'Cleaning up your own mess. Character growth.'],
      myOpen: ['That\'s a choice.', 'Bold strategy, leaving pins for later.', 'The pins are fine. They didn\'t feel a thing.'],
      myGutter: ['The gutter is not a lane. I thought you knew.', 'I\'m not laughing. Out loud.', 'Somewhere a bumper is crying.'],
      theirStrike: ['Two hands. Zero effort.', 'That\'s how it\'s supposed to look, by the way.', 'Take notes. I\'ll wait.'],
      theirMiss: ['Lane\'s oily. Clearly.', 'I let that one go. Sportsmanship.', 'Don\'t get excited.'],
      ahead: ['Check the scoreboard. Actually, don\'t. It\'s sad.', 'Is this your first time bowling?'],
      behind: ['Enjoy it. It won\'t last.', 'I\'m just giving you hope. It\'s funnier that way.'],
      draft: ['Oh, you wanted that? Shame.', 'That charm and I go way back.', 'Thanks for leaving that one for me.'],
      win: ['GG. Well, G.', 'Rematch? I could use the practice. Not really.'],
      lose: ['The lane was crooked. Everyone saw it.', 'Fine. Best of 99?']
    },
    kaleb: {
      start: ['LET\'S GOOO. Wait, it\'s you? Let\'s go anyway.', 'I\'m crossing the whole lane and your whole ego.', 'Hope you stretched. I didn\'t need to.'],
      myStrike: ['OK OK OK. Lucky. But OK.', 'Did the ball do that or did you?', 'Sit down, it was one strike.'],
      mySpare: ['A spare? In THIS economy?', 'Cleanup crew has arrived. Slowly.'],
      myOpen: ['HAHAHA. Sorry. HAHAHA.', 'That pin is still standing and so is my respect for it.', 'You left that on purpose? Respect the commitment.'],
      myGutter: ['GUTTER BALL! Someone get this on video.', 'That ball bowled itself into another dimension.', 'The ball wanted to leave. I get it.'],
      theirStrike: ['WHOLE LANE. WHOLE LANE!', 'Did you see the hook on that?? You did. You had to.', 'Boards crossed: all of them.'],
      theirMiss: ['That was a warm-up throw.', 'The lane moved. I swear it moved.', 'Nobody saw that. Right?'],
      ahead: ['Scoreboard looking real lopsided over here.', 'I\'d say good game but I respect honesty.'],
      behind: ['I\'m saving my good throws. Obviously.', 'Momentum is a myth. Comebacks are real.'],
      draft: ['MINE. Sorry. MINE.', 'Rarity is rarity. Can\'t argue with shiny.', 'I didn\'t read it but it looks strong.'],
      win: ['GG GG GG. Run it back. I need more highlights.', 'Put it on the TV. Put ME on the TV.'],
      lose: ['I was lagging. In real life.', 'That\'s fine, I was bowling left-handed. Mentally.']
    },
    levi: {
      start: ['I\'m gonna loft it so high it gets a passport.', 'Prepare for THUD.', 'I had three coffees. This is going to be chaos.'],
      myStrike: ['WOW. Also, I wasn\'t watching. Do it again.', 'Strikes are cool I guess. Have you tried THUD?', 'Teach me. No, don\'t. I like my way.'],
      mySpare: ['You fixed it! Like a little pin janitor.', 'Spare me. Get it? Spare me.'],
      myOpen: ['Pins left behind. Pin orphans.', 'They\'re just resting. Give them a moment.', 'That\'s fine, pins are overrated.'],
      myGutter: ['The gutter waved at you. You waved back.', 'Ball took the scenic route.', 'That\'s my move! Wait, no, mine goes on the lane.'],
      theirStrike: ['THUUUUD. Physics is my friend.', 'Did the whole building shake? It shook.', 'Airborne excellence.'],
      theirMiss: ['I was aiming for the vibe, not the pins.', 'That was performance art.', 'Oops. Anyway.'],
      ahead: ['Am I winning? Nobody tell me, I\'ll get nervous.', 'Look at me go! Please look.'],
      behind: ['Losing is just winning in a different font.', 'I\'m playing the long game. Very long. Like, next week.'],
      draft: ['Ooh, that ball looks bouncy.', 'I picked it because the name is funny.', 'No idea what this does. Exciting!'],
      win: ['I won?? I WON! Nobody was more surprised than me.', 'Victory THUD.'],
      lose: ['Fun though, right? Right?', 'I\'ll get you next time. Or the time after. Eventually.']
    }
  };
  GK.trash = function (opp, cat, rng) {
    const L = GK.TRASH[opp] && GK.TRASH[opp][cat]; if (!L || !L.length) return null;
    return L[Math.floor((rng || Math.random)() * L.length)];
  };
})();
