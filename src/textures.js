// Procedural textures, generated into canvases at load time.
// The build may not make an external request, so nothing is ever fetched — every
// surface in the game is drawn here in code and uploaded as a texture.
import * as THREE from '../vendor/three.module.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}

function toTexture(c, { repeat = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cheap deterministic value noise — enough structure to break up flat surfaces.
function valueNoise(ctx, size, cells, alpha, seed = 1, blur = 0) {
  if (blur) ctx.filter = `blur(${blur}px)`;
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const step = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = Math.floor(120 + rnd() * 135);
      ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      ctx.fillRect(x * step, y * step, step + 1, step + 1);
    }
  }
  ctx.filter = 'none';
}

function speckle(ctx, size, count, colors, minR, maxR, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, minR + rnd() * (maxR - minR), 0, Math.PI * 2);
    ctx.fill();
  }
}

/* --------------------------------------------------------------- surfaces */

// Seabed: sand base, drifting ripples, shell grit.
export function sandTexture() {
  const size = 512;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#e0c589';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.5;
  valueNoise(ctx, size, 40, 0.16, 21, 7);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255,246,206,0.16)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    const y = (i / 26) * size;
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin((x / size) * Math.PI * 4 + i * 1.4) * 9;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  speckle(ctx, size, 900, ['rgba(255,250,222,0.22)', 'rgba(158,122,64,0.16)'], 0.6, 2.2, 3);
  return toTexture(c, { repeat: 3.5 });
}

// Rock: mottled dark stone with lighter mineral flecks and crack lines.
export function rockTexture() {
  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#5d8298';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.55;
  valueNoise(ctx, size, 28, 0.3, 5, 4);
  ctx.globalAlpha = 1;
  speckle(ctx, size, 260, ['rgba(198,224,238,0.26)', 'rgba(44,74,96,0.34)'], 1, 5, 11);

  ctx.strokeStyle = 'rgba(38,66,88,0.45)';
  ctx.lineWidth = 2;
  let s = 99;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    let x = rnd() * size, y = rnd() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return toTexture(c, { repeat: 1 });
}

// Painted marine metal: brushed streaks, weld seams, rust blooms at the waterline.
export function hullTexture() {
  const size = 512;
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#f4f8f7');
  g.addColorStop(0.55, '#dbe7e6');
  g.addColorStop(1, '#b9cbcb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 340; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.7)' : 'rgba(90,120,125,0.5)';
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    const y = Math.random() * size;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (Math.random() - 0.5) * 5); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(120,150,155,0.45)';
  ctx.lineWidth = 2.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, (i / 4) * size); ctx.lineTo(size, (i / 4) * size); ctx.stroke();
  }
  // rivet lines along each seam
  ctx.fillStyle = 'rgba(105,135,140,0.5)';
  for (let i = 1; i < 4; i++) {
    for (let x = 10; x < size; x += 22) {
      ctx.beginPath(); ctx.arc(x, (i / 4) * size, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 0.5;
  speckle(ctx, size, 90, ['rgba(150,85,40,0.5)', 'rgba(115,60,25,0.4)'], 1, 7, 43);
  ctx.globalAlpha = 1;
  return toTexture(c, { repeat: 1 });
}

// Salvaged brass/bronze for the boat parts — warm, scratched, a little tarnished.
export function brassTexture() {
  const size = 256;
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#ffd587');
  g.addColorStop(0.45, '#e0a24a');
  g.addColorStop(0.7, '#b9782f');
  g.addColorStop(1, '#f0c273');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 160; i++) {
    ctx.strokeStyle = i % 3 ? 'rgba(255,240,200,0.8)' : 'rgba(90,55,20,0.6)';
    ctx.lineWidth = 0.5 + Math.random();
    const x = Math.random() * size;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - 0.5) * 30, size); ctx.stroke();
  }
  ctx.globalAlpha = 0.3;
  speckle(ctx, size, 70, ['rgba(70,120,110,0.55)'], 1, 5, 17);   // verdigris
  ctx.globalAlpha = 1;
  return toTexture(c, { repeat: 1 });
}

// Neoprene wetsuit: matte rubber with a faint weave.
export function suitTexture() {
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#16323f';
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.3;
  valueNoise(ctx, size, 32, 0.14, 61, 2);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 4) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
  }
  return toTexture(c, { repeat: 2 });
}

// Sharkskin: dark dorsal fading to a pale belly, with dermal stipple.
export function sharkTexture() {
  const size = 256;
  const { c, ctx } = canvas(size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#41566180');
  g.addColorStop(0.42, '#6d858f');
  g.addColorStop(0.62, '#aebfc4');
  g.addColorStop(1, '#e6eeee');
  ctx.fillStyle = '#6d858f';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.35;
  speckle(ctx, size, 700, ['rgba(35,55,65,0.35)', 'rgba(230,240,240,0.25)'], 0.5, 1.6, 29);
  ctx.globalAlpha = 1;
  return toTexture(c, { repeat: 1 });
}

// Caustics: bright interference lines, additively blended and scrolled over the
// seabed. Two layers at different speeds read as moving water light.
export function causticsTexture() {
  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  const pts = [];
  let s = 1234;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 22; i++) pts.push({ x: rnd() * size, y: rnd() * size });

  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = Infinity, d2 = Infinity;
      for (const p of pts) {
        // wrap so the tile repeats seamlessly
        const dx = Math.min(Math.abs(p.x - x), size - Math.abs(p.x - x));
        const dy = Math.min(Math.abs(p.y - y), size - Math.abs(p.y - y));
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
      // the ridge between two cells is where the light concentrates
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const v = Math.max(0, 1 - edge / 16);
      const b = Math.floor(Math.pow(v, 2.4) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = b * 0.75; img.data[i + 1] = b; img.data[i + 2] = b * 0.95; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: 3, srgb: false });
}

// Soft round falloff, used for bubbles, motes and light shafts.
let GLOW = null;
export function glowTexture() {
  if (GLOW) return GLOW;
  const size = 128;
  const { c, ctx } = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  GLOW = new THREE.CanvasTexture(c);
  GLOW.colorSpace = THREE.SRGBColorSpace;
  return GLOW;
}
