// Generic civic, religious and green landmarks: the stand-in model for every place of these kinds that has
// no model of its own. Each one is the typical Bangladeshi version:
// - mosque: a jame masjid, white prayer hall behind an arched verandah, a big central dome with corner kiosks,
//   tall minarets with balconies, a pond with a bathing ghat beside it
// - madrasa: a Qawmi madrasa, white-and-green hostel blocks with open corridors round a yard, its own mosque,
//   students in white panjabi and caps
// - temple: a rekha deul with a curvilinear shikhara (terracotta or whitewashed), a natmandir, a do-chala shrine,
//   tulsi mancha and a saffron flag
// - buddhist: a CHT kyang, golden bell-shaped zedi on white terraces, a monastery hall with tiered roofs, monks
// - mazar: a dargah, white tomb with a green onion dome, flags, a gate arch, a banyan, a pond, devotees
// - monument: a Shaheed Minar or a triangular memorial on a stepped red-brick plinth with lawns and pools
// - ruins: a Buddhist vihara site, brick cells round a courtyard, a cruciform central shrine, an archaeology board
// - cemetery: a Commonwealth war cemetery (headstone rows, cross of sacrifice) or a village kabarstan
// - university, college, cantonment, govtBuilding, jail, hospital, museum: gates, compounds and blocks
// - park, forest, teaGarden, lake: an eco-park with a lake and footbridge, a sal forest, a Sylhet tea estate
// Frame (LKit): x = 0 at the road edge, +x away from it, z along the road. People facing the road use FACE_ROAD.

import * as THREE from 'three';
import type { LandmarkKind } from '../../config/landmarks';
import { box, buildColored, cached, cone, cyl, ico } from '../../utils/geometry';
import { personParts } from '../People';
import type { LandmarkModel, LKit, PersonLook } from './kit';

const FACE_ROAD = Math.PI / 2;

const WHITE = 0xf3f0e8;
const CREAM = 0xeadfc4;
const DARK = 0x2c3a44;
const GOLD = 0xd4a72c;
const BRICK = 0xa24a30;
const BRICK_DARK = 0x7f3622;
const TERRACOTTA = 0xb5552f;
const LAWN = 0x6e9c45;
const GRASS = 0x86a656;
const PAVE = 0xbdb6a6;
const EARTH = 0x9a7b55;
const BANK = 0x8f7d55;
const M_GREEN = 0x1f7a4d;
const DOME_GREEN = 0x2f8a57;
const SAFFRON = 0xf28c28;
const RED = 0xd62f2f;
const OLIVE = 0x4b5a2a;
const WOOD = 0x6b4a2a;
const TIN = 0x9aa0a3;
const ROOF_RED = 0x9c2f22;
const LAMP = 0xfff2c4;

const SKINS = [0x8d5a3b, 0x9c6644, 0x7b4a2e, 0xa87150];

const MUSALLI: PersonLook = { shirt: 0xf6f4ee, lower: 0xf6f4ee, cap: 0xffffff };
const MEN: PersonLook[] = [
  MUSALLI,
  { shirt: 0x9ec3e6, lower: 0x3b5d8f, lungi: true },
  { shirt: 0xd9c7a3, lower: 0x2f6f5e, lungi: true, cap: 0xffffff },
  { shirt: 0xc9c9c9, lower: 0x3a3a40 },
];
const SARIS: PersonLook[] = [
  { shirt: 0xc0392b, lower: 0xc0392b, lungi: true },
  { shirt: 0xe9b824, lower: 0xe9b824, lungi: true },
  { shirt: 0x2a9d8f, lower: 0x2a9d8f, lungi: true },
  { shirt: 0xd94f8a, lower: 0xd94f8a, lungi: true },
];
const STUDENTS: PersonLook[] = [
  { shirt: 0xf2f0ea, lower: 0x2f3b55 },
  { shirt: 0x9ec3e6, lower: 0x3a3a40 },
  { shirt: 0xd94f8a, lower: 0xd94f8a, lungi: true },
  { shirt: 0x6b8f3a, lower: 0x2f3b55 },
  { shirt: 0xe9b824, lower: 0xf2f0ea, lungi: true },
  { shirt: 0x8a9bb0, lower: 0x3a3a40 },
];
const MONK: PersonLook = { shirt: 0xb5451b, lower: 0xb5451b, lungi: true };
const SOLDIER: PersonLook = { shirt: 0x4f5b32, lower: 0x4f5b32, cap: 0x3d4a26 };
const KHAKI: PersonLook = { shirt: 0xb8a77a, lower: 0xb8a77a, cap: 0x2f3b55 };

// ---------------------------------------------------------------- shared helpers

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** A lathe from [radius, y] pairs (domes, stupas, shikharas). */
function lathe(pts: [number, number][], seg = 12): THREE.LatheGeometry {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** A person at height y (on a deck, a hill), same look as kit.person. */
function personAt(kit: LKit, x: number, y: number, z: number, yaw: number, look: PersonLook = {}): void {
  const skin = look.skin ?? SKINS[Math.floor(kit.rng() * SKINS.length)];
  const l = { skin, shirt: look.shirt ?? 0xf2f0ea, lower: look.lower ?? 0x3b5d8f, lungi: look.lungi ?? false, cap: look.cap, seated: look.seated };
  const geo = cached(`lmperson:${l.skin}:${l.shirt}:${l.lower}:${l.lungi}:${l.cap}:${!!l.seated}`, () => buildColored(personParts(l)));
  kit.add(geo, undefined, x, y, z, [0, yaw, 0]);
}

/** n people scattered in a rectangle; yaw undefined = random headings. */
function crowd(kit: LKit, n: number, x0: number, x1: number, z0: number, z1: number, looks: PersonLook[], yaw?: number): void {
  for (let i = 0; i < n; i++) {
    const y = yaw ?? kit.rng() * Math.PI * 2;
    kit.person(x0 + kit.rng() * (x1 - x0), z0 + kit.rng() * (z1 - z0), y, looks[i % looks.length]);
  }
}

/** Gold finial with a ball and a small crescent (mosque and mazar domes). */
function finial(kit: LKit, x: number, y: number, z: number, s = 1, crescent = true): void {
  kit.add(cyl(0.05 * s, 0.08 * s, 1.1 * s, 5), GOLD, x, y + 0.55 * s, z);
  kit.ball(x, y + 0.75 * s, z, 0.15 * s, GOLD, 6);
  if (crescent) {
    const g = new THREE.TorusGeometry(0.22 * s, 0.05 * s, 4, 8, Math.PI * 1.3).rotateZ(-Math.PI * 0.15);
    kit.add(g, GOLD, x, y + 1.3 * s, z, [0, Math.PI / 2, 0]);
  }
}

const ONION: [number, number][] = [[1, 0], [1.1, 0.22], [1.08, 0.5], [0.86, 0.86], [0.52, 1.16], [0.2, 1.42], [0.06, 1.58], [0, 1.62]];

/** A Mughal/Bengal-sultanate style dome: slightly bulbous, r = base radius, tall stretches it into an onion. */
function onion(kit: LKit, x: number, z: number, r: number, y0: number, color: number, tall = 1, seg = 12, top = true): void {
  kit.add(lathe(ONION, seg), color, x, y0, z, [0, 0, 0], [r, r * tall, r]);
  if (top) finial(kit, x, y0 + r * tall * 1.6, z, Math.max(0.5, r * 0.35));
}

/** A small roof kiosk (chhatri): a drum and a little dome, for roof corners and gate posts. */
function kiosk(kit: LKit, x: number, z: number, r: number, y0: number, body: number, domeCol: number): void {
  kit.cylinder(x, z, r, r * 1.4, body, y0, 8);
  onion(kit, x, z, r * 1.1, y0 + r * 1.4, domeCol, 1.2, 8, false);
  kit.add(cyl(0.03, 0.05, r * 1.2, 4), GOLD, x, y0 + r * 1.4 + r * 1.9, z);
}

/** A minaret: plinth, tapering octagonal shaft, two balconies, an open top kiosk and a dome. */
function minaret(kit: LKit, x: number, z: number, h: number, r: number, body = WHITE, domeCol = WHITE, band = M_GREEN): void {
  kit.block(x, z, r * 2.6, r * 2.6, h * 0.12, body);
  const shaft = h * 0.8;
  kit.cylinder(x, z, r, shaft, body, 0, 8, r * 0.8);
  for (const t of [0.45, 0.72]) {
    kit.cylinder(x, z, r * 1.5, 0.25, band, shaft * t, 8);
    kit.cylinder(x, z, r * 1.42, 0.7, body, shaft * t + 0.25, 8);
  }
  const ky = shaft;
  const kh = h * 0.08;
  kit.cylinder(x, z, r * 1.3, 0.25, band, ky, 8);
  kit.cylinder(x, z, r * 0.45, kh, DARK, ky + 0.25, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    kit.cylinder(x + Math.sin(a) * r * 0.85, z + Math.cos(a) * r * 0.85, 0.07, kh, body, ky + 0.25, 4);
  }
  kit.cylinder(x, z, r * 1.15, 0.25, body, ky + 0.25 + kh, 8);
  onion(kit, x, z, r * 0.95, ky + 0.5 + kh, domeCol, 1.25, 10);
  kit.light(x, ky + 0.25 + kh / 2, z, 0x9dffb0);
}

/** A dark arched opening (door, arcade bay, window) on a face looking at the road (x = xFace). */
function archDoor(kit: LKit, xFace: number, z: number, w: number, h: number, y0 = 0, color = DARK): void {
  const rect = Math.max(0.2, h - w / 2);
  kit.add(box(0.1, rect, w), color, xFace - 0.06, y0 + rect / 2, z);
  const top = new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
  kit.add(top, color, xFace - 0.06, y0 + rect, z);
}

/** A half-ring arch across z (a gate arch) sitting on y0, centre z, span = inner width. */
function archRing(kit: LKit, x: number, z: number, span: number, y0: number, color: number, tube = 0.35): void {
  kit.add(new THREE.TorusGeometry(span / 2 + tube, tube, 6, 14, Math.PI), color, x, y0, z, [0, Math.PI / 2, 0]);
}

/** Two gate pillars at z ± span/2 with caps, and a lintel when wanted. */
function gatePosts(kit: LKit, x: number, z: number, span: number, h: number, color: number, cap = color, lintel = false, p = 1.1): void {
  for (const s of [-1, 1]) {
    kit.block(x, z + s * (span / 2 + p / 2), p, p, h, color);
    kit.block(x, z + s * (span / 2 + p / 2), p + 0.3, p + 0.3, 0.35, cap, h);
  }
  if (lintel) kit.block(x, z, p * 0.9, span + p * 2, 1.0, color, h - 1.0);
  kit.light(x - 0.4, h + 0.5, z - span / 2 - p / 2, LAMP);
  kit.light(x - 0.4, h + 0.5, z + span / 2 + p / 2, LAMP);
}

/** A pyramidal (hip) roof w (x) × d (z), h tall, its base on y0. */
function hipRoof(kit: LKit, x: number, z: number, w: number, d: number, h: number, color: number, y0: number): void {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
  kit.add(g, color, x, y0 + h / 2, z, [0, 0, 0], [w, h, d]);
}

/** A pitched roof, ridge along z (or along x with yaw π/2): w wide, d long, h tall on y0. */
function gableRoof(kit: LKit, x: number, z: number, w: number, d: number, h: number, color: number, y0: number, yaw = 0, over = 0.4): void {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - over, 0);
  s.lineTo(w / 2 + over, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d + over * 2, bevelEnabled: false });
  g.translate(0, 0, -(d + over * 2) / 2);
  kit.add(g, color, x, y0, z, [0, yaw, 0]);
}

/** A Bengal do-chala roof: two convex curved slopes, ridge along z. */
function dochala(kit: LKit, x: number, z: number, w: number, d: number, h: number, color: number, y0: number): void {
  const a = w / 2 + 0.4;
  const s = new THREE.Shape();
  s.moveTo(-a, -0.1);
  s.quadraticCurveTo(-a * 0.6, h * 1.02, 0, h);
  s.quadraticCurveTo(a * 0.6, h * 1.02, a, -0.1);
  s.lineTo(a, -0.35);
  s.lineTo(-a, -0.35);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -(d + 0.8) / 2);
  kit.add(g, color, x, y0 + 0.35, z);
}

/** A thin triangular plane facing the road (a memorial blade, a pediment): base b along z, h tall. */
function triPlane(kit: LKit, x: number, z: number, b: number, h: number, thick: number, color: number, y0: number): void {
  const s = new THREE.Shape();
  s.moveTo(-b / 2, 0);
  s.lineTo(b / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  kit.add(g, color, x, y0, z, [0, Math.PI / 2, 0]);
}

/** A pond with a grassy-earth bank and a brick ghat (steps and two side parapets) on its road side. */
function pond(kit: LKit, x: number, z: number, w: number, d: number, ghat = BRICK): void {
  kit.ground(x, z, w + 2, d + 2, BANK);
  kit.water(x, z, w, d);
  const gx = x - w / 2;
  for (let i = 0; i < 4; i++) kit.block(gx - 0.6 + i * 0.7, z, 0.7, 4, 0.5 - i * 0.12, ghat);
  for (const s of [-1, 1]) {
    kit.block(gx + 0.3, z + s * 2.3, 2.8, 0.5, 0.8, ghat);
    kit.block(gx + 0.3, z + s * 2.3, 2.6, 0.9, 0.12, WHITE, 0.8);
  }
}

/**
 * A block of `floors` storeys from (x0, z0), w deep (x) and d long (z), with floor bands, a parapet and windows
 * on its road face. ribbon = continuous window bands instead of single windows (modern blocks).
 */
function building(
  kit: LKit, x0: number, z0: number, w: number, d: number, floors: number, color: number,
  o: { fh?: number; band?: number; win?: number; spacing?: number; ribbon?: boolean; lit?: number } = {},
): number {
  const fh = o.fh ?? 3.3;
  const h = floors * fh;
  const xc = x0 + w / 2;
  const zc = z0 + d / 2;
  kit.block(xc, zc, w, d, h, color);
  kit.block(xc, zc, w + 0.3, d + 0.3, 0.7, o.band ?? color, h);
  if (o.band !== undefined) for (let f = 1; f < floors; f++) kit.add(box(w + 0.2, 0.25, d + 0.2), o.band, xc, f * fh, zc);
  const win = o.win ?? DARK;
  if (o.ribbon) {
    for (let f = 0; f < floors; f++) kit.add(box(0.08, fh * 0.45, d - 1.2), win, x0 - 0.05, f * fh + fh * 0.55, zc);
  } else {
    kit.windows(x0, z0 + 0.6, z0 + d - 0.6, 0, floors, fh, win, o.spacing ?? 3, 1.2, 1.5);
  }
  for (let i = 0; i < (o.lit ?? 2); i++) {
    kit.light(x0 - 0.2, (Math.floor(kit.rng() * floors) + 0.5) * fh, z0 + 1 + kit.rng() * (d - 2));
  }
  return h;
}

/** An open verandah (corridor) along the road face of a block, columns every ~3 m, all floors. */
function verandah(kit: LKit, xFace: number, z0: number, z1: number, floors: number, fh: number, color: number, pillar = color, rail = color, deep = 2.2): void {
  const len = z1 - z0;
  const zc = (z0 + z1) / 2;
  const xv = xFace - deep / 2;
  kit.block(xv, zc, deep, len, 0.4, color);
  for (let f = 1; f <= floors; f++) kit.add(box(deep + 0.2, 0.3, len), color, xv, f * fh, zc);
  for (let f = 1; f < floors; f++) kit.add(box(0.14, 0.9, len), rail, xFace - deep + 0.05, f * fh + 0.6, zc);
  const n = Math.max(2, Math.round(len / 3));
  for (let i = 0; i <= n; i++) kit.add(box(0.45, floors * fh, 0.45), pillar, xFace - deep + 0.25, (floors * fh) / 2, z0 + (i / n) * len);
}

/**
 * The Central Shaheed Minar in miniature: a red-brick plinth, the tall middle pair of columns with the bent top
 * (the mother bowing over her martyred sons), two shorter pairs either side, the red sun behind. s = scale.
 */
function shaheedMinar(kit: LKit, x: number, z: number, s = 1): void {
  kit.block(x, z, 5.5 * s, 12 * s, 0.5 * s, BRICK);
  kit.block(x + 0.5 * s, z, 3.8 * s, 9.5 * s, 0.4 * s, BRICK_DARK, 0.5 * s);
  const y0 = 0.9 * s;
  kit.add(cyl(2.4 * s, 2.4 * s, 0.12, 18), RED, x + 1.5 * s, y0 + 3.4 * s, z, [0, 0, Math.PI / 2]);
  const t = 0.22 * s;
  const frame = (fz: number, h: number, w: number, bend: boolean) => {
    for (const side of [-1, 1]) kit.add(box(t, h, t), WHITE, x, y0 + h / 2, fz + side * w / 2);
    for (const f of [-1 / 6, 1 / 6]) kit.add(box(t * 0.4, h * 0.9, t * 0.4), WHITE, x, y0 + h * 0.45, fz + f * w);
    if (bend) {
      const bl = 1.7 * s;
      const a = 0.6;
      for (const side of [-1, 1]) {
        kit.add(box(t, bl, t), WHITE, x - (Math.sin(a) * bl) / 2, y0 + h + (Math.cos(a) * bl) / 2, fz + side * w / 2, [0, 0, a]);
      }
      kit.add(box(t, t, w + t), WHITE, x - Math.sin(a) * bl, y0 + h + Math.cos(a) * bl, fz);
      kit.add(box(t, t, w + t), WHITE, x, y0 + h, fz);
    } else {
      kit.add(box(t, t, w + t), WHITE, x, y0 + h, fz);
    }
  };
  frame(z, 5.6 * s, 1.7 * s, true);
  for (const side of [-1, 1]) {
    frame(z + side * 2.0 * s, 4.3 * s, 1.1 * s, false);
    frame(z + side * 3.6 * s, 3.5 * s, 1.0 * s, false);
  }
}

/** A sal tree: tall straight dark trunk, a rounded crown high up. */
function salTree(kit: LKit, x: number, z: number, h: number): void {
  const leaves = [0x3f6b2a, 0x4a7a30, 0x557f35];
  kit.add(cyl(0.22, 0.34, h, 6), 0x5e4c3a, x, h / 2, z);
  kit.add(ico(2.3), leaves[Math.floor(kit.rng() * 3)], x, h + 1.2, z, [0, kit.rng() * 3, 0], [1, 1.35, 1]);
}

/** A tall shade tree of the tea gardens (Albizia): thin pale trunk, a flat umbrella crown. */
function albizia(kit: LKit, x: number, z: number, y0: number, s = 1): void {
  kit.add(cyl(0.18 * s, 0.3 * s, 9 * s, 6), 0xa8a294, x, y0 + 4.5 * s, z);
  kit.add(ico(4 * s), 0x5d8c3a, x, y0 + 9.3 * s, z, [0, kit.rng() * 3, 0], [1, 0.3, 1]);
  kit.add(ico(2.6 * s), 0x6b9a42, x + 1.5 * s, y0 + 8.4 * s, z - 1 * s, [0, 0, 0], [1, 0.35, 1]);
}

/** A park bench (concrete seat on two legs), along z. */
function bench(kit: LKit, x: number, z: number, color = 0x8a8a84): void {
  kit.block(x, z, 0.5, 1.8, 0.1, color, 0.42);
  for (const s of [-1, 1]) kit.block(x, z + s * 0.7, 0.45, 0.12, 0.42, color);
}

/** A country boat (nouka): hull, pointed raised ends, a bamboo-mat chhoi. yaw 0 = along z. */
function nouka(kit: LKit, x: number, z: number, len: number, yaw: number, y = 0.05, chhoi = true): void {
  const at = (dz: number): [number, number] => [x + dz * Math.sin(yaw), z + dz * Math.cos(yaw)];
  kit.add(box(1.3, 0.5, len * 0.6), WOOD, x, y + 0.25, z, [0, yaw, 0]);
  const tip = (dir: 1 | -1) => cone(0.65, len * 0.24, 4).rotateX((dir * Math.PI) / 2).rotateZ(Math.PI / 4);
  for (const dir of [1, -1] as const) {
    const [px, pz] = at(dir * len * 0.42);
    kit.add(tip(dir), WOOD, px, y + 0.35, pz, [0, yaw, 0]);
  }
  if (chhoi) {
    const g = new THREE.CylinderGeometry(0.62, 0.62, len * 0.28, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    kit.add(g, 0xb59a5a, x, y + 0.5, z, [0, yaw, 0]);
  }
}

/** A small van/car parked along z: body, cabin glass, wheels. */
function vehicle(kit: LKit, x: number, z: number, color: number, len = 4.6, tall = 1.5): void {
  kit.block(x, z, 1.9, len, tall * 0.55, color, 0.35);
  kit.block(x, z + len * 0.05, 1.7, len * 0.6, tall * 0.42, 0x2a3640, 0.35 + tall * 0.55);
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.33, 0.33]) kit.add(cyl(0.35, 0.35, 0.25, 8), 0x1d1d1d, x + sx, 0.35, z + sz * len, [0, 0, Math.PI / 2]);
}

/** Lawn over the whole footprint. */
function lawn(kit: LKit, color = LAWN): void {
  kit.ground(kit.depth / 2, 0, kit.depth, kit.length, color, 0.02);
}

// ---------------------------------------------------------------- religious

function mosque(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const body = kit.rng() < 0.6 ? WHITE : CREAM;
  const domeCol = kit.rng() < 0.6 ? DOME_GREEN : WHITE;
  const mz = 5;
  lawn(kit, GRASS);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.3, body, mz, 6);
  for (const s of [-1, 1]) {
    kit.block(0.8, mz + s * 3.6, 1.2, 1.2, 3.2, body);
    kiosk(kit, 0.8, mz + s * 3.6, 0.55, 3.2, body, domeCol);
  }
  kit.ground(6.5, mz, 11, 22, PAVE);

  // prayer hall
  const hx = 25;
  kit.block(hx, mz, 14, 20, 7.5, body);
  kit.block(hx, mz, 14.4, 20.4, 0.5, M_GREEN, 7.5);
  kit.block(32.8, mz, 1.6, 4, 6.2, body);
  kit.dome(32.8, mz, 1.6, body, 6.2, 1.2, 10);
  // drum and the great dome
  kit.cylinder(hx, mz, 4.6, 1.6, body, 8, 16);
  kit.cylinder(hx, mz, 4.8, 0.3, M_GREEN, 9.4, 16);
  onion(kit, hx, mz, 4.7, 9.7, domeCol, 1, 16);
  for (const [cx, cz] of [[19, -8.5], [19, 8.5], [31, -8.5], [31, 8.5]]) kiosk(kit, cx, mz + cz, 0.9, 8, body, domeCol);

  // the arched verandah facing the road
  kit.block(15.25, mz, 5.5, 20, 0.5, body, 5.2);
  kit.block(15.25, mz, 5.7, 20.2, 0.6, M_GREEN, 5.7);
  kit.block(12.75, mz, 0.5, 20, 5.2, body);
  kit.block(15.25, mz, 5.5, 20, 0.3, PAVE);
  for (const z of [-8, -4, 0, 4, 8]) archDoor(kit, 12.5, mz + z, 2.6, 4.3, 0.3);
  for (const z of [-5, 5]) {
    kit.cylinder(15.25, mz + z, 1.3, 0.8, body, 6.3, 12);
    onion(kit, 15.25, mz + z, 1.4, 7.1, domeCol, 1.1, 12);
  }
  for (const z of [-10, 10]) kiosk(kit, 12.8, mz + z, 0.55, 6.3, body, domeCol);

  // minarets at the front corners
  minaret(kit, 11.2, mz + 11.8, 23, 1.1, body, domeCol);
  if (kit.rng() < 0.65) minaret(kit, 11.2, mz - 11.8, 23, 1.1, body, domeCol);

  // the pond with its ghat
  pond(kit, 27, -15, 18, 10);
  kit.palm(16, -19, 0.9);
  kit.tree(37, -15, 0.9);
  kit.tree(37, 18, 1);
  kit.palm(36, 19, 1);
  kit.tree(5, -16, 0.8);

  crowd(kit, 7, 3, 11, mz - 8, mz + 8, [MUSALLI, MUSALLI, MEN[2]]);
  kit.light(hx, 9.7 + 4.7 * 1.6 + 1, mz, 0x9dffb0);
  for (const z of [-6, 0, 6]) kit.light(13.2, 4.6, mz + z);
}

function madrasa(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit, GRASS);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 2.2, WHITE, 0, 7);
  kit.wall(0.8, -hz + 0.8, 0.8, -3.5, 0.25, M_GREEN, 0.4, 2.2);
  kit.wall(0.8, 3.5, 0.8, hz - 0.8, 0.25, M_GREEN, 0.4, 2.2);
  gatePosts(kit, 0.8, 0, 6.4, 5.5, WHITE, M_GREEN);
  archRing(kit, 0.8, 0, 6.4, 5.5, M_GREEN, 0.4);
  for (const s of [-1, 1]) kiosk(kit, 0.8, s * 3.75, 0.6, 5.85, WHITE, DOME_GREEN);
  kit.ground(17, -3, 26, 28, 0xc9b48c);

  // the main hostel/classroom block with open corridors facing the yard
  const fh = 3.2;
  building(kit, 31, -hz + 3, 10, L - 6, 4, WHITE, { fh, band: M_GREEN, spacing: 4, win: 0x1f3a2c, lit: 4 });
  verandah(kit, 31, -hz + 3, hz - 3, 4, fh, WHITE, WHITE, M_GREEN);
  kit.cylinder(38, -14, 0.8, 1.4, 0x222222, 4 * fh + 0.7);
  kit.cylinder(38, 12, 0.8, 1.4, 0x222222, 4 * fh + 0.7);
  // a side block across the yard
  kit.block(19, -22, 22, 8, 3 * fh, WHITE);
  kit.block(19, -22, 22.3, 8.3, 0.6, M_GREEN, 3 * fh);
  for (let f = 1; f < 3; f++) kit.add(box(22.2, 0.25, 8.2), M_GREEN, 19, f * fh, -22);
  kit.windowsZ(-18, 8, 30, 0, 3, fh, 0x1f3a2c, 3.6);
  kit.windows(8, -26, -18, 0, 3, fh, 0x1f3a2c, 3.6);

  // the madrasa mosque
  kit.block(20, 20, 12, 12, 6.5, WHITE);
  kit.block(20, 20, 12.4, 12.4, 0.45, M_GREEN, 6.5);
  for (const z of [16.5, 20, 23.5]) archDoor(kit, 14, z, 2.2, 3.6);
  kit.cylinder(20, 20, 3.6, 1.2, WHITE, 6.95, 14);
  onion(kit, 20, 20, 3.7, 8.15, DOME_GREEN, 1.05, 14);
  for (const [cx, cz] of [[14.6, 14.6], [25.4, 14.6], [25.4, 25.4]]) kiosk(kit, cx, cz, 0.6, 6.95, WHITE, DOME_GREEN);
  minaret(kit, 13, 26.5, 19, 0.95, WHITE, DOME_GREEN);

  // students in white panjabi and caps, some reading in the corridor
  crowd(kit, 12, 6, 28, -16, 10, [MUSALLI, MUSALLI, { shirt: 0xf6f4ee, lower: 0xf6f4ee, cap: 0xf6f4ee }]);
  for (let i = 0; i < 6; i++) kit.person(29.2, -10 + i * 1.6, FACE_ROAD, { ...MUSALLI, seated: true });
  kit.tree(5, -22, 0.9);
  kit.tree(42, hz - 4, 0.8);
  kit.palm(6, 22, 0.9);
}

function temple(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const terracotta = kit.rng() < 0.55;
  const body = terracotta ? TERRACOTTA : WHITE;
  const trim = terracotta ? BRICK_DARK : SAFFRON;
  lawn(kit, GRASS);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.2, WHITE, 0, 4);
  gatePosts(kit, 0.8, 0, 4, 3.4, WHITE, SAFFRON);
  kit.ground(12, 0, 20, 16, PAVE);

  // the rekha deul: plinth, sanctum, curvilinear shikhara, amalaka and kalash
  const dx = 21;
  kit.block(dx, 0, 10, 10, 1.2, BRICK);
  for (let i = 0; i < 3; i++) kit.block(15.6 + i * 0.5, 0, 0.5, 3, 1.2 - i * 0.4, BRICK);
  kit.block(dx, 0, 7, 7, 4.5, body, 1.2);
  kit.block(dx, 0, 7.4, 7.4, 0.35, trim, 5.7);
  archDoor(kit, dx - 3.5, 0, 1.6, 2.8, 1.2);
  const sq = Math.SQRT2;
  const prof: [number, number][] = [[3.4, 0], [3.5, 2], [3.3, 5], [2.8, 8], [2.1, 10.5], [1.3, 12], [0.9, 12.5], [0, 12.5]];
  const shikhara = lathe(prof.map(([r, y]) => [r * sq, y] as [number, number]), 4).rotateY(Math.PI / 4);
  kit.add(shikhara, body, dx, 6.05, 0);
  const inner = lathe([[1.6 * sq, 0], [1.7 * sq, 3], [1.4 * sq, 7], [0.9 * sq, 10.5], [0, 11]], 4).rotateY(Math.PI / 4);
  kit.add(inner, trim, dx - 1.9, 6.05, 0, [0, 0, 0], [0.5, 1, 1]);
  kit.cylinder(dx, 0, 1.5, 0.7, body, 18.5, 12);
  kit.ball(dx, 19.6, 0, 0.5, GOLD, 8);
  kit.add(cone(0.2, 0.9, 6), GOLD, dx, 20.4, 0);
  kit.cylinder(dx, 0, 0.04, 2.6, 0xdddddd, 19.2, 4);
  kit.add(box(0.03, 0.7, 1.2), SAFFRON, dx, 21.4, 0.6);

  // the natmandir: an open pillared hall in front
  kit.block(9.5, 0, 7, 10, 0.6, WHITE);
  for (const x of [6.5, 12.5]) for (const z of [-4.3, -1.4, 1.4, 4.3]) kit.cylinder(x, z, 0.22, 3.2, WHITE, 0.6, 8);
  kit.block(9.5, 0, 7.4, 10.4, 0.35, WHITE, 3.8);
  dochala(kit, 9.5, 0, 7.4, 10.4, 2.4, terracotta ? BRICK_DARK : ROOF_RED, 4.15);

  // a small do-chala Shiva shrine and the tulsi mancha
  kit.block(23, 11.5, 4, 4, 0.6, BRICK);
  kit.block(23, 11.5, 3.4, 3.4, 2.8, TERRACOTTA, 0.6);
  archDoor(kit, 21.3, 11.5, 1, 1.8, 0.6);
  dochala(kit, 23, 11.5, 3.4, 3.4, 1.8, TERRACOTTA, 3.4);
  kit.block(13, -10, 0.9, 0.9, 1.1, WHITE);
  kit.add(ico(0.55), 0x3f7a2c, 13, 1.55, -10);

  // a saffron flag on a tall pole by the gate
  kit.cylinder(4, 6, 0.06, 9, 0xe8e8e8, 0, 6);
  triPlane(kit, 4, 7.1, 2, 1.2, 0.04, SAFFRON, 7.6);
  kit.tree(27, -12, 1.2);
  kit.tree(5, -12, 0.8);
  kit.palm(28, 13.5, 0.9);

  crowd(kit, 5, 6, 15, -6, 6, SARIS);
  crowd(kit, 2, 6, 14, -6, 6, [{ shirt: 0xf6f4ee, lower: 0xf6f4ee, lungi: true }]);
  for (const z of [-1.3, 1.3]) kit.light(16.4, 1.4, z, 0xffb347);
  kit.light(dx, 21, 0, 0xffb347);
}

function buddhist(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit, GRASS);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.5, WHITE, 0, 5);
  // gate with a small tiered roof
  gatePosts(kit, 0.8, 0, 5, 4, WHITE, GOLD, true);
  hipRoof(kit, 0.8, 0, 2.4, 8.6, 1.2, ROOF_RED, 4.1);
  hipRoof(kit, 0.8, 0, 1.6, 4.5, 1.0, ROOF_RED, 5.1);
  kit.add(cone(0.25, 1.6, 6), GOLD, 0.8, 6.8, 0);
  kit.ground(14, -2, 26, 6, PAVE);

  // the zedi: white terraces, a golden bell, rings, lotus, banana bud and the hti umbrella
  const zx = 31;
  const zz = -8;
  kit.block(zx, zz, 13, 13, 1.2, WHITE);
  kit.block(zx, zz, 10.5, 10.5, 1.2, WHITE, 1.2);
  kit.block(zx, zz, 8, 8, 1.0, WHITE, 2.4);
  kit.cylinder(zx, zz, 3.9, 0.8, WHITE, 3.4, 8);
  const bell: [number, number][] = [[3.2, 0], [3.3, 0.6], [3.05, 2], [2.45, 3.4], [1.5, 4.4], [1.3, 4.6], [1.3, 5.1], [1.05, 5.3], [1.05, 5.9], [0.9, 6.3], [0.7, 7], [0.4, 8.5], [0.12, 10], [0, 10.4]];
  const s = 1.25;
  kit.add(lathe(bell.map(([r, y]) => [r * s, y * s] as [number, number]), 14), GOLD, zx, 4.2, zz);
  kit.add(cone(0.7, 0.8, 8), GOLD, zx, 4.2 + 10.4 * s + 0.2, zz);
  kit.add(cyl(0.03, 0.05, 1.4, 4), GOLD, zx, 4.2 + 10.4 * s + 1.1, zz);
  for (const [cx, cz] of [[-5.6, -5.6], [-5.6, 5.6], [5.6, -5.6], [5.6, 5.6]]) {
    kit.block(zx + cx, zz + cz, 1.2, 1.2, 0.8, WHITE, 1.2);
    kit.add(lathe(bell.map(([r, y]) => [r * 0.32, y * 0.32] as [number, number]), 8), GOLD, zx + cx, 2.0, zz + cz);
  }
  kit.light(zx - 4, 3.5, zz, 0xffe08a);
  kit.light(zx, 4.2 + 10.4 * s + 1.6, zz, 0xffe08a);

  // the kyang: a monastery hall on posts with tiered roofs and a small spire
  const kx = 20;
  const kz = 13;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) kit.block(kx - 6 + i * 6, kz - 6.5 + j * 4.33, 0.4, 0.4, 1.6, WOOD);
  kit.block(kx, kz, 14.4, 14.4, 0.3, WOOD, 1.5);
  kit.block(kx, kz, 13, 13, 3.4, CREAM, 1.8);
  kit.windows(kx - 6.5, kz - 6.5, kz + 6.5, 1.8, 1, 3.4, 0x6a2a1a, 2.6, 1.2, 1.6);
  for (let i = 0; i < 4; i++) kit.block(kx - 7.4 - i * 0.45, kz, 0.45, 2.5, 1.6 - i * 0.4, WOOD);
  hipRoof(kit, kx, kz, 16, 16, 2.2, ROOF_RED, 5.2);
  kit.block(kx, kz, 8, 8, 1.2, CREAM, 6.6);
  hipRoof(kit, kx, kz, 10.5, 10.5, 1.8, ROOF_RED, 7.8);
  kit.block(kx, kz, 3.4, 3.4, 1.0, CREAM, 9.2);
  hipRoof(kit, kx, kz, 5, 5, 1.4, ROOF_RED, 10.2);
  kit.add(cone(0.5, 3, 8), GOLD, kx, 13.1, kz);
  kit.light(kx - 6.6, 3.5, kz - 3);
  kit.light(kx - 6.6, 3.5, kz + 3);

  // a seated golden Buddha facing the road
  kit.block(11, zz, 3, 3, 1.5, WHITE);
  kit.cylinder(11, zz, 1.3, 0.35, GOLD, 1.5, 12);
  kit.block(11, zz, 1.4, 2.4, 0.55, GOLD, 1.85);
  kit.block(11.2, zz, 1, 1.5, 1.5, GOLD, 2.3);
  kit.ball(11.1, 4.15, zz, 0.45, GOLD, 8);
  kit.ball(11.1, 4.6, zz, 0.18, GOLD, 6);

  kit.bunting(2, -1.5, zx - 5, zz, 5, [0x1f4fa0, 0xffd200, 0xd62f2f, 0xffffff, 0xf28c28]);
  kit.bunting(2, 1.5, kx - 7, kz - 5, 5, [0x1f4fa0, 0xffd200, 0xd62f2f, 0xffffff, 0xf28c28]);
  kit.tree(38, 15, 1.3);
  kit.tree(6, 17, 0.8);
  kit.tree(40, -19, 0.9);
  crowd(kit, 4, 6, 26, -4, 4, [MONK]);
  crowd(kit, 3, 5, 16, -14, -3, SARIS);
}

function mazar(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  kit.ground(D / 2, 0, D, L, 0xb5a27a, 0.02);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.4, WHITE, 0, 5);
  // the gate arch
  gatePosts(kit, 1.2, 0, 5, 4.6, WHITE, M_GREEN);
  archRing(kit, 1.2, 0, 5, 4.6, DOME_GREEN, 0.35);
  for (const sz of [-1, 1]) onion(kit, 1.2, sz * 3.05, 0.6, 4.95, DOME_GREEN, 1.3, 8, false);
  kit.ground(7.5, 0, 13, 3, PAVE);

  // the tomb: a white cube, a green onion dome on a drum, little corner minarets
  const tx = 17;
  kit.ground(tx, 0, 12, 12, WHITE);
  kit.block(tx, 0, 8, 8, 4.8, WHITE);
  kit.block(tx, 0, 8.4, 8.4, 0.4, M_GREEN, 4.8);
  archDoor(kit, tx - 4, 0, 1.8, 3.2, 0, M_GREEN);
  archDoor(kit, tx - 4.02, 0, 1.4, 2.8, 0);
  kit.cylinder(tx, 0, 3, 1, WHITE, 5.2, 14);
  onion(kit, tx, 0, 3.1, 6.2, DOME_GREEN, 1.3, 14);
  for (const [cx, cz] of [[-3.8, -3.8], [-3.8, 3.8], [3.8, -3.8], [3.8, 3.8]]) {
    kit.cylinder(tx + cx, cz, 0.35, 6.2, WHITE, 0, 8);
    onion(kit, tx + cx, cz, 0.45, 6.2, DOME_GREEN, 1.3, 8, false);
  }
  kit.light(tx, 6.2 + 3.1 * 1.3 * 1.6 + 1, 0, 0x9dffb0);
  kit.light(tx - 4.3, 3.6, 0, 0x9dffb0);

  // flags on bamboo poles round the tomb
  const flags = [M_GREEN, RED, M_GREEN, RED];
  [[11.5, -6], [11.5, 6], [23, -6], [23, 6]].forEach(([fx, fz], i) => {
    kit.cylinder(fx, fz, 0.07, 8, 0xb59a5a, 0, 5);
    kit.add(box(0.04, 1, 1.6), flags[i], fx, 7.4, fz + 0.85);
  });
  kit.bunting(1.2, -2, tx - 4, -4, 4.2, [M_GREEN, RED, 0xffd166]);
  kit.bunting(1.2, 2, tx - 4, 4, 4.2, [M_GREEN, RED, 0xffd166]);

  // the old banyan with hanging roots
  const bx = 25;
  const bz = -10;
  kit.cylinder(bx, bz, 0.9, 4.5, 0x5b4027, 0, 8, 0.7);
  kit.add(ico(4.2), 0x3f6f2a, bx, 6.2, bz, [0, 0, 0], [1.2, 0.7, 1.1]);
  kit.add(ico(3), 0x4f8132, bx - 2.5, 5.4, bz + 2.2, [0, 0, 0], [1.1, 0.7, 1]);
  for (const [rx, rz] of [[-2.8, -1.5], [2.5, 1.4], [-1, 3], [1.8, -2.6]]) kit.cylinder(bx + rx, bz + rz, 0.09, 4.3, 0x6b5030, 0, 4);
  // the pond and the flower/candle stalls by the gate
  pond(kit, 23, 10, 9, 7, WHITE);
  for (const sz of [-9, -5]) {
    for (const [px, pz] of [[3, -1.2], [3, 1.2], [6, -1.2], [6, 1.2]]) kit.cylinder(px, sz + pz, 0.05, 2.4, 0x8f7a45, 0, 4);
    kit.add(box(3.6, 0.08, 3), TIN, 4.5, 2.5, sz, [0, 0, 0.12]);
    kit.block(4.2, sz, 1.6, 2.2, 0.8, WOOD);
    kit.block(4.2, sz, 1.4, 2, 0.12, kit.rng() < 0.5 ? 0xe63946 : 0xffd166, 0.8);
  }
  crowd(kit, 8, 3, 13, -4, 4, [MUSALLI, MEN[1], MEN[2], SARIS[2]]);
  kit.person(12, -3, FACE_ROAD, { shirt: M_GREEN, lower: M_GREEN, lungi: true });
}

// ---------------------------------------------------------------- memorial and heritage

function monument(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit);
  kit.ground(7, 0, 14, 4, PAVE);
  for (const sz of [-1, 1]) {
    kit.ground(8, sz * 8, 7, 8, BANK);
    kit.water(8, sz * 8, 6, 7);
  }
  // the stepped red-brick plinth
  kit.block(24, 0, 22, 30, 0.6, BRICK);
  kit.block(25, 0, 17, 22, 0.6, BRICK, 0.6);
  kit.block(26, 0, 12, 15, 0.6, BRICK_DARK, 1.2);
  for (let i = 0; i < 4; i++) kit.block(13.4 + i * 0.85, 0, 0.85, 7, 0.3 * (i + 1), BRICK);
  for (let i = 0; i < 2; i++) kit.block(18.8 + i * 0.6, 0, 0.6, 5, 1.2 + 0.3 * (i + 1), BRICK);
  for (const [fx, fz] of [[15, -12], [15, 12], [34, -12], [34, 12]]) kit.block(fx, fz, 2.4, 2.4, 0.4, 0xc0392b, 0.6);

  if (kit.rng() < 0.5) {
    shaheedMinar(kit, 27, 0, 1.6);
  } else {
    // a stylised memorial of nested triangular planes, the tallest at the back
    for (let i = 0; i < 5; i++) triPlane(kit, 23 + i * 1.4, 0, 13 - i * 2.3, 6 + i * 3.2, 0.4, i % 2 ? 0xd8d4cc : 0xe9e6df, 1.8);
  }
  kit.light(21, 2.2, -4, LAMP);
  kit.light(21, 2.2, 4, LAMP);
  kit.flag(15, -hz + 6, 10);
  for (let x = 6; x < D - 2; x += 8) {
    kit.tree(x, -hz + 3, 0.8, kit.rng() < 0.5 ? 0xd8452c : 0x3f6f2a);
    kit.tree(x, hz - 3, 0.8, kit.rng() < 0.5 ? 0xd8452c : 0x3f6f2a);
  }
  crowd(kit, 5, 4, 18, -10, 10, [...STUDENTS, MEN[1]]);
}

function ruins(kit: LKit): void {
  const L = kit.length;
  const hz = L / 2;
  lawn(kit, GRASS);
  // earth mounds not yet dug
  kit.add(ico(1, 1), 0x7f8f4a, 46, 0, hz - 9, [0, 0, 0], [7, 2.2, 6]);
  kit.add(ico(1, 1), 0x8a8a50, 8, 0, -hz + 8, [0, 0, 0], [5, 1.6, 6]);

  // the vihara: brick cells round a square courtyard, entrance from the road side
  const x0 = 12;
  const x1 = 48;
  const z0 = -18;
  const z1 = 18;
  const cell = 4;
  kit.ground((x0 + x1) / 2, 0, x1 - x0, z1 - z0, 0xa58a62, 0.03);
  kit.ground((x0 + x1) / 2, 0, x1 - x0 - 2 * cell, z1 - z0 - 2 * cell, 0x8faa5a, 0.05);
  const w = (ax: number, az: number, bx: number, bz: number, h: number) => kit.wall(ax, az, bx, bz, h, BRICK, 1.2);
  w(x0, z0, x0, -2.5, 1.3);
  w(x0, 2.5, x0, z1, 1.3);
  w(x1, z0, x1, z1, 1.3);
  w(x0, z0, x1, z0, 1.3);
  w(x0, z1, x1, z1, 1.3);
  const i0 = x0 + cell;
  const i1 = x1 - cell;
  kit.wall(i0, z0 + cell, i0, -2.5, 0.9, BRICK, 0.8);
  kit.wall(i0, 2.5, i0, z1 - cell, 0.9, BRICK, 0.8);
  kit.wall(i1, z0 + cell, i1, z1 - cell, 0.9, BRICK, 0.8);
  kit.wall(i0, z0 + cell, i1, z0 + cell, 0.9, BRICK, 0.8);
  kit.wall(i0, z1 - cell, i1, z1 - cell, 0.9, BRICK, 0.8);
  for (let z = z0 + cell + 3; z < z1 - cell; z += 3) {
    if (Math.abs(z) < 3) continue;
    kit.wall(x0, z, i0, z, 0.8 + kit.rng() * 0.3, BRICK_DARK, 0.6);
    kit.wall(i1, z, x1, z, 0.8 + kit.rng() * 0.3, BRICK_DARK, 0.6);
  }
  for (let x = i0 + 3; x < i1; x += 3) {
    kit.wall(x, z0, x, z0 + cell, 0.8 + kit.rng() * 0.3, BRICK_DARK, 0.6);
    kit.wall(x, z1 - cell, x, z1, 0.8 + kit.rng() * 0.3, BRICK_DARK, 0.6);
  }
  // the cruciform central shrine with the stupa base on top
  const cx = 30;
  kit.block(cx, 0, 11, 4.5, 1.6, BRICK);
  kit.block(cx, 0, 4.5, 11, 1.6, BRICK);
  kit.block(cx, 0, 6.5, 6.5, 1.2, BRICK_DARK, 1.6);
  kit.cylinder(cx, 0, 2.3, 0.8, BRICK, 2.8, 12);
  kit.dome(cx, 0, 2.3, 0x7f8f4a, 3.6, 0.45, 12);
  // votive stupa bases outside
  for (const [vx, vz] of [[52, -24], [52, -14], [6, 24]]) {
    kit.block(vx, vz, 3, 3, 0.6, BRICK);
    kit.cylinder(vx, vz, 1.1, 0.7, BRICK_DARK, 0.6, 10);
  }
  // the archaeology department board (lettering left blank)
  for (const sz of [-1.1, 1.1]) kit.block(3, -10 + sz, 0.12, 0.12, 2.6, 0x555555);
  kit.add(box(0.1, 1.5, 2.6), WHITE, 3, 2.0, -10);
  kit.add(box(0.12, 1.3, 2.4), 0x1f4f8a, 3, 2.0, -10);
  kit.ground(6, 0, 12, 3, 0xa58a62);
  for (const [tx, tz] of [[4, 20], [51, 27], [51, -6], [20, -28], [36, 29], [51, 12]]) kit.tree(tx, tz, 0.9 + kit.rng() * 0.3);
  crowd(kit, 6, 8, 46, -14, 14, [...STUDENTS, MEN[3]]);
}

function cemetery(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const war = kit.rng() < 0.6;
  lawn(kit, war ? LAWN : GRASS);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 2, war ? 0xd9cfb8 : WHITE, 0, 5);
  kit.ground(20, 0, 38, 3, war ? 0xd9cfb8 : EARTH);

  if (war) {
    // the stone entrance pavilion
    for (const s of [-1, 1]) kit.block(2.5, s * 4.5, 4, 4, 3.8, 0xd9cfb8);
    kit.block(2.5, 0, 4.4, 13.2, 0.7, 0xc9bfa6, 3.8);
    kit.block(2.5, 0, 3.4, 5, 0.15, 0xc9bfa6, 3.4);
    // rows of white headstones
    for (let x = 10; x <= 34; x += 3) {
      for (const s of [-1, 1]) {
        for (let z = 3.5; z < hz - 3; z += 3) kit.block(x, s * z, 0.14, 0.6, 0.85, 0xeeeae2);
      }
      for (const s of [-1, 1]) kit.ground(x - 0.6, s * (hz / 2 + 1), 0.5, hz - 6, 0xc0392b, 0.06);
    }
    // the cross of sacrifice
    const cx = 39.5;
    kit.cylinder(cx, 0, 2.4, 0.4, 0xd9cfb8, 0, 8);
    kit.cylinder(cx, 0, 1.8, 0.4, 0xd9cfb8, 0.4, 8);
    kit.cylinder(cx, 0, 1.2, 0.4, 0xd9cfb8, 0.8, 8);
    kit.block(cx, 0, 0.5, 0.5, 7, WHITE, 1.2);
    kit.block(cx, 0, 0.4, 2.6, 0.45, WHITE, 6);
  } else {
    // a village kabarstan: green arch gate, earth graves, some tiled, a few fenced with bamboo
    gatePosts(kit, 0.8, 0, 3.4, 3.4, WHITE, M_GREEN);
    archRing(kit, 0.8, 0, 3.4, 3.4, M_GREEN, 0.3);
    for (let x = 9; x <= 38; x += 4) {
      for (const s of [-1, 1]) {
        for (let z = 4; z < hz - 3; z += 3.2) {
          const r = kit.rng();
          if (r < 0.2) continue;
          if (r < 0.4) kit.block(x, s * z, 2.3, 1.2, 0.3, WHITE);
          kit.add(box(2, 0.4, 0.9), r < 0.7 ? 0x7a6040 : 0x6f8f45, x, 0.2, s * z);
          if (r > 0.92) for (const fz of [-0.7, 0.7]) kit.add(box(2.6, 0.8, 0.08), 0xb59a5a, x, 0.4, s * z + fz);
        }
      }
    }
    for (const [bx, bz] of [[42, -20], [42, 20]]) for (let i = 0; i < 6; i++) kit.cylinder(bx + (i % 3) * 0.6, bz + Math.floor(i / 3) * 0.6, 0.08, 9 + i, 0x8fa04a, 0, 5);
  }
  kit.light(0.6, 3, -3, LAMP);
  kit.light(0.6, 3, 3, LAMP);
  for (let z = -hz + 4; z <= hz - 4; z += 10) kit.tree(D - 3.5, z, 0.9);
  kit.tree(4, -hz + 5, 0.9);
  kit.tree(4, hz - 5, 0.9);
  crowd(kit, 3, 6, 30, -2, 2, war ? STUDENTS : [MUSALLI]);
}

// ---------------------------------------------------------------- institutions

function university(kit: LKit): void {
  const L = kit.length;
  const hz = L / 2;
  const red = kit.rng() < 0.5;
  const body = red ? 0xa4502f : 0xeeeae0;
  const band = red ? 0x7f3622 : 0x9aa6a8;
  const win = red ? 0x2a2420 : 0x35566a;
  lawn(kit);
  // the gate: two massive pillars and a lintel, side pedestrian gates and a wall along the road
  const gate = red ? BRICK : 0xe6e2d8;
  kit.wall(1, -hz + 1, 1, -12.5, 2, gate, 0.5);
  kit.wall(1, 12.5, 1, hz - 1, 2, gate, 0.5);
  for (const s of [-1, 1]) {
    kit.block(3, s * 8, 2.4, 2.4, 11, gate);
    kit.block(3, s * 8, 2.8, 2.8, 0.5, WHITE, 11);
    kit.block(3, s * 12, 1.2, 1.2, 4.2, gate);
    kit.block(3, s * 10, 0.8, 4, 0.6, gate, 3.6);
  }
  kit.block(3, 0, 2, 18.4, 2, gate, 9.5);
  kit.block(2.0, 0, 0.1, 14, 1.2, WHITE, 9.9);
  triPlane(kit, 3, 0, 9, 2.4, 1.2, gate, 11.5);
  kit.light(1.6, 9, -6.6);
  kit.light(1.6, 9, 6.6);
  // the avenue
  kit.ground(17, 0, 30, 6, 0x6b6b66);
  for (let x = 8; x <= 28; x += 6) for (const s of [-1, 1]) kit.tree(x, s * 6.5, 0.85, kit.rng() < 0.3 ? 0xd8452c : 0x3f6f2a);
  // academic buildings
  building(kit, 34, -hz + 4, 12, 28, 5, body, { band, win, spacing: 2.8, lit: 3 });
  building(kit, 34, 8, 12, 28, 4, body, { band, win, spacing: 2.8, lit: 3 });
  building(kit, 49, -7, 9, 14, 3, body, { band, win, spacing: 2.8, lit: 1 });
  if (red) {
    for (const z of [-hz + 8, -hz + 18, 12, 22, 30]) kit.block(33.5, z, 1, 1.8, 16.5, BRICK_DARK);
  } else {
    verandah(kit, 34, 8, 36, 4, 3.3, body, WHITE, band);
  }
  // shaheed minar, a lawn, students
  shaheedMinar(kit, 22, -21, 1.1);
  kit.ground(22, 22, 18, 22, 0x7fb04f);
  for (const [tx, tz] of [[56, -hz + 5], [56, hz - 5], [30, hz - 4], [12, -hz + 6]]) kit.tree(tx, tz, 1);
  crowd(kit, 10, 5, 30, -4, 4, STUDENTS);
  for (let i = 0; i < 6; i++) kit.person(18 + (i % 3) * 1.4, 18 + Math.floor(i / 3) * 1.6, (i * 2.1) % 6.28, { ...STUDENTS[i % STUDENTS.length], seated: true });
}

function college(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const looks = [[0xe5c97a, WHITE], [0xb8573a, WHITE], [CREAM, 0xb8573a]];
  const [body, trim] = looks[Math.floor(kit.rng() * looks.length)];
  lawn(kit);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.8, body, -hz + 9, 6);
  gatePosts(kit, 0.8, -hz + 9, 6, 4.2, body, trim, true);
  kit.ground(14, -hz + 9, 26, 4, PAVE);
  // the playing field with goal posts
  kit.ground(14, 4, 18, 36, 0x8aab5a);
  for (const s of [-1, 1]) {
    for (const gz of [-1.8, 1.8]) kit.cylinder(14 + gz, s * 21.5, 0.06, 2.2, WHITE, 0, 4);
    kit.add(box(3.7, 0.1, 0.1), WHITE, 14, 2.2, s * 21.5);
  }
  // the colonial block: three storeys behind a long verandah, a pedimented portico in the middle
  const fh = 3.6;
  building(kit, 28, -24, 10, 48, 3, body, { fh, band: trim, spacing: 3, lit: 3 });
  verandah(kit, 28, -24, 24, 3, fh, body, trim, trim);
  kit.block(24.5, 0, 3, 8, 0.5, trim);
  for (const z of [-3.4, -1.1, 1.1, 3.4]) kit.cylinder(23.5, z, 0.32, 3 * fh, trim, 0.5, 10);
  kit.block(24.8, 0, 3.8, 8.6, 0.6, trim, 3 * fh);
  triPlane(kit, 24.8, 0, 9, 2.2, 3.8, body, 3 * fh + 0.6);
  kit.add(cyl(0.7, 0.7, 0.1, 14), WHITE, 22.85, 3 * fh + 1.3, 0, [0, 0, Math.PI / 2]);
  shaheedMinar(kit, 20, 23, 0.9);
  kit.flag(22, -6, 10);
  for (let z = -hz + 4; z <= hz - 4; z += 9) kit.tree(D - 3, z, 0.8);
  crowd(kit, 9, 6, 24, -20, 18, STUDENTS);
}

function cantonment(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const camo = [0x3b4a24, 0x6b5b3a, 0x2d3320, 0x5d6b3a];
  const wallCol = 0xe8dcb0;
  lawn(kit);
  kit.compound(1, -hz + 1, D - 1, hz - 1, 2.5, wallCol, 0, 10);
  for (const [a, b] of [[-hz + 1, -5], [5, hz - 1]]) kit.wall(1, a, 1, b, 0.35, 0x333333, 0.08, 2.5);
  // the camouflage gate with the emblem plate
  for (const s of [-1, 1]) {
    const pz = s * 6.2;
    kit.block(2.5, pz, 2, 2, 7.5, OLIVE);
    for (let i = 0; i < 7; i++) {
      const y = 0.5 + kit.rng() * 6.5;
      const c = camo[i % camo.length];
      if (i % 2) kit.add(box(0.06, 0.6 + kit.rng(), 0.9 + kit.rng()), c, 1.47, y, pz + (kit.rng() - 0.5) * 1.2);
      else kit.add(box(0.8 + kit.rng(), 0.7 + kit.rng(), 0.06), c, 2.5 + (kit.rng() - 0.5) * 1.1, y, pz - s * 1.03);
    }
  }
  kit.block(2.5, 0, 1.8, 14.4, 1.7, OLIVE, 7.5);
  for (let i = 0; i < 5; i++) kit.add(box(0.06, 0.6, 1.3), camo[i % 4], 1.57, 7.8 + (i % 2) * 0.8, -5.5 + i * 2.6);
  kit.add(cyl(1.2, 1.2, 0.12, 16), WHITE, 1.55, 8.35, 0, [0, 0, Math.PI / 2]);
  kit.add(cyl(0.9, 0.9, 0.12, 16), 0xb22222, 1.48, 8.35, 0, [0, 0, Math.PI / 2]);
  kit.add(cyl(0.45, 0.45, 0.12, 12), GOLD, 1.41, 8.35, 0, [0, 0, Math.PI / 2]);
  // boom barrier and sentry box
  for (let i = 0; i < 8; i++) kit.add(box(0.15, 0.15, 1.1), i % 2 ? WHITE : RED, 1.3, 1.0, -4.6 + i * 1.12);
  kit.block(1.3, -5.2, 0.5, 0.5, 1.0, 0x333333);
  kit.block(3, -10.5, 1.8, 1.8, 2.4, OLIVE);
  kit.add(box(0.06, 0.7, 1.2), DARK, 2.06, 1.7, -10.5);
  kit.block(3, -10.5, 2.4, 2.4, 0.2, camo[2], 2.4);
  kit.light(2, 2.2, -10.5, LAMP);
  kit.person(1.2, -3, FACE_ROAD, SOLDIER);
  kit.person(1.2, 3, FACE_ROAD, SOLDIER);
  kit.person(3, -9, FACE_ROAD, SOLDIER);
  // the drive with black-and-white kerbs and white-banded trees
  kit.ground(16, 0, 28, 6, 0x6b6b66);
  for (let x = 4; x < 30; x += 1.3) {
    for (const s of [-1, 1]) kit.add(box(1.0, 0.25, 0.3), Math.round(x / 1.3) % 2 ? WHITE : 0x222222, x, 0.13, s * 3.2);
  }
  for (let x = 8; x <= 28; x += 5) {
    for (const s of [-1, 1]) {
      kit.tree(x, s * 7, 0.8);
      kit.cylinder(x, s * 7, 0.36, 1, WHITE, 0, 6);
    }
  }
  // a tank on a plinth, gun to the road
  const tz = -16;
  kit.block(16, tz, 5, 7.5, 1.2, WHITE);
  kit.block(16, tz, 5.1, 7.6, 0.25, 0x222222, 0.95);
  for (const s of [-1, 1]) kit.block(16 + s * 1.5, tz, 0.7, 6.4, 0.9, 0x2a2a24, 1.2);
  kit.block(16, tz, 3.2, 6.2, 1.0, OLIVE, 1.6);
  kit.block(16.2, tz, 2.2, 2.8, 0.85, OLIVE, 2.6);
  kit.add(cyl(0.12, 0.14, 4, 8), 0x3a4422, 13.2, 3.05, tz, [0, 0, Math.PI / 2]);
  // barracks
  const bar = 0xe8d9a8;
  building(kit, 31, -hz + 4, 8, 24, 2, bar, { band: 0x8a5a3a, spacing: 3.2, lit: 2 });
  building(kit, 31, 7, 8, 24, 2, bar, { band: 0x8a5a3a, spacing: 3.2, lit: 2 });
  building(kit, 41, -10, 7, 20, 2, bar, { band: 0x8a5a3a, spacing: 3.2, lit: 1 });
  kit.flag(20, 9, 11);
  kit.light(1.4, 8.5, -6.2, LAMP);
  kit.light(1.4, 8.5, 6.2, LAMP);
}

function govtBuilding(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const body = kit.rng() < 0.5 ? 0xf0e6cc : WHITE;
  lawn(kit);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.8, WHITE, -10, 7);
  gatePosts(kit, 0.8, -10, 7, 2.6, WHITE, 0x8a8a84);
  kit.ground(9, -10, 16, 6, PAVE);
  kit.ground(14.5, -2, 5, 16, PAVE);
  const fh = 3.4;
  const h = building(kit, 18, -18, 12, 36, 4, body, { fh, band: 0xbfae8a, spacing: 2.8, lit: 4 });
  kit.block(16.5, 0, 3, 10, h + 1.5, body);
  kit.windows(15, -4, 4, 0, 4, fh, DARK, 2.6);
  kit.block(13.5, 0, 3.6, 7, 0.3, body, 3.8);
  for (const z of [-3.2, 3.2]) kit.cylinder(12, z, 0.25, 3.8, WHITE, 0, 8);
  kit.flag(8, 2, 10);
  vehicle(kit, 13, -12, WHITE);
  vehicle(kit, 13, -7, 0x2a2a2a);
  kit.palm(4, 10, 0.9);
  kit.palm(4, 16, 0.9);
  kit.tree(35, hz - 4, 0.9);
  kit.tree(35, -hz + 4, 0.9);
  crowd(kit, 4, 10, 16, -6, 6, [MEN[3], MEN[0], MEN[1]]);
}

function jail(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const wallCol = kit.rng() < 0.5 ? 0xa3553a : 0xd9c59a;
  const x0 = 5;
  const x1 = D - 3;
  const z0 = -hz + 2;
  const z1 = hz - 2;
  const H = 6.5;
  kit.ground(D / 2, 0, D, L, 0x9c9a8a, 0.02);
  kit.ground((x0 + x1) / 2, 0, x1 - x0, z1 - z0, 0x7f9a52, 0.03);
  // the high plain wall with a strand of wire on top
  kit.wall(x0, z0, x0, -7, H, wallCol, 0.7);
  kit.wall(x0, 7, x0, z1, H, wallCol, 0.7);
  kit.wall(x1, z0, x1, z1, H, wallCol, 0.7);
  kit.wall(x0, z0, x1, z0, H, wallCol, 0.7);
  kit.wall(x0, z1, x1, z1, H, wallCol, 0.7);
  for (const [a, b] of [[z0, -7], [7, z1]]) kit.wall(x0, a, x0, b, 0.12, 0x333333, 0.12, H + 0.35);
  // the gate block
  kit.block(x0, 0, 7, 14, 9, wallCol);
  kit.block(x0, 0, 7.4, 14.4, 0.6, WHITE, 9);
  kit.add(box(0.12, 4.6, 4.2), 0x2b2b2b, x0 - 3.55, 2.3, 0);
  kit.add(box(0.12, 2.2, 1.0), 0x2b2b2b, x0 - 3.55, 1.1, -4);
  kit.add(box(0.1, 0.9, 7), WHITE, x0 - 3.55, 6.4, 0);
  kit.windows(x0 - 3.5, -7, 7, 7.2, 1, 1.6, DARK, 2.8, 1, 0.9);
  kit.light(x0 - 3.7, 5.2, -2.6, LAMP);
  kit.light(x0 - 3.7, 5.2, 2.6, LAMP);
  // watchtowers
  for (const [tx, tz] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1], [x0, -22], [x0, 22]]) {
    kit.block(tx, tz, 2, 2, 9, wallCol);
    kit.block(tx, tz, 3.2, 3.2, 2.2, CREAM, 9);
    kit.add(box(3.3, 0.8, 3.3), DARK, tx, 10.3, tz);
    hipRoof(kit, tx, tz, 3.8, 3.8, 1.2, 0x3d5a3a, 11.2);
    kit.light(tx - 1.7, 10.3, tz, 0xfff8e0);
  }
  // blocks behind the wall, the upper floors showing
  const inner = kit.rng() < 0.5 ? 0xc96a4a : CREAM;
  building(kit, 14, -30, 10, 20, 3, inner, { spacing: 3, lit: 1 });
  building(kit, 14, 10, 10, 20, 3, inner, { spacing: 3, lit: 1 });
  building(kit, 30, -20, 14, 40, 4, inner, { spacing: 3, lit: 2 });
  building(kit, 48, -30, 7, 60, 2, inner, { spacing: 4, lit: 0 });
  // guards and the visitors' queue
  kit.person(1.6, -2.6, FACE_ROAD, KHAKI);
  kit.person(1.6, 2.6, FACE_ROAD, KHAKI);
  for (let i = 0; i < 9; i++) kit.person(2.4 + (i % 2) * 0.4, 8 + i * 1.1, 0, i % 3 ? MEN[i % MEN.length] : SARIS[i % SARIS.length]);
}

function hospital(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit, GRASS);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.8, WHITE, -12, 9);
  gatePosts(kit, 0.8, -12, 9, 3, WHITE, 0x2a7ab0);
  kit.ground(12, -4, 22, 30, PAVE);
  // the main block: seven storeys with window bands and a central stair tower carrying the red crescent
  const fh = 3.4;
  building(kit, 22, -24, 14, 48, 7, 0xf4f4f0, { fh, band: 0xc8d4d8, win: 0x3d6b7a, ribbon: true, lit: 6 });
  kit.block(21, 0, 2, 6, 7 * fh + 2.5, 0xeae6da);
  kit.block(20.0, 0, 0.1, 4.4, 4.4, WHITE, 7 * fh - 3);
  kit.add(cyl(1.6, 1.6, 0.12, 18), RED, 19.9, 7 * fh - 0.8, 0, [0, 0, Math.PI / 2]);
  kit.add(cyl(1.35, 1.35, 0.12, 18), WHITE, 19.8, 7 * fh - 0.65, 0.55, [0, 0, Math.PI / 2]);
  kit.light(19.6, 7 * fh + 2.8, 0, 0xff3030);
  // the emergency porch with a red plus
  kit.block(17.5, 12, 6, 9, 0.4, WHITE, 4);
  for (const [px, pz] of [[15, 8], [15, 16]]) kit.cylinder(px, pz, 0.25, 4, WHITE, 0, 8);
  kit.add(box(0.1, 1.6, 0.45), RED, 14.45, 5.4, 12);
  kit.add(box(0.1, 0.45, 1.6), RED, 14.45, 5.4, 12);
  kit.light(14.3, 4.2, 12, LAMP);
  // ambulances
  for (const az of [8, 12.5, 17]) {
    const ax = az === 12.5 ? 17.5 : 11;
    kit.block(ax, az, 2, 5, 2, WHITE, 0.35);
    kit.block(ax, az, 2.04, 5.04, 0.3, RED, 1.2);
    kit.block(ax, az - 2.1, 1.8, 0.1, 0.8, 0x2a3640, 1.3);
    kit.block(ax, az - 1.6, 1.2, 0.4, 0.2, 0x2a6ad8, 2.35);
    kit.light(ax, 2.6, az - 1.6, 0x4a8aff);
    for (const sx of [-0.8, 0.8]) for (const sz of [-1.6, 1.6]) kit.add(cyl(0.35, 0.35, 0.25, 8), 0x1d1d1d, ax + sx, 0.35, az + sz, [0, 0, Math.PI / 2]);
  }
  // the crowd at the gate and tea stalls outside
  crowd(kit, 14, 1.5, 9, -18, -6, [...MEN, ...SARIS]);
  for (const sz of [-24, -21]) {
    kit.block(3, sz, 2, 2.5, 2.2, 0x8a6a4a);
    kit.add(box(2.8, 0.08, 3), TIN, 2.8, 2.35, sz, [0, 0, 0.12]);
  }
  kit.tree(5, 20, 0.9);
  kit.tree(41, -hz + 4, 0.8);
  kit.tree(41, hz - 4, 0.8);
}

function museum(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit);
  kit.compound(0.8, -hz + 0.8, D - 0.8, hz - 0.8, 1.6, WHITE, 0, 5);
  gatePosts(kit, 0.8, 0, 5, 3, WHITE, 0x8a8a84);
  kit.ground(9, 0, 16, 3, PAVE);
  // a fountain and an old cannon on the lawn
  kit.cylinder(9, -9, 2.5, 0.6, WHITE, 0, 16);
  kit.add(cyl(2.3, 2.3, 0.05, 16), 0x3f7f95, 9, 0.62, -9);
  kit.cylinder(9, -9, 0.3, 1.8, WHITE, 0.6, 8);
  kit.cylinder(9, -9, 0.9, 0.2, WHITE, 2.2, 10);
  kit.block(11, 9, 1.2, 2, 0.8, WOOD);
  kit.add(cyl(0.22, 0.32, 3, 10), 0x2b2b2b, 10.6, 1.05, 9, [0, 0, Math.PI / 2 - 0.12]);

  if (kit.rng() < 0.7) {
    // a zamindari-era palace turned museum: two storeys behind a giant colonnade, a pediment and a dome
    const cols = [0xd9a5a0, 0xe8d8a8, 0xf2efe6];
    const body = cols[Math.floor(kit.rng() * cols.length)];
    const fh = 4.5;
    kit.block(27, 0, 10, 32, 2 * fh, body);
    kit.block(27, 0, 10.4, 32.4, 1.0, WHITE, 2 * fh);
    kit.add(box(10.3, 0.3, 32.3), WHITE, 27, fh, 0);
    for (let f = 0; f < 2; f++) for (let z = -13.5; z <= 13.5; z += 3) archDoor(kit, 22, z, 1.4, 3, f * fh + 0.4);
    kit.block(21, 0, 2.4, 32, 0.4, WHITE);
    for (let z = -15; z <= 15; z += 2.5) kit.cylinder(20.3, z, 0.38, 2 * fh, WHITE, 0.4, 10);
    kit.block(21, 0, 2.6, 32.2, 0.8, WHITE, 2 * fh + 0.2);
    // central portico with pediment and the grand steps
    kit.block(18.5, 0, 3.4, 10, 1.2, WHITE);
    for (const z of [-4, -1.4, 1.4, 4]) kit.cylinder(17.4, z, 0.45, 2 * fh, WHITE, 1.2, 10);
    kit.block(18.8, 0, 4, 10.6, 1, WHITE, 2 * fh + 1.2);
    triPlane(kit, 18.8, 0, 11, 2.8, 4, body, 2 * fh + 2.2);
    for (let i = 0; i < 4; i++) kit.block(16.3 - i * 0.6, 0, 0.6, 8, 1.2 - i * 0.3, WHITE);
    if (kit.rng() < 0.6) {
      kit.cylinder(27, 0, 3, 2, body, 2 * fh + 1, 14);
      onion(kit, 27, 0, 3.1, 2 * fh + 3, body, 1.15, 14, false);
      kit.add(cyl(0.05, 0.1, 1.8, 5), GOLD, 27, 2 * fh + 3 + 3.1 * 1.15 * 1.62 + 0.9, 0);
    }
  } else {
    // a modern museum: concrete block, a glass band, a cantilevered entrance canopy
    kit.block(27, 0, 14, 30, 10, 0xc8c4bb);
    kit.add(box(0.1, 3, 24), 0x35566a, 19.95, 5.5, 0);
    kit.block(18, 0, 4, 12, 0.5, 0xc8c4bb, 4);
    kit.block(26, -4, 6, 10, 4, 0xb0aca2, 10);
    kit.add(box(0.1, 1.2, 1.2), DARK, 19.95, 1.6, 0);
    kit.add(ico(1.2), 0x8a6a4a, 9, 3, 5, [0.3, 0.5, 0], [1, 1.6, 0.6]);
  }
  kit.light(19, 2, -3, LAMP);
  kit.light(19, 2, 3, LAMP);
  for (const [tx, tz] of [[5, -hz + 4], [5, hz - 4], [36, -hz + 4], [36, hz - 4]]) kit.tree(tx, tz, 0.9);
  crowd(kit, 5, 4, 16, -6, 6, STUDENTS);
}

// ---------------------------------------------------------------- green places

function park(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit);
  for (const [a, b] of [[-hz + 1, -7.5], [7.5, hz - 1]]) kit.wall(1, a, 1, b, 1.1, 0x3f7a2c, 0.25);
  // the decorative gate: two pillars dressed as tree trunks, a bright arch
  for (const s of [-1, 1]) {
    kit.cylinder(2, s * 6.5, 0.9, 6.5, 0x6b4a2a, 0, 8, 0.75);
    kit.add(ico(1.7), 0x3f7a2c, 2, 7.2, s * 6.5);
    kit.add(ico(1.2), 0x4f8f32, 2.4, 8.2, s * 6.8);
    kit.block(2.2, s * 9.5, 2.2, 0.6, 1.0, WHITE);
    kit.block(2.2, s * 9.5, 0.6, 1.4, 0.9, 0xc9a26a, 1.0);
    kit.ball(2.2, 2.2, s * 9.5 - 0.6, 0.3, 0xc9a26a, 6);
  }
  archRing(kit, 2, 0, 12, 5.2, SAFFRON, 0.5);
  kit.add(box(0.2, 1.2, 9), 0x2a9d8f, 1.5, 9.4, 0);
  kit.light(1.6, 5.8, -6.5, LAMP);
  kit.light(1.6, 5.8, 6.5, LAMP);
  // ticket booth
  kit.block(4, -12.5, 2.5, 2.5, 2.4, 0xe9b824);
  hipRoof(kit, 4, -12.5, 3.2, 3.2, 1.2, ROOF_RED, 2.4);
  kit.add(box(0.06, 0.8, 1.2), DARK, 2.7, 1.5, -12.5);
  kit.ground(11, 0, 20, 3, PAVE);

  // the lake with its curved footbridge
  const lx = 33;
  const lz = 4;
  kit.add(cyl(1, 1, 0.06, 28), BANK, lx, 0.04, lz, [0, 0, 0], [13.5, 1, 23.5]);
  kit.add(cyl(1, 1, 0.05, 28), 0x3f7f95, lx, 0.07, lz, [0, 0, 0], [12, 1, 22]);
  const n = 12;
  const bx0 = lx - 14;
  const span = 28;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const y0 = Math.sin(t0 * Math.PI) * 3.2;
    const y1 = Math.sin(t1 * Math.PI) * 3.2;
    const seg = Math.hypot(span / n, y1 - y0);
    const a = Math.atan2(y1 - y0, span / n);
    const mx = bx0 + ((t0 + t1) / 2) * span;
    const my = (y0 + y1) / 2 + 0.3;
    kit.add(box(seg + 0.05, 0.2, 2.2), 0x8a6a4a, mx, my, lz, [0, 0, a]);
    for (const s of [-1, 1]) kit.add(box(seg + 0.05, 0.1, 0.1), RED, mx, my + 1, lz + s * 1.05, [0, 0, a]);
    for (const s of [-1, 1]) kit.add(box(0.1, 1, 0.1), RED, bx0 + t0 * span, y0 + 0.8, lz + s * 1.05);
  }
  // swan boats
  for (const [sx, sz] of [[30, -10], [38, 16]]) {
    kit.add(box(1.5, 0.6, 2.2), WHITE, sx, 0.35, sz);
    kit.add(cyl(0.12, 0.16, 1.4, 6), WHITE, sx, 1.2, sz - 1, [-0.3, 0, 0]);
    kit.ball(sx, 1.9, sz - 1.25, 0.25, WHITE, 6);
    kit.add(cone(0.08, 0.3, 4), SAFFRON, sx, 1.85, sz - 1.5, [-Math.PI / 2, 0, 0]);
  }
  // a round gazebo, benches and trees
  const gx = 46;
  const gz = -24;
  kit.cylinder(gx, gz, 3, 0.4, WHITE, 0, 12);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    kit.cylinder(gx + Math.sin(a) * 2.5, gz + Math.cos(a) * 2.5, 0.15, 2.8, WHITE, 0.4, 6);
  }
  kit.spire(gx, gz, 3.4, 2, ROOF_RED, 3.2, 12);
  for (const [bx, bz] of [[18, -12], [18, 20], [48, -6], [48, 14], [26, 28], [40, 29]]) bench(kit, bx, bz);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const tx = lx + Math.cos(a) * 17;
    const tz = lz + Math.sin(a) * 27;
    if (tx < 8 || tx > D - 3 || Math.abs(tz) > hz - 3) continue;
    if (i % 4 === 0) kit.palm(tx, tz, 0.9);
    else kit.tree(tx, tz, 0.8 + kit.rng() * 0.3, i % 3 === 0 ? 0xd8452c : 0x3f6f2a);
  }
  for (const [fx, fz] of [[8, -6], [8, 6], [14, -6], [14, 6]]) kit.block(fx, fz, 2.4, 1.4, 0.35, 0xe63946);
  crowd(kit, 10, 4, 22, -8, 26, [...SARIS, ...STUDENTS]);
  for (let i = 0; i < 3; i++) personAt(kit, lx - 3 + i * 1.5, 3.4, lz + (i - 1) * 0.5, i * 1.3, STUDENTS[i]);
}

function forest(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  kit.ground(D / 2, 0, D, L, 0x6f6440, 0.02);
  kit.ground(D / 2, 0, D, 6, 0x9a7b55, 0.04);
  // the forest-department gate: timber posts, a small green roof, a board and a barrier
  for (const s of [-1, 1]) kit.block(2, s * 4.2, 0.7, 0.7, 5, 0x6b4a2a);
  kit.block(2, 0, 0.6, 9.4, 0.6, 0x6b4a2a, 4.4);
  gableRoof(kit, 2, 0, 1.8, 9.4, 1.2, 0x2f5f2f, 5);
  kit.add(box(0.1, 1.2, 4.6), WHITE, 1.65, 3.6, 0);
  kit.add(box(0.12, 1.0, 4.4), 0x1f5f2f, 1.62, 3.6, 0);
  for (let i = 0; i < 6; i++) kit.add(box(0.12, 0.12, 1.2), i % 2 ? 0x222222 : 0xe9b824, 2.6, 1, -3.4 + i * 1.2);
  kit.person(1.4, -5.4, FACE_ROAD, { shirt: 0x3d5a2c, lower: 0x3d5a2c, cap: 0x2f4a22 });
  // the range office
  kit.block(9, 10, 6, 6, 3, CREAM);
  gableRoof(kit, 9, 10, 6, 6, 1.6, 0x2f5f2f, 3);
  kit.add(box(0.06, 1.8, 1), DARK, 5.95, 0.9, 10);
  kit.light(5.8, 2.6, 10, LAMP);
  kit.light(1.5, 4.2, 0, LAMP);

  // tall sal trees, close together, the canopy shading the floor
  for (let x = 6; x < D - 2; x += 6.2) {
    for (let z = -hz + 3; z < hz - 2; z += 6.2) {
      const jx = x + (kit.rng() - 0.5) * 3;
      const jz = z + (kit.rng() - 0.5) * 3;
      if (Math.abs(jz) < 4.5) continue;
      if (jx < 14 && jz > 5 && jz < 15) continue;
      if (kit.rng() < 0.1) continue;
      salTree(kit, jx, jz, 9 + kit.rng() * 5);
    }
  }
  for (let i = 0; i < 14; i++) {
    const bz = (kit.rng() < 0.5 ? -1 : 1) * (6 + kit.rng() * (hz - 8));
    kit.add(ico(0.9 + kit.rng() * 0.6), 0x4d6b2e, 4 + kit.rng() * (D - 6), 0.5, bz, [0, 0, 0], [1.4, 0.7, 1.4]);
  }
}

function teaGarden(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  const k = kit.k;
  // the gentle tilla mounds: flat at the road, along the estate path and round the factory
  const fx = 26;
  const fz = 34;
  const hgt = (x: number, z: number) => {
    const edge = smooth((x - 4) / 14) * smooth((hz - Math.abs(z)) / 12) * smooth((Math.abs(z) - 2.5) / 6);
    const fac = 1 - smooth((fx - x) / 6) * smooth((z - fz + 4) / 6);
    const h = 2.4 + 1.6 * Math.sin(x * 0.09 + 0.6) * Math.cos(z * 0.07) + Math.sin(z * 0.045 + x * 0.03);
    return Math.max(0, h) * edge * fac;
  };
  const terrain = new THREE.PlaneGeometry(D, L, 28, 48).rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hgt(D / 2 + k * pos.getX(i), pos.getZ(i)));
  terrain.computeVertexNormals();
  kit.add(terrain, 0x6f7f3a, D / 2, 0.03, 0);
  kit.ground(D / 2, 0, D, 4, EARTH, 0.05);

  // flat-topped tea bushes in neat rows over the mounds
  let row = 0;
  for (let x = 7; x < D - 2; x += 2.4, row++) {
    const zEnd = x < fx + 2 ? fz - 3 : hz - 3;
    for (const [a, b] of [[-hz + 3, -2.6], [2.6, zEnd]]) {
      const len = b - a;
      if (len < 3) continue;
      const zc = (a + b) / 2;
      const g = new THREE.BoxGeometry(1.5, 1.0, len, 1, 1, Math.ceil(len / 2.5));
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + hgt(x + k * p.getX(i), zc + p.getZ(i)));
      g.computeVertexNormals();
      kit.add(g, row % 2 ? 0x3c7a2a : 0x46852f, x, 0.5, zc);
    }
  }
  // tall Albizia shade trees
  for (let i = 0; i < 18; i++) {
    const x = 8 + kit.rng() * (D - 12);
    const z = -hz + 6 + kit.rng() * (L - 12);
    if (Math.abs(z) < 4 || (x < fx + 4 && z > fz - 6)) continue;
    albizia(kit, x, z, hgt(x, z), 0.9 + kit.rng() * 0.3);
  }
  // the factory: a long shed with a tin roof, the withering loft louvres, a chimney
  const sx = 13;
  const sz = 47;
  kit.block(sx, sz, 14, 20, 7, 0xe6dcc0);
  gableRoof(kit, sx, sz, 14, 20, 3, TIN, 7);
  for (let i = 0; i < 3; i++) kit.add(box(0.1, 0.35, 18), 0x5a5048, sx - 7.05, 4.2 + i * 0.8, sz);
  kit.add(box(0.1, 3, 3), DARK, sx - 7.05, 1.5, sz - 5);
  kit.cylinder(sx + 9, sz + 6, 0.7, 17, BRICK, 0, 10, 0.55);
  kit.light(sx + 9, 17.4, sz + 6, 0xff3030);
  kit.light(sx - 7.3, 3.4, sz - 5, LAMP);
  kit.ground(sx, fz + 2, 26, 4, EARTH, 0.05);
  // pluckers with baskets on their backs, among the rows and walking the path
  for (let i = 0; i < 10; i++) {
    const x = 8.2 + Math.floor(kit.rng() * 18) * 2.4;
    const z = (kit.rng() < 0.5 ? -1 : 1) * (6 + kit.rng() * (hz - 12));
    if (x < fx + 2 && z > fz - 4) continue;
    const y = hgt(x, z);
    const yaw = kit.rng() < 0.5 ? 0 : Math.PI;
    personAt(kit, x, y, z, yaw, SARIS[i % SARIS.length]);
    kit.add(cyl(0.38, 0.22, 0.6, 7), 0xb59a5a, x, y + 1.3, z + (yaw === 0 ? 0.32 : -0.32));
  }
  for (let i = 0; i < 4; i++) {
    const z = 0.8 - (i % 2) * 1.6;
    kit.person(10 + i * 7, z, i % 2 ? Math.PI / 2 : -Math.PI / 2, SARIS[i]);
    kit.add(cyl(0.38, 0.22, 0.6, 7), 0xb59a5a, 10 + i * 7 + (i % 2 ? 0.32 : -0.32), 1.3, z);
  }
}

function lake(kit: LKit): void {
  const L = kit.length;
  const D = kit.depth;
  const hz = L / 2;
  lawn(kit, GRASS);
  const lx = 33;
  const rx = 21;
  const rz = hz - 8;
  kit.add(cyl(1, 1, 0.06, 32), BANK, lx, 0.04, 0, [0, 0, 0], [rx + 1.8, 1, rz + 1.8]);
  kit.add(cyl(1, 1, 0.05, 32), 0x3f7f95, lx, 0.08, 0, [0, 0, 0], [rx, 1, rz]);
  // the viewing deck reaching over the water, with a little shade roof
  const dx = 15;
  for (const px of [11.5, 15, 18.5]) for (const pz of [-3.5, 3.5]) kit.cylinder(px, pz, 0.15, 1.2, WOOD, 0, 6);
  kit.block(dx, 0, 8, 8, 0.25, 0x9a7048, 1.0);
  kit.add(box(0.1, 0.9, 8), WOOD, dx + 4, 1.7, 0);
  for (const s of [-1, 1]) kit.add(box(8, 0.9, 0.1), WOOD, dx, 1.7, s * 4);
  for (let i = 0; i < 4; i++) kit.block(10.4 - i * 0.6, 0, 0.6, 2.4, 1.0 - i * 0.25, WOOD);
  for (const [px, pz] of [[12, -2.5], [12, 2.5], [15, -2.5], [15, 2.5]]) kit.cylinder(px, pz, 0.1, 2.6, WOOD, 1.25, 6);
  hipRoof(kit, 13.5, 0, 4.6, 6.4, 1.4, ROOF_RED, 3.85);
  kit.light(13.5, 3.6, 0, LAMP);
  for (let i = 0; i < 4; i++) personAt(kit, 15.5 + (i % 2) * 1.8, 1.25, -2 + i * 1.3, FACE_ROAD + Math.PI, i % 2 ? SARIS[i] : STUDENTS[i]);
  // country boats, one with its boatman
  nouka(kit, 36, -14, 7, 0.4);
  nouka(kit, 44, 10, 6.5, -0.9, 0.05, false);
  personAt(kit, 44 + Math.sin(-0.9) * 2.2, 0.55, 10 + Math.cos(-0.9) * 2.2, -0.9, MEN[1]);
  nouka(kit, 28, 22, 6, 1.4);
  // trees round the shore and benches
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tx = lx + Math.cos(a) * (rx + 4.5);
    const tz = Math.sin(a) * (rz + 4.5);
    if (tx < 8 || tx > D - 2 || Math.abs(tz) > hz - 2) continue;
    if (i % 3 === 0) kit.palm(tx, tz, 0.9);
    else kit.tree(tx, tz, 0.8 + kit.rng() * 0.4);
  }
  for (const [bx, bz] of [[8, -10], [8, 10], [7, -22], [7, 22]]) bench(kit, bx, bz);
  for (const z of [-16, 16]) kit.light(5, 3, z, LAMP);
  crowd(kit, 5, 3, 9, -26, 26, [...SARIS, ...MEN]);
}

export const GENERIC_CIVIC: Partial<Record<LandmarkKind, LandmarkModel>> = {
  mosque,
  madrasa,
  temple,
  buddhist,
  mazar,
  monument,
  ruins,
  cemetery,
  university,
  college,
  cantonment,
  govtBuilding,
  jail,
  hospital,
  museum,
  park,
  forest,
  teaGarden,
  lake,
};
