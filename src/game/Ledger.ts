// Every taka that leaves the driver's pocket (or cargo taken in lieu of taka) is recorded here.
// The HUD and the result report derive all their numbers from these entries.

export type CostCategory = 'PURCHASE' | 'ROAD_TAX' | 'TOLL' | 'FINE' | 'CHANDA' | 'PENALTY' | 'CARGO_LOSS';

export const CATEGORY_BN: Record<CostCategory, string> = {
  PURCHASE: 'সবজি কেনা',
  ROAD_TAX: 'সড়ক কর',
  TOLL: 'সেতু টোল',
  FINE: 'ট্রাফিক জরিমানা',
  CHANDA: 'চাঁদা',
  PENALTY: 'জরিমানা চাঁদা',
  CARGO_LOSS: 'নষ্ট মাল',
};

export interface LedgerEntry {
  id: number;
  category: CostCategory;
  /** ৳ value. For non-cash entries: the purchase value of the cargo taken/lost. */
  amount: number;
  /** true = paid in cash; false = settled with cargo (value already counted in PURCHASE) */
  cash: boolean;
  /** kg of cargo involved (purchases, cargo taken, cargo lost) */
  kg: number;
  labelBn: string;
  locationBn: string;
  /** seconds since the run started */
  t: number;
}

export class Ledger {
  readonly entries: LedgerEntry[] = [];
  private nextId = 1;

  add(entry: Omit<LedgerEntry, 'id'>): LedgerEntry {
    const e = { ...entry, id: this.nextId++ };
    this.entries.push(e);
    return e;
  }

  sum(filter: { categories?: CostCategory[]; cash?: boolean } = {}): number {
    let total = 0;
    for (const e of this.entries) {
      if (filter.categories && !filter.categories.includes(e.category)) continue;
      if (filter.cash !== undefined && e.cash !== filter.cash) continue;
      total += e.amount;
    }
    return total;
  }

  kg(filter: { categories?: CostCategory[]; cash?: boolean } = {}): number {
    let total = 0;
    for (const e of this.entries) {
      if (filter.categories && !filter.categories.includes(e.category)) continue;
      if (filter.cash !== undefined && e.cash !== filter.cash) continue;
      total += e.kg;
    }
    return total;
  }

  /** Total cash that actually left the wallet. */
  cashSpent(): number {
    return this.sum({ cash: true });
  }

  /** Chanda + penalty chanda, cash and in kind. */
  extortionTotal(): number {
    return this.sum({ categories: ['CHANDA', 'PENALTY'] });
  }
}
