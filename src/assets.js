// Asset URLs and preloading.
//
// The art is delivered as one folder per asset, each holding the same image at
// 1x/2x/3x/4x. Two things about those folders need handling here rather than at
// every call site:
//
//  1. Several names are not URL-safe — spaces, parentheses, and a literal "?".
//     An unencoded "?" is read as the start of a query string, so the request
//     404s. Every path segment is percent-encoded.
//  2. One folder's basename does not match its own name (see BASENAME).
//
// Scale is chosen per asset rather than globally: a soft gradient backdrop is
// indistinguishable at 1x, while a sprite drawn small on screen is already
// oversampled at 1x. Shipping only what each asset actually needs is what keeps
// the build inside the 35MB competition limit.

const BASE = './assets';

// folder name -> file basename, only where the two differ.
const BASENAME = {
  'setting popup 2': 'setting popup',
};

const seg = (s) => encodeURIComponent(s);

/** URL for one of the delivered assets, at the given scale (1-4). */
export function asset(folder, scale = 1) {
  const base = BASENAME[folder] ?? folder;
  return `${BASE}/${seg(folder)}/${seg(`${base}_${scale}x.webp`)}`;
}

/** URL for an image derived from the delivered art (see assets/derived/). */
export const derived = (file) => `${BASE}/derived/${seg(file)}`;

/** URL for a delivered video. These sit at the top level of assets/. */
export const video = (file) => `${BASE}/${seg(file)}`;

/** Resolve one `data-asset` value to a URL. "derived:name.webp" reads from assets/derived/. */
export function resolve(spec, scale = 1) {
  return spec.startsWith('derived:') ? derived(spec.slice(8)) : asset(spec, scale);
}

/**
 * Point every `[data-asset]` element at its image, so markup can name art
 * directly instead of every screen repeating URL construction:
 *
 *   <img data-asset="go bg" data-scale="2">        -> src
 *   <div data-asset="derived:start-button.webp">   -> background-image
 *
 * Returns the URLs it set, which is what a screen hands to preload().
 */
export function hydrateAssets(root = document) {
  const urls = [];
  for (const el of root.querySelectorAll('[data-asset]')) {
    const url = resolve(el.dataset.asset, Number(el.dataset.scale) || 1);
    if (el.tagName === 'IMG') el.src = url;
    else el.style.backgroundImage = `url("${url}")`;
    urls.push(url);
  }
  return urls;
}

/**
 * Load every URL, reporting fractional progress as each settles.
 * A failed image still counts: one missing file must not wedge the loader.
 * Resolves with the list of URLs that failed, so callers can warn.
 */
export function preload(urls, onProgress) {
  const total = urls.length;
  if (!total) { onProgress?.(1); return Promise.resolve([]); }

  let settled = 0;
  const failed = [];
  return Promise.all(urls.map((url) => new Promise((resolve) => {
    const img = new Image();
    const done = (ok) => {
      if (!ok) failed.push(url);
      settled += 1;
      onProgress?.(settled / total);
      resolve();
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  }))).then(() => failed);
}
