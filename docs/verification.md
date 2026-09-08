# Depth Rush — Verification

How claims about this build were checked. The point of this file is that nothing in the
build log has to be taken on trust: each number below came from a measurement that can be
re-run.

**Nothing here replaces a real-device playtest.** See *Still needs a human*.

---

## The harness

`src/main.js` exposes `globalThis.DepthRush` — a playtest hook that can drive the
simulation deterministically from the browser console, with no rendering dependency:

| Call | Does |
|---|---|
| `step(dt, n)` | Advance the sim `n` frames — decoupled from `requestAnimationFrame` |
| `stick(x, y, m)` | Drive the move stick, as a thumb would |
| `lookAt(yaw, pitch)` / `boost(on)` | Aim; hold boost |
| `moveTo(x, y, z)` | Teleport — setup only, never used to prove reachability |
| `startLevel(id)` / `begin()` | Load a dive |
| `state` / `level` / `levelDef()` | Read state, generated world, declaration |
| `minimap` / `hud` | Force a redraw for inspection |

Two rules kept the results honest:

1. **Autopilots drive the sticks.** Anything claiming a level is *completable* swims
   there. `moveTo` is setup only — a teleporting bot proves nothing about reachability.
2. **Isolate by removal, not by parking.** An early test parked enemies at
   `x = 900`; the world clamp dragged them straight back and they ate the diver, so the
   run failed for the wrong reason. Isolation now empties `level.enemies`.

---

## Measured results

Recorded against the code at the time of each session — this is a chronological log, not
a claim about the current tree.

### Completability

| Check | Result |
|---|---|
| All 9 dives, 3 passes each, stick-driven autopilot | **27/27** |
| Buried spawns (item inside a boulder) over 40 seeds | **0** |
| Declared goal = generated targets = `partsTotal`, all 9 | **match** |
| `vent-3` (all five parts sealed in rock) | completes |

### Controls and camera

| Check | Result |
|---|---|
| Stick-up rise / stick-right traverse (2.7D) | 3.70m / 3.87m, Z held on plane |
| Dive movement controls on screen | **2** (stick + boost) |
| Camera penetration, 780 samples over 3 levels | **0** (worst 0.25m clear) |
| Scenery in front of the play plane | **0** across 3 sampled levels |

### Balance

| Check | Result |
|---|---|
| Shark facing flips over a 4s pursuit | **0** (was strobing every frame) |
| Escape without boost, 12 trials | caught **12/12** |
| Escape with boost, 12 trials | shakes pursuit **12/12** |
| Oxygen drain while drilling | exactly **2×** base |
| Honest autopilot ignoring spare tanks and boost | wins 4/8, loses 3 to a dry tank |

That last row is the useful one: a bot that never manages its air *should* mostly drown.

### Rules compliance

| Check | Result |
|---|---|
| Requests during gameplay | **0** — every request is a same-origin module load at startup |
| Absolute URLs outside `vendor/`, in the shipped zip | **0** |
| Network APIs outside `vendor/`, in the shipped zip | **0** |
| Minified files in the zip | **0** |
| Zip size | **28MB** / 35MB |
| Design doc | 489 words / 500 · no images · no author metadata |

**The no-network check is behavioural, not `grep`.** Three.js *contains* `fetch` and
`XMLHttpRequest` in loaders the game never calls, so grepping `vendor/` would fail the
build over code that never runs. `tools/package.sh` deliberately greps only `index.html`
and `src/`; the real proof is playing the game and reading the browser's network log.

The zip is audited **unpacked**, not the working tree — those can differ.

---

## Known harness limitation

`startLevel()` became async, with a re-entrancy guard, and awaits the intro and briefing
screens before starting a run. **An automated loop that calls `startLevel()` repeatedly
without dismissing the briefing silently gets one level.** The guard stays latched, later
calls return immediately, and every dive reports as `shelf-1`.

This produced a convincing false alarm — nine "wins" that were all level 1. Worth stating
plainly because the failure mode looks exactly like a real regression.

A correct loop must, per level: call `startLevel(id)`, click `#btn-alert-ok`, then wait a
frame before reading `game.state`.

Re-verified manually after the async change: `vent-3` applies correctly — `haul`, goal 5,
seabed −60m, 5 crates, all three enemy types.

---

## Still needs a human

1. **Real-device playtest.** The control scheme was rebuilt around thumb feel. Nothing
   above measures that.
2. **Tilt-to-swim direction.** Verified only with injected readings — no motion sensor in
   a desktop browser. If tipping the phone away swims backward, it is one sign flip in
   `src/tilt.js`.
3. **Audio.** Synthesised at runtime and confirmed to fire, but not listened to.
