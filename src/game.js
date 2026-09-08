// The simulation. Two modes share one world and one clock:
//   'boat' — moored at the surface, fitting parts while the storm closes in
//   'dive' — under the water, on the sticks
// The storm timer never stops in either mode. That is the whole game: every
// second spent installing a part is a second not spent finding the next one.
//
// The world is a 3D volume. The left stick swims relative to where you are
// looking; the right (eye) stick turns your head. Swimming follows your pitch,
// so looking down and pushing forward takes you down — there is no separate
// ascend/descend control to learn.
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';
import { PARTS } from './parts.js';
import { makeRng, randomSeed } from './rng.js';
import { generateLevel, MESHES, PALETTE, makeDiverLamp, loadTextures } from './world.js';
import { updateBoat } from './boat.js';
import { animateEnemy } from './enemies.js';

const W = CONFIG.world;
const DF = CONFIG.depthFade;
const PLAY = CONFIG.play;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

// Scratch vectors — the update loop must not allocate.
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _camWant = new THREE.Vector3();
const _look = new THREE.Vector3();
const _back = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _colShallow = new THREE.Color();
const _colDeep = new THREE.Color();

// Boat parts have illustrated silhouettes in the checklist. These resources
// only exist as 3D pickups, so use a compact emoji fallback whenever they are
// named in the HUD or a toast.
const RESOURCE_EMOJI = Object.freeze({
  air: '🫧',
  fins: '🦶',
  light: '🔦',
  beacon: '📡',
  crate: '📦',
});

// Gameplay proximity. On the plane the diver cannot steer in Z, so Z must not
// count against reaching something — otherwise an item a couple of metres off
// the plane is simply unreachable. Collision stays honestly 3D.
function reach(ax, ay, az, bx, by, bz) {
  return PLAY.planar ? Math.hypot(ax - bx, ay - by) : Math.hypot(ax - bx, ay - by, az - bz);
}

// Aim a model whose length runs along +X down a direction vector.
function aimAlong(obj, x, y, z) {
  const len = Math.hypot(x, y, z);
  if (len < 0.001) return;
  const pitch = Math.asin(clamp(y / len, -1, 1));
  const yaw = Math.atan2(-x, -z);
  obj.rotation.set(0, yaw + Math.PI / 2, pitch, 'YZX');
}

export class Game {
  constructor({ scene, camera, sun, ambient, moveStick, lookStick, panStick, boatLook,
                tilt, audio, minimap, hooks = {} }) {
    this.scene = scene;
    this.camera = camera;
    this.sun = sun;
    this.ambient = ambient;
    this.motes = new THREE.Group();
    this.caustics = [];
    this.shafts = [];
    this.kelp = [];
    this.surface = null;
    this.surfaceBase = null;
    this.colliders = [];
    this.move = moveStick;
    this.look = lookStick;
    this.pan = panStick;
    this.boatLook = boatLook;
    this.tilt = tilt ?? null;
    this.audio = audio;
    this.minimap = minimap ?? null;
    this.hooks = hooks;
    this.boostHeld = false;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.boat = MESHES.boat();
    this.boat.position.set(W.boatX, W.boatY, W.boatZ);
    scene.add(this.boat);

    this.diver = MESHES.diver();
    scene.add(this.diver);

    this.lamp = makeDiverLamp();
    this.diver.add(this.lamp);

    // Oxygen reads off a bar pinned above the diver. It billboards to the camera
    // so it stays legible from any angle.
    this.o2Bar = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.17),
      new THREE.MeshBasicMaterial({ color: 0x04141c, fog: false, transparent: true, opacity: 0.75 }));
    this.o2Fill = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.11),
      new THREE.MeshBasicMaterial({ color: PALETTE.ok, fog: false }));
    this.o2Fill.position.z = 0.01;
    this.o2Bar.add(back, this.o2Fill);
    // The oxygen readout is drawn in the DOM now, from the delivered artwork.
    // The group stays because the sonar chevron below still rides on it.
    back.visible = false;
    this.o2Fill.visible = false;

    this.sonarTick = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 3),
      new THREE.MeshBasicMaterial({ color: PALETTE.signal, fog: false, transparent: true, opacity: 0.9 })
    );
    this.sonarTick.position.y = 0.42;
    this.o2Bar.add(this.sonarTick);
    scene.add(this.o2Bar);

    this.bubbles = this._makeBubbles();
    scene.add(this.bubbles);

    this.state = null;
    this.mode = 'boat';
    this.paused = false;
    this.outro = null;
    this.clock = 0;
  }

  // Swapped in whenever a level with different dimensions is loaded.
  setEnvironment(env) {
    this.motes = env.motes;
    this.caustics = env.caustics ?? [];
    this.shafts = env.shafts?.children ?? [];
    this.kelp = env.kelp ?? [];
    this.surface = env.surface;
    this.surfaceBase = env.surfaceBase;
    this.colliders = env.colliders ?? [];
  }

  // How far back the camera may sit before something solid gets between it and
  // the diver. Analytic ray/sphere against the boulders we already track — far
  // cheaper than raycasting the scene graph, and they are what actually clips.
  _cameraReach(origin, dir, maxDist) {
    let limit = maxDist;
    const test = (cx, cy, cz, r) => {
      const lx = cx - origin.x, ly = cy - origin.y, lz = cz - origin.z;
      const tca = lx * dir.x + ly * dir.y + lz * dir.z;
      const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
      const rr = r * r;
      if (d2 > rr) return;
      const thc = Math.sqrt(rr - d2);
      const t0 = tca - thc;
      if (t0 > 0.1 && t0 < limit) limit = t0;
    };
    for (const c of this.colliders) test(c.x, c.y, c.z, c.r + 0.5);
    const rocks = this.state?.level?.rocks;
    if (rocks) for (const r of rocks) test(r.x, r.y, r.z, (r.opened ? 0.5 : 0.95) + 0.5);
    return limit;
  }

  // Exhaust bubbles, from a recycled pool — no allocation per frame.
  _makeBubbles() {
    const g = new THREE.Group();
    const tex = loadTextures().glow;
    for (let i = 0; i < 30; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xdff6ff, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      s.userData = { life: 0, ttl: 0, speed: 0, sway: 0, size: 0.2 };
      g.add(s);
    }
    g.userData.cursor = 0;
    return g;
  }

  _emitBubble(x, y, z, big = false) {
    const g = this.bubbles;
    const s = g.children[g.userData.cursor];
    g.userData.cursor = (g.userData.cursor + 1) % g.children.length;
    s.position.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.3);
    s.userData.size = (big ? 0.22 : 0.11) + Math.random() * 0.12;
    s.userData.life = 0;
    s.userData.ttl = 1.1 + Math.random() * 1.2;
    s.userData.speed = 0.9 + Math.random() * 0.9;
    s.userData.sway = Math.random() * Math.PI * 2;
  }

  _updateBubbles(dt) {
    for (const s of this.bubbles.children) {
      const u = s.userData;
      if (u.life >= u.ttl) { s.material.opacity = 0; continue; }
      u.life += dt;
      const t = u.life / u.ttl;
      s.position.y += u.speed * dt;
      s.position.x += Math.sin(u.sway + u.life * 5) * 0.35 * dt;
      s.position.z += Math.cos(u.sway + u.life * 4) * 0.3 * dt;
      s.material.opacity = Math.sin(t * Math.PI) * 0.5;
      const sc = u.size * (0.7 + t * 0.6);
      s.scale.set(sc, sc, 1);
    }
  }

  /* ------------------------------------------------------------- lifecycle */

  startRun(seed = randomSeed()) {
    this._clearLevel();
    const rng = makeRng(seed);
    const level = generateLevel(rng, this.colliders);

    const place = (o, mesh) => { o.mesh = mesh; mesh.position.set(o.x, o.y, o.z); this.group.add(mesh); };
    level.rocks.forEach((r) => place(r, MESHES.rock(r.shape)));
    level.parts.forEach((p) => place(p, MESHES.part(p.id)));
    level.pickups.forEach((p) => place(p, MESHES[p.kind]()));
    level.enemies.forEach((e) => place(e, MESHES.enemy(e.type)));
    level.anchors.forEach((a) => place(a, MESHES.anchor()));
    level.crates.forEach((c) => place(c, MESHES.crate()));

    this.state = {
      seed,
      level,
      timeLeft: CONFIG.run.stormSeconds,
      oxygen: CONFIG.oxygen.max,
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: -0.35,            // start looking slightly down, toward the work
      carrying: [],
      installed: [],
      found: new Set(),
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
      stunTimer: 0,
      breathing: false,
      canSurface: false,
      sonar: null,
      outcome: null,
      reason: '',
      score: 0,
      bubbleTimer: 0,
      kick: 0,
      flyups: [],
      depthT: 0,
      camDist: CONFIG.camera.distance,
      // measurements for the dive's training objective
      minAir: CONFIG.oxygen.max,
      maxDepth: 0,
      contacts: 0,
      planted: 0,
      delivered: 0,
      // Scouting from the deck: orbit around a focus you can walk over the map.
      boatYaw: 0.6,
      boatPitch: 0.45,
      panX: 0,
      panZ: 0,
      holdKind: null,
      haulCrate: null,
    };

    this.diver.position.set(W.boatX, W.boatY - 4.0, W.boatZ);
    this.boat.position.set(W.boatX, W.boatY, W.boatZ);
    this.boat.rotation.set(0, 0, 0);
    this.outro = null;
    this.minimap?.reset();
    this.setMode('boat');
    this.paused = false;
  }

  _clearLevel() {
    // A carried crate is parented to the diver, not the level group, so it
    // would otherwise survive into the next run.
    if (this.state?.haulCrate?.mesh) {
      this.diver.remove(this.state.haulCrate.mesh);
      this.state.haulCrate = null;
    }
    while (this.group.children.length) {
      const c = this.group.children.pop();
      c.traverse?.((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); });
    }
  }

  setMode(mode) {
    this.mode = mode;
    const s = this.state;
    if (mode === 'dive') {
      s.dives += 1;
      this.diver.position.set(W.boatX, W.boatY - 4.0, W.boatZ);
      s.velocity.set(0, 0, 0);
      s.oxygen = CONFIG.oxygen.max;
      s.yaw = 0;
      s.pitch = -0.5;
      s.canSurface = false;    // must clear the boat before surfacing counts
      this.tilt?.calibrate();  // however they are holding the phone right now is centre
    }
    if (mode === 'boat') {
      s.panX = 0;
      s.panZ = 0;
      this.pan?.reset();
      this.boatLook?.reset();
      s.drillRock = null;
      s.drillProgress = 0;
      s.sharkThreat = false;
      s.breathing = false;
    }
    this.move.reset();
    this.look.reset();
    this.hooks.onMode?.(mode);
  }

  /* ------------------------------------------------------------ boat logic */

  canRepair() { return this.boatAction.enabled; }

  setRepairing(on) {
    if (!this.state) return;
    this.state.repairing = on && this.canRepair();
    if (!this.state.repairing) this.state.repairProgress = 0;
  }

  recentre() {
    if (!this.state) return;
    this.state.panX = 0;
    this.state.panZ = 0;
  }

  _updateBoat(dt) {
    const s = this.state;
    this._updateEnemies(dt, null);

    // Drag anywhere to swing the view; the stick walks the focus point over the
    // dive site so you can scout a route before you go in.
    if (this.boatLook) {
      const { dx, dy } = this.boatLook.take();
      s.boatYaw -= dx * 0.006;
      s.boatPitch = clamp(s.boatPitch - dy * 0.005, -0.25, 1.15);
    }
    if (this.pan && this.pan.magnitude > 0.02) {
      const speed = 11;
      // pan relative to where the camera is looking, not to world axes
      const sinY = Math.sin(s.boatYaw), cosY = Math.cos(s.boatYaw);
      const fx = -sinY, fz = -cosY;
      s.panX += (this.pan.x * cosY + this.pan.y * fx) * speed * dt;
      s.panZ += (this.pan.x * -sinY + this.pan.y * fz) * speed * dt;
      s.panX = clamp(s.panX, -W.halfWidth, W.halfWidth);
      s.panZ = clamp(s.panZ, -W.halfDepth, W.halfDepth);
    }
    this.diver.visible = false;
    this.o2Bar.visible = false;
    this.lamp.visible = false;

    if (s.repairing && this.boatAction.enabled) {
      const secs = this.objective === 'beacon' ? CONFIG.objective.beacon.loadSeconds
        : this.objective === 'haul' ? CONFIG.objective.haul.unloadSeconds
        : CONFIG.repair.secondsPerPart;
      s.repairProgress += dt / secs;
      if (s.repairProgress >= 1) {
        s.repairProgress = 0;
        this.audio.installed();
        if (this.objective === 'beacon') {
          s.carrying.push('beacon');
          this.hooks.onToast?.(`Beacon aboard — ${s.carrying.length} loaded`);
        } else if (this.objective === 'haul') {
          s.carrying.shift();
          s.delivered += 1;
          this._stowCrate();
          this.hooks.onToast?.(`Crate secured — ${s.delivered}/${this.partsTotal}`);
          if (s.delivered >= this.partsTotal) return this._end('win', 'Cargo delivered. The boat sails.', 'win');
        } else {
          const id = s.carrying.shift();
          s.installed.push(id);
          this.hooks.onToast?.(`${PARTS.find((p) => p.id === id).label} fitted`);
          if (s.installed.length >= this.partsTotal) return this._end('win', 'The boat sails.', 'win');
        }
        if (!this.boatAction.enabled) this.setRepairing(false);
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
    this.lamp.visible = true;

    if (PLAY.planar) {
      // 2.7D: the stick maps straight onto the plane. Up is up. There is nothing
      // to aim, so there is no second stick.
      _fwd.set(0, 1, 0);
      _right.set(1, 0, 0);
    } else {
      // --- look: the eye stick turns the head ---
      s.yaw -= this.look.x * CONFIG.look.yawSpeed * dt;
      s.pitch = clamp(s.pitch + this.look.y * CONFIG.look.pitchSpeed * dt,
                      -CONFIG.look.pitchClamp, CONFIG.look.pitchClamp);

      _euler.set(s.pitch, s.yaw, 0, 'YXZ');
      _fwd.set(0, 0, -1).applyEuler(_euler);
      _yawEuler.set(0, s.yaw, 0, 'YXZ');
      _right.set(1, 0, 0).applyEuler(_yawEuler);
    }

    // --- hold-to-act: push into a boulder to drill it, or into an anchor to
    // plant a beacon. One gesture, one progress readout, two meanings.
    // Tilt takes over from the left stick when it is live; both expose the same
    // x / y / magnitude shape, so nothing downstream needs to know which is which.
    const src = this.tilt?.active ? this.tilt : this.move;
    const stickLen = src.magnitude;
    _desired.set(0, 0, 0)
      .addScaledVector(_fwd, src.y)
      .addScaledVector(_right, src.x);
    const pushing = stickLen > 0.3 && _desired.lengthSq() > 0.001;
    const aimedAt = (o, within) => {
      const d = reach(o.x, o.y, o.z, p.x, p.y, p.z);
      if (d > within || d < 0.0001) return false;
      _tmp.set(o.x - p.x, o.y - p.y, PLAY.planar ? 0 : o.z - p.z).normalize();
      return _tmp.dot(_look.copy(_desired).normalize()) > CONFIG.drill.aimDot;
    };

    let target = null, kind = null;
    if (pushing && this.objective === 'beacon' && s.carrying.length) {
      let best = null, bd = Infinity;
      for (const a of s.level.anchors) {
        if (a.planted) continue;
        const d = reach(a.x, a.y, a.z, p.x, p.y, p.z);
        if (d < bd) { bd = d; best = a; }
      }
      if (best && aimedAt(best, CONFIG.drill.contactRadius + 1.0)) { target = best; kind = 'anchor'; }
    }
    if (!target && pushing) {
      let best = null, bd = Infinity;
      for (const r of s.level.rocks) {
        if (r.opened) continue;
        const d = reach(r.x, r.y, r.z, p.x, p.y, p.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (best && aimedAt(best, CONFIG.drill.contactRadius)) { target = best; kind = 'rock'; }
    }

    const drilling = !!target;
    if (target) {
      if (s.drillRock !== target) { s.drillRock = target; s.drillProgress = 0; s.holdKind = kind; }
      const before = s.drillProgress;
      const secs = kind === 'anchor' ? CONFIG.objective.beacon.plantSeconds : CONFIG.drill.seconds;
      s.drillProgress += dt / secs;
      if (Math.floor(s.drillProgress * 8) !== Math.floor(before * 8)) this.audio.drillTick();
      if (kind === 'rock') {
        target.mesh.material.color.setHex(PALETTE.rockLit);
        target.mesh.rotation.z += dt * 3;
      }
      if (s.drillProgress >= 1) {
        if (kind === 'anchor') this._plantBeacon(target);
        else this._openRock(target);
      }
    } else {
      if (s.drillRock && s.holdKind === 'rock') s.drillRock.mesh.material.color.setHex(PALETTE.rock);
      s.drillRock = null;
      s.holdKind = null;
      s.drillProgress = 0;
    }

    // --- boost ---
    const wantsBoost = this.boostHeld && s.boostReady && s.boostCharge > 0;
    s.boosting = wantsBoost;
    if (wantsBoost) {
      s.boostCharge -= dt;
      if (s.boostCharge <= 0) { s.boostCharge = 0; s.boostReady = false; }
    } else {
      s.boostCharge = Math.min(CONFIG.boost.maxHold, s.boostCharge + dt * (CONFIG.boost.maxHold / CONFIG.boost.cooldown));
      if (s.boostCharge >= CONFIG.boost.maxHold * 0.65) s.boostReady = true;
    }

    // --- movement, relative to where you are looking ---
    if (s.stunTimer > 0) s.stunTimer -= dt;
    const hauling = this.objective === 'haul' && s.carrying.length > 0;
    const speed = CONFIG.diver.speed
      * (1 + s.finStacks * CONFIG.fins.speedBonus)
      * (s.boosting ? CONFIG.boost.speedMultiplier : 1)
      * (s.stunTimer > 0 ? 0.45 : 1)
      * (hauling ? CONFIG.objective.haul.speedFactor : 1);
    if (_desired.lengthSq() > 1) _desired.normalize();
    _desired.multiplyScalar(speed);
    if (drilling) _desired.multiplyScalar(0.12);          // hold station on the rock
    s.velocity.lerp(_desired, Math.min(1, CONFIG.diver.accel * dt));
    if (!stickLen) s.velocity.multiplyScalar(Math.max(0, 1 - CONFIG.diver.drag * dt));

    p.addScaledVector(s.velocity, dt);
    if (PLAY.planar) {
      // Eased back onto the plane rather than pinned to it, so being shoved
      // around a boulder reads as depth instead of a hard stop.
      p.z += (PLAY.planeZ - p.z) * Math.min(1, PLAY.planeSpring * dt);
      s.velocity.z *= Math.max(0, 1 - 4 * dt);
    }
    p.x = clamp(p.x, -W.halfWidth, W.halfWidth);
    p.z = clamp(p.z, -W.halfDepth, W.halfDepth);
    p.y = clamp(p.y, W.seabedY + 0.7, W.surfaceY - 0.3);

    // Rock and scenery are both solid: push the diver out along the contact
    // normal. Scenery used to be swim-through, which looked wrong and was also
    // how the camera ended up inside boulders.
    const pushOut = (cx, cy, cz, solid) => {
      _tmp.set(p.x - cx, p.y - cy, p.z - cz);
      const d = _tmp.length();
      if (d >= solid || d === 0) return;
      _tmp.divideScalar(d);
      p.set(cx, cy, cz).addScaledVector(_tmp, solid);
      const into = s.velocity.dot(_tmp);
      if (into < 0) s.velocity.addScaledVector(_tmp, -into);
    };
    for (const r of s.level.rocks) pushOut(r.x, r.y, r.z, (r.opened ? 0.5 : 0.92) + CONFIG.diver.bodyRadius);
    for (const c of this.colliders) pushOut(c.x, c.y, c.z, c.r + CONFIG.diver.bodyRadius);

    if (PLAY.planar) {
      const v = s.velocity;
      if (v.lengthSq() > 0.04) {
        aimAlong(this.diver, v.x, v.y, 0);
        s.yaw = v.x >= 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    } else {
      aimAlong(this.diver, _fwd.x, _fwd.y, _fwd.z);
    }

    // Fin kick, driven by how hard the diver is actually swimming.
    const effort = Math.min(1, s.velocity.length() / CONFIG.diver.speed);
    s.kick += dt * (3 + effort * 9);
    const swing = Math.sin(s.kick) * 0.32 * (0.25 + effort);
    for (const child of this.diver.children) {
      if (child.userData.finIndex === undefined) continue;
      child.rotation.z = Math.PI / 2 + swing * (child.userData.finIndex ? 1 : -1);
    }

    this.lamp.distance = 12 + s.lightStacks * CONFIG.floodlight.radiusBonus;
    this.lamp.intensity = 7 + 3 * clamp(s.oxygen / CONFIG.oxygen.max, 0.25, 1) + s.lightStacks * 2;

    // --- oxygen: break the surface and you breathe ---
    const nearSurface = (W.surfaceY - p.y) < CONFIG.oxygen.surfaceDepth;
    s.breathing = nearSurface && s.oxygen < CONFIG.oxygen.max;
    if (nearSurface) {
      if (s.breathing) {
        const before = s.oxygen;
        s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.surfaceRefillPerSec * dt);
        if (before < CONFIG.oxygen.max * 0.5 && s.oxygen >= CONFIG.oxygen.max * 0.5) this.audio.surfaced();
      }
    } else {
      let drain = CONFIG.oxygen.baseDrain;
      if (drilling) drain *= CONFIG.oxygen.drillMultiplier;
      if (s.boosting) drain *= CONFIG.oxygen.boostMultiplier;
      if (hauling) drain *= CONFIG.objective.haul.drainFactor;
      const before = s.oxygen;
      s.oxygen -= drain * dt;
      s.minAir = Math.min(s.minAir, s.oxygen);
      const lowAt = CONFIG.oxygen.max * CONFIG.oxygen.redBelow;
      if (before > lowAt && s.oxygen <= lowAt) this.audio.alarm();
    }

    // Exhaust bubbles, faster when working hard.
    s.bubbleTimer -= dt;
    if (s.bubbleTimer <= 0) {
      s.bubbleTimer = drilling ? 0.09 : s.boosting ? 0.06 : 0.34 - effort * 0.16;
      this._emitBubble(p.x + _fwd.x * 0.5, p.y + 0.15, p.z + _fwd.z * 0.5, s.boosting || drilling);
    }

    s.maxDepth = Math.max(s.maxDepth, W.surfaceY - p.y);
    this.minimap?.reveal(p.x, p.z, 4.0 + s.lightStacks * 1.6);

    // --- collection ---
    const R = CONFIG.diver.collectRadius;
    for (const part of s.level.parts) {
      if (part.taken || reach(part.x, part.y, part.z, p.x, p.y, p.z) > R) continue;
      part.taken = true;
      part.mesh.visible = false;
      this._takePart(part.id);
    }
    if (this.objective === 'haul' && !s.carrying.length) {
      for (const c of s.level.crates) {
        if (c.taken || reach(c.x, c.y, c.z, p.x, p.y, p.z) > R + 0.8) continue;
        c.taken = true;
        s.carrying.push('crate');
        s.haulCrate = c;
        // carry it under the diver so the load is visible
        this.group.remove(c.mesh);
        c.mesh.position.set(0, -1.0, 0);
        c.mesh.scale.setScalar(0.8);
        this.diver.add(c.mesh);
        this.audio.partFound();
        this.hooks.onToast?.(`${RESOURCE_EMOJI.crate} Crate on the line — you are slow now`);
        break;
      }
    }
    for (const item of s.level.pickups) {
      if (item.taken || reach(item.x, item.y, item.z, p.x, p.y, p.z) > R) continue;
      item.taken = true;
      item.mesh.visible = false;
      this.audio.pickup();
      if (item.kind === 'tank') {
        s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.tankRefill);
        this.hooks.onToast?.(`${RESOURCE_EMOJI.air} Spare air tank`);
      } else if (item.kind === 'fins') {
        s.finStacks = Math.min(CONFIG.fins.maxStacks, s.finStacks + 1);
        this.hooks.onToast?.(`${RESOURCE_EMOJI.fins} Fins — faster this dive`);
      } else {
        s.lightStacks = Math.min(CONFIG.floodlight.maxStacks, s.lightStacks + 1);
        this.hooks.onToast?.(`${RESOURCE_EMOJI.light} Floodlight — you can see further`);
      }
    }

    if (this._updateEnemies(dt, p)) return;

    // --- climbing aboard ---
    const toBoat = Math.hypot(this.boat.position.x - p.x, this.boat.position.y - p.y, this.boat.position.z - p.z);
    if (!s.canSurface && toBoat > W.surfaceRadius * 1.35) s.canSurface = true;
    if (s.canSurface && toBoat < W.surfaceRadius) {
      this.audio.surfaced();
      this.setMode('boat');
      // A survey only counts once it is called in from the deck, so the swim
      // home still matters on a beacon dive.
      if (this.objective === 'beacon' && s.planted >= this.partsTotal) {
        return this._end('win', 'Survey called in. The boat sails.', 'win');
      }
      const a = this.boatAction;
      this.hooks.onToast?.(a.enabled ? `Aboard — hold ${a.label}` : 'Aboard — tank refilled');
      return;
    }

    // --- sonar ---
    const remaining = this.objective === 'beacon'
      ? (s.carrying.length ? s.level.anchors.filter((a) => !a.planted) : [])
      : this.objective === 'haul'
        ? (s.carrying.length ? [] : s.level.crates.filter((c) => !c.taken))
        : [
            ...s.level.parts.filter((x) => !x.taken),
            ...s.level.rocks.filter((r) => !r.opened && r.part),
          ];
    let near = null, nearD = Infinity;
    for (const o of remaining) {
      const d = Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z);
      if (d < nearD) { nearD = d; near = o; }
    }
    const lowAir = s.oxygen / CONFIG.oxygen.max < CONFIG.oxygen.headHomeBelow;
    if (lowAir || !near) {
      s.sonar = { dist: toBoat, mode: 'home',
        tx: this.boat.position.x, ty: this.boat.position.y, tz: this.boat.position.z };
    } else {
      s.sonar = { dist: nearD, mode: 'part', tx: near.x, ty: near.y, tz: near.z };
    }

    if (s.oxygen <= 0) return this._end('loss', 'You ran out of oxygen.', 'oxygen');
  }

  _plantBeacon(anchor) {
    const s = this.state;
    anchor.planted = true;
    s.planted += 1;
    s.carrying.shift();
    s.drillRock = null;
    s.drillProgress = 0;
    s.holdKind = null;
    anchor.mesh.traverse((n) => {
      if (n.userData.mast) n.visible = true;
      if (n.userData.halo && n.material) n.material.color.setHex(PALETTE.ok);
    });
    this.audio.installed();
    for (let i = 0; i < 6; i++) this._emitBubble(anchor.x, anchor.y + 0.5, anchor.z, true);
    this.hooks.onToast?.(`${RESOURCE_EMOJI.beacon} Beacon planted — ${s.planted}/${this.partsTotal}`);
  }

  _stowCrate() {
    const s = this.state;
    if (!s.haulCrate) return;
    const m = s.haulCrate.mesh;
    this.diver.remove(m);
    m.traverse?.((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); });
    s.haulCrate.delivered = true;
    s.haulCrate = null;
  }

  // Enemies keep swimming whether or not anyone is in the water. Passing
  // p = null means the diver is aboard: nothing to hunt, so pursuit decays and
  // they drift back to their patrol lanes instead of parking under the hull —
  // which is exactly what they used to do while you were on deck.
  _updateEnemies(dt, p) {
    const s = this.state;
    const SH = CONFIG.shark;
    let threat = false;
    for (const e of s.level.enemies) {
      const spec = e.spec;
      const dx = p ? p.x - e.x : 0, dy = p ? p.y - e.y : 0, dz = p ? p.z - e.z : 0;
      const d = p ? (Math.hypot(dx, dy, dz) || 0.0001) : Infinity;
      if (e.biteTimer > 0) e.biteTimer -= dt;

      if (p && spec.detectRadius > 0 && d < spec.detectRadius) e.chaseTimer = spec.loseInterestAfter;
      else e.chaseTimer -= dt;
      const chasing = e.chaseTimer > 0 && spec.chaseSpeed > 0;
      let wx, wy, wz;
      if (chasing) {
        wx = (dx / d) * spec.chaseSpeed;
        wy = (dy / d) * spec.chaseSpeed * spec.verticalBias;
        wz = (dz / d) * spec.chaseSpeed;
      } else if (spec.drifts) {
        e.heading += 0.18 * dt;
        wx = Math.cos(e.heading) * spec.patrolSpeed * 0.6;
        wz = Math.sin(e.heading) * spec.patrolSpeed * 0.6;
        wy = Math.sin(this.clock * 0.4 + e.phase) * spec.patrolSpeed;
      } else {
        e.heading += Math.sin(this.clock * 0.3 + e.laneY) * 0.25 * dt;
        wx = Math.cos(e.heading) * spec.patrolSpeed;
        wz = Math.sin(e.heading) * spec.patrolSpeed;
        wy = clamp((e.laneY - e.y) * 0.8, -1.2, 1.2);
      }
      // A plane-locked hunter patrols across the plane at a constant lateral
      // speed rather than losing it to a heading that points into the screen.
      const onPlane = PLAY.planar && spec.planeLocked;
      if (onPlane) {
        if (!chasing) wx = (Math.cos(e.heading) >= 0 ? 1 : -1) * spec.patrolSpeed;
        wz = 0;
      }
      const turn = Math.min(1, spec.turnRate * dt);
      e.vx += (wx - e.vx) * turn;
      e.vy += (wy - e.vy) * turn;
      e.vz += (wz - e.vz) * turn;

      e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      if (onPlane) e.z += (PLAY.planeZ - e.z) * Math.min(1, 6 * dt);
      if (e.x <= -W.halfWidth || e.x >= W.halfWidth) {
        e.x = clamp(e.x, -W.halfWidth, W.halfWidth);
        e.vx *= -1; e.heading = Math.PI - e.heading;
      }
      if (e.z <= -W.halfDepth || e.z >= W.halfDepth) {
        e.z = clamp(e.z, -W.halfDepth, W.halfDepth);
        e.vz *= -1; e.heading = -e.heading;
      }
      e.y = clamp(e.y, W.seabedY + 1.0, W.surfaceY - 1.4);

      if (p && d < spec.dangerRadius) {
        threat = true;
        e.dwell += dt;
      } else {
        // Escaping a ring you actually loitered inside is the risk bonus.
        // Jellies do not count: nothing was hunting you.
        if (!spec.drifts && e.dwell >= spec.closeCallDwell && !e.banked) {
          e.banked = true;
          s.closeCalls += 1;
          this.audio.danger();
          this.hooks.onToast?.('Close call +' + CONFIG.score.perCloseCall);
        }
        if (e.dwell > 0) { e.dwell = 0; e.banked = false; }
      }

      if (p && d < spec.contactRadius) {
        if (spec.lethal) {
          s.contacts += 1;
          this._end('loss', `A ${spec.label.toLowerCase()} caught you.`, 'shark');
          return true;
        }
        if (e.biteTimer <= 0) {
          e.biteTimer = spec.biteCooldown;
          s.contacts += 1;
          s.oxygen = Math.max(0, s.oxygen - spec.oxygenBite);
          if (spec.slowFactor) s.stunTimer = 1.2;
          this.audio.danger();
          this.hooks.onToast?.(`${spec.label} — ${spec.oxygenBite} air lost`);
          this.hooks.onHit?.();
        }
      }

      e.mesh.position.set(e.x, e.y, e.z);
      if (!spec.drifts) aimAlong(e.mesh, e.vx, e.vy, e.vz);
      animateEnemy(e, this.clock);
    }
    s.sharkThreat = threat;
    return false;

  }

  _openRock(rock) {
    const s = this.state;
    rock.opened = true;
    rock.mesh.material.color.setHex(PALETTE.deep);
    rock.mesh.scale.setScalar(0.55);
    s.drillRock = null;
    s.drillProgress = 0;
    if (rock.part) {
      this._spawnFlyup(rock.part, rock.x, rock.y, rock.z);
      this._takePart(rock.part);
    } else {
      s.oxygen = Math.min(CONFIG.oxygen.max, s.oxygen + CONFIG.oxygen.tankRefill);
      this.audio.pickup();
      this.hooks.onToast?.(`${RESOURCE_EMOJI.air} Air pocket`);
    }
  }

  // A part sealed in a rock has no mesh until the rock cracks. Without this the
  // only feedback was a toast, so drilling felt like nothing happened.
  _spawnFlyup(id, x, y, z) {
    const m = MESHES.part(id);
    m.position.set(x, y, z);
    this.group.add(m);
    this.state.flyups.push({ mesh: m, t: 0 });
    for (let i = 0; i < 6; i++) this._emitBubble(x, y, z, true);
  }

  _updateFlyups(dt) {
    const s = this.state;
    if (!s.flyups.length) return;
    const p = this.diver.position;
    for (let i = s.flyups.length - 1; i >= 0; i--) {
      const f = s.flyups[i];
      f.t += dt / 0.75;
      if (f.t >= 1) {
        this.group.remove(f.mesh);
        f.mesh.traverse((n) => { n.geometry?.dispose?.(); n.material?.dispose?.(); });
        s.flyups.splice(i, 1);
        continue;
      }
      const e = f.t * f.t;
      f.mesh.position.lerp(_tmp.set(p.x, p.y + 0.4, p.z), e * 0.35);
      f.mesh.rotation.y += dt * 5;
      f.mesh.scale.setScalar(1 + Math.sin(f.t * Math.PI) * 0.5 - f.t * 0.55);
    }
  }

  _takePart(id) {
    const s = this.state;
    s.carrying.push(id);
    s.found.add(id);
    this.audio.partFound();
    this.hooks.onToast?.(`${PARTS.find((p) => p.id === id).label} recovered`);
    this.hooks.onPartFound?.(id);
  }

  /* ------------------------------------------------------------------ end */

  // Each dive states a skill and then measures whether it was demonstrated.
  // The measurement is real gameplay data, not a participation badge — and the
  // bonus only pays out on a run you actually finished.
  _evaluateTraining(outcome) {
    const t = CONFIG.training;
    if (!t) return null;
    const s = this.state;
    const readings = {
      minAir: Math.round(Math.max(0, s.minAir)),
      dives: s.dives,
      contacts: s.contacts,
      closeCalls: s.closeCalls,
      lights: s.lightStacks,
      sweptPct: Math.round(this.minimap?.exploredPct() ?? 0),
      timeLeft: Math.round(Math.max(0, s.timeLeft)),
    };
    const value = readings[t.metric] ?? 0;
    const hit = t.compare === 'lte' ? value <= t.target : value >= t.target;
    return { ...t, value, met: hit && outcome === 'win' };
  }

  // `cause` is what actually finished the run — 'shark', 'oxygen', 'storm',
  // 'quit' or 'win' — which is what selects the game-over film and artwork.
  _end(outcome, reason, cause = outcome === 'win' ? 'win' : 'quit') {
    const s = this.state;
    if (s.outcome) return;
    s.outcome = outcome;
    s.reason = reason;
    s.cause = cause;
    s.training = this._evaluateTraining(outcome);
    s.breakdown = {
      parts: this.goalDone * CONFIG.score.perPartInstalled,
      closeCalls: s.closeCalls * CONFIG.score.perCloseCall,
      escape: outcome === 'win' ? Math.round(Math.max(0, s.timeLeft)) * CONFIG.score.perSecondOnEscape : 0,
      training: s.training?.met ? CONFIG.score.trainingBonus : 0,
    };
    s.score = s.breakdown.parts + s.breakdown.closeCalls + s.breakdown.escape + s.breakdown.training;
    if (outcome === 'win') { this.audio.win(); this.outro = 0; } else this.audio.lose();
    this.hooks.onEnd?.(outcome, reason, s);
  }

  // Plays after a win: the boat pulls away toward shore behind the score card.
  updateOutro(dt) {
    if (this.outro == null) return;
    this.outro += dt;
    const t = Math.min(1, this.outro / 7);
    const eased = t * t * (3 - 2 * t);
    this.boat.position.x = W.boatX + eased * 34;
    this.boat.position.y = W.boatY + Math.sin(this.outro * 1.6) * 0.16;
    this.boat.rotation.z = Math.sin(this.outro * 1.2) * 0.05;
    this.diver.visible = false;
    this.o2Bar.visible = false;
    const cx = this.boat.position.x;
    this.camera.position.set(cx - 9, 4.5, 13);
    this.camera.lookAt(cx + 1, 1.2, 0);
    updateBoat(this.boat, this.clock + this.outro, 0);
  }

  // Last line of defence: if the camera ended a frame inside a solid, push it
  // straight back out along the surface normal.
  _evictCamera() {
    const c = this.camera.position;
    const evict = (cx, cy, cz, r) => {
      _tmp.set(c.x - cx, c.y - cy, c.z - cz);
      const d = _tmp.length();
      if (d >= r || d === 0) return;
      _tmp.divideScalar(d);
      c.set(cx, cy, cz).addScaledVector(_tmp, r);
    };
    for (const o of this.colliders) evict(o.x, o.y, o.z, o.r + 0.25);
    const rocks = this.state?.level?.rocks;
    if (rocks) for (const r of rocks) evict(r.x, r.y, r.z, (r.opened ? 0.5 : 0.95) + 0.25);
  }

  /* --------------------------------------------------------------- update */

  update(dt) {
    const s = this.state;
    if (!s || s.outcome || this.paused) return;

    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      s.timeLeft = 0;
      return this._end('loss', 'Thunderstorm arrived.', 'storm');
    }

    if (this.mode === 'dive') this._updateDive(dt);
    else this._updateBoat(dt);
    if (s.outcome) return;

    this._updateVisuals(dt);
  }

  _updateVisuals(dt) {
    const s = this.state;
    const p = this.diver.position;
    this.clock += dt;

    // --- oxygen bar + sonar chevron, billboarded to the camera ---
    const pct = clamp(s.oxygen / CONFIG.oxygen.max, 0, 1);
    this.o2Bar.position.set(p.x, p.y + 1.15, p.z);
    this.o2Bar.quaternion.copy(this.camera.quaternion);

    // Where the diver lands on screen, so the DOM oxygen badge can ride with
    // them. Normalised 0..1 from the top-left; `behind` means off-camera.
    _tmp.set(p.x, p.y + 0.95, p.z).project(this.camera);
    s.screen = {
      x: (_tmp.x * 0.5 + 0.5),
      y: (-_tmp.y * 0.5 + 0.5),
      behind: _tmp.z > 1,
    };
    this.o2Fill.scale.x = Math.max(0.001, pct);
    this.o2Fill.position.x = -(1.32 * (1 - pct)) / 2;
    this.o2Fill.material.color.setHex(
      pct < CONFIG.oxygen.redBelow ? PALETTE.danger : pct < CONFIG.oxygen.amberBelow ? PALETTE.signal : PALETTE.ok
    );

    if (s.sonar && this.mode === 'dive') {
      this.sonarTick.visible = true;
      // Project the bearing into camera space, so the chevron points at the
      // target on screen whichever way the head is turned.
      _tmp.set(s.sonar.tx - p.x, s.sonar.ty - p.y, s.sonar.tz - p.z)
        .applyQuaternion(this.camera.quaternion.clone().invert());
      this.sonarTick.rotation.z = -Math.atan2(_tmp.x, _tmp.y);
      this.sonarTick.material.opacity = 0.3 + 0.65 * (1 - clamp(s.sonar.dist / (W.halfWidth * 1.6), 0, 1));
      this.sonarTick.material.color.setHex(s.sonar.mode === 'home' ? PALETTE.ok : PALETTE.signal);
    } else {
      this.sonarTick.visible = false;
    }

    // --- the water closes in with depth ---
    const depthT = clamp((W.surfaceY - p.y) / Math.abs(W.seabedY), 0, 1);
    s.depthT = depthT;
    const late = 1 - clamp(s.timeLeft / CONFIG.run.lateGameSeconds, 0, 1);
    const lightRelief = s.lightStacks * 0.12;
    const murk = clamp(depthT + late * 0.45 - lightRelief, 0, 1);

    _colShallow.setHex(PALETTE.shallow);
    _colDeep.setHex(PALETTE.abyss);
    _colShallow.lerp(_colDeep, Math.pow(murk, 0.85));
    this.scene.background.copy(_colShallow);
    this.scene.fog.color.copy(_colShallow);
    this.scene.fog.near = lerp(DF.fogNearSurface, DF.fogNearDeep, murk);
    this.scene.fog.far = lerp(DF.fogFarSurface, DF.fogFarDeep, murk) * (1 + s.lightStacks * 0.18);
    this.ambient.intensity = lerp(DF.ambientSurface, DF.ambientDeep, murk);
    this.sun.intensity = lerp(DF.sunSurface, DF.sunDeep, murk);

    // --- ambient life ---
    for (const m of this.motes.children) {
      m.position.y += m.userData.drift * dt;
      m.position.x += Math.sin(this.clock * 0.6 + m.userData.sway) * 0.12 * dt;
      if (m.position.y > W.surfaceY) m.position.y = W.seabedY;
    }
    for (const c of this.caustics) {
      c.material.map.offset.x += c.userData.speed * dt;
      c.material.map.offset.y += c.userData.speed * 0.6 * dt;
    }
    for (const sh of this.shafts) {
      sh.userData.mat.opacity = (0.08 + 0.05 * (0.5 + 0.5 * Math.sin(this.clock * 0.5 + sh.userData.phase))) * (1 - late * 0.7);
    }
    for (const k of this.kelp) {
      const { blades, base, height, phase, amp } = k.userData;
      for (const blade of blades) {
        const pos = blade.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = base[i * 3 + 1];
          const t = y / height;                    // rooted at the bed, loose at the tip
          pos.setX(i, base[i * 3] + Math.sin(this.clock * 0.9 + phase + t * 2.2) * amp * t * t);
        }
        pos.needsUpdate = true;
      }
    }
    // gentle swell on the underside of the surface
    if (this.surface && this.surfaceBase) {
      const pos = this.surface.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = this.surfaceBase[i * 3], by = this.surfaceBase[i * 3 + 1];
        pos.setZ(i, Math.sin(bx * 0.18 + this.clock * 0.8) * 0.28 + Math.sin(by * 0.15 + this.clock * 0.6) * 0.22);
      }
      pos.needsUpdate = true;
    }
    this._updateBubbles(dt);
    this._updateFlyups(dt);

    // --- boat: bob, and list by however much of her is still missing ---
    const missing = 1 - s.installed.length / Math.max(1, this.partsTotal);
    this.boat.position.y = W.boatY + Math.sin(this.clock * 0.9) * 0.12;
    this.boat.rotation.z = Math.sin(this.clock * 0.7) * 0.03 - missing * 0.055;
    updateBoat(this.boat, this.clock, s.repairing ? 1 : 0);

    // --- camera ---
    const k = Math.min(1, dt * CONFIG.camera.followLerp);
    if (this.mode === 'dive' && PLAY.planar) {
      // 2.7D: a fixed, slightly raked shot that tracks the diver across the
      // plane. No collision test here, deliberately — scenery is all built
      // behind the play plane so the line to the diver is clear by
      // construction, and the only things left to hit are the objective
      // boulders, which sit ON the plane by necessity. Testing against those
      // collapsed the camera onto the diver whenever you stood beside one.
      // Diver collision already stops you tucking directly behind a boulder,
      // so grazing is all that can happen, and grazing reads as depth.
      _camWant.set(p.x, p.y + CONFIG.camera.planarHeight, PLAY.planeZ + CONFIG.camera.planarDistance);
      _camWant.x = clamp(_camWant.x, -W.halfWidth + 3, W.halfWidth - 3);
      _camWant.y = clamp(_camWant.y, W.seabedY + 4.0, W.surfaceY + 3.5);
      this.camera.position.lerp(_camWant, k);
      _look.set(p.x, p.y - 0.6, PLAY.planeZ);
      this.camera.lookAt(_look);
    } else if (this.mode === 'dive') {
      _euler.set(s.pitch, s.yaw, 0, 'YXZ');
      _fwd.set(0, 0, -1).applyEuler(_euler);
      // Pull the camera in when something would sit between it and the diver,
      // and ease back out once the way is clear so it does not snap. The test
      // runs along the true diver->camera segment, height lift included.
      _back.copy(p).addScaledVector(_fwd, -CONFIG.camera.distance);
      _back.y += CONFIG.camera.height;
      _back.sub(p);
      const full = _back.length() || 0.001;
      _back.divideScalar(full);
      const reach = this._cameraReach(p, _back, full);
      const wanted = clamp(reach - 0.35, CONFIG.camera.minDistance, full);
      s.camDist = wanted < s.camDist ? wanted : lerp(s.camDist, wanted, Math.min(1, dt * 2.5));
      _camWant.copy(p).addScaledVector(_back, s.camDist);
      _camWant.y = clamp(_camWant.y, W.seabedY + 1.0, W.surfaceY - 0.4);
      this.camera.position.lerp(_camWant, k);
      this._evictCamera();
      _look.copy(p).addScaledVector(_fwd, CONFIG.camera.lookAhead);
      this.camera.lookAt(_look);
    } else {
      const fx = W.boatX + s.panX, fz = W.boatZ + s.panZ;
      const scouting = Math.hypot(s.panX, s.panZ) > 0.5;
      const dist = 13 + Math.hypot(s.panX, s.panZ) * 0.15;
      const cp = Math.cos(s.boatPitch);
      _camWant.set(
        fx + Math.sin(s.boatYaw) * cp * dist,
        W.boatY + 1.2 + Math.sin(s.boatPitch) * dist,
        fz + Math.cos(s.boatYaw) * cp * dist
      );
      _camWant.y = Math.max(_camWant.y, W.surfaceY + 1.2);
      this.camera.position.lerp(_camWant, k);
      _look.set(fx, W.boatY + (scouting ? -1.2 : 1.1), fz);
      this.camera.lookAt(_look);
    }
  }

  /* ------------------------------------------------------------- readouts */

  get objective() { return this.state?.level?.objective ?? 'salvage'; }

  get partsTotal() {
    const lv = this.state?.level;
    if (!lv) return PARTS.length;
    if (lv.objective === 'beacon') return lv.anchors.length;
    if (lv.objective === 'haul') return lv.crates.length;
    return lv.activeParts.length;
  }

  get goalDone() {
    const s = this.state;
    if (!s) return 0;
    if (this.objective === 'beacon') return s.planted;
    if (this.objective === 'haul') return s.delivered;
    return s.installed.length;
  }

  // What the second button on the boat does, and whether it can do it.
  get boatAction() {
    const s = this.state;
    if (!s) return { label: 'Repair', enabled: false, verb: 'fit' };
    if (this.objective === 'beacon') {
      const left = this.partsTotal - s.planted - s.carrying.length;
      return { label: 'Load', verb: 'load',
               enabled: this.mode === 'boat' && left > 0 && s.carrying.length < CONFIG.objective.beacon.maxLoad };
    }
    if (this.objective === 'haul') {
      return { label: 'Unload', verb: 'unload',
               enabled: this.mode === 'boat' && s.carrying.length > 0 };
    }
    return { label: 'Repair', verb: 'fit', enabled: this.mode === 'boat' && s.carrying.length > 0 };
  }

  get checklist() {
    const s = this.state;
    const active = new Set(s.level.activeParts);
    return PARTS.filter((p) => active.has(p.id)).map((p) => ({
      ...p,
      state: s.installed.includes(p.id) ? 'installed'
        : s.carrying.includes(p.id) ? 'carried'
        : 'unknown',
    }));
  }
}
