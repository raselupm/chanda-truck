// Real-design landmarks on the north and north-east routes (Sylhet, Netrokona, Munshiganj):
// - Sylhet: Shahjalal's dargah (white mosque and minaret, the tila with the grave, the gajar-fish pond, the gate),
//   Ali Amjad's red clock tower on the Surma, Keane Bridge (bow-shaped steel trusses over the Surma),
//   Teliapara's bullet-shaped memorial in the tea garden, Ashuganj power station (striped stacks on the Meghna)
//   and the fertiliser factory's prilling tower
// - Netrokona: Bangladesh Agricultural University, Shashi Lodge with the Venus fountain, Nazrul University,
//   the Safari Park gate with its animals, Jagroto Chowrongi, the Ijtema ground on the Turag, Shahjalal Airport
// - Munshiganj: Baba Adam's six-domed mosque, Idrakpur's Mughal water fort, Shah Cement's silos on the
//   Dhaleshwari, Fatullah stadium, the Pagla Mughal bridge ruins, Pagla sewage works, Mayor Hanif Flyover
// Frame (kit.ts): x = 0 at the road-facing edge, +x away from the road, -z toward Dhaka, right side only.

import * as THREE from 'three';
import { box, cone, cyl, ico } from '../../utils/geometry';
import type { LandmarkModel, LKit, V3 } from './kit';

const WHITE = 0xf1eee6;
const CREAM = 0xe6dcc4;
const CONCRETE = 0xb9b5aa;
const GREY = 0x8d8f8c;
const DARK = 0x2c3a44;
const BRICK = 0x9c4a32;
const BRICK_OLD = 0x8a5040;
const GRASS = 0x6f9a3e;
const EARTH = 0xa98c63;
const RIVER = 0x5a7f86;
const STEEL = 0x9aa3a8;
const BAMBOO = 0xb59a5a;
const GREEN_FLAG = 0x1f6b3a;
const TIN = 0x8f9493;

// ---------------------------------------------------------------- local helpers

const ZAXIS = new THREE.Vector3(0, 0, 1);

/** A square beam from a to b (truss members, arms, conveyors, rifle). */
function beam(kit: LKit, a: V3, b: V3, t: number, color: number, t2 = t): void {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  if (len < 1e-4) return;
  const q = new THREE.Quaternion().setFromUnitVectors(ZAXIS, d.normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  kit.add(box(t, t2, len), color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, [e.x, e.y, e.z]);
}

/** A turned shape (bullet, chimney, stack) from [radius, y] points, standing at (x, y0, z). */
function turned(kit: LKit, x: number, z: number, pts: [number, number][], color: number, y0 = 0, seg = 12): void {
  kit.add(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), color, x, y0, z);
}

/** A half-cylinder vault with its axis along x (a shell roof seen end-on from the road), rise ≤ r. */
function vaultX(kit: LKit, x: number, y0: number, z: number, r: number, len: number, color: number, rise = r): void {
  kit.add(new THREE.CylinderGeometry(r, r, len, 14, 1, false, 0, Math.PI), color, x, y0, z, [0, 0, Math.PI / 2], [rise / r, 1, 1]);
}

/** The same with its axis along z (a long shed roof parallel to the road). */
function vaultZ(kit: LKit, x: number, y0: number, z: number, r: number, len: number, color: number, rise = r): void {
  kit.add(new THREE.CylinderGeometry(r, r, len, 14, 1, false, -Math.PI / 2, Math.PI), color, x, y0, z, [-Math.PI / 2, 0, 0], [1, 1, rise / r]);
}

/** A tall chimney with painted bands (red/white on the old units) and a red light on top. */
function stack(kit: LKit, x: number, z: number, h: number, r: number, base: number, band?: number): void {
  kit.cylinder(x, z, r, h, base, 0, 12, r * 0.8);
  if (band !== undefined) for (let i = 0; i < 3; i++) kit.cylinder(x, z, r * (0.86 - i * 0.03) + 0.05, h * 0.07, band, h * (0.72 + i * 0.1), 12);
  kit.light(x, h + 0.5, z, 0xff3020);
}

/** A row of tea bushes: low flat-topped hedges with shade trees (Albizia) standing over them. */
function teaRows(kit: LKit, x0: number, x1: number, z0: number, z1: number): void {
  for (let x = x0; x < x1; x += 2.6) kit.block(x, (z0 + z1) / 2, 1.5, z1 - z0, 0.9, 0x3d7a32);
  for (let x = x0 + 4; x < x1; x += 13) {
    for (let z = z0 + 5; z < z1; z += 14) {
      const zz = z + (kit.rng() - 0.5) * 4;
      kit.cylinder(x, zz, 0.18, 7, 0xb8b0a0, 0, 5);
      kit.add(cyl(3.4, 2.6, 0.9, 7), 0x5f8f3a, x, 7.3, zz);
    }
  }
}

/** A road vehicle seen from above: a bus/truck box with a darker roof. */
function vehicle(kit: LKit, x: number, z: number, y0: number, len: number, color: number): void {
  kit.block(x, z, 2.4, len, 2.6, color, y0);
  kit.block(x, z, 2.2, len * 0.9, 0.12, 0x3a3a3a, y0 + 2.6);
}

/** A parked airliner, nose toward the road (-x), wings along z. */
function airliner(kit: LKit, x: number, z: number, tail: number, stripe: number, len = 38): void {
  const r = 2;
  kit.add(cyl(r, r, len * 0.78, 12), WHITE, x + len * 0.45, 3.6, z, [0, 0, Math.PI / 2]);
  kit.add(cone(r, 4, 12), WHITE, x + 2, 3.6, z, [0, 0, Math.PI / 2]);
  kit.add(cone(r, 6, 12), WHITE, x + len * 0.84 + 3, 3.9, z, [0, 0, -Math.PI / 2], [1, 1, 0.7]);
  kit.add(box(len * 0.76, 0.35, 0.22), stripe, x + len * 0.45, 3.3, z - r);
  kit.add(box(len * 0.76, 0.35, 0.22), stripe, x + len * 0.45, 3.3, z + r);
  kit.add(box(4.5, 0.4, len * 0.9), 0xdcdcdc, x + len * 0.48, 2.6, z, [0, 0, 0]);
  for (const s of [-1, 1]) kit.add(cyl(1.1, 1.1, 3.6, 10), GREY, x + len * 0.4, 1.7, z + s * len * 0.2, [0, 0, Math.PI / 2]);
  kit.add(box(4, 6.5, 0.35), tail, x + len * 0.9, 7.4, z, [0, 0, -0.35]);
  kit.add(box(3, 0.25, 12), WHITE, x + len * 0.94, 4.6, z);
  for (const [gx, gz] of [[x + 4, z], [x + len * 0.5, z - 2], [x + len * 0.5, z + 2]] as [number, number][]) kit.cylinder(gx, gz, 0.15, 1.6, DARK, 0, 6);
}

// ---------------------------------------------------------------- Sylhet

/** Hazrat Shahjalal's dargah: the gate, the white mosque and its minaret, the grave on the tila, the gajar-fish pond. */
const shahjalalDargah: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xd8cfb8);
  kit.compound(1, -L / 2 + 1, D - 1, L / 2 - 1, 2.6, WHITE, 0, 12);
  // the dargah gate: white with green trim, a pointed arch and two small minarets
  for (const s of [-1, 1]) {
    kit.block(3, s * 6.5, 3, 3, 9, WHITE);
    kit.cylinder(3, s * 6.5, 1.2, 3, WHITE, 9, 10);
    kit.dome(3, s * 6.5, 1.25, GREEN_FLAG, 12, 1.4, 10);
    kit.spire(3, s * 6.5, 0.15, 1.6, 0xd4af37, 13.7, 6);
  }
  kit.block(3, 0, 3, 10, 2.4, WHITE, 7.2);
  kit.block(3, 0, 3.2, 10.4, 0.4, GREEN_FLAG, 9.6);
  kit.add(cone(5, 3.2, 4), WHITE, 3, 7.4, 0, [0, 0, 0], [0.3, 1, 1.2]);
  kit.sign(['হযরত শাহজালাল (রহ.) এর দরগাহ'], 1.4, 8.4, 0, 9, 1.2, { bg: '#1f6b3a', fg: '#ffffff' }, -Math.PI / 2);
  kit.light(1.3, 7, -4.8);
  kit.light(1.3, 7, 4.8);
  // the path up to the tila
  kit.ground(18, 0, 30, 6, 0xc9c1ad, 0.07);
  // the white mosque: three storeys, arcaded front, a flat dome, and the tall slender minaret
  const mx = 30;
  const mz = L * 0.24;
  kit.block(mx, mz, 18, 22, 13, WHITE);
  for (let i = 0; i < 3; i++) kit.block(mx - 9.1, mz, 0.3, 22, 0.35, GREEN_FLAG, 4.2 + i * 4.3);
  kit.windows(mx - 9, mz - 11, mz + 11, 0.5, 3, 4.3, 0x3d5560, 3.2, 1.6, 2.6);
  kit.cylinder(mx, mz, 6, 2, WHITE, 13, 14);
  kit.dome(mx, mz, 6, WHITE, 15, 0.8, 16);
  kit.spire(mx, mz, 0.2, 2.4, 0xd4af37, 19.6, 6);
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.cylinder(mx + s * 8.6, mz + t * 10.6, 0.6, 2.5, WHITE, 13, 8);
  const nx = mx - 7;
  const nz = mz + 14;
  kit.cylinder(nx, nz, 1.8, 6, WHITE, 0, 12);
  kit.cylinder(nx, nz, 1.3, 30, WHITE, 6, 12, 1.1);
  for (const y of [14, 24, 34]) {
    kit.cylinder(nx, nz, 2, 0.4, WHITE, y, 12);
    kit.cylinder(nx, nz, 2, 0.6, GREEN_FLAG, y + 0.4, 12);
  }
  kit.cylinder(nx, nz, 1.6, 3, WHITE, 36, 12);
  kit.dome(nx, nz, 1.6, GREEN_FLAG, 39, 1.5, 12);
  kit.spire(nx, nz, 0.12, 2, 0xd4af37, 41.4, 6);
  kit.light(nx, 42.5, nz, 0x8fff9a);
  for (let i = 0; i < 4; i++) kit.light(mx - 9.3, 2.5 + i * 3, mz - 8 + i * 5);
  // the tila (hillock) with stairs, the grave under its canopy and a golden railing
  const tx = D * 0.62;
  const tz = -L * 0.06;
  kit.add(cyl(9, 15, 5, 14), 0x7d8f4f, tx, 2.5, tz);
  for (let i = 0; i < 8; i++) kit.block(tx - 15 + i * 0.75, tz, 0.8, 4, 0.6 * (i + 1), CREAM);
  kit.ground(tx, tz, 16, 16, 0xe7e2d6, 5.03);
  kit.compound(tx - 4, tz - 4, tx + 4, tz + 4, 1.1, 0xd4af37, tz, 2);
  kit.wall(tx - 4, tz - 4, tx - 4, tz + 4, 0.01, 0xd4af37);
  kit.block(tx, tz, 2.4, 1.3, 0.9, GREEN_FLAG, 5);
  kit.block(tx, tz, 2.6, 1.4, 0.12, 0x9c1c2a, 5.9);
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.cylinder(tx + s * 3.5, tz + t * 3.5, 0.18, 4, WHITE, 5, 6);
  kit.block(tx, tz, 8, 8, 0.4, WHITE, 9);
  kit.dome(tx, tz, 2.6, GREEN_FLAG, 9.4, 0.8, 12);
  kit.light(tx - 3.6, 8.6, tz);
  // the pond: dark water with stepped ghat and the gajar (giant snakehead) fish rising to be fed
  const px = D * 0.45;
  const pz = -L * 0.33;
  kit.block(px, pz, 22, 18, 0.3, CREAM);
  kit.water(px, pz, 19, 15, 0x355a4a);
  for (let i = 0; i < 4; i++) kit.block(px - 11 + i * 0.7, pz, 0.7, 8, 0.3 + i * 0.12, CREAM);
  for (let i = 0; i < 9; i++) {
    const fx = px - 7 + kit.rng() * 14;
    const fz = pz - 6 + kit.rng() * 12;
    kit.add(new THREE.SphereGeometry(0.5, 7, 5), 0x3b3b33, fx, 0.12, fz, [0, kit.rng() * 3, 0], [0.5, 0.35, 2]);
  }
  for (let i = 0; i < 5; i++) kit.person(px - 12.5, pz - 3 + i * 1.5, Math.PI / 2, { shirt: WHITE, lower: WHITE, cap: WHITE });
  // the Jalali pigeons on the court and pilgrims
  for (let i = 0; i < 26; i++) kit.add(new THREE.SphereGeometry(0.16, 6, 4), i % 3 ? 0x7d828c : 0xd8d8d8, 10 + kit.rng() * 12, 0.15, -5 + kit.rng() * 10, [0, 0, 0], [1, 0.8, 1.5]);
  for (let i = 0; i < 10; i++) kit.person(8 + kit.rng() * 16, -2.5 + kit.rng() * 5, kit.rng() * 6, { shirt: i % 3 ? WHITE : 0xd9cbb0, lower: WHITE, cap: i % 2 ? WHITE : undefined, lungi: i % 4 === 0 });
  kit.treeRow(D - 5, -L / 2 + 5, L / 2 - 5, 9, 1.1);
  kit.tree(12, -L * 0.3, 1.2);
  kit.tree(12, L * 0.4, 1.2);
  kit.flag(8, -9, 10);
};

/** Ali Amjad's clock (1874): a small red Victorian tower with four white faces and a tin dome, on the Surma bank. */
const aliAmjadClock: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(7, 0, 14, L, 0xc9c0ae);
  kit.water(D * 0.72, 0, D * 0.56, L, RIVER);
  kit.block(14.2, 0, 0.6, L, 1.1, CREAM);
  const x = 7;
  const RED = 0xb3302a;
  kit.block(x, 0, 6, 6, 0.8, CREAM);
  kit.block(x, 0, 4.6, 4.6, 4.4, RED, 0.8);
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.block(x + s * 2.2, t * 2.2, 0.5, 0.5, 4.4, WHITE, 0.8);
  // the arched openings at the base
  kit.block(x - 2.32, 0, 0.1, 1.6, 2.6, 0x3a2a24, 0.8);
  kit.add(cyl(0.8, 0.8, 0.1, 10), 0x3a2a24, x - 2.32, 3.4, 0, [0, 0, Math.PI / 2]);
  kit.block(x, 0, 5.2, 5.2, 0.4, WHITE, 5.2);
  // clock stage, faces on all four sides
  kit.block(x, 0, 4, 4, 3.2, RED, 5.6);
  for (const [fx, fz, ry] of [[x - 2.02, 0, 0], [x + 2.02, 0, 0], [x, -2.02, Math.PI / 2], [x, 2.02, Math.PI / 2]] as [number, number, number][]) {
    kit.add(cyl(1.25, 1.25, 0.1, 16), WHITE, fx, 7.2, fz, [0, ry, Math.PI / 2]);
    kit.add(cyl(1.38, 1.38, 0.06, 16), 0x2a2a2a, fx, 7.2, fz, [0, ry, Math.PI / 2]);
  }
  kit.add(box(0.12, 0.9, 0.1), 0x111111, x - 2.1, 7.5, 0);
  kit.add(box(0.12, 0.1, 0.7), 0x111111, x - 2.1, 7.2, 0.3);
  kit.block(x, 0, 4.6, 4.6, 0.35, WHITE, 8.8);
  // the corrugated tin dome and finial
  kit.add(new THREE.SphereGeometry(2.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0x7a3a2c, x, 9.15, 0, [0, Math.PI / 8, 0], [1, 1.25, 1]);
  kit.cylinder(x, 0, 0.35, 0.6, WHITE, 12.1, 8);
  kit.spire(x, 0, 0.18, 1.6, 0xd4af37, 12.7, 6);
  kit.light(x - 2.2, 7.2, 0, 0xfff7d6);
  // railing, lamps, people by the river, a couple of country boats
  for (let z = -L / 2 + 2; z < L / 2; z += 4) kit.cylinder(13.5, z, 0.08, 1, 0x333333, 0, 5);
  kit.add(box(0.08, 0.08, L - 3), 0x333333, 13.5, 1, 0);
  for (const z of [-10, 10]) {
    kit.cylinder(4, z, 0.1, 5, 0x333333, 0, 6);
    kit.light(4, 5.2, z);
  }
  for (let i = 0; i < 6; i++) kit.person(3 + kit.rng() * 9, -12 + kit.rng() * 24, kit.rng() * 6);
  for (const [bx, bz] of [[19, -6], [24, 8]] as [number, number][]) {
    kit.add(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x6b4a2e, bx, 0.6, bz, [0, 0, 0], [1.1, 0.7, 4.5]);
    vaultZ(kit, bx, 0.6, bz, 0.9, 3, 0x8a6a3e, 0.8);
  }
};

/** Keane Bridge (1936) over the Surma: steel through-trusses with bow-curved top chords, painted red. */
const keaneBridge: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(4, 0, 8, L, EARTH);
  kit.ground(D - 4, 0, 8, L, EARTH);
  kit.water(D / 2, 0, D - 12, L, RIVER);
  const RED = 0xa8382e;
  const spans = 4;
  const x0 = 4;
  const x1 = D - 4;
  const span = (x1 - x0) / spans;
  const deckY = 9;
  const hw = 3.4;
  // abutments, piers and the deck
  for (let i = 0; i <= spans; i++) {
    const px = x0 + i * span;
    kit.block(px, 0, i === 0 || i === spans ? 5 : 3, hw * 2 + 2, deckY - 0.6, CONCRETE);
    if (i > 0 && i < spans) kit.add(cyl(1.6, 1.6, deckY, 10), CONCRETE, px, deckY / 2 - 0.6, 0, [0, 0, 0], [1, 1, 2.6]);
  }
  kit.block(D / 2, 0, x1 - x0, hw * 2, 0.5, 0x6a6a68, deckY - 0.5);
  for (let i = 0; i < spans; i++) {
    const a = x0 + i * span;
    const n = 8;
    for (const s of [-1, 1]) {
      const z = s * hw;
      const top = (t: number): V3 => [a + t * span, deckY + 2 + Math.sin(t * Math.PI) * 6, z];
      const bot = (t: number): V3 => [a + t * span, deckY, z];
      beam(kit, bot(0), bot(1), 0.4, RED, 0.5);
      for (let j = 0; j < n; j++) {
        const t0 = j / n;
        const t1 = (j + 1) / n;
        beam(kit, top(t0), top(t1), 0.45, RED);
        beam(kit, bot(t1), top(t1), 0.25, RED);
        beam(kit, j < n / 2 ? bot(t0) : bot(t1), j < n / 2 ? top(t1) : top(t0), 0.2, RED);
      }
      beam(kit, bot(0), top(0), 0.45, RED);
    }
    // portal and top bracing
    for (let j = 1; j < 8; j += 2) {
      const t = j / 8;
      const y = deckY + 2 + Math.sin(t * Math.PI) * 6;
      kit.add(box(0.25, 0.25, hw * 2), RED, a + t * span, y, 0);
    }
  }
  // people walking (it is a footbridge now) and rickshaws
  for (let i = 0; i < 8; i++) kit.person(x0 + 6 + kit.rng() * (x1 - x0 - 12), (kit.rng() - 0.5) * 4, i % 2 ? Math.PI / 2 : -Math.PI / 2);
  for (let i = 0; i < spans + 1; i++) kit.light(x0 + i * span, deckY + 3, hw + 0.3);
  // country boats on the Surma
  for (const [bx, bz] of [[30, 30], [55, -28], [70, 20]] as [number, number][]) {
    kit.add(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x6b4a2e, bx, 0.6, bz, [0, 0, 0], [1.2, 0.7, 5]);
    vaultZ(kit, bx, 0.6, bz, 1, 3.5, 0x6d5a3a, 0.9);
  }
};

/** Teliapara's war memorial (1975): a tall white bullet on a stepped plinth among the tea bushes, the golden bullet at the gate. */
const teliapara: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0x7c9a48);
  teaRows(kit, 3, D - 2, -L / 2 + 2, -10);
  teaRows(kit, 34, D - 2, 10, L / 2 - 2);
  // the gate with the golden bullet
  kit.ground(14, 0, 28, 5, 0xc9c1ad, 0.07);
  for (const s of [-1, 1]) kit.block(3, s * 3.5, 1, 1, 3, WHITE);
  kit.block(3, 0, 1, 8, 0.8, 0x2f6a3a, 3);
  kit.block(6, 0, 1.6, 1.6, 0.8, 0x777777);
  turned(kit, 6, 0, [[0, 0], [0.5, 0], [0.5, 1.6], [0.45, 2.2], [0.3, 2.7], [0, 3.1]], 0xd4af37, 0.8, 12);
  // the memorial
  const mx = 22;
  for (let i = 0; i < 3; i++) kit.block(mx, 0, 12 - i * 3, 12 - i * 3, 0.6, i ? WHITE : 0x9a3d2a, i * 0.6);
  kit.block(mx, 0, 4, 4, 1.4, 0x2f6a3a, 1.8);
  turned(kit, mx, 0, [[0, 0], [1.5, 0], [1.6, 0.4], [1.5, 0.6], [1.5, 6.5], [1.35, 8.2], [1, 9.6], [0.5, 10.6], [0, 11]], WHITE, 3.2, 16);
  kit.cylinder(mx, 0, 1.62, 0.5, 0xd4af37, 3.2, 16);
  kit.sign(['তেলিয়াপাড়া স্মৃতিসৌধ'], mx - 6.1, 1.1, 0, 4.5, 0.8, { bg: '#2f2f2f', fg: '#ffffff' }, -Math.PI / 2);
  kit.flag(mx - 4, 5, 9);
  kit.light(mx - 2, 1, -2);
  kit.light(mx - 2, 1, 2);
  // the tea estate manager's bungalow (Sector HQ in 1971): white walls, red tin roof, verandah
  const bx = 42;
  const bz = -L * 0.18;
  kit.block(bx, bz, 10, 14, 4, WHITE, 0.8);
  kit.block(bx, bz, 11, 15, 0.8, CREAM);
  kit.add(cone(10, 3.2, 4), 0xa33a2c, bx, 6.4, bz, [0, Math.PI / 4, 0], [0.72, 1, 1]);
  for (let z = bz - 6; z <= bz + 6; z += 3) kit.cylinder(bx - 5.5, z, 0.15, 3.8, WHITE, 0.8, 6);
  kit.windows(bx - 5.05, bz - 6, bz + 6, 1, 1, 3.2, 0x3c4d55, 3, 1.1, 1.6);
  kit.light(bx - 5.3, 2.5, bz);
  for (let i = 0; i < 4; i++) kit.person(8 + i * 3, 2.6 + kit.rng(), Math.PI / 2, { shirt: 0xd9473a, lower: 0x4a4a8a });
};

/** Ashuganj power station on the Meghna: the old units' red/white stacks, boiler and turbine halls, combined-cycle units, switchyard. */
const ashuganjPower: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xa29d8e);
  kit.water(D - 7, 0, 14, L, RIVER);
  kit.compound(1, -L / 2 + 1, D - 15, L / 2 - 1, 2.6, CREAM, -L * 0.35, 10);
  kit.sign(['আশুগঞ্জ পাওয়ার স্টেশন কোম্পানি লিঃ'], 1.2, 3.6, -L * 0.35, 10, 1.2, { bg: '#1d4e89' }, -Math.PI / 2);
  // the old steam units: boiler houses, a long turbine hall, three banded stacks
  kit.block(40, 15, 14, 60, 18, 0xd8d2c2);
  kit.block(40, 15, 14.4, 60.4, 0.6, 0x2d5a8a, 18);
  kit.windows(32.9, -14, 44, 2, 3, 5, 0x50606a, 4, 2.4, 2);
  for (let i = 0; i < 3; i++) {
    const z = -5 + i * 20;
    kit.block(54, z, 14, 14, 30, i === 2 ? 0x9aa0a6 : 0xbfbab0);
    kit.block(54, z, 14.4, 14.4, 0.6, 0x2d5a8a, 30);
    stack(kit, 66, z, 72, 2.8, WHITE, 0xc8322a);
  }
  // newer combined-cycle units: gas turbines, HRSGs and their plain steel stacks
  for (let i = 0; i < 3; i++) {
    const z = -30 - i * 14;
    kit.block(30, z, 10, 9, 9, 0xe1e4e6);
    kit.block(42, z, 12, 8, 22, 0x7b8a96);
    stack(kit, 49, z, 46, 2.2, STEEL);
  }
  // switchyard and the line towers marching off
  for (let x = 14; x < 30; x += 5) for (let z = 26; z < L / 2 - 6; z += 6) {
    kit.block(x, z, 1.4, 2.6, 2, 0x6c6f73);
    beam(kit, [x, 0, z - 1.5], [x, 8, z - 1.5], 0.3, STEEL);
  }
  for (let i = 0; i < 2; i++) {
    const z = 30 + i * 16;
    kit.add(cone(3.2, 34, 4), STEEL, 10, 17, z, [0, Math.PI / 4, 0]);
    kit.add(box(0.3, 0.3, 12), STEEL, 10, 26, z);
    kit.add(box(0.3, 0.3, 9), STEEL, 10, 31, z);
  }
  // cooling-water intake and a barge on the Meghna
  kit.block(D - 18, 0, 8, 12, 2.5, CONCRETE);
  kit.block(D - 6, -L * 0.25, 6, 26, 2, 0x3a3f46);
  kit.block(D - 6, -L * 0.25 + 9, 4, 5, 3, WHITE, 2);
  for (let z = -L / 2 + 10; z < L / 2; z += 30) kit.light(34, 8, z);
};

/** Ashuganj fertiliser factory: the tall concrete urea prilling tower, the vaulted bulk-urea store, reformer stack and tanks. */
const ashuganjFertilizer: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xa7a195);
  kit.compound(1, -L / 2 + 1, D - 1, L / 2 - 1, 2.6, CREAM, L * 0.3, 10);
  kit.treeRow(4, -L / 2 + 6, L / 2 - 20, 8, 0.9);
  // prilling tower: a tall pale cylinder with the top housing and the conveyor gallery
  const px = 40;
  const pz = -L * 0.15;
  kit.cylinder(px, pz, 7, 72, 0xd9d5cc, 0, 16);
  kit.cylinder(px, pz, 7.4, 1, 0x2d6a4a, 60, 16);
  kit.block(px, pz, 11, 11, 7, 0xe8e4da, 72);
  kit.block(px, pz, 11.4, 11.4, 0.6, 0x2d6a4a, 79);
  kit.block(px, pz - 9, 3, 4, 74, 0xc9c4b8);
  beam(kit, [px + 5, 6, pz + 5], [px + 22, 14, pz + 26], 2.4, 0x8a8f94, 2.2);
  kit.light(px, 80.5, pz, 0xff3020);
  kit.light(px - 6, 30, pz);
  // the bulk urea store: a long vaulted shed
  vaultZ(kit, px + 22, 0, pz + 38, 10, 40, 0xc7cdd1, 9);
  // reformer, stack, ammonia tanks and cooling-tower cells
  kit.block(18, L * 0.22, 12, 18, 14, 0x8e9aa4);
  stack(kit, 18, L * 0.22 + 12, 52, 1.8, 0xd9d5cc, 0xc8322a);
  for (let i = 0; i < 2; i++) kit.ball(D - 16, 9, -L / 2 + 12 + i * 15, 6.5, WHITE, 12);
  for (let i = 0; i < 2; i++) for (const s of [-1, 1]) kit.cylinder(D - 16 + s * 2.2, -L / 2 + 12 + i * 15, 0.4, 3, GREY, 0, 6);
  for (let i = 0; i < 4; i++) {
    kit.block(18, -L * 0.36 + i * 8, 10, 7.6, 7, 0x8b9590);
    kit.cylinder(18, -L * 0.36 + i * 8, 2.6, 2, 0x6a746f, 7, 10, 3);
  }
  beam(kit, [24, 6, L * 0.22], [34, 6, pz], 1.6, 0x7d858a, 1.2);
};

// ---------------------------------------------------------------- Netrokona – Mymensingh – Gazipur

/** Bangladesh Agricultural University: the gate, red-brick halls, research plots and the avenue to the Brahmaputra. */
const bau: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, GRASS);
  kit.compound(1, -L / 2 + 1, D - 1, L / 2 - 1, 1.8, 0xb75a3c, 0, 14);
  // the gate: two tall pylons, a wide arch and the name in Bangla
  for (const s of [-1, 1]) {
    kit.block(3, s * 8.5, 2.4, 2.4, 10, 0xb75a3c);
    kit.block(3, s * 8.5, 2.8, 2.8, 0.5, WHITE, 10);
  }
  kit.add(new THREE.TorusGeometry(7.5, 0.6, 6, 20, Math.PI), WHITE, 3, 6.2, 0, [0, Math.PI / 2, 0]);
  kit.block(3, 0, 1.2, 15, 1.6, 0x245a2f, 9.2);
  kit.sign(['বাংলাদেশ কৃষি বিশ্ববিদ্যালয়'], 2.3, 10, 0, 13, 1.3, { bg: '#245a2f', fg: '#ffffff' }, -Math.PI / 2);
  kit.light(2, 9, -8.5);
  kit.light(2, 9, 8.5);
  kit.ground(D / 2, 0, D - 4, 8, 0x5a5a58, 0.07);
  for (let x = 14; x < D - 6; x += 9) {
    kit.tree(x, -6, 1.1);
    kit.tree(x, 6, 1.1);
  }
  // the administration building and academic blocks: red brick with white bands
  kit.block(D * 0.62, -L * 0.25, 14, 32, 13, 0xb05a40);
  for (let i = 1; i < 4; i++) kit.block(D * 0.62 - 7.05, -L * 0.25, 0.2, 32, 0.4, WHITE, i * 3.3);
  kit.windows(D * 0.62 - 7, -L * 0.25 - 16, -L * 0.25 + 16, 0.4, 4, 3.3, 0x34414a, 2.8, 1.3, 1.8);
  kit.block(D * 0.62, -L * 0.25, 4, 6, 18, 0xb05a40);
  kit.block(D * 0.62, -L * 0.25, 4.5, 6.5, 0.5, WHITE, 18);
  kit.block(D * 0.4, L * 0.3, 12, 24, 10, 0xc4744f);
  kit.windows(D * 0.4 - 6, L * 0.3 - 12, L * 0.3 + 12, 0.4, 3, 3.3, 0x34414a, 2.8, 1.3, 1.8);
  // research plots in strips and a pond
  const plot = [0x7fb04a, 0xa8c75a, 0x4f8a34, 0xcdb862];
  for (let i = 0; i < 6; i++) kit.ground(D * 0.82, L * 0.08 + i * 5.5 - 6, 18, 5, plot[i % 4], 0.08);
  kit.water(D * 0.82, L * 0.38, 16, 12, 0x4f7f82);
  for (let i = 0; i < 6; i++) kit.person(10 + kit.rng() * 20, -3 + kit.rng() * 6, kit.rng() * 6, { shirt: [0xffffff, 0x5a7fbf, 0xd9473a][i % 3] });
  kit.flag(8, 13, 9);
};

/** Shashi Lodge (Mymensingh Rajbari): two-storey salmon-red mansion with white trim, a portico, and the Venus fountain on the lawn. */
const shashiLodge: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, GRASS);
  kit.compound(1, -L / 2 + 1, D - 1, L / 2 - 1, 2.2, WHITE, 0, 6);
  for (const s of [-1, 1]) kit.block(1, s * 3.5, 1.2, 1.2, 3.4, WHITE);
  kit.ground(12, 0, 22, 4, 0xcfc4ab, 0.07);
  // the fountain: round white basin, pedestal and the marble Venus
  const fx = 18;
  kit.cylinder(fx, 0, 5, 0.7, WHITE, 0, 20);
  kit.water(fx, 0, 8, 8, 0x6c9ab0);
  kit.cylinder(fx, 0, 1, 1.6, WHITE, 0, 10, 0.7);
  kit.cylinder(fx, 0, 1.6, 0.25, WHITE, 1.6, 12);
  turned(kit, fx, 0, [[0, 0], [0.45, 0], [0.38, 0.8], [0.32, 1.2], [0.25, 1.6], [0.2, 1.9], [0.12, 2.1], [0.16, 2.3], [0.13, 2.45], [0, 2.5]], 0xf6f3ee, 1.85, 10);
  kit.light(fx - 1.6, 1.2, 0, 0xcfe8ff);
  // the mansion
  const mx = 38;
  const W = 14;
  const len = L * 0.7;
  const SALMON = 0xc56a5c;
  kit.block(mx, 0, W, len, 1, CREAM);
  kit.block(mx, 0, W, len, 10, SALMON, 1);
  kit.block(mx, 0, W + 0.6, len + 0.6, 0.5, WHITE, 5.8);
  kit.block(mx, 0, W + 0.8, len + 0.8, 0.6, WHITE, 11);
  // roof balustrade
  for (let z = -len / 2 + 1; z <= len / 2 - 1; z += 1.2) kit.block(mx - W / 2 - 0.1, z, 0.25, 0.25, 0.9, WHITE, 11.6);
  kit.block(mx - W / 2 - 0.1, 0, 0.35, len, 0.25, WHITE, 12.5);
  // pilasters and tall shuttered windows
  for (let z = -len / 2 + 2; z <= len / 2 - 2; z += 4) kit.block(mx - W / 2 - 0.05, z, 0.3, 0.7, 10, WHITE, 1);
  kit.windows(mx - W / 2, -len / 2 + 2, len / 2 - 2, 1.8, 2, 5, 0x3e6b52, 4, 1.4, 2.6);
  // the central portico: columns, an upper verandah and a pediment
  const pz = 0;
  kit.block(mx - W / 2 - 3, pz, 6, 12, 0.8, CREAM, 0.2);
  for (const z of [-5, -2, 2, 5]) {
    kit.cylinder(mx - W / 2 - 5.4, pz + z, 0.4, 9.8, WHITE, 1, 10);
  }
  kit.block(mx - W / 2 - 3, pz, 6, 12, 0.5, WHITE, 5.8);
  kit.block(mx - W / 2 - 3, pz, 6.2, 12.4, 0.8, WHITE, 10.8);
  kit.add(cone(7.4, 2.6, 3), WHITE, mx - W / 2 - 5.5, 12.9, pz, [0, 0, 0], [0.12, 1, 1]);
  kit.add(cone(6.8, 2.2, 3), SALMON, mx - W / 2 - 5.45, 12.8, pz, [0, 0, 0], [0.12, 1, 1]);
  kit.light(mx - W / 2 - 1, 3, -3);
  kit.light(mx - W / 2 - 1, 3, 3);
  kit.light(mx - W / 2 - 0.2, 7.5, -12);
  kit.treeRow(D - 5, -L / 2 + 5, L / 2 - 5, 10, 1.3);
  for (const z of [-L * 0.36, L * 0.36]) kit.tree(10, z, 1.4);
  for (const z of [-L * 0.22, L * 0.22]) kit.palm(14, z, 1.1);
  for (let i = 0; i < 4; i++) kit.person(10 + kit.rng() * 10, -8 + kit.rng() * 16, kit.rng() * 6);
};

/** Jatiya Kabi Kazi Nazrul Islam University, Trishal: the gate, red-and-white academic blocks, the Shaheed Minar and the lake. */
const nazrulUniversity: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, GRASS);
  kit.compound(1, -L / 2 + 1, D - 1, L / 2 - 1, 1.8, WHITE, 0, 12);
  // the gate: two angled red slabs and a beam with the name, Nazrul's signature colours (red, white)
  for (const s of [-1, 1]) {
    kit.add(box(2, 9, 3.2), 0xa8302a, 3, 4.5, s * 7.5, [s * 0.12, 0, 0]);
    kit.block(3, s * 7.5, 2.4, 0.5, 9.6, WHITE);
  }
  kit.block(3, 0, 1.4, 17, 1.8, WHITE, 8.2);
  kit.sign(['জাতীয় কবি কাজী নজরুল ইসলাম বিশ্ববিদ্যালয়'], 2.25, 9.1, 0, 15, 1.4, { bg: '#ffffff', fg: '#a8302a' }, -Math.PI / 2);
  kit.light(2, 7.5, -7.5);
  kit.light(2, 7.5, 7.5);
  kit.ground(D * 0.4, 0, D * 0.7, 7, 0x5a5a58, 0.07);
  // academic blocks
  for (const [bx, bz, h] of [[D * 0.55, -L * 0.28, 18], [D * 0.62, L * 0.27, 15], [D * 0.86, 0, 12]] as [number, number, number][]) {
    kit.block(bx, bz, 14, 26, h, 0xece6da);
    for (let y = 3.6; y < h; y += 3.6) kit.block(bx - 7.05, bz, 0.2, 26, 0.5, 0xb03a2e, y);
    kit.windows(bx - 7, bz - 13, bz + 13, 0.5, Math.floor(h / 3.6), 3.6, 0x34414a, 2.6, 1.4, 1.8);
    kit.light(bx - 7.2, h * 0.5, bz + 3);
  }
  // the Shaheed Minar: five white pillars, the middle one bent, a red disc behind
  const sx = D * 0.3;
  const sz = L * 0.22;
  kit.block(sx, sz, 6, 10, 0.8, WHITE);
  kit.add(cyl(2.6, 2.6, 0.2, 16), 0xc8322a, sx + 2.2, 4.5, sz, [0, 0, Math.PI / 2]);
  for (const [z, h] of [[-3.4, 3.5], [-1.8, 4.5], [1.8, 4.5], [3.4, 3.5]] as [number, number][]) kit.block(sx + 1, sz + z, 0.4, 0.7, h, WHITE, 0.8);
  kit.block(sx + 1, sz, 0.4, 2.4, 6, WHITE, 0.8);
  kit.block(sx + 0.5, sz, 1.4, 2.4, 0.4, WHITE, 6.6, 0);
  // the lake
  kit.water(D * 0.3, -L * 0.3, 16, 20, 0x4f7f82);
  kit.treeRow(D - 4, -L / 2 + 5, L / 2 - 5, 9, 1.1);
  for (let i = 0; i < 7; i++) kit.person(8 + kit.rng() * 22, -3 + kit.rng() * 6, kit.rng() * 6, { shirt: [0xffffff, 0xd9473a, 0x5a7fbf][i % 3] });
};

/** One sculpted animal for the Safari Park gate (simple blocks, painted). */
function giraffe(kit: LKit, x: number, z: number, y0: number, h = 5.5): void {
  const c = 0xd9a441;
  const s = h / 5.5;
  for (const [dx, dz] of [[-0.5, -0.9], [0.5, -0.9], [-0.5, 0.9], [0.5, 0.9]]) kit.block(x + dx * s, z + dz * s, 0.25 * s, 0.25 * s, 2 * s, c, y0);
  kit.add(box(1.2 * s, 1.1 * s, 2.4 * s), c, x, y0 + 2.5 * s, z, [0.15, 0, 0]);
  beam(kit, [x, y0 + 2.7 * s, z - 0.9 * s], [x, y0 + 5 * s, z - 1.7 * s], 0.45 * s, c);
  kit.add(box(0.5 * s, 0.5 * s, 1 * s), c, x, y0 + 5.1 * s, z - 2.1 * s);
  for (let i = 0; i < 6; i++) kit.add(box(1.22 * s, 0.3 * s, 0.4 * s), 0x8a5a2a, x, y0 + 2.6 * s + (i % 2) * 0.3 * s, z - 0.9 * s + i * 0.38 * s);
}

function elephant(kit: LKit, x: number, z: number, y0: number): void {
  const c = 0x7c7a78;
  for (const [dx, dz] of [[-0.8, -1.2], [0.8, -1.2], [-0.8, 1.2], [0.8, 1.2]]) kit.block(x + dx, z + dz, 0.8, 0.8, 1.8, c, y0);
  kit.add(box(2.4, 2.2, 3.6), c, x, y0 + 2.8, z);
  kit.add(box(1.8, 1.8, 1.4), c, x, y0 + 3.2, z - 2.3);
  for (const s of [-1, 1]) kit.add(box(0.2, 1.5, 1.2), c, x + s * 1.1, y0 + 3.2, z - 2);
  beam(kit, [x, y0 + 2.8, z - 3], [x, y0 + 0.6, z - 3.4], 0.45, c);
  for (const s of [-1, 1]) beam(kit, [x + s * 0.5, y0 + 2.5, z - 2.9], [x + s * 0.5, y0 + 2.4, z - 3.8], 0.15, 0xf1eadc);
}

function tiger(kit: LKit, x: number, z: number, y0: number): void {
  const c = 0xe08a2e;
  for (const [dx, dz] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]]) kit.block(x + dx, z + dz, 0.25, 0.25, 0.7, c, y0);
  kit.add(box(0.8, 0.7, 2), c, x, y0 + 1.05, z);
  for (let i = 0; i < 4; i++) kit.add(box(0.82, 0.72, 0.12), 0x2a2018, x, y0 + 1.05, z - 0.6 + i * 0.4);
  kit.add(box(0.7, 0.65, 0.6), c, x, y0 + 1.3, z - 1.2);
  beam(kit, [x, y0 + 1.2, z + 1], [x, y0 + 0.5, z + 1.9], 0.12, c);
}

/** The Safari Park, Baghertal: a big gate with sculpted giraffes, elephant and tiger, the ticket booths and the sal forest. */
const safariPark: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0x5c7f38);
  kit.ground(9, 0, 16, 40, 0x8b7a5e, 0.07);
  // the gate: rock-look pylons and a long beam, animals on and beside it
  const ROCK = 0x9b8a72;
  for (const s of [-1, 1]) {
    kit.block(6, s * 9, 4, 5, 9, ROCK);
    kit.add(ico(2.8), 0x8a7a64, 6, 9.5, s * 9, [0.3, 0.5, 0], [1, 0.6, 1]);
  }
  kit.block(6, 0, 2.4, 22, 2.4, 0x6b4a2e, 8.6);
  kit.block(6, 0, 2.6, 22.4, 0.5, 0x3d6a2a, 11);
  giraffe(kit, 6, -3.5, 11.5, 6);
  giraffe(kit, 6, 3, 11.5, 5);
  elephant(kit, 7, -16, 0);
  tiger(kit, 4.5, 15.5, 0);
  tiger(kit, 6, 17.5, 0);
  kit.block(4.5, 15.5, 2, 3, 0.4, ROCK);
  for (const z of [-24, 24]) {
    kit.block(10, z, 4, 6, 3, 0xd8c8a8);
    kit.add(cone(4.6, 1.6, 4), 0x6b4a2e, 10, 3.8, z, [0, Math.PI / 4, 0]);
  }
  kit.light(4, 8, -9);
  kit.light(4, 8, 9);
  // fence and the sal forest behind
  kit.wall(18, -L / 2 + 1, 18, -12, 2.4, 0x5b5b55, 0.15);
  kit.wall(18, 12, 18, L / 2 - 1, 2.4, 0x5b5b55, 0.15);
  for (let i = 0; i < 46; i++) {
    const x = 22 + kit.rng() * (D - 25);
    const z = -L / 2 + 3 + kit.rng() * (L - 6);
    kit.cylinder(x, z, 0.25, 8, 0x5b4a36, 0, 5);
    kit.add(ico(2.6), [0x3b6a2a, 0x4a7a30, 0x557f34][i % 3], x, 9.5, z, [0, 0, 0], [1, 1.3, 1]);
  }
  for (let i = 0; i < 8; i++) kit.person(3 + kit.rng() * 10, -8 + kit.rng() * 16, kit.rng() * 6, { shirt: [0xffffff, 0xd9473a, 0x5a7fbf, 0xf2c94c][i % 4] });
};

/** Jagroto Chowrongi (1973), Joydebpur: a freedom fighter, grenade raised in the right hand, rifle in the left, on a tall pedestal. */
const jagrotoChowrongi: LandmarkModel = (kit) => {
  const D = kit.depth;
  const cx = D / 2;
  const STATUE = 0x6a6256;
  kit.cylinder(cx, 0, 10.5, 0.45, 0x2a2a2a, 0, 24);
  kit.cylinder(cx, 0, 10, 0.5, GRASS, 0, 24);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    kit.add(box(0.5, 0.48, 2.6), i % 2 ? 0xf2c94c : 0x222222, cx + Math.sin(a) * 10.3, 0.24, Math.cos(a) * 10.3, [0, a, 0]);
  }
  // the stepped base and the pedestal with the martyrs' plaques
  kit.block(cx, 0, 8, 8, 0.8, 0xd8d2c4);
  kit.block(cx, 0, 6, 6, 0.8, 0xd8d2c4, 0.8);
  kit.block(cx, 0, 3.4, 3.4, 5.8, 0xe6e0d2, 1.6);
  kit.block(cx - 1.75, 0, 0.1, 2.4, 2.6, 0x2a2a2a, 2.6);
  kit.block(cx, 0, 4, 4, 0.5, 0xd8d2c4, 7.4);
  // the figure, about 5.5 m: facing the road (-x); his right is -z
  const y0 = 7.9;
  const s = 3;
  for (const t of [-1, 1]) beam(kit, [cx + t * 0.08 * s, y0, t * 0.2 * s], [cx, y0 + 0.82 * s, t * 0.11 * s], 0.15 * s, STATUE);
  kit.add(box(0.3 * s, 0.36 * s, 0.42 * s), STATUE, cx, y0 + 0.8 * s, 0);
  kit.add(box(0.24 * s, 0.56 * s, 0.42 * s), STATUE, cx, y0 + 1.25 * s, 0);
  kit.add(box(0.13 * s, 0.14 * s, 0.13 * s), STATUE, cx, y0 + 1.58 * s, 0);
  kit.ball(cx, y0 + 1.74 * s, 0, 0.12 * s, STATUE, 10);
  // right arm thrown up with the grenade
  beam(kit, [cx, y0 + 1.48 * s, -0.24 * s], [cx - 0.06 * s, y0 + 1.82 * s, -0.36 * s], 0.09 * s, STATUE);
  beam(kit, [cx - 0.06 * s, y0 + 1.82 * s, -0.36 * s], [cx - 0.12 * s, y0 + 2.2 * s, -0.4 * s], 0.08 * s, STATUE);
  kit.ball(cx - 0.12 * s, y0 + 2.27 * s, -0.4 * s, 0.07 * s, STATUE, 8);
  // left arm down, gripping the rifle
  beam(kit, [cx, y0 + 1.48 * s, 0.24 * s], [cx - 0.1 * s, y0 + 1.08 * s, 0.3 * s], 0.09 * s, STATUE);
  beam(kit, [cx - 0.1 * s, y0 + 1.08 * s, 0.3 * s], [cx - 0.2 * s, y0 + 0.92 * s, 0.32 * s], 0.08 * s, STATUE);
  beam(kit, [cx - 0.08 * s, y0 + 0.3 * s, 0.36 * s], [cx - 0.28 * s, y0 + 1.5 * s, 0.34 * s], 0.05 * s, STATUE);
  beam(kit, [cx - 0.08 * s, y0 + 0.3 * s, 0.36 * s], [cx - 0.12 * s, y0 + 0.62 * s, 0.36 * s], 0.08 * s, STATUE);
  for (const z of [-2, 2]) kit.light(cx - 4.2, 0.6, z, 0xfff2c4);
  kit.light(cx - 1.5, 8, 0);
  kit.flag(cx + 5, 6, 8);
};

/** The Bishwa Ijtema ground at Tongi: a vast field under a patchwork tarpaulin roof on bamboo, the Turag and pontoon bridges. */
const ijtemaGround: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xbfae84);
  const riverW = 14;
  kit.water(D - riverW / 2, 0, riverW, L, RIVER);
  // the shamiana: rows of tarps on bamboo, ridged along x, each about 4–6 m up
  const x0 = 6;
  const x1 = D - riverW - 4;
  const z0 = -L / 2 + 4;
  const z1 = L / 2 - 4;
  const bay = 12;
  const tarps = [0xe8e2d2, 0xdcd6c4, 0xd4cbb6, 0xe8e2d2, 0x9fb5c4, 0xe0d8c6];
  for (let z = z0; z < z1 - 1; z += bay) {
    for (let x = x0; x < x1 - 1; x += 18) {
      const w = Math.min(18, x1 - x);
      const c = tarps[Math.floor(kit.rng() * tarps.length)];
      for (const sgn of [-1, 1]) kit.add(box(w, 0.08, bay / 2 + 0.3), c, x + w / 2, 5.2, z + bay / 2 + (sgn * bay) / 4, [sgn * 0.17, 0, 0]);
    }
  }
  // bamboo poles along the road edge and a sparse grid inside
  for (let z = z0; z <= z1; z += bay / 2) kit.add(cyl(0.09, 0.11, 4.4, 5), BAMBOO, x0, 2.2, z);
  for (let x = x0 + 18; x < x1; x += 18) for (let z = z0 + bay / 2; z < z1; z += bay) kit.add(cyl(0.09, 0.11, 6.2, 5), BAMBOO, x, 3.1, z);
  // the khitta (zone) number posts, loudspeaker masts and lights
  for (let z = z0 + 6; z < z1; z += 36) {
    kit.add(cyl(0.1, 0.1, 9, 5), BAMBOO, x0 - 1, 4.5, z);
    kit.add(cone(0.4, 0.8, 6), 0xd9d9d9, x0 - 1.3, 8.6, z, [0, 0, Math.PI / 2]);
    kit.block(x0 - 1.2, z, 0.1, 1.8, 1.2, 0xffffff, 6);
    kit.light(x0 - 0.8, 4.6, z);
  }
  // worshippers on the mats, walking in along the front
  for (let i = 0; i < 26; i++) kit.person(x0 - 3 + kit.rng() * 22, z0 + kit.rng() * (z1 - z0), kit.rng() * 6, { shirt: WHITE, lower: WHITE, cap: WHITE, lungi: i % 3 === 0 });
  // the army's pontoon bridges over the Turag
  for (const z of [-L * 0.25, L * 0.25]) {
    kit.block(D - riverW / 2, z, riverW, 4, 0.6, 0x5a5a4e);
    for (let x = D - riverW; x < D - 3.4; x += 3.4) kit.cylinder(x + 1.7, z, 1.3, 0.5, 0x3d4a3a, 0, 8);
  }
};

/** Hazrat Shahjalal International Airport: the terminal's repeated shell vaults, the elevated drive, control tower, aircraft at the gates. */
const shahjalalAirport: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0x8a9a6a);
  // the elevated departures drive on round piers
  kit.block(10, 0, 9, L * 0.82, 0.8, CONCRETE, 7);
  for (let z = -L * 0.38; z <= L * 0.38; z += 16) kit.cylinder(10, z, 0.9, 7, CONCRETE, 0, 10);
  kit.block(6, 0, 0.3, L * 0.82, 1, WHITE, 7.8);
  vehicle(kit, 9, -20, 7.8, 10, 0x2a6ab0);
  vehicle(kit, 11.5, 14, 7.8, 4.5, 0xf2f2f2);
  vehicle(kit, 8.5, 30, 7.8, 4.5, 0xf2c94c);
  // the terminal: glass front, then a row of white concrete shell vaults (seen end-on from the road)
  const tx = 16;
  const tW = 34;
  const tL = L * 0.8;
  kit.block(tx + tW / 2, 0, tW, tL, 11, 0xdedbd2);
  kit.block(tx + 0.1, 0, 0.3, tL, 9, 0x5e7f92, 1);
  const n = 11;
  const vw = tL / n;
  for (let i = 0; i < n; i++) {
    const z = -tL / 2 + vw * (i + 0.5);
    vaultX(kit, tx + tW / 2, 11, z, vw / 2 - 0.2, tW + 2, WHITE, 4);
    kit.add(cyl(0.3, 0.6, 11, 6), WHITE, tx - 0.5, 5.5, z - vw / 2);
  }
  kit.sign(['হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর'], tx - 0.4, 13.5, 0, 26, 2, { bg: '#ffffff', fg: '#0b4f8a' }, -Math.PI / 2);
  for (let z = -tL / 2 + 6; z < tL / 2; z += 14) kit.light(tx - 0.4, 5, z);
  // jet bridges and the aircraft
  const ax = tx + tW + 6;
  const planes: [number, number, number][] = [[0xc8102e, 0x0b7a3e, -L * 0.3], [0x1d4f9a, 0x1d4f9a, -L * 0.05], [0xc8102e, 0x0b7a3e, L * 0.22]];
  kit.ground(ax + 22, 0, 48, L, 0x9c9c96, 0.06);
  for (const [tail, stripe, z] of planes) {
    beam(kit, [tx + tW, 4.5, z - 6], [ax + 2, 4.2, z - 6], 2.6, 0xc9cdd0, 2.8);
    kit.cylinder(ax + 1, z - 6, 0.3, 4, GREY, 0, 6);
    airliner(kit, ax + 3, z, tail, stripe);
  }
  // the runway at the back
  kit.ground(D - 9, 0, 16, L, 0x55565a, 0.08);
  for (let z = -L / 2 + 6; z < L / 2; z += 14) kit.ground(D - 9, z, 0.6, 7, WHITE, 0.1);
  // control tower: a tall white shaft, flared cab with green glass, radar on top
  const cx = tx + tW + 2;
  const cz = L * 0.42;
  kit.cylinder(cx, cz, 2.4, 44, WHITE, 0, 12, 1.8);
  kit.cylinder(cx, cz, 3.8, 1, WHITE, 44, 10);
  kit.cylinder(cx, cz, 4, 3.4, 0x3f6a6a, 45, 10, 4.6);
  kit.cylinder(cx, cz, 4.8, 0.8, WHITE, 48.4, 10);
  kit.cylinder(cx, cz, 0.2, 5, GREY, 49.2, 6);
  kit.add(box(0.3, 1.2, 3.4), GREY, cx, 54, cz);
  kit.light(cx, 54.8, cz, 0xff3020);
  for (let i = 0; i < 4; i++) kit.light(cx - 4, 46.5, cz - 1.5 + i, 0x9fffd0);
};

// ---------------------------------------------------------------- Munshiganj – Narayanganj

/** Baba Adam's mosque (1483), Rampal: Sultanate red brick, six domes in two rows, octagonal corner towers, three arched doors. */
const babaAdamMosque: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, GRASS);
  kit.ground(12, 0, 10, 20, 0xc4b498, 0.07);
  const mx = 22;
  const w = 13;
  const l = 16;
  kit.block(mx, 0, w + 1.4, l + 1.4, 0.6, 0x8a5a40);
  kit.block(mx, 0, w, l, 6.4, BRICK, 0.6);
  // the curved Bengal cornice: a gentle arc along the long face
  for (let i = 0; i < 8; i++) {
    const z = -l / 2 + (i + 0.5) * (l / 8);
    const lift = Math.sin(((i + 0.5) / 8) * Math.PI) * 0.5;
    kit.block(mx, z, w + 0.4, l / 8 + 0.02, 0.5, 0x7d3a28, 7 + lift - 0.25);
  }
  // corner towers
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    kit.cylinder(mx + s * w / 2, t * l / 2, 0.9, 7.6, 0x8f4430, 0, 8);
    kit.cylinder(mx + s * w / 2, t * l / 2, 1, 0.3, 0x7d3a28, 2.5, 8);
    kit.cylinder(mx + s * w / 2, t * l / 2, 1, 0.3, 0x7d3a28, 5, 8);
    kit.dome(mx + s * w / 2, t * l / 2, 0.9, 0x8f4430, 7.6, 0.8, 8);
  }
  // six domes: two rows of three
  for (const dx of [-w / 4, w / 4]) for (const dz of [-l / 3, 0, l / 3]) {
    kit.cylinder(mx + dx, dz, 2.6, 0.6, 0x8f4430, 7.2, 12);
    kit.dome(mx + dx, dz, 2.6, 0x94503a, 7.8, 0.85, 12);
  }
  // three pointed-arch doorways with terracotta panels between them
  for (const z of [-l / 3, 0, l / 3]) {
    kit.block(mx - w / 2 - 0.05, z, 0.12, 1.6, 2.6, 0x2a1d18, 0.6);
    kit.add(cone(0.8, 1, 4), 0x2a1d18, mx - w / 2 - 0.05, 3.7, z, [0, Math.PI / 4, 0], [0.1, 1, 1]);
    kit.block(mx - w / 2 - 0.08, z, 0.1, 2.4, 0.3, 0xb0654a, 4.6);
  }
  for (const z of [-l / 6, l / 6]) kit.block(mx - w / 2 - 0.06, z, 0.1, 1.4, 3, 0xa85f44, 1.4);
  kit.light(mx - w / 2 - 0.5, 1.6, 0);
  // Baba Adam's tomb under a small tin roof, beside the old gajari tree
  kit.block(10, -L * 0.33, 4, 3, 0.7, WHITE);
  kit.block(10, -L * 0.33, 2.2, 1, 0.5, GREEN_FLAG, 0.7);
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.cylinder(10 + s * 1.8, -L * 0.33 + t * 1.3, 0.1, 2.6, GREY, 0, 5);
  kit.add(cone(3.4, 1, 4), TIN, 10, 3.1, -L * 0.33, [0, Math.PI / 4, 0]);
  kit.tree(14, -L * 0.36, 1.5);
  kit.wall(2, -L / 2 + 1, 2, L / 2 - 1, 1.2, WHITE, 0.25);
  kit.treeRow(D - 4, -L / 2 + 4, L / 2 - 4, 9);
  for (let i = 0; i < 4; i++) kit.person(8 + kit.rng() * 6, -4 + kit.rng() * 8, kit.rng() * 6, { shirt: WHITE, cap: WHITE });
};

/** Idrakpur Fort (c. 1660): Mughal water fort, crenellated white-plastered walls, round corner bastions and the high round drum. */
const idrakpurFort: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const WALL = 0xe3dccb;
  const STAIN = 0xb9b09a;
  kit.ground(D / 2, 0, D, L, GRASS);
  const x0 = 26;
  const x1 = D - 4;
  const z0 = -L / 2 + 4;
  const z1 = L / 2 - 4;
  // curtain walls with merlons and the loopholes
  const crenWall = (ax: number, az: number, bx: number, bz: number) => {
    kit.wall(ax, az, bx, bz, 4.2, WALL, 1.2);
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.floor(len / 1.6);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      kit.block(ax + (bx - ax) * t, az + (bz - az) * t, 1.1, 0.8, 0.9, WALL, 4.2);
    }
  };
  crenWall(x0, z0, x0, -5);
  crenWall(x0, 5, x0, z1);
  crenWall(x1, z0, x1, z1);
  crenWall(x0, z0, x1, z0);
  crenWall(x0, z1, x1, z1);
  for (const [bx, bz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as [number, number][]) {
    kit.cylinder(bx, bz, 2.6, 5.4, WALL, 0, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      kit.block(bx + Math.sin(a) * 2.3, bz + Math.cos(a) * 2.3, 0.7, 0.7, 0.9, WALL, 5.4);
    }
  }
  // the gateway: a tall arched portal
  kit.block(x0, 0, 2.4, 10, 7, WALL);
  kit.block(x0 - 1.25, 0, 0.12, 3.6, 4.8, 0x3a3128, 0);
  kit.add(cone(1.8, 1.4, 4), 0x3a3128, x0 - 1.25, 5.5, 0, [0, Math.PI / 4, 0], [0.08, 1, 1]);
  for (let i = 0; i < 6; i++) kit.block(x0, -4.2 + i * 1.7, 2.6, 0.9, 0.9, WALL, 7);
  // the great round drum (on the side facing the river, here toward the road), stepped, with merlons
  const dx = 13;
  const dz = -L * 0.12;
  kit.cylinder(dx, dz, 11, 3.5, WALL, 0, 20);
  kit.cylinder(dx, dz, 9.5, 3.5, WALL, 3.5, 20);
  kit.cylinder(dx, dz, 8, 2.6, WALL, 7, 20);
  kit.cylinder(dx, dz, 11.05, 0.3, STAIN, 2.6, 20);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    kit.block(dx + Math.sin(a) * 7.6, dz + Math.cos(a) * 7.6, 0.8, 0.9, 0.9, WALL, 9.6, -a);
  }
  // the stair up and the bungalow on top
  for (let i = 0; i < 8; i++) kit.block(dx + 6.4 + i * 0.8, dz - 9.5, 0.8, 2, 9.6 - i * 1.2, STAIN);
  kit.block(dx, dz, 7, 9, 3.2, WHITE, 9.6);
  kit.add(cone(7.4, 2, 4), 0x9c3a2a, dx, 13.8, dz, [0, Math.PI / 4, 0], [0.75, 1, 1]);
  kit.light(dx - 3.6, 11, dz);
  kit.tree(x0 + 12, z1 - 10, 1.3);
  kit.tree(x0 + 20, z0 + 12, 1.2);
  kit.tree(4, L * 0.35, 1.2);
  for (let i = 0; i < 4; i++) kit.person(4 + kit.rng() * 14, L * 0.15 + kit.rng() * 10, kit.rng() * 6);
};

/** Shah Cement, Muktarpur: grey silos with the brand, the grinding mill, a conveyor gantry out to the Dhaleshwari jetty, bulk ships. */
const muktarpurCement: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const riverX = D - 18;
  kit.ground(riverX / 2, 0, riverX, L, 0xa8a49a);
  kit.water(D - 9, 0, 18, L, RIVER);
  kit.compound(1, -L / 2 + 1, riverX - 1, L / 2 - 1, 2.8, CREAM, -L * 0.36, 10);
  // the silos: two rows of tall cylinders and one taller with the brand
  const SILO = 0xc7c5bd;
  for (let i = 0; i < 5; i++) for (const r of [0, 1]) {
    const x = 26 + r * 12;
    const z = -L * 0.2 + i * 12;
    kit.cylinder(x, z, 5.6, 34, SILO, 0, 16);
    kit.cylinder(x, z, 5.8, 0.8, 0xc8322a, 31, 16);
    kit.dome(x, z, 5.6, SILO, 34, 0.25, 14);
  }
  kit.block(32, 4, 6, 60, 4, 0x9a9a92, 34);
  kit.sign(['শাহ সিমেন্ট'], 20.3, 24, -L * 0.2 + 12, 9, 2.4, { bg: '#c8322a', fg: '#ffffff' }, -Math.PI / 2);
  kit.light(32, 38.6, -L * 0.2, 0xff3020);
  kit.light(32, 38.6, L * 0.2 + 8, 0xff3020);
  // grinding mill and packing house
  kit.block(22, L * 0.36, 16, 20, 22, 0x8f9aa2);
  kit.block(22, L * 0.36, 16.4, 20.4, 0.6, 0xc8322a, 22);
  kit.block(10, -L * 0.3, 12, 22, 10, 0xd9d6cf);
  kit.windows(3.95, -L * 0.3 - 11, -L * 0.3 + 11, 1, 2, 4.4, 0x50606a, 4, 2.2, 1.6);
  for (let i = 0; i < 3; i++) vehicle(kit, 4 + i * 1, -L * 0.3 + 12 + i * 4, 0, 7, [0xc8322a, 0x2a6ab0, 0xf2c94c][i]);
  // the conveyor gantry out over the bank to the jetty, and lighter vessels moored
  beam(kit, [40, 26, 0], [riverX + 4, 10, 0], 2.4, 0x7d858a, 2);
  for (const x of [48, 58]) kit.cylinder(x, 0, 0.5, 22 - (x - 48) * 0.8, GREY, 0, 6);
  kit.block(riverX + 4, 0, 6, 26, 9, CONCRETE);
  for (const z of [-L * 0.25, L * 0.22]) {
    kit.block(D - 8, z, 7, 36, 2.2, 0x6c3a2a);
    kit.block(D - 8, z + 14, 6, 6, 3.4, WHITE, 2.2);
    kit.block(D - 8, z - 4, 5, 20, 1.2, 0x7a7a72, 2.2);
  }
};

/** Khan Saheb Osman Ali Stadium, Fatullah: the oval, tiered stands, the roofed pavilion stand and four floodlight towers. */
const fatullahStadium: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const cx = D / 2 + 2;
  const rx = D / 2 - 8;
  const rz = L / 2 - 8;
  kit.ground(cx, 0, D - 2, L - 2, 0x9a9488);
  // ring of stands around the oval
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    const segLen = (Math.PI * 2 * Math.max(rx, rz) * 0.85) / segs;
    const yaw = Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz);
    const c = i % 2 ? 0xd8d2c4 : 0x2e7d4f;
    kit.add(box(7, 4, segLen), 0xc7c1b1, x, 2, z, [0, yaw, 0]);
    kit.add(box(3.5, 3.4, segLen), c, x + Math.cos(a) * 1.75, 5.7, z + Math.sin(a) * 1.75, [0, yaw, 0]);
  }
  kit.add(new THREE.CylinderGeometry(1, 1, 0.1, 24), 0x5d9a3a, cx, 0.1, 0, [0, 0, 0], [rx - 4, 1, rz - 4]);
  kit.ground(cx, 0, 3, 20, 0xc9b98a, 0.15);
  // the pavilion stand on the road side with its cantilever roof
  kit.block(cx - rx - 2, 0, 9, 34, 11, 0xe8e4da);
  kit.windows(cx - rx - 6.55, -17, 17, 1, 2, 3.4, 0x3c4d55, 3, 1.6, 1.8);
  kit.add(box(12, 0.5, 36), WHITE, cx - rx + 1, 13, 0, [0, 0, -0.12]);
  kit.sign(['খান সাহেব ওসমান আলী স্টেডিয়াম'], cx - rx - 6.7, 9, 0, 18, 1.6, { bg: '#2e7d4f', fg: '#ffffff' }, -Math.PI / 2);
  // floodlight towers
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const fx = cx + s * (rx + 3);
    const fz = t * (rz + 2);
    kit.cylinder(fx, fz, 0.8, 42, GREY, 0, 8, 0.5);
    kit.add(box(1, 4.5, 7), 0xdedede, fx, 43.5, fz, [0, Math.atan2(-s, -t), 0.3 * s]);
    kit.light(fx - s * 0.8, 43.5, fz, 0xffffff);
  }
};

/** Pagla Bridge (Mir Jumla, c. 1660): brick ruins of three four-centred arches, octagonal corner towers, one with its ribbed dome. */
const paglaBridge: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0x7f9450);
  kit.water(D * 0.5, 0, D * 0.8, 10, 0x4f6a5a);
  const bx = D * 0.42;
  const bw = 8;
  const spanZ = 9;
  const h = 7;
  // the piers and the arch rings (broken in the middle span)
  for (const z of [-1.5, -0.5, 0.5, 1.5]) kit.block(bx, z * spanZ, bw, 2.6, h - 1.5, BRICK_OLD);
  for (const z of [-1, 0, 1]) {
    const broken = z === 0;
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      if (broken && (i === 3 || i === 4)) continue;
      const a0 = (i / segs) * Math.PI;
      const a1 = ((i + 1) / segs) * Math.PI;
      const r = spanZ / 2 - 1.2;
      beam(kit, [bx, h - 2.4 + Math.sin(a0) * 2.2, z * spanZ - Math.cos(a0) * r], [bx, h - 2.4 + Math.sin(a1) * 2.2, z * spanZ - Math.cos(a1) * r], bw, BRICK_OLD, 1.0);
    }
    if (!broken) kit.block(bx, z * spanZ, bw, spanZ, 1, 0x7a4a3a, h - 0.2);
  }
  // the blind arches at the ends and the ramps
  for (const s of [-1, 1]) {
    kit.block(bx, s * (spanZ * 1.5 + 5), bw, 8, h - 1, BRICK_OLD);
    kit.block(bx - bw / 2 - 0.05, s * (spanZ * 1.5 + 5), 0.12, 3, 3.4, 0x3a2a24, 1);
  }
  // octagonal hollow towers at the corners, one with its ribbed dome on a drum
  const corners: [number, number, boolean][] = [[bx - bw / 2, -spanZ * 1.5 - 9, true], [bx + bw / 2, -spanZ * 1.5 - 9, false], [bx - bw / 2, spanZ * 1.5 + 9, false], [bx + bw / 2, spanZ * 1.5 + 9, false]];
  for (const [x, z, dome] of corners) {
    const th = dome ? 9 : 4 + kit.rng() * 3;
    kit.cylinder(x, z, 1.8, th, BRICK_OLD, 0, 8);
    kit.block(x - 1.85, z, 0.1, 0.9, 1.8, 0x2a1d18, th - 3);
    if (dome) {
      kit.cylinder(x, z, 2.1, 0.3, 0x7a4a3a, th, 8);
      kit.cylinder(x, z, 1.4, 1.2, BRICK_OLD, th + 0.3, 8);
      kit.dome(x, z, 1.4, 0x8f5a48, th + 1.5, 1.1, 8);
    }
  }
  // grass and saplings growing out of the ruin, rubble
  for (let i = 0; i < 8; i++) kit.add(ico(0.7), 0x557f34, bx + (kit.rng() - 0.5) * bw, h + 0.3, (kit.rng() - 0.5) * spanZ * 3);
  for (let i = 0; i < 10; i++) kit.add(box(0.8, 0.4, 0.6), BRICK_OLD, bx + (kit.rng() - 0.5) * 14, 0.2, (kit.rng() - 0.5) * 30, [0, kit.rng() * 3, 0]);
  kit.tree(4, -L * 0.35, 1.1);
  kit.tree(D - 4, L * 0.3, 1.2);
};

/** Pagla sewage treatment plant: round clarifiers, long aeration tanks and the pump house on the Buriganga side. */
const paglaSewage: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0x8a9a6a);
  kit.compound(1, -L / 2 + 1, D - 1, L / 2 - 1, 2.4, CREAM, L * 0.35, 8);
  for (let i = 0; i < 3; i++) {
    const z = -L * 0.3 + i * 22;
    kit.cylinder(22, z, 9, 1.6, CONCRETE, 0, 24);
    kit.water(22, z, 16, 16, 0x5e6e52);
    beam(kit, [13, 1.9, z], [31, 1.9, z], 0.8, 0x2f6a8a);
    kit.cylinder(22, z, 0.6, 2.6, GREY, 0, 8);
  }
  for (let i = 0; i < 3; i++) {
    kit.block(D - 16, -L * 0.25 + i * 9, 18, 7, 1.4, CONCRETE);
    kit.water(D - 16, -L * 0.25 + i * 9, 16, 5.4, 0x6b7a4e);
  }
  kit.block(10, L * 0.25, 10, 14, 7, 0xd8d2c4);
  kit.add(cone(9.8, 2, 4), 0x2f6a8a, 10, 8, L * 0.25, [0, Math.PI / 4, 0], [0.75, 1, 1]);
  kit.light(4.8, 4, L * 0.25);
};

/** Mayor Hanif Flyover: the long concrete deck on single-column hammerhead piers, traffic up top and the market underneath. */
const hanifFlyover: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const x = D / 2;
  const deck = 14;
  const h = 11;
  kit.ground(x, 0, D, L, 0x7a7670);
  for (let z = -L / 2 + 8; z < L / 2; z += 26) {
    kit.block(x, z, 2.2, 2.4, h - 1.6, 0xb3afa6);
    kit.add(box(deck - 2, 1.4, 2.6), 0xb3afa6, x, h - 1.6 + 0.7, z);
  }
  kit.block(x, 0, deck, L, 1.4, 0xc4c0b6, h - 0.2);
  for (const s of [-1, 1]) kit.block(x + (s * deck) / 2, 0, 0.35, L, 1, 0xd8d4ca, h + 1.2);
  kit.block(x, 0, 0.5, L, 0.6, 0xd8d4ca, h + 1.2);
  // the traffic: buses and trucks, both ways
  const cols = [0xc8322a, 0x2a6ab0, 0x2e7d4f, 0xf2c94c, 0xe8e8e8];
  for (let i = 0; i < 9; i++) {
    const lane = i % 2 ? 1 : -1;
    vehicle(kit, x + lane * (deck / 4), -L / 2 + 12 + i * (L / 9.5), h + 1.2, i % 3 ? 10 : 4.5, cols[i % cols.length]);
  }
  // lamps along the parapet
  for (let z = -L / 2 + 10; z < L / 2; z += 30) {
    kit.cylinder(x, z, 0.12, 7, GREY, h + 1.8, 6);
    kit.light(x, h + 9, z, 0xffd28a);
  }
  // shops, rickshaws and people under the flyover
  for (let z = -L / 2 + 20; z < L / 2 - 10; z += 22) {
    kit.block(x + 4, z, 3, 8, 2.6, [0x2a6ab0, 0xc8322a, 0xd9a441][Math.floor(kit.rng() * 3)]);
    kit.person(x - 1, z + 3, kit.rng() * 6);
  }
};

export const MODELS_NORTH: Record<string, LandmarkModel> = {
  shahjalalDargah,
  aliAmjadClock,
  keaneBridge,
  teliapara,
  ashuganjPower,
  ashuganjFertilizer,
  bau,
  shashiLodge,
  nazrulUniversity,
  safariPark,
  jagrotoChowrongi,
  ijtemaGround,
  shahjalalAirport,
  babaAdamMosque,
  idrakpurFort,
  muktarpurCement,
  fatullahStadium,
  paglaBridge,
  paglaSewage,
  hanifFlyover,
};
