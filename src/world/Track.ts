// The road as a function of s (metres along the route): centreline x offset, elevation, width, zone.
// World mapping: point(s, d) = (centerX(s) + d, elevation(s), -s). d > 0 is the driver's right.
// Around every event the road is perfectly straight at x = 0, so set pieces need no rotation.

import * as THREE from 'three';
import { ROAD } from '../config/tuning';
import type { BridgeStyle, RouteDef } from '../config/route';
import { clamp, smoothstep } from '../utils/math';

export type ZoneKind = 'village' | 'rural' | 'town' | 'river' | 'city';

export interface BridgeSpan {
  start: number;
  end: number;
  style: BridgeStyle;
  nameBn: string;
}

export interface LateralLimit {
  from: number;
  to: number;
  /** allowed [min d, max d] at s */
  range: (s: number) => [number, number];
}

/** Areas where streamed scenery must not be placed (set pieces own them). */
export interface PropBlock {
  from: number;
  to: number;
  dMin: number;
  dMax: number;
}

const ORIGIN = -300;
const STEP = 2;

export class Track {
  readonly length: number;
  readonly bridges: BridgeSpan[] = [];
  readonly limits: LateralLimit[] = [];
  readonly propBlocks: PropBlock[] = [];
  private cx: Float32Array;
  private el: Float32Array;

  constructor(readonly route: RouteDef) {
    this.length = route.length;
    // Stretches that must be straight (along x = 0): the village, every set piece, bridges, the city
    const straight: [number, number][] = [[-1000, route.highwayStartS + 150]];
    for (const e of route.events) {
      if (e.type === 'farm') continue;
      let end = e.s + ROAD.straightAfter;
      if ((e.type === 'bridgeToll' || e.type === 'roadToll' || e.type === 'roadTax') && e.bridge) {
        const start = e.s + e.bridge.offset;
        this.bridges.push({ start, end: start + e.bridge.length, style: e.bridge.style, nameBn: e.bridge.nameBn });
        end = start + e.bridge.length + ROAD.bridgeRampLength + 60;
      }
      if (e.type === 'market') end = this.length + 2000;
      straight.push([e.s - ROAD.straightBefore, end]);
    }
    straight.push([route.cityStartS - 200, this.length + 2000]);
    straight.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const r of straight) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    // Every gap between straight stretches gets its own bends. The shape
    // A·sin²(πt)·sin(2πnt + φ) starts and ends with zero offset and zero angle, so it joins
    // the straight bits smoothly.
    const bends: { a: number; b: number; amp: number; n: number; phase: number }[] = [];
    for (let i = 0; i + 1 < merged.length; i++) {
      const a = merged[i][1];
      const b = merged[i + 1][0];
      const L = b - a;
      if (L < 150) continue;
      const n = Math.max(1, Math.round(L / ROAD.bendLength));
      const wl = L / n;
      // peak curvature of this shape is ≈ 59·amp / wl², keep the radius ≥ bendMinRadius
      const amp = Math.min(ROAD.bendMaxAmp, wl * ROAD.bendAmpRatio, (wl * wl) / (59 * ROAD.bendMinRadius)) * (i % 2 ? -1 : 1);
      bends.push({ a, b, amp, n, phase: (Math.sin(a * 12.9898) * 43758.5453) % Math.PI });
    }

    const n = Math.ceil((this.length + 1500 - ORIGIN) / STEP) + 1;
    this.cx = new Float32Array(n);
    this.el = new Float32Array(n);
    const ramp = ROAD.bridgeRampLength;
    for (let i = 0; i < n; i++) {
      const s = ORIGIN + i * STEP;
      let x = 0;
      for (const bd of bends) {
        if (s <= bd.a || s >= bd.b) continue;
        const t = (s - bd.a) / (bd.b - bd.a);
        const env = Math.sin(Math.PI * t);
        x = bd.amp * env * env * Math.sin(2 * Math.PI * bd.n * t + bd.phase);
        break;
      }
      this.cx[i] = x;
      let h = 0;
      for (const b of this.bridges) {
        if (s >= b.start - ramp && s <= b.end + ramp) {
          if (s < b.start) h = Math.max(h, smoothstep(b.start - ramp, b.start, s));
          else if (s > b.end) h = Math.max(h, 1 - smoothstep(b.end, b.end + ramp, s));
          else h = 1;
        }
      }
      this.el[i] = h * ROAD.bridgeDeckHeight;
    }
  }

  private sample(arr: Float32Array, s: number): number {
    const f = clamp((s - ORIGIN) / STEP, 0, arr.length - 1.001);
    const i = Math.floor(f);
    const t = f - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  }

  centerX(s: number): number {
    return this.sample(this.cx, s);
  }

  elevation(s: number): number {
    return this.sample(this.el, s);
  }

  /** Road surface height (what wheels touch). */
  surfaceY(s: number): number {
    return this.elevation(s) + ROAD.top;
  }

  /** Heading angle of the road (0 = straight toward -Z, positive = bending toward +X). */
  headingAt(s: number): number {
    return Math.atan2(this.centerX(s + 2) - this.centerX(s - 2), 4);
  }

  slopeAt(s: number): number {
    return (this.elevation(s + 2) - this.elevation(s - 2)) / 4;
  }

  halfWidth(s: number): number {
    const hs = this.route.highwayStartS;
    if (s < hs - 60) return ROAD.villageHalfWidth;
    if (s < hs) return ROAD.villageHalfWidth + (ROAD.highwayHalfWidth - ROAD.villageHalfWidth) * smoothstep(hs - 60, hs, s);
    return ROAD.highwayHalfWidth;
  }

  isVillage(s: number): boolean {
    return s < this.route.highwayStartS - 30;
  }

  bridgeAt(s: number): BridgeSpan | undefined {
    return this.bridges.find((b) => s >= b.start && s <= b.end);
  }

  isRiver(s: number, margin = 80): boolean {
    return this.bridges.some((b) => s >= b.start - margin && s <= b.end + margin);
  }

  zone(s: number): ZoneKind {
    if (s < this.route.highwayStartS) return 'village';
    if (this.isRiver(s)) return 'river';
    if (s >= this.route.cityStartS) return 'city';
    if (this.route.townZones.some(([a, b]) => s >= a && s <= b)) return 'town';
    return 'rural';
  }

  /** Allowed [min, max] lateral offset for the truck centre at s. */
  lateralRange(s: number): [number, number] {
    let limit: number;
    if (this.bridgeAt(s)) limit = this.halfWidth(s) + 1.0 - 1.35;
    else if (this.elevation(s) > 1.5) limit = this.halfWidth(s) + ROAD.shoulder - 0.8;
    else if (this.isVillage(s)) limit = this.halfWidth(s) + 5;
    else limit = ROAD.hardLimit;
    let lo = -limit;
    let hi = limit;
    for (const l of this.limits) {
      if (s >= l.from && s <= l.to) {
        const [a, b] = l.range(s);
        lo = Math.max(lo, a);
        hi = Math.min(hi, b);
      }
    }
    return [lo, hi];
  }

  isBlocked(s: number, d: number): boolean {
    for (const b of this.propBlocks) {
      if (s >= b.from && s <= b.to && d >= b.dMin && d <= b.dMax) return true;
    }
    return false;
  }

  point(s: number, d: number, out: THREE.Vector3, yOffset = 0): THREE.Vector3 {
    return out.set(this.centerX(s) + d, this.elevation(s) + yOffset, -s);
  }
}
