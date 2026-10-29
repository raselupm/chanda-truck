// A charge on the driver: chanda, a toll or a fine. Game.charge() takes it right away (cash first, then cargo).

import type { CostCategory } from './Ledger';

export interface ChargeLine {
  category: Exclude<CostCategory, 'PURCHASE' | 'CARGO_LOSS'>;
  amount: number;
  labelBn: string;
}

export interface PaymentRequest {
  kind: 'chanda' | 'toll';
  /** short name for the HUD message, e.g. "চাঁদা" or the toll plaza's name */
  titleBn: string;
  /** the collector's line, shown as a toast ('' for none) */
  messageBn: string;
  lines: ChargeLine[];
  locationBn: string;
  onPaid?: () => void;
}
