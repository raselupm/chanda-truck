// Circular chase timer: fills only while the truck holds ≥ 90 km/h.

import { ECONOMY } from '../config/economy';
import { formatBn, formatDistance } from '../utils/bnNumber';
import { el, setText } from './dom';

const R = 42;
const CIRC = 2 * Math.PI * R;

export class ChaseMeter {
  private root: HTMLElement;
  private ring: SVGCircleElement;
  private secs: HTMLElement;
  private dist: HTMLElement;
  private hint: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'chase hidden', '', parent);
    this.root.innerHTML = `
      <div class="chase-title">🏍️ ধাওয়া!</div>
      <div class="chase-ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="${R}" class="bg"/>
          <circle cx="50" cy="50" r="${R}" class="fg" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" transform="rotate(-90 50 50)"/>
        </svg>
        <div class="chase-secs"></div>
      </div>
      <div class="chase-dist"></div>
      <div class="chase-hint"></div>`;
    this.ring = this.root.querySelector('.fg') as SVGCircleElement;
    this.secs = this.root.querySelector('.chase-secs') as HTMLElement;
    this.dist = this.root.querySelector('.chase-dist') as HTMLElement;
    this.hint = this.root.querySelector('.chase-hint') as HTMLElement;
  }

  update(active: boolean, meter: number, gap: number): void {
    this.root.classList.toggle('hidden', !active);
    if (!active) return;
    const need = ECONOMY.chaseRequiredSeconds;
    const frac = Math.min(1, meter / need);
    this.ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - frac)));
    setText(this.secs, `${formatBn(Math.ceil(need - meter))}`);
    setText(this.dist, Number.isFinite(gap) ? `পিছনে: ${formatDistance(Math.max(0, gap))}` : '');
    const filling = meter > 0;
    setText(this.hint, filling ? 'গতি ধরে রাখুন!' : `${formatBn(ECONOMY.ramSpeedKmh)}+ গতিতে উঠুন!`);
    this.root.classList.toggle('filling', filling);
    this.root.classList.toggle('close', gap < 40);
  }
}
