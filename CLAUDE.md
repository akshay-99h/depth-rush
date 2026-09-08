# Working on Depth Rush

Read this before changing anything. It is the contract for AI sessions on this repo:
the rules that will silently disqualify the build if broken, and the traps that have
already caught someone.

Deeper context: `docs/implementation.md` (how it works) · `docs/build-log.md` (how it was
made) · `docs/verification.md` (how to prove a change is sound).

---

## 1. Hard rules — breaking these disqualifies the submission

This is a Meta Horizon Creator Competition prototype. Non-negotiable:

1. **No external network request at runtime.** No CDN, no webfonts, no analytics, no
   remote assets. Three.js is vendored in `vendor/`; every procedural texture is drawn
   into a canvas at load. If you need a font or a library, vendor it.
2. **A single `index.html` at the zip root, unminified.** No bundler, no build step, no
   transpiler. Plain ES modules with relative paths.
3. **≤35MB zipped.** The art is delivered at 1x–4x; ship only the tier each asset needs.
4. **Portrait, single-player.**
5. **The design doc is anonymous** — including document metadata, not just prose.

**`tools/package.sh` enforces 1–3 and fails the build on violation. Never weaken it to
make a build pass.** It has already refused a 139MB zip that would otherwise have reached
a judge.

```bash
./tools/package.sh          # build + audit; writes dist/
python3 tools/serve.py 5173 .   # dev server — see §4
```

---

## 2. Conventions

- **All tunables live in `src/config.js`.** Balance there, never in a system. If you find
  yourself typing a number into `game.js`, it belongs in config.
- **Levels are data** (`src/levels.js`). `applyLevel()` mutates the live `CONFIG` and
  `PALETTE`. Modules cache `const W = CONFIG.world` — that is the *same object*, so the
  cache stays valid. **Mutate `CONFIG`; never replace it.**
- **One-way dependencies.** `game.js` never imports `main.js`.
- **Comments explain *why*, not *what*.** The codebase documents non-obvious decisions
  and the bugs behind them. Match that; do not narrate the syntax.
- **Everything the player must reach is measured with `reach()`**, which ignores Z in
  planar mode. Collision stays 3D.

---

## 3. Verify before claiming

Use the `globalThis.DepthRush` hook (`docs/verification.md`). Two standing rules:

- **Autopilots drive the sticks.** `moveTo()` is setup only. A teleporting bot proves
  nothing about whether a level is completable.
- **Isolate enemies by emptying `level.enemies`**, not by parking them off-map — the
  world clamp drags them back.

After any gameplay change, re-run the 9-level × 3-pass completion check.

---

## 4. Traps that have already caught someone

| Trap | Symptom | Reality |
|---|---|---|
| `python3 -m http.server` | `does not provide an export named X` after an edit | Browsers heuristically cache ES modules. **Use `tools/serve.py`** — it sends `no-store`. |
| `startLevel()` is async + re-entrancy guarded | Every level reports as `shelf-1` | The guard latches until the briefing is dismissed. Click `#btn-alert-ok` between levels. |
| Scene built once | A 60m dive renders the 28m world | `createScene()` once; `buildEnvironment()` **per level**. |
| Camera collision in planar mode | Camera collapses onto the diver | Objective boulders sit *on* the plane by necessity. Scenery spawns behind it, so the line is clear by construction — do not re-add the test. |
| Grepping `vendor/` for `fetch` | Build fails on Three.js loader code | Those loaders are never called. Prove no-network **behaviourally**, by reading the network log. |
| A defensive `??` fallback | Broken code looks like working code | A missed rename once made every level silently run 5 targets. Assert, don't default, when a value is required. |
| Value noise tiled unblurred | Visible lattice across the seabed | Blur before tiling. |

---

## 5. Design positions — change them deliberately, not by accident

These were argued for and are easy to undo without noticing:

- **Score banks only at the boat.** Parts in hand are lost with the diver. Without this
  there is no cost to dying.
- **No dive-up button.** The swim home *is* the core bet. Navigation help (the sonar
  switching to a bearing on the boat below 35% air) is the intended answer instead.
- **Training objectives never gate progress** and pay only on a finished run.
- **Two dive controls.** If you are adding a third, re-read §3 of
  `docs/implementation.md` first — the 2.7D plane exists specifically to avoid it.
- **Enemies keep swimming while the diver is aboard.** Passing `p = null` to
  `_updateEnemies` is what stops a shark parking under the hull.

---

## 6. Current known risk

**All dives are locked again.** A fresh save leaves 8 of 9 locked; only `shelf-1` is
selectable. The star system reintroduced sequential unlocking, reversing an earlier
decision to open everything so a judge sees more than one objective and one biome.
One line in `isUnlocked()` (`src/levels.js`).
