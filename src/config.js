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
    seabedY: -26,
    halfWidth: 14,
    boatX: 0,
    boatY: 0,           // the workboat model puts its waterline at the origin
    surfaceRadius: 3.0,   // the workboat is ~7.6m long, so the surfacing zone grew with it       // swim this close to the boat to surface
  },

  diver: {
    // 2.8 m/s is a hard fin kick. It was 5.0, which crossed the whole map in six
    // seconds — that is what made the world feel small and the tank feel irrelevant,
    // not the dimensions. Distance has to cost something for oxygen to be a resource.
    speed: 2.8,               // metres / second at full stick
    accel: 7.5,
    drag: 2.2,
    collectRadius: 1.0,
  },

  oxygen: {
    max: 100,
    headHomeBelow: 0.35,      // below this the sonar switches to bearing on the boat
    baseDrain: 100 / 45,      // a full tank is ~45s of ordinary swimming
    drillMultiplier: 2,
    boostMultiplier: 3,
    tankRefill: 40,
    amberBelow: 0.40,
    redBelow: 0.15,
  },

  boost: {
    speedMultiplier: 2.1,     // 5.9 m/s — comfortably above a shark's chase speed
    // Long enough, and recharging fast enough, that the duty cycle actually
    // averages above a shark's chase speed. At 1.8s/2.4s it did not, so boost
    // could never break a pursuit — you just died slightly later.
    maxHold: 2.4,
    cooldown: 2.0,
  },

  drill: {
    seconds: 1.6,             // push the stick into a rock this long to crack it
    contactRadius: 1.85,      // collision holds the diver ~1.32m off a boulder,
                              // so contact must reach past that to register
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
    count: 3,
    patrolSpeed: 1.9,         // slower than a swimming diver: you can outpace a cruise
    chaseSpeed: 3.2,          // faster than the diver: only boost breaks a pursuit
    detectRadius: 6.0,        // starts a pursuit — well outside the danger ring
    dangerRadius: 3.4,        // warning pulse, and where a close call is earned
    catchRadius: 0.85,
    loseInterestAfter: 2.5,   // seconds of pursuit after losing contact
    turnRate: 2.6,            // how fast it can swing onto a new heading
    facingDeadzone: 0.35,     // m/s of lateral speed before it flips to face the other way
    closeCallDwell: 0.45,     // must stay in the danger ring this long to bank a close call
  },

  spawn: {
    partsInRocks: 3,          // of the five; the rest lie loose on the seabed
    rocks: 11,
    tanks: 5,
    fins: 3,
    floodlights: 3,
  },

  score: {
    perPartInstalled: 200,
    perCloseCall: 50,
    perSecondOnEscape: 5,     // only paid if the boat actually sails
  },
};
