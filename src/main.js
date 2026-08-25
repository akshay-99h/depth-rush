import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';
import { makeRng, randomSeed } from './rng.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { createRenderer, createCamera, createScene, generateLevel, MESHES } from './world.js';

const W = CONFIG.world;
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const { scene, murk } = createScene();
const input = new Input(canvas, document.getElementById('boost-btn'));
const hud = new Hud();

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayReason = document.getElementById('overlay-reason');
const overlayBreakdown = document.getElementById('overlay-breakdown');
const overlayBest = document.getElementById('overlay-best');
const retryBtn = document.getElementById('retry-btn');

const raycaster = new THREE.Raycaster();
const playPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const pointerNdc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();

const group = new THREE.Group();
scene.add(group);

let state = null;
let running = false;

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function screenToWorld(sx, sy) {
  const r = canvas.getBoundingClientRect();
  pointerNdc.set((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  raycaster.ray.intersectPlane(playPlane, hitPoint);
  return hitPoint;
}

function clearGroup() {
  while (group.children.length) {
    const c = group.children.pop();
    c.geometry?.dispose();
    c.material?.dispose();
  }
}

function startRun(seed = randomSeed()) {
  clearGroup();
  const rng = makeRng(seed);
  const level = generateLevel(rng);

  const ship = MESHES.ship();
  ship.position.set(W.shipX, W.surfaceY - 0.9, 0);
  group.add(ship);

  const diver = MESHES.diver();
  diver.position.set(W.shipX, W.surfaceY - 1.6, 0);
  group.add(diver);

  const attach = (list, factory) => list.forEach((o) => {
    o.mesh = factory();
    o.mesh.position.set(o.x, o.y, 0);
    group.add(o.mesh);
  });
  attach(level.rocks, MESHES.rock);
  attach(level.parts, MESHES.part);
  level.pickups.forEach((p) => {
    p.mesh = MESHES[p.kind]();
    p.mesh.position.set(p.x, p.y, 0);
    group.add(p.mesh);
  });
  level.sharks.forEach((s) => {
    s.mesh = MESHES.shark();
    s.mesh.position.set(s.x, s.laneY, 0);
    s.mesh.rotation.z = Math.PI / 2;
    group.add(s.mesh);
  });

  state = {
    seed,
    level,
    ship,
    diver,
    velocity: new THREE.Vector2(0, 0),
    target: new THREE.Vector2(diver.position.x, diver.position.y),
    oxygen: CONFIG.oxygen.max,
    timeLeft: CONFIG.run.stormSeconds,
    depth: 0,
    carrying: 0,
    partsBanked: 0,
    closeCalls: 0,
    finStacks: 0,
    lightStacks: 0,
    bankedScore: 0,
    returns: 0,
    breakdown: { parts: 0, oxygen: 0, time: 0, closeCalls: 0 },
    boosting: false,
    boostCharge: CONFIG.boost.maxHold,
    boostReady: true,
    drillTarget: null,
    drillProgress: 0,
    sharkThreat: false,
    sonar: null,
    over: false,
  };

  overlay.dataset.open = 'false';
  running = true;
}

function endRun(reason) {
  if (state.over) return;
  state.over = true;
  running = false;

  // Everything scores at the ship, not at the moment of death: parts still in hand
  // and the O2/time cushion you never cashed in are lost with the diver. Without
  // this, drowning on the surface at 0:01 scored a free 1,400.
  const bd = state.breakdown;
  const total = bd.parts + bd.oxygen + bd.time + bd.closeCalls;

  const best = Math.max(total, Number(localStorage.getItem('depthrush.best') || 0));
  localStorage.setItem('depthrush.best', String(best));

  overlayTitle.textContent = 'RUN OVER';
  overlayReason.textContent = reason;
  overlayBreakdown.innerHTML = [
    ['Parts repaired', `${state.partsBanked} × ${CONFIG.score.perPart}`, bd.parts],
    ['O2 banked', `at ${state.returns} return${state.returns === 1 ? '' : 's'}`, bd.oxygen],
    ['Time banked', `at ${state.returns} return${state.returns === 1 ? '' : 's'}`, bd.time],
    ['Close calls', `${state.closeCalls} × ${CONFIG.score.perCloseCall}`, bd.closeCalls],
  ].map(([label, calc, value]) =>
    `<li><span>${label}</span><em>${calc}</em><b>${value.toLocaleString()}</b></li>`
  ).join('') + `<li class="total"><span>Score</span><em></em><b>${total.toLocaleString()}</b></li>`;
  overlayBest.textContent = `Best ${best.toLocaleString()}`;
  overlay.dataset.open = 'true';
}

retryBtn.addEventListener('click', () => startRun());

function nearest(list, pos, filter) {
  let best = null, bestD = Infinity;
  for (const o of list) {
    if (filter && !filter(o)) continue;
    const d = Math.hypot(o.x - pos.x, o.y - pos.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best ? { obj: best, dist: bestD } : null;
}

function update(dt) {
  const s = state;
  const p = s.diver.position;

  s.timeLeft -= dt;
  input.update(dt);

  // ---- steering -------------------------------------------------------
  if (!state.drillTarget && (input.pointerDown || input.consumeTap())) {
    const world = screenToWorld(input.screen.x, input.screen.y);
    s.target.set(
      THREE.MathUtils.clamp(world.x, -W.halfWidth, W.halfWidth),
      THREE.MathUtils.clamp(world.y, W.seabedY + 0.4, W.surfaceY - 0.4)
    );
  }

  // ---- drill: holding near a rock cracks it open -----------------------
  // The drill latches once it starts. Without the latch the target keeps being
  // re-derived from a screen point while the camera drifts, so the diver swims
  // off the rock mid-hold and the drill silently cancels itself.
  if (!input.pointerDown) {
    s.drillTarget = null;
    s.drillProgress = 0;
  } else if (!s.drillTarget) {
    const hit = nearest(s.level.rocks, s.target, (r) => !r.opened);
    const inReach = hit && hit.dist < CONFIG.drill.radius
      && Math.hypot(hit.obj.x - p.x, hit.obj.y - p.y) < CONFIG.drill.radius + 0.6;
    if (inReach) { s.drillTarget = hit.obj; s.drillProgress = 0; }
  }

  const holdingOnRock = !!s.drillTarget;
  if (holdingOnRock) {
    // hold station on the rock so the swim step cannot pull the diver off it
    s.target.set(s.drillTarget.x, s.drillTarget.y + 0.4);
    s.drillProgress += dt / CONFIG.drill.seconds;
    if (s.drillProgress >= 1) {
      const rock = s.drillTarget;
      rock.opened = true;
      rock.mesh.material.color.set(0x2a3438);
      rock.mesh.scale.setScalar(0.6);
      if (rock.yields === 'part') s.carrying += 1;
      else s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.tankRefill);
      s.drillTarget = null;
      s.drillProgress = 0;
    }
  }

  // ---- boost ----------------------------------------------------------
  const wantsBoost = input.boostHeld && s.boostCharge > 0 && s.boostReady;
  s.boosting = wantsBoost;
  if (wantsBoost) {
    s.boostCharge -= dt;
    if (s.boostCharge <= 0) { s.boostCharge = 0; s.boostReady = false; }
  } else {
    s.boostCharge = Math.min(CONFIG.boost.maxHold, s.boostCharge + dt * (CONFIG.boost.maxHold / CONFIG.boost.cooldown));
    if (s.boostCharge >= CONFIG.boost.maxHold * 0.6) s.boostReady = true;
  }

  // ---- movement -------------------------------------------------------
  const speed = CONFIG.diver.baseSpeed
    * (1 + s.finStacks * CONFIG.fins.speedBonus)
    * (s.boosting ? CONFIG.boost.speedMultiplier : 1)
    * (holdingOnRock ? 0.15 : 1);

  const toTarget = new THREE.Vector2(s.target.x - p.x, s.target.y - p.y);
  const dist = toTarget.length();
  const desired = dist > CONFIG.diver.arriveRadius
    ? toTarget.normalize().multiplyScalar(speed)
    : new THREE.Vector2(0, 0);
  s.velocity.lerp(desired, Math.min(1, CONFIG.diver.accel * dt));
  p.x += s.velocity.x * dt;
  p.y += s.velocity.y * dt;
  p.x = THREE.MathUtils.clamp(p.x, -W.halfWidth, W.halfWidth);
  p.y = THREE.MathUtils.clamp(p.y, W.seabedY + 0.4, W.surfaceY - 0.4);
  s.depth = p.y;

  // procedural bob/tilt stands in for a rigged swim animation
  s.diver.rotation.z = -s.velocity.x * 0.12;
  s.diver.position.z = Math.sin(performance.now() * 0.004) * 0.06;

  // ---- oxygen ---------------------------------------------------------
  let drain = CONFIG.oxygen.baseDrain;
  if (holdingOnRock) drain *= CONFIG.oxygen.drillMultiplier;
  if (s.boosting) drain *= CONFIG.oxygen.boostMultiplier;
  s.oxygen -= drain * dt;

  // ---- pickups & parts ------------------------------------------------
  const grabRadius = CONFIG.diver.collectRadius;
  for (const part of s.level.parts) {
    if (part.taken) continue;
    if (Math.hypot(part.x - p.x, part.y - p.y) < grabRadius) {
      part.taken = true;
      part.mesh.visible = false;
      s.carrying += 1;
    }
  }
  for (const item of s.level.pickups) {
    if (item.taken) continue;
    if (Math.hypot(item.x - p.x, item.y - p.y) < grabRadius) {
      item.taken = true;
      item.mesh.visible = false;
      if (item.kind === 'tank') s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.tankRefill);
      if (item.kind === 'fins') s.finStacks = Math.min(CONFIG.fins.maxStacks, s.finStacks + 1);
      if (item.kind === 'light') s.lightStacks = Math.min(CONFIG.floodlight.maxStacks, s.lightStacks + 1);
    }
  }

  // ---- auto-repair on return -----------------------------------------
  const atShip = Math.hypot(s.ship.position.x - p.x, s.ship.position.y - p.y) < W.shipReturnRadius;
  if (atShip && s.carrying > 0) {
    // A return cashes in the whole trip: parts, the O2 you did not burn, and the
    // clock you did not spend. That is what makes staying down one more drill a bet.
    const o2Bonus = Math.round(s.oxygen) * CONFIG.score.perOxygen;
    const timeBonus = Math.round(Math.max(0, s.timeLeft)) * CONFIG.score.perSecond;
    s.breakdown.parts += s.carrying * CONFIG.score.perPart;
    s.breakdown.oxygen += o2Bonus;
    s.breakdown.time += timeBonus;
    s.partsBanked += s.carrying;
    s.bankedScore += s.carrying * CONFIG.score.perPart + o2Bonus + timeBonus;
    s.returns += 1;
    s.carrying = 0;
    s.oxygen = CONFIG.oxygen.max;   // topping off at the ship is the risk/reward pivot
  }

  // ---- sharks ---------------------------------------------------------
  let threat = false;
  for (const shark of s.level.sharks) {
    const d = Math.hypot(shark.x - p.x, shark.laneY - p.y);
    if (d < CONFIG.shark.dangerRadius) {
      threat = true;
      shark.inDanger = true;
      shark.state = 'chase';
      shark.chaseTimer = CONFIG.shark.loseInterestAfter;
      const dir = Math.sign(p.x - shark.x) || 1;
      shark.x += dir * CONFIG.shark.chaseSpeed * dt;
      shark.laneY += Math.sign(p.y - shark.laneY) * CONFIG.shark.chaseSpeed * 0.4 * dt;
      if (d < CONFIG.shark.catchRadius) return endRun('A shark caught you.');
    } else {
      if (shark.inDanger) {  // escaped the danger radius alive — bank the close call
        shark.inDanger = false;
        s.closeCalls += 1;
        s.breakdown.closeCalls += CONFIG.score.perCloseCall;
        s.bankedScore += CONFIG.score.perCloseCall;
      }
      shark.chaseTimer -= dt;
      if (shark.chaseTimer <= 0) shark.state = 'patrol';
      shark.x += shark.dir * CONFIG.shark.patrolSpeed * dt;
      if (Math.abs(shark.x) > W.halfWidth) shark.dir *= -1;
    }
    shark.mesh.position.set(shark.x, shark.laneY, 0);
    shark.mesh.rotation.z = shark.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  s.sharkThreat = threat;

  // ---- sonar bearing to the nearest undiscovered part ------------------
  const targets = [
    ...s.level.parts.filter((x) => !x.taken),
    ...s.level.rocks.filter((r) => !r.opened && r.yields === 'part'),
  ];
  const near = nearest(targets, p);
  s.sonar = near ? {
    normalized: Math.min(1, near.dist / (W.halfWidth * 1.6)),
    bearingDeg: (Math.atan2(near.obj.x - p.x, near.obj.y - p.y) * 180) / Math.PI,
  } : null;

  // ---- storm pressure --------------------------------------------------
  const lateT = 1 - THREE.MathUtils.clamp(s.timeLeft / CONFIG.run.lateGameSeconds, 0, 1);
  const light = 1 + s.lightStacks * 0.35;
  scene.fog.far = (44 - lateT * 20) * light;
  // setHSL defaults to the linear working space; pass sRGB so these read as authored.
  scene.background.setHSL(0.55, 0.55 - lateT * 0.35, 0.14 - lateT * 0.07, THREE.SRGBColorSpace);
  scene.fog.color.copy(scene.background);
  murk.position.x = Math.sin(performance.now() * 0.0002) * 1.5;

  // ---- camera ----------------------------------------------------------
  camera.position.x += (p.x * 0.55 - camera.position.x) * Math.min(1, dt * 3);
  camera.position.y += (p.y + 1.5 - camera.position.y) * Math.min(1, dt * 3);
  camera.lookAt(p.x * 0.6, p.y, 0);

  // ---- fail states ------------------------------------------------------
  if (s.oxygen <= 0) return endRun('Your tank ran dry.');
  if (s.timeLeft <= 0) return endRun('The storm made landfall.');
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running) update(dt);
  if (state) hud.update({ ...state, boostReady: state.boostReady, boosting: state.boosting });
  document.getElementById('drill-ring').style.setProperty('--fill', `${(state?.drillProgress ?? 0) * 100}%`);
  document.getElementById('drill-ring').dataset.on = state?.drillTarget ? 'true' : 'false';
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

resize();
startRun();
requestAnimationFrame(frame);

// Playtest hook: step the sim by hand, restart from a fixed seed, or inspect state
// from the console. Also how the smoke test in tools/ drives a headless run.
globalThis.DepthRush = {
  step: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n && running; i++) update(dt); return globalThis.DepthRush.state; },
  restart: (seed) => startRun(seed),
  get state() {
    return {
      seed: state.seed, oxygen: state.oxygen, timeLeft: state.timeLeft,
      depth: state.depth, x: state.diver.position.x, carrying: state.carrying,
      partsBanked: state.partsBanked, closeCalls: state.closeCalls,
      finStacks: state.finStacks, lightStacks: state.lightStacks,
      drilling: !!state.drillTarget, drillProgress: state.drillProgress,
      targetX: state.target.x, targetY: state.target.y,
      score: state.bankedScore, over: state.over, running,
    };
  },
  get level() { return state.level; },
  moveTo: (x, y) => { state.diver.position.set(x, y, 0); state.target.set(x, y); },
};
