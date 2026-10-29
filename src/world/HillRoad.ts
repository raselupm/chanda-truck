// The hill road's signs and warnings: a sign where it starts, and before every sharp bend a warning with
// the speed it can be taken at. Coming at a bend too fast flashes a warning on the HUD.

import * as THREE from 'three';
import { HILL, ROAD, TRUCK } from '../config/tuning';
import type { Game } from '../game/Game';
import { toBnDigits } from '../utils/bnNumber';
import { clamp, lerp } from '../utils/math';
import { signTexture, speedSignTexture } from '../utils/textures';
import { signPost } from './SetPiece';
import type { Track } from './Track';

interface Bend {
  /** s of the tightest point */
  s: number;
  /** 1 = bending right, -1 = left */
  dir: -1 | 1;
  safeKmh: number;
}

/**
 * Fastest speed (km/h, rounded down to 5) at which the truck can still steer round a bend of this radius,
 * from its steering limits (TruckController: yaw rate falls with speed), with a little to spare.
 */
export function safeKmh(radius: number): number {
  for (let kmh = 120; kmh > 15; kmh -= 5) {
    const v = kmh / 3.6;
    const yaw = lerp(TRUCK.maxYawLow, TRUCK.maxYawHigh, clamp(kmh / 100, 0, 1)) * Math.min(1, v / 4);
    if (yaw >= (1.25 * v) / radius) return kmh;
  }
  return 15;
}

export class HillRoad {
  readonly group = new THREE.Group();
  private bends: Bend[] = [];
  private welcomed = false;
  private warnCooldown = 0;

  constructor(private game: Game) {}

  build(track: Track): void {
    for (const c of [...this.group.children]) this.group.remove(c);
    this.bends = [];
    this.welcomed = false;
    const h = track.route.hills;
    if (!h) return;
    // the tightest point of every sharp bend
    let best: Bend | null = null;
    let bestC = 0;
    for (let s = h.from + 150; s < h.to - 150; s += 4) {
      const c = track.curvature(s);
      if (Math.abs(c) > 1 / HILL.sharpRadius) {
        if (Math.abs(c) > bestC) {
          bestC = Math.abs(c);
          best = { s, dir: c > 0 ? 1 : -1, safeKmh: safeKmh(1 / Math.abs(c)) };
        }
      } else if (best) {
        this.bends.push(best);
        best = null;
        bestC = 0;
      }
    }
    if (best) this.bends.push(best);

    const put = (g: THREE.Group, s: number, side: number) => {
      const d = side * (track.halfWidth(s) + HILL.shoulder - 0.3);
      track.point(s, d, g.position, ROAD.top);
      g.rotation.y = -side * 0.3 - track.headingAt(s);
      this.group.add(g);
    };
    put(signPost(signTexture(['{warning} পাহাড়ি রাস্তা', 'বাঁকে গতি কমান, খাদে পড়বেন না!'], { bg: '#ffd23f', fg: '#1d1d1d', border: '#c1121f', sizes: [56, 38] }), 3, 1.5, 2.4), h.from - 80, -1);
    // the warning stands on the inside of the bend, where the hillside is
    for (const b of this.bends) {
      const at = b.s - 70;
      const g = new THREE.Group();
      const warn = signPost(signTexture([b.dir < 0 ? '↰ তীক্ষ্ণ বাঁক' : 'তীক্ষ্ণ বাঁক ↱', 'ধীরে চলুন'], { bg: '#ffd23f', fg: '#1d1d1d', border: '#c1121f', sizes: [58, 42] }), 2.4, 1.2, 2.2);
      const limit = signPost(speedSignTexture(b.safeKmh), 1, 1, 2.2);
      // the speed limit comes first, a few metres before the warning
      limit.position.z = 5;
      g.add(warn, limit);
      put(g, at, b.dir);
    }
  }

  update(dt: number): void {
    const g = this.game;
    const t = g.truck;
    const h = g.track.route.hills;
    if (!h || g.state.phase !== 'HIGHWAY') return;
    if (!this.welcomed && t.frontS > h.from - 300 && t.frontS < h.to) {
      this.welcomed = true;
      g.hud.warn('{warning} পাহাড়ি রাস্তা শুরু — বাঁকে গতি কমান, নইলে ট্রাক খাদে পড়বে!', 'danger', 4.5);
    }
    this.warnCooldown -= dt;
    if (this.warnCooldown > 0) return;
    const next = this.bends.find((b) => b.s > t.frontS && b.s - t.frontS < 150);
    if (next && t.kmh > next.safeKmh + 8) {
      this.warnCooldown = 5;
      g.hud.warn(`{warning} সামনে তীক্ষ্ণ বাঁক — ${toBnDigits(next.safeKmh)} কিমি/ঘণ্টার নিচে নামান!`, 'danger', 2.5);
      g.sound.beep();
    }
  }
}
