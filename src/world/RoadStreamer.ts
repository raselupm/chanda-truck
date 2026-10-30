// Streams road chunks ahead of the truck and recycles the ones behind.

import * as THREE from 'three';
import { HILL, ROAD, SHORTCUT } from '../config/tuning';
import { hash2, mulberry32 } from '../utils/rng';
import type { Track } from './Track';

const C = {
  asphalt: new THREE.Color(0x4b4a4f),
  asphaltPatch: new THREE.Color(0x5a5752),
  dirt: new THREE.Color(0xa47b4c),
  dirtDark: new THREE.Color(0x8f6a40),
  shoulder: new THREE.Color(0x9b8a68),
  embank: new THREE.Color(0x7d6a42),
  bridgeSide: new THREE.Color(0xbdb6a8),
  bridgeUnder: new THREE.Color(0x8a857b),
  white: new THREE.Color(0xecebe4),
  yellow: new THREE.Color(0xe8c02e),
  // broken road: crumbling asphalt, gravel, potholes and muddy puddles
  crumble: new THREE.Color(0x5b554d),
  gravel: new THREE.Color(0x7a6e5e),
  pothole: new THREE.Color(0x2b2622),
  puddle: new THREE.Color(0x4f4434),
  // flyover over a village shortcut
  concrete: new THREE.Color(0xbdb6a8),
  parapetTop: new THREE.Color(0xd8d2c4),
  // hill road: earth cuttings, grassy hilltops, the slope down into the valley
  cutting: new THREE.Color(0x9a7b4f),
  hilltop: new THREE.Color(0x4f7a34),
  hillDark: new THREE.Color(0x3f6a2c),
  valley: new THREE.Color(0x6f7a3c),
};

/** a hillside's flat top and its back slope down to the valley floor (as in Track.hillGround) */
const HILL_TOP = 30;
const HILL_BACK = 25;

const PARAPET_H = 0.9;
const PARAPET_W = 0.3;

/** Builds road quads along any centreline that is a function of s (the highway, a village shortcut). */
export class StripBuilder {
  pos: number[] = [];
  col: number[] = [];
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(private track: Pick<Track, 'centerX' | 'elevation'>) {}

  /** Quad between (s0,d0)-(s0,d1)-(s1,d1)-(s1,d0); y given relative to elevation unless abs is set. */
  quad(
    s0: number, s1: number,
    d00: number, d01: number, d10: number, d11: number,
    y00: number, y01: number, y10: number, y11: number,
    color: THREE.Color, absY = false,
  ): void {
    const t = this.track;
    const e0 = absY ? 0 : t.elevation(s0);
    const e1 = absY ? 0 : t.elevation(s1);
    const cx0 = t.centerX(s0);
    const cx1 = t.centerX(s1);
    this.a.set(cx0 + d00, e0 + y00, -s0);
    this.b.set(cx0 + d01, e0 + y01, -s0);
    this.c.set(cx1 + d11, e1 + y11, -s1);
    this.d.set(cx1 + d10, e1 + y10, -s1);
    for (const v of [this.a, this.b, this.c, this.a, this.c, this.d]) {
      this.pos.push(v.x, v.y, v.z);
      this.col.push(color.r, color.g, color.b);
    }
  }

  /** Flat strip at constant lateral offsets. */
  strip(s0: number, s1: number, d0: number, d1: number, y: number, color: THREE.Color): void {
    this.quad(s0, s1, d0, d1, d0, d1, y, y, y, y, color);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

export class RoadStreamer {
  readonly group = new THREE.Group();
  private chunks = new Map<number, THREE.Mesh>();
  private material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private first = 0;
  private last = -1;

  constructor(private track: Track) {}

  setTrack(track: Track): void {
    for (const m of this.chunks.values()) {
      m.geometry.dispose();
      this.group.remove(m);
    }
    this.chunks.clear();
    this.track = track;
    this.first = 0;
    this.last = -1;
  }

  /** Returns true when the visible chunk window changed (scenery should rebuild). */
  update(s: number): boolean {
    const L = ROAD.chunkLength;
    const first = Math.floor(s / L) - ROAD.chunksBehind;
    const last = Math.min(Math.floor(s / L) + ROAD.chunksAhead, Math.ceil((this.track.length + 400) / L));
    if (first === this.first && last === this.last) return false;
    this.first = first;
    this.last = last;
    for (const [c, m] of this.chunks) {
      if (c < first || c > last) {
        m.geometry.dispose();
        this.group.remove(m);
        this.chunks.delete(c);
      }
    }
    for (let c = first; c <= last; c++) {
      if (this.chunks.has(c)) continue;
      const m = new THREE.Mesh(this.buildChunk(c), this.material);
      m.matrixAutoUpdate = false;
      this.chunks.set(c, m);
      this.group.add(m);
    }
    return true;
  }

  get window(): [number, number] {
    return [this.first, this.last];
  }

  private buildChunk(c: number): THREE.BufferGeometry {
    const t = this.track;
    const L = ROAD.chunkLength;
    const step = ROAD.sampleStep;
    const sb = new StripBuilder(t);
    const rng = mulberry32(hash2(c, 991));
    const top = ROAD.top;
    const tmp = new THREE.Color();

    for (let s0 = c * L; s0 < (c + 1) * L - 0.01; s0 += step) {
      const s1 = s0 + step;
      const sm = (s0 + s1) / 2;
      const hw0 = t.halfWidth(s0);
      const hw1 = t.halfWidth(s1);
      const village = t.isVillage(sm);
      const bridge = t.bridgeAt(sm);
      const flyover = !bridge && t.isFlyover(sm);
      const hill = t.isHill(sm);
      const sh = bridge ? 1.0 : hill ? HILL.shoulder : ROAD.shoulder;

      // Surface with a little colour noise (patches, wear)
      const broken = !village && !bridge && t.isBroken(sm);
      const base = village ? (rng() < 0.3 ? C.dirtDark : C.dirt)
        : broken ? (rng() < 0.4 ? C.crumble : rng() < 0.5 ? C.gravel : C.asphaltPatch)
        : rng() < 0.12 ? C.asphaltPatch : C.asphalt;
      tmp.copy(base).multiplyScalar(0.94 + rng() * 0.1);
      sb.quad(s0, s1, -hw0, hw0, -hw1, hw1, top, top, top, top, tmp);
      if (broken) {
        // potholes and puddles scattered across every lane
        const holes = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < holes; k++) {
          const d = (rng() * 2 - 1) * (hw0 - 0.8);
          const w = 0.6 + rng() * 1.4;
          const a = s0 + rng() * (step - 1);
          const l = Math.min(s1 - a, 0.6 + rng() * 1.6);
          const jag = (rng() - 0.5) * 0.5;
          sb.quad(a, a + l, d - w / 2, d + w / 2, d - w / 2 + jag, d + w / 2 - jag, top + 0.012, top + 0.012, top + 0.012, top + 0.012, rng() < 0.35 ? C.puddle : C.pothole);
        }
      }

      // Shoulders
      const shColor = village || hill ? C.dirtDark : bridge || flyover ? C.bridgeSide : C.shoulder;
      sb.quad(s0, s1, -hw0 - sh, -hw0, -hw1 - sh, -hw1, top - 0.02, top - 0.02, top - 0.02, top - 0.02, shColor);
      sb.quad(s0, s1, hw0, hw0 + sh, hw1, hw1 + sh, top - 0.02, top - 0.02, top - 0.02, top - 0.02, shColor);

      if (bridge) {
        const depth = 1.9;
        for (const side of [-1, 1]) {
          const e0 = side * (hw0 + sh);
          const e1 = side * (hw1 + sh);
          sb.quad(s0, s1, e0, e0, e1, e1, top, top - depth, top, top - depth, C.bridgeSide);
        }
        sb.quad(s0, s1, -hw0 - sh, hw0 + sh, -hw1 - sh, hw1 + sh, top - depth, top - depth, top - depth, top - depth, C.bridgeUnder);
      } else if (hill) {
        // each side: a slope up to a hillside (cutting, grassy top, back down) or down into the valley
        const el0 = t.elevation(s0);
        const el1 = t.elevation(s1);
        const yTop = top - 0.02;
        for (const side of [-1, 1] as const) {
          const a = t.hillSide(s0, side);
          const b = t.hillSide(s1, side);
          const band = (i0: number, i1: number, o0: number, o1: number, yi0: number, yi1: number, yo0: number, yo1: number, color: THREE.Color) =>
            side < 0
              ? sb.quad(s0, s1, -o0, -i0, -o1, -i1, yo0, yi0, yo1, yi1, color)
              : sb.quad(s0, s1, i0, o0, i1, o1, yi0, yo0, yi1, yo1, color);
          const up = a.rel > 0.5 || b.rel > 0.5;
          band(a.edge, b.edge, a.edge + a.slope, b.edge + b.slope, yTop, yTop, a.rel, b.rel, up ? C.cutting : C.valley);
          // a hillside: its grassy top and the back slope down to the valley floor
          if (a.rel > -el0 + 0.5 || b.rel > -el1 + 0.5) {
            const t0 = a.edge + a.slope;
            const t1 = b.edge + b.slope;
            band(t0, t1, t0 + HILL_TOP, t1 + HILL_TOP, a.rel, b.rel, a.rel, b.rel, rng() < 0.5 ? C.hilltop : C.hillDark);
            band(t0 + HILL_TOP, t1 + HILL_TOP, t0 + HILL_TOP + HILL_BACK, t1 + HILL_TOP + HILL_BACK, a.rel, b.rel, -el0 + 0.03, -el1 + 0.03, C.hillDark);
          }
        }
      } else if (flyover) {
        // parapets, and side faces down to the girder's bottom (or to the ground on the low ramp)
        const el0 = t.elevation(s0);
        const el1 = t.elevation(s1);
        const girder = t.isViaduct(sm) ? 1.9 : SHORTCUT.girder;
        const bot0 = Math.max(-el0 + 0.02, -girder);
        const bot1 = Math.max(-el1 + 0.02, -girder);
        const pt = top + PARAPET_H;
        for (const side of [-1, 1]) {
          const a0 = side * (hw0 + sh);
          const a1 = side * (hw1 + sh);
          const b0 = side * (hw0 + sh + PARAPET_W);
          const b1 = side * (hw1 + sh + PARAPET_W);
          sb.quad(s0, s1, a0, a0, a1, a1, pt, top - 0.02, pt, top - 0.02, C.concrete);
          sb.quad(s0, s1, a0, b0, a1, b1, pt, pt, pt, pt, C.parapetTop);
          sb.quad(s0, s1, b0, b0, b1, b1, pt, bot0, pt, bot1, C.concrete);
        }
        if (bot0 === -girder || bot1 === -girder) {
          const w0 = hw0 + sh + PARAPET_W;
          const w1 = hw1 + sh + PARAPET_W;
          sb.quad(s0, s1, -w0, w0, -w1, w1, bot0, bot0, bot1, bot1, C.bridgeUnder);
        }
      } else {
        // Embankment down to the surrounding ground
        const el0 = t.elevation(s0);
        const el1 = t.elevation(s1);
        for (const side of [-1, 1]) {
          const a0 = side * (hw0 + sh);
          const a1 = side * (hw1 + sh);
          const b0 = side * (hw0 + sh + 1.2 + el0 * 1.3);
          const b1 = side * (hw1 + sh + 1.2 + el1 * 1.3);
          const yTop = top - 0.02;
          sb.quad(
            s0, s1,
            side < 0 ? b0 : a0, side < 0 ? a0 : b0, side < 0 ? b1 : a1, side < 0 ? a1 : b1,
            side < 0 ? -el0 + 0.02 : yTop, side < 0 ? yTop : -el0 + 0.02,
            side < 0 ? -el1 + 0.02 : yTop, side < 0 ? yTop : -el1 + 0.02,
            C.embank,
          );
        }
      }

      // Markings (half worn away on broken stretches); the hill road has edge lines and a dashed centre line
      if (hill) {
        const y = top + 0.015;
        sb.quad(s0, s1, -hw0 + 0.2, -hw0 + 0.35, -hw1 + 0.2, -hw1 + 0.35, y, y, y, y, C.white);
        sb.quad(s0, s1, hw0 - 0.35, hw0 - 0.2, hw1 - 0.35, hw1 - 0.2, y, y, y, y, C.white);
        if (Math.floor(s0 / step) % 2 === 0) sb.strip(s0, s1, -0.08, 0.08, y, C.yellow);
      } else if (!village && (!broken || rng() < 0.35) && !t.isJunction(sm)) {
        const y = top + 0.015;
        // Edge lines
        sb.strip(s0, s1, -hw0 + 0.25, -hw0 + 0.45, y, C.white);
        sb.strip(s0, s1, hw0 - 0.45, hw0 - 0.25, y, C.white);
        // Double yellow centre line
        sb.strip(s0, s1, -0.3, -0.16, y, C.yellow);
        sb.strip(s0, s1, 0.16, 0.3, y, C.yellow);
        // Dashed lane dividers (2 lanes a side on the highway, 4 on the city avenue)
        if (Math.floor(s0 / step) % 3 === 0) {
          const lanes = Math.max(2, Math.round(hw0 / 3.5));
          for (let k = 1; k < lanes; k++) {
            const d = (hw0 * k) / lanes;
            sb.strip(s0, s1, -d - 0.08, -d + 0.08, y, C.white);
            sb.strip(s0, s1, d - 0.08, d + 0.08, y, C.white);
          }
        }
      }
    }
    return sb.build();
  }
}
