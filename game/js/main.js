// Gutter Kings — game controller: input, the frame loop, scoring animation, screens flow.
'use strict';
(function () {
  const GK = window.GK, UI = GK.UI, $ = UI.$, C = GK.C, fmt = GK.fmt, sfx = GK.sfx;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let run = null, sim = null, phase = 'menu', sel = 0, aimX = 0, gesture = null;
  let glow = null, fast = false, hitStop = 0, busyToken = 0;
  let meta = GK.meta();
  GK._meta = meta;
  sfx.setMuted(!!meta.muted);
  // Replays: frames recorded while a roll plays, so strikes and the best frame can be shown again.
  let recFrames = [], lastRec = null, bestReplay = null, replay = null, crowd = { mood: 'idle', t: 0 }, tv = null;
  try { fast = localStorage.getItem('gk-fast') === '1'; } catch (e) {}

  const cv = $('lane');
  const R = new GK.Renderer(cv);
  GK.debug = { get run() { return run; }, get sim() { return sim; }, get phase() { return phase; } };

  // ---------- sizing ----------
  function fit() {
    const r = $('stage').getBoundingClientRect();
    // Integer scaling in device pixels keeps the pixel art crisp (no moiré on the boards).
    const dpr = window.devicePixelRatio || 1;
    let s = Math.min(r.width / C.W, r.height / C.H);
    const si = Math.floor(s * dpr) / dpr;
    if (si >= s * 0.82) s = si;
    $('lanebox').style.width = Math.floor(C.W * s) + 'px';
    $('lanebox').style.height = Math.floor(C.H * s) + 'px';
  }
  new ResizeObserver(fit).observe($('stage'));
  window.addEventListener('resize', fit);

  // ---------- view helpers ----------
  const laneOf = () => GK.laneFor(run);
  function themeRound() {
    const def = GK.alleyDef(run), L = laneOf();
    R.setTheme(def, L.lhw || C.LHW, L.magnet ? 12 : C.GUT, L.oil);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (run) R.buildStatic(); });
  }
  function refresh() {
    if (!run) return;
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
  const newRunScreen = () => UI.bagSelect(meta, o => startRun(o), title);
  function title() {
    phase = 'menu'; run = null; sim = null; replay = null;
    UI.hideModal();
    UI.title(meta, saveDesc(GK.load()), {
      continue: () => { const s = GK.load(); if (s) resume(s); },
      new: newRunScreen,
      daily: () => startRun({ bag: 'classic', seed: GK.dailySeed(), daily: true }),
      how: () => UI.how(),
      collection: () => UI.collection(meta),
      sound: el => { sfx.init(); sfx.setMuted(!sfx.muted); meta.muted = sfx.muted; GK.saveMeta(meta); el.textContent = sfx.muted ? 'Sound off' : 'Sound on'; }
    });
  }
  function startRun(o) {
    sfx.init();
    run = GK.newRun(o);
    meta.runs++; GK.saveMeta(meta);
    sel = 0; bestReplay = null;
    toIntro();
  }
  function resume(s) {
    sfx.init();
    run = s; sel = 0; bestReplay = null;
    if (run.phase === 'shop' && run.shop) { themeRound(); showShop(); return; }
    if (run.phase === 'round' && run.rs && (run.rs.frameIdx > 0 || run.rs.total > 0)) {
      themeRound(); UI.hideLayer(); beginFrame(); return;
    }
    toIntro();
  }

  function toIntro() {
    GK.startRound(run);
    GK.save(run);
    themeRound();
    sim = null; resetTally(); setPhase('intro');
    UI.shot(GK.roundName(run) + ' · target ' + fmt(run.rs.target));
    if (GK.isBoss(run)) sfx.boss();
    UI.intro(run, () => { UI.hideLayer(); beginFrame(); UI.banner(GK.roundName(run).toUpperCase(), 'Target ' + fmt(run.rs.target), 1300); });
  }

  // ---------- frames ----------
  function beginFrame() {
    GK.save(run);
    sim = GK.beginFrame(run);
    sim.onEvent = onSimEvent;
    R.setWear(run.rs.wear);
    pickGlow();
    step = 'pos';
    resetTally();
    const rs = run.rs;
    UI.shot('Frame ' + (rs.frameIdx + 1) + ' · line up your shot');
    if (rs.loadedNext) UI.toast('Loaded Ball: this frame gets ×3 Mult');
    if (rs.boss === 'bookie' && rs.cur.bet) UI.toast('The Bookie takes ' + GK.money(rs.cur.bet) + ' as a bet');
    if (rs.boss === 'ringmaster') UI.toast('The lane tilts ' + (rs.tilts[rs.frameIdx % rs.tilts.length] > 0 ? 'right' : 'left'));
    if (rs.boss === 'astronaut') UI.toast('The rack respawned somewhere new');
    setPhase(GK.needsCall(run) ? 'call' : 'aim');
  }
  function pickGlow() {
    glow = null;
    if (!laneOf().dark || !sim) return;
    const rng = GK.stream(run.seed, 'glow:' + run.alley + ':' + run.round + ':' + run.rs.frameIdx + ':' + run.stats.throws);
    glow = new Set(rng.shuffle(sim.pins.map(p => p.n)).slice(0, 4));
  }

  document.querySelectorAll('#callbar [data-call]').forEach(b => b.addEventListener('click', () => {
    if (phase !== 'call') return;
    run.rs.cur.call = b.dataset.call;
    UI.toast('Called: ' + b.textContent);
    setPhase('aim');
  }));

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
    GK.launch(run, sim, sel, prm);
    hitStop = 0; step = 'pos'; recFrames = [];
    UI.shot(GK.BALLS[b.type].full + ' away');
    setPhase('rolling');
  }

  function onSimEvent(e) {
    switch (e.t) {
      case 'clack': sfx.clack(e.v); break;
      case 'first': hitStop = 0.07; R.shake = Math.min(4, R.shake + 2); break;
      case 'down':
        if (e.by === 'pin') R.pop(e.x, e.z, 18, '+3', '#39c6d6');
        else if (e.by === 'late') R.pop(e.x, e.z, 18, '+4 late', '#39c6d6');
        if (e.type === 'gold') { R.pop(e.x + 3, e.z, 26, '+$1', '#f2c94c'); sfx.coin(); }
        if (e.type === 'glass') sfx.shatter();
        if (run && sim.roll && sim.roll.ball === 'feather' && e.by === 'pin') R.pop(e.x + 3, e.z, 26, '+2 mult', '#ff5a6e');
        break;
      case 'gutter': if (e.main) { sfx.gutter(); if (e.early) R.pop(e.x, e.z, 10, 'GUTTER', '#ff5a6e'); } break;
      case 'explode': sfx.boom(); R.shake = 7; R.flash = 0.6; R.burst(e.x, e.z, '#ffd447', 14, 70); break;
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
    }
  }

  async function onRollEnd() {
    setPhase('busy');
    sfx.roll(0);
    const token = ++busyToken;
    const out = GK.afterRoll(run, sim);
    lastRec = { frames: recFrames, alley: run.alley, champ: GK.isChamp(run), lane: laneOf(), def: GK.alleyDef(run), preview: run.rs.cur && run.rs.cur.ball, glow, dark: laneOf().dark };
    recFrames = [];
    UI.card(run); refresh();
    R.setWear(run.rs.wear);
    if (out.rec.perfect === true) { R.pop(aimX, 20, 18, 'GROOVE ×' + run.rs.groove, '#7be38a'); feats({ t: 'throw', streak: run.stats.pstreak, run }); }
    for (const n of out.notes) {
      UI.toast(n.text, 1800);
      if (n.t === 'shatter') { sfx.shatter(); sel = Math.min(sel, run.bag.length - 1); }
      if (n.t === 'mechanic') { R.pop(0, C.ZH + 12, 30, 'THE MECHANIC RESETS ' + n.pins.length, '#ff5a6e'); sfx.crack(); }
      if (n.t === 'split') UI.shot(n.text);
      if (n.t === 'pay') sfx.coin();
      if (n.t === 'stuck') { sfx.nope(); R.pop(12, -20, 20, 'JAMMED!', '#ff5a6e'); }
      if (n.t === 'unstuck') sfx.tick(660);
      if (n.t === 'respot') { sfx.crack(); R.pop(0, C.ZH + 10, 34, 'PINSETTER FUMBLE!', '#ffd447'); R.shake = 3; }
    }
    if (out.rec.gutterBall) cheer('groan');
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
  function endReplay() {
    if (!replay) return;
    const d = replay.done; replay = null; UI.hideBanner();
    if (phase === 'replay') phase = 'busy';
    d();
  }
  function cheer(mood) { crowd = { mood, t: 0 }; }
  function tvShow(kind, leave710) {
    const k = kind === 'split' ? (leave710 ? 'seven10' : 'split') : kind;
    if (!['strike', 'double', 'turkey', 'spare', 'split', 'seven10'].includes(k)) return;
    tv = { kind: k, t: 0, v: Math.floor(Math.random() * 2) };
  }

  const stepText = st => st.op === 'chips' ? '+' + fmt(st.v) + ' Points' : st.op === 'mult' ? '+' + (Math.round(st.v * 10) / 10) + ' Mult' : st.op === 'xmult' ? '×' + (Math.round(st.v * 100) / 100) + ' Mult' : st.op === 'money' ? '+$' + st.v : '';
  const stepCol = st => st.op === 'chips' ? '#39c6d6' : st.op === 'money' ? '#f2c94c' : '#ff5a6e';

  // token: if the player quits (or a debug jump happens) mid-animation, stop touching the run.
  async function scoreFrame(kind, token) {
    const rs = run.rs, s = GK.SHOTS[kind];
    const live = () => token === busyToken && run && run.rs === rs;
    const res = GK.scoreCurrent(run, kind);
    if (GK.isStrikeKind(kind)) { R.shake = 6; sfx.strike(); R.flash = 0.35; }
    else if (GK.isSpareKind(kind)) sfx.spare();
    tvShow(kind, res.ctx.leave710);
    const pinsSum = rs.cur.rolls.reduce((a, r) => a + r.pins, 0);
    UI.banner(s.name.toUpperCase(), kind === 'open' ? pinsSum + ' pins' : '');
    const d = fast ? 120 : 260;
    await sleep(fast ? 250 : 450); if (!live()) return;
    let n = 0;
    for (const st of res.steps) {
      if (st.op === 'set') { UI.tally(st.chips, st.mult, null); UI.shot(st.label); UI.bump($('chipsBox')); UI.bump($('multBox')); sfx.tick(440); await sleep(d); if (!live()) return; continue; }
      UI.tally(st.chips, st.mult, null);
      const txt = stepText(st);
      UI.shot(st.label + (txt ? ' · ' + txt : ''));
      if (st.src === 'charm') UI.fireCharm(st.idx, txt || st.label, stepCol(st));
      if (st.op === 'chips') { UI.bump($('chipsBox')); sfx.chip(n); }
      else if (st.op === 'mult') { UI.bump($('multBox')); sfx.mult(n); }
      else if (st.op === 'xmult') { UI.bump($('multBox')); sfx.xmult(); }
      else if (st.op === 'money') { sfx.coin(); }
      else if (st.op === 'zero') { UI.bump($('eqBox')); sfx.nope(); }
      n++;
      await sleep(d); if (!live()) return;
    }
    UI.tally(res.chips, res.mult, res.score); UI.bump($('eqBox')); sfx.tick(880);
    UI.shot(s.name + ' · ' + fmt(res.chips) + ' × ' + (Math.round(res.mult * 100) / 100) + ' = ' + fmt(res.score));
    await sleep(fast ? 200 : 380); if (!live()) return;
    const start = rs.total;
    const out = GK.commitFrame(run, kind, res);
    if (run.best && run.best.score === res.score && run.best.frame === rs.frameIdx - 1) bestReplay = lastRec;
    feats({ t: 'frame', kind, score: res.score, ctx: res.ctx, leave710: res.ctx.leave710, run });
    if (kind === 'turkey' || kind === 'double') cheer('cheer'); else if (GK.isSpareKind(kind)) cheer('clap'); else if (kind === 'gutter') cheer('groan');
    for (let i = 1; i <= 8; i++) { $('score').firstChild.textContent = fmt(start + res.score * i / 8); await sleep(30); if (!live()) return; }
    if (res.score > meta.bestFrame) { meta.bestFrame = res.score; GK.saveMeta(meta); }
    refresh();
    for (const nt of out.notes) UI.toast(nt.text, 1800);
    await sleep(fast ? 250 : 450); if (!live()) return;
    UI.hideBanner();
    if (out.status === 'won') return roundWon();
    if (out.status === 'lost') return roundLost();
    beginFrame();
  }

  // Check feats against an event; announce and save anything newly unlocked.
  function feats(ev) {
    const got = GK.checkFeats(meta, ev);
    if (!got.length) return;
    GK.saveMeta(meta);
    got.forEach((f, i) => setTimeout(() => {
      UI.toast('Feat: ' + f.name + ' · Unlocked ' + f.unlocks.map(GK.unlockName).join(', '), 2600);
      sfx.win();
    }, i * 2700));
  }

  function bumpMeta() {
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
    const score = run.rs.total;
    UI.banner('ROUND CLEARED', fmt(score), 1400);
    const lines = GK.payout(run);
    GK.applyPayout(run, lines);
    const payRun = JSON.parse(JSON.stringify(run));
    feats({ t: 'round', boss: run.rs.boss, run });
    const nxt = GK.advance(run);
    if (nxt === 'won') {
      meta.wins++;
      meta.maxAsc = Math.max(meta.maxAsc || 0, Math.min(GK.MAX_ASC, (run.asc || 0) + 1));
      feats({ t: 'run', won: true, run });
      bumpMeta(); GK.clearSave();
      setPhase('menu');
      const tk = busyToken;
      setTimeout(() => tk === busyToken && showEnd(true), 900);
      return;
    }
    feats({ t: 'reach', run });
    bumpMeta();
    GK.openShop(run);
    GK.save(run);
    setPhase('menu');
    const tk = busyToken;
    setTimeout(() => tk === busyToken && UI.payout(payRun, lines, score, showShop), 700);
  }
  function roundLost() {
    sfx.lose();
    run.over = true; bumpMeta(); GK.clearSave();
    setPhase('menu');
    UI.banner('RUN OVER', fmt(run.rs.total) + ' / ' + fmt(run.rs.target), 1500);
    const tk = busyToken;
    setTimeout(() => tk === busyToken && showEnd(false), 1200);
  }
  function showEnd(won) {
    UI.end(run, won, meta, {
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
        UI.detail(UI.info('ball', b.type, b.ed), [
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
    }
  }

  // ---------- consumables ----------
  function tapCons(i) { if (phase === 'aim') consDetail(i, true); }
  function consDetail(i, inRound) {
    const id = run.cons[i], k = GK.CONS[id];
    const done = r => {
      UI.hideModal();
      if (!r.ok) { sfx.nope(); if (r.msg) UI.toast(r.msg); return; }
      sfx.buy(); UI.toast(r.msg || 'Used', 2000);
      if (k.target === 'pin' && inRound) UI.toast(r.msg + ' (from next frame)', 2200);
      GK.save(run);
      if (inRound) refresh(); else showShop();
    };
    const use = () => {
      if (k.inRound && !inRound) { UI.hideModal(); sfx.nope(); return UI.toast('Use this during a round.'); }
      if (k.target === 'pin') return UI.pinPicker(run, k, picks => done(GK.useCons(run, i, picks, inRound)), UI.hideModal);
      if (k.target === 'ball') return UI.ballPicker(run, k.name, k.desc, bi => done(GK.useCons(run, i, bi, inRound)), UI.hideModal);
      done(GK.useCons(run, i, null, inRound));
    };
    UI.detail(UI.info('cons', id), [
      { label: 'Use', fn: use, disabled: k.inRound && !inRound },
      { label: 'Sell for $' + Math.max(1, Math.floor(k.cost / 2)), fn: () => { GK.sellCons(run, i); sfx.coin(); UI.hideModal(); GK.save(run); if (inRound) refresh(); else showShop(); }, cls: 'danger' },
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
      title: () => { busyToken++; if (run && !run.over && !run.won) GK.save(run); UI.hideLayer(); title(); },
      abandon: () => {
        UI.detail({ name: 'Abandon run?', k: 'Are you sure', desc: 'This run will end and its save will be deleted.', col: '#ff5a6e' }, [
          { label: 'Abandon', cls: 'danger', fn: () => { busyToken++; run.over = true; bumpMeta(); GK.clearSave(); UI.hideLayer(); title(); } },
          { label: 'Keep playing', cls: 'alt', fn: UI.hideModal }
        ]);
      }
    });
  });

  // ---------- input: 1) slide to set the start, 2) set the angle, 3) time the power bar ----------
  // Drag on the lane adjusts the current step; a tap (or the Set button / Space) locks it in.
  // On the power step the bar sweeps up and down and the tap that stops it throws the ball.
  // Four steps: start spot → angle → power bar → hook dial. The last tap throws.
  // Tuned to be demanding: the power bar sweeps fast and the PERFECT zone is narrow.
  let step = 'pos', aimAng = 0, powerT0 = 0, dialT0 = 0, lockedPower = null;
  const PZONE = [0.83, 0.89], POWER_PERIOD = 0.8, DIAL_PERIOD = 0.7;
  function pickBall(i) {
    if (!run || !run.bag[i]) return;
    if (GK.isStuck(run, i)) { sfx.nope(); UI.toast(GK.BALLS[run.bag[i].type].full + ' is stuck in the ball return. Throw another ball first.'); return; }
    sel = i; sfx.tick(760); refresh();
  }
  function rectInfo() { const r = cv.getBoundingClientRect(); return { r, k: r.width / C.W }; }
  function pt(e) { const { r } = rectInfo(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }
  const aimLim = () => C.LHW - C.BALL_R - 0.5 - (C.LHW - (laneOf().lhw || C.LHW));
  const angLim = () => 0.085 * Math.max(1, GK.equipMods(run).aim);
  function zone() {
    const eq = GK.equipMods(run), mid = (PZONE[0] + PZONE[1]) / 2, half = (PZONE[1] - PZONE[0]) / 2 * eq.zone;
    return [mid - half, Math.min(0.99, mid + half)];
  }
  const tri = u => { u %= 2; return u < 1 ? u : 2 - u; };
  function powerNow() { return tri((performance.now() - powerT0) / 1000 / (POWER_PERIOD * GK.equipMods(run).bar)); }
  // Hook dial: -1 (hard left) .. +1 (hard right), starting from the centre.
  function dialNow() { return tri((performance.now() - dialT0) / 1000 / (DIAL_PERIOD * GK.equipMods(run).dial) + 0.5) * 2 - 1; }
  const STEP_TEXT = {
    pos: ['1 · Drag to set your start', 'Set start'],
    angle: ['2 · Drag to set the angle', 'Set angle'],
    power: ['3 · Tap to stop the power bar', 'Set power'],
    hook: ['4 · Tap to set your hook', 'Throw!']
  };
  function setStep(s2) {
    step = s2;
    if (s2 === 'power') powerT0 = performance.now();
    if (s2 === 'hook') dialT0 = performance.now();
    syncCtrl();
  }
  function syncCtrl() {
    const on = phase === 'aim';
    $('ctrl').classList.toggle('off', !on);
    $('stepLbl').textContent = on ? STEP_TEXT[step][0] : phase === 'call' ? 'Call your shot first' : phase === 'rolling' ? 'Rolling…' : phase === 'replay' ? 'Replay · tap to skip' : '';
    $('setBtn').textContent = STEP_TEXT[step][1];
    $('setBtn').disabled = !on; $('backBtn').disabled = !on || step === 'pos';
    $('pbar').hidden = !(on && step === 'power');
    $('hbar').hidden = !(on && step === 'hook');
    $('stepLbl').hidden = on && (step === 'power' || step === 'hook');
    const z = zone();
    $('pzone').style.left = z[0] * 100 + '%'; $('pzone').style.width = (z[1] - z[0]) * 100 + '%';
    const g = run && run.rs ? run.rs.groove || 0 : 0;
    $('grooveLbl').hidden = !g; $('grooveLbl').textContent = '♪ ' + g;
  }
  function confirmStep() {
    if (phase !== 'aim') return;
    sfx.init();
    if (step === 'pos') { setStep('angle'); sfx.tick(520); }
    else if (step === 'angle') { setStep('power'); sfx.tick(660); }
    else if (step === 'power') lockPower();
    else releaseHook();
  }
  function backStep() {
    if (phase !== 'aim') return;
    if (step === 'hook') setStep('power'); else if (step === 'power') setStep('angle'); else if (step === 'angle') setStep('pos');
  }
  function lockPower() {
    const p = powerNow(), z = zone();
    let label;
    if (p >= z[0] && p <= z[1]) { label = 'PERFECT!'; sfx.coin(); }
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
    throwBall({ aimX, aim, spin: GK.clamp(spin, -1.2, 1.2), speed, power: lp.p, perfect: lp.perfect });
  }

  cv.addEventListener('pointerdown', e => {
    sfx.init();
    if (phase === 'replay') { e.preventDefault(); endReplay(); return; }
    if (phase !== 'aim') return;
    if (step === 'power' || step === 'hook') { e.preventDefault(); confirmStep(); return; }
    {
      const rr = cv.getBoundingClientRect(), bx = (e.clientX - rr.left) / rr.width * C.W, by = (e.clientY - rr.top) / rr.height * C.H;
      const hit = R.returnHit(bx, by);
      if (hit >= 0) { e.preventDefault(); pickBall(hit); return; }
    }
    cv.setPointerCapture(e.pointerId);
    const p = pt(e);
    gesture = { moved: false, x0: p.x, y0: p.y, aim0: aimX, ang0: aimAng };
  });
  cv.addEventListener('pointermove', e => {
    if (!gesture || phase !== 'aim') return;
    const p = pt(e), dx = p.x - gesture.x0;
    if (!gesture.moved && Math.abs(dx) < 4) return;
    gesture.moved = true;
    const { k, r } = rectInfo();
    if (step === 'pos') {
      const L = aimLim();
      aimX = GK.clamp(gesture.aim0 + dx / (k * C.S0 * GK.sc(C.BALL_Z0)), -L, L);
    } else if (step === 'angle') {
      const lim = angLim();
      aimAng = GK.clamp(gesture.ang0 + dx / r.width * 0.25 * GK.equipMods(run).aim, -lim, lim);
    }
  });
  cv.addEventListener('pointerup', () => { if (gesture && !gesture.moved) confirmStep(); gesture = null; });
  cv.addEventListener('pointercancel', () => { gesture = null; });
  $('setBtn').addEventListener('pointerdown', e => { e.preventDefault(); confirmStep(); });
  $('backBtn').addEventListener('click', backStep);
  window.addEventListener('keydown', e => {
    if (!$('modal').hidden || !$('layer').hidden) return;
    if (phase === 'replay' && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); endReplay(); return; }
    if (!run) return;
    if (phase === 'call' && ['1', '2', '3'].includes(e.key)) { document.querySelectorAll('#callbar [data-call]')[+e.key - 1].click(); return; }
    if (phase !== 'aim') return;
    const L = aimLim(), lim = angLim();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      if (step === 'pos') aimX = GK.clamp(aimX + d * 0.6, -L, L);
      else if (step === 'angle') aimAng = GK.clamp(aimAng + d * 0.004, -lim, lim);
      e.preventDefault();
    }
    else if (/^[1-9]$/.test(e.key) && +e.key <= run.bag.length) pickBall(+e.key - 1);
    else if (e.key === 'r' || e.key === 'R') $('rerackBtn').click();
    else if (e.key === 'Escape' || e.key === 'Backspace') backStep();
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
  GK.debug.tv = k => tvShow(k, false);
  GK.debug.jump = (alley, round) => { busyToken++; UI.hideLayer(); UI.hideModal(); run.alley = alley; run.round = round; toIntro(); };

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  function loop(now) {
    const realDt = Math.min(0.05, (now - last) / 1000); last = now;
    let simDt = realDt;
    if (hitStop > 0) { hitStop -= realDt; simDt = realDt * 0.12; }
    if (replay) {
      replay.t += realDt * replay.speed;
      while (replay.i < replay.frames.length - 1 && replay.frames[replay.i + 1].time <= replay.t) replay.i++;
      if (replay.i >= replay.frames.length - 1 && !replay.ending) { replay.ending = true; setTimeout(endReplay, 300); }
    } else if (sim) {
      if (phase === 'rolling') {
        acc += simDt; let n = 0;
        while (acc >= GK.DT && n < 40) { sim.step(GK.DT); acc -= GK.DT; n++; if (!sim.rolling) break; }
        sfx.roll(GK.clamp((sim.fastest || 0) / 450, 0, 1));
        const lc = GK.liveChips(run.rs.cur.rolls, sim), el = $('chips');
        if (el.textContent !== fmt(lc)) { el.textContent = fmt(lc); UI.bump($('chipsBox')); }
        if (recFrames.length < 900) recFrames.push(snapSim(sim));
        if (!sim.rolling) { acc = 0; onRollEnd(); }
      } else sim.time += realDt;
      for (const p of sim.pins) {
        if (p.drop < 1) p.drop = Math.min(1, p.drop + realDt * 3.5);
        if (p.cleared) p.clearT += realDt;
        if (phase !== 'rolling' && p.fallen && p.fallT < 0.3) p.fallT += realDt;
      }
      if (phase !== 'rolling') { sim.updatePosts(); for (const f of sim.fx) f.t += realDt; sim.fx = sim.fx.filter(f => f.t < 0.6); }
    }
    if (phase === 'aim' && step === 'power') $('pneedle').style.left = (powerNow() * 100) + '%';
    if (phase === 'aim' && step === 'hook') $('hneedle').style.left = ((dialNow() + 1) * 50) + '%';
    crowd.t += realDt; if (crowd.mood !== 'idle' && crowd.t > 2.4) crowd = { mood: 'idle', t: 0 };
    if (tv) { tv.t += realDt; if (tv.t > 3.4) tv = null; }
    R.tick(realDt);
    const rs = run && run.rs;
    const thrown = rs && rs.cur && rs.cur.ball && phase !== 'aim' ? rs.cur.ball : null;
    const b = run && run.bag[sel];
    const wide = run ? GK.flags(run, rs ? rs.stolen : -1).wide : 1;
    const rp = replay && replay.frames[replay.i];
    R.draw({
      sim: rp || sim, replay: !!rp, crowd, tv,
      ret: run && run.rs && !rp ? { balls: run.bag, sel, stuck: run.rs.stuck && run.bag.length > 1 ? run.rs.stuck.idx : -1, inPlay: phase === 'rolling' && run.rs.cur ? run.rs.cur.ballIdx : -1 } : null,
      phase: rp ? 'replay' : phase, aimX, aimAng, step, time: now / 1000,
      preview: rp && replay.rec.preview ? { type: replay.rec.preview.type, ed: replay.rec.preview.ed, r: C.BALL_R } : thrown ? { type: thrown.type, ed: thrown.ed, r: C.BALL_R * wide } : b ? { type: b.type, ed: b.ed, r: (b.type === 'cluster' ? 2.3 : C.BALL_R) * wide } : null,
      dark: rp ? replay.rec.dark : run && laneOf().dark, strobe: !rp && rs && rs.boss === 'strobe', glow: rp ? replay.rec.glow : glow,
      tilt: rs && rs.boss === 'ringmaster' ? rs.tilts[rs.frameIdx % rs.tilts.length] : 0
    });
    requestAnimationFrame(loop);
  }

  // ---------- boot ----------
  R.setTheme(GK.ALLEYS[0], C.LHW, C.GUT);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!run) R.buildStatic(); });
  fit();
  title();
  requestAnimationFrame(loop);
  // No service worker inside the Android app: the APK already ships every file, and a cache could serve stale files after an update.
  if (!window.Capacitor && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/[?&]nosw\b/.test(location.search)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
