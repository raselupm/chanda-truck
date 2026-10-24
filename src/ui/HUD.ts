// In-game DOM overlay: money, cargo, per-kg cost, speedometer, route progress, warnings, chase meter.

import { ECONOMY } from '../config/economy';
import type { RouteDef } from '../config/route';
import type { Game } from '../game/Game';
import { formatBn, formatDistance, formatKg, formatTaka, formatTakaPerKg, toBnDigits } from '../utils/bnNumber';
import { ChaseMeter } from './ChaseMeter';
import { button, el, setText } from './dom';

const SPEEDO_MAX = 120;

function speedoAngle(v: number): number {
  return 225 - (Math.min(v, SPEEDO_MAX) / SPEEDO_MAX) * 270;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function speedometerSvg(): string {
  const cx = 100;
  const cy = 100;
  let ticks = '';
  for (let v = 0; v <= SPEEDO_MAX; v += 10) {
    const a = speedoAngle(v);
    const major = v % 20 === 0;
    const [x0, y0] = polar(cx, cy, 84, a);
    const [x1, y1] = polar(cx, cy, major ? 70 : 76, a);
    ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="tick${v >= ECONOMY.ramSpeedKmh ? ' hot' : ''}"/>`;
    if (major) {
      const [lx, ly] = polar(cx, cy, 57, a);
      ticks += `<text x="${lx}" y="${ly}" class="lbl">${toBnDigits(v)}</text>`;
    }
  }
  const [mx, my] = polar(cx, cy, 92, speedoAngle(ECONOMY.tollMaxSpeedKmh));
  return `
  <svg viewBox="0 0 200 175" class="speedo-svg" aria-hidden="true">
    <circle cx="100" cy="100" r="94" class="face"/>
    <path d="${arcPath(cx, cy, 86, speedoAngle(ECONOMY.ramSpeedKmh), speedoAngle(SPEEDO_MAX))}" class="red-arc"/>
    ${ticks}
    <circle cx="${mx}" cy="${my}" r="6" class="toll-mark"/>
    <g class="needle"><line x1="100" y1="100" x2="100" y2="26"/><circle cx="100" cy="100" r="7"/></g>
    <text x="100" y="140" class="digital">০</text>
    <text x="100" y="158" class="unit">কিমি/ঘণ্টা</text>
  </svg>`;
}

const ICON: Record<string, string> = { farm: '{farm}', barrier: '{hand}', roadTax: '{receipt}', roadToll: '{receipt}', bridgeToll: '{bridge}', rail: '{train}', market: '{cart}' };

export class HUD {
  readonly root: HTMLDivElement;
  /** set every frame by toll plazas the truck is approaching */
  tollMode = false;
  private cash: HTMLElement;
  private kg: HTMLElement;
  private perKg: HTMLElement;
  private chanda: HTMLElement;
  private needle: SVGGElement;
  private digital: SVGTextElement;
  private speedo: HTMLElement;
  private progressBar: HTMLElement;
  private progressFill: HTMLElement;
  private progressTruck: HTMLElement;
  private progressIcons: { e: HTMLElement; s: number; id: string }[] = [];
  private next: HTMLElement;
  private warnEl: HTMLElement;
  private toastEl: HTMLElement;
  private floats: HTMLElement;
  private departBtn: HTMLButtonElement;
  private farmHint: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private weatherEl: HTMLElement;
  private limitBadge: HTMLElement;
  private chaseMeter: ChaseMeter;
  private warnTimer = 0;
  private toastTimer = 0;
  private lastPerKg = 0;
  private route: RouteDef | null = null;

  constructor(parent: HTMLElement, private game: Game) {
    this.root = el('div', 'hud hidden', '', parent);

    const stats = el('div', 'hud-stats', '', this.root);
    const row = (icon: string, label: string) => {
      const r = el('div', 'stat', `<span class="ic">${icon}</span><span class="lb">${label}</span>`, stats);
      return el('span', 'val', '', r);
    };
    this.cash = row('{money}', 'নগদ');
    this.kg = row('{box}', 'মাল');
    this.perKg = row('{scale}', 'কেজিপ্রতি খরচ');
    this.chanda = row('{hand}', 'চাঁদা মোট');

    const top = el('div', 'hud-top', '', this.root);
    this.progressBar = el('div', 'progress', '', top);
    this.progressFill = el('div', 'progress-fill', '', this.progressBar);
    this.progressTruck = el('div', 'progress-truck', '{truck}', this.progressBar);
    this.next = el('div', 'next-event', '', top);
    this.departBtn = button('শহরের দিকে রওনা {truck}', 'btn btn-go depart', () => game.depart(), top);
    this.farmHint = el('div', 'farm-hint', 'ক্ষেতের পাশের সবুজ জায়গায় থামুন — সবজি কিনুন', top);

    const btns = el('div', 'hud-buttons', '', this.root);
    this.weatherEl = el('div', 'weather-chip', '', btns);
    this.muteBtn = button(game.sound.muted ? '{mute}' : '{sound}', 'icon-btn', () => game.sound.toggleMute(), btns);
    this.muteBtn.title = 'শব্দ (M)';
    game.sound.onMuteChange((m) => setText(this.muteBtn, m ? '{mute}' : '{sound}'));
    button('{camera}', 'icon-btn', () => game.toggleCamera(), btns).title = 'ক্যামেরা (C)';
    button('{pause}', 'icon-btn', () => game.togglePause(), btns).title = 'বিরতি (P)';

    this.speedo = el('div', 'speedo', speedometerSvg(), this.root);
    this.limitBadge = el('div', 'limit-badge hidden', '', this.speedo);
    this.needle = this.speedo.querySelector('.needle') as SVGGElement;
    this.digital = this.speedo.querySelector('.digital') as SVGTextElement;

    this.chaseMeter = new ChaseMeter(this.root);
    this.warnEl = el('div', 'warn', '', this.root);
    this.toastEl = el('div', 'toast', '', this.root);
    this.floats = el('div', 'floats', '', this.root);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }

  setRoute(route: RouteDef): void {
    this.route = route;
    for (const p of this.progressIcons) p.e.remove();
    this.progressIcons = [];
    let farmShown = false;
    for (const e of route.events) {
      if (e.type === 'farm') {
        if (farmShown) continue;
        farmShown = true;
      }
      const icon = el('div', `p-icon p-${e.type}`, ICON[e.type] ?? e.icon, this.progressBar);
      icon.style.left = `${(e.s / route.length) * 100}%`;
      icon.title = e.nameBn;
      this.progressIcons.push({ e: icon, s: e.s, id: e.id });
    }
  }

  warn(text: string, kind: 'danger' | 'info' | 'good', seconds = 3): void {
    setText(this.warnEl, text);
    this.warnEl.className = `warn show ${kind}`;
    this.warnTimer = seconds;
  }

  toast(text: string, seconds = 2.5): void {
    setText(this.toastEl, text);
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  floatText(text: string, kind: 'bad' | 'good' | 'legal' = 'bad'): void {
    const f = el('div', `float ${kind}`, '', this.floats);
    setText(f, text);
    setTimeout(() => f.remove(), 2600);
  }

  update(dt: number): void {
    const g = this.game;
    const t = g.truck;
    const phase = g.state.phase;

    setText(this.cash, formatTaka(g.cash));
    setText(this.kg, `${formatKg(g.cargo.totalKg)} / ${formatBn(ECONOMY.truckCapacityKg)}`);
    const kgNow = g.cargo.totalKg;
    const perKg = kgNow > 0 ? g.ledger.cashSpent() / kgNow : 0;
    setText(this.perKg, kgNow > 0 ? formatTakaPerKg(perKg) : '—');
    if (perKg > this.lastPerKg + 0.004 && this.lastPerKg > 0) {
      this.perKg.parentElement!.classList.remove('bump');
      void this.perKg.offsetWidth;
      this.perKg.parentElement!.classList.add('bump');
    }
    this.lastPerKg = perKg;
    setText(this.chanda, formatTaka(g.ledger.extortionTotal()));

    // Speedometer
    const kmh = Math.abs(t.kmh);
    this.needle.setAttribute('transform', `rotate(${90 - speedoAngle(kmh)} 100 100)`);
    setText(this.digital, formatBn(Math.round(kmh)));
    this.speedo.classList.toggle('hot', kmh >= ECONOMY.ramSpeedKmh);
    this.speedo.classList.toggle('toll', this.tollMode);
    this.speedo.classList.toggle('over', this.tollMode && kmh > ECONOMY.tollMaxSpeedKmh);

    // Route progress
    if (this.route) {
      const frac = Math.min(1, Math.max(0, t.s / this.route.length));
      this.progressFill.style.width = `${frac * 100}%`;
      this.progressTruck.style.left = `${frac * 100}%`;
      for (const p of this.progressIcons) p.e.classList.toggle('done', p.s < t.s);
      const nextPiece = g.nextPieceAhead(t.frontS);
      if (nextPiece && phase === 'HIGHWAY') {
        const e = nextPiece.event;
        setText(this.next, `${ICON[e.type] ?? ''} ${e.nameBn} · ${formatDistance(nextPiece.s - t.frontS)}`);
      } else {
        setText(this.next, phase === 'FARM' ? '{farm} গ্রামের ক্ষেত — সবজি কিনুন' : '');
      }
    }

    const farm = phase === 'FARM';
    this.departBtn.classList.toggle('hidden', !farm || g.cargo.totalKg <= 0 || g.modal);
    this.farmHint.classList.toggle('hidden', !farm || g.cargo.totalKg > 0 || g.modal);

    this.chaseMeter.update(g.chase.active, g.chase.meter, g.chase.gap);
    setText(this.weatherEl, g.weather.label);
    const zone = g.slowZones.current;
    this.limitBadge.classList.toggle('hidden', !zone);
    if (zone) {
      setText(this.limitBadge, toBnDigits(zone.limitKmh));
      this.limitBadge.classList.toggle('over', kmh > zone.limitKmh + 5);
    }

    if (this.warnTimer > 0) {
      this.warnTimer -= dt;
      if (this.warnTimer <= 0) this.warnEl.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }
}
