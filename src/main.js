// Screen flow and wiring:
//   landing -> start -> [intro film] -> alert -> boat <-> dive -> end
// with settings as a modal over any of them, and level select reachable from
// the end screen.
import { createRenderer, createCamera, createScene, buildEnvironment } from './world.js';
import { Stick, DragLook, bindHold, bindKeyboard } from './joystick.js';
import { Audio } from './audio.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { Tilt } from './tilt.js';
import { CONFIG } from './config.js';
import { LEVELS, BIOMES, applyLevel, getLevel, getBiome, loadProgress, saveResult,
         isUnlocked, firstUnplayed, clearedCount, ratingFor, MAX_STARS } from './levels.js';
import { startLanding } from './landing.js';
import { hydrateAssets, resolve, video } from './assets.js';

// Point every [data-asset] element in the markup at its image up front.
hydrateAssets();


const $ = (id) => document.getElementById(id);

const canvas = $('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const { scene, sun, ambient } = createScene();
const audio = new Audio();
const moveStick = new Stick($('move-stick'), $('move-stick').querySelector('.stick-knob'));
const lookStick = new Stick($('look-stick'), $('look-stick').querySelector('.stick-knob'));
const panStick = new Stick($('pan-stick'), $('pan-stick').querySelector('.stick-knob'));
const boatLook = new DragLook($('boat-look'));
const tilt = new Tilt();
const hud = new Hud();
const minimap = new Minimap($('minimap'));

const SCREENS = ['landing', 'menu', 'intro', 'alert', 'levels', 'boat', 'deck', 'dive', 'clip', 'end'];
let screen = 'landing';

const game = new Game({
  scene, camera, sun, ambient, moveStick, lookStick, panStick, boatLook, tilt, audio, minimap,
  hooks: {
    onToast: (t) => hud.toastMessage(t),
    onMode: (mode) => {
      // The painted home screen is the pre-dive one only. Coming up out of a
      // dive lands on the 3D deck, which is where repairs are made.
      if (screen === 'boat' || screen === 'deck' || screen === 'dive') {
        showScreen(mode === 'dive' ? 'dive' : 'deck');
      }
    },
    onEnd: (outcome, reason, state) => showEnd(outcome, reason, state),
  },
});

let progress = loadProgress();
let currentLevel = getLevel(firstUnplayed(progress));

let scoutHintTimer = null;
function flashScoutHint() {
  const el = $('scout-hint');
  el.dataset.on = 'true';
  clearTimeout(scoutHintTimer);
  scoutHintTimer = setTimeout(() => { el.dataset.on = 'false'; }, 3800);
}

function showScreen(next) {
  screen = next;
  for (const id of SCREENS) $(`screen-${id}`).dataset.on = String(id === next);
  $('hud').dataset.on = String(next === 'dive' || next === 'deck');
  if (next !== 'dive') { moveStick.reset(); lookStick.reset(); }
  if (next !== 'deck') { panStick.reset(); boatLook.reset(); }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', resize);

/* --------------------------------------------------------------- landing */

// The landing screen owns its own scene, preloading and bar; its tap starts the
// first dive intro directly. The tap is also what unlocks audio.
startLanding().then(() => {
  audio.unlock();
  startLevel(getLevel(firstUnplayed(progress)), true);
});

/* ------------------------------------------------------------------ menu */

function showMenu() {
  progress = loadProgress();
  // The picker only earns its place once a dive has been cleared — before that
  // there is exactly one dive open and Start goes straight to it.
  $('btn-levels').hidden = clearedCount(progress) === 0;
  showScreen('menu');
}

$('btn-levels').addEventListener('click', () => { audio.unlock(); showLevels(); });

$('btn-play').addEventListener('click', () => {
  audio.unlock();
  startLevel(getLevel(firstUnplayed(progress)), true);
});
$('btn-levels-back').addEventListener('click', showMenu);

const JOB_LABEL = { salvage: 'Salvage', beacon: 'Survey', haul: 'Cargo' };
const FOE_PLURAL = { shark: 'sharks', squid: 'squid', jelly: 'jellies' };
const mmssOf = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

// The stat chips a dive is described by, shared by the picker and the briefing.
// Inline SVG so the rating scales with the card and ships no asset.
function starRow(earned) {
  let out = '';
  for (let i = 0; i < MAX_STARS; i++) {
    out += `<svg class="star" data-on="${i < earned}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"/></svg>`;
  }
  return `<span class="stars" role="img" aria-label="${earned} of ${MAX_STARS} stars">${out}</span>`;
}

function levelChips(l) {
  const foes = l.enemies
    .map((e) => `<span class="foe"><b>${e.count}</b> ${e.count > 1 ? FOE_PLURAL[e.type] : e.type}</span>`)
    .join('');
  return `<span><b>${l.world.halfWidth * 2}m</b> across</span>
          <span><b>${Math.abs(l.world.seabedY)}m</b> deep</span>
          <span><b>${l.goal}</b> targets</span>
          <span><b>${mmssOf(l.storm)}</b> storm</span>${foes}`;
}

/* ------------------------------------------------------- level briefing */

// Shown when the player commits to the dive: what this dive is, what it asks
// for, and the skill it sets out to teach — then it counts itself in. The storm
// clock is held while it is up; five seconds of weather for an unskippable
// briefing would not be fair.
const BRIEF_SECONDS = 5;

function showBrief(level) {
  return new Promise((resolve) => {
    const n = LEVELS.indexOf(level) + 1;
    $('lb-eyebrow').textContent = `Dive ${n} of ${LEVELS.length} \u00b7 ${getBiome(level.biome).name}`;
    $('lb-name').textContent = level.name;
    const job = $('lb-job');
    job.textContent = JOB_LABEL[level.objective];
    job.dataset.job = level.objective;
    $('lb-brief').textContent = level.brief;
    const t = level.training;
    $('lb-trains').style.display = t ? '' : 'none';
    if (t) { $('lb-skill').textContent = t.skill; $('lb-tbrief').textContent = t.brief; }
    $('lb-stats').innerHTML = levelChips(level);

    const modal = $('modal-brief');
    const count = $('lb-count');
    const wasPaused = game.paused;
    modal.dataset.on = 'true';
    game.paused = true;

    let left = BRIEF_SECONDS;
    count.textContent = left;
    const id = setInterval(() => {
      left -= 1;
      if (left < 1) {
        clearInterval(id);
        modal.dataset.on = 'false';
        game.paused = wasPaused;
        resolve();
        return;
      }
      count.textContent = left;
    }, 1000);
  });
}

function showLevels() {
  progress = loadProgress();
  const list = $('levels-list');
  list.innerHTML = BIOMES.map((b) => {
    const inBiome = LEVELS.filter((l) => l.biome === b.id);
    const done = inBiome.filter((l) => progress.cleared[l.id]).length;
    const rows = inBiome.map((l) => {
      const unlocked = isUnlocked(l.id, progress);
      const cleared = !!progress.cleared[l.id];
      const best = progress.best[l.id] ?? 0;
      const stars = progress.stars?.[l.id] ?? 0;
      const node = cleared ? '&#10003;' : unlocked ? LEVELS.indexOf(l) + 1 : '&#128274;';
      return `<button class="lvl" data-id="${l.id}" data-locked="${!unlocked}"
                data-cleared="${cleared}" data-job="${l.objective}" ${unlocked ? '' : 'disabled'}>
        <span class="node">${node}</span>
        <span>
          <span class="head">
            <span class="name">${l.name}</span>
            <span class="job" data-job="${l.objective}">${JOB_LABEL[l.objective]}</span>
            ${best ? `<span class="score"><i>Best</i>${best.toLocaleString()}</span>` : ''}
          </span>
          <span class="rating">${starRow(stars)}</span>
          <span class="brief">${l.brief}</span>
          ${l.training ? `<span class="trains">
            <span class="lab">Trains</span><span class="skill">${l.training.skill}</span>
          </span>` : ''}
          <span class="stats">${levelChips(l)}</span>
        </span>
      </button>`;
    }).join('');
    return `<div class="biome">
      <div class="biome-head"><h3>${b.name}</h3><span class="count">${done}/${inBiome.length}</span></div>
      <p class="blurb">${b.blurb}</p>${rows}</div>`;
  }).join('');

  for (const el of list.querySelectorAll('.lvl')) {
    el.addEventListener('click', () => {
      if (el.dataset.locked === 'true') return;
      audio.unlock();
      startLevel(getLevel(el.dataset.id));
    });
  }
  showScreen('levels');
}

// Applying a level rewrites the shared CONFIG, so the minimap grid and the
// scene both have to be rebuilt around the new dimensions before the run.
//
// The intro film plays only on START from the front screen. Retrying or picking
// a dive goes straight to the briefing — a ten-second clip in front of every
// retry would wear out fast.
//
// Both the film and the briefing wait on the player, so a second tap partway
// through would leave one run half-started and begin another on top of it.
let starting = false;
async function startLevel(level, withIntro = false) {
  if (starting) return;
  starting = true;
  try {
    currentLevel = level;
    applyLevel(level);
    game.setEnvironment(buildEnvironment(scene));
    minimap.rebuild();
    if (withIntro) await playIntro();
    await showAlert();
    beginRun();
  } finally {
    starting = false;
  }
}

/* ----------------------------------------------------------- intro video */

function playIntro() {
  return new Promise((resolve) => {
    const v = $('intro-video');
    const skip = $('btn-intro-skip');
    // The portrait film keeps its original framing on phones.  The companion
    // 16:9 render preserves that focal frame with an extended background, so a
    // desktop player does not have to crop most of the scene to fill a monitor.
    const introFile = matchMedia('(min-width: 768px)').matches
      ? 'IntroVideoDesktop.mp4'
      : 'IntroVideo.mp4';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.pause();
      v.removeEventListener('ended', finish);
      v.removeEventListener('error', finish);
      skip.removeEventListener('click', finish);
      resolve();
    };
    v.addEventListener('ended', finish);
    v.addEventListener('error', finish);
    skip.addEventListener('click', finish);

    showScreen('intro');
    // A player can resize a browser between runs, so compare the requested
    // source rather than setting it only on the first intro.
    const src = video(introFile);
    if (v.getAttribute('src') !== src) {
      v.setAttribute('src', src);
      v.load();
    }
    try { v.currentTime = 0; } catch { /* not seekable yet */ }
    // Sound is allowed here because this runs inside the START click. If the
    // browser refuses anyway, drop to muted, and if that fails too, move on
    // rather than stranding the player on a black screen.
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(finish);
    });
  });
}

/* ------------------------------------------------------------ briefing */

function showAlert() {
  return new Promise((resolve) => {
    showScreen('alert');
    const ok = $('btn-alert-ok');
    const go = () => { ok.removeEventListener('click', go); audio.unlock(); resolve(); };
    ok.addEventListener('click', go);
  });
}


/* -------------------------------------------------------- how to play */

// Reachable from the ? on both harbour screens. The briefing sits behind it and
// the storm clock has not started there, so nothing is paused; opening it from
// the home screen does pause, because the clock is running by then.
const helpModal = $('modal-help');
function openHelp() {
  helpModal.dataset.on = 'true';
  if (screen === 'boat' || screen === 'deck') game.paused = true;
}
function closeHelp() {
  helpModal.dataset.on = 'false';
  if (screen === 'boat' || screen === 'deck') game.paused = false;
}
$('btn-boat-help').addEventListener('click', openHelp);

/* ------------------------------------------------------- checklist pill */

// Both pills — the beige one on the home screen and the blue one underwater —
// open and close the same way.
function bindPill(buttonId, pillId) {
  const el = $(pillId);
  let timer = null;
  $(buttonId).addEventListener('click', () => {
    clearTimeout(timer);
    if (el.dataset.on === 'true') {
      el.dataset.on = 'closing';
      timer = setTimeout(() => { el.dataset.on = 'false'; }, 190);
    } else {
      el.dataset.on = 'true';
    }
  });
}
bindPill('btn-boat-list', 'checklist-pill');
bindPill('btn-checklist', 'uw-pill');
$('al-help').addEventListener('click', openHelp);
$('btn-help-close').addEventListener('click', closeHelp);
// Tapping the scene around the scroll closes it too.
helpModal.querySelector('.scrim').addEventListener('click', closeHelp);

/* ------------------------------------------------------------------- run */

function beginRun() {
  game.startRun();
  showScreen('boat');
}

bindHold($('btn-boost'), (on) => { game.boostHeld = on; });
bindKeyboard(moveStick, lookStick, (on) => { game.boostHeld = on; });

// The deck's Dive goes straight in — it is used repeatedly through a run, and
// the briefing would be in the way. The home screen's Dive is the once-a-run
// commitment, so that is the one that carries it.
let briefing = false;
$('btn-dive').addEventListener('click', async () => {
  if (briefing) return;
  briefing = true;
  audio.unlock();
  try { await showBrief(currentLevel); } finally { briefing = false; }
  game.setMode('dive');
});
$('btn-deck-dive').addEventListener('click', () => { audio.unlock(); game.setMode('dive'); });

$('btn-recentre').addEventListener('click', () => game.recentre());
$('btn-scout').addEventListener('click', () => {
  const el = $('screen-deck');
  const on = el.dataset.scout !== 'on';
  el.dataset.scout = on ? 'on' : 'off';
  if (on) flashScoutHint();
  else { panStick.reset(); game.recentre(); }
});

// Repair is a hold, not a tap: the seconds it costs have to be felt while the
// storm clock is visibly running.
const repairBtn = $('btn-deck-repair');
const repairOn = (e) => { e.preventDefault(); audio.unlock(); game.setRepairing(true); };
const repairOff = (e) => { e.preventDefault(); game.setRepairing(false); };
repairBtn.addEventListener('pointerdown', repairOn);
repairBtn.addEventListener('pointerup', repairOff);
repairBtn.addEventListener('pointercancel', repairOff);
repairBtn.addEventListener('pointerleave', repairOff);

/* -------------------------------------------------------------- settings */

const modal = $('modal-settings');
function openSettings() {
  modal.dataset.on = 'true';
  game.paused = true;
}
function closeSettings() {
  modal.dataset.on = 'false';
  game.paused = false;
}
$('btn-boat-settings').addEventListener('click', openSettings);
$('btn-menu-settings').addEventListener('click', openSettings);
$('btn-alert-settings').addEventListener('click', openSettings);
// PLAY just dismisses the sheet. The design has no Quit here, and none is
// needed on the surface — the blue underwater panel is the one that carries a
// Home button, for abandoning a dive.
$('btn-resume').addEventListener('click', closeSettings);
modal.querySelector('.scrim').addEventListener('click', closeSettings);

// Knob right is on, which is the near-universal reading. The delivered artwork
// draws the knob on the left; that is one state of a two-state control, not a
// statement about which way round it goes.
const bindToggle = (id, apply) => {
  const el = $(id);
  el.addEventListener('click', () => {
    const on = el.dataset.on !== 'true';
    el.dataset.on = String(on);
    apply(on);
  });
};
bindToggle('tg-music', (on) => audio.setMusic(on));
bindToggle('tg-sfx', (on) => audio.setSfx(on));

/* -------------------------------------------------- underwater settings */

// The blue panel is the in-dive one. Its toggles drive the same two switches as
// the surface panel, so opening either reflects the current state.
const uwModal = $('modal-uw-settings');
function openUwSettings() {
  $('tg-uw-sfx').dataset.on = String(audio.sfxOn);
  $('tg-uw-music').dataset.on = String(audio.musicOn);
  uwModal.dataset.on = 'true';
  game.paused = true;
}
function closeUwSettings() {
  uwModal.dataset.on = 'false';
  game.paused = false;
  // Keep the surface panel in step, since both show the same two switches.
  $('tg-sfx').dataset.on = String(audio.sfxOn);
  $('tg-music').dataset.on = String(audio.musicOn);
}
$('btn-settings').addEventListener('click', openUwSettings);
$('uw-play').addEventListener('click', closeUwSettings);
uwModal.querySelector('.scrim').addEventListener('click', closeUwSettings);
bindToggle('tg-uw-sfx', (on) => audio.setSfx(on));
bindToggle('tg-uw-music', (on) => audio.setMusic(on));

// Home abandons the dive. The run is over either way — the storm does not stop
// for anyone — so it ends the run rather than silently discarding it.
$('uw-home').addEventListener('click', () => {
  closeUwSettings();
  if (game.state && !game.state.outcome) game._end('loss', 'You surfaced and left the wreck.');
});

// The eye stick only exists to aim movement in free 3D. On the plane the move
// stick already points where you are going, so it comes off the screen.
if (CONFIG.play.planar) $('look-stick').style.display = 'none';

/* ------------------------------------------------------------------- end */

// Each ending has its own film and its own artwork. A cause with no clip —
// winning, or quitting from the deck — goes straight to the scroll.
const GAME_OVER = {
  shark:  { clip: 'GameOverDueToSharkAttack.mp4',     icon: 'SHARK GO',       title: 'RUN OVER' },
  oxygen: { clip: 'GameOverDueToOxygenDepletion.mp4', icon: '02 GO ICON',     title: 'GAME OVER' },
  storm:  { clip: 'GameOverDueToStorm.mp4',           icon: 'STORM GO ICON',  title: 'GAME OVER' },
  quit:   { clip: null,                               icon: 'STORM GO ICON',  title: 'GAME OVER' },
  win:    { clip: null,                               icon: null,             title: 'YOU MADE IT' },
};

// Fades up, plays, fades out. A tap cuts it short — ten seconds in front of
// every retry would wear thin, and the scroll behind it is the real payload.
function playClip(file) {
  return new Promise((resolve) => {
    const scr = $('screen-clip');
    const v = $('clip-video');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener('ended', finish);
      v.removeEventListener('error', finish);
      scr.removeEventListener('pointerdown', finish);
      scr.dataset.fade = 'out';
      setTimeout(() => { v.pause(); resolve(); }, 460);
    };
    v.addEventListener('ended', finish);
    v.addEventListener('error', finish);
    scr.addEventListener('pointerdown', finish);

    scr.dataset.fade = 'out';
    showScreen('clip');
    v.setAttribute('src', video(file));
    try { v.currentTime = 0; } catch { /* not seekable yet */ }
    requestAnimationFrame(() => { scr.dataset.fade = 'in'; });
    v.muted = false;
    v.play().catch(() => { v.muted = true; v.play().catch(finish); });
  });
}

const mmss = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:`
  + String(Math.floor(secs % 60)).padStart(2, '0');

async function showEnd(outcome, reason, s) {
  const spec = GAME_OVER[s.cause] ?? GAME_OVER.quit;
  const stars = ratingFor(outcome, s, CONFIG.run.stormSeconds);
  progress = saveResult(currentLevel.id, outcome, s.score, stars);

  const el = $('screen-end');
  el.dataset.outcome = outcome;
  $('end-title').textContent = outcome === 'win' ? GAME_OVER.win.title : spec.title;
  $('end-reason').textContent = reason;
  // Only a win earns a rating, so the loss screens stay as designed.
  const starBox = $('end-stars');
  starBox.hidden = outcome !== 'win';
  if (outcome === 'win') starBox.innerHTML = starRow(stars);

  const icon = $('end-icon');
  const art = outcome === 'win' ? null : spec.icon;
  icon.style.display = art ? '' : 'none';
  if (art) icon.src = resolve(art, 4);

  // What the design reports: how deep, how much recovered, how long survived.
  $('end-depth').textContent = `${Math.round(s.maxDepth)} m`;
  $('end-parts').textContent = `${game.objective === 'salvage' ? s.found.size : game.goalDone}`
    + `/${game.partsTotal}`;
  $('end-time').textContent = mmss(CONFIG.run.stormSeconds - Math.max(0, s.timeLeft));

  if (spec.clip) await playClip(spec.clip);
  showScreen('end');
}

$('btn-again').addEventListener('click', () => startLevel(currentLevel));
$('btn-end-levels').addEventListener('click', showLevels);

/* ------------------------------------------------------------------ loop */

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (screen === 'boat' || screen === 'deck' || screen === 'dive') {
    game.update(dt);
    if (game.state) { hud.update(game); minimap.draw(game); }
  }
  if (screen === 'end') game.updateOutro(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Seed the default level so the first frames have a world to draw before the
// player has picked anything.
applyLevel(currentLevel);
game.setEnvironment(buildEnvironment(scene));
minimap.rebuild();

resize();
showScreen('landing');
requestAnimationFrame(frame);

// Playtest hook: drive the sim by hand, jump screens, inspect state.
globalThis.DepthRush = {
  game, audio, minimap, hud, moveStick, lookStick, panStick, boatLook, tilt,
  screen: () => screen,
  levels: LEVELS,
  levelDef: () => currentLevel,   // `level` is the generated world; this is its definition
  startLevel: (id) => startLevel(getLevel(id)),
  showLevels, showMenu,
  go: showScreen,
  begin: beginRun,
  step: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) game.update(dt); return globalThis.DepthRush.state; },
  moveTo: (x, y, z = 0) => { game.diver.position.set(x, y, z); game.state.velocity.set(0, 0, 0); },
  stick: (x, y, mag = 1) => moveStick.setVector(x, y, mag),
  lookAt: (yaw, pitch) => { game.state.yaw = yaw; game.state.pitch = pitch; },
  boost: (on) => { game.boostHeld = on; },
  get level() { return game.state.level; },
  get state() {
    const s = game.state;
    return {
      mode: game.mode, screen, seed: s.seed,
      timeLeft: s.timeLeft, oxygen: s.oxygen,
      x: game.diver.position.x, y: game.diver.position.y, z: game.diver.position.z,
      yaw: s.yaw, pitch: s.pitch, breathing: s.breathing, depthT: s.depthT,
      carrying: [...s.carrying], installed: [...s.installed],
      closeCalls: s.closeCalls, dives: s.dives,
      drilling: !!s.drillRock, drillProgress: s.drillProgress,
      repairProgress: s.repairProgress,
      outcome: s.outcome, reason: s.reason, score: s.score,
      finStacks: s.finStacks, lightStacks: s.lightStacks,
      sonar: s.sonar,
    };
  },
};
