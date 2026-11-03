// The three trucks you can pick on the title menu: the most common goods vehicles on Bangladeshi highways.
// Tata and Ashok Leyland build most of them; trucks, covered vans and pickups make up most commercial vehicle sales.
// Each one overrides a few TRUCK physics values (tuning.ts) and carries its own load, toll class and model layout.

import { ECONOMY, type FeeKey } from './economy';
import { TRUCK } from './tuning';

export type TruckId = 'open' | 'covered' | 'pickup';

type V3 = [number, number, number];

export interface TruckSpec {
  id: TruckId;
  nameBn: string;
  /** one line under the name on the menu */
  aboutBn: string;
  /** what's good and bad about it, shown on the menu */
  prosBn: string;
  capacityKg: number;
  /** Chanda at barriers scales with the vehicle: pickups get let off lighter. */
  chandaFactor: number;
  /** Legal tolls and road tax are charged by vehicle class (pickup = light, covered van and truck = medium/heavy). */
  feeFactor: number;
  /** a locked box body: jam thieves can't get at the sacks */
  theftProof: boolean;
  /** overrides for TRUCK in tuning.ts */
  physics: Partial<Pick<typeof TRUCK, 'length' | 'width' | 'maxSpeedKmh' | 'engineAccel' | 'loadAccelPenalty' | 'brakeDecel' | 'maxYawLow' | 'maxYawHigh'>>;
  /** driver's eye in truck-body space (right-hand drive) */
  eye: V3;
  /** tailpipe in the model's own space (EXHAUST.player.pipe for this truck) */
  pipe: V3;
  /** wheel centres (x, z) and radius, also used for the mud smears */
  wheels: [number, number][];
  wheelRadius: number;
}

export const TRUCKS: Record<TruckId, TruckSpec> = {
  // Tata SE 1613 / Ashok Leyland 1616 chassis with a locally built wooden body and full truck art: the
  // yellow "Bangla truck" with a wooden crown over the cab.
  open: {
    id: 'open',
    nameBn: 'খোলা ট্রাক',
    aboutBn: '১৬১৩ মডেলের কাঠের বডি, মাথায় মুকুট, গায়ে ট্রাক আর্ট',
    prosBn: 'মাল সবচেয়ে বেশি · ভারী, ধীরে টানে',
    capacityKg: 5_000,
    chandaFactor: 1,
    feeFactor: 1,
    theftProof: false,
    physics: {},
    eye: [0.5, 2.62, -2.2],
    pipe: [1.33, 3.65, -1.75],
    wheels: [[-1.08, -2.75], [1.08, -2.75], [-1.08, 2.2], [1.08, 2.2], [-1.08, 3.1], [1.08, 3.1]],
    wheelRadius: 0.52,
  },
  // A 12-tonne class cab-over (Tata LPT 1212 / Ashok Leyland Ecomet) with a steel box body and rear doors.
  covered: {
    id: 'covered',
    nameBn: 'কাভার্ড ভ্যান',
    aboutBn: 'স্টিলের বাক্স বডি, পেছনে তালা দেওয়া দরজা',
    prosBn: 'তালাবন্ধ — জ্যামে চুরি হয় না · মাল একটু কম',
    capacityKg: 4_000,
    chandaFactor: 1,
    feeFactor: 0.85,
    theftProof: true,
    physics: { length: 7.8, maxSpeedKmh: 115, engineAccel: 3.6 },
    eye: [0.55, 2.68, -3.15],
    pipe: [1.12, 3.75, -2.02],
    wheels: [[-1.05, -2.95], [1.05, -2.95], [-1.05, 2.3], [1.05, 2.3]],
    wheelRadius: 0.5,
  },
  // A one-tonne single-cab pickup (Mahindra Bolero / Tata Yodha class) with a steel rack over the bed.
  pickup: {
    id: 'pickup',
    nameBn: 'পিকআপ',
    aboutBn: 'এক কেবিনের পিকআপ, পেছনে লোহার খাঁচা',
    prosBn: 'দ্রুত, সহজে ঘোরে · চাঁদা-টোল কম · মাল অনেক কম',
    capacityKg: 1_800,
    chandaFactor: 0.5,
    feeFactor: 0.4,
    theftProof: false,
    physics: { length: 5.2, width: 1.9, engineAccel: 4.6, loadAccelPenalty: 0.2, brakeDecel: 10, maxYawLow: 0.95, maxYawHigh: 0.3 },
    eye: [0.42, 1.72, -0.45],
    pipe: [0.6, 0.38, 2.6],
    wheels: [[-0.8, -1.75], [0.8, -1.75], [-0.8, 1.55], [0.8, 1.55]],
    wheelRadius: 0.38,
  },
};

export const TRUCK_LIST: TruckSpec[] = [TRUCKS.open, TRUCKS.covered, TRUCKS.pickup];
export const DEFAULT_TRUCK: TruckId = 'open';

const BASE = { ...TRUCK };

/** A truck's top speed on the speedometer. */
export const topSpeedKmh = (t: TruckSpec): number => t.physics.maxSpeedKmh ?? BASE.maxSpeedKmh;

/** Most any truck can carry (for the worker's score ceiling). */
export const MAX_CAPACITY_KG = Math.max(...TRUCK_LIST.map((t) => t.capacityKg));
/** Fastest any truck can go (for the worker's minimum drive time). */
export const MAX_TRUCK_KMH = Math.max(...TRUCK_LIST.map(topSpeedKmh));
let active: TruckSpec = TRUCKS[DEFAULT_TRUCK];

/** The truck being driven this run. */
export function activeTruck(): TruckSpec {
  return active;
}

/** Switch trucks: TRUCK in tuning.ts takes this truck's physics, so every system that reads it follows. */
export function selectTruck(id: TruckId): TruckSpec {
  active = TRUCKS[id] ?? TRUCKS[DEFAULT_TRUCK];
  Object.assign(TRUCK, BASE, active.physics);
  return active;
}

export const isTruckId = (id: unknown): id is TruckId => typeof id === 'string' && id in TRUCKS;

/** A barrier's chanda for the truck being driven (rounded to ৳50). */
export const chandaFor = (base: number): number => Math.round((base * active.chandaFactor) / 50) * 50;

/** A legal toll or road tax for the truck being driven's vehicle class (rounded to ৳10). */
export const feeFor = (key: FeeKey): number => Math.round((ECONOMY.fees[key] * active.feeFactor) / 10) * 10;
