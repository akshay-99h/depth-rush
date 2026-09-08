# Depth Rush — Implementation

How the build is put together, and why it is put together that way. Paired with
`docs/build-log.md` (how it was made) and `docs/verification.md` (how claims were checked).

Vanilla ES modules, one vendored dependency (Three.js r185), no build step. `index.html`
at the repo root **is** the app.

---

## 1. The constraints that shaped everything

Four competition rules drove more architecture than any design decision:

| Rule | Consequence |
|---|---|
| No external network request at runtime | Three.js is **vendored**, not CDN-loaded. Every texture is drawn procedurally into a canvas at load. No webfonts — system stack only. |
| Single `index.html` at the zip root, unminified | No bundler, no build step. Plain ES modules with relative paths. |
| ≤35MB zip | Asset scale chosen **per asset**, not globally. `tools/package.sh` fails the build over the limit. |
| Design doc anonymous | `tools/make-docx.js` writes empty `creator`/`lastModifiedBy` rather than letting the toolchain stamp the machine's user name. |

`tools/package.sh` is the enforcement point, not a convenience: it refuses to produce a
zip that breaks any of these.

---

## 2. Module map

```
index.html          all screens as DOM layers, plus the styles
src/
  main.js           screen flow, wiring, the frame loop
  game.js           the simulation — both modes, one clock
  config.js         every tunable in one object
  levels.js         9 dives as data, progression, training objectives
  world.js          scene, per-level environment, level generation
  enemies.js        3 threat models, meshes and idle animation
  boat.js           the Riverside Workboat, re-aimed for the game
  textures.js       every surface, drawn into a canvas at load
  assets.js         delivered-art URLs, hydration, preloading
  landing.js        landing scene composed from delivered sprites
  hud.js            DOM HUD bindings
  minimap.js        top-down sonar plot with fog of war
  joystick.js       sticks, drag-look, hold buttons, keyboard
  tilt.js           optional tilt-to-swim
  audio.js          runtime-synthesised SFX — no audio files
  parts.js, rng.js  named parts; seeded RNG
vendor/three.*      Three.js r185, unminified
tools/              package.sh · make-docx.js · serve.py
```

**Dependency direction is one-way.** `game.js` never imports `main.js`; `levels.js`
mutates `CONFIG` rather than calling into systems. Nothing imports `hud.js` except
`main.js`.

---

## 3. The 2.7D model

The single most important structural decision.

Movement is locked to a vertical plane — **X across, Y depth** — while the world stays
fully 3D around it. `CONFIG.play.planar` gates it; setting it `false` restores free 3D
swimming, which is still implemented.

The reason is control, not rendering. On a plane the stick maps **directly** onto
movement: push up, go up. In free 3D, changing depth meant pitching with a look stick and
then pushing forward with a move stick — two thumbs for one intention. Planar movement
removes the reason for the second stick, so dive is two controls.

Three rules keep the plane honest, and each exists because breaking it caused a real bug:

1. **Gameplay proximity ignores Z.** The player cannot steer in Z, so Z must not count
   against reaching something. One `reach()` helper in `game.js`; collision stays 3D.
2. **Scenery spawns only *behind* the plane.** Otherwise half of it sits between the
   camera and the diver.
3. **No camera collision in planar mode.** Rule 2 guarantees a clear line by
   construction, and the only remaining candidates are the objective boulders that must
   sit *on* the plane — testing against those collapsed the camera onto the diver.

---

## 4. Levels as data

`src/levels.js` holds three biomes × three dives. Applying one **mutates the live
`CONFIG` and `PALETTE` objects**, so every system picks up the new numbers without
knowing a level system exists.

```js
applyLevel(level)   // CONFIG.world, .spawn, .depthFade, .enemies, .objectiveKind …
```

This is why modules cache `const W = CONFIG.world` at import: they hold the *same object*
that `applyLevel` mutates, so the cache stays correct.

Because the environment's size depends on the level, scene construction is split:

- `createScene()` — once. Scene, fog, lights.
- `buildEnvironment(scene)` — per level. Bed, surface, caustics, shafts, kelp, boulders.
  Removes anything tagged `userData.env` first.

Skipping that split was a bug that nearly shipped: a 60m dive would have rendered the
28m world.

### Objectives

Three jobs share every underlying system and differ in the *shape of the trip*:

| Job | Shape | Where the risk sits |
|---|---|---|
| `salvage` | Search, carry many home, fit them | Loaded return |
| `beacon` | Load at the boat, carry **out**, plant on site | Loaded departure |
| `haul` | One crate, 0.58× speed, 1.7× air | Many trips, no batching |

Survey loads max 3 beacons per trip and only counts once **called in from the deck**, so
the swim home still matters. Anchors always plot on the minimap — you were given the
coordinates — which makes survey a routing problem; crates stay behind the fog, so cargo
is a search *and* a slog.

`push into a boulder to drill` and `push into an anchor to plant` are the **same gesture**
through one hold-to-act path.

### Training objectives

Each dive names a skill and measures it from real play: `minAir`, `dives`, `contacts`,
`sweptPct`, `lights`, `timeLeft`. A declaration is `{ metric, compare, target }`, so
adding one is data. Worth a score bonus, **never a gate**, and paid only on a finished run.

---

## 5. Enemies

Three threat models rather than three reskins — the distinction is deliberate:

| Type | Behaviour | Threatens |
|---|---|---|
| `shark` | Hunts, lethal on contact. Only boost breaks pursuit | Your life |
| `squid` | Ambushes, then darts. Tears air from the tank | Your budget |
| `jelly` | Never hunts. Stings and stalls | Your route |

One loop drives all three, parameterised by `ENEMY_TYPES`. It runs in **both** modes:
passing `p = null` means the diver is aboard, so pursuit decays and animals return to
their patrol lanes — without that, a shark froze under the hull waiting for you.

---

## 6. Rendering and assets

Two sources, deliberately kept separate.

**Procedural** — the 3D world. Every texture in `textures.js` is drawn into a canvas at
load: sand with ripples, cracked rock, brushed marine paint with weld seams and rivets,
tarnished brass, neoprene, graded sharkskin, and caustics as a Voronoi-ridge tile scrolled
in two additive layers. Value noise is **blurred before tiling**, or it shows a visible
lattice.

**Delivered art** — the 2D UI, through `src/assets.js`. It centralises two problems:
several folder names are not URL-safe (a literal `?` reads as a query string and 404s, so
every segment is percent-encoded), and scale is chosen **per asset**, which is what keeps
the build inside 35MB.

Markup names art directly and `hydrateAssets()` resolves it:

```html
<img data-asset="go bg" data-scale="2">
<div data-asset="derived:start-button.webp">
```

**Depth darkening is real falloff**, not a colour filter: fog range, hemisphere and sun
intensity all fall off with depth (≈68m/1.21 at the surface to ≈22m/0.20 on the bed), and
the diver's lamp is what pushes back — which is why floodlight pickups matter.

---

## 7. Screen flow

`landing → intro → menu → levels → alert (briefing) → boat ⇄ dive → end`, with `deck`,
`clip` and settings/help as overlays. One `showScreen()` toggles `data-on`.

`startLevel()` is **async** and re-entrancy-guarded: it applies the level, rebuilds the
environment and the minimap grid, then awaits the intro and briefing before `beginRun()`.
*Gotcha:* the guard drops calls that never dismiss the briefing — see
`docs/verification.md`.

---

## 8. Extension points

| To change | Touch |
|---|---|
| Balance | `src/config.js` only — systems read from it |
| Add a dive | One entry in `LEVELS` |
| Add a training objective | A `{ metric, compare, target }` declaration |
| Add an enemy | An `ENEMY_TYPES` entry plus a mesh builder |
| Swap the boat | `boatMesh()` in `boat.js` — the game reads only `position` and `rotation.z` |
| Restore free 3D | `CONFIG.play.planar = false` |
