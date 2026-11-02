// Gutter Kings — DOM UI: HUD, charm rail, dock, scorecard, and the overlay screens
// (title, bag select, round intro, payout, shop, pickers, game over). No game rules here.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const $ = id => document.getElementById(id);
  const esc = GK.esc, fmt = GK.fmt;
  const UI = GK.UI = {};
  UI.$ = $;

  UI.bump = el => { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); };
  UI.shot = t => { $('shot').textContent = t; };
  UI.tally = (c, m, f) => {
    $('chips').textContent = c == null ? '0' : fmt(c);
    $('mult').textContent = m == null ? '–' : (Math.round(m * 100) / 100).toLocaleString('en-US');
    $('fscore').textContent = f == null ? '–' : fmt(f);
  };
  // Banners slam in, then fade out. Pop-ups stay up long enough to read (scaled by length).
  let bannerT = 0, bannerOut = 0;
  UI.banner = (t, sub, ms) => {
    const el = $('banner'); el.innerHTML = esc(t) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    clearTimeout(bannerT); clearTimeout(bannerOut);
    el.hidden = false; el.classList.remove('show', 'out'); void el.offsetWidth; el.classList.add('show');
    if (ms) bannerT = setTimeout(UI.hideBanner, ms * 1.4);
  };
  UI.hideBanner = () => {
    const el = $('banner'); if (el.hidden) return;
    el.classList.remove('show'); el.classList.add('out');
    clearTimeout(bannerOut); bannerOut = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 340);
  };
  // Toasts queue up instead of replacing each other, so nothing flashes by unread.
  const toastQ = []; let toastBusy = false, toastLast = '';
  const readMs = t => Math.max(2600, 1400 + String(t).length * 45);
  UI.toast = (t, ms) => {
    if (t === toastLast && toastBusy) return;
    if (toastQ.length >= 4) toastQ.shift();
    toastQ.push([t, Math.max(ms || 0, readMs(t))]);
    if (!toastBusy) nextToast();
  };
  function nextToast() {
    const el = $('toast'), item = toastQ.shift();
    if (!item) { toastBusy = false; toastLast = ''; return; }
    toastBusy = true; toastLast = item[0];
    el.textContent = item[0]; el.hidden = false; el.classList.remove('out', 'show'); void el.offsetWidth; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); el.classList.add('out'); setTimeout(() => { el.hidden = true; nextToast(); }, 300); }, item[1]);
  }

  // ---------- item descriptions ----------
  UI.info = function (kind, id, ed, inst) {
    if (kind === 'charm') {
      const d = GK.CHARMS[id];
      return { name: d.name, k: GK.RARITY[d.rarity].name + ' charm', desc: inst ? GK.charmDesc(inst) : GK.charmDesc(GK.charmInst(id)), col: GK.RARITY[d.rarity].col, glyph: GK.TAG_GLYPH[d.tag], ed };
    }
    if (kind === 'ball') { const b = GK.BALLS[id], dr = inst && inst.drill && inst.drill !== 'stock' ? GK.DRILLS[inst.drill] : null; return { name: b.full, k: 'Ball', desc: b.desc + (dr ? ' Drilled: ' + dr.name + ' (' + dr.desc + ')' : ''), col: b.col, ed }; }
    if (kind === 'cons') { const c = GK.CONS[id]; return { name: c.name, k: GK.CONS_KIND[c.kind].name, desc: c.desc, col: GK.CONS_KIND[c.kind].col }; }
    if (kind === 'equip') { const e = GK.EQUIP[id]; return { name: e.name, k: 'Equipment · ' + e.slot, desc: e.desc + ' Replaces your current ' + e.slot + '.', col: '#c88f6a' }; }
    if (kind === 'member') { const m = GK.MEMBERSHIPS[id]; return { name: m.name, k: 'Alley Membership', desc: m.desc, col: '#f2c94c' }; }
    return { name: id, k: kind, desc: '', col: '#888' };
  };
  const edTag = ed => ed ? '<span class="ed" style="background:' + GK.EDITIONS[ed].col + '">' + GK.EDITIONS[ed].name + ' · ' + GK.EDITIONS[ed].desc + '</span>' : '';

  // ---------- HUD ----------
  UI.hud = function (run) {
    const def = GK.alleyDef(run), rs = run.rs;
    $('alleyLbl').textContent = run.practice ? 'Practice lane · ' + def.name : GK.isChamp(run) ? 'The Championship' : GK.isEndless(run) ? def.name : 'Alley ' + (run.alley + 1) + ' of 8 · ' + def.name;
    const boss = GK.isBoss(run) && !run.practice ? ' <span>· ' + esc(GK.bossDef(run).name) + '</span>' : '';
    $('round').innerHTML = run.practice ? 'Practice' : esc(GK.roundName(run)) + boss;
    $('money').textContent = GK.money(run.money);
    if (rs) {
      const champ = rs.boss === 'champion';
      $('target').textContent = run.practice ? 'Free bowl' : champ ? 'Beat the King · ' + fmt(rs.kingTotal) : 'Target ' + fmt(rs.target);
      $('score').innerHTML = fmt(rs.total) + (run.practice ? '' : '<small> / ' + fmt(rs.target) + '</small>');
      const pct = GK.clamp(rs.total / rs.target, 0, 1) * 100;
      $('bar').firstElementChild.style.width = pct + '%';
      $('bar').classList.toggle('done', pct >= 100);
      const roll = rs.cur ? rs.cur.rollIdx + 1 : 1;
      $('frameLbl').textContent = run.practice ? 'Frame ' + (rs.frameIdx + 1) + ' · Roll ' + roll : 'Frame ' + Math.min(rs.framesMax, rs.frameIdx + 1) + ' of ' + rs.framesMax + ' · Roll ' + roll;
      $('rrLbl').textContent = '↻ ' + (run.practice ? '∞' : rs.reracks);
      $('rrLbl').title = rs.reracks + ' re-racks left this round';
    }
  };

  UI.charms = function (run, onTap) {
    const el = $('charms'); el.innerHTML = '';
    const n = run.maxCharms; el.style.setProperty('--n', n);
    const stolen = run.rs ? run.rs.stolen : -1;
    for (let i = 0; i < n; i++) {
      const c = run.charms[i], b = document.createElement('button');
      b.type = 'button'; b.className = 'charm'; b.setAttribute('role', 'listitem');
      if (!c) { b.classList.add('empty'); b.innerHTML = '<span class="nm">empty</span>'; b.disabled = true; }
      else {
        const d = GK.CHARMS[c.id];
        b.style.setProperty('--rc', GK.RARITY[d.rarity].col);
        if (c.ed) b.classList.add('ed-' + c.ed);
        if (stolen === i) b.classList.add('stolen');
        b.innerHTML = '<span class="g">' + esc(GK.TAG_GLYPH[d.tag]) + '</span><span class="nm">' + esc(d.name) + '</span>';
        b.setAttribute('aria-label', d.name + ': ' + GK.charmDesc(c));
        b.addEventListener('click', () => onTap(i));
      }
      el.appendChild(b);
    }
  };
  UI.fireCharm = function (i, text, col) {
    const b = $('charms').children[i]; if (!b) return;
    b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire');
    const f = document.createElement('span'); f.className = 'float'; f.style.color = col; f.textContent = text;
    b.appendChild(f); setTimeout(() => f.remove(), 750);
  };

  UI.bag = function (run, sel, enabled, onPick) {
    const el = $('bag'); el.innerHTML = '';
    run.bag.forEach((b, i) => {
      const d = GK.BALLS[b.type], btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'slot' + (b.ed ? ' ed-' + b.ed : '');
      btn.setAttribute('aria-pressed', String(i === sel)); btn.disabled = !enabled;
      btn.innerHTML = '<span class="sw" style="background:' + d.col + '"></span><span>' + esc(d.name) + '</span>';
      btn.title = d.full + ': ' + d.desc;
      btn.addEventListener('click', () => onPick(i));
      el.appendChild(btn);
    });
  };
  UI.cons = function (run, enabled, onTap) {
    const el = $('cons'); el.innerHTML = '';
    for (let i = 0; i < run.maxCons; i++) {
      const id = run.cons[i], btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'slot';
      if (!id) { btn.classList.add('empty'); btn.disabled = true; btn.innerHTML = '<span class="ctag" style="background:transparent;border-style:dashed;border-color:var(--line)"></span><span class="lbl">empty</span>'; }
      else {
        const k = GK.CONS[id], kc = GK.CONS_KIND[k.kind];
        btn.disabled = !enabled;
        btn.innerHTML = '<span class="ctag" style="background:' + kc.col + '">' + (k.kind === 'card' ? 'S' : k.kind === 'market' ? 'M' : 'T') + '</span><span>' + esc(k.name) + '</span>';
        btn.addEventListener('click', () => onTap(i));
      }
      el.appendChild(btn);
    }
  };
  UI.rule = function (run, sel) {
    const b = run.bag[sel]; if (!b) { $('rule').textContent = ''; return; }
    const d = GK.BALLS[b.type];
    const st = run.rs && run.rs.stuck && run.bag.length > 1 && run.bag[run.rs.stuck.idx] ? ' <span style="color:var(--mult)">' + esc(GK.BALLS[run.bag[run.rs.stuck.idx].type].name) + ' is stuck in the return.</span>' : '';
    const dr = b.drill && b.drill !== 'stock' ? ' <span class="tag">' + esc(GK.DRILLS[b.drill].name) + '</span>' : '';
    $('rule').innerHTML = '<i class="sw" style="background:' + d.col + '"></i><span><b>' + esc(d.full) + (b.ed ? ' (' + GK.EDITIONS[b.ed].name + ')' : '') + '</b>' + dr + ' ' + esc(d.desc) + st + '</span>';
  };

  function mark(f, live) {
    if (f && GK.isStrikeKind(f.kind)) return ['', 'X'];
    const r = live || (f ? f.r : []);
    const m = r.map(v => v == null ? '' : v === 0 ? '–' : String(v));
    while (m.length < 2) m.push('');
    if (f && GK.isSpareKind(f.kind)) m[m.length - 1] = '/';
    return m;
  }
  UI.card = function (run) {
    const rs = run.rs, card = $('card'); if (!rs) return;
    // Long rounds (practice) show a sliding window of the last few frames.
    const show = Math.min(rs.framesMax, 7), from = rs.framesMax > 7 ? Math.max(0, rs.frameIdx - show + 1) : 0;
    card.innerHTML = ''; card.style.setProperty('--n', show);
    let tot = 0, ktot = 0;
    for (let i = 0; i < from; i++) { if (rs.frames[i]) { tot += rs.frames[i].score; if (rs.frames[i].king != null) ktot += rs.frames[i].king; } }
    for (let i = from; i < from + show; i++) {
      const f = rs.frames[i], el = document.createElement('div');
      el.className = 'cell' + (i === rs.frameIdx && !f ? ' now' : '');
      let marks = ['', ''];
      if (f) { marks = mark(f); tot += f.score; if (f.king != null) ktot += f.king; }
      else if (i === rs.frameIdx && rs.cur && rs.cur.rolls.length) marks = mark(null, rs.cur.rolls.map(r => r.pins));
      const nr = Math.max(2, marks.length);
      el.style.setProperty('--r', nr);
      el.innerHTML = '<div class="no">' + (i + 1) + '</div><div class="marks">' + marks.map(m => '<span>' + m + '</span>').join('') + '</div><div class="pts">' + (f ? fmt(tot) : '') + '</div>' +
        (rs.king ? '<div class="kg">' + (f ? 'K ' + fmt(ktot) : '') + '</div>' : '');
      card.appendChild(el);
    }
  };

  // ---------- overlay screens ----------
  UI.layer = function (html, bind) {
    const L = $('layer'); $('layerInner').innerHTML = html; L.hidden = false; L.scrollTop = 0;
    if (bind) bind($('layerInner'));
    const f = $('layerInner').querySelector('[data-focus]'); if (f) f.focus({ preventScroll: true });
  };
  UI.hideLayer = () => { $('layer').hidden = true; $('layerInner').innerHTML = ''; };
  UI.modal = function (html, bind) {
    const M = $('modal'); $('modalInner').innerHTML = html; M.hidden = false; M.scrollTop = 0;
    if (bind) bind($('modalInner'));
  };
  UI.hideModal = () => { $('modal').hidden = true; $('modalInner').innerHTML = ''; };
  UI.on = (root, sel, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => { GK.sfx.init(); fn(el, e); }));

  UI.title = function (meta, save, h) {
    const daily = GK.dailySeed(), done = meta.daily && meta.daily[daily];
    const nFeats = GK.FEATS.filter(f => meta.feats && meta.feats[f.id]).length;
    UI.layer(`<div class="panel">
      <div class="lbl">A bowling roguelike</div>
      <h1>GUTTER<br>KINGS</h1>
      <p class="dim">Hit the target in 5 frames. Buy balls, charms and oddities that rewrite the rules. Beat 8 alleys, then the Gutter King.</p>
      <div class="btns">
        ${save ? '<button class="btn" data-a="continue" data-focus>Continue run</button><p class="dim" style="margin-top:-4px">' + esc(save) + '</p>' : ''}
        <button class="btn ${save ? 'alt' : ''}" data-a="new" ${save ? '' : 'data-focus'}>New run</button>
        <button class="btn alt" data-a="daily">Daily run${done ? ' · best ' + esc(done) : ''}</button>
        <div class="row2"><button class="btn alt small" data-a="practice">Practice lane</button><button class="btn alt small" data-a="collection">Feats · ${nFeats}/${GK.FEATS.length}</button></div>
        <div class="row2"><button class="btn alt small" data-a="how">How to play</button><button class="btn alt small" data-a="sound">${GK.sfx.muted ? 'Sound off' : 'Sound on'}</button></div>
      </div>
      <p class="dim">Runs ${meta.runs} · Wins ${meta.wins} · Best alley ${meta.bestAlley ? (meta.bestAlley > 8 ? 'Champion' : meta.bestAlley) : '–'} · Best frame ${fmt(meta.bestFrame)}${meta.bestEndless ? ' · Endless ' + meta.bestEndless : ''}${GK.VERSION ? ' · v' + GK.VERSION : ''}</p>
    </div>`, r => UI.on(r, '[data-a]', el => h[el.dataset.a](el)));
  };

  // New run setup: starting bag, league and ascension level.
  UI.bagSelect = function (meta, onGo, onBack) {
    let sel = 'classic', league = 'open', asc = 0;
    const maxAsc = meta.maxAsc || 0;
    const unlocked = GK.unlockedFor(meta);
    const leagueOpen = id => !GK.LOCKED.has('league:' + id) || unlocked.has('league:' + id);
    const featFor = key => GK.FEATS.find(f => f.unlocks.includes(key));
    const draw = () => UI.layer(`<div class="panel">
      <h2>New run</h2>
      <h3>Starting bag</h3>
      <div class="choices">${GK.STARTER_BAGS.map(b => `<button class="choice" data-b="${b.id}" aria-pressed="${b.id === sel}"><b>${esc(b.name)}</b>
        <span class="balls">${b.balls.map(t => '<i class="sw" style="background:' + GK.BALLS[t].col + '"></i>').join('')}</span><span>${esc(b.desc)}</span></button>`).join('')}</div>
      <h3>League</h3>
      <div class="choices">${GK.LEAGUE_ORDER.map(id => {
        const L = GK.LEAGUES[id], open = leagueOpen(id), f = featFor('league:' + id);
        return `<button class="choice" data-l="${id}" aria-pressed="${id === league}" ${open ? '' : 'disabled'}><b>${esc(L.name)}</b><span>${open ? esc(L.desc) : 'Locked · feat: ' + esc(f ? f.name + ' (' + f.desc + ')' : '')}</span></button>`;
      }).join('')}</div>
      <h3>Ascension</h3>
      ${maxAsc ? `<div class="stepper"><button class="btn alt small" data-a="ascdown" ${asc ? '' : 'disabled'}>−</button><div><b>Level ${asc}</b><p class="dim">${asc ? GK.ASCENSION.slice(1, asc + 1).map(a => esc(a.desc)).join('<br>') : 'Standard difficulty.'}</p></div><button class="btn alt small" data-a="ascup" ${asc < maxAsc ? '' : 'disabled'}>+</button></div>` : '<p class="dim">Beat the Gutter King to unlock Ascension levels: harder runs that stack a new rule each level.</p>'}
      <div class="seedrow"><input id="seedIn" placeholder="Seed (optional)" maxlength="8" aria-label="Seed"><button class="btn small alt" data-a="back">Back</button></div>
      <button class="btn" data-a="go" data-focus>Start run</button>
    </div>`, r => {
      UI.on(r, '[data-b]', el => { sel = el.dataset.b; keep(draw); });
      UI.on(r, '[data-l]', el => { if (!el.disabled) { league = el.dataset.l; keep(draw); } });
      UI.on(r, '[data-a=ascdown]', () => { asc = Math.max(0, asc - 1); keep(draw); });
      UI.on(r, '[data-a=ascup]', () => { asc = Math.min(maxAsc, asc + 1); keep(draw); });
      UI.on(r, '[data-a=go]', () => { const s = $('seedIn').value.trim(); onGo({ bag: sel, seed: s ? GK.parseSeed(s) : null, league, asc }); });
      UI.on(r, '[data-a=back]', onBack);
    });
    // Redraw without losing the seed text or scroll position.
    const keep = fn => { const v = $('seedIn') ? $('seedIn').value : '', y = $('layer').scrollTop; fn(); $('seedIn').value = v; $('layer').scrollTop = y; };
    draw();
  };

  UI.collection = function (meta) {
    const done = meta.feats || {};
    const log = meta.dailyLog || [];
    UI.modal(`<div class="panel" style="text-align:left">
      <h2>Feats &amp; unlocks</h2>
      <p class="dim">Feats unlock new balls, charms and leagues for future runs.</p>
      <div>${GK.FEATS.map(f => `<div class="feat"><b class="${done[f.id] ? 'ok' : 'no'}">${done[f.id] ? 'DONE' : 'LOCKED'}</b><b>${esc(f.name)}</b><span>${esc(f.desc)} Unlocks ${esc(f.unlocks.map(GK.unlockName).join(', '))}.</span></div>`).join('')}</div>
      <h3>Ascension</h3><p class="dim">${meta.maxAsc ? 'Unlocked up to level ' + meta.maxAsc + ' of ' + GK.MAX_ASC + '.' : 'Beat the Gutter King to unlock.'}</p>
      <h3>Your daily runs</h3>
      ${log.length ? '<div class="story">' + log.map(x => `<div><span>${esc(x.date)}</span><b>${esc(x.label)} · best frame ${fmt(x.best || 0)}</b></div>`).join('') + '</div>' : '<p class="dim">No daily runs yet.</p>'}
      <button class="btn" data-a="ok">Close</button>
    </div>`, r => UI.on(r, '[data-a=ok]', UI.hideModal));
  };

  UI.how = function (onBack) {
    UI.modal(`<div class="panel" style="text-align:left">
      <h2>How to play</h2>
      <p><b>Throw in 4 timed taps:</b> 1) the ball slides back and forth across the approach: tap to stop it on your starting spot. 2) The aim arrow swings side to side: tap to lock the angle. 3) Tap to stop the fast power bar. The thin green zone is a PERFECT throw; past it, the ball wobbles off line. 4) Tap to stop the hook dial: left curves the ball left, right curves it right. Tap anywhere on the lane or press Set. There's no going back: once you stop a slider, that part of your throw is locked in. Keyboard: Space taps.</p>
      <p><b>Your balls</b> sit on the ball return at the right of the approach. Tap one to pick it. Now and then a ball jams in the return and you have to throw a different one before it comes back.</p>
      <p><b>Oil:</b> the blue sheen on the lane is oil. The ball skids through oil and hooks on dry boards. Every alley has its own pattern, and it breaks down as you bowl: throw the same line again and again and it dries out (the boards turn brown) and your ball hooks earlier. The lane is re-oiled each round.</p>
      <p><b>The pinsetter</b> is old. Once in a while it fumbles after your first ball and drops a pin or two you left standing. Lucky you.</p>
      <p><b>Groove:</b> PERFECT throws in a row build Groove. Each stack adds +1 Mult to every frame until you miss the zone.</p>
      <p><b>Score:</b> every frame scores <span style="color:var(--chips)">Points</span> × <span style="color:var(--mult)">Mult</span>. The shot sets the base (Strike, Spare, Split conversion, Double, Turkey…). Each pin adds Points. Pins knocking over pins, late wobblers and kickback bangs add bonus Points.</p>
      <p><b>Rounds:</b> reach the target within your frames. Each alley has a Qualifier, a Heat and a Boss Match. Miss a target and the run ends.</p>
      <p><b>Re-racks:</b> after a bad first roll, spend a re-rack to reset all pins and take roll one again.</p>
      <p><b>Bosses</b> change every run: each alley has a pool of bosses and you meet one of them.</p>
      <p><b>Skipping:</b> you can skip a Qualifier or Heat. You get no score, pay or shop, but you take that round's reward tag (cash, a coupon, a free charm and more).</p>
      <p><b>Between rounds</b> you may run into the Lost &amp; Found, a vending machine, a shady bowler or the lane mechanic.</p>
      <p><b>Drilling:</b> the Pro Shop can re-drill a ball: Strong (more hook), Control (less hook) or Skid-flare (skids through oil, snaps on dry boards).</p>
      <p><b>Lane surprises:</b> now and then a frame starts with a power flicker, a sticky approach or a fresh oil top-up.</p>
      <p><b>Lane TV:</b> tap the TV beside the lane to watch its cartoons big. Beat the Gutter King to unlock <b>Endless mode</b>, and use the <b>Practice lane</b> on the title screen to learn each oil pattern.</p>
      <p><b>Shop:</b> charms trigger left to right after every frame, so order matters. Balls change the physics. Scorecards level up shots, Lane Tricks change your pins and balls, and the Black Market is powerful but costs you.</p>
      <p><b>Money:</b> clear a round to get paid, plus $1 per unused frame and $1 interest per $5 you hold (max $4).</p>
      <button class="btn" data-a="ok">Got it</button>
    </div>`, r => UI.on(r, '[data-a=ok]', () => { UI.hideModal(); if (onBack) onBack(); }));
  };

  UI.intro = function (run, onGo, onSkip) {
    const def = GK.alleyDef(run), rs = run.rs, boss = GK.isBoss(run);
    const first = run.round === 0;
    const oil = GK.OIL[(def.lane && def.lane.oil) || 'house'];
    const tags = [run.league && run.league !== 'open' ? GK.LEAGUES[run.league].name : '', run.asc ? 'Ascension ' + run.asc : ''].filter(Boolean).join(' · ');
    UI.layer(`<div class="panel">
      <div class="lbl">${GK.isChamp(run) ? 'Final' : GK.isEndless(run) ? 'Endless' : 'Alley ' + (run.alley + 1) + ' of 8'} · ${esc(def.name)}${tags ? ' · ' + esc(tags) : ''}</div>
      <h2>${esc(GK.roundName(run))}</h2>
      <p>Target <b style="color:var(--marquee)">${fmt(rs.target)}</b> in ${rs.framesMax} frames · ${rs.reracks} re-rack${rs.reracks === 1 ? '' : 's'}</p>
      ${first || GK.isChamp(run) ? '<p class="dim">' + esc(def.laneDesc) + '</p>' : ''}
      <p class="dim"><b style="color:var(--chips)">Oil: ${esc(oil.name)}.</b> ${esc(oil.desc)}</p>
      ${boss ? `<div class="boss"><b>${esc(GK.bossDef(run).name)}</b><p>${esc(GK.bossDef(run).desc)}</p>${rs.stolen >= 0 && run.charms[rs.stolen] ? '<p class="dim">Stolen: ' + esc(GK.CHARMS[run.charms[rs.stolen].id].name) + '</p>' : ''}</div>` : ''}
      ${!GK.isChamp(run) && run.round === 1 && GK.rules(run).heatMech ? '<div class="boss"><b>Ascension</b><p>The Mechanic stands 1 pin back up after your first roll.</p></div>' : ''}
      ${!GK.isChamp(run) ? '<p class="dim">Reward: $' + GK.ROUND_PAY[run.round] + ' + $1 per unused frame + interest</p>' : ''}
      <button class="btn" data-a="go" data-focus>${boss ? 'Face the boss' : 'Bowl'}</button>
      ${onSkip ? (() => { const t = GK.TAGS[GK.skipTag(run)]; return `<div class="boss info"><b>Skip this round?</b><p>No score, no pay and no shop, but you get the <b>${esc(t.name)}</b>: ${esc(t.desc)}</p></div><button class="btn alt small" data-a="skip">Skip for the ${esc(t.name)}</button>`; })() : ''}
    </div>`, r => { UI.on(r, '[data-a=go]', onGo); if (onSkip) UI.on(r, '[data-a=skip]', onSkip); });
  };

  // Between rounds: a small encounter with one offer.
  UI.eventScreen = function (run, ev, h) {
    const E = GK.EVENTS[ev.id];
    let offer = '', take = 'Take it';
    if (ev.id === 'lost_found') { const b = GK.BALLS[ev.ball]; offer = '<div class="boss info"><b>' + esc(b.full) + '</b><p>' + esc(b.desc) + '</p></div>'; take = 'Take the ' + b.name + ' ball'; }
    if (ev.id === 'vending') { offer = '<p class="dim">You never know what\'s in there until it drops.</p>'; take = 'Pay $3'; }
    if (ev.id === 'shady') { const c = GK.CHARMS[ev.charm]; offer = '<div class="boss"><b>' + esc(c.name) + '</b><p>' + esc(GK.charmDesc(GK.charmInst(ev.charm))) + '</p></div>'; take = 'Take the charm'; }
    if (ev.id === 'lane_mech') { take = 'Re-drill a ball'; }
    UI.layer(`<div class="panel solid">
      <div class="lbl">Between rounds</div>
      <h2>${esc(E.name)}</h2>
      <p>${esc(E.desc)}</p>
      ${offer}
      <div class="row2"><button class="btn" data-a="take" data-focus>${esc(take)}</button><button class="btn alt" data-a="leave">Walk away</button></div>
    </div>`, r => { UI.on(r, '[data-a=take]', h.take); UI.on(r, '[data-a=leave]', h.leave); });
  };

  UI.drillPicker = function (run, bi, onPick, onCancel) {
    const b = run.bag[bi], cur = b.drill || 'stock';
    UI.modal(`<div class="panel">
      <div class="lbl">Re-drill · ${esc(GK.BALLS[b.type].full)}</div>
      <h2>Pick a layout</h2>
      <div class="choices">${Object.entries(GK.DRILLS).map(([id, d]) => `<button class="choice" data-d="${id}" aria-pressed="${id === cur}"><b>${esc(d.name)}${id === cur ? ' · current' : ''}</b><span>${esc(d.desc)}</span></button>`).join('')}</div>
      <button class="btn alt" data-a="no">Cancel</button>
    </div>`, r => { UI.on(r, '[data-d]', el => onPick(el.dataset.d)); UI.on(r, '[data-a=no]', onCancel); });
  };

  UI.practiceSetup = function (onGo, onBack) {
    UI.layer(`<div class="panel">
      <h2>Practice lane</h2>
      <p class="dim">Free bowling with no target and no shop. Pick a lane to learn its oil. Your House, Featherweight, Lead and Split balls are on the return.</p>
      <div class="choices">${GK.ALLEYS.map((a, i) => { const o = GK.OIL[a.lane.oil || 'house']; return `<button class="choice" data-p="${i}"><b>${esc(a.name)}</b><span>${esc(o.name)}: ${esc(o.desc)}</span></button>`; }).join('')}</div>
      <button class="btn alt" data-a="back">Back</button>
    </div>`, r => { UI.on(r, '[data-p]', el => onGo(+el.dataset.p)); UI.on(r, '[data-a=back]', onBack); });
  };

  // Tap the lane TV to watch its cartoons big.
  UI.tvModal = function (onClose) {
    UI.modal(`<div class="panel">
      <div class="lbl">Lane TV</div>
      <canvas class="tvbig" id="tvBig" width="456" height="312"></canvas>
      <button class="btn" data-a="ok">Close</button>
    </div>`, r => UI.on(r, '[data-a=ok]', () => { UI.hideModal(); if (onClose) onClose(); }));
  };

  UI.payout = function (run, lines, score, onGo) {
    const tot = lines.reduce((a, l) => a + l.v, 0);
    UI.layer(`<div class="panel">
      <h2>Round cleared</h2>
      <p>${fmt(score)} of ${fmt(run.rs.target)}</p>
      <div class="lines">${lines.map(l => '<div><span>' + esc(l.label) + '</span><b>' + (l.v < 0 ? '-$' + (-l.v) : '+$' + l.v) + '</b></div>').join('')}
        <div class="tot"><span>Total</span><b>${tot < 0 ? '-$' + (-tot) : '+$' + tot}</b></div></div>
      <button class="btn" data-a="go" data-focus>To the Pro Shop</button>
    </div>`, r => UI.on(r, '[data-a=go]', onGo));
  };

  const roundLabel = h => h.champ ? 'Championship' : (h.alley > GK.ALLEY_COUNT ? 'E' + (h.alley - GK.ALLEY_COUNT) : 'A' + (h.alley + 1)) + ' ' + GK.ROUND_NAMES[h.round];
  // End of run: what happened round by round, the best frame (with a replay) and a share line.
  UI.end = function (run, won, meta, h) {
    const s = run.stats, rs = run.rs, hist = run.history || [], b = run.best;
    const reached = GK.isChamp(run) ? 'Championship' : 'Alley ' + (run.alley + 1) + ', ' + GK.roundName(run);
    const d = new Date(), date = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    const share = run.daily ? `Gutter Kings daily ${date}\n${won ? 'CHAMPION' : 'Reached ' + reached}\nBest frame ${fmt(s.bestFrame)} · ${s.strikes} strikes · ${s.perfects || 0} perfect throws\nSeed ${GK.seedCode(run.seed)}` : '';
    UI.layer(`<div class="panel">
      <h2>${won ? 'Gutter King dethroned!' : 'Run over'}</h2>
      <p>${won ? 'You beat the Championship. The crown is yours.' : 'You finished ' + esc(GK.roundName(run)) + ' at ' + esc(GK.alleyDef(run).name) + ' with ' + fmt(rs ? rs.total : 0) + ' of ' + fmt(rs ? rs.target : 0) + '.'}</p>
      ${won && run.asc < GK.MAX_ASC ? '<p style="color:var(--good)">Ascension ' + (run.asc + 1) + ' unlocked.</p>' : ''}
      <h3>Your run</h3>
      <div class="story">${hist.map(x => `<div><span>${esc(roundLabel(x))}</span><b class="${x.skipped ? 's' : x.won ? 'w' : 'l'}">${x.skipped ? 'skipped' : fmt(x.total) + ' / ' + fmt(x.target)}</b></div>`).join('')}</div>
      ${b ? `<p class="dim">Best frame: <b>${esc(GK.SHOTS[b.kind].name)}</b> for ${fmt(b.score)} in ${esc(roundLabel(b))}, frame ${b.frame + 1}.</p>` : ''}
      <div class="lines">
        <div><span>Strikes / Spares / Splits</span><b>${s.strikes} / ${s.spares} / ${s.splits}</b></div>
        <div><span>PERFECT throws (best streak)</span><b>${s.perfects || 0} (${s.bestPStreak || 0})</b></div>
        <div><span>Pins knocked down</span><b>${fmt(s.pins)}</b></div>
        <div><span>League · Ascension</span><b>${esc(GK.LEAGUES[run.league || 'open'].name)} · ${run.asc || 0}</b></div>
        <div><span>Seed</span><b>${GK.seedCode(run.seed)}${run.daily ? ' (daily)' : ''}</b></div>
      </div>
      ${h.endless ? '<button class="btn good" data-a="endless">Keep bowling: Endless mode</button><p class="dim">The alleys come around again with targets that keep climbing. See how far your build goes.</p>' : ''}
      ${h.best ? '<button class="btn alt" data-a="best">Watch your best frame</button>' : ''}
      ${share ? '<div class="share" id="shareTxt">' + esc(share) + '</div><button class="btn alt small" data-a="copy">Copy daily result</button>' : ''}
      <div class="row2"><button class="btn" data-a="again" data-focus>New run</button><button class="btn alt" data-a="title">Title</button></div>
    </div>`, r => {
      UI.on(r, '[data-a=again]', h.again); UI.on(r, '[data-a=title]', h.title);
      if (h.best) UI.on(r, '[data-a=best]', h.best);
      if (h.endless) UI.on(r, '[data-a=endless]', h.endless);
      UI.on(r, '[data-a=copy]', el => {
        const done = () => { el.textContent = 'Copied'; };
        try { navigator.clipboard.writeText(share).then(done, () => selectShare()); } catch (e) { selectShare(); }
      });
    });
    function selectShare() { const t = $('shareTxt'); if (!t) return; const rg = document.createRange(); rg.selectNodeContents(t); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); UI.toast('Selected. Copy it from the menu.'); }
  };

  UI.levelsHtml = function (run) {
    return '<div class="levels">' + GK.SHOT_ORDER.map(k => { const b = GK.shotBase(k, run.levels); return '<span>' + esc(GK.SHOTS[k].name) + (b.lv ? ' <i>Lv.' + (b.lv + 1) + '</i>' : '') + ' <i>' + b.chips + '×' + b.mult + '</i></span>'; }).join('') + '</div>';
  };
  // Rack diagram (back row 11-13 on top). canPick(n) decides which spots are selectable.
  UI.rackHtml = function (rack, picks, canPick) {
    rack = GK.padRack(rack);
    const rows = [[11, 12, 13], [7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];
    return '<div class="rack">' + rows.map(r => '<div class="rr">' + r.map(n => {
      const t = rack[n - 1], d = GK.PINS[t];
      const ok = typeof canPick === 'function' ? canPick(n) : !!canPick;
      return `<button class="pinb${t === 'none' ? ' none' : ''}" data-pin="${n}" style="--pc:${d.body || 'transparent'}" aria-pressed="${picks && picks.has(n) ? 'true' : 'false'}" title="${esc(d.name)}" ${ok ? '' : 'disabled'}>${n}</button>`;
    }).join('') + '</div>').join('') + '</div>';
  };

  UI.runInfo = function (run, onClose) {
    const eq = Object.values(run.equip).filter(id => GK.EQUIP[id]).map(id => GK.EQUIP[id].name).join(', ') || 'None';
    const mem = run.members.map(id => GK.MEMBERSHIPS[id].name).join(', ') || 'None';
    const kinds = [...new Set(run.rack)].filter(t => t !== 'std');
    UI.modal(`<div class="panel" style="text-align:left">
      <h2>Your run</h2>
      <h3>Shot levels</h3>${UI.levelsHtml(run)}
      <h3>Pin rack</h3>${UI.rackHtml(run.rack, null, false)}
      ${kinds.length ? '<p class="dim">' + kinds.map(t => '<b>' + esc(GK.PINS[t].name) + ':</b> ' + esc(GK.PINS[t].desc)).join('<br>') + '</p>' : '<p class="dim">All standard pins.</p>'}
      <h3>Equipment</h3><p class="dim">${esc(eq)}</p>
      <h3>Memberships</h3><p class="dim">${esc(mem)}</p>
      <p class="dim">Seed ${GK.seedCode(run.seed)}${run.daily ? ' (daily)' : ''} · Throws ${run.stats.throws}</p>
      <button class="btn" data-a="ok">Close</button>
    </div>`, r => UI.on(r, '[data-a=ok]', () => { UI.hideModal(); if (onClose) onClose(); }));
  };

  // Generic item detail with action buttons: actions = [{label, fn, cls}]
  UI.detail = function (inf, actions) {
    UI.modal(`<div class="panel">
      <div class="lbl" style="color:${inf.col}">${esc(inf.k)}</div>
      <h2>${esc(inf.name)}</h2>
      ${inf.ed ? '<p style="color:' + GK.EDITIONS[inf.ed].col + '">' + GK.EDITIONS[inf.ed].name + ' edition · ' + GK.EDITIONS[inf.ed].desc + '</p>' : ''}
      <p>${esc(inf.desc)}</p>
      <div class="btns">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}" ${a.disabled ? 'disabled' : ''}>${esc(a.label)}</button>`).join('')}</div>
    </div>`, r => UI.on(r, '[data-i]', el => actions[+el.dataset.i].fn()));
  };

  UI.pinPicker = function (run, k, onDone, onCancel) {
    const picks = new Set(), rack = GK.padRack(run.rack);
    const canPick = n => k.backRow ? n >= 11 && rack[n - 1] === 'none' : rack[n - 1] !== 'none';
    const draw = () => UI.modal(`<div class="panel">
      <div class="lbl" style="color:${GK.CONS_KIND[k.kind].col}">${esc(k.name)}</div>
      <h2>Pick ${k.picks > 1 ? 'up to ' + k.picks + ' pins' : 'a pin'}</h2>
      <p class="dim">${esc(k.desc)}</p>
      ${UI.rackHtml(run.rack, picks, canPick)}
      <div class="row2"><button class="btn" data-a="ok" ${picks.size ? '' : 'disabled'}>Apply</button><button class="btn alt" data-a="no">Cancel</button></div>
    </div>`, r => {
      UI.on(r, '[data-pin]', el => {
        const n = +el.dataset.pin; if (!canPick(n)) return;
        if (picks.has(n)) picks.delete(n); else { if (picks.size >= k.picks) picks.delete(picks.values().next().value); picks.add(n); }
        draw();
      });
      UI.on(r, '[data-a=ok]', () => onDone([...picks]));
      UI.on(r, '[data-a=no]', onCancel);
    });
    draw();
  };
  UI.ballPicker = function (run, title, desc, onDone, onCancel) {
    UI.modal(`<div class="panel">
      <h2>${esc(title)}</h2><p class="dim">${esc(desc)}</p>
      <div class="choices">${run.bag.map((b, i) => `<button class="choice" data-b="${i}"><b><i class="sw" style="display:inline-block;vertical-align:-2px;background:${GK.BALLS[b.type].col}"></i> ${esc(GK.BALLS[b.type].full)}${b.ed ? ' · ' + GK.EDITIONS[b.ed].name : ''}</b><span>${esc(GK.BALLS[b.type].desc)}${b.drill && b.drill !== 'stock' ? ' · ' + esc(GK.DRILLS[b.drill].name) : ''}</span></button>`).join('')}</div>
      <button class="btn alt" data-a="no">Cancel</button>
    </div>`, r => { UI.on(r, '[data-b]', el => onDone(+el.dataset.b)); UI.on(r, '[data-a=no]', onCancel); });
  };

  // ---------- shop ----------
  UI.shop = function (run, h) {
    const shop = run.shop, nextTarget = GK.roundTarget(run);
    const card = (it, i) => {
      const inf = UI.info(it.kind, it.id, it.ed);
      const afford = GK.canAfford(run, it.price);
      return `<div class="item${it.sold ? ' sold' : ''}" style="--rc:${inf.col}">
        <span class="k">${esc(inf.k)}</span><span class="n">${esc(inf.name)}</span>${edTag(it.ed)}
        <span class="d">${esc(inf.desc)}</span>
        <button class="btn small" data-buy="${i}" ${it.sold || !afford ? 'disabled' : ''}>${it.sold ? 'Sold' : it.price === 0 ? 'Take (free)' : 'Buy $' + it.price}</button></div>`;
    };
    const mem = shop.member ? (() => {
      const m = GK.MEMBERSHIPS[shop.member], price = GK.price(run, m.cost);
      return `<div class="item wide" style="--rc:#f2c94c"><span class="k">Alley Membership · permanent</span><span class="n">${esc(m.name)}</span><span class="d">${esc(m.desc)}</span>
        <button class="btn small" data-a="member" ${GK.canAfford(run, price) ? '' : 'disabled'}>Buy $${price}</button></div>`;
    })() : '';
    const charms = run.charms.map((c, i) => { const d = GK.CHARMS[c.id]; return `<button class="chip" data-charm="${i}" style="--rc:${GK.RARITY[d.rarity].col}">${esc(d.name)}${c.ed ? ' <small>' + GK.EDITIONS[c.ed].name + '</small>' : ''}</button>`; }).join('') || '<span class="lbl">No charms yet</span>';
    const balls = run.bag.map((b, i) => `<button class="chip" data-ball="${i}" style="--rc:${GK.BALLS[b.type].col}"><i class="sw" style="background:${GK.BALLS[b.type].col}"></i>${esc(GK.BALLS[b.type].name)}${b.ed ? ' <small>' + GK.EDITIONS[b.ed].name + '</small>' : ''}${b.drill && b.drill !== 'stock' ? ' <small>' + esc(GK.DRILLS[b.drill].name.split(' ')[0]) + '</small>' : ''}</button>`).join('');
    const cons = run.cons.map((id, i) => `<button class="chip" data-cons="${i}" style="--rc:${GK.CONS_KIND[GK.CONS[id].kind].col}">${esc(GK.CONS[id].name)}</button>`).join('') || '<span class="lbl">Empty</span>';
    const eq = Object.values(run.equip).filter(id => GK.EQUIP[id]).map(id => GK.EQUIP[id].name).join(', ');
    UI.layer(`<div class="shop">
      <div class="shophead"><div><div class="lbl">Next: ${esc(GK.roundName(run))} · ${esc(GK.alleyDef(run).name)} · target ${fmt(nextTarget)}</div><h2>Pro Shop</h2></div><div class="m">${GK.money(run.money)}</div></div>
      ${shop.coupon ? '<div class="boss info"><b>Coupon Tag</b><p>Everything here is half price.</p></div>' : ''}
      <div class="grid">${shop.items.map(card).join('')}${mem}</div>
      <div class="item wide" style="--rc:#3fd0e0"><span class="k">Pro Shop service</span><span class="n">Re-drill a ball</span><span class="d">Change how a ball hooks: Strong, Control or Skid-flare layouts.</span>
        <button class="btn small alt" data-a="drill" ${GK.canAfford(run, GK.drillCost(run)) ? '' : 'disabled'}>${GK.drillCost(run) ? 'Re-drill $' + GK.drillCost(run) : 'Re-drill (free)'}</button></div>
      <div class="row2"><button class="btn alt small" data-a="reroll" ${GK.canAfford(run, GK.rerollCost(run)) ? '' : 'disabled'}>Reroll $${GK.rerollCost(run)}</button><button class="btn alt small" data-a="info">Run info</button></div>
      <div class="sect">Charms ${run.charms.length}/${run.maxCharms} · tap to sell or reorder</div><div class="owned">${charms}</div>
      <div class="sect">Bag ${run.bag.length}/${run.maxBag}</div><div class="owned">${balls}</div>
      <div class="sect">Consumables ${run.cons.length}/${run.maxCons}</div><div class="owned">${cons}</div>
      ${eq ? '<div class="sect">Equipment</div><p class="dim" style="margin:0;font-size:13px;color:var(--muted)">' + esc(eq) + '</p>' : ''}
      <button class="btn" data-a="next" data-focus>Next round</button>
    </div>`, r => {
      UI.on(r, '[data-buy]', el => h.buy(+el.dataset.buy));
      UI.on(r, '[data-a=member]', h.member);
      UI.on(r, '[data-a=drill]', h.drill);
      UI.on(r, '[data-a=reroll]', h.reroll);
      UI.on(r, '[data-a=info]', h.info);
      UI.on(r, '[data-a=next]', h.next);
      UI.on(r, '[data-charm]', el => h.charm(+el.dataset.charm));
      UI.on(r, '[data-ball]', el => h.ball(+el.dataset.ball));
      UI.on(r, '[data-cons]', el => h.cons(+el.dataset.cons));
    });
  };

  UI.menu = function (run, h) {
    UI.modal(`<div class="panel">
      <h2>Paused</h2>
      <div class="btns">
        <button class="btn" data-a="resume">Resume</button>
        <button class="btn alt" data-a="info">Run info</button>
        <button class="btn alt" data-a="how">How to play</button>
        <div class="row2"><button class="btn alt small" data-a="sound">${GK.sfx.muted ? 'Sound off' : 'Sound on'}</button><button class="btn alt small" data-a="speed">${h.fast() ? 'Scoring: fast' : 'Scoring: normal'}</button></div>
        <div class="row2"><button class="btn alt small" data-a="music">${h.musicOn() ? 'Music: on' : 'Music: off'}</button><button class="btn alt small" data-a="replays">${h.replaysOn() ? 'Replays: on' : 'Replays: off'}</button></div>
        <div class="row2"><button class="btn alt small" data-a="haptics">${h.hapticsOn() ? 'Vibration: on' : 'Vibration: off'}</button><button class="btn alt small" data-a="hints">${h.hintsOn() ? 'Hints: on' : 'Hints: off'}</button></div>
        ${h.practice() ? '<button class="btn alt" data-a="freshOil">Fresh oil</button><button class="btn alt" data-a="title">End practice</button>' : '<button class="btn alt" data-a="title">Save and quit</button><button class="btn danger small" data-a="abandon">Abandon run</button>'}
      </div>
    </div>`, r => UI.on(r, '[data-a]', el => h[el.dataset.a](el)));
  };
})();
