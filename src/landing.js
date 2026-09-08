// The landing / loading screen.
//
// The design is one rendered seabed scene. The delivered art has no flattened
// version of it, but it does ship the pieces that scene is built from — the
// water gradient, and the coral / plant / rock / chest sprites — so the scene is
// composed here from those. Swapping in a single flattened backdrop later means
// dropping one entry into WATER and emptying FLORA.
//
// The bar is the delivered art too. Its cyan fill is baked in at ~70%, so it
// cannot animate as shipped; assets/derived/ holds an emptied track and the fill
// sliced out of it, both cut from the same source image.
import { asset, derived, preload } from './assets.js';

// Sprites are drawn at roughly a quarter of the screen width, so their 1x files
// are already well past the pixel density they need. The water is a soft
// gradient with no fine detail, which is the one thing that upscales for free.
const WATER = { folder: 'underwater', scale: 1 };

// left/right/bottom/width are percentages of the screen box, ordered back to
// front. `fade` stands in for distance: the far rock shelves are dimmed and
// desaturated so the column reads as having depth rather than as one flat layer.
const FLORA = [
  { folder: 'rock 3',      left:  -9, bottom: 36, width: 27, fade: 0.55 },
  { folder: 'rock 4',      right: -10, bottom: 39, width: 25, fade: 0.50 },
  { folder: 'rock 2',      left:  -8, bottom: 17, width: 30 },
  { folder: 'rock 5',      right:  -7, bottom: 18, width: 27 },
  { folder: 'plant 3',     left:  20, bottom:  7, width: 19 },
  { folder: 'coral 1',     left:  -2, bottom:  6, width: 25 },
  { folder: 'coral 5',     right:  -3, bottom:  5, width: 29 },
  { folder: 'chest box 4', left:   3, bottom:  0, width: 26 },
  { folder: 'coral 3',     right:   9, bottom: -1, width: 26 },
];

const $ = (id) => document.getElementById(id);

/**
 * Build the scene, preload it, and run the bar off real load progress.
 * Resolves when the player taps to begin.
 */
export function startLanding() {
  const water = $('ls-water');
  const flora = $('ls-flora');
  const fill = $('load-fill');
  const label = $('load-label');
  const screen = $('screen-landing');

  water.src = asset(WATER.folder, WATER.scale);

  flora.innerHTML = '';
  FLORA.forEach((f, i) => {
    const img = document.createElement('img');
    img.className = 'ls-sprite';
    img.alt = '';
    img.src = asset(f.folder, 1);
    img.style.width = `${f.width}%`;
    img.style.bottom = `${f.bottom}%`;
    img.style.zIndex = String(i + 1);
    if (f.left !== undefined) img.style.left = `${f.left}%`;
    else img.style.right = `${f.right}%`;
    if (f.fade) {
      img.style.opacity = String(f.fade);
      img.style.filter = 'saturate(0.75)';
    }
    flora.appendChild(img);
  });

  // The fill is positioned inside the bar against the track measured out of the
  // source image, so it lines up with the painted frame at any size.
  const FILL_MAX = 92.7;   // % of the bar image the inner track spans
  let shown = 0;           // what the bar is currently displaying
  let target = 0;          // what has actually loaded

  const urls = [water.src, ...FLORA.map((f) => asset(f.folder, 1)),
                derived('loading-bar-track.webp'), derived('loading-bar-fill.webp')];

  preload(urls, (p) => { target = p; }).then((failed) => {
    if (failed.length) console.warn('[landing] failed to load:', failed);
    target = 1;
  });

  return new Promise((resolve) => {
    let ready = false;
    let raf = 0;
    let last = performance.now();

    // The bar eases toward real progress rather than snapping to it, and is
    // floored to a minimum duration, so a warm cache still reads as a fill
    // rather than a flash.
    const MIN_SECONDS = 1.1;
    let elapsed = 0;

    const finish = () => {
      cancelAnimationFrame(raf);
      screen.removeEventListener('pointerdown', finish);
      resolve();
    };

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      const cap = Math.min(target, elapsed / MIN_SECONDS);
      shown += (cap - shown) * Math.min(1, dt * 6);
      if (cap - shown < 0.004) shown = cap;
      fill.style.width = `${shown * FILL_MAX}%`;

      if (!ready && shown >= 0.999) {
        ready = true;
        label.textContent = 'Tap to begin';
        label.dataset.ready = 'true';
        screen.addEventListener('pointerdown', finish);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}
