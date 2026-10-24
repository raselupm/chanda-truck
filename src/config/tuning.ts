// All gameplay/physics/render numbers live here.

/**
 * How fast vehicles move through the world relative to the speed shown on the speedometer.
 * 1 = realistic; 1.6 = the trip goes 60% faster while every km/h number (speedometer, 90 km/h ram,
 * 20 km/h toll rule, slow zones, chase meter) stays the same. Applies to the truck, traffic and chasers.
 */
export const WORLD = {
  speedScale: 1.6,
} as const;

export const RENDER = {
  /** Upper bound for devicePixelRatio; keeps fill-rate sane on high-DPI screens. */
  maxPixelRatio: 2,
  /** Pixel ratio cap on phones/tablets. */
  maxPixelRatioMobile: 1.25,
  fov: 60,
  near: 0.5,
  far: 620,
  fogNear: 140,
  fogFar: 560,
  skyTop: 0x8fb8d8,
  skyColor: 0xf1d9b4,
} as const;

export const LOOP = {
  /** Clamp frame delta so a background tab or a long GC pause doesn't teleport the truck. */
  maxDt: 1 / 20,
} as const;

export const TRUCK = {
  length: 8,
  width: 2.5,
  maxSpeedKmh: 120,
  reverseMaxKmh: 15,
  /** m/s² at standstill; falls off as (1 - (v/vmax)^engineCurveExp) */
  engineAccel: 3.4,
  engineCurveExp: 2.5,
  /** fraction of acceleration lost when fully loaded */
  loadAccelPenalty: 0.28,
  brakeDecel: 9,
  reverseAccel: 3,
  handbrakeDecel: 7,
  coastDecel: 0.3,
  airDrag: 0.0004,
  offroadDecel: 3.5,
  /** yaw rate (rad/s) at low and at top speed */
  maxYawLow: 0.75,
  maxYawHigh: 0.24,
  /** how quickly the yaw rate follows the steering (higher = twitchier) */
  yawResponse: 6,
  /** max angle between truck and road (prevents U-turns) */
  maxHeadingOffset: 0.85,
  steerRise: 2.2,
  steerReturn: 3.8,
} as const;

export const ROAD = {
  chunkLength: 40,
  sampleStep: 4,
  chunksAhead: 15,
  chunksBehind: 3,
  villageHalfWidth: 3.6,
  highwayHalfWidth: 7,
  shoulder: 2,
  /** road surface height above surrounding ground */
  top: 0.25,
  /** furthest the truck may drift from the centreline on open road */
  hardLimit: 14,
  /** road deck height above the water and approach-ramp length, per bridge style */
  bridgeStyles: {
    jamuna: { deck: 7, ramp: 180 },
    lalon: { deck: 7, ramp: 180 },
    // Padma: road on top of a deep steel truss (railway deck inside), so it sits much higher
    padma: { deck: 22, ramp: 440 },
  },
  /** straight road kept before / after every event (set pieces sit on x = 0) */
  straightBefore: 260,
  straightAfter: 160,
  /** roughly one S-bend every this many metres between events */
  bendLength: 800,
  /** bend amplitude as a fraction of the bend length (bigger = curvier) */
  bendAmpRatio: 0.045,
  bendMaxAmp: 60,
  /** tightest allowed curve radius (m) */
  bendMinRadius: 330,
} as const;

export const EVENTS = {
  barrierWarnDistance: 400,
  tollWarnDistance: 500,
  /** |speed| below this (m/s) counts as "stopped" */
  stopSpeed: 0.45,
  farmStopKmh: 5,
  /** set pieces further than this are hidden */
  visibleRange: 750,
  /** an active chase is forced to end (caught) this close to the next event */
  chaseCutoffBeforeEvent: 250,
} as const;

export const CHASE = {
  bikesMin: 2,
  bikesMax: 4,
  pickupChance: 0.5,
  chaserMaxKmh: 96,
  /** chasers far behind get a boost so they don't vanish */
  boostKmh: 108,
  boostGap: 220,
  spawnGap: 110,
  accel: 4.5,
  /** chaser front within this many metres of the truck's rear = caught */
  caughtGap: 4,
} as const;

export const TRAFFIC = {
  /** desired vehicles ahead (same direction / oncoming) per zone */
  density: {
    village: [0, 0],
    rural: [5, 6],
    town: [8, 7],
    river: [4, 5],
    city: [16, 12],
  } as Record<string, [number, number]>,
  spawnAheadMin: 300,
  spawnAheadMax: 480,
  despawnBehind: 70,
  /** closing speed (km/h) above which hitting a heavy vehicle head-on ends the game */
  headOnGameOverKmh: 90,
  overtakerChance: 0.18,
  /** horn taps a bus/truck needs before it gives way (or one long press) */
  heavyHonks: 3,
  /** seconds within which those taps must come */
  heavyHonkWindow: 6,
  /** seconds of continuous horn that count as a long press */
  longHornSeconds: 1.2,
} as const;

export const CAMERA = {
  distance: 13,
  height: 5.6,
  lookAhead: 9,
  lookHeight: 1.2,
  followLambda: 4,
  fovMin: 58,
  fovMax: 74,
  /** Portrait screens (phones): taller FOV and a higher, further camera so the road stays in view */
  portrait: {
    distance: 15,
    height: 7.2,
    lookAhead: 7,
    lookHeight: 0.6,
    fovMin: 82,
    fovMax: 94,
  },
} as const;

export const SLOW_ZONES = {
  bazarKmh: 40,
  schoolKmh: 30,
  marketKmh: 30,
  /** schools placed randomly on each route */
  schoolsMin: 2,
  schoolsMax: 3,
  /** km/h over the limit before the "slow down" warning fires */
  tolerance: 5,
} as const;

export const RAIL = {
  /** level crossings per route */
  perRouteMin: 1,
  perRouteMax: 2,
  /** chance a train is coming when you approach a crossing */
  trainChance: 0.8,
  /** the crossing decides (and closes) when the truck is this far away */
  triggerDistance: 450,
  /** m/s (~58 km/h) */
  trainSpeed: 16,
  /** how far down the line the train's nose starts when the gates close */
  trainStartGap: 330,
  coaches: 9,
  /** hitting a closed gate faster than this damages cargo */
  gateHitKmh: 20,
} as const;

export const WEATHER = {
  /** seconds a weather/time state lasts before drifting to the next one */
  holdMin: 60,
  holdMax: 120,
  /** seconds to blend between two states */
  blendSeconds: 25,
} as const;
