// Depth Rush — all gameplay tunables in one place.
// The world is a 3D volume: X and Z span the seabed, Y is depth.

export const CONFIG = {
  run: {
    stormSeconds: 480,        // "The storm returns in 8 minutes."
    lateGameSeconds: 90,
    criticalSeconds: 30,
  },

  world: {
    surfaceY: 0,
    seabedY: -28,
    halfWidth: 16,            // X extent
    halfDepth: 16,            // Z extent
    boatX: 0,
    boatZ: 0,
    boatY: 0,
    surfaceRadius: 4.0,       // swim this close to the boat to climb aboard
  },

  camera: {
    distance: 6.2,            // third-person trail distance
    height: 1.5,              // lifted above the diver's head
    lookAhead: 3.0,
    followLerp: 7.0,
    fov: 62,
  },

  look: {
    yawSpeed: 2.4,            // radians / second at full stick
    pitchSpeed: 1.7,
    pitchClamp: 1.2,          // ~69 degrees, so you never flip over the top
  },

  diver: {
    speed: 2.8,               // metres / second at full stick
    accel: 7.5,
    drag: 2.2,
    collectRadius: 1.4,
    bodyRadius: 0.5,
  },

  oxygen: {
    max: 100,
    headHomeBelow: 0.35,      // below this the sonar switches to bearing on the boat
    baseDrain: 100 / 45,      // a full tank is ~45s of ordinary swimming
    drillMultiplier: 2,
    boostMultiplier: 3,
    tankRefill: 40,
    // Breaking the surface refills the tank. Air is free up top — what it costs
    // is the storm clock, and the swim back down.
    surfaceDepth: 2.2,        // within this of the surface counts as breathing
    surfaceRefillPerSec: 30,
    amberBelow: 0.40,
    redBelow: 0.15,
  },

  boost: {
    speedMultiplier: 2.1,
    maxHold: 2.4,
    cooldown: 2.0,
  },

  drill: {
    seconds: 1.6,
    contactRadius: 2.1,
    aimDot: 0.35,             // how squarely you must face a rock to bite into it
  },

  repair: {
    secondsPerPart: 2.6,
  },

  fins: { speedBonus: 0.16, maxStacks: 3 },
  floodlight: { radiusBonus: 3.5, maxStacks: 3 },

  shark: {
    count: 4,
    patrolSpeed: 1.9,
    chaseSpeed: 3.2,
    detectRadius: 6.0,
    dangerRadius: 3.4,
    catchRadius: 0.95,
    loseInterestAfter: 2.5,
    turnRate: 2.6,
    closeCallDwell: 0.45,
  },

  spawn: {
    partsInRocks: 3,
    rocks: 14,
    tanks: 5,
    fins: 3,
    floodlights: 3,
  },

  // How hard the water closes in with depth. 0 at the surface, 1 on the bed.
  depthFade: {
    fogNearSurface: 26,
    fogFarSurface: 70,
    fogNearDeep: 5,
    fogFarDeep: 20,
    ambientSurface: 1.25,
    ambientDeep: 0.16,
    sunSurface: 2.1,
    sunDeep: 0.12,
  },

  score: {
    perPartInstalled: 200,
    perCloseCall: 50,
    perSecondOnEscape: 5,
  },
};
