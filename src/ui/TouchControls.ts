// On-screen controls: steering buttons on the left, pedals on the right, horn. Multi-touch safe.

import type { Input } from '../game/Input';
import { isTouchDevice } from '../utils/device';
import { el } from './dom';

type Key = keyof Input['touch'];

export class TouchControls {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement, private input: Input) {
    this.root = el('div', 'touch hidden', '', parent);
    const left = el('div', 'touch-left', '', this.root);
    const right = el('div', 'touch-right', '', this.root);
    this.pad(el('div', 'tbtn horn', '{horn}', left), 'horn');
    const steer = el('div', 'steer', '', left);
    this.pad(el('div', 'tbtn steer-btn', '{left}', steer), 'left');
    this.pad(el('div', 'tbtn steer-btn', '{right}', steer), 'right');
    this.pad(el('div', 'tbtn pedal brake', '<span>ব্রেক</span>', right), 'brake');
    this.pad(el('div', 'tbtn pedal gas', '<span>গ্যাস</span>', right), 'gas');
    if (!isTouchDevice) window.addEventListener('touchstart', () => this.enable(), { once: true });
  }

  private enabled = isTouchDevice;

  enable(): void {
    this.enabled = true;
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !(on && this.enabled));
    if (!on) for (const k of Object.keys(this.input.touch) as Key[]) this.input.touch[k] = false;
  }

  private pad(e: HTMLElement, key: Key): void {
    const pointers = new Set<number>();
    const sync = () => {
      this.input.touch[key] = pointers.size > 0;
      e.classList.toggle('down', pointers.size > 0);
    };
    e.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      pointers.add(ev.pointerId);
      e.setPointerCapture?.(ev.pointerId);
      sync();
    });
    const up = (ev: PointerEvent) => {
      pointers.delete(ev.pointerId);
      sync();
    };
    e.addEventListener('pointerup', up);
    e.addEventListener('pointercancel', up);
    e.addEventListener('lostpointercapture', up);
    e.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
}
