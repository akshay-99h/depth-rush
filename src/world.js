// Scene construction + per-run level generation.
// Play happens on the XY plane (X = horizontal, Y = depth). Z is decoration only.
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';

const W = CONFIG.world;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  return renderer;
}

export function createCamera() {
  // Portrait framing: ~18m tall view, width follows aspect.
  const cam = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 120);
  cam.position.set(0, -6, 16);
  return cam;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a2740);
  scene.fog = new THREE.Fog(0x0a2740, 16, 44);

  scene.add(new THREE.AmbientLight(0x6fd8e0, 0.55));
  const sun = new THREE.DirectionalLight(0xbfefff, 0.9);
  sun.position.set(2, 10, 6);
  scene.add(sun);

  // Surface plane + seabed slab give the run its vertical anchors.
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfWidth * 3, 6),
    new THREE.MeshBasicMaterial({ color: 0x9fe8f2, transparent: true, opacity: 0.35 })
  );
  surface.position.set(0, W.surfaceY + 2.6, -2);
  scene.add(surface);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W.halfWidth * 3, 3, 14),
    new THREE.MeshStandardMaterial({ color: 0x1d3d3a, roughness: 1 })
  );
  floor.position.set(0, W.seabedY - 1.5, -1);
  scene.add(floor);

  // Parallax murk behind the play plane.
  const murk = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.1, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x8fdcea, transparent: true, opacity: 0.25 })
    );
    m.position.set((Math.random() - 0.5) * W.halfWidth * 2.5, W.seabedY + Math.random() * 16, -3 - Math.random() * 6);
    murk.add(m);
  }
  scene.add(murk);

  return { scene, murk, floor, surface };
}

function marker(color, size, shape = 'box') {
  const geo = shape === 'sphere'
    ? new THREE.SphereGeometry(size, 12, 12)
    : shape === 'cone'
      ? new THREE.ConeGeometry(size, size * 2, 8)
      : new THREE.BoxGeometry(size * 2, size * 2, size * 2);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.25 }));
}

// Placeholder-grade art on purpose — the loop is what this prototype proves.
export const MESHES = {
  diver: () => marker(0xffd782, 0.34, 'sphere'),
  ship: () => marker(0xc9d6d4, 0.9),
  part: () => marker(0xffc247, 0.28),
  rock: () => marker(0x53656b, 0.55, 'cone'),
  tank: () => marker(0x35d6c4, 0.25),
  fins: () => marker(0x7ba7ff, 0.24),
  light: () => marker(0xfff0a8, 0.24),
  shark: () => marker(0x7f95a3, 0.45, 'cone'),
};

// Every run reshuffles the seabed: nothing carries over, layout never repeats.
export function generateLevel(rng) {
  const spread = W.halfWidth - 1.5;
  const seabedBand = () => rng.range(W.seabedY + 0.6, W.seabedY + 4.5);
  const spot = () => ({ x: rng.range(-spread, spread), y: seabedBand() });

  const rocks = [];
  for (let i = 0; i < CONFIG.spawn.rocks; i++) {
    const p = spot();
    // Roughly a third of rocks hide a part; the rest hide a spare tank.
    rocks.push({ ...p, yields: i < Math.ceil(CONFIG.spawn.rocks / 3) ? 'part' : 'tank', opened: false });
  }

  const looseParts = CONFIG.spawn.parts - rocks.filter(r => r.yields === 'part').length;
  const parts = [];
  for (let i = 0; i < Math.max(0, looseParts); i++) parts.push({ ...spot(), taken: false });

  const pickups = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) pickups.push({ ...spot(), kind, taken: false }); };
  add('tank', CONFIG.spawn.tanks);
  add('fins', CONFIG.spawn.fins);
  add('light', CONFIG.spawn.floodlights);

  const sharks = [];
  for (let i = 0; i < CONFIG.shark.count; i++) {
    const laneY = rng.range(W.seabedY + 2, W.seabedY + 8);
    sharks.push({
      laneY,
      x: rng.range(-spread, spread),
      dir: rng.pick([-1, 1]),
      state: 'patrol',
      chaseTimer: 0,
      inDanger: false,
    });
  }

  return { rocks, parts, pickups, sharks };
}
