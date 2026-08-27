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
  const cam = new THREE.PerspectiveCamera(52, 9 / 19.5, 0.1, 160);
  cam.position.set(0, -6, 18);
  return cam;
}

export function createScene() {
  const tex = loadTextures();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.water);
  scene.fog = new THREE.Fog(PALETTE.water, 18, 46);

  // Sunlight from above the surface, plus a sky/seabed hemisphere so nothing
  // ever goes fully black. Everything else in the water is lit by the diver.
  const sun = new THREE.DirectionalLight(0xd8f6ff, 2.1);
  sun.position.set(3, 30, 12);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8fe3f0, 0x0a2129, 1.15));
  const fill = new THREE.DirectionalLight(0x2f7f96, 0.5);
  fill.position.set(-6, -4, 10);
  scene.add(fill);

  // Sky above the waterline — the only warm value in the frame, so the surface
  // always reads as safety from anywhere in the water column.
  const skyGeo = new THREE.PlaneGeometry(W.halfWidth * 5, 30);
  const skyMat = new THREE.MeshBasicMaterial({ fog: false });
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 8; skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const sg = sctx.createLinearGradient(0, 0, 0, 256);
  sg.addColorStop(0, '#7fb9c6');
  sg.addColorStop(0.55, '#3d8497');
  sg.addColorStop(1, '#1d5e70');
  sctx.fillStyle = sg; sctx.fillRect(0, 0, 8, 256);
  skyMat.map = new THREE.CanvasTexture(skyCanvas);
  skyMat.map.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, W.surfaceY + 15, -10);
  scene.add(sky);

  // The waterline itself: a bright band plus a thin foam lip.
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfWidth * 5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x9fe6ee, fog: false, transparent: true, opacity: 0.4 })
  );
  surface.position.set(0, W.surfaceY - 0.05, -1.5);
  scene.add(surface);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfWidth * 5, 0.09),
    new THREE.MeshBasicMaterial({ color: 0xeafcff, fog: false, transparent: true, opacity: 0.8 })
  );
  foam.position.set(0, W.surfaceY + 0.2, -1.4);
  scene.add(foam);

  // Seabed, with a second additive plane of caustics scrolling across it.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W.halfWidth * 5, 26, 1, 1),
    new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2.7;       // raked back so the bed reads as ground
  floor.position.set(0, W.seabedY - 0.7, -2);
  scene.add(floor);

  const caustics = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(W.halfWidth * 5, 24),
      new THREE.MeshBasicMaterial({
        map: tex.caustics.clone(), blending: THREE.AdditiveBlending,
        transparent: true, opacity: i ? 0.16 : 0.24, depthWrite: false,
      })
    );
    m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2.7;
    m.position.set(0, W.seabedY - 0.65 + i * 0.02, -2);
    m.userData.speed = i ? -0.014 : 0.022;
    scene.add(m);
    caustics.push(m);
  }

  // Shafts of light angling down from the surface.
  const shafts = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const w = 1.4 + Math.random() * 2.6;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, Math.abs(W.seabedY) + 6),
      new THREE.MeshBasicMaterial({
        map: tex.glow, color: 0xbdf0ff, blending: THREE.AdditiveBlending,
        transparent: true, opacity: 0.10 + Math.random() * 0.07, depthWrite: false, fog: false,
      })
    );
    m.position.set((Math.random() - 0.5) * W.halfWidth * 2.4, W.surfaceY - (Math.abs(W.seabedY) + 6) / 2 + 2, -5 - Math.random() * 2);
    m.rotation.z = (Math.random() - 0.5) * 0.22;
    m.userData.phase = Math.random() * Math.PI * 2;
    shafts.add(m);
  }
  scene.add(shafts);

  // Parallax backdrop. Distant boulders and kelp sitting behind the play plane
  // give the water column something to read against — without them the mid-water
  // is just fog.
  const backdrop = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const z = -6.5 - Math.random() * 4;
    const s = 1.6 + Math.random() * 3.4;
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s, 0),
      new THREE.MeshStandardMaterial({ color: 0x0d2a35, roughness: 1, metalness: 0 })
    );
    b.position.set((Math.random() - 0.5) * W.halfWidth * 2.8, W.seabedY + Math.random() * 2.5 - 0.5, z);
    b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    b.scale.z = 0.6;
    backdrop.add(b);
  }
  scene.add(backdrop);

  const kelp = [];
  for (let i = 0; i < 18; i++) {
    const h = 3.5 + Math.random() * 5.5;
    const geo = new THREE.PlaneGeometry(0.34 + Math.random() * 0.22, h, 1, 8);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x11463f, roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
      transparent: true, opacity: 0.9,
    }));
    m.position.set((Math.random() - 0.5) * W.halfWidth * 2.4, W.seabedY - 0.3, -4.5 - Math.random() * 3.5);
    m.userData = {
      base: geo.attributes.position.array.slice(),
      height: h,
      phase: Math.random() * Math.PI * 2,
      amp: 0.35 + Math.random() * 0.5,
    };
    scene.add(m);
    kelp.push(m);
  }

  // Suspended particulate, drifting up.
  const motes = new THREE.Group();
  const moteGeo = new THREE.PlaneGeometry(0.13, 0.13);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({
      map: tex.glow, color: 0xcdf2f5, transparent: true,
      opacity: 0.12 + Math.random() * 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    m.position.set(
      (Math.random() - 0.5) * W.halfWidth * 3,
      W.seabedY + Math.random() * (Math.abs(W.seabedY) + 4),
      -2 - Math.random() * 5
    );
    m.scale.setScalar(0.5 + Math.random() * 1.6);
    m.userData.drift = 0.08 + Math.random() * 0.3;
    m.userData.sway = Math.random() * Math.PI * 2;
    motes.add(m);
  }
  scene.add(motes);

  return { scene, motes, caustics, shafts, kelp, backdrop, floor, sky, surface };
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
  // A soft glow so a dropped part is still findable in a dark pocket.
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ map: loadTextures().glow, color: 0xffa825, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.28, depthWrite: false })
  );
  halo.position.z = -0.3;
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
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: loadTextures().glow, color: 0xffe89a, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.4, depthWrite: false })
  );
  glow.position.set(0.2, 0, 0);
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
  const spread = W.halfWidth - 1.6;
  const spot = () => ({
    x: rng.range(-spread, spread),
    y: rng.range(W.seabedY + 0.8, W.seabedY + 5.5),
  });
  // Keep the water directly under the boat clear so the first dive is never a wall.
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
    const p = clearSpot();
    p.y = rng.range(W.seabedY + 0.5, W.seabedY + 2.4);   // resting on the seabed
    rocks.push({ ...p, opened: false, part: sealed[i] ?? null, yieldsTank: !sealed[i], shape: i });
  }

  // Rocks are solid, so anything spawned inside one would be unreachable.
  const clearOfRocks = () => {
    let p = clearSpot(), guard = 0;
    while (guard++ < 40 && rocks.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 2.1)) p = clearSpot();
    return p;
  };

  const parts = loose.map((id) => ({ ...clearOfRocks(), id, taken: false }));

  const pickups = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) pickups.push({ ...clearOfRocks(), kind, taken: false }); };
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
