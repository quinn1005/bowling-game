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
  let bannerT = 0;
  UI.banner = (t, sub, ms) => {
    const el = $('banner'); el.innerHTML = esc(t) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerT); if (ms) bannerT = setTimeout(() => { el.hidden = true; }, ms);
  };
  UI.hideBanner = () => { $('banner').hidden = true; };
  let toastT = 0;
  UI.toast = (t, ms = 1600) => { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms); };

  // ---------- item descriptions ----------
  UI.info = function (kind, id, ed, inst) {
    if (kind === 'charm') {
      const d = GK.CHARMS[id];
      return { name: d.name, k: GK.RARITY[d.rarity].name + ' charm', desc: inst ? GK.charmDesc(inst) : GK.charmDesc(GK.charmInst(id)), col: GK.RARITY[d.rarity].col, glyph: GK.TAG_GLYPH[d.tag], ed };
    }
    if (kind === 'ball') { const b = GK.BALLS[id]; return { name: b.full, k: 'Ball', desc: b.desc, col: b.col, ed }; }
    if (kind === 'cons') { const c = GK.CONS[id]; return { name: c.name, k: GK.CONS_KIND[c.kind].name, desc: c.desc, col: GK.CONS_KIND[c.kind].col }; }
    if (kind === 'equip') { const e = GK.EQUIP[id]; return { name: e.name, k: 'Equipment · ' + e.slot, desc: e.desc + ' Replaces your current ' + e.slot + '.', col: '#c88f6a' }; }
    if (kind === 'member') { const m = GK.MEMBERSHIPS[id]; return { name: m.name, k: 'Alley Membership', desc: m.desc, col: '#f2c94c' }; }
    return { name: id, k: kind, desc: '', col: '#888' };
  };
  const edTag = ed => ed ? '<span class="ed" style="background:' + GK.EDITIONS[ed].col + '">' + GK.EDITIONS[ed].name + ' · ' + GK.EDITIONS[ed].desc + '</span>' : '';

  // ---------- HUD ----------
  UI.hud = function (run) {
    const def = GK.alleyDef(run), rs = run.rs;
    $('alleyLbl').textContent = GK.isChamp(run) ? 'The Championship' : 'Alley ' + (run.alley + 1) + ' of 8 · ' + def.name;
    const boss = GK.isBoss(run) ? ' <span>· ' + esc(def.boss.name) + '</span>' : '';
    $('round').innerHTML = esc(GK.roundName(run)) + boss;
    $('money').textContent = GK.money(run.money);
    if (rs) {
      const champ = rs.boss === 'champion';
      $('target').textContent = champ ? 'Beat the King · ' + fmt(rs.kingTotal) : 'Target ' + fmt(rs.target);
      $('score').innerHTML = fmt(rs.total) + '<small> / ' + fmt(rs.target) + '</small>';
      const pct = GK.clamp(rs.total / rs.target, 0, 1) * 100;
      $('bar').firstElementChild.style.width = pct + '%';
      $('bar').classList.toggle('done', pct >= 100);
      const roll = rs.cur ? rs.cur.rollIdx + 1 : 1;
      $('frameLbl').textContent = 'Frame ' + Math.min(rs.framesMax, rs.frameIdx + 1) + ' of ' + rs.framesMax + ' · Roll ' + roll;
      $('rrLbl').textContent = '↻ ' + rs.reracks;
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
    $('rule').innerHTML = '<b>' + esc(d.full) + (b.ed ? ' (' + GK.EDITIONS[b.ed].name + ')' : '') + '.</b> ' + esc(d.desc);
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
    card.innerHTML = ''; card.style.setProperty('--n', rs.framesMax);
    let tot = 0, ktot = 0;
    for (let i = 0; i < rs.framesMax; i++) {
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
    UI.layer(`<div class="panel">
      <div class="lbl">A bowling roguelike</div>
      <h1>GUTTER<br>KINGS</h1>
      <p class="dim">Hit the target in 5 frames. Buy balls, charms and oddities that rewrite the rules. Beat 8 alleys, then the Gutter King.</p>
      <div class="btns">
        ${save ? '<button class="btn" data-a="continue" data-focus>Continue run</button><p class="dim" style="margin-top:-4px">' + esc(save) + '</p>' : ''}
        <button class="btn ${save ? 'alt' : ''}" data-a="new" ${save ? '' : 'data-focus'}>New run</button>
        <button class="btn alt" data-a="daily">Daily run${done ? ' · best ' + esc(done) : ''}</button>
        <div class="row2"><button class="btn alt small" data-a="how">How to play</button><button class="btn alt small" data-a="sound">${GK.sfx.muted ? 'Sound off' : 'Sound on'}</button></div>
      </div>
      <p class="dim">Runs ${meta.runs} · Wins ${meta.wins} · Best alley ${meta.bestAlley ? (meta.bestAlley > 8 ? 'Champion' : meta.bestAlley) : '–'} · Best frame ${fmt(meta.bestFrame)}</p>
    </div>`, r => UI.on(r, '[data-a]', el => h[el.dataset.a](el)));
  };

  UI.bagSelect = function (onGo, onBack) {
    let sel = 'classic';
    const draw = () => UI.layer(`<div class="panel">
      <h2>Pick your bag</h2>
      <div class="choices">${GK.STARTER_BAGS.map(b => `<button class="choice" data-b="${b.id}" aria-pressed="${b.id === sel}"><b>${esc(b.name)}</b>
        <span class="balls">${b.balls.map(t => '<i class="sw" style="background:' + GK.BALLS[t].col + '"></i>').join('')}</span><span>${esc(b.desc)}</span></button>`).join('')}</div>
      <div class="seedrow"><input id="seedIn" placeholder="Seed (optional)" maxlength="8" aria-label="Seed"><button class="btn small alt" data-a="back">Back</button></div>
      <button class="btn" data-a="go" data-focus>Start run</button>
    </div>`, r => {
      UI.on(r, '[data-b]', el => { sel = el.dataset.b; r.querySelectorAll('[data-b]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.b === sel))); });
      UI.on(r, '[data-a=go]', () => { const s = $('seedIn').value.trim(); onGo(sel, s ? GK.parseSeed(s) : null); });
      UI.on(r, '[data-a=back]', onBack);
    });
    draw();
  };

  UI.how = function (onBack) {
    UI.modal(`<div class="panel" style="text-align:left">
      <h2>How to play</h2>
      <p><b>Throw in 3 steps:</b> 1) drag on the lane to slide your starting spot, then tap (or press Set). 2) Drag to swing the aim arrow, then tap. 3) The power bar sweeps back and forth: tap to stop it. Land in the green PERFECT zone for a hard, true throw. Push past it and the ball wobbles off line. Keyboard: ←/→ adjust, Space sets, Esc goes back.</p>
      <p><b>Score:</b> every frame scores <span style="color:var(--chips)">Points</span> × <span style="color:var(--mult)">Mult</span>. The shot sets the base (Strike 40×4, Spare 20×3, Split conversion 50×5, Double, Turkey…). Each pin adds 5 Points. Pins knocking over pins, late wobblers and kickback bangs add bonus Points.</p>
      <p><b>Rounds:</b> reach the target within your frames. Each alley has a Qualifier, a Heat and a Boss Match. Miss a target and the run ends.</p>
      <p><b>Re-racks:</b> after a bad first roll, spend a re-rack to reset all pins and take roll one again.</p>
      <p><b>Shop:</b> charms trigger left to right after every frame, so order matters. Balls change the physics. Scorecards level up shots, Lane Tricks change your pins and balls, and the Black Market is powerful but costs you.</p>
      <p><b>Money:</b> clear a round to get paid, plus $1 per unused frame and $1 interest per $5 you hold (max $5).</p>
      <button class="btn" data-a="ok">Got it</button>
    </div>`, r => UI.on(r, '[data-a=ok]', () => { UI.hideModal(); if (onBack) onBack(); }));
  };

  UI.intro = function (run, onGo) {
    const def = GK.alleyDef(run), rs = run.rs, boss = GK.isBoss(run);
    const first = run.round === 0;
    UI.layer(`<div class="panel">
      <div class="lbl">${GK.isChamp(run) ? 'Final' : 'Alley ' + (run.alley + 1) + ' of 8'} · ${esc(def.name)}</div>
      <h2>${esc(GK.roundName(run))}</h2>
      <p>Target <b style="color:var(--marquee)">${fmt(rs.target)}</b> in ${rs.framesMax} frames · ${rs.reracks} re-racks</p>
      ${first || GK.isChamp(run) ? '<p class="dim">' + esc(def.laneDesc) + '</p>' : ''}
      ${boss ? `<div class="boss"><b>${esc(def.boss.name)}</b><p>${esc(def.boss.desc)}</p>${rs.stolen >= 0 && run.charms[rs.stolen] ? '<p class="dim">Stolen: ' + esc(GK.CHARMS[run.charms[rs.stolen].id].name) + '</p>' : ''}</div>` : ''}
      ${!GK.isChamp(run) ? '<p class="dim">Reward: $' + GK.ROUND_PAY[run.round] + ' + $1 per unused frame + interest</p>' : ''}
      <button class="btn" data-a="go" data-focus>${boss ? 'Face the boss' : 'Bowl'}</button>
    </div>`, r => UI.on(r, '[data-a=go]', onGo));
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

  UI.end = function (run, won, onAgain, onTitle) {
    const s = run.stats, rs = run.rs;
    UI.layer(`<div class="panel">
      <h2>${won ? 'Gutter King dethroned!' : 'Run over'}</h2>
      <p>${won ? 'You beat the Championship. The crown is yours.' : 'You finished ' + esc(GK.roundName(run)) + ' at ' + esc(GK.alleyDef(run).name) + ' with ' + fmt(rs ? rs.total : 0) + ' of ' + fmt(rs ? rs.target : 0) + '.'}</p>
      <div class="lines">
        <div><span>Reached</span><b>${GK.isChamp(run) ? 'Championship' : 'Alley ' + (run.alley + 1) + ', ' + GK.roundName(run)}</b></div>
        <div><span>Best frame</span><b>${fmt(s.bestFrame)}</b></div>
        <div><span>Strikes / Spares / Splits</span><b>${s.strikes} / ${s.spares} / ${s.splits}</b></div>
        <div><span>Pins knocked down</span><b>${fmt(s.pins)}</b></div>
        <div><span>Seed</span><b>${GK.seedCode(run.seed)}${run.daily ? ' (daily)' : ''}</b></div>
      </div>
      <div class="row2"><button class="btn" data-a="again" data-focus>New run</button><button class="btn alt" data-a="title">Title</button></div>
    </div>`, r => { UI.on(r, '[data-a=again]', onAgain); UI.on(r, '[data-a=title]', onTitle); });
  };

  UI.levelsHtml = function (run) {
    return '<div class="levels">' + GK.SHOT_ORDER.map(k => { const b = GK.shotBase(k, run.levels); return '<span>' + esc(GK.SHOTS[k].name) + (b.lv ? ' <i>Lv.' + (b.lv + 1) + '</i>' : '') + ' <i>' + b.chips + '×' + b.mult + '</i></span>'; }).join('') + '</div>';
  };
  UI.rackHtml = function (rack, picks, selectable) {
    const rows = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];
    return '<div class="rack">' + rows.map(r => '<div class="rr">' + r.map(n => {
      const t = rack[n - 1], d = GK.PINS[t];
      return `<button class="pinb${t === 'none' ? ' none' : ''}" data-pin="${n}" style="--pc:${d.body || 'transparent'}" aria-pressed="${picks && picks.has(n) ? 'true' : 'false'}" title="${esc(d.name)}" ${selectable ? '' : 'disabled'}>${n}</button>`;
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
    const picks = new Set();
    const draw = () => UI.modal(`<div class="panel">
      <div class="lbl" style="color:${GK.CONS_KIND[k.kind].col}">${esc(k.name)}</div>
      <h2>Pick ${k.picks > 1 ? 'up to ' + k.picks + ' pins' : 'a pin'}</h2>
      <p class="dim">${esc(k.desc)}</p>
      ${UI.rackHtml(run.rack, picks, true)}
      <div class="row2"><button class="btn" data-a="ok" ${picks.size ? '' : 'disabled'}>Apply</button><button class="btn alt" data-a="no">Cancel</button></div>
    </div>`, r => {
      UI.on(r, '[data-pin]', el => {
        const n = +el.dataset.pin; if (k.pinType === 'none' && run.rack[n - 1] === 'none') return;
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
      <div class="choices">${run.bag.map((b, i) => `<button class="choice" data-b="${i}"><b><i class="sw" style="display:inline-block;vertical-align:-2px;background:${GK.BALLS[b.type].col}"></i> ${esc(GK.BALLS[b.type].full)}${b.ed ? ' · ' + GK.EDITIONS[b.ed].name : ''}</b><span>${esc(GK.BALLS[b.type].desc)}</span></button>`).join('')}</div>
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
        <button class="btn small" data-buy="${i}" ${it.sold || !afford ? 'disabled' : ''}>${it.sold ? 'Sold' : 'Buy $' + it.price}</button></div>`;
    };
    const mem = shop.member ? (() => {
      const m = GK.MEMBERSHIPS[shop.member], price = GK.price(run, m.cost);
      return `<div class="item wide" style="--rc:#f2c94c"><span class="k">Alley Membership · permanent</span><span class="n">${esc(m.name)}</span><span class="d">${esc(m.desc)}</span>
        <button class="btn small" data-a="member" ${GK.canAfford(run, price) ? '' : 'disabled'}>Buy $${price}</button></div>`;
    })() : '';
    const charms = run.charms.map((c, i) => { const d = GK.CHARMS[c.id]; return `<button class="chip" data-charm="${i}" style="--rc:${GK.RARITY[d.rarity].col}">${esc(d.name)}${c.ed ? ' <small>' + GK.EDITIONS[c.ed].name + '</small>' : ''}</button>`; }).join('') || '<span class="lbl">No charms yet</span>';
    const balls = run.bag.map((b, i) => `<button class="chip" data-ball="${i}" style="--rc:${GK.BALLS[b.type].col}"><i class="sw" style="background:${GK.BALLS[b.type].col}"></i>${esc(GK.BALLS[b.type].name)}${b.ed ? ' <small>' + GK.EDITIONS[b.ed].name + '</small>' : ''}</button>`).join('');
    const cons = run.cons.map((id, i) => `<button class="chip" data-cons="${i}" style="--rc:${GK.CONS_KIND[GK.CONS[id].kind].col}">${esc(GK.CONS[id].name)}</button>`).join('') || '<span class="lbl">Empty</span>';
    const eq = Object.values(run.equip).filter(id => GK.EQUIP[id]).map(id => GK.EQUIP[id].name).join(', ');
    UI.layer(`<div class="shop">
      <div class="shophead"><div><div class="lbl">Next: ${esc(GK.roundName(run))} · ${esc(GK.alleyDef(run).name)} · target ${fmt(nextTarget)}</div><h2>Pro Shop</h2></div><div class="m">${GK.money(run.money)}</div></div>
      <div class="grid">${shop.items.map(card).join('')}${mem}</div>
      <div class="row2"><button class="btn alt small" data-a="reroll" ${GK.canAfford(run, GK.rerollCost(run)) ? '' : 'disabled'}>Reroll $${GK.rerollCost(run)}</button><button class="btn alt small" data-a="info">Run info</button></div>
      <div class="sect">Charms ${run.charms.length}/${run.maxCharms} · tap to sell or reorder</div><div class="owned">${charms}</div>
      <div class="sect">Bag ${run.bag.length}/${run.maxBag}</div><div class="owned">${balls}</div>
      <div class="sect">Consumables ${run.cons.length}/${run.maxCons}</div><div class="owned">${cons}</div>
      ${eq ? '<div class="sect">Equipment</div><p class="dim" style="margin:0;font-size:13px;color:var(--muted)">' + esc(eq) + '</p>' : ''}
      <button class="btn" data-a="next" data-focus>Next round</button>
    </div>`, r => {
      UI.on(r, '[data-buy]', el => h.buy(+el.dataset.buy));
      UI.on(r, '[data-a=member]', h.member);
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
        <button class="btn alt" data-a="title">Save and quit</button>
        <button class="btn danger small" data-a="abandon">Abandon run</button>
      </div>
    </div>`, r => UI.on(r, '[data-a]', el => h[el.dataset.a](el)));
  };
})();
