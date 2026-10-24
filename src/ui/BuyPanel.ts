// Farm purchase panel with live cost, cash-left and load bar that update on every change.

import { ECONOMY } from '../config/economy';
import type { FarmEvent } from '../config/route';
import { VEGETABLES, type VegId } from '../config/vegetables';
import type { Game } from '../game/Game';
import { formatBn, formatKg, formatTaka, formatTakaPerKg } from '../utils/bnNumber';
import { button, el, esc, setText } from './dom';
import { rich } from './icons';

interface Row {
  veg: VegId;
  kg: number;
  range: HTMLInputElement;
  kgEl: HTMLElement;
  sub: HTMLElement;
  minus: HTMLButtonElement;
  plus: HTMLButtonElement;
}

export class BuyPanel {
  private overlay: HTMLElement;
  private card: HTMLElement;
  private rows: Row[] = [];
  private farm: FarmEvent | null = null;
  private els!: {
    farmTotal: HTMLElement;
    spent: HTMLElement;
    cashLeft: HTMLElement;
    load: HTMLElement;
    loadFill: HTMLElement;
    road: HTMLElement;
    buy: HTMLButtonElement;
    go: HTMLButtonElement;
  };

  constructor(parent: HTMLElement, private game: Game) {
    this.overlay = el('div', 'modal-overlay hidden', '', parent);
    this.card = el('div', 'modal buy-panel', '', this.overlay);
  }

  get isOpen(): boolean {
    return !this.overlay.classList.contains('hidden');
  }

  open(farm: FarmEvent): void {
    this.farm = farm;
    this.rows = [];
    const c = this.card;
    c.innerHTML = '';
    el('div', 'bp-head', `<div class="bp-title">{farm} ${esc(farm.nameBn)}</div><div class="bp-quote">“${esc(farm.farmerLineBn)}”</div>`, c);
    const list = el('div', 'bp-rows', '', c);
    for (const vegId of farm.vegetables) {
      const v = VEGETABLES[vegId];
      const r = el('div', 'bp-row', '', list);
      el('div', 'bp-veg', `<span class="emo">${v.icon}</span><div><b>${v.nameBn}</b><small>${formatTakaPerKg(v.farmPricePerKg)}</small></div>`, r);
      const ctrl = el('div', 'bp-ctrl', '', r);
      const row = { veg: vegId, kg: 0 } as Row;
      row.minus = button('−', 'step', () => this.setKg(row, row.kg - ECONOMY.buyStepKg), ctrl);
      row.kgEl = el('div', 'bp-kg', '', ctrl);
      row.plus = button('+', 'step', () => this.setKg(row, row.kg + ECONOMY.buyStepKg), ctrl);
      row.range = el('input', 'bp-range', '', r);
      row.range.type = 'range';
      row.range.min = '0';
      row.range.step = String(ECONOMY.buyStepKg);
      row.range.addEventListener('input', () => this.setKg(row, Number(row.range.value)));
      row.sub = el('div', 'bp-sub', '', r);
      this.rows.push(row);
    }

    const sum = el('div', 'bp-summary', '', c);
    const line = (label: string, cls = '') => {
      const d = el('div', `bp-line ${cls}`, `<span>${label}</span>`, sum);
      return el('b', '', '', d);
    };
    const farmTotal = line('এই ক্ষেত থেকে');
    const spent = line('মোট সবজি কেনা');
    const cashLeft = line('নগদ বাকি থাকবে', 'big');
    const loadWrap = el('div', 'bp-load', '', sum);
    const load = el('div', 'bp-load-label', '', loadWrap);
    const bar = el('div', 'bar', '', loadWrap);
    const loadFill = el('div', 'fill', '', bar);
    const road = el('div', 'bp-road', '', sum);

    const btns = el('div', 'bp-buttons', '', c);
    button('বন্ধ করুন', 'btn btn-ghost', () => this.close(), btns);
    const buy = button('কিনে নিন {check}', 'btn btn-buy', () => this.commit(), btns);
    const go = button('কিনে রওনা দিন {truck}', 'btn btn-go', () => {
      this.commit();
      this.close();
      this.game.depart();
    }, btns);
    this.els = { farmTotal, spent, cashLeft, load, loadFill, road, buy, go };
    this.refresh();
    this.overlay.classList.remove('hidden');
  }

  private pendingTotal(except?: Row): { kg: number; cost: number } {
    let kg = 0;
    let cost = 0;
    for (const r of this.rows) {
      if (r === except) continue;
      kg += r.kg;
      cost += r.kg * VEGETABLES[r.veg].farmPricePerKg;
    }
    return { kg, cost };
  }

  private maxFor(row: Row): number {
    const g = this.game;
    const other = this.pendingTotal(row);
    const capLeft = ECONOMY.truckCapacityKg - g.cargo.totalKg - other.kg;
    const cashLeft = g.cash - other.cost;
    const byCash = cashLeft / VEGETABLES[row.veg].farmPricePerKg;
    const step = ECONOMY.buyStepKg;
    return Math.max(0, Math.floor(Math.min(capLeft, byCash) / step) * step);
  }

  private setKg(row: Row, kg: number): void {
    row.kg = Math.max(0, Math.min(this.maxFor(row), Math.round(kg / ECONOMY.buyStepKg) * ECONOMY.buyStepKg));
    this.refresh();
  }

  private refresh(): void {
    const g = this.game;
    for (const r of this.rows) {
      const max = this.maxFor(r);
      r.range.max = String(Math.max(max, ECONOMY.buyStepKg));
      r.range.value = String(r.kg);
      r.range.disabled = max <= 0;
      setText(r.kgEl, formatKg(r.kg));
      setText(r.sub, formatTaka(r.kg * VEGETABLES[r.veg].farmPricePerKg));
      r.minus.disabled = r.kg <= 0;
      r.plus.disabled = r.kg + ECONOMY.buyStepKg > max;
    }
    const p = this.pendingTotal();
    const purchased = g.ledger.sum({ categories: ['PURCHASE'] });
    const cashLeft = g.cash - p.cost;
    const loadKg = g.cargo.totalKg + p.kg;
    const e = this.els;
    setText(e.farmTotal, formatTaka(p.cost));
    setText(e.spent, formatTaka(purchased + p.cost));
    setText(e.cashLeft, formatTaka(cashLeft));
    setText(e.load, `ট্রাকের লোড: ${formatKg(loadKg)} / ${formatBn(ECONOMY.truckCapacityKg)}`);
    e.loadFill.style.width = `${(loadKg / ECONOMY.truckCapacityKg) * 100}%`;
    const road = g.estimatedRoadCost();
    e.road.innerHTML = rich(`{road} রাস্তার আনুমানিক খরচ: টোল ${formatTaka(road.legal)} + চাঁদা ${formatTaka(road.chanda)}`) +
      (cashLeft < road.legal + road.chanda ? ` <span class="warn-text">— নগদ কম পড়লে মাল দিয়ে দিতে হবে!</span>` : '');
    e.buy.disabled = p.kg <= 0;
    e.go.disabled = loadKg <= 0;
  }

  private commit(): void {
    if (!this.farm) return;
    for (const r of this.rows) {
      if (r.kg > 0) this.game.buy(r.veg, r.kg, this.farm.nameBn);
      r.kg = 0;
    }
    this.refresh();
  }

  /** Close without notifying the game (run restarted / went home). */
  hide(): void {
    this.overlay.classList.add('hidden');
    this.farm = null;
  }

  close(): void {
    this.overlay.classList.add('hidden');
    this.farm = null;
    this.game.onBuyPanelClosed();
  }
}
