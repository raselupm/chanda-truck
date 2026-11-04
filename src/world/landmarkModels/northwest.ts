// Real-design models for the north-west routes (config/landmarkData/northwest.ts):
// - rooppur: Rooppur NPP on the Padma — two VVER-1200 units (domed containment, passive heat-removal tanks on
//   the shoulder, the tall vent stack, turbine halls) and the four 175 m natural-draft cooling towers, two steaming
// - bheramaraPP: the Bheramara 360 MW combined-cycle plant — HRSG and stack, turbine halls, fan cooling towers
// - smritisoudho: Jatiyo Smriti Soudho at Savar — seven nested folded triangles, the tallest behind, on a
//   red-brick terrace past the mass graves and the reflecting pool
// - mahasthangarh: the citadel's brick-faced earthen ramparts, a gateway, excavated cells and the Govinda Bhita mound
// - puthiaShiva: Puthia's five-spired Shiva temple on its high plinth by Shiv Sagar, the four-tiered Dol Mancha
//   and the terracotta Govinda temple
// - navaratna: Hatikumrul's two-storey nine-spired brick temple with its small do-chala shrine
// - kherua / mithapukur / barobazar: Sultanate and Mughal brick mosques (three domes, curved cornice, corner towers)
// - jorBangla: Pabna's Jor Bangla temple, two curved do-chala huts joined front to back
// - rabindraKachharibari: Tagore's two-storey red kachharibari at Shahjadpur with its arcaded verandahs
// - jamunaResort, jahangirnagar, dhakaEpz, mirzapurCadet, kumudini, milkVita, payraChattar
// Kumarkhali → Daulatdia, Paturia → Savar (the ferry route):
// - kuthibari: Tagore's Shilaidaha Kuthibari — red, two arcaded floors, a terrace and a pyramid-roofed top floor,
//   inside its wavy-topped boundary wall, the pond behind
// - baliati: the Baliati zamindars' palace at Saturia — four cream blocks in a row behind columned porticos
// - dhamraiRath: Dhamrai's Jagannath rath — the tiered chariot with corner spires on its wheels, the temple behind
// Frame (see kit.ts): x away from the road, z along it (-z toward Dhaka), fronts face the road (-x).
// Everything asymmetric is built along z or symmetric about its own x so the kit's left-side mirror stays right.

import * as THREE from 'three';
import { box, cached, cone, cyl, ico } from '../../utils/geometry';
import type { LKit, LandmarkModel } from './kit';

const BRICK = 0xa0502f;
const BRICK_DARK = 0x86412a;
const TERRACOTTA = 0xb2603b;
const LAWN = 0x6f9a45;
const EARTH = 0x9c8462;
const PAVE = 0xb8b1a2;
const OPENING = 0x2a2420;
const GLASS = 0x2f4f6a;
const WHITE = 0xeeeeea;

// ---------------------------------------------------------------- shape helpers

/** A solid of revolution from [radius, y] points, bottom to top (outward faces). */
function lathe(pts: [number, number][], seg = 16): THREE.BufferGeometry {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** A flat plate cut to a polygon of [z, y] points, `thick` metres along x (centred on x = 0). */
function plate(pts: [number, number][], thick: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** A prism: a cross-section of [x, y] points (symmetric about x = 0) run `len` metres along z, centred. */
function prism(pts: [number, number][], len: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

/** A box w × h × d (base at y = 0) whose vertices are moved by f(x, y, z) → new y: curved cornices and roofs. */
function bent(w: number, h: number, d: number, sx: number, sz: number, f: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, sx, 1, sz);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, f(p.getX(i), p.getY(i), p.getZ(i)));
  return g;
}

/** Unit square pyramid (base 1 × 1 on y = 0, apex at 1): hipped roofs, scaled. */
const pyramid = () => cached('nw:pyr', () => cone(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0));

/** A hipped roof w (x) × d (z), h tall, sitting on y0. */
function hipRoof(kit: LKit, x: number, z: number, w: number, d: number, h: number, color: number, y0: number): void {
  kit.add(pyramid(), color, x, y0, z, [0, 0, 0], [w, h, d]);
}

/**
 * Walls of a Bengal hut-shaped building: w across x, d along z, h tall at the middle, the top edge drooping
 * by `droop` toward both ends (the curved cornice of Bengal temples and Sultanate mosques).
 */
function curvedWalls(kit: LKit, x: number, z: number, w: number, d: number, h: number, droop: number, color: number, y0 = 0): void {
  const hd = d / 2;
  kit.add(bent(w, h, d, 1, 8, (_x, y, zz) => (y > 0.01 ? h - droop * (zz / hd) ** 2 : 0)), color, x, y0, z);
}

/** A do-chala roof: two curved slopes meeting at a ridge that bows down toward the ends. */
function dochala(kit: LKit, x: number, z: number, w: number, d: number, rise: number, droop: number, color: number, y0: number): void {
  const hw = w / 2;
  const hd = d / 2;
  const geo = bent(w, 0.35, d, 8, 8, (xx, y, zz) => y + rise * (1 - Math.abs(xx / hw) ** 1.5) - droop * (zz / hd) ** 2);
  kit.add(geo, color, x, y0, z);
}

/** A curvilinear (rekha) temple spire with its amalaka ring and finial, base radius r, h tall, on y0. */
function shikhara(kit: LKit, x: number, z: number, r: number, h: number, color: number, y0: number): void {
  const geo = cached(`nw:shikhara`, () => lathe([
    [0, 0], [1, 0], [1.03, 0.22], [0.95, 0.5], [0.72, 0.76], [0.46, 0.88], [0.52, 0.9], [0.52, 0.94], [0.2, 0.97],
    [0.12, 1.02], [0.16, 1.05], [0.03, 1.08], [0.03, 1.16], [0, 1.17],
  ], 8));
  kit.add(geo, color, x, y0, z, [0, 0, 0], [r, h, r]);
}

/** A Bengal ratna: a little square chamber with a curved cornice and a rekha spire on top. */
function ratna(kit: LKit, x: number, z: number, side: number, chamberH: number, spireH: number, color: number, y0: number): void {
  curvedWalls(kit, x, z, side, side, chamberH, 0.25, color, y0);
  kit.add(box(side + 0.4, 0.3, side + 0.4), color, x, y0 + chamberH, z);
  shikhara(kit, x, z, side * 0.45, spireH, color, y0 + chamberH + 0.3);
}

/** A hyperbolic natural-draft cooling tower: base radius r, h tall, as a shell with a dark air-inlet ring. */
function coolingTower(kit: LKit, x: number, z: number, r: number, h: number, color: number): void {
  const t = 0.6;
  const prof: [number, number][] = [[1, 0.06], [0.93, 0.2], [0.8, 0.45], [0.7, 0.68], [0.68, 0.78], [0.69, 0.9], [0.72, 1]];
  const out = prof.map(([a, b]) => [a * r, b * h] as [number, number]);
  const inner = [...prof].reverse().map(([a, b]) => [a * r - t, b * h] as [number, number]);
  kit.add(lathe([...out, ...inner], 20), color, x, 0, z);
  // the ring of raking columns at the foot reads as a dark band
  kit.add(cyl(r * 1.0, r * 1.02, h * 0.06, 20), 0x55534e, x, h * 0.03, z);
  kit.add(cyl(r * 0.98 - t, r * 0.98 - t, 0.2, 20), 0x4d6670, x, 0.3, z);
}

/** A white cumulus of steam leaving a tower top (a few overlapping puffs drifting along +z). */
function plume(kit: LKit, x: number, y: number, z: number, r: number): void {
  for (let i = 0; i < 5; i++) {
    const s = r * (0.75 + i * 0.18);
    kit.add(ico(s, 1), i < 2 ? 0xf6f6f4 : 0xe9ecee, x + (kit.rng() - 0.5) * r * 0.4, y + i * r * 0.55, z + i * r * 0.5, [0, 0, 0], [1, 0.7, 1]);
  }
}

/** A horizontal pipe from (x, y, z0) to (x, y, z1) along the road. */
function pipeZ(kit: LKit, x: number, y: number, z0: number, z1: number, r: number, color: number): void {
  kit.add(cyl(r, r, Math.abs(z1 - z0), 8), color, x, y, (z0 + z1) / 2, [Math.PI / 2, 0, 0]);
}

/** A switchyard gantry: two lattice legs and a cross beam (lattice drawn as slim boxes). */
function gantry(kit: LKit, x: number, z: number, span: number, h: number): void {
  for (const dz of [-span / 2, span / 2]) {
    kit.add(box(0.6, h, 0.6), 0x9aa0a4, x, h / 2, z + dz);
  }
  kit.add(box(0.5, 0.6, span), 0x9aa0a4, x, h, z);
  for (let i = 0; i < 3; i++) kit.add(cyl(0.15, 0.15, 1.4, 6), 0x6f7f8c, x, h - 1, z - span / 3 + (i * span) / 3);
}

/** A row of arches on the road face of a wall at x = xFace: dark openings with a pointed head. */
function arches(kit: LKit, xFace: number, z0: number, z1: number, n: number, w: number, h: number, y0: number, color = OPENING): void {
  const step = (z1 - z0) / n;
  for (let i = 0; i < n; i++) {
    const z = z0 + step * (i + 0.5);
    kit.add(box(0.12, h - w / 2, w), color, xFace - 0.04, y0 + (h - w / 2) / 2, z);
    kit.add(cone(w / 2, w * 0.6, 4), color, xFace - 0.04, y0 + h - w / 2 + w * 0.3, z, [0, 0, 0], [0.15, 1, 1]);
  }
}

/** Lawn with a fringe of trees round the back and sides (kept off the front so the place shows). */
function grounds(kit: LKit, color = LAWN, trees = true): void {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, color);
  if (!trees) return;
  kit.treeRow(D - 3, -L / 2 + 4, L / 2 - 4, 9, 1);
  for (const z of [-L / 2 + 3, L / 2 - 3]) for (let x = D * 0.35; x < D - 6; x += 10) kit.tree(x, z + (kit.rng() - 0.5) * 2, 0.9);
}

interface MosqueOpts {
  /** wall and dome colours */
  wall: number;
  dome: number;
  /** footprint: w across x, d along the road */
  w: number;
  d: number;
  h: number;
  /** dome rows across (x) × columns along the road (z) */
  rows?: number;
  cols?: number;
  domeR: number;
  /** octagonal drum under each dome */
  drum?: number;
  /** curved cornice droop */
  curve?: number;
  /** corner towers: their height above the roof (0 = flush, Sultanate style) */
  towerUp?: number;
  /** front arches */
  doors?: number;
}

/** A Sultanate / Mughal mosque: domes in a grid, octagonal corner towers, arched doors on the road face. */
function mosque(kit: LKit, x: number, z: number, o: MosqueOpts): void {
  const { w, d, h } = o;
  const rows = o.rows ?? 1;
  const cols = o.cols ?? 3;
  const curve = o.curve ?? 0;
  if (curve > 0) curvedWalls(kit, x, z, w, d, h, curve, o.wall);
  else kit.block(x, z, w, d, h, o.wall);
  // a cornice band and a row of blind arched panels below it
  kit.add(bent(w + 0.3, 0.35, d + 0.3, 1, 8, (_x, y, zz) => y + h - 0.35 - curve * (zz / (d / 2)) ** 2), o.wall === WHITE ? 0xdcd6c8 : BRICK_DARK, x, 0, z);
  arches(kit, x - w / 2, z - d / 2 + 1, z + d / 2 - 1, Math.round(d / 1.3), 0.5, 0.9, h - 1.6, o.wall === WHITE ? 0xc9c2b2 : BRICK_DARK);
  arches(kit, x - w / 2, z - d / 2 + 1.2, z + d / 2 - 1.2, o.doors ?? cols, 1.3, 3, 0);
  // domes on the roof grid
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const dx = x - w / 2 + (w / rows) * (i + 0.5);
      const dz = z - d / 2 + (d / cols) * (j + 0.5);
      let y = h - curve * ((dz - z) / (d / 2)) ** 2;
      if (o.drum) {
        kit.cylinder(dx, dz, o.domeR * 1.02, o.drum, o.wall, y, 8);
        y += o.drum;
      }
      kit.dome(dx, dz, o.domeR, o.dome, y, o.drum ? 1.15 : 0.9, 12);
      kit.spire(dx, dz, 0.15, 1.2, o.drum ? 0xd4b04c : o.dome, y + o.domeR * (o.drum ? 1.1 : 0.85), 6);
    }
  }
  // octagonal corner towers
  const up = o.towerUp ?? 0;
  for (const cx of [x - w / 2, x + w / 2]) {
    for (const cz of [z - d / 2, z + d / 2]) {
      const th = h - curve + up + 0.4;
      kit.cylinder(cx, cz, 0.6, th, o.wall, 0, 8);
      if (up > 0) {
        kit.dome(cx, cz, 0.75, o.dome, th, 1.2, 8);
        kit.spire(cx, cz, 0.1, 0.8, 0xd4b04c, th + 0.8, 5);
      }
    }
  }
}

// ---------------------------------------------------------------- Rooppur NPP

/**
 * Rooppur Nuclear Power Plant, Ishwardi: two VVER-1200 (AES-2006) units side by side on the Padma bank.
 * Each: a domed double containment with the passive heat-removal tanks round its shoulder and the ~100 m vent
 * stack, a square annex of safety buildings, the long turbine hall behind; four 175 m hyperbolic cooling towers
 * stand in a row at the back (scaled here to ~88 m). Pale grey concrete, white cladding with a blue band.
 */
const rooppur: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xb3ae9f);
  kit.ground(6, 0, 12, L, LAWN);
  // the security fence, gate and guard post, an avenue in to the units
  kit.compound(3, -L / 2 + 2, D - 1, L / 2 - 2, 2.6, 0xd9d9d2, 0, 14);
  for (const dz of [-8, 8]) kit.block(3, dz, 1.4, 1.4, 4, 0x6b7f99);
  kit.add(box(1, 1.4, 17.4), 0x2d4f86, 3, 4.6, 0);
  kit.sign(['রূপপুর পারমাণবিক বিদ্যুৎকেন্দ্র'], 2.4, 4.6, 0, 16, 1.3, { bg: '#2d4f86', fg: '#ffffff' }, -Math.PI / 2);
  kit.block(9, 12, 4, 4, 3, 0xe8e6df);
  kit.ground(30, 0, 50, 10, 0x6a6a68);
  kit.treeRow(7, -L / 2 + 8, -12, 10, 0.9);
  kit.treeRow(7, 12, L / 2 - 8, 10, 0.9);
  kit.light(3, 5.5, -8);
  kit.light(3, 5.5, 8);

  for (const uz of [-48, 48]) {
    const rx = 48;
    // annex of safety and auxiliary buildings round the reactor
    kit.block(rx, uz, 54, 56, 14, 0xe4e4df);
    kit.block(rx, uz, 54.4, 56.4, 1.4, 0x2f5f9e, 12);
    kit.windows(rx - 27, uz - 26, uz + 26, 2, 3, 4, 0x3b5068, 4.5, 1.6, 1.2);
    // containment: cylinder, blue band, dome
    kit.cylinder(rx, uz, 19, 40, 0xd5d7d4, 0, 24);
    kit.cylinder(rx, uz, 19.3, 2.2, 0x2f5f9e, 33, 24);
    kit.dome(rx, uz, 19, 0xcfd2cf, 40, 0.55, 24);
    // passive heat-removal tanks on the shoulder
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      kit.add(box(7, 9, 7), 0xeaeae6, rx + Math.cos(a) * 17, 42, uz + Math.sin(a) * 17, [0, -a, 0]);
      kit.add(cyl(1.2, 1.2, 5, 8), 0xb9bcb8, rx + Math.cos(a) * 17, 49, uz + Math.sin(a) * 17);
    }
    // the vent stack beside the containment
    const sx = rx + 22;
    kit.cylinder(sx, uz, 2.2, 78, 0xe8e8e4, 0, 12, 1.7);
    for (let y = 10; y < 76; y += 11) kit.cylinder(sx, uz, 2.6, 0.6, 0x9da3a6, y, 12);
    kit.cylinder(sx, uz, 1.8, 6, 0xc23b2b, 72, 12);
    kit.light(sx, 79, uz, 0xff3a2a);
    // turbine hall behind, the transformer yard beside it
    kit.block(rx + 40, uz, 24, 64, 28, 0xe2e4e3);
    kit.block(rx + 40, uz, 24.4, 64.4, 3, 0x2f5f9e, 24);
    kit.block(rx + 40, uz, 20, 60, 1, 0x9fa6aa, 28);
    for (let z = uz - 26; z <= uz + 26; z += 13) kit.block(rx + 27, z, 4, 5, 4, 0x6d7a7f);
    // a few lit windows on the annex
    kit.light(rx - 27.2, 8, uz - 10);
    kit.light(rx - 27.2, 8, uz + 12);
  }
  gantry(kit, 92, -106 + 18, 14, 18);
  gantry(kit, 92, 106 - 18, 14, 18);

  // the four cooling towers in a row at the back, unit 1's pair steaming
  const tx = 132;
  const zs = [-82, -27, 27, 82];
  zs.forEach((z, i) => {
    coolingTower(kit, tx, z, 24, 88, 0xbdbcb5);
    kit.light(tx - 16.5, 88.5, z, 0xff3a2a);
    kit.light(tx + 16.5, 88.5, z, 0xff3a2a);
    if (i < 2) plume(kit, tx, 98, z, 13);
  });
};

// ---------------------------------------------------------------- Bheramara combined cycle

/** Bheramara 360 MW CCPP: gas turbine house, HRSG box with its tall stack, steam turbine hall, fan cooling towers. */
const bheramaraPP: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xb6b1a5);
  kit.compound(3, -L / 2 + 2, D - 2, L / 2 - 2, 2.4, 0xd6d3c8, 30, 10);
  // admin block near the gate
  kit.block(14, 42, 14, 22, 10, 0xece8dc);
  kit.windows(7, 32, 52, 0.8, 3, 3.2, GLASS, 2.6);
  kit.flag(9, 28, 9);
  // gas turbine house and the HRSG + stack
  kit.block(40, 10, 20, 22, 14, 0xdadfe2);
  kit.block(40, 10, 20.4, 22.4, 1.6, 0x2f6db5, 12.4);
  kit.block(46, -18, 16, 30, 26, 0x8d99a5);
  for (let y = 5; y < 26; y += 5) kit.block(46, -18, 16.3, 30.3, 0.4, 0x6e7882, y);
  kit.cylinder(62, -18, 3.4, 62, 0xd8d8d6, 0, 14, 3);
  kit.cylinder(62, -18, 3.2, 3, 0xc23b2b, 52, 14);
  kit.cylinder(62, -18, 3.1, 3, 0xc23b2b, 58, 14);
  kit.add(box(8, 4, 4), 0x8d99a5, 57, 20, -18);
  kit.light(62, 62.5, -18, 0xff3a2a);
  // steam turbine hall
  kit.block(42, 36, 24, 26, 20, 0xe3e5e4);
  kit.block(42, 36, 24.4, 26.4, 2, 0x2f6db5, 17.5);
  kit.windows(30, 25, 47, 4, 2, 6, GLASS, 4, 2.2, 2.4);
  // mechanical-draft cooling tower cells
  kit.block(74, 22, 16, 40, 10, 0xa7aeb2);
  for (let z = 7; z <= 37; z += 10) {
    kit.cylinder(74, z, 3.2, 3.5, 0x6c7378, 10, 12);
    kit.add(ico(3.5, 1), 0xf2f3f2, 74, 16, z + 2, [0, 0, 0], [1, 0.6, 1]);
  }
  // gas pipe and the switchyard
  pipeZ(kit, 30, 1.2, -40, 22, 0.6, 0xf2c14e);
  for (let z = -46; z <= -28; z += 9) gantry(kit, 22, z, 7, 13);
  for (let z = -45; z <= -30; z += 7) kit.block(34, z, 4, 4, 3.5, 0x707c80);
  kit.light(7, 6, 32);
  kit.light(7, 9, 46);
};

// ---------------------------------------------------------------- National Martyrs' Memorial

/**
 * Jatiyo Smriti Soudho, Savar: seven pairs of triangular concrete walls folded like a crease, each pair taller and
 * narrower than the one in front, the innermost 45.72 m (≈34 m here). It stands on a red-brick terrace at the end
 * of a long brick walk past the mass graves and a reflecting pool, with an artificial lake round it.
 */
const smritisoudho: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, LAWN);
  // the gate on the highway, the walk, the pool
  for (const dz of [-9, 9]) kit.block(2, dz, 1.4, 6, 2.2, BRICK);
  kit.ground(35, 0, 62, 9, BRICK);
  kit.ground(32, 0, 34, 16, 0xa95634);
  kit.water(32, 0, 30, 7, 0x3b7f9a);
  // the mass graves: low brick-paved squares either side
  for (const dz of [-24, 24]) {
    for (let x = 14; x <= 54; x += 10) {
      kit.block(x, dz, 6, 6, 0.5, 0x9a4a2c);
      kit.block(x, dz, 5, 5, 0.12, 0xb05e3a, 0.5);
    }
  }
  // the terrace
  kit.block(80, 0, 34, 54, 1.2, 0xa04a2e);
  kit.block(62, 0, 3, 18, 0.6, 0xa04a2e);
  // seven folded pairs: outermost shortest and widest at the front
  const hs = [12, 15.5, 19, 22.5, 26, 30, 34];
  const bs = [22, 19, 16, 13, 10, 7.5, 5];
  const fold = 0.5;
  for (let i = 0; i < 7; i++) {
    const h = hs[i];
    const b = bs[i];
    const x = 70 + i * 2.1;
    const shade = i % 2 ? 0xd2cbbd : 0xc8c1b2;
    const half = plate([[0, 0], [b, 0], [0, h]], 0.6);
    const halfB = plate([[0, 0], [0, h], [-b, 0]], 0.6);
    kit.add(half, shade, x, 1.2, 0, [0, fold, 0]);
    kit.add(halfB, shade, x, 1.2, 0, [0, -fold, 0]);
  }
  kit.light(83, 36, 0, 0xffe7b0);
  // the lake behind and round the sides
  kit.water(102, 0, 14, 80, 0x3f7f95);
  for (const dz of [-38, 38]) kit.water(84, dz, 30, 10, 0x3f7f95);
  kit.flag(8, -14, 10);
  kit.treeRow(4, -L / 2 + 6, -16, 8, 0.8);
  kit.treeRow(4, 16, L / 2 - 6, 8, 0.8);
  for (const dz of [-L / 2 + 4, L / 2 - 4]) for (let x = 14; x < D - 8; x += 9) kit.tree(x, dz, 1);
  for (let i = 0; i < 6; i++) kit.person(10 + kit.rng() * 50, (kit.rng() - 0.5) * 6, Math.PI, { shirt: [0xe63946, 0xf2f0ea, 0x2a9d8f][i % 3] });
};

// ---------------------------------------------------------------- Mahasthangarh

/**
 * Mahasthangarh citadel: earthen ramparts faced with brick, a gap where a gateway stood, the excavated brick
 * cells of a monastery inside (Bairagir Bhita) and the stepped brick mound of Govinda Bhita by the Karatoya.
 */
const mahasthangarh: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0x7f9a4e);
  const bank: [number, number][] = [[-7, 0], [7, 0], [2.6, 6], [-2.6, 6]];
  // rampart along the road with the gateway gap, and its return at the far end
  const runs: [number, number][] = [[-L / 2 + 8, -12], [2, L / 2 - 8]];
  for (const [z0, z1] of runs) {
    kit.add(prism(bank, z1 - z0), 0x6f8a45, 12, 0, (z0 + z1) / 2);
    // brick facing on the crest and the outer foot, broken in places
    for (let z = z0 + 2; z < z1 - 2; z += 4) {
      const hh = 0.6 + kit.rng() * 1.8;
      kit.block(12, z, 1.4, 3.6, hh, BRICK, 6);
      kit.block(4.8, z, 1.0, 3.8, 0.8 + kit.rng() * 1.4, BRICK_DARK, 0);
    }
  }
  kit.add(prism(bank, D - 22), 0x6f8a45, 12 + (D - 22) / 2, 0, -L / 2 + 8, [0, Math.PI / 2, 0]);
  // a corner bastion
  kit.add(lathe([[0, 0], [9, 0], [6, 7], [0, 7]], 10), 0x6a8442, 12, 0, -L / 2 + 8);
  kit.block(12, -L / 2 + 8, 4, 4, 1.4, BRICK, 7);
  // the gateway: two brick jambs and a brick-paved path in
  for (const dz of [-12, 2]) kit.block(12, dz, 5, 2, 4, BRICK, 0);
  kit.ground(30, -5, 40, 6, EARTH);
  // excavated cells round a court
  const cx = 42;
  const cz = 20;
  for (let i = -2; i <= 2; i++) {
    kit.wall(cx - 12, cz + i * 5, cx + 12, cz + i * 5, 0.8 + kit.rng() * 0.6, BRICK, 1);
    kit.wall(cx + i * 6, cz - 10, cx + i * 6, cz + 10, 0.7 + kit.rng() * 0.6, BRICK, 1);
  }
  kit.ground(cx, cz, 26, 22, 0xa78a64);
  // Govinda Bhita: stepped brick terraces
  const gx = 50;
  const gz = -26;
  kit.block(gx, gz, 22, 20, 1.6, BRICK_DARK);
  kit.block(gx, gz, 16, 14, 1.4, BRICK, 1.6);
  kit.block(gx, gz, 10, 8, 1.2, BRICK_DARK, 3);
  kit.block(gx, gz, 5, 4, 1.0, BRICK, 4.2);
  // trees on the ramparts, palms inside, a few visitors
  for (let z = -L / 2 + 14; z < L / 2 - 10; z += 16) kit.tree(14, z, 0.8);
  kit.palm(30, 32, 1);
  kit.palm(62, 4, 1.1);
  kit.treeRow(D - 4, -L / 2 + 10, L / 2 - 6, 11, 1);
  for (let i = 0; i < 5; i++) kit.person(30 + kit.rng() * 25, -5 + (kit.rng() - 0.5) * 30, kit.rng() * 6, { shirt: [0xffd166, 0x2a9d8f, 0xf2f0ea][i % 3] });
};

// ---------------------------------------------------------------- Puthia

/**
 * Puthia temple complex: the Bhubaneshwar Shiva temple — five rekha spires (the central one ringed by small
 * pinnacles) over a square two-tier body on a high plinth, cream plaster weathered grey — looking over the
 * Shiv Sagar tank; the four-tiered white Dol Mancha and the red terracotta Govinda temple beside them.
 */
const puthiaShiva: LandmarkModel = (kit) => {
  const L = kit.length;
  grounds(kit);
  const CREAM = 0xd8cdb0;
  const CREAM_DARK = 0xbcae90;
  // Shiv Sagar with its bathing ghat
  kit.water(13, -12, 18, 46);
  for (let i = 0; i < 4; i++) kit.block(22.5 - i * 0.8, -14, 0.8, 8, 0.3 + i * 0.3, CREAM_DARK);
  // Shiva temple
  const sx = 40;
  const sz = -14;
  kit.block(sx, sz, 24, 24, 4.5, CREAM_DARK);
  for (let i = 0; i < 6; i++) kit.block(sx - 12.6 - i * 0.7, sz, 0.7, 7, 4.5 - i * 0.75, CREAM);
  kit.block(sx, sz, 17, 17, 6.5, CREAM, 4.5);
  arches(kit, sx - 8.5, sz - 7.5, sz + 7.5, 5, 1.6, 3.6, 5);
  kit.block(sx, sz, 18, 18, 0.5, CREAM_DARK, 11);
  for (const dx of [-6, 6]) for (const dz of [-6, 6]) {
    kit.block(sx + dx, sz + dz, 4, 4, 2.6, CREAM, 11.5);
    shikhara(kit, sx + dx, sz + dz, 2, 8, CREAM, 14.1);
  }
  kit.block(sx, sz, 7.5, 7.5, 3.2, CREAM, 11.5);
  shikhara(kit, sx, sz, 3.8, 17, CREAM_DARK, 14.7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    shikhara(kit, sx + Math.cos(a) * 3.6, sz + Math.sin(a) * 3.6, 0.7, 3.2, CREAM, 14.7);
  }
  // Dol Mancha: four tiers of arched pavilions, a little dome on top
  const dx = 40;
  const dz = 26;
  const tiers: [number, number][] = [[12, 4], [9.6, 3.6], [7.4, 3.2], [5.4, 3]];
  let y = 0.6;
  kit.block(dx, dz, 13.5, 13.5, 0.6, 0xd9d2c4);
  for (const [s, h] of tiers) {
    kit.block(dx, dz, s, s, h, 0xf0ebe0, y);
    arches(kit, dx - s / 2, dz - s / 2 + 0.6, dz + s / 2 - 0.6, Math.max(3, Math.round(s / 2.2)), 1.2, h * 0.75, y);
    kit.block(dx, dz, s + 0.6, s + 0.6, 0.4, 0xd9d2c4, y + h);
    y += h + 0.4;
  }
  kit.dome(dx, dz, 2.2, 0xf0ebe0, y, 1.1, 10);
  kit.spire(dx, dz, 0.2, 1.4, 0xd4b04c, y + 2.3, 6);
  // the Govinda temple: small pancharatna in terracotta
  const gx = 52;
  const gz = 6;
  kit.block(gx, gz, 11, 11, 1, BRICK_DARK);
  curvedWalls(kit, gx, gz, 9, 9, 5, 0.4, TERRACOTTA, 1);
  arches(kit, gx - 4.5, gz - 3.5, gz + 3.5, 3, 1.2, 2.6, 1);
  kit.block(gx, gz, 9.6, 9.6, 0.4, TERRACOTTA, 5.8);
  for (const ox of [-3.2, 3.2]) for (const oz of [-3.2, 3.2]) ratna(kit, gx + ox, gz + oz, 2, 1.4, 3.2, TERRACOTTA, 6.2);
  ratna(kit, gx, gz, 3.2, 2, 5, TERRACOTTA, 6.2);
  for (let i = 0; i < 6; i++) kit.person(24 + kit.rng() * 6, -L / 4 + kit.rng() * 30, Math.PI / 2, { shirt: [0xe63946, 0xffd166, 0xf2f0ea][i % 3], lungi: i % 2 === 0 });
  kit.light(sx - 12.6, 5, sz - 4);
  kit.light(dx - 6.5, 3, dz);
};

// ---------------------------------------------------------------- Hatikumrul Navaratna

/**
 * Hatikumrul Navaratna temple (early 18th c.): a 15.4 m square, two-storey brick temple with nine ratnas — four
 * on the corners of each roof and the tallest in the middle — terracotta panels round the arched front, with a
 * little do-chala Shiva shrine in the grounds.
 */
const navaratna: LandmarkModel = (kit) => {
  grounds(kit);
  const x = 25;
  const z = -2;
  kit.ground(x - 6, z, 30, 26, 0xc2a882);
  kit.block(x, z, 18, 18, 1, BRICK_DARK);
  // ground storey with the curved cornice
  curvedWalls(kit, x, z, 15.4, 15.4, 6.2, 0.5, BRICK, 1);
  kit.add(box(0.15, 1.2, 13), TERRACOTTA, x - 7.75, 2.4, z);
  arches(kit, x - 7.7, z - 5, z + 5, 3, 1.8, 3.6, 1.1);
  kit.add(bent(16.2, 0.5, 16.2, 1, 8, (_x, y, zz) => y + 6.8 - 0.5 * (zz / 8.1) ** 2), BRICK_DARK, x, 0.5, z);
  // four ratnas on the lower roof
  for (const ox of [-6, 6]) for (const oz of [-6, 6]) ratna(kit, x + ox, z + oz, 2.4, 2, 4, BRICK, 7.6);
  // upper storey and its ratnas
  curvedWalls(kit, x, z, 8.4, 8.4, 4.4, 0.3, BRICK, 7.6);
  arches(kit, x - 4.2, z - 2.5, z + 2.5, 3, 1, 2.4, 7.8);
  kit.block(x, z, 9, 9, 0.4, BRICK_DARK, 12);
  for (const ox of [-3.3, 3.3]) for (const oz of [-3.3, 3.3]) ratna(kit, x + ox, z + oz, 1.8, 1.5, 3.4, BRICK, 12.4);
  ratna(kit, x, z, 3.2, 2.4, 6.6, BRICK, 12.4);
  // the small do-chala shrine
  curvedWalls(kit, 32, 15, 4.5, 6, 3, 0.3, BRICK, 0);
  dochala(kit, 32, 15, 5.2, 6.8, 1.8, 0.4, BRICK_DARK, 3);
  arches(kit, 29.75, 13.5, 16.5, 1, 1.1, 2, 0);
  kit.person(13, -1, -Math.PI / 2, { shirt: 0xffd166, lungi: true });
  kit.person(12, 3, -Math.PI / 2, { shirt: 0xe63946, lower: 0xe63946 });
};

// ---------------------------------------------------------------- mosques

/** Kherua Mosque, Sherpur (1582): 17.5 × 7.5 m red brick, three low domes, curved cornice, octagonal corner towers. */
const kherua: LandmarkModel = (kit) => {
  grounds(kit);
  const L = kit.length;
  kit.compound(2, -L / 2 + 3, kit.depth - 3, L / 2 - 3, 1.0, BRICK, 0, 4);
  // the iron railing on the boundary wall, read as a dark band
  kit.wall(2, -L / 2 + 3, 2, -2, 0.7, 0x3a3a38, 0.05, 1);
  kit.wall(2, 2, 2, L / 2 - 3, 0.7, 0x3a3a38, 0.05, 1);
  kit.ground(14, 0, 22, 3, 0xb7a58a);
  mosque(kit, 28, 0, { wall: 0x9c4a2b, dome: 0x8f4528, w: 7.6, d: 17.5, h: 6, domeR: 2.3, curve: 0.6, doors: 3 });
  kit.palm(12, -12, 1);
  kit.palm(12, 12, 0.9);
  kit.tree(16, -18, 0.9);
  kit.tree(18, 17, 1);
};

/** Mithapukur Mosque, Rangpur (early 19th c.): three Mughal domes on drums, tall corner minarets, white plaster. */
const mithapukur: LandmarkModel = (kit) => {
  grounds(kit);
  const L = kit.length;
  kit.ground(20, 0, 26, 24, 0xd8d2c4);
  kit.compound(8, -12, 34, 12, 1.4, 0xe6e1d4, 0, 4);
  // the gateway with a little dome
  for (const dz of [-2.6, 2.6]) kit.block(8, dz, 1.4, 1.2, 4, 0xe6e1d4);
  kit.block(8, 0, 1.4, 6.4, 0.8, 0xe6e1d4, 4);
  kit.dome(8, 0, 1.3, WHITE, 4.8, 1.2, 10);
  mosque(kit, 28, 0, { wall: WHITE, dome: 0xf4f2ec, w: 7, d: 16.5, h: 6, domeR: 2.6, drum: 1.2, towerUp: 4, doors: 3 });
  // the pond the place is named after
  kit.water(10, -L / 2 + 6.5, 14, 12);
  kit.palm(16, 15, 1);
  kit.person(14, 2, -Math.PI / 2, { shirt: WHITE, lower: WHITE, cap: WHITE });
};

/** Barobazar: the restored brick mosques of the Sultanate city — six-domed Galakata and two single-domed ones by a dighi. */
const barobazar: LandmarkModel = (kit) => {
  grounds(kit);
  kit.water(14, -24, 20, 18);
  kit.ground(26, 8, 40, 30, 0x8fa860);
  mosque(kit, 24, 6, { wall: BRICK, dome: BRICK_DARK, w: 9, d: 13, h: 5, rows: 2, cols: 3, domeR: 1.9, curve: 0.4, doors: 3 });
  mosque(kit, 44, -14, { wall: BRICK, dome: BRICK_DARK, w: 7, d: 7, h: 5, rows: 1, cols: 1, domeR: 3, curve: 0.35, doors: 1 });
  mosque(kit, 46, 22, { wall: TERRACOTTA, dome: BRICK_DARK, w: 6.5, d: 6.5, h: 4.6, rows: 1, cols: 1, domeR: 2.8, curve: 0.3, doors: 1 });
  kit.person(12, 6, -Math.PI / 2, { shirt: 0x2a9d8f });
};

// ---------------------------------------------------------------- Pabna, Shahjadpur

/** Jor Bangla temple, Pabna (18th c.): two do-chala huts joined front to back, three arches, terracotta brick. */
const jorBangla: LandmarkModel = (kit) => {
  grounds(kit);
  const x = 16;
  const z = 0;
  kit.ground(x - 4, z, 22, 18, 0xc2a882);
  kit.block(x + 3, z, 15, 13, 1.1, BRICK_DARK);
  for (const [hx, front] of [[x, true], [x + 6.2, false]] as [number, boolean][]) {
    curvedWalls(kit, hx, z, 6.2, 10.4, 4.6, 0.6, TERRACOTTA, 1.1);
    dochala(kit, hx, z, 7, 11.4, 2.8, 0.7, 0x9a4f31, 5.1);
    if (front) {
      arches(kit, hx - 3.1, z - 3.6, z + 3.6, 3, 1.4, 3, 1.1);
      kit.add(box(0.12, 0.8, 9.6), 0xc77b52, hx - 3.15, 4.6, z);
    }
  }
  for (let i = 0; i < 3; i++) kit.block(x - 4 - i * 0.6, z, 0.6, 4, 1.1 - i * 0.35, BRICK_DARK);
  kit.person(10, -2, -Math.PI / 2, { shirt: 0xe63946, lower: 0xe63946 });
};

/**
 * Rabindra Kachharibari, Shahjadpur: Tagore's estate office, a two-storey Indo-European building in red with
 * white columns, arcaded corridors along its long sides and a balustraded parapet; his bust on the lawn.
 */
const rabindraKachharibari: LandmarkModel = (kit) => {
  grounds(kit);
  const L = kit.length;
  kit.compound(2, -L / 2 + 3, kit.depth - 2, L / 2 - 3, 1.1, 0xe7e1d2, 0, 5);
  kit.ground(12, 0, 20, 3, 0xcbbfa6);
  const x = 26;
  const RED = 0xa8432e;
  kit.block(x, 0, 11, 29, 0.8, 0xd9d2c4);
  kit.block(x + 1.6, 0, 7.8, 28, 8.6, RED, 0.8);
  // the two arcaded floors on the road side
  for (const y of [0.8, 5.1]) {
    kit.add(box(0.1, 3.2, 27), 0x3a2a24, x - 2.3, y + 1.6, 0);
    for (let z = -13.5; z <= 13.5; z += 2.7) kit.block(x - 4.6, z, 0.6, 0.6, 3.7, WHITE, y);
    kit.block(x - 4.4, 0, 0.6, 28.2, 0.6, WHITE, y + 3.7);
    kit.block(x - 3.4, 0, 2.6, 28, 0.25, 0xd9d2c4, y + 3.75);
  }
  // parapet with balusters
  kit.block(x, 0, 11.2, 29.2, 0.3, WHITE, 9.4);
  for (let z = -14; z <= 14; z += 1) kit.block(x - 5.3, z, 0.2, 0.2, 0.8, WHITE, 9.7);
  kit.block(x - 5.3, 0, 0.3, 28.6, 0.2, WHITE, 10.5);
  // the bust on its pedestal, flower beds
  kit.block(12, 0, 1.4, 1.4, 1.8, WHITE);
  kit.add(box(0.5, 0.7, 1.1), 0x4a3b2c, 12, 2.15, 0);
  kit.ball(12, 2.75, 0, 0.32, 0x4a3b2c, 8);
  for (const dz of [-14, -7, 7, 14]) kit.block(14, dz, 3, 3, 0.4, [0xe63946, 0xffd166, 0xff7aa2, 0xffffff][(dz + 14) % 4]);
  kit.light(x - 2.4, 6.6, -6);
  kit.light(x - 2.4, 6.6, 6);
};

// ---------------------------------------------------------------- Kumarkhali, Manikganj, Dhamrai

/** A square pyramid roof (4-sided cone turned square to the axes), w along x and d along z, base at y0. */
function pyramidRoof(kit: LKit, x: number, z: number, w: number, d: number, h: number, color: number, y0: number): void {
  const geo = cached('nw:pyramid', () => cone(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4));
  kit.add(geo, color, x, y0 + h / 2, z, [0, 0, 0], [w, h, d]);
}

const kuthibari: LandmarkModel = (kit) => {
  grounds(kit);
  const L = kit.length;
  const D = kit.depth;
  const RED = 0xb5523a;
  const ROOF = 0x8c3b2a;
  // the boundary wall with its wavy top
  kit.compound(2, -L / 2 + 3, D - 2, L / 2 - 3, 1.4, RED, 0, 6);
  for (let z = -L / 2 + 4; z < L / 2 - 3; z += 2) if (Math.abs(z) > 3.5) kit.add(cyl(0.95, 0.95, 0.3, 12), RED, 2, 1.4, z, [0, 0, Math.PI / 2]);
  kit.ground(14, 0, 22, 3, 0xcbbfa6);
  const x = 31;
  kit.block(x, 0, 18, 26, 0.9, 0xd9d2c4);
  // two floors, each with its arcade toward the road and a white cornice
  for (const [y, h] of [[0.9, 4.2], [5.45, 3.8]] as const) {
    kit.block(x, 0, 16, 24, h, RED, y);
    arches(kit, x - 8, -11, 11, 7, 1.5, h - 1.4, y + 0.2);
    kit.block(x, 0, 16.6, 24.6, 0.35, WHITE, y + h);
  }
  // the roof terrace: a parapet round it, the top floor in the middle under its pyramid roof
  const yT = 9.6;
  for (const sd of [-1, 1]) {
    kit.block(x, sd * 12, 16.4, 0.3, 0.9, WHITE, yT);
    kit.block(x + sd * 8, 0, 0.3, 24.4, 0.9, WHITE, yT);
  }
  kit.block(x, 0, 9, 11, 3.2, RED, yT);
  kit.windows(x - 4.5, -5, 5, yT + 0.6, 1, 3.2, OPENING, 2.4, 1.1, 1.8);
  kit.block(x, 0, 9.6, 11.6, 0.3, WHITE, yT + 3.2);
  pyramidRoof(kit, x, 0, 10.6, 12.6, 3, ROOF, yT + 3.5);
  // the pond behind, its bathing ghat, mango trees round the lawn
  kit.water(D - 9, -L / 4, 12, 22);
  kit.block(D - 15.5, -L / 4, 1.5, 6, 0.6, 0xd9d2c4);
  for (const [tx, tz] of [[10, -L / 2 + 8], [10, L / 2 - 8], [D - 8, L / 4], [20, -L / 2 + 10], [44, L / 2 - 7]]) kit.tree(tx, tz, 1.1);
  kit.light(x - 8.1, 3, -6);
  kit.light(x - 8.1, 3, 6);
  kit.light(x - 8.1, 7.3, 0);
};

const baliati: LandmarkModel = (kit) => {
  grounds(kit);
  const L = kit.length;
  const D = kit.depth;
  const CREAM = 0xe9e1cf;
  const SHUTTER = 0x3f6b4a;
  kit.compound(2, -L / 2 + 2, D - 2, L / 2 - 2, 1.6, 0xd8cfbd, 0, 8);
  kit.ground(10, 0, 16, 4, 0xcbbfa6);
  const x = 30;
  const w = 14;
  // four palace blocks in a row, the two middle ones a storey taller
  for (const [z, storeys, len] of [[-32, 2, 17], [-11, 3, 21], [11, 3, 21], [32, 2, 17]] as const) {
    const h = storeys * 4.4;
    const y0 = 0.8;
    kit.block(x, z, w + 2, len + 2, y0, 0xcfc6b4);
    kit.block(x, z, w, len, h, CREAM, y0);
    kit.windows(x - w / 2, z - len / 2 + 1, z + len / 2 - 1, y0 + 0.7, storeys, 4.4, SHUTTER, 2.6, 1.1, 2.4);
    // the portico: tall columns, an entablature, a balustrade on top
    const px = x - w / 2 - 2.4;
    for (let zz = z - len / 2 + 1.5; zz <= z + len / 2 - 1.4; zz += 2.6) {
      kit.cylinder(px, zz, 0.34, h, WHITE, y0, 10);
      kit.block(px, zz, 0.9, 0.9, 0.4, WHITE, y0 + h - 0.4);
    }
    kit.block(px + 1.2, z, 3.4, len, 0.6, WHITE, y0 + h);
    kit.block(x, z, w + 0.6, len + 0.6, 0.5, WHITE, y0 + h);
    for (let zz = z - len / 2 + 0.5; zz <= z + len / 2 - 0.5; zz += 0.8) kit.block(px - 0.4, zz, 0.18, 0.18, 0.8, WHITE, y0 + h + 0.6);
    kit.block(px - 0.4, z, 0.3, len, 0.2, WHITE, y0 + h + 1.4);
    if (storeys === 3) kit.add(plate([[-5, 0], [5, 0], [0, 2.4]], 0.5), WHITE, px, y0 + h + 0.6, z);
  }
  kit.water(D - 7, 0, 9, L - 14);
  for (const z of [-L / 2 + 6, L / 2 - 6]) kit.tree(9, z, 1.1);
  for (const z of [-21.5, 0, 21.5]) kit.light(x - w / 2 - 0.2, 6, z);
};

const dhamraiRath: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, EARTH);
  const RED = 0xc0392b;
  const GOLD = 0xf2c14e;
  const BLUE = 0x2a6fb0;
  const x = 17;
  // the wheels and the timber platform
  for (const dx of [-4.4, 4.4]) for (let i = 0; i < 5; i++) kit.add(cyl(1.1, 1.1, 0.5, 14), 0x4a3424, x + dx, 1.1, -4 + i * 2, [0, 0, Math.PI / 2]);
  kit.block(x, 0, 8.4, 10.6, 0.8, 0x7a4a2a, 2.0);
  // three tiers, each smaller, a gold eave and a spire at each corner, the tall spire on top
  const tiers: [number, number, number][] = [[7, 2.6, RED], [5, 2.2, BLUE], [3.2, 1.8, RED]];
  let y = 2.8;
  for (const [size, h, color] of tiers) {
    kit.block(x, 0, size, size, h, color, y);
    for (const c of [-1, 1]) for (const e of [-1, 1]) kit.block(x + (c * size) / 2, (e * size) / 2, 0.35, 0.35, h, 0xf7f3e8, y);
    y += h;
    kit.block(x, 0, size + 1, size + 1, 0.35, GOLD, y);
    y += 0.35;
    if (size > 4) for (const c of [-1, 1]) for (const e of [-1, 1]) kit.spire(x + (c * size) / 2, (e * size) / 2, size * 0.09, size * 0.26, GOLD, y);
  }
  shikhara(kit, x, 0, 1.6, 4.6, GOLD, y);
  kit.cylinder(x, 0, 0.05, 2.4, 0xd8d8d8, y + 4.5, 6);
  kit.add(box(0.04, 0.6, 1.0), RED, x, y + 6.5, 0.5);
  // the two wooden horses at the front, bunting down to the ground
  for (const dz of [-1.6, 1.6]) {
    kit.block(x - 6, dz, 2.6, 0.8, 1.1, 0xf7f3e8, 2.2);
    kit.block(x - 7.4, dz, 0.7, 0.7, 1.4, 0xf7f3e8, 2.9);
  }
  for (const [bx, bz] of [[x - 8, -9], [x - 8, 9], [x + 9, -9], [x + 9, 9]]) kit.bunting(x, 0, bx, bz, y + 3);
  // the Jagannath temple behind the rath khola
  ratna(kit, D - 9, 7, 6, 4, 6, 0xe9e1cf, 0.6);
  kit.block(D - 9, 7, 7.4, 7.4, 0.6, 0xd9d2c4);
  for (const [px, pz, yaw] of [[6, -6, 0.4], [8, 7, -2.6], [26, -10, 1.2], [5, 2, 0]] as const) kit.person(px, pz, yaw, { lungi: px > 20 });
  kit.light(x, y + 4.4, 0, 0xffd27a);
};

// ---------------------------------------------------------------- Jamuna and the Tangail road

/** Jamuna Resort at the bridge's east end: a red-roofed main block, cottages, a pool, palms, the river behind. */
const jamunaResort: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, LAWN);
  kit.water(D - 7, 0, 14, L, 0x5b8f9e);
  kit.ground(D - 15, 0, 3, L, 0xd8cba8);
  // main building
  kit.block(20, -18, 14, 32, 7.2, 0xf1e6cf);
  kit.windows(13, -33, -3, 0.9, 2, 3.4, GLASS, 3);
  hipRoof(kit, 20, -18, 16, 34, 4, 0xb2452c, 7.2);
  kit.block(12.5, -18, 3, 8, 3.2, 0xf1e6cf);
  hipRoof(kit, 12.5, -18, 4, 9, 1.6, 0xb2452c, 3.2);
  // the pool
  kit.ground(24, 14, 12, 18, WHITE, 0.06);
  kit.water(24, 14, 10, 16, 0x4fb3d9);
  // cottages along the river bank
  for (let i = 0; i < 5; i++) {
    const z = -36 + i * 18;
    kit.block(38, z, 7, 9, 3.4, 0xf3ead7);
    hipRoof(kit, 38, z, 8.4, 10.4, 2.6, 0xb2452c, 3.4);
    kit.palm(32, z + 7, 0.9);
  }
  kit.ground(10, 20, 14, 20, 0x9a9a92);
  for (let z = -40; z <= 40; z += 16) {
    kit.cylinder(3, z, 0.06, 4, 0x333333, 0, 6);
    kit.light(3, 4.1, z);
  }
  kit.light(13, 4.5, -10);
};

/** Mirzapur Cadet College: gate with the crest, a cream academic block, the parade ground with cadets drilling. */
const mirzapurCadet: LandmarkModel = (kit) => {
  const L = kit.length;
  grounds(kit);
  kit.compound(2, -L / 2 + 2, kit.depth - 2, L / 2 - 2, 1.8, 0xe8e0c8, -20, 9);
  for (const dz of [-25, -15]) kit.block(2, dz, 1.6, 1.6, 5, 0xe8e0c8);
  kit.block(2, -20, 1.4, 11.6, 1.2, 0x2f5f9e, 5);
  kit.sign(['মির্জাপুর ক্যাডেট কলেজ'], 1.2, 5.6, -20, 10, 1.1, { bg: '#2f5f9e', fg: '#ffffff' }, -Math.PI / 2);
  kit.ground(18, 0, 26, 60, 0x9db36a);
  for (let i = 0; i < 12; i++) kit.person(14 + (i % 4) * 2, -6 + Math.floor(i / 4) * 2, Math.PI, { shirt: 0xc8b98a, lower: 0xc8b98a, cap: 0x2f5f9e });
  kit.flag(10, 10, 10);
  kit.block(40, 0, 12, 46, 10, 0xe9dcb5);
  kit.windows(34, -22, 22, 0.8, 3, 3.2, GLASS, 3);
  kit.block(32.5, 0, 3, 10, 10, 0xd9c99c);
  kit.block(40, 0, 12.4, 46.4, 0.5, 0xb8441e, 10);
  kit.light(33.9, 4, -10);
  kit.light(33.9, 7, 10);
};

/** Kumudini Hospital, Mirzapur: the old cream two-storey block with arched verandahs and newer white wings. */
const kumudini: LandmarkModel = (kit) => {
  grounds(kit);
  kit.ground(12, 0, 20, 6, PAVE);
  kit.block(26, 0, 10, 32, 8, 0xefe4c8);
  for (const y of [0, 4]) {
    for (let z = -15; z <= 15; z += 2.5) kit.block(19, z, 0.5, 0.5, 3.6, WHITE, y);
    kit.block(19, 0, 0.5, 31, 0.4, WHITE, y + 3.6);
    kit.add(box(0.1, 2.8, 30), 0x5a4a3a, 20.95, y + 1.6, 0);
  }
  kit.block(19.6, 0, 1.6, 32, 0.25, 0xd7c8a4, 4);
  kit.block(25, 0, 12.6, 32.6, 0.6, 0xd7c8a4, 8);
  kit.sign(['কুমুদিনী হাসপাতাল'], 18.7, 9.2, 0, 10, 1, { bg: '#f6f1e2', fg: '#1d5e2f' });
  for (const dz of [-25, 25]) {
    kit.block(30, dz, 12, 14, 13, WHITE);
    kit.windows(24, dz - 7, dz + 7, 0.8, 4, 3.1, GLASS, 2.6);
  }
  kit.block(12, -18, 1, 1, 3, WHITE);
  kit.add(box(0.2, 1.6, 0.5), 0x1f8a4c, 11.4, 3.6, -18);
  kit.add(box(0.2, 0.5, 1.6), 0x1f8a4c, 11.4, 3.6, -18);
  kit.light(20.8, 6, -8);
  kit.light(20.8, 6, 8);
  kit.light(23.9, 9, -25);
};

// ---------------------------------------------------------------- Savar

/**
 * Jahangirnagar University: Mazharul Islam's red-brick halls with deep-set openings, the lakes where the winter
 * ducks gather, a Shaheed Minar, the green campus behind its gate.
 */
const jahangirnagar: LandmarkModel = (kit) => {
  const L = kit.length;
  grounds(kit);
  // the gate
  for (const dz of [-20, -8]) kit.block(3, dz, 2, 2, 6, 0xa14a2c);
  kit.block(3, -14, 1.6, 14, 1.4, 0xa14a2c, 6);
  kit.sign(['জাহাঙ্গীরনগর বিশ্ববিদ্যালয়'], 2.1, 6.7, -14, 11, 1.2, { bg: '#7e3420', fg: '#ffffff' }, -Math.PI / 2);
  kit.ground(20, -14, 34, 8, PAVE);
  // the lakes and their birds
  kit.water(26, 24, 30, 26, 0x3c7d8a);
  kit.water(18, 42, 14, 12, 0x3c7d8a);
  for (let i = 0; i < 40; i++) {
    const bx = 14 + kit.rng() * 24;
    const bz = 13 + kit.rng() * 22;
    kit.add(box(0.35, 0.2, 0.55), i % 4 ? 0x7a5536 : 0xf2f0ea, bx, 0.18, bz, [0, kit.rng() * 3, 0]);
  }
  for (let i = 0; i < 10; i++) kit.add(cyl(0.6, 0.6, 0.06, 6), 0x3f7a35, 30 + kit.rng() * 8, 0.1, 15 + kit.rng() * 12);
  // red-brick halls: deep window slots, a sloped prow
  const halls: [number, number, number, number][] = [[50, -30, 24, 12], [62, 4, 30, 15], [48, 30, 18, 10]];
  for (const [hx, hz, len, h] of halls) {
    kit.block(hx, hz, 12, len, h, 0xa14a2c);
    for (let r = 0; r < Math.floor(h / 3.5); r++) {
      for (let z = hz - len / 2 + 1.5; z < hz + len / 2 - 1; z += 3) kit.add(box(0.6, 2.2, 1), 0x241a16, hx - 6.1, 1.8 + r * 3.5, z);
    }
    kit.add(prism([[-6, 0], [6, 0], [0, 3]], len), 0x8e3f26, hx, h, hz);
  }
  // the Shaheed Minar: white frames, the bowing middle one, the red sun
  const mx = 30;
  const mz = -32;
  kit.block(mx, mz, 10, 14, 1, 0xe9e6df);
  for (const [dz, h] of [[-4.5, 5], [-2, 6], [2, 6], [4.5, 5]] as [number, number][]) {
    kit.block(mx + 1, mz + dz, 0.4, 0.4, h, WHITE, 1);
    kit.block(mx + 1, mz + dz + (dz < 0 ? 0.6 : -0.6), 0.4, 0.4, h, WHITE, 1);
    kit.block(mx + 1, mz + dz, 0.4, 1.6, 0.4, WHITE, 1 + h);
  }
  kit.block(mx + 1, mz, 0.4, 2.2, 7, WHITE, 1);
  kit.add(box(0.5, 1.2, 2.2), WHITE, mx + 0.4, 8.2, mz, [0, 0, 0.5]);
  kit.add(cyl(2.8, 2.8, 0.2, 16), 0xd62b30, mx + 2, 5.2, mz, [0, 0, Math.PI / 2]);
  for (let i = 0; i < 6; i++) kit.tree(70 + kit.rng() * 6, -L / 2 + 8 + i * 18, 1.1);
  for (let i = 0; i < 5; i++) kit.person(10 + kit.rng() * 18, -16 + kit.rng() * 6, Math.PI, { shirt: [0xe63946, 0xf2f0ea, 0x2a9d8f, 0xffd166][i % 4] });
  kit.light(3, 7.6, -14);
};

/** Dhaka EPZ, Ganakbari: BEPZA gate, white boundary wall, multi-storey garment factories and blue-roofed sheds. */
const dhakaEpz: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xa9a59a);
  kit.compound(3, -L / 2 + 2, D - 2, L / 2 - 2, 2.6, 0xeceae2, -20, 14);
  kit.wall(3, -L / 2 + 2, 3, -27, 0.4, 0x2f5f9e, 0.32, 2.2);
  kit.wall(3, -13, 3, L / 2 - 2, 0.4, 0x2f5f9e, 0.32, 2.2);
  // the gate arch with its name
  for (const dz of [-28, -12]) kit.block(3, dz, 2.2, 2.2, 7, 0xeceae2);
  kit.block(3, -20, 2, 18, 1.8, 0x1d4f8f, 7);
  kit.sign(['ঢাকা রপ্তানি প্রক্রিয়াকরণ অঞ্চল'], 1.9, 7.9, -20, 15, 1.5, { bg: '#1d4f8f', fg: '#ffffff' }, -Math.PI / 2);
  kit.block(9, -9, 3, 3, 2.8, 0xd9d6cc);
  // factories: tall white blocks with long glass bands
  const facts: [number, number, number, number][] = [[22, 20, 30, 18], [24, 44, 14, 14], [50, -36, 26, 16], [56, 8, 32, 21]];
  for (const [fx, fz, len, h] of facts) {
    kit.block(fx, fz, 16, len, h, 0xeeeee8);
    for (let y = 1.4; y < h - 2; y += 3.6) kit.add(box(0.1, 1.5, len - 2), 0x355f80, fx - 8.05, y + 0.8, fz);
    kit.block(fx, fz, 16.4, len + 0.4, 0.5, 0x2f5f9e, h);
  }
  // sheds with blue roofs
  for (const z of [-44, -20]) {
    kit.block(26, z, 14, 20, 6, 0xdedcd2);
    kit.add(prism([[-7.6, 0], [7.6, 0], [0, 2.4]], 21), 0x2f6db5, 26, 6, z);
  }
  // the water tank
  kit.cylinder(D - 8, 40, 0.4, 16, 0x9a9a92, 0, 6);
  kit.cylinder(D - 8, 40, 3.2, 4, 0xe8e6de, 16, 12);
  // the shift going in
  for (let i = 0; i < 14; i++) {
    kit.person(4 + kit.rng() * 12, -26 + kit.rng() * 12, Math.PI / 2, { shirt: [0xe63946, 0xff7aa2, 0xffd166, 0x2a9d8f, 0x8e44ad][i % 5], lower: [0x2b2b5f, 0xe63946, 0x3b5d8f][i % 3] });
  }
  kit.light(3, 9, -27);
  kit.light(3, 9, -13);
  kit.light(47.9, 12, 2);
  kit.light(13.9, 9, 26);
};

// ---------------------------------------------------------------- small ones

/** Milk Vita at Baghabari: the white dairy plant with its blue name, steel milk silos and the tankers. */
const milkVita: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D, L, 0xb3afa3);
  kit.compound(3, -L / 2 + 2, D - 2, L / 2 - 2, 2.2, 0xeceae2, 20, 10);
  kit.block(26, -10, 20, 42, 12, 0xf2f2ee);
  kit.block(26, -10, 20.4, 42.4, 1.4, 0x1f63b5, 10.6);
  kit.sign(['মিল্ক ভিটা'], 15.8, 8, -10, 12, 2.4, { bg: '#ffffff', fg: '#1f63b5' }, -Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    kit.cylinder(42, -22 + i * 7, 2.8, 14, 0xd9dde2, 0, 14);
    kit.dome(42, -22 + i * 7, 2.8, 0xc9ced4, 14, 0.4, 14);
  }
  // milk tankers in the yard
  for (const z of [22, 32]) {
    kit.add(box(2.4, 2.2, 2.2), 0x1f63b5, 14, 1.6, z - 4);
    kit.add(cyl(1.1, 1.1, 6, 12), 0xdfe3e6, 14, 2, z + 0.6, [Math.PI / 2, 0, 0]);
  }
  kit.light(15.7, 6, -20);
};

/** Payra Chattar, Jhenaidah: a round island with a slender white column and a flight of white pigeons. */
const payraChattar: LandmarkModel = (kit) => {
  const x = 12;
  kit.ground(x, 0, 22, 22, 0x8a8a82);
  kit.cylinder(x, 0, 8, 0.5, 0xb9b3a6, 0, 20);
  kit.cylinder(x, 0, 7.2, 0.15, LAWN, 0.5, 20);
  kit.cylinder(x, 0, 3.2, 0.9, 0xe9e6df, 0.5, 16);
  kit.add(cyl(2.8, 2.8, 0.05, 16), 0x4fa0c4, x, 1.42, 0);
  kit.cylinder(x, 0, 0.45, 9, WHITE, 1.4, 10, 0.25);
  // pigeons: round body, spread wings, rising round the column
  for (let i = 0; i < 9; i++) {
    const a = i * 1.3;
    const r = 1.2 + (i % 3) * 0.5;
    const y = 4 + i * 0.75;
    const px = x + Math.cos(a) * r;
    const pz = Math.sin(a) * r;
    kit.add(sph(0.3), 0xf7f7f5, px, y, pz, [0, 0, 0], [1, 0.8, 1.4]);
    kit.add(box(1.2, 0.05, 0.4), 0xf0f0ee, px, y + 0.08, pz, [0, 0, 0.3 * (i % 2 ? 1 : -1)]);
  }
  for (let i = 0; i < 6; i++) kit.add(sph(0.18), 0x9aa3ad, x + Math.cos(i) * 3.4, 1.6, Math.sin(i) * 3.4, [0, 0, 0], [1, 0.8, 1.4]);
  for (const a of [0.4, 2.2, 4.1]) kit.light(x + Math.cos(a) * 3, 1.6, Math.sin(a) * 3);
};

function sph(r: number): THREE.BufferGeometry {
  return cached(`nw:sph:${r}`, () => new THREE.SphereGeometry(r, 7, 5));
}

export const MODELS_NORTHWEST: Record<string, LandmarkModel> = {
  rooppur, bheramaraPP, smritisoudho, mahasthangarh, puthiaShiva, navaratna, kherua, mithapukur, barobazar,
  jorBangla, rabindraKachharibari, jamunaResort, mirzapurCadet, kumudini, jahangirnagar, dhakaEpz, milkVita, payraChattar,
  kuthibari, baliati, dhamraiRath,
};
