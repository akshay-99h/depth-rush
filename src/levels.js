// Nine dives across three biomes. The core loop is the same everywhere —
// find the parts, fit them, beat the storm — because that loop is what the
// prototype is for. What changes between levels is the shape of the problem:
// how much water there is, how far down, how dark, and what is in it with you.
//
// Everything here is data. A level is applied by mutating the live CONFIG and
// PALETTE objects, so every system picks the new numbers up without knowing
// levels exist.
import { CONFIG } from './config.js';
import { PALETTE } from './world.js';

export const BIOMES = [
  {
    id: 'shelf',
    name: 'Continental Shelf',
    blurb: 'Sunlit water over a sand bed. Sharks work the shallows.',
    palette: { shallow: 0x14586b, abyss: 0x04141c },
    depthFade: { fogNearSurface: 26, fogFarSurface: 70, fogNearDeep: 6, fogFarDeep: 24,
                 ambientSurface: 1.3, ambientDeep: 0.22, sunSurface: 2.2, sunDeep: 0.16 },
  },
  {
    id: 'trench',
    name: 'Kelp Trench',
    blurb: 'A silted cut in the shelf. Squid hang in the murk and rip at your tank.',
    palette: { shallow: 0x0e4450, abyss: 0x030f16 },
    depthFade: { fogNearSurface: 18, fogFarSurface: 52, fogNearDeep: 4, fogFarDeep: 16,
                 ambientSurface: 1.0, ambientDeep: 0.12, sunSurface: 1.6, sunDeep: 0.06 },
  },
  {
    id: 'vent',
    name: 'Abyssal Vent',
    blurb: 'Past the light. Your lamp is the only thing down here that is yours.',
    palette: { shallow: 0x0a2c3a, abyss: 0x01070b },
    depthFade: { fogNearSurface: 12, fogFarSurface: 36, fogNearDeep: 2.5, fogFarDeep: 11,
                 ambientSurface: 0.7, ambientDeep: 0.05, sunSurface: 1.0, sunDeep: 0.02 },
  },
];

export const LEVELS = [
  // ---- Continental Shelf -------------------------------------------------
  {
    id: 'shelf-1', biome: 'shelf', name: 'Shakedown',
    brief: 'Calm water, one shark, four parts. Learn the stick and the tank.',
    world: { halfWidth: 13, halfDepth: 13, seabedY: -20 },
    storm: 480, parts: 4, partsInRocks: 2,
    spawn: { rocks: 10, tanks: 5, fins: 3, floodlights: 2 },
    enemies: [{ type: 'shark', count: 1 }],
  },
  {
    id: 'shelf-2', biome: 'shelf', name: 'Reef Break',
    brief: 'More ground to sweep, and the sharks now work in a pair.',
    world: { halfWidth: 16, halfDepth: 16, seabedY: -24 },
    storm: 480, parts: 5, partsInRocks: 3,
    spawn: { rocks: 14, tanks: 5, fins: 3, floodlights: 3 },
    enemies: [{ type: 'shark', count: 2 }],
  },
  {
    id: 'shelf-3', biome: 'shelf', name: 'Storm Front',
    brief: 'Seven minutes, four hunters, and the light already going.',
    world: { halfWidth: 17, halfDepth: 17, seabedY: -27 },
    storm: 420, parts: 5, partsInRocks: 3,
    spawn: { rocks: 15, tanks: 5, fins: 3, floodlights: 3 },
    enemies: [{ type: 'shark', count: 3 }, { type: 'squid', count: 1 }],
    depthFade: { ambientSurface: 0.95, sunSurface: 1.5 },
  },

  // ---- Kelp Trench -------------------------------------------------------
  {
    id: 'trench-1', biome: 'trench', name: 'Fogbank',
    brief: 'Visibility drops fast. Squid do not kill you — they empty you.',
    world: { halfWidth: 15, halfDepth: 15, seabedY: -32 },
    storm: 480, parts: 5, partsInRocks: 3,
    spawn: { rocks: 15, tanks: 6, fins: 3, floodlights: 4 },
    enemies: [{ type: 'squid', count: 2 }, { type: 'shark', count: 1 }],
  },
  {
    id: 'trench-2', biome: 'trench', name: 'The Narrows',
    brief: 'A tight cut, deep. Nowhere to boost to.',
    world: { halfWidth: 12, halfDepth: 12, seabedY: -38 },
    storm: 450, parts: 5, partsInRocks: 4,
    spawn: { rocks: 16, tanks: 6, fins: 3, floodlights: 4 },
    enemies: [{ type: 'squid', count: 3 }, { type: 'shark', count: 1 }],
  },
  {
    id: 'trench-3', biome: 'trench', name: 'Blackwater',
    brief: 'Wide, deep and unlit. Bring the floodlights home.',
    world: { halfWidth: 17, halfDepth: 17, seabedY: -42 },
    storm: 450, parts: 5, partsInRocks: 4,
    spawn: { rocks: 18, tanks: 7, fins: 3, floodlights: 5 },
    enemies: [{ type: 'squid', count: 3 }, { type: 'shark', count: 2 }, { type: 'jelly', count: 3 }],
  },

  // ---- Abyssal Vent ------------------------------------------------------
  {
    id: 'vent-1', biome: 'vent', name: 'First Descent',
    brief: 'Jellies drift the whole column. They will not chase. They do not need to.',
    world: { halfWidth: 15, halfDepth: 15, seabedY: -48 },
    storm: 480, parts: 5, partsInRocks: 3,
    spawn: { rocks: 16, tanks: 7, fins: 4, floodlights: 5 },
    enemies: [{ type: 'jelly', count: 6 }, { type: 'squid', count: 2 }],
  },
  {
    id: 'vent-2', biome: 'vent', name: 'Cold Seep',
    brief: 'Everything that lives down here is down here with you.',
    world: { halfWidth: 18, halfDepth: 18, seabedY: -54 },
    storm: 480, parts: 5, partsInRocks: 4,
    spawn: { rocks: 18, tanks: 7, fins: 4, floodlights: 5 },
    enemies: [{ type: 'jelly', count: 7 }, { type: 'squid', count: 3 }, { type: 'shark', count: 2 }],
  },
  {
    id: 'vent-3', biome: 'vent', name: 'The Rift',
    brief: 'Sixty metres of black water and eight minutes of weather.',
    world: { halfWidth: 20, halfDepth: 20, seabedY: -60 },
    storm: 480, parts: 5, partsInRocks: 5,
    spawn: { rocks: 20, tanks: 8, fins: 4, floodlights: 6 },
    enemies: [{ type: 'jelly', count: 8 }, { type: 'squid', count: 4 }, { type: 'shark', count: 3 }],
  },
];

export const getLevel = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const getBiome = (id) => BIOMES.find((b) => b.id === id) ?? BIOMES[0];

// Mutate the shared CONFIG/PALETTE in place so every module sees the new level
// without needing to know a level system exists.
export function applyLevel(level) {
  const biome = getBiome(level.biome);

  Object.assign(CONFIG.world, level.world);
  CONFIG.run.stormSeconds = level.storm;
  Object.assign(CONFIG.spawn, level.spawn, {
    partsInRocks: Math.min(level.partsInRocks, level.parts),
  });
  CONFIG.parts = { count: level.parts };
  CONFIG.enemies = level.enemies;

  Object.assign(CONFIG.depthFade, biome.depthFade, level.depthFade ?? {});
  PALETTE.shallow = biome.palette.shallow;
  PALETTE.abyss = biome.palette.abyss;

  // The boat sits in the middle of whatever water this level has.
  CONFIG.world.boatX = 0;
  CONFIG.world.boatZ = 0;
  CONFIG.world.boatY = 0;
  return level;
}

/* ---------------------------------------------------------------- progress */

const KEY = 'depthrush.progress.v1';

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { cleared: raw.cleared ?? {}, best: raw.best ?? {} };
  } catch {
    return { cleared: {}, best: {} };
  }
}

export function saveResult(levelId, outcome, score) {
  const p = loadProgress();
  if (outcome === 'win') p.cleared[levelId] = true;
  p.best[levelId] = Math.max(score, p.best[levelId] ?? 0);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
  return p;
}

// The first level is always open; each clear opens the next.
export function isUnlocked(levelId, progress) {
  const i = LEVELS.findIndex((l) => l.id === levelId);
  if (i <= 0) return true;
  return !!progress.cleared[LEVELS[i - 1].id];
}

export function firstUnplayed(progress) {
  return (LEVELS.find((l) => !progress.cleared[l.id] && isUnlocked(l.id, progress)) ?? LEVELS[0]).id;
}
