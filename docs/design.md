# Gutter Kings — design summary

## Run structure
8 alleys × 3 rounds (Qualifier ×1 target, Heat ×1.5, Boss Match ×2). Miss a target and the run ends. Shop between rounds. After alley 8: the Championship vs the Gutter King.

Each round: 5 Frames (like hands) and 2 Re-racks (like discards). Payout: base + $1 per unused frame + $1 interest per $5 held (cap $5).

## Scoring
Frame score = (shot chips + Σ pin chips + bonus chips) × Mult. Standard pin = 5 chips.

| Shot | Base chips | Base mult |
| --- | --- | --- |
| Open frame | 0 | 1 |
| Spare | 20 | 3 |
| Split conversion | 50 | 5 |
| Strike | 40 | 4 |
| Double | 60 | 6 |
| Turkey | 100 | 8 |
| Gutter | 0 | 0 |

Bonus chips come from physics events: pin-on-pin hits, wall bounces, late-falling pins.

## Balls (bag of 3, pick before each roll)
House, Split, Ghost (passes through first 3 pins), Featherweight (+2 Mult per pin-on-pin hit), Lead (×0.5 chips, flattens pins), Bouncer (+10 chips per wall bounce), Bomb (explodes on 3rd contact), Ice (no hook, shard projectiles), Mirror (mirrored twin), Echo (replays throw at 50%), Glass (×3 Mult, 1 in 4 shatters), Golden ($1 per pin, no chips), Cluster (5 marbles), Black Hole (swallows pins for ×2 chips), Snake (draw its path), Lucky Seven (exactly 7 pins retriggers). Editions: Foil +chips, Holo +mult, Neon ×mult.

## Charms (5 slots, trigger left to right)
Types: +Chips, +Mult, ×Mult, Scaling, Economy, Rule-breakers. Examples: Lucky Shoes, Chalk Bag, League Jacket, Split Personality, Headpin Hunter, Corner Office, Domino Theory, Strike Out, Spare Parts, Overtime, Bumper Kid, Moon Shot, Pin Collector, Thunderclap, Pyromaniac, Butterfingers, Piggy Bank, Loan Shark, Ref's Blind Eye, Graveyard Shift.

Archetypes: Chain Reaction, Spare Specialist, Bank Shot, Demolition, High Roller, Precision, Big Rack.

## Other layers
- Pin collection (deck): Gold, Glass, Lead, Rubber, Explosive, Lucky, Phantom pins.
- Consumables: Scorecards (level shots), Lane Tricks (one-shot effects), Black Market items (powerful with a cost).
- Equipment: Gloves, Shoes, Wrist (feel, not rules).
- Alley Memberships: permanent run upgrades.

## Alleys and bosses
1. Lucky Strike Lanes — The League Secretary (call your shot)
2. The Basement (warped boards) — The Mechanic (resets 2 pins after roll one)
3. Cosmic Bowl (only glowing pins visible) — DJ Strobe (ball goes invisible)
4. The Back Room (narrow lane) — The Bookie (bets half your money per frame)
5. Frostbite Rink (no friction) — Old Man Winter (pins need two hits)
6. Midway Carnival (moving obstacles) — The Ringmaster (lane tilts each frame)
7. Lunar Lanes (low gravity) — The Astronaut (pins respawn randomly)
8. The Gutter — The Gutter King (head-to-head, copies your best charm)

## Roadmap
1. Throw prototype (3–4 weeks) — gate: throwing is fun alone.
2. Vertical slice (2–3 months).
3. Content build (4–6 months).
4. Polish and launch (2–3 months). Premium price, no ads.
