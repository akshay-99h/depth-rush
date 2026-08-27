// Scene construction + per-run level generation.
// Play happens on the XY plane (X across, Y depth). Z is parallax only.
// Materials are deliberately flat and unlit: silhouette plus fog does the depth
// work, which stays readable on a phone in daylight and costs almost nothing.
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';
import { PARTS } from './parts.js';

const W = CONFIG.world;

export const PALETTE = {
  abyss: 0x04141c,
  deep: 0x072430,
  water: 0x0d3a4a,
  shallow: 0x14586b,
  foam: 0x7fd4d9,
  ok: 0x35d6c4,
  signal: 0xffb340,
  danger: 0xff4d5e,
  rock: 0x123141,
  rockLit: 0x1d4a5e,
  shark: 0x9fb6c0,
  hull: 0xd8e6e4,
  diver: 0xffd782,
};

const flat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  return renderer;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(52, 9 / 19.5, 0.1, 160);
  cam.position.set(0, -6, 18);
  return cam;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.water);
  scene.fog = new THREE.Fog(PALETTE.water, 18, 46);

  // Sky band above the waterline — the only warm value in the scene, so the
  // surface always reads as "safety" from anywhere in the water column.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(W.halfWidth * 4, 24), flat(0x2b6b7d, { fog: false }));
  sky.position.set(0, W.surfaceY + 12.2, -8);
  scene.add(sky);

  const surface = new THREE.Mesh(new THREE.PlaneGeometry(W.halfWidth * 4, 0.5), flat(PALETTE.foam, { fog: false }));
  surface.position.set(0, W.surfaceY + 0.25, -1);
  scene.add(surface);

  // Depth bands: each darker slab sells descent without a single light calculation.
  const bands = [];
  for (let i = 0; i < 4; i++) {
    const h = (Math.abs(W.seabedY) + 2) / 4;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(W.halfWidth * 4, h),
      flat(PALETTE.water, { transparent: true, opacity: 0.28 })
    );
    m.position.set(0, W.surfaceY - h * (i + 0.5), -6 + i * 0.2);
    scene.add(m);
    bands.push(m);
  }

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W.halfWidth * 4, 4, 16), flat(PALETTE.deep));
  floor.position.set(0, W.seabedY - 2, -1);
  scene.add(floor);

  const ridge = new THREE.Mesh(new THREE.PlaneGeometry(W.halfWidth * 4, 1.2), flat(PALETTE.rockLit, { transparent: true, opacity: 0.5 }));
  ridge.position.set(0, W.seabedY + 0.6, -2);
  scene.add(ridge);

  // Drifting motes give the water parallax and a sense of scale.
  const motes = new THREE.Group();
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.04 + Math.random() * 0.08, 6),
      flat(PALETTE.foam, { transparent: true, opacity: 0.18 })
    );
    m.position.set((Math.random() - 0.5) * W.halfWidth * 3, W.seabedY + Math.random() * (Math.abs(W.seabedY) + 2), -3 - Math.random() * 5);
    m.userData.drift = 0.1 + Math.random() * 0.35;
    motes.add(m);
  }
  scene.add(motes);

  return { scene, motes, bands, sky };
}

/* ---------------------------------------------------------------- meshes */

function boatMesh() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 1.6), flat(PALETTE.hull));
  const keel = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.5, 4), flat(0x8fa8ad));
  keel.rotation.x = Math.PI; keel.rotation.y = Math.PI / 4;
  keel.position.y = -0.9;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.3), flat(0xf2f7f6));
  cabin.position.set(-0.5, 0.95, 0);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), flat(0xf2f7f6));
  mast.position.set(0.9, 1.65, 0);
  g.add(hull, keel, cabin, mast);
  return g;
}

function diverMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 8), flat(0x1c3d4c));
  body.rotation.z = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), flat(PALETTE.diver));
  head.position.x = 0.5;
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 6), flat(PALETTE.ok));
  tank.rotation.z = Math.PI / 2; tank.position.set(-0.35, 0.16, -0.1);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 3), flat(0x1c3d4c));
  fin.rotation.z = Math.PI / 2; fin.position.x = -0.72;
  g.add(body, head, tank, fin);
  return g;
}

function sharkMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 4, 8), flat(PALETTE.shark));
  body.rotation.z = Math.PI / 2;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), flat(PALETTE.shark));
  snout.rotation.z = -Math.PI / 2; snout.position.x = 1.05;
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 3), flat(0x8aa2ad));
  dorsal.position.y = 0.42;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 3), flat(0x8aa2ad));
  tail.rotation.z = Math.PI / 2; tail.position.x = -1.0;
  g.add(body, snout, dorsal, tail);
  return g;
}

// Each part gets its own silhouette so it is identifiable on the seabed and in
// the checklist without reading the label.
function partMesh(id) {
  const mat = flat(PALETTE.signal);
  switch (id) {
    case 'propeller': {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 3), mat);
        blade.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.25, Math.sin((i / 3) * Math.PI * 2) * 0.25, 0);
        blade.rotation.z = (i / 3) * Math.PI * 2 - Math.PI / 2;
        g.add(blade);
      }
      return g;
    }
    case 'rudder':  return new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.72, 3), mat);
    case 'hull':    return new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.18), mat);
    case 'fuel':    return new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 6, 12), mat);
    default:        return new THREE.Mesh(new THREE.OctahedronGeometry(0.36), mat);
  }
}

export const MESHES = {
  boat: boatMesh,
  diver: diverMesh,
  shark: sharkMesh,
  part: partMesh,
  rock: () => new THREE.Mesh(new THREE.DodecahedronGeometry(0.85), flat(PALETTE.rock)),
  tank: () => new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 8), flat(PALETTE.ok)),
  fins: () => new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 3), flat(0x7ba7ff)),
  light: () => new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), flat(0xfff0a8)),
};

/* ------------------------------------------------------------ generation */

// Every run reshuffles the seabed. Three of the five parts are sealed inside
// rocks so the player has to spend air drilling, not just swimming.
export function generateLevel(rng) {
  const spread = W.halfWidth - 1.6;
  const spot = () => ({
    x: rng.range(-spread, spread),
    y: rng.range(W.seabedY + 0.8, W.seabedY + 5.5),
  });
  // Keep the area right under the boat clear so the first dive is never a wall.
  const clearSpot = () => {
    let p = spot(), guard = 0;
    while (Math.abs(p.x - W.boatX) < 2.2 && guard++ < 24) p = spot();
    return p;
  };

  const order = PARTS.map((p) => p.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const sealed = order.slice(0, CONFIG.spawn.partsInRocks);
  const loose = order.slice(CONFIG.spawn.partsInRocks);

  const rocks = [];
  for (let i = 0; i < CONFIG.spawn.rocks; i++) {
    rocks.push({ ...clearSpot(), opened: false, part: sealed[i] ?? null, yieldsTank: !sealed[i] });
  }

  const parts = loose.map((id) => ({ ...clearSpot(), id, taken: false }));

  const pickups = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) pickups.push({ ...clearSpot(), kind, taken: false }); };
  add('tank', CONFIG.spawn.tanks);
  add('fins', CONFIG.spawn.fins);
  add('light', CONFIG.spawn.floodlights);

  const sharks = [];
  for (let i = 0; i < CONFIG.shark.count; i++) {
    sharks.push({
      x: rng.range(-spread, spread),
      y: rng.range(W.seabedY + 2.5, W.seabedY + 9),
      dir: rng.pick([-1, 1]),
      chaseTimer: 0,
      dwell: 0,
      banked: false,
    });
  }

  return { rocks, parts, pickups, sharks };
}
