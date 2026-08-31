// Enemy types. Three threat models rather than three reskins:
//
//   shark — a hunter. Fast, wide detection, lethal on contact. Only boost
//           breaks a pursuit. This is the one that kills you.
//   squid — an ambusher. Hangs motionless until you are close, then darts.
//           It does not kill: it grabs and rips air out of your tank. The
//           threat is to your budget, which is why it belongs in the deep
//           levels where the swim home is already long.
//   jelly — a drifting hazard field. Never hunts, never gives up, just is.
//           Brushing one costs air and stalls you. Clusters block routes,
//           so they are an obstacle you route around rather than fight.
import * as THREE from '../vendor/three.module.js';
import { sharkTexture, glowTexture } from './textures.js';

export const ENEMY_TYPES = {
  shark: {
    label: 'Shark',
    lethal: true,
    patrolSpeed: 1.9,
    chaseSpeed: 3.2,
    detectRadius: 6.0,
    dangerRadius: 3.4,
    contactRadius: 0.95,
    loseInterestAfter: 2.5,
    turnRate: 2.6,
    verticalBias: 0.8,
    closeCallDwell: 0.45,
    plot: '#ff4d5e',
  },
  squid: {
    label: 'Squid',
    lethal: false,
    oxygenBite: 16,           // per grab
    biteCooldown: 1.6,
    patrolSpeed: 0.5,         // barely moves until it commits
    chaseSpeed: 3.6,          // but it is quick over the last few metres
    detectRadius: 4.2,
    dangerRadius: 2.8,
    contactRadius: 1.15,
    loseInterestAfter: 1.6,
    turnRate: 3.4,
    verticalBias: 1.0,
    closeCallDwell: 0.45,
    plot: '#c07be8',
  },
  jelly: {
    label: 'Jelly',
    lethal: false,
    oxygenBite: 9,
    biteCooldown: 1.0,
    drifts: true,             // no pursuit at all
    patrolSpeed: 0.45,
    chaseSpeed: 0,
    detectRadius: 0,
    dangerRadius: 2.2,
    contactRadius: 1.25,
    loseInterestAfter: 0,
    turnRate: 1.0,
    verticalBias: 0.6,
    closeCallDwell: 0.6,
    slowFactor: 0.45,         // stings also stall you
    plot: '#7be8d2',
  },
};

const flat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });

function sharkMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ map: sharkTexture(), roughness: 0.62, metalness: 0.08 });

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
    pec.rotation.z = -1.9;
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

  const eyeMat = flat(0x08131a, { roughness: 0.15, metalness: 0.4 });
  for (const z of [0.2, -0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(0.86, 0.08, z);
    g.add(eye);
  }
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.3), flat(0xf1f7f6, { roughness: 0.5 }));
  jaw.position.set(0.85, -0.19, 0);
  jaw.rotation.z = 0.1;
  g.add(jaw);
  return g;
}

function squidMesh() {
  const g = new THREE.Group();
  const skin = flat(0x8f4f86, { roughness: 0.55, emissive: 0x2a0f28, emissiveIntensity: 0.6 });

  // Mantle: a cone pointing backwards (-X), so it reads as jetting forward.
  const mantle = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 12), skin);
  mantle.rotation.z = Math.PI / 2;
  mantle.position.x = -0.45;
  g.add(mantle);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skin);
  head.scale.set(1, 0.9, 0.9);
  head.position.x = 0.28;
  g.add(head);

  for (const z of [0.34, -0.34]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 3), skin);
    fin.scale.set(1, 1, 0.22);
    fin.rotation.z = Math.PI / 2;
    fin.position.set(-1.05, 0, z);
    g.add(fin);
  }

  const eyeMat = flat(0xffe27a, { emissive: 0xffc23a, emissiveIntensity: 1.1, roughness: 0.2 });
  for (const z of [0.28, -0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), eyeMat);
    eye.position.set(0.42, 0.12, z);
    g.add(eye);
  }

  // Eight arms, tagged so they can writhe.
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.ConeGeometry(0.075, 1.15, 5), skin);
    arm.rotation.z = -Math.PI / 2;
    arm.position.set(1.05, Math.sin(a) * 0.19, Math.cos(a) * 0.19);
    arm.userData.armIndex = i;
    g.add(arm);
    arms.push(arm);
  }
  g.userData.arms = arms;

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xd07be8, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.3, depthWrite: false,
  }));
  glow.scale.set(2.6, 2.6, 1);
  g.add(glow);
  return g;
}

function jellyMesh() {
  const g = new THREE.Group();
  const bellMat = new THREE.MeshStandardMaterial({
    color: 0x7be8d2, roughness: 0.25, metalness: 0.1,
    emissive: 0x2ea08c, emissiveIntensity: 0.9,
    transparent: true, opacity: 0.62, side: THREE.DoubleSide,
  });
  // Bell built as a half-sphere; the model's "forward" is +X like the others,
  // but a jelly never aims anywhere, so it just bobs.
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), bellMat);
  bell.userData.bell = true;
  g.add(bell);

  const tentMat = new THREE.MeshStandardMaterial({
    color: 0x9ff2e2, roughness: 0.4, emissive: 0x2ea08c, emissiveIntensity: 0.7,
    transparent: true, opacity: 0.55,
  });
  const tentacles = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.012, 1.9, 5), tentMat);
    t.position.set(Math.cos(a) * 0.5, -0.95, Math.sin(a) * 0.5);
    t.userData.tentIndex = i;
    g.add(t);
    tentacles.push(t);
  }
  g.userData.tentacles = tentacles;

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0x7be8d2, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.42, depthWrite: false,
  }));
  glow.scale.set(3.4, 3.4, 1);
  g.add(glow);
  return g;
}

const BUILDERS = { shark: sharkMesh, squid: squidMesh, jelly: jellyMesh };

export function enemyMesh(type) {
  return (BUILDERS[type] ?? sharkMesh)();
}

// Per-frame idle animation that has nothing to do with steering.
export function animateEnemy(e, clock) {
  const m = e.mesh;
  if (!m) return;
  if (e.type === 'squid') {
    const arms = m.userData.arms;
    if (arms) {
      for (const a of arms) {
        const i = a.userData.armIndex;
        const wave = Math.sin(clock * 4 + i * 0.8) * 0.3;
        a.rotation.y = wave * 0.5;
        a.rotation.x = Math.cos(clock * 4 + i * 0.8) * 0.3;
      }
    }
  } else if (e.type === 'jelly') {
    const pulse = 0.85 + Math.sin(clock * 1.6 + e.phase) * 0.18;
    m.scale.set(1, pulse, 1);
    const tents = m.userData.tentacles;
    if (tents) {
      for (const t of tents) {
        const i = t.userData.tentIndex;
        t.rotation.x = Math.sin(clock * 1.4 + i) * 0.22;
        t.rotation.z = Math.cos(clock * 1.2 + i) * 0.22;
      }
    }
  }
}
