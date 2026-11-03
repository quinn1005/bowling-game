// Gutter Kings — game controller: input, the frame loop, scoring animation, screens flow.
'use strict';
(function () {
  const GK = window.GK, UI = GK.UI, $ = UI.$, C = GK.C, fmt = GK.fmt, sfx = GK.sfx;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let run = null, sim = null, phase = 'menu', sel = 0, aimX = 0;
  let glow = null, fast = false, hitStop = 0, busyToken = 0, skipScore = false;
  let tension = null; // the 'will it fall?' moment
  let bonus = null; // bonus balls after a round won with frames to spare
  let highlights = [], lastXP = null; // the run's 3 best frames for the highlight reel; XP from the last run
  let meta = GK.meta();
  GK._meta = meta;
  sfx.setMuted(!!meta.muted);
  GK.music.setOn(meta.music !== false);
  GK.haptic.setOn(meta.haptics !== false);
  // Replays: frames recorded while a roll plays, so strikes and the best frame can be shown again.
  let curPath = [], lastPath = null, themedRs = null; // the lane map's live ball trail and your last shot's line
  let recFrames = [], lastRec = null, bestReplay = null, replay = null, crowd = { mood: 'idle', t: 0 }, tv = null;
  try { fast = localStorage.getItem('gk-fast') === '1'; } catch (e) {}

  const cv = $('lane');
  const R = new GK.Renderer(cv);
  GK.debug = { get run() { return run; }, get sim() { return sim; }, get phase() { return phase; }, get aimX() { return aimX; } };

  // ---------- sizing ----------
  const MINI_W = 34, MINI_GAP = 6;
  function fit() {
    const r = $('stage').getBoundingClientRect();
    // The lane renders at high resolution, so it can scale to fill the space exactly.
    // The lane map sits beside it in the spare width.
    const s = Math.min((r.width - MINI_W - MINI_GAP) / C.W, r.height / C.H);
    const h = Math.floor(C.H * s), dpr = Math.min(3, window.devicePixelRatio || 1);
    $('lanebox').style.width = Math.floor(C.W * s) + 'px';
    $('lanebox').style.height = h + 'px';
    const m = $('mini'); m.style.height = h + 'px'; m.width = MINI_W * dpr; m.height = h * dpr;
  }
  new ResizeObserver(fit).observe($('stage'));
  window.addEventListener('resize', fit);

  // ---------- view helpers ----------
  const laneOf = () => GK.laneFor(run);
  function themeRound() {
    const def = GK.alleyDef(run), L = laneOf();
    if (!run.rs || run.rs !== themedRs) { lastPath = null; curPath = []; themedRs = run.rs; }
    R.setTheme(def, L.lhw || C.LHW, L.magnet ? 12 : C.GUT, L.oil);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (run) R.buildStatic(); });
  }
  function refresh() {
    if (!run) return;
    if (GK.markSeen(meta, run)) GK.saveMeta(meta);
    UI.hud(run); UI.charms(run, tapCharm); UI.card(run);
    sel = Math.min(sel, run.bag.length - 1);
    if (run.rs && GK.isStuck(run, sel)) sel = GK.firstFreeBall(run, sel);
    const canAct = phase === 'aim';
    UI.cons(run, canAct, tapCons);
    UI.rule(run, sel);
    $('rerackBtn').disabled = !(canAct && GK.canRerack(run));
    $('callbar').hidden = phase !== 'call';
    syncCtrl();
  }
  function setPhase(p) { phase = p; refresh(); }
  function resetTally() { UI.tally(null, null, null); }

  // ---------- title / run start ----------
  function saveDesc(s) {
    if (!s) return null;
    const where = s.alley >= GK.ALLEY_COUNT ? 'Championship' : 'Alley ' + (s.alley + 1) + ' · ' + GK.ROUND_NAMES[s.round];
    return where + ' · ' + GK.money(s.money) + (s.daily ? ' · daily' : '');
  }
  const urlSeed = (() => { try { return new URLSearchParams(location.search).get('seed'); } catch (e) { return null; } })();
  const newRunScreen = () => { UI.bagSelect(meta, o => startRun(o), title); if (urlSeed && $('seedIn')) $('seedIn').value = urlSeed; };
  GK.challengeText = function (run, won) {
    const code = GK.seedCode(run.seed), url = location.origin + location.pathname + '?seed=' + code;
    const reached = won ? 'beat the Gutter King' : 'reached ' + (GK.isChamp(run) ? 'the Championship' : 'Alley ' + (run.alley + 1) + ', ' + GK.roundName(run));
    return 'I ' + reached + ' in Gutter Kings with a best frame of ' + fmt(run.stats.bestFrame) + '. Same lanes, same shops: seed ' + code + '. Beat me: ' + url;
  };
  function title() {
    phase = 'menu'; run = null; sim = null; replay = null; bonus = null; coach(null);
    GK.music.stop();
    UI.hideModal();
    UI.title(meta, saveDesc(GK.load()), {
      continue: () => { const s = GK.load(); if (s) resume(s); },
      new: newRunScreen,
      daily: () => startRun({ bag: 'classic', seed: GK.dailySeed(), daily: true }),
      how: () => UI.how(),
      collection: () => UI.collection(meta),
      locker: () => UI.locker(meta, () => { GK.saveMeta(meta); R.setCosmetics(GK.cosmeticsOn(meta)); }),
      book: () => UI.book(meta),
      practice: () => UI.practiceSetup(startPractice, title),
      sound: el => { sfx.init(); sfx.setMuted(!sfx.muted); meta.muted = sfx.muted; GK.saveMeta(meta); el.textContent = sfx.muted ? 'Sound off' : 'Sound on'; }
    });
  }
  function startRun(o) {
    sfx.init();
    run = GK.newRun(o);
    meta.runs++; GK.saveMeta(meta);
    sel = 0; bestReplay = null; highlights = []; lastXP = null;
    toIntro();
  }
  function resume(s) {
    sfx.init();
    run = s; sel = 0; bestReplay = null; highlights = []; lastXP = null;
    if (run.phase === 'shop' && run.shop) { themeRound(); showShop(); return; }
    if (run.phase === 'shop' && run.event) { themeRound(); showEvent(run.event); return; }
    if (run.phase === 'round' && run.rs && run.rs.cur) { themeRound(); UI.hideLayer(); resumeFrame(); return; }
    if (run.phase === 'round' && run.rs && (run.rs.frameIdx > 0 || run.rs.total > 0)) {
      themeRound(); UI.hideLayer(); beginFrame(); return;
    }
    toIntro();
  }

  function toIntro() {
    bonus = null;
    GK.startRound(run);
    GK.save(run);
    themeRound();
    sim = null; resetTally(); setPhase('intro');
    UI.shot(GK.roundName(run) + ' · target ' + fmt(run.rs.target));
    if (GK.isBoss(run)) sfx.boss();
    UI.intro(run, () => { UI.hideLayer(); beginFrame(); UI.banner(GK.roundName(run).toUpperCase(), 'Target ' + fmt(run.rs.target), 1800); },
      GK.canSkip(run) ? () => { const r = GK.skipRound(run); sfx.coin(); UI.toast(r.msg, 3200); GK.save(run); feats({ t: 'shop', run }); toIntro(); } : null);
  }

  // ---------- frames ----------
  // Rebuild a frame that was saved mid-way. A throw that was already in the air is replayed.
  function resumeFrame() {
    playMusic();
    sim = GK.beginFrame(run, true);
    sim.onEvent = onSimEvent;
    R.setWear(run.rs.wear); pickGlow(); resetTally();
    const cur = run.rs.cur;
    step = 'pos'; posT0 = performance.now();
    if (cur.pending) {
      const pd = cur.pending; sel = GK.firstFreeBall(run, pd.ballIdx);
      setPhase('aim'); throwBall(Object.assign({}, pd.prm));
      UI.toast('Picking up where you left off: your last throw is still rolling', 2600);
      return;
    }
    UI.shot('Frame ' + (run.rs.frameIdx + 1) + ' · roll ' + (cur.rollIdx + 1));
    setPhase(GK.needsCall(run) ? 'call' : 'aim');
  }
  const playMusic = () => { if (run) GK.music.play(GK.isChamp(run) ? 7 : GK.baseAlley(run), GK.isBoss(run)); };
  function beginFrame() {
    playMusic();
    sim = GK.beginFrame(run);
    GK.save(run);
    sim.onEvent = onSimEvent;
    R.setWear(run.rs.wear);
    pickGlow();
    step = 'pos'; posT0 = performance.now();
    resetTally();
    const rs = run.rs;
    hint('step_pos');
    if (GK.isBoss(run) && rs.frameIdx === 0) hint('boss');
    UI.shot('Frame ' + (rs.frameIdx + 1) + ' · line up your shot');
    if (rs.loadedNext) UI.toast('Loaded Ball: this frame gets ×3 Mult');
    if (rs.boss === 'bookie' && rs.cur.bet) UI.toast('The Bookie takes ' + GK.money(rs.cur.bet) + ' as a bet');
    if (rs.boss === 'ringmaster') UI.toast('The lane tilts ' + (rs.tilts[rs.frameIdx % rs.tilts.length] > 0 ? 'right' : 'left'));
    if (rs.boss === 'astronaut') UI.toast('The rack respawned somewhere new');
    if (rs.cur.rent) UI.toast('The Landlord collects $2 rent');
    if (rs.cur.rentMiss) UI.toast('You can\'t pay the rent: this frame gets -2 Mult');
    if (rs.boss === 'janitor' && rs.frameIdx > 0) UI.toast('The Janitor mopped fresh oil over your line');
    if (rs.cur.laneEvent) { const ev = GK.LANE_EVENTS[rs.cur.laneEvent]; UI.toast(ev.name + ': ' + ev.desc, 3200); hint('laneEvent'); }
    setPhase(GK.needsCall(run) ? 'call' : 'aim');
  }
  function pickGlow() {
    glow = null;
    if (!laneOf().dark || !sim) return;
    if (laneOf().fog) { glow = new Set(); return; }
    if (run.rs && run.rs.cur && run.rs.cur.laneEvent === 'blackout') { glow = new Set(sim.pins.map(p => p.n)); return; }
    const rng = GK.stream(run.seed, 'glow:' + run.alley + ':' + run.round + ':' + run.rs.frameIdx + ':' + run.stats.throws);
    glow = new Set(rng.shuffle(sim.pins.map(p => p.n)).slice(0, 4));
  }

  document.querySelectorAll('#callbar [data-call]').forEach(b => b.addEventListener('click', () => {
    if (phase !== 'call') return;
    run.rs.cur.call = b.dataset.call;
    UI.toast('Called: ' + b.textContent);
    setPhase('aim');
  }));

  $('trophyBtn').addEventListener('click', () => { if (run) UI.trophyShelf(run); });
  $('rerackBtn').addEventListener('click', () => {
    if (phase !== 'aim' || !GK.rerack(run, sim)) return;
    pickGlow(); sfx.spare();
    UI.toast('Re-rack! Roll one again'); resetTally();
    UI.shot('Frame ' + (run.rs.frameIdx + 1) + ' · re-racked');
    refresh();
  });

  function throwBall(prm) {
    if (phase !== 'aim') return;
    sfx.init();
    const b = run.bag[sel];
    if (b.type === 'snake' && !prm.path) prm.path = GK.snakePath(prm.aimX, prm.aim, laneOf().lhw || C.LHW);
    if (bonus) GK.bonusLaunch(run, sim, sel, prm);
    else { GK.launch(run, sim, sel, prm); GK.save(run); }
    curPath = [];
    hitStop = 0; step = 'pos'; posT0 = performance.now(); recFrames = [];
    UI.shot(GK.BALLS[b.type].full + ' away');
    setPhase('rolling');
  }

  function onSimEvent(e) {
    switch (e.t) {
      case 'clack': sfx.clack(e.v); break;
      case 'first': {
        const pocket = e.n === 1 && Math.abs(e.off || 0) > 1.5 && Math.abs(e.off || 0) < 5.5 && (e.v || 0) > 250;
        if (pocket) { hitStop = 0.16; R.shake = Math.min(7, R.shake + 5); R.flash = Math.max(R.flash, 0.18); sfx.thump(); GK.haptic('heavy'); }
        else { hitStop = 0.07; R.shake = Math.min(4, R.shake + 2); GK.haptic('light'); }
        break;
      }
      case 'down':
        if (e.by === 'pin') R.pop(e.x, e.z, 18, '+3', '#39c6d6');
        else if (e.by === 'late') R.pop(e.x, e.z, 18, '+4 late', '#39c6d6');
        if (e.type === 'gold') { R.pop(e.x + 3, e.z, 26, '+$1', '#f2c94c'); sfx.coin(); }
        if (e.type === 'glass') sfx.shatter();
        if (run && sim.roll && sim.roll.ball === 'feather' && e.by === 'pin') R.pop(e.x + 3, e.z, 26, '+2 mult', '#ff5a6e');
        break;
      case 'gutter': if (e.main) { sfx.gutter(); GK.haptic('medium'); if (e.early) R.pop(e.x, e.z, 10, 'GUTTER', '#ff5a6e'); } break;
      case 'explode': sfx.boom(); GK.haptic('heavy'); R.shake = 7; R.flash = 0.6; R.burst(e.x, e.z, '#ffd447', 14, 70); break;
      case 'ghost': sfx.ghost(); R.pop(e.x, e.z, 22, 'boo', '#e8f0ff'); break;
      case 'swallow': sfx.swallow(); R.burst(e.x, e.z, '#b06bff', 6, 30); break;
      case 'ballBounce': sfx.bounce(); R.pop(e.x, e.z, 10, e.post ? 'BONK' : 'BOUNCE', '#7be38a'); break;
      case 'wall': R.pop(e.x, e.z, 16, '+2', '#39c6d6'); break;
      case 'crack': sfx.crack(); R.pop(e.x, e.z, 22, 'CRACK', '#bff4ff'); R.burst(e.x, e.z, '#e8fbff', 5, 20); break;
      case 'rubber': sfx.bounce(); R.pop(e.x, e.z, 22, '+5', '#ff7a59'); break;
      case 'split': R.pop(e.x, e.z, 16, 'SPLIT!', '#ffb547'); break;
      case 'shards': sfx.shatter(); R.burst(e.x, e.z, '#bff4ff', 8, 50); break;
      case 'pit': break;
      case 'rebound': sfx.bounce(); R.pop(e.x, e.z, 10, 'REBOUND', '#7be38a'); break;
      case 'squeak': sfx.squeak(); R.pop(e.x, e.z, 24, 'SQUEAK', '#ffd23a'); break;
      case 'thud': sfx.thud(); GK.haptic('heavy'); R.shake = 6; R.burst(e.x, e.z, '#e8c890', 8, 25); R.pop(e.x, e.z, 8, 'THUD!', '#ffd23a'); break;
    }
  }

  async function onRollEnd() {
    setPhase('busy');
    sfx.roll(0);
    const token = ++busyToken;
    if (bonus) return bonusRollEnd(token);
    const out = GK.afterRoll(run, sim);
    if (out.next === 'aim') GK.save(run);
    lastRec = { frames: recFrames, alley: run.alley, champ: GK.isChamp(run), lane: laneOf(), def: GK.alleyDef(run), preview: run.rs.cur && run.rs.cur.ball, glow, dark: laneOf().dark };
    recFrames = [];
    UI.card(run); refresh();
    R.setWear(run.rs.wear);
    if (run.rs.wear.some(w => w > 0.3)) hint('oil');
    if (out.rec.perfect === true) { R.pop(aimX, 20, 18, 'GROOVE ×' + run.rs.groove, '#7be38a'); feats({ t: 'throw', streak: run.stats.pstreak, run }); }
    for (const n of out.notes) {
      UI.toast(n.text, 1800);
      if (n.t === 'shatter') { sfx.shatter(); sel = Math.min(sel, run.bag.length - 1); }
      if (n.t === 'mechanic') { R.pop(0, C.ZH + 12, 30, 'THE MECHANIC RESETS ' + n.pins.length, '#ff5a6e'); sfx.crack(); }
      if (n.t === 'split') UI.shot(n.text);
      if (n.t === 'pay') sfx.coin();
      if (n.t === 'stuck') { sfx.nope(); GK.haptic('medium'); hint('stuck'); R.pop(12, -20, 20, 'JAMMED!', '#ff5a6e'); }
      if (n.t === 'unstuck') sfx.tick(660);
      if (n.t === 'respot') { sfx.crack(); hint('respot'); R.pop(0, C.ZH + 10, 34, 'PINSETTER FUMBLE!', '#ffd447'); R.shake = 3; }
    }
    if (out.rec.gutterBall) cheer('groan');
    feats({ t: 'roll', notes: out.notes, rec: out.rec, run });
    if (out.next === 'aim') {
      await sleep(650);
      if (token !== busyToken || !run) return;
      UI.shot(out.notes.some(n => n.t === 'retake') ? 'Retake your shot' : 'Roll ' + (run.rs.cur.rollIdx + 1) + ' · pick up the spare');
      setPhase('aim');
      return;
    }
    if (meta.replays !== false && (GK.isStrikeKind(out.kind) || (out.kind === 'split' && run.rs.cur.leave710))) {
      cheer('cheer');
      await playReplay(lastRec, out.kind === 'split' ? '7-10 REPLAY' : 'REPLAY');
      if (token !== busyToken || !run) return;
    }
    await scoreFrame(out.kind, token);
  }

  // ---------- replays ----------
  function snapSim(sm) {
    return {
      time: sm.time,
      pins: sm.pins.map(p => ({ n: p.n, type: p.type, x: p.x, z: p.z, sx: p.sx, sz: p.sz, origX: p.origX, origZ: p.origZ, standing: p.standing, fallen: p.fallen, fallT: p.fallT, fd: p.fd, wob: p.wob, wobDir: p.wobDir, gone: p.gone, cleared: p.cleared, clearT: p.clearT, drop: 1, hp: p.hp, swallowed: p.swallowed, r: p.r })),
      balls: sm.balls.map(b => ({ x: b.x, z: b.z, r: b.r, type: b.type, kind: b.kind, rot: b.rot, gone: b.gone, delay: b.delay, shard: b.shard, didSplit: b.didSplit, exploded: b.exploded })),
      posts: sm.posts.map(q => ({ x: q.x, z: q.z, r: q.r })),
      fx: sm.fx.map(f => Object.assign({}, f))
    };
  }
  // Plays a recorded roll at 40% speed. Resolves when done or when the player taps to skip.
  function playReplay(rec, label) {
    if (!rec || !rec.frames || rec.frames.length < 4) return Promise.resolve();
    const fr = rec.frames, t0 = fr[0].time;
    let start = 0;
    const firstHit = fr.findIndex(f => f.balls.some(b => !b.gone && b.z > GK.C.ZH - 30));
    if (firstHit > 0) { const tt = fr[firstHit].time - 0.45; start = Math.max(0, fr.findIndex(f => f.time >= tt)); }
    return new Promise(resolve => {
      replay = { rec, frames: fr, i: start, t: fr[start].time, speed: 0.4, done: resolve };
      UI.banner(label || 'REPLAY', 'tap to skip');
      setPhase('replay');
    });
  }
  async function playHighlights() {
    const list = highlights.slice().sort((a, b) => a.score - b.score);
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      R.setTheme(h.rec.def, h.rec.lane.lhw || C.LHW, h.rec.lane.magnet ? 12 : C.GUT, h.rec.lane.oil);
      await playReplay(h.rec, 'HIGHLIGHT ' + (i + 1) + '/' + list.length + ' · ' + fmt(h.score));
    }
  }
  function endReplay() {
    if (!replay) return;
    const d = replay.done; replay = null; UI.hideBanner();
    if (phase === 'replay') phase = 'busy';
    d();
  }
  // ---------- tutorial hints ----------
  // Each hint shows once (remembered in meta); the first run's first frame walks through the steps.
  const HINTS = {
    step_pos: 'Tap anywhere on the lane to stop the ball where you want to start. The bar under the lane slides with it.',
    step_angle: 'Now the arrow swings. Tap when it points where you want your ball to go.',
    step_power: 'Tap inside the thin green zone for a PERFECT throw. Late taps go too hard and the ball wobbles.',
    step_hook: 'Last, the hook dial. Left curves the ball left, right curves it right. Stop it near the middle to roll straight.',
    groove: 'PERFECT! Throw PERFECT again and again to build Groove: +1 Mult per stack on every frame.',
    oil: 'See the boards turning brown? You are drying out your line. The ball will start hooking earlier there.',
    stuck: 'Your ball jammed in the ball return. Tap a different ball on the return; the stuck one comes back after.',
    respot: 'The old pinsetter fumbles now and then. Free pins!',
    laneEvent: 'Lane surprises like this can happen at the start of any frame except in Boss Matches.',
    boss: 'Boss Match! Read the boss rule on the intro card. Bosses change how the whole round plays.',
    shop: 'The Pro Shop: charms trigger left to right after every frame, so their order matters. Tap your charms below to sell or move them.'
  };
  let coachT = 0;
  function hint(key) {
    if (!HINTS[key] || meta.hintsOff) return;
    meta.hints = meta.hints || {};
    if (meta.hints[key]) return;
    meta.hints[key] = true; GK.saveMeta(meta);
    coach(HINTS[key]);
  }
  function coach(text) {
    const el = $('coach'); if (!el) return;
    clearTimeout(coachT);
    if (!text) { el.hidden = true; return; }
    el.querySelector('p').textContent = text; el.hidden = false;
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    coachT = setTimeout(() => { el.hidden = true; }, 9000);
  }
  $('coach').addEventListener('click', () => coach(null));

  // ---------- practice lane ----------
  function startPractice(alley) {
    sfx.init();
    run = GK.newRun({ seed: (Date.now() >>> 0), bag: 'classic' });
    run.practice = true; run.alley = alley; run.round = 0; run.maxBag = 4;
    run.bag = ['house', 'feather', 'lead', 'split'].map(type => ({ type, ed: null }));
    GK.startRound(run);
    run.rs.target = Infinity; run.rs.framesMax = 999; run.rs.reracks = 99; run.rs.boss = null;
    sel = 0; bestReplay = null;
    themeRound(); UI.hideLayer();
    UI.banner('PRACTICE', GK.alleyDef(run).name + ' · ' + GK.OIL[laneOf().oil || 'house'].name, 1800);
    beginFrame();
  }

  function cheer(mood) { crowd = { mood, t: 0 }; }
  // Big TV: replays the latest cartoon on a loop (or the idle channel).
  let tvBig = null, lastTv = null;
  function openTV() {
    sfx.tick(600);
    tvBig = { t: 0 };
    UI.tvModal(() => { tvBig = null; });
  }
  function tvShow(kind, leave710) {
    const k = kind === 'split' ? (leave710 ? 'seven10' : 'split') : kind;
    if (!['strike', 'double', 'turkey', 'spare', 'split', 'seven10'].includes(k)) return;
    tv = { kind: k, t: 0, v: Math.floor(Math.random() * 2) };
    // Rarely, the TV shows one of the Regulars bowling instead.
    if (k !== 'split' && k !== 'seven10' && Math.random() < 0.12) tv.kind = ['quinn', 'levi', 'kaleb'][Math.floor(Math.random() * 3)];
    lastTv = { kind: tv.kind, v: tv.v };
  }

  const stepText = st => st.op === 'chips' ? '+' + fmt(st.v) + ' Points' : st.op === 'mult' ? '+' + (Math.round(st.v * 10) / 10) + ' Mult' : st.op === 'xmult' ? '×' + (Math.round(st.v * 100) / 100) + ' Mult' : st.op === 'money' ? '+$' + st.v : '';
  const stepCol = st => st.op === 'chips' ? '#39c6d6' : st.op === 'money' ? '#f2c94c' : '#ff5a6e';

  // token: if the player quits (or a debug jump happens) mid-animation, stop touching the run.
  async function scoreFrame(kind, token) {
    const rs = run.rs, s = GK.SHOTS[kind];
    const live = () => token === busyToken && run && run.rs === rs;
    const res = GK.scoreCurrent(run, kind);
    skipScore = false;
    const streakN = GK.isStrikeKind(kind) ? (rs.streak || 0) + 1 : 0;
    if (streakN) {
      R.shake = Math.min(14, 5 + streakN * 1.5); R.flash = Math.min(0.7, 0.3 + streakN * 0.05); GK.haptic('success');
      if (streakN >= 2) sfx.streak(streakN); else sfx.strike();
      if (streakN >= 3) R.confetti(Math.min(90, 30 + streakN * 10));
    } else if (GK.isSpareKind(kind)) sfx.spare();
    tvShow(kind, res.ctx.leave710);
    const pinsSum = rs.cur.rolls.reduce((a, r) => a + r.pins, 0);
    if (streakN >= 2) UI.banner(GK.streakName(streakN), streakN >= 4 ? streakN + ' strikes in a row' : '', 0, Math.min(5, streakN - 1));
    else UI.banner(s.name.toUpperCase(), kind === 'open' ? pinsSum + ' pins' : '');
    const d = fast ? 120 : 260;
    const wait = ms => skipScore ? Promise.resolve() : sleep(ms);
    await wait(fast ? 250 : 450); if (!live()) return;
    let n = 0;
    for (const st of res.steps) {
      if (st.op === 'set') { UI.tally(st.chips, st.mult, null); UI.shot(st.label); UI.bump($('chipsBox')); UI.bump($('multBox')); sfx.tick(440); await wait(d); if (!live()) return; continue; }
      UI.tally(st.chips, st.mult, null);
      const txt = stepText(st);
      UI.shot(st.label + (txt ? ' · ' + txt : ''));
      if (st.src === 'charm') UI.fireCharm(st.idx, txt || st.label, stepCol(st));
      if (st.op === 'chips') { UI.bump($('chipsBox')); sfx.chip(n); }
      else if (st.op === 'mult') { UI.bump($('multBox')); sfx.mult(n); }
      else if (st.op === 'xmult') { UI.bump($('multBox')); UI.jolt(); sfx.xmult(); R.shake = Math.max(R.shake, 3); }
      else if (st.op === 'money') { sfx.coin(); }
      else if (st.op === 'zero') { UI.bump($('eqBox')); sfx.nope(); }
      n++;
      await wait(d); if (!live()) return;
    }
    UI.tally(res.chips, res.mult, res.score); UI.bump($('eqBox')); sfx.tick(880);
    UI.shot(s.name + ' · ' + fmt(res.chips) + ' × ' + (Math.round(res.mult * 100) / 100) + ' = ' + fmt(res.score));
    await wait(fast ? 200 : 380); if (!live()) return;
    const start = rs.total;
    const out = GK.commitFrame(run, kind, res);
    if (run.best && run.best.score === res.score && run.best.frame === rs.frameIdx - 1) bestReplay = lastRec;
    if (lastRec && lastRec.frames && lastRec.frames.length > 4 && !run.practice) {
      highlights.push({ score: res.score, rec: lastRec, kind });
      highlights.sort((a, b) => b.score - a.score); highlights = highlights.slice(0, 3);
    }
    if (!run.practice) {
      const beat = GK.beatRegulars(meta, res.score);
      if (beat.length) {
        const r0 = beat[beat.length - 1];
        GK.saveMeta(meta);
        setTimeout(() => { UI.toast('You beat ' + r0.name + '\'s best frame of ' + fmt(r0.frame) + '!', 2800); tv = { kind: r0.who, t: 0, v: 0 }; lastTv = { kind: r0.who, v: 0 }; sfx.win(); }, 600);
      }
    }
    feats({ t: 'frame', kind, score: res.score, ctx: res.ctx, leave710: res.ctx.leave710, breaks: res.breaks, run });
    if (kind === 'turkey' || kind === 'double') cheer('cheer'); else if (GK.isSpareKind(kind)) cheer('clap'); else if (kind === 'gutter') cheer('groan');
    for (let i = 1; i <= 8; i++) { $('score').firstChild.textContent = fmt(start + res.score * i / 8); await wait(30); if (!live()) return; }
    if (res.score > meta.bestFrame) { meta.bestFrame = res.score; GK.saveMeta(meta); }
    refresh();
    for (const nt of out.notes) {
      UI.toast(nt.text, nt.t === 'evolve' ? 2600 : 1800);
      if (nt.t === 'evolve') { sfx.levelUp(); UI.fireCharm(nt.idx, 'EVOLVED!', '#ffd447'); R.confetti(25); }
      if (nt.t === 'jackpot') { tv = { kind: 'jackpot', t: 0, v: 0, reels: nt.reels }; lastTv = { kind: 'jackpot', v: 0, reels: nt.reels }; for (let i = 0; i < 14; i++) setTimeout(() => sfx.slot(), i * 70); setTimeout(() => { sfx.win(); R.confetti(50); }, 1100); UI.banner('JACKPOT PIN!', nt.text, 1800, 4); }
      if (nt.t === 'dare') { tv = { kind: nt.who, t: 0, v: 0 }; lastTv = { kind: nt.who, v: 0 }; if (nt.won) { sfx.coin(); R.confetti(25); } else sfx.taunt(); }
    }
    await wait(fast ? 250 : 450); if (!live()) return;
    UI.hideBanner();
    if (out.status === 'won') return roundWon();
    if (out.status === 'lost') return roundLost();
    beginFrame();
  }

  // Check feats against an event; announce and save anything newly unlocked.
  function feats(ev) {
    if (run && run.practice) return;
    const got = GK.checkFeats(meta, ev);
    if (!got.length) return;
    GK.saveMeta(meta);
    got.forEach((f, i) => setTimeout(() => {
      UI.toast('Feat: ' + f.name + ' · Unlocked ' + f.unlocks.map(GK.unlockName).join(', '), 2600);
      sfx.win();
    }, i * 2700));
  }

  function bumpMeta() {
    if (run && run.practice) return;
    const reached = GK.isChamp(run) ? 9 : run.alley + 1;
    meta.bestAlley = Math.max(meta.bestAlley, run.won ? 9 : reached);
    if (run.daily) {
      const key = GK.dailySeed(), label = run.won ? 'Champion' : (GK.isChamp(run) ? 'Champ' : 'A' + (run.alley + 1) + ' R' + (run.round + 1));
      const prev = meta.daily[key];
      const rank = l => l === 'Champion' ? 999 : l === 'Champ' ? 900 : (parseInt(l.slice(1), 10) * 10 + parseInt(l.split('R')[1], 10));
      if (!prev || rank(label) > rank(prev)) meta.daily = { [key]: label };
      const d = new Date(), date = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
      const rk = rank(label);
      meta.dailyLog = (meta.dailyLog || []).filter(x => x.date !== date || (x.rank || 0) >= rk);
      if (!meta.dailyLog.some(x => x.date === date)) meta.dailyLog.unshift({ date, rank: rk, label: run.won ? 'Champion' : GK.isChamp(run) ? 'Championship' : 'Alley ' + (run.alley + 1) + ' · ' + GK.ROUND_NAMES[run.round], best: run.stats.bestFrame });
      meta.dailyLog = meta.dailyLog.slice(0, 14);
    }
    GK.saveMeta(meta);
  }

  function roundWon() {
    sfx.win();
    const score = run.rs.total, ok = GK.overkill(run.rs);
    if (ok && !run.practice) { UI.banner(ok.label + '!', fmt(score) + ' · ' + (Math.floor(score / run.rs.target * 10) / 10) + '× the target', 1600, Math.min(5, ok.tier + 1)); R.confetti(30 + ok.tier * 20); sfx.streak(2 + ok.tier * 2); R.shake = 6 + ok.tier * 2; }
    else UI.banner('ROUND CLEARED', fmt(score), 1400);
    const n = GK.bonusCount(run);
    if (n > 0) {
      bonus = { i: 0, n, pays: [] };
      const tk = busyToken;
      setTimeout(() => tk === busyToken && bonus && nextBonusBall(), 1500);
      return;
    }
    finishRound();
  }
  // Bonus balls: a fresh rack of gold pins for every frame you didn't need (up to 3).
  function nextBonusBall() {
    sim = GK.bonusSim(run, bonus.i);
    sim.onEvent = onSimEvent;
    pickGlow(); resetTally();
    step = 'pos'; posT0 = performance.now();
    UI.banner('BONUS BALL ' + (bonus.i + 1) + '/' + bonus.n, 'Gold pins pay cash · every 4 pins = $1', 1500);
    UI.shot('Bonus ball ' + (bonus.i + 1) + ' of ' + bonus.n + ' · knock down the gold!');
    setPhase('aim');
  }
  async function bonusRollEnd(token) {
    const r = GK.bonusResult(run, sim);
    bonus.pays.push(r.pay);
    if (r.strike) { sfx.strike(); R.confetti(40); R.shake = 6; UI.banner('GOLD STRIKE!', '+$' + r.pay, 1300, 3); }
    else UI.banner(r.pins + ' GOLD PINS', r.pay ? '+$' + r.pay : 'no cash this time', 1100);
    for (let i = 0; i < r.pay; i++) setTimeout(() => sfx.coin(), i * 120);
    UI.shot('Bonus ball ' + (bonus.i + 1) + ': ' + r.pins + ' pins · +$' + r.pay);
    await sleep(1400); if (token !== busyToken || !bonus) return;
    bonus.i++;
    if (bonus.i < bonus.n) return nextBonusBall();
    bonus = null;
    UI.hideBanner();
    finishRound();
  }
  function finishRound() {
    const score = run.rs.total;
    const lines = GK.payout(run);
    GK.applyPayout(run, lines);
    const payRun = JSON.parse(JSON.stringify(run));
    feats({ t: 'round', boss: run.rs.boss, run });
    const beatBoss = !run.practice && run.rs.boss && run.rs.boss !== 'champion' ? GK.bossFor(run) : null;
    const nxt = GK.advance(run);
    if (nxt === 'won') {
      meta.wins++;
      meta.maxAsc = Math.max(meta.maxAsc || 0, Math.min(GK.MAX_ASC, (run.asc || 0) + 1));
      feats({ t: 'run', won: true, run });
      bumpMeta(); GK.clearSave();
      setPhase('menu');
      const tk = busyToken;
      setTimeout(() => tk === busyToken && UI.wallOfFame(run, () => showEnd(true)), 900);
      return;
    }
    feats({ t: 'reach', run });
    bumpMeta();
    GK.openShop(run);
    GK.applyShopTags(run);
    run.event = GK.rollEvent(run);
    GK.save(run);
    setPhase('menu');
    const tk = busyToken;
    const afterPay = () => run.event ? showEvent(run.event) : showShop();
    const choices = beatBoss ? GK.trophyChoices(run, beatBoss) : [];
    setTimeout(() => tk === busyToken && UI.payout(payRun, lines, score, () => {
      if (!choices.length) return afterPay();
      sfx.levelUp();
      UI.trophyPick(beatBoss, choices, id => { const r = GK.takeTrophy(run, id); UI.toast(r.msg, 2200); GK.save(run); UI.hud(run); afterPay(); });
    }, choices.length ? 'Claim your trophy' : null), 700);
  }
  function roundLost() {
    sfx.lose();
    run.over = true; bumpMeta(); GK.clearSave();
    if (GK.isEndless(run)) { meta.bestEndless = Math.max(meta.bestEndless || 0, run.alley - GK.ALLEY_COUNT); GK.saveMeta(meta); }
    setPhase('menu');
    UI.banner('RUN OVER', fmt(run.rs.total) + ' / ' + fmt(run.rs.target), 1500);
    const tk = busyToken;
    setTimeout(() => tk === busyToken && showEnd(false), 1200);
  }
  // Between-round event: one offer, take it or walk away, then on to the shop.
  function showEvent(ev) {
    const done = r => {
      if (r && r.ok === false) { sfx.nope(); UI.toast(r.msg || 'Can\'t do that'); return; }
      if (r && r.msg) { sfx.buy(); UI.toast(r.msg, 2600); }
      feats({ t: 'shop', run });
      run.event = null; GK.save(run); UI.hideModal(); showShop();
    };
    UI.eventScreen(run, ev, {
      take: () => {
        if (ev.id === 'lane_mech') return drillFlow(true, r => done(r));
        const r = GK.takeEvent(run, ev);
        if (r.need === 'replace') return UI.ballPicker(run, 'Leave a ball behind', r.msg, i => done(GK.takeEvent(run, ev, i)), UI.hideModal);
        done(r);
      },
      leave: () => done(null),
      // sell a charm or ball right from the event screen, then show the event again
      charm: i => {
        const c = run.charms[i]; GK._run = run;
        UI.detail(UI.info('charm', c.id, c.ed, c), [
          { label: 'Sell for $' + GK.charmSell(c), fn: () => { GK.sellCharm(run, i); sfx.coin(); UI.hideModal(); GK.save(run); showEvent(ev); }, cls: 'danger' },
          { label: 'Close', fn: UI.hideModal, cls: 'alt' }
        ]);
      },
      ball: i => {
        const b = run.bag[i]; GK._run = run;
        UI.detail(UI.info('ball', b.type, b.ed, b), [
          { label: 'Sell for $' + GK.ballSell(b), fn: () => { const r = GK.sellBall(run, i); UI.hideModal(); if (!r.ok) { sfx.nope(); return UI.toast(r.msg); } sfx.coin(); GK.save(run); showEvent(ev); }, cls: 'danger', disabled: run.bag.length <= 1 },
          { label: 'Close', fn: UI.hideModal, cls: 'alt' }
        ]);
      }
    });
  }
  // Pick a ball, then a layout. free = the lane mechanic's favour.
  function drillFlow(free, after) {
    UI.ballPicker(run, 'Re-drill a ball', free ? 'Pick a ball for the free re-drill.' : 'Pick a ball to re-drill for ' + (GK.drillCost(run) ? '$' + GK.drillCost(run) : 'free') + '.', bi => {
      UI.drillPicker(run, bi, id => { UI.hideModal(); after(free ? GK.takeEvent(run, run.event || { id: 'lane_mech' }, { ball: bi, drill: id }) : GK.redrill(run, bi, id)); }, UI.hideModal);
    }, UI.hideModal);
  }
  function awardXP() {
    if (!run || run.practice || run.xpDone) return;
    run.xpDone = true;
    const x = GK.runXP(run), res = GK.addXP(meta, x.total);
    lastXP = Object.assign(res, { parts: x.parts });
    GK.saveMeta(meta);
  }
  function showEnd(won) {
    awardXP();
    if (lastXP && lastXP.to > lastXP.from) { sfx.levelUp(); setTimeout(() => R.confetti(40), 200); }
    UI.end(run, won, meta, {
      xp: lastXP,
      highlights: highlights.length ? () => { UI.hideLayer(); playHighlights().then(() => showEnd(won)); } : null,
      challenge: () => GK.challengeText(run, won),
      endless: won ? () => {
        GK.startEndless(run); GK.openShop(run); GK.applyShopTags(run); GK.save(run);
        themeRound(); UI.toast('Endless mode: the alleys come around again, and the targets keep climbing.', 3200); showShop();
      } : null,
      again: newRunScreen, title,
      best: bestReplay ? () => {
        const rec = bestReplay;
        UI.hideLayer();
        R.setTheme(rec.def, rec.lane.lhw || C.LHW, rec.lane.magnet ? 12 : C.GUT, rec.lane.oil);
        playReplay(rec, 'BEST FRAME').then(() => showEnd(won));
      } : null
    });
  }

  // ---------- shop ----------
  function showShop() {
    phase = 'shop';
    hint('shop');
    UI.hud(run); UI.charms(run, tapCharm);
    UI.shop(run, {
      buy: i => {
        const r = GK.buy(run, i);
        if (r.need === 'replace') {
          const it = run.shop.items[i];
          return UI.ballPicker(run, 'Swap out a ball', 'Your bag is full. Pick a ball to replace with the ' + GK.BALLS[it.id].full + '.', bi => { UI.hideModal(); const r2 = GK.buy(run, i, bi); after(r2); }, UI.hideModal);
        }
        after(r);
      },
      member: () => after(GK.buyMember(run)),
      drill: () => drillFlow(false, r => after(r)),
      reroll: () => after(GK.reroll(run)),
      info: () => UI.runInfo(run),
      next: () => { UI.hideLayer(); run.phase = 'intro'; toIntro(); },
      charm: i => {
        const c = run.charms[i];
        UI.detail(UI.info('charm', c.id, c.ed, c), [
          { label: 'Sell for $' + GK.charmSell(c), fn: () => { GK.sellCharm(run, i); sfx.coin(); UI.hideModal(); showShop(); }, cls: 'danger' },
          { label: '← Move left', fn: () => { GK.moveCharm(run, i, -1); UI.hideModal(); showShop(); }, cls: 'alt', disabled: i === 0 },
          { label: 'Move right →', fn: () => { GK.moveCharm(run, i, 1); UI.hideModal(); showShop(); }, cls: 'alt', disabled: i === run.charms.length - 1 },
          { label: 'Close', fn: UI.hideModal, cls: 'alt' }
        ]);
      },
      ball: i => {
        const b = run.bag[i];
        UI.detail(UI.info('ball', b.type, b.ed, b), [
          { label: 'Sell for $' + GK.ballSell(b), fn: () => { const r = GK.sellBall(run, i); if (!r.ok) { UI.hideModal(); sfx.nope(); return UI.toast(r.msg); } sfx.coin(); UI.hideModal(); showShop(); }, cls: 'danger', disabled: run.bag.length <= 1 },
          { label: 'Close', fn: UI.hideModal, cls: 'alt' }
        ]);
      },
      cons: i => consDetail(i, false)
    });
    function after(r) {
      if (r && r.ok === false) { sfx.nope(); UI.toast(r.msg || 'Can\'t do that'); }
      else sfx.buy();
      GK.save(run); showShop();
      feats({ t: 'shop', run });
    }
  }

  // ---------- consumables ----------
  function tapCons(i) { if (phase === 'aim' && !bonus) consDetail(i, true); }
  function consDetail(i, inRound) {
    const id = run.cons[i], k = GK.CONS[id];
    const done = r => {
      UI.hideModal();
      if (!r.ok) { sfx.nope(); if (r.msg) UI.toast(r.msg); return; }
      sfx.buy(); UI.toast(r.msg || 'Used', 2000);
      feats({ t: inRound ? 'use' : 'shop', run });
      if (k.target === 'pin' && inRound) UI.toast(r.msg + ' (from next frame)', 2200);
      GK.save(run);
      if (inRound) refresh(); else showShop();
    };
    const use = () => {
      if (k.inRound && !inRound) { UI.hideModal(); sfx.nope(); return UI.toast('Use this during a round.'); }
      if (k.target === 'pin') return UI.pinPicker(run, k, picks => done(GK.useCons(run, i, picks, inRound)), UI.hideModal);
      if (k.target === 'ball') return UI.ballPicker(run, k.name, k.desc, bi => done(GK.useCons(run, i, bi, inRound)), UI.hideModal);
      const pick = opts => UI.choicePicker(k.name, k.desc, opts, v => done(GK.useCons(run, i, v, inRound)), UI.hideModal);
      if (k.target === 'oil') return pick(Object.entries(GK.OIL).map(([id, o]) => ({ id, name: o.name, desc: o.desc })));
      if (k.target === 'boss') return pick(Object.entries(GK.BOSSES).filter(([id]) => id !== 'champion').map(([id, b]) => ({ id, name: b.name, desc: b.desc })));
      if (k.target === 'shot') return pick(GK.SHOT_ORDER.concat(['fullrack']).map(id => ({ id, name: GK.SHOTS[id].name, desc: 'Level ' + (((run.levels || {})[id] || 0) + 1) })));
      done(GK.useCons(run, i, null, inRound));
    };
    UI.detail(UI.info('cons', id), [
      { label: 'Use', fn: use, disabled: k.inRound && !inRound },
      { label: 'Sell for $' + (GK._run = run, GK.consSell(id)), fn: () => { GK.sellCons(run, i); sfx.coin(); UI.hideModal(); GK.save(run); if (inRound) refresh(); else showShop(); }, cls: 'danger' },
      { label: 'Close', fn: UI.hideModal, cls: 'alt' }
    ]);
  }
  function tapCharm(i) {
    const c = run.charms[i]; if (!c) return;
    const inf = UI.info('charm', c.id, c.ed, c);
    if (run.rs && run.rs.stolen === i && phase !== 'shop') inf.desc += ' (Stolen by the Gutter King for this match.)';
    UI.detail(inf, [{ label: 'Close', fn: UI.hideModal, cls: 'alt' }]);
  }

  // ---------- menu ----------
  $('menuBtn').addEventListener('click', () => {
    sfx.init();
    if (!run) return;
    UI.menu(run, {
      resume: UI.hideModal,
      info: () => UI.runInfo(run, () => $('menuBtn').click()),
      how: () => UI.how(() => $('menuBtn').click()),
      sound: el => { sfx.setMuted(!sfx.muted); meta.muted = sfx.muted; GK.saveMeta(meta); el.textContent = sfx.muted ? 'Sound off' : 'Sound on'; },
      speed: el => { fast = !fast; try { localStorage.setItem('gk-fast', fast ? '1' : '0'); } catch (e) {} el.textContent = fast ? 'Scoring: fast' : 'Scoring: normal'; },
      fast: () => fast,
      replays: el => { meta.replays = meta.replays === false; GK.saveMeta(meta); el.textContent = meta.replays === false ? 'Replays: off' : 'Replays: on'; },
      replaysOn: () => meta.replays !== false,
      music: el => { meta.music = meta.music === false; GK.saveMeta(meta); GK.music.setOn(meta.music !== false); if (meta.music !== false) playMusic(); el.textContent = meta.music === false ? 'Music: off' : 'Music: on'; },
      musicOn: () => meta.music !== false,
      haptics: el => { meta.haptics = meta.haptics === false; GK.saveMeta(meta); GK.haptic.setOn(meta.haptics !== false); el.textContent = meta.haptics === false ? 'Vibration: off' : 'Vibration: on'; },
      hapticsOn: () => meta.haptics !== false,
      hints: el => { meta.hintsOff = !meta.hintsOff; if (!meta.hintsOff) meta.hints = {}; GK.saveMeta(meta); el.textContent = meta.hintsOff ? 'Hints: off' : 'Hints: on'; },
      hintsOn: () => !meta.hintsOff,
      practice: () => !!(run && run.practice),
      freshOil: () => { if (run && run.rs) { run.rs.wear = GK.newWear(); R.setWear(run.rs.wear); UI.toast('Fresh oil on the lane'); } UI.hideModal(); },
      title: () => { busyToken++; if (run && !run.over && !run.won) GK.save(run); UI.hideLayer(); title(); },
      abandon: () => {
        UI.detail({ name: 'Abandon run?', k: 'Are you sure', desc: 'This run will end and its save will be deleted.', col: '#ff5a6e' }, [
          { label: 'Abandon', cls: 'danger', fn: () => { busyToken++; run.over = true; bumpMeta(); GK.clearSave(); UI.hideLayer(); title(); } },
          { label: 'Keep playing', cls: 'alt', fn: UI.hideModal }
        ]);
      }
    });
  });

  // ---------- input ----------
  // Four timed steps, each a tap to stop a sweeping slider: start spot → angle → power → hook.
  // There is no going back: once a slider is stopped, that part of the throw is locked in.
  // The last tap throws. Tuned to be demanding: the sliders are quick and the PERFECT zone narrow.
  let step = 'pos', aimAng = 0, posT0 = performance.now(), angT0 = 0, powerT0 = 0, dialT0 = 0, lockedPower = null;
  const PZONE = [0.83, 0.89], POS_PERIOD = 1.0, ANG_PERIOD = 0.8, POWER_PERIOD = 0.8, DIAL_PERIOD = 0.7;
  function pickBall(i) {
    if (!run || !run.bag[i]) return;
    if (GK.isStuck(run, i)) { sfx.nope(); UI.toast(GK.BALLS[run.bag[i].type].full + ' is stuck in the ball return. Throw another ball first.'); return; }
    sel = i; sfx.tick(760);
    aimX = GK.clamp(aimX, -aimLim(), aimLim());
    refresh();
  }
  // Quinn's Two-Hander can start right on the gutter edge; Kaleb's Wide Swing gets twice the angle.
  const selType = () => run && run.bag[sel] ? run.bag[sel].type : 'house';
  const aimLim = () => (selType() === 'twohander' ? C.LHW - 1.2 : C.LHW - C.BALL_R - 0.5) - (C.LHW - (laneOf().lhw || C.LHW));
  const angLim = () => 0.085 * Math.max(1, GK.equipMods(run).aim) * GK.equipMods(run).angRange * (selType() === 'wideswing' ? 2 : 1);
  let zoneMid = null; // Lucky Socks: the PERFECT zone wanders to a new spot each throw
  function zone() {
    const eq = GK.equipMods(run), half = (PZONE[1] - PZONE[0]) / 2 * eq.zone;
    const mid = eq.wander && zoneMid != null ? zoneMid : (PZONE[0] + PZONE[1]) / 2;
    return [Math.max(0.3, mid - half), Math.min(0.99, mid + half)];
  }
  const tri = u => { u %= 2; return u < 1 ? u : 2 - u; };
  // Slow Motion slows the bar while you have Groove; Fingerless Gloves make it jitter.
  function barPeriod() {
    const fl = GK.flags(run, run.rs ? run.rs.stolen : -1);
    return POWER_PERIOD * GK.equipMods(run).bar * (fl.slowmo && run.rs && run.rs.groove > 0 ? 1.3 : 1);
  }
  function powerNow() {
    const t = (performance.now() - powerT0) / 1000;
    const p = tri(t / barPeriod());
    return GK.equipMods(run).jitter ? GK.clamp(p + 0.025 * Math.sin(t * 41) * Math.sin(t * 13), 0, 1) : p;
  }
  // Start slider: the ball glides across the approach; angle slider: the arrow swings side to side.
  // Both start from the centre. Anchor Shoes slow the angle swing; Slide Shoes widen its range.
  function posNow() { return (tri((performance.now() - posT0) / 1000 / (POS_PERIOD * GK.equipMods(run).posSlow) + 0.5) * 2 - 1) * aimLim(); }
  function angNow() {
    const eq = GK.equipMods(run), a = eq.aim, per = ANG_PERIOD * Math.max(1, a) / Math.min(1, a) * eq.angSpeed;
    return (tri((performance.now() - angT0) / 1000 / per + 0.5) * 2 - 1) * angLim();
  }
  // Hook dial: -1 (hard left) .. +1 (hard right), starting from the centre.
  function dialNow() { return tri((performance.now() - dialT0) / 1000 / (DIAL_PERIOD * GK.equipMods(run).dial) + 0.5) * 2 - 1; }
  const STEP_TEXT = {
    pos: ['1 · Tap to stop the start slider', 'Set start'],
    angle: ['2 · Tap to stop the angle', 'Set angle'],
    power: ['3 · Tap to stop the power bar', 'Set power'],
    hook: ['4 · Tap to set your hook', 'Throw!']
  };
  function setStep(s2) {
    step = s2;
    hint('step_' + s2);
    if (s2 === 'pos') posT0 = performance.now();
    if (s2 === 'angle') angT0 = performance.now();
    if (s2 === 'power') { powerT0 = performance.now(); zoneMid = 0.55 + Math.random() * 0.36; }
    if (s2 === 'hook') dialT0 = performance.now();
    syncCtrl();
  }
  UI.onShot = () => syncCtrl();
  function syncCtrl() {
    const on = phase === 'aim';
    $('ctrl').classList.toggle('off', !on);
    $('stepLbl').textContent = on ? STEP_TEXT[step][0] : phase === 'call' ? 'Call your shot first' : phase === 'rolling' ? 'Rolling…' : phase === 'replay' ? 'Replay · tap to skip' : '';
    $('setBtn').textContent = STEP_TEXT[step][1];
    $('setBtn').disabled = !on;
    $('pbar').hidden = !(on && step === 'power');
    $('hbar').hidden = !(on && step === 'hook');
    $('sbar').hidden = !(on && (step === 'pos' || step === 'angle'));
    $('sbarLbl').textContent = step === 'angle' ? 'angle' : 'start';
    // While the ball rolls and the frame scores, the control row shows the play-by-play instead.
    const showShot = !on && phase !== 'call' && phase !== 'replay' && !!$('shot').textContent;
    $('stepLbl').hidden = on || showShot;
    $('shot').hidden = !showShot;
    const z = zone();
    $('pzone').style.left = z[0] * 100 + '%'; $('pzone').style.width = (z[1] - z[0]) * 100 + '%';
    const g = run && run.rs ? run.rs.groove || 0 : 0;
    $('grooveLbl').hidden = !g; $('grooveLbl').textContent = '♪ ' + g;
    if (GK.music && GK.music.setGroove) GK.music.setGroove(g);
  }
  function confirmStep() {
    if (phase !== 'aim') return;
    sfx.init();
    if (step === 'pos') { setStep('angle'); sfx.tick(520); }
    else if (step === 'angle') { setStep('power'); sfx.tick(660); }
    else if (step === 'power') lockPower();
    else releaseHook();
  }
  function lockPower() {
    const p = powerNow(), z = zone();
    let label;
    if (p >= z[0] && p <= z[1]) { label = 'PERFECT!'; sfx.coin(); GK.haptic('medium'); hint('groove'); }
    else if (p > z[1]) { label = 'TOO HARD'; sfx.tick(220); }
    else { label = p < 0.45 ? 'SOFT' : 'GOOD'; sfx.tick(440); }
    lockedPower = { p, label, perfect: label === 'PERFECT!' };
    R.pop(aimX, 10, 14, label + ' ' + Math.round(p * 100) + '%', label === 'PERFECT!' ? '#7be38a' : label === 'TOO HARD' ? '#ff5a6e' : '#ffb547');
    setStep('hook');
  }
  function releaseHook() {
    const lp = lockedPower || { p: 0.5, label: 'GOOD', perfect: false };
    const eq = GK.equipMods(run), z = zone();
    let aim = aimAng, spin = dialNow();
    if (lp.p > z[1] && !eq.noWobble) {
      const k = (lp.p - z[1]) / (1 - z[1] + 0.001);
      aim += (Math.random() - 0.5) * 0.05 * (0.4 + k); spin += (Math.random() - 0.5) * 0.6 * (0.4 + k);
    }
    const speed = 170 + GK.clamp(lp.p, 0, 1) * 300;
    lockedPower = null;
    // Pendulum Ball: where the swing is when you let go decides its path.
    const phase0 = (performance.now() / 1000 * 2.4) % (Math.PI * 2);
    throwBall({ aimX, aim, spin: GK.clamp(spin, -1.2, 1.2), speed, power: lp.p, perfect: lp.perfect, phase: phase0 });
  }

  // Every step is a tap: anywhere on the lane stops the current slider, except a tap on a ball
  // sitting in the ball return (before the power step), which picks that ball instead.
  cv.addEventListener('pointerdown', e => {
    sfx.init();
    if (phase === 'replay') { e.preventDefault(); endReplay(); return; }
    if (phase === 'busy') skipScore = true;
    {
      const rr = cv.getBoundingClientRect(), bx = (e.clientX - rr.left) / rr.width * C.W, by = (e.clientY - rr.top) / rr.height * C.H;
      if (run && R.tvHit(bx, by)) { e.preventDefault(); openTV(); return; }
    }
    if (phase !== 'aim') return;
    e.preventDefault();
    if (step === 'pos' || step === 'angle') {
      const rr = cv.getBoundingClientRect(), bx = (e.clientX - rr.left) / rr.width * C.W, by = (e.clientY - rr.top) / rr.height * C.H;
      const hit = R.returnHit(bx, by);
      if (hit >= 0) { pickBall(hit); return; }
    }
    confirmStep();
  });
  $('setBtn').addEventListener('pointerdown', e => { e.preventDefault(); confirmStep(); });
  window.addEventListener('keydown', e => {
    if (!$('modal').hidden || !$('layer').hidden) return;
    if (phase === 'replay' && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); endReplay(); return; }
    if (!run) return;
    if (phase === 'call' && ['1', '2', '3'].includes(e.key)) { document.querySelectorAll('#callbar [data-call]')[+e.key - 1].click(); return; }
    if (phase !== 'aim') return;
    if (/^[1-9]$/.test(e.key) && +e.key <= run.bag.length) pickBall(+e.key - 1);
    else if (e.key === 'r' || e.key === 'R') $('rerackBtn').click();
    else if (e.key === ' ' || e.key === 'Enter') {
      // Space/Enter always means "set" during aiming, even if a dock button still has focus.
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      e.preventDefault(); confirmStep();
    }
  });
  // Exposed for automated play-tests.
  GK.debug.throw = prm => throwBall(Object.assign({ aimX, aim: 0, spin: 0, speed: 340 }, prm));
  GK.debug.skipReplay = () => endReplay();
  GK.debug.select = i => { sel = i; refresh(); };
  GK.debug.pickBall = i => pickBall(i);
  GK.debug.showEvent = ev => { UI.hideModal(); showEvent(ev); };
  GK.debug.showEnd = won => { busyToken++; UI.hideModal(); showEnd(won); };
  GK.debug.wall = () => { busyToken++; UI.hideModal(); UI.wallOfFame(run, () => showEnd(true)); };
  GK.debug.tv = k => { if (['quinn', 'levi', 'kaleb'].includes(k)) { tv = { kind: k, t: 0, v: 0 }; lastTv = { kind: k, v: 0 }; } else tvShow(k, false); };
  GK.debug.jump = (alley, round) => { busyToken++; UI.hideLayer(); UI.hideModal(); run.alley = alley; run.round = round; toIntro(); };

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  function loop(now) {
    const realDt = Math.min(0.05, (now - last) / 1000); last = now;
    let simDt = realDt;
    if (hitStop > 0) { hitStop -= realDt; simDt = realDt * 0.12; }
    if (phase === 'rolling' && sim && !replay) {
      const up = sim.pins.filter(p => p.standing && !p.gone && !p.cleared);
      const down = sim.pins.filter(p => !p.standing && !p.counted).length;
      const ballsBy = sim.balls.every(b => b.gone || b.z > C.ZH + 6 || b.gutter);
      const teeter = up.filter(p => p.wob > 0.28 || p.fallAt);
      if (!tension && ballsBy && down >= 3 && up.length >= 1 && up.length <= 2 && teeter.length) {
        tension = { t: 0, beat: 0, pins: teeter.map(p => p.n) };
        R.tension = 1;
      }
      if (tension) {
        tension.t += realDt; tension.beat -= realDt;
        if (tension.beat <= 0) { sfx.heart(); GK.haptic('light'); tension.beat = 0.55; }
        const still = sim.pins.filter(p => tension.pins.includes(p.n) && p.standing && !p.gone);
        const calm = still.every(p => p.wob < 0.06 && !p.fallAt);
        if (still.length < tension.pins.length || tension.t > 2.6 || calm) {
          const fell = tension.pins.length - still.length;
          if (fell) { sfx.roar(); R.shake = 6; R.flash = 0.3; sim.pins.filter(p => tension.pins.includes(p.n) && !p.standing).forEach(p => { R.burst(p.x, p.z, '#ffd447', 14, 60); R.pop(p.x, p.z, 26, 'DOWN!', '#ffd447'); }); cheer('cheer'); }
          else { sfx.taunt(); still.forEach(p => R.pop(p.x, p.z, 28, 'NOPE', '#ff5a6e')); cheer('groan'); }
          tension = null; R.tension = 0;
        } else simDt *= 0.3;
      }
    } else if (tension) { tension = null; R.tension = 0; }
    if (replay) {
      replay.t += realDt * replay.speed;
      while (replay.i < replay.frames.length - 1 && replay.frames[replay.i + 1].time <= replay.t) replay.i++;
      if (replay.i >= replay.frames.length - 1 && !replay.ending) { replay.ending = true; setTimeout(endReplay, 300); }
    } else if (sim) {
      if (phase === 'rolling') {
        acc += simDt; let n = 0;
        while (acc >= GK.DT && n < 40) { sim.step(GK.DT); acc -= GK.DT; n++; if (!sim.rolling) break; }
        sfx.roll(GK.clamp((sim.fastest || 0) / 450, 0, 1));
        const lc = run.rs.cur ? GK.liveChips(run.rs.cur.rolls, sim) : 0, el = $('chips');
        if (el.textContent !== fmt(lc)) { el.textContent = fmt(lc); UI.bump($('chipsBox')); }
        if (recFrames.length < 900) recFrames.push(snapSim(sim));
        const mb = sim.balls.find(b => b.kind === 'main' && !b.gone && !(b.delay > 0));
        if (mb && (!curPath.length || Math.abs(mb.z - curPath[curPath.length - 1].z) > 3)) curPath.push({ x: mb.x, z: mb.z });
        if (!sim.rolling) { acc = 0; if (curPath.length > 2) lastPath = curPath; curPath = []; onRollEnd(); }
      } else sim.time += realDt;
      for (const p of sim.pins) {
        if (p.drop < 1) p.drop = Math.min(1, p.drop + realDt * 3.5);
        if (p.cleared) p.clearT += realDt;
        if (phase !== 'rolling' && p.fallen && p.fallT < 0.3) p.fallT += realDt;
      }
      if (phase !== 'rolling') { sim.updatePosts(); for (const f of sim.fx) f.t += realDt; sim.fx = sim.fx.filter(f => f.t < 0.6); }
    }
    if (phase === 'aim' && step === 'pos') { aimX = posNow(); $('sneedle').style.left = ((aimX / aimLim() + 1) * 50) + '%'; }
    if (phase === 'aim' && step === 'angle') { aimAng = angNow(); $('sneedle').style.left = ((aimAng / angLim() + 1) * 50) + '%'; }
    if (phase === 'aim' && step === 'power') $('pneedle').style.left = (powerNow() * 100) + '%';
    if (phase === 'aim' && step === 'hook') $('hneedle').style.left = ((dialNow() + 1) * 50) + '%';
    crowd.t += realDt; if (crowd.mood !== 'idle' && crowd.t > 2.4) crowd = { mood: 'idle', t: 0 };
    if (tv) { tv.t += realDt; if (tv.t > 3.4) tv = null; }
    if (tvBig) {
      tvBig.t += realDt;
      const c = document.getElementById('tvBig');
      if (c) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); GK.drawTVScene(g, c.width, c.height, lastTv && lastTv.kind, lastTv ? tvBig.t % 3.4 : 0, lastTv && lastTv.v, R.theme); }
      else tvBig = null;
    }
    R.tick(realDt);
    R.drawMini($('mini'), { sim: replay ? null : sim, live: phase === 'rolling' ? curPath : null, last: lastPath });
    const rs = run && run.rs;
    const thrown = rs && rs.cur && rs.cur.ball && phase !== 'aim' ? rs.cur.ball : null;
    const b = run && run.bag[sel];
    const wide = run ? GK.flags(run, rs ? rs.stolen : -1).wide : 1;
    const rp = replay && replay.frames[replay.i];
    R.draw({
      sim: rp || sim, replay: !!rp, crowd, tv,
      ret: run && run.rs && !rp ? { balls: run.bag, sel, stuck: run.rs.stuck && run.bag.length > 1 ? run.rs.stuck.idx : -1, inPlay: phase === 'rolling' && run.rs.cur ? run.rs.cur.ballIdx : -1 } : null,
      phase: rp ? 'replay' : phase, aimX, aimAng, step, time: now / 1000,
      boards: !rp && phase === 'aim' && step === 'pos' && run && GK.equipMods(run).boards,
      party: !rp && !bonus && rs && rs.cur && rs.cur.laneEvent === 'party',
      hookPreview: !rp && phase === 'aim' && step === 'hook' && run && GK.equipMods(run).preview ? dialNow() : null,
      clearOil: !!(run && GK.equipMods(run).clearOil),
      preview: rp && replay.rec.preview ? { type: replay.rec.preview.type, ed: replay.rec.preview.ed, r: C.BALL_R } : thrown ? { type: thrown.type, ed: thrown.ed, r: C.BALL_R * wide } : b ? { type: b.type, ed: b.ed, r: (b.type === 'cluster' ? 2.3 : C.BALL_R) * wide } : null,
      fog: !rp && run && laneOf().fog,
      dark: rp ? replay.rec.dark : run && laneOf().dark, strobe: !rp && rs && rs.boss === 'strobe', glow: rp ? replay.rec.glow : glow,
      tilt: rs && rs.boss === 'ringmaster' ? rs.tilts[rs.frameIdx % rs.tilts.length] : 0
    });
    requestAnimationFrame(loop);
  }

  // ---------- boot ----------
  R.setTheme(GK.ALLEYS[0], C.LHW, C.GUT);
  R.setCosmetics(GK.cosmeticsOn(meta));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!run) R.buildStatic(); });
  fit();
  title();
  requestAnimationFrame(loop);
  // No service worker inside the Android app: the APK already ships every file, and a cache could serve stale files after an update.
  if (!window.Capacitor && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/[?&]nosw\b/.test(location.search)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
