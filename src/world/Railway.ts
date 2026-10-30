// Railway lines beside the big bridges (Jamuna, Padma, and the old Hardinge Bridge next to Lalon Shah):
// ballast, sleepers and rails on an earth bank or a concrete viaduct, and passenger trains that run along
// them now and then, with a horn and the clatter of the wheels.

import * as THREE from 'three';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { smoothstep } from '../utils/math';

export type RailSupport = 'bank' | 'viaduct' | 'deck' | 'none';

export interface RailPath {
  from: number;
  to: number;
  /** world x of the line's centre at s */
  x(s: number): number;
  /** world y of the top of the ballast */
  y(s: number): number;
  /** what holds it up: an earth bank, a viaduct on piers, a bridge deck (rails only), or nothing drawn */
  support(s: number): RailSupport;
  /** centres of the tracks across the line (one track = [0]) */
  tracks: number[];
}

/**
 * Smooth steps through control points [u, value] (u ascending): constant before the first and after the
 * last, an S-curve between neighbours.
 */
export function ease(u: number, pts: [number, number][]): number {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [u1, v1] = pts[i];
    if (u <= u1) {
      const [u0, v0] = pts[i - 1];
      return v0 + (v1 - v0) * smoothstep(u0, u1, u);
    }
  }
  return pts[pts.length - 1][1];
}

const STEP = 5;
const SLEEPER_EVERY = 2.2;
const GAUGE = 1.5;
/** rail head above the ballast top (where the wheels run) */
const RAIL_TOP = 0.27;
const PIER_EVERY = 32;

const BALLAST = 0x7d7468;
const SLEEPER = 0x4a3a2c;
const RAIL = 0xa9a9a9;
const BANK = 0x8a7550;
const CONCRETE = 0xb9b3a6;

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** Euler (for Part.r) of something lying along (dx, dy, dz), level across. */
function along(dx: number, dy: number, dz: number): [number, number, number] {
  const h = Math.hypot(dx, dz);
  tmpE.set(Math.atan2(dy, h), Math.atan2(-dx, -dz), 0, 'YXZ');
  tmpQ.setFromEuler(tmpE);
  tmpE.setFromQuaternion(tmpQ, 'XYZ');
  return [tmpE.x, tmpE.y, tmpE.z];
}

export class RailLine {
  readonly mesh: THREE.Mesh;
  /** arc length along the line at every ARC_STEP of s */
  private arc: Float32Array;
  readonly length: number;

  constructor(readonly path: RailPath) {
    const { from, to } = path;
    const n = Math.ceil((to - from) / 2) + 1;
    this.arc = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      const s0 = from + (i - 1) * 2;
      const s1 = from + i * 2;
      this.arc[i] = this.arc[i - 1] + Math.hypot(path.x(s1) - path.x(s0), path.y(s1) - path.y(s0), 2);
    }
    this.length = this.arc[n - 1];
    this.mesh = new THREE.Mesh(buildColored(this.parts()), vertexColorMaterial());
    this.mesh.frustumCulled = false;
  }

  /** Arc length along the line at s. */
  arcAt(s: number): number {
    const f = Math.max(0, Math.min((s - this.path.from) / 2, this.arc.length - 1.001));
    const i = Math.floor(f);
    return this.arc[i] + (this.arc[i + 1] - this.arc[i]) * (f - i);
  }

  /** s at an arc length along the line. */
  sAt(a: number): number {
    let lo = 0;
    let hi = this.arc.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid] < a) lo = mid;
      else hi = mid;
    }
    const t = (a - this.arc[lo]) / Math.max(1e-6, this.arc[hi] - this.arc[lo]);
    return this.path.from + (lo + Math.max(0, Math.min(1, t))) * 2;
  }

  private parts(): Part[] {
    const p = this.path;
    const parts: Part[] = [];
    const spread = p.tracks.length > 1 ? Math.max(...p.tracks) - Math.min(...p.tracks) : 0;
    const width = 3.6 + spread;
    let nextSleeper = p.from;
    let nextPier = p.from + PIER_EVERY / 2;
    for (let s0 = p.from; s0 < p.to - 0.01; s0 += STEP) {
      const s1 = Math.min(p.to, s0 + STEP);
      const sm = (s0 + s1) / 2;
      const sup = p.support(sm);
      if (sup === 'none') {
        nextSleeper = s1;
        continue;
      }
      const x0 = p.x(s0);
      const x1 = p.x(s1);
      const y0 = p.y(s0);
      const y1 = p.y(s1);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dz = -(s1 - s0);
      const len = Math.hypot(dx, dy, dz) + 0.05;
      const r = along(dx, dy, dz);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // across the line (level), for the tracks' offsets
      const h = Math.hypot(dx, dz);
      const ax = -dz / h;
      const az = dx / h;
      parts.push({ geo: box(width, 0.45, len), color: BALLAST, p: [cx, cy - 0.22, -sm], r });
      for (const tk of p.tracks) {
        for (const g of [-GAUGE / 2, GAUGE / 2]) {
          const o = tk + g;
          parts.push({ geo: box(0.1, 0.15, len), color: RAIL, p: [cx + ax * o, cy + RAIL_TOP - 0.075, -sm + az * o], r });
        }
      }
      for (; nextSleeper < s1; nextSleeper += SLEEPER_EVERY) {
        const k = (nextSleeper - s0) / (s1 - s0);
        for (const tk of p.tracks) {
          parts.push({ geo: box(2.6, 0.14, 0.28), color: SLEEPER, p: [x0 + dx * k + ax * tk, y0 + dy * k + 0.05, -nextSleeper + az * tk], r });
        }
      }
      const under = cy - 0.45;
      if (sup === 'bank' && under > 0.1) {
        parts.push({ geo: box(width + 1.5 + under * 1.2, under, len), color: BANK, p: [cx, under / 2, -sm], r });
      } else if (sup === 'viaduct') {
        // box girder with low parapets, and a pier now and then
        parts.push({ geo: box(width + 0.6, 1.4, len), color: CONCRETE, p: [cx, cy - 1.15, -sm], r });
        for (const side of [-1, 1]) {
          const o = side * (width / 2 + 0.15);
          parts.push({ geo: box(0.25, 0.9, len), color: 0xd8d2c4, p: [cx + ax * o, cy + 0.2, -sm + az * o], r });
        }
        for (; nextPier < s1; nextPier += PIER_EVERY) {
          const k = (nextPier - s0) / (s1 - s0);
          const py = y0 + dy * k - 1.85;
          if (py < 1) continue;
          parts.push({ geo: box(2, py, 2), color: 0xc2bcae, p: [x0 + dx * k, py / 2, -nextPier], r: [0, r[1], 0] });
          parts.push({ geo: box(width + 1, 0.9, 2.4), color: 0xaaa497, p: [x0 + dx * k, py - 0.2, -nextPier], r: [0, r[1], 0] });
        }
      }
      if (sup !== 'viaduct') nextPier = s1 + PIER_EVERY / 2;
    }
    return parts;
  }
}

// ---------------------------------------------------------------- trains

const ENGINE_LEN = 17;
const COACH_LEN = 21;
const GAP = 1.2;

/** One car of a Bangladesh Railway passenger train, facing -Z, wheels on y = 0. */
function carGeometry(kind: 'engine' | 'coach' | 'coachRed'): THREE.BufferGeometry {
  return cached(`railcar:${kind}`, () => {
    const parts: Part[] = [];
    if (kind === 'engine') {
      // blue-red-yellow livery, like the level-crossing train
      const L = ENGINE_LEN;
      parts.push({ geo: box(3, 3.2, L), color: 0x1d4e89, p: [0, 2.4, 0] });
      parts.push({ geo: box(3.02, 0.5, L + 0.02), color: 0xe63946, p: [0, 1.5, 0] });
      parts.push({ geo: box(3.04, 0.25, L + 0.04), color: 0xffd166, p: [0, 3.3, 0] });
      parts.push({ geo: box(2.2, 1.0, 0.06), color: 0x22313f, p: [0, 3.0, -L / 2 - 0.01] });
      parts.push({ geo: box(0.5, 0.4, 0.1), color: 0xfff3b0, p: [0, 2.0, -L / 2 - 0.03] });
      parts.push({ geo: box(2.6, 0.6, L - 2), color: 0x163a66, p: [0, 4.2, 0] });
      for (let i = 0; i < 6; i++) parts.push({ geo: cyl(0.5, 0.5, 2.9, 10), color: 0x222222, p: [0, 0.55, -L / 2 + 2 + i * 2.6], r: [0, 0, Math.PI / 2] });
    } else {
      const L = COACH_LEN;
      parts.push({ geo: box(3, 3.1, L), color: kind === 'coachRed' ? 0x8b2e2e : 0x2f6b3a, p: [0, 2.35, 0] });
      parts.push({ geo: box(3.02, 0.18, L + 0.02), color: 0xffd166, p: [0, 1.6, 0] });
      parts.push({ geo: box(3.04, 0.7, L - 1), color: 0x1f2a30, p: [0, 2.7, 0] });
      parts.push({ geo: box(2.6, 0.3, L), color: 0x5a5a5a, p: [0, 4.05, 0] });
      for (const z of [-L / 2 + 3, L / 2 - 3]) parts.push({ geo: cyl(0.45, 0.45, 2.9, 8), color: 0x222222, p: [0, 0.5, z], r: [0, 0, Math.PI / 2] });
    }
    return buildColored(parts);
  });
}

interface Car {
  mesh: THREE.Mesh;
  /** distance from the train's nose to this car's centre */
  back: number;
}

/** A train running along a RailLine. Positions are arc lengths along the line. */
export class Train {
  readonly group = new THREE.Group();
  private cars: Car[] = [];
  readonly length: number;
  active = false;
  /** arc length of the nose */
  private head = 0;
  private dir: 1 | -1 = 1;
  private speed = 0;
  private horned = false;
  private clackTimer = 0;

  constructor(private line: RailLine, coaches: number) {
    const mat = vertexColorMaterial();
    let back = ENGINE_LEN / 2;
    for (let i = 0; i <= coaches; i++) {
      const kind = i === 0 ? 'engine' : i % 4 === 3 ? 'coachRed' : 'coach';
      const len = i === 0 ? ENGINE_LEN : COACH_LEN;
      if (i > 0) back += len / 2;
      const mesh = new THREE.Mesh(carGeometry(kind), mat);
      mesh.rotation.order = 'YXZ';
      mesh.visible = false;
      this.group.add(mesh);
      this.cars.push({ mesh, back });
      back += len / 2 + GAP;
    }
    this.length = back - GAP;
  }

  /** Start a run: nose at arc length `head`, going `dir` (1 = toward larger s). */
  run(head: number, dir: 1 | -1, speed: number): void {
    this.active = true;
    this.head = head;
    this.dir = dir;
    this.speed = speed;
    this.horned = false;
    this.clackTimer = 0;
  }

  /** Arc range [lo, hi] the train covers. */
  span(): [number, number] {
    const tail = this.head - this.dir * this.length;
    return [Math.min(this.head, tail), Math.max(this.head, tail)];
  }

  update(dt: number, game: Game): void {
    if (!this.active) return;
    const line = this.line;
    this.head += this.dir * this.speed * dt;
    const [lo, hi] = this.span();
    if (hi < 0 || lo > line.length) {
      this.active = false;
      for (const c of this.cars) c.mesh.visible = false;
      return;
    }
    const p = line.path;
    for (const c of this.cars) {
      const a = this.head - this.dir * c.back;
      const visible = a > 0 && a < line.length;
      c.mesh.visible = visible;
      if (!visible) continue;
      const s = line.sAt(a);
      const dx = (p.x(s + 1) - p.x(s - 1)) * this.dir;
      const dy = (p.y(s + 1) - p.y(s - 1)) * this.dir;
      const dz = -2 * this.dir;
      c.mesh.position.set(p.x(s), p.y(s) + RAIL_TOP, -s);
      c.mesh.rotation.set(Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0);
    }
    // horn as it comes up to the truck, wheels clattering while it's alongside
    const t = line.arcAt(game.truck.s);
    const gap = Math.max(0, lo - t, t - hi);
    if (!this.horned && gap < 320 && game.truck.s > p.from && game.truck.s < p.to) {
      this.horned = true;
      game.sound.trainHorn();
    }
    if (gap < 45) {
      this.clackTimer -= dt;
      if (this.clackTimer <= 0) {
        this.clackTimer = (COACH_LEN + GAP) / this.speed / 2;
        game.sound.clack();
      }
    }
  }
}
