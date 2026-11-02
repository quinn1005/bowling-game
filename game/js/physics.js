// Gutter Kings — 2D top-down lane physics (circles), fixed timestep, seeded RNG, no DOM.
// One Sim per frame: the rack persists between rolls. Everything the scoring cares about is
// recorded as events and counters on sim.roll, and mirrored to sim.onEvent for juice (sound, pops).
'use strict';
var GK = globalThis.GK = globalThis.GK || {};
(function () {
  const C = GK.C;
  const DT = 1 / 240;
  GK.DT = DT;

  function decel(o, a, dt) {
    const v = Math.hypot(o.vx, o.vz); if (v < 0.001) { o.vx = o.vz = 0; return; }
    const nv = Math.max(0, v - a * dt); o.vx *= nv / v; o.vz *= nv / v;
  }
  // Impulse-based circle collision. Positions passed separately so fallen pins can collide at their lying centre.
  function resolve(ax, az, ar, am, a, bx, bz, br, bm, b, e) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
    if (d >= ar + br || d === 0) return 0;
    const nx = dx / d, nz = dz / d, ov = ar + br - d, ia = 1 / am, ib = 1 / bm, it = ia + ib;
    a.x -= nx * ov * ia / it; a.z -= nz * ov * ia / it; b.x += nx * ov * ib / it; b.z += nz * ov * ib / it;
    const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rel > 0) return 0;
    const j = -(1 + e) * rel / it;
    a.vx -= j * ia * nx; a.vz -= j * ia * nz; b.vx += j * ib * nx; b.vz += j * ib * nz;
    return j;
  }
  const overlaps = (ax, az, ar, bx, bz, br) => Math.hypot(bx - ax, bz - az) < ar + br;

  class Sim {
    // o: { lane, rng, rack: [10 pin type ids], layout: 'std'|'random', winter, tilt }
    constructor(o) {
      const L = o.lane || {};
      this.rng = o.rng || GK.makeRng(1);
      this.lhw = L.lhw || C.LHW;
      this.gut = L.magnet ? 12 : C.GUT;
      this.hookDry = L.ice ? 0 : L.lowg ? 130 : 200;
      this.hookOil = L.ice ? 0 : 22;
      this.ballFric = L.ice ? 0.01 : 0.12;
      this.pinDecel = L.ice ? 650 : L.lowg ? 900 : 1400;
      this.fallDecel = L.ice ? 110 : L.lowg ? 240 : 520;
      this.toppleV = L.lowg ? 21 : 34;
      this.lowg = !!L.lowg;
      this.warp = L.warp || 0; this.warpPh = this.rng() * Math.PI * 2;
      this.magnet = !!L.magnet;
      this.tilt = o.tilt || 0;
      this.winter = !!o.winter;
      this.bumpers = false;
      this.posts = L.posts ? [
        { x: 0, z: 150, r: 3.2, amp: 13, w: 1.3, ph: this.rng() * 6.28 },
        { x: 0, z: 235, r: 3.2, amp: 15, w: 0.9, ph: this.rng() * 6.28 }
      ] : [];
      this.time = 0; this.throwT = 0; this.settleT = 0;
      this.balls = []; this.blasts = []; this.fx = [];
      this.rolling = false;
      this.onEvent = null;
      this.rack = (o.rack || new Array(10).fill('std')).slice();
      this.setupPins(o.layout || 'std');
      this.updatePosts();
    }

    emit(ev) { ev.time = this.time; if (this.roll) this.roll.events.push(ev); if (this.onEvent) this.onEvent(ev); }

    setupPins(layout) {
      const spots = layout === 'random' ? this.randomSpots() : GK.spots(this.lhw);
      this.pins = [];
      this.rack.forEach((type, i) => {
        if (type === 'none') return;
        const def = GK.PINS[type] || GK.PINS.std;
        const [x, z] = spots[i];
        this.pins.push({
          n: i + 1, type, sx: x, sz: z, x, z, vx: 0, vz: 0, m: def.m || C.PIN_M,
          toppleV: this.toppleV * (def.topple || 1), e: def.e || 0,
          standing: true, fallen: false, fallT: 0, fd: { x: 0, z: 1 }, wob: 0, wobDir: { x: 0, z: 1 }, fallAt: 0, byPin: false,
          gone: false, cleared: false, clearT: 0, counted: false, drop: 0, hp: this.winter ? 2 : 1,
          swallowed: false, downBy: null, downT: 0, blasted: false, rubberHits: 0
        });
      });
    }
    randomSpots() {
      const out = [], xm = this.lhw - 4;
      for (let i = 0; i < 10; i++) {
        let best = null;
        for (let t = 0; t < 300; t++) {
          const x = (this.rng() * 2 - 1) * xm, z = C.ZH - 4 + this.rng() * (3 * C.ROW + 8);
          if (out.every(([a, b]) => Math.hypot(a - x, b - z) > 6.4)) { best = [x, z]; break; }
        }
        out.push(best || GK.spots(this.lhw)[i]);
      }
      return out;
    }

    standing() { return this.pins.filter(p => p.standing && !p.cleared && !p.gone); }

    // ---------- throw ----------
    // ball: { type, edition }, prm: { aimX, aim, spin, speed, path }, mods: { wide, hook, wild, bumpers }
    launch(ball, prm, mods = {}) {
      const t = ball.type, def = GK.BALLS[t];
      const wide = mods.wide || 1;
      this.bumpers = !!mods.bumpers;
      let spin = prm.spin * (mods.hook || 1);
      if (mods.wild) spin = GK.clamp(spin + (this.rng() * 2 - 1) * 0.9, -1.2, 1.2);
      if (t === 'ice') spin = 0;
      const base = { z: C.BALL_Z0, spin, r: C.BALL_R * wide, m: def.m, type: t, rot: 0, gutter: false, gone: false, contacts: 0, delay: 0, kind: 'main', touched: false, exploded: false };
      const mk = (x, aim, extra) => Object.assign({}, base, { x, vx: Math.sin(aim) * prm.speed, vz: Math.cos(aim) * prm.speed }, extra || {});
      this.balls = [];
      if (t === 'cluster') {
        [-2, -1, 0, 1, 2].forEach(i => this.balls.push(mk(GK.clamp(prm.aimX + i * 2.4, -this.lhw + 2, this.lhw - 2), prm.aim + i * 0.018, { r: 2.3 * wide, m: 1.6, kind: i === 0 ? 'main' : 'marble' })));
      } else {
        let x = prm.aimX;
        if (t === 'mirror') {
          const R = base.r + 0.3;
          if (Math.abs(x) < R) x = x >= 0 ? R : -R;
          this.balls.push(mk(x, prm.aim));
          this.balls.push(mk(-x, -prm.aim, { spin: -spin, kind: 'twin' }));
        } else {
          this.balls.push(mk(x, prm.aim, { ghostLeft: t === 'ghost' ? 3 : 0, ghosted: new Set(), path: t === 'snake' ? prm.path : null }));
          if (t === 'echo') this.balls.push(mk(x, prm.aim, { kind: 'echo', delay: 0.75, m: 3, r: base.r * 0.8 }));
        }
      }
      this.roll = {
        events: [], ball: t, carry: 0, late: 0, walls: 0, pit: 0, ballBounces: 0, explosions: 0, blasted: 0,
        swallowed: 0, firstPin: 0, firstT: -1, rubber: 0, gutterBall: false, contact: false, shattered: false
      };
      this.rolling = true; this.throwT = 0; this.settleT = 0;
    }

    // ---------- events ----------
    topple(p, dir, by) {
      if (!p.standing) return;
      p.standing = false; p.fallen = true; p.fallT = 0; p.fallAt = 0; p.hp = 0;
      const l = Math.hypot(dir.x, dir.z);
      p.fd = l > 0.001 ? { x: dir.x / l, z: dir.z / l } : { x: this.rng() - 0.5, z: 1 };
      const fl = Math.hypot(p.fd.x, p.fd.z) || 1; p.fd.x /= fl; p.fd.z /= fl;
      p.downBy = by; p.downT = this.time;
      if (this.roll) {
        if (by === 'pin') this.roll.carry++;
        if (by === 'late') this.roll.late++;
        if (by === 'blast') { this.roll.blasted++; p.blasted = true; }
      }
      this.emit({ t: 'down', n: p.n, by, x: p.x, z: p.z, type: p.type });
      if (p.type === 'explosive') this.blasts.push({ at: this.time + 0.12, x: p.x, z: p.z, r: 15, pw: 260, src: 'pin' });
    }

    afterHit(p, byPin, j, ball) {
      const v = Math.hypot(p.vx, p.vz);
      if (this.lowg) { p.vx *= 1.18; p.vz *= 1.18; }
      if (p.standing) {
        if (ball && ball.type === 'lead') { this.topple(p, { x: p.vx || ball.vx, z: p.vz || ball.vz }, 'ball'); }
        else if (v > p.toppleV) {
          if (p.hp > 1) {
            p.hp--; p.vx *= 0.12; p.vz *= 0.12; p.wob = 0.6; p.wobDir = { x: 0, z: 1 };
            this.emit({ t: 'crack', n: p.n, x: p.x, z: p.z });
          } else this.topple(p, { x: p.vx, z: p.vz }, byPin ? 'pin' : 'ball');
        } else if (v > 5) {
          p.wob = Math.max(p.wob, Math.min(1, v / p.toppleV));
          p.wobDir = { x: p.vx / v, z: p.vz / v }; p.byPin = byPin;
          if (!p.fallAt && p.hp <= 1 && this.rng() < (v - 5) / (p.toppleV - 5) * 0.85) p.fallAt = this.time + 0.3 + this.rng() * 0.55;
        }
      }
      this.emit({ t: 'clack', v: j / 400 });
    }

    explode(x, z, r, pw, src) {
      if (this.roll) this.roll.explosions++;
      this.emit({ t: 'explode', x, z, src });
      this.fx.push({ k: 'boom', x, z, r, t: 0 });
      for (const p of this.pins) {
        if (p.gone || p.cleared) continue;
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d > r) continue;
        const f = pw * (1 - d / r) + 40, nx = d > 0.01 ? dx / d : this.rng() - 0.5, nz = d > 0.01 ? dz / d : 1;
        p.vx += nx * f; p.vz += nz * f;
        if (p.standing) { p.hp = 1; this.topple(p, { x: nx, z: nz }, 'blast'); }
      }
    }

    pinCenter(p) {
      if (!p.fallen) return [p.x, p.z, C.PIN_R];
      const f = Math.min(1, p.fallT / 0.22);
      return [p.x + p.fd.x * 6 * f, p.z + p.fd.z * 6 * f, 3.0];
    }

    doSplit(b) {
      b.gone = true;
      const sp = Math.hypot(b.vx, b.vz), ang = Math.atan2(b.vx, b.vz);
      for (const s of [-1, 1]) {
        const a = ang + s * 0.32;
        this.balls.push(Object.assign({}, b, { x: b.x + s * 2.6, r: b.r * 0.73, m: b.m / 2, vx: Math.sin(a) * sp * 0.95, vz: Math.cos(a) * sp * 0.95, kind: 'half', type: 'split', gone: false, didSplit: true }));
      }
      this.emit({ t: 'split', x: b.x, z: b.z });
    }
    doShards(b) {
      const sp = Math.max(160, Math.hypot(b.vx, b.vz)), ang = Math.atan2(b.vx, b.vz);
      for (const s of [-0.55, 0, 0.55]) {
        const a = ang + s;
        this.balls.push(Object.assign({}, b, { x: b.x + Math.sin(a) * (b.r + 1.6), z: b.z + Math.cos(a) * (b.r + 1.6), r: 1.6, m: 1.2, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, kind: 'shard', spin: 0, contacts: 0, shard: true, gone: false }));
      }
      b.shattered = true;
      this.emit({ t: 'shards', x: b.x, z: b.z });
    }

    updatePosts() { for (const q of this.posts) q.x = q.amp * Math.sin(this.time * q.w + q.ph); }

    // ---------- step ----------
    step(dt = DT) {
      this.time += dt; this.throwT += dt;
      this.updatePosts();
      const R = this.roll, lhw = this.lhw;
      let fastest = 0;
      for (let bi = 0; bi < this.balls.length; bi++) {
        const b = this.balls[bi]; if (b.gone) continue;
        if (b.delay > 0) { b.delay -= dt; continue; }
        if (b.gutter) {
          const gx = Math.sign(b.x) * (lhw + this.gut / 2);
          b.x += (gx - b.x) * Math.min(1, dt * 12); b.vx = 0; b.z += b.vz * dt;
        } else {
          const dry = b.z > C.ZOIL;
          let ax = b.spin * (dry ? this.hookDry : this.hookOil);
          if (this.warp) ax += this.warp * Math.sin(b.z / 38 + this.warpPh);
          ax += this.tilt;
          if (this.magnet && Math.abs(b.x) > lhw - 7) ax += Math.sign(b.x) * 90;
          if (b.path && !b.touched) {
            const tx = pathX(b.path, b.z + 24);
            if (tx != null) { b.vx = GK.clamp((tx - b.x) * b.vz / 24, -b.vz * 0.6, b.vz * 0.6); ax = 0; }
          }
          b.vx += ax * dt;
          const f = Math.max(0, 1 - (dry ? this.ballFric : this.ballFric * 0.25) * dt);
          b.vx *= f; b.vz *= f;
          b.x += b.vx * dt; b.z += b.vz * dt;
          const bouncy = (b.type === 'bouncer' || this.bumpers) && !b.shard;
          if (bouncy && b.z < C.ZBACK && Math.abs(b.x) > lhw - b.r * 0.4 && Math.sign(b.vx) === Math.sign(b.x)) {
            b.x = Math.sign(b.x) * (lhw - b.r * 0.4); b.vx = -b.vx * 0.85 - Math.sign(b.x) * 15;
            if (R) R.ballBounces++;
            this.emit({ t: 'ballBounce', x: b.x, z: b.z, type: b.type });
          } else if (!bouncy && Math.abs(b.x) > lhw + 0.8 && b.z < C.ZBACK) {
            b.gutter = true;
            if (R && b.kind === 'main' && !R.contact) R.gutterBall = true;
            this.emit({ t: 'gutter', x: b.x, z: b.z, main: b.kind === 'main', early: R ? !R.contact : true });
          }
          for (const q of this.posts) {
            const dx = b.x - q.x, dz = b.z - q.z, d = Math.hypot(dx, dz);
            if (d < b.r + q.r && d > 0) {
              const nx = dx / d, nz = dz / d, ov = b.r + q.r - d;
              b.x += nx * ov; b.z += nz * ov;
              const rel = b.vx * nx + b.vz * nz;
              if (rel < 0) { b.vx -= 1.8 * rel * nx; b.vz -= 1.8 * rel * nz; if (R) R.ballBounces++; this.emit({ t: 'ballBounce', x: b.x, z: b.z, post: true }); }
            }
          }
        }
        const sp = Math.hypot(b.vx, b.vz); fastest = Math.max(fastest, sp);
        b.rot += sp * dt / b.r;
        if (b.z > C.ZBACK + 12 || sp < 6 || b.z < C.BALL_Z0 - 30) b.gone = true;
        if (b.gone || b.gutter) continue;
        if (b.type === 'blackhole') {
          for (const p of this.pins) {
            if (p.gone || p.cleared) continue;
            const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
            if (d < 20 && d > 0.1) { const a = 2400 * (1 - d / 20) * dt; p.vx += dx / d * a; p.vz += dz / d * a; }
          }
        }
        for (const p of this.pins) {
          if (p.gone || p.cleared) continue;
          const [px, pz, pr] = this.pinCenter(p);
          if (b.ghosted && b.ghosted.has(p)) continue;
          if (!overlaps(b.x, b.z, b.type === 'blackhole' ? b.r * 1.5 : b.r, px, pz, pr)) continue;
          if (b.ghostLeft > 0) {
            // Spooked: the pin shivers and may fall late (feeds Late Bloomer).
            b.ghostLeft--; b.ghosted.add(p);
            if (p.standing) {
              const v = Math.hypot(b.vx, b.vz) || 1;
              p.wob = 0.9; p.wobDir = { x: b.vx / v, z: b.vz / v }; p.byPin = false;
              if (!p.fallAt && p.hp <= 1 && this.rng() < 0.55) p.fallAt = this.time + 0.35 + this.rng() * 0.5;
            }
            this.emit({ t: 'ghost', n: p.n, x: p.x, z: p.z });
            continue;
          }
          this.markContact(b, p);
          if (b.type === 'blackhole' && !b.shard) {
            p.swallowed = true; const was = p.standing; p.standing = false; p.fallen = true; p.gone = true; p.downBy = 'swallow'; p.downT = this.time;
            if (R) R.swallowed++;
            b.vx *= 0.93; b.vz *= 0.93;
            if (was) this.emit({ t: 'down', n: p.n, by: 'swallow', x: p.x, z: p.z, type: p.type });
            this.emit({ t: 'swallow', n: p.n, x: p.x, z: p.z });
            continue;
          }
          const j = resolve(b.x, b.z, b.r, b.m, b, px, pz, pr, p.m, p, 0.55);
          if (j > 0) {
            b.contacts++;
            this.afterHit(p, false, j, b);
            if (b.type === 'split' && !b.didSplit) { this.doSplit(b); break; }
            if (b.type === 'ice' && !b.shattered && !b.shard) this.doShards(b);
            if (b.type === 'bomb' && !b.exploded && b.contacts >= 3) { b.exploded = true; b.gone = true; this.explode(b.x, b.z, 19, 300, 'ball'); break; }
          }
        }
      }
      this.fastest = fastest;

      for (const bl of this.blasts) if (!bl.done && this.time >= bl.at) { bl.done = true; this.explode(bl.x, bl.z, bl.r, bl.pw, bl.src); }

      const wall = lhw + this.gut - 1.5;
      for (const p of this.pins) {
        if (p.gone || p.cleared) continue;
        if (p.fallen) { p.fallT += dt; decel(p, this.fallDecel, dt); }
        else {
          decel(p, this.pinDecel, dt);
          p.wob *= Math.exp(-2.5 * dt);
          if (p.fallAt && this.time >= p.fallAt) this.topple(p, p.wobDir, 'late');
          if (p.standing && p.hp <= 1 && Math.hypot(p.x - p.sx, p.z - p.sz) > 3.5) this.topple(p, { x: p.x - p.sx, z: p.z - p.sz }, p.byPin ? 'pin' : 'ball');
          if (p.standing && p.hp > 1) { p.vx *= 0.9; p.vz *= 0.9; }
        }
        p.x += p.vx * dt; p.z += p.vz * dt;
        if (p.z > C.ZH - 14 && Math.abs(p.x) > wall && Math.sign(p.vx) === Math.sign(p.x)) {
          const hard = Math.abs(p.vx) > 25;
          p.x = Math.sign(p.x) * wall; p.vx = -p.vx * 0.55;
          if (hard) { if (R) R.walls++; this.emit({ t: 'wall', n: p.n, x: p.x, z: p.z }); }
        }
        const v = Math.hypot(p.vx, p.vz);
        if (p.z > C.ZBACK) {
          if (p.standing) this.topple(p, { x: p.vx, z: p.vz }, p.byPin ? 'pin' : 'ball');
          p.gone = true; p.standing = false;
          if (R) R.pit++;
          this.emit({ t: 'pit', n: p.n, x: p.x, z: p.z });
        } else if (Math.abs(p.x) > lhw + 1.2 && (v < 60 || p.z < C.ZH - 14)) {
          if (p.standing) this.topple(p, { x: p.vx, z: p.vz }, p.byPin ? 'pin' : 'ball');
          p.gone = true; p.standing = false;
        }
      }

      const pins = this.pins;
      for (let i = 0; i < pins.length; i++) {
        const a = pins[i]; if (a.gone || a.cleared) continue;
        for (let k = i + 1; k < pins.length; k++) {
          const b = pins[k]; if (b.gone || b.cleared) continue;
          if (a.type === 'phantom' || b.type === 'phantom') continue;
          const va = Math.hypot(a.vx, a.vz), vb = Math.hypot(b.vx, b.vz);
          if (va < 1 && vb < 1) continue;
          const [ax, az, ar] = this.pinCenter(a), [bx, bz, br] = this.pinCenter(b);
          const e = Math.max(0.72, a.e, b.e);
          const j = resolve(ax, az, ar, a.m, a, bx, bz, br, b.m, b, e);
          if (j > 0) {
            if (va >= vb) this.afterHit(b, true, j); else this.afterHit(a, true, j);
            if ((a.type === 'rubber' || b.type === 'rubber') && j > 30) {
              const rp = a.type === 'rubber' ? a : b;
              if (rp.rubberHits < 6) { rp.rubberHits++; if (R) R.rubber++; this.emit({ t: 'rubber', n: rp.n, x: rp.x, z: rp.z }); }
            }
          }
        }
      }
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter(f => f.t < 0.6);

      if (this.rolling) {
        const ballsDone = this.balls.every(b => b.gone);
        const quiet = pins.every(p => p.gone || p.cleared || (Math.hypot(p.vx, p.vz) < 2.5 && (p.fallen ? p.fallT > 0.3 : (!p.fallAt && p.wob < 0.06))));
        const blastsDone = this.blasts.every(b => b.done);
        this.settleT = ballsDone && quiet && blastsDone ? this.settleT + dt : 0;
        if (this.settleT > 0.4 || this.throwT > 10) this.rolling = false;
      }
    }

    markContact(b, p) {
      b.touched = true;
      const R = this.roll;
      if (R && !R.contact) { R.contact = true; R.firstPin = p.n; R.firstT = this.time; this.emit({ t: 'first', n: p.n, x: p.x, z: p.z }); }
    }

    // Run a whole roll headless (tests, bots). Call summarize() (or GK.afterRoll) afterwards.
    simulate(maxT = 12) {
      let t = 0;
      while (this.rolling && t < maxT) { this.step(DT); t += DT; }
      this.rolling = false;
      return this;
    }

    // Count pins knocked down this roll (marks them counted) and return the roll record.
    summarize() {
      const R = this.roll;
      const newly = this.pins.filter(p => !p.standing && !p.counted);
      newly.forEach(p => { p.counted = true; });
      const fast = R && R.firstT >= 0 ? newly.filter(p => p.downT - R.firstT <= 0.5).length : 0;
      return {
        ball: R ? R.ball : 'house',
        down: newly.map(p => ({ n: p.n, type: p.type, by: p.downBy, swallowed: p.swallowed, blasted: p.blasted, rubber: p.rubberHits })),
        pins: newly.length,
        carry: R ? R.carry : 0, late: R ? R.late : 0, walls: R ? R.walls : 0, pit: R ? R.pit : 0,
        ballBounces: R ? R.ballBounces : 0, explosions: R ? R.explosions : 0, blasted: R ? R.blasted : 0,
        swallowed: R ? R.swallowed : 0, firstPin: R ? R.firstPin : 0, fast, rubber: R ? R.rubber : 0,
        gutterBall: R ? (R.gutterBall && newly.length === 0) : false,
        standing: this.standing().map(p => p.n)
      };
    }

    // Clear fallen pins off the deck (the sweep bar) and settle standing ones where they are.
    sweep() {
      for (const p of this.pins) {
        if (!p.standing) { if (!p.cleared) { p.cleared = true; p.clearT = 0; } }
        else { p.vx = p.vz = 0; p.wob = 0; p.fallAt = 0; p.sx = p.x; p.sz = p.z; }
      }
      this.balls = []; this.blasts = [];
    }
    // Stand specific pins back up on their spots (The Mechanic, Ref's retake).
    standUp(nums) {
      const spots = GK.spots(this.lhw);
      for (const p of this.pins) {
        if (!nums.includes(p.n)) continue;
        const [x, z] = this.layoutSpot ? this.layoutSpot(p.n) : spots[p.n - 1];
        Object.assign(p, { x: p.origX != null ? p.origX : x, z: p.origZ != null ? p.origZ : z, vx: 0, vz: 0, standing: true, fallen: false, fallT: 0, gone: false, cleared: false, counted: false, drop: 0, wob: 0, fallAt: 0, swallowed: false, blasted: false, downBy: null, hp: this.winter ? 2 : 1 });
        p.sx = p.x; p.sz = p.z;
      }
    }
    rememberLayout() { for (const p of this.pins) { p.origX = p.sx; p.origZ = p.sz; } }
    // Restore the exact standing/fallen state captured by snapshot() (retaking a gutter ball).
    snapshot() { return this.pins.map(p => Object.assign({}, p)); }
    restore(snap) { this.pins = snap.map(p => Object.assign({}, p)); this.balls = []; this.blasts = []; }
  }

  function pathX(path, z) {
    if (!path || path.length < 2) return null;
    if (z <= path[0].z) return path[0].x;
    for (let i = 1; i < path.length; i++) {
      if (z <= path[i].z) { const a = path[i - 1], b = path[i]; return a.x + (b.x - a.x) * (z - a.z) / Math.max(0.001, b.z - a.z); }
    }
    return path[path.length - 1].x;
  }

  // Snake Ball: an S-curve that weaves around the aim line.
  function snakePath(aimX, aim, lhw) {
    const out = [], lim = (lhw || C.LHW) - 2;
    for (let z = 0; z <= 300; z += 10) {
      const amp = 9 * Math.min(1, z / 60);
      out.push({ z, x: GK.clamp(aimX + Math.tan(aim) * (z - C.BALL_Z0) + amp * Math.sin(z / 300 * Math.PI * 3), -lim, lim) });
    }
    return out;
  }

  GK.Sim = Sim;
  GK.pathX = pathX;
  GK.snakePath = snakePath;
})();
