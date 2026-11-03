// Low-poly aircraft seen over Bangladesh, in real metres, nose toward -z, y up:
// - wide-body twin (Boeing 787 class) and narrow-body (737-800 class) airliners, the turboprop domestic hopper
//   (ATR 72 / Dash 8-400 class): fictional liveries, no real airline branding
// - Air Force F-7BGI (double-delta, nose intake) and MiG-29 (twin engines, twin fins), grey camouflage
// - Mi-17/Mi-171 transport helicopter (olive, 5 blades) and a civil Bell 212 (two-blade "Huey")
// Spinning parts (rotors, propellers) come back as separate geometries with their hub position and spin axis.

import * as THREE from 'three';
import { box, buildColored, cone, cyl, sph, type Part } from '../utils/geometry';

type V3 = [number, number, number];

export interface Spinner {
  geo: THREE.BufferGeometry;
  p: V3;
  axis: 'x' | 'y' | 'z';
  /** radians per second */
  rate: number;
}

export interface AircraftModel {
  body: THREE.BufferGeometry;
  spinners: Spinner[];
  /** landing gear, shown on the approach to Dhaka */
  gear: THREE.BufferGeometry | null;
  /** navigation lights: red on the left wingtip, green on the right, white at the tail */
  nav: { p: V3; color: number }[];
  /** red anti-collision beacon(s), flashing */
  beacon: V3[];
  /** engine exhausts (contrails / afterburner glow) */
  exhausts: V3[];
}

const ALONG_Z: V3 = [Math.PI / 2, 0, 0];
const NOSE_FWD: V3 = [-Math.PI / 2, 0, 0];

/**
 * A flat wing panel: chord along z (leading edge at -z), span out along x. side = 1 builds the right wing,
 * -1 the left. Coordinates are relative to the root leading edge.
 */
function panel(side: 1 | -1, rootChord: number, tipChord: number, span: number, sweep: number, thick: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(side * span, sweep);
  s.lineTo(side * span, sweep + tipChord);
  s.lineTo(0, rootChord);
  s.closePath();
  // shape y → +z (back), extrusion → down
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, thick / 2, 0);
}

/** A vertical fin: root chord along z at y = 0, up to `height`, swept back by `sweep`. */
function fin(rootChord: number, tipChord: number, height: number, sweep: number, thick: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(sweep, height);
  s.lineTo(sweep + tipChord, height);
  s.lineTo(rootChord, 0);
  s.closePath();
  // shape x → +z, extrusion → -x (then centred)
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(thick / 2, 0, 0);
}

function wheels(at: V3[], r: number, w: number, strut: number): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (const [x, y, z] of at) {
    parts.push({ geo: cyl(0.08 * strut, 0.08 * strut, strut, 6), color: 0x9a9a9a, p: [x, y + strut / 2, z] });
    parts.push({ geo: cyl(r, r, w, 10), color: 0x1b1b1b, p: [x, y, z], r: [0, 0, Math.PI / 2] });
  }
  return buildColored(parts);
}

// ---------------------------------------------------------------- airliners

interface Livery {
  body: number;
  belly: number;
  cheat: number;
  tail: number;
  tailAccent: number;
  engine: number;
}

/** Fictional liveries: national green and red, a navy-and-orange private carrier, a teal domestic one. */
export const LIVERIES: Record<'green' | 'navy' | 'teal', Livery> = {
  green: { body: 0xf4f5f2, belly: 0xd9dcd8, cheat: 0x0b7a4b, tail: 0xc8102e, tailAccent: 0xffffff, engine: 0x0b7a4b },
  navy: { body: 0xf4f5f2, belly: 0xcfd3d8, cheat: 0xf28c28, tail: 0x16325c, tailAccent: 0xf28c28, engine: 0xe6e7e8 },
  teal: { body: 0xf6f6f4, belly: 0xd6d9d9, cheat: 0x138a8a, tail: 0x138a8a, tailAccent: 0xffd23f, engine: 0xe6e7e8 },
};

interface JetSpec {
  R: number;
  L: number;
  span: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  /** wing root leading edge, from the nose */
  wingZ: number;
  engineR: number;
  engineL: number;
  /** engine x, fraction of the half-span */
  engineX: number;
  finH: number;
  stabSpan: number;
  winglet: number;
}

function jet(j: JetSpec, c: Livery): AircraftModel {
  const { R, L } = j;
  const z0 = -L / 2;
  const noseL = R * 1.6;
  const tailL = R * 3.2;
  const tubeL = L - noseL - tailL;
  const tubeZ = z0 + noseL + tubeL / 2;
  const parts: Part[] = [
    { geo: cyl(R, R, tubeL, 14), color: c.body, p: [0, 0, tubeZ], r: ALONG_Z },
    // nose and tapering tail cone
    { geo: sph(R, 14, 10), color: c.body, p: [0, 0, z0 + noseL], s: [1, 1, noseL / R] },
    { geo: cyl(R * 0.25, R, tailL, 14), color: c.body, p: [0, R * 0.35, z0 + noseL + tubeL + tailL / 2], r: ALONG_Z, s: [1, 1, 1] },
    // belly, cheatline, window band, cockpit windows
    { geo: box(R * 1.6, R * 0.5, tubeL), color: c.belly, p: [0, -R * 0.72, tubeZ] },
    { geo: box(R * 2.04, R * 0.12, tubeL * 0.95), color: c.cheat, p: [0, -R * 0.12, tubeZ] },
    { geo: box(R * 2.03, R * 0.14, tubeL * 0.85), color: 0x2b3440, p: [0, R * 0.3, tubeZ - tubeL * 0.03] },
    { geo: box(R * 1.0, R * 0.14, R * 0.4), color: 0x1d2630, p: [0, R * 0.74, z0 + noseL * 0.62], r: [0.5, 0, 0] },
    { geo: box(R * 1.86, R * 0.16, R * 0.45), color: 0x1d2630, p: [0, R * 0.5, z0 + noseL * 0.85] },
    // wing box under the fuselage
    { geo: box(R * 1.7, R * 0.5, j.rootChord * 0.9), color: c.belly, p: [0, -R * 0.75, z0 + j.wingZ + j.rootChord / 2] },
  ];
  // wings with a little dihedral, winglets
  const half = j.span / 2 - R * 0.8;
  for (const side of [-1, 1] as const) {
    parts.push({ geo: panel(side, j.rootChord, j.tipChord, half, j.sweep, R * 0.18), color: c.body, p: [side * R * 0.8, -R * 0.55, z0 + j.wingZ], r: [0, 0, side * 0.08] });
    if (j.winglet) {
      parts.push({ geo: fin(j.tipChord, j.tipChord * 0.5, j.winglet, j.tipChord * 0.5, 0.2), color: c.tail, p: [side * (R * 0.8 + half), -R * 0.55 + half * 0.08, z0 + j.wingZ + j.sweep], r: [0, 0, -side * 0.25] });
    }
    // engine pod hung under the wing
    const ex = side * (R * 0.8 + half * j.engineX);
    const ez = z0 + j.wingZ + j.sweep * j.engineX - j.engineL * 0.45;
    const ey = -R * 0.55 - j.engineR * 1.05 + Math.abs(ex) * 0.08;
    parts.push({ geo: cyl(j.engineR, j.engineR * 0.8, j.engineL, 14), color: c.engine, p: [ex, ey, ez + j.engineL / 2], r: ALONG_Z });
    parts.push({ geo: cyl(j.engineR * 0.82, j.engineR * 0.82, 0.1, 14), color: 0x222222, p: [ex, ey, ez - 0.02], r: ALONG_Z });
    parts.push({ geo: box(0.35, j.engineR, j.engineL * 0.6), color: c.body, p: [ex, ey + j.engineR * 0.9, ez + j.engineL * 0.4] });
    // horizontal stabiliser
    parts.push({ geo: panel(side, j.rootChord * 0.45, j.tipChord * 0.8, j.stabSpan / 2, j.rootChord * 0.4, R * 0.12), color: c.body, p: [side * R * 0.3, R * 0.3, L / 2 - tailL * 0.75] });
  }
  // vertical tail with its livery and a stripe
  const finRoot = tailL * 0.95;
  parts.push({ geo: fin(finRoot, finRoot * 0.35, j.finH, finRoot * 0.65, R * 0.14), color: c.tail, p: [0, R * 0.6, L / 2 - tailL - 0.2] });
  parts.push({ geo: fin(finRoot * 0.5, finRoot * 0.2, j.finH * 0.3, finRoot * 0.3, R * 0.16), color: c.tailAccent, p: [0, R * 0.6 + j.finH * 0.45, L / 2 - tailL + finRoot * 0.35] });

  const engineX = R * 0.8 + half * j.engineX;
  const mainZ = z0 + j.wingZ + j.rootChord * 0.75;
  const gear = wheels([[0, -R * 1.9, z0 + noseL * 1.4], [-R * 0.9, -R * 2.1, mainZ], [R * 0.9, -R * 2.1, mainZ]], R * 0.28, R * 0.3, R * 1.2);
  return {
    body: buildColored(parts),
    spinners: [],
    gear,
    nav: [
      { p: [-j.span / 2, -R * 0.4, z0 + j.wingZ + j.sweep + j.tipChord * 0.5], color: 0xff2a1a },
      { p: [j.span / 2, -R * 0.4, z0 + j.wingZ + j.sweep + j.tipChord * 0.5], color: 0x2aff5a },
      { p: [0, R * 0.4, L / 2 + 0.2], color: 0xffffff },
    ],
    beacon: [[0, R * 1.05, tubeZ], [0, -R * 1.05, tubeZ]],
    exhausts: [[-engineX, -R * 1.6, z0 + j.wingZ + j.sweep * j.engineX + j.engineL * 0.6], [engineX, -R * 1.6, z0 + j.wingZ + j.sweep * j.engineX + j.engineL * 0.6]],
  };
}

/** Wide-body twin, 787 class: 57 m long, 60 m span, raked wingtips, big high-bypass engines. */
export const wideBody = (c: Livery): AircraftModel =>
  jet({ R: 2.9, L: 57, span: 60, rootChord: 11, tipChord: 2.2, sweep: 15, wingZ: 20, engineR: 1.6, engineL: 6.5, engineX: 0.33, finH: 10, stabSpan: 20, winglet: 0 }, c);

/** Narrow-body, 737-800 class: 40 m long, 34 m span, blended winglets, engines close in under the wing. */
export const narrowBody = (c: Livery): AircraftModel =>
  jet({ R: 1.9, L: 40, span: 34, rootChord: 7.5, tipChord: 1.5, sweep: 8.5, wingZ: 14, engineR: 1.05, engineL: 4.2, engineX: 0.3, finH: 7.5, stabSpan: 14, winglet: 2.4 }, c);

/** High-wing twin turboprop, ATR 72 class: 27 m long, 27 m span, T-tail, six-blade propellers. */
export function turboprop(c: Livery): AircraftModel {
  const R = 1.4;
  const L = 27;
  const z0 = -L / 2;
  const parts: Part[] = [
    { geo: cyl(R, R, L * 0.6, 12), color: c.body, p: [0, 0, z0 + L * 0.4], r: ALONG_Z },
    { geo: sph(R, 12, 8), color: c.body, p: [0, 0, z0 + L * 0.1], s: [1, 1, 2] },
    { geo: cyl(R * 0.3, R, L * 0.3, 12), color: c.body, p: [0, R * 0.3, z0 + L * 0.85], r: ALONG_Z },
    { geo: box(R * 1.4, R * 0.45, L * 0.6), color: c.belly, p: [0, -R * 0.75, z0 + L * 0.4] },
    { geo: box(R * 2.03, R * 0.14, L * 0.55), color: c.cheat, p: [0, -R * 0.15, z0 + L * 0.42] },
    { geo: box(R * 2.02, R * 0.16, L * 0.5), color: 0x2b3440, p: [0, R * 0.28, z0 + L * 0.42] },
    { geo: box(R * 1.2, R * 0.3, 0.5), color: 0x1d2630, p: [0, R * 0.45, z0 + L * 0.12], r: [0.5, 0, 0] },
    // landing-gear fairings on the belly
    { geo: box(R * 2.4, R * 0.6, 4), color: c.belly, p: [0, -R * 0.85, z0 + L * 0.52] },
    // wing on the roof
    { geo: box(R * 1.4, 0.5, 3), color: c.body, p: [0, R * 0.95, z0 + L * 0.43] },
  ];
  const spinners: Spinner[] = [];
  const prop: Part[] = [{ geo: cone(0.35, 0.8, 8), color: 0xe6e7e8, r: NOSE_FWD, p: [0, 0, -0.3] }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    prop.push({ geo: box(0.28, 1.95, 0.06), color: 0x1f1f1f, p: [Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0], r: [0, 0, -a] });
  }
  const propGeo = buildColored(prop);
  for (const side of [-1, 1] as const) {
    parts.push({ geo: panel(side, 2.6, 1.4, 13.5 - R * 0.7, 0.6, 0.3), color: c.body, p: [side * R * 0.7, R * 1.05, z0 + L * 0.37], r: [0, 0, -side * 0.02] });
    // engine nacelle under the wing
    parts.push({ geo: cyl(0.55, 0.45, 4.2, 10), color: c.engine, p: [side * 4.1, R * 0.7, z0 + L * 0.37 + 0.9], r: ALONG_Z });
    spinners.push({ geo: propGeo, p: [side * 4.1, R * 0.7, z0 + L * 0.37 - 1.3], axis: 'z', rate: side * 32 });
  }
  // T-tail: tall fin with the tailplane on top
  parts.push({ geo: fin(4.2, 2, 5, 2.6, 0.3), color: c.tail, p: [0, R * 0.7, L / 2 - 4.6] });
  for (const side of [-1, 1] as const) parts.push({ geo: panel(side, 1.8, 1, 3.8, 0.6, 0.22), color: c.tail, p: [0, R * 0.7 + 5, L / 2 - 2.2] });
  return {
    body: buildColored(parts),
    spinners,
    gear: wheels([[0, -R * 1.5, z0 + L * 0.12], [-R * 1.1, -R * 1.7, z0 + L * 0.53], [R * 1.1, -R * 1.7, z0 + L * 0.53]], 0.45, 0.4, 1.2),
    nav: [
      { p: [-13.5, R * 1.05, z0 + L * 0.37 + 1.8], color: 0xff2a1a },
      { p: [13.5, R * 1.05, z0 + L * 0.37 + 1.8], color: 0x2aff5a },
      { p: [0, R * 0.7, L / 2 + 0.2], color: 0xffffff },
    ],
    beacon: [[0, R * 0.7 + 5.2, L / 2 - 1.6], [0, -R * 1.05, z0 + L * 0.4]],
    exhausts: [],
  };
}

// ---------------------------------------------------------------- fighters

const ROUNDEL_GREEN = 0x006a4e;
const ROUNDEL_RED = 0xf42a41;

function roundel(x: number, y: number, z: number, r: number): Part[] {
  return [
    { geo: cyl(r, r, 0.04, 12), color: ROUNDEL_GREEN, p: [x, y, z] },
    { geo: cyl(r * 0.55, r * 0.55, 0.05, 12), color: ROUNDEL_RED, p: [x, y + 0.005, z] },
  ];
}

/** F-7BGI: a slim fuselage with the intake in the nose, double-delta wings, one tall fin. */
export function f7(): AircraftModel {
  const grey = 0xa3acb3;
  const dark = 0x7b858d;
  const parts: Part[] = [
    { geo: cyl(0.72, 0.7, 11, 12), color: grey, p: [0, 0, 0.3], r: ALONG_Z },
    // nose intake with its shock cone, pitot boom
    { geo: cyl(0.66, 0.72, 1.4, 12), color: grey, p: [0, 0, -5.9], r: ALONG_Z },
    { geo: cyl(0.56, 0.56, 0.08, 12), color: 0x111111, p: [0, 0, -6.62], r: ALONG_Z },
    { geo: cone(0.3, 0.8, 8), color: dark, p: [0, 0, -6.8], r: NOSE_FWD },
    { geo: cyl(0.03, 0.03, 1.6, 4), color: 0x444444, p: [0, 0.35, -7.3], r: ALONG_Z },
    // canopy and spine
    { geo: sph(0.5, 10, 6), color: 0x2a3a48, p: [0, 0.6, -3.6], s: [0.9, 0.8, 2] },
    { geo: box(0.4, 0.35, 6), color: grey, p: [0, 0.75, 0.5] },
    // jet pipe, ventral fins, centreline drop tank
    { geo: cyl(0.58, 0.62, 0.8, 12), color: 0x4a4a4a, p: [0, 0, 6.2], r: ALONG_Z },
    { geo: cyl(0.32, 0.32, 3.2, 10), color: dark, p: [0, -0.95, 0.4], r: ALONG_Z },
    { geo: fin(1.4, 0.6, 0.6, 0.6, 0.08), color: dark, p: [0, -1.1, 4.5], r: [Math.PI, 0, 0] },
  ];
  for (const side of [-1, 1] as const) {
    // double delta: a steep inner panel and a shallower outer one
    parts.push({ geo: panel(side, 5.6, 3.2, 1.3, 2.0, 0.14), color: grey, p: [side * 0.55, -0.2, -1.6] });
    parts.push({ geo: panel(side, 3.2, 0.6, 2.4, 2.4, 0.12), color: grey, p: [side * 1.85, -0.2, 0.4] });
    parts.push({ geo: panel(side, 1.5, 0.5, 1.5, 0.9, 0.1), color: dark, p: [side * 0.6, -0.1, 4.6] });
    parts.push(...roundel(side * 2.3, -0.08, 2.0, 0.42));
  }
  parts.push({ geo: fin(3.2, 1.0, 2.9, 2.6, 0.12), color: dark, p: [0, 0.6, 2.8] });
  return {
    body: buildColored(parts),
    spinners: [],
    gear: null,
    nav: [{ p: [-4.2, -0.15, 2.9], color: 0xff2a1a }, { p: [4.2, -0.15, 2.9], color: 0x2aff5a }, { p: [0, 3.5, 6.3], color: 0xffffff }],
    beacon: [],
    exhausts: [[0, 0, 6.7]],
  };
}

/** MiG-29: flat lifting body, two widely spaced engines with intakes under the leading-edge extensions, twin fins. */
export function mig29(): AircraftModel {
  const grey = 0x8f99a1;
  const dark = 0x6c7780;
  const parts: Part[] = [
    // centre body, nose radome, canopy
    { geo: box(1.5, 0.75, 9), color: grey, p: [0, 0, 0] },
    { geo: cyl(0.55, 0.75, 3, 10), color: grey, p: [0, 0.1, -6], r: ALONG_Z },
    { geo: cone(0.55, 2.2, 10), color: dark, p: [0, 0.1, -8.6], r: NOSE_FWD },
    { geo: sph(0.5, 10, 6), color: 0x2a3a48, p: [0, 0.65, -5.2], s: [0.85, 0.8, 2] },
    { geo: box(0.7, 0.4, 5), color: grey, p: [0, 0.5, -1.5] },
  ];
  for (const side of [-1, 1] as const) {
    // engine nacelle and its square intake, nozzle
    parts.push({ geo: cyl(0.62, 0.6, 9, 10), color: dark, p: [side * 1.05, -0.4, 1.6], r: ALONG_Z });
    parts.push({ geo: box(1.1, 0.9, 1.8), color: grey, p: [side * 1.05, -0.45, -3.2] });
    parts.push({ geo: box(0.9, 0.7, 0.05), color: 0x111111, p: [side * 1.05, -0.45, -4.12] });
    parts.push({ geo: cyl(0.5, 0.55, 0.9, 10), color: 0x4a4a4a, p: [side * 1.05, -0.4, 6.4], r: ALONG_Z });
    // leading-edge extension, wing, stabilator, canted fin
    parts.push({ geo: panel(side, 5, 0.6, 1.1, 4.6, 0.12), color: grey, p: [side * 0.7, 0.05, -5.0] });
    parts.push({ geo: panel(side, 4.6, 1.3, 4.3, 3.6, 0.14), color: dark, p: [side * 1.5, 0.05, -0.8] });
    parts.push({ geo: panel(side, 2.4, 1.0, 2.4, 1.6, 0.1), color: grey, p: [side * 1.5, -0.2, 4.5] });
    parts.push({ geo: fin(3.0, 1.1, 2.9, 2.3, 0.12), color: dark, p: [side * 1.25, 0.35, 2.8], r: [0, 0, side * -0.15] });
    parts.push(...roundel(side * 3.8, 0.13, 2.0, 0.42));
  }
  return {
    body: buildColored(parts),
    spinners: [],
    gear: null,
    nav: [{ p: [-5.8, 0, 3.0], color: 0xff2a1a }, { p: [5.8, 0, 3.0], color: 0x2aff5a }, { p: [0, 0, 6.9], color: 0xffffff }],
    beacon: [],
    exhausts: [[-1.05, -0.4, 6.9], [1.05, -0.4, 6.9]],
  };
}

// ---------------------------------------------------------------- helicopters

function rotor(blades: number, radius: number, chord: number, hub: number, color = 0x222222): THREE.BufferGeometry {
  const parts: Part[] = [{ geo: cyl(hub, hub, 0.4, 8), color: 0x555555 }];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    parts.push({ geo: box(chord, 0.06, radius), color, p: [Math.sin(a) * radius * 0.5, 0.1, Math.cos(a) * radius * 0.5], r: [0, a, 0] });
  }
  return buildColored(parts);
}

/** Tail rotor in the y-z plane (spins about x). */
function tailRotor(blades: number, radius: number): THREE.BufferGeometry {
  const parts: Part[] = [{ geo: cyl(0.12, 0.12, 0.3, 6), color: 0x555555, r: [0, 0, Math.PI / 2] }];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    parts.push({ geo: box(0.05, radius, 0.22), color: 0x222222, p: [0, Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5], r: [a, 0, 0] });
  }
  return buildColored(parts);
}

/** Mi-17 / Mi-171Sh: big pod with a glazed nose, twin engines on the roof, tail boom with a tall fin, fixed gear. */
export function mi17(): AircraftModel {
  const olive = 0x56613f;
  const camo = 0x3f4a2e;
  const belly = 0x7d8770;
  const parts: Part[] = [
    { geo: box(2.4, 2.4, 8.5), color: olive, p: [0, 0, 0.2] },
    { geo: sph(1.25, 12, 8), color: olive, p: [0, -0.05, -4.1], s: [0.98, 0.98, 1.4] },
    // glazed nose and cockpit windows
    { geo: sph(0.9, 10, 6), color: 0x2a3a48, p: [0, -0.35, -5.15], s: [1.1, 0.9, 0.8] },
    { geo: box(2.3, 0.6, 1.0), color: 0x2a3a48, p: [0, 0.55, -4.4], r: [-0.4, 0, 0] },
    { geo: box(2.42, 0.4, 7.5), color: belly, p: [0, -1.05, 0.4] },
    // camouflage patches
    { geo: box(2.44, 1.1, 2.2), color: camo, p: [0, 0.5, -1.5] },
    { geo: box(2.44, 0.9, 1.8), color: camo, p: [0, -0.2, 2.8] },
    // engines and gearbox on the roof, exhausts, intakes
    { geo: box(1.9, 0.95, 5.2), color: olive, p: [0, 1.65, -0.4] },
    { geo: box(1.2, 0.5, 1.4), color: camo, p: [0, 2.3, 0.8] },
    { geo: cyl(0.35, 0.35, 0.1, 10), color: 0x111111, p: [-0.5, 1.65, -3.02], r: ALONG_Z },
    { geo: cyl(0.35, 0.35, 0.1, 10), color: 0x111111, p: [0.5, 1.65, -3.02], r: ALONG_Z },
    { geo: cyl(0.3, 0.3, 0.8, 8), color: 0x333333, p: [-1.1, 1.7, 1.2], r: [0, 0, Math.PI / 2] },
    { geo: cyl(0.3, 0.3, 0.8, 8), color: 0x333333, p: [1.1, 1.7, 1.2], r: [0, 0, Math.PI / 2] },
    // external fuel tanks on both sides, sliding door
    { geo: cyl(0.55, 0.55, 2.8, 10), color: olive, p: [-1.55, -0.55, 0.6], r: ALONG_Z },
    { geo: cyl(0.55, 0.55, 2.8, 10), color: olive, p: [1.55, -0.55, 0.6], r: ALONG_Z },
    { geo: box(0.05, 1.5, 1.3), color: camo, p: [-1.22, 0, -2.3] },
    // tail boom rising to the fin, tailplane
    { geo: cyl(0.32, 0.75, 7.6, 10), color: olive, p: [0, 0.45, 8.1], r: [Math.PI / 2 + 0.06, 0, 0] },
    { geo: fin(1.6, 1.0, 2.6, 1.0, 0.25), color: olive, p: [0, 0.6, 11.6] },
    { geo: box(2.6, 0.08, 0.7), color: olive, p: [0, 0.55, 10.8] },
  ];
  // round windows down the cabin
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) parts.push({ geo: cyl(0.22, 0.22, 0.05, 8), color: 0x2a3a48, p: [side * 1.22, 0.35, -1.1 + i * 1.05], r: [0, 0, Math.PI / 2] });
  }
  // roundels on the cabin sides behind the doors
  for (const side of [-1, 1]) {
    parts.push({ geo: cyl(0.42, 0.42, 0.04, 12), color: ROUNDEL_GREEN, p: [side * 1.22, 0.4, 3.6], r: [0, 0, Math.PI / 2] });
    parts.push({ geo: cyl(0.23, 0.23, 0.04, 12), color: ROUNDEL_RED, p: [side * 1.245, 0.4, 3.6], r: [0, 0, Math.PI / 2] });
  }
  // fixed tricycle gear
  const gear = wheels([[-0.35, -1.75, -3.5], [0.35, -1.75, -3.5], [-1.6, -1.75, 1.4], [1.6, -1.75, 1.4]], 0.4, 0.3, 0.9);
  parts.push({ geo: gear });
  return {
    body: buildColored(parts),
    spinners: [
      { geo: rotor(5, 10.6, 0.52, 0.45), p: [0, 2.75, -0.2], axis: 'y', rate: -20 },
      { geo: tailRotor(3, 1.95), p: [0.4, 2.6, 12.6], axis: 'x', rate: 70 },
    ],
    gear: null,
    nav: [{ p: [-1.6, 0.2, 0.6], color: 0xff2a1a }, { p: [1.6, 0.2, 0.6], color: 0x2aff5a }, { p: [0, 0.6, 12.9], color: 0xffffff }],
    beacon: [[0, 2.45, 1.6], [0, -1.25, 0.6]],
    exhausts: [],
  };
}

/** Bell 212 "Twin Huey" in a civil white livery: big greenhouse nose, roof engines, skids, two-blade rotor. */
export function bell212(): AircraftModel {
  const white = 0xf1f2ef;
  const stripe = 0x1d4e89;
  const red = 0xc1121f;
  const parts: Part[] = [
    { geo: box(2.3, 1.9, 4.6), color: white, p: [0, 0, 0] },
    { geo: sph(1.15, 12, 8), color: white, p: [0, -0.05, -2.3], s: [1, 0.85, 1.2] },
    // raked two-piece windscreen, chin windows, cabin windows
    { geo: box(2.0, 0.95, 0.06), color: 0x2a3a48, p: [0, 0.35, -3.05], r: [0.65, 0, 0] },
    { geo: box(0.06, 0.97, 0.08), color: white, p: [0, 0.35, -3.07], r: [0.65, 0, 0] },
    { geo: box(1.5, 0.35, 0.06), color: 0x2a3a48, p: [0, -0.45, -3.45], r: [-0.5, 0, 0] },
    { geo: box(2.32, 0.6, 2.4), color: 0x2a3a48, p: [0, 0.35, 0.3] },
    // stripes
    { geo: box(2.34, 0.22, 4.6), color: stripe, p: [0, -0.4, 0] },
    { geo: box(2.34, 0.08, 4.6), color: red, p: [0, -0.6, 0] },
    // engine fairing, exhausts
    { geo: box(1.3, 0.6, 3.0), color: white, p: [0, 1.22, 0.8] },
    { geo: cyl(0.22, 0.22, 0.6, 8), color: 0x333333, p: [-0.5, 1.4, 2.6], r: ALONG_Z },
    { geo: cyl(0.22, 0.22, 0.6, 8), color: 0x333333, p: [0.5, 1.4, 2.6], r: ALONG_Z },
    // tail boom, small stabilisers, fin
    { geo: cyl(0.25, 0.6, 7.5, 10), color: white, p: [0, 0.3, 6.0], r: [Math.PI / 2 + 0.03, 0, 0] },
    { geo: box(0.1, 0.12, 7.4), color: stripe, p: [0, 0.3, 6.0] },
    { geo: box(2.4, 0.08, 0.6), color: white, p: [0, 0.3, 6.2] },
    { geo: fin(1.4, 0.7, 1.8, 0.9, 0.2), color: red, p: [0, 0.35, 8.9] },
  ];
  // skids with their cross tubes
  for (const side of [-1, 1]) {
    parts.push({ geo: cyl(0.07, 0.07, 3.8, 6), color: 0x777777, p: [side * 1.25, -1.45, -0.1], r: ALONG_Z });
    parts.push({ geo: cyl(0.07, 0.07, 0.5, 6), color: 0x777777, p: [side * 1.25, -1.33, -2.1], r: [Math.PI / 2 - 0.6, 0, 0] });
  }
  for (const z of [-1.0, 1.0]) parts.push({ geo: cyl(0.06, 0.06, 2.6, 6), color: 0x777777, p: [0, -1.2, z], r: [0, 0, Math.PI / 2] });
  return {
    body: buildColored(parts),
    spinners: [
      { geo: rotor(2, 7.3, 0.6, 0.35), p: [0, 1.95, 0.2], axis: 'y', rate: -30 },
      { geo: tailRotor(2, 1.3), p: [-0.25, 1.3, 9.9], axis: 'x', rate: 90 },
    ],
    gear: null,
    nav: [{ p: [-1.2, -0.2, 6.2], color: 0xff2a1a }, { p: [1.2, -0.2, 6.2], color: 0x2aff5a }, { p: [0, 2.2, 9.9], color: 0xffffff }],
    beacon: [[0, 1.75, 1.6], [0, -0.98, 0.5]],
    exhausts: [],
  };
}
