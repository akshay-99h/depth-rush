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

**Open questions for the next session.**
- Is a full tank (≈190s of plain swimming) too generous against a 300s storm? The intended tension
  is that you cannot cover the whole seabed on one tank, so the ship top-off becomes the real
  decision point.
- Two sharks on fixed lanes may be too readable once the layout is learned. Consider one patrol
  shark plus one that roams.
- Close-call detection currently fires on leaving the danger radius by any means. It may need a
  minimum dwell time so brushing the edge does not farm bonuses.

**Verification.** `tools/package.sh` passes: index.html at the zip top level, no absolute URLs, no
network APIs, archive well under 35MB.

---

## Session 02 — TBD

<!-- Template:
**Goal.**
**Prompts / approach.**
**What changed.**
**What was wrong and how it was corrected.**
**Verification.**
-->
