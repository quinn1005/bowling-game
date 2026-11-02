# Changelog

## v0.6.1

### Changed
- **Back to crisp pixel art, but better.** The lane is drawn on a pixel grid twice as fine as before and scaled up with hard square pixels: no smoothing, no blurry gradients. Lighting on the wood, the oil sheen and the darkness of Cosmic lanes use dithered, stepped pixel shading. Pins, balls, shadows, the crowd and the ball return are drawn pixel by pixel with outlines and shading, and the text on the lane (score pops, the neon sign, the TV) is crisp pixel text.
- **Bowling pins look like real pins:** two thin red stripes around the neck with white between them, instead of a single red blob. The stripes turn with the pin when it falls.

## v0.6.0

### New look
- **New fonts.** Bungee (a bowling-alley sign face) for titles and Rubik for everything else, replacing the hard-to-read pixel fonts.
- **Bigger lane.** The header, score boxes, charm row, controls and scorecard are all more compact, and the lane now scales to fill the space, so it takes up much more of the screen.
- **Sharper, richer graphics.** The lane is drawn at 3× resolution: glossy lane lighting with a warm pool of light on the pin deck, rounded gutters, smoother pins with soft shadows, shaded balls with a reflection on the lane, a glowing neon sign and marquee bulbs, themed art above the pins for every alley, a patterned carpet, a vignette, and a redrawn crowd.
- **Polished UI.** Rounded panels and buttons, clearer meters for every slider, a menu button, and new pill counters for frames, Groove, re-racks and money.
- **Smoother animations everywhere.** Banners slide in and fade out, score boxes pulse smoothly, charms bounce when they fire, screens fade in, and the progress bar glides.
- **Pop-ups stay up longer.** Messages now queue instead of replacing each other and stay up long enough to read (longer messages stay longer). Score pops on the lane last about twice as long.

### New features
- **Boss pools.** Every alley now has two bosses and each run meets one of them. New bosses: The Janitor, The Landlord, The Fog Machine, The Enforcer, The Snow Golem, The Strongman, The Comet and The Gutter Rats.
- **Skip a round.** Skip a Qualifier or Heat for its reward tag (cash, a shop coupon, a free charm, two shot level-ups, a Lane Trick or a free re-drill). You get no score, pay or shop for that round.
- **Events between rounds.** Sometimes you meet the Lost & Found, a vending machine, a shady bowler or the lane mechanic before the shop.
- **Ball drilling.** Re-drill a ball at the Pro Shop: Strong (hooks more), Control (hooks less) or Skid-flare (skids through oil, snaps on dry boards).
- **Lane surprises.** Now and then a frame starts with a power flicker, a sticky approach or a fresh oil top-up (never in Boss Matches).
- **Endless mode.** After beating the Gutter King, keep bowling: the alleys come around again with targets that keep climbing. Your best Endless depth shows on the title screen.
- **Practice lane.** Free bowling on any alley with no target and no shop, to learn each oil pattern. "Fresh oil" in the menu resets the lane.
- **Tutorial tips.** Your first throws walk you through each slider, and tips pop up the first time you see Groove, a dried-out line, a jammed ball, a pinsetter fumble, a lane surprise, a boss or the shop. Turn them off (or reset them) in the menu.
- **Music.** A generated chiptune loop for every alley, faster and louder in Boss Matches. Toggle it in the menu.
- **Vibration.** A short buzz on PERFECT taps, first contact, strikes, gutters and explosions (Android app and Android browsers). Toggle it in the menu.
- **Big TV.** Tap the lane TV to watch its cartoons full size.

### Fixed
- **No more do-overs by quitting.** The game now saves after every throw. Quitting mid-frame and continuing puts you back exactly where you were, and a throw that was already rolling plays out again.
- The Midway Carnival posts no longer bat the ball repeatedly into the gutter, and the Ringmaster's tilt is now strong but beatable by angling against it.
- The Enforcer can't push your money below $0.

## v0.5.2

### Changed
- **No more do-overs mid-throw.** The Back button is gone (and Esc no longer steps back). Once you stop a slider, that part of your throw is locked in, so a mistimed start, angle or power tap sticks.

## v0.5.1

### Changed
- **Every step of a throw is now timed.** The ball slides back and forth across the approach: tap to stop it on your starting spot. Then the aim arrow swings side to side: tap to lock your angle. Then the power bar and hook dial as before. Tap anywhere on the lane or press Set; on a keyboard, Space taps and Esc goes back.
- Anchor Shoes now slow the angle slider, and Slide Shoes widen how far it swings.
- **Pinsetter fumbles never give you a strike.** If the pinsetter drops the last pin (or pins) you left standing, it's a free Spare instead. The scorecard shows the pinsetter's pins as a second roll.

## v0.5.0

### New
- **Ball return.** Your balls now sit on a ball return at the right side of the approach. Tap a ball on the return to throw it (number keys still work). The old ball buttons under the lane are gone, which leaves more room for the lane.
- **Jammed balls.** Now and then (6% of throws) the ball you just threw gets stuck in the return. It flashes STUCK in the hood, and you have to throw a different ball before it comes back.
- **Pinsetter fumbles.** Once in a while (5% of frames) the pinsetter fumbles after your first ball and drops one or two of the pins you left standing. They count as knocked down by that ball, so a fumble can even turn into a strike.
- **Lane TV.** A TV beside the lane plays short pixel cartoons: pins flying off and a victory dance for strikes, two balls high-fiving for a Double, a strutting turkey for a Turkey, a pin waving a white flag (then fainting) or a fist pump for spares, a pin doing the splits for split conversions, and the 7 and 10 pins hugging for a 7-10.
- **Oil breaks down.** Every ball strips oil from the boards it rolls over and carries a little past the end of the pattern. Throw the same line over and over and it dries out: the boards lose their blue sheen and turn brown, and your ball starts hooking earlier. The lane is freshly oiled every round.

## v0.4.0

### New
- **Hook dial.** Every throw now has a 4th step: after the power bar, tap to stop a sweeping hook dial. Left curves the ball left, right curves it right.
- **Harder timing.** The power bar sweeps much faster and the PERFECT zone is half as wide.
- **Groove.** PERFECT throws in a row build Groove. Each stack adds +1 Mult to every frame until you miss the zone.
- **Oil patterns you can see.** Each alley has its own oil pattern (House Shot, Short Oil, Shark Stripes, Sport Flat, Black Ice, Long Oil), drawn on the lane as a blue sheen. The ball skids through oil and hooks on dry boards.
- **Leagues.** Pick a league before a run: Open, Bumper, Senior, Speed, Cosmic or Pro Tour, each with its own twist.
- **Unlocks.** 19 feats (like "Convert the 7-10" or "5 PERFECT throws in a row") unlock new balls, charms and leagues. See them under Feats & unlocks on the title screen.
- **Ascension.** Beat the Gutter King to unlock Ascension levels 1-8. Each level stacks a new rule (higher targets, pricier shop, fewer re-racks, the Mechanic in every Heat, smaller PERFECT zone and more).
- **Bigger racks.** Back-Row Pins add pins 11-13 behind the rack. Shrink Ray makes Tiny Pins and Loose Screws makes Wobbly Pins.
- **New charms:** Rebound, Pin Whisperer, Chain Gang, Shoes of Destiny.
- **New balls:** Magnet, Tiny and Giant.
- **New equipment:** Hook Glove (slower hook dial).
- **Slow-motion replays** of strikes and 7-10 conversions (tap to skip; can be turned off in the menu).
- **The end screen tells your run's story:** every round's score, your best frame with a replay, and for daily runs a result you can copy and share. Your daily results are listed under Feats & unlocks.
- **A crowd** in the front corners cheers strikes, claps spares and groans at gutters.

### Rebalanced (much harder)
- Targets are higher and climb faster: Alley 1 starts at 500 and Alley 8 at 150,000; Boss Matches are ×2. The Championship is 420,000.
- Shot values lowered: Strike 30×3, Double 45×4, Turkey 70×5, Spare 15×2, Split 40×4. Scorecard levels give less.
- Bonus Points lowered (carry +2, late fall +3, kickback +1).
- Every charm is weaker and most cost more. ×Mult charms are smaller (Tenth Frame ×2, Hot Streak +×0.25 per strike, Butterfingers ×1.5, Sniper ×2).
- Editions: Foil +30 Points, Holo +6 Mult, Neon ×1.4.
- Balls cost $1 more; Glass Ball ×2, Featherweight +1 Mult per carry, Bouncer +6 Points per bounce.
- Special pins are weaker (Glass ×1.25, Lucky 1 in 4 for +5 Mult, Lead and Explosive pins 15 and 12 Points).
- Economy: round pay $2/$3/$4, interest capped at $4, rerolls start at $6 and rise by $2, memberships $12, Scorecards $4, Lane Tricks $5.
- The League Secretary is fairer: a wrong call now halves Mult instead of wiping the frame.

## v0.3.1

### New: play in the browser
- Gutter Kings can be played in any web browser, including on iPhone: https://quinn1005.github.io/bowling-game/
- Every push that changes the game republishes the web version (`.github/workflows/pages.yml`).
- On Android Chrome or iPhone Safari, add it to your home screen to play fullscreen like an app.

## v0.3.0

### New
- **Android app.** Every push now builds an installable APK and publishes it on the repo's Releases page, the same way as Neon Bastion.
- The game's version is shown on the title screen.

## v0.2.0

### New
- **New throwing controls.** Each throw is three steps: drag to set your starting spot, drag to set the angle, then tap to stop the sweeping power bar. The green PERFECT zone gives a hard, straight throw; going past it makes the ball wobble off line.
- Equipment reworked around the new controls: Steady Glove slows the power bar, Wrist Brace widens the PERFECT zone, Snap Wrist stops overpowered throws from wobbling, and shoes change how far and how finely you can angle.
- Snake Ball now weaves in an S-curve along your aim line.

### Changed
- **Chips are now called Points** everywhere in the game.

## v0.1.0

### New
- The full run: 8 alleys with 3 rounds each and a boss, then the Championship against the Gutter King.
- 16 balls, 36 charms, 8 pin types, Scorecards, Lane Tricks, Black Market items, equipment and Alley Memberships.
- Pro Shop between rounds, seeded and daily runs, save and continue.
