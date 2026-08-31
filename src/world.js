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

const W = CONFIG.world;
const D = CONFIG.depthFade;

export const PALETTE = {
  abyss: 0x04141c,
  deep: 0x072430,
  water: 0x0d3a4a,
  shallow: 0x14586b,
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
  renderer.toneMappingExposure = 1.15;
  return renderer;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(CONFIG.camera.fov, 9 / 19.5, 0.1, 220);
  cam.position.set(0, -6, 18);
  return cam;
}

export function createScene() {
  const tex = loadTextures();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.shallow);
  scene.fog = new THREE.Fog(PALETTE.shallow, D.fogNearSurface, D.fogFarSurface);

  // Lights are handed back so the sim can crush them as the diver descends —
  // the darkening is a real falloff, not a colour filter over a bright scene.
  const sun = new THREE.DirectionalLight(0xd8f6ff, D.sunSurface);
  sun.position.set(6, 40, 10);
  scene.add(sun);
  const ambient = new THREE.HemisphereLight(0x8fe3f0, 0x07202a, D.ambientSurface);
  scene.add(ambient);

  // The underside of the surface: a big bright ceiling you can always find by
  // looking up, which is what makes "swim up to breathe" legible.
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfWidth * 6, W.halfDepth * 6, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xa8ecf2, side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: true })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = W.surfaceY;
  scene.add(surface);
  const surfaceBase = surface.geometry.attributes.position.array.slice();

  // Seabed.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfWidth * 4, W.halfDepth * 4, 1, 1),
    new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = W.seabedY;
  scene.add(floor);

  // Caustics: two additive layers scrolling across the bed at different speeds.
  const caustics = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(W.halfWidth * 4, W.halfDepth * 4),
      new THREE.MeshBasicMaterial({
        map: tex.caustics.clone(), blending: THREE.AdditiveBlending,
        transparent: true, opacity: i ? 0.16 : 0.24, depthWrite: false,
      })
    );
    m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2;
    m.position.y = W.seabedY + 0.03 + i * 0.02;
    m.userData.speed = i ? -0.014 : 0.022;
    scene.add(m);
    caustics.push(m);
  }

  // Shafts of light. Crossed pairs, so they read from any camera angle.
  const shafts = new THREE.Group();
  const shaftH = Math.abs(W.seabedY) + 4;
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const wdt = 1.6 + Math.random() * 3.0;
    const mat = new THREE.MeshBasicMaterial({
      map: tex.glow, color: 0xbdf0ff, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.09, depthWrite: false, fog: true,
    });
    for (let k = 0; k < 2; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(wdt, shaftH), mat);
      p.rotation.y = k * Math.PI / 2;
      g.add(p);
    }
    g.position.set(
      (Math.random() - 0.5) * W.halfWidth * 2.2,
      W.surfaceY - shaftH / 2,
      (Math.random() - 0.5) * W.halfDepth * 2.2
    );
    g.userData = { phase: Math.random() * Math.PI * 2, mat };
    shafts.add(g);
  }
  scene.add(shafts);

  // Suspended particulate. Sprites, so they face the camera from any angle.
  const motes = new THREE.Group();
  for (let i = 0; i < 160; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow, color: 0xcdf2f5, transparent: true,
      opacity: 0.10 + Math.random() * 0.2, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: true,
    }));
    s.position.set(
      (Math.random() - 0.5) * W.halfWidth * 2.2,
      W.seabedY + Math.random() * (Math.abs(W.seabedY) + 2),
      (Math.random() - 0.5) * W.halfDepth * 2.2
    );
    const sc = 0.06 + Math.random() * 0.16;
    s.scale.set(sc, sc, 1);
    s.userData = { drift: 0.08 + Math.random() * 0.3, sway: Math.random() * Math.PI * 2 };
    motes.add(s);
  }
  scene.add(motes);

  // Kelp: crossed blades rooted on the bed, so they have volume from any angle.
  const kelp = [];
  for (let i = 0; i < 46; i++) {
    const h = 3.5 + Math.random() * 7;
    const geo = new THREE.PlaneGeometry(0.34 + Math.random() * 0.24, h, 1, 8);
    geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x11463f, roughness: 0.9, metalness: 0,
      side: THREE.DoubleSide, transparent: true, opacity: 0.92,
    });
    const g = new THREE.Group();
    const blades = [];
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(geo.clone(), mat);
      m.rotation.y = k * Math.PI / 2;
      g.add(m);
      blades.push(m);
    }
    g.position.set(
      (Math.random() - 0.5) * W.halfWidth * 2,
      W.seabedY - 0.2,
      (Math.random() - 0.5) * W.halfDepth * 2
    );
    g.userData = {
      blades,
      base: geo.attributes.position.array.slice(),
      height: h,
      phase: Math.random() * Math.PI * 2,
      amp: 0.35 + Math.random() * 0.5,
    };
    scene.add(g);
    kelp.push(g);
  }

  // Scenery boulders scattered over the bed for parallax and landmarks.
  const backdrop = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const s = 1.4 + Math.random() * 3.2;
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s, 0),
      new THREE.MeshStandardMaterial({ color: 0x0d2a35, roughness: 1, metalness: 0 })
    );
    b.position.set(
      (Math.random() - 0.5) * W.halfWidth * 2.3,
      W.seabedY + s * 0.35 - 0.6,
      (Math.random() - 0.5) * W.halfDepth * 2.3
    );
    b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    backdrop.add(b);
  }
  scene.add(backdrop);

  return { scene, motes, caustics, shafts, kelp, backdrop, floor, surface, surfaceBase, sun, ambient };
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

function sharkMesh() {
  const g = new THREE.Group();
  const skin = mat.shark();

  // Spindle body from a lathe profile — tapered nose and peduncle.
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const r = Math.sin(Math.pow(t, 0.75) * Math.PI) * 0.36 + 0.02;
    pts.push(new THREE.Vector2(r, t * 2.6 - 1.3));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), skin);
  body.rotation.z = -Math.PI / 2;
  body.scale.z = 0.82;
  g.add(body);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 3), skin);
  dorsal.scale.set(1, 1, 0.3);
  dorsal.position.set(-0.05, 0.42, 0);
  dorsal.rotation.z = -0.25;
  g.add(dorsal);

  for (const z of [0.26, -0.26]) {
    const pec = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 3), skin);
    pec.scale.set(1, 1, 0.25);
    pec.rotation.set(0, 0, z > 0 ? -1.9 : -1.9);
    pec.position.set(0.2, -0.2, z);
    g.add(pec);
  }

  const tailTop = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 3), skin);
  tailTop.scale.set(1, 1, 0.3);
  tailTop.rotation.z = -0.5;
  tailTop.position.set(-1.35, 0.26, 0);
  g.add(tailTop);
  const tailBot = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.44, 3), skin);
  tailBot.scale.set(1, 1, 0.3);
  tailBot.rotation.z = Math.PI + 0.4;
  tailBot.position.set(-1.32, -0.18, 0);
  g.add(tailBot);

  for (const z of [0.2, -0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: 0x08131a, roughness: 0.15, metalness: 0.4 }));
    eye.position.set(0.86, 0.08, z);
    g.add(eye);
  }
  // gill slits
  for (let i = 0; i < 5; i++) {
    const gill = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), mat.paint(0x3a4d56, 0.9));
    gill.position.set(0.5 - i * 0.09, 0.0, 0.26);
    gill.rotation.z = 0.25;
    g.add(gill);
  }

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.3), mat.paint(0xf1f7f6, 0.5));
  jaw.position.set(0.85, -0.19, 0);
  jaw.rotation.z = 0.1;
  g.add(jaw);

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

export const MESHES = {
  boat: buildBoat,
  diver: diverMesh,
  shark: sharkMesh,
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
export function generateLevel(rng) {
  const sx = W.halfWidth - 2.0, sz = W.halfDepth - 2.0;
  const spot = (minUp, maxUp) => ({
    x: rng.range(-sx, sx),
    y: rng.range(W.seabedY + minUp, W.seabedY + maxUp),
    z: rng.range(-sz, sz),
  });
  // Keep the water column directly under the boat clear so the first descent
  // is never a wall.
  const clearOfBoat = (minUp, maxUp) => {
    let p = spot(minUp, maxUp), guard = 0;
    while (guard++ < 30 && Math.hypot(p.x - W.boatX, p.z - W.boatZ) < 4.0) p = spot(minUp, maxUp);
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
    const p = clearOfBoat(0.5, 2.4);       // boulders rest on the bed
    rocks.push({ ...p, opened: false, part: sealed[i] ?? null, yieldsTank: !sealed[i], shape: i });
  }

  // Rocks are solid, so nothing may spawn inside one.
  const clearOfRocks = () => {
    let p = clearOfBoat(0.9, Math.abs(W.seabedY) * 0.55), guard = 0;
    while (guard++ < 40 && rocks.some((r) => Math.hypot(r.x - p.x, r.y - p.y, r.z - p.z) < 2.6)) {
      p = clearOfBoat(0.9, Math.abs(W.seabedY) * 0.55);
    }
    return p;
  };

  const parts = loose.map((id) => ({ ...clearOfRocks(), id, taken: false }));

  const pickups = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) pickups.push({ ...clearOfRocks(), kind, taken: false }); };
  add('tank', CONFIG.spawn.tanks);
  add('fins', CONFIG.spawn.fins);
  add('light', CONFIG.spawn.floodlights);

  // One shark per depth band, spread across the volume.
  const sharks = [];
  const top = W.surfaceY - 4, bot = W.seabedY + 3;
  const band = (top - bot) / CONFIG.shark.count;
  for (let i = 0; i < CONFIG.shark.count; i++) {
    const laneY = rng.range(bot + band * i, bot + band * (i + 1));
    const heading = rng.range(0, Math.PI * 2);
    sharks.push({
      x: rng.range(-sx, sx), y: laneY, z: rng.range(-sz, sz),
      laneY,
      vx: Math.cos(heading) * CONFIG.shark.patrolSpeed,
      vy: 0,
      vz: Math.sin(heading) * CONFIG.shark.patrolSpeed,
      heading,
      chaseTimer: 0,
      dwell: 0,
      banked: false,
    });
  }

  return { rocks, parts, pickups, sharks };
}
