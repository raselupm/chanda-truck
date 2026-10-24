// People walking (and standing around) on the footpaths of towns and the city.
// Pooled and instanced: a few person variants, one InstancedMesh each.

import * as THREE from 'three';
import { ROAD } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cone, cyl, vertexColorMaterial } from '../utils/geometry';
import { personGeometry } from './People';

const VARIANTS = 6;
const PER_VARIANT = 26;
const WANT = { city: 140, town: 50 } as const;

const UMBRELLA_COLORS = [0x1b1b1b, 0x1b1b1b, 0x1b1b1b, 0x23395b, 0x8b1e3f, 0x2a6f4a, 0xd1495b, 0x3a3a3a];

/** Open umbrella held in the right hand, in person-local space (person faces -Z). */
function umbrellaGeometry(): THREE.BufferGeometry {
  return buildColored([
    { geo: cyl(0.02, 0.02, 1.35, 5), color: 0x111111, p: [0.26, 1.5, -0.05], r: [0, 0, 0.12] },
    { geo: cone(0.62, 0.32, 10), color: 0xffffff, p: [0.18, 2.28, -0.05] },
    { geo: cyl(0.62, 0.62, 0.04, 10), color: 0xffffff, p: [0.18, 2.12, -0.05] },
  ]);
}

function torchGeometry(): THREE.BufferGeometry {
  return buildColored([
    { geo: box(0.07, 0.07, 0.22), color: 0x2b2b2b, p: [0.33, 0.88, -0.14] },
    { geo: box(0.08, 0.08, 0.02), color: 0xfff6c0, p: [0.33, 0.88, -0.26] },
  ]);
}

/** Light cone from the torch, pointing ahead and a little down. */
function beamGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.75, 4.2, 12, 1, true);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -2.1);
  g.rotateX(-0.32);
  g.translate(0.33, 0.88, -0.26);
  return g;
}

interface Ped {
  active: boolean;
  /** index into the accessory (umbrella / torch) instance buffers */
  idx: number;
  variant: number;
  slot: number;
  s: number;
  d: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
}

export class Pedestrians {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private peds: Ped[] = [];
  private t = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private umbrellas: THREE.InstancedMesh;
  private torches: THREE.InstancedMesh;
  private beams: THREE.InstancedMesh;
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private game: Game) {
    const total = VARIANTS * PER_VARIANT;
    const acc = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, mat, total);
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.visible = false;
      this.group.add(m);
      return m;
    };
    this.umbrellas = acc(umbrellaGeometry(), vertexColorMaterial());
    this.torches = acc(torchGeometry(), vertexColorMaterial());
    this.beams = acc(beamGeometry(), new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.11, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    const c = new THREE.Color();
    for (let i = 0; i < total; i++) this.umbrellas.setColorAt(i, c.set(UMBRELLA_COLORS[i % UMBRELLA_COLORS.length]));
    for (let v = 0; v < VARIANTS; v++) {
      const kind = v % 3 === 2 ? 'farmer' : 'trader';
      const mesh = new THREE.InstancedMesh(personGeometry(kind, v + 10), vertexColorMaterial(), PER_VARIANT);
      mesh.count = PER_VARIANT;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.push(mesh);
      this.group.add(mesh);
      for (let i = 0; i < PER_VARIANT; i++) {
        this.peds.push({ active: false, idx: this.peds.length, variant: v, slot: i, s: 0, d: 0, dir: 1, speed: 0, phase: Math.random() * 10 });
        this.hide(v, i);
      }
    }
  }

  private hide(variant: number, slot: number): void {
    this.meshes[variant].setMatrixAt(slot, this.zero);
    const idx = variant * PER_VARIANT + slot;
    this.umbrellas?.setMatrixAt(idx, this.zero);
    this.torches?.setMatrixAt(idx, this.zero);
    this.beams?.setMatrixAt(idx, this.zero);
  }

  reset(): void {
    for (const p of this.peds) {
      p.active = false;
      this.hide(p.variant, p.slot);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  private want(s: number): number {
    const z = this.game.track.zone(s);
    return z === 'city' ? WANT.city : z === 'town' ? WANT.town : 0;
  }

  private spawn(p: Ped, truckS: number, anywhere: boolean): boolean {
    const track = this.game.track;
    const s = anywhere ? truckS - 30 + Math.random() * 300 : truckS + 220 + Math.random() * 110;
    const zone = track.zone(s);
    if (zone !== 'city' && zone !== 'town') return false;
    const side = Math.random() < 0.5 ? -1 : 1;
    const edge = track.halfWidth(s) + ROAD.shoulder + 1.5;
    const d = side * (edge + 0.6 + Math.random() * (zone === 'city' ? 4 : 3));
    if (track.isBlocked(s, d)) return false;
    p.active = true;
    p.s = s;
    p.d = d;
    p.dir = Math.random() < 0.5 ? 1 : -1;
    // a third of them just stand and chat
    p.speed = Math.random() < 0.33 ? 0 : 1 + Math.random() * 0.7;
    return true;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const truckS = g.truck.s;
    const want = Math.max(this.want(truckS), this.want(truckS + 300));
    let active = 0;
    for (const p of this.peds) if (p.active) active++;

    // Weather props: umbrellas in the rain, flashlights after dark
    const look = g.weather.look;
    const rain = look.rain > 0.25;
    const dark = look.headlights > 0.75;
    this.umbrellas.visible = rain;
    this.torches.visible = this.beams.visible = dark;

    let spawns = want > active ? 3 : 0;
    for (const p of this.peds) {
      if (!p.active) {
        if (spawns > 0 && active < want && this.spawn(p, truckS, active < want * 0.5)) {
          spawns--;
          active++;
        } else continue;
      }
      p.s += p.speed * p.dir * dt;
      const rel = p.s - truckS;
      const zone = g.track.zone(p.s);
      if (rel < -60 || rel > 360 || (zone !== 'city' && zone !== 'town')) {
        p.active = false;
        this.hide(p.variant, p.slot);
        continue;
      }
      const walking = p.speed > 0;
      const bob = walking ? Math.abs(Math.sin(this.t * 7 + p.phase)) * 0.06 : 0;
      const face = walking ? (p.dir === 1 ? 0 : Math.PI) : p.phase;
      this.e.set(0, face, walking ? Math.sin(this.t * 7 + p.phase) * 0.05 : 0);
      this.q.setFromEuler(this.e);
      this.p.set(g.track.centerX(p.s) + p.d, ROAD.top + bob, -p.s);
      this.m.compose(this.p, this.q, this.one);
      this.meshes[p.variant].setMatrixAt(p.slot, this.m);
      if (rain) this.umbrellas.setMatrixAt(p.idx, this.m);
      if (dark) {
        this.torches.setMatrixAt(p.idx, this.m);
        this.beams.setMatrixAt(p.idx, this.m);
      }
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    if (rain) this.umbrellas.instanceMatrix.needsUpdate = true;
    if (dark) {
      this.torches.instanceMatrix.needsUpdate = true;
      this.beams.instanceMatrix.needsUpdate = true;
    }
  }
}
