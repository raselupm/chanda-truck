// A village shortcut as a function of s, like the Track: its centreline is the highway's plus an offset.
// It bends off to the left of the highway, winds along beside it and bends back on. A right-side one
// crosses under the highway soon after the fork (the highway goes over it on a flyover), runs along the
// right past the barrier and crosses back under it, so it always rejoins from the left. The village road
// itself always stays on the ground.
// Lateral offsets (d) used with it are measured along x, like everywhere else.

import type { ShortcutDef } from '../config/route';
import { ROAD, SHORTCUT } from '../config/tuning';
import { clamp, smoothstep } from '../utils/math';
import type { Track } from './Track';

const STEP = 2;
/** where the shortcut and the highway's drivable strip still touch, the truck may pick either */
const MOUTH = ROAD.hardLimit + SHORTCUT.halfWidth + SHORTCUT.verge + 1;

/** 0 → 1 with zero slope and curvature at both ends */
function smoother(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export class Shortcut {
  readonly from: number;
  readonly to: number;
  /** s where it passes under the highway's flyovers (none for a left-side shortcut) */
  readonly crossings: number[];
  /** side it runs along past the barrier (-1 = left) */
  readonly side: -1 | 1;
  private off: Float32Array;

  constructor(def: ShortcutDef, private track: Track) {
    this.from = def.from;
    this.to = def.to;
    this.crossings = def.crossings;
    this.side = def.side;
    const L = this.to - this.from;
    const F = SHORTCUT.forkLength;
    const X = SHORTCUT.crossLength;
    const W = SHORTCUT.sideOffset;
    const cross = this.crossings.map((c) => c - this.from);
    // the long stretch past the barrier: after the first crossing, before the last one
    const a = cross.length ? cross[0] + X / 2 : F;
    const b = cross.length ? cross[cross.length - 1] - X / 2 : L - F;
    const n = Math.ceil(L / STEP) + 1;
    this.off = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = i * STEP;
      // off to the left, across under the highway and back if it crosses, back onto the highway
      let side = -1;
      let o: number | null = u < F ? -W * smoother(u / F) : null;
      for (const c of cross) {
        if (o !== null || u < c - X / 2) break;
        if (u < c + X / 2) o = side * W * (1 - 2 * smoother((u - (c - X / 2)) / X));
        else side = -side;
      }
      if (o === null) o = u < L - F ? side * W : side * W * (1 - smoother((u - (L - F)) / F));
      // village bends along the long stretch beside the highway
      const env = smoothstep(a, a + 150, u) * (1 - smoothstep(b - 160, b - 20, u));
      o += SHORTCUT.wiggleAmp * env * Math.sin((2 * Math.PI * (u - a)) / SHORTCUT.wiggleLength);
      this.off[i] = o;
    }
  }

  private sample(arr: Float32Array, s: number): number {
    if (s <= this.from || s >= this.to) return 0;
    const f = Math.min((s - this.from) / STEP, arr.length - 1.001);
    const i = Math.floor(f);
    const t = f - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  }

  contains(s: number): boolean {
    return s >= this.from && s <= this.to;
  }

  /** Centre of the shortcut relative to the highway's centreline. */
  offset(s: number): number {
    return this.sample(this.off, s);
  }

  centerX(s: number): number {
    return this.track.centerX(s) + this.offset(s);
  }

  /** Always on the ground (it's the highway that climbs over it). */
  elevation(_s: number): number {
    return 0;
  }

  surfaceY(_s: number): number {
    return ROAD.top;
  }

  headingAt(s: number): number {
    return Math.atan2(this.centerX(s + 2) - this.centerX(s - 2), 4);
  }

  slopeAt(_s: number): number {
    return 0;
  }

  /** Half the road's width along x (wider than SHORTCUT.halfWidth where it runs at an angle). */
  halfWidth(s: number): number {
    return SHORTCUT.halfWidth / Math.cos(this.headingAt(s));
  }

  /** The fork / join, where the truck may still choose between the shortcut and the highway. */
  inMouth(s: number): boolean {
    if (!this.contains(s) || Math.abs(this.offset(s)) > MOUTH) return false;
    return s - this.from < SHORTCUT.forkLength || this.to - s < SHORTCUT.forkLength;
  }
}
