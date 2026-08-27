# Depth Rush

A one-thumb underwater salvage race. Your boat is wrecked, five parts are scattered across the
seabed, and a storm makes landfall in eight minutes. Dive, drill, surface, repair, escape.

Built for the **Meta Horizon Creator Competition: Game Prototype** (Survival & Resource
Management genre). Three.js, HTML5, mobile portrait. Structure follows `docs/lofi-game-ui.pdf`;
see `docs/ui-design.md` for how it was interpreted.

## Run it locally

```
python3 -m http.server 5173
```

Then open <http://localhost:5173> — use your browser's device toolbar in portrait to play it as
intended. ES modules need a server; opening `index.html` from the filesystem will not work.

## Build the submission zip

```
./tools/package.sh
```

Writes `dist/depth-rush.zip` and hard-fails on any rule violation: index.html not at the top
level, an absolute URL or network API anywhere in shipped code, or an archive over 35MB.

## Layout

```
index.html          entry point + HUD markup and styles (top level of the zip)
src/config.js       every gameplay tunable — balance here, not in the systems
src/main.js         screen flow, wiring, game loop
src/game.js         the simulation: boat mode and dive mode on one clock
src/world.js        scene construction + per-run level generation
src/joystick.js     virtual stick + boost
src/hud.js          DOM HUD bindings
src/parts.js        the five named boat parts
src/audio.js        runtime-synthesised SFX and drone — no audio files, no network
src/rng.js          seeded RNG so a run can be replayed from its seed
vendor/             Three.js r185, unminified, no CDN
docs/ui-design.md       how the lofi was interpreted, and the visual system
docs/lofi-game-ui.pdf   the source wireframe
docs/design-intent.md   submission artifact (≤500 words → export to .docx)
docs/build-log.md       submission artifact (required, not scored)
```

## Submission checklist

- [x] Single `index.html` at the zip top level, unminified
- [x] Third-party libraries under `/vendor` with relative paths
- [x] No external network request at runtime
- [x] Portrait, single-player
- [ ] Zip under 35MB — verified by `tools/package.sh` on each build
- [ ] `docs/design-intent.md` exported to `.docx`, ≤500 words, no identifying information
- [ ] `docs/build-log.md` kept current, one entry per session
- [ ] Deadline: **September 8, 2026 @ 1:00pm PDT**
