// Depth Rush — all gameplay tunables in one place.
// Numbers follow the UI lofi where the two disagree with the GDD (8-minute storm,
// five named parts, joystick control, boat/dive split).

export const CONFIG = {
  run: {
    stormSeconds: 480,        // "The storm returns in 8 minutes."
    lateGameSeconds: 90,      // visual pressure inside the last 90s
    criticalSeconds: 30,      // timer goes red and the water goes black
  },

  world: {
    surfaceY: 0,
    seabedY: -18,
    halfWidth: 16,
    boatX: 0,
    boatY: -0.35,
    surfaceRadius: 2.2,       // swim this close to the boat to surface
  },

  diver: {
    speed: 4.4,               // metres / second at full stick
    accel: 7.5,
    drag: 2.2,
    collectRadius: 1.0,
  },

  oxygen: {
    max: 100,
    baseDrain: 100 / 85,      // a full tank is ~85s of ordinary swimming
    drillMultiplier: 2,
    boostMultiplier: 3,
    tankRefill: 40,
    amberBelow: 0.40,
    redBelow: 0.15,
  },

  boost: {
    speedMultiplier: 2.0,
    maxHold: 1.8,
    cooldown: 2.4,
  },

  drill: {
    seconds: 1.6,             // push the stick into a rock this long to crack it
    contactRadius: 1.5,
  },

  repair: {
    secondsPerPart: 2.6,      // held on the boat, with the storm clock still running
  },

  fins: {
    speedBonus: 0.16,
    maxStacks: 3,
  },

  floodlight: {
    radiusBonus: 3.0,
    maxStacks: 3,
  },

  shark: {
    count: 2,
    patrolSpeed: 2.4,
    chaseSpeed: 3.9,
    dangerRadius: 3.2,
    catchRadius: 0.8,
    loseInterestAfter: 4.0,
    closeCallDwell: 0.45,     // must stay in the radius this long to bank a close call
  },

  spawn: {
    partsInRocks: 3,          // of the five; the rest lie loose on the seabed
    rocks: 7,
    tanks: 3,
    fins: 2,
    floodlights: 2,
  },

  score: {
    perPartInstalled: 200,
    perCloseCall: 50,
    perSecondOnEscape: 5,     // only paid if the boat actually sails
  },
};
