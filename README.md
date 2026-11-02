# Gutter Kings

A physics bowling roguelike: hit the target score in a limited number of frames, then buy balls, charms and oddities that rewrite the rules. Beat 8 alleys and their bosses, then take the crown from the Gutter King.

## Play

**In the browser:** https://quinn1005.github.io/bowling-game/ (works on phones too; add it to your home screen to play fullscreen).

Open `game/index.html` in a browser, or serve it and open it on your phone:

```
npm run serve   # http://localhost:8080
```

On Android Chrome, use "Add to Home screen" to install it as a full-screen app that also works offline.

**Controls:** three steps per throw. Drag to set your starting spot and tap to lock it, drag to set the angle and tap to lock it, then tap to stop the moving power bar (the green zone is a PERFECT throw; past it the ball wobbles). On a keyboard: ←/→ adjust, Space/Enter sets, Esc goes back, 1–3 picks a ball, R re-racks.

### Get the installable APK

Every push runs the **Build Android APK** workflow (`.github/workflows/build-apk.yml`), which publishes a **GitHub Release** named after the version in `game/js/version.js` (for example `v0.3.0`) with `gutter-kings-v0.3.0.apk` attached. Old releases stay on the repo's **Releases** page, so every version is kept.

1. On GitHub, open the repo's **Releases** page (signed in, since the repo is private).
2. Download the `.apk` from the version you want.
3. Open it on your phone and allow installing from unknown sources.

All builds are signed with the same key (`keys/debug.keystore`), so a new version installs over the old one and keeps your save. To release a new version, bump `VERSION` in `game/js/version.js` (and `package.json`) and add a section to `CHANGELOG.md` before pushing. Pushing without a version bump rebuilds the APK and updates that version's existing release.

## Develop

No build step. See `docs/development.md` for the code layout and `docs/design.md` for the design.

```
npm test        # unit tests (Node 18+)
npm run bot     # headless bot plays 30 runs (balance check)
npm run e2e     # browser play-tests (needs Playwright)
```
