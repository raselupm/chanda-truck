// City four-way junction (চার রাস্তার মোড়) with traffic lights: green, yellow, then 5 s red while
// the cross street goes. Main-road traffic waits at the stop line; cross traffic is simulated here.

import * as THREE from 'three';
import type { JunctionEvent } from '../config/route';
import { JUNCTION, ROAD, WORLD } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { makeWaver } from './People';
import { SetPiece } from './SetPiece';
import { VEHICLE_DIMS, vehicleGeometry, type TrafficKind } from './VehicleModels';

type Light = 'green' | 'yellow' | 'red';

interface CrossCar {
  active: boolean;
  mesh: THREE.Mesh;
  len: number;
  wid: number;
  /** +1 = toward +x (driver's right), -1 = toward -x */
  dir: 1 | -1;
  /** lateral position along the cross street (same axis as d) */
  x: number;
  speed: number;
  cruise: number;
}

const CROSS_KINDS: TrafficKind[] = ['car', 'cng', 'rickshaw', 'bus', 'car', 'cng', 'rickshaw', 'truck', 'car', 'cng'];
const CROSS_SPEED: Partial<Record<TrafficKind, number>> = { rickshaw: 3.5, cng: 8, car: 10, bus: 9, truck: 8 };
/** how far the cross street is drawn on each side */
const REACH = 160;

/** Pole + signal head. Head faces +Z (lamps on the +Z face). */
function poleGeometry(arm: number): THREE.BufferGeometry {
  return cached(`junction:pole:${arm}`, () => {
    const parts: Part[] = [{ geo: cyl(0.12, 0.14, 6.4, 6), color: 0x5a5f63, p: [0, 3.2, 0] }];
    if (arm) parts.push({ geo: box(Math.abs(arm), 0.16, 0.16), color: 0x5a5f63, p: [arm / 2, 6.2, 0] });
    return buildColored(parts);
  });
}

function headGeometry(): THREE.BufferGeometry {
  return cached('junction:head', () =>
    buildColored([
      { geo: box(0.46, 1.3, 0.34), color: 0x1d1f21, p: [0, 0, 0] },
      { geo: box(0.56, 1.42, 0.04), color: 0x2b2d2f, p: [0, 0, -0.18] },
    ]),
  );
}

export class Junction extends SetPiece<JunctionEvent> {
  private light: Light;
  private timer: number;
  /** lamp materials, lit / dim, for the main road and for the cross street */
  private lamps: Record<'r' | 'y' | 'g' | 'cr' | 'cg', THREE.MeshBasicMaterial>;
  private cars: CrossCar[] = [];
  private spawnTimer = 0;
  private prevFront = 0;
  private ranRed = false;
  private warnedRed = false;
  private t = 0;
  private police: THREE.Mesh;
  private hornCooldown = 0;

  constructor(event: JunctionEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const I = event.s;
    const hw = track.halfWidth(I);
    const CW = JUNCTION.crossHalfWidth;
    const mat = vertexColorMaterial();
    const cycle = JUNCTION.greenSeconds + JUNCTION.yellowSeconds + JUNCTION.redSeconds;
    const start = Math.random() * cycle;
    [this.light, this.timer] =
      start < JUNCTION.greenSeconds ? ['green', JUNCTION.greenSeconds - start]
        : start < JUNCTION.greenSeconds + JUNCTION.yellowSeconds ? ['yellow', JUNCTION.greenSeconds + JUNCTION.yellowSeconds - start]
          : ['red', cycle - start];

    track.propBlocks.push({ from: I - CW - 6, to: I + CW + 6, dMin: -500, dMax: 500 });

    // Cross street, zebra crossings, stop lines, corner kerbs (local: x = d, z = -(s - I))
    const P = (s: number, d: number, y: number): [number, number, number] => [d, y, -(s - I)];
    const parts: Part[] = [];
    for (const side of [-1, 1]) {
      const len = REACH - hw;
      parts.push({ geo: box(len, 0.3, CW * 2), color: 0x4b4a4f, p: P(I, side * (hw + len / 2), -0.155) });
      for (let x = hw + 4; x < REACH; x += 6) parts.push({ geo: box(3, 0.02, 0.16), color: 0xe8c02e, p: P(I, side * x, 0.0) });
      // kerbs on the corners
      for (const ss of [-1, 1]) parts.push({ geo: box(6, 0.3, 4), color: 0xa8a196, p: P(I + ss * (CW + 2.2), side * (hw + 4.5), 0) });
    }
    for (const ss of [-1, 1]) {
      // zebra across the main road
      for (let d = -hw + 0.6; d < hw; d += 1.2) parts.push({ geo: box(0.6, 0.02, 3), color: 0xf2f2f2, p: P(I + ss * (CW + 2), d + 0.3, 0.016) });
    }
    parts.push({ geo: box(hw, 0.02, 0.5), color: 0xffffff, p: P(I - CW - 4.5, -hw / 2, 0.016) });
    parts.push({ geo: box(hw, 0.02, 0.5), color: 0xffffff, p: P(I + CW + 4.5, hw / 2, 0.016) });
    const ground = new THREE.Mesh(buildColored(parts), mat);
    ground.position.copy(this.at(I, 0, ROAD.top));
    this.group.add(ground);

    // Traffic lights
    const lamp = (color: number) => new THREE.MeshBasicMaterial({ color });
    this.lamps = { r: lamp(0xff2a1a), y: lamp(0xffc300), g: lamp(0x2bd65a), cr: lamp(0xff2a1a), cg: lamp(0x2bd65a) };
    const lampGeo = new THREE.CircleGeometry(0.16, 12);
    const head = (mats: THREE.MeshBasicMaterial[]) => {
      const h = new THREE.Mesh(headGeometry(), mat);
      mats.forEach((m, i) => {
        const l = new THREE.Mesh(lampGeo, m);
        l.position.set(0, 0.4 - i * 0.4, 0.18);
        h.add(l);
      });
      return h;
    };
    const main = [this.lamps.r, this.lamps.y, this.lamps.g];
    const cross = [this.lamps.cr, this.lamps.y, this.lamps.cg];
    for (const ss of [-1, 1]) {
      const s = I + ss * (CW + 3);
      const d = ss * (hw + 0.8);
      const facing = ss < 0 ? 0 : Math.PI;
      // the mast arm reaches over the road to above the open lane (pole-local +x points at the road)
      const pole = new THREE.Mesh(poleGeometry(hw - 1.5), mat);
      pole.position.copy(this.at(s, d, ROAD.top));
      pole.rotation.y = facing;
      // overhead head above the open lane, and one on the pole
      const over = head(main);
      over.position.set(hw - 1.5, 5.4, 0);
      pole.add(over);
      const low = head(main);
      low.position.set(0, 3.2, 0.2);
      pole.add(low);
      // one for the cross street, facing along it
      const side = head(cross);
      side.position.set(0, 3.2, 0);
      side.rotation.y = -Math.PI / 2;
      pole.add(side);
      this.group.add(pole);
    }
    for (const m of Object.values(this.lamps)) m.userData.base = m.color.getHex();

    // Traffic police with a stick on the corner
    this.police = makeWaver('official', 3, 'stick');
    this.police.position.copy(this.at(I - CW - 1.5, -hw - 2.5, ROAD.top + 0.3));
    this.police.rotation.y = Math.PI + 0.6;
    this.group.add(this.police);

    // Cross traffic pool
    CROSS_KINDS.forEach((kind, i) => {
      const mesh = new THREE.Mesh(vehicleGeometry(kind, i % 5), mat);
      mesh.visible = false;
      this.group.add(mesh);
      const dims = VEHICLE_DIMS[kind];
      const cruise = CROSS_SPEED[kind] ?? 8;
      this.cars.push({ active: false, mesh, len: dims.len, wid: dims.wid, dir: 1, x: 0, speed: 0, cruise });
    });
    this.resolved = true;
  }

  visibleRange(): [number, number] {
    return [this.s - 750, this.s + 200];
  }

  get controlsTraffic(): boolean {
    return true;
  }

  stopLine(dir: 1 | -1): number | null {
    if (this.light === 'green') return null;
    const CW = JUNCTION.crossHalfWidth;
    return dir === 1 ? this.s - CW - 4.5 : this.s + CW + 4.5;
  }

  /** Cross street has green while the main road is red (minus a short all-red at each end). */
  private get crossGo(): boolean {
    return this.light === 'red' && this.timer > 0.8 && this.timer < JUNCTION.redSeconds - 0.8;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const I = this.s;
    const CW = JUNCTION.crossHalfWidth;

    if ((this.timer -= dt) <= 0) {
      if (this.light === 'green') [this.light, this.timer] = ['yellow', JUNCTION.yellowSeconds];
      else if (this.light === 'yellow') [this.light, this.timer] = ['red', JUNCTION.redSeconds];
      else {
        [this.light, this.timer] = ['green', JUNCTION.greenSeconds];
        this.warnedRed = false;
      }
    }
    const L = this.lamps;
    const set = (m: THREE.MeshBasicMaterial, on: boolean) => m.color.setHex(on ? m.userData.base : 0x2a2a2a);
    set(L.r, this.light === 'red');
    set(L.y, this.light === 'yellow');
    set(L.g, this.light === 'green');
    set(L.cr, !this.crossGo);
    set(L.cg, this.crossGo);
    const arm = this.police.userData.arm as THREE.Object3D;
    arm.rotation.x = this.crossGo ? 2.3 + Math.sin(this.t * 5) * 0.5 : Math.PI / 2;

    if (tr.s < I - 750 || tr.s > I + 200) return;
    const front = tr.frontS;
    const line = I - CW - 4.5;
    if (g.state.phase === 'HIGHWAY') {
      if (this.light !== 'green' && !this.warnedRed && front > line - 110 && front < line - 15) {
        this.warnedRed = true;
        g.hud.warn('{trafficlight} সামনে লাল বাতি — থামুন', 'info', 2);
      }
      if (this.light === 'red' && this.prevFront < line && front >= line && !this.ranRed) {
        this.ranRed = true;
        g.hud.warn('{siren} লাল বাতি অমান্য! ট্রাফিক পুলিশের বাঁশি', 'danger', 2.5);
        g.sound.whistle();
      }
      if (front < line - 5) this.ranRed = false;
    }
    this.prevFront = front;
    this.updateCross(dt);
  }

  private updateCross(dt: number): void {
    const g = this.game;
    const tr = g.truck;
    const I = this.s;
    const hw = g.track.halfWidth(I);
    const go = this.crossGo;
    // the truck is in the box: everybody waits
    const truckIn = tr.frontS > I - JUNCTION.crossHalfWidth - 1 && tr.rearS < I + JUNCTION.crossHalfWidth + 1;
    this.hornCooldown -= dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2 + Math.random() * 2;
      const c = this.cars.filter((k) => !k.active)[Math.floor(Math.random() * 4)];
      if (c) {
        c.dir = Math.random() < 0.5 ? 1 : -1;
        c.x = -c.dir * REACH;
        // room at the end of the street?
        const clear = this.cars.every((o) => !o.active || o.dir !== c.dir || Math.abs(o.x - c.x) > (o.len + c.len) / 2 + 3);
        if (clear) {
          c.active = true;
          c.speed = c.cruise;
          c.mesh.visible = true;
          c.mesh.rotation.y = c.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    }

    for (const c of this.cars) {
      if (!c.active) continue;
      const front = c.x + (c.dir * c.len) / 2;
      let target = c.cruise;
      // stop line on the cross street: just outside the main road
      const stopX = -c.dir * (hw + 3);
      const toLine = (stopX - front) * c.dir;
      if ((!go || truckIn) && toLine > -0.5) target = Math.min(target, Math.max(0, toLine - 0.3) * 0.6);
      // queue behind the one ahead
      for (const o of this.cars) {
        if (o === c || !o.active || o.dir !== c.dir) continue;
        const gap = (o.x - c.x) * c.dir - (o.len + c.len) / 2;
        if (gap > -1 && gap < 25) target = Math.min(target, Math.max(0, o.speed + (gap - 2.5) * 0.5));
      }
      // never drive into the truck
      const laneS = I + c.dir * 3.5;
      if (Math.abs(laneS - tr.s) < c.wid / 2 + 4.5) {
        const gapT = (tr.d - c.x) * c.dir - c.len / 2 - 1.6;
        if (gapT > -2 && gapT < 10) {
          target = 0;
          if (this.hornCooldown <= 0 && gapT < 4) {
            this.hornCooldown = 3;
            g.sound.otherHorn();
          }
        }
      }
      c.speed = target < c.speed ? Math.max(target, c.speed - 9 * dt) : Math.min(target, c.speed + 3 * dt);
      c.x += c.dir * c.speed * WORLD.speedScale * dt;
      if (c.x * c.dir > REACH) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      g.track.point(laneS, c.x, c.mesh.position, ROAD.top - 0.005);
    }
  }
}
