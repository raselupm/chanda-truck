// Driving on the grass beside the road: after a few seconds the wheels sink in the mud. Two helpers climb
// out of the cab and push the truck (slowly) back to the road; then the driver must stop and pick them up,
// or drive off without them and lose. The tyres leave mud prints on the grass, and for a moment on the road.

import * as THREE from 'three';
import { MUD, ROAD, SHORTCUT, TRUCK } from '../config/tuning';
import type { Game } from '../game/Game';
import { canvasTexture } from '../utils/textures';
import { makePerson } from './People';

type State = 'free' | 'stuck' | 'pushing' | 'waiting' | 'boarding';

interface Helper {
  mesh: THREE.Mesh;
  s: number;
  d: number;
  /** -1 = left side of the truck, 1 = right */
  side: -1 | 1;
  phase: number;
}

/** wheel positions in truck space (x right, z back), from the truck model */
const WHEELS: [number, number][] = [[-1.08, -2.75], [1.08, -2.75], [-1.08, 3.1], [1.08, 3.1]];
const HALF_LEN = TRUCK.length / 2;
const CAB_OFF = 2.6;

function mudTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 128, (ctx, w, h) => {
    // a tyre-wide smear with tread bars and a few splashes
    ctx.fillStyle = 'rgba(74, 50, 30, 0.85)';
    ctx.beginPath();
    ctx.roundRect(10, 4, w - 20, h - 8, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(46, 30, 18, 0.9)';
    for (let y = 10; y < h - 10; y += 14) ctx.fillRect(14, y, w - 28, 6);
    ctx.fillStyle = 'rgba(90, 62, 38, 0.7)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(4 + ((i * 37) % (w - 8)), 8 + ((i * 53) % (h - 16)), 3 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export class Mud {
  readonly group = new THREE.Group();
  private state: State = 'free';
  /** seconds driven off the road (resets on the road) */
  private offTime = 0;
  /** seconds left of mud on the tyres after getting back on the road */
  private trail = 0;
  private sinceStain = 0;
  private lastS = 0;
  private lastD = 0;
  private t = 0;
  private warnedFar = false;
  private helpers: Helper[] = [];
  private stains: THREE.InstancedMesh;
  private stainNext = 0;
  private stainCount = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  /** wet dark mud on the grass; lighter, drier smears stand out on the asphalt */
  private grassTint = new THREE.Color(0.75, 0.75, 0.75);
  private roadTint = new THREE.Color(1.5, 1.4, 1.25);

  constructor(private game: Game) {
    const geo = new THREE.PlaneGeometry(0.55, 1.0);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({
      map: mudTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.stains = new THREE.InstancedMesh(geo, mat, MUD.maxStains);
    this.stains.count = 0;
    this.stains.frustumCulled = false;
    this.stains.renderOrder = 1;
    this.group.add(this.stains);

    for (const side of [-1, 1] as const) {
      const mesh = makePerson('farmer', side < 0 ? 81 : 84);
      mesh.rotation.order = 'YXZ';
      mesh.visible = false;
      this.group.add(mesh);
      this.helpers.push({ mesh, s: 0, d: 0, side, phase: side < 0 ? 0 : 1.7 });
    }
  }

  /** Helpers are outside the cab. */
  get helpersOut(): boolean {
    return this.state !== 'free';
  }

  reset(): void {
    this.state = 'free';
    this.offTime = 0;
    this.trail = 0;
    this.warnedFar = false;
    this.stainCount = this.stainNext = 0;
    this.stains.count = 0;
    for (const h of this.helpers) h.mesh.visible = false;
    const tr = this.game.truck;
    tr.stuck = false;
    tr.mudCapKmh = Infinity;
    this.lastS = tr.s;
    this.lastD = tr.d;
  }

  /** Before the truck moves: hold it in the mud, or let it creep while pushed. */
  preUpdate(): void {
    const tr = this.game.truck;
    tr.stuck = this.state === 'stuck';
    tr.mudCapKmh = this.state === 'pushing' ? MUD.pushKmh : Infinity;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const active = (g.state.phase === 'FARM' || g.state.phase === 'HIGHWAY') && !g.modal;
    const off = tr.offRoad;

    // ---- mud on the tyres
    // (the mud only comes off while the wheels turn)
    if (off) this.trail = MUD.roadTrailSeconds;
    else if (Math.abs(tr.speed) > 0.5) this.trail = Math.max(0, this.trail - dt);
    const moved = Math.hypot(tr.s - this.lastS, tr.d - this.lastD);
    this.lastS = tr.s;
    this.lastD = tr.d;
    this.sinceStain += moved;
    if (moved > 5) this.sinceStain = 0; // teleported (restart)
    if ((off || this.trail > 0) && this.sinceStain >= MUD.stainSpacing) {
      this.sinceStain = 0;
      // prints fade out (shrink) as the mud comes off on the road
      this.stainPair(off ? 1 : 0.35 + 0.65 * (this.trail / MUD.roadTrailSeconds), off);
    }

    if (!active) return;

    // ---- stuck in the mud
    switch (this.state) {
      case 'free':
      case 'waiting':
        if (off && Math.abs(tr.speed) > 0.5) this.offTime += dt;
        else if (!off) this.offTime = 0;
        if (this.offTime >= MUD.stuckAfter) {
          this.offTime = 0;
          if (this.state === 'free') for (const h of this.helpers) this.placeAtDoor(h);
          this.state = 'stuck';
          tr.speed = 0;
          g.sound.whistle();
          g.hud.warn('{warning} গাড়ির চাকা কাদায় আটকে গেছে, হেলপার বের হচ্ছে ঠেলার জন্য। আস্তে আস্তে গাড়িকে রাস্তায় তুলেন।', 'danger', 6);
        }
        break;
      case 'stuck':
        // walk round to the back of the truck, then start pushing
        if (this.helpers.every((h) => this.near(h, this.pushSpot(h), 0.3))) {
          this.state = 'pushing';
          g.hud.toast('{truck} হেলপাররা ঠেলছে — আস্তে আস্তে রাস্তায় উঠুন', 3);
        }
        break;
      case 'pushing':
        if (!off) {
          this.state = 'waiting';
          this.warnedFar = false;
          g.hud.warn('{ok} রাস্তায় উঠেছেন! থামুন, হেলপারদের তুলে নিন', 'good', 4);
        }
        break;
      case 'boarding':
        if (this.helpers.every((h) => this.near(h, this.doorSpot(h), 0.35))) {
          this.state = 'free';
          for (const h of this.helpers) h.mesh.visible = false;
          g.hud.toast('{ok} হেলপাররা উঠে পড়েছে — চলুন!', 2.5);
        }
        break;
    }

    if (this.state === 'waiting') {
      const dist = this.helperDistance();
      if (dist < MUD.pickupRange && Math.abs(tr.kmh) < MUD.pickupKmh) this.state = 'boarding';
      else if (dist > MUD.forgetRange * 0.45 && !this.warnedFar) {
        this.warnedFar = true;
        g.hud.warn('{warning} হেলপার পেছনে পড়ে আছে! থেমে তুলে নিন', 'danger', 3);
      }
    }
    if ((this.state === 'waiting' || this.state === 'boarding') && this.helperDistance() > MUD.forgetRange) {
      g.gameOver('helper');
      return;
    }

    this.moveHelpers(dt);
  }

  private helperDistance(): number {
    const tr = this.game.truck;
    return Math.min(...this.helpers.map((h) => Math.hypot(h.s - tr.s, h.d - tr.d)));
  }

  private near(h: Helper, [s, d]: [number, number], r: number): boolean {
    return Math.hypot(h.s - s, h.d - d) < r;
  }

  /** beside the cab door */
  private doorSpot(h: Helper): [number, number] {
    const tr = this.game.truck;
    return [tr.s + CAB_OFF, tr.d + h.side * (TRUCK.width / 2 + 0.5)];
  }

  /** hands on the tailboard */
  private pushSpot(h: Helper): [number, number] {
    const tr = this.game.truck;
    return [tr.s - HALF_LEN - 0.45, tr.d + h.side * 0.65];
  }

  private placeAtDoor(h: Helper): void {
    [h.s, h.d] = this.doorSpot(h);
    h.mesh.visible = true;
  }

  private moveHelpers(dt: number): void {
    const g = this.game;
    for (const h of this.helpers) {
      if (!h.mesh.visible) continue;
      let target: [number, number] | null = null;
      if (this.state === 'stuck') {
        // along the side of the truck to the back corner, then in behind it
        const [ps, pd] = this.pushSpot(h);
        target = h.s > ps + 0.3 ? [ps + 0.2, g.truck.d + h.side * (TRUCK.width / 2 + 0.5)] : [ps, pd];
      } else if (this.state === 'pushing') {
        // glued to the tailboard while the truck creeps
        [h.s, h.d] = this.pushSpot(h);
      } else if (this.state === 'boarding') {
        target = this.doorSpot(h);
      }
      let ds = 0;
      let dd = 0;
      if (target) {
        ds = target[0] - h.s;
        dd = target[1] - h.d;
        const dist = Math.hypot(ds, dd);
        const step = Math.min(dist, MUD.walkSpeed * (this.state === 'boarding' ? 1.4 : 1) * dt);
        if (dist > 0.01) {
          h.s += (ds / dist) * step;
          h.d += (dd / dist) * step;
        }
      }

      const walking = Math.hypot(ds, dd) > 0.05;
      const pushing = this.state === 'pushing';
      const bob = walking ? Math.abs(Math.sin(this.t * 9 + h.phase)) * 0.1 : pushing ? Math.abs(Math.sin(this.t * 4 + h.phase)) * 0.05 : 0;
      g.track.point(h.s, h.d, h.mesh.position, this.groundY(h.s, h.d) - g.track.elevation(h.s) + bob);
      if (pushing) h.mesh.rotation.set(-0.5, 0, 0);
      else if (walking) h.mesh.rotation.set(-0.1, Math.atan2(-dd, ds), 0);
      else {
        // waiting at the roadside: face the truck and wave it back
        const tr = g.truck;
        h.mesh.rotation.set(0, Math.atan2(-(tr.d - h.d), tr.s - h.s), Math.sin(this.t * 5 + h.phase) * 0.12);
      }
    }
  }

  /** Height of the ground at (s, d): road, shoulder, the embankment down to the fields. */
  private groundY(s: number, d: number): number {
    const tr = this.game.track;
    // beside a village shortcut: measure from that road instead
    const sc = tr.shortcutAt(s);
    const near = sc && Math.abs(d - sc.offset(s)) < Math.abs(d) ? sc : null;
    const el = near ? near.elevation(s) : tr.elevation(s);
    const roadY = el + ROAD.top;
    const out = near
      ? Math.abs(d - near.offset(s)) - (near.halfWidth(s) + SHORTCUT.shoulder)
      : Math.abs(d) - (tr.halfWidth(s) + ROAD.shoulder);
    if (out <= 0) return roadY;
    const k = Math.min(1, out / (1.2 + el * 1.3));
    return roadY + (0.02 - roadY) * k;
  }

  /** Mud prints under the rear wheels (and the front ones while in the mud). */
  private stainPair(size: number, off: boolean): void {
    const tr = this.game.truck;
    const h = tr.heading;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    this.q.setFromAxisAngle(this.up, -h);
    for (const [x, z] of WHEELS) {
      if (!off && z < 0) continue; // on the road only the rear wheels still carry mud
      const wx = tr.x + Math.cos(h) * x - fx * z;
      const wz = tr.z + Math.sin(h) * x - fz * z;
      const s = -wz;
      const d = wx - this.game.track.centerX(s);
      this.p.set(wx, this.groundY(s, d) + 0.03, wz);
      this.sc.set(size, 1, size * (0.85 + Math.random() * 0.3));
      this.m.compose(this.p, this.q, this.sc);
      this.stains.setMatrixAt(this.stainNext, this.m);
      this.stains.setColorAt(this.stainNext, off ? this.grassTint : this.roadTint);
      this.stainNext = (this.stainNext + 1) % MUD.maxStains;
      this.stainCount = Math.min(MUD.maxStains, this.stainCount + 1);
    }
    this.stains.count = this.stainCount;
    this.stains.instanceMatrix.needsUpdate = true;
    this.stains.instanceColor!.needsUpdate = true;
  }
}
