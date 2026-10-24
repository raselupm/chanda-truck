// End-of-run report: where every taka went, per-vegetable costs and trip stats.
// Every number comes from ResultData (i.e. the Ledger).

import { VEGETABLES } from '../config/vegetables';
import type { ResultData } from '../game/Results';
import { formatBn, formatClock, formatKg, formatTaka } from '../utils/bnNumber';
import { button, el, esc } from './dom';
import { renderShareImage } from './ShareImage';

export const CATEGORY_COLORS = {
  purchaseDelivered: '#3f8f2a',
  legal: '#2f6fb2',
  chanda: '#c1121f',
  penalty: '#f77f00',
  cargoLoss: '#8d6e63',
} as const;

export const BREAKDOWN_LABELS: Record<keyof typeof CATEGORY_COLORS, string> = {
  purchaseDelivered: 'সবজি কেনা (পৌঁছানো মাল)',
  legal: 'বৈধ টোল ও সড়ক কর',
  chanda: 'চাঁদা',
  penalty: 'জরিমানা চাঁদা',
  cargoLoss: 'নষ্ট / হারানো মাল',
};

/** One plain line describing how the run ended. */
export function outcomeLine(r: ResultData): { icon: string; text: string } {
  if (r.outcome === 'crash') return { icon: '💥', text: 'সংঘর্ষে যাত্রা শেষ — মাল পৌঁছায়নি' };
  if (r.outcome === 'toll') return { icon: '🚨', text: 'টোল প্লাজায় ট্রাক জব্দ — মাল পৌঁছায়নি' };
  if (r.deliveredKg <= 0) return { icon: '📦', text: 'কাওরান বাজারে পৌঁছেছেন — কিন্তু ট্রাক খালি' };
  return { icon: '✅', text: `কাওরান বাজারে পৌঁছেছেন — ${formatKg(r.deliveredKg)} মাল ডেলিভারি` };
}

const perKg = (v: number) => (Number.isFinite(v) ? formatTaka(v, 2) : '—');

function breakdownHtml(r: ResultData): string {
  const keys = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[];
  const total = r.totalCash || 1;
  let x = 0;
  let segs = '';
  for (const k of keys) {
    const v = r.breakdown[k];
    if (v <= 0) continue;
    const w = (v / total) * 1000;
    segs += `<rect x="${x}" y="0" width="${Math.max(w - 2, 0)}" height="36" fill="${CATEGORY_COLORS[k]}"><title>${BREAKDOWN_LABELS[k]}: ${formatTaka(v)}</title></rect>`;
    x += w;
  }
  const rows = keys
    .map((k) => {
      const v = r.breakdown[k];
      return `<li><span class="sw" style="background:${CATEGORY_COLORS[k]}"></span><span>${BREAKDOWN_LABELS[k]}</span>
        <b>${formatTaka(v)}</b><span class="pct">${formatBn((v / total) * 100, 1)}%</span></li>`;
    })
    .join('');
  return `<svg viewBox="0 0 1000 36" preserveAspectRatio="none" class="rp-bar" role="img" aria-label="খরচের ভাগ">${segs}</svg>
    <ul class="rp-legend">${rows}<li class="sum"><span></span><span>মোট নগদ খরচ</span><b>${formatTaka(r.totalCash)}</b><span class="pct">১০০%</span></li></ul>`;
}

export class ResultReport {
  private overlay: HTMLElement;
  private card: HTMLElement;
  private last: ResultData | null = null;

  constructor(parent: HTMLElement, private handlers: { onReplay: () => void; onHome: () => void }) {
    this.overlay = el('div', 'rp-overlay hidden', '', parent);
    this.card = el('div', 'report', '', this.overlay);
  }

  hide(): void {
    this.overlay.classList.add('hidden');
  }

  show(r: ResultData): void {
    this.last = r;
    const arrived = r.outcome === 'arrived';
    const o = outcomeLine(r);
    const vegRows = r.rows
      .map((row) => {
        const v = VEGETABLES[row.veg];
        return `<tr><td>${v.emoji} ${v.nameBn}</td><td class="num">${formatBn(Math.round(row.kgBought))}</td>
          <td class="num">${formatBn(Math.round(row.kgDelivered))}</td><td class="num">${perKg(row.farmPrice)}</td>
          <td class="num">${perKg(row.landedPerKg)}</td><td class="num">${perKg(row.marketPrice)}</td>
          <td class="num ${row.diff >= 0 ? 'pos' : 'neg'}">${perKg(row.diff)}</td></tr>`;
      })
      .join('');
    const s = r.stats;
    const stat = (label: string, value: string, cls = '') => `<div class="${cls}"><small>${label}</small><b>${value}</b></div>`;

    this.card.innerHTML = `
      <h2 class="rp-title">📋 যাত্রার হিসাব</h2>
      <div class="rp-outcome ${arrived ? 'ok' : 'bad'}">${o.icon} ${esc(o.text)}</div>

      <div class="rp-keys">
        ${stat('ক্ষেতের গড় দাম', `${perKg(r.avgFarmPerKg)}/কেজি`)}
        ${stat('আপনার কেজিপ্রতি খরচ', arrived ? `${perKg(r.landedPerKg)}/কেজি` : '—')}
        ${stat('কেজিপ্রতি চাঁদার ভাগ', arrived ? `${perKg(r.extortionPerKg)}/কেজি` : '—', 'red')}
        ${stat('চাঁদা না থাকলে খরচ হতো', arrived ? `${perKg(r.noExtortionPerKg)}/কেজি` : '—', 'green')}
      </div>

      <section class="rp-section">
        <h3>খরচের ভাগ</h3>
        ${breakdownHtml(r)}
      </section>

      <section class="rp-section">
        <h3>সবজিভিত্তিক হিসাব</h3>
        <div class="rp-table-wrap"><table class="rp-table">
          <thead><tr><th>সবজি</th><th>কেনা (কেজি)</th><th>পৌঁছেছে (কেজি)</th><th>ক্ষেতে /কেজি</th><th>আপনার খরচ /কেজি</th><th>কাওরান বাজার /কেজি</th><th>ব্যবধান /কেজি</th></tr></thead>
          <tbody>${vegRows || '<tr><td colspan="7">কিছুই কেনা হয়নি</td></tr>'}</tbody>
        </table></div>
      </section>

      <section class="rp-section">
        <h3>যাত্রার পরিসংখ্যান</h3>
        <div class="rp-stats">
          ${stat('মোট চাঁদা (জরিমানাসহ)', formatTaka(r.extortionTotal))}
          ${stat('চাঁদা দেওয়া হয়েছে', `${formatBn(s.barriersPaid)} বার`)}
          ${stat('ব্যারিকেড ভাঙা', `${formatBn(s.barriersBroken)}টি`)}
          ${stat('ধাওয়া: পালানো / ধরা', `${formatBn(s.chasesEscaped)} / ${formatBn(s.chasesCaught)}`)}
          ${stat('সংঘর্ষ', `${formatBn(s.collisions)}টি`)}
          ${stat('মহাসড়কে সময়', formatClock(s.highwayTime))}
          ${arrived ? stat('বিক্রি (কাওরান বাজার দরে)', formatTaka(r.revenue)) : ''}
          ${stat(arrived ? 'লাভ / ক্ষতি' : 'মোট ক্ষতি', formatTaka(arrived ? r.profit : -r.totalCash), (arrived ? r.profit : -1) >= 0 ? 'pos' : 'neg')}
        </div>
      </section>

      <div class="rp-buttons"></div>`;
    const btns = this.card.querySelector('.rp-buttons') as HTMLElement;
    button('🔁 আবার চালান', 'btn btn-go', () => this.handlers.onReplay(), btns);
    button('🏠 হোম', 'btn btn-ghost', () => this.handlers.onHome(), btns);
    button('📤 শেয়ার করুন', 'btn btn-buy', () => void this.share(), btns);
    this.overlay.classList.remove('hidden');
    this.overlay.scrollTop = 0;
  }

  private async share(): Promise<void> {
    if (!this.last) return;
    const blob = await renderShareImage(this.last);
    if (!blob) return;
    const file = new File([blob], 'sobjir-truck-report.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'সবজির ট্রাক — যাত্রার হিসাব', text: outcomeLine(this.last).text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      /* share failed — fall back to download */
    }
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = 'sobjir-truck-report.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
