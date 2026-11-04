// Own models for the southern routes (config/landmarkData/south.ts), built after the real places:
// - bhangaInterchange: Bangladesh's first cloverleaf, four 270° loops on grassed earth embankments round an
//   overpass, outer ramps and a green direction gantry (drawn beside the highway; the highway itself is unchanged)
// - bhangaStation: the big "iconic" Bhanga Junction terminal, a white hall under a sweeping vaulted roof,
//   a glass front, two wings, a plaza with a fountain, island platforms behind
// - padmaLinkStation: the smaller Padma rail link station (Shibchar, Padma, Mawa, Nimtala): white two-storey
//   building with blue glass under a wave roof (the Padma's waves), a long canopied platform
// - jajiraServiceArea / mawaServiceArea: the Padma Bridge service areas, food court and rest house under
//   red-tiled hip roofs, bus parking; Jajira has a viewing tower, Mawa a filling station
// - shimuliaGhat: the old Shimulia ferry ghat, idle Ro-Ro ferries and launches moored at the pontoons
// - keraniganjJail: Dhaka Central Jail at Teghoria, an 18-foot wall with wire and watchtowers, a maroon gate
//   house, six-storey wards inside
// - mahilaraMath: the 27 m slender octagonal brick tower at Gournadi, leaning, plants growing out of the top
// - ugraTara: the Shikarpur Ugratara (Sugandha shaktipeeth) temple, white rekha spire, nat mandir, courtyard
// - rupshaBridge: Khan Jahan Ali Bridge, a haunched PC box girder bridge humped high over the Rupsha
// - smSultan: S M Sultan's memorial museum by the Chitra, his tomb, his house and the "Shishu Swarga" boat
// - shatGambujSign: a big direction board with the Sixty Dome Mosque painted on it in terracotta
// - barishalUniversity: the gate arch at Karnakathi, academic blocks, the Shaheed Minar
// - barishalAirport: Rahmatpur's small terminal and tower, a turboprop on the apron, the runway behind a fence

import * as THREE from 'three';
import { box, cached, cone, cyl } from '../../utils/geometry';
import type { LandmarkModel, LKit } from './kit';

const WHITE = 0xf1f0ea;
const CREAM = 0xe6dcc4;
const CONCRETE = 0xb9b5ab;
const ASPHALT = 0x4d4d4f;
const GRASS = 0x7fa05a;
const BANK = 0x6f8f45;
const GLASS = 0x5f93b8;
const BRICK = 0xa5553a;
const MAROON = 0x7f2a26;
const TIN = 0x8d9499;
const RIVER = 0x5a8a96;

// ---------------------------------------------------------------- shapes

/** A curved roof slab: chord along u, rise up, extended `len` along x (curve faces the road) or z. */
function vault(chord: number, rise: number, thick: number, len: number, along: 'x' | 'z'): THREE.BufferGeometry {
  return cached(`s-vault:${chord}:${rise}:${thick}:${len}:${along}`, () => {
    const R = (chord * chord) / 4 / (2 * rise) + rise / 2;
    const a = Math.asin(chord / 2 / R);
    const s = new THREE.Shape();
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = -a + (2 * a * i) / n;
      const p: [number, number] = [R * Math.sin(t), R * Math.cos(t) - (R - rise)];
      if (i === 0) s.moveTo(...p);
      else s.lineTo(...p);
    }
    for (let i = n; i >= 0; i--) {
      const t = -a + (2 * a * i) / n;
      s.lineTo((R - thick) * Math.sin(t), (R - thick) * Math.cos(t) - (R - rise));
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    if (along === 'x') g.rotateY(Math.PI / 2);
    return g;
  });
}

/** A wave roof (thin slab rippling along z), `depth` deep along x, centred on its middle. */
function waveRoof(length: number, depth: number, amp: number, waves: number, thick: number): THREE.BufferGeometry {
  return cached(`s-wave:${length}:${depth}:${amp}:${waves}`, () => {
    const s = new THREE.Shape();
    const n = 40;
    const y = (u: number) => amp * Math.sin((u / length) * waves * Math.PI * 2);
    for (let i = 0; i <= n; i++) {
      const u = -length / 2 + (length * i) / n;
      if (i === 0) s.moveTo(u, y(u));
      else s.lineTo(u, y(u));
    }
    for (let i = n; i >= 0; i--) {
      const u = -length / 2 + (length * i) / n;
      s.lineTo(u, y(u) - thick);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

/** A four-sided pyramid with its base square to the axes (unit base, unit height): scale it to a hip roof. */
function pyramid(): THREE.BufferGeometry {
  return cached('s-pyramid', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, false, Math.PI / 4));
}

/** A boat hull along z: a box with pointed bow (-z) and stern, sitting at y0. */
function hull(kit: LKit, x: number, z: number, len: number, beam: number, h: number, color: number, y0 = 0.1): void {
  const mid = len * 0.62;
  const end = (len - mid) / 2;
  kit.add(box(beam, h, mid), color, x, y0 + h / 2, z);
  for (const d of [-1, 1]) {
    // a pyramid laid along z, squashed to the hull's beam and depth
    kit.add(pyramid(), color, x, y0 + h / 2, z + d * (mid / 2 + end / 2), [d * Math.PI / 2, 0, 0], [beam, end, h]);
  }
}

/** A street lamp with its light. */
function lamp(kit: LKit, x: number, z: number, h = 8, y0 = 0): void {
  kit.cylinder(x, z, 0.09, h, 0x8a8f94, y0, 6);
  kit.add(box(1.2, 0.12, 0.25), 0x8a8f94, x - 0.5, y0 + h, z);
  kit.light(x - 1, y0 + h - 0.2, z, 0xffe2a8);
}

/** A launch / ferry superstructure deck by deck. */
function decks(kit: LKit, x: number, z: number, len: number, beam: number, n: number, colors: number[], y0: number): void {
  for (let i = 0; i < n; i++) {
    const l = len * (1 - i * 0.12);
    kit.add(box(beam * (1 - i * 0.08), 2.2, l), colors[i % colors.length], x, y0 + i * 2.4 + 1.1, z);
    kit.add(box(0.08, 0.7, l * 0.9), 0x2c3a44, x - beam * (1 - i * 0.08) / 2 - 0.02, y0 + i * 2.4 + 1.4, z);
  }
}

// ---------------------------------------------------------------- Bhanga

/** A ramp curving round (cx, cz) on its earth embankment, rising y0 → y1. */
function ramp(kit: LKit, cx: number, cz: number, r: number, a0: number, sweep: number, y0: number, y1: number, n: number): void {
  const segLen = (Math.abs(sweep) * r) / n + 0.6;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const a = a0 + sweep * t;
    const sg = Math.sign(sweep);
    const yaw = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg);
    const px = cx + r * Math.cos(a);
    const pz = cz + r * Math.sin(a);
    const y = y0 + (y1 - y0) * t;
    if (y > 0.5) kit.add(box(11, y, segLen), BANK, px, y / 2, pz, [0, yaw, 0]);
    kit.add(box(6.5, 0.4, segLen), ASPHALT, px, y + 0.2, pz, [0, yaw, 0]);
  }
}

const bhangaInterchange: LandmarkModel = (kit) => {
  const cx = 62;
  const H = 7;
  kit.ground(cx, 0, 120, kit.length - 4, GRASS);
  // the cross road, under the overpass
  kit.add(box(10, 0.12, kit.length - 6), ASPHALT, cx, 0.1, 0);
  for (let z = -78; z <= 78; z += 9) if (Math.abs(z) > 7 && Math.abs(z - 70) > 2) kit.add(box(0.2, 0.13, 3.5), 0xf2f2f2, cx, 0.12, z);
  // the overpass: a deck on twin piers, earth ramps down at both ends
  kit.add(box(64, 0.9, 11), CONCRETE, cx, H, 0);
  kit.add(box(64, 0.4, 10), ASPHALT, cx, H + 0.6, 0);
  for (const s of [-1, 1]) {
    kit.add(box(64, 1, 0.3), 0xd8d4cc, cx, H + 1.1, s * 5.4);
    for (let x = 34; x <= 90; x += 14) kit.add(box(1.2, H - 0.45, 1.2), CONCRETE, x, (H - 0.45) / 2, s * 3.2);
    const slope = Math.atan2(H, 22);
    const xm = cx + s * 43;
    kit.add(box(23.2, 0.6, 10), ASPHALT, xm, H / 2 + 0.3, 0, [0, 0, -s * slope]);
    for (let i = 0; i < 4; i++) {
      const hh = H * (1 - (i + 0.5) / 4);
      kit.add(box(5.6, hh, 14), BANK, cx + s * (34.8 + i * 5.5), hh / 2, 0);
    }
    for (let x = 36; x <= 88; x += 13) lamp(kit, x, s * 5.2, 7, H + 0.6);
  }
  // four 270° loops in the quadrants, ground → deck, and the outer ramps
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const qx = cx + sx * 25;
      const qz = sz * 25;
      const a0 = sx > 0 ? Math.PI : 0;
      const target = sz > 0 ? -Math.PI / 2 : Math.PI / 2;
      let short = target - a0;
      while (short > Math.PI) short -= Math.PI * 2;
      while (short <= -Math.PI) short += Math.PI * 2;
      ramp(kit, qx, qz, 16, a0, short > 0 ? short - Math.PI * 2 : short + Math.PI * 2, 0, H, 26);
      kit.ground(qx, qz, 12, 12, 0x8db864, 0.06);
      kit.tree(qx, qz, 0.7);
      // the outer ramp bulges round the loop, from the cross road to the far end of the overpass
      ramp(kit, cx + sx * 6, sz * 6, 52, sz * (Math.PI / 2), -sx * sz * (Math.PI / 2), 0, 0, 14);
    }
  }
  // the green direction gantry over the cross road
  for (const s of [-1, 1]) kit.cylinder(cx + s * 6.5, 70, 0.25, 7.5, 0x9a9fa4, 0, 8);
  kit.add(box(13.4, 0.4, 0.4), 0x9a9fa4, cx, 7.3, 70);
  kit.sign(['ঢাকা · পদ্মা সেতু', 'বরিশাল · খুলনা · গোপালগঞ্জ'], cx, 6.1, 70.3, 9, 2.2, { bg: '#1d6b3a', fg: '#ffffff', border: '#ffffff' }, 0);
};

const bhangaStation: LandmarkModel = (kit) => {
  // front plaza with a fountain, flag and palms
  kit.ground(9, 0, 18, kit.length - 6, 0xcfc8b8);
  kit.cylinder(9, 0, 4, 0.6, 0xbfb8a8, 0, 16);
  kit.water(9, 0, 6, 6, 0x6aaecb);
  kit.cylinder(9, 0, 0.3, 2.4, 0xe8e8e8, 0, 8);
  kit.flag(4, -14, 10);
  for (const z of [-30, -22, 22, 30]) kit.palm(4, z, 0.9);
  for (const z of [-40, -10, 10, 40]) lamp(kit, 15, z, 7);
  // the main hall: white, a full-height glass front, under the great vault running back from the road
  kit.block(32, 0, 24, 48, 12, WHITE, 0);
  kit.add(box(0.25, 10, 40), GLASS, 19.9, 5.4, 0);
  for (let z = -20; z <= 20; z += 5) kit.add(box(0.35, 10.6, 0.3), WHITE, 19.8, 5.3, z);
  kit.add(vault(56, 7, 0.7, 36, 'x'), 0xdfe3e6, 31, 12, 0);
  kit.add(box(36, 0.3, 56), 0xc7ccd0, 31, 12.1, 0);
  for (let z = -24; z <= 24; z += 8) kit.cylinder(14.5, z, 0.35, 12, WHITE, 0, 10);
  kit.sign(['ভাঙ্গা জংশন'], 19.6, 10.9, 0, 12, 1.6, { bg: '#f1f0ea', fg: '#1d4f7a' }, -Math.PI / 2);
  // the wings, two storeys with a thin flat canopy
  for (const s of [-1, 1]) {
    kit.block(32, s * 37, 20, 26, 8.5, CREAM, 0);
    kit.add(box(22, 0.4, 28), 0xdfe3e6, 31, 8.7, s * 37);
    kit.windows(21.95, s * 37 - 12, s * 37 + 12, 0.6, 2, 3.8, 0x3e6d8c, 3.2, 2.2, 2.2);
    kit.light(21.8, 5.6, s * 31);
    kit.light(21.8, 5.6, s * 43);
  }
  // island platforms with long canopies and the tracks
  for (const px of [52, 62]) {
    kit.block(px, 0, 4.5, 110, 1, 0xc8c2b5, 0);
    for (let z = -50; z <= 50; z += 10) kit.cylinder(px, z, 0.15, 4, 0xe0e0e0, 1, 6);
    kit.add(box(5.5, 0.3, 104), 0x9fb7c7, px, 5.1, 0);
  }
  for (const tx of [47.5, 56.8, 66.5]) {
    kit.add(box(3, 0.3, kit.length - 4), 0x8a8478, tx, 0.15, 0);
    for (const d of [-0.84, 0.84]) kit.add(box(0.1, 0.15, kit.length - 4), 0x55565a, tx + d, 0.38, 0);
  }
  kit.light(19.5, 11, -8);
  kit.light(19.5, 11, 8);
  for (let i = 0; i < 6; i++) kit.person(10 + kit.rng() * 6, -20 + kit.rng() * 40, -Math.PI / 2);
};

const padmaLinkStation: LandmarkModel = (kit) => {
  kit.ground(5, 0, 10, 60, 0xcfc8b8);
  // two storeys, white with blue glass bands, a porch
  kit.block(16, 0, 16, 44, 9, WHITE, 0);
  for (const y of [1, 5.2]) kit.add(box(0.15, 2.6, 36), GLASS, 7.95, y + 1.3, 0);
  for (let z = -18; z <= 18; z += 6) kit.add(box(0.3, 9, 0.5), WHITE, 7.9, 4.5, z);
  kit.add(waveRoof(52, 22, 1.1, 2, 0.5), 0xd2d8dc, 16, 10.4, 0);
  kit.add(box(5, 0.35, 12), 0xd2d8dc, 5, 4.2, 0);
  for (const z of [-5.5, 5.5]) kit.cylinder(3, z, 0.2, 4.1, WHITE, 0, 8);
  kit.sign(['বাংলাদেশ রেলওয়ে'], 7.8, 3.3, 0, 8, 0.9, { bg: '#f1f0ea', fg: '#1d4f7a' }, -Math.PI / 2);
  // the platform under its canopy, the line beyond
  kit.block(30, 0, 6, kit.length - 6, 1, 0xc8c2b5, 0);
  for (let z = -44; z <= 44; z += 8) kit.cylinder(30, z, 0.13, 3.6, 0xe0e0e0, 1, 6);
  kit.add(box(6.5, 0.25, 80), 0x9fb7c7, 30, 4.7, 0);
  kit.add(box(3, 0.3, kit.length - 2), 0x8a8478, 35.5, 0.15, 0);
  for (const d of [-0.84, 0.84]) kit.add(box(0.1, 0.15, kit.length - 2), 0x55565a, 35.5 + d, 0.38, 0);
  for (const z of [-30, 30]) lamp(kit, 5, z, 6);
  for (const z of [-12, 0, 12]) kit.light(7.8, 6.5, z);
  for (let i = 0; i < 4; i++) kit.person(29 + kit.rng() * 2, -30 + kit.rng() * 60, kit.rng() * 6);
};

// ---------------------------------------------------------------- Padma Bridge ends

function serviceArea(kit: LKit, mawa: boolean): void {
  kit.ground(14, 0, 26, kit.length - 4, 0x8c8c88);
  for (let z = -36; z <= 36; z += 4) kit.add(box(5, 0.07, 0.15), 0xf2f2f2, 20, 0.08, z);
  // a couple of coaches and cars parked
  for (const [z, c] of [[-28, 0xe8e3d6], [-18, 0x2b6cb0]] as const) {
    kit.add(box(2.5, 3.2, 11), c, 20, 1.9, z);
    kit.add(box(2.55, 0.9, 10.4), 0x2c3a44, 20, 2.6, z);
  }
  for (const z of [8, 13, 18]) kit.add(box(1.8, 1.4, 4.2), [0xd9d9d9, 0x8b1e1e, 0x2f2f2f][Math.floor(kit.rng() * 3)], 9, 0.8, z);
  // food court and rest house under red-tiled hip roofs, Bangla style
  kit.block(40, -10, 18, 34, 7.5, CREAM, 0);
  kit.add(pyramid(), 0xa8432f, 40, 10.5, -10, [0, 0, 0], [20, 6, 36]);
  kit.add(box(20, 0.3, 36), 0xa8432f, 40, 7.6, -10);
  kit.add(box(0.15, 2.4, 28), GLASS, 30.95, 1.6, -10);
  kit.windows(30.95, -26, 6, 4.2, 1, 3, 0x3e6d8c, 3, 1.6, 1.5);
  kit.sign(['রেস্তোরাঁ · বিশ্রামাগার'], 30.8, 5.6, -10, 10, 1, { bg: '#7f2a26', fg: '#ffffff' }, -Math.PI / 2);
  kit.block(42, 22, 14, 14, 4.5, CREAM, 0);
  kit.add(pyramid(), 0xa8432f, 42, 6.7, 22, [0, 0, 0], [15, 4.4, 15]);
  if (mawa) {
    // a filling station by the entrance
    kit.add(box(9, 0.6, 14), 0xffffff, 10, 5.4, 32);
    kit.add(box(9.1, 0.4, 14.1), 0xd62d20, 10, 5.0, 32);
    for (const z of [27, 37]) {
      kit.cylinder(10, z, 0.25, 5, 0xe0e0e0, 0, 8);
      kit.block(10, z, 1, 0.6, 1.6, 0x2f7a3a, 0);
    }
    kit.light(10, 4.6, 32, 0xffffff);
  } else {
    // a viewing tower toward the bridge
    kit.cylinder(48, 32, 1.6, 16, CREAM, 0, 10);
    kit.cylinder(48, 32, 3.2, 0.4, 0xa8432f, 16, 12);
    kit.add(cone(3.4, 2.6, 12), 0xa8432f, 48, 19.4, 32);
    for (let i = 0; i < 8; i++) kit.cylinder(48 + Math.cos(i) * 2.9, 32 + Math.sin(i) * 2.9, 0.08, 1.1, 0xe0e0e0, 16.4, 4);
  }
  kit.flag(28, -32, 9);
  kit.treeRow(52, -38, 38, 9, 0.9);
  for (const z of [-34, -2, 30]) lamp(kit, 2, z, 8);
  for (const z of [-22, -12, -2]) kit.light(30.8, 4.6, z);
  for (let i = 0; i < 5; i++) kit.person(27 + kit.rng() * 3, -24 + kit.rng() * 24, -Math.PI / 2);
}

const shimuliaGhat: LandmarkModel = (kit) => {
  kit.ground(9, 0, 18, kit.length - 4, 0xa89a7c);
  kit.water(37, 0, 36, kit.length - 2, RIVER);
  // tea stalls and the ticket counter on the bank
  for (const z of [-32, -24, -16, 20, 28]) {
    kit.block(6, z, 5, 6, 2.6, [0x6d8f9c, 0xb0a17e, 0x8f6d4f][Math.floor(kit.rng() * 3)], 0);
    kit.add(box(6, 0.15, 7), TIN, 6, 2.9, z, [0, 0, 0.12]);
  }
  kit.block(6, 6, 5, 8, 3, WHITE, 0);
  kit.add(box(5.6, 0.2, 8.6), 0x2f6f4f, 6, 3.1, 6);
  // the steel pontoon and its ramp
  kit.add(box(8, 0.2, 5), 0x6b6b66, 21, 0.5, 0, [0, 0, -0.06]);
  kit.add(box(9, 1.2, 18), 0x47505a, 29, 0.6, 0);
  kit.add(box(9.1, 0.25, 18.1), 0x7a3b2b, 29, 0.2, 0);
  // idle Ro-Ro ferries moored since the bridge opened
  for (const [z, c] of [[-22, 0x2d6a4f], [24, 0x7a2f2a]] as const) {
    kit.add(box(12, 1.6, 26), c, 40, 0.8, z);
    kit.add(box(12.2, 0.25, 26.2), 0x3a3a3a, 40, 1.65, z);
    kit.block(45, z, 2, 6, 5, WHITE, 1.8);
    kit.block(45, z, 2.2, 3, 1.2, 0x2c3a44, 5.4);
    kit.cylinder(45, z + 2, 0.3, 2, 0x3a3a3a, 6.8, 6);
  }
  // a two-deck launch alongside the pontoon
  hull(kit, 37, 0, 20, 5, 1.6, 0xf3f1e8);
  decks(kit, 37, 0, 15, 4.6, 2, [0xf3f1e8, 0x3b82c4], 1.7);
  // speedboats and a country boat
  for (const z of [-8, -4]) hull(kit, 24, z, 6, 1.6, 0.6, 0xffffff);
  hull(kit, 52, 8, 9, 2, 0.7, 0x6b4a2c);
  lamp(kit, 14, -8, 7);
  lamp(kit, 14, 14, 7);
  for (let i = 0; i < 5; i++) kit.person(10 + kit.rng() * 8, -10 + kit.rng() * 20, -Math.PI / 2, { lungi: kit.rng() < 0.5 });
};

const keraniganjJail: LandmarkModel = (kit) => {
  const x0 = 6;
  const x1 = kit.depth - 4;
  const z0 = -kit.length / 2 + 4;
  const z1 = kit.length / 2 - 4;
  kit.ground(x0 / 2 + 1, 0, x0, 30, 0x8c8c88);
  // the 18-foot wall: pale with a maroon band and wire on top, the gate house in the middle
  kit.compound(x0, z0, x1, z1, 5.5, 0xd9cfb9, 0, 12);
  for (const [a, b, c, d] of [[x0, z0, x0, -6], [x0, 6, x0, z1], [x1, z0, x1, z1], [x0, z0, x1, z0], [x0, z1, x1, z1]]) {
    kit.wall(a, b, c, d, 0.5, MAROON, 0.4, 5.5);
    kit.wall(a, b, c, d, 0.6, 0x5a5a5a, 0.06, 6.0);
  }
  kit.block(x0 + 2, 0, 9, 14, 9, MAROON, 0);
  kit.block(x0 - 2.6, 0, 0.4, 8, 6.2, 0x3a2a24, 0);
  kit.add(box(0.5, 1.2, 14.4), WHITE, x0 - 2.5, 7.4, 0);
  kit.add(box(9.6, 0.4, 14.6), WHITE, x0 + 2, 9.2, 0);
  kit.sign(['কেন্দ্রীয় কারাগার, ঢাকা'], x0 - 2.85, 7.4, 0, 12, 1.1, { bg: '#f1f0ea', fg: '#7f2a26' }, -Math.PI / 2);
  for (const z of [-5.5, 5.5]) {
    kit.light(x0 - 3, 6.6, z);
    kit.cylinder(x0 - 3, z, 0.12, 6.4, 0x777777, 0, 6);
  }
  // watchtowers at the corners and halfway along
  for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1], [x0, z0 / 2], [x0, z1 / 2], [x1, 0]]) {
    kit.block(x, z, 1.6, 1.6, 9, 0xd9cfb9, 0);
    kit.block(x, z, 3.2, 3.2, 2.4, 0xd9cfb9, 9);
    kit.add(box(3.3, 0.8, 3.3), 0x2c3a44, x, 10.6, z);
    kit.add(cone(2.7, 1.4, 4), MAROON, x, 12.1, z, [0, Math.PI / 4, 0]);
    kit.light(x, 10.6, z, 0xffffff);
  }
  // the wards: two six-storey blocks for the convicts, lower ones behind, all with their own walls
  for (const z of [-38, 38]) {
    kit.block(34, z, 18, 44, 19, CREAM, 0);
    kit.add(box(18.4, 0.6, 44.4), MAROON, 34, 19.2, z);
    for (let y = 3.2; y < 19; y += 3.2) kit.add(box(18.2, 0.25, 44.2), MAROON, 34, y, z);
    kit.windows(24.95, z - 21, z + 21, 0.3, 6, 3.2, 0x3a3a3a, 3, 0.9, 1.4);
    kit.wall(22, z - 25, 22, z + 25, 3.5, 0xd9cfb9, 0.25);
  }
  for (const z of [-20, 20]) {
    kit.block(70, z, 16, 34, 12.6, CREAM, 0);
    kit.add(box(16.4, 0.5, 34.4), MAROON, 70, 12.8, z);
    kit.windows(61.95, z - 16, z + 16, 0.3, 4, 3.15, 0x3a3a3a, 3, 0.9, 1.4);
  }
  kit.block(36, 0, 14, 16, 9, 0xe9e3d4, 0);
  kit.add(box(14.4, 0.5, 16.4), MAROON, 36, 9.2, 0);
  kit.windows(28.95, -7, 7, 0.4, 3, 3, 0x3e6d8c, 2.8, 1.3, 1.4);
  kit.ground(52, 0, 40, 30, 0x8db864, 0.05);
  kit.treeRow(98, -60, 60, 14, 0.8);
  for (const z of [-30, 30]) kit.flag(x0 - 3, z * 0.5, 9);
};

// ---------------------------------------------------------------- Barishal road

/** Mahilara Sarkar Math: ~27 m, octagonal, tapering, leaning away from the road. */
const mahilaraMath: LandmarkModel = (kit) => {
  const cx = 18;
  const lean = 0.07;
  const sn = Math.sin(lean);
  const cs = Math.cos(lean);
  // a part of the tower centred at height y (along its own axis)
  const put = (geo: THREE.BufferGeometry, color: number, y: number, dz = 0, dx = 0, yaw = 0) =>
    kit.add(geo, color, cx + y * sn + dx * cs, y * cs - dx * sn, dz, [0, yaw, -lean]);
  kit.ground(cx, 0, 34, 30, 0x8db864);
  kit.ground(cx / 2, 0, cx, 2.4, 0xa8674a, 0.07);
  kit.block(cx, 0, 8, 8, 0.6, 0xb98b6a, 0);
  // the octagonal base storey, then the shaft in four tapering stages with mouldings and blind niches
  put(cyl(3.3, 3.5, 3.84, 8), BRICK, 0.6 + 1.92);
  put(cyl(3.6, 3.6, 0.35, 8), 0x8f4630, 4.6);
  put(box(0.3, 2, 1.3), 0x4a2a20, 1.9, 0, -3.3);
  const stages = [[3.0, 2.5, 5.6], [2.45, 1.95, 5.2], [1.9, 1.45, 4.8], [1.4, 1.0, 4.4]];
  let y = 4.8;
  for (const [rb, rt, h] of stages) {
    put(cyl(rt, rb, h, 8), y > 12 ? 0x9b4f37 : BRICK, y + h / 2);
    put(cyl(rt + 0.25, rt + 0.25, 0.35, 8), 0x8f4630, y + h);
    const rm = (rb + rt) / 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
      put(box(0.2, h * 0.45, rm * 0.55), 0x5a3024, y + h / 2, Math.sin(a) * rm, -Math.cos(a) * rm, Math.PI + a);
    }
    // weathered grey plaster patches
    put(box(0.12, h * 0.3, rm * 0.5), 0x9a938a, y + h * 0.3, Math.sin(2 + y) * rm * 0.9, Math.cos(2 + y) * rm * 0.9);
    y += h + 0.35;
  }
  put(cone(1.15, 2.6, 8), 0x8f4630, y + 1.3);
  put(cyl(0.12, 0.12, 0.9, 6), 0x6b6b6b, y + 3);
  // banyan and grass sprouting from the cracks near the top
  put(new THREE.IcosahedronGeometry(0.9), 0x4f8132, y - 1, 0.6, -0.8);
  put(new THREE.IcosahedronGeometry(0.6), 0x5f9a3a, y - 5, -0.8, 1.2);
  // the low railing, the pond behind, the Archaeology plaque
  for (const [a, b, c, d] of [[8, -12, 8, -2], [8, 2, 8, 12], [28, -12, 28, 12], [8, -12, 28, -12], [8, 12, 28, 12]]) kit.wall(a, b, c, d, 0.8, 0xe8e8e8, 0.12);
  kit.water(31, 0, 5, 26, 0x4f7f6a);
  kit.sign(['প্রত্নতত্ত্ব অধিদপ্তর', 'সংরক্ষিত পুরাকীর্তি'], 6, 1.6, -6, 2.6, 1.3, { bg: '#1d5e2f', fg: '#ffffff' });
  kit.cylinder(6, -6, 0.06, 1, 0x777777, 0, 6);
  for (const z of [-14, 14]) kit.palm(30, z, 1);
  kit.tree(4, 13, 0.9);
};

/** Ugratara of Shikarpur: whitewashed rekha temple in a walled courtyard, the nat mandir facing the road. */
const ugraTara: LandmarkModel = (kit) => {
  kit.ground(24, 0, 46, 40, 0xd6cdb8);
  kit.compound(2, -20, 44, 20, 1.8, CREAM, 0, 5);
  // the gate: two pillars and a little arched top with the goddess's name
  for (const z of [-3, 3]) kit.block(2, z, 1.2, 1.2, 4.4, 0xe9a23b, 0);
  kit.add(vault(7.2, 1.2, 0.5, 1, 'x'), 0xd9492f, 2, 4.4, 0);
  kit.sign(['শ্রী শ্রী উগ্রতারা মন্দির'], 1.3, 3.6, 0, 5, 0.8, { bg: '#d9492f', fg: '#ffffff' }, -Math.PI / 2);
  // nat mandir: an open pillared hall on a plinth
  kit.block(14, 0, 9, 14, 0.8, 0xe8e2d3, 0);
  for (const x of [10.5, 17.5]) for (let z = -6; z <= 6; z += 3) kit.cylinder(x, z, 0.25, 3.6, WHITE, 0.8, 8);
  kit.block(14, 0, 9.4, 14.4, 0.5, WHITE, 4.4);
  kit.add(box(9.6, 0.5, 14.6), 0xe9a23b, 14, 5.1, 0);
  // the main temple: plinth, sanctum, then the curved rekha spire with amalaka and kalash
  kit.block(29, 0, 11, 11, 1.4, 0xe8e2d3, 0);
  kit.block(29, 0, 8, 8, 6, WHITE, 1.4);
  kit.block(24.9, 0, 0.3, 2.2, 3.2, 0x5a2a1f, 1.4);
  kit.add(box(8.6, 0.4, 8.6), 0xe9a23b, 29, 7.5, 0);
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    prof.push(new THREE.Vector2(4.6 * (1 - t * t * 0.75) * (1 - t * 0.3) + 0.01, t * 13));
  }
  const spire = cached('s-rekha', () => new THREE.LatheGeometry(prof, 8).rotateY(Math.PI / 8));
  kit.add(spire, WHITE, 29, 7.7, 0);
  // orange bands round the spire at its own radius
  for (const p of [prof[2], prof[4], prof[6]]) kit.add(cyl(p.x + 0.12, p.x + 0.12, 0.35, 8), 0xe9a23b, 29, 7.7 + p.y, 0, [0, Math.PI / 8, 0]);
  kit.add(cyl(1.7, 1.7, 0.7, 12), 0xe9a23b, 29, 21, 0);
  kit.ball(29, 22, 0, 0.6, 0xd9a520);
  kit.spire(29, 0, 0.35, 1.4, 0xd9a520, 22.4);
  kit.cylinder(29, 0, 0.05, 3, 0x8a8a8a, 23.4, 4);
  kit.add(box(0.04, 0.8, 1.4), 0xe63946, 29, 25.8, 0.7);
  // small spired shrines at the corners of the plinth
  for (const z of [-12, 12]) {
    kit.block(30, z, 4, 4, 3, WHITE, 0);
    kit.spire(30, z, 2.4, 4.5, WHITE, 3);
    kit.ball(30, 7.7, z, 0.3, 0xe9a23b);
  }
  kit.water(40, -12, 6, 12, 0x4f7f6a);
  kit.tree(40, 12, 1);
  kit.bunting(10, -7, 24, 0, 6, [0xe63946, 0xffd166, 0xe9a23b]);
  kit.bunting(10, 7, 24, 0, 6, [0xe63946, 0xffd166, 0xe9a23b]);
  kit.light(10, 4, -6, 0xffc070);
  kit.light(10, 4, 6, 0xffc070);
  kit.light(25, 5, 0, 0xffc070);
  for (let i = 0; i < 4; i++) kit.person(8 + kit.rng() * 14, -10 + kit.rng() * 20, kit.rng() * 6, { shirt: 0xf2c94c, lower: 0xe63946 });
};

const barishalUniversity: LandmarkModel = (kit) => {
  // boundary wall with the gate arch
  kit.wall(2, -kit.length / 2 + 2, 2, -6, 2.2, 0xe2dccb);
  kit.wall(2, 6, 2, kit.length / 2 - 2, 2.2, 0xe2dccb);
  for (const z of [-6.5, 6.5]) {
    kit.block(2, z, 2.2, 2.2, 7.5, BRICK, 0);
    kit.block(2, z, 2.6, 2.6, 0.4, WHITE, 7.5);
  }
  kit.add(box(1.4, 1.6, 15), WHITE, 2, 6.9, 0);
  kit.sign(['বরিশাল বিশ্ববিদ্যালয়'], 1.25, 6.9, 0, 12.4, 1.3, { bg: '#7f2a26', fg: '#ffffff' }, -Math.PI / 2);
  kit.ground(20, 0, 34, 7, 0x8f8a80);
  kit.ground(36, 0, 66, kit.length - 6, 0x8db864, 0.03);
  // the academic building: five storeys, white frame with red-brick fins
  kit.block(56, -6, 16, 56, 17, WHITE, 0);
  for (let z = -32; z <= 20; z += 4) kit.add(box(1, 17, 0.6), BRICK, 47.6, 8.5, z);
  kit.windows(47.95, -34, 22, 0.4, 5, 3.4, 0x3e6d8c, 4, 2.6, 1.8);
  kit.add(box(17, 0.6, 57), BRICK, 56, 17.3, -6);
  // admin block
  kit.block(30, -30, 12, 18, 10, CREAM, 0);
  kit.windows(23.95, -38, -22, 0.3, 3, 3.3, 0x3e6d8c, 3, 1.5, 1.6);
  // Shaheed Minar: the red sun behind five white columns, the middle ones bowing
  kit.block(26, 26, 9, 12, 0.8, 0xf2f2f2, 0);
  kit.add(cyl(3.2, 3.2, 0.3, 20), 0xd62d20, 28.5, 5.5, 26, [0, 0, Math.PI / 2]);
  for (const [z, h] of [[21.5, 4.2], [23.5, 6], [28.5, 6], [30.5, 4.2]]) kit.block(27, z, 0.4, 0.9, h, WHITE, 0.8);
  kit.block(27, 26, 0.4, 3.8, 0.6, WHITE, 6.8);
  kit.block(27.6, 26, 0.4, 0.9, 6, WHITE, 0.8);
  kit.add(box(0.4, 0.9, 3.8), WHITE, 26.4, 7.6, 26, [0, Math.PI / 2, -0.5]);
  kit.treeRow(12, -40, -12, 8, 0.9);
  kit.treeRow(12, 12, 42, 8, 0.9);
  kit.flag(20, -12, 9);
  for (let i = 0; i < 6; i++) kit.light(47.8, 2 + Math.floor(kit.rng() * 5) * 3.4, -30 + kit.rng() * 48);
  for (let i = 0; i < 6; i++) kit.person(14 + kit.rng() * 20, -3 + kit.rng() * 6, -Math.PI / 2, { shirt: [0xf2f0ea, 0x4a90c2, 0xc94f7c][i % 3] });
};

const barishalAirport: LandmarkModel = (kit) => {
  const L = kit.length;
  // fence on the road side, the car park
  for (let z = -L / 2 + 2; z < L / 2; z += 6) kit.cylinder(4, z, 0.06, 2.4, 0x8a8f94, 0, 4);
  kit.add(box(0.05, 2, L - 4), 0x9aa3a8, 4, 1.3, 0);
  kit.ground(12, -26, 14, 40, 0x8c8c88);
  for (const z of [-40, -34, -28, -20]) kit.add(box(1.8, 1.4, 4.2), [0xd9d9d9, 0x2f2f2f, 0x8b1e1e][Math.floor(kit.rng() * 3)], 12, 0.8, z);
  kit.ground(60, 0, 112, L - 4, 0x9cb36a, 0.03);
  // the terminal: low, white, a blue glass front under a curved canopy
  kit.block(30, -26, 18, 44, 7, WHITE, 0);
  kit.add(box(0.15, 4.2, 32), GLASS, 20.95, 2.3, -26);
  kit.add(vault(12, 1.5, 0.35, 6, 'x'), 0xd2d8dc, 20, 6.6, -26);
  for (const z of [-31, -21]) kit.cylinder(17.5, z, 0.2, 6.6, WHITE, 0, 8);
  kit.sign(['বরিশাল বিমানবন্দর'], 20.8, 5.6, -40, 12, 1.1, { bg: '#f1f0ea', fg: '#0b4f8a' }, -Math.PI / 2);
  // the control tower
  kit.cylinder(30, 10, 1.6, 15, WHITE, 0, 12);
  kit.cylinder(30, 10, 3, 0.6, 0xd2d8dc, 15, 8);
  kit.cylinder(30, 10, 2.9, 2.4, 0x35505a, 15.6, 8, 3.3);
  kit.cylinder(30, 10, 3.4, 0.5, 0xd2d8dc, 18, 8);
  kit.cylinder(30, 10, 0.05, 2.5, 0x8a8a8a, 18.5, 4);
  kit.light(30, 21, 10, 0xff3b30);
  // apron and taxiway
  kit.ground(52, -16, 24, 56, 0xb6b2a8, 0.05);
  kit.ground(70, -16, 16, 10, 0xb6b2a8, 0.05);
  // the runway with its centre line and threshold stripes
  kit.ground(86, 0, 26, L - 2, 0x5a5a5c, 0.07);
  for (let z = -L / 2 + 14; z < L / 2 - 14; z += 12) kit.add(box(0.5, 0.05, 6), 0xffffff, 86, 0.11, z);
  for (const e of [-1, 1]) for (let x = 76; x <= 96; x += 2.6) kit.add(box(1.4, 0.05, 10), 0xffffff, x, 0.11, e * (L / 2 - 8));
  for (let z = -L / 2 + 4; z < L / 2; z += 30) kit.light(72.5, 0.5, z, 0xffffff);
  // the windsock
  kit.cylinder(72, 60, 0.07, 6, 0xe0e0e0, 0, 4);
  kit.add(cone(0.5, 3, 8), 0xff7a1a, 72.2, 5.6, 58.5, [-Math.PI / 2 + 0.2, 0, 0]);
  // an ATR 72 on the apron: high wing, two turboprops, a T-tail
  const px = 54;
  const pz = -14;
  kit.add(cyl(1.35, 1.35, 20, 12), WHITE, px, 2.4, pz, [Math.PI / 2, 0, 0]);
  kit.add(cone(1.35, 3.5, 12), WHITE, px, 2.4, pz - 11.7, [-Math.PI / 2, 0, 0]);
  kit.add(cone(1.35, 5, 12), WHITE, px, 2.7, pz + 12.5, [Math.PI / 2, 0, 0], [1, 1, 0.7]);
  kit.add(box(27, 0.35, 2.4), WHITE, px, 3.85, pz - 2);
  for (const d of [-4.2, 4.2]) {
    kit.add(cyl(0.55, 0.55, 3.2, 8), 0xdfe3e6, px + d, 3.3, pz - 2.6, [Math.PI / 2, 0, 0]);
    kit.add(box(3.2, 0.25, 0.1), 0x2a2a2a, px + d, 3.3, pz - 4.3);
  }
  kit.add(box(0.3, 4, 3.4), 0x1d4f9a, px, 5, pz + 13.2, [0.35, 0, 0]);
  kit.add(box(7, 0.25, 1.8), 0x1d4f9a, px, 6.9, pz + 14);
  for (const s of [-1, 1]) {
    kit.add(box(0.1, 0.4, 16), 0x2c3a44, px + s * 1.36, 2.8, pz);
    kit.add(box(0.1, 0.25, 19), 0x1d4f9a, px + s * 1.33, 1.9, pz);
  }
  for (const z of [-3, 3]) kit.add(box(1, 0.9, 0.4), 0x2a2a2a, px, 0.45, pz + z);
  kit.treeRow(108, -L / 2 + 10, L / 2 - 10, 16, 0.8);
  for (const z of [-40, -30, -20, -10]) kit.light(20.8, 2.5, z);
  for (let i = 0; i < 4; i++) kit.person(16 + kit.rng() * 3, -36 + kit.rng() * 18, -Math.PI / 2);
};

// ---------------------------------------------------------------- Khulna and Narail

/** Khan Jahan Ali Bridge over the Rupsha, seen from the bank: humped haunched box girder on wall piers. */
const rupshaBridge: LandmarkModel = (kit) => {
  const D = kit.depth;
  const deckY = (x: number) => 3 + 14 * Math.sin((Math.PI * x) / D);
  kit.ground(12, 0, 24, kit.length - 2, 0x9c8f72);
  kit.water(D / 2 + 6, 0, D - 38, kit.length, RIVER);
  kit.ground(D - 6, 0, 12, kit.length - 2, 0x7d9a52);
  // deck in short tilted pieces, the box girder deepening toward each pier
  const piers: number[] = [];
  for (let x = 12; x < D - 6; x += 18) piers.push(x);
  const step = 5;
  for (let x = 0; x < D; x += step) {
    const xm = x + step / 2;
    const y = deckY(xm);
    const slope = Math.atan2(deckY(x + step) - deckY(x), step);
    const near = Math.min(...piers.map((p) => Math.abs(p - xm)));
    const depth = 1.4 + Math.max(0, 1 - near / 9) * 2.6;
    kit.add(box(step + 0.15, 0.6, 14), 0xc9c5bc, xm, y, 0, [0, 0, slope]);
    kit.add(box(step + 0.15, depth, 8), CONCRETE, xm, y - 0.3 - depth / 2, 0, [0, 0, slope]);
    for (const s of [-1, 1]) kit.add(box(step + 0.15, 1, 0.3), 0xe0ddd5, xm, y + 0.8, s * 6.85, [0, 0, slope]);
  }
  for (const p of piers) {
    const top = deckY(p) - 4.2;
    kit.add(box(2.6, top, 7), CONCRETE, p, top / 2, 0);
    kit.add(box(3.4, 0.8, 9), 0xa9a59b, p, top - 0.2, 0);
  }
  for (let x = 10; x < D; x += 22) lamp(kit, x, 6.6, 7, deckY(x) + 0.3);
  // traffic on the bridge
  kit.add(box(5, 2.4, 2.2), 0x2f6fb0, 40, deckY(40) + 1.6, -3, [0, 0, Math.atan2(deckY(42) - deckY(38), 4)]);
  kit.add(box(3.6, 1.6, 1.8), 0x2f9e5a, 90, deckY(90) + 1.2, 3, [0, 0, Math.atan2(deckY(92) - deckY(88), 4)]);
  // boats on the Rupsha and the ghat steps on this bank
  hull(kit, 60, -22, 9, 2, 0.7, 0x6b4a2c);
  hull(kit, 82, 20, 24, 5, 1.8, 0x3f4f5f);
  kit.block(82, 26, 4, 5, 3, WHITE, 1.9);
  hull(kit, 36, 12, 7, 1.8, 0.6, 0x7a5232);
  for (let i = 0; i < 4; i++) kit.add(box(1.2, 0.3, 8), 0xb3aca0, 21 + i * 1.2, 0.5 - i * 0.12, -18);
  for (const z of [-28, 24]) {
    kit.block(8, z, 5, 6, 2.6, 0x8f6d4f, 0);
    kit.add(box(6, 0.15, 7), TIN, 8, 2.9, z, [0, 0, 0.12]);
  }
  kit.tree(5, -10, 1);
  kit.palm(18, 28, 1);
  for (let z = -30; z <= 30; z += 15) kit.tree(D - 5, z, 1);
};

/** S M Sultan's memorial museum at Machimdia, on the Chitra: the gallery, his tomb and house, his boat. */
const smSultan: LandmarkModel = (kit) => {
  kit.ground(22, 0, 44, kit.length - 4, 0x8db864);
  kit.water(52, 0, 16, kit.length, 0x5a8a8a);
  // gate and the path in
  for (const z of [-4, 4]) kit.block(2, z, 1.2, 1.2, 4, BRICK, 0);
  kit.add(box(1.2, 1, 9.2), BRICK, 2, 4.5, 0);
  kit.sign(['শিল্পী এস এম সুলতান স্মৃতি সংগ্রহশালা'], 1.3, 4.5, 0, 8.6, 0.8, { bg: '#7f2a26', fg: '#ffffff' }, -Math.PI / 2);
  kit.ground(10, 0, 16, 3, 0xb98b6a, 0.07);
  // the gallery: white walls, a red-brick base and a sloping red roof
  kit.block(22, -20, 14, 22, 5.5, WHITE, 0);
  kit.block(22, -20, 14.2, 22.2, 1, BRICK, 0);
  kit.add(pyramid(), 0xa8432f, 22, 7.2, -20, [0, 0, 0], [16, 3.4, 24]);
  for (let z = -29; z <= -11; z += 4.5) kit.add(box(0.1, 2.4, 1.6), 0x3e5a6c, 14.9, 2.8, z);
  // his tomb under a small white canopy
  kit.block(18, 4, 4.5, 3, 0.6, 0xf4f4f0, 0);
  kit.block(18, 4, 2.2, 1, 0.6, 0xffffff, 0.6);
  for (const [dx, dz] of [[-2, -1.3], [2, -1.3], [-2, 1.3], [2, 1.3]]) kit.cylinder(18 + dx, 4 + dz, 0.15, 3, WHITE, 0.6, 8);
  kit.block(18, 4, 4.8, 3.4, 0.4, WHITE, 3.6);
  // his house: brick with a tin roof and a veranda
  kit.block(26, 20, 10, 14, 4, 0xd8c8a8, 0);
  kit.add(box(12, 0.2, 9), TIN, 25, 4.6, 16.5, [0.25, 0, 0]);
  kit.add(box(12, 0.2, 9), TIN, 25, 4.6, 23.5, [-0.25, 0, 0]);
  for (let z = 14; z <= 26; z += 3) kit.cylinder(20.5, z, 0.12, 3, 0xe0d8c8, 0, 6);
  // "Shishu Swarga": his big two-deck wooden boat for the children, under a shed on the bank
  hull(kit, 39, -14, 18, 4.2, 1.4, 0x6b4426, 0.2);
  kit.block(39, -14, 3.6, 10, 2, 0x8b5a2b, 1.6);
  kit.block(39, -14, 3.2, 7, 1.8, 0xc9a24a, 3.6);
  kit.add(box(3.8, 0.12, 10.4), 0xb03a2e, 39, 3.65, -14);
  kit.add(box(3.4, 0.12, 7.4), 0x2e7d6a, 39, 5.45, -14);
  for (const [dx, dz] of [[-3.5, -24], [3.5, -24], [-3.5, -4], [3.5, -4]]) kit.cylinder(39 + dx, dz, 0.14, 7, 0x777777, 0, 6);
  kit.add(box(8.4, 0.15, 22), TIN, 39, 7.1, -14);
  // the new double-deck boat for children on the Chitra
  hull(kit, 52, 18, 14, 3.6, 1.2, 0xf3f1e8);
  decks(kit, 52, 18, 9, 3.2, 2, [0xf2c94c, 0x3b82c4], 1.3);
  hull(kit, 55, -2, 7, 1.6, 0.6, 0x6b4a2c);
  for (let i = 0; i < 4; i++) kit.add(box(1.2, 0.3, 6), 0xb3aca0, 42 + i * 1.1, 0.5 - i * 0.12, 6);
  kit.tree(8, -14, 1.1);
  kit.tree(8, 18, 1);
  kit.tree(32, 6, 1.2);
  for (const z of [-30, 28]) kit.palm(40, z, 1);
  kit.light(14.8, 4, -20);
  kit.light(20, 3.4, 4, 0xffe2a8);
  for (let i = 0; i < 5; i++) kit.person(10 + kit.rng() * 18, -6 + kit.rng() * 12, kit.rng() * 6, { shirt: [0xffd166, 0xe63946, 0x4a90c2][i % 3] });
};

/** The direction board to Bagerhat with the Sixty Dome Mosque painted in terracotta. */
const shatGambujSign: LandmarkModel = (kit) => {
  const x = 3.2;
  for (const z of [-6, 6]) kit.cylinder(x + 0.4, z, 0.2, 9.8, 0x8a8f94, 0, 8);
  kit.add(box(0.25, 7.2, 14.4), 0x1f6b3a, x, 6.4, 0);
  kit.add(box(0.2, 7.5, 14.7), 0xffffff, x + 0.06, 6.4, 0);
  kit.sign(['ষাটগম্বুজ মসজিদ', 'বিশ্ব ঐতিহ্য · বাগেরহাট →'], x - 0.15, 8.75, 0, 13.6, 2.3, { bg: '#1f6b3a', fg: '#ffffff' }, -Math.PI / 2);
  // the mosque: long low brick front, eleven arched doors, round corner towers, the row of domes
  const fx = x - 0.2;
  const T = 0xc4693e;
  kit.add(box(0.12, 1.7, 9.6), T, fx, 4.1, 0);
  for (let i = 0; i < 11; i++) {
    const z = -4.3 + i * 0.86;
    kit.add(box(0.14, i === 5 ? 1.1 : 0.85, 0.42), 0x3a2418, fx - 0.03, 3.7 + (i === 5 ? 0.12 : 0), z);
    kit.dome(fx, z, 0.36, T, 4.95, 0.9, 10);
  }
  kit.add(box(0.14, 0.5, 1.2), T, fx, 5.2, 0);
  for (const s of [-1, 1]) {
    kit.add(cyl(0.45, 0.5, 2.6, 10), T, fx, 4.25, s * 5.1);
    kit.dome(fx, s * 5.1, 0.45, T, 5.55, 1, 10);
  }
  kit.add(box(0.12, 0.12, 11), 0xe8d9b0, fx, 3.2, 0);
  kit.block(x + 0.4, 0, 1.6, 14, 0.4, 0xb3aca0, 0);
  for (const z of [-4, 4]) kit.light(x - 1, 10.3, z, 0xffffff);
};

export const MODELS_SOUTH: Record<string, LandmarkModel> = {
  bhangaInterchange,
  bhangaStation,
  padmaLinkStation,
  jajiraServiceArea: (kit) => serviceArea(kit, false),
  mawaServiceArea: (kit) => serviceArea(kit, true),
  shimuliaGhat,
  keraniganjJail,
  mahilaraMath,
  ugraTara,
  barishalUniversity,
  barishalAirport,
  rupshaBridge,
  smSultan,
  shatGambujSign,
};
