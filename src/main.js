// Screen flow and wiring. The lofi's seven screens map to five states here:
// landing -> ftux -> boat <-> dive -> end, with settings as a modal over any of them.
import { createRenderer, createCamera, createScene, buildEnvironment } from './world.js';
import { Stick, bindHold, bindKeyboard } from './joystick.js';
import { Audio } from './audio.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { CONFIG } from './config.js';
import { LEVELS, BIOMES, applyLevel, getLevel, getBiome,
         loadProgress, saveResult, isUnlocked, firstUnplayed } from './levels.js';


const $ = (id) => document.getElementById(id);

const canvas = $('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const { scene, sun, ambient } = createScene();
const audio = new Audio();
const moveStick = new Stick($('move-stick'), $('move-stick').querySelector('.stick-knob'));
const lookStick = new Stick($('look-stick'), $('look-stick').querySelector('.stick-knob'));
const hud = new Hud();
const minimap = new Minimap($('minimap'));

const SCREENS = ['landing', 'menu', 'levels', 'ftux', 'boat', 'dive', 'end'];
let screen = 'landing';

const game = new Game({
  scene, camera, sun, ambient, moveStick, lookStick, audio, minimap,
  hooks: {
    onToast: (t) => hud.toastMessage(t),
    onMode: (mode) => { if (screen === 'boat' || screen === 'dive') showScreen(mode); },
    onEnd: (outcome, reason, state) => showEnd(outcome, reason, state),
  },
});

let progress = loadProgress();
let currentLevel = getLevel(firstUnplayed(progress));

function showScreen(next) {
  screen = next;
  for (const id of SCREENS) $(`screen-${id}`).dataset.on = String(id === next);
  $('hud').dataset.on = String(next === 'boat' || next === 'dive');
  $('ship-progress').style.display = next === 'boat' || next === 'dive' ? '' : 'none';
  if (next !== 'dive') { moveStick.reset(); lookStick.reset(); }
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

let loadBar = 0;   // renamed: `loadProgress` is now the saved-progress import
function tickLoading(dt) {
  loadBar = Math.min(1, loadBar + dt * 0.85);
  $('load-fill').style.width = `${loadBar * 100}%`;
  if (loadBar >= 1) {
    $('load-label').textContent = 'Tap to begin';
    $('screen-landing').onclick = () => {
      audio.unlock();
      $('screen-landing').onclick = null;
      showMenu();
    };
  }
}

/* ------------------------------------------------------------------ menu */

function showMenu() {
  progress = loadProgress();
  const cleared = Object.keys(progress.cleared).length;
  $('menu-note').textContent = cleared
    ? `${cleared} of ${LEVELS.length} dives cleared`
    : 'Nine dives across three biomes';
  showScreen('menu');
}

$('btn-play').addEventListener('click', () => {
  audio.unlock();
  startLevel(getLevel(firstUnplayed(progress)));
});
$('btn-levels').addEventListener('click', () => { audio.unlock(); showLevels(); });
$('btn-menu-settings').addEventListener('click', openSettings);
$('btn-levels-back').addEventListener('click', showMenu);

function showLevels() {
  progress = loadProgress();
  const list = $('levels-list');
  list.innerHTML = BIOMES.map((b) => {
    const rows = LEVELS.filter((l) => l.biome === b.id).map((l) => {
      const unlocked = isUnlocked(l.id, progress);
      const best = progress.best[l.id] ?? 0;
      const depth = Math.abs(l.world.seabedY);
      const span = l.world.halfWidth * 2;
      const plural = { shark: 'sharks', squid: 'squid', jelly: 'jellies' };
      const foes = l.enemies.map((e) => `${e.count} ${e.count > 1 ? plural[e.type] : e.type}`).join(' · ');
      const job = { salvage: 'Salvage', beacon: 'Survey', haul: 'Cargo' }[l.objective];
      return `<button class="lvl" data-id="${l.id}" data-locked="${!unlocked}"
                data-cleared="${!!progress.cleared[l.id]}" ${unlocked ? '' : 'disabled'}>
        <span class="idx">${unlocked ? (progress.cleared[l.id] ? '&#10003;' : LEVELS.indexOf(l) + 1) : '&#128274;'}</span>
        <span>
          <span class="name">${l.name}</span>
          <div class="brief">${l.brief}</div>
          <div class="meta"><b class="job">${job}</b> &middot; ${span}m across &middot; ${depth}m deep &middot; ${l.goal} targets &middot; ${foes}</div>
        </span>
        <span class="score">${best ? best.toLocaleString() : ''}</span>
      </button>`;
    }).join('');
    return `<div class="biome"><h3>${b.name}</h3><p class="blurb">${b.blurb}</p>${rows}</div>`;
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
function startLevel(level) {
  currentLevel = level;
  applyLevel(level);
  game.setEnvironment(buildEnvironment(scene));
  minimap.rebuild();
  if (!localStorage.getItem('depthrush.seenFtux')) {
    try { localStorage.setItem('depthrush.seenFtux', '1'); } catch { /* private mode */ }
    startFtux();
  } else {
    beginRun();
  }
}

/* ------------------------------------------------------------------ ftux */

let ftuxTimers = [];
function startFtux() {
  showScreen('ftux');
  ftuxTimers.forEach(clearTimeout);
  ftuxTimers = [];
  const beats = [...document.querySelectorAll('.beat')];
  beats.forEach((b) => { b.dataset.on = 'false'; });
  beats.forEach((b, i) => {
    ftuxTimers.push(setTimeout(() => { b.dataset.on = 'true'; }, 500 + i * 900));
  });
  ftuxTimers.push(setTimeout(beginRun, 500 + beats.length * 900 + 1400));
}

$('btn-skip').addEventListener('click', () => { audio.unlock(); beginRun(); });

/* ------------------------------------------------------------------- run */

function beginRun() {
  ftuxTimers.forEach(clearTimeout);
  ftuxTimers = [];
  game.startRun();
  showScreen('boat');
  hud.toastMessage(`${getBiome(currentLevel.biome).name} — ${currentLevel.name}`);
}

bindHold($('btn-boost'), (on) => { game.boostHeld = on; });
bindKeyboard(moveStick, lookStick, (on) => { game.boostHeld = on; });

$('btn-dive').addEventListener('click', () => {
  audio.unlock();
  game.setMode('dive');
});

// Repair is a hold, not a tap: the seconds it costs have to be felt while the
// storm clock is visibly running.
const repairBtn = $('btn-repair');
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
$('btn-settings').addEventListener('click', openSettings);
$('btn-resume').addEventListener('click', closeSettings);
$('btn-quit').addEventListener('click', () => {
  closeSettings();
  if (screen === 'boat' || screen === 'dive') {
    game.state.outcome = null;
    game._end('loss', 'You abandoned the boat.');
  } else {
    showMenu();
  }
});

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

/* ------------------------------------------------------------------- end */

function showEnd(outcome, reason, s) {
  showScreen('end');
  const el = $('screen-end');
  el.dataset.outcome = outcome;
  $('end-eyebrow').textContent = outcome === 'win'
    ? `Off to shore — ${currentLevel.name}` : `Run over — ${currentLevel.name}`;
  $('end-title').textContent = outcome === 'win' ? 'YOU MADE IT' : 'RUN OVER';
  $('end-reason').textContent = reason;

  const rows = [
    [{ salvage: 'Parts fitted', beacon: 'Beacons planted', haul: 'Crates delivered' }[game.objective],
      `${game.goalDone}/${game.partsTotal}`, s.breakdown.parts],
    ['Close calls', `${s.closeCalls}`, s.breakdown.closeCalls],
    ['Time to spare', outcome === 'win' ? `${Math.round(s.timeLeft)}s` : '—', s.breakdown.escape],
  ];
  // Parts still in hand went down with the diver. Say so, rather than leaving the
  // player to wonder why the three they recovered scored nothing.
  if (s.carrying.length && game.objective !== 'beacon') {
    rows.push(['Lost with the diver', `${s.carrying.length}`, 0]);
  }
  $('end-breakdown').innerHTML = rows.map(([label, detail, value]) =>
    `<li><span>${label} · ${detail}</span><b>${value.toLocaleString()}</b></li>`
  ).join('') + `<li class="total"><span>Score</span><b>${s.score.toLocaleString()}</b></li>`;

  progress = saveResult(currentLevel.id, outcome, s.score);
  const best = progress.best[currentLevel.id] ?? s.score;
  $('end-best').textContent = `${currentLevel.name} — best ${best.toLocaleString()}`;
  $('btn-again').textContent = outcome === 'win' ? 'Dive Again' : 'Retry';
}

$('btn-again').addEventListener('click', () => startLevel(currentLevel));
$('btn-end-levels').addEventListener('click', showLevels);

/* ------------------------------------------------------------------ loop */

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (screen === 'landing') tickLoading(dt);
  if (screen === 'boat' || screen === 'dive') {
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
  game, audio, minimap, hud, moveStick, lookStick,
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
