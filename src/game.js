// The simulation. Two modes share one world and one clock:
//   'boat' — moored at the surface, fitting parts while the storm closes in
//   'dive' — under the water, on the stick
// The storm timer never stops in either mode. That is the whole game: every
// second spent installing a part is a second not spent finding the next one.
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';
import { PARTS, PART_COUNT } from './parts.js';
import { makeRng, randomSeed } from './rng.js';
import { generateLevel, MESHES, PALETTE } from './world.js';

const W = CONFIG.world;
const clamp = THREE.MathUtils.clamp;

export class Game {
  constructor({ scene, camera, motes, joystick, audio, hooks = {} }) {
    this.scene = scene;
    this.camera = camera;
    this.motes = motes;
    this.stick = joystick;
    this.audio = audio;
    this.hooks = hooks;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.boat = MESHES.boat();
    this.boat.position.set(W.boatX, W.boatY, 0);
    scene.add(this.boat);

    this.diver = MESHES.diver();
    scene.add(this.diver);

    // Oxygen reads off a bar pinned above the diver rather than a corner gauge —
    // the lofi puts it there, and it keeps the player's eyes on the danger.
    this.o2Bar = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.17), new THREE.MeshBasicMaterial({ color: 0x04141c, fog: false, transparent: true, opacity: 0.75 }));
    this.o2Fill = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.11), new THREE.MeshBasicMaterial({ color: PALETTE.ok, fog: false }));
    this.o2Fill.position.z = 0.01;
    this.o2Bar.add(back, this.o2Fill);

    // Sonar reads as a chevron above the tank bar that swings toward the nearest
    // part still out there, brightening as it closes. No extra HUD chip needed.
    this.sonarTick = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 3),
      new THREE.MeshBasicMaterial({ color: PALETTE.signal, fog: false, transparent: true, opacity: 0.9 })
    );
    this.sonarTick.position.y = 0.42;
    this.o2Bar.add(this.sonarTick);
    scene.add(this.o2Bar);

    this.state = null;
    this.mode = 'boat';
    this.paused = false;
    this.outro = null;
  }

  /* ------------------------------------------------------------- lifecycle */

  startRun(seed = randomSeed()) {
    this._clearLevel();
    const rng = makeRng(seed);
    const level = generateLevel(rng);

    const place = (o, mesh) => { o.mesh = mesh; mesh.position.set(o.x, o.y, 0); this.group.add(mesh); };
    level.rocks.forEach((r) => place(r, MESHES.rock()));
    level.parts.forEach((p) => place(p, MESHES.part(p.id)));
    level.pickups.forEach((p) => place(p, MESHES[p.kind]()));
    level.sharks.forEach((s) => place(s, MESHES.shark()));

    this.state = {
      seed,
      level,
      timeLeft: CONFIG.run.stormSeconds,
      oxygen: CONFIG.oxygen.max,
      velocity: new THREE.Vector2(),
      carrying: [],            // part ids in hand
      installed: [],           // part ids fitted to the boat
      found: new Set(),        // part ids ever recovered
      closeCalls: 0,
      finStacks: 0,
      lightStacks: 0,
      boostCharge: CONFIG.boost.maxHold,
      boostReady: true,
      boosting: false,
      drillRock: null,
      drillProgress: 0,
      repairing: false,
      repairProgress: 0,
      dives: 0,
      sharkThreat: false,
      sonar: null,
      outcome: null,
      reason: '',
      score: 0,
    };

    this.diver.position.set(W.boatX, W.boatY - 2.4, 0);
    this.boat.position.set(W.boatX, W.boatY, 0);
    this.boat.rotation.z = 0;
    this.outro = null;
    this.setMode('boat');
    this.paused = false;
  }

  _clearLevel() {
    while (this.group.children.length) {
      const c = this.group.children.pop();
      c.traverse?.((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); });
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }
  }

  setMode(mode) {
    this.mode = mode;
    const s = this.state;
    if (mode === 'dive') {
      s.dives += 1;
      // Enter the water just under the keel, tank topped off.
      this.diver.position.set(W.boatX, W.boatY - 2.4, 0);
      s.velocity.set(0, 0);
      s.oxygen = CONFIG.oxygen.max;
      this.stick.reset();
    } else {
      s.drillRock = null;
      s.drillProgress = 0;
      s.sharkThreat = false;
      this.stick.reset();
    }
    this.hooks.onMode?.(mode);
  }

  /* ------------------------------------------------------------ boat logic */

  canRepair() {
    return this.mode === 'boat' && this.state.carrying.length > 0;
  }

  setRepairing(on) {
    if (!this.state) return;
    this.state.repairing = on && this.canRepair();
    if (!this.state.repairing) this.state.repairProgress = 0;
  }

  _updateBoat(dt) {
    const s = this.state;
    // Bob the boat so the surface never looks frozen.
    const t = performance.now() * 0.001;
    this.boat.position.y = W.boatY + Math.sin(t * 0.9) * 0.12;
    this.boat.rotation.z = Math.sin(t * 0.7) * 0.03;
    this.diver.visible = false;
    this.o2Bar.visible = false;

    if (s.repairing && s.carrying.length) {
      s.repairProgress += dt / CONFIG.repair.secondsPerPart;
      if (s.repairProgress >= 1) {
        const id = s.carrying.shift();
        s.installed.push(id);
        s.repairProgress = 0;
        this.audio.installed();
        const part = PARTS.find((p) => p.id === id);
        this.hooks.onToast?.(`${part.label} fitted`);
        if (s.installed.length >= PART_COUNT) return this._end('win', 'The boat sails.');
        if (!s.carrying.length) this.setRepairing(false);
      }
    } else {
      s.repairProgress = 0;
    }
  }

  /* ------------------------------------------------------------ dive logic */

  _updateDive(dt) {
    const s = this.state;
    const p = this.diver.position;
    this.diver.visible = true;
    this.o2Bar.visible = true;

    // --- drill: push the stick into a rock and hold ---
    const stickLen = this.stick.magnitude;
    let rock = null, rockDist = Infinity;
    for (const r of s.level.rocks) {
      if (r.opened) continue;
      const d = Math.hypot(r.x - p.x, r.y - p.y);
      if (d < rockDist) { rockDist = d; rock = r; }
    }
    let drilling = false;
    if (rock && rockDist < CONFIG.drill.contactRadius && stickLen > 0.3) {
      const dx = (rock.x - p.x) / (rockDist || 1);
      const dy = (rock.y - p.y) / (rockDist || 1);
      if (this.stick.x * dx + this.stick.y * dy > 0.35) drilling = true;
    }
    if (drilling) {
      if (s.drillRock !== rock) { s.drillRock = rock; s.drillProgress = 0; }
      s.drillProgress += dt / CONFIG.drill.seconds;
      if (Math.floor(s.drillProgress * 8) !== Math.floor((s.drillProgress - dt / CONFIG.drill.seconds) * 8)) {
        this.audio.drillTick();
      }
      rock.mesh.material.color.setHex(PALETTE.rockLit);
      rock.mesh.rotation.z += dt * 3;
      if (s.drillProgress >= 1) this._openRock(rock);
    } else {
      if (s.drillRock) s.drillRock.mesh.material.color.setHex(PALETTE.rock);
      s.drillRock = null;
      s.drillProgress = 0;
    }

    // --- boost ---
    const wantsBoost = this.stick.boostHeld && s.boostReady && s.boostCharge > 0;
    s.boosting = wantsBoost;
    if (wantsBoost) {
      s.boostCharge -= dt;
      if (s.boostCharge <= 0) { s.boostCharge = 0; s.boostReady = false; }
    } else {
      s.boostCharge = Math.min(CONFIG.boost.maxHold, s.boostCharge + dt * (CONFIG.boost.maxHold / CONFIG.boost.cooldown));
      if (s.boostCharge >= CONFIG.boost.maxHold * 0.65) s.boostReady = true;
    }

    // --- movement ---
    const speed = CONFIG.diver.speed
      * (1 + s.finStacks * CONFIG.fins.speedBonus)
      * (s.boosting ? CONFIG.boost.speedMultiplier : 1);
    const desired = new THREE.Vector2(this.stick.x, this.stick.y).multiplyScalar(speed);
    if (drilling) desired.multiplyScalar(0.12);   // hold station against the rock
    s.velocity.lerp(desired, Math.min(1, CONFIG.diver.accel * dt));
    if (!stickLen) s.velocity.multiplyScalar(Math.max(0, 1 - CONFIG.diver.drag * dt));
    p.x = clamp(p.x + s.velocity.x * dt, -W.halfWidth, W.halfWidth);
    p.y = clamp(p.y + s.velocity.y * dt, W.seabedY + 0.5, W.surfaceY - 0.5);

    // face travel direction, with a little roll
    if (Math.abs(s.velocity.x) > 0.15) this.diver.scale.x = s.velocity.x > 0 ? 1 : -1;
    this.diver.rotation.z = clamp(s.velocity.y * 0.12, -0.5, 0.5) * this.diver.scale.x;

    // --- oxygen ---
    let drain = CONFIG.oxygen.baseDrain;
    if (drilling) drain *= CONFIG.oxygen.drillMultiplier;
    if (s.boosting) drain *= CONFIG.oxygen.boostMultiplier;
    const before = s.oxygen;
    s.oxygen -= drain * dt;
    const lowAt = CONFIG.oxygen.max * CONFIG.oxygen.redBelow;
    if (before > lowAt && s.oxygen <= lowAt) this.audio.alarm();

    // --- collection ---
    const R = CONFIG.diver.collectRadius;
    for (const part of s.level.parts) {
      if (part.taken || Math.hypot(part.x - p.x, part.y - p.y) > R) continue;
      part.taken = true;
      part.mesh.visible = false;
      this._takePart(part.id);
    }
    for (const item of s.level.pickups) {
      if (item.taken || Math.hypot(item.x - p.x, item.y - p.y) > R) continue;
      item.taken = true;
      item.mesh.visible = false;
      this.audio.pickup();
      if (item.kind === 'tank') {
        s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.tankRefill);
        this.hooks.onToast?.('Spare tank');
      } else if (item.kind === 'fins') {
        s.finStacks = Math.min(CONFIG.fins.maxStacks, s.finStacks + 1);
        this.hooks.onToast?.('Fins — faster this dive');
      } else {
        s.lightStacks = Math.min(CONFIG.floodlight.maxStacks, s.lightStacks + 1);
        this.hooks.onToast?.('Floodlight — you can see further');
      }
    }

    // --- sharks ---
    let threat = false;
    for (const shark of s.level.sharks) {
      const d = Math.hypot(shark.x - p.x, shark.y - p.y);
      if (d < CONFIG.shark.dangerRadius) {
        threat = true;
        shark.chaseTimer = CONFIG.shark.loseInterestAfter;
        shark.dwell += dt;
        const dirX = Math.sign(p.x - shark.x) || 1;
        shark.x += dirX * CONFIG.shark.chaseSpeed * dt;
        shark.y += Math.sign(p.y - shark.y) * CONFIG.shark.chaseSpeed * 0.45 * dt;
        shark.dir = dirX;
        if (d < CONFIG.shark.catchRadius) return this._end('loss', 'A shark caught you.');
      } else {
        // Escaping a radius you actually loitered inside is the risk bonus.
        if (shark.dwell >= CONFIG.shark.closeCallDwell && !shark.banked) {
          shark.banked = true;
          s.closeCalls += 1;
          this.audio.danger();
          this.hooks.onToast?.('Close call +' + CONFIG.score.perCloseCall);
        }
        if (shark.dwell > 0) { shark.dwell = 0; shark.banked = false; }
        shark.chaseTimer -= dt;
        shark.x += shark.dir * CONFIG.shark.patrolSpeed * dt;
        if (Math.abs(shark.x) > W.halfWidth) shark.dir *= -1;
      }
      shark.mesh.position.set(shark.x, shark.y, 0);
      shark.mesh.scale.x = shark.dir > 0 ? 1 : -1;
    }
    s.sharkThreat = threat;

    // --- surfacing ---
    if (Math.hypot(this.boat.position.x - p.x, this.boat.position.y - p.y) < W.surfaceRadius) {
      this.audio.surfaced();
      this.setMode('boat');
      this.hooks.onToast?.(s.carrying.length ? 'Aboard — fit what you found' : 'Aboard — tank refilled');
      return;
    }

    // --- sonar bearing to the nearest part still out there ---
    const remaining = [
      ...s.level.parts.filter((x) => !x.taken),
      ...s.level.rocks.filter((r) => !r.opened && r.part),
    ];
    let near = null, nearD = Infinity;
    for (const o of remaining) {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < nearD) { nearD = d; near = o; }
    }
    s.sonar = near ? { dist: nearD, bearingDeg: (Math.atan2(near.x - p.x, near.y - p.y) * 180) / Math.PI } : null;

    if (s.oxygen <= 0) return this._end('loss', 'Your tank ran dry.');
  }

  _openRock(rock) {
    const s = this.state;
    rock.opened = true;
    rock.mesh.material.color.setHex(PALETTE.deep);
    rock.mesh.scale.setScalar(0.55);
    s.drillRock = null;
    s.drillProgress = 0;
    if (rock.part) {
      this._takePart(rock.part);
    } else {
      s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.tankRefill);
      this.audio.pickup();
      this.hooks.onToast?.('Air pocket');
    }
  }

  _takePart(id) {
    const s = this.state;
    s.carrying.push(id);
    s.found.add(id);
    this.audio.partFound();
    const part = PARTS.find((p) => p.id === id);
    this.hooks.onToast?.(`${part.label} recovered`);
    this.hooks.onPartFound?.(id);
  }

  /* ------------------------------------------------------------------ end */

  _end(outcome, reason) {
    const s = this.state;
    if (s.outcome) return;
    s.outcome = outcome;
    s.reason = reason;
    s.breakdown = {
      parts: s.installed.length * CONFIG.score.perPartInstalled,
      closeCalls: s.closeCalls * CONFIG.score.perCloseCall,
      // Beating the storm pays for the clock you did not need. Losing pays nothing
      // for it — otherwise sitting on the boat would score.
      escape: outcome === 'win' ? Math.round(Math.max(0, s.timeLeft)) * CONFIG.score.perSecondOnEscape : 0,
    };
    s.score = s.breakdown.parts + s.breakdown.closeCalls + s.breakdown.escape;
    if (outcome === 'win') { this.audio.win(); this.outro = 0; } else { this.audio.lose(); }
    this.hooks.onEnd?.(outcome, reason, s);
  }

  /* --------------------------------------------------------------- update */

  // Plays after a win: the boat pulls away toward shore behind the score card.
  updateOutro(dt) {
    if (this.outro == null) return;
    this.outro += dt;
    const t = Math.min(1, this.outro / 7);
    const eased = t * t * (3 - 2 * t);
    this.boat.position.x = W.boatX + eased * 26;
    this.boat.position.y = W.boatY + Math.sin(this.outro * 1.6) * 0.16;
    this.boat.rotation.z = Math.sin(this.outro * 1.2) * 0.05;
    this.diver.visible = false;
    this.o2Bar.visible = false;
    // Sit the boat high in frame so it stays clear of the score card below it.
    const camX = W.boatX + eased * 20;
    this.camera.position.set(camX, W.boatY - 5.6, 22);
    this.camera.lookAt(camX + 2, W.boatY - 5.2, 0);
  }

  update(dt) {
    const s = this.state;
    if (!s || s.outcome || this.paused) return;

    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      s.timeLeft = 0;
      return this._end('loss', 'The storm made landfall.');
    }

    if (this.mode === 'dive') this._updateDive(dt);
    else this._updateBoat(dt);
    if (s.outcome) return;

    this._updateVisuals(dt);
  }

  _updateVisuals(dt) {
    const s = this.state;
    const p = this.diver.position;

    // O2 bar rides above the diver
    const pct = clamp(s.oxygen / CONFIG.oxygen.max, 0, 1);
    this.o2Bar.position.set(p.x, p.y + 1.05, 0.2);
    this.o2Fill.scale.x = Math.max(0.001, pct);
    this.o2Fill.position.x = -(1.32 * (1 - pct)) / 2;
    this.o2Fill.material.color.setHex(
      pct < CONFIG.oxygen.redBelow ? PALETTE.danger : pct < CONFIG.oxygen.amberBelow ? PALETTE.signal : PALETTE.ok
    );

    if (s.sonar) {
      this.sonarTick.visible = this.mode === 'dive';
      // bearingDeg is measured clockwise from "up", which is how the cone points.
      this.sonarTick.rotation.z = -(s.sonar.bearingDeg * Math.PI) / 180;
      this.sonarTick.material.opacity = 0.25 + 0.7 * (1 - clamp(s.sonar.dist / (W.halfWidth * 1.4), 0, 1));
    } else {
      this.sonarTick.visible = false;
    }

    // Storm pressure: the water darkens and closes in over the last 90 seconds.
    const late = 1 - clamp(s.timeLeft / CONFIG.run.lateGameSeconds, 0, 1);
    const light = 1 + s.lightStacks * 0.3;
    const depthT = clamp((W.surfaceY - p.y) / Math.abs(W.seabedY), 0, 1);
    const base = new THREE.Color(PALETTE.shallow).lerp(new THREE.Color(PALETTE.abyss), depthT * 0.85);
    base.lerp(new THREE.Color(PALETTE.abyss), late * 0.7);
    this.scene.background.copy(base);
    this.scene.fog.color.copy(base);
    this.scene.fog.near = 12 * light;
    this.scene.fog.far = (46 - late * 22) * light;

    for (const m of this.motes.children) {
      m.position.y += m.userData.drift * dt;
      if (m.position.y > W.surfaceY) m.position.y = W.seabedY;
    }

    // Camera: framed on the boat at the surface, trailing the diver underwater.
    const target = this.mode === 'dive'
      ? { x: p.x * 0.7, y: p.y + 1.2, z: 18 }
      : { x: W.boatX, y: W.boatY - 3.4, z: 21 };
    const k = Math.min(1, dt * 3.2);
    this.camera.position.x += (target.x - this.camera.position.x) * k;
    this.camera.position.y += (target.y - this.camera.position.y) * k;
    this.camera.position.z += (target.z - this.camera.position.z) * k;
    this.camera.lookAt(target.x, target.y, 0);
  }

  /* ------------------------------------------------------------- readouts */

  get checklist() {
    const s = this.state;
    return PARTS.map((p) => ({
      ...p,
      state: s.installed.includes(p.id) ? 'installed'
        : s.carrying.includes(p.id) ? 'carried'
        : 'unknown',
    }));
  }
}
