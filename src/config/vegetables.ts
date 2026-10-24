// Vegetable catalogue.
// ⚠️ ALL PRICES BELOW ARE PLACEHOLDERS — adjust them to real farm-gate and Karwan Bazar wholesale
// prices (৳ per kg). The result screen derives everything from these numbers plus the Ledger.

export type VegId = 'tomato' | 'potato' | 'onion' | 'brinjal' | 'cauliflower' | 'cabbage' | 'chili' | 'gourd';

export interface Vegetable {
  id: VegId;
  nameBn: string;
  emoji: string;
  /** PLACEHOLDER — what the farmer receives, ৳/kg. */
  farmPricePerKg: number;
  /** PLACEHOLDER — Karwan Bazar wholesale price, ৳/kg. */
  karwanBazarPricePerKg: number;
  /** kg per crate/sack; only affects how many crates are drawn on the truck. */
  crateKg: number;
  /** produce colour for crates and crops */
  color: number;
}

export const VEGETABLES: Record<VegId, Vegetable> = {
  tomato:      { id: 'tomato',      nameBn: 'টমেটো',     emoji: '🍅', farmPricePerKg: 20, karwanBazarPricePerKg: 58,  crateKg: 25, color: 0xe03b2a },
  potato:      { id: 'potato',      nameBn: 'আলু',       emoji: '🥔', farmPricePerKg: 18, karwanBazarPricePerKg: 32,  crateKg: 50, color: 0xc9a46a },
  onion:       { id: 'onion',       nameBn: 'পেঁয়াজ',     emoji: '🧅', farmPricePerKg: 35, karwanBazarPricePerKg: 72,  crateKg: 40, color: 0xb5506b },
  brinjal:     { id: 'brinjal',     nameBn: 'বেগুন',      emoji: '🍆', farmPricePerKg: 22, karwanBazarPricePerKg: 60,  crateKg: 30, color: 0x5b2a6e },
  cauliflower: { id: 'cauliflower', nameBn: 'ফুলকপি',     emoji: '🥦', farmPricePerKg: 18, karwanBazarPricePerKg: 50,  crateKg: 30, color: 0xf1ead0 },
  cabbage:     { id: 'cabbage',     nameBn: 'বাঁধাকপি',    emoji: '🥬', farmPricePerKg: 12, karwanBazarPricePerKg: 38,  crateKg: 40, color: 0x9ccc65 },
  chili:       { id: 'chili',       nameBn: 'কাঁচা মরিচ',  emoji: '🌶️', farmPricePerKg: 40, karwanBazarPricePerKg: 110, crateKg: 20, color: 0x2e9e3a },
  gourd:       { id: 'gourd',       nameBn: 'লাউ',        emoji: '🥒', farmPricePerKg: 15, karwanBazarPricePerKg: 42,  crateKg: 40, color: 0x7cb342 },
};

export const VEG_LIST: readonly Vegetable[] = Object.values(VEGETABLES);
