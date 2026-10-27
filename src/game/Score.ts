// Leaderboard points for one run, from its profit and highway drive time.
// Shared by the game (to show the points) and the API worker (which recomputes them, never trusting the client).

import { ECONOMY } from '../config/economy';
import { TRUCK, WORLD } from '../config/tuning';
import { VEG_LIST } from '../config/vegetables';

export const SCORE = {
  /** 1 point per this many ৳ of profit */
  takaPerPoint: 100,
  /** driving the highway at this average speedometer speed = ×1 */
  parKmh: 60,
  /** the speed multiplier is clamped to this range */
  minFactor: 0.5,
  maxFactor: 2,
} as const;

/** Real metres per second for a speedometer reading (the world runs faster than the speedometer). */
const worldMs = (kmh: number) => (kmh * WORLD.speedScale) / 3.6;

/** No arrival can be quicker than flat out at top speed the whole way (+10% slack). */
export function minDriveTime(distance: number): number {
  return distance / (worldMs(TRUCK.maxSpeedKmh) * 1.1);
}

export interface ScoreInput {
  arrived: boolean;
  /** ৳ */
  profit: number;
  /** seconds on the highway */
  driveTime: number;
  /** metres from the highway start to the market */
  distance: number;
}

export interface Score {
  points: number;
  /** points from profit alone */
  base: number;
  /** drive-time multiplier applied to base */
  speedFactor: number;
}

/** Highest profit any run can make: every taka (or kg of room) on the vegetable with the best margin. */
export function maxProfit(): number {
  let bestPerKg = 0;
  let bestPerTaka = 0;
  for (const v of VEG_LIST) {
    bestPerKg = Math.max(bestPerKg, v.karwanBazarPricePerKg - v.farmPricePerKg);
    bestPerTaka = Math.max(bestPerTaka, (v.karwanBazarPricePerKg - v.farmPricePerKg) / v.farmPricePerKg);
  }
  return Math.min(ECONOMY.truckCapacityKg * bestPerKg, ECONOMY.startingCash * bestPerTaka);
}

/** No delivery or no profit = 0 points. Otherwise profit/100, ×0.5–2 by how fast the highway was driven. */
export function computeScore(r: ScoreInput): Score {
  if (!r.arrived || r.profit <= 0 || r.driveTime <= 0 || r.distance <= 0) return { points: 0, base: 0, speedFactor: 1 };
  const parTime = r.distance / worldMs(SCORE.parKmh);
  const speedFactor = Math.min(SCORE.maxFactor, Math.max(SCORE.minFactor, parTime / r.driveTime));
  const base = r.profit / SCORE.takaPerPoint;
  return { points: Math.round(base * speedFactor), base: Math.round(base), speedFactor };
}
