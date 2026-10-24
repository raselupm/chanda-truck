// Keyboard + touch input merged into one analog-ish driving state.

import { TRUCK } from '../config/tuning';

export type InputAction = 'horn' | 'camera' | 'mute' | 'pause' | 'confirm';

export interface DriveInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

export const NO_INPUT: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

export class Input implements DriveInput {
  throttle = 0;
  brake = 0;
  steer = 0;
  handbrake = false;
  horn = false;

  /** touch buttons write into this */
  readonly touch = { left: false, right: false, gas: false, brake: false, horn: false };

  private keys = new Set<string>();
  private listeners: Partial<Record<InputAction, (() => void)[]>> = {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (typing && !e.code.startsWith('Key')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'KeyH') this.emit('horn');
        if (e.code === 'KeyC') this.emit('camera');
        if (e.code === 'KeyM') this.emit('mute');
        if (e.code === 'KeyP' || e.code === 'Escape') this.emit('pause');
        if (e.code === 'Enter' || e.code === 'NumpadEnter') this.emit('confirm');
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  on(action: InputAction, fn: () => void): void {
    (this.listeners[action] ??= []).push(fn);
  }

  emit(action: InputAction): void {
    for (const fn of this.listeners[action] ?? []) fn();
  }

  private k(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  update(dt: number): void {
    const gas = this.k('KeyW', 'ArrowUp') || this.touch.gas;
    const brk = this.k('KeyS', 'ArrowDown') || this.touch.brake;
    const left = this.k('KeyA', 'ArrowLeft') || this.touch.left;
    const right = this.k('KeyD', 'ArrowRight') || this.touch.right;
    this.throttle = gas ? 1 : 0;
    this.brake = brk ? 1 : 0;
    this.handbrake = this.k('Space');
    this.horn = this.k('KeyH') || this.touch.horn;

    const target = (right ? 1 : 0) - (left ? 1 : 0);
    // Digital keys become a smooth steering value
    const rate = target === 0 || Math.sign(target) !== Math.sign(this.steer) ? TRUCK.steerReturn : TRUCK.steerRise;
    const delta = target - this.steer;
    const step = rate * dt;
    this.steer = Math.abs(delta) <= step ? target : this.steer + Math.sign(delta) * step;
  }
}
