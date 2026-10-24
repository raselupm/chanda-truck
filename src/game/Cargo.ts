import { VEGETABLES, type VegId } from '../config/vegetables';

export interface CargoItem {
  veg: VegId;
  kgBought: number;
  kgLost: number;
  /** ৳ paid in total for this vegetable */
  purchaseValue: number;
}

export class Cargo {
  readonly items = new Map<VegId, CargoItem>();

  get totalKg(): number {
    let kg = 0;
    for (const it of this.items.values()) kg += it.kgBought - it.kgLost;
    return kg;
  }

  get boughtKg(): number {
    let kg = 0;
    for (const it of this.items.values()) kg += it.kgBought;
    return kg;
  }

  kgOf(veg: VegId): number {
    const it = this.items.get(veg);
    return it ? it.kgBought - it.kgLost : 0;
  }

  add(veg: VegId, kg: number, pricePerKg: number): void {
    let it = this.items.get(veg);
    if (!it) {
      it = { veg, kgBought: 0, kgLost: 0, purchaseValue: 0 };
      this.items.set(veg, it);
    }
    it.kgBought += kg;
    it.purchaseValue += kg * pricePerKg;
  }

  /** Average purchase price per kg of what's on the truck now. */
  avgPricePerKg(): number {
    let value = 0;
    let kg = 0;
    for (const it of this.items.values()) {
      const left = it.kgBought - it.kgLost;
      value += left * (it.purchaseValue / it.kgBought);
      kg += left;
    }
    return kg > 0 ? value / kg : 0;
  }

  /**
   * Remove kg spread proportionally across all vegetables.
   * Returns the purchase value of what was removed.
   */
  removeProportional(kg: number): { kg: number; value: number } {
    const total = this.totalKg;
    if (total <= 0 || kg <= 0) return { kg: 0, value: 0 };
    const take = Math.min(kg, total);
    let value = 0;
    for (const it of this.items.values()) {
      const left = it.kgBought - it.kgLost;
      const part = (left / total) * take;
      it.kgLost += part;
      value += part * (it.purchaseValue / it.kgBought);
    }
    return { kg: take, value };
  }

  /** Crate colours for the truck bed, proportional to what's loaded. */
  crateColors(count: number): number[] {
    const total = this.totalKg;
    const out: number[] = [];
    if (total <= 0) return out;
    for (const it of this.items.values()) {
      const n = Math.round(((it.kgBought - it.kgLost) / total) * count);
      for (let i = 0; i < n && out.length < count; i++) out.push(VEGETABLES[it.veg].color);
    }
    while (out.length < count && this.items.size) out.push(VEGETABLES[[...this.items.keys()][0]].color);
    return out;
  }
}
