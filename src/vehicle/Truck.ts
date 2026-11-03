// The player's truck, in one of three bodies (config/trucks.ts):
// - open:    Tata SE 1613-style semi-forward cab, locally built wooden body, wooden crown over the cab, full truck art
// - covered: 12-tonne cab-over with a corrugated steel box body and locking rear doors
// - pickup:  one-tonne single cab with a vertical-slat grille, a low steel bed and a tube rack over it
// Each body is built the first time it's chosen. Wheels spin, the front pair steers, crates fill with cargo.

import * as THREE from 'three';
import { activeTruck, TRUCKS, type TruckId } from '../config/trucks';
import { WORLD } from '../config/tuning';
import { blobShadow, box, buildColored, cone, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { coveredVanSideTexture, pickupTailgateTexture, truckArtTexture } from '../utils/textures';
import { adMaterials } from '../world/AdBoards';

type V3 = [number, number, number];

/** How the cargo crates stack on a body: cols across, rows from the back forward, layers up. */
interface CrateLayout {
  cols: number;
  rows: number;
  layers: number;
  x0: number;
  dx: number;
  y0: number;
  dy: number;
  /** the back row; rows step forward (-z) from here */
  z0: number;
  dz: number;
}

interface Lamp {
  p: V3;
  w: number;
  h: number;
  round?: boolean;
}

interface Body {
  /** rides on the bouncing body group */
  group: THREE.Group;
  /** wheels and shadow, on the root (they don't bounce) */
  under: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheels: THREE.Mesh[];
  wheelRadius: number;
  /** hidden in the driver's-seat view (the cockpit overlay draws the cab) */
  cab: THREE.Object3D[];
  tassels: THREE.Mesh | null;
  /** the panel that carries a random ad (see shuffleRearAd) and its own art for when there are no ads */
  back: THREE.Mesh | null;
  backArt: THREE.Material | null;
  /** null: cargo is shut away out of sight (covered van) */
  crates: CrateLayout | null;
  /** front of the headlights, for the spotlight */
  lampZ: number;
}

const OPEN_CRATES: CrateLayout = { cols: 3, rows: 6, layers: 3, x0: -0.78, dx: 0.78, y0: 1.65, dy: 0.52, z0: 3.5, dz: 0.88 };
const PICKUP_CRATES: CrateLayout = { cols: 2, rows: 2, layers: 3, x0: -0.4, dx: 0.8, y0: 1.21, dy: 0.52, z0: 2.0, dz: 0.95 };
/** instance slots shared by every body */
const CRATE_SLOTS = OPEN_CRATES.cols * OPEN_CRATES.rows * OPEN_CRATES.layers;

const CHROME = 0xd6d6d2;
const TYRE = 0x1b1b1b;
const GLASS = 0x22313f;
const TASSEL_COLORS = [0xe63946, 0xffd166, 0x2a9d8f, 0xf72585, 0x4361ee, 0xff8c1a];

function tasselStrand(n: number, width: number, y: number, z: number): Part[] {
  const parts: Part[] = [];
  const step = width / (n - 1);
  for (let i = 0; i < n; i++) {
    parts.push({ geo: cone(0.07, 0.35, 5), color: TASSEL_COLORS[i % TASSEL_COLORS.length], p: [-width / 2 + i * step, y, z], r: [Math.PI, 0, 0] });
  }
  parts.push({ geo: box(width + 0.1, 0.03, 0.03), color: 0xdddddd, p: [0, y + 0.17, z] });
  return parts;
}

/** A tyre with its rim, and a bar across it so you can see it spin. dual = twin rear tyres. */
function wheelGeometry(r: number, w: number, rim: number, dual = false): THREE.BufferGeometry {
  const side: V3 = [0, 0, Math.PI / 2];
  const parts: Part[] = [
    { geo: cyl(r, r, w, 14), color: TYRE, r: side },
    { geo: cyl(r * 0.56, r * 0.56, w + 0.02, 10), color: rim, r: side },
    { geo: cyl(r * 0.18, r * 0.18, w + 0.05, 6), color: 0x555555, r: side },
    { geo: box(w + 0.04, 0.08, r * 1.35), color: 0x2b2b2b },
  ];
  // the gap between twin tyres
  if (dual) parts.push({ geo: cyl(r * 0.9, r * 0.9, 0.04, 12), color: 0x0c0c0c, r: side });
  return buildColored(parts);
}

/** Vertical steel tube between two heights. */
const post = (x: number, z: number, y0: number, y1: number, r = 0.025, color = 0x9a9a9a): Part => ({ geo: cyl(r, r, y1 - y0, 6), color, p: [x, (y0 + y1) / 2, z] });
/** Steel tube along z. */
const railZ = (x: number, y: number, z0: number, z1: number, r = 0.025, color = 0x9a9a9a): Part => ({ geo: cyl(r, r, z1 - z0, 6), color, p: [x, y, (z0 + z1) / 2], r: [Math.PI / 2, 0, 0] });
/** Steel tube along x. */
const railX = (y: number, z: number, w: number, r = 0.025, color = 0x9a9a9a): Part => ({ geo: cyl(r, r, w, 6), color, p: [0, y, z], r: [0, 0, Math.PI / 2] });

export class Truck {
  readonly root = new THREE.Group();
  /** pitch/roll/bounce happen on this inner group */
  private body = new THREE.Group();
  /** driver's eye; the cockpit camera rides on it */
  readonly eye = new THREE.Object3D();
  private bodies = new Map<TruckId, Body>();
  private cur!: Body;
  private kind: TruckId = 'open';
  private crates: THREE.InstancedMesh;
  private produce: THREE.InstancedMesh;
  private wheelSpin = 0;
  private cockpit = false;
  private ad: THREE.Material | null = null;
  private crateColors: number[] = [];
  private mat = vertexColorMaterial();

  private spot: THREE.SpotLight;
  private lampMat: THREE.MeshBasicMaterial;
  private tailMat: THREE.MeshBasicMaterial;
  private poolMat: THREE.MeshBasicMaterial;

  constructor() {
    this.root.add(this.body);
    this.body.add(this.eye);

    // Cargo crates: crate bodies + coloured produce on top, shared by the open truck and the pickup
    const crateGeo = buildColored([{ geo: box(0.74, 0.5, 0.86), color: 0x9b7040 }]);
    const produceGeo = buildColored([{ geo: box(0.66, 0.14, 0.78), color: 0xffffff }]);
    this.crates = new THREE.InstancedMesh(crateGeo, this.mat, CRATE_SLOTS);
    this.produce = new THREE.InstancedMesh(produceGeo, this.mat, CRATE_SLOTS);
    this.crates.count = this.produce.count = 0;
    this.crates.frustumCulled = this.produce.frustumCulled = false;
    this.body.add(this.crates, this.produce);

    // Headlights for dusk / night / rain: a real spotlight, glowing lamps and a fake light pool
    this.spot = new THREE.SpotLight(0xfff2cc, 0, 90, 0.55, 0.6, 1.1);
    this.spot.target.position.set(0, 0, -30);
    this.root.add(this.spot, this.spot.target);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0 });
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0 });
    const poolTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,240,200,0.9)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 26).rotateX(-Math.PI / 2), this.poolMat);
    pool.position.set(0, 0.32, -17);
    pool.renderOrder = 1;
    this.root.add(pool);

    this.setType(activeTruck().id);
  }

  /** Swap to another body (built the first time it's needed). */
  setType(id: TruckId): void {
    if (this.cur && this.kind === id) return;
    if (this.cur) {
      this.cur.group.visible = this.cur.under.visible = false;
    }
    this.kind = id;
    let b = this.bodies.get(id);
    if (!b) {
      b = id === 'covered' ? this.buildCovered() : id === 'pickup' ? this.buildPickup() : this.buildOpen();
      this.bodies.set(id, b);
      this.body.add(b.group);
      this.root.add(b.under);
    }
    this.cur = b;
    b.group.visible = b.under.visible = true;
    const spec = TRUCKS[id];
    this.eye.position.set(...spec.eye);
    this.eye.rotation.x = -0.1;
    this.spot.position.set(0, 1.4, b.lampZ - 0.05);
    if (b.back) b.back.material = this.ad ?? b.backArt!;
    this.setCockpit(this.cockpit);
    this.setCrates(this.crateColors);
  }

  get type(): TruckId {
    return this.kind;
  }

  /** How many crates a full load shows (0: the cargo is out of sight). */
  get maxCrates(): number {
    const c = this.cur.crates;
    return c ? c.cols * c.rows * c.layers : 0;
  }

  // ---------------------------------------------------------------- bodies

  /** Glowing lamp faces (switched on with the headlights). */
  private lamps(group: THREE.Group, front: Lamp[], tail: Lamp[]): void {
    const make = (l: Lamp, m: THREE.Material) => {
      const geo = l.round ? new THREE.CylinderGeometry(l.w / 2, l.w / 2, 0.05, 12).rotateX(Math.PI / 2) : new THREE.BoxGeometry(l.w, l.h, 0.05);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(...l.p);
      group.add(mesh);
    };
    for (const l of front) make(l, this.lampMat);
    for (const l of tail) make(l, this.tailMat);
  }

  /** Wheel pivots and the shadow, on the root. */
  private underGroup(wheels: [number, number][], r: number, geoFront: THREE.BufferGeometry, geoRear: THREE.BufferGeometry, shadow: [number, number], out: Body): void {
    for (const [x, z] of wheels) {
      const front = z < 0;
      const pivot = new THREE.Group();
      pivot.position.set(x, r, z);
      const w = new THREE.Mesh(front ? geoFront : geoRear, this.mat);
      pivot.add(w);
      out.under.add(pivot);
      out.wheels.push(w);
      if (front) out.frontWheels.push(w);
    }
    out.under.add(blobShadow(...shadow));
  }

  private emptyBody(r: number, crates: CrateLayout | null, lampZ: number): Body {
    return { group: new THREE.Group(), under: new THREE.Group(), wheels: [], frontWheels: [], wheelRadius: r, cab: [], tassels: null, back: null, backArt: null, crates, lampZ };
  }

  /**
   * The classic Bangladeshi highway truck: a Tata SE 1613-style cab with a short nose, a wooden body with high
   * sides built at a local body shop, a wooden "crown" (mukut) over the cab, truck art all round, tassels.
   */
  private buildOpen(): Body {
    const spec = TRUCKS.open;
    const b = this.emptyBody(spec.wheelRadius, OPEN_CRATES, -4.2);
    const g = b.group;
    const mat = this.mat;
    const WOOD = 0x7a5530;
    const POST = 0x4f3318;

    const chassis: Part[] = [
      { geo: box(2.2, 0.4, 7.7), color: 0x2a2a2a, p: [0, 0.95, 0.1] },
      // cargo bed floor and wooden sides
      { geo: box(2.5, 0.2, 5.5), color: 0x6b4a2a, p: [0, 1.3, 1.25] },
      { geo: box(0.1, 1.4, 5.5), color: WOOD, p: [-1.22, 2.1, 1.25] },
      { geo: box(0.1, 1.4, 5.5), color: WOOD, p: [1.22, 2.1, 1.25] },
      { geo: box(2.5, 1.4, 0.1), color: WOOD, p: [0, 2.1, -1.47] },
      { geo: box(2.5, 1.4, 0.1), color: WOOD, p: [0, 2.1, 3.98] },
      // tarpaulin rolled up on top of the front wall, ready for the rain
      { geo: cyl(0.17, 0.17, 2.4, 8), color: 0x2f5d3a, p: [0, 2.96, -1.32], r: [0, 0, Math.PI / 2] },
      // rear bumper / mudflaps (red tops) / tail lamps / number plate
      { geo: box(2.5, 0.25, 0.2), color: 0xc1121f, p: [0, 0.85, 4.05] },
      { geo: box(0.5, 0.6, 0.05), color: 0x111111, p: [-0.95, 0.55, 3.75] },
      { geo: box(0.5, 0.6, 0.05), color: 0x111111, p: [0.95, 0.55, 3.75] },
      { geo: box(0.5, 0.1, 0.06), color: 0xc1121f, p: [-0.95, 0.88, 3.75] },
      { geo: box(0.5, 0.1, 0.06), color: 0xc1121f, p: [0.95, 0.88, 3.75] },
      { geo: box(0.3, 0.15, 0.06), color: 0xff3b30, p: [-1.0, 1.05, 4.16] },
      { geo: box(0.3, 0.15, 0.06), color: 0xff3b30, p: [1.0, 1.05, 4.16] },
      { geo: box(0.55, 0.18, 0.04), color: 0xf4f4f4, p: [0, 1.08, 4.17] },
      // fuel tank and battery box between the axles, side under-run rails
      { geo: cyl(0.27, 0.27, 1.0, 10), color: 0xb8b8b8, p: [-0.82, 0.78, -1.0], r: [Math.PI / 2, 0, 0] },
      { geo: box(0.45, 0.4, 0.55), color: 0x1d1d1d, p: [0.85, 0.8, -1.0] },
      { geo: box(0.05, 0.08, 3.5), color: 0xf4c542, p: [-1.2, 0.72, -0.3] },
      { geo: box(0.05, 0.08, 3.5), color: 0xf4c542, p: [1.2, 0.72, -0.3] },
      // exhaust stack on the back corner of the cab (spec.pipe is its top)
      { geo: cyl(0.09, 0.09, 2.5, 8), color: 0x3a3a3a, p: [1.33, 2.35, -1.75] },
      { geo: cyl(0.11, 0.11, 0.35, 8), color: 0x9a9a9a, p: [1.33, 3.45, -1.75] },
      // front bumper with a chrome strip
      { geo: box(2.55, 0.32, 0.25), color: 0xc1121f, p: [0, 0.82, -4.0] },
      { geo: box(2.55, 0.05, 0.03), color: CHROME, p: [0, 0.9, -4.14] },
    ];
    // wooden posts on the sides with brass caps, top rail, rope hooks along the bottom
    for (const z of [-1.42, -0.3, 2.8, 3.93]) {
      for (const x of [-1.31, 1.31]) {
        chassis.push({ geo: box(0.08, 1.48, 0.1), color: POST, p: [x, 2.1, z] });
        chassis.push({ geo: box(0.1, 0.08, 0.12), color: 0xe0b23a, p: [x, 2.86, z] });
      }
    }
    for (const x of [-1.3, 1.3]) {
      chassis.push({ geo: box(0.1, 0.08, 5.55), color: 0xf4c542, p: [x, 2.82, 1.25] });
      for (let z = -1.1; z < 3.9; z += 0.7) chassis.push({ geo: box(0.08, 0.06, 0.08), color: 0x777777, p: [x * 1.02, 1.4, z] });
    }
    g.add(new THREE.Mesh(buildColored(chassis), mat));

    const YELLOW = 0xf4a300;
    const cabParts: Part[] = [
      { geo: box(2.4, 1.85, 2.0), color: YELLOW, p: [0, 2.1, -2.6] },
      // the short nose over the engine
      { geo: box(2.3, 0.9, 0.7), color: YELLOW, p: [0, 1.5, -3.8] },
      { geo: box(2.32, 0.06, 0.72), color: 0xe63946, p: [0, 1.97, -3.8] },
      // grille with chrome slats and round headlamps in chrome rings
      { geo: box(1.3, 0.55, 0.06), color: 0x2b2b2b, p: [0, 1.5, -4.16] },
      // windscreen in two halves, side windows
      { geo: box(2.15, 0.8, 0.06), color: GLASS, p: [0, 2.45, -3.61] },
      { geo: box(0.07, 0.82, 0.07), color: YELLOW, p: [0, 2.45, -3.63] },
      { geo: box(0.06, 0.65, 1.0), color: GLASS, p: [-1.21, 2.45, -2.75] },
      { geo: box(0.06, 0.65, 1.0), color: GLASS, p: [1.21, 2.45, -2.75] },
      // painted bands, roof
      { geo: box(2.42, 0.12, 2.02), color: 0x2a9d8f, p: [0, 3.06, -2.6] },
      { geo: box(2.42, 0.18, 2.02), color: 0xe63946, p: [0, 1.25, -2.6] },
      // door shut lines, handles, steps
      { geo: box(0.03, 1.5, 0.03), color: 0x7a5200, p: [-1.215, 2.0, -2.05] },
      { geo: box(0.03, 1.5, 0.03), color: 0x7a5200, p: [1.215, 2.0, -2.05] },
      { geo: box(0.04, 0.05, 0.2), color: CHROME, p: [-1.23, 2.05, -2.25] },
      { geo: box(0.04, 0.05, 0.2), color: CHROME, p: [1.23, 2.05, -2.25] },
      { geo: box(0.3, 0.06, 0.5), color: 0x222222, p: [-1.2, 1.0, -2.95] },
      { geo: box(0.3, 0.06, 0.5), color: 0x222222, p: [1.2, 1.0, -2.95] },
      // mirrors on long arms
      { geo: box(0.08, 0.45, 0.25), color: 0x111111, p: [-1.45, 2.4, -3.3] },
      { geo: box(0.08, 0.45, 0.25), color: 0x111111, p: [1.45, 2.4, -3.3] },
      { geo: box(0.3, 0.05, 0.05), color: 0x777777, p: [-1.3, 2.6, -3.3] },
      { geo: box(0.3, 0.05, 0.05), color: 0x777777, p: [1.3, 2.6, -3.3] },
    ];
    for (let i = 0; i < 4; i++) cabParts.push({ geo: box(1.25, 0.04, 0.03), color: CHROME, p: [0, 1.32 + i * 0.12, -4.2] });
    for (const x of [-0.88, 0.88]) {
      cabParts.push({ geo: cyl(0.2, 0.2, 0.06, 14), color: CHROME, p: [x, 1.55, -4.16], r: [Math.PI / 2, 0, 0] });
      cabParts.push({ geo: cyl(0.15, 0.15, 0.06, 14), color: 0xfff6c0, p: [x, 1.55, -4.19], r: [Math.PI / 2, 0, 0] });
      cabParts.push({ geo: box(0.16, 0.09, 0.05), color: 0xff9f1c, p: [x, 1.22, -4.17] });
    }
    const cab = new THREE.Mesh(buildColored(cabParts), mat);

    // The crown: a tall wooden box on the cab roof jutting out over the windscreen, painted and trimmed with brass
    const crownParts: Part[] = [
      { geo: box(2.5, 0.7, 2.3), color: 0xe63946, p: [0, 3.47, -2.5] },
      { geo: box(2.54, 0.07, 2.34), color: 0xe0b23a, p: [0, 3.84, -2.5] },
      { geo: box(2.54, 0.07, 2.34), color: 0xe0b23a, p: [0, 3.12, -2.5] },
      // sun visor over the windscreen
      { geo: box(2.5, 0.08, 0.35), color: 0x1d3557, p: [0, 3.06, -3.75] },
      { geo: box(0.04, 0.5, 2.1), color: 0x2a9d8f, p: [-1.27, 3.47, -2.5] },
      { geo: box(0.04, 0.5, 2.1), color: 0x2a9d8f, p: [1.27, 3.47, -2.5] },
    ];
    // brass finials along the top front edge
    for (let i = 0; i < 5; i++) crownParts.push({ geo: cone(0.06, 0.28, 6), color: 0xe0b23a, p: [-1.1 + i * 0.55, 4.0, -3.55] });
    const crown = new THREE.Mesh(buildColored(crownParts), mat);

    // Truck-art panels
    const sideMat = new THREE.MeshLambertMaterial({ map: truckArtTexture('side') });
    const sideGeo = new THREE.PlaneGeometry(5.5, 1.4);
    const left = new THREE.Mesh(sideGeo, sideMat);
    left.position.set(-1.28, 2.1, 1.25);
    left.rotation.y = -Math.PI / 2;
    const right = new THREE.Mesh(sideGeo, sideMat);
    right.position.set(1.28, 2.1, 1.25);
    right.rotation.y = Math.PI / 2;
    b.backArt = new THREE.MeshLambertMaterial({ map: truckArtTexture('back') });
    const back = (b.back = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.4), b.backArt));
    back.position.set(0, 2.1, 4.04);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshLambertMaterial({ map: truckArtTexture('front') }));
    front.position.set(0, 3.47, -3.66);
    front.rotation.y = Math.PI;
    b.tassels = new THREE.Mesh(buildColored(tasselStrand(12, 2.3, 0.5, -4.12)), mat);
    g.add(cab, crown, left, right, back, front, b.tassels);
    b.cab.push(cab, crown, front);

    this.lamps(g, [{ p: [-0.88, 1.55, -4.2], w: 0.3, h: 0.3, round: true }, { p: [0.88, 1.55, -4.2], w: 0.3, h: 0.3, round: true }],
      [{ p: [-1.0, 1.05, 4.19], w: 0.32, h: 0.17 }, { p: [1.0, 1.05, 4.19], w: 0.32, h: 0.17 }]);
    const wheel = wheelGeometry(0.52, 0.42, 0xbdbdbd);
    this.underGroup(spec.wheels, spec.wheelRadius, wheel, wheel, [3.4, 9.5], b);
    return b;
  }

  /**
   * A 12-tonne covered van: flat-fronted cab-over (white, blue band, black grille), then a steel box body with
   * corrugated sides, painted company lettering and two rear doors with full-height locking bars.
   */
  private buildCovered(): Body {
    const spec = TRUCKS.covered;
    const b = this.emptyBody(spec.wheelRadius, null, -3.98);
    const g = b.group;
    const mat = this.mat;
    const BLUE = 0x1f4e8c;
    const RIB = 0x173e70;
    const RAIL = 0xc9cdd1;
    const BOX = { z0: -1.9, z1: 3.85, y0: 1.25, y1: 3.95 };
    const boxLen = BOX.z1 - BOX.z0;
    const boxZ = (BOX.z0 + BOX.z1) / 2;
    const boxH = BOX.y1 - BOX.y0;
    const boxY = (BOX.y0 + BOX.y1) / 2;

    const parts: Part[] = [
      // ladder frame, fuel tank, side guards
      { geo: box(1.9, 0.3, 7.6), color: 0x262626, p: [0, 0.9, -0.05] },
      { geo: cyl(0.26, 0.26, 0.95, 10), color: 0xb8b8b8, p: [-0.82, 0.78, -1.15], r: [Math.PI / 2, 0, 0] },
      { geo: box(0.45, 0.4, 0.5), color: 0x1d1d1d, p: [0.85, 0.8, -1.2] },
      { geo: box(0.05, 0.08, 3.6), color: RAIL, p: [-1.2, 0.75, -0.2] },
      { geo: box(0.05, 0.08, 3.6), color: RAIL, p: [1.2, 0.75, -0.2] },
      // box body
      { geo: box(2.5, boxH, boxLen), color: BLUE, p: [0, boxY, boxZ] },
      { geo: box(2.56, 0.1, boxLen + 0.04), color: RAIL, p: [0, BOX.y1 - 0.03, boxZ] },
      { geo: box(2.56, 0.12, boxLen + 0.04), color: RAIL, p: [0, BOX.y0 + 0.04, boxZ] },
      // rear wheel arches
      { geo: box(0.62, 0.08, 1.3), color: 0x111111, p: [-1.05, 1.17, spec.wheels[2][1]] },
      { geo: box(0.62, 0.08, 1.3), color: 0x111111, p: [1.05, 1.17, spec.wheels[2][1]] },
      // rear door frame, doors, hinges, locking bars
      { geo: box(2.56, boxH + 0.04, 0.06), color: RAIL, p: [0, boxY, BOX.z1 + 0.02] },
      { geo: box(1.2, boxH - 0.16, 0.04), color: BLUE, p: [-0.62, boxY, BOX.z1 + 0.06] },
      { geo: box(1.2, boxH - 0.16, 0.04), color: BLUE, p: [0.62, boxY, BOX.z1 + 0.06] },
      { geo: box(0.03, boxH - 0.16, 0.05), color: 0x0d2240, p: [0, boxY, BOX.z1 + 0.07] },
      // rear bumper with red/white reflective blocks, tail lamps, number plate, mudflaps
      { geo: box(2.45, 0.22, 0.18), color: 0x2a2a2a, p: [0, 0.95, BOX.z1 + 0.1] },
      { geo: box(0.3, 0.15, 0.06), color: 0xff3b30, p: [-1.0, 1.05, BOX.z1 + 0.2] },
      { geo: box(0.3, 0.15, 0.06), color: 0xff3b30, p: [1.0, 1.05, BOX.z1 + 0.2] },
      { geo: box(0.55, 0.18, 0.04), color: 0xf4f4f4, p: [0, 0.95, BOX.z1 + 0.2] },
      { geo: box(0.5, 0.55, 0.05), color: 0x111111, p: [-1.0, 0.55, 3.05] },
      { geo: box(0.5, 0.55, 0.05), color: 0x111111, p: [1.0, 0.55, 3.05] },
      // exhaust stack in the gap between cab and box (spec.pipe is its top)
      { geo: cyl(0.075, 0.075, 2.5, 8), color: 0x3a3a3a, p: [spec.pipe[0], 2.4, spec.pipe[2]] },
      { geo: cyl(0.095, 0.095, 0.3, 8), color: 0x9a9a9a, p: [spec.pipe[0], 3.55, spec.pipe[2]] },
    ];
    for (let i = 0; i < 6; i++) {
      parts.push({ geo: box(0.2, 0.2, 0.05), color: i % 2 ? 0xffffff : 0xd62828, p: [-1.05 + i * 0.42, 0.95, BOX.z1 + 0.2] });
    }
    // corrugation: vertical ribs every ~32 cm down both sides, corner posts
    for (let z = BOX.z0 + 0.2; z < BOX.z1 - 0.1; z += 0.32) {
      for (const x of [-1.265, 1.265]) parts.push({ geo: box(0.04, boxH - 0.22, 0.08), color: RIB, p: [x, boxY, z] });
    }
    for (const x of [-1.26, 1.26]) {
      for (const z of [BOX.z0, BOX.z1]) parts.push({ geo: box(0.1, boxH, 0.1), color: RAIL, p: [x, boxY, z] });
    }
    for (const x of [-0.95, -0.28, 0.28, 0.95]) {
      parts.push({ geo: cyl(0.025, 0.025, boxH - 0.1, 6), color: CHROME, p: [x, boxY, BOX.z1 + 0.11] });
      parts.push({ geo: box(0.05, 0.05, 0.12), color: CHROME, p: [x, BOX.y0 + 0.15, BOX.z1 + 0.1] });
      parts.push({ geo: box(0.05, 0.05, 0.12), color: CHROME, p: [x, BOX.y1 - 0.15, BOX.z1 + 0.1] });
    }
    for (const x of [-0.95, 0.28]) parts.push({ geo: box(0.3, 0.05, 0.06), color: CHROME, p: [x + 0.15, 1.95, BOX.z1 + 0.14] });
    for (const y of [1.7, 2.6, 3.5]) {
      for (const x of [-1.2, 1.2]) parts.push({ geo: box(0.12, 0.14, 0.06), color: 0x777777, p: [x, y, BOX.z1 + 0.1] });
    }
    g.add(new THREE.Mesh(buildColored(parts), mat));

    const WHITE = 0xf2f2ee;
    const cabParts: Part[] = [
      { geo: box(2.36, 1.15, 1.85), color: WHITE, p: [0, 1.6, -3.0] },
      { geo: box(2.36, 0.95, 1.75), color: WHITE, p: [0, 2.65, -2.95] },
      { geo: box(2.3, 0.1, 1.7), color: WHITE, p: [0, 3.17, -2.95] },
      // blue and red bands round the cab
      { geo: box(2.38, 0.14, 1.87), color: BLUE, p: [0, 2.08, -3.0] },
      { geo: box(2.38, 0.05, 1.87), color: 0xc1121f, p: [0, 1.95, -3.0] },
      // raked windscreen with a centre bar, sun visor
      { geo: box(2.1, 0.82, 0.05), color: GLASS, p: [0, 2.64, -3.84], r: [-0.08, 0, 0] },
      { geo: box(0.05, 0.84, 0.06), color: WHITE, p: [0, 2.64, -3.86], r: [-0.08, 0, 0] },
      { geo: box(2.2, 0.12, 0.28), color: 0x1a1a1a, p: [0, 3.1, -3.92] },
      // black grille with slats, rectangular headlamps, indicators
      { geo: box(1.5, 0.44, 0.05), color: 0x1c1c1c, p: [0, 1.5, -3.95] },
      { geo: box(0.36, 0.22, 0.05), color: 0xfff6c0, p: [-0.88, 1.3, -3.95] },
      { geo: box(0.36, 0.22, 0.05), color: 0xfff6c0, p: [0.88, 1.3, -3.95] },
      { geo: box(0.14, 0.12, 0.05), color: 0xff9f1c, p: [-1.1, 1.3, -3.95] },
      { geo: box(0.14, 0.12, 0.05), color: 0xff9f1c, p: [1.1, 1.3, -3.95] },
      // bumper with fog lamps
      { geo: box(2.45, 0.3, 0.25), color: 0x3a3a3a, p: [0, 0.95, -3.98] },
      { geo: box(0.2, 0.1, 0.04), color: 0xfff6c0, p: [-0.75, 0.95, -4.12] },
      { geo: box(0.2, 0.1, 0.04), color: 0xfff6c0, p: [0.75, 0.95, -4.12] },
      // side windows, door shut lines, handles, two steps a side
      { geo: box(0.04, 0.6, 0.95), color: GLASS, p: [-1.19, 2.62, -3.1] },
      { geo: box(0.04, 0.6, 0.95), color: GLASS, p: [1.19, 2.62, -3.1] },
      { geo: box(0.03, 2.0, 0.03), color: 0x9a9a9a, p: [-1.185, 2.05, -2.45] },
      { geo: box(0.03, 2.0, 0.03), color: 0x9a9a9a, p: [1.185, 2.05, -2.45] },
      { geo: box(0.04, 0.05, 0.2), color: 0x333333, p: [-1.2, 2.2, -2.65] },
      { geo: box(0.04, 0.05, 0.2), color: 0x333333, p: [1.2, 2.2, -2.65] },
      { geo: box(0.25, 0.05, 0.4), color: 0x222222, p: [-1.13, 0.75, -3.4] },
      { geo: box(0.25, 0.05, 0.4), color: 0x222222, p: [1.13, 0.75, -3.4] },
      { geo: box(0.2, 0.05, 0.4), color: 0x222222, p: [-1.15, 1.15, -3.4] },
      { geo: box(0.2, 0.05, 0.4), color: 0x222222, p: [1.15, 1.15, -3.4] },
      // front wheel arches
      { geo: box(0.5, 0.1, 1.15), color: 0x111111, p: [-1.05, 1.06, spec.wheels[0][1]] },
      { geo: box(0.5, 0.1, 1.15), color: 0x111111, p: [1.05, 1.06, spec.wheels[0][1]] },
      // big mirrors on arms reaching forward
      { geo: box(0.35, 0.04, 0.04), color: 0x777777, p: [-1.35, 2.85, -3.6] },
      { geo: box(0.35, 0.04, 0.04), color: 0x777777, p: [1.35, 2.85, -3.6] },
      { geo: box(0.06, 0.5, 0.22), color: 0x111111, p: [-1.52, 2.62, -3.6] },
      { geo: box(0.06, 0.5, 0.22), color: 0x111111, p: [1.52, 2.62, -3.6] },
    ];
    for (let i = 0; i < 3; i++) cabParts.push({ geo: box(1.4, 0.04, 0.03), color: CHROME, p: [0, 1.38 + i * 0.12, -3.98] });
    const cab = new THREE.Mesh(buildColored(cabParts), mat);

    // painted lettering on both sides, truck art on the front of the box above the cab
    const sideMat = new THREE.MeshLambertMaterial({ map: coveredVanSideTexture(), transparent: true });
    const sideGeo = new THREE.PlaneGeometry(boxLen - 0.3, boxH - 0.22);
    const left = new THREE.Mesh(sideGeo, sideMat);
    left.position.set(-1.29, boxY, boxZ);
    left.rotation.y = -Math.PI / 2;
    const right = new THREE.Mesh(sideGeo, sideMat);
    right.position.set(1.29, boxY, boxZ);
    right.rotation.y = Math.PI / 2;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshLambertMaterial({ map: truckArtTexture('front') }));
    front.position.set(0, 3.58, BOX.z0 - 0.02);
    front.rotation.y = Math.PI;
    // the ad goes on the upper half of the rear doors, behind the locking bars
    b.backArt = new THREE.MeshLambertMaterial({ map: truckArtTexture('back') });
    const back = (b.back = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.25), b.backArt));
    back.position.set(0, 3.05, BOX.z1 + 0.085);
    b.tassels = new THREE.Mesh(buildColored(tasselStrand(11, 2.2, 0.62, -4.1)), mat);
    g.add(cab, left, right, front, back, b.tassels);
    b.cab.push(cab);

    this.lamps(g, [{ p: [-0.88, 1.3, -3.98], w: 0.36, h: 0.22 }, { p: [0.88, 1.3, -3.98], w: 0.36, h: 0.22 }],
      [{ p: [-1.0, 1.05, BOX.z1 + 0.23], w: 0.32, h: 0.17 }, { p: [1.0, 1.05, BOX.z1 + 0.23], w: 0.32, h: 0.17 }]);
    this.underGroup(spec.wheels, spec.wheelRadius, wheelGeometry(0.5, 0.36, 0xbdbdbd), wheelGeometry(0.5, 0.56, 0xbdbdbd, true), [3.3, 9.3], b);
    return b;
  }

  /**
   * A one-tonne single-cab pickup: tall flat bonnet with a vertical-slat chrome grille, white body with a side
   * stripe, a low steel bed and the tube rack Bangladeshi pickups carry to pile the load high.
   */
  private buildPickup(): Body {
    const spec = TRUCKS.pickup;
    const b = this.emptyBody(spec.wheelRadius, PICKUP_CRATES, -2.55);
    const g = b.group;
    const mat = this.mat;
    const WHITE = 0xf3f3f0;
    const RACK = 0x8d8d8d;
    const rake = Math.atan2(0.35, 0.55);

    const parts: Part[] = [
      { geo: box(1.2, 0.18, 4.9), color: 0x222222, p: [0, 0.55, 0] },
      // bed: floor, sides, front wall, tailgate, top rails
      { geo: box(1.72, 0.08, 2.15), color: 0x6e6e6e, p: [0, 0.92, 1.47] },
      { geo: box(0.05, 0.5, 2.15), color: WHITE, p: [-0.86, 1.17, 1.47] },
      { geo: box(0.05, 0.5, 2.15), color: WHITE, p: [0.86, 1.17, 1.47] },
      { geo: box(1.72, 0.5, 0.05), color: WHITE, p: [0, 1.17, 0.42] },
      { geo: box(1.72, 0.5, 0.05), color: WHITE, p: [0, 1.17, 2.52] },
      { geo: box(0.08, 0.04, 2.15), color: 0xaaaaaa, p: [-0.86, 1.43, 1.47] },
      { geo: box(0.08, 0.04, 2.15), color: 0xaaaaaa, p: [0.86, 1.43, 1.47] },
      { geo: box(1.72, 0.04, 0.08), color: 0xaaaaaa, p: [0, 1.43, 2.52] },
      // rear wheel arches, upright tail lamps, step bumper, number plate, tailpipe, mudflaps
      { geo: box(0.08, 0.14, 0.92), color: 0x222222, p: [-0.89, 0.82, spec.wheels[2][1]] },
      { geo: box(0.08, 0.14, 0.92), color: 0x222222, p: [0.89, 0.82, spec.wheels[2][1]] },
      { geo: box(0.1, 0.32, 0.05), color: 0xff3b30, p: [-0.81, 1.15, 2.56] },
      { geo: box(0.1, 0.32, 0.05), color: 0xff3b30, p: [0.81, 1.15, 2.56] },
      { geo: box(1.5, 0.12, 0.16), color: 0x2a2a2a, p: [0, 0.6, 2.6] },
      { geo: box(0.45, 0.14, 0.04), color: 0xf4f4f4, p: [0, 0.78, 2.6] },
      { geo: cyl(0.04, 0.04, 0.35, 6), color: 0x555555, p: [spec.pipe[0], spec.pipe[1], spec.pipe[2] - 0.2], r: [Math.PI / 2, 0, 0] },
      { geo: box(0.36, 0.38, 0.04), color: 0x111111, p: [-0.8, 0.45, 2.05] },
      { geo: box(0.36, 0.38, 0.04), color: 0x111111, p: [0.8, 0.45, 2.05] },
    ];
    // The rack: posts at the corners and middle, rails along the top and halfway up, cross bars, and a
    // sloping front that reaches over the cab roof
    const RX = 0.84;
    const RTOP = 2.45;
    for (const z of [0.45, 1.5, 2.5]) {
      for (const x of [-RX, RX]) parts.push(post(x, z, 1.42, RTOP, 0.025, RACK));
      parts.push(railX(RTOP, z, RX * 2, 0.025, RACK));
    }
    for (const x of [-RX, RX]) {
      parts.push(railZ(x, RTOP, 0.45, 2.5, 0.025, RACK));
      parts.push(railZ(x, 1.95, 0.45, 2.5, 0.02, RACK));
      parts.push({ geo: cyl(0.025, 0.025, 0.72, 6), color: RACK, p: [x, 2.3, 0.125], r: [Math.atan2(0.91, 0.42), 0, 0] });
    }
    parts.push(railX(2.15, -0.2, RX * 2, 0.025, RACK));
    g.add(new THREE.Mesh(buildColored(parts), mat));

    const cabParts: Part[] = [
      // bonnet and front bumper
      { geo: box(1.74, 0.55, 1.3), color: WHITE, p: [0, 1.05, -1.85] },
      { geo: box(1.85, 0.22, 0.2), color: 0x9a9a9a, p: [0, 0.62, -2.5] },
      // vertical-slat chrome grille, square headlamps, indicators
      { geo: box(1.0, 0.32, 0.04), color: 0x151515, p: [0, 1.08, -2.51] },
      { geo: box(0.34, 0.24, 0.04), color: CHROME, p: [-0.68, 1.1, -2.51] },
      { geo: box(0.34, 0.24, 0.04), color: CHROME, p: [0.68, 1.1, -2.51] },
      { geo: box(0.28, 0.18, 0.04), color: 0xfff6c0, p: [-0.68, 1.1, -2.53] },
      { geo: box(0.28, 0.18, 0.04), color: 0xfff6c0, p: [0.68, 1.1, -2.53] },
      { geo: box(0.2, 0.07, 0.04), color: 0xff9f1c, p: [-0.68, 0.93, -2.52] },
      { geo: box(0.2, 0.07, 0.04), color: 0xff9f1c, p: [0.68, 0.93, -2.52] },
      // front wheel arches
      { geo: box(0.1, 0.16, 0.95), color: 0x222222, p: [-0.88, 0.82, spec.wheels[0][1]] },
      { geo: box(0.1, 0.16, 0.95), color: 0x222222, p: [0.88, 0.82, spec.wheels[0][1]] },
      // cab: lower half, glasshouse, roof
      { geo: box(1.76, 0.6, 1.55), color: WHITE, p: [0, 1.075, -0.43] },
      { geo: box(1.7, 0.55, 1.2), color: WHITE, p: [0, 1.65, -0.25] },
      { geo: box(1.72, 0.05, 1.22), color: WHITE, p: [0, 1.95, -0.25] },
      // raked windscreen on its pillars
      { geo: box(1.72, 0.652, 0.3), color: WHITE, p: [0, 1.565, -0.9], r: [rake, 0, 0] },
      { geo: box(1.56, 0.6, 0.04), color: GLASS, p: [0, 1.66, -1.04], r: [rake, 0, 0] },
      // side windows, rear window, door shut lines, handles
      { geo: box(0.03, 0.42, 0.62), color: GLASS, p: [-0.86, 1.66, -0.42] },
      { geo: box(0.03, 0.42, 0.62), color: GLASS, p: [0.86, 1.66, -0.42] },
      { geo: box(1.4, 0.38, 0.03), color: GLASS, p: [0, 1.68, 0.36] },
      { geo: box(0.02, 1.1, 0.02), color: 0xb0b0b0, p: [-0.885, 1.3, 0.05] },
      { geo: box(0.02, 1.1, 0.02), color: 0xb0b0b0, p: [0.885, 1.3, 0.05] },
      { geo: box(0.03, 0.04, 0.14), color: 0x333333, p: [-0.89, 1.32, -0.12] },
      { geo: box(0.03, 0.04, 0.14), color: 0x333333, p: [0.89, 1.32, -0.12] },
      // body stripe along the bonnet and doors
      { geo: box(1.78, 0.05, 2.7), color: 0xc1121f, p: [0, 1.17, -1.15] },
      { geo: box(1.78, 0.03, 2.7), color: 0x1d3557, p: [0, 1.11, -1.15] },
      // mirrors
      { geo: box(0.06, 0.18, 0.14), color: 0x111111, p: [-0.98, 1.5, -0.95] },
      { geo: box(0.06, 0.18, 0.14), color: 0x111111, p: [0.98, 1.5, -0.95] },
      { geo: box(0.12, 0.03, 0.03), color: 0x333333, p: [-0.92, 1.5, -0.95] },
      { geo: box(0.12, 0.03, 0.03), color: 0x333333, p: [0.92, 1.5, -0.95] },
    ];
    for (let x = -0.4; x <= 0.41; x += 0.16) cabParts.push({ geo: box(0.035, 0.3, 0.03), color: CHROME, p: [x, 1.08, -2.54] });
    const cab = new THREE.Mesh(buildColored(cabParts), mat);

    const tailgate = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.46), new THREE.MeshLambertMaterial({ map: pickupTailgateTexture() }));
    tailgate.position.set(0, 1.17, 2.548);
    // a flex banner tied to the back of the rack carries the ad
    b.backArt = new THREE.MeshLambertMaterial({ map: truckArtTexture('back') });
    const back = (b.back = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.9), b.backArt));
    back.position.set(0, 1.97, 2.53);
    b.tassels = new THREE.Mesh(buildColored(tasselStrand(8, 1.6, 0.36, -2.62)), mat);
    g.add(cab, tailgate, back, b.tassels);
    b.cab.push(cab);

    this.lamps(g, [{ p: [-0.68, 1.1, -2.56], w: 0.28, h: 0.18 }, { p: [0.68, 1.1, -2.56], w: 0.28, h: 0.18 }],
      [{ p: [-0.81, 1.15, 2.59], w: 0.1, h: 0.32 }, { p: [0.81, 1.15, 2.59], w: 0.1, h: 0.32 }]);
    const wheel = wheelGeometry(0.38, 0.26, 0xcfcfcf);
    this.underGroup(spec.wheels, spec.wheelRadius, wheel, wheel, [2.3, 6.2], b);
    return b;
  }

  // ---------------------------------------------------------------- state

  /** 0 = off (bright day) … 1 = full night beams */
  setHeadlights(level: number): void {
    this.spot.intensity = level * 60;
    this.lampMat.opacity = Math.min(1, level * 1.5);
    this.tailMat.opacity = Math.min(1, level * 1.5);
    this.poolMat.opacity = level * 0.35;
  }

  /** Every run the tailboard carries a random ad (truck art only when the ads/ folder is empty). */
  shuffleRearAd(): void {
    const ads = adMaterials();
    this.ad = ads.length ? ads[Math.floor(Math.random() * ads.length)] : null;
    const b = this.cur;
    if (b.back) b.back.material = this.ad ?? b.backArt!;
  }

  setCrates(colors: number[]): void {
    this.crateColors = colors;
    const L = this.cur.crates;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const n = L ? Math.min(colors.length, L.cols * L.rows * L.layers) : 0;
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / (L!.cols * L!.rows));
      const k = i % (L!.cols * L!.rows);
      const row = Math.floor(k / L!.cols);
      const col = k % L!.cols;
      const jitter = ((i * 7919) % 10) / 100;
      const x = L!.x0 + col * L!.dx;
      const y = L!.y0 + layer * L!.dy;
      const z = L!.z0 - row * L!.dz;
      m.makeRotationY(jitter - 0.05).setPosition(x, y, z);
      this.crates.setMatrixAt(i, m);
      m.makeRotationY(jitter - 0.05).setPosition(x, y + 0.3, z);
      this.produce.setMatrixAt(i, m);
      this.produce.setColorAt(i, c.set(colors[i]));
    }
    this.crates.count = this.produce.count = n;
    this.crates.instanceMatrix.needsUpdate = true;
    this.produce.instanceMatrix.needsUpdate = true;
    if (this.produce.instanceColor) this.produce.instanceColor.needsUpdate = true;
  }

  setCockpit(on: boolean): void {
    this.cockpit = on;
    for (const o of this.cur.cab) o.visible = !on;
    if (this.cur.tassels) this.cur.tassels.visible = !on;
  }

  /** Sync the model with the simulation. */
  update(dt: number, x: number, y: number, z: number, heading: number, pitch: number, speed: number, steer: number, yawRate: number, bump: number): void {
    const b = this.cur;
    this.root.position.set(x, y, z);
    this.root.rotation.set(pitch, -heading, 0, 'YXZ');
    this.wheelSpin -= ((speed * WORLD.speedScale) / b.wheelRadius) * dt;
    for (const w of b.wheels) w.rotation.x = this.wheelSpin;
    for (const w of b.frontWheels) w.parent!.rotation.y = -steer * 0.45;
    // body roll outward in turns and a little bounce
    const roll = THREE.MathUtils.clamp(yawRate * speed * 0.012, -0.08, 0.08);
    this.body.rotation.z += (roll - this.body.rotation.z) * Math.min(1, dt * 5);
    this.body.position.y = bump;
    if (b.tassels) b.tassels.rotation.x = Math.sin(performance.now() * 0.012) * 0.04 * Math.min(1, Math.abs(speed) / 10);
  }
}
