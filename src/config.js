// Depth Rush — all gameplay tunables in one place.
// GDD numbers are proposals; tune here, not in the systems.

export const CONFIG = {
  run: {
    stormSeconds: 300,        // 5:00 storm timer
    lateGameSeconds: 60,      // visual pressure inside the last minute
  },

  world: {
    surfaceY: 0,
    seabedY: -15,
    halfWidth: 14,            // playfield spans -halfWidth .. +halfWidth in X
    shipX: 0,
    shipReturnRadius: 1.6,
  },

  diver: {
    baseSpeed: 3.2,           // metres / second
    accel: 9.0,
    arriveRadius: 0.25,
    collectRadius: 0.9,
  },

  oxygen: {
    max: 100,
    baseDrain: 100 / 190,     // full tank ≈ 190s of plain swimming
    drillMultiplier: 2,
    boostMultiplier: 3,
    tankRefill: 35,
    amberBelow: 0.40,
    redBelow: 0.15,
  },

  boost: {
    speedMultiplier: 2.1,
    maxHold: 1.6,             // seconds of continuous boost
    cooldown: 2.0,
  },

  drill: {
    seconds: 1.5,             // hold duration to crack a rock
    radius: 1.3,              // how close the touch point must be
  },

  fins: {
    speedBonus: 0.18,         // +18% swim speed per pickup, per run
    maxStacks: 3,
  },

  floodlight: {
    radiusBonus: 2.5,         // widens the visible pocket
    maxStacks: 3,
  },

  shark: {
    count: 2,
    patrolSpeed: 2.2,
    chaseSpeed: 3.6,
    dangerRadius: 3.0,        // enters warning pulse + banks a close call on escape
    catchRadius: 0.7,
    loseInterestAfter: 4.0,
  },

  spawn: {
    parts: 4,                 // ship parts to find (score driver)
    rocks: 6,                 // drillable — each yields a part or a tank
    tanks: 2,                 // free-floating spare O2
    fins: 2,
    floodlights: 2,
  },

  score: {
    perPart: 200,
    perOxygen: 5,             // × O2 remaining at return
    perSecond: 3,             // × time remaining at return
    perCloseCall: 50,
  },
};
