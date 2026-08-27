# Depth Rush — UI & Visual Design

The wireframe (`Game ui.pdf`) is the source of truth for structure. This document
records what the lofi specifies, what it left open, and the calls made to fill the gaps.

## What the lofi changed about the game

The wireframe is not a reskin of the GDD — it restructures the loop. Four changes matter:

| | GDD | Lofi | Built |
|---|---|---|---|
| Storm clock | 5:00 | **8 minutes** | 8:00 |
| Control | tap-to-swim | **virtual joystick**, bottom-left | joystick |
| Structure | one continuous dive | **boat screen with Dive / Repair**, plus an underwater screen | two modes, one clock |
| Goal | collect parts, score | **5-item checklist**, ship progress bar, "Off to shore" | win state |

The last two are the big ones. The GDD had no win condition — only three ways to die.
The lofi's Dive/Repair split and its "Off to shore" screen give the run something to be
*for*, which is what turns a score-attack into a survival-and-resource game.

## The loop the lofi implies

```
BOAT ──DIVE──> UNDERWATER ──surface at the hull──> BOAT ──hold REPAIR──> parts fitted
  └── all five fitted ─────────────────────────────────> OFF TO SHORE (win)
```

The storm clock runs in **both** modes. That is the whole design: every second spent
installing a part is a second not spent finding the next one. Repair is a **hold**, not a
tap, so the cost is felt against a visibly ticking timer rather than deducted off-screen.

## Decisions the lofi left open

**Five parts, named.** The lofi says "Item 1–5". Naming them — Propeller, Rudder, Hull
Plate, Fuel Line, Radio — makes the checklist worth opening and gives each part a distinct
silhouette on the seabed. All five names show from the start, dimmed until recovered: knowing
you still need a rudder *is* the checklist's job.

**Three of the five are sealed inside rocks.** Otherwise the game is only swimming. Drilling
costs double air, which is what makes the tank a resource rather than a timer.

**Drilling has no button.** Push the stick into a rock and hold. The lofi shows exactly one
control underwater and that restraint is worth keeping — the drill is diegetic, needs no
affordance, and cannot be fired by accident.

**Boost is the one addition.** The GDD specifies it and dodging a shark needs a reactive
out. It sits bottom-right, opposite the stick.

**Sonar is a chevron above the diver's tank bar**, swinging toward the nearest part still out
there and brightening as it closes — rather than the GDD's corner dial. The lofi puts the
oxygen bar above the diver; putting the bearing there too keeps the player's eyes in one place.

**"Off to shore" is played, not printed.** The lofi's last screen is captioned "Moving boat
and diver after repair", so the boat actually pulls away on the live scene with the score
card fading in beneath it.

## Visual system

The world is fully lit and textured; the UI stays flat and high-contrast. Judging does not
score visual polish, so fidelity buys *legibility and atmosphere*, never decoration.

**The hard constraint shapes everything: the build may not make an external request.** No
model files, no texture downloads, no webfonts. So every surface is drawn procedurally into
a canvas at load (`src/textures.js`) and every object is built from profiles, lathes and
displaced primitives (`src/world.js`).

- **Palette.** Abyss `#04141c` → deep `#072430` → water `#0d3a4a` → shallow `#14586b`,
  with foam `#7fd4d9` for the surface. Scene tint is computed live from the diver's depth
  and the storm's progress, so descending darkens the frame continuously.
- **One accent.** Signal amber `#ffb340` is reserved for urgency and reward only — the
  timer under 90s, oxygen under 40%, a part in hand. Never decoration, so when it appears
  the player looks at it.
- **Lighting.** A sun above the surface, a sky/seabed hemisphere so nothing goes flat black,
  and a **point light carried by the diver**. Swimming into a dark pocket genuinely reveals
  what is in it, and floodlight pickups widen the lamp's reach — the pickup and the lighting
  model are the same system.
- **Procedural textures.** Sand with ripples and grit, mottled rock with crack lines,
  brushed marine paint with weld seams and rivets, tarnished brass for the parts, neoprene,
  and sharkskin graded dark-dorsal to pale-belly. Value noise is blurred before tiling —
  unblurred it produced a visible lattice across the seabed.
- **Caustics** are a Voronoi-ridge tile, two layers scrolling at different speeds, additively
  blended over the seabed. **Light shafts** are additive planes from the surface that fade as
  the storm closes in.
- **Parallax backdrop.** Distant boulders and 18 kelp fronds whose vertices sway, rooted at
  the bed and loose at the tip. Without them the mid-water is just fog.
- **Bubbles** stream from the regulator, faster while drilling or boosting, from a recycled
  pool so nothing allocates per frame.
- **UI.** System font stack, tabular numerals, translucent chips with hairline foam borders,
  matching the lofi's circular affordances.

### The boat — Riverside Workboat

The hero asset is the Riverside Workboat, adapted from a standalone orbit-camera scene into
`src/boat.js`. Three things had to change to make it a game object rather than a turntable model:

1. **Orientation.** It is built length-along-Z for a camera that orbits it. Depth Rush is a
   side-on view of the XY plane, so the whole boat sits in an inner group yawed 90° — length
   now runs along world X, beam runs into the screen. Anything authored flat-on to an orbiting
   camera had to be re-aimed by hand or it ends up edge-on and invisible: the **flag** is
   yawed back so it faces us and streams aft, the **fish** turned to lie along the view axis,
   and the **fishing line** re-routed off the stern instead of off the starboard beam.
2. **Scale and origin.** Scaled to ~7.6m long against a 22m-wide world, with the waterline at
   the group origin so it sits in the surface band correctly.
3. **Lighting.** The original hull paint (`#33302c`) was authored under a bright grey-green
   sky. Against teal water it read as a black slab, so the paint is graded — sun-caught
   topsides, a boot-top stripe, antifouling below the waterline — with plate seams and rust.

The water, orbit controls and HUD from the original are dropped; the game supplies its own.
The crew was **trimmed from four to two**: the fiction is one diver working a barely-crewed
boat, and four idle hands on deck while you drown reads wrong. The two who remain idle at the
rail and work visibly while you hold Repair. Gulls, flag and crew animate through
`updateBoat()`, called once per frame.

**She lists to starboard by however much of her is still missing**, and rights herself as parts
are fitted — the progress bar and the hero asset say the same thing.

## Minimap — "Sonar plot"

Sits under the settings chip at top-left, at the world's own aspect ratio. It deliberately
does **not** reveal where the parts are — the chevron above the tank already gives a bearing,
and plotting the answers would delete the search. What it gives instead is:

- **Memory** — a fog-of-war grid revealing everything the diver has lit up, so you can see
  where you have already been. Floodlights widen the reveal radius, tying a third system to
  the same pickup.
- **Situational awareness** — sharks are plotted live as red darts whether or not you have
  explored their area. That is the point of a sonar contact display, and it is what makes
  the minimap worth its screen space.

Rocks, tanks, fins and floodlights appear once their area has been explored. The diver pings
with an expanding ring so the eye finds it instantly.

## Screen map

| Lofi screen | Built as |
|---|---|
| Landing screen | `#screen-landing` — wordmark, loading bar, tap to begin (also unlocks audio) |
| FTUX Animation | `#screen-ftux` — the storm line verbatim, four staggered control beats, Skip |
| Main screen | `#screen-boat` — ship progress bar, live boat on the waterline, Dive / Repair |
| Underwater | `#screen-dive` — joystick, boost, oxygen bar above the diver, danger vignette |
| Checklist menu | `#checklist` — the rail expands under the Parts chip |
| Setting pop up | `#modal-settings` — Music / Sound toggles, Play / Quit; pauses the sim |
| Off to shore | `#screen-end[data-outcome="win"]` — the boat sails, score card fades in |

Plus one screen the lofi does not have: the same end screen in its `loss` state, for the
three fail conditions (drowned, caught, storm) and for Quit.
