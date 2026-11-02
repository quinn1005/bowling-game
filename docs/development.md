# Gutter Kings: development notes

Physics-based bowling roguelike for Android. Hit a target score in a limited number of frames, then buy balls, charms and oddities that rewrite the rules. Think Balatro's build-craft + Peglin's satisfying shots + Ballionaire's cascades, on a bowling lane.

The design summary lives in `docs/design.md`.

## Current state

`prototype/index.html` is a single-file browser prototype (canvas + vanilla JS, no build step). Open it in a browser to play. It exists to test whether throwing feels good before committing to an engine.

What it has:
- One lane, portrait, rendered at 200×356 and scaled up pixelated.
- Swipe controls: drag sideways to line up, flick up to throw, curve the flick to hook.
- 2D top-down physics (circles) with pseudo-3D rendering. Pins wobble, fall late, carry into each other, bounce off kickbacks, drop into gutters and the pit.
- Chips × Mult scoring with the shot table (Strike, Double, Turkey, Spare, Split conversion, Open, Gutter).
- Ball bag: House, Featherweight, Lead, Split.
- Three rounds: Qualifier (700), Heat (1,100), Boss Match vs The Mechanic (1,500).
- WebAudio sound, scorecard, pin monitor, best score in localStorage.

## Prototype tuning constants (top of the script)

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

1. Tune throw feel in the prototype (hook strength, pin scatter, carry).
2. Port the throw + physics to Godot 4 and test on a real Android phone.
3. Vertical slice: Alley 1 with three rounds and a boss, shop, 8 balls, 25 charms, 5 pin types.
