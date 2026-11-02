# Gutter Kings

A physics bowling roguelike: hit the target score in a limited number of frames, then buy balls, charms and oddities that rewrite the rules. Beat 8 alleys and their bosses, then take the crown from the Gutter King.

## Play

Open `game/index.html` in a browser, or serve it and open it on your phone:

```
npm run serve   # http://localhost:8080
```

On Android Chrome, use "Add to Home screen" to install it as a full-screen app that also works offline.

**Controls:** drag sideways to line up, flick up to throw, curve the end of the flick to hook. On a keyboard: ←/→ to aim, Space to throw (Shift+Space hooks), 1–3 to pick a ball, R to re-rack.

## Develop

No build step. See `docs/development.md` for the code layout and `docs/design.md` for the design.

```
npm test        # unit tests (Node 18+)
npm run bot     # headless bot plays 30 runs (balance check)
npm run e2e     # browser play-tests (needs Playwright)
```
