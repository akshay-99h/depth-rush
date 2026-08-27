# Depth Rush — Build Log

Required by the competition, not scored. One entry per working session: what was decided,
what was prompted, what came back, and what had to be corrected.

---

## Session 01 — 2026-08-25 · Project setup

**Goal.** Turn the Depth Rush GDD into a runnable project scaffold that already satisfies every
hard submission rule, so later sessions are about the game and never about packaging.

**Decisions.**
- **2.5D on the XY plane.** The GDD's loop is a vertical arc (0M surface → −15M seabed → ascend).
  Play happens on a flat XY plane rendered in Three.js with a side-on portrait camera; Z is used
  only for parallax murk and the diver's bob. This makes tap-to-swim a direct screen→world
  raycast, and reads correctly in portrait without a camera-control problem to solve.
- **DOM HUD, not in-scene text.** Crisper on mobile, cheaper per frame, and the pulse/darken
  pressure states are one CSS attribute each.
- **Every tunable in `src/config.js`.** The GDD's numbers are proposals; systems read from config
  so balance passes never touch gameplay code.
- **Seeded RNG (`mulberry32`).** The seabed reshuffles per run, but any run can be replayed from
  its seed — needed for debugging balance, and it is the hook for daily seeded runs later.
- **Vendored Three.js r185, unminified, in `/vendor`.** The build must make no external network
  request, so nothing loads from a CDN. `tools/package.sh` fails the build if an absolute URL or a
  network API appears anywhere in shipped code.

**Built this session.** Scene and camera; per-run level generation; tap-to-swim with acceleration
and arrive-radius; hold-to-drill with a fill ring; boost with charge and cooldown; the oxygen system
with base/drill/boost multipliers; the storm timer with late-game fog and desaturation; parts,
tanks, fins and floodlight pickups; two sharks with patrol/chase steering, a danger radius and a
catch radius; close-call banking on escape; auto-repair at the ship; the sonar bearing; the unified
Game Over with a score breakdown and a local best.

**Deliberately deferred.** Audio (placeholder SFX only, and not yet wired). Diver rig — procedural
bob and tilt stands in. Any meta-progression. Anything from the GDD's Future Vision section.

**Two bugs found and fixed while smoke-testing the loop.**
- *Hold-to-drill cancelled itself.* The swim target was re-derived from the touch point every
  frame, and because the camera lerps toward the diver, the same screen point maps to a drifting
  world point — so the diver swam off the rock mid-hold and the drill silently reset. The drill now
  **latches**: once it starts, the target pins to the rock until release or completion.
- *Dying was worth 1,400 points.* The score tallied O2 and time remaining at the moment the run
  ended, so drowning on the surface at 0:01 paid out a full unspent cushion. Score now banks
  **only at the ship**: parts, unspent O2 and unspent clock are cashed in on each return, and
  anything still in hand is lost with the diver. This is a deliberate deviation from the GDD's
  "tally at Game Over" wording — without it there is no cost to dying, which kills the core bet.
  Worth confirming before it hardens.

**Open questions for the next session.**
- Is a full tank (≈190s of plain swimming) too generous against a 300s storm? The intended tension
  is that you cannot cover the whole seabed on one tank, so the ship top-off becomes the real
  decision point.
- Two sharks on fixed lanes may be too readable once the layout is learned. Consider one patrol
  shark plus one that roams.
- Close-call detection currently fires on leaving the danger radius by any means. It may need a
  minimum dwell time so brushing the edge does not farm bonuses.

**Verification.** Systems driven headlessly through the `globalThis.DepthRush` playtest hook:
level generation, part pickup, drill (rock opens, part awarded, O2 drains at exactly 2×),
auto-repair banking, close-call banking on escape, shark catch, tank-dry and storm-timeout fail
states, Game Over breakdown, and the retry loop all confirmed. `tools/package.sh` passes: index.html at the zip top level, no absolute URLs, no
network APIs, archive well under 35MB.

---

## Session 02 — 2026-08-25 · Rebuild around the UI lofi

**Goal.** Take `docs/lofi-game-ui.pdf` as the source of truth for structure and rebuild the
game layer to match it. Full reasoning in `docs/ui-design.md`.

**What the lofi changed.** It is not a reskin — it restructures the loop. The storm clock
becomes 8 minutes; tap-to-swim becomes a virtual joystick; the single continuous dive becomes
a **boat screen (Dive / Repair) plus an underwater screen**; and the abstract part count
becomes a **five-item checklist** with a ship-progress bar and an "Off to shore" win screen.
The GDD had no win condition at all — only three ways to die. That was the gap worth closing.

**Built this session.**
- Seven-screen flow: landing → FTUX → boat ⇄ dive → end, settings as a modal over any of them.
- `Joystick` replaces the old tap input. Boost moved to a bottom-right thumb button.
- Two-mode sim in `game.js` sharing one clock. Surfacing at the hull refills the tank;
  holding Repair fits carried parts one at a time while the storm clock keeps running.
- Five named parts (Propeller, Rudder, Hull Plate, Fuel Line, Radio), three of them sealed
  inside rocks. Each has its own silhouette.
- Drilling with no button: push the stick into a rock and hold. Keeps the lofi's one-control
  restraint and cannot be fired by accident.
- Sonar as a chevron above the diver's oxygen bar rather than a corner dial.
- Win state with the boat sailing off on the live scene behind the score card.
- Runtime-synthesised audio so the Music / Sound toggles do something real — no audio files,
  no network.
- Flat unlit visual system; scene tint computed from diver depth and storm progress.

**Deviations from the lofi, deliberate.**
- Added a boost button underwater; the lofi shows only the stick. Dodging a shark needs a
  reactive out and the GDD specifies it.
- Added a loss variant of the end screen. The lofi only draws the win.
- Checklist shows all five part names from the start (dimmed until found) rather than
  hiding them — knowing you still need a rudder is the point of having a checklist.

**Fixed while verifying.** The boat sat entirely under the waterline and the boat-mode camera
was close enough to crop it; `boatY` and the framing were both wrong. The win outro originally
put the sailing boat directly behind the score card, where the scrim swallowed it — the camera
now frames it in the upper third.

**Open questions for the next session.**
- 8 minutes may be long for a mobile session (the GDD targeted 90s–5min). It is the number
  written into the FTUX copy, so it stays until a real playtest says otherwise.
- Repair at 2.6s per part means a full five-part repair costs ~13s of the clock. Probably
  too cheap to be a real decision — worth raising once dive pacing is known.
- The playfield is 32m × 18m with 7 rocks and 7 pickups. It reads sparse on screen; either
  tighten the bounds or raise the spawn counts.

**Verification.** Driven headlessly through `globalThis.DepthRush`. Confirmed: full win path
(collect both loose parts → drill all three sealed rocks → surface → hold repair → win, 3,300);
all four end paths (drowned, caught by shark, storm timeout, quit) with correct scores —
0 for dying with nothing fitted, 200 for one part fitted; checklist states; settings pause;
oxygen draining at exactly 2× while drilling. `tools/package.sh` passes.

---

## Session 03 — 2026-08-27 · Fidelity pass + minimap

**Goal.** The lofi-faithful build was reading as a wireframe. Raise every element to
finished fidelity and add a minimap.

**The constraint that shaped the approach.** The build may make no external request, so
there are no model or texture files to load. Everything is generated: textures drawn into
canvases at load (`src/textures.js`), geometry built from profiles, lathes and displaced
primitives (`src/world.js`).

**What changed.**
- Lit rendering throughout — ACES tone mapping, a sun above the surface, a sky/seabed
  hemisphere, and a point light carried by the diver so dark pockets genuinely need lighting.
  Floodlight pickups now widen that lamp, so the pickup and the lighting model are one system.
- Procedural textures: rippled sand, cracked rock, brushed marine paint with weld seams and
  rivets, tarnished brass, neoprene, and graded sharkskin.
- The boat is now a trawler built from a hull profile — sheer line, stem, waterline stripe
  and boot-top, plank deck, wheelhouse with lit windows, mast, boom, stays, deck rail, and a
  working lamp. `boatMesh()` is isolated so a different boat can be dropped in.
- The diver has a torso, hood, mask, twin tank with a regulator hose, swept arms and kicking
  fins driven by actual swim effort. Sharks are lathe-built spindles with gills, eyes, pectoral
  fins and a swaying tail.
- Caustics (scrolling Voronoi ridges), light shafts, a parallax backdrop of distant boulders,
  18 swaying kelp fronds, and a recycled bubble pool.
- **Minimap ("Sonar plot")** — fog-of-war of everything lit up so far, plus live shark
  contacts. Deliberately does not plot the parts.
- **Rocks are now solid.** The diver is pushed out along the contact normal instead of
  swimming through the boulder they are drilling.

**Fixed while verifying.**
- *The camera let the diver leave the screen.* Dive framing used a `p.x * 0.7` parallax
  factor, so near the world's side walls the diver drifted out of frame entirely. Now it
  follows 1:1 and clamps to the world, with an upward bias so the diver never sits behind
  the joystick and boost button.
- *Value noise tiled into a visible lattice* across the seabed. Blurred before tiling.
- *The danger vignette washed the whole frame red* — an inset box-shadow with a 90px blur
  reached the middle of a 375px-wide screen. Replaced with a radial gradient that hugs the edges.
- *A back wall cut a hard horizontal seam* across the surface framing; the parallax backdrop
  replaced its purpose, so it was removed.
- *Collision created a reachability risk* — a loose part could spawn inside a boulder and be
  permanently unreachable. Spawns are now rejected within 2.1m of a rock, and drill contact
  radius was widened to 1.85m because collision holds the diver ~1.32m off a boulder.
- The world narrowed from 32m to 22m wide. At the old width the portrait camera showed 21%
  of the map horizontally and it read sparse; the minimap now covers navigation.

**Still open.** The boat is my design, not the one designed in Cowork — that asset is not on
this machine. `boatMesh()` is isolated so it can be swapped once the file is available.

**Verification.** Full win path across **20 fresh seeds: 20/20**. Zero buried spawns across
40 seeds (parts or pickups trapped inside rocks). Shark, storm and drown end paths still
resolve with correct scores. Sim cost 0.018 ms/frame. `tools/package.sh` passes at 449KB.

---

## Session 04 — TBD

<!-- Template:
**Goal.**
**Prompts / approach.**
**What changed.**
**What was wrong and how it was corrected.**
**Verification.**
-->
