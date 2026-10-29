// The road as a function of s (metres along the route): centreline x offset, elevation, width, zone.
// World mapping: point(s, d) = (centerX(s) + d, elevation(s), -s). d > 0 is the driver's right.
// Around every event the road is perfectly straight at x = 0, so set pieces need no rotation.

import * as THREE from 'three';
import { CITY, JUNCTION, ROAD, SHORTCUT } from '../config/tuning';
import type { BridgeStyle, RouteDef } from '../config/route';
import { clamp, smoothstep } from '../utils/math';
import { Shortcut } from './Shortcut';

export type ZoneKind = 'village' | 'rural' | 'town' | 'river' | 'city';

export interface BridgeSpan {
  start: number;
  end: number;
  /** road deck height and ramp length (from ROAD.bridgeStyles) */
  deck: number;
  ramp: number;
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
/** metres over which the road widens into / narrows out of the city avenue */
const WIDEN = 40;
const AVENUE_HW = CITY.lanesPerSide * CITY.laneWidth;
/** how far the truck centre may drift from the centreline on the avenue (open lanes + a little) */
const AVENUE_LIMIT = CITY.openLanes * CITY.laneWidth + 0.3 - 1.25;

export class Track {
  readonly length: number;
  readonly bridges: BridgeSpan[] = [];
  readonly limits: LateralLimit[] = [];
  readonly propBlocks: PropBlock[] = [];
  /** village roads round some of the barriers */
  readonly shortcuts: Shortcut[] = [];
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
        const st = ROAD.bridgeStyles[e.bridge.style];
        this.bridges.push({ start, end: start + e.bridge.length, style: e.bridge.style, nameBn: e.bridge.nameBn, deck: st.deck, ramp: st.ramp });
        end = start + e.bridge.length + st.ramp + 60;
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
        const ramp = b.ramp;
        if (s >= b.start - ramp && s <= b.end + ramp) {
          let k: number;
          if (s < b.start) k = smoothstep(b.start - ramp, b.start, s);
          else if (s > b.end) k = 1 - smoothstep(b.end, b.end + ramp, s);
          else k = 1;
          h = Math.max(h, k * b.deck);
        }
      }
      // the highway's flyovers over the village shortcuts
      for (const sc of route.shortcuts) {
        for (const c of sc.crossings) h = Math.max(h, SHORTCUT.deck * (1 - smoothstep(SHORTCUT.deckFlat, SHORTCUT.deckFlat + SHORTCUT.ramp, Math.abs(s - c))));
      }
      this.el[i] = h;
    }
    for (const def of route.shortcuts) this.shortcuts.push(new Shortcut(def, this));
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
    return ROAD.highwayHalfWidth + (AVENUE_HW - ROAD.highwayHalfWidth) * this.wideness(s);
  }

  /** 0 on the highway, 1 on the city avenue (smooth in between). */
  wideness(s: number): number {
    const w = this.route.wide;
    if (!w || s < w[0] - WIDEN || s > w[1] + WIDEN) return 0;
    return smoothstep(w[0] - WIDEN, w[0], s) * (1 - smoothstep(w[1], w[1] + WIDEN, s));
  }

  /** Fully on the 4 + 4 lane city avenue. */
  isWide(s: number): boolean {
    const w = this.route.wide;
    return !!w && s >= w[0] && s <= w[1];
  }

  /** Lane centre (always positive) for traffic: inner or outer lane; the avenue only has its inner lane open. */
  laneD(s: number, outer: boolean): number {
    if (this.wideness(s) > 0.5) return CITY.laneWidth / 2;
    return (outer ? 0.75 : 0.25) * ROAD.highwayHalfWidth;
  }

  /** Inside a city junction box (no lane markings there). */
  isJunction(s: number): boolean {
    return this.route.events.some((e) => e.type === 'junction' && Math.abs(s - e.s) < JUNCTION.crossHalfWidth + 1);
  }

  isBroken(s: number): boolean {
    return this.route.broken.some(([a, b]) => s >= a && s <= b);
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
    else if (this.isFlyover(s)) limit = this.halfWidth(s) + ROAD.shoulder - 1.35;
    else if (this.elevation(s) > 1.5) limit = this.halfWidth(s) + ROAD.shoulder - 0.8;
    else if (this.isVillage(s)) limit = this.halfWidth(s) + 5;
    else limit = ROAD.hardLimit;
    // City avenue: the occupied lanes squeeze everybody into the inner lanes
    const w = this.route.wide;
    if (w && s > w[0] - 60 && s < w[1] + 60) {
      const k = smoothstep(w[0] - 60, w[0] + 10, s) * (1 - smoothstep(w[1] - 10, w[1] + 60, s));
      limit = limit + (AVENUE_LIMIT - limit) * k;
    }
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
    return this.nearShortcut(s, d, 4);
  }

  /** Near the highway's flyover over a village shortcut (nothing tall may stand there). */
  nearFlyover(s: number, margin = 40): boolean {
    return this.shortcuts.some((sc) => sc.crossings.some((c) => Math.abs(s - c) < SHORTCUT.deckFlat + SHORTCUT.ramp + margin));
  }

  /** On the highway's flyover (deck or ramp, off the ground): parapets, no verge to drive on. */
  isFlyover(s: number): boolean {
    return this.elevation(s) > 0.3 && this.nearFlyover(s, 0);
  }

  shortcutAt(s: number): Shortcut | undefined {
    return this.shortcuts.find((sc) => sc.contains(s));
  }

  /** Is (s, d) on a village shortcut or within pad metres of its edge? */
  nearShortcut(s: number, d: number, pad: number): boolean {
    const sc = this.shortcutAt(s);
    return !!sc && Math.abs(d - sc.offset(s)) < sc.halfWidth(s) + pad;
  }

  point(s: number, d: number, out: THREE.Vector3, yOffset = 0): THREE.Vector3 {
    return out.set(this.centerX(s) + d, this.elevation(s) + yOffset, -s);
  }
}
