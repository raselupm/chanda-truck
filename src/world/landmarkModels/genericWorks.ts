// Generic roadside landmarks: works, transport and the odd roadside sight, drawn for any place of that kind.
// - powerPlant: a gas-fired combined cycle plant (Ashuganj / Meghnaghat / Bheramara): turbine hall, HRSG boxes
//   with slim steel stacks, an old red-and-white chimney, a switchyard with lattice pylons, red aviation lights
// - factory: a garment factory behind a boundary wall: gate and guard booth, a six-storey white block with blue
//   glass and black rooftop water tanks, sheds at the back, workers at the gate
// - cement: a river-bank cement plant (Muktarpur / Meghnaghat): grey silos, conveyor galleries, clinker sheds,
//   a jetty with a bulk lighter on the water strip at the back
// - sugarMill: an old BSFIC mill: tall red-brick chimney, rusty corrugated-iron sheds, cane carts and trolleys
// - coldStorage: a potato hima-gar: a tall windowless cream block with green bands, trucks loading jute sacks
// - brickKilns: two FCK kilns: oval mounds, tall tapered chimneys, stacks of red and green bricks
// - shipyard: Sitakunda ship-breaking: beached hulls cut open on the mud, scrap heaps, cranes, winches
// - gasField: a Bibiyana-style process plant: well heads, pipe racks, separators, tanks, a burning flare
// - oilDepot: white bunded tanks (Fatullah / Godnail), a loading gantry with tanker lorries
// - station: a Bangladesh Railway station: platform canopy, cream-and-red building, a train in BR colours
// - busTerminal: a counter shed and inter-district buses nose to the road
// - market: a bazaar of tin-roofed stalls, tarps and heaps of vegetables under a rain tree
// - hotel: a highway food stop (Food Village style): glass-front restaurant, buses in the car park, pole sign
// - airport: a regional airport: terminal, control tower, two planes on the apron, a lit runway at the back
// - riverGhat: a launch ghat: pontoon, a two-deck river launch, country boats, a tin ticket counter
// - bridgeView: a river at the back of the site with a PC-girder bridge crossing it, boats, a char
// - flyover: an elevated viaduct beside the road on T piers, ramps at both ends, cars on top
// - chattar: a roundabout with a white shapla sculpture in a garden ring, rickshaws and CNGs around it
// - gateSign: a painted তোরণ (gateway arch) over a side road
// - stadium: a district stadium: oval concrete galleries, a roofed pavilion, four floodlight towers
// Vehicles (bus, truck, tanker, car, CNG, rickshaw, boat, launch, ship, plane, coaches) are shared helpers below.

import * as THREE from 'three';
import type { LandmarkKind } from '../../config/landmarks';
import { box, cone, cyl, ico } from '../../utils/geometry';
import type { LandmarkModel, LKit, V3 } from './kit';

const HALF_PI = Math.PI / 2;
const GLASS = 0x26323b;
const TYRE = 0x1c1c1c;
const CONCRETE = 0xb8b5ae;
const ASPHALT = 0x4a4a4c;
const STEEL = 0x8a9096;
const RED_LIGHT = 0xff3020;
const BUS_LIVERY: [number, number][] = [
  [0xf2f2ee, 0x1f5fb4], [0x2e8b3e, 0xf2f2ee], [0xd8262f, 0xf6c445], [0xf2f2ee, 0xd8262f], [0x1f3c88, 0xf6c445], [0xf6a821, 0x2b2b2b],
];
const CAR_COLORS = [0xf2f2ee, 0xc8ccd0, 0x2b2b2b, 0x8a1f1f, 0x1f4f8a, 0x9aa0a6];
const TRUCK_CABS = [0xd8262f, 0x2a6fb5, 0xf6c445, 0x2e8b3e, 0xe8e8e2];

// ---------------------------------------------------------------- small helpers

const rnd = (kit: LKit, a: number, b: number) => a + kit.rng() * (b - a);
const pick = <T>(kit: LKit, arr: T[]): T => arr[Math.floor(kit.rng() * arr.length)];

type Put = (geo: THREE.BufferGeometry, color: number, lx: number, y: number, lz: number, rz?: number) => void;

/**
 * A local frame for a vehicle or vessel at (x, z) turned by yaw (0 = nose toward -z; π/2 = nose to the road).
 * lx is across, lz along it (front at -lz); rz turns a part round its own length axis before the yaw.
 */
function frame(kit: LKit, x: number, z: number, yaw = 0): { p: Put; w: (lx: number, y: number, lz: number) => V3 } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const w = (lx: number, y: number, lz: number): V3 => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  const p: Put = (geo, color, lx, y, lz, rz = 0) => {
    const [wx, , wz] = w(lx, y, lz);
    kit.add(geo, color, wx, y, wz, [0, yaw, rz]);
  };
  return { p, w };
}

/** Euler (XYZ) that turns local +z toward the direction a → b, keeping the part upright. */
function aim(a: V3, b: V3): { len: number; r: V3 } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ'));
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return { len: Math.hypot(dx, dy, dz), r: [e.x, e.y, e.z] };
}

/** A box w wide, h deep, running from a to b (conveyor gallery, girder, boom, ramp). */
function beam(kit: LKit, a: V3, b: V3, w: number, h: number, color: number): void {
  const { len, r } = aim(a, b);
  kit.add(box(w, h, len), color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, r);
}

/** A round bar from a to b (pylon legs, pipes, cables, stays). */
function strut(kit: LKit, a: V3, b: V3, r: number, color: number, seg = 5): void {
  const { len, r: rot } = aim(a, b);
  kit.add(cyl(r, r, len, seg).rotateX(HALF_PI), color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, rot);
}

/** A ship's hull plan (pointed bow at -z when bow > 0), extruded h tall from y = 0. */
function hullGeo(w: number, len: number, h: number, bow: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -len / 2);
  s.lineTo(w / 2, -len / 2);
  s.lineTo(w / 2, len / 2 - bow);
  if (bow > 0) s.lineTo(0, len / 2);
  s.lineTo(-w / 2, len / 2 - bow);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }).rotateX(-HALF_PI);
}

/** A walled shed with a pitched corrugated roof, ridge along z: w across (x), d along the road. */
function shed(kit: LKit, x: number, z: number, w: number, d: number, h: number, wall: number, roof: number, pitch = 0.22): void {
  kit.block(x, z, w, d, h, wall);
  const rise = (w / 2) * Math.tan(pitch);
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2, 0);
  tri.lineTo(w / 2, 0);
  tri.lineTo(0, rise);
  tri.closePath();
  kit.add(new THREE.ExtrudeGeometry(tri, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), wall, x, h, z);
  const sw = w / 2 / Math.cos(pitch) + 0.5;
  kit.add(box(sw, 0.15, d + 0.8), roof, x - w / 4, h + rise / 2 + 0.1, z, [0, 0, pitch]);
  kit.add(box(sw, 0.15, d + 0.8), roof, x + w / 4, h + rise / 2 + 0.1, z, [0, 0, -pitch]);
}

/** An open canopy: posts every `step` along z on two lines, a flat roof slab sloping a little to the road. */
function canopy(kit: LKit, x: number, z: number, w: number, d: number, h: number, post: number, roof: number, step = 6): void {
  for (let zz = z - d / 2 + 0.4; zz <= z + d / 2; zz += step) {
    kit.block(x - w / 2 + 0.3, zz, 0.3, 0.3, h, post);
    kit.block(x + w / 2 - 0.3, zz, 0.3, 0.3, h + 0.4, post);
  }
  kit.add(box(w + 1, 0.15, d + 0.6), roof, x, h + 0.25, z, [0, 0, 0.05]);
}

/** Gate pillars with lamps and a little guard booth beside them. */
function gate(kit: LKit, x: number, z: number, w: number, pillar: number, leaf = 0x2a5a8a): void {
  for (const s of [-1, 1]) {
    kit.block(x, z + s * (w / 2 + 0.5), 1, 1, 3.2, pillar);
    kit.block(x, z + s * (w / 2 + 0.5), 1.2, 1.2, 0.25, 0xe8e2d0, 3.2);
    kit.ball(x, 3.75, z + s * (w / 2 + 0.5), 0.25, 0xfff2c4);
    kit.light(x, 3.8, z + s * (w / 2 + 0.5));
    // gate leaves, half open
    kit.add(box(0.1, 2, w / 2 - 0.2), leaf, x + 1.2, 1.1, z + s * (w / 2 - 0.3) - s * 0.2, [0, s * 0.9, 0]);
  }
  const bz = z + w / 2 + 3;
  kit.block(x + 2, bz, 2.4, 2.4, 2.6, 0xe8e2d0);
  kit.block(x + 2, bz, 3, 3, 0.2, 0x2a5a8a, 2.6);
  kit.add(box(0.08, 1, 1.4), GLASS, x + 0.78, 1.7, bz);
}

/** A tall stack (chimney): tapered cylinder, a coloured band and red aviation lights. */
function stack(kit: LKit, x: number, z: number, rb: number, rt: number, h: number, color: number, band?: number, seg = 12): void {
  kit.cylinder(x, z, rb, h, color, 0, seg, rt);
  if (band !== undefined) {
    const k = rb + (rt - rb) * 0.9;
    kit.cylinder(x, z, k + 0.05, h * 0.06, band, h * 0.88, seg);
  }
  kit.cylinder(x, z, rt * 1.12, 0.6, 0x3a3a3a, h - 0.3, seg);
  kit.light(x - rt - 0.1, h - 1, z, RED_LIGHT);
  kit.light(x, h * 0.55, z - rb - 0.1, RED_LIGHT);
}

/** A steel lattice transmission pylon, h tall, crossarms along z. */
function pylon(kit: LKit, x: number, z: number, h: number, color = STEEL): void {
  const b = h * 0.09;
  const t = h * 0.03;
  const at = (f: number) => b + (t - b) * f;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(kit, [x + sx * b, 0, z + sz * b], [x + sx * t, h * 0.95, z + sz * t], 0.14, color, 4);
  for (const f of [0.25, 0.5, 0.72]) {
    const hw = at(f);
    const y = h * 0.95 * f;
    kit.add(box(0.12, 0.12, hw * 2), color, x - hw, y, z);
    kit.add(box(0.12, 0.12, hw * 2), color, x + hw, y, z);
    kit.add(box(hw * 2, 0.12, 0.12), color, x, y, z - hw);
    kit.add(box(hw * 2, 0.12, 0.12), color, x, y, z + hw);
  }
  // cross bracing on the road face
  const lv = [0, 0.25, 0.5, 0.72];
  for (let i = 0; i < 3; i++) {
    const y0 = h * 0.95 * lv[i];
    const y1 = h * 0.95 * lv[i + 1];
    strut(kit, [x - at(lv[i]), y0, z - at(lv[i])], [x - at(lv[i + 1]), y1, z + at(lv[i + 1])], 0.07, color, 4);
    strut(kit, [x - at(lv[i]), y0, z + at(lv[i])], [x - at(lv[i + 1]), y1, z - at(lv[i + 1])], 0.07, color, 4);
  }
  for (const [f, span] of [[0.66, 0.3], [0.8, 0.26], [0.93, 0.2]] as const) {
    kit.add(box(0.3, 0.4, h * span), color, x, h * f, z);
    for (const s of [-1, 1]) kit.add(box(0.2, 1.4, 0.2), 0xd8d0c0, x, h * f - 0.9, z + s * h * span * 0.45);
  }
  kit.spire(x, z, t * 1.5, h * 0.1, color, h * 0.95, 4);
}

/** A white oil / water storage tank with a shallow cone roof, a band and a stair. */
function tank(kit: LKit, x: number, z: number, r: number, h: number, color = 0xf0f0ea, band?: number): void {
  kit.cylinder(x, z, r, h, color, 0, 16);
  kit.add(cone(r * 1.02, r * 0.22, 16), 0xdcdcd4, x, h + r * 0.11, z);
  if (band !== undefined) kit.cylinder(x, z, r + 0.04, h * 0.14, band, h * 0.62, 16);
  beam(kit, [x - r - 0.4, 0, z - r * 0.5], [x - r - 0.4, h, z + r * 0.5], 0.7, 0.15, 0x6a6e72);
}

/** A floodlight tower h tall, its lamp head turned to (fx, fz). */
function floodlight(kit: LKit, x: number, z: number, h: number, fx: number, fz: number): void {
  kit.add(cyl(0.35, 0.9, h, 4), 0x7d8288, x, h / 2, z, [0, Math.PI / 4, 0]);
  const yaw = Math.atan2(-(fz - z), fx - x);
  kit.add(box(0.5, 4, 6), 0x5a5e62, x, h + 1.6, z, [0, yaw, 0]);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (const t of [-2, 0, 2]) for (const yy of [-1, 1]) kit.light(x + c * 0.4 - s * t, h + 1.6 + yy, z - s * 0.4 - c * t, 0xffffff);
}

/** A street lamp on a pole with its light. */
function lamp(kit: LKit, x: number, z: number, h = 7, y0 = 0): void {
  kit.cylinder(x, z, 0.08, h, 0x8a8f94, y0, 6);
  kit.add(box(1.2, 0.12, 0.25), 0x8a8f94, x - 0.5, y0 + h, z);
  kit.light(x - 1, y0 + h - 0.15, z);
}

// ---------------------------------------------------------------- vehicles and vessels

/** An inter-district coach, 11 m, front at -lz. */
function bus(kit: LKit, x: number, z: number, yaw: number, body: number, stripe: number, y0 = 0): void {
  const { p } = frame(kit, x, z, yaw);
  p(box(2.5, 2.5, 11), body, 0, y0 + 1.7, 0);
  p(box(2.56, 0.95, 9.2), GLASS, 0, y0 + 2.4, 0.6);
  p(box(2.3, 1.2, 0.08), GLASS, 0, y0 + 2.35, -5.52);
  p(box(2.56, 0.4, 10.8), stripe, 0, y0 + 1.25, 0);
  p(box(2.3, 0.15, 10.6), 0xe8e8e2, 0, y0 + 3.0, 0);
  p(box(2.6, 0.3, 0.15), 0xd8d8d8, 0, y0 + 0.7, -5.55);
  for (const lz of [-3.6, 3.4]) for (const lx of [-1.15, 1.15]) p(cyl(0.5, 0.5, 0.35, 8), TYRE, lx, y0 + 0.5, lz, HALF_PI);
}

/** A Bangladeshi Tata-style truck with its painted wooden body, optionally loaded (tarp or sacks). */
function truck(kit: LKit, x: number, z: number, yaw: number, cab: number, load?: number, body = 0xc0662a): void {
  const { p } = frame(kit, x, z, yaw);
  p(box(2.3, 1.9, 1.9), cab, 0, 1.75, -2.9);
  p(box(2.1, 0.8, 0.08), GLASS, 0, 2.2, -3.86);
  p(box(2.4, 1.6, 5.0), body, 0, 1.75, 0.6);
  p(box(2.45, 0.25, 5.05), 0xf6c445, 0, 2.45, 0.6);
  if (load !== undefined) p(box(2.3, 0.8, 4.8), load, 0, 2.9, 0.6);
  for (const lz of [-2.8, 1.4, 2.5]) for (const lx of [-1.05, 1.05]) p(cyl(0.48, 0.48, 0.3, 8), TYRE, lx, 0.48, lz, HALF_PI);
}

/** A fuel tanker lorry. */
function tanker(kit: LKit, x: number, z: number, yaw: number, cab: number, shell = 0xe8e8e2): void {
  const { p } = frame(kit, x, z, yaw);
  p(box(2.3, 1.9, 1.9), cab, 0, 1.75, -2.9);
  p(box(2.1, 0.8, 0.08), GLASS, 0, 2.2, -3.86);
  p(box(1.6, 0.3, 5.4), 0x333333, 0, 0.9, 0.7);
  p(cyl(1.15, 1.15, 5.2, 12).rotateX(HALF_PI), shell, 0, 2.15, 0.75);
  p(box(0.6, 0.3, 3), 0x8a8f94, 0, 3.4, 0.75);
  for (const lz of [-2.8, 1.4, 2.5]) for (const lx of [-1.05, 1.05]) p(cyl(0.48, 0.48, 0.3, 8), TYRE, lx, 0.48, lz, HALF_PI);
}

/** A car (sedan / microbus look), y0 lets it sit on a flyover. */
function car(kit: LKit, x: number, z: number, yaw: number, color: number, y0 = 0): void {
  const { p } = frame(kit, x, z, yaw);
  p(box(1.6, 0.35, 3.6), TYRE, 0, y0 + 0.3, 0);
  p(box(1.75, 0.65, 4.3), color, 0, y0 + 0.75, 0);
  p(box(1.55, 0.55, 2.3), GLASS, 0, y0 + 1.35, 0.25);
  p(box(1.5, 0.08, 2.1), color, 0, y0 + 1.66, 0.25);
}

/** A green CNG auto-rickshaw. */
function cng(kit: LKit, x: number, z: number, yaw: number): void {
  const { p } = frame(kit, x, z, yaw);
  p(box(1.3, 0.8, 2.5), 0x2f8f3a, 0, 0.75, 0);
  p(box(1.35, 0.8, 1.9), 0x1f6d2a, 0, 1.55, 0.2);
  p(box(1.15, 0.55, 0.06), GLASS, 0, 1.5, -0.95);
  for (const [lx, lz] of [[0, -1.0], [-0.55, 0.8], [0.55, 0.8]]) p(cyl(0.28, 0.28, 0.16, 8), TYRE, lx, 0.28, lz, HALF_PI);
}

/** A cycle rickshaw with its painted hood. */
function rickshaw(kit: LKit, x: number, z: number, yaw: number): void {
  const { p } = frame(kit, x, z, yaw);
  const hood = pick(kit, [0xd8262f, 0x2a6fb5, 0x2e8b3e, 0xe07a1f]);
  p(box(1.1, 0.5, 0.9), 0x2a5a8a, 0, 0.9, 0.5);
  p(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 8, 1, true, HALF_PI, Math.PI).rotateX(HALF_PI), hood, 0, 1.25, 0.6);
  p(box(0.08, 0.08, 1.4), 0x333333, 0, 0.7, -0.4);
  for (const [lx, lz] of [[0, -1.1], [-0.55, 0.5], [0.55, 0.5]]) p(cyl(0.34, 0.34, 0.05, 10), 0x333333, lx, 0.34, lz, HALF_PI);
}

/** A wooden country boat (nouka) with a bamboo hood, on the water. */
function boat(kit: LKit, x: number, z: number, yaw: number, len = 7, hood = true): void {
  const { p } = frame(kit, x, z, yaw);
  const wood = pick(kit, [0x5b3a22, 0x4a3020, 0x6b4a2a]);
  p(box(1.5, 0.6, len * 0.66), wood, 0, 0.32, 0);
  p(box(1.1, 0.45, len * 0.22).rotateX(0.35), wood, 0, 0.58, -len * 0.41);
  p(box(1.1, 0.45, len * 0.22).rotateX(-0.35), wood, 0, 0.58, len * 0.41);
  if (hood) p(new THREE.CylinderGeometry(0.78, 0.78, len * 0.3, 8, 1, true, HALF_PI, Math.PI).rotateX(HALF_PI), 0xa88a52, 0, 0.62, len * 0.05);
}

/** A Bangladeshi river launch: white multi-deck passenger ship with coloured stripes, bow at -lz. */
function launch(kit: LKit, x: number, z: number, yaw: number, len = 40, decks = 2): void {
  const { p, w } = frame(kit, x, z, yaw);
  const beamW = len * 0.22;
  const stripes = pick(kit, [[0x1f5fb4, 0xd8262f], [0x2e8b3e, 0xf6c445], [0xd8262f, 0x1f3c88], [0xe07a1f, 0x2e8b3e]]);
  p(hullGeo(beamW, len, 0.8, len * 0.18), 0x7a1f1a, 0, 0, 0);
  p(hullGeo(beamW, len, 1.6, len * 0.18), 0xf2f2ee, 0, 0.8, 0);
  p(box(beamW + 0.05, 0.3, len * 0.8), stripes[0], 0, 2.0, len * 0.08);
  let y = 2.4;
  for (let d = 0; d < decks; d++) {
    const dl = len * (0.72 - d * 0.12);
    const dz = len * (0.1 + d * 0.04);
    const dw = beamW - 0.6 - d * 0.5;
    p(box(dw, 2.3, dl), 0xf4f4f0, 0, y + 1.15, dz);
    p(box(dw + 0.06, 0.7, dl - 1.5), GLASS, 0, y + 1.3, dz);
    p(box(dw + 0.08, 0.25, dl), stripes[d % 2], 0, y + 2.15, dz);
    p(box(dw + 0.6, 0.12, dl + 0.6), 0xe0e0da, 0, y + 2.35, dz);
    // lit cabins after dark
    for (const s of [-1, 1]) {
      const a = w(s * (dw / 2 + 0.1), y + 1.3, dz - dl * 0.3);
      const b = w(s * (dw / 2 + 0.1), y + 1.3, dz + dl * 0.3);
      kit.light(a[0], a[1], a[2]);
      kit.light(b[0], b[1], b[2]);
    }
    y += 2.4;
  }
  // wheelhouse up front on the top deck, mast and flag
  p(box(beamW * 0.55, 2, len * 0.12), 0xf4f4f0, 0, y + 1, -len * 0.12);
  p(box(beamW * 0.56, 0.7, len * 0.1), GLASS, 0, y + 1.2, -len * 0.12);
  p(cyl(0.08, 0.08, 4, 5), 0xdddddd, 0, y + 2, -len * 0.2);
  p(box(0.05, 0.8, 1.3), 0x006a4e, 0, y + 3.5, -len * 0.2 + 0.7);
  const m = w(0, y + 4, -len * 0.2);
  kit.light(m[0], m[1], m[2], RED_LIGHT);
}

/**
 * A steel ship (bulk lighter, or a hull beached for breaking), bow at -lz. `cut` = part of the bow already
 * cut away (0 … 0.7): the open section shows its rusty frames.
 */
function ship(kit: LKit, x: number, z: number, yaw: number, len: number, beamW: number, h: number, hull: number, cut = 0, y0 = 0): void {
  const { p } = frame(kit, x, z, yaw);
  const l = len * (1 - cut);
  const cz = (len * cut) / 2;
  const bow = cut > 0 ? 0 : beamW * 0.9;
  p(hullGeo(beamW, l, h * 0.4, bow), 0x8a3a26, 0, y0, cz);
  p(hullGeo(beamW, l, h * 0.6, bow), hull, 0, y0 + h * 0.4, cz);
  if (cut > 0) {
    const fz = cz - l / 2;
    p(box(beamW - 0.4, h - 0.6, 0.3), 0x6b3a22, 0, y0 + h / 2, fz + 0.4);
    for (let i = -2; i <= 2; i++) p(box(0.35, h, 0.5), 0x4a2a1a, (i * beamW) / 5, y0 + h / 2, fz - 0.1);
    p(box(beamW, 0.4, 0.5), 0x4a2a1a, 0, y0 + h * 0.55, fz - 0.1);
  }
  // accommodation block and funnel at the stern
  const sz = len / 2 - len * 0.09;
  p(box(beamW * 0.8, h * 0.9, len * 0.1), cut > 0.4 ? 0xb9a58a : 0xf0ece2, 0, y0 + h + h * 0.45, sz);
  p(box(beamW * 0.82, 0.6, len * 0.08), GLASS, 0, y0 + h + h * 0.75, sz - 0.6);
  p(box(beamW * 0.25, h * 0.6, beamW * 0.25), 0x2b2b2b, 0, y0 + h + h * 1.1, sz + len * 0.03);
  // hatch covers along the deck
  for (let hz = cz - l / 2 + beamW * 1.2; hz < sz - len * 0.08; hz += beamW * 1.1) p(box(beamW * 0.7, 0.6, beamW * 0.75), 0x6a3a26, 0, y0 + h + 0.3, hz);
}

/** A twin-engine narrow-body airliner (or turboprop when prop), nose at -lz. */
function plane(kit: LKit, x: number, z: number, yaw: number, prop: boolean, tail: number, stripe: number): void {
  const { p } = frame(kit, x, z, yaw);
  const len = prop ? 27 : 34;
  const r = prop ? 1.4 : 1.9;
  const y = r + 1.2;
  p(cyl(r, r, len * 0.72, 12).rotateX(HALF_PI), 0xf4f4f2, 0, y, 0);
  p(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, HALF_PI).rotateX(-HALF_PI), 0xf4f4f2, 0, y, -len * 0.36);
  p(cone(r, len * 0.26, 12).rotateX(HALF_PI), 0xf4f4f2, 0, y + r * 0.35, len * 0.49);
  p(box(r * 2.02, 0.35, len * 0.7), stripe, 0, y - r * 0.2, 0);
  p(box(r * 2.02, 0.35, len * 0.6), GLASS, 0, y + r * 0.35, -len * 0.04);
  const span = prop ? 27 : 30;
  const wy = prop ? y + r * 0.9 : y - r * 0.6;
  p(box(span, 0.35, 3.6), 0xdcdcda, 0, wy, len * 0.02);
  for (const s of [-1, 1]) {
    if (prop) {
      p(cyl(0.6, 0.6, 3.4, 8).rotateX(HALF_PI), 0xe8e8e6, s * 4.2, wy - 0.4, -0.4);
      p(box(3.6, 0.2, 0.1), 0x2b2b2b, s * 4.2, wy - 0.4, -2.2);
    } else {
      p(cyl(0.95, 0.85, 3.4, 10).rotateX(HALF_PI), 0xc8ccd0, s * 5.6, wy - 0.9, -1.2);
    }
  }
  p(box(prop ? 9 : 11, 0.25, 2.6), 0xdcdcda, 0, prop ? y + 5.6 : y + r * 0.6, len * 0.47);
  p(box(0.3, prop ? 5 : 5.6, 4), tail, 0, y + r + 2.2, len * 0.45);
  for (const [lx, lz] of [[0, -len * 0.33], [-1.6, len * 0.06], [1.6, len * 0.06]]) p(box(0.35, 1.3, 0.8), 0x3a3a3a, lx, 0.65, lz);
}

/** A railway coach, along z, centred at (x, z). */
function coach(kit: LKit, x: number, z: number, len: number, body: number, stripe: number): void {
  kit.block(x, z, 2.4, len - 1, 0.7, 0x2b2b2b, 0.55);
  kit.block(x, z, 2.9, len - 0.6, 2.9, body, 1.25);
  kit.block(x, z, 2.96, len - 2.4, 0.75, GLASS, 2.45);
  kit.block(x, z, 2.96, len - 0.6, 0.22, stripe, 2.0);
  kit.block(x, z, 2.6, len - 0.8, 0.35, 0x9a9a96, 4.15);
  for (const s of [-1, 1]) kit.block(x, z + s * (len / 2 - 3), 2.2, 2.6, 0.75, 0x1f1f1f, 0);
}

// ---------------------------------------------------------------- the models

/** Gas-fired combined cycle power plant. */
const powerPlant: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D - 2, L - 2, 0x9a9a88);
  kit.compound(2, -L / 2 + 2, D - 2, L / 2 - 2, 2.4, 0xdcd6c6, L * 0.3, 10);
  gate(kit, 2, L * 0.3, 10, 0xc8c0aa);
  // admin block by the gate
  kit.block(10, L * 0.18, 9, 16, 10, 0xeeeee8);
  kit.windows(5.5, L * 0.18 - 8, L * 0.18 + 8, 0.6, 3, 3.2, 0x3a6ea5, 2.4);
  kit.flag(7, L * 0.3 - 9, 9);
  // turbine hall: tall pale shed with a blue band
  const hx = D * 0.38;
  const hz = -L * 0.12;
  kit.block(hx, hz, 22, 42, 22, 0xc9d0d4);
  kit.block(hx, hz, 22.2, 42.2, 3, 0x3a6ea5, 19);
  kit.add(box(0.1, 4, 38), 0x9fb4c4, hx - 11.05, 13, hz);
  kit.block(hx, hz, 20, 40, 1.2, 0x8a959c, 22);
  // three HRSG trains, each a tall box with its slim steel stack
  for (const z of [-L * 0.36, -L * 0.18, L * 0.0]) {
    const gx = D * 0.66;
    kit.block(gx - 9, z, 8, 7, 7, 0xd6d8da);
    kit.block(gx, z, 10, 11, 25, 0x9aa3a8);
    for (let y = 5; y < 25; y += 5) kit.block(gx, z, 10.3, 11.3, 0.4, 0x6a747a, y);
    stack(kit, gx + 7.5, z, 2.4, 2.0, 58, 0xd0d4d6, 0xc8302a);
    beam(kit, [gx + 5, 20, z], [gx + 6.2, 22, z], 3, 3, 0x9aa3a8);
  }
  // the old steam unit's red-and-white chimney
  const cx = D * 0.84;
  const cz = L * 0.06;
  kit.cylinder(cx, cz, 3.6, 72, 0xe8e4dc, 0, 14, 2.6);
  for (const y of [52, 62]) kit.cylinder(cx, cz, 2.95 - (y - 52) * 0.02, 5, 0xc8302a, y, 14);
  kit.cylinder(cx, cz, 2.8, 4, 0xc8302a, 70, 14);
  kit.light(cx - 2.8, 73, cz, RED_LIGHT);
  kit.light(cx - 3.2, 40, cz, RED_LIGHT);
  // mechanical draft cooling tower
  kit.block(D * 0.88, -L * 0.3, 10, 24, 9, 0xb8bcbe);
  for (let i = 0; i < 4; i++) kit.cylinder(D * 0.88, -L * 0.3 - 9 + i * 6, 2.3, 2.6, 0x8a9096, 9, 12);
  // yellow gas pipe rack along the hall
  for (let z = -L * 0.42; z < L * 0.05; z += 8) kit.block(hx - 13, z, 0.3, 0.3, 5, 0x6a6e72);
  for (const dx of [-0.5, 0.5]) kit.add(cyl(0.4, 0.4, L * 0.47, 8).rotateX(HALF_PI), 0xe8c02a, hx - 13 + dx, 5.3, -L * 0.185);
  // switchyard: gravel, transformers, portal frames, pylons
  const sx0 = 22;
  const sx1 = D - 8;
  const sz = L * 0.33;
  kit.ground((sx0 + sx1) / 2, sz, sx1 - sx0, L * 0.26, 0x8f8a80, 0.08);
  for (let i = 0; i < 3; i++) {
    const tx = sx0 + 6 + i * 6;
    kit.block(tx, sz - 9, 3.5, 4, 4, 0x6f7a6a);
    for (const d of [-1, 0, 1]) kit.block(tx - 1.9, sz - 9 + d * 1.2, 0.3, 0.3, 2, 0xc8b89a, 4);
  }
  for (let x = sx0 + 4; x < sx1 - 14; x += 9) {
    for (const z of [sz - 3, sz + 9]) {
      kit.block(x, z, 0.4, 0.4, 9, STEEL);
      kit.block(x + 6, z, 0.4, 0.4, 9, STEEL);
      kit.add(box(6.4, 0.5, 0.5), STEEL, x + 3, 9, z);
    }
  }
  pylon(kit, sx1 - 4, sz, 38);
  pylon(kit, sx0 + 6, L / 2 - 8, 32);
  pylon(kit, sx1 - 4, L / 2 - 8, 32);
  for (const f of [0.66, 0.8]) for (const s of [-1, 1]) strut(kit, [sx1 - 4, 38 * f - 1.6, sz + s * 38 * (f === 0.66 ? 0.3 : 0.26) * 0.45], [sx0 + 6, 32 * f - 1.6, L / 2 - 8 + s * 32 * (f === 0.66 ? 0.3 : 0.26) * 0.45], 0.05, 0x3a3a3a, 3);
  kit.treeRow(5, -L / 2 + 6, L * 0.05, 9, 0.9);
};

/** Garment factory behind its boundary wall. */
const factory: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const gz = L * 0.28;
  kit.ground(D / 2, 0, D - 2, L - 2, 0xa8a59a);
  kit.compound(2, -L / 2 + 2, D - 2, L / 2 - 2, 2.6, 0xe6e0cc, gz, 9);
  kit.wall(2, -L / 2 + 2, 2, gz - 4.5, 0.4, 0x2a5a8a, 0.35, 2.6);
  gate(kit, 2, gz, 9, 0x2a5a8a);
  // main six-storey block: white with blue glass bands
  const bx = D * 0.38;
  const bz = -L * 0.12;
  const bw = 16;
  const bd = L * 0.5;
  const fh = 3.6;
  kit.block(bx, bz, bw, bd, fh * 6 + 0.6, 0xf0f2f2);
  for (let f = 0; f < 6; f++) kit.add(box(0.1, 1.7, bd - 2), 0x3f7fb8, bx - bw / 2 - 0.04, f * fh + 2.1, bz);
  kit.add(box(0.12, fh * 6, 3), 0x2a5a8a, bx - bw / 2 - 0.05, fh * 3, bz + bd / 2 - 4);
  kit.windowsZ(bz + bd / 2, bx - bw / 2, bx + bw / 2, 0.6, 6, fh, 0x3f7fb8, 3.2, 2);
  // stair tower and black rooftop water tanks
  kit.block(bx, bz - bd / 2 + 2, 6, 4, fh * 6 + 3.5, 0xe0e4e4);
  for (let i = 0; i < 5; i++) kit.cylinder(bx + 3 + (i % 2) * 2.6, bz - bd / 2 + 8 + i * 3, 1, 1.6, 0x1c1c1c, fh * 6 + 0.6, 10);
  for (let f = 1; f < 6; f++) for (let w = 0; w < 6; w++) if (kit.rng() < 0.35) kit.light(bx - bw / 2 - 0.2, f * fh + 2, bz - bd / 2 + 3 + w * (bd / 6));
  // sheds at the back: dyeing / washing, blue roofs, boiler stack
  shed(kit, D * 0.8, -L * 0.22, 14, 26, 7, 0xd6d2c6, 0x3a6ea5);
  shed(kit, D * 0.8, L * 0.15, 14, 22, 6, 0xd6d2c6, 0x3a6ea5);
  stack(kit, D * 0.9, L * 0.32, 0.9, 0.7, 22, 0x9a9a96);
  kit.block(D * 0.76, L * 0.34, 8, 6, 4, 0xb8b4a8);
  // covered van at the loading bay, workers at the gate
  truck(kit, D * 0.6, L * 0.2, 0, 0x2a6fb5, 0x2a5a8a, 0x2a5a8a);
  const dresses = [0xd8262f, 0xe07a1f, 0x8a2a8a, 0x2e8b3e, 0xf6c445, 0x1f5fb4, 0xd64a8a];
  for (let i = 0; i < 10; i++) kit.person(rnd(kit, 4, 12), gz + rnd(kit, -6, 6), rnd(kit, -3, 3), { shirt: pick(kit, dresses), lower: pick(kit, dresses) });
  kit.treeRow(D - 4, -L / 2 + 6, L / 2 - 6, 10, 0.8);
};

/** River-bank cement plant with a jetty. */
const cement: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const dust = 0xb3b0a8;
  const wx = D - 14;
  kit.ground(wx / 2, 0, wx, L - 2, 0xa6a39a);
  kit.water(D - 7, 0, 14, L);
  kit.ground(wx - 2, 0, 4, L, 0x8a7a62, 0.02);
  kit.wall(2, -L / 2 + 2, 2, L * 0.3 - 5, 2.4, 0xd8d4c8);
  kit.wall(2, L * 0.3 + 5, 2, L / 2 - 2, 2.4, 0xd8d4c8);
  gate(kit, 2, L * 0.3, 10, 0x8a8a86);
  // silos: a cluster of four tall grey cylinders with a top house
  const sx = D * 0.38;
  const sz = -L * 0.28;
  for (const [dx, dz] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) kit.cylinder(sx + dx, sz + dz, 4, 34, 0xc4c2bc, 0, 14);
  kit.block(sx, sz, 14, 14, 4, 0xa8a69e, 34);
  kit.cylinder(sx + 12, sz, 5, 24, 0xbab8b0, 0, 14);
  kit.dome(sx + 12, sz, 5, 0xa8a69e, 24, 0.4);
  kit.light(sx, 38.5, sz, RED_LIGHT);
  // clinker / mill sheds
  shed(kit, D * 0.58, L * 0.05, 14, 40, 14, 0xc8c6be, 0x9aa0a4, 0.3);
  shed(kit, D * 0.33, L * 0.15, 12, 18, 10, 0xd0cec6, 0x9aa0a4);
  // packing plant with trucks loading bags
  kit.block(D * 0.2, -L * 0.04, 8, 14, 12, 0xd4d2ca);
  kit.block(D * 0.13, -L * 0.04, 6, 14, 0.3, 0x8a8f94, 5);
  truck(kit, D * 0.1, -L * 0.02, 0, 0xd8262f, 0xd8d0b8);
  truck(kit, D * 0.08, L * 0.4, 0, 0xf6c445, 0xd8d0b8);
  // conveyor galleries: jetty → shed → silos
  const jz = -L * 0.05;
  beam(kit, [wx + 2, 14, jz], [D * 0.58 + 7, 16, jz + 10], 2.4, 2.2, dust);
  beam(kit, [D * 0.58 - 7, 16, L * 0.0], [sx + 6, 34, sz + 2], 2.4, 2.2, dust);
  for (const t of [0.35, 0.7]) {
    const px = D * 0.58 - 7 + (sx + 6 - (D * 0.58 - 7)) * t;
    const pz = sz + 2 + (L * 0.0 - sz - 2) * (1 - t);
    const py = 16 + 18 * t;
    kit.block(px, pz, 1, 1, py - 1, 0x7d8288);
  }
  // jetty, unloader and a bulk lighter tied up
  kit.block(wx + 3, jz, 8, 26, 1.4, CONCRETE, 0);
  for (let z = jz - 12; z <= jz + 12; z += 6) kit.block(wx + 3, z, 0.8, 0.8, 1.4, 0x6a6e72, -1);
  kit.block(wx + 3, jz, 5, 5, 12, 0xd6a12a, 1.4);
  beam(kit, [wx + 3, 13, jz], [D - 1, 12, jz], 1.2, 1.2, 0xd6a12a);
  ship(kit, D - 4, jz + 8, 0, 34, 7.5, 3.5, 0x2b2b2b);
  for (let z = -L / 2 + 6; z < L / 2 - 4; z += 15) if (Math.abs(z - jz - 8) > 23) boat(kit, D - 3, z, 0, 9, false);
  kit.treeRow(wx - 2, L * 0.25, L / 2 - 4, 8, 0.8);
};

/** Old BSFIC sugar mill. */
const sugarMill: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const rust = 0x8a5a3c;
  const ci = 0x8d918c;
  kit.ground(D / 2, 0, D - 2, L - 2, 0x9d8a68);
  kit.compound(2, -L / 2 + 2, D - 2, L / 2 - 2, 2, 0xd8c48a, L * 0.25, 9);
  gate(kit, 2, L * 0.25, 9, 0xd8c48a, 0x3a5a3a);
  // mill house (brick) and the long corrugated sheds
  kit.block(D * 0.5, -L * 0.18, 16, 22, 16, 0x9b4a32);
  kit.windows(D * 0.5 - 8, -L * 0.18 - 10, -L * 0.18 + 10, 2, 3, 4.5, 0x2c2a26, 3.2, 1.2, 2.2);
  kit.block(D * 0.5, -L * 0.18, 16.4, 22.4, 1, rust, 16);
  shed(kit, D * 0.5, L * 0.06, 16, 22, 10, ci, rust, 0.26);
  shed(kit, D * 0.78, -L * 0.12, 12, 30, 8, ci, 0x7a7d78, 0.26);
  kit.block(D * 0.78, L * 0.2, 10, 12, 6, 0xb8a888);
  // tall red-brick chimney with a white band and a dark sooty top
  const cx = D * 0.66;
  const cz = -L * 0.34;
  kit.block(cx, cz, 5.5, 5.5, 3, 0x8a3e2a);
  kit.cylinder(cx, cz, 2.4, 46, 0x9b4a32, 3, 12, 1.4);
  kit.cylinder(cx, cz, 1.62, 1.6, 0xf0ece2, 38, 12);
  kit.cylinder(cx, cz, 1.55, 2.2, 0x2a2420, 47, 12);
  kit.light(cx - 1.6, 48.5, cz, RED_LIGHT);
  // cane yard: heaps of cane, a tractor trolley and bullock carts
  const cane = 0x8a7a3a;
  for (let i = 0; i < 4; i++) kit.add(box(5, 1.6, 9), i % 2 ? cane : 0x6f7a32, D * 0.2 + (i % 2) * 6, 1.4 - 0.6, -L * 0.3 + Math.floor(i / 2) * 11, [0, 0.1 * i, 0]);
  {
    const { p } = frame(kit, D * 0.22, L * 0.05, 0);
    p(box(1.8, 1.2, 2.2), 0xd8262f, 0, 1.3, -4.6);
    p(cyl(0.75, 0.75, 0.4, 10), TYRE, -0.9, 0.75, -4.2, HALF_PI);
    p(cyl(0.75, 0.75, 0.4, 10), TYRE, 0.9, 0.75, -4.2, HALF_PI);
    p(box(2.4, 0.8, 4.4), 0x6a6e72, 0, 1.2, 0);
    p(box(2.6, 1.6, 4.6), cane, 0, 2.4, 0);
  }
  for (let i = 0; i < 3; i++) {
    const { p } = frame(kit, D * 0.12 + i * 3, L * 0.12 + i * 3, 0.2);
    p(box(1.6, 0.2, 3.4), 0x6b4a2a, 0, 1.1, 0.4);
    p(box(1.8, 1.2, 3.6), cane, 0, 1.8, 0.4);
    for (const s of [-1, 1]) p(cyl(0.7, 0.7, 0.12, 10), 0x5b3a22, s * 1, 0.7, 0.8, HALF_PI);
    for (const s of [-0.35, 0.35]) {
      p(box(0.6, 0.7, 1.4), 0xd8d0c0, s, 1.0, -2.2);
      p(box(0.4, 0.4, 0.5), 0xd8d0c0, s, 1.2, -3.1);
    }
  }
  for (let i = 0; i < 5; i++) kit.person(rnd(kit, 8, 20), rnd(kit, -L * 0.3, L * 0.1), rnd(kit, -3, 3), { lungi: true, lower: pick(kit, [0x3b5d8f, 0x2e6b3a, 0x7a3a2a]) });
  // the manager's bungalow under old trees
  kit.block(D * 0.82, L * 0.38, 9, 10, 4, 0xe8dcb8);
  kit.tree(D * 0.65, L * 0.4, 1.1);
  kit.tree(D - 6, L * 0.25, 1);
  kit.treeRow(5, -L / 2 + 5, L * 0.12, 9, 0.9);
};

/** Potato cold storage (hima-gar). */
const coldStorage: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const cream = 0xe9dfb8;
  const green = 0x2e7b45;
  kit.ground(D / 2, 0, D - 1, L - 1, 0xa8a090);
  const bx = D * 0.62;
  const bz = -L * 0.1;
  const bw = 15;
  const bd = L * 0.58;
  kit.block(bx, bz, bw, bd, 19, cream);
  for (const y of [0, 6.2, 12.4, 18.2]) kit.block(bx, bz, bw + 0.15, bd + 0.15, 0.8, green, y);
  for (let z = bz - bd / 2 + 2; z < bz + bd / 2; z += 3.5) kit.add(box(0.1, 0.5, 0.9), 0x5a5a50, bx - bw / 2 - 0.04, 17.4, z);
  // machine room with the ammonia condensers on top
  kit.block(bx, bz + bd / 2 + 4, 10, 8, 6, cream);
  kit.block(bx, bz + bd / 2 + 4, 8, 6, 1.5, 0x9aa0a4, 6);
  kit.cylinder(bx - 2, bz + bd / 2 + 4, 1.2, 0.8, 0x6a6e72, 7.5, 10);
  kit.cylinder(bx + 2, bz + bd / 2 + 4, 1.2, 0.8, 0x6a6e72, 7.5, 10);
  // loading platform under a tin awning on the road side
  const px = bx - bw / 2 - 1.8;
  kit.block(px, bz, 3.6, bd, 1.2, CONCRETE);
  kit.add(box(4.5, 0.12, bd), 0x8d918c, px - 0.3, 4.6, bz, [0, 0, 0.12]);
  for (let z = bz - bd / 2 + 1; z <= bz + bd / 2; z += 6) kit.block(px - 1.6, z, 0.2, 0.2, 4.3, 0x6a6e72);
  for (let i = 0; i < 6; i++) kit.add(box(1.6, 1.2, 2.4), 0xc4a36a, px + 0.3, 1.8, bz - bd / 2 + 3 + i * 3.4);
  for (let i = 0; i < 4; i++) kit.light(px - 1.6, 4.3, bz - bd / 2 + 2 + i * (bd / 4));
  // trucks backed up to the platform, porters carrying sacks
  truck(kit, px - 5.5, bz - 5, Math.PI / 2, pick(kit, TRUCK_CABS), 0xc4a36a);
  truck(kit, px - 5.5, bz + 5, Math.PI / 2, pick(kit, TRUCK_CABS), 0xc4a36a);
  for (let i = 0; i < 5; i++) {
    const x = rnd(kit, px - 3, px - 1);
    const z = bz + rnd(kit, -9, 9);
    kit.person(x, z, HALF_PI, { lungi: true, shirt: 0xd8d0c0, lower: pick(kit, [0x3b5d8f, 0x2e6b3a]) });
    kit.add(box(0.5, 0.35, 0.8), 0xc4a36a, x, 1.95, z);
  }
  // little office by the road
  kit.block(6, L * 0.36, 6, 8, 3.4, cream);
  kit.block(6, L * 0.36, 6.6, 8.6, 0.3, green, 3.4);
  kit.add(box(0.08, 1.2, 1.6), GLASS, 2.96, 1.8, L * 0.36);
  kit.light(2.8, 3, L * 0.36 - 2);
};

/** Two FCK brick kilns. */
const brickKilns: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const brick = 0xb5532f;
  kit.ground(D / 2, 0, D - 1, L - 1, 0xa0714b);
  for (const s of [-1, 1]) {
    const kx = D * 0.6;
    const kz = s * L * 0.22;
    // the oval kiln: a low mound of burnt earth, ash on top
    kit.add(cyl(1, 1.1, 2.6, 16), 0x8e5a3e, kx, 1.3, kz, [0, 0, 0], [8, 1, 12]);
    kit.add(cyl(1, 1, 0.3, 16), 0x5a4b42, kx, 2.75, kz, [0, 0, 0], [7.2, 1, 11]);
    kit.add(cyl(1, 1, 0.32, 12), 0x8e5a3e, kx, 2.8, kz, [0, 0, 0], [3, 1, 7]);
    // the tall tapered chimney, soot at the top
    kit.cylinder(kx, kz, 2.3, 36, 0xa4573c, 0, 10, 1.1);
    kit.cylinder(kx, kz, 1.6, 1.2, 0xf0ece2, 26, 10, 1.5);
    kit.cylinder(kx, kz, 1.2, 2.5, 0x2a2420, 35, 10, 1.1);
    kit.light(kx - 1.2, 37, kz, RED_LIGHT);
    // workers on the kiln top
    kit.person(kx - 4, kz + 2, 0, { lungi: true, shirt: 0x8a7a6a });
  }
  // stacks of fired red bricks near the road
  for (let i = 0; i < 8; i++) {
    const x = 6 + (i % 2) * 5;
    const z = -L * 0.42 + Math.floor(i / 2) * (L * 0.24) + rnd(kit, -1, 1);
    kit.block(x, z, 3.2, 6, rnd(kit, 1.4, 2.2), i % 3 ? brick : 0x9c4428);
  }
  // long rows of green (raw) bricks drying, a couple under tarp
  for (let r = 0; r < 5; r++) {
    const x = D * 0.3 + r * 2.4;
    kit.block(x, 0, 1, L * 0.5, 0.8, 0x9c8a74);
    if (r % 2 === 0) kit.add(box(1.3, 0.05, L * 0.3), 0x2a6fb5, x, 0.85, -L * 0.08);
  }
  // coal heap, labour sheds, a hand mould stand
  kit.add(ico(3, 0), 0x2a2622, D - 8, 0.8, 0, [0, 0, 0], [1.4, 0.5, 1.8]);
  for (const z of [-L * 0.42, -L * 0.32]) shed(kit, D - 5, z, 5, 7, 2.2, 0xa88a52, 0x8d918c);
  for (let i = 0; i < 8; i++) kit.person(rnd(kit, 4, D * 0.45), rnd(kit, -L * 0.4, L * 0.4), rnd(kit, -3, 3), { lungi: true, shirt: pick(kit, [0x8a7a6a, 0xd8d0c0, 0x5a6a7a]), lower: 0x5a4a3a });
  kit.palm(3, L * 0.45, 0.9);
};

/** Ship-breaking yard on the Sitakunda shore. */
const shipyard: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const rust = [0x8a4a2a, 0x6b3a22, 0x9b5a32, 0x5a4a3a];
  kit.ground(D * 0.22, 0, D * 0.44, L - 1, 0x8a8070);
  kit.ground(D * 0.6, 0, D * 0.36, L, 0x6f6550, 0.03);
  kit.water(D * 0.9, 0, D * 0.2, L, 0x6a7f86);
  // tin fence along the road with the gate
  kit.wall(2, -L / 2 + 1, 2, L * 0.1 - 5, 3, 0x3a6ea5, 0.15);
  kit.wall(2, L * 0.1 + 5, 2, L / 2 - 1, 3, 0x3a6ea5, 0.15);
  gate(kit, 2, L * 0.1, 10, 0x3a6ea5, 0x8a8f94);
  // beached ships, bow to the land, cut open at the front
  const ships: [number, number, number, number, number][] = [
    [-L * 0.32, 58, 13, 12, 0.35],
    [L * 0.03, 66, 15, 14, 0.12],
    [L * 0.33, 46, 11, 10, 0.6],
  ];
  for (const [z, len, w, h, cut] of ships) {
    const cx = D * 0.42 + len / 2 - Math.min(len / 2, 6);
    ship(kit, Math.min(cx, D - len / 2 - 1), z, HALF_PI, len, w, h, pick(kit, [0x2b2b2b, 0x3a4a5a, 0x5a2a22]), cut, -0.8);
  }
  // scrap: plates and heaps on the mud and the yard
  for (let i = 0; i < 18; i++) {
    const x = rnd(kit, 8, D * 0.45);
    const z = rnd(kit, -L * 0.45, L * 0.45);
    kit.add(box(rnd(kit, 2, 5), 0.3, rnd(kit, 3, 7)), pick(kit, rust), x, 0.3 + i * 0.01, z, [rnd(kit, -0.15, 0.15), rnd(kit, 0, 3), rnd(kit, -0.15, 0.15)]);
  }
  for (let i = 0; i < 5; i++) kit.add(ico(3, 0), pick(kit, rust), rnd(kit, 10, D * 0.35), 0.8, rnd(kit, -L * 0.42, L * 0.42), [0, rnd(kit, 0, 3), 0], [rnd(kit, 1, 1.8), 0.6, rnd(kit, 1, 2)]);
  // cutters' gas cylinders, winch houses with cables to the hulls
  for (let i = 0; i < 6; i++) kit.cylinder(rnd(kit, 12, 22), rnd(kit, -L * 0.2, L * 0.2), 0.22, 1.4, i % 2 ? 0xd8262f : 0x2a2a2a, 0, 8);
  for (const [z] of ships) {
    kit.block(D * 0.3, z + 6, 4, 3, 2.6, 0x9a9a96);
    kit.cylinder(D * 0.3 + 1, z + 6, 0.8, 1, 0xd6a12a, 2.6, 10);
    strut(kit, [D * 0.3 + 2, 1.5, z + 6], [D * 0.42 + 2, 4, z], 0.06, 0x2a2a2a, 3);
  }
  // crawler cranes
  for (const z of [-L * 0.14, L * 0.18]) {
    const { p, w } = frame(kit, D * 0.36, z, -HALF_PI);
    p(box(3.6, 0.9, 5.5), 0x2a2a2a, 0, 0.45, 0);
    p(box(3.2, 2.4, 4), 0xd6a12a, 0, 2.1, 0.4);
    p(box(1.4, 1.6, 1.6), GLASS, -1, 2.9, -1.4);
    beam(kit, w(0, 2.5, -1), w(0, 24, -16), 0.9, 0.9, 0xd6a12a);
    strut(kit, w(0, 24, -16), w(0, 8, -16), 0.04, 0x1c1c1c, 3);
    kit.light(...w(0, 24.5, -16), RED_LIGHT);
  }
  // yard office and workers in yellow helmets
  shed(kit, 10, -L * 0.42, 7, 10, 3, 0xd8d0c0, 0x8d918c);
  for (let i = 0; i < 14; i++) kit.person(rnd(kit, 8, D * 0.45), rnd(kit, -L * 0.45, L * 0.45), rnd(kit, -3, 3), { shirt: pick(kit, [0x5a6a7a, 0x8a7a6a, 0x3a4a5a]), lower: 0x3a3a3a, cap: 0xf6c445 });
  for (const z of [-L * 0.42, L * 0.42]) kit.light(4, 6, z);
};

/** Gas field process plant (Bibiyana style). */
const gasField: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D - 1, L - 1, 0x9a988c);
  kit.compound(2, -L / 2 + 1, D - 1, L / 2 - 1, 2, 0xd0ccc0, L * 0.3, 8);
  gate(kit, 2, L * 0.3, 8, 0xd0ccc0, 0xd8262f);
  // control building
  kit.block(9, L * 0.12, 8, 14, 4, 0xf0f0ea);
  kit.block(9, L * 0.12, 8.3, 14.3, 0.6, 0x2a5a8a, 4);
  kit.windows(5, L * 0.12 - 7, L * 0.12 + 7, 0.5, 1, 3.2, GLASS, 3);
  // well pads: Christmas-tree valve stacks behind little fences
  for (const z of [-L * 0.38, -L * 0.2]) {
    const x = D * 0.22;
    kit.ground(x, z, 7, 7, CONCRETE, 0.08);
    kit.cylinder(x, z, 0.35, 2.8, 0xd8262f, 0, 8);
    for (const y of [0.8, 1.6, 2.4]) kit.add(box(1.2, 0.35, 0.35), 0xf6c445, x, y, z);
    kit.add(box(0.35, 0.35, 1.4), 0xf6c445, x, 1.6, z);
    kit.compound(x - 3.5, z - 3.5, x + 3.5, z + 3.5, 1.2, 0x8a8f94, z, 0);
  }
  // pipe rack across the plant
  const rx = D * 0.5;
  for (let z = -L * 0.42; z <= L * 0.2; z += 6) {
    kit.block(rx - 2, z, 0.3, 0.3, 5, 0x6a6e72);
    kit.block(rx + 2, z, 0.3, 0.3, 5, 0x6a6e72);
    kit.add(box(4.4, 0.3, 0.3), 0x6a6e72, rx, 5, z);
  }
  const rl = L * 0.62;
  for (const [dx, c] of [[-1.4, 0xf6c445], [-0.4, 0xd8d0c0], [0.6, 0xf6c445], [1.5, 0x8a8f94]] as const) {
    kit.add(cyl(0.3, 0.3, rl, 8).rotateX(HALF_PI), c, rx + dx, 5.45, -L * 0.42 + rl / 2);
  }
  strut(kit, [D * 0.22, 1.6, -L * 0.38], [rx - 1.4, 5.45, -L * 0.38], 0.2, 0xf6c445, 6);
  strut(kit, [D * 0.22, 1.6, -L * 0.2], [rx - 1.4, 5.45, -L * 0.2], 0.2, 0xf6c445, 6);
  // horizontal separators on saddles, and the tall glycol contactor columns
  for (let i = 0; i < 3; i++) {
    const z = -L * 0.32 + i * 8;
    kit.add(cyl(1.3, 1.3, 7, 12).rotateZ(HALF_PI), 0xe8e8e2, rx + 8, 2.4, z);
    kit.block(rx + 6, z, 0.6, 2.4, 1.1, CONCRETE);
    kit.block(rx + 10, z, 0.6, 2.4, 1.1, CONCRETE);
  }
  for (let i = 0; i < 2; i++) {
    const z = L * 0.0 + i * 6;
    kit.cylinder(rx + 7, z, 1.1, 18, 0xe8e8e2, 0, 12);
    kit.dome(rx + 7, z, 1.1, 0xe8e8e2, 18);
    beam(kit, [rx + 5.7, 0, z - 0.6], [rx + 5.7, 18, z + 0.6], 0.5, 0.1, 0x6a6e72);
  }
  // condensate tanks
  tank(kit, D * 0.75, L * 0.22, 4, 7, 0xf0f0ea, 0xd8262f);
  tank(kit, D * 0.75, L * 0.38, 4, 7, 0xf0f0ea, 0xd8262f);
  kit.compound(D * 0.75 - 6, L * 0.14, D * 0.75 + 6, L * 0.46, 0.9, CONCRETE, L * 0.3, 0);
  // flare stack at the back corner, always burning
  const fx = D - 6;
  const fz = -L * 0.4;
  kit.cylinder(fx, fz, 0.5, 30, 0x9a9a96, 0, 8, 0.35);
  for (const a of [0, 2.1, 4.2]) strut(kit, [fx + Math.cos(a) * 4.5, 0, fz + Math.sin(a) * 4.5], [fx, 22, fz], 0.03, 0x3a3a3a, 3);
  kit.spire(fx, fz, 0.9, 3.4, 0xff8a1f, 30, 8);
  kit.spire(fx, fz, 0.5, 2.2, 0xffd23a, 30.2, 6);
  kit.light(fx, 32, fz, 0xff9a30);
  kit.light(fx, 33.2, fz, 0xffc040);
  kit.light(fx - 0.4, 15, fz, RED_LIGHT);
  for (const z of [-L * 0.2, L * 0.1]) kit.light(rx, 6.2, z);
};

/** Oil depot: white bunded tanks and a tanker loading gantry. */
const oilDepot: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const band = pick(kit, [0xd8262f, 0x1f5fb4, 0x2e8b3e]);
  kit.ground(D / 2, 0, D - 1, L - 1, 0x9d9a8e);
  kit.compound(2, -L / 2 + 1, D - 1, L / 2 - 1, 2.4, 0xe8e4d8, L * 0.32, 10);
  gate(kit, 2, L * 0.32, 10, 0xe8e4d8, band);
  // tank farm: two bunds of three tanks
  const tx = [D * 0.42, D * 0.72];
  for (let b = 0; b < 2; b++) {
    const z0 = -L * 0.44 + b * L * 0.3;
    const z1 = z0 + L * 0.28;
    kit.compound(D * 0.28, z0, D - 4, z1, 1.2, 0xc8c4b4, z0, 0);
    for (const x of tx) tank(kit, x, (z0 + z1) / 2, Math.min(7, L * 0.12), 11 + kit.rng() * 2, 0xf2f2ec, band);
  }
  tank(kit, D * 0.42, L * 0.24, 4, 9, 0xf2f2ec, band);
  // pipes from the tanks to the gantry
  for (const dy of [0.6, 1.3]) kit.add(cyl(0.25, 0.25, L * 0.62, 8).rotateX(HALF_PI), 0x8a8f94, D * 0.26, dy, -L * 0.13);
  // loading gantry with tankers under it
  const gx = D * 0.16;
  const gz = L * 0.1;
  canopy(kit, gx, gz, 9, 20, 6, 0xd0d0cc, 0xe8e8e2, 6.5);
  kit.block(gx, gz, 1, 20, 1.2, band, 5);
  tanker(kit, gx - 2.2, gz - 4, 0, band);
  tanker(kit, gx + 2.2, gz + 4, Math.PI, 0xf6c445);
  tanker(kit, 8, L * 0.42, 0, band);
  for (let i = 0; i < 3; i++) kit.light(gx, 5.8, gz - 7 + i * 7);
  // office, fire water tank and a foam shed
  kit.block(D * 0.18, -L * 0.3, 8, 12, 6, 0xf0ece2);
  kit.windows(D * 0.18 - 4, -L * 0.3 - 6, -L * 0.3 + 6, 0.6, 2, 3, GLASS, 3);
  kit.cylinder(D * 0.18, L * 0.38, 3, 6, 0xd8262f, 0, 14);
  kit.flag(D * 0.18 - 6, -L * 0.3 + 8, 9);
};

/** Bangladesh Railway station with a train in. */
const station: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const cream = 0xe8c96a;
  const trim = 0xb8332a;
  // track bed and the rails
  const px = D * 0.6;
  const pw = 5.5;
  const tx = px + pw / 2 + 2;
  kit.ground(tx, 0, 5, L, 0x7d776c, 0.12);
  for (const s of [-0.75, 0.75]) kit.add(box(0.12, 0.18, L), 0x8a8f94, tx + s, 0.25, 0);
  // platform with its yellow edge and the canopy on cast iron pillars
  kit.block(px, 0, pw, L * 0.8, 0.9, CONCRETE);
  kit.add(box(0.4, 0.05, L * 0.8), 0xf6c445, px + pw / 2 - 0.2, 0.93, 0);
  canopy(kit, px, 0, pw - 0.8, L * 0.5, 4.2, 0x2e6b3a, 0x8a3e2a, 6);
  for (let z = -L * 0.22; z <= L * 0.22; z += L * 0.11) kit.light(px, 4.3, z);
  // the station building: cream with red trim, arched-look openings
  const bx = D * 0.3;
  const bw = D * 0.32;
  const bz = -L * 0.04;
  const bd = L * 0.3;
  kit.block(bx, bz, bw, bd, 5, cream);
  kit.block(bx, bz, bw + 0.3, bd + 0.3, 0.6, trim, 5);
  kit.block(bx, bz, bw - 1, bd - 1, 0.8, cream, 5.6);
  kit.block(bx, bz, bw + 0.2, bd + 0.2, 0.4, trim, 0);
  for (let z = bz - bd / 2 + 2; z < bz + bd / 2 - 1; z += 3) {
    kit.add(box(0.1, 2.6, 1.4), 0x5a3a22, bx - bw / 2 - 0.04, 1.7, z);
    kit.add(box(0.12, 0.25, 1.8), trim, bx - bw / 2 - 0.06, 3.15, z);
  }
  // porch on the road side
  kit.block(bx - bw / 2 - 1.5, bz, 3, 6, 0.3, trim, 3.6);
  for (const s of [-1, 1]) kit.block(bx - bw / 2 - 2.8, bz + s * 2.6, 0.4, 0.4, 3.6, cream);
  kit.light(bx - bw / 2 - 2.8, 3.4, bz);
  // the train: BR loco and coaches in green and red
  const loco = -L * 0.38;
  kit.block(tx, loco, 2.4, 14, 0.8, 0x1f1f1f, 0.5);
  kit.block(tx, loco, 2.9, 14, 3, 0xe8b02a, 1.3);
  kit.block(tx, loco, 2.95, 14, 0.5, 0x1f3c88, 2.3);
  kit.block(tx, loco - 5.5, 2.95, 2.8, 1.1, GLASS, 3.1);
  kit.block(tx, loco + 1, 2.4, 8, 0.4, 0x9a9a96, 4.3);
  kit.light(tx, 4, loco - 7.1);
  const cols: [number, number][] = [[0x2e6b3a, 0xf6c445], [0xb8332a, 0xf0ece2], [0x2e6b3a, 0xf6c445]];
  const cl = Math.min(20, (L * 0.85 - 14) / cols.length);
  cols.forEach(([b, s], i) => coach(kit, tx, loco + 7 + cl / 2 + i * cl + 0.4, cl - 0.6, b, s));
  // signal post, benches, tea stall and people
  kit.cylinder(tx - 3, L * 0.44, 0.12, 6, 0xe8e8e2, 0, 6);
  kit.block(tx - 3, L * 0.44, 0.4, 0.6, 1.2, 0x1f1f1f, 5);
  kit.light(tx - 3.3, 5.8, L * 0.44, RED_LIGHT);
  for (let z = -L * 0.2; z <= L * 0.2; z += L * 0.13) kit.block(px - 1.2, z, 0.5, 2, 0.5, 0x6b4a2a, 0.9);
  shed(kit, px - 1, L * 0.33, 2.5, 3, 2.2, 0xa88a52, 0x8d918c);
  for (let i = 0; i < 12; i++) kit.person(px + rnd(kit, -2, 2), rnd(kit, -L * 0.3, L * 0.3), rnd(kit, -3, 3), { shirt: pick(kit, [0xf2f0ea, 0x3b5d8f, 0xd8262f, 0x2e8b3e, 0xe07a1f]), lungi: kit.rng() < 0.3 });
  for (let i = 0; i < 3; i++) rickshaw(kit, 4 + i * 2, bz + bd / 2 + 4 + i, 0.4);
  kit.tree(4, -L * 0.4, 1);
};

/** Inter-district bus terminal. */
const busTerminal: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D - 1, L - 1, ASPHALT);
  // counter shed at the back: a row of booths, each with its colour board
  const cx = D - 6;
  const boards = [0x2e8b3e, 0xd8262f, 0x1f5fb4, 0xf6a821, 0x8a2a8a, 0x1f3c88, 0xe07a1f];
  kit.block(cx, 0, 7, L * 0.84, 3.4, 0xe8e2d0);
  const n = Math.floor((L * 0.84) / 5);
  for (let i = 0; i < n; i++) {
    const z = -L * 0.42 + 2.5 + i * 5;
    kit.add(box(0.12, 1, 4.4), boards[i % boards.length], cx - 3.56, 3.1, z);
    kit.add(box(0.1, 1.2, 1.6), GLASS, cx - 3.55, 1.5, z);
  }
  canopy(kit, cx - 6, 0, 5, L * 0.84, 3.6, 0x9a9a96, 0x8d918c, 7);
  for (let i = 0; i < 5; i++) kit.light(cx - 6, 3.6, -L * 0.36 + i * L * 0.18);
  // the buses, nose to the road, in their liveries
  const nb = Math.floor((L * 0.84) / 9.5);
  for (let i = 0; i < nb; i++) {
    if (kit.rng() < 0.15) continue;
    const [b, s] = pick(kit, BUS_LIVERY);
    bus(kit, cx - 15.5, -L * 0.42 + 4.75 + i * 9.5, HALF_PI, b, s);
  }
  // one pulling out
  const [b, s] = pick(kit, BUS_LIVERY);
  bus(kit, 8, -L * 0.15, 0.25, b, s);
  // tea stalls, CNGs and rickshaws at the entrance, people with bags
  shed(kit, 4, L * 0.38, 3, 4, 2.3, 0xa88a52, 0x8d918c);
  shed(kit, 4, L * 0.3, 3, 4, 2.3, 0x2a6fb5, 0x8d918c);
  for (let i = 0; i < 3; i++) cng(kit, 3 + i * 1.8, L * 0.12 + i * 2.2, 0.2);
  for (let i = 0; i < 3; i++) rickshaw(kit, 9 + i * 1.6, L * 0.38, 0);
  for (let i = 0; i < 16; i++) kit.person(rnd(kit, cx - 9, cx - 4), rnd(kit, -L * 0.4, L * 0.4), rnd(kit, -3, 3), { shirt: pick(kit, [0xf2f0ea, 0x3b5d8f, 0xd8262f, 0x2e8b3e, 0xd64a8a]), lungi: kit.rng() < 0.25 });
  for (const z of [-L / 2 + 2, L / 2 - 2]) lamp(kit, 3, z, 8);
};

/** Village bazaar of tin-roofed stalls. */
const market: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D - 1, L - 1, 0x9d8a68);
  const veg = [0x3f8a2a, 0xd8262f, 0xe07a1f, 0x6a2a6a, 0xf0ece2, 0x9a7a4a, 0xf6c445, 0x2e6b2a];
  const tin = [0x8d918c, 0x8a5a3c, 0x9a9a96, 0x7a7d78];
  const tarp = [0x2a6fb5, 0xe07a1f, 0xd8262f, 0xf6c445];
  // pucca shop row at the back with painted shutters
  const sx = D - 4;
  kit.block(sx, 0, 6, L * 0.86, 3.4, 0xe0d6bc);
  kit.block(sx - 0.5, 0, 7.4, L * 0.88, 0.2, 0x8d918c, 3.4);
  for (let z = -L * 0.4; z < L * 0.42; z += 3.5) kit.add(box(0.1, 2.4, 3), pick(kit, [0x3a6ea5, 0x2e8b3e, 0x8a8f94, 0xb8332a]), sx - 3.04, 1.3, z + 1.6);
  // stalls: bamboo posts, a sloping tin or tarp roof, produce on the mat
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const x = 5 + r * ((D - 12) / 3);
      const z = -L * 0.4 + c * (L * 0.8 / 6) + 2;
      if (r === 1 && (c === 2 || c === 3)) continue;
      const w = 3.4;
      const d = 4;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.block(x + (dx * w) / 2, z + (dz * d) / 2, 0.12, 0.12, 2.6 + (dx > 0 ? 0.4 : 0), 0xb59a5a);
      const isTarp = kit.rng() < 0.35;
      kit.add(box(w + 0.6, 0.08, d + 0.5), isTarp ? pick(kit, tarp) : pick(kit, tin), x, 2.95, z, [0, 0, 0.12]);
      kit.ground(x, z, w - 0.4, d - 0.6, 0x8a6a3a, 0.1);
      for (let i = 0; i < 3; i++) kit.add(ico(0.45, 0), pick(kit, veg), x - 0.6 + i * 0.6, 0.3, z - 1 + i * 0.9, [0, 0, 0], [1.2, 0.6, 1.2]);
      kit.person(x + 1.1, z + 1, -HALF_PI, { seated: true, lungi: true, shirt: pick(kit, [0xf2f0ea, 0x8a7a6a, 0x3b5d8f]), lower: 0x2e6b3a });
    }
  }
  // the old rain tree in the middle, shoppers, a van gari and rickshaws
  kit.tree(5 + (D - 12) / 3, 0, 1.4);
  for (let i = 0; i < 16; i++) kit.person(rnd(kit, 2, D - 9), rnd(kit, -L * 0.42, L * 0.42), rnd(kit, -3, 3), { shirt: pick(kit, [0xf2f0ea, 0x3b5d8f, 0xd8262f, 0x2e8b3e, 0xd64a8a, 0xe07a1f]), lungi: kit.rng() < 0.5, lower: pick(kit, [0x3b5d8f, 0x2e6b3a, 0x5a4a3a]) });
  for (let i = 0; i < 3; i++) rickshaw(kit, 2.5, -L * 0.44 + i * 2.4, 0.3);
  {
    const { p } = frame(kit, 2.5, L * 0.44, 0);
    p(box(1.2, 0.12, 2), 0x6b4a2a, 0, 0.7, 0.4);
    p(box(1, 0.5, 1.6), 0xf0ece2, 0, 1.0, 0.4);
    for (const [lx, lz] of [[0, -1.1], [-0.6, 0.6], [0.6, 0.6]]) p(cyl(0.34, 0.34, 0.05, 10), 0x333333, lx, 0.34, lz, HALF_PI);
  }
  kit.bunting(1, -L * 0.3, 1, L * 0.3, 4);
  for (let i = 0; i < 4; i++) kit.light(5 + (i % 2) * 10, 2.7, -L * 0.3 + i * L * 0.2, 0xfff0b0);
};

/** Highway food stop (Food Village / Elenga style). */
const hotel: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D * 0.3, 0, D * 0.6, L - 1, ASPHALT);
  kit.ground(D * 0.8, 0, D * 0.4, L - 1, 0x6f9a4a);
  // the restaurant: a long hall with a full glass front, red roof band
  const rx = D * 0.68;
  const rw = D * 0.34;
  const rd = L * 0.6;
  const rz = -L * 0.05;
  kit.block(rx, rz, rw, rd, 7, 0xf2f0ea);
  kit.add(box(0.12, 4.6, rd - 3), 0x3a5a78, rx - rw / 2 - 0.05, 3, rz);
  for (let z = rz - rd / 2 + 2; z <= rz + rd / 2 - 2; z += 4) kit.add(box(0.2, 4.6, 0.2), 0xd8d8d8, rx - rw / 2 - 0.12, 3, z);
  kit.block(rx, rz, rw + 0.6, rd + 0.6, 1.4, 0xc8302a, 7);
  // second-floor block on top and a porte-cochère at the door
  kit.block(rx + 2, rz - rd * 0.15, rw - 4, rd * 0.4, 3.4, 0xf2f0ea, 8.4);
  kit.add(box(0.12, 1.6, rd * 0.36), 0x3a5a78, rx - rw / 2 + 1.95, 10.1, rz - rd * 0.15);
  kit.block(rx - rw / 2 - 3.5, rz, 7, 9, 0.5, 0xc8302a, 4.6);
  for (const s of [-1, 1]) kit.cylinder(rx - rw / 2 - 6.5, rz + s * 4, 0.3, 4.6, 0xf2f0ea, 0, 8);
  for (let i = 0; i < 6; i++) kit.light(rx - rw / 2 - 0.3, 3.5, rz - rd / 2 + 3 + i * (rd - 6) / 5);
  // buses and cars in the car park
  for (let i = 0; i < 3; i++) {
    const [b, s] = pick(kit, BUS_LIVERY);
    bus(kit, 6 + i * 4, -L * 0.3 + i * 1.5, 0.1, b, s);
  }
  for (let i = 0; i < 4; i++) car(kit, D * 0.38, L * 0.12 + i * 3.2, HALF_PI, pick(kit, CAR_COLORS));
  // tall pole sign by the road and lamps
  const pz = L * 0.4;
  kit.cylinder(3, pz, 0.45, 16, 0x9a9a96, 0, 10);
  kit.add(box(0.6, 4.5, 8), 0xc8302a, 3, 18, pz);
  kit.add(box(0.65, 1, 8.1), 0xf6c445, 3, 16.4, pz);
  kit.add(box(0.66, 1.4, 6), 0xf2f0ea, 3, 18.8, pz);
  kit.light(2.6, 18, pz - 3.5);
  kit.light(2.6, 18, pz + 3.5);
  for (const z of [-L * 0.45, 0]) lamp(kit, 2, z, 8);
  for (let i = 0; i < 10; i++) kit.person(rnd(kit, D * 0.4, rx - rw / 2 - 1), rnd(kit, -L * 0.3, L * 0.2), rnd(kit, -3, 3), { shirt: pick(kit, [0xf2f0ea, 0x3b5d8f, 0xd8262f, 0x2e8b3e, 0xd64a8a]) });
  kit.palm(D - 4, -L * 0.45, 1);
  kit.palm(D - 4, L * 0.4, 0.9);
  kit.treeRow(D - 3, -L * 0.3, L * 0.3, 10, 0.8);
};

/** Regional airport: terminal, tower, apron with planes, runway at the back. */
const airport: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  kit.ground(D / 2, 0, D - 1, L - 1, 0x7a9a52);
  // runway parallel to the road with its markings and edge lights
  const rx = D * 0.85;
  const rw = Math.min(16, D * 0.16);
  kit.ground(rx, 0, rw, L - 2, 0x3a3a3c, 0.08);
  for (let z = -L / 2 + 6; z < L / 2 - 6; z += 12) kit.add(box(0.5, 0.02, 6), 0xf2f2ee, rx, 0.12, z);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) kit.add(box(0.8, 0.02, 4), 0xf2f2ee, rx - rw / 2 + 2 + i * 1.2 * (rw / 6), 0.12, s * (L / 2 - 4));
  for (let z = -L / 2 + 4; z <= L / 2 - 4; z += L / 10) for (const s of [-1, 1]) kit.light(rx + (s * rw) / 2, 0.4, z, 0xfff2c4);
  // apron and taxiway
  const ax = D * 0.48;
  const aw = D * 0.3;
  kit.ground(ax, -L * 0.12, aw, L * 0.55, 0xa8a8a2, 0.07);
  kit.ground((ax + aw / 2 + rx - rw / 2) / 2, -L * 0.1, rx - rw / 2 - ax - aw / 2 + 0.5, 14, 0x5a5a5c, 0.07);
  // terminal: low white roof floating over a blue glass front, car park in front
  const tx = D * 0.2;
  const tw = D * 0.18;
  const tz = -L * 0.14;
  const td = L * 0.36;
  kit.block(tx, tz, tw, td, 8, 0xe8e8e2);
  kit.add(box(0.12, 5.5, td - 4), 0x3a5a78, tx - tw / 2 - 0.05, 3.5, tz);
  kit.block(tx, tz, tw + 6, td + 4, 0.8, 0xf6f6f2, 8);
  for (let z = tz - td / 2; z <= tz + td / 2; z += td / 6) kit.cylinder(tx - tw / 2 - 2.5, z, 0.3, 8, 0xd8d8d8, 0, 8);
  for (let i = 0; i < 6; i++) kit.light(tx - tw / 2 - 0.3, 4, tz - td / 2 + 3 + i * (td - 6) / 5);
  kit.ground(5, tz, 8, td, ASPHALT, 0.06);
  for (let i = 0; i < 6; i++) car(kit, 5, tz - td / 2 + 4 + i * 5, HALF_PI, pick(kit, CAR_COLORS));
  // control tower
  const cz = L * 0.3;
  const cxx = D * 0.3;
  kit.block(cxx, cz, 10, 10, 5, 0xe8e8e2);
  kit.cylinder(cxx, cz, 2.2, 26, 0xe8e8e2, 0, 12, 1.8);
  kit.cylinder(cxx, cz, 4, 0.8, 0xd8d8d2, 26, 10);
  kit.cylinder(cxx, cz, 3.8, 3.4, 0x2b4a60, 26.8, 10, 4.2);
  kit.cylinder(cxx, cz, 4.4, 0.7, 0xd8d8d2, 30.2, 10);
  kit.cylinder(cxx, cz, 0.08, 4, 0xd8d8d8, 30.9, 4);
  kit.light(cxx, 35, cz, RED_LIGHT);
  for (let i = 0; i < 3; i++) kit.light(cxx - 4, 28.4, cz - 2 + i * 2, 0x9fe0ff);
  // a Biman narrow-body at the gate and a turboprop
  plane(kit, ax, -L * 0.26, HALF_PI, false, 0xc8202a, 0x1f8a3a);
  plane(kit, ax + 2, L * 0.03, HALF_PI, true, 0x1f3c88, 0x1f3c88);
  // tug and a baggage cart, windsock, perimeter fence
  kit.block(ax - 12, -L * 0.12, 2, 3, 1.4, 0xf6c445);
  kit.block(ax - 12, -L * 0.12 + 4, 1.6, 3, 1, 0x8a8f94);
  kit.cylinder(rx - rw / 2 - 4, L * 0.42, 0.06, 6, 0xd8d8d8, 0, 4);
  kit.add(cone(0.5, 3, 8).rotateZ(HALF_PI), 0xe07a1f, rx - rw / 2 - 2.5, 5.7, L * 0.42);
  for (let z = -L / 2 + 2; z < L / 2; z += 10) kit.block(1, z, 0.08, 0.08, 2.4, 0x8a8f94);
  kit.add(box(0.04, 2, L - 2), 0x9aa0a4, 1, 1.4, 0);
};

/** Launch ghat on the river. */
const riverGhat: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const bank = D * 0.42;
  kit.ground(bank / 2, 0, bank, L - 1, 0x9d8a68);
  kit.ground(bank + 2, 0, 4, L, 0x7a6a50, 0.02);
  kit.water((bank + 2 + D) / 2, 0, D - bank - 2, L, 0x5f8a8f);
  // concrete steps down to the water
  for (let i = 0; i < 4; i++) kit.block(bank - 2 + i * 1.2, -L * 0.3, 1.2, 10, 1.2 - i * 0.3, CONCRETE);
  // the pontoon and its gangway
  const px = bank + 6;
  kit.block(px, L * 0.05, 6, 22, 1.2, 0x2b2b2b, 0);
  kit.block(px, L * 0.05, 6.1, 22.1, 0.3, 0xc8302a, 1.0);
  for (let z = L * 0.05 - 10; z <= L * 0.05 + 10; z += 5) kit.block(px - 2.8, z, 0.15, 0.15, 1.1, 0xd8d8d8, 1.2);
  beam(kit, [bank - 3, 1.0, L * 0.05], [px - 3, 1.3, L * 0.05], 2.2, 0.2, 0x6a6e72);
  for (const s of [-1, 1]) beam(kit, [bank - 3, 2.0, L * 0.05 + s * 1.1], [px - 3, 2.3, L * 0.05 + s * 1.1], 0.08, 0.08, 0x6a6e72);
  // a two-deck river launch tied alongside, and one more further out
  const ll = Math.min(42, L * 0.6);
  launch(kit, px + 8, L * 0.05, 0, ll, 2);
  if (D - bank > 34) launch(kit, D - 6, -L * 0.15, Math.PI, ll * 0.8, 2);
  // country boats along the bank
  for (let i = 0; i < 5; i++) boat(kit, bank + 3 + kit.rng() * 2, -L * 0.45 + i * 5, 0.4 + kit.rng() * 0.4, 6 + kit.rng() * 2, kit.rng() < 0.6);
  boat(kit, D - 3, L * 0.38, 0, 9, false);
  // tin ticket counter, tea stalls, waiting passengers
  shed(kit, 8, L * 0.05, 5, 8, 2.8, 0x3a6ea5, 0x8d918c);
  kit.add(box(0.1, 0.8, 1.2), GLASS, 5.46, 1.6, L * 0.05);
  kit.light(5.3, 2.6, L * 0.05);
  shed(kit, 8, L * 0.25, 3, 4, 2.3, 0xa88a52, 0x8d918c);
  shed(kit, 8, L * 0.33, 3, 4, 2.3, 0xa88a52, 0x8a5a3c);
  for (let i = 0; i < 18; i++) kit.person(rnd(kit, 4, bank - 2), rnd(kit, -L * 0.2, L * 0.4), rnd(kit, -3, 3), { shirt: pick(kit, [0xf2f0ea, 0x3b5d8f, 0xd8262f, 0x2e8b3e, 0xd64a8a, 0xe07a1f]), lungi: kit.rng() < 0.4, lower: pick(kit, [0x3b5d8f, 0x2e6b3a, 0x5a4a3a]) });
  for (let i = 0; i < 3; i++) rickshaw(kit, 3, -L * 0.1 + i * 2.3, 0.2);
  cng(kit, 3, -L * 0.22, 0.2);
  kit.tree(4, -L * 0.42, 1.1);
  kit.bunting(10.5, L * 0.05 - 4, bank - 3, L * 0.05 - 4, 4.5);
};

/** A river close to the road with a PC-girder bridge crossing it. */
const bridgeView: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const nearBank = D * 0.15;
  const farBank = D * 0.9;
  kit.ground(nearBank / 2, 0, nearBank, L - 1, 0x6f9a4a);
  kit.water((nearBank + farBank) / 2, 0, farBank - nearBank, L, 0x5f8a95);
  kit.ground((farBank + D) / 2, 0, D - farBank, L, 0x6f9a4a);
  // the bank curves in: sandy shelves and kash grass along it
  kit.add(box(D * 0.14, 0.08, L * 0.35), 0xcbb88a, nearBank + D * 0.03, 0.07, -L * 0.3, [0, 0.35, 0]);
  kit.add(box(D * 0.1, 0.08, L * 0.3), 0x6f9a4a, nearBank + D * 0.02, 0.08, L * 0.32, [0, -0.3, 0]);
  // a char (sandbar) with kash flowers
  kit.add(box(D * 0.16, 0.12, L * 0.3), 0xd8c89a, D * 0.62, 0.08, L * 0.3, [0, 0.4, 0]);
  for (let i = 0; i < 10; i++) kit.add(cone(0.5, 1.4, 5), 0xf2f0e8, D * 0.62 + rnd(kit, -5, 5), 0.8, L * 0.3 + rnd(kit, -10, 10));
  // the bridge: approach embankment, then a deck on hammerhead piers right across the river
  const bz = -L * 0.06;
  const deckY = 12;
  const bw = 10;
  const rampEnd = 4;
  const rampTop = nearBank + 6;
  beam(kit, [rampEnd, deckY * 0.15, bz], [rampTop, deckY + 0.6, bz], bw, 1.6, 0xc8c4b8);
  kit.block((rampEnd + rampTop) / 2, bz, rampTop - rampEnd, bw + 4, deckY * 0.45, 0x8a7a5a);
  const x0 = rampTop;
  const x1 = D;
  kit.add(box(x1 - x0, 2.2, bw), CONCRETE, (x0 + x1) / 2, deckY - 0.4, bz);
  kit.add(box(x1 - x0, 0.3, bw + 0.6), 0xd0ccc4, (x0 + x1) / 2, deckY + 0.85, bz);
  kit.add(box(x1 - x0, 0.1, bw - 1.2), 0x4a4a4c, (x0 + x1) / 2, deckY + 1.02, bz);
  for (const s of [-1, 1]) kit.add(box(x1 - x0, 0.9, 0.3), 0xe0dcd4, (x0 + x1) / 2, deckY + 1.45, bz + s * (bw / 2 + 0.1));
  const span = 18;
  for (let x = x0 + span; x < x1 - 2; x += span) {
    kit.block(x, bz, 2.2, bw * 0.75, 1.6, 0xb0aca4, deckY - 3.1);
    for (const s of [-1, 1]) kit.cylinder(x, bz + s * 2.2, 1.0, deckY - 3.1, 0xb8b4ac, -1, 10);
    kit.ball(x, 0.1, bz, 2.6, 0xa8a49c);
  }
  for (let x = x0 + 6; x < x1; x += 24) {
    for (const s of [-1, 1]) {
      kit.cylinder(x, bz + s * (bw / 2 + 0.1), 0.08, 6, 0x9a9a96, deckY + 1, 6);
      kit.light(x, deckY + 7, bz + s * (bw / 2 - 0.6));
    }
  }
  // traffic on the bridge
  const [b1, s1] = pick(kit, BUS_LIVERY);
  bus(kit, x0 + 20, bz - 2.2, -HALF_PI, b1, s1, deckY + 1);
  car(kit, x0 + 44, bz + 2.2, HALF_PI, pick(kit, CAR_COLORS), deckY + 1);
  car(kit, x0 + 58, bz - 2.2, -HALF_PI, pick(kit, CAR_COLORS), deckY + 1);
  // boats on the river: country boats, a sand bulkhead
  for (let i = 0; i < 5; i++) boat(kit, rnd(kit, nearBank + 6, farBank - 4), (i % 2 ? 1 : -1) * rnd(kit, 14, L * 0.42), rnd(kit, -1, 1), rnd(kit, 6, 9), kit.rng() < 0.6);
  {
    const { p } = frame(kit, D * 0.7, -L * 0.3, 0.3);
    p(hullGeo(5, 22, 1.4, 4), 0x2b2b2b, 0, 0, 0);
    p(box(4, 1.2, 14), 0xd8c08a, 0, 1.8, 1);
    p(box(3, 2, 2.5), 0xd8262f, 0, 2.4, 9.5);
  }
  kit.treeRow(3, -L * 0.45, -L * 0.15, 9, 0.9);
  kit.treeRow(3, L * 0.05, L * 0.45, 9, 0.9);
  kit.treeRow(D - 3, -L * 0.45, L * 0.45, 9, 0.8);
};

/** An elevated flyover beside the road. */
const flyover: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const fx = D * 0.5;
  const fw = Math.min(10, D * 0.4);
  const h = 7.5;
  const ramp = Math.min(26, L * 0.2);
  const zt = L / 2 - ramp - 2;
  kit.ground(fx, 0, fw + 6, L - 1, 0x6a6a68);
  // the elevated deck: concrete box girder, parapets, asphalt, a median
  const deck = (y: number, len: number, z: number, rx = 0) => {
    kit.add(box(fw - 2, 1.6, len), CONCRETE, fx, y - 0.8, z, [rx, 0, 0]);
    kit.add(box(fw, 0.4, len), 0xc8c4bc, fx, y + 0.2, z, [rx, 0, 0]);
    kit.add(box(fw - 1, 0.06, len), 0x4a4a4c, fx, y + 0.42, z, [rx, 0, 0]);
    for (const s of [-1, 1]) kit.add(box(0.35, 1.0, len), 0xe0dcd4, fx + s * (fw / 2 - 0.15), y + 0.9, z, [rx, 0, 0]);
    kit.add(box(0.5, 0.6, len), 0xe0dcd4, fx, y + 0.7, z, [rx, 0, 0]);
  };
  deck(h, zt * 2, 0);
  const slope = Math.atan2(h, ramp);
  const rl = Math.hypot(h, ramp);
  deck(h / 2, rl, zt + ramp / 2, slope);
  deck(h / 2, rl, -zt - ramp / 2, -slope);
  // T-piers
  for (let z = -zt + 6; z <= zt - 6; z += 16) {
    kit.block(fx, z, 2, 2, h - 1.6, 0xb8b4ac);
    kit.block(fx, z, fw - 1, 2.2, 1.2, 0xb0aca4, h - 2.8);
  }
  // median lamps and cars
  for (let z = -zt + 8; z <= zt; z += 20) {
    kit.cylinder(fx, z, 0.1, 8, 0x9a9a96, h + 1, 6);
    kit.add(box(5, 0.12, 0.25), 0x9a9a96, fx, h + 9, z);
    kit.light(fx - 2.4, h + 8.8, z);
    kit.light(fx + 2.4, h + 8.8, z);
  }
  const lane = fw / 4;
  for (let i = 0; i < 6; i++) {
    const toDhaka = i % 2 === 0;
    const z = -zt + 8 + i * ((zt * 2 - 16) / 5) + rnd(kit, -3, 3);
    const x = fx + (toDhaka ? -lane : lane);
    if (i === 3) bus(kit, x, z, toDhaka ? 0 : Math.PI, ...pick(kit, BUS_LIVERY), h + 0.45);
    else car(kit, x, z, toDhaka ? 0 : Math.PI, pick(kit, CAR_COLORS), h + 0.45);
  }
  // life under the deck: rickshaws parked, a tea stall, painted pier
  for (let i = 0; i < 4; i++) rickshaw(kit, fx + rnd(kit, -2, 2), rnd(kit, -zt * 0.6, zt * 0.6), rnd(kit, -0.5, 0.5));
  shed(kit, fx, -6, 2.6, 3, 2.2, 0xa88a52, 0x2a6fb5);
  kit.person(fx - 2, -5, -HALF_PI, { lungi: true });
  kit.person(fx - 2, -7, -HALF_PI);
};

/** Roundabout with a white shapla sculpture. */
const chattar: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const cx = D / 2;
  const r = Math.min(D, L) / 2 - 3;
  kit.ground(cx, 0, D - 0.5, L - 0.5, ASPHALT);
  // kerb painted black and white, the garden ring, the white tiled plinth
  kit.cylinder(cx, 0, r, 0.45, 0xf0f0ea, 0, 24);
  for (let i = 0; i < 24; i += 2) {
    const a = (i / 24) * Math.PI * 2;
    kit.add(box(0.2, 0.46, ((2 * Math.PI * r) / 24) * 1.02), 0x1c1c1c, cx + Math.cos(a) * r, 0.23, Math.sin(a) * r, [0, -a, 0]);
  }
  kit.cylinder(cx, 0, r - 0.3, 0.6, 0x4f8a32, 0, 24);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    kit.ball(cx + Math.cos(a) * (r - 1.2), 0.75, Math.sin(a) * (r - 1.2), 0.45, pick(kit, [0xd8262f, 0xf6c445, 0xe07a1f, 0xd64a8a]), 6);
  }
  kit.cylinder(cx, 0, r * 0.42, 1.6, 0xe8e6e0, 0, 16);
  kit.cylinder(cx, 0, r * 0.36, 0.2, 0x5f8a95, 1.6, 16);
  // the shapla: a stem and two rings of tall white petals opening outward
  kit.cylinder(cx, 0, 0.5, 3.2, 0xf2f2ee, 1.6, 10);
  for (const [n, len, tilt, y, off] of [[8, 5.2, 0.42, 4.6, 0.9], [6, 4, 0.18, 5.2, 0.4]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (n === 6 ? 0.3 : 0);
      const px = cx + Math.cos(a) * (off + Math.sin(tilt) * len * 0.5);
      const pz = Math.sin(a) * (off + Math.sin(tilt) * len * 0.5);
      const g = new THREE.CylinderGeometry(0.15, 0.75, len, 4).rotateZ(-tilt).rotateY(-a);
      kit.add(g, 0xf4f4f0, px, y + Math.cos(tilt) * len * 0.5 - 1.6, pz, [0, 0, 0], [1, 1, 1]);
    }
  }
  kit.ball(cx, 5.2, 0, 0.9, 0xf6c445, 10);
  // lamps, traffic round it
  for (const [dx, dz] of [[-1, -1], [1, 1]]) lamp(kit, cx + dx * (r - 0.8), dz * (r - 0.8), 7);
  for (let i = 0; i < 3; i++) kit.light(cx + rnd(kit, -1, 1), 3.5, rnd(kit, -1, 1), 0xffffff);
  const ringR = r + 1.6;
  for (let i = 0; i < 5; i++) {
    const a = rnd(kit, 0, Math.PI * 2);
    const x = cx + Math.cos(a) * ringR;
    const z = Math.sin(a) * ringR;
    if (x < 1 || x > D - 1 || Math.abs(z) > L / 2 - 1.5) continue;
    if (i % 2) cng(kit, x, z, -a);
    else rickshaw(kit, x, z, -a);
  }
  kit.person(cx - r - 0.8, 0.5, HALF_PI, { shirt: 0xf2f0ea, lower: 0x3b5d8f, cap: 0xf2f0ea });
};

/** A painted gateway arch (তোরণ) over a side road. */
const gateSign: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const gx = D * 0.45;
  const span = Math.min(14, L * 0.55);
  const h = 6.5;
  kit.ground(D / 2, 0, D, span - 2, ASPHALT);
  for (const s of [-1, 1]) {
    const z = s * (span / 2);
    kit.block(gx, z, 1.4, 1.4, 0.6, 0xe8e2d0);
    kit.block(gx, z, 1.2, 1.2, h, 0x2e8b3e, 0.6);
    for (const y of [1.6, 3.6]) kit.block(gx, z, 1.3, 1.3, 0.35, 0xc8302a, y);
    kit.block(gx, z, 1.6, 1.6, 0.4, 0xe8e2d0, h + 0.6);
    kit.dome(gx, z, 0.8, 0xf6c445, h + 1, 1.3, 10);
    kit.spire(gx, z, 0.12, 1, 0xf6c445, h + 2, 5);
    kit.light(gx - 0.9, h - 0.2, z);
    kit.ground(gx, z + s * 2.6, 2.2, 3, 0x4f8a32, 0.3);
    for (let i = 0; i < 3; i++) kit.ball(gx + rnd(kit, -0.7, 0.7), 0.55, z + s * (1.6 + i * 0.8), 0.32, pick(kit, [0xd8262f, 0xf6c445, 0xe07a1f]), 6);
  }
  // the lintel: cream band with red edges, a pointed crown in the middle
  const lw = span + 1.6;
  kit.add(box(1, 1.8, lw), 0xf2ead2, gx, h + 0.1, 0);
  kit.add(box(1.1, 0.25, lw + 0.2), 0xc8302a, gx, h + 1.05, 0);
  kit.add(box(1.1, 0.25, lw + 0.2), 0xc8302a, gx, h - 0.85, 0);
  const crown = new THREE.Shape();
  crown.moveTo(-3, 0);
  crown.quadraticCurveTo(-1.2, 0.4, 0, 1.8);
  crown.quadraticCurveTo(1.2, 0.4, 3, 0);
  crown.closePath();
  kit.add(new THREE.ExtrudeGeometry(crown, { depth: 0.6, bevelEnabled: false }).translate(0, 0, -0.3).rotateY(HALF_PI), 0x2e8b3e, gx, h + 1.15, 0);
  kit.sign(['স্বাগতম'], gx - 0.6, h + 0.1, 0, span - 1, 1.3, { bg: '#f2ead2', fg: '#b8232a', sizes: [100] }, -HALF_PI);
  kit.bunting(gx - 0.6, -span / 2, gx - 0.6, span / 2, h - 1.2);
};

/** District stadium: oval galleries, pavilion, four floodlights. */
const stadium: LandmarkModel = (kit) => {
  const L = kit.length;
  const D = kit.depth;
  const cx = D * 0.52;
  const az = L * 0.4;
  const ax = D * 0.38;
  kit.ground(D / 2, 0, D - 1, L - 1, 0x8a8a6a);
  // the field and the running track
  kit.add(cyl(1, 1, 0.1, 28), 0x9a5a3a, cx, 0.08, 0, [0, 0, 0], [ax - 7.5, 1, az - 7.5]);
  kit.add(cyl(1, 1, 0.1, 28), 0x4f9a3a, cx, 0.12, 0, [0, 0, 0], [ax - 11, 1, az - 11]);
  // concrete galleries: three rising tiers in a ring, a gap for the main gate on the road side
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI) < 0.15 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI) < 0.15) continue;
    const nx = Math.cos(a) / ax;
    const nz = Math.sin(a) / az;
    const yaw = Math.atan2(-nz, nx);
    const seg = (Math.hypot(ax * Math.sin(a), az * Math.cos(a)) * Math.PI * 2) / N + 0.3;
    for (let t = 0; t < 3; t++) {
      const off = -4.5 + t * 2.4;
      const hh = 1.6 + t * 2;
      kit.add(box(2.5, hh, seg), t === 2 ? 0xd8d2c0 : 0xb8b4ac, cx + Math.cos(a) * (ax + off), hh / 2, Math.sin(a) * (az + off), [0, yaw, 0]);
    }
    kit.add(box(0.4, 1.2, seg), i % 2 ? 0x2e8b3e : 0xc8302a, cx + Math.cos(a) * (ax + 0.6), 6.2, Math.sin(a) * (az + 0.6), [0, yaw, 0]);
  }
  // the roofed pavilion on the far side
  const px = cx + ax - 1;
  kit.block(px + 2, 0, 6, L * 0.3, 9, 0xe8e2d0);
  kit.add(box(10, 0.3, L * 0.32), 0x3a6ea5, px - 2, 11, 0, [0, 0, 0.12]);
  for (let z = -L * 0.14; z <= L * 0.14; z += L * 0.07) kit.cylinder(px + 3, z, 0.3, 11, 0xe8e2d0, 0, 8);
  for (let t = 0; t < 4; t++) kit.block(px - 4 + t * 1.4, 0, 1.4, L * 0.28, 1 + t * 1.6, t % 2 ? 0x2e8b3e : 0xc8302a);
  kit.flag(px + 4, L * 0.17, 14);
  // main gate on the road side
  const gxx = cx - ax - 1;
  for (const s of [-1, 1]) kit.block(gxx, s * 5, 1.6, 1.6, 7, 0xe8e2d0);
  kit.add(box(1.4, 1.4, 11.6), 0x2e8b3e, gxx, 7.5, 0);
  kit.add(box(1.5, 0.3, 11.8), 0xc8302a, gxx, 8.3, 0);
  kit.light(gxx - 0.9, 6.8, -4);
  kit.light(gxx - 0.9, 6.8, 4);
  // four floodlight towers at the corners
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * (ax * 0.82);
    const z = sz * (az * 0.86);
    floodlight(kit, x, z, 40, cx, 0);
  }
  kit.ground(6, 0, 10, L * 0.5, ASPHALT, 0.06);
  for (let i = 0; i < 4; i++) rickshaw(kit, 4, -L * 0.2 + i * 2.5, 0.3);
  kit.treeRow(3, -L / 2 + 5, -L * 0.28, 9, 0.9);
  kit.treeRow(3, L * 0.28, L / 2 - 5, 9, 0.9);
};

export const GENERIC_WORKS: Partial<Record<LandmarkKind, LandmarkModel>> = {
  powerPlant, factory, cement, sugarMill, coldStorage, brickKilns, shipyard, gasField, oilDepot,
  station, busTerminal, market, hotel, airport, riverGhat, bridgeView, flyover, chattar, gateSign, stadium,
};
