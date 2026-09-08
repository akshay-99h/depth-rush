# Depth Rush

A one-thumb underwater salvage race. Your boat is wrecked, five parts are scattered across the
seabed, and a storm makes landfall in eight minutes. Dive, drill, surface, repair, escape.

Built for the **Meta Horizon Creator Competition: Game Prototype** (Survival & Resource
Management genre). Three.js, HTML5, mobile portrait. Structure follows `docs/lofi-game-ui.pdf`;
see `docs/ui-design.md` for how it was interpreted.

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
index.html          entry point + HUD markup and styles (top level of the zip)
src/config.js       every gameplay tunable — balance here, not in the systems
src/main.js         screen flow, wiring, game loop
src/game.js         the simulation: boat mode and dive mode on one clock
src/world.js        scene construction + per-run level generation
src/joystick.js     virtual stick + boost
src/hud.js          DOM HUD bindings
src/parts.js        the five named boat parts
src/levels.js       three biomes x three dives, three objectives, progression save/load
src/enemies.js      shark / squid / jelly — three threat models, not three reskins
src/tilt.js         optional tilt-to-swim, same shape as a stick
src/textures.js     every surface, drawn into a canvas at load — no texture files
src/boat.js         the Riverside Workboat, re-aimed and rescaled for a side-on view
src/minimap.js      the sonar plot: fog-of-war + live shark contacts
src/audio.js        runtime-synthesised SFX and drone — no audio files, no network
src/rng.js          seeded RNG so a run can be replayed from its seed
vendor/             Three.js r185, unminified, no CDN
docs/ui-design.md       how the lofi was interpreted, and the visual system
docs/lofi-game-ui.pdf   the source wireframe
docs/design-intent.md   submission artifact (≤500 words → export to .docx)
docs/build-log.md       submission artifact (required, not scored)
```

## Deploy (playable demo)

Static site, no build step — `index.html` at the repo root is the whole app.

`vercel.json` sets cache headers only: `/vendor/*` is immutable (Three.js is vendored by
hand and never changes without a rename), `/src/*` always revalidates so playtesters never
get stale game code. `.vercelignore` keeps `docs/`, `tools/` and the zip off the public site.

The deployed build is for playtesting and the demo video. **The competition submission is
`dist/depth-rush.zip`, not the URL** — and the deployed page makes no external request
either, so the two stay in sync.

## Documentation

| File | What it is |
|---|---|
| `CLAUDE.md` | Contract for AI sessions: hard rules, conventions, known traps |
| `docs/implementation.md` | How the build works — architecture, 2.7D model, level system |
| `docs/build-log.md` | How it was made — the prompts and the decisions they produced |
| `docs/verification.md` | How every claim was measured, and what still needs a human |
| `docs/design-intent.md` | Submission artifact source (exported to `.docx`) |
| `docs/ui-design.md` | How the lofi wireframe was interpreted |

## Submission checklist

Three artifacts, submitted separately on Devpost. `tools/package.sh` builds all three
into `dist/` and fails the build on any rule violation.

**1. Playable prototype build — `dist/depth-rush.zip`**
- [x] Single `index.html` at the zip top level, unminified
- [x] Third-party libraries under `/vendor` with relative paths (Three.js r185)
- [x] No external network request at runtime — verified empirically, not just by grep:
      every request is a same-origin module load at startup, none during play
- [x] Portrait, single-player
- [x] 466KB, against a 35MB limit

**2. Design-intent document — `dist/design-intent.docx`**
- [x] `.docx`, text-only, no images
- [x] 489 words, against a 500 limit
- [x] No identifying information, including document metadata (creator and
      lastModifiedBy are written empty rather than left for the toolchain to fill in)
- Regenerate after editing the Markdown source:
  ```
  npm install docx && node tools/make-docx.js docs/design-intent.md docs/design-intent.docx
  ```

**3. Build log — `dist/build-log.md`**
- [x] Markdown, one entry per working session. Required, not scored.

**Deadline: September 8, 2026 @ 1:00pm PDT.**

### Still needs a human

Everything above is verified programmatically. **Play it on a real phone before you submit** —
the control scheme was rebuilt around thumb feel, and that is the one thing that cannot be
checked from here. Worth confirming specifically: tilt-to-swim's forward/back direction (it is
one sign flip in `src/tilt.js` if it feels inverted), and that the two dive controls sit
comfortably under your thumbs.
