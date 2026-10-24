// The player's truck: Bangladeshi truck-art body, tassels, spinning wheels and crates that fill with cargo.

import * as THREE from 'three';
import { WORLD } from '../config/tuning';
import { blobShadow, box, buildColored, cone, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { truckArtTexture } from '../utils/textures';

const CRATE_COLS = 3;
const CRATE_ROWS = 6;
const CRATE_LAYERS = 3;
export const MAX_CRATES = CRATE_COLS * CRATE_ROWS * CRATE_LAYERS;

export class Truck {
  readonly root = new THREE.Group();
  /** pitch/roll/bounce happen on this inner group */
  private body = new THREE.Group();
  private cab: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private frontWheels: THREE.Mesh[] = [];
  private crates: THREE.InstancedMesh;
  private produce: THREE.InstancedMesh;
  private tassels: THREE.Mesh;
  private wheelSpin = 0;

  constructor() {
    this.root.add(this.body);
    const mat = vertexColorMaterial();

    const chassis: Part[] = [
      { geo: box(2.2, 0.4, 7.7), color: 0x2a2a2a, p: [0, 0.95, 0.1] },
      // cargo bed floor and wooden sides
      { geo: box(2.5, 0.2, 5.5), color: 0x6b4a2a, p: [0, 1.3, 1.25] },
      { geo: box(0.1, 1.4, 5.5), color: 0x7a5530, p: [-1.22, 2.1, 1.25] },
      { geo: box(0.1, 1.4, 5.5), color: 0x7a5530, p: [1.22, 2.1, 1.25] },
      { geo: box(2.5, 1.4, 0.1), color: 0x7a5530, p: [0, 2.1, -1.47] },
      { geo: box(2.5, 1.4, 0.1), color: 0x7a5530, p: [0, 2.1, 3.98] },
      // rear bumper / mudflaps
      { geo: box(2.5, 0.25, 0.2), color: 0xc1121f, p: [0, 0.85, 4.05] },
      { geo: box(0.5, 0.6, 0.05), color: 0x111111, p: [-0.95, 0.55, 3.35] },
      { geo: box(0.5, 0.6, 0.05), color: 0x111111, p: [0.95, 0.55, 3.35] },
      { geo: box(0.3, 0.15, 0.06), color: 0xff3b30, p: [-1.0, 1.05, 4.16] },
      { geo: box(0.3, 0.15, 0.06), color: 0xff3b30, p: [1.0, 1.05, 4.16] },
      // front bumper
      { geo: box(2.55, 0.32, 0.25), color: 0xc1121f, p: [0, 0.82, -4.0] },
    ];
    this.body.add(new THREE.Mesh(buildColored(chassis), mat));

    const cabParts: Part[] = [
      { geo: box(2.4, 1.85, 2.0), color: 0xf4a300, p: [0, 2.1, -2.6] },
      { geo: box(2.3, 0.9, 0.7), color: 0xf4a300, p: [0, 1.5, -3.8] },
      { geo: box(2.0, 0.55, 0.06), color: 0x2b2b2b, p: [0, 1.55, -4.16] },
      { geo: box(2.15, 0.8, 0.06), color: 0x22313f, p: [0, 2.45, -3.61] },
      { geo: box(0.06, 0.65, 1.0), color: 0x22313f, p: [-1.21, 2.45, -2.75] },
      { geo: box(0.06, 0.65, 1.0), color: 0x22313f, p: [1.21, 2.45, -2.75] },
      { geo: box(2.42, 0.12, 2.02), color: 0x2a9d8f, p: [0, 3.06, -2.6] },
      { geo: box(2.42, 0.18, 2.02), color: 0xe63946, p: [0, 1.25, -2.6] },
      { geo: box(0.35, 0.2, 0.06), color: 0xfff6c0, p: [-0.85, 1.55, -4.17] },
      { geo: box(0.35, 0.2, 0.06), color: 0xfff6c0, p: [0.85, 1.55, -4.17] },
      { geo: box(0.08, 0.45, 0.25), color: 0x111111, p: [-1.45, 2.4, -3.3] },
      { geo: box(0.08, 0.45, 0.25), color: 0x111111, p: [1.45, 2.4, -3.3] },
      { geo: box(0.3, 0.05, 0.05), color: 0x777777, p: [-1.3, 2.6, -3.3] },
      { geo: box(0.3, 0.05, 0.05), color: 0x777777, p: [1.3, 2.6, -3.3] },
    ];
    this.cab = new THREE.Mesh(buildColored(cabParts), mat);
    this.body.add(this.cab);

    // Truck-art panels
    const sideTex = truckArtTexture('side');
    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
    const sideGeo = new THREE.PlaneGeometry(5.5, 1.4);
    const left = new THREE.Mesh(sideGeo, sideMat);
    left.position.set(-1.28, 2.1, 1.25);
    left.rotation.y = -Math.PI / 2;
    const right = new THREE.Mesh(sideGeo, sideMat);
    right.position.set(1.28, 2.1, 1.25);
    right.rotation.y = Math.PI / 2;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.4), new THREE.MeshLambertMaterial({ map: truckArtTexture('back') }));
    back.position.set(0, 2.1, 4.04);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshLambertMaterial({ map: truckArtTexture('front') }));
    front.position.set(0, 3.45, -3.62);
    front.rotation.y = Math.PI;
    const headboard = new THREE.Mesh(buildColored([{ geo: box(2.42, 0.65, 0.1), color: 0xe63946 }]), mat);
    headboard.position.set(0, 3.45, -3.55);
    this.body.add(left, right, back, headboard, front);
    // Front-facing art must face -Z; flip handled by rotation above. Keep the headboard with the cab.
    this.cabExtras = [headboard, front];

    // Tassels hanging under the front bumper
    const tasselParts: Part[] = [];
    const colors = [0xe63946, 0xffd166, 0x2a9d8f, 0xf72585, 0x4361ee, 0xff8c1a];
    for (let i = 0; i < 12; i++) {
      tasselParts.push({ geo: cone(0.07, 0.35, 5), color: colors[i % colors.length], p: [-1.15 + i * 0.21, 0.5, -4.12], r: [Math.PI, 0, 0] });
    }
    tasselParts.push({ geo: box(2.5, 0.03, 0.03), color: 0xdddddd, p: [0, 0.67, -4.12] });
    this.tassels = new THREE.Mesh(buildColored(tasselParts), mat);
    this.body.add(this.tassels);

    // Wheels (separate meshes so they can spin)
    const wheelGeo = buildColored([
      { geo: cyl(0.52, 0.52, 0.42, 12), color: 0x1b1b1b, r: [0, 0, Math.PI / 2] },
      { geo: cyl(0.28, 0.28, 0.44, 8), color: 0xbdbdbd, r: [0, 0, Math.PI / 2] },
      { geo: box(0.46, 0.08, 0.7), color: 0x2b2b2b },
    ]);
    const positions: [number, number, boolean][] = [
      [-1.08, -2.75, true], [1.08, -2.75, true],
      [-1.08, 2.2, false], [1.08, 2.2, false], [-1.08, 3.1, false], [1.08, 3.1, false],
    ];
    for (const [x, z, isFront] of positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.52, z);
      const w = new THREE.Mesh(wheelGeo, mat);
      pivot.add(w);
      this.root.add(pivot);
      this.wheels.push(w);
      if (isFront) this.frontWheels.push(w);
    }

    // Cargo crates: crate bodies + coloured produce on top
    const crateGeo = buildColored([{ geo: box(0.74, 0.5, 0.86), color: 0x9b7040 }]);
    const produceGeo = buildColored([{ geo: box(0.66, 0.14, 0.78), color: 0xffffff }]);
    this.crates = new THREE.InstancedMesh(crateGeo, mat, MAX_CRATES);
    this.produce = new THREE.InstancedMesh(produceGeo, mat, MAX_CRATES);
    this.crates.count = this.produce.count = 0;
    this.crates.frustumCulled = this.produce.frustumCulled = false;
    this.body.add(this.crates, this.produce);

    this.root.add(blobShadow(3.4, 9.5));

    // Headlights for dusk / night / rain: a real spotlight, glowing lamps and a fake light pool
    this.spot = new THREE.SpotLight(0xfff2cc, 0, 90, 0.55, 0.6, 1.1);
    this.spot.position.set(0, 1.6, -4.2);
    this.spot.target.position.set(0, 0, -30);
    this.root.add(this.spot, this.spot.target);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0 });
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0 });
    const lampGeo = new THREE.BoxGeometry(0.38, 0.24, 0.05);
    for (const x of [-0.85, 0.85]) {
      const l = new THREE.Mesh(lampGeo, this.lampMat);
      l.position.set(x, 1.55, -4.2);
      const t = new THREE.Mesh(lampGeo, this.tailMat);
      t.position.set(x * 1.18, 1.05, 4.19);
      this.body.add(l, t);
    }
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
  }

  private spot: THREE.SpotLight;
  private lampMat: THREE.MeshBasicMaterial;
  private tailMat: THREE.MeshBasicMaterial;
  private poolMat: THREE.MeshBasicMaterial;

  /** 0 = off (bright day) … 1 = full night beams */
  setHeadlights(level: number): void {
    this.spot.intensity = level * 60;
    this.lampMat.opacity = Math.min(1, level * 1.5);
    this.tailMat.opacity = Math.min(1, level * 1.5);
    this.poolMat.opacity = level * 0.35;
  }

  private cabExtras: THREE.Object3D[];

  setCrates(colors: number[]): void {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const n = Math.min(colors.length, MAX_CRATES);
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / (CRATE_COLS * CRATE_ROWS));
      const k = i % (CRATE_COLS * CRATE_ROWS);
      const row = Math.floor(k / CRATE_COLS);
      const col = k % CRATE_COLS;
      const jitter = ((i * 7919) % 10) / 100;
      const x = -0.78 + col * 0.78;
      const y = 1.65 + layer * 0.52;
      const z = 3.5 - row * 0.88;
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
    this.cab.visible = !on;
    for (const o of this.cabExtras) o.visible = !on;
    this.tassels.visible = !on;
  }

  /** Sync the model with the simulation. */
  update(dt: number, x: number, y: number, z: number, heading: number, pitch: number, speed: number, steer: number, yawRate: number, bump: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.set(pitch, -heading, 0, 'YXZ');
    this.wheelSpin -= ((speed * WORLD.speedScale) / 0.52) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
    for (const w of this.frontWheels) w.parent!.rotation.y = -steer * 0.45;
    // body roll outward in turns and a little bounce
    const roll = THREE.MathUtils.clamp(yawRate * speed * 0.012, -0.08, 0.08);
    this.body.rotation.z += (roll - this.body.rotation.z) * Math.min(1, dt * 5);
    this.body.position.y = bump;
    this.tassels.rotation.x = Math.sin(performance.now() * 0.012) * 0.04 * Math.min(1, Math.abs(speed) / 10);
  }
}
