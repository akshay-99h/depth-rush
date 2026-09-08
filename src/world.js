// Scene construction + per-run level generation.
// Play happens on the XY plane (X across, Y depth). Z is depth-of-field only.
//
// Everything is lit and textured — the textures are drawn procedurally at load
// (see textures.js) because the build may not fetch anything. Geometry is built
// from profiles and lathes rather than primitives so silhouettes read as objects
// rather than as shapes.
import * as THREE from '../vendor/three.module.js';
import { CONFIG } from './config.js';
import { PARTS } from './parts.js';
import {
  sandTexture, rockTexture, hullTexture, brassTexture,
  suitTexture, sharkTexture, causticsTexture, glowTexture,
} from './textures.js';
import { buildBoat } from './boat.js';
import { enemyMesh, ENEMY_TYPES } from './enemies.js';

const W = CONFIG.world;
const D = CONFIG.depthFade;

export const PALETTE = {
  // Tuned to sit with the painted UI: saturated cyan at the surface falling to a
  // deep blue rather than to black, so depth still reads without going murky.
  abyss: 0x0b4076,
  deep: 0x12588c,
  water: 0x2384c4,
  shallow: 0x3fb8ea,
  foam: 0x7fd4d9,
  ok: 0x35d6c4,
  signal: 0xffb340,
  danger: 0xff4d5e,
  rock: 0xffffff,        // rocks are textured; tint stays neutral
  rockLit: 0xffd9a0,     // warm flash while a rock is being drilled
  shark: 0x9fb6c0,
  hull: 0xd8e6e4,
  diver: 0xffd782,
};

let TEX = null;
export function loadTextures() {
  if (TEX) return TEX;
  TEX = {
    sand: sandTexture(),
    rock: rockTexture(),
    hull: hullTexture(),
    brass: brassTexture(),
    suit: suitTexture(),
    shark: sharkTexture(),
    caustics: causticsTexture(),
    glow: glowTexture(),
  };
  return TEX;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  return renderer;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(CONFIG.camera.fov, 9 / 19.5, 0.1, 220);
  cam.position.set(0, -6, 18);
  return cam;
}

// The scene and its lights are made once. Everything whose size depends on the
// level — bed, surface, caustics, shafts, kelp, boulders, motes — is built by
// buildEnvironment() and rebuilt whenever a level with different dimensions is
// loaded. Without that split, picking a 60m-deep dive would still render the
// 28m one.
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.shallow);
  scene.fog = new THREE.Fog(PALETTE.shallow, D.fogNearSurface, D.fogFarSurface);

  const sun = new THREE.DirectionalLight(0xeafaff, D.sunSurface);
  sun.position.set(6, 40, 10);
  scene.add(sun);
  const ambient = new THREE.HemisphereLight(0xc4f0ff, 0x2f7bb0, D.ambientSurface);
  scene.add(ambient);

  return { scene, sun, ambient };
}

function disposeDeep(obj) {
  obj.traverse?.((n) => {
    n.geometry?.dispose?.();
    if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose?.());
    else n.material?.dispose?.();
  });
}

export function buildEnvironment(scene) {
  const tex = loadTextures();
  const P = CONFIG.play;
  // In 2.7D the camera looks along +Z at a fixed plane, so anything in front of
  // that plane ends up between the lens and the diver. Scenery is pushed behind.
  const sceneryZ = (spread) => (P.planar
    ? P.planeZ - 3.5 - Math.random() * Math.max(6, spread * 0.5)
    : (Math.random() - 0.5) * spread);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    if (c.userData?.env) { disposeDeep(c); scene.remove(c); }
  }
  const add = (o) => { o.userData.env = true; scene.add(o); return o; };

  const spanX = W.halfWidth * 2, spanZ = W.halfDepth * 2;
  const depth = Math.abs(W.seabedY);

  // The underside of the surface: a big bright ceiling you can always find by
  // looking up, which is what makes "swim up to breathe" legible.
  const surface = add(new THREE.Mesh(
    new THREE.PlaneGeometry(spanX * 3, spanZ * 3, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xa6e6ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  ));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = W.surfaceY;
  const surfaceBase = surface.geometry.attributes.position.array.slice();

  const floor = add(new THREE.Mesh(
    new THREE.PlaneGeometry(spanX * 2, spanZ * 2, 1, 1),
    new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 0.95, metalness: 0 })
  ));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = W.seabedY;

  const caustics = [];
  for (let i = 0; i < 2; i++) {
    const m = add(new THREE.Mesh(
      new THREE.PlaneGeometry(spanX * 2, spanZ * 2),
      new THREE.MeshBasicMaterial({
        map: tex.caustics.clone(), blending: THREE.AdditiveBlending,
        transparent: true, opacity: i ? 0.16 : 0.24, depthWrite: false,
      })
    ));
    m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2;
    m.position.y = W.seabedY + 0.03 + i * 0.02;
    m.userData.speed = i ? -0.014 : 0.022;
    caustics.push(m);
  }

  // Shafts of light. Crossed pairs, so they read from any camera angle.
  const shafts = add(new THREE.Group());
  const shaftH = depth + 4;
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const wdt = 1.6 + Math.random() * 3.0;
    const mat = new THREE.MeshBasicMaterial({
      map: tex.glow, color: 0xbdf0ff, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.09, depthWrite: false,
    });
    for (let k = 0; k < 2; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(wdt, shaftH), mat);
      p.rotation.y = k * Math.PI / 2;
      g.add(p);
    }
    g.position.set((Math.random() - 0.5) * spanX * 1.1, W.surfaceY - shaftH / 2, (Math.random() - 0.5) * spanZ * 1.1);
    g.userData = { phase: Math.random() * Math.PI * 2, mat };
    shafts.add(g);
  }

  // Suspended particulate. Sprites, so they face the camera from any angle.
  const motes = add(new THREE.Group());
  for (let i = 0; i < 170; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow, color: 0xcdf2f5, transparent: true,
      opacity: 0.10 + Math.random() * 0.2, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    s.position.set((Math.random() - 0.5) * spanX * 1.1, W.seabedY + Math.random() * (depth + 2), (Math.random() - 0.5) * spanZ * 1.1);
    const sc = 0.06 + Math.random() * 0.16;
    s.scale.set(sc, sc, 1);
    s.userData = { drift: 0.08 + Math.random() * 0.3, sway: Math.random() * Math.PI * 2 };
    motes.add(s);
  }

  // Kelp: crossed blades rooted on the bed, so they have volume from any angle.
  const kelp = [];
  const kelpCount = Math.round(spanX * spanZ / 22);
  for (let i = 0; i < kelpCount; i++) {
    const h = 3.5 + Math.random() * 7;
    const geo = new THREE.PlaneGeometry(0.34 + Math.random() * 0.24, h, 1, 8);
    geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2e8f6b, roughness: 0.9, metalness: 0,
      side: THREE.DoubleSide, transparent: true, opacity: 0.92,
    });
    const g = add(new THREE.Group());
    const blades = [];
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(geo.clone(), mat);
      m.rotation.y = k * Math.PI / 2;
      g.add(m);
      blades.push(m);
    }
    g.position.set((Math.random() - 0.5) * spanX, W.seabedY - 0.2, sceneryZ(spanZ));
    g.userData.env = true;
    g.userData.blades = blades;
    g.userData.base = geo.attributes.position.array.slice();
    g.userData.height = h;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.amp = 0.35 + Math.random() * 0.5;
    kelp.push(g);
  }

  // Scenery boulders scattered over the bed for parallax and landmarks.
  const backdrop = add(new THREE.Group());
  const colliders = [];
  for (let i = 0; i < Math.round(spanX * spanZ / 36); i++) {
    const s = 1.4 + Math.random() * 3.2;
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a7d99, roughness: 1, metalness: 0 })
    );
    b.position.set((Math.random() - 0.5) * spanX * 1.15, W.seabedY + s * 0.35 - 0.6, sceneryZ(spanZ * 1.15));
    b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    backdrop.add(b);
    // Scenery is what the trailing camera actually clips through, so it is
    // handed back as sphere colliders for the camera to pull in against.
    colliders.push({ x: b.position.x, y: b.position.y, z: b.position.z, r: s * 0.9 });
  }

  return { motes, caustics, shafts, kelp, backdrop, floor, surface, surfaceBase, colliders };
}

/* ----------------------------------------------------------------- meshes */

const mat = {
  hull: () => new THREE.MeshStandardMaterial({ map: loadTextures().hull, roughness: 0.55, metalness: 0.15 }),
  paint: (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.1 }),
  brass: () => new THREE.MeshStandardMaterial({ map: loadTextures().brass, roughness: 0.32, metalness: 0.85, emissive: 0x3a2200, emissiveIntensity: 0.35 }),
  suit: () => new THREE.MeshStandardMaterial({ map: loadTextures().suit, roughness: 0.8, metalness: 0.05, color: 0x9fd0dd, emissive: 0x0b2531, emissiveIntensity: 0.9 }),
  rock: () => new THREE.MeshStandardMaterial({ map: loadTextures().rock, roughness: 1, metalness: 0.02 }),
  shark: () => new THREE.MeshStandardMaterial({ map: loadTextures().shark, roughness: 0.62, metalness: 0.08 }),
  steel: (color = 0xb9c7cc) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.7 }),
  // pickups read at a distance even outside the lamp's reach
  lit: (color, glow = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.45, emissive: color, emissiveIntensity: glow }),
  glass: (color = 0x7fe4ff) => new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.2, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.75 }),
};

function diverMesh() {
  const g = new THREE.Group();
  const suit = mat.suit();

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.46, 6, 12), suit);
  torso.rotation.z = Math.PI / 2;
  g.add(torso);

  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.3, 6, 10), suit);
  hips.rotation.z = Math.PI / 2;
  hips.position.set(-0.5, -0.03, 0);
  g.add(hips);

  // Head, hood and mask.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), suit);
  head.position.set(0.55, 0.06, 0);
  g.add(head);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.3), mat.glass(0x8ff0ff));
  mask.position.set(0.68, 0.08, 0);
  g.add(mask);
  const reg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), mat.steel(0x2b3d44));
  reg.rotation.z = Math.PI / 2;
  reg.position.set(0.66, -0.08, 0);
  g.add(reg);

  // Twin tank, banded, with a hose looping to the regulator.
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.4, 6, 10), mat.steel(0x2fbfae));
  tank.rotation.z = Math.PI / 2;
  tank.position.set(-0.16, 0.2, -0.16);
  g.add(tank);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8), mat.steel(0xd8b25c));
  valve.position.set(0.14, 0.28, -0.16);
  g.add(valve);
  const hose = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.028, 6, 16, Math.PI * 1.1),
    mat.paint(0x14262c, 0.9)
  );
  hose.rotation.set(0, 0, -0.6);
  hose.position.set(0.36, 0.14, -0.1);
  g.add(hose);

  // Arms swept back, legs with fins. Fins are tagged so the sim can kick them.
  let finIndex = 0;
  for (const z of [0.22, -0.22]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), suit);
    arm.rotation.z = Math.PI / 2.6;
    arm.position.set(0.16, -0.12, z);
    g.add(arm);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.4, 4, 8), suit);
    leg.rotation.z = Math.PI / 2;
    leg.position.set(-0.85, -0.05, z * 0.55);
    g.add(leg);

    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 4), mat.paint(0x2ea89b, 0.7));
    fin.rotation.z = Math.PI / 2;
    fin.scale.set(1, 1, 0.42);
    fin.position.set(-1.32, -0.05, z * 0.55);
    fin.userData.finIndex = finIndex++;
    g.add(fin);
  }

  return g;
}

// Each part gets a distinct silhouette so it is identifiable on the seabed and
// in the checklist without reading a label.
function partMesh(id) {
  const g = new THREE.Group();
  const brass = mat.brass();
  switch (id) {
    case 'propeller': {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 12), brass);
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.16, 0.52, 6), brass);
        const a = (i / 4) * Math.PI * 2;
        blade.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0);
        blade.rotation.z = a - Math.PI / 2;
        blade.rotation.y = 0.5;
        g.add(blade);
      }
      break;
    }
    case 'rudder': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.09), brass);
      blade.geometry.translate(0.1, -0.05, 0);
      g.add(blade);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 10), brass);
      post.position.set(-0.18, 0.05, 0);
      g.add(post);
      const tiller = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), brass);
      tiller.position.set(0.0, 0.46, 0);
      g.add(tiller);
      break;
    }
    case 'hull': {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.09), brass);
      g.add(plate);
      for (const [x, y] of [[-0.28, 0.2], [0.28, 0.2], [-0.28, -0.2], [0.28, -0.2]]) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat.steel(0xe4d3a4));
        rivet.position.set(x, y, 0.06);
        g.add(rivet);
      }
      break;
    }
    case 'fuel': {
      const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.075, 8, 20, Math.PI * 1.5), brass);
      g.add(pipe);
      for (const a of [0, Math.PI * 1.5]) {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat.steel(0xd8c08a));
        flange.position.set(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
        flange.rotation.z = a;
        g.add(flange);
      }
      break;
    }
    default: {   // radio
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.28), brass);
      g.add(box);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.03), mat.glass(0x9fffe4));
      face.position.set(0, 0.05, 0.16);
      g.add(face);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6), mat.steel());
      ant.position.set(0.22, 0.45, 0);
      ant.rotation.z = -0.2;
      g.add(ant);
      for (const x of [-0.14, 0.0]) {
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), mat.steel(0x30454d));
        knob.rotation.x = Math.PI / 2;
        knob.position.set(x, -0.13, 0.16);
        g.add(knob);
      }
    }
  }
  // A soft glow so a dropped part is still findable in a dark pocket. A sprite,
  // so it faces the camera from any angle now that the world is 3D.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: loadTextures().glow, color: 0xffa825, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.34, depthWrite: false,
  }));
  halo.scale.set(2.0, 2.0, 1);
  g.add(halo);
  return g;
}

// Irregular boulder: an icosahedron with its vertices pushed around, so no two
// rocks in a run share a silhouette.
function rockMesh(seedIndex = 0) {
  const geo = new THREE.IcosahedronGeometry(0.95, 1);
  const pos = geo.attributes.position;
  let s = 1013 + seedIndex * 7717;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).multiplyScalar(0.78 + rnd() * 0.44);
    pos.setXYZ(i, v.x, v.y, v.z * 0.75);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat.rock());
  m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  return m;
}

function tankMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 6, 12), mat.lit(0x2fbfae, 0.5));
  g.add(body);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 10), mat.steel(0xd8b25c));
  collar.position.y = 0.34;
  g.add(collar);
  for (const y of [0.12, -0.12]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 6, 16), mat.steel(0x0f2b33));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    g.add(band);
  }
  return g;
}

function finsMesh() {
  const g = new THREE.Group();
  for (const z of [0.12, -0.12]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.6, 4), mat.lit(0x5b8dff, 0.45));
    fin.scale.set(1, 1, 0.35);
    fin.rotation.z = 0.35;
    fin.position.set(z * 1.4, 0, z);
    g.add(fin);
  }
  return g;
}

function floodlightMesh() {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 12), mat.lit(0x5d768a, 0.25));
  housing.rotation.z = Math.PI / 2;
  g.add(housing);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.19, 14), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
  lens.rotation.y = Math.PI / 2;
  lens.position.x = 0.16;
  g.add(lens);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: loadTextures().glow, color: 0xffe89a, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.45, depthWrite: false,
  }));
  glow.scale.set(1.6, 1.6, 1);
  g.add(glow);
  return g;
}

// A surveyed anchor point: a ring on the bed with a pulsing marker. Once a
// beacon is planted the mast rises and the colour flips to confirmed.
function anchorMesh() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.09, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x2f8fb0, roughness: 0.5, metalness: 0.3,
      emissive: 0x1c6a86, emissiveIntensity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 8), mat.steel(0xcfe2e6));
    stud.position.set(Math.cos(a) * 1.0, 0.22, Math.sin(a) * 1.0);
    g.add(stud);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 8), mat.steel(0xe6f2f0));
  mast.position.y = 0.95;
  mast.visible = false;
  mast.userData.mast = true;
  g.add(mast);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x9ffff0, fog: false }));
  lamp.position.y = 1.95;
  lamp.visible = false;
  lamp.userData.mast = true;
  g.add(lamp);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: loadTextures().glow, color: 0x6fd8ff, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.3, depthWrite: false,
  }));
  halo.scale.set(3.0, 3.0, 1);
  halo.position.y = 0.6;
  halo.userData.halo = true;
  g.add(halo);
  return g;
}

// Cargo: heavy, strapped, and deliberately unglamorous.
function crateMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 1.05),
    new THREE.MeshStandardMaterial({ map: loadTextures().hull, color: 0xb08a4a, roughness: 0.85, metalness: 0.1 }));
  g.add(box);
  const strap = () => new THREE.MeshStandardMaterial({ color: 0x2a3238, roughness: 0.8 });
  for (const x of [-0.35, 0.35]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.04, 1.09), strap());
    s.position.x = x;
    g.add(s);
  }
  const lug = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 6, 14), mat.steel(0xd8e2e4));
  lug.position.y = 0.56;
  lug.rotation.x = Math.PI / 2;
  g.add(lug);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: loadTextures().glow, color: 0xffb340, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.26, depthWrite: false,
  }));
  halo.scale.set(2.4, 2.4, 1);
  g.add(halo);
  return g;
}

export const MESHES = {
  anchor: anchorMesh,
  crate: crateMesh,
  boat: buildBoat,
  diver: diverMesh,
  enemy: enemyMesh,
  part: partMesh,
  rock: rockMesh,
  tank: tankMesh,
  fins: finsMesh,
  light: floodlightMesh,
};

// The diver's lamp — a real light, so swimming into a dark pocket actually
// reveals what is in it. Floodlight pickups widen its reach.
export function makeDiverLamp() {
  const light = new THREE.PointLight(0xffe6b0, 9, 11, 1.6);
  light.position.set(1.1, 0.15, 0.6);
  return light;
}

/* ------------------------------------------------------------- generation */

// Every run reshuffles the seabed. Three of the five parts are sealed inside
// rocks so the player has to spend air drilling, not just swimming.
export function generateLevel(rng, scenery = []) {
  const P = CONFIG.play;
  const sx = W.halfWidth - 2.0, sz = W.halfDepth - 2.0;
  // In 2.7D everything the player has to reach sits in a shallow band around the
  // play plane; the rest of the volume is there to be looked at and swum through.
  const spot = (minUp, maxUp) => ({
    x: rng.range(-sx, sx),
    y: rng.range(W.seabedY + minUp, W.seabedY + maxUp),
    z: P.planar ? P.planeZ + rng.range(-P.bandZ, 0.4) : rng.range(-sz, sz),
  });
  const inScenery = (p, pad) => scenery.some((c) => Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) < c.r + pad);
  const clearOfBoat = (minUp, maxUp, pad = 1.6) => {
    let p = spot(minUp, maxUp), guard = 0;
    while (guard++ < 60 && (Math.hypot(p.x - W.boatX, p.z - W.boatZ) < 4.0 || inScenery(p, pad))) {
      p = spot(minUp, maxUp);
    }
    return p;
  };

  // Which of the five parts this level asks for, and in what order.
  const order = PARTS.map((p) => p.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const wanted = Math.max(1, Math.min(PARTS.length, CONFIG.parts?.count ?? PARTS.length));
  const activeParts = order.slice(0, wanted);
  const sealedCount = Math.min(CONFIG.spawn.partsInRocks, wanted);
  const sealed = activeParts.slice(0, sealedCount);
  const loose = activeParts.slice(sealedCount);

  const rocks = [];
  for (let i = 0; i < CONFIG.spawn.rocks; i++) {
    const p = clearOfBoat(0.5, 2.4, 2.2);  // boulders rest on the bed, clear of scenery
    rocks.push({ ...p, opened: false, part: sealed[i] ?? null, yieldsTank: !sealed[i], shape: i });
  }

  // Rocks are solid, so nothing may spawn inside one.
  const band = Math.max(4, Math.abs(W.seabedY) * 0.6);
  const clearOfRocks = () => {
    let p = clearOfBoat(0.9, band), guard = 0;
    while (guard++ < 40 && rocks.some((r) => Math.hypot(r.x - p.x, r.y - p.y, r.z - p.z) < 2.6)) {
      p = clearOfBoat(0.9, band);
    }
    return p;
  };

  // Only a salvage dive scatters boat parts. The other objectives leave the
  // rocks as air pockets and put their own targets on the bed.
  const salvage = (CONFIG.objectiveKind ?? 'salvage') === 'salvage';
  if (!salvage) for (const r of rocks) { r.part = null; r.yieldsTank = true; }
  const parts = salvage ? loose.map((id) => ({ ...clearOfRocks(), id, taken: false })) : [];

  const pickups = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) pickups.push({ ...clearOfRocks(), kind, taken: false }); };
  add('tank', CONFIG.spawn.tanks);
  add('fins', CONFIG.spawn.fins);
  add('light', CONFIG.spawn.floodlights);

  // Enemies, spread one per depth band so the column is never empty or stacked.
  const roster = [];
  for (const entry of (CONFIG.enemies ?? [{ type: 'shark', count: 2 }])) {
    for (let i = 0; i < entry.count; i++) roster.push(entry.type);
  }
  const enemies = [];
  const top = W.surfaceY - 4, bot = W.seabedY + 3;
  const slice = (top - bot) / Math.max(1, roster.length);
  roster.forEach((type, i) => {
    const spec = ENEMY_TYPES[type] ?? ENEMY_TYPES.shark;
    const laneY = rng.range(bot + slice * i, bot + slice * (i + 1));
    const heading = rng.range(0, Math.PI * 2);
    enemies.push({
      type, spec,
      x: rng.range(-sx, sx), y: laneY,
      z: P.planar
        ? (spec.planeLocked ? P.planeZ : P.planeZ + rng.range(-P.enemyBandZ, P.enemyBandZ))
        : rng.range(-sz, sz),
      laneY,
      vx: Math.cos(heading) * spec.patrolSpeed,
      vy: 0,
      vz: Math.sin(heading) * spec.patrolSpeed,
      heading,
      chaseTimer: 0,
      dwell: 0,
      banked: false,
      biteTimer: 0,
      phase: rng.range(0, Math.PI * 2),
    });
  });

  const anchors = [];
  const crates = [];
  // Anchors and crates have to clear the boulders as well as the scenery, and
  // each other. Without the rock check one could land inside a boulder, where
  // the diver's own collision keeps them permanently out of reach — a
  // seed-dependent unwinnable run.
  const clearTarget = (minUp, maxUp, placed) => {
    let p = clearOfBoat(minUp, maxUp, 2.4), guard = 0;
    const bad = (q) => rocks.some((r) => Math.hypot(r.x - q.x, r.y - q.y, r.z - q.z) < 3.0)
      || placed.some((o) => Math.hypot(o.x - q.x, o.y - q.y, o.z - q.z) < 3.5);
    while (guard++ < 60 && bad(p)) p = clearOfBoat(minUp, maxUp, 2.4);
    return p;
  };

  if (CONFIG.objectiveKind === 'beacon') {
    for (let i = 0; i < wanted; i++) {
      anchors.push({ ...clearTarget(0.4, 0.9, anchors), planted: false });
    }
  } else if (CONFIG.objectiveKind === 'haul') {
    for (let i = 0; i < wanted; i++) {
      crates.push({ ...clearTarget(0.7, 1.4, crates), taken: false, delivered: false });
    }
  }

  return { rocks, parts, pickups, enemies, activeParts, anchors, crates,
           objective: CONFIG.objectiveKind ?? 'salvage' };
}
