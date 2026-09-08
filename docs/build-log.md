# Depth Rush — Build Log

Required submission artifact. Not scored, but it is the record of how the build was
actually made, so it is written to be checkable: every prompt below was really issued,
and every number quoted was really measured. Both can be cross-referenced against
`git log` and against `docs/verification.md`.

**Built by prompting.** No system was hand-designed and then transcribed. Each one
started as a prompt, and the interesting work was in how those prompts were framed —
which is what this log is mostly about.

| Workstream | Assistant | Commits |
|---|---|---|
| Engine, gameplay systems, verification harness | Claude Code (Opus) | `5d43071` … `4460b76` |
| Art integration, UI, presentation flow | ChatGPT (+ teammate) | `9552a31` … `898be36` |

Per-commit authorship is in `git log`. Roughly 4,700 lines of application code across
17 modules, plus a vendored Three.js.

---

## How we prompted

Six patterns did most of the work. They are listed first because they are the reusable
part; the session log after this is just them applied.

### 1. Constraint-first framing

The competition's hard rules were encoded **before** any code was requested, so they
shaped the architecture instead of being retrofitted onto it.

> *"look at the deep rush gdd. it will be a submission for: https://mhcp-game-prototype.devpost.com/ — help me set the project up"*

The rules (single `index.html` at the zip root, no external network request at runtime,
unminified, ≤35MB) became `tools/package.sh`, which **fails the build** on violation.
That guard paid for itself: when the art pack landed, the packager refused a 139MB zip
rather than letting it reach a judge.

### 2. Source-of-truth prompting

When two documents disagreed, one was named as the authority rather than asking for a
blend.

> *"use this lofi as the source of truth and come up with a design that you think would be good for this kind of project"*

The wireframe contradicted the GDD on four points (8-minute storm not 5, joystick not
tap-to-swim, a boat/dive split, a five-item checklist). Naming it the authority resolved
all four at once and surfaced the real gap: **the GDD had no win condition.** That
finding came from the framing, not from a later review pass.

### 3. Ask for a recommendation, not an implementation

Design forks were posed as questions. This is the pattern that most often changed the
outcome.

> *"should the shark follow the diver? should we include a dive up button? the timer of o2 is slow"*

The dive-up button was **recommended against and not built** — the swim home is the
core bet, and a button that skips it deletes the tension. What shipped instead was a
sonar chevron that switches to a bearing on the boat below 35% air: it answers the real
need (navigation) at the moment it matters, without removing the decision.

### 4. Instrumented verification — prove it, don't claim it

Every gameplay claim was measured through a live hook (`globalThis.DepthRush`) that can
step the simulation frame by frame, drive the sticks, and read state.

> *"the controls got too complex for mobile. How can we make them simpler?"*

The answer began by **counting**: 7 touch targets on the boat screen, 5 in dive. That
measurement immediately reframed the problem — the count was not the issue, the
*coupling* was. Surfacing for air needed two thumbs for one intention.

### 5. Adversarial self-review

After each change, the standing instruction was to hunt the bug the change had just
introduced. This is where most real defects came from — not from the feature work, but
from its second-order effects.

Moving to 2.7D produced three at once, all from one root (*the player can no longer
steer in Z, so anything that assumed they could is now a trap*): items spawning
unreachably off-plane, scenery spawning between the camera and the diver, and then the
camera-collision test firing on the very boulders that must sit on the plane.

### 6. Deliberate-deviation logging

Where the AI's judgement departed from a brief, it had to say so and say why, rather
than quietly complying or quietly ignoring.

Four are on record: adding a boost button the lofi did not show; trimming the workboat's
crew from four to two; scoring only on a successful return; and recommending against a
dive-up button. Each is a design position the team can defend or reverse.

---

## Session log

### 1 — Scaffold under the rules · `5d43071`

> *"look at the deep rush gdd. it will be a submission for: …devpost… help me set the project up"* → *"use git for this"*

Read the GDD and fetched the competition rules, then built the skeleton around the
constraints: Three.js **vendored** (no CDN — a CDN load is an external request at
runtime and would disqualify the build), every tunable in one `config.js`, seeded RNG so
any run is reproducible from its seed, and `tools/package.sh` as the enforcement point.

*Caught in the same session:* hold-to-drill cancelled itself, because the swim target was
re-derived from the touch point every frame while the camera drifted. And dying scored
1,400 — oxygen and time were tallied at death, so drowning at 0:01 paid out a full unspent
cushion. Score now banks only at the boat.

### 2 — The lofi becomes the authority · `d476c32`, `1c8d6df`

> *"use this lofi as the source of truth …and start working on the game"*

Restructured to the wireframe's spine: 8-minute storm, virtual joystick, boat screen with
Dive/Repair alongside the underwater screen, a five-item named checklist, and the win
state the GDD never had.

### 3–4 — Fidelity, then the real boat · `c88f083`, `03f5711`

> *"too lofi, need the elements to be of high fidelity… Also, a minimap somewhere on the screen would help."*
> *"integrate the following for the boat: <the Riverside Workboat scene>"*

The supplied boat was a standalone orbit-camera scene, not a game object. Three things
had to change, and naming them up front is what made the integration one pass instead of
several: **orientation** (built length-along-Z for a camera that circles it — anything
authored flat-on to that camera ends up edge-on after the yaw, so the flag, fish and
fishing line each had to be re-aimed), **lighting** (its hull paint was authored under a
bright grey-green sky and rendered as a black slab against teal water), and **scale/origin**.

### 5 — Deployment · `a0dd19e`

> *"how do I deploy this to vercel?"* → *"just let me know what settings to select"*

Static, zero-build. The prompt that mattered was the follow-up constraint — *settings, not
a CLI* — which changed the answer from "install the CLI" to a dashboard walkthrough plus
the two settings that actually bite (Output Directory, and Deployment Protection, which
otherwise puts a login wall in front of a judge's link).

### 6 — Playtest triage · `408f3c2`

> *"1) Part collected number doesn't go up … 2) Area is too small … 3) shark glitches … 5) after drilling the rocks it doesn't show if the part is collected"*

Five reports, but **two were the same bug**. Instrumenting a real round trip showed the
diver swam at 5 m/s: the whole map crossed in six seconds, a full trip costing ~10% of a
tank. "Area too small" and "oxygen too slow" were both *distance is free*. Speed dropped
to 2.8 m/s and both complaints resolved.

The shark glitch was a genuine defect: the old code snapped position straight at the
diver with `Math.sign()` each frame, so the instant it drew level the sign flipped and it
juddered and strobed its facing. Replaced with steering (turn rate, latched facing
through a deadzone): **0 facing flips** measured over a 4-second pursuit.

*Which then exposed a balance bug:* with sharks properly pursuing, **boost could not break
one.** Its duty cycle averaged 4.1 m/s against a 3.2 m/s chase. Retuned to 2.4s hold /
2.0s cooldown — measured over 12 trials each: swim-only caught **12/12**, with boost
shakes the pursuit **12/12**.

### 7 — Levels, enemies, menus · `31214c5`, `a07503a`

Nine dives as **data** (`src/levels.js`); applying one mutates the live `CONFIG` so every
system picks up new numbers without knowing a level system exists.

Three enemies as three *threat models*, not three reskins: **shark** hunts and kills;
**squid** ambushes and tears air out of the tank rather than killing; **jelly** never hunts
but stings and stalls. Then three objectives — **salvage** (carry home), **survey** (carry
out and plant), **cargo** (one crate, slowed and thirsty) — rotated through each biome.

*Nearly shipped:* the scene was built once at load, so choosing a 60m dive would still have
rendered the 28m one. Split into `createScene()` and `buildEnvironment()`, rebuilt per level.

### 8 — Everything unlocked, and a measured objective · `3978735`

> *"all the chapters should already be unlocked, since it is supposed to be a trailer. Also, there should be a clear learning objective behind the games too."*

Every dive names the skill it drills — air discipline, trip planning, load handling,
search pattern, reserve management, threat avoidance, light discipline, dead reckoning,
endurance — and **measures** it from real play data. An objective declares a metric, a
comparison and a target, so adding one is data, not code.

Three decisions worth defending: it pays out **only on a run you finished** (a passing
reading on a failed dive earns nothing); it **never gates progress**; and the debrief shows
the *number*, not just a verdict, so a player learns what to change.

> ⚠️ **This is currently reversed.** See *Open risks*.

### 9 — 2.7D · `543ab29`

> *"the controls got too complex for mobile. How can we make them simpler?"* → *"for mobiles I need a 2.7D type view only"*

Locking movement to a vertical plane makes the stick **direct** — push up, go up — which
removes the reason for a second stick. Dive went to two controls. `CONFIG.play.planar`
gates it, so free 3D is one flag away.

### 10 — Submission artifacts · `4460b76`

The `.docx` is generated from Markdown by `tools/make-docx.js`. Two rules are easy to
miss: *no identifying information* includes **document metadata**, so `creator` and
`lastModifiedBy` are written empty rather than left for the toolchain to stamp with the
machine's user name; and *text-only* means no images at all.

The no-network rule was proved **behaviourally, not by grep** — Three.js contains `fetch`
and `XMLHttpRequest` in loaders the game never calls, so grep is the wrong instrument.
Played three levels and read the browser network log: every request is a same-origin
module load at startup, **none during gameplay**.

### 11 — Art integration and presentation · `9552a31` … `898be36` (ChatGPT-assisted)

*Prompts for this stretch are reconstructed from the resulting code and commits rather
than quoted, since they were issued in a different tool.*

Wired the delivered art pack in behind `src/assets.js`, which solves two things centrally:
several folder names are not URL-safe (spaces, parentheses, a literal `?` that would be
read as a query string and 404), and scale is chosen **per asset** — a soft gradient is
indistinguishable at 1x while a small sprite is already oversampled there. That per-asset
decision is what keeps the build inside 35MB.

Added the landing scene composed from delivered sprites, an intro film with a 16:9
companion render for desktop, alert/deck/clip screens, and a three-star rating
(completion + training objective met + a quarter of the clock left).

**Asset cleanup:** 182MB → **28MB**, 380 files → 55, by dropping unused folders and the
resolution tiers each asset did not need.

---

## What the AI got wrong

Kept deliberately, because a log with no failures is not a credible log.

| # | Wrong | How it surfaced |
|---|---|---|
| 1 | Hold-to-drill silently cancelled itself | Instrumented drill test |
| 2 | Dying scored 1,400 points | Reading the score breakdown on a deliberate loss |
| 3 | Sharks juddered and strobed their facing | `Math.sign()` sign-flip at zero crossing |
| 4 | Boost could not break a pursuit | 12-trial escape test |
| 5 | Scene built once — every level would have rendered as level 1's world | Cross-checking generated vs declared dimensions |
| 6 | Camera collapsed onto the diver in 2.7D | Ray test firing on plane-bound boulders |
| 7 | A rename to `goal:` missed all nine lines (prefixed by `storm:`), and a fallback made it look like working code | Level select rendering "undefined targets" |
| 8 | Anchors/crates could spawn inside boulders — an unwinnable seed | A bad seed in the 3-pass regression |

Number 7 is the instructive one: **a defensive fallback turned a broken rename into
plausible-looking output.** Every level silently ran 5 targets, including the one meant to
be a gentler 4.

---

## Open risks

1. **All dives are locked again.** A fresh save leaves **8 of 9 locked** — only `shelf-1`
   is selectable. The star system reintroduced sequential unlocking, reversing the
   earlier decision to open everything for judging. A judge who plays once sees one of
   three objectives and one of three biomes. *One-line change in `isUnlocked()`.*
2. **Real-device playtest.** Everything here is verified programmatically; the control
   scheme was rebuilt around thumb feel, which cannot be checked from a desktop browser.
3. **The regression harness needs updating** for the new async `startLevel` — its
   re-entrancy guard silently drops calls that do not dismiss the briefing screen. See
   `docs/verification.md`.
