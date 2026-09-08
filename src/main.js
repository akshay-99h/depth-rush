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
import { LEVELS, BIOMES, applyLevel, getLevel, getBiome,
         loadProgress, saveResult, isUnlocked, firstUnplayed } from './levels.js';
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

// The landing screen owns its own scene, preloading and bar; it resolves when
// the player taps to begin. The tap is also what unlocks audio.
startLanding().then(() => {
  audio.unlock();
  showMenu();
});

/* ------------------------------------------------------------------ menu */

function showMenu() {
  progress = loadProgress();
  showScreen('menu');
}

$('btn-play').addEventListener('click', () => {
  audio.unlock();
  startLevel(getLevel(firstUnplayed(progress)), true);
});
$('btn-levels-back').addEventListener('click', showMenu);

function showLevels() {
  progress = loadProgress();
  const list = $('levels-list');
  const plural = { shark: 'sharks', squid: 'squid', jelly: 'jellies' };
  const JOB = { salvage: 'Salvage', beacon: 'Survey', haul: 'Cargo' };

  list.innerHTML = BIOMES.map((b) => {
    const inBiome = LEVELS.filter((l) => l.biome === b.id);
    const done = inBiome.filter((l) => progress.cleared[l.id]).length;
    const rows = inBiome.map((l) => {
      const unlocked = isUnlocked(l.id, progress);
      const cleared = !!progress.cleared[l.id];
      const best = progress.best[l.id] ?? 0;
      const foes = l.enemies
        .map((e) => `<span class="foe"><b>${e.count}</b> ${e.count > 1 ? plural[e.type] : e.type}</span>`)
        .join('');
      const mark = cleared ? '&#10003;' : unlocked ? LEVELS.indexOf(l) + 1 : '&#128274;';
      return `<button class="lvl" data-id="${l.id}" data-locked="${!unlocked}"
                data-cleared="${cleared}" ${unlocked ? '' : 'disabled'}>
        <span class="idx">${mark}</span>
        <span>
          <span class="top">
            <span class="name">${l.name}</span>
            <span class="job" data-job="${l.objective}">${JOB[l.objective]}</span>
          </span>
          <span class="brief">${l.brief}</span>
          ${l.training ? `<span class="trains">
            <span class="lab">Trains</span><span class="skill">${l.training.skill}</span>
          </span>` : ''}
          <span class="stats">
            <span><b>${l.world.halfWidth * 2}m</b> across</span>
            <span><b>${Math.abs(l.world.seabedY)}m</b> deep</span>
            <span><b>${l.goal}</b> targets</span>
            <span><b>${Math.floor(l.storm / 60)}:${String(l.storm % 60).padStart(2, '0')}</b> storm</span>
            ${foes}
          </span>
        </span>
        <span class="score">${best ? best.toLocaleString() : ''}</span>
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
    if (!v.getAttribute('src')) v.setAttribute('src', video('IntroVideo.mp4'));
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
  hud.toastMessage(`${getBiome(currentLevel.biome).name} — ${currentLevel.name}`);
  if (currentLevel.training) {
    setTimeout(() => {
      if (screen === 'boat' || screen === 'dive') {
        hud.toastMessage(`Objective: ${currentLevel.training.skill}`);
      }
    }, 1900);
  }
}

bindHold($('btn-boost'), (on) => { game.boostHeld = on; });
bindKeyboard(moveStick, lookStick, (on) => { game.boostHeld = on; });

const dive = () => { audio.unlock(); game.setMode('dive'); };
$('btn-dive').addEventListener('click', dive);        // painted home, pre-dive
$('btn-deck-dive').addEventListener('click', dive);   // 3D deck, mid-run

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
  progress = saveResult(currentLevel.id, outcome, s.score);

  const el = $('screen-end');
  el.dataset.outcome = outcome;
  $('end-title').textContent = outcome === 'win' ? GAME_OVER.win.title : spec.title;
  $('end-reason').textContent = reason;

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
