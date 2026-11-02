# Gutter Kings: development notes

Physics-based bowling roguelike for Android. Hit a target score in a limited number of frames, then buy balls, charms and oddities that rewrite the rules. Think Balatro's build-craft + Peglin's satisfying shots + Ballionaire's cascades, on a bowling lane.

The design summary lives in `docs/design.md`.

## Current state

`game/` is the full browser build of the run (vanilla JS + canvas, no build step, portrait, touch-first, installable as a PWA). Open `game/index.html` (works from file://) or `npm run serve` and visit http://localhost:8080 on a phone.

`prototype/index.html` is the original single-file throw-feel prototype, kept for reference.

What the game has:
- Full run: 8 alleys × 3 rounds (Qualifier ×1, Heat ×1.5, Boss Match ×2), then the Championship vs the Gutter King. 5 frames and 2 re-racks per round. Payout $3/$4/$5 + $1 per unused frame + interest ($1 per $5, cap $5).
- Every alley has its lane gimmick and boss from the design doc (Secretary call-your-shot, Mechanic, Cosmic darkness + DJ Strobe, narrow lane + Bookie, ice + Old Man Winter, moving posts + Ringmaster tilt, low gravity + Astronaut scramble, magnetic gutters + Gutter King charm theft, Championship head-to-head).
- All 16 balls from the design doc, ball/charm editions (Foil, Holo, Neon), 36 charms, 8 pin types, 7 Scorecards, 12 Lane Tricks, 5 Black Market items, 6 equipment pieces, 8 Alley Memberships.
- Pro Shop between rounds: 2 charms, 1 ball, 2 goods, a per-alley membership, rerolls, selling, charm reordering.
- Chips × Mult scoring animated step by step; charms fire left to right.
- Seeded runs (seed code on the end screen), daily run, run save/continue, meta stats, procedural WebAudio.

## Code layout (`game/js`, all attach to the global `GK`)

- `core.js` constants, projection, seeded RNG (`GK.stream(seed, tag)` gives independent streams).
- `data.js` all content as data: shots, balls, charms (score hooks), pins, consumables, equipment, memberships, alleys/bosses.
- `physics.js` `GK.Sim`: 2D lane sim, fixed 240 Hz step, emits events (`down`, `first`, `wall`, `pit`, `explode`, `ballBounce`…) and per-roll counters. No DOM.
- `scoring.js` frame pipeline: shot base → rolls (pins, pin types, ball, ball edition) → charms (+edition, Copycat, Lucky Seven retrigger) → round modifiers. Returns animation steps.
- `run.js` run state, targets, flags from charms/memberships, payout, shop, inventory, consumables, saves.
- `frame.js` frame flow: begin frame, launch, after roll (re-rack, retake, Mechanic, third roll), score and commit.
- `render.js`, `audio.js`, `ui.js`, `main.js` browser only (canvas, sound, DOM screens, controller and input).

The logic modules (core, data, physics, scoring, run, frame) load in Node, so whole runs can be simulated headless.

## Tests

- `npm test` unit tests for scoring, rules, physics determinism, shop and consumables.
- `npm run bot` headless bot plays 30 runs and prints where they ended (balance check).
- `npm run e2e` Playwright play-tests in Chromium: a normal run with the shop, then every alley's boss with every ball type. Needs `playwright` resolvable (e.g. `NODE_PATH=$(npm root -g)`).

## Physics tuning constants (`game/js/core.js`, `physics.js`; same values as the prototype)

- World units are inches. Lane compressed to 300in foul line → headpin (real is 720). `ZH=300`, `ZBACK=358`, `ZOIL=200` (oil ends; hook only bites past this).
- Projection: `S0=W/60`, `K=330` (perspective), `Y0`, `YK`.
- Ball mass 6 (Lead 11, Feather 2.4), pin mass 1.5, ball–pin restitution 0.55, pin–pin 0.72.
- Hook: `spin * 200` in/s² in the dry zone, `* 22` in oil.
- Pin topples above 34 in/s; between 5 and 34 it wobbles with a chance to fall late.
- Fallen pin slide decel 520 in/s²; standing pin 1400.
- Throw speed maps to 170–470 in/s from flick speed (canvas heights per second).

## Design rules to keep

- Every throw must be fun with zero upgrades.
- Upgrades change *how* you score, never flat "+10% power".
- Keep bowling vocabulary (strikes, spares, splits, frames, 7-10) as the hooks upgrades hang on.
- Chaos with authorship: wild results should come from setups the player made.
- Art: richly detailed modern pixel art (Eastward / Blasphemous level), not literal N64 3D. Portrait, 360×640 base canvas, integer scaling, 2D lighting.

## Planned stack

Godot 4, Android export. Simulate in 2D top-down, render pseudo-3D pixel art (same approach as the prototype). Data-driven content (balls, charms, pins, bosses as resources) and a scoring event bus (`on_pin_down`, `on_pin_hit_pin`, `on_wall_bounce`, `on_strike`, `on_frame_scored`) that charms subscribe to. Fixed timestep + seeded RNG for replays and daily seeds.

## Next steps

1. Playtest the browser build on real phones; tune targets (`base` per alley in `data.js`) and throw feel.
2. Replace procedural art with hand-made pixel art (the renderer draws everything from `render.js`).
3. Port to Godot 4 for the Android store build, reusing `data.js` as the content source of truth.
