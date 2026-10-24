// Shared modal for any payment. ChandaDialog and TollDialog give it their own look and wording.

import type { CostCategory } from '../game/Ledger';
import { formatKg, formatTaka } from '../utils/bnNumber';
import { button, el, esc } from './dom';

export interface ChargeLine {
  category: Exclude<CostCategory, 'PURCHASE' | 'CARGO_LOSS'>;
  amount: number;
  labelBn: string;
}

export interface PaymentRequest {
  kind: 'chanda' | 'toll';
  titleBn: string;
  messageBn: string;
  lines: ChargeLine[];
  locationBn: string;
  onPaid?: () => void;
}

export interface ChargePreview {
  total: number;
  cashPart: number;
  kgTaken: number;
  cashBefore: number;
}

export interface DialogTheme {
  className: string;
  icon: string;
  receiptBn: string;
  payLabel: (amount: string) => string;
  inKindNote: (cash: string, kg: string) => string;
}

export class PaymentDialog {
  private overlay: HTMLElement;
  private card: HTMLElement;
  private onPay: (() => void) | null = null;

  constructor(parent: HTMLElement, private theme: DialogTheme) {
    this.overlay = el('div', 'modal-overlay hidden', '', parent);
    this.card = el('div', `modal pay-dialog ${theme.className}`, '', this.overlay);
  }

  get isOpen(): boolean {
    return !this.overlay.classList.contains('hidden');
  }

  show(req: PaymentRequest, preview: ChargePreview, onPay: () => void): void {
    this.onPay = onPay;
    const t = this.theme;
    const lines = req.lines
      .map((l) => `<tr><td>${esc(l.labelBn)}</td><td class="num">${formatTaka(l.amount)}</td></tr>`)
      .join('');
    const short = preview.cashPart < preview.total;
    this.card.innerHTML = `
      <div class="pd-head"><span class="pd-icon">${t.icon}</span><div>
        <div class="pd-title">${esc(req.titleBn)}</div>
        <div class="pd-loc">📍 ${esc(req.locationBn)}</div></div></div>
      <div class="pd-msg">“${esc(req.messageBn)}”</div>
      <table class="pd-lines">${lines}
        <tr class="total"><td>মোট</td><td class="num">${formatTaka(preview.total)}</td></tr></table>
      <div class="pd-cash">আপনার নগদ: <b>${formatTaka(preview.cashBefore)}</b></div>
      ${short ? `<div class="pd-inkind">⚠️ ${t.inKindNote(formatTaka(preview.cashPart), formatKg(preview.kgTaken))}</div>` : ''}
      <div class="pd-receipt">${esc(t.receiptBn)}</div>`;
    const pay = button(t.payLabel(formatTaka(preview.total)), 'btn btn-pay', () => this.pay(), this.card);
    this.overlay.classList.remove('hidden');
    setTimeout(() => pay.focus(), 50);
  }

  /** Close without paying (run restarted / went home). */
  hide(): void {
    this.onPay = null;
    this.overlay.classList.add('hidden');
  }

  /** Enter key / button */
  pay(): void {
    if (!this.isOpen || !this.onPay) return;
    const fn = this.onPay;
    this.onPay = null;
    this.overlay.classList.add('hidden');
    fn();
  }
}
