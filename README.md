# Depth Rush

A one-thumb underwater salvage race. Your boat is wrecked, five parts are scattered across the
seabed, and a storm makes landfall in eight minutes. Dive, drill, surface, repair, escape.

Built for the **Meta Horizon Creator Competition: Game Prototype** (Survival & Resource
Management genre). Three.js, HTML5, portrait, single-player. No install, no build step.

**Nine dives across three biomes**, rotating three jobs — salvage, survey and cargo — against
an eight-minute storm clock. Full design and process documentation lives in the repository
(see *Documentation* at the end).

## Controls

Portrait phone or a browser window sized tall. Movement is on a vertical plane, so the
stick maps straight onto it: push up and you go up.

| Control | Does |
|---|---|
| **Left stick** | Swim. Push into a boulder to drill it, or into an anchor to plant a beacon |
| **BOOST** | Speed burst. Costs air, and it is the only thing that breaks a shark's pursuit |
| **Drag anywhere** (on the boat) | Orbit the view. **SCOUT** adds a stick to pan over the dive site |
| **Keyboard** (desktop) | `WASD` swim · `Shift`/`Space` boost |

Optional **tilt-to-swim** is in Settings: it drives movement from the device's orientation
and re-centres on every dive.

The loop: dive, do the job, and get back to the boat before your tank or the storm runs out.
Surfacing refills your air — the cost is the clock.

## Run it locally

Depth Rush is a static HTML/JavaScript game: there is no install or build step. It must,
however, be opened through an HTTP server because it uses browser ES modules. Double-clicking
`index.html` opens it as `file://` and browsers block those module imports.

From this project folder, use any of these options, then visit the listed localhost URL.

### Recommended — project server (no install)

```bash
python3 tools/serve.py 5173 .
```

Open <http://localhost:5173>. This is the preferred option because it disables caching, so
edits to ES modules are reflected straight away.

### Python built-in server (no install)

```bash
python3 -m http.server 5173
```

Open <http://localhost:5173>. This is fine for a quick playtest. After editing JavaScript,
do a hard refresh if the browser appears to be using an older module.

### Node.js static server

With Node.js installed, either command starts a local static server without changing project
dependencies:

```bash
npx serve . -l 5173
# or
npx http-server . -p 5173 -c-1
```

Open the localhost address printed by the command (normally <http://localhost:5173>). The
first use may download the chosen server package.

### Editor server

If you use VS Code, the **Live Server** extension can serve `index.html`: open the project
folder, right-click `index.html`, and choose **Open with Live Server**. Use its local URL, not
the file directly. Other IDE/editor live-preview servers work equally well.

### Any other static web server

Apache, Nginx, Caddy, PHP's built-in server (`php -S localhost:5173`), a Docker static-server
image, or a static-hosting preview all work. Serve the `depth-rush/` directory as the web root
and keep the existing relative paths intact.

Use your browser's device toolbar in portrait to play it as intended; desktop layouts are also
supported for menu and intro playback.

## Build the submission zip

```
./tools/package.sh
```

Writes `dist/depth-rush.zip` and hard-fails on any rule violation: index.html not at the top
level, an absolute URL or network API anywhere in shipped code, or an archive over 35MB.

## Layout

```
index.html          entry point + all screen markup and styles
src/config.js       every gameplay tunable — balance here, not in the systems
src/main.js         screen flow, wiring, game loop
src/game.js         the simulation: boat mode and dive mode on one clock
src/levels.js       three biomes x three dives, three objectives, progression
src/world.js        scene construction + per-level environment and generation
src/enemies.js      shark / squid / jelly — three threat models, not three reskins
src/boat.js         the Riverside Workboat
src/textures.js     every 3D surface, drawn into a canvas at load — no texture files
src/assets.js       delivered-art URLs, hydration and preloading
src/landing.js      landing scene composed from delivered sprites
src/hud.js          DOM HUD bindings
src/minimap.js      the sonar plot: fog of war + live enemy contacts
src/joystick.js     sticks, drag-look, hold buttons, keyboard
src/tilt.js         optional tilt-to-swim, same shape as a stick
src/audio.js        runtime-synthesised SFX — no audio files
src/parts.js        the named boat parts
src/rng.js          seeded RNG, so a run replays from its seed
vendor/             Three.js r185, unminified, vendored — never a CDN
assets/             delivered art and video
tools/              serve.py (dev server) · package.sh (build + audit) · make-docx.js
```

## Documentation

The full design and process record lives in the repository, not in this build:

<https://github.com/akshay-99h/depth-rush>

| File | What it is |
|---|---|
| `CLAUDE.md` | Contract for AI sessions: hard rules, conventions, known traps |
| `docs/implementation.md` | How the build works — architecture, 2.7D model, level system |
| `docs/build-log.md` | How it was made — the prompts and the decisions they produced |
| `docs/verification.md` | How every claim was measured, and what still needs a human |
| `docs/design-intent.md` | Submission artifact source (exported to `.docx`) |

## Competition constraints

This build is shaped by four rules, and `tools/package.sh` enforces the first three:

- **No external network request at runtime.** Three.js is vendored rather than loaded from a
  CDN, every 3D texture is drawn into a canvas at load, and there are no webfonts. Verified
  behaviourally: playing the game issues no request at all beyond the same-origin module
  loads at startup.
- **A single `index.html` at the top level of the zip, unminified.** No bundler, no build step.
- **Under 35MB zipped.** The delivered art ships at 1x-4x; each asset ships only the tier it
  needs, which is what keeps the build inside the limit.
- **Portrait, single-player.**
