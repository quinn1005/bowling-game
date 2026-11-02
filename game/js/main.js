// Gutter Kings — game controller: input, the frame loop, scoring animation, screens flow.
'use strict';
(function () {
  const GK = window.GK, UI = GK.UI, $ = UI.$, C = GK.C, fmt = GK.fmt, sfx = GK.sfx;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let run = null, sim = null, phase = 'menu', sel = 0, aimX = 0, guide = null, gesture = null, snakePath = null;
  let glow = null, fast = false, hintShown = false, hitStop = 0, busyToken = 0;
  let meta = GK.meta();
  sfx.setMuted(!!meta.muted);
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
    R.setTheme(def, L.lhw || C.LHW, L.magnet ? 12 : C.GUT);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (run) R.buildStatic(); });
  }
  function refresh() {
    if (!run) return;
    UI.hud(run); UI.charms(run, tapCharm); UI.card(run);
    sel = Math.min(sel, run.bag.length - 1);
    const canAct = phase === 'aim';
    UI.bag(run, sel, canAct, i => { sel = i; refresh(); });
    UI.cons(run, canAct, tapCons);
    UI.rule(run, sel);
    $('rerackBtn').disabled = !(canAct && GK.canRerack(run));
    $('callbar').hidden = phase !== 'call';
  }
  function setPhase(p) { phase = p; refresh(); }
  function resetTally() { UI.tally(null, null, null); }

  // ---------- title / run start ----------
  function saveDesc(s) {
    if (!s) return null;
    const where = s.alley >= GK.ALLEY_COUNT ? 'Championship' : 'Alley ' + (s.alley + 1) + ' · ' + GK.ROUND_NAMES[s.round];
    return where + ' · ' + GK.money(s.money) + (s.daily ? ' · daily' : '');
  }
  function title() {
    phase = 'menu'; run = null; sim = null;
    UI.hideModal();
    UI.title(meta, saveDesc(GK.load()), {
      continue: () => { const s = GK.load(); if (s) resume(s); },
      new: () => UI.bagSelect((bag, seed) => startRun({ bag, seed }), title),
      daily: () => startRun({ bag: 'classic', seed: GK.dailySeed(), daily: true }),
      how: () => UI.how(),
      sound: el => { sfx.init(); sfx.setMuted(!sfx.muted); meta.muted = sfx.muted; GK.saveMeta(meta); el.textContent = sfx.muted ? 'Sound off' : 'Sound on'; }
    });
  }
  function startRun(o) {
    sfx.init();
    run = GK.newRun(o);
    meta.runs++; GK.saveMeta(meta);
    sel = 0; hintShown = true;
    toIntro();
  }
  function resume(s) {
    sfx.init();
    run = s; sel = 0;
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
    pickGlow();
    aimX = 0; guide = null; snakePath = null;
    resetTally();
    $('hint').hidden = !hintShown;
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
    glow = new Set(rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4));
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
    if (b.type === 'snake' && !prm.path) prm.path = [{ z: 0, x: prm.aimX }, { z: 300, x: prm.aimX + Math.tan(prm.aim) * 300 }];
    GK.launch(run, sim, sel, prm);
    if (hintShown) { hintShown = false; $('hint').hidden = true; }
    guide = null; snakePath = null; hitStop = 0;
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
    }
  }

  async function onRollEnd() {
    setPhase('busy');
    sfx.roll(0);
    const token = ++busyToken;
    const out = GK.afterRoll(run, sim);
    UI.card(run);
    for (const n of out.notes) {
      UI.toast(n.text, 1800);
      if (n.t === 'shatter') { sfx.shatter(); sel = Math.min(sel, run.bag.length - 1); }
      if (n.t === 'mechanic') { R.pop(0, C.ZH + 12, 30, 'THE MECHANIC RESETS ' + n.pins.length, '#ff5a6e'); sfx.crack(); }
      if (n.t === 'split') UI.shot(n.text);
    }
    if (out.next === 'aim') {
      await sleep(650);
      if (token !== busyToken || !run) return;
      UI.shot(out.notes.some(n => n.t === 'retake') ? 'Retake your shot' : 'Roll ' + (run.rs.cur.rollIdx + 1) + ' · pick up the spare');
      setPhase('aim');
      return;
    }
    await scoreFrame(out.kind, token);
  }

  const stepText = st => st.op === 'chips' ? '+' + fmt(st.v) + ' Chips' : st.op === 'mult' ? '+' + (Math.round(st.v * 10) / 10) + ' Mult' : st.op === 'xmult' ? '×' + (Math.round(st.v * 100) / 100) + ' Mult' : st.op === 'money' ? '+$' + st.v : '';
  const stepCol = st => st.op === 'chips' ? '#39c6d6' : st.op === 'money' ? '#f2c94c' : '#ff5a6e';

  // token: if the player quits (or a debug jump happens) mid-animation, stop touching the run.
  async function scoreFrame(kind, token) {
    const rs = run.rs, s = GK.SHOTS[kind];
    const live = () => token === busyToken && run && run.rs === rs;
    const res = GK.scoreCurrent(run, kind);
    if (GK.isStrikeKind(kind)) { R.shake = 6; sfx.strike(); R.flash = 0.35; }
    else if (GK.isSpareKind(kind)) sfx.spare();
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

  function bumpMeta() {
    const reached = GK.isChamp(run) ? 9 : run.alley + 1;
    meta.bestAlley = Math.max(meta.bestAlley, run.won ? 9 : reached);
    if (run.daily) {
      const key = GK.dailySeed(), label = run.won ? 'Champion' : (GK.isChamp(run) ? 'Champ' : 'A' + (run.alley + 1) + ' R' + (run.round + 1));
      const prev = meta.daily[key];
      const rank = l => l === 'Champion' ? 999 : l === 'Champ' ? 900 : (parseInt(l.slice(1), 10) * 10 + parseInt(l.split('R')[1], 10));
      if (!prev || rank(label) > rank(prev)) meta.daily = { [key]: label };
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
    const nxt = GK.advance(run);
    if (nxt === 'won') {
      meta.wins++; bumpMeta(); GK.clearSave();
      setPhase('menu');
      const tk = busyToken;
      setTimeout(() => tk === busyToken && UI.end(run, true, () => UI.bagSelect((bag, seed) => startRun({ bag, seed }), title), title), 900);
      return;
    }
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
    setTimeout(() => tk === busyToken && UI.end(run, false, () => UI.bagSelect((bag, seed) => startRun({ bag, seed }), title), title), 1200);
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
  function rectInfo() { const r = cv.getBoundingClientRect(); return { r, k: r.width / C.W }; }
  function pt(e) { const { r } = rectInfo(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }
  const aimLim = () => C.LHW - C.BALL_R - 0.5 - (C.LHW - (laneOf().lhw || C.LHW));

  function gestureParams(pts, final) {
    const p0 = pts[0], pN = pts[pts.length - 1], dyTot = p0.y - pN.y, { r } = rectInfo();
    if (dyTot < (final ? r.height * 0.06 : 4)) return null;
    const eq = GK.equipMods(run);
    let pm = pN;
    for (const q of pts) { if (p0.y - q.y >= dyTot * 0.55) { pm = q; break; } }
    const angEarly = Math.atan2(pm.x - p0.x, Math.max(1, p0.y - pm.y));
    const angLate = pm === pN ? angEarly : Math.atan2(pN.x - pm.x, Math.max(1, pm.y - pN.y));
    const lim = 0.085 * Math.max(1, eq.aim);
    const aim = GK.clamp(angEarly * 0.16 * eq.aim, -lim, lim);
    const spin = GK.clamp((angLate - angEarly) * 1.6 * eq.spin, -1, 1);
    let pa = p0;
    for (let i = pts.length - 1; i >= 0; i--) { if (pN.t - pts[i].t > 90) { pa = pts[i]; break; } }
    const dt = Math.max(16, pN.t - pa.t);
    const hps = (pa.y - pN.y) / dt * 1000 / r.height;
    const speed = GK.clamp(170 + (hps - 0.8) * 75, 170, 470);
    return { aimX, aim, spin, speed };
  }
  function buildSnake(pts) {
    const p0 = pts[0], pN = pts[pts.length - 1], dy = p0.y - pN.y; if (dy < 8) return null;
    const { k } = rectInfo(), L = aimLim();
    const out = []; let lastZ = -1;
    for (const q of pts) {
      const z = (p0.y - q.y) / dy * 300; if (z <= lastZ) continue; lastZ = z;
      out.push({ z, x: GK.clamp(aimX + (q.x - p0.x) / (k * C.S0) * 1.4, -L - 3, L + 3) });
    }
    return out.length > 1 ? out : null;
  }

  cv.addEventListener('pointerdown', e => {
    sfx.init();
    if (phase !== 'aim') return;
    cv.setPointerCapture(e.pointerId);
    const p = pt(e);
    gesture = { mode: null, pts: [p], x0: p.x, y0: p.y, aim0: aimX };
  });
  cv.addEventListener('pointermove', e => {
    if (!gesture || phase !== 'aim') return;
    const p = pt(e); gesture.pts.push(p);
    const dx = p.x - gesture.x0, dy = p.y - gesture.y0;
    if (!gesture.mode) {
      if (dy < -10 && Math.abs(dy) > Math.abs(dx) * 0.8) gesture.mode = 'throw';
      else if (Math.abs(dx) > 8) gesture.mode = 'move';
    }
    if (gesture.mode === 'move') {
      const { k } = rectInfo(), L = aimLim();
      aimX = GK.clamp(gesture.aim0 + dx / (k * C.S0 * GK.sc(C.BALL_Z0)), -L, L);
    } else if (gesture.mode === 'throw') {
      guide = gestureParams(gesture.pts, false);
      if (run.bag[sel].type === 'snake') snakePath = buildSnake(gesture.pts);
    }
  });
  function endGesture() {
    if (!gesture) return;
    if (gesture.mode === 'throw' && phase === 'aim') {
      const pr = gestureParams(gesture.pts, true);
      if (pr) { if (run.bag[sel].type === 'snake') pr.path = buildSnake(gesture.pts); throwBall(pr); }
    }
    gesture = null; guide = null; if (phase === 'aim') snakePath = null;
  }
  cv.addEventListener('pointerup', endGesture);
  cv.addEventListener('pointercancel', () => { gesture = null; guide = null; snakePath = null; });
  window.addEventListener('keydown', e => {
    if (!$('modal').hidden || !$('layer').hidden || !run) return;
    if (phase === 'call' && ['1', '2', '3'].includes(e.key)) { document.querySelectorAll('#callbar [data-call]')[+e.key - 1].click(); return; }
    if (phase !== 'aim') return;
    const L = aimLim();
    if (e.key === 'ArrowLeft') { aimX = GK.clamp(aimX - 0.6, -L, L); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { aimX = GK.clamp(aimX + 0.6, -L, L); e.preventDefault(); }
    else if (/^[1-9]$/.test(e.key) && +e.key <= run.bag.length) { sel = +e.key - 1; refresh(); }
    else if (e.key === 'r' || e.key === 'R') $('rerackBtn').click();
    else if (e.key === ' ' || e.key === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault(); throwBall({ aimX, aim: 0, spin: e.shiftKey ? 0.5 : 0, speed: 340 });
    }
  });
  // Exposed for automated play-tests.
  GK.debug.throw = prm => throwBall(Object.assign({ aimX, aim: 0, spin: 0, speed: 340 }, prm));
  GK.debug.select = i => { sel = i; refresh(); };
  GK.debug.jump = (alley, round) => { busyToken++; UI.hideLayer(); UI.hideModal(); run.alley = alley; run.round = round; toIntro(); };

  // ---------- loop ----------
  let last = performance.now(), acc = 0;
  function loop(now) {
    const realDt = Math.min(0.05, (now - last) / 1000); last = now;
    let simDt = realDt;
    if (hitStop > 0) { hitStop -= realDt; simDt = realDt * 0.12; }
    if (sim) {
      if (phase === 'rolling') {
        acc += simDt; let n = 0;
        while (acc >= GK.DT && n < 40) { sim.step(GK.DT); acc -= GK.DT; n++; if (!sim.rolling) break; }
        sfx.roll(GK.clamp((sim.fastest || 0) / 450, 0, 1));
        const lc = GK.liveChips(run.rs.cur.rolls, sim), el = $('chips');
        if (el.textContent !== fmt(lc)) { el.textContent = fmt(lc); UI.bump($('chipsBox')); }
        if (!sim.rolling) { acc = 0; onRollEnd(); }
      } else sim.time += realDt;
      for (const p of sim.pins) {
        if (p.drop < 1) p.drop = Math.min(1, p.drop + realDt * 3.5);
        if (p.cleared) p.clearT += realDt;
        if (phase !== 'rolling' && p.fallen && p.fallT < 0.3) p.fallT += realDt;
      }
      if (phase !== 'rolling') { sim.updatePosts(); for (const f of sim.fx) f.t += realDt; sim.fx = sim.fx.filter(f => f.t < 0.6); }
    }
    R.tick(realDt);
    const rs = run && run.rs;
    const thrown = rs && rs.cur && rs.cur.ball && phase !== 'aim' ? rs.cur.ball : null;
    const b = run && run.bag[sel];
    const wide = run ? GK.flags(run, rs ? rs.stolen : -1).wide : 1;
    R.draw({
      sim, phase, aimX, guide, snakePath, time: now / 1000,
      preview: thrown ? { type: thrown.type, ed: thrown.ed, r: C.BALL_R * wide } : b ? { type: b.type, ed: b.ed, r: (b.type === 'cluster' ? 2.3 : C.BALL_R) * wide } : null,
      dark: run && laneOf().dark, strobe: rs && rs.boss === 'strobe', glow,
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
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/[?&]nosw\b/.test(location.search)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
