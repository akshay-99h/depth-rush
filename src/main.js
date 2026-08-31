// Screen flow and wiring. The lofi's seven screens map to five states here:
// landing -> ftux -> boat <-> dive -> end, with settings as a modal over any of them.
import { createRenderer, createCamera, createScene } from './world.js';
import { Joystick } from './joystick.js';
import { Audio } from './audio.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { CONFIG } from './config.js';
import { PART_COUNT } from './parts.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const { scene, motes, caustics, shafts, kelp } = createScene();
const audio = new Audio();
const joystick = new Joystick($('joystick'), $('stick'), $('btn-boost'));
const hud = new Hud();
const minimap = new Minimap($('minimap'));

const SCREENS = ['landing', 'ftux', 'boat', 'dive', 'end'];
let screen = 'landing';

const game = new Game({
  scene, camera, motes, caustics, shafts, kelp, joystick, audio, minimap,
  hooks: {
    onToast: (t) => hud.toastMessage(t),
    onMode: (mode) => { if (screen === 'boat' || screen === 'dive') showScreen(mode); },
    onEnd: (outcome, reason, state) => showEnd(outcome, reason, state),
  },
});

function showScreen(next) {
  screen = next;
  for (const id of SCREENS) $(`screen-${id}`).dataset.on = String(id === next);
  $('hud').dataset.on = String(next === 'boat' || next === 'dive');
  $('ship-progress').style.display = next === 'boat' || next === 'dive' ? '' : 'none';
  if (next !== 'dive') joystick.reset();
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

let loadProgress = 0;
function tickLoading(dt) {
  loadProgress = Math.min(1, loadProgress + dt * 0.85);
  $('load-fill').style.width = `${loadProgress * 100}%`;
  if (loadProgress >= 1) {
    $('load-label').textContent = 'Tap to begin';
    $('screen-landing').onclick = () => {
      audio.unlock();
      $('screen-landing').onclick = null;
      startFtux();
    };
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
}

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
  game.state.outcome = null;
  game._end('loss', 'You abandoned the boat.');
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
  $('end-eyebrow').textContent = outcome === 'win' ? 'Off to shore' : 'Run over';
  $('end-title').textContent = outcome === 'win' ? 'YOU MADE IT' : 'RUN OVER';
  $('end-reason').textContent = reason;

  const rows = [
    ['Parts fitted', `${s.installed.length}/${PART_COUNT}`, s.breakdown.parts],
    ['Close calls', `${s.closeCalls}`, s.breakdown.closeCalls],
    ['Time to spare', outcome === 'win' ? `${Math.round(s.timeLeft)}s` : '—', s.breakdown.escape],
  ];
  // Parts still in hand went down with the diver. Say so, rather than leaving the
  // player to wonder why the three they recovered scored nothing.
  if (s.carrying.length) {
    rows.push([`Lost with the diver`, `${s.carrying.length}`, 0]);
  }
  $('end-breakdown').innerHTML = rows.map(([label, detail, value]) =>
    `<li><span>${label} · ${detail}</span><b>${value.toLocaleString()}</b></li>`
  ).join('') + `<li class="total"><span>Score</span><b>${s.score.toLocaleString()}</b></li>`;

  const best = Math.max(s.score, Number(localStorage.getItem('depthrush.best') || 0));
  localStorage.setItem('depthrush.best', String(best));
  $('end-best').textContent = `Best ${best.toLocaleString()}`;
  $('btn-again').textContent = outcome === 'win' ? 'Dive Again' : 'Retry';
}

$('btn-again').addEventListener('click', beginRun);

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

resize();
showScreen('landing');
requestAnimationFrame(frame);

// Playtest hook: drive the sim by hand, jump screens, inspect state.
globalThis.DepthRush = {
  game, audio, minimap, hud,
  screen: () => screen,
  go: showScreen,
  begin: beginRun,
  step: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) game.update(dt); return globalThis.DepthRush.state; },
  moveTo: (x, y) => { game.diver.position.set(x, y, 0); game.state.velocity.set(0, 0); },
  stick: (x, y, mag = 1) => { joystick.x = x; joystick.y = y; joystick.magnitude = mag; },
  get level() { return game.state.level; },
  get state() {
    const s = game.state;
    return {
      mode: game.mode, screen, seed: s.seed,
      timeLeft: s.timeLeft, oxygen: s.oxygen,
      x: game.diver.position.x, y: game.diver.position.y,
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
