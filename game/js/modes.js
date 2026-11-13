// Gutter Kings — v1.2 modes and systems: the Daily Boss Rush, Head to Head against the Regulars,
// cursed charms, the ghost race and per-ball rolling sounds. Pure logic; loaded after content2.js.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- Daily Boss Rush ----------
  // Every boss back to back (one per alley, then the Gutter King), with a shop after each. The
  // day's seed fixes the bosses, the starting build and the shops, and everything is unlocked for
  // the rush, so everyone playing that day gets the same Boss Rush.
  GK.RUSH_TARGET = 0.55; // boss targets without the Qualifier and Heat to build up first
  GK.newRushRun = function (seed) {
    const run = GK.newRun({ seed, bag: 'classic' });
    run.rush = true; run.round = 2; run.money = 12;
    const r = GK.stream(seed, 'rush-build');
    const pick = (list, n) => { const out = []; const pool = list.slice(); while (out.length < n && pool.length) out.push(pool.splice(r.int(pool.length), 1)[0]); return out; };
    const charmPool = rar => GK.CHARM_LIST.filter(c => c.rarity === rar && !c.copy && c.id !== 'regulars');
    run.charms = pick(charmPool('common'), 2).concat(pick(charmPool('uncommon'), 1)).map(c => GK.charmInst(c.id));
    const balls = Object.keys(GK.BALLS).filter(k => k !== 'house' && !GK.BALLS[k].regular && GK.BALLS[k].cost <= 8);
    run.bag = [{ type: 'house', ed: null }].concat(pick(balls, 2).map(type => ({ type, ed: null })));
    run.cons = pick(GK.CONS_LIST.filter(c => c.kind === 'card'), 1).map(c => c.id);
    return run;
  };
  GK.rushBosses = run => GK.ALLEYS.map((a, i) => (run.bosses || GK.pickBosses(run.seed))[i]).concat(['champion']);
  GK.rushDepth = run => run.won ? GK.ALLEY_COUNT + 1 : (run.history || []).filter(h => h.won).length;

  // ---------- Head to Head ----------
  // Three rounds of 5 frames against one of the Regulars. You alternate frames on the same lane.
  // Before each round you both draft from a shared pool of charms, balls and items, taking turns.
  // Difficulty and drafting smarts: Quinn (hardest), then Kaleb, then Levi.
  GK.H2H = {
    quinn: { name: 'Quinn', ball: 'twohander', skill: 0.84, iq: 3, blurb: 'Two-handed up the outside. The best bowler and the sharpest drafter: builds real synergies, takes the picks you want, and saves items for the right moment.' },
    kaleb: { name: 'Kaleb', ball: 'wideswing', skill: 0.82, iq: 2, blurb: 'Plays the whole lane, out wide and back hard. Drafts the strongest-looking picks and keeps his charms in a sensible order.' },
    levi: { name: 'Levi', ball: 'loftduck', skill: 0.5, iq: 1, blurb: 'Lofts it way out with a THUD. Drafts on a hunch (he loves a fun ball) and uses items the moment he gets them.' }
  };
  GK.H2H_FRAMES = 5;
  GK.H2H_ROUNDS = 3;
  GK.newH2HRun = function (opp, seed) {
    const run = GK.newRun({ seed, bag: 'classic' });
    run.h2h = {
      opp, round: 0, total: 0, myTotal: 0, myRounds: [], frames: [], streak: 0,
      ai: { charms: [], levels: {}, bag: [{ type: GK.H2H[opp].ball, ed: null }], cons: [], loadedNext: false, extraNext: 0, frameIdx: 0, framesMax: GK.H2H_FRAMES, kinds: { strike: 0, spare: 0, open: 0 }, spareBall: null }
    };
    return run;
  };
  // The AI's build, in the shape scoring expects.
  GK.aiRun = run => { const A = run.h2h.ai; return { levels: A.levels, charms: A.charms, money: 0, rack: GK.padRack(), bag: A.bag, trophies: [], maxCharms: 5 }; };
  GK.h2hBall = (opp, ri, run) => ri === 0 ? GK.H2H[opp].ball : (run && run.h2h && run.h2h.ai.spareBall) || 'house';
  // The opponent's throw for roll `ri` of their frame.
  GK.h2hThrow = function (opp, sim, rng, ri) {
    const O = GK.H2H[opp], miss = (1 - O.skill) * 3;
    const g = () => { let u = 0; for (let i = 0; i < 6; i++) u += rng(); return (u - 3) / Math.sqrt(0.5); };
    const st = sim.standing();
    if (ri > 0 && st.length) {
      const tx = st.reduce((a, p) => a + p.x, 0) / st.length;
      const aimX = GK.clamp(tx * 0.3, -14, 14);
      return { aimX, aim: GK.clamp((tx - aimX) / 310 + g() * 0.004 * miss, -0.09, 0.09), spin: 0, speed: 390 };
    }
    if (opp === 'quinn') return { aimX: 13 + g() * 0.8 * miss, aim: 0.01 + g() * 0.006 * miss, spin: 0.3 + g() * 0.1 * miss, speed: 400 + g() * 15 };
    if (opp === 'kaleb') return { aimX: -10 + g() * 1.2 * miss, aim: 0.09 + g() * 0.008 * miss, spin: -0.6 + g() * 0.15 * miss, speed: 400 + g() * 20 };
    return { aimX: 2 + g() * 1.2 * miss, aim: g() * 0.006 * miss, spin: 0, speed: 430 + g() * 15 };
  };
  // Score an opponent frame with the opponent's drafted build.
  GK.h2hScore = function (run, rolls, cleared, splitLeave, frameIdx) {
    const A = run.h2h.ai, ar = GK.aiRun(run);
    if (frameIdx == null) frameIdx = A.frameIdx;
    A.frameIdx = frameIdx + 1;
    rolls.forEach((r, i) => { r.ball = i === 0 ? 'house' : (A.spareBall || 'house'); }); // signature balls move their way, without their own bonuses
    const kind = GK.classify(rolls, cleared, splitLeave, run.h2h.streak);
    const f = { kind, rolls, frameIdx, lastFrame: frameIdx === A.framesMax - 1, loaded: A.loadedNext };
    A.loadedNext = false;
    const res = GK.scoreFrame(f, ar, { rng: GK.stream(run.seed, 'aiscore:' + run.h2h.round + ':' + frameIdx) });
    GK.afterFrame(res.ctx, ar);
    run.h2h.streak = GK.isStrikeKind(kind) ? run.h2h.streak + 1 : 0;
    run.h2h.total += res.score; run.h2h.frames.push({ kind, score: res.score, r: rolls.map(r => r.pins), round: run.h2h.round });
    A.kinds[GK.isStrikeKind(kind) ? 'strike' : GK.isSpareKind(kind) ? 'spare' : 'open']++;
    return { kind, score: res.score };
  };

  // ---------- the draft ----------
  // 8 items per draft (4 charms, 2 balls, 2 items); you each take 3, alternating; who picks first alternates.
  GK.DRAFT_ITEMS = ['card_strike', 'card_spare', 'card_double', 'card_turkey', 'card_split', 't_frame', 'm_loaded'];
  GK.draftPool = function (run) {
    const r = GK.stream(run.seed, 'draft:' + run.h2h.round), pool = [];
    const take = (list, n) => { const src = list.slice(); for (let i = 0; i < n && src.length; i++) pool.push(src.splice(r.int(src.length), 1)[0]); };
    const owned = new Set(run.charms.map(c => c.id).concat(run.h2h.ai.charms.map(c => c.id)));
    take(GK.CHARM_LIST.filter(c => !c.copy && c.id !== 'regulars' && !owned.has(c.id) && GK.isUnlocked('charm', c.id)).map(c => ({ kind: 'charm', id: c.id })), 4);
    take(Object.keys(GK.BALLS).filter(k => k !== 'house' && !GK.BALLS[k].regular && GK.isUnlocked('ball', k)).map(k => ({ kind: 'ball', id: k })), 2);
    take(GK.DRAFT_ITEMS.map(k => ({ kind: 'cons', id: k })), 2);
    return { items: pool, turn: run.h2h.round % 2 === 1 ? 'me' : 'ai', picks: { me: 0, ai: 0 }, per: 3, log: [] };
  };
  // Sample frames the AI uses to judge what an item is worth to its build.
  const R = (o) => Object.assign({ ball: 'house', edition: null, down: [], pins: 0, carry: 0, late: 0, walls: 0, pit: 0, ballBounces: 0, explosions: 0, blasted: 0, swallowed: 0, firstPin: 1, fast: 0, rubber: 0, perfect: true }, o);
  const D = n => Array.from({ length: n }, (_, i) => ({ n: i + 1, type: 'std', by: i < 3 ? 'ball' : 'pin' }));
  const SAMPLES = {
    strike: { kind: 'strike', rolls: [R({ down: D(10), pins: 10, carry: 5, late: 1, fast: 7, pocket: true })] },
    double: { kind: 'double', rolls: [R({ down: D(10), pins: 10, carry: 5, fast: 6, pocket: true })] },
    turkey: { kind: 'turkey', rolls: [R({ down: D(10), pins: 10, carry: 6, fast: 7, pocket: true })] },
    spare: { kind: 'spare', rolls: [R({ down: D(7), pins: 7, carry: 3, fast: 4 }), R({ down: D(3).map(d => ({ n: d.n + 7, type: 'std', by: 'ball' })), pins: 3, firstPin: 8 })] },
    open: { kind: 'open', rolls: [R({ down: D(6), pins: 6, carry: 2, fast: 3 }), R({ down: D(2).map(d => ({ n: d.n + 6, type: 'std', by: 'ball' })), pins: 2, firstPin: 7, perfect: false })] }
  };
  const weights = kinds => {
    const t = kinds.strike + kinds.spare + kinds.open, s = (kinds.strike + 2) / (t + 6), sp = (kinds.spare + 2) / (t + 6), o = 1 - s - sp;
    return { strike: s * 0.5, double: s * 0.3, turkey: s * 0.2, spare: sp, open: o };
  };
  // Expected frame score of a build over the sample frames, weighted by how this bowler rolls.
  GK.expectedFrame = function (build, kinds) {
    const w = weights(kinds); let v = 0;
    for (const [k, f] of Object.entries(SAMPLES)) v += w[k] * GK.scoreFrame(Object.assign({ frameIdx: 1, framesLeft: 3 }, f), build, { rng: GK.makeRng(7) }).score;
    return v;
  };
  const withCharm = (build, id) => {
    // try the new charm in every slot and keep the best order (Quinn's trick)
    let best = null;
    for (let i = 0; i <= build.charms.length; i++) {
      const charms = build.charms.slice(); charms.splice(i, 0, GK.charmInst(id));
      const b = Object.assign({}, build, { charms: charms.slice(0, 5) });
      const v = GK.expectedFrame(b, build._kinds);
      if (!best || v > best.v) best = { v, charms: b.charms };
    }
    return best;
  };
  // With a full row, the charm whose loss hurts the build least goes.
  GK.dropWeakest = function (build, kinds) {
    let best = null;
    build.charms.forEach((c, i) => { const rest = build.charms.filter((x, j) => j !== i), v = GK.expectedFrame(Object.assign({}, build, { charms: rest }), kinds); if (!best || v > best.v) best = { v, rest }; });
    return best ? best.rest : build.charms;
  };
  // What an item is worth to a build (in expected Points per frame), for the smart drafter.
  GK.itemValue = function (build, item, kinds) {
    const b = Object.assign({}, build, { _kinds: kinds }), base = GK.expectedFrame(b, kinds), framesLeft = build._left || 5;
    if (item.kind === 'charm') {
      let from = b;
      if (build.charms.length >= 5) from = Object.assign({}, b, { charms: GK.dropWeakest(b, kinds) });
      return (withCharm(from, item.id).v - base) * framesLeft * 1.4; // charms compound with later picks
    }
    if (item.kind === 'cons') {
      const C = GK.CONS[item.id];
      if (C.kind === 'card') { const lv = Object.assign({}, build.levels); lv[C.shot] = (lv[C.shot] || 0) + 1; return (GK.expectedFrame(Object.assign({}, b, { levels: lv }), kinds) - base) * framesLeft; }
      if (item.id === 't_frame') return base * 1.2;
      if (item.id === 'm_loaded') return base * 2 - GK.loadedLoss(b, kinds) * framesLeft;
    }
    if (item.kind === 'ball') { const sp = SAMPLES.spare, f = { kind: 'spare', rolls: [sp.rolls[0], Object.assign({}, sp.rolls[1], { ball: item.id })], frameIdx: 1 }; return Math.max(0, GK.scoreFrame(f, b, { rng: GK.makeRng(7) }).score - GK.scoreFrame(Object.assign({}, sp, { frameIdx: 1 }), b, { rng: GK.makeRng(7) }).score) * 2; }
    return 0;
  };
  // Loaded Ball destroys a random charm: the average Points per frame that costs the build.
  GK.loadedLoss = function (build, kinds) {
    if (!build.charms.length) return 0;
    const base = GK.expectedFrame(build, kinds);
    return build.charms.reduce((a, c, i) => a + base - GK.expectedFrame(Object.assign({}, build, { charms: build.charms.filter((x, j) => j !== i) }), kinds), 0) / build.charms.length;
  };
  // Frames left in the match from the start of this round (charms and cards last the whole match).
  GK.h2hLeft = run => GK.H2H_FRAMES * (GK.H2H_ROUNDS - run.h2h.round + 1);
  // A quick, synergy-blind value: rarity and tag (Kaleb).
  const roughValue = item => {
    if (item.kind === 'charm') { const c = GK.CHARMS[item.id]; return ({ rare: 3, uncommon: 2, common: 1 }[c.rarity]) * ({ xmult: 1.5, scaling: 1.3, mult: 1.2, chips: 1, rule: 0.7, economy: 0.3 }[c.tag] || 1); }
    if (item.kind === 'cons') return item.id === 't_frame' ? 2.6 : item.id === 'm_loaded' ? 1.6 : 1.8;
    return 1.1;
  };
  // The AI picks from the pool. Returns the index it takes.
  GK.aiPick = function (run, draft) {
    const A = run.h2h.ai, iq = GK.H2H[run.h2h.opp].iq, items = draft.items;
    const r = GK.stream(run.seed, 'aipick:' + run.h2h.round + ':' + draft.picks.ai);
    if (iq === 1) { // Levi: on a hunch, and he loves a fun ball
      const w = items.map(it => it.kind === 'ball' ? 3 : 1), tot = w.reduce((a, b) => a + b, 0);
      let x = r() * tot; for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return i; } return 0;
    }
    if (iq === 2) { let bi = 0, bv = -1; items.forEach((it, i) => { const v = roughValue(it) * (0.9 + r() * 0.2); if (v > bv) { bv = v; bi = i; } }); return bi; }
    // Quinn: real synergy with his build, and denies you a pick that's much better for you
    const left = GK.h2hLeft(run), mine = Object.assign(GK.aiRun(run), { _left: left }), yours = { levels: run.levels, charms: run.charms, money: run.money, rack: run.rack, bag: run.bag, trophies: [], _left: left };
    const youKinds = { strike: run.stats.strikes, spare: run.stats.spares, open: Math.max(0, run.stats.frames - run.stats.strikes - run.stats.spares) };
    let bi = 0, bv = -Infinity;
    items.forEach((it, i) => {
      const forMe = GK.itemValue(mine, it, A.kinds), forYou = GK.itemValue(yours, it, youKinds);
      const v = Math.max(forMe, forYou * 0.55) + roughValue(it) * 25; // the rough value breaks ties for charms the samples can't see
      if (v > bv) { bv = v; bi = i; }
    });
    return bi;
  };
  // Put a drafted item into a build. who: 'me' | 'ai'. arg: slot to replace when full (player).
  GK.takeDraft = function (run, draft, idx, who, arg) {
    const it = draft.items[idx]; if (!it) return { ok: false };
    if (who === 'me') {
      if (it.kind === 'charm') {
        if (run.charms.length >= run.maxCharms) { if (arg == null) return { ok: false, need: 'charm', msg: 'Charm slots full: pick one to swap out.' }; run.charms.splice(arg, 1, GK.charmInst(it.id)); }
        else run.charms.push(GK.charmInst(it.id));
      } else if (it.kind === 'ball') {
        if (run.bag.length >= GK.maxBag(run)) { if (arg == null) return { ok: false, need: 'ball', msg: 'Bag full: pick a ball to swap out.' }; run.bag.splice(arg, 1, { type: it.id, ed: null }); }
        else run.bag.push({ type: it.id, ed: null });
      } else {
        if (run.cons.length >= run.maxCons) { if (arg == null) return { ok: false, need: 'cons', msg: 'Item slots full: pick one to swap out.' }; run.cons.splice(arg, 1, it.id); }
        else run.cons.push(it.id);
      }
    } else GK.aiTake(run, it);
    draft.items.splice(idx, 1); draft.picks[who]++;
    draft.log.push({ who, item: it });
    draft.turn = who === 'me' ? 'ai' : 'me';
    if (draft.picks[draft.turn] >= draft.per) draft.turn = draft.picks.me >= draft.per && draft.picks.ai >= draft.per ? 'done' : (draft.turn === 'me' ? 'ai' : 'me');
    return { ok: true };
  };
  GK.aiTake = function (run, it) {
    const A = run.h2h.ai, iq = GK.H2H[run.h2h.opp].iq;
    if (it.kind === 'charm') {
      if (iq === 3) { const b = Object.assign(GK.aiRun(run), { _kinds: A.kinds }); if (A.charms.length >= 5) b.charms = GK.dropWeakest(b, A.kinds); A.charms = withCharm(b, it.id).charms; }
      else { if (A.charms.length >= 5) A.charms.shift(); A.charms.push(GK.charmInst(it.id)); if (iq === 2) A.charms.sort((a, b) => (GK.CHARMS[a.id].tag === 'xmult') - (GK.CHARMS[b.id].tag === 'xmult')); }
    } else if (it.kind === 'ball') { A.bag.push({ type: it.id, ed: null }); if (iq >= 2 && GK.itemValue(GK.aiRun(run), it, A.kinds) > 0) A.spareBall = it.id; else if (iq === 1) A.spareBall = it.id; }
    else A.cons.push(it.id);
  };
  // The AI uses its items: Levi right away, Kaleb on the last round, Quinn when it matters.
  GK.aiUseItems = function (run) {
    const H = run.h2h, A = H.ai, iq = GK.H2H[H.opp].iq, used = [];
    const last = H.round >= GK.H2H_ROUNDS, behind = H.total < H.myTotal;
    A.cons = A.cons.filter(id => {
      const C = GK.CONS[id];
      let use = false;
      if (C.kind === 'card') use = true;
      else if (iq === 1) use = true;
      else if (iq === 2) use = last;
      else if (id === 't_frame') use = behind || last;
      else if (id === 'm_loaded') { const b = GK.aiRun(run); use = GK.expectedFrame(b, A.kinds) * 2 > GK.loadedLoss(b, A.kinds) * GK.h2hLeft(run) && (behind || last); }
      if (!use) return true;
      if (C.kind === 'card') A.levels[C.shot] = (A.levels[C.shot] || 0) + 1;
      if (id === 't_frame') A.extraNext++;
      if (id === 'm_loaded') { A.loadedNext = true; if (A.charms.length) A.charms.splice(GK.stream(run.seed, 'aiload:' + H.round).int(A.charms.length), 1); }
      used.push(C.name);
      return false;
    });
    return used;
  };
  // Start a Head to Head round: the AI's frame count for it (5, plus any Extra Frame it used).
  GK.h2hRoundStart = function (run) {
    const A = run.h2h.ai;
    A.frameIdx = 0; A.framesMax = GK.H2H_FRAMES + A.extraNext; A.extraNext = 0;
  };

  // ---------- curses ----------
  // Shops sometimes sell a cursed charm. It triggers twice every frame, but carries a curse
  // until you meet its condition, and you can't sell it while it's cursed. Lift the curse and
  // you keep the double trigger.
  GK.CURSE_CHANCE = 0.12;
  GK.CURSES = {
    heavy: { name: 'Heavy Hands', desc: 'The PERFECT zone is 25% smaller.', lift: 'Throw 6 PERFECT throws', n: 6, count: c => c.perfects },
    leaky: { name: 'Leaky Pockets', desc: 'Lose $1 every frame.', lift: 'Roll 3 Strikes', n: 3, count: c => GK.isStrikeKind(c.kind) ? 1 : 0 },
    dark: { name: 'Darkness', desc: 'Your lane is dark.', lift: 'Pick up 4 Spares', n: 4, count: c => GK.isSpareKind(c.kind) ? 1 : 0 },
    jinx: { name: 'Jinx', desc: '-3 Mult every frame.', lift: 'Roll a Turkey', n: 1, count: c => c.kind === 'turkey' ? 1 : 0 },
    chains: { name: 'Chains', desc: 'No re-racks.', lift: 'Clear 2 rounds', n: 2, count: () => 0 }
  };
  GK.activeCurses = run => (run.charms || []).filter(c => c.curse).map(c => c.curse.id);
  GK.curseDesc = c => { const C = GK.CURSES[c.curse.id]; return 'CURSED with ' + C.name + ' (' + C.desc + ') until you ' + C.lift.charAt(0).toLowerCase() + C.lift.slice(1) + ' (' + Math.min(C.n, c.curse.have) + '/' + C.n + '). Triggers twice every frame, even after the curse lifts. Can\'t be sold while cursed. '; };
  // Progress the curses after a frame (or a round, for Chains). Returns the curses just lifted.
  GK.progressCurses = function (run, ctx, roundWon) {
    const out = [];
    (run.charms || []).forEach(c => {
      if (!c.curse) return;
      const C = GK.CURSES[c.curse.id];
      c.curse.have += roundWon ? (c.curse.id === 'chains' ? 1 : 0) : (C.count(ctx) || 0);
      if (c.curse.have >= C.n) { out.push(GK.charmName(c) + ': ' + C.name + ' lifted!'); c.curse = null; c.blessed = true; }
    });
    return out;
  };

  // ---------- ghost race ----------
  // Every frame score of the run, round by round, so a friend can race your ghost on the same seed.
  GK.logFrame = function (run, score) {
    run.flog = run.flog || [];
    const i = (run.roundNo || 1) - 1;
    (run.flog[i] = run.flog[i] || []).push(score);
  };
  GK.encodeGhost = flog => (flog || []).map(r => r.map(v => Math.max(0, Math.round(v)).toString(36)).join('-')).join('.');
  GK.decodeGhost = s => { try { return String(s).split('.').filter(Boolean).map(r => r.split('-').map(v => parseInt(v, 36) || 0)); } catch (e) { return null; } };
  // The ghost's round total after `frames` frames of round `roundNo` (1-based).
  GK.ghostAt = (ghost, roundNo, frames) => { const r = ghost && ghost[roundNo - 1]; return r ? r.slice(0, frames).reduce((a, v) => a + v, 0) : null; };

  // ---------- rolling sounds ----------
  // Which rolling sound a ball makes: heavy rumble, light hiss, glassy ring, squeaky duck...
  GK.ROLL_SOUND = {
    heavy: ['lead', 'wrecking', 'giant', 'anchor', 'spiked', 'snowball', 'moon'],
    light: ['feather', 'tiny', 'duster', 'bubble', 'pinball', 'cluster'],
    glass: ['glass', 'ice', 'black_pearl', 'disco', 'mirror'],
    squeak: ['loftduck', 'rubber', 'jelly'],
    clank: ['chain', 'grenade', 'bomb', 'magnet']
  };
  GK.rollSound = type => { for (const [k, list] of Object.entries(GK.ROLL_SOUND)) if (list.includes(type)) return k; return 'normal'; };
})();
