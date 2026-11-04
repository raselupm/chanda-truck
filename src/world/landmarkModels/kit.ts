// Building kit for the roadside landmarks. A model is built in its own site frame:
//   x = 0 is the site's road-facing edge, +x runs away from the road (depth),
//   y is up from the ground, z runs along the road with -z toward Dhaka (the truck comes from +z),
//   the site spans z = -length/2 … +length/2 and x = 0 … depth.
// The kit mirrors everything onto the left side (k = -1), so models are written once, for the right.
// All solid parts are merged into one vertex-coloured mesh; signs (textured planes) and night lights
// are kept apart. Keep the polygon count modest: cylinders 8–16 segments, no per-brick detail.

import * as THREE from 'three';
import { box, buildColored, cached, cone, cyl, ico, sph, vertexColorMaterial, type Part } from '../../utils/geometry';
import { signTexture, type SignOpts } from '../../utils/textures';
import { mulberry32 } from '../../utils/rng';
import { personParts } from '../People';

export type V3 = [number, number, number];

export interface PersonLook {
  shirt?: number;
  lower?: number;
  lungi?: boolean;
  cap?: number;
  skin?: number;
  seated?: boolean;
}

const SKINS = [0x8d5a3b, 0x9c6644, 0x7b4a2e, 0xa87150];

export class LKit {
  readonly parts: Part[] = [];
  /** textured signs and anything else that can't be merged (added to the site group as is) */
  readonly extras: THREE.Object3D[] = [];
  private lightPos: number[] = [];
  private lightCol: number[] = [];
  /** deterministic per landmark: use it for small variations (colours, counts) */
  readonly rng: () => number;

  /**
   * @param k 1 = right of the road, -1 = left (mirrors x)
   * @param length metres along the road, depth metres away from it (the footprint)
   */
  constructor(readonly k: 1 | -1, readonly length: number, readonly depth: number, seed = 1) {
    this.rng = mulberry32(seed);
  }

  /** Any geometry at (x, y, z) in the site frame; r = Euler rotation, s = scale. */
  add(geo: THREE.BufferGeometry, color: number | undefined, x: number, y: number, z: number, r: V3 = [0, 0, 0], s?: V3): void {
    this.parts.push({ geo, color, p: [this.k * x, y, z], r: [r[0], this.k * r[1], this.k * r[2]], s });
  }

  /** A box standing on y0: w along x (depth), d along z (the road), h tall. */
  block(x: number, z: number, w: number, d: number, h: number, color: number, y0 = 0, yaw = 0): void {
    this.add(box(w, h, d), color, x, y0 + h / 2, z, [0, yaw, 0]);
  }

  /** A vertical cylinder standing on y0 (rTop = rBottom unless given). */
  cylinder(x: number, z: number, r: number, h: number, color: number, y0 = 0, seg = 12, rTop = r): void {
    this.add(cyl(rTop, r, h, seg), color, x, y0 + h / 2, z);
  }

  /** A cone (spire, roof) with its base on y0. */
  spire(x: number, z: number, r: number, h: number, color: number, y0 = 0, seg = 8): void {
    this.add(cone(r, h, seg), color, x, y0 + h / 2, z);
  }

  /** A dome (half sphere) sitting on y0, optionally stretched tall (onion-ish when > 1). */
  dome(x: number, z: number, r: number, color: number, y0 = 0, tall = 1, seg = 14): void {
    this.add(new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg / 2)), 0, Math.PI * 2, 0, Math.PI / 2), color, x, y0, z, [0, 0, 0], [1, tall, 1]);
  }

  /** A sphere of radius r centred at (x, y, z). */
  ball(x: number, y: number, z: number, r: number, color: number, seg = 8): void {
    this.add(sph(r, seg, Math.max(4, Math.round(seg * 0.6))), color, x, y, z);
  }

  /** Flat ground patch (paving, lawn, earth) just above the terrain. */
  ground(x: number, z: number, w: number, d: number, color: number, y = 0.04): void {
    this.add(box(w, 0.06, d), color, x, y, z);
  }

  /** A patch of water (pond, river bank, lake). */
  water(x: number, z: number, w: number, d: number, color = 0x3f7f95): void {
    this.add(box(w, 0.05, d), color, x, 0.06, z);
  }

  /** A straight wall from (x0, z0) to (x1, z1). */
  wall(x0: number, z0: number, x1: number, z1: number, h: number, color: number, thick = 0.3, y0 = 0): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    this.add(box(thick, h, len), color, (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, [0, yaw, 0]);
  }

  /** A boundary wall round a rectangle, with a gap (the gate) on the road side at z = gateZ. */
  compound(x0: number, z0: number, x1: number, z1: number, h: number, color: number, gateZ = (z0 + z1) / 2, gateW = 8): void {
    this.wall(x0, z0, x0, gateZ - gateW / 2, h, color);
    this.wall(x0, gateZ + gateW / 2, x0, z1, h, color);
    this.wall(x1, z0, x1, z1, h, color);
    this.wall(x0, z0, x1, z0, h, color);
    this.wall(x0, z1, x1, z1, h, color);
  }

  /**
   * Rows of windows on the road-facing side (x = xFace) of a block: from z0 to z1, `rows` storeys
   * starting at y0, each rowH tall. Windows are thin dark boxes standing just proud of the wall.
   */
  windows(xFace: number, z0: number, z1: number, y0: number, rows: number, rowH: number, color = 0x2c3a44, spacing = 2.6, w = 1.3, h = 1.4): void {
    for (let r = 0; r < rows; r++) {
      for (let z = z0 + spacing / 2; z < z1; z += spacing) this.add(box(0.08, h, w), color, xFace - 0.05, y0 + r * rowH + rowH / 2, z);
    }
  }

  /** Same, on a face that looks along z (the ends of a block), x0..x1 at z = zFace. */
  windowsZ(zFace: number, x0: number, x1: number, y0: number, rows: number, rowH: number, color = 0x2c3a44, spacing = 2.6, w = 1.3, h = 1.4): void {
    for (let r = 0; r < rows; r++) {
      for (let x = x0 + spacing / 2; x < x1; x += spacing) this.add(box(w, h, 0.08), color, x, y0 + r * rowH + rowH / 2, zFace + 0.05);
    }
  }

  /** A leafy tree (rain tree / mango / jackfruit look), scale 1 ≈ 7 m. */
  tree(x: number, z: number, scale = 1, leaf = 0x3f6f2a): void {
    const s = scale;
    this.add(cyl(0.25 * s, 0.38 * s, 3.2 * s, 6), 0x5b4027, x, 1.6 * s, z);
    this.add(ico(2.6 * s), leaf, x, 4.8 * s, z);
    this.add(ico(1.8 * s), 0x4f8132, x + 1.2 * s, 4.1 * s, z + 0.6 * s);
  }

  /** A coconut / betel-nut palm, scale 1 ≈ 9 m. */
  palm(x: number, z: number, scale = 1): void {
    const s = scale;
    this.add(cyl(0.16 * s, 0.24 * s, 8 * s, 6), 0x7a6648, x, 4 * s, z);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add(box(0.5 * s, 0.05, 3 * s), i % 2 ? 0x4c8f2a : 0x5fa632, x + Math.sin(a) * 1.3 * s, 7.8 * s, z + Math.cos(a) * 1.3 * s, [0.45, a, 0]);
    }
  }

  /** A row of trees from z0 to z1 at x (shade trees along a wall or avenue). */
  treeRow(x: number, z0: number, z1: number, step = 8, scale = 0.9): void {
    for (let z = z0; z <= z1; z += step) this.tree(x + (this.rng() - 0.5) * 1.5, z, scale * (0.85 + this.rng() * 0.3));
  }

  /** A person standing at (x, z), facing yaw (0 = facing -z, toward Dhaka; π/2 … toward the road is -π/2 for k = 1). */
  person(x: number, z: number, yaw = 0, look: PersonLook = {}): void {
    const skin = look.skin ?? SKINS[Math.floor(this.rng() * SKINS.length)];
    const l = { skin, shirt: look.shirt ?? 0xf2f0ea, lower: look.lower ?? 0x3b5d8f, lungi: look.lungi ?? false, cap: look.cap, seated: look.seated };
    const geo = cached(`lmperson:${l.skin}:${l.shirt}:${l.lower}:${l.lungi}:${l.cap}:${!!l.seated}`, () => buildColored(personParts(l)));
    this.add(geo, undefined, x, 0, z, [0, yaw, 0]);
  }

  /** The Bangladesh flag on a white pole (pole h tall, flag on the road side). */
  flag(x: number, z: number, h = 8): void {
    this.cylinder(x, z, 0.06, h, 0xe8e8e8, 0, 6);
    this.add(box(0.04, 1.2, 2), 0x006a4e, x, h - 0.7, z + 1.05);
    this.add(cyl(0.38, 0.38, 0.06, 12), 0xf42a41, x - 0.04, h - 0.7, z + 0.95, [0, 0, Math.PI / 2]);
  }

  /** A string of small triangular bunting/flags between two points (mazars, melas, markets). */
  bunting(x0: number, z0: number, x1: number, z1: number, y: number, colors = [0xe63946, 0xffd166, 0x2a9d8f, 0xffffff]): void {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.8));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.add(cone(0.18, 0.35, 3), colors[i % colors.length], x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * 0.6 - 0.2, z0 + (z1 - z0) * t, [Math.PI, 0, 0]);
    }
  }

  /**
   * A textured text sign (a plane w × h) centred at (x, y, z). By default it faces the road, turned a little
   * toward the oncoming truck; yaw overrides that (0 = facing +z, the oncoming truck, head on).
   */
  sign(lines: string[], x: number, y: number, z: number, w: number, h: number, opts: SignOpts = {}, yaw?: number): THREE.Mesh {
    const tex = signTexture(lines, { w: 1024, h: Math.round((1024 * h) / w), ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(this.k * x, y, z);
    m.rotation.y = yaw === undefined ? -this.k * (Math.PI / 2 - 0.35) : this.k * yaw;
    m.userData.ownsMaterial = true;
    this.extras.push(m);
    return m;
  }

  /** A point of light that glows after dark (lit windows, red aviation lights, street lamps, a gas flare). */
  light(x: number, y: number, z: number, color = 0xfff2c4): void {
    this.lightPos.push(this.k * x, y, z);
    this.lightCol.push(...new THREE.Color(color).toArray());
  }

  /** Builds the merged mesh plus the lights; returns the objects to add to the site group. */
  finish(): { mesh: THREE.Mesh; lights: THREE.Points | null } {
    const mesh = new THREE.Mesh(buildColored(this.parts), vertexColorMaterial());
    mesh.frustumCulled = false;
    mesh.userData.ownsGeometry = true;
    let lights: THREE.Points | null = null;
    if (this.lightPos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.lightPos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(this.lightCol, 3));
      lights = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
      lights.frustumCulled = false;
    }
    return { mesh, lights };
  }
}

/** A model: draws one landmark into the kit (the footprint is kit.length × kit.depth). */
export type LandmarkModel = (kit: LKit) => void;
