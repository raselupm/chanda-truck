// Real-design models for the eastern routes (Cumilla, Rangamati, Bandarban → Dhaka):
// - Cumilla: Victoria College (red-brick, white portico), Dharmasagar dighi, Shalban Vihara (square brick
//   monastery of ~115 cells round a courtyard, cruciform shrine), Maynamati War Cemetery (headstone rows,
//   Stone of Remembrance, Cross of Sacrifice on a terrace half up the flat-topped hill)
// - Rangamati road: the orange hanging bridge on Kaptai Lake, Ghagra falls, Kundeshwari temple and Bhavan,
//   Hathazari madrasa, Chittagong University gate
// - N1 north of Chattogram: Fouzdarhat Cadet College, the Military Academy gate at Bhatiary, the Sitakunda
//   ship-breaking yards (rusty tankers beached on the mud), Chandranath hill with its temple on top,
//   Mohipal flyover at Feni
// - Bandarban: Buddha Dhatu Jadi, the golden Burmese-style stupa on its hill
// - the tail: Meghnaghat's combined-cycle plants, Panam Nagar's derelict mansions, Bara Sardar Bari
//   (Folk Arts Museum) behind its pond, the twin Kanchpur bridges over the Shitalakshya
// Frame (kit.ts): x = 0 at the road edge, +x away from it, -z toward Dhaka; drawn for the right side.

import * as THREE from 'three';
import { box, cached, cone, cyl, ico } from '../../utils/geometry';
import type { LKit, LandmarkModel } from './kit';

const BRICK = 0xa4553a;
const BRICK_D = 0x8a4430;
const WHITE = 0xece8de;
const CREAM = 0xe2d6b8;
const LAWN = 0x74a850;
const GRASS = 0x6f9a45;
const DARK = 0x2c3a44;
const CONCRETE = 0xa9a59c;
const ROAD = 0x55534f;
const GOLD = 0xd4a52a;
const LEAVES = [0x3d6b2a, 0x4a7a30, 0x35602a, 0x557f34];
const OLIVE = 0x4f5d3a;

// ---------------------------------------------------------------- local helpers

interface Hill {
  x: number;
  z: number;
  rx: number;
  rz: number;
  h: number;
  y0?: number;
}

const hemi = () => cached('lm:hemi16', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));

/** Ground height on a set of half-ellipsoid hills. */
function hillY(hs: Hill[], x: number, z: number): number {
  let y = 0;
  for (const h of hs) {
    const d = ((x - h.x) / h.rx) ** 2 + ((z - h.z) / h.rz) ** 2;
    if (d < 1) y = Math.max(y, (h.y0 ?? 0) + h.h * Math.sqrt(1 - d));
  }
  return y;
}

/** Hills as stretched half spheres, then n tree clumps on their slopes (below maxY). */
function hills(kit: LKit, hs: Hill[], color: number, trees = 0, maxY = Infinity): void {
  for (const h of hs) kit.add(hemi(), color, h.x, h.y0 ?? 0, h.z, [0, 0, 0], [h.rx, h.h, h.rz]);
  for (let i = 0; i < trees; i++) {
    const h = hs[Math.floor(kit.rng() * hs.length)];
    const a = kit.rng() * Math.PI * 2;
    const r = Math.sqrt(kit.rng()) * 0.9;
    const x = h.x + Math.cos(a) * r * h.rx;
    const z = h.z + Math.sin(a) * r * h.rz;
    const y = hillY(hs, x, z);
    if (y > maxY) continue;
    const s = 1.8 + kit.rng() * 1.6;
    kit.add(ico(s), LEAVES[i % LEAVES.length], x, y + s * 0.5, z);
  }
}

/** An arched window or door on a face looking toward the road (-x), standing on y. */
function archX(kit: LKit, xFace: number, y: number, z: number, w: number, h: number, color = DARK): void {
  kit.add(box(0.1, h, w), color, xFace - 0.05, y + h / 2, z);
  kit.add(cyl(w / 2, w / 2, 0.1, 8), color, xFace - 0.05, y + h, z, [0, 0, Math.PI / 2]);
}

/** The same on a face looking along z (dir -1 = toward -z). */
function archZ(kit: LKit, x: number, y: number, zFace: number, dir: number, w: number, h: number, color = DARK): void {
  kit.add(box(w, h, 0.1), color, x, y + h / 2, zFace + dir * 0.05);
  kit.add(cyl(w / 2, w / 2, 0.1, 8), color, x, y + h, zFace + dir * 0.05, [Math.PI / 2, 0, 0]);
}

/** A triangular pediment facing the road, w wide along z, h tall, its base on y. */
function pediment(kit: LKit, x: number, y: number, z: number, w: number, h: number, color: number, thick = 0.8): void {
  const geo = cached(`lm:ped:${w}:${h}:${thick}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    g.translate(0, 0, -thick / 2);
    return g;
  });
  kit.add(geo, color, x, y, z, [0, Math.PI / 2, 0]);
}

/** A lathe (stupa bell, shikhara) from [radius, height] pairs, standing on y. */
function lathe(kit: LKit, key: string, profile: [number, number][], color: number, x: number, y: number, z: number, seg = 12): void {
  const geo = cached(`lm:lathe:${key}`, () => new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg));
  kit.add(geo, color, x, y, z);
}

/** A simple gate: two pillars at z = ±half, a beam with a lettered sign facing the road. */
function gate(kit: LKit, x: number, half: number, h: number, pillar: number, beam: number, lines: string[], signOpts: { bg: string; fg: string }): void {
  for (const s of [-1, 1]) kit.block(x, s * half, 1.8, 1.8, h, pillar);
  kit.block(x, 0, 1.4, half * 2 + 1.8, 1.8, beam, h);
  kit.sign(lines, x - 0.75, h + 0.9, 0, half * 2 - 0.4, 1.4, { ...signOpts, sizes: [96] }, -Math.PI / 2);
}

// ---------------------------------------------------------------- Cumilla

/** Shalban Vihara, Kotbari: 8th-c. square brick monastery, cells round a courtyard, cruciform shrine. */
function shalbanVihara(kit: LKit): void {
  const cx = kit.depth / 2;
  const H = 34;
  const cell = 5;
  kit.ground(cx, 0, kit.depth, kit.length, 0x7aa14e);
  kit.ground(cx, 0, 2 * H + 6, 2 * H + 6, 0x9c8a6a, 0.06);
  const at = (side: number, u: number, v: number): [number, number] =>
    side === 0 ? [cx - H + v, u] : side === 1 ? [cx + H - v, -u] : side === 2 ? [cx - u, -H + v] : [cx + u, H - v];
  for (let side = 0; side < 4; side++) {
    const w = (u0: number, v0: number, u1: number, v1: number, h: number, c: number, t: number) => {
      const [x0, z0] = at(side, u0, v0);
      const [x1, z1] = at(side, u1, v1);
      kit.wall(x0, z0, x1, z1, h, c, t);
    };
    // the outer wall (the gate gap in the middle of the road-side wing), and the inner verandah wall
    if (side === 0) {
      w(-H, 0.6, -4, 0.6, 2.6, BRICK, 1.3);
      w(4, 0.6, H, 0.6, 2.6, BRICK, 1.3);
    } else w(-H, 0.6, H, 0.6, 2.4 + kit.rng() * 0.5, BRICK, 1.3);
    w(-H + cell, cell, H - cell, cell, 1.6, BRICK_D, 0.8);
    // cross walls of the cells: 29 a side, ~115 in all
    const n = 29;
    for (let i = 1; i < n; i++) {
      const u = -H + (2 * H * i) / n;
      if (side === 0 && Math.abs(u) < 4) continue;
      w(u, 1.2, u, cell, 1.1 + kit.rng() * 1.1, kit.rng() < 0.5 ? BRICK : BRICK_D, 0.7);
    }
  }
  // the gate hall projecting toward the road
  for (const s of [-1, 1]) kit.block(cx - H - 2, s * 4.5, 5, 3, 2.8, BRICK);
  kit.ground(cx - H + cell / 2, 0, cell, 8, 0xb08060, 0.08);
  // the cruciform central shrine, stepped up in three stages
  kit.block(cx, 0, 24, 8, 1.4, BRICK);
  kit.block(cx, 0, 8, 24, 1.4, BRICK);
  kit.block(cx, 0, 17, 6, 1.4, BRICK_D, 1.4);
  kit.block(cx, 0, 6, 17, 1.4, BRICK_D, 1.4);
  kit.block(cx, 0, 6, 6, 1.8, BRICK, 2.8);
  for (const [dx, dz] of [[-13, 0], [13, 0], [0, -13], [0, 13]]) kit.block(cx + dx, dz, Math.abs(dx) ? 2 : 3, Math.abs(dz) ? 2 : 3, 0.6, BRICK_D);
  // votive stupa bases in the courtyard
  for (const [dx, dz] of [[-16, -16], [16, -16], [-16, 16], [16, 16], [-20, 6]]) kit.block(cx + dx, dz, 2.4, 2.4, 0.9, BRICK);
  // sal trees round it (Shalban = sal forest)
  for (let z = -42; z <= 42; z += 9) kit.tree(kit.depth - 4 + kit.rng() * 2, z, 1.2, 0x3f6a2c);
  for (let x = 8; x < kit.depth - 8; x += 12) for (const s of [-1, 1]) kit.tree(x, s * (H + 6 + kit.rng() * 2), 1.1);
  for (let i = 0; i < 5; i++) kit.person(cx - 20 + kit.rng() * 40, -18 + kit.rng() * 36, kit.rng() * 6, { shirt: [0xe63946, 0x2a9d8f, 0xf2f0ea][i % 3] });
}

/** Maynamati War Cemetery (CWGC): headstone rows, Stone of Remembrance, Cross on the flat-topped hill. */
function warCemetery(kit: LKit): void {
  const D = kit.depth;
  const L = kit.length;
  kit.ground(D / 2, 0, D, L, LAWN);
  // low cream boundary wall, gap for the gate
  kit.wall(1, -L / 2 + 2, 1, -7, 1.1, CREAM, 0.5);
  kit.wall(1, 7, 1, L / 2 - 2, 1.1, CREAM, 0.5);
  for (const s of [-1, 1]) kit.wall(1, s * (L / 2 - 2), D - 2, s * (L / 2 - 2), 1.1, CREAM, 0.5);
  kit.wall(D - 2, -L / 2 + 2, D - 2, L / 2 - 2, 1.1, CREAM, 0.5);
  // the entrance building: two rooms either side of the open passage under one flat roof
  for (const s of [-1, 1]) kit.block(4.5, s * 4.5, 6, 4, 3.8, CREAM);
  kit.block(4.5, 0, 7, 14, 0.5, 0xcfc3a5, 3.8);
  kit.block(1.4, 0, 0.3, 5, 0.5, 0x6b5a3a, 3.2);
  kit.ground(26, 0, 44, 3.5, 0xd9cfb4, 0.07);
  // rows of white headstones either side of the central path, facing the road
  for (const s of [-1, 1]) {
    for (let row = 0; row < 10; row++) {
      for (let c = 0; c < 9; c++) kit.block(12 + row * 3.3, s * (5.5 + c * 3.3), 0.18, 0.6, 0.8, 0xf0ece2);
      kit.ground(12.6 + row * 3.3, s * 19, 0.6, 30, 0xc46a7a, 0.07);
    }
  }
  // the Stone of Remembrance
  kit.block(46, 0, 3, 5.4, 0.3, 0xe8e4da);
  kit.block(46, 0, 1.4, 3.8, 1.2, 0xf2efe6, 0.3);
  // the hill, the terrace half way up with its steps, the Cross of Sacrifice
  hills(kit, [{ x: 74, z: 0, rx: 16, rz: 28, h: 9 }], 0x69a046, 10, 7.5);
  kit.block(58, 0, 8, 12, 3.4, 0xd8d0bc);
  for (let i = 0; i < 6; i++) kit.block(51.8 + i * 0.75, 0, 0.75, 4.5, 0.57 * (i + 1), 0xd8d0bc);
  kit.cylinder(59, 0, 1.4, 0.6, 0xeeeae0, 3.4, 8);
  kit.cylinder(59, 0, 1, 0.5, 0xeeeae0, 4, 8);
  kit.block(59, 0, 0.45, 0.45, 7.2, 0xf6f3ea, 4.5);
  kit.block(59, 0, 0.4, 3, 0.45, 0xf6f3ea, 9.3);
  kit.block(58.75, 0, 0.06, 0.14, 3.4, 0x4a3b22, 6.8);
  kit.block(58.75, 0, 0.06, 1, 0.12, 0x4a3b22, 9.4);
  // the shelter on top looking out over the far side
  kit.block(76, 0, 5, 6, 0.3, CREAM, 8.6);
  for (const [dx, dz] of [[-2, -2.6], [2, -2.6], [-2, 2.6], [2, 2.6]]) kit.block(76 + dx, dz, 0.4, 0.4, 2.8, CREAM, 8.9);
  kit.block(76, 0, 5.6, 6.6, 0.4, 0xcfc3a5, 11.7);
  // tall trees framing it
  for (let x = 10; x <= 50; x += 10) for (const s of [-1, 1]) kit.tree(x, s * (L / 2 - 5), 1.1);
  kit.palm(8, -12, 1);
  kit.palm(8, 12, 1);
}

/** Cumilla Victoria College: the old red-brick building with white bands and a columned portico. */
function victoriaCollege(kit: LKit): void {
  kit.ground(kit.depth / 2, 0, kit.depth, kit.length, GRASS);
  kit.ground(13, 0, 22, 40, 0x86a85a, 0.06);
  const red = 0xa64b32;
  kit.block(34, 0, 12, 46, 9, red);
  kit.block(34, 0, 12.4, 46.4, 0.4, WHITE, 4.3);
  kit.block(34, 0, 12.4, 46.4, 0.9, WHITE, 9);
  for (let z = -21; z <= 21; z += 3.4) {
    if (Math.abs(z) < 4) continue;
    archX(kit, 28, 1, z, 1.4, 2.2, 0x3a2a22);
    archX(kit, 28, 5.4, z, 1.4, 2, 0x3a2a22);
  }
  // portico: four white columns, a pediment
  kit.block(25.5, 0, 5, 9, 0.6, WHITE);
  for (const z of [-3.6, -1.2, 1.2, 3.6]) kit.cylinder(23.5, z, 0.4, 8.4, WHITE, 0.6, 10);
  kit.block(25.5, 0, 5, 9.4, 1, WHITE, 9);
  pediment(kit, 23.4, 10, 0, 9.4, 2.4, WHITE);
  kit.flag(18, -8, 10);
  kit.treeRow(4, -26, 26, 9, 0.9);
  for (let i = 0; i < 6; i++) kit.person(8 + kit.rng() * 14, -16 + kit.rng() * 32, kit.rng() * 6, { shirt: [0xf2f0ea, 0x5b8fd6, 0xc94f6d][i % 3] });
}

/** Dharmasagar: the 23-acre royal tank in Cumilla town, tree-lined walks, Rani Kuthi on the far bank. */
function dharmasagar(kit: LKit): void {
  const D = kit.depth;
  kit.ground(D / 2, 0, D, kit.length, GRASS);
  kit.ground(42, 0, 62, 58, 0xc9bfa4, 0.05);
  kit.water(42, 0, 58, 54, 0x41808f);
  // the ghat on the road side
  for (let i = 0; i < 4; i++) kit.block(14 + i * 0.6, 0, 0.6, 8, 0.25 * (4 - i), 0xd2c7b0);
  // Rani Kuthi: a small white two-storey house past the far bank
  kit.block(80, 18, 8, 14, 7, WHITE);
  kit.block(80, 18, 8.6, 14.6, 0.5, 0xcfc8b8, 7);
  kit.windows(76, 11.5, 24.5, 0.5, 2, 3.3, DARK, 2.6, 1, 1.6);
  // benches and trees round the walks
  for (let z = -36; z <= 36; z += 8) for (const x of [8, 76]) if (!(x === 76 && z > 8 && z < 28)) kit.tree(x + kit.rng() * 2, z, 1.05);
  for (let x = 16; x <= 68; x += 9) for (const s of [-1, 1]) kit.tree(x, s * 32, 0.95);
  for (let i = 0; i < 2; i++) kit.block(30 + i * 22, -12 + i * 18, 1.4, 4.5, 0.6, 0x8a5a33, 0.05);
  for (let i = 0; i < 6; i++) kit.person(10 + kit.rng() * 3, -30 + kit.rng() * 60, kit.rng() * 6, { shirt: [0xf2f0ea, 0xe0a030, 0x3b7bd6][i % 3] });
}

// ---------------------------------------------------------------- Rangamati road

/** Rangamati's suspension footbridge across an arm of Kaptai Lake, between two green hillocks. */
function hangingBridge(kit: LKit): void {
  const D = kit.depth;
  kit.water(D / 2 + 4, 0, D - 4, kit.length, 0x3b7f8c);
  const hs: Hill[] = [{ x: 4, z: 0, rx: 14, rz: 34, h: 7 }, { x: 78, z: -6, rx: 14, rz: 40, h: 12 }];
  hills(kit, hs, 0x5e8f3a, 26, 5.5);
  const orange = 0xe2581f;
  const x0 = 13;
  const x1 = 70;
  const deckY = 5.2;
  const sag = 1.4;
  const top = 12;
  // the towers: an A-frame at each end
  for (const x of [x0, x1]) {
    for (const s of [-1, 1]) kit.block(x, s * 1.4, 0.5, 0.5, top, orange);
    kit.block(x, 0, 0.5, 3.3, 0.5, orange, top - 0.5);
    kit.block(x, 0, 0.5, 3.3, 0.4, orange, deckY + 2);
    kit.block(x, 0, 2, 4, deckY, 0x9a958a);
  }
  // deck, side rails, hangers and the main cables in segments
  const n = 22;
  const dy = (t: number) => deckY - sag * Math.sin(Math.PI * t);
  const cy = (t: number) => top - (top - deckY - 1.2 - sag) * Math.sin(Math.PI * t);
  for (let i = 0; i < n; i++) {
    const ta = i / n;
    const tb = (i + 1) / n;
    const xa = x0 + (x1 - x0) * ta;
    const xb = x0 + (x1 - x0) * tb;
    const len = Math.hypot(xb - xa, dy(tb) - dy(ta));
    const ang = Math.atan2(dy(tb) - dy(ta), xb - xa);
    kit.add(box(len, 0.2, 2.2), 0x8a6a45, (xa + xb) / 2, (dy(ta) + dy(tb)) / 2, 0, [0, 0, ang]);
    const clen = Math.hypot(xb - xa, cy(tb) - cy(ta));
    const cang = Math.atan2(cy(tb) - cy(ta), xb - xa);
    for (const s of [-1, 1]) {
      kit.add(box(len, 0.12, 0.08), orange, (xa + xb) / 2, (dy(ta) + dy(tb)) / 2 + 1, s * 1.15, [0, 0, ang]);
      kit.add(box(clen, 0.12, 0.12), orange, (xa + xb) / 2, (cy(ta) + cy(tb)) / 2, s * 1.4, [0, 0, cang]);
      if (i > 0) kit.add(box(0.06, cy(ta) - dy(ta), 0.06), orange, xa, (cy(ta) + dy(ta)) / 2, s * 1.3);
    }
  }
  // country boats on the lake and visitors at the near end
  for (const [x, z] of [[35, 22], [55, -26], [28, -30]]) {
    kit.add(box(1.4, 0.5, 6), 0x5a3d22, x, 0.3, z);
    kit.add(box(1.2, 0.8, 1.6), 0xc9a85a, x, 0.9, z + 0.6);
  }
  for (let i = 0; i < 5; i++) kit.person(6 + kit.rng() * 4, -6 + kit.rng() * 12, kit.rng() * 6, { shirt: [0xe63946, 0xffd166, 0x2a9d8f, 0xf2f0ea, 0x7b4fd6][i] });
}

/** Ghagra waterfall: a white fall down a dark rock face into a pool, jungle round it. */
function ghagraFalls(kit: LKit): void {
  const hs: Hill[] = [{ x: 34, z: -12, rx: 16, rz: 12, h: 16 }, { x: 34, z: 12, rx: 16, rz: 12, h: 15 }, { x: 40, z: 0, rx: 10, rz: 10, h: 18 }];
  hills(kit, hs, 0x4f7f34, 30);
  kit.block(27, 0, 6, 12, 15, 0x55554a);
  for (const [z, h] of [[-5, 12], [4.5, 13], [0, 16]]) kit.block(25.5 + kit.rng(), z, 3, 3, h, 0x67665a);
  kit.add(box(0.3, 14.6, 3), 0xeef5f6, 23.8, 7.3, 0.3);
  kit.add(box(0.3, 9, 1.6), 0xffffff, 23.6, 4.5, 1.5);
  kit.water(18, 0, 10, 14, 0x4a8b8f);
  for (let i = 0; i < 7; i++) kit.ball(14 + kit.rng() * 9, 0.3, -8 + kit.rng() * 16, 0.6 + kit.rng() * 0.8, 0x77756a);
  for (let i = 0; i < 4; i++) kit.person(8 + kit.rng() * 5, -6 + kit.rng() * 12, kit.rng() * 6, { shirt: [0xe63946, 0x2a9d8f][i % 2] });
}

/** Kundeshwari, Gahira: the white temple with its shikhara, and the Kundeshwari Bhavan behind. */
function kundeshwari(kit: LKit): void {
  kit.ground(kit.depth / 2, 0, kit.depth, kit.length, GRASS);
  kit.compound(1, -kit.length / 2 + 1, kit.depth - 1, kit.length / 2 - 1, 1.6, 0xe9e2d2, 0, 6);
  // temple: plinth, sanctum, a curved rekha spire with amalaka and kalash, saffron flag
  const tx = 14;
  const tz = -9;
  kit.block(tx, tz, 9, 9, 1.2, 0xd8cfbe);
  kit.block(tx, tz, 5.4, 5.4, 4, WHITE, 1.2);
  archX(kit, tx - 2.7, 1.2, tz, 1.4, 2, 0x5a2a1a);
  lathe(kit, 'kundShikhara', [[3.1, 0], [3, 2], [2.7, 4.5], [2.1, 7], [1.3, 8.6], [0.6, 9.2], [0, 9.4]], 0xf3eee4, tx, 5.2, tz, 8);
  kit.cylinder(tx, tz, 0.9, 0.5, 0xf3eee4, 14.4, 10);
  kit.spire(tx, tz, 0.35, 1.2, GOLD, 14.9, 8);
  kit.cylinder(tx + 0.4, tz, 0.05, 4, 0xe8e8e8, 14, 6);
  kit.add(box(0.04, 0.8, 1.4), 0xf07f1f, tx + 0.4, 17.4, tz + 0.75);
  // natmandir: an open hall on pillars in front
  kit.block(tx, tz + 9, 8, 7, 0.5, 0xd8cfbe);
  for (const [dx, dz] of [[-3.4, -3], [3.4, -3], [-3.4, 3], [3.4, 3]]) kit.block(tx + dx, tz + 9 + dz, 0.4, 0.4, 3.6, WHITE, 0.5);
  kit.block(tx, tz + 9, 8.4, 7.4, 0.4, 0xcfc8b8, 4.1);
  // Kundeshwari Bhavan: white three-storey house with arched verandahs
  kit.block(33, 6, 12, 24, 11, WHITE);
  for (let f = 0; f < 3; f++) for (let z = -4.5; z <= 16.5; z += 3) archX(kit, 27, 0.6 + f * 3.6, z, 1.4, 2, 0x4a5560);
  kit.block(33, 6, 12.6, 24.6, 0.7, 0xd9d2c2, 11);
  kit.sign(['কুণ্ডেশ্বরী ঔষধালয়'], 26.9, 12.3, 6, 10, 1.3, { bg: '#f3eee4', fg: '#8a1f1f', sizes: [100] }, -Math.PI / 2);
  kit.palm(6, 14, 1);
  kit.tree(44, -14, 1.1);
  for (let i = 0; i < 4; i++) kit.person(6 + kit.rng() * 10, -12 + kit.rng() * 10, kit.rng() * 6, { shirt: [0xf2f0ea, 0xe85d75, 0xf0b030][i % 3] });
}

/** Darul Uloom Hathazari: the big white domed mosque and the multi-storey hostel blocks. */
function hathazariMadrasa(kit: LKit): void {
  const L = kit.length;
  kit.ground(kit.depth / 2, 0, kit.depth, L, 0xbdb39c);
  kit.wall(1, -L / 2 + 1, 1, -5, 2, WHITE, 0.4);
  kit.wall(1, 5, 1, L / 2 - 1, 2, WHITE, 0.4);
  gate(kit, 1.5, 4, 5, WHITE, 0xdde8dd, ['দারুল উলূম হাটহাজারী'], { bg: '#1f6b3a', fg: '#ffffff' });
  // the mosque: white prayer hall, drum and big dome, four corner minarets
  const mx = 30;
  const mz = -12;
  kit.block(mx, mz, 16, 18, 9, WHITE);
  for (let z = mz - 6; z <= mz + 6; z += 3) archX(kit, mx - 8, 0.5, z, 1.6, 3.4, 0x3d5560);
  kit.cylinder(mx, mz, 6, 1.6, WHITE, 9, 16);
  kit.dome(mx, mz, 6, 0xf5f3ee, 10.6, 1.15, 16);
  kit.spire(mx, mz, 0.3, 2, GOLD, 17.4, 6);
  for (const [dx, dz] of [[-8, -9], [8, -9], [-8, 9], [8, 9]]) {
    kit.cylinder(mx + dx, mz + dz, 0.9, 22, WHITE, 0, 10);
    kit.cylinder(mx + dx, mz + dz, 1.3, 0.5, 0xdcd8cc, 14, 10);
    kit.cylinder(mx + dx, mz + dz, 1.3, 0.5, 0xdcd8cc, 19, 10);
    kit.dome(mx + dx, mz + dz, 1, WHITE, 22, 1.4, 10);
    kit.light(mx + dx, 23.6, mz + dz, 0xb8ffc8);
  }
  // hostel / class blocks
  kit.block(30, 15, 14, 18, 16, 0xe8dfc7);
  kit.windows(23, 6.5, 23.5, 0.5, 5, 3.1, DARK, 2.8, 1.2, 1.5);
  kit.block(58, 0, 12, 44, 13, 0xe4dbc4);
  kit.windows(52, -21, 21, 0.5, 4, 3.1, DARK, 3, 1.2, 1.5);
  for (const z of [10, 20]) kit.light(22.9, 7, z);
  for (let i = 0; i < 9; i++) kit.person(8 + kit.rng() * 14, -20 + kit.rng() * 40, kit.rng() * 6, { shirt: 0xf6f6f2, lower: 0xf6f6f2, cap: 0xffffff });
}

/** Chittagong University gate: red-brick pillars, a white beam with the name, hills behind. */
function cuGate(kit: LKit): void {
  kit.ground(kit.depth / 2, 0, kit.depth, kit.length, GRASS);
  kit.ground(kit.depth / 2, 0, kit.depth, 9, ROAD, 0.06);
  hills(kit, [{ x: 30, z: -14, rx: 12, rz: 8, h: 11 }, { x: 32, z: 13, rx: 10, rz: 8, h: 9 }], 0x4f7f34, 18);
  for (const s of [-1, 1]) {
    kit.block(5, s * 6.5, 2.6, 2.6, 9, 0xa0472e);
    kit.block(5, s * 6.5, 3, 3, 0.5, WHITE, 9);
    kit.block(5, s * 9.6, 1.4, 1.8, 4, 0xa0472e);
  }
  kit.block(5, 0, 2, 16, 2.2, WHITE, 9.5);
  kit.sign(['চট্টগ্রাম বিশ্ববিদ্যালয়'], 3.95, 10.6, 0, 12.4, 1.6, { bg: '#ffffff', fg: '#8a1f1f', sizes: [104] }, -Math.PI / 2);
  kit.block(8, 11.5, 2, 2, 2.6, 0xd8d0bc);
  kit.block(8, 11.5, 2.4, 2.4, 0.3, 0x8a3a2a, 2.6);
  for (let i = 0; i < 5; i++) kit.person(3 + kit.rng() * 10, -8 + kit.rng() * 16, kit.rng() * 6, { shirt: [0xf2f0ea, 0x3b7bd6, 0xe85d75][i % 3] });
}

// ---------------------------------------------------------------- N1, Chattogram → Feni

/** Fouzdarhat Cadet College: gate, parade ground with cadets in white, the academic block, hills behind. */
function faujdarhatCadet(kit: LKit): void {
  const L = kit.length;
  kit.ground(kit.depth / 2, 0, kit.depth, L, GRASS);
  hills(kit, [{ x: 74, z: -18, rx: 18, rz: 24, h: 18 }, { x: 76, z: 20, rx: 16, rz: 22, h: 15 }], 0x4c7c32, 30);
  gate(kit, 2, 4.5, 4.6, CREAM, 0x7a2a2a, ['ফৌজদারহাট ক্যাডেট কলেজ'], { bg: '#7a1f1f', fg: '#ffffff' });
  kit.wall(2, -L / 2 + 1, 2, -5.5, 1.8, CREAM, 0.4);
  kit.wall(2, 5.5, 2, L / 2 - 1, 1.8, CREAM, 0.4);
  // parade ground, flag, cadets
  kit.ground(22, -8, 24, 36, 0xb59b6a, 0.06);
  kit.flag(12, -26, 12);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) kit.person(18 + r * 1.6, -18 + c * 1.6, 0, { shirt: 0xf8f8f4, lower: 0xf8f8f4, cap: 0x2a2a3a });
  // the academic block: long, two storeys, cream with maroon bands, a taller centre with a clock
  kit.block(46, 0, 12, 56, 8.5, 0xe8dcc0);
  kit.block(46, 0, 12.4, 56.4, 0.5, 0x7a2a2a, 4);
  kit.block(46, 0, 12.4, 56.4, 0.6, 0x7a2a2a, 8.5);
  kit.windows(40, -27, 27, 0.6, 2, 4, DARK, 3, 1.4, 1.8);
  kit.block(39, 0, 4, 8, 13, 0xe8dcc0);
  kit.block(39, 0, 4.4, 8.4, 0.6, 0x7a2a2a, 13);
  kit.cylinder(36.9, 0, 1.1, 0.15, 0xf8f6ee, 10.6, 16);
  kit.add(box(0.2, 0.9, 0.1), 0x222222, 36.75, 10.9, 0);
  kit.block(62, 22, 10, 14, 7, 0xe8dcc0);
  kit.treeRow(4, 6, 28, 8, 1);
}

/** Bangladesh Military Academy, Bhatiary: the main gate (crest, name, motto), sentries, hills. */
function bma(kit: LKit): void {
  const L = kit.length;
  kit.ground(kit.depth / 2, 0, kit.depth, L, GRASS);
  kit.ground(26, 0, 44, 9, ROAD, 0.06);
  hills(kit, [{ x: 42, z: -16, rx: 20, rz: 15, h: 16 }, { x: 46, z: 17, rx: 18, rz: 14, h: 13 }], 0x4c7c32, 30);
  // the gate: two tall cream pillars with olive bands, the lettered beam, the crest on top
  for (const s of [-1, 1]) {
    kit.block(4, s * 8, 3, 3, 11, CREAM);
    kit.block(4, s * 8, 3.2, 3.2, 0.8, OLIVE, 9.6);
    kit.block(4, s * 8, 3.2, 3.2, 0.8, OLIVE, 1);
    kit.spire(4, s * 8, 1.4, 1.6, GOLD, 13.4, 4);
  }
  kit.block(4, 0, 2.4, 19, 2.4, CREAM, 11);
  kit.add(cyl(2.2, 2.2, 0.4, 16), GOLD, 3.9, 15.4, 0, [0, 0, Math.PI / 2]);
  kit.add(cyl(1.6, 1.6, 0.42, 16), 0x2f4a2a, 3.88, 15.4, 0, [0, 0, Math.PI / 2]);
  kit.add(box(0.44, 1.8, 0.3), GOLD, 3.86, 15.4, 0);
  kit.sign(['বাংলাদেশ মিলিটারি একাডেমি'], 2.75, 12.2, 0, 13, 1.7, { bg: '#2f4a2a', fg: '#f2d16b', sizes: [96] }, -Math.PI / 2);
  kit.block(3, 15, 1, 6, 2, 0x8f8a7e);
  kit.sign(['চির উন্নত মম শির'], 2.45, 1.1, 15, 5.4, 1.2, { bg: '#2f4a2a', fg: '#f2d16b', sizes: [90] }, -Math.PI / 2);
  // sentry boxes, a boom barrier, flags
  for (const s of [-1, 1]) {
    kit.block(8, s * 11.5, 2, 2, 2.6, OLIVE);
    kit.block(8, s * 11.5, 2.4, 2.4, 0.3, 0x2f3a24, 2.6);
    kit.light(7, 2.8, s * 11.5);
  }
  for (let i = 0; i < 6; i++) kit.block(6.5, -5 + i * 1.6, 0.2, 1.6, 0.2, i % 2 ? 0xffffff : 0xc8312a, 1);
  kit.flag(2, -14, 9);
  kit.flag(2, 20, 9);
  for (const z of [-3, 3]) kit.person(7, z, -Math.PI / 2, { shirt: OLIVE, lower: OLIVE, cap: 0x2f3a24 });
  kit.treeRow(12, -24, -8, 8, 0.9);
}

/** Sitakunda ship-breaking yard: tankers and bulk carriers beached bow-first on the mud, partly cut. */
function shipBreaking(kit: LKit): void {
  const D = kit.depth;
  const L = kit.length;
  kit.ground(D / 2, 0, D, L, 0x6e6253);
  kit.water(D * 0.75, 0, D * 0.5, L, 0x5d7a80);
  kit.ground(30, 0, 50, L, 0x7c705e, 0.05);
  // the yard fence along the road with a gate
  kit.wall(1, -L / 2, 1, -6, 2.4, 0x3d6f9a, 0.15);
  kit.wall(1, 6, 1, L / 2, 2.4, 0x3d6f9a, 0.15);
  const hull = (len: number, beam: number, h: number) =>
    cached(`lm:hull:${len}:${beam}:${h}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-beam / 2, len / 2);
      s.lineTo(beam / 2, len / 2);
      s.lineTo(beam / 2, -len / 2 + beam * 0.9);
      s.lineTo(0, -len / 2);
      s.lineTo(-beam / 2, -len / 2 + beam * 0.9);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      return g;
    });
  const RUST = 0x8a4a2a;
  const BOTTOM = 0x7a2e24;
  const BLACK = 0x3a302a;
  /** a whole ship, bow on the mud toward the road, stern out in the water */
  const ship = (xc: number, z: number, len: number, beam: number, upper: number, tanker: boolean) => {
    kit.add(hull(len, beam, 5), BOTTOM, xc, -1, z, [0, -Math.PI / 2, 0]);
    kit.add(hull(len, beam, 6), upper, xc, 4, z, [0, -Math.PI / 2, 0]);
    // rust streaks down the side facing the truck
    for (let i = 0; i < 6; i++) kit.add(box(0.6 + kit.rng() * 2, 2 + kit.rng() * 4, 0.1), RUST, xc - len / 2 + 10 + kit.rng() * (len - 20), 4 + kit.rng() * 3, z + beam / 2 + 0.06);
    if (tanker) {
      kit.add(box(len * 0.7, 0.5, 0.5), 0x6b6b5e, xc - 4, 10.3, z);
      for (let x = xc - len / 2 + 14; x < xc + len / 2 - 18; x += 9) kit.block(x, z, 0.5, beam * 0.7, 0.8, 0x7a6b52, 10);
    } else {
      for (let x = xc - len / 2 + 12; x < xc + len / 2 - 18; x += 9) kit.block(x, z, 6, beam * 0.75, 1.2, 0x9a5a30, 10);
      for (let x = xc - len / 2 + 16; x < xc + len / 2 - 20; x += 18) {
        kit.block(x, z, 0.8, 0.8, 9, 0xb08a30, 10);
        kit.add(box(10, 0.5, 0.5), 0xb08a30, x + 4, 18, z, [0, 0, 0.35]);
      }
    }
    // accommodation block and funnel at the stern
    const sx = xc + len / 2 - 7;
    kit.block(sx, z, 8, beam * 0.9, 9, 0xd8d2c4, 10);
    kit.windows(sx - 4, z - beam * 0.4, z + beam * 0.4, 11, 3, 2.8, DARK, 2, 1.2, 0.9);
    kit.block(sx, z, 9, beam + 2, 0.4, 0xd8d2c4, 16);
    kit.block(sx + 3, z, 3.4, 2.6, 7, 0x2a2a2a, 19);
    kit.light(sx + 3, 26.4, z, 0xff3b30);
  };
  ship(66, -46, 78, 14, BLACK, true);
  ship(68, 4, 72, 13, 0x5a3a2a, false);
  // the third is cut down to its stern: the open section shows its dark insides
  const cz = 50;
  kit.block(92, cz, 30, 13, 5, BOTTOM, -1);
  kit.block(92, cz, 30, 13, 6, 0x2f4f6a, 4);
  kit.block(76.9, cz, 0.3, 12, 9, 0x1c1814, 0.5);
  kit.block(100, cz, 8, 11.5, 8, 0xd8d2c4, 10);
  kit.block(102, cz, 3, 2.4, 5, 0x2a2a2a, 18);
  // cut plates and hull sections on the mud, winch cables, a crane, workers
  for (let i = 0; i < 12; i++) {
    const big = i < 4;
    kit.add(box(big ? 8 : 3 + kit.rng() * 3, big ? 4 : 0.3, big ? 6 : 2 + kit.rng() * 2), i % 3 ? RUST : 0x5a4030, 14 + kit.rng() * 40, big ? 2 : 0.2, -30 + kit.rng() * 70, [0, kit.rng() * Math.PI, big ? 0.2 : 0]);
  }
  for (const z of [-46, 4]) for (const s of [-1, 1]) kit.wall(8, z + s * 3, 28, z + s * 2, 0.06, 0x2a2a2a, 0.06, 1.2);
  kit.block(18, -20, 3, 4, 1.6, 0xe0b020);
  kit.add(box(0.6, 0.6, 16), 0xe0b020, 18, 7, -20, [0.9, 0, 0]);
  for (let i = 0; i < 10; i++) kit.person(12 + kit.rng() * 30, -40 + kit.rng() * 90, kit.rng() * 6, { shirt: [0xe0a030, 0x5b6b7a, 0x8a3a2a][i % 3], lungi: true, cap: i % 2 ? 0xe0b020 : undefined });
  for (let i = 0; i < 4; i++) kit.block(6, -60 + i * 7, 4, 5, 3, 0x7a7a72);
}

/** Chandranath hill, Sitakunda: a steep forested hill, the pilgrims' steps, the small temple on the top. */
function chandranath(kit: LKit): void {
  const hs: Hill[] = [{ x: 62, z: 0, rx: 46, rz: 54, h: 26 }, { x: 64, z: 2, rx: 20, rz: 22, h: 50, y0: 14 }];
  hills(kit, hs, 0x426f2c, 110, 61);
  // the steps zig-zagging up the road-facing slope
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const x = 16 + t * 46;
    const z = Math.sin(t * Math.PI * 4) * 9 * (1 - t);
    const y = hillY(hs, x, z);
    kit.block(x, z, 1.8, 2.2, 0.5, 0xbdb6a8, y - 0.3);
  }
  // the temple: white plinth, shrine, a short shikhara, kalash, the saffron flag
  const ty = hillY(hs, 64, 2);
  kit.block(64, 2, 8, 8, 1.2, 0xd8d1c2, ty - 0.6);
  kit.block(64, 2, 4.4, 4.4, 3.4, 0xf1ece2, ty + 0.6);
  archX(kit, 61.8, ty + 0.6, 2, 1.2, 1.8, 0x5a2a1a);
  lathe(kit, 'chandranath', [[2.4, 0], [2.2, 1.5], [1.6, 3], [0.8, 4.2], [0, 4.6]], 0xf1ece2, 64, ty + 4, 2, 8);
  kit.spire(64, 2, 0.3, 1, GOLD, ty + 8.5, 6);
  kit.cylinder(65.5, 3.5, 0.06, 6, 0xe8e8e8, ty + 0.6, 6);
  kit.add(box(0.04, 1, 1.8), 0xf07f1f, 65.5, ty + 6, 4.4);
  kit.light(64, ty + 9.6, 2, 0xffc870);
  // the gate at the foot
  for (const s of [-1, 1]) kit.block(10, s * 3, 1, 1, 4.5, 0xf07f1f);
  kit.block(10, 0, 1, 7, 1.2, 0xf6efe0, 4.5);
  kit.sign(['চন্দ্রনাথ ধাম'], 9.45, 5.1, 0, 5.6, 1, { bg: '#f6efe0', fg: '#b03010', sizes: [100] }, -Math.PI / 2);
  for (let i = 0; i < 5; i++) kit.person(6 + kit.rng() * 6, -4 + kit.rng() * 8, kit.rng() * 6, { shirt: [0xf07f1f, 0xf2f0ea, 0xe63946][i % 3] });
}

/** Mohipal flyover, Feni: the six-lane deck on hammerhead piers with ramps at both ends, traffic below. */
function mohipalFlyover(kit: LKit): void {
  const x = 17;
  const w = 22;
  const h = 7.5;
  const C = 0xbdb8ae;
  kit.ground(x, 0, w + 6, kit.length, ROAD, 0.05);
  kit.block(x, 0, w, 100, 1.4, C, h);
  for (const s of [-1, 1]) kit.block(x + s * (w / 2 - 0.2), 0, 0.4, 100, 1, 0xdedad2, h + 1.4);
  kit.block(x, 0, 0.6, 100, 0.8, 0xdedad2, h + 1.4);
  for (let z = -40; z <= 40; z += 20) {
    kit.block(x, z, 2.4, 2.4, h - 1.2, 0xa8a398);
    kit.block(x, z, 16, 2.4, 1.2, 0xa8a398, h - 1.2);
  }
  // ramps down at both ends, tilted about x
  const rl = 25;
  const a = Math.atan2(h, rl);
  for (const s of [-1, 1]) {
    kit.add(box(w, 1.4, Math.hypot(rl, h)), C, x, h / 2 + 0.7, s * (50 + rl / 2), [s * a, 0, 0]);
    kit.block(x, s * 56, 2, 2, h * 0.7, 0xa8a398);
  }
  for (let z = -45; z <= 45; z += 15) {
    kit.cylinder(x, z, 0.12, 8, 0x8a8a86, h + 1.4, 6);
    kit.add(box(0.15, 0.15, 3), 0x8a8a86, x, h + 9.3, z);
    kit.light(x, h + 9.1, z - 1.4);
    kit.light(x, h + 9.1, z + 1.4);
  }
  // traffic: on the deck and under it
  const cols = [0x2f6db5, 0xe0b020, 0x3fa34d, 0xc8312a, 0xf2f0ea];
  for (let i = 0; i < 6; i++) kit.block(x - 6 + (i % 4) * 4, -40 + i * 16, 2.4, i % 2 ? 4.5 : 10, i % 2 ? 1.6 : 3.2, cols[i % cols.length], h + 1.4);
  for (let i = 0; i < 4; i++) kit.block(x - 5 + i * 3.4, -20 + i * 13, 1.6, 2.6, 1.6, 0x3fa34d);
}

// ---------------------------------------------------------------- Bandarban

/** Buddha Dhatu Jadi (the Golden Temple): golden Burmese stupa and tiered pavilions on a hill top. */
function goldenTemple(kit: LKit): void {
  const hs: Hill[] = [{ x: 52, z: 0, rx: 34, rz: 38, h: 20 }];
  hills(kit, hs, 0x4f7f34, 40, 16);
  const top = 21;
  kit.block(56, 0, 28, 32, 4, 0xece6d6, 17);
  // the grand stair with golden naga balustrades
  const x0 = 14;
  const x1 = 43;
  for (let i = 0; i < 14; i++) kit.block(x0 + 1 + i * 2.1, 0, 2.2, 6, ((i + 1) * top) / 14, 0xe8e2d2);
  const len = Math.hypot(x1 - x0, top);
  const ang = Math.atan2(top, x1 - x0);
  for (const s of [-1, 1]) {
    kit.add(box(len, 0.9, 0.6), GOLD, (x0 + x1) / 2, top / 2 + 1, s * 3.4, [0, 0, ang]);
    kit.ball(x0 - 0.5, 1.6, s * 3.4, 0.9, GOLD);
    kit.add(cone(0.5, 1.4, 6), 0xc0302a, x0 - 1.2, 1.6, s * 3.4, [0, 0, Math.PI / 2]);
  }
  // the main zedi: square terraces, an octagonal drum, the golden bell, rings, spire and hti
  const zx = 60;
  kit.block(zx, 0, 15, 15, 2, 0xf3efe4, top);
  kit.block(zx, 0, 12, 12, 1.6, GOLD, top + 2);
  kit.cylinder(zx, 0, 4.8, 1.6, GOLD, top + 3.6, 8, 4.4);
  lathe(kit, 'zediBell', [[4.4, 0], [4.6, 1], [4.4, 2.6], [3.6, 4.4], [2.4, 5.8], [1.5, 6.8], [1.1, 7.4]], GOLD, zx, top + 5.2, 0, 14);
  for (let i = 0; i < 4; i++) kit.cylinder(zx, 0, 1.1 - i * 0.18, 0.5, i % 2 ? 0xe6bb3a : GOLD, top + 12.6 + i * 0.5, 10);
  kit.spire(zx, 0, 0.6, 6, GOLD, top + 14.6, 10);
  kit.cylinder(zx, 0, 0.7, 0.4, 0xf2d16b, top + 19, 10, 0.2);
  kit.ball(zx, top + 20.8, 0, 0.25, 0xffffff);
  kit.light(zx, top + 21.2, 0, 0xffe7a0);
  // four small corner stupas
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
    kit.cylinder(zx + dx, dz, 0.9, 1.2, GOLD, top + 3.6, 8);
    kit.add(cone(0.8, 3, 8), GOLD, zx + dx, top + 6.3, dz);
  }
  // two pavilions with stacked red-and-gold roofs either side of the stair head
  for (const s of [-1, 1]) {
    const px = 47;
    const pz = s * 10;
    kit.block(px, pz, 6, 6, 3.2, 0xf3efe4, top);
    for (let t = 0; t < 5; t++) kit.block(px, pz, 7 - t * 1.25, 7 - t * 1.25, 0.6, t % 2 ? 0xb52a1f : GOLD, top + 3.2 + t * 1.1);
    kit.spire(px, pz, 0.4, 3, GOLD, top + 8.7, 6);
    kit.light(px - 3.2, top + 2, pz, 0xffe7a0);
  }
  for (let i = 0; i < 5; i++) kit.person(6 + kit.rng() * 7, -8 + kit.rng() * 16, kit.rng() * 6, { shirt: [0xd8822a, 0xf2f0ea, 0x7b4fd6][i % 3] });
}

// ---------------------------------------------------------------- the tail

/** Meghnaghat: three combined-cycle plants side by side on the Meghna bank, stacks and switchyard. */
function meghnaghatPower(kit: LKit): void {
  const D = kit.depth;
  const L = kit.length;
  kit.ground(D / 2, 0, D, L, 0xa49c88);
  kit.water(D - 8, 0, 16, L, 0x4a7f86);
  kit.wall(1, -L / 2, 1, L / 2 - 14, 2.4, 0xd8d2c4, 0.3);
  // switchyard gantries near the road
  for (let z = -L / 2 + 8; z < -30; z += 7) {
    for (const x of [6, 14]) kit.block(x, z, 0.5, 0.5, 10, 0x9a9a96);
    kit.block(10, z, 9, 0.4, 0.4, 0x9a9a96, 10);
  }
  const halls = [0x8fa8c4, 0xd6d8dc, 0x6f94b8];
  for (let u = 0; u < 3; u++) {
    const zc = -14 + u * 34;
    // gas turbine hall, heat recovery boiler, stack with red-and-white top
    kit.block(30, zc, 22, 26, 15, halls[u]);
    kit.block(30, zc, 22.4, 26.4, 0.8, 0x5a6a7a, 15);
    kit.block(16, zc + 6, 6, 8, 9, 0xc8c8c0);
    kit.block(54, zc, 16, 12, 25, 0xdcdcd6);
    kit.block(54, zc, 16.4, 12.4, 1, 0x8a8a86, 25);
    const sh = 52 + u * 4;
    kit.cylinder(68, zc, 2.6, sh, 0xc9c6bf, 0, 12, 2.2);
    kit.cylinder(68, zc, 2.3, 2.5, 0xc8312a, sh - 6, 12);
    kit.cylinder(68, zc, 2.25, 2.5, 0xf2f0ea, sh - 3.5, 12);
    kit.light(68, sh + 0.4, zc, 0xff3b30);
    kit.block(44, zc - 9, 4, 3, 3.4, 0x6b6b5e);
    kit.light(18.9, 8, zc);
  }
  // fuel tanks and the jetty on the river
  for (const z of [-60, -48]) kit.cylinder(78, z, 5, 10, 0xe8e6de, 0, 16);
  kit.block(86, 40, 16, 4, 1.4, CONCRETE);
}

/** Panam Nagar, Sonargaon: derelict 2–3 storey colonial mansions either side of a narrow street. */
function panamNagar(kit: LKit): void {
  const D = kit.depth;
  const L = kit.length;
  kit.ground(D / 2, 0, D, L, 0x7a9a4a);
  kit.ground(D / 2, 0, D - 4, 6, 0x8a8174, 0.07);
  const tones = [0xc9a27a, 0xb5aa98, 0xbf8f7c, 0xd0b48c, 0xa99d8c];
  for (const s of [-1, 1]) {
    let x = 4;
    let n = 0;
    while (x < D - 12) {
      const w = 8 + kit.rng() * 4;
      const floors = kit.rng() < 0.35 ? 3 : 2;
      const fh = 3.8;
      const dep = 11 + kit.rng() * 3;
      const face = s * 3.2;
      const tone = tones[(n + (s > 0 ? 2 : 0)) % tones.length];
      const h = floors * fh + 0.9;
      kit.block(x + w / 2, s * (3.2 + dep / 2), w, dep, h, tone);
      // plaster fallen off to bare brick, black monsoon mould near the top
      kit.add(box(w * 0.3, fh * 0.7, 0.1), BRICK, x + w * (0.2 + kit.rng() * 0.5), fh * (0.6 + kit.rng() * (floors - 1)), face - s * 0.07);
      kit.add(box(w * 0.85, 0.7, 0.1), 0x58534a, x + w / 2, h - 1.3, face - s * 0.08);
      for (let f = 1; f <= floors; f++) kit.add(box(w + 0.3, 0.3, 0.5), 0xdcd5c4, x + w / 2, f * fh, face - s * 0.15);
      for (const px of [x + 0.35, x + w - 0.35]) kit.add(box(0.6, h, 0.3), 0xe0d9c8, px, h / 2, face - s * 0.12);
      const nWin = Math.max(2, Math.floor(w / 3));
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < nWin; i++) archZ(kit, x + ((i + 0.5) * w) / nWin, f * fh + (f ? 0.9 : 0.1), face, -s, 1.1, f ? 1.7 : 2.3, 0x2a2622);
      }
      if (kit.rng() < 0.35) kit.add(ico(1.6), 0x4f7f32, x + w * 0.7, h + 0.8, s * (3.2 + dep / 2));
      x += w + 0.5;
      n++;
    }
  }
  // the canal behind each row, and trees
  for (const s of [-1, 1]) {
    kit.water(D / 2, s * 24, D - 6, 5, 0x4f7f6a);
    for (let x = 8; x < D; x += 11) kit.tree(x, s * (30 + kit.rng() * 6), 1.05);
  }
  for (let i = 0; i < 6; i++) kit.person(6 + kit.rng() * 50, -1.8 + kit.rng() * 3.6, kit.rng() * 6, { shirt: [0xe63946, 0x2a9d8f, 0xf2f0ea, 0xf0b030][i % 4] });
}

/** Bara Sardar Bari (Folk Arts & Crafts Museum): long white two-storey arcaded mansion behind its pond. */
function folkArtsMuseum(kit: LKit): void {
  const D = kit.depth;
  const L = kit.length;
  kit.ground(D / 2, 0, D, L, GRASS);
  kit.ground(20, 0, 30, 54, 0xcfc6b0, 0.05);
  kit.water(20, 0, 26, 50, 0x4f8a8a);
  for (let i = 0; i < 4; i++) kit.block(33 + i * 0.7, 0, 0.7, 10, 0.25 * (i + 1), 0xd8d1c0);
  // the two horsemen on the pond bank
  for (const s of [-1, 1]) {
    const z = s * 16;
    const c = 0xe0dcd2;
    kit.block(6, z, 2.2, 3.4, 1.6, 0xb8b2a4);
    kit.block(6, z, 1, 2.2, 1, c, 2.4);
    for (const [dx, dz] of [[-0.3, -0.8], [0.3, -0.8], [-0.3, 0.8], [0.3, 0.8]]) kit.block(6 + dx, z + dz, 0.25, 0.25, 0.9, c, 1.6);
    kit.add(box(0.6, 1.1, 0.6), c, 6, 3.7, z - 1.2, [-0.5, 0, 0]);
    kit.block(6, z - 1.6, 0.5, 0.9, 0.5, c, 3.9);
    kit.block(6, z + 0.1, 0.6, 0.5, 1, c, 3.4);
    kit.ball(6, 4.7, z + 0.1, 0.25, c);
    kit.add(box(0.08, 1.4, 0.08), 0xb8b2a4, 6, 5, z - 0.3, [0.6, 0, 0]);
  }
  // the mansion: core, arcaded front on both floors, central projecting bay, balustraded parapet
  const fx = 40;
  kit.block(50, 0, 16, 72, 10, 0xe9e3d3);
  kit.block(fx + 2.8, 0, 0.1, 71, 9.5, 0xb9b3a5);
  for (let f = 0; f < 2; f++) {
    for (let z = -34; z <= 34; z += 3.4) kit.block(fx, z, 0.6, 0.6, 4.4, WHITE, f * 5);
    kit.block(fx + 1.4, 0, 3.4, 72, 0.6, WHITE, f * 5 + 4.4);
    for (let z = -32.3; z <= 32.3; z += 6.8) archX(kit, fx + 2.75, f * 5 + 0.4, z, 1.3, 2.4, 0x4a5560);
  }
  kit.block(fx + 1.4, 0, 3.6, 72.4, 1, WHITE, 10);
  kit.block(fx - 0.6, 0, 4, 12, 11.5, 0xf2eee4);
  pediment(kit, fx - 0.6, 11.5, 0, 12, 2.2, 0xf2eee4, 4);
  for (const z of [-4, 0, 4]) archX(kit, fx - 2.6, 0.4, z, 2, 3, 0x4a5560);
  for (const z of [-4, 0, 4]) archX(kit, fx - 2.6, 5.6, z, 1.6, 2.6, 0x4a5560);
  kit.block(66, 0, 8, 60, 8, 0xe2dccc);
  for (const z of [-30, 30]) kit.palm(36, z, 1.1);
  for (let z = -36; z <= 36; z += 12) kit.tree(D - 3, z, 1.1);
  for (let i = 0; i < 6; i++) kit.person(36 + kit.rng() * 3, -30 + kit.rng() * 60, kit.rng() * 6, { shirt: [0xe63946, 0xf2f0ea, 0x2a9d8f][i % 3] });
}

/** Kanchpur: the old and the second Kanchpur bridges side by side over the Shitalakshya. */
function kanchpurBridge(kit: LKit): void {
  const D = kit.depth;
  kit.water(D / 2, 0, D, 72, 0x4a7f86);
  for (const s of [-1, 1]) kit.ground(D / 2, s * 46, D, 20, 0x8a8a6a);
  const decks = [
    { x: 20, w: 13, c: 0xb8b3a8 },
    { x: 40, w: 16, c: 0xc9c5bb },
  ];
  const h = 11;
  for (const b of decks) {
    kit.block(b.x, 0, b.w, 110, 1.2, b.c, h);
    kit.block(b.x, 0, b.w * 0.7, 72, 2.4, 0xa09a8f, h - 2.4);
    for (const s of [-1, 1]) {
      kit.block(b.x + s * (b.w / 2 - 0.2), 0, 0.4, 110, 1, 0xe2ded6, h + 1.2);
      kit.block(b.x, s * 46, b.w, 20, h, 0x9a8f72);
    }
    for (const z of [-24, 0, 24]) {
      for (const s of [-1, 1]) kit.cylinder(b.x + s * b.w * 0.25, z, 1.1, h - 2.4, 0x9b968c, 0, 10);
      kit.block(b.x, z, b.w * 0.8, 3, 1, 0x8c877d);
    }
    for (let z = -48; z <= 48; z += 16) {
      kit.cylinder(b.x - b.w / 2 + 0.6, z, 0.1, 7, 0x8a8a86, h + 1.2, 6);
      kit.light(b.x - b.w / 2 + 1.4, h + 8, z);
    }
  }
  // traffic on the decks
  const cols = [0x2f6db5, 0xe0b020, 0xc8312a, 0x3fa34d];
  for (let i = 0; i < 7; i++) {
    const b = decks[i % 2];
    kit.block(b.x - 3 + (i % 3) * 3, -45 + i * 14, 2.4, i % 3 ? 9 : 4.5, i % 3 ? 3 : 1.6, cols[i % cols.length], h + 1.2);
  }
  // sand barges and a cargo boat on the river
  for (const [x, z] of [[62, -14], [78, 18]]) {
    kit.block(x, z, 6, 22, 1.2, 0x3a3530);
    kit.add(cone(2.6, 2.2, 8), 0xd8c08a, x, 2.3, z, [0, 0, 0], [1, 1, 3]);
  }
  kit.block(66, 26, 4, 14, 1.6, 0x6b3a2a);
  kit.block(66, 31, 3.4, 4, 2.4, 0xe8e2d2, 1.6);
}

export const MODELS_EAST: Record<string, LandmarkModel> = {
  shalbanVihara,
  warCemetery,
  victoriaCollege,
  dharmasagar,
  hangingBridge,
  ghagraFalls,
  kundeshwari,
  hathazariMadrasa,
  cuGate,
  faujdarhatCadet,
  bma,
  shipBreaking,
  chandranath,
  mohipalFlyover,
  goldenTemple,
  meghnaghatPower,
  panamNagar,
  folkArtsMuseum,
  kanchpurBridge,
};
