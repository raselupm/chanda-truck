// Turns the Ledger + Cargo into the numbers shown in the result report.

import { VEGETABLES, type VegId } from '../config/vegetables';
import type { Cargo } from './Cargo';
import type { Ledger } from './Ledger';

export type Outcome = 'arrived' | 'crash' | 'toll' | 'helper' | 'fall';

export interface RunStats {
  barriersBroken: number;
  barriersPaid: number;
  slowHits: number;
  chasesEscaped: number;
  chasesCaught: number;
  collisions: number;
  /** seconds on the highway */
  highwayTime: number;
}

export interface VegRow {
  veg: VegId;
  kgBought: number;
  kgDelivered: number;
  farmPrice: number;
  landedPerKg: number;
  marketPrice: number;
  diff: number;
}

export interface ResultData {
  outcome: Outcome;
  rows: VegRow[];
  /** breakdown that sums exactly to totalCash */
  breakdown: {
    purchaseDelivered: number;
    legal: number;
    chanda: number;
    penalty: number;
    cargoLoss: number;
  };
  purchase: number;
  totalCash: number;
  boughtKg: number;
  deliveredKg: number;
  avgFarmPerKg: number;
  landedPerKg: number;
  extortionPerKg: number;
  noExtortionPerKg: number;
  avgMarketPerKg: number;
  revenue: number;
  profit: number;
  extortionTotal: number;
  topVeg: VegId | null;
  stats: RunStats;
}

export function computeResults(ledger: Ledger, cargo: Cargo, stats: RunStats, outcome: Outcome): ResultData {
  const purchase = ledger.sum({ categories: ['PURCHASE'] });
  const totalCash = ledger.cashSpent();
  const inKind = ledger.sum({ cash: false });
  // legal: tolls, road tax and speed camera fines
  const legal = ledger.sum({ categories: ['TOLL', 'ROAD_TAX', 'FINE'] });
  const chanda = ledger.sum({ categories: ['CHANDA'] });
  const penalty = ledger.sum({ categories: ['PENALTY'] });
  const cargoLoss = ledger.sum({ categories: ['CARGO_LOSS'] });
  // A crash/seizure means nothing is delivered.
  const deliveredKg = outcome === 'arrived' ? cargo.totalKg : 0;
  const boughtKg = cargo.boughtKg;

  // Every non-purchase cash cost is allocated to vegetables by their share of the purchase value.
  const overheadCash = totalCash - purchase;
  const rows: VegRow[] = [];
  let revenue = 0;
  let topVeg: VegId | null = null;
  let topKg = -1;
  for (const it of cargo.items.values()) {
    const v = VEGETABLES[it.veg];
    const delivered = outcome === 'arrived' ? it.kgBought - it.kgLost : 0;
    const landedTotal = it.purchaseValue + (purchase > 0 ? (overheadCash * it.purchaseValue) / purchase : 0);
    const landedPerKg = delivered > 0 ? landedTotal / delivered : NaN;
    rows.push({
      veg: it.veg,
      kgBought: it.kgBought,
      kgDelivered: delivered,
      farmPrice: it.purchaseValue / it.kgBought,
      landedPerKg,
      marketPrice: v.karwanBazarPricePerKg,
      diff: v.karwanBazarPricePerKg - landedPerKg,
    });
    revenue += delivered * v.karwanBazarPricePerKg;
    if (it.kgBought > topKg) {
      topKg = it.kgBought;
      topVeg = it.veg;
    }
  }

  const extortionTotal = chanda + penalty;
  const extortionCash = ledger.sum({ categories: ['CHANDA', 'PENALTY'], cash: true });
  const extortionKg = ledger.kg({ categories: ['CHANDA', 'PENALTY'], cash: false });

  return {
    outcome,
    rows,
    // On a crash/seizure the cargo still on the truck is lost too.
    breakdown:
      outcome === 'arrived'
        ? { purchaseDelivered: purchase - inKind, legal, chanda, penalty, cargoLoss }
        : { purchaseDelivered: 0, legal, chanda, penalty, cargoLoss: cargoLoss + purchase - inKind },
    purchase,
    totalCash,
    boughtKg,
    deliveredKg,
    avgFarmPerKg: boughtKg > 0 ? purchase / boughtKg : 0,
    landedPerKg: deliveredKg > 0 ? totalCash / deliveredKg : NaN,
    extortionPerKg: deliveredKg > 0 ? extortionTotal / deliveredKg : NaN,
    // Without extortion: no chanda cash spent, and cargo taken as chanda would have been delivered.
    noExtortionPerKg:
      deliveredKg + extortionKg > 0 ? (totalCash - extortionCash) / (deliveredKg + extortionKg) : NaN,
    avgMarketPerKg: deliveredKg > 0 ? revenue / deliveredKg : 0,
    revenue,
    profit: revenue - totalCash,
    extortionTotal,
    topVeg,
    stats,
  };
}
