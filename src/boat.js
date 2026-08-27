// The Riverside Workboat.
//
// Adapted from the standalone orbit-camera scene. Three things had to change to
// make it work as a game object rather than a turntable model:
//
//  1. ORIENTATION. It is built length-along-Z for a camera that orbits it.
//     Depth Rush is a side-on view of the XY plane, so the whole boat sits
//     inside an inner group yawed 90° — length now runs along world X, beam
//     runs into the screen. Anything that was flat-on to an orbiting camera
//     (the flag, the fish, the fishing line) had to be re-aimed by hand or it
//     ends up edge-on and invisible.
//  2. SCALE + ORIGIN. Scaled to ~7.6m long against a 22m-wide world, with the
//     waterline at the group origin so it sits in the surface band correctly.
//  3. NO SHADOW MAP. The original casts real shadows; this build keeps the
//     shadow map off for mobile cost, so the flags are left inert rather than
//     paying for a 2048² depth pass.
//
// The water, orbit controls and HUD from the original are dropped — the game
// supplies its own.
import * as THREE from '../vendor/three.module.js';
import { glowTexture } from './textures.js';

const DECK = 1.85;                 // deck height above the waterline, model units
const SCALE = 0.4;                 // 19 model units of length -> ~7.6m in world
const YAW = Math.PI / 2;           // local +Z (bow) -> world +X

/* ------------------------------------------------------------- textures */

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function jitter(hex, amt) {
  const c = new THREE.Color(hex);
  const f = 1 + (Math.random() * 2 - 1) * amt;
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}

let TEX = null;
function textures() {
  if (TEX) return TEX;

  // deck planks
  const deck = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7c4632'; ctx.fillRect(0, 0, w, h);
    const planks = 6, pw = w / planks;
    for (let i = 0; i < planks; i++) {
      ctx.fillStyle = jitter('#7f4a34', 0.10);
      ctx.fillRect(i * pw + 1, 0, pw - 2, h);
      ctx.strokeStyle = 'rgba(60,30,20,0.25)'; ctx.lineWidth = 1;
      for (let g = 0; g < 5; g++) {
        const gx = i * pw + 4 + Math.random() * (pw - 8);
        ctx.beginPath(); ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(gx + 3, h * 0.3, gx - 3, h * 0.6, gx + 2, h);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(35,18,12,0.85)';
      ctx.fillRect(i * pw - 1, 0, 2, h);
      ctx.fillRect(i * pw, (i * 97) % h, pw, 2);
    }
  });
  deck.repeat.set(0.5, 0.16);

  // crate faces
  const crate = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c8823c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = jitter('#c8823c', 0.08);
      ctx.fillRect(0, i * h / 4 + 1, w, h / 4 - 2);
    }
    ctx.strokeStyle = '#8a5423'; ctx.lineWidth = 3;
    for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(0, j * h / 4); ctx.lineTo(w, j * h / 4); ctx.stroke(); }
    ctx.strokeStyle = '#a4662c'; ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(w - 8, h - 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,35,12,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });

  const barrelWood = canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a5a35'; ctx.fillRect(0, 0, w, h);
    const st = 8;
    for (let i = 0; i < st; i++) {
      ctx.fillStyle = jitter('#8a5a35', 0.12);
      ctx.fillRect(i * w / st + 1, 0, w / st - 2, h);
    }
  });

  // painted metal hull with rust streaks near the waterline
  const hull = canvasTex(256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6f7a76');          // sun-caught topsides
    g.addColorStop(0.52, '#57615f');
    g.addColorStop(0.62, '#8d4a3a');       // boot-top stripe
    g.addColorStop(0.70, '#33302c');       // antifouling below the waterline
    g.addColorStop(1, '#26241f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = `rgba(${150 + Math.random() * 60 | 0},${158 + Math.random() * 55 | 0},${150 + Math.random() * 50 | 0},0.10)`;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.6, 3 + Math.random() * 12, 1 + Math.random() * 3);
    }
    for (let r = 0; r < 26; r++) {
      ctx.fillStyle = `rgba(150,88,48,${0.14 + Math.random() * 0.18})`;
      ctx.fillRect(Math.random() * w, h * 0.5 + Math.random() * h * 0.28, 2 + Math.random() * 3, 6 + Math.random() * 22);
    }
    // plate seams
    ctx.strokeStyle = 'rgba(20,22,20,0.4)'; ctx.lineWidth = 1.5;
    for (let s = 1; s < 6; s++) {
      ctx.beginPath(); ctx.moveTo(s * w / 6, 0); ctx.lineTo(s * w / 6, h); ctx.stroke();
    }
  });
  hull.repeat.set(3, 1);

  TEX = { deck, crate, barrelWood, hull };
  return TEX;
}

/* ------------------------------------------------------------ materials */

function materials() {
  const T = textures();
  return {
    hull: new THREE.MeshStandardMaterial({ map: T.hull, color: 0xffffff, roughness: 0.7, metalness: 0.15, emissive: 0x16262c, emissiveIntensity: 0.55 }),
    deck: new THREE.MeshStandardMaterial({ map: T.deck, roughness: 0.85, metalness: 0.0, emissive: 0x2a140c, emissiveIntensity: 0.4 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x211f1d, roughness: 0.6, metalness: 0.2 }),
    crate: new THREE.MeshStandardMaterial({ map: T.crate, roughness: 0.8 }),
    drumDark: new THREE.MeshStandardMaterial({ color: 0x687076, roughness: 0.45, metalness: 0.65 }),
    drumLight: new THREE.MeshStandardMaterial({ color: 0x9ba6a6, roughness: 0.4, metalness: 0.6 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xc3cccc, roughness: 0.3, metalness: 0.8 }),
    whiteBarrel: new THREE.MeshStandardMaterial({ color: 0xd8ded9, roughness: 0.5, metalness: 0.2 }),
    platform: new THREE.MeshStandardMaterial({ color: 0x5f7b96, roughness: 0.65, metalness: 0.3 }),
    platformTrim: new THREE.MeshStandardMaterial({ color: 0x46596e, roughness: 0.6, metalness: 0.35 }),
    engine: new THREE.MeshStandardMaterial({ color: 0x424e59, roughness: 0.55, metalness: 0.45 }),
    engineLight: new THREE.MeshStandardMaterial({ color: 0x97a4ad, roughness: 0.5, metalness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.95 }),
    barrelWood: new THREE.MeshStandardMaterial({ map: T.barrelWood, roughness: 0.85 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x8a5f38, roughness: 0.95 }),
    mast: new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: 0.5, metalness: 0.6 }),
    flag: new THREE.MeshStandardMaterial({ color: 0x3f6a8c, roughness: 0.9, side: THREE.DoubleSide }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe2ae82, roughness: 0.8 }),
    capGreen: new THREE.MeshStandardMaterial({ color: 0x53a251, roughness: 0.85 }),
    capGreenD: new THREE.MeshStandardMaterial({ color: 0x3e7e3f, roughness: 0.85 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0xc7ae83, roughness: 0.9 }),
    overalls: new THREE.MeshStandardMaterial({ color: 0xd6973c, roughness: 0.9 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x39404a, roughness: 0.9 }),
    fish: new THREE.MeshStandardMaterial({ color: 0x8d979e, roughness: 0.35, metalness: 0.3 }),
    gull: new THREE.MeshStandardMaterial({ color: 0xf2f4f2, roughness: 0.9, side: THREE.DoubleSide }),
  };
}

/* ---------------------------------------------------------------- build */

export function buildBoat() {
  const M = materials();
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };

  const root = new THREE.Group();          // what the game positions and rolls
  const inner = new THREE.Group();         // the model, re-aimed for a side-on view
  inner.rotation.y = YAW;
  inner.scale.setScalar(SCALE);
  root.add(inner);

  const boat = new THREE.Group();
  inner.add(boat);

  // --- hull: beam across shape-x, length along shape-y, bow at +10 ---------
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, -9);
  hullShape.lineTo(2.2, -9);
  hullShape.quadraticCurveTo(2.95, -8.85, 3.0, -7.4);
  hullShape.lineTo(3.0, 2.0);
  hullShape.quadraticCurveTo(3.0, 6.4, 0, 10);
  hullShape.quadraticCurveTo(-3.0, 6.4, -3.0, 2.0);
  hullShape.lineTo(-3.0, -7.4);
  hullShape.quadraticCurveTo(-2.95, -8.85, -2.2, -9);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 3.4, bevelEnabled: false, steps: 6, curveSegments: 28 });
  hullGeo.rotateX(Math.PI / 2);            // extrusion points down: y in [-3.4, 0], length along z
  {
    // taper toward the keel and lift it at bow and stern (rocker)
    const pos = hullGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const t = THREE.MathUtils.clamp((y + 3.4) / 3.4, 0, 1);   // 0 keel -> 1 deck
      const w = 0.30 + 0.70 * Math.pow(t, 0.8);
      const end = Math.max(0, (Math.abs(z) - 4.5) / 5.5);
      pos.setX(i, x * w);
      pos.setY(i, y + (1 - t) * Math.pow(end, 1.6) * 1.5);
    }
    hullGeo.computeVertexNormals();
  }
  hullGeo.translate(0, DECK, 0);           // deck cap at DECK, keel at DECK - 3.4
  boat.add(new THREE.Mesh(hullGeo, [M.deck, M.hull]));   // caps = planks, walls = paint

  // --- gunwale lip and inner bulwark --------------------------------------
  {
    const pts2 = hullShape.getPoints(80);
    const ring = (scaleX, scaleZ, y, r) => {
      const curve = new THREE.CatmullRomCurve3(
        pts2.map((p) => new THREE.Vector3(p.x * scaleX, y, p.y * scaleZ)), true
      );
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 160, r, 10, true), M.rim);
    };
    boat.add(ring(1, 1, DECK + 0.05, 0.17));
    boat.add(ring(0.965, 0.985, DECK + 0.15, 0.10));
  }

  // --- crates, stern port --------------------------------------------------
  const crateGeo = new THREE.BoxGeometry(1.12, 1.12, 1.12);
  for (const [x, z, rot] of [[-1.95, -8.3, 0.05], [-0.78, -8.35, -0.07], [-1.98, -7.12, -0.04], [-0.80, -7.16, 0.08]]) {
    const c = mesh(crateGeo, M.crate, x, DECK + 0.56, z);
    c.rotation.y = rot;
    boat.add(c);
  }

  // --- metal drums, stern starboard ---------------------------------------
  const drum = (x, z, mat, s = 1) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 1.15 * s, 20), mat, 0, 0.575 * s, 0));
    for (const hy of [0.32, 0.72]) {
      const r = mesh(new THREE.TorusGeometry(0.455 * s, 0.028 * s, 8, 24), mat, 0, hy * 1.15 * s, 0);
      r.rotation.x = Math.PI / 2;
      g.add(r);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.05, 12), M.black, 0.2 * s, 1.16 * s, 0.1 * s));
    g.position.set(x, DECK, z);
    g.rotation.y = Math.random() * Math.PI;
    return g;
  };
  boat.add(drum(1.35, -8.25, M.drumDark));
  boat.add(drum(2.28, -8.15, M.drumDark));
  boat.add(drum(1.32, -7.25, M.drumDark));
  boat.add(drum(2.25, -7.10, M.drumDark));
  boat.add(drum(1.78, -6.35, M.drumLight, 0.92));

  // --- wooden barrel + rope coil, port ------------------------------------
  {
    const b = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 8; i++) {
      const v = i / 8;
      prof.push(new THREE.Vector2(0.34 + Math.sin(v * Math.PI) * 0.08, v * 0.85));
    }
    b.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 18), M.barrelWood));
    for (const hy of [0.16, 0.68]) {
      const hoop = mesh(new THREE.TorusGeometry(0.375 + Math.sin(hy / 0.85 * Math.PI) * 0.075, 0.02, 6, 20), M.black, 0, hy, 0);
      hoop.rotation.x = Math.PI / 2;
      b.add(hoop);
    }
    b.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 18), M.barrelWood, 0, 0.86, 0));
    b.position.set(-2.3, DECK, -6.3);
    boat.add(b);

    const coil = new THREE.Group();
    for (const [r, y] of [[0.34, 0.07], [0.27, 0.2], [0.2, 0.32]]) {
      const ring = mesh(new THREE.TorusGeometry(r, 0.075, 8, 24), M.rope, 0, y, 0);
      ring.rotation.x = Math.PI / 2;
      coil.add(ring);
    }
    coil.position.set(-2.28, DECK, -4.85);
    boat.add(coil);
  }

  // --- mast, flag, stays, masthead lamp -----------------------------------
  let flag;
  {
    const mastX = 0.25, mastZ = -5.5, mastH = 7.4;
    boat.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, mastH, 10), M.mast, mastX, DECK + mastH / 2, mastZ));
    boat.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), M.mast, mastX, DECK + mastH + 0.06, mastZ));

    // The flag is authored in local XY waving in Z, which the 90° yaw would turn
    // edge-on to the camera. Yaw it back so it faces us and streams aft.
    const fg = new THREE.PlaneGeometry(2.3, 1.3, 26, 8);
    fg.translate(1.15, 0, 0);
    flag = new THREE.Mesh(fg, M.flag);
    flag.rotation.y = Math.PI / 2;
    flag.position.set(mastX + 0.08, DECK + mastH - 0.85, mastZ);
    boat.add(flag);

    const stayMat = new THREE.LineBasicMaterial({ color: 0x2b2e30, transparent: true, opacity: 0.7 });
    for (const a of [[0, DECK + 0.35, 8.6], [0, DECK + 0.35, -8.55]]) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(mastX, DECK + mastH - 0.15, mastZ),
        new THREE.Vector3(a[0], a[1], a[2]),
      ]);
      boat.add(new THREE.Line(g, stayMat));
    }

    // A masthead lamp: the one bright point that stays findable from the seabed.
    const lampY = DECK + mastH - 0.1;
    boat.add(mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }), mastX, lampY, mastZ));
    const glow = mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({
      map: glowTexture(), color: 0xffe0a0, blending: THREE.AdditiveBlending,
      transparent: true, opacity: 0.5, depthWrite: false, fog: false,
    }), mastX, lampY, mastZ);
    glow.rotation.y = -YAW;              // face the camera through the group yaw
    boat.add(glow);
    root.userData.lampGlow = glow;
  }

  // --- machinery platform amidships ---------------------------------------
  {
    const P = new THREE.Group();
    P.position.set(0.15, DECK, -0.1);
    P.add(mesh(new THREE.BoxGeometry(3.5, 0.5, 7.6), M.platform, 0, 0.25, 0));
    P.add(mesh(new THREE.BoxGeometry(3.66, 0.14, 7.76), M.platformTrim, 0, 0.1, 0));

    for (const [x, z] of [[-0.7, -3.0], [0.72, -3.05], [-0.68, -2.0], [0.7, -1.98]]) {
      P.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.05, 18), M.tank, x, 1.03, z));
      P.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10), M.engine, x, 1.6, z));
      const rr = mesh(new THREE.TorusGeometry(0.465, 0.025, 6, 20), M.tank, x, 1.25, z);
      rr.rotation.x = Math.PI / 2;
      P.add(rr);
    }

    const wbarrel = (x, y, z) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 18), M.whiteBarrel));
      for (const hy of [-0.55, 0, 0.55]) {
        const r = mesh(new THREE.TorusGeometry(0.405, 0.022, 6, 20), M.whiteBarrel, 0, hy, 0);
        r.rotation.x = Math.PI / 2;
        g.add(r);
      }
      g.rotation.z = Math.PI / 2;
      g.position.set(x, y, z);
      return g;
    };
    P.add(wbarrel(0, 0.9, -0.75));
    P.add(wbarrel(0, 0.9, 0.12));
    P.add(wbarrel(0, 1.58, -0.32));

    const tireStack = (x, z, n) => {
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.2, 12, 24), M.tire);
        t.rotation.x = Math.PI / 2;
        t.position.set((Math.random() - 0.5) * 0.08, 0.2 + i * 0.4, (Math.random() - 0.5) * 0.08);
        g.add(t);
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14), M.engine, 0, 0.2 + i * 0.4, 0));
      }
      g.position.set(x, 0.5, z);
      return g;
    };
    P.add(tireStack(-0.75, 1.35, 2));
    P.add(tireStack(0.72, 1.5, 2));

    P.add(mesh(new THREE.BoxGeometry(2.9, 0.95, 1.15), M.engine, 0, 0.97, 2.7));
    for (let s = 0; s < 6; s++) {
      P.add(mesh(new THREE.BoxGeometry(2.5, 0.05, 0.09), M.black, 0, 1.48, 2.28 + s * 0.17));
    }
    P.add(mesh(new THREE.BoxGeometry(2.9, 0.55, 0.55), M.engineLight, 0, 0.78, 3.45));
    P.add(mesh(new THREE.BoxGeometry(2.4, 0.22, 0.06), M.black, 0, 0.84, 3.75));
    P.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 10), M.black, 1.2, 1.8, 2.4));
    boat.add(P);
  }

  // --- cargo grate near the bow -------------------------------------------
  {
    const G = new THREE.Group();
    G.position.set(0, DECK, 6.15);
    const Wd = 2.15, L = 2.5, bars = 6;
    G.add(mesh(new THREE.BoxGeometry(Wd + 0.3, 0.22, L + 0.3), M.rim, 0, 0.11, 0));
    G.add(mesh(new THREE.BoxGeometry(Wd, 0.06, L), M.black, 0, 0.2, 0));
    for (let i = 0; i <= bars; i++) G.add(mesh(new THREE.BoxGeometry(0.07, 0.1, L), M.engine, -Wd / 2 + i * (Wd / bars), 0.24, 0));
    for (let j = 0; j <= bars + 1; j++) G.add(mesh(new THREE.BoxGeometry(Wd, 0.1, 0.07), M.engine, 0, 0.24, -L / 2 + j * (L / (bars + 1))));
    boat.add(G);
  }

  // --- fenders along both sides -------------------------------------------
  {
    const halfWidthAt = (z) => (z <= 2 ? 3.0 : 3.0 * (1 - Math.pow((z - 2) / 8, 2) * 0.95));
    for (const z of [-6.4, -2.9, 0.6, 3.9]) {
      for (const side of [1, -1]) {
        const f = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 14), M.tire);
        body.rotation.z = Math.PI / 2;
        f.add(body);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.66, 12), M.black);
        cap.rotation.z = Math.PI / 2;
        f.add(cap);
        f.position.set(side * (halfWidthAt(z) * 0.83 + 0.42), DECK - 0.72, z);
        const lg = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(side * -0.15, 1.35, 0),
        ]);
        f.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x2a2320 })));
        boat.add(f);
      }
    }
  }

  // --- deck cleats ---------------------------------------------------------
  for (const [x, z] of [[-2.55, -8.0], [2.55, -8.0], [-2.65, -3.8], [2.65, -3.8], [-2.3, 3.2], [2.3, 3.2]]) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.1, 0.26), M.rim, 0, 0.05, 0));
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 8), M.rim);
    horn.rotation.x = Math.PI / 2;
    horn.position.y = 0.13;
    g.add(horn);
    g.position.set(x, DECK, z);
    boat.add(g);
  }

  // --- fish on deck (turned to lie along the viewing axis) -----------------
  {
    const F = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M.fish);
    body.scale.set(0.44, 0.13, 0.15);
    F.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), M.fish);
    tail.scale.set(1, 1, 0.35);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.52, 0, 0);
    F.add(tail);
    F.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), M.black, 0.28, 0.06, 0.12));
    F.position.set(-1.9, DECK + 0.13, -2.45);
    F.rotation.y = Math.PI / 2 + 0.3;
    boat.add(F);
  }

  // --- fishing line, re-aimed off the stern so it is not lost into the screen
  {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.2, DECK + 0.3, -8.9),
      new THREE.Vector3(-1.0, DECK - 0.9, -9.9),
      new THREE.Vector3(-0.9, 0.15, -10.5)
    );
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
    boat.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x22262a })));
    boat.add(mesh(new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9534f, roughness: 0.6 }), -0.9, 0.15, -10.5));
  }

  // --- crew ----------------------------------------------------------------
  // Trimmed from four to two: the fiction is one diver working a boat that is
  // barely crewed, and four idle hands on deck while you drown reads wrong.
  const crew = [];
  const makeCrew = (x, z, rotY) => {
    const g = new THREE.Group();
    for (const lx of [-0.09, 0.09]) g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 8), M.pants, lx, 0.18, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.42, 12), M.overalls, 0, 0.55, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.34, 12), M.shirt, 0, 0.93, 0));
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8), M.shirt, s * 0.26, 0.9, 0);
      arm.rotation.z = s * -0.28;
      g.add(arm);
      g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), M.skin, s * 0.315, 0.7, 0));
      arms.push(arm);
    }
    g.add(mesh(new THREE.SphereGeometry(0.17, 14, 12), M.skin, 0, 1.28, 0));
    g.add(mesh(new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.capGreen, 0, 1.3, 0));
    const brim = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), M.capGreenD, 0, 1.36, 0.14);
    brim.scale.z = 1.35;
    g.add(brim);
    g.position.set(x, DECK, z);
    g.rotation.y = rotY;
    g.userData = { phase: Math.random() * Math.PI * 2, baseY: DECK, arms };
    boat.add(g);
    crew.push(g);
  };
  makeCrew(-2.25, -2.3, Math.PI * 0.5);    // at the port rail, watching the dive line
  makeCrew(1.55, 3.6, Math.PI * 1.15);     // forward, by the engine housing

  // --- gulls, circling the boat -------------------------------------------
  const gulls = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.gull);
    body.scale.set(1.6, 0.7, 0.8);
    g.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.85), M.gull);
      w.geometry.translate(0, 0.425, 0);
      w.rotation.x = -Math.PI / 2;
      w.rotation.y = s > 0 ? 0 : Math.PI;
      const piv = new THREE.Group();
      piv.add(w);
      piv.position.set(0, 0.05, 0);
      g.add(piv);
      wings.push(piv);
    }
    g.userData = { r: 6.5 + i * 2.4, h: 9.5 + i * 1.6, speed: 0.25 + i * 0.06, phase: i * 2.1, wings };
    boat.add(g);
    gulls.push(g);
  }

  root.userData.flag = flag;
  root.userData.flagBase = flag.geometry.attributes.position.array.slice();
  root.userData.crew = crew;
  root.userData.gulls = gulls;
  return root;
}

// Per-frame life: flag, crew, gulls. `work` (0..1) makes the crew busier while
// the player is holding Repair.
export function updateBoat(root, t, work = 0) {
  const u = root.userData;
  if (!u.flag) return;

  const pos = u.flag.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const fx = u.flagBase[i * 3];
    const w = fx / 2.3;
    pos.setZ(i, Math.sin(fx * 2.2 - t * 6) * 0.16 * w + Math.sin(fx * 4.5 - t * 9) * 0.05 * w);
  }
  pos.needsUpdate = true;

  for (const c of u.crew) {
    const p = c.userData.phase;
    c.position.y = c.userData.baseY + Math.sin(t * 1.6 + p) * 0.015;
    c.rotation.z = Math.sin(t * 1.1 + p) * 0.035;
    // hauling motion while a part is being fitted
    for (let i = 0; i < c.userData.arms.length; i++) {
      const s = i ? 1 : -1;
      c.userData.arms[i].rotation.z = s * -0.28 + work * Math.sin(t * 7 + p + i) * 0.5;
    }
  }

  for (const g of u.gulls) {
    const d = g.userData;
    const a = t * d.speed + d.phase;
    g.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * 0.8 + d.phase) * 0.6, Math.sin(a) * d.r);
    g.rotation.y = -a - Math.PI / 2;
    const flap = Math.sin(t * 7 + d.phase) * 0.55;
    d.wings[0].rotation.x = flap;
    d.wings[1].rotation.x = -flap;
  }
}
