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

## Session 04 — 2026-08-27 · Integrate the Riverside Workboat

**Goal.** Replace the placeholder boat with the supplied Riverside Workboat model.

**The three real problems.** The asset is a standalone orbit-camera scene, not a game object:
1. *Orientation.* Built length-along-Z for a camera that circles it. Depth Rush is side-on to
   the XY plane, so the whole boat now sits in an inner group yawed 90°. Everything authored
   flat-on to an orbiting camera had to be re-aimed or it ends up edge-on and invisible — the
   flag is yawed back to face us and stream aft, the fish turned along the view axis, the
   fishing line re-routed off the stern.
2. *Lighting.* The hull paint was authored under a bright grey-green sky. Against teal water
   it rendered as a black slab. Regraded into sun-caught topsides, a boot-top stripe and
   antifouling below the waterline, with plate seams and rust streaks.
3. *Scale and origin.* Scaled to ~7.6m long in a 22m world, waterline at the group origin.

Also dropped: the original's water plane, orbit controls, HUD. Crew trimmed four → two,
because four idle hands on deck while the player drowns contradicts the solo-diver fiction.

**Added on top.** A masthead lamp (the one bright point findable from the seabed) and a list:
she leans by however much of her is still missing and rights herself as parts are fitted, so
the hero asset and the progress bar say the same thing.

**Fixed while verifying.**
- *Moving the boat's origin to its waterline broke diving.* The dive entry point landed inside
  the surfacing radius, so the diver bounced straight back aboard on every dive. Surfacing is
  now **latched** — it only arms once the diver has actually swum clear of the hull — which is
  robust to any future change of those two numbers.
- *The masthead glow drew as a hard pale rectangle* over the sonar plot: the plane was created
  without its falloff map, so an additive quad rendered at full strength. Also memoised the
  glow texture, which was rebuilding a canvas per call.
- *The mast and flag sat behind the sonar plot.* Moved the plot down to sit just above the
  joystick — which is where the thumb already is in dive mode, so it reads better there anyway.
- Gulls orbited 7m toward the camera; tightened their radius to stay around the boat.

**Verification.** Dive entry no longer re-surfaces; returning to the hull still does. Full win
path **20/20 across fresh seeds**. Shark and storm end paths resolve with correct scores. Boat
is 163 meshes; sim cost 0.021 ms/frame. `tools/package.sh` passes.

---

## Session 05 — 2026-08-27 · Playtest fixes and a balance pass

**Reported.** Parts counter never moved; area too small; sharks glitched; too shallow, so the
diver was always near a shark; drilling gave no sign a part was recovered. Plus three questions:
should sharks follow, should there be a dive-up button, and oxygen drains too slowly.

**The finding that drove most of this.** The diver swam at **5 m/s**. Instrumenting a real
round trip showed it cost about 5 seconds and 10% of a tank — the whole map crossed in six
seconds. So "area too small" and "oxygen too slow" were the same bug: **distance was free**,
which made the world feel tiny and the tank irrelevant. Speed is now 2.8 m/s (a hard fin kick).
The same measured trip now costs ~14s and ~20% of a tank.

**Fixes.**
- *Counter.* The chip showed fitted parts only, so recovering one looked like nothing happened.
  It now reads `0+1/5` — fitted, plus an amber carried count. The end screen gained a
  "Lost with the diver" row so parts that went down with you are accounted for, not silently
  scored zero.
- *Shark glitch.* The old code snapped position straight at the diver each frame using
  `Math.sign()`, so the moment it drew level the sign flipped and it juddered and strobed its
  facing. Sharks now accelerate onto a heading with a turn rate, clamp to the water column, and
  latch their facing through a deadzone. Measured: **0 facing flips** over a 4s pursuit,
  max 0.07 units of travel per frame.
- *Depth.* Seabed −18m → −26m, width 22m → 28m, loot spread through 13m of column rather than
  5m, and sharks seeded one per depth band instead of stacked near the bed.
- *Drill feedback.* A part sealed in a rock had no mesh until the rock cracked, so the only
  feedback was a toast. The part now spawns at the rock, bursts bubbles, and flies to the diver.

**Answers to the three questions.**
- *Should sharks follow?* Yes, and that was the real cause of the "glitch". They previously only
  chased **inside** the danger ring, so they lunged and instantly gave up at its edge — that
  flicker read as a bug. Pursuit is now a latched state with its own 6m detection ring and a
  2.5s memory.
- *Dive-up button?* Recommended against, and not built. The swim home **is** the tension — a
  button that skips it deletes the core bet. What was missing was navigation, so the sonar
  chevron now switches from "nearest part" (amber) to "bearing on the boat" (teal) once the
  tank drops below 35%. It answers the need at exactly the moment it matters.
- *Oxygen too slow?* Fixed by the speed change plus a tighter drain: 85s → 45s per tank.

**Balance bug this exposed.** With sharks properly pursuing, **boost could not break one.**
At 1.8s hold / 2.4s cooldown the duty cycle averaged 4.1 m/s against a 3.2 m/s chase, so you
could never open enough water before hitting a wall — boost just delayed the death. Now 2.4s /
2.0s. Measured over 12 trials each: swim-only **caught 12/12**, with boost **shakes the pursuit
12/12**. That is the intended shape — boost is the answer to a shark, and it costs air.

**Verification.** Reachability 20/20 across fresh seeds. Zero buried spawns across 40 seeds.
All four end paths resolve with correct reasons. An honest autopilot — no teleporting, no
oxygen refills, ignoring spare tanks and boost — wins 4 of 8, losing 3 to a dry tank. That is
the right shape for a bot that never manages its air.

**Open question.** Bot wins take only 76–105s of the 480s storm budget, so the clock may be
generous; real play involves searching, which the bot skips, so the honest number is higher.
Worth watching in a human playtest before touching the 8 minutes the FTUX copy promises.

---

## Session 06 — 2026-09-01 · 3D port, then levels

Two large asks in one session. Committed separately so the 3D port stands on its own.

### Part 1 — from a 2.5D plane to a 3D volume

**Controls.** Left stick swims relative to where you are looking; a right-hand **eye stick**
turns the head. Swimming follows pitch, so looking down and pushing forward takes you down —
no separate ascend control to learn. Boost moved between the two sticks.

**Rebuilt in three axes.** Movement, collision, spawning, drilling and enemy steering. Models
aim down a direction vector through one shared `aimAlong()` helper. Sprites for motes, bubbles
and glows, crossed planes for kelp and light shafts, so nothing reads edge-on from an arbitrary
camera angle.

**Surface breathing.** Breaking the surface refills the tank. Air is free up top; what it costs
is the storm clock and the swim back down. This moves the pressure from "don't drown" to "time
spent breathing is time not spent searching", which is the better version of the same tension.

**Depth darkens for real.** Fog range, hemisphere and sun intensity all fall off with depth —
measured 68m/1.21 at the surface against 22m/0.20 on the bed — rather than a colour filter over
a bright scene. Floodlight pickups push back against it.

**Sonar plot** is now top-down with fog of war and a depth gutter showing where the diver and
each contact sit in the water column.

### Part 2 — nine levels, a menu, and enemies that are not all sharks

**Levels are data.** `src/levels.js` holds three biomes × three dives. Applying a level mutates
the live `CONFIG` and `PALETTE`, so every system picks up the new numbers without knowing a
level system exists. Sizes run 26m across / 20m deep up to 40m across / 60m deep.

**Three threat models, not three reskins.**
- *Shark* — a hunter. Fast, wide detection, lethal on contact. Only boost breaks a pursuit.
- *Squid* — an ambusher. Hangs almost still until you are close, then darts. It does not kill:
  it rips air out of the tank. The threat is to your budget, which is why it belongs in the
  deep levels where the swim home is already long.
- *Jelly* — a drifting hazard field. Never hunts. Stings for air and stalls you, so clusters
  are an obstacle you route around rather than fight.

**Menu and progression.** Landing → main menu → level select, with per-level best scores and
each clear unlocking the next. FTUX plays once, ever.

**The bug this nearly shipped with.** The scene was built once at load, so picking a 60m-deep
dive would still have rendered the 28m one. Environment construction is now split out of
`createScene()` into `buildEnvironment()`, rebuilt on every level change; the minimap grid
rebuilds with it.

**Also fixed.** `loadProgress` collided with the loading-bar variable of the same name in
main.js. Added `tools/serve.py`, a no-cache dev server — plain `http.server` lets the browser
heuristically cache ES modules, which surfaces as a bogus "does not provide an export named X"
after an edit and cost real time to diagnose.

**Verification.** All 9 levels generate with correct dimensions, part counts and enemy rosters;
minimap grid matches each world; **zero buried spawns**. Reachability **27/27** (3 runs × 9
levels), including `vent-3` where all five parts are sealed in rocks. Squid and jelly confirmed
non-lethal but costly; jelly confirmed not to pursue (1.1m of drift while the diver sat 5m away);
shark still lethal. Progression persists and unlocks correctly.

**Open — worth a decision before the deadline.** Judging scores *Focus* at 15%, explicitly for
"a contained experience avoiding over-scoping". Nine levels all share one core loop deliberately.
Adding genuinely different objectives per biome is the obvious next step and was discussed, but
it cuts directly against that criterion. My recommendation is to keep the single loop and let
the biomes vary the *problem*, not the *goal*.

---

## Session 07 — 2026-09-01 · Three objectives, and camera collision

**Three objectives, not nine.** Rather than a bespoke goal per level, there are three jobs
rotated through each biome, so a biome teaches all three and the later biomes re-test them in
worse water. Every job shares swimming, air, the storm clock, enemies, sonar and the minimap;
what changes is the *shape of the trip*.

| Job | Shape | Where the risk sits |
|---|---|---|
| **Salvage** | Search out, carry many home, fit them | Loaded return |
| **Survey** | Load beacons at the boat, carry OUT, plant on site | Loaded departure |
| **Cargo** | One crate at a time, slowed and thirsty | Many trips, no batching |

Each biome runs salvage → survey → cargo.

**How they differ mechanically, not just cosmetically.**
- *Survey* loads a maximum of three beacons per trip, so five anchors is two departures. The
  survey only counts once it is **called in from the deck**, so the swim home still matters.
  Anchors always plot on the minimap — you were given the coordinates — which makes a survey a
  routing problem rather than a search.
- *Cargo* allows exactly one crate, at 0.58× speed and 1.7× air. Measured loaded speed 1.59 m/s
  against a 2.8 m/s base. Crates stay behind the fog of war, so it is a search *and* a slog.
- The hold-to-act gesture is shared: push into a boulder to drill it, push into an anchor to
  plant. One progress readout, two meanings.

**Camera collision.** The trailing camera clipped through boulders. Now an analytic ray/sphere
test along the true diver→camera segment (height lift included — testing the flat -forward ray
left the camera off the line it had checked), pulling in when blocked and easing back out when
clear, with a post-lerp eviction because the lerp lags the target through fast turns.

The deeper fix was that **scenery boulders were swim-through**. Making them solid — for the
diver as well as the camera — is why the camera problem largely disappears, and it stops the
diver gliding through rock. Generation now keeps spawns clear of scenery too.

**The bug that hid itself.** Renaming each level's `parts:` field to `goal:` silently missed
all nine lines because they are prefixed with `storm:`. `applyLevel` then read `undefined`,
`generateLevel` fell back to "all five parts", and every level quietly ran five targets —
including `shelf-1`, which is meant to be a gentler four. It only surfaced because the level
select rendered "undefined targets". Worth remembering: the fallback made a broken rename look
like working code.

**Verification.** All 9 levels: declared goal matches generated targets matches `partsTotal`.
All 9 completed end-to-end through their own objective — **9/9 wins**, salvage, survey and
cargo each exercised in all three biomes. Camera penetration across **780 samples** on three
levels: zero (worst case 0.25m clear, exactly the eviction margin).

**Still open.** Kelp is not a camera collider — thin planes would make the camera jumpy — so a
dense kelp stand can still crowd the frame. Judged not worth the instability.

---

## Session 08 — 2026-09-01 · Sharks that go home, a scouting camera, tilt, and a UI pass

**The shark bug, and why it happened.** Enemies were only ticked from `_updateDive`, so the
moment the diver climbed aboard they froze mid-pursuit — parked under the hull, waiting. The
enemy loop is now `_updateEnemies(dt, p)` and runs in both modes; passing `p = null` means
"nobody in the water", so pursuit decays and they ease back to their patrol lanes. Measured
across 15 seconds on deck: chase timer 2.5 → −10.9, the shark swam 20m away and returned to
its lane (offset 10.68m → 0.03m).

**UI.** Nothing was width-constrained, so on a desktop screen the level select stretched to
2000px with 9px text. Interactive layers are now capped at a 460px column and centred, while
the 3D canvas stays full-bleed. Level rows were rebuilt: job pill (Salvage / Survey / Cargo,
colour-coded), name, brief, and the level's numbers as stat chips including storm time, plus a
per-biome cleared count.

**Scouting from the deck.** Dragging anywhere on the boat screen orbits the view, and a pan
stick walks the focus point out over the dive site so you can plan a route before going in.
Pan is relative to the current view rather than to world axes, so "up" always means "away".
A recentre button snaps back to the boat, and pitch is clamped so the camera cannot dip under
the sea. The hint fades after a few seconds rather than sitting on screen permanently.

**Tilt to swim.** Two sticks plus boost is a lot of thumb on a phone, so `src/tilt.js` can
drive movement from the device's orientation instead, leaving one thumb for looking and one
for boost. It reports the same `x / y / magnitude` shape as a Stick, so the sim takes either
source without knowing which. It re-centres on every dive, so it does not matter how the phone
is held; iOS needs permission, which is requested from inside the toggle's click, and the
settings note reports unavailable/denied honestly. The left stick hides itself when tilt is on.

**Fixed while verifying.** The boat status text, the scout hint and the pan stick were all
landing on top of each other at the bottom-left. Now stacked with measured gaps (hint 561–584,
status 600–616, stick 632–720, buttons 736–794).

**Verification.** Shark returns to patrol while aboard (above). Boat drag changes both yaw and
pitch; pan moves the focus 13m and the camera follows; recentre resets; orbit pitch clamps at
both limits with the camera staying above water. Tilt moves the diver 3.87m with the left stick
idle. No overlapping HUD boxes.

---

## Session 09 — TBD

<!-- Template:
**Goal.**
**Prompts / approach.**
**What changed.**
**What was wrong and how it was corrected.**
**Verification.**
-->
