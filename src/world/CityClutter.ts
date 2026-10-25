// The occupied lanes of the city avenue: of 4 + 4 lanes only the inner one each way is open,
// the rest is parked rickshaws, vegetable vans and hawkers selling off the road.
// Deterministic per road chunk and instanced (one draw call per kind), rebuilt with the scenery.

import * as THREE from 'three';
import { CITY, ROAD } from '../config/tuning';
import { box, buildColored, cached, cone, cyl, sph, vertexColorMaterial, type Part } from '../utils/geometry';
import { hash2, mulberry32, pick, range } from '../utils/rng';
import { personGeometry, personParts } from './People';
import type { Track } from './Track';
import { vehicleGeometry } from './VehicleModels';

type ClutterKind = 'rickshawA' | 'rickshawB' | 'van' | 'hawkerA' | 'hawkerB' | 'person';

const CAPACITY: Record<ClutterKind, number> = { rickshawA: 260, rickshawB: 260, van: 220, hawkerA: 160, hawkerB: 160, person: 260 };

const VEG = [0xd63a2f, 0x3f8f2a, 0x9c6b3a, 0x7d3c98, 0xe9b949, 0x8bc34a, 0xf4f1e6];

/** Pedal van (ভ্যান) loaded with vegetables, puller on the saddle. Faces -Z. */
function vanGeometry(): THREE.BufferGeometry {
  return cached('clutter:van', () => {
    const parts: Part[] = [
      { geo: box(1.3, 0.1, 1.9), color: 0x8a6238, p: [0, 0.72, 0.35] },
      { geo: box(0.06, 0.6, 0.06), color: 0x444444, p: [0, 0.6, -0.75] },
      { geo: box(0.6, 0.05, 0.05), color: 0x444444, p: [0, 1.05, -0.95] },
      { geo: cyl(0.32, 0.32, 0.08, 10), color: 0x1b1b1b, p: [0, 0.32, -1.0], r: [0, 0, Math.PI / 2] },
      { geo: cyl(0.32, 0.32, 0.08, 10), color: 0x1b1b1b, p: [-0.62, 0.32, 0.7], r: [0, 0, Math.PI / 2] },
      { geo: cyl(0.32, 0.32, 0.08, 10), color: 0x1b1b1b, p: [0.62, 0.32, 0.7], r: [0, 0, Math.PI / 2] },
    ];
    // baskets and heaps of vegetables on the bed
    for (let i = 0; i < 6; i++) {
      const x = -0.38 + (i % 3) * 0.38;
      const z = -0.15 + Math.floor(i / 3) * 0.8;
      parts.push({ geo: cyl(0.2, 0.16, 0.22, 7), color: 0xb08d57, p: [x, 0.88, z] });
      parts.push({ geo: sph(0.19, 6, 4), color: VEG[i % VEG.length], p: [x, 1.0, z], s: [1, 0.6, 1] });
    }
    parts.push(...personParts({ skin: 0x8d5a3b, shirt: 0xd9c7a3, lower: 0x3b5d8f, lungi: false, seated: true, gamchha: true }, [0, 0.45, -0.55]));
    return buildColored(parts);
  });
}

/** Hawker sitting on a tarp with heaps of vegetables under a big umbrella. */
function hawkerGeometry(variant: number): THREE.BufferGeometry {
  return cached(`clutter:hawker:${variant}`, () => {
    const tarp = variant ? 0x2f6fb0 : 0xb5482d;
    const brolly = variant ? 0x1b1b1b : 0x2a6f4a;
    const parts: Part[] = [
      { geo: box(2.4, 0.04, 1.8), color: tarp, p: [0, 0.02, 0] },
      { geo: cyl(0.03, 0.03, 2.3, 5), color: 0x555555, p: [0.9, 1.15, 0.6] },
      { geo: cone(1.5, 0.6, 9), color: brolly, p: [0.9, 2.5, 0.6] },
    ];
    for (let i = 0; i < 5; i++) {
      parts.push({ geo: cone(0.32, 0.36, 7), color: VEG[(i + variant * 2) % VEG.length], p: [-0.85 + i * 0.42, 0.2, -0.45] });
    }
    parts.push({ geo: cyl(0.3, 0.25, 0.25, 8), color: 0xb08d57, p: [-0.6, 0.14, 0.35] });
    parts.push(...personParts({ skin: 0x9c6644, shirt: variant ? 0xf2f0ea : 0x9ec3e6, lower: 0x6b4f8a, lungi: false, seated: true }, [0.2, -0.2, 0.55]));
    return buildColored(parts);
  });
}

function geometryFor(kind: ClutterKind): THREE.BufferGeometry {
  switch (kind) {
    case 'rickshawA':
      return vehicleGeometry('rickshaw', 0);
    case 'rickshawB':
      return vehicleGeometry('rickshaw', 1);
    case 'van':
      return vanGeometry();
    case 'hawkerA':
      return hawkerGeometry(0);
    case 'hawkerB':
      return hawkerGeometry(1);
    case 'person':
      return personGeometry('trader', 41);
  }
}

export class CityClutter {
  readonly group = new THREE.Group();
  private meshes = new Map<ClutterKind, THREE.InstancedMesh>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);

  constructor(private track: Track) {
    const mat = vertexColorMaterial();
    for (const kind of Object.keys(CAPACITY) as ClutterKind[]) {
      const mesh = new THREE.InstancedMesh(geometryFor(kind), mat, CAPACITY[kind]);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  setTrack(track: Track): void {
    this.track = track;
    for (const mesh of this.meshes.values()) {
      mesh.count = 0;
      mesh.visible = false;
    }
  }

  /** Rebuild every instance for road chunks [first, last]. */
  rebuild(first: number, last: number): void {
    const t = this.track;
    const counts = new Map<ClutterKind, number>();
    const put = (kind: ClutterKind, s: number, d: number, rotY: number) => {
      const i = counts.get(kind) ?? 0;
      if (i >= CAPACITY[kind] || !t.isWide(s) || t.isBlocked(s, d)) return;
      this.e.set(0, rotY, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(t.centerX(s) + d, t.elevation(s) + ROAD.top, -s), this.q, this.one);
      this.meshes.get(kind)!.setMatrixAt(i, this.m);
      counts.set(kind, i + 1);
    };
    const L = ROAD.chunkLength;
    const W = CITY.laneWidth;
    const open = CITY.openLanes * W;
    for (let c = first; c <= last; c++) {
      const s0 = c * L;
      if (!t.isWide(s0) && !t.isWide(s0 + L)) continue;
      const rng = mulberry32(hash2(c, 4242));
      for (const side of [-1, 1]) {
        // vehicles face the way traffic on that side goes
        const face = side < 0 ? 0 : Math.PI;
        // first occupied lane: rickshaws waiting for passengers, vans
        for (let s = s0 + rng() * 3; s < s0 + L; s += range(rng, 2.6, 4.2)) {
          const r = rng();
          const kind: ClutterKind = r < 0.38 ? 'rickshawA' : r < 0.72 ? 'rickshawB' : 'van';
          put(kind, s, side * (open + 2.1 + rng() * 0.6), face + range(rng, -0.25, 0.25));
        }
        // second lane: vans selling straight off the bed, rickshaws parked any old way, people
        for (let s = s0 + rng() * 4; s < s0 + L; s += range(rng, 3, 5.5)) {
          const r = rng();
          const d = side * (open + W + 1.75 + range(rng, -0.6, 0.6));
          if (r < 0.45) put('van', s, d, face + range(rng, -0.5, 0.5));
          else if (r < 0.75) put(pick(rng, ['rickshawA', 'rickshawB'] as const), s, d, face + range(rng, -1.2, 1.2));
          else put('person', s, d, rng() * 6.28);
        }
        // outer lanes: hawkers on tarps, buyers standing around
        for (let s = s0 + rng() * 3; s < s0 + L; s += range(rng, 2.6, 3.6)) {
          const d = side * (open + 2 * W + 1.4 + rng() * 3.6);
          put(rng() < 0.5 ? 'hawkerA' : 'hawkerB', s, d, (side < 0 ? -Math.PI / 2 : Math.PI / 2) + range(rng, -0.3, 0.3));
          if (rng() < 0.45) put('person', s + range(rng, -1, 1), d - side * 1.5, rng() * 6.28);
        }
      }
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
