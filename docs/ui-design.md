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

Flat, high-contrast, sunlight-readable — the opposite of an atmospheric underwater sim.
Judging does not score visual polish, so the look buys legibility, not beauty.

- **Palette.** Abyss `#04141c` → deep `#072430` → water `#0d3a4a` → shallow `#14586b`,
  with foam `#7fd4d9` for the surface. The scene tint is computed from the diver's depth,
  so descending darkens the screen continuously without a single light calculation.
- **One accent.** Signal amber `#ffb340` is reserved for urgency and reward only — the
  timer under 90s, oxygen under 40%, a part in hand. It never appears as decoration, so
  when it shows up the player looks at it.
- **Silhouette over shading.** Every material is unlit; depth comes from fog and overlap.
  Cheap on a phone, and shapes stay readable at thumb size.
- **Type.** System UI stack only — the build may make no external request, so no webfonts.
  Tabular numerals everywhere a number changes.
- **Chips.** Circular and pill controls with a translucent dark fill and a hairline foam
  border, matching the lofi's circular affordances.

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
