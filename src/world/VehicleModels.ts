// Procedural vehicle geometry. All models face -Z, origin on the ground at the footprint centre.

import * as THREE from 'three';
import { box, buildColored, cached, cyl, type Part } from '../utils/geometry';
import { personParts } from './People';

export type TrafficKind = 'bus' | 'truck' | 'car' | 'cng' | 'rickshaw';

export const VEHICLE_DIMS: Record<TrafficKind | 'bike' | 'pickup', { len: number; wid: number }> = {
  bus: { len: 11, wid: 2.5 },
  truck: { len: 8.5, wid: 2.5 },
  car: { len: 4.4, wid: 1.8 },
  cng: { len: 2.7, wid: 1.4 },
  rickshaw: { len: 2.3, wid: 1.1 },
  bike: { len: 2, wid: 0.8 },
  pickup: { len: 5, wid: 2 },
};

const DARK = 0x1f2730;
const TYRE = 0x1b1b1b;

function wheels(xs: number[], zs: number[], r: number, w: number): Part[] {
  const out: Part[] = [];
  for (const x of xs) for (const z of zs) out.push({ geo: cyl(r, r, w, 10), color: TYRE, p: [x, r, z], r: [0, 0, Math.PI / 2] });
  return out;
}

const BUS_COLORS: [number, number, number][] = [
  [0xd63a2f, 0xffd23f, 0xffffff],
  [0x2f6fd6, 0xf2f2f2, 0xff8c1a],
  [0x2fa35a, 0xffffff, 0xe63946],
  [0xf2f2f2, 0x7b2cbf, 0x2a9d8f],
];

export function vehicleGeometry(kind: TrafficKind, variant: number): THREE.BufferGeometry {
  return cached(`veh:${kind}:${variant}`, () => {
    switch (kind) {
      case 'bus': {
        const [body, stripe, stripe2] = BUS_COLORS[variant % BUS_COLORS.length];
        return buildColored([
          { geo: box(2.5, 2.5, 11), color: body, p: [0, 1.85, 0] },
          { geo: box(2.54, 0.75, 9.6), color: DARK, p: [0, 2.35, 0.3] },
          { geo: box(2.54, 0.25, 10.8), color: stripe, p: [0, 1.65, 0] },
          { geo: box(2.54, 0.12, 10.8), color: stripe2, p: [0, 1.4, 0] },
          { geo: box(2.3, 1.0, 0.06), color: DARK, p: [0, 2.4, -5.5] },
          { geo: box(2.4, 0.35, 0.1), color: stripe, p: [0, 3.05, -5.5] },
          { geo: box(2.3, 0.2, 9.5), color: 0x8a8a8a, p: [0, 3.2, 0.4] },
          { geo: box(0.4, 0.2, 0.1), color: 0xfff6c0, p: [-0.85, 1.0, -5.52] },
          { geo: box(0.4, 0.2, 0.1), color: 0xfff6c0, p: [0.85, 1.0, -5.52] },
          ...wheels([-1.1, 1.1], [-3.6, 3.4], 0.55, 0.4),
        ]);
      }
      case 'truck': {
        const cab = [0xe0a32e, 0x2f6fd6, 0xd63a2f][variant % 3];
        const tarp = [0x23507a, 0x3d6b2f, 0x6b3d2f][variant % 3];
        return buildColored([
          { geo: box(2.4, 1.9, 2.0), color: cab, p: [0, 2.05, -3.2] },
          { geo: box(2.2, 0.8, 0.06), color: DARK, p: [0, 2.4, -4.21] },
          { geo: box(2.5, 0.35, 0.2), color: 0xc1121f, p: [0, 0.8, -4.25] },
          { geo: box(2.2, 0.4, 8.0), color: 0x2b2b2b, p: [0, 0.9, 0] },
          { geo: box(2.5, 2.4, 5.8), color: tarp, p: [0, 2.4, 1.2] },
          { geo: box(2.52, 0.3, 5.8), color: 0xffd166, p: [0, 1.25, 1.2] },
          ...wheels([-1.05, 1.05], [-3.0, 2.4, 3.2], 0.5, 0.4),
        ]);
      }
      case 'car': {
        const c = [0xf2f2f2, 0xb8bcc2, 0x2b2d30, 0x9b2226, 0x355070][variant % 5];
        return buildColored([
          { geo: box(1.8, 0.65, 4.4), color: c, p: [0, 0.75, 0] },
          { geo: box(1.6, 0.6, 2.2), color: c, p: [0, 1.35, 0.2] },
          { geo: box(1.62, 0.45, 2.0), color: DARK, p: [0, 1.38, 0.2] },
          { geo: box(0.35, 0.15, 0.06), color: 0xfff6c0, p: [-0.6, 0.85, -2.21] },
          { geo: box(0.35, 0.15, 0.06), color: 0xfff6c0, p: [0.6, 0.85, -2.21] },
          ...wheels([-0.85, 0.85], [-1.35, 1.35], 0.33, 0.25),
        ]);
      }
      case 'cng':
        return buildColored([
          { geo: box(1.4, 0.55, 2.6), color: 0x2f9e44, p: [0, 0.6, 0] },
          { geo: box(1.38, 0.95, 1.9), color: 0x2f9e44, p: [0, 1.35, 0.25] },
          { geo: box(1.42, 0.55, 1.5), color: 0x24312a, p: [0, 1.4, 0.3] },
          { geo: box(1.2, 0.6, 0.05), color: DARK, p: [0, 1.4, -0.72] },
          { geo: box(1.5, 0.08, 2.1), color: 0x1e7a33, p: [0, 1.86, 0.2] },
          { geo: cyl(0.28, 0.28, 0.2, 8), color: TYRE, p: [0, 0.28, -1.05], r: [0, 0, Math.PI / 2] },
          ...wheels([-0.65, 0.65], [0.85], 0.28, 0.2),
        ]);
      case 'rickshaw': {
        const hood = [0xe63946, 0x2a9d8f, 0xffb703, 0x7b2cbf][variant % 4];
        return buildColored([
          { geo: box(0.08, 0.08, 1.9), color: 0x555555, p: [0, 0.55, 0] },
          { geo: box(1.0, 0.35, 0.6), color: 0x2b6cb0, p: [0, 0.85, 0.5] },
          { geo: box(1.0, 0.6, 0.12), color: 0xffd166, p: [0, 1.25, 0.8] },
          { geo: cyl(0.6, 0.6, 0.8, 8, ).rotateZ(Math.PI / 2), color: hood, p: [0, 1.55, 0.6], s: [1, 0.9, 0.9] },
          { geo: box(0.25, 0.08, 0.3), color: 0x333333, p: [0, 1.05, -0.55] },
          { geo: cyl(0.33, 0.33, 0.05, 10), color: TYRE, p: [0, 0.33, -0.85], r: [0, 0, Math.PI / 2] },
          ...wheels([-0.5, 0.5], [0.5], 0.33, 0.05),
          ...personParts({ skin: 0x7b4a2e, shirt: 0xf2f0ea, lower: 0x3b5d8f, lungi: true, seated: true }, [0, 0.55, -0.35]),
        ]);
      }
    }
  });
}

/** Chaser motorbike with two riders (pillion waves a stick). */
export function bikeGeometry(variant: number): THREE.BufferGeometry {
  return cached(`bike:${variant}`, () => {
    const c = [0x1d3557, 0x2b2b2b, 0x6a040f][variant % 3];
    const look = { skin: 0x8d5a3b, shirt: [0xf2f0ea, 0x9ec3e6, 0xd9c7a3][variant % 3], lower: 0x3a3a40, lungi: false, cap: 0xb3ada2, armband: true, seated: true };
    return buildColored([
      { geo: box(0.3, 0.45, 1.5), color: c, p: [0, 0.75, 0] },
      { geo: box(0.35, 0.12, 0.9), color: 0x111111, p: [0, 1.0, 0.2] },
      { geo: box(0.7, 0.06, 0.06), color: 0x888888, p: [0, 1.2, -0.65] },
      { geo: cyl(0.32, 0.32, 0.12, 10), color: TYRE, p: [0, 0.32, -0.72], r: [0, 0, Math.PI / 2] },
      { geo: cyl(0.32, 0.32, 0.12, 10), color: TYRE, p: [0, 0.32, 0.72], r: [0, 0, Math.PI / 2] },
      ...personParts(look, [0, 0.55, 0.1]),
      ...personParts({ ...look, shirt: 0xc9c9c9 }, [0, 0.6, 0.6]),
      { geo: cyl(0.025, 0.03, 1.1, 5), color: 0x6b4a2a, p: [0.45, 2.5, 0.6], r: [0.4, 0, -0.5] },
    ]);
  });
}

export function pickupGeometry(): THREE.BufferGeometry {
  return cached('pickup', () => {
    const parts: Part[] = [
      { geo: box(2, 1.0, 1.8), color: 0xeeeeee, p: [0, 1.4, -1.4] },
      { geo: box(1.9, 0.5, 0.06), color: DARK, p: [0, 1.6, -2.31] },
      { geo: box(2, 0.7, 5), color: 0xdddddd, p: [0, 0.75, 0] },
      { geo: box(2, 0.5, 3.0), color: 0xcfcfcf, p: [0, 1.3, 1.0] },
      ...wheels([-0.95, 0.95], [-1.6, 1.6], 0.4, 0.3),
    ];
    const shirts = [0xf2f0ea, 0x9ec3e6, 0xd9c7a3, 0xc9c9c9];
    shirts.forEach((shirt, i) => {
      parts.push(...personParts({ skin: 0x8d5a3b, shirt, lower: 0x3a3a40, lungi: false, cap: 0xb3ada2, armband: true }, [i % 2 ? 0.5 : -0.5, 1.05, 0.2 + Math.floor(i / 2) * 1.1]));
    });
    return buildColored(parts);
  });
}

export function boatHullGeometry(): THREE.BufferGeometry {
  return cached('boat', () =>
    buildColored([
      { geo: box(1.6, 0.6, 5), color: 0x5b3a1e, p: [0, 0.3, 0] },
      { geo: cyl(0, 0.8, 1.8, 4).rotateX(-Math.PI / 2), color: 0x5b3a1e, p: [0, 0.35, -3.3], s: [1, 0.45, 1] },
      { geo: cyl(0, 0.8, 1.8, 4).rotateX(Math.PI / 2), color: 0x5b3a1e, p: [0, 0.35, 3.3], s: [1, 0.45, 1] },
      { geo: cyl(0.9, 0.9, 2.4, 8, ).rotateX(Math.PI / 2), color: 0x3a2a1a, p: [0, 0.75, 0.6], s: [1, 0.6, 1] },
      { geo: cyl(0.05, 0.05, 4, 5), color: 0x4a3a2a, p: [0, 2.4, -1] },
      { geo: box(0.04, 3.0, 2.4), color: 0xd8c39a, p: [0, 2.6, -0.4] },
      { geo: box(0.05, 1.0, 1.2), color: 0x9b2226, p: [0, 3.2, -0.2] },
    ]),
  );
}
