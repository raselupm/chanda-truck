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

/** Physics of the truck being driven. selectTruck() (trucks.ts) overwrites some of these for the chosen truck. */
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
};

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
    // Shah Amanat (Karnaphuli): extradosed, tall enough for river ships
    shahAmanat: { deck: 12, ramp: 260 },
    meghnaGumti: { deck: 9, ramp: 210 },
    // plain concrete girder bridge over a smaller river (Sherpur, Shambhuganj)
    girder: { deck: 7, ramp: 180 },
    // Syed Nazrul Islam (Bhairab): box girder over the Meghna, two railway bridges beside it
    bhairab: { deck: 10, ramp: 220 },
    // Payra (Lebukhali): extradosed like Shah Amanat, high over the river
    payra: { deck: 12, ramp: 260 },
    meghna: { deck: 9, ramp: 210 },
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

/**
 * Village shortcuts: a 2-lane road that forks off to the left of the highway before a chanda barrier, winds
 * through the paddy fields and rejoins the highway past the barrier, always from the left. A left one stays
 * on the left; a right one passes under the highway soon after the fork (the highway climbs over it on a
 * flyover), runs along the right side past the barrier, then passes under it again to rejoin from the left.
 * Only rickshaws, CNGs and motorbikes use it. Distances are metres along the route (s).
 */
export const SHORTCUT = {
  perRoute: 2,
  /** chance a shortcut runs on the right side (under the highway's flyover) */
  rightChance: 0.5,
  /** fork this far before the barrier (further when it crosses the highway first), rejoin this far after it */
  forkBefore: 950,
  forkBeforeFlyover: 1400,
  joinAfter: 1100,
  joinAfterFlyover: 1270,
  /** a right one passes under the highway's flyovers this far past the fork, and this far past the barrier */
  crossAfterFork: 700,
  crossBackAfter: 550,
  /** speed limit on the village road */
  maxKmh: 70,
  /** how far beside the highway the village road runs (centre to centre) */
  sideOffset: 80,
  /** length of the bend off the highway (and back onto it) */
  forkLength: 450,
  /** length of the S-bend that takes it across the highway */
  crossLength: 440,
  /** 2 lanes; width across the road, not along x */
  halfWidth: 3.4,
  shoulder: 1,
  /** how far off the road the truck may wander (into the paddy, and the mud) */
  verge: 5,
  /** the extra bends on the long stretch beside the highway */
  wiggleAmp: 12,
  wiggleLength: 230,
  /** the highway's flyover: deck height, flat top either side of the crossing, ramp length */
  deck: 8.5,
  deckFlat: 50,
  ramp: 170,
  /** girder depth under the deck */
  girder: 1.6,
  /** vehicles wanted ahead on the shortcut (same direction / oncoming) */
  traffic: [4, 4] as [number, number],
} as const;

/**
 * The hill road (Rangamati → Chattogram): two lanes, tight bends, climbing and dipping. On each bend the
 * inside is a hillside, the outside a drop into the valley: run off the outside edge and the truck falls.
 */
export const HILL = {
  /** two lanes (along the road, not along x) */
  halfWidth: 3.5,
  shoulder: 1,
  /** bends: two waves on top of each other (metres) */
  bendAmp: [17, 20] as [number, number],
  bendLength: [190, 330] as [number, number],
  /** road height above the valley floor: base + two waves */
  baseHeight: 20,
  rise: [8, 4] as [number, number],
  riseLength: [1100, 450] as [number, number],
  /** how high the hillside on the inside of a bend rises above the road */
  wallHeight: 22,
  /** a bend this tight (1/m) or tighter has a full hillside on its inside */
  wallCurvature: 1 / 110,
  /** the outside drops at least this much: run past the edge there and you fall */
  fallDrop: 2.5,
  /** bends tighter than this radius (m) get a warning sign with a safe speed */
  sharpRadius: 80,
  /** traffic on the hill road goes no faster than this */
  trafficKmh: 40,
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
    hill: [3, 4],
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

/**
 * Engine sound from a recording (public/sounds): one file, played in parts (seconds into the file).
 * The file is cut down to just these parts: 0–20 s of the original, then its gear change (33–37 s).
 * Without the file the synthesised engine hum is used.
 */
export const ENGINE_SOUND = {
  url: '/sounds/truck-engine.m4a',
  start: [0, 4] as [number, number],
  idle: [4, 11] as [number, number],
  running: [13, 20] as [number, number],
  gearUp: [20, 24] as [number, number],
  /** shifting up past these speeds plays the gear change */
  gearKmh: [22, 42, 62, 82, 102],
  /** idle fades into the running sound between these speeds */
  idleToRunKmh: [3, 18] as [number, number],
  volume: 0.55,
} as const;

/** Recorded crash for the run-ending crashes (head-on, falling into the valley); others are synthesised. */
export const FINAL_CRASH_SOUND = { url: '/sounds/final-crash.m4a', volume: 0.9 } as const;

/**
 * Black exhaust smoke. pipe = tailpipe (the player's: top of the stack behind the cab) in the model's own space (models face -Z, so the rear is +z);
 * rate = puffs per second, size = puff width (m) as it leaves the pipe, alpha = how black it starts.
 * Pedal rickshaws have no engine, so no smoke.
 */
export const EXHAUST = {
  /** seconds a puff lasts */
  life: 1.7,
  /** a puff swells to this many times its size */
  swell: 4,
  /** only vehicles this close to the truck smoke */
  range: 170,
  player: {
    pipe: [1.33, 3.65, -1.75] as [number, number, number],
    rate: 7,
    size: 0.55,
    alpha: 0.4,
    /** flooring it from low speed: thick black clouds */
    accelRate: 26,
    accelSize: 0.9,
    accelAlpha: 0.5,
    /** seconds of heavy smoke when the engine starts */
    startKick: 1.6,
  },
  traffic: {
    bus: { pipe: [0.8, 0.45, 5.55], rate: 12, size: 0.75, alpha: 0.55 },
    truck: { pipe: [0.8, 0.45, 4.3], rate: 12, size: 0.75, alpha: 0.6 },
    car: { pipe: [0.55, 0.3, 2.25], rate: 4, size: 0.35, alpha: 0.3 },
    cng: { pipe: [0.35, 0.35, 1.35], rate: 7, size: 0.35, alpha: 0.45 },
    bike: { pipe: [0.22, 0.4, 0.95], rate: 5, size: 0.25, alpha: 0.38 },
    pickup: { pipe: [0.6, 0.35, 2.55], rate: 7, size: 0.45, alpha: 0.45 },
  },
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
  /** Driver's-seat view: [min, max] FOV, widening a little with speed */
  cockpit: {
    fov: [62, 68],
    portraitFov: [80, 86],
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

/** Passenger trains on the railways beside Jamuna and Padma bridges (world/Railway.ts). */
export const TRAINS = {
  /** m/s along the line (~72 km/h) */
  speed: 20,
  coaches: 8,
  /** chance a second train crosses the bridge alongside the truck */
  bridgeChance: 0.65,
} as const;

/** The old Hardinge railway bridge beside Lalon Shah Bridge: how far left, and its rail height. */
export const HARDINGE = { offset: -160, railY: 9 } as const;

/** Bhairab: the 2017 railway bridge and the old 1937 truss, left of the road bridge (x offsets, rail height) */
export const BHAIRAB_RAIL = { newX: -30, oldX: -58, railY: 8.5 } as const;

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

/** Broken stretches of road (ভাঙা রাস্তা), rural and in the city: the truck can't go faster than maxKmh. */
export const BROKEN_ROAD = {
  maxKmh: 70,
  /** m/s² the truck is slowed by when it drives onto a broken stretch too fast */
  slowDecel: 7,
  ruralMin: 3,
  ruralMax: 5,
  lenMin: 180,
  lenMax: 340,
  cityLenMin: 120,
  cityLenMax: 200,
} as const;

/** Queues of 5-6 vehicles at toll plazas: each pays at the booth, then drives off. */
export const TOLL_JAM = {
  vehiclesMin: 5,
  vehiclesMax: 6,
  /** the queue appears when the truck is this close to the booth */
  spawnDistance: 480,
  /** booths only start serving once the truck is this close (so you always end up in the queue) */
  serveFrom: 170,
  /** seconds each vehicle spends paying at the booth */
  serviceSeconds: 2.2,
} as const;

/** Village roadworks: our half is dug up, both directions share one lane, a flagman alternates them. */
export const ROADWORKS = {
  perRouteMin: 2,
  perRouteMax: 3,
  /** length of the closed stretch */
  length: 70,
  vehiclesMin: 5,
  vehiclesMax: 6,
  /** oncoming vehicles already waiting at the far flagman */
  oncomingMin: 4,
  oncomingMax: 6,
  spawnDistance: 480,
  /** both flagmen hold their side (red) until the truck is this close, then the cycle starts with the other side */
  cycleFrom: 220,
  greenSeconds: 9,
  redSeconds: 8,
  /** all-red gap between the two directions */
  clearSeconds: 4,
} as const;

/** City avenue: 4 + 4 lanes, but only the inner lane each way is open; the rest belongs to rickshaws, vans and hawkers. */
export const CITY = {
  lanesPerSide: 4,
  laneWidth: 3.5,
  /** open lanes per side (the rest is occupied) */
  openLanes: 1,
  /** four-way junctions, metres after the start of the avenue */
  junctions: [300, 850],
  /** the wide avenue ends this far before the market */
  wideEndBeforeMarket: 200,
} as const;

/** Four-way junctions with traffic lights in the city. */
export const JUNCTION = {
  greenSeconds: 7,
  yellowSeconds: 1.5,
  /** red for the main road (cross traffic goes) */
  redSeconds: 5,
  /** half width of the cross road */
  crossHalfWidth: 7,
} as const;

/** Thieves who grab vegetables off the truck while it crawls through a jam. */
export const THIEVES = {
  /** only while the truck is slower than this */
  maxKmh: 15,
  /** seconds between thieves */
  intervalMin: 2.5,
  intervalMax: 5,
  maxAtOnce: 3,
  kgMin: 8,
  kgMax: 22,
  /** seconds a thief needs at the truck to grab a sack */
  grabSeconds: 1.1,
  /** horn scares off thieves within this many metres */
  hornRange: 14,
} as const;

/** Driving on the grass beside the road: the wheels sink in the mud and two helpers have to push. */
export const MUD = {
  /** seconds of driving off the road before the truck is stuck */
  stuckAfter: 3,
  /** top speed while the helpers push it back to the road */
  pushKmh: 7,
  /** helpers' walking speed, m/s */
  walkSpeed: 3.2,
  /** stop within this many metres of the helpers (and below pickupKmh) to take them back on */
  pickupRange: 10,
  pickupKmh: 3,
  /** drive this far from the helpers and they are left behind: game over */
  forgetRange: 70,
  /** after leaving the mud, the tyres print mud on the road for this many seconds of driving */
  roadTrailSeconds: 2,
  /** a pair of tyre prints every this many metres */
  stainSpacing: 0.9,
  /** decals kept in the world (oldest are reused) */
  maxStains: 360,
} as const;
