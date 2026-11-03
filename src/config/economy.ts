// Money rules. All values in ৳ unless noted. Tune freely.

export const ECONOMY = {
  startingCash: 150_000,
  /** BuyPanel stepper increment */
  buyStepKg: 50,

  /**
   * Chanda at each randomly placed barrier: a random amount between min and max (rounded to step).
   * Later barriers on a route tend toward the top of the range.
   */
  randomChanda: { min: 1_000, max: 4_500, step: 500 },
  /** Hitting a barrier below ramSpeedKmh: you pay base × this (base logged as CHANDA, extra as PENALTY). */
  penaltyMultiplierSlowHit: 1.5,
  /** Caught by chasers: base × this. */
  caughtMultiplier: 2,

  /** Legal, unavoidable fees (PLACEHOLDERS). Keys are referenced from route.ts `feeKey`. */
  fees: {
    roadTax: 500,
    lalonToll: 600,
    natoreToll: 300,
    jamunaToll: 1_600,
    padmaToll: 2_800,
    expresswayToll: 900,
    shahAmanatToll: 250,
    meghnaGumtiToll: 650,
    sherpurToll: 250,
    bhairabToll: 500,
    shambhuganjToll: 200,
    payraToll: 400,
    meghnaToll: 650,
    mollahatToll: 100,
    madhumatiToll: 550,
    muktarpurToll: 400,
  },

  /** % of current cargo kg lost in each situation */
  cargoDamagePct: {
    ramMin: 1,
    ramMax: 2,
    slowHit: 1.5,
    caught: 2,
    /** rear-end: pct per km/h of relative speed, clamped */
    rearEndPerKmh: 0.05,
    rearEndMax: 4,
    sideSwipe: 0.5,
    headOnLight: 3,
  },

  /** Speed camera in a slow zone (bazaar, school, market): base + this much per km/h over the limit. PLACEHOLDERS. */
  speedFine: { base: 500, perKmhOver: 50 },

  ramSpeedKmh: 90,
  tollMaxSpeedKmh: 20,
  chaseRequiredSeconds: 10,
  /** 'reset' = dropping below ramSpeedKmh resets the chase meter to 0; 'pause' = it just stops filling */
  chaseMeterMode: 'reset' as 'reset' | 'pause',
} as const;

export type FeeKey = keyof typeof ECONOMY.fees;
