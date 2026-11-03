// Gutter Kings — long-term progress (v1.0): bowler XP and levels, cosmetics unlocked by level,
// the collection book and the Regulars' scoreboard. Pure logic over the saved meta object.
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  // ---------- XP and levels ----------
  GK.MAX_LEVEL = 50;
  // XP to go from level L to L+1.
  GK.xpStep = L => 80 + 30 * (L - 1);
  GK.levelOf = function (xp) {
    let L = 1, left = Math.max(0, xp | 0);
    while (L < GK.MAX_LEVEL && left >= GK.xpStep(L)) { left -= GK.xpStep(L); L++; }
    return { level: L, into: left, need: L >= GK.MAX_LEVEL ? 0 : GK.xpStep(L) };
  };
  // What a finished run is worth. Every run earns something, even a quick loss.
  GK.runXP = function (run) {
    const s = run.stats, h = (run.history || []).filter(x => x.won);
    const bosses = h.filter(x => x.round === 2 || x.champ).length;
    const parts = [
      ['Frames bowled', 2 * s.frames], ['Strikes', 3 * s.strikes], ['Spares', 2 * s.spares],
      ['PERFECT throws', s.perfects || 0], ['Rounds cleared', 15 * h.length], ['Bosses beaten', 25 * bosses],
      ['Gutter King dethroned', run.won ? 150 : 0], ['Ascension bonus', run.won ? 25 * (run.asc || 0) : 0]
    ].filter(p => p[1] > 0);
    return { total: parts.reduce((a, p) => a + p[1], 0), parts };
  };
  // Add XP to the meta. Returns { from, to, gained, unlocked: [cosmetics] }.
  GK.addXP = function (meta, xp) {
    const before = GK.levelOf(meta.xp || 0).level;
    meta.xp = (meta.xp || 0) + xp;
    const after = GK.levelOf(meta.xp).level;
    const unlocked = GK.COSMETICS.filter(c => c.level > before && c.level <= after);
    return { from: before, to: after, gained: xp, unlocked };
  };

  // ---------- cosmetics ----------
  // Pure looks, no gameplay effect. Each unlocks at a bowler level.
  GK.COSMETIC_KINDS = { trail: 'Ball trails', pins: 'Pin skins', lane: 'Lane finishes', hats: 'Crowd hats' };
  const C = [];
  const cos = (kind, id, name, level, o) => C.push(Object.assign({ kind, id, name, level }, o || {}));
  // ball trails
  cos('trail', 'none', 'No trail', 1);
  cos('trail', 'sparkle', 'Sparkle', 2);
  cos('trail', 'fire', 'Fire', 4);
  cos('trail', 'bubbles', 'Bubbles', 7);
  cos('trail', 'smoke', 'Smoke', 10);
  cos('trail', 'rainbow', 'Rainbow', 13);
  cos('trail', 'stars', 'Stardust', 17);
  cos('trail', 'hearts', 'Hearts', 21);
  cos('trail', 'pixels', 'Pixel blocks', 25);
  cos('trail', 'lightning', 'Lightning', 30);
  cos('trail', 'ducks', 'Rubber ducks', 36);
  cos('trail', 'comet', 'Comet tail', 42);
  // pin skins: only standard pins change, and only their stripes and a light body tint, so
  // special pins (Gold, Glass, Lead, Lucky...) always stay easy to tell apart.
  cos('pins', 'classic', 'Classic', 1, { body: '#f2ebe0', shade: '#c9bfb2', band: '#c4243a' });
  cos('pins', 'gold_trim', 'Gold Trim', 3, { body: '#f6f0e4', shade: '#cfc4b4', band: '#d8a020' });
  cos('pins', 'mint', 'Mint Stripe', 6, { body: '#f0f6f0', shade: '#c8d4c8', band: '#2a9a6a' });
  cos('pins', 'retro', 'Retro Blue', 9, { body: '#f4ead4', shade: '#d4c6a8', band: '#2a5ad0' });
  cos('pins', 'candy', 'Candy Stripe', 12, { body: '#ffffff', shade: '#e2d6da', band: '#ff4a8a' });
  cos('pins', 'tuxedo', 'Tuxedo', 16, { body: '#f8f6f2', shade: '#d4d0ca', band: '#141018' });
  cos('pins', 'sunset', 'Sunset', 20, { body: '#fbf0e4', shade: '#d8c8b4', band: '#ff7a2a' });
  cos('pins', 'royal', 'Royal Purple', 24, { body: '#f4f0f8', shade: '#d0c8d8', band: '#6a3ac8' });
  cos('pins', 'bone', 'Bone', 28, { body: '#e8dcc0', shade: '#bcae8c', band: '#3a2a20' });
  cos('pins', 'duck', 'Rubber Duck', 33, { body: '#fffaf0', shade: '#d8d0c0', band: '#f2b818' });
  cos('pins', 'galaxy', 'Galaxy', 40, { body: '#eef0ff', shade: '#c4c8e0', band: '#2a2a7a' });
  // lane finishes: a colour wash over the wood
  cos('lane', 'classic', 'Classic wood', 1);
  cos('lane', 'maple', 'Pale maple', 5, { tint: 'rgba(255,236,200,0.35)', mode: 'soft-light' });
  cos('lane', 'walnut', 'Dark walnut', 8, { tint: 'rgba(70,36,16,0.45)', mode: 'multiply' });
  cos('lane', 'cherry', 'Cherry', 11, { tint: 'rgba(190,40,40,0.35)', mode: 'color' });
  cos('lane', 'mint', 'Seafoam', 15, { tint: 'rgba(60,200,160,0.35)', mode: 'color' });
  cos('lane', 'ice', 'Glacier', 19, { tint: 'rgba(80,170,255,0.4)', mode: 'color' });
  cos('lane', 'neon', 'Neon grid', 23, { tint: 'rgba(255,60,220,0.35)', mode: 'color', grid: '#ff6ae8' });
  cos('lane', 'gold', 'Gold leaf', 31, { tint: 'rgba(255,200,40,0.45)', mode: 'color' });
  cos('lane', 'midnight', 'Midnight', 38, { tint: 'rgba(40,40,120,0.5)', mode: 'multiply' });
  // crowd hats for Kaleb, Quinn and Levi
  cos('hats', 'none', 'No hats', 1);
  cos('hats', 'party', 'Party hats', 3);
  cos('hats', 'beanie', 'Beanies', 6);
  cos('hats', 'cowboy', 'Cowboy hats', 9);
  cos('hats', 'tophat', 'Top hats', 14);
  cos('hats', 'propeller', 'Propeller caps', 18);
  cos('hats', 'chef', 'Chef hats', 22);
  cos('hats', 'viking', 'Viking helmets', 27);
  cos('hats', 'bunny', 'Bunny ears', 32);
  cos('hats', 'halo', 'Halos', 37);
  cos('hats', 'crown', 'Crowns', 45);
  GK.COSMETICS = C;
  GK.HAT_GLYPH = { none: '–', party: '🎉', beanie: '🧶', cowboy: '🤠', tophat: '🎩', propeller: '🌀', chef: '🧑‍🍳', viking: '🪓', bunny: '🐰', halo: '😇', crown: '👑' };
  GK.cosmetic = (kind, id) => C.find(c => c.kind === kind && c.id === id) || C.find(c => c.kind === kind);
  GK.cosmeticsOn = meta => Object.assign({ trail: 'none', pins: 'classic', lane: 'classic', hats: 'none' }, (meta && meta.cosm) || {});
  GK.canWear = (meta, c) => GK.levelOf(meta.xp || 0).level >= c.level;

  // ---------- collection book ----------
  // Every ball, charm, pin type and trophy you've come across, with silhouettes for the rest.
  GK.COLLECTION = () => ({
    ball: Object.keys(GK.BALLS),
    charm: GK.CHARM_LIST.map(c => c.id),
    pin: Object.keys(GK.PINS).filter(k => k !== 'none'),
    trophy: Object.keys(GK.TROPHIES || {})
  });
  GK.markSeen = function (meta, run) {
    if (!meta || !run || run.practice) return false;
    const seen = meta.seen = meta.seen || { ball: {}, charm: {}, pin: {}, trophy: {} };
    let added = false;
    const add = (k, id) => { if (id && !seen[k][id]) { seen[k][id] = 1; added = true; } };
    run.bag.forEach(b => add('ball', b.type));
    run.charms.forEach(c => add('charm', c.id));
    GK.padRack(run.rack).forEach(t => add('pin', t !== 'none' ? t : null));
    if (run.rs && run.rs.cur && run.rs.cur.rack) run.rs.cur.rack.forEach(t => add('pin', t !== 'none' ? t : null));
    (run.trophies || []).forEach(t => add('trophy', t.id));
    if (run.shop) run.shop.items.forEach(it => { if (it.kind === 'ball') add('ball', it.id); if (it.kind === 'charm') add('charm', it.id); });
    return added;
  };
  GK.collectionProgress = function (meta) {
    const all = GK.COLLECTION(), seen = (meta && meta.seen) || {};
    let have = 0, total = 0;
    for (const k of Object.keys(all)) { total += all[k].length; have += all[k].filter(id => seen[k] && seen[k][id]).length; }
    return { have, total };
  };

  // ---------- the Regulars' scoreboard ----------
  // Their best frames, to beat. Beat one and they react on the lane TV.
  GK.REGULARS_BOARD = [
    { who: 'kaleb', name: 'Kaleb', frame: 6000 },
    { who: 'levi', name: 'Levi', frame: 25000 },
    { who: 'quinn', name: 'Quinn', frame: 90000 }
  ];
  // Returns the regulars whose best frame this score just beat (once each, ever).
  GK.beatRegulars = function (meta, score) {
    meta.beatRegs = meta.beatRegs || {};
    const out = GK.REGULARS_BOARD.filter(r => score > r.frame && !meta.beatRegs[r.who]);
    out.forEach(r => { meta.beatRegs[r.who] = 1; });
    return out;
  };
})();
