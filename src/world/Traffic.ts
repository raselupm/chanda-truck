// Pooled highway traffic (left-hand driving): buses, trucks, cars, CNGs, rickshaws, plus collisions.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import { ROAD, TRAFFIC, TRUCK, WORLD } from '../config/tuning';
import type { Game } from '../game/Game';
import { blobShadow, vertexColorMaterial } from '../utils/geometry';
import { clamp, damp } from '../utils/math';
import { rearMaterials, sideMaterials, stickerMaterials } from './VehicleArt';
import { VEHICLE_DIMS, vehicleGeometry, type TrafficKind } from './VehicleModels';
import type { ZoneKind } from './Track';

interface Vehicle {
  active: boolean;
  kind: TrafficKind;
  mesh: THREE.Group;
  s: number;
  d: number;
  targetD: number;
  /** m/s, always positive; dir gives the travel direction */
  speed: number;
  cruise: number;
  /** 1 = same direction as the player, -1 = oncoming */
  dir: 1 | -1;
  len: number;
  wid: number;
  heavy: boolean;
  overtaker: boolean;
  overtakeState: 0 | 1 | 2;
  /** knocked aside / stalled after a crash */
  stalled: number;
  hitCooldown: number;
  hop: number;
  /** painted slogans (rear plate, side names / sticker) */
  art: THREE.Group;
  rear: THREE.Mesh | null;
  sides: THREE.Mesh[];
  /** >0 while pulled aside after the player honked */
  yieldTimer: number;
  homeD: number;
}

const MIX: Record<ZoneKind, [TrafficKind, number][]> = {
  village: [],
  rural: [['bus', 0.35], ['truck', 0.33], ['car', 0.2], ['cng', 0.12]],
  town: [['bus', 0.25], ['truck', 0.2], ['car', 0.15], ['cng', 0.25], ['rickshaw', 0.15]],
  river: [['bus', 0.45], ['truck', 0.4], ['car', 0.15]],
  city: [['bus', 0.18], ['car', 0.22], ['cng', 0.28], ['rickshaw', 0.32]],
};

const SPEED_KMH: Record<TrafficKind, [number, number]> = {
  bus: [55, 72],
  truck: [45, 60],
  car: [60, 80],
  cng: [32, 42],
  rickshaw: [10, 15],
};

const LAMP_GEO = new THREE.BoxGeometry(0.34, 0.2, 0.06);

const POOL_PER_KIND: Record<TrafficKind, number> = { bus: 10, truck: 8, car: 12, cng: 14, rickshaw: 16 };

export class Traffic {
  readonly group = new THREE.Group();
  private pool: Vehicle[] = [];
  private spawnTimer = 0;
  private headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
  private tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  private lightsOn = false;

  constructor(private game: Game) {
    const mat = vertexColorMaterial();
    let variant = 0;
    for (const kind of Object.keys(POOL_PER_KIND) as TrafficKind[]) {
      for (let i = 0; i < POOL_PER_KIND[kind]; i++) {
        const dims = VEHICLE_DIMS[kind];
        const g = new THREE.Group();
        g.add(new THREE.Mesh(vehicleGeometry(kind, variant++ % 5), mat));
        g.add(blobShadow(dims.wid * 1.3, dims.len * 1.1));
        // Lamps (only visible when it's dark)
        const lampY = kind === 'rickshaw' ? 0.9 : kind === 'cng' ? 0.7 : 1.0;
        const lamps = new THREE.Group();
        for (const x of kind === 'rickshaw' || kind === 'cng' ? [0] : [-dims.wid * 0.34, dims.wid * 0.34]) {
          const h = new THREE.Mesh(LAMP_GEO, this.headMat);
          h.position.set(x, lampY, -dims.len / 2 - 0.04);
          const t = new THREE.Mesh(LAMP_GEO, this.tailMat);
          t.position.set(x, lampY, dims.len / 2 + 0.04);
          lamps.add(h, t);
        }
        lamps.visible = false;
        lamps.name = 'lamps';
        g.add(lamps);
        const art = this.buildArt(kind);
        g.add(art.group);
        g.visible = false;
        this.group.add(g);
        this.pool.push({
          active: false, kind, mesh: g, s: 0, d: 0, targetD: 0, speed: 0, cruise: 0, dir: 1,
          len: dims.len, wid: dims.wid, heavy: kind === 'bus' || kind === 'truck',
          overtaker: false, overtakeState: 0, stalled: 0, hitCooldown: 0, hop: 0, yieldTimer: 0, homeD: 0,
          art: art.group, rear: art.rear, sides: art.sides,
        });
      }
    }
  }

  /** Planes for slogans, placed on each model's rear / sides (models face -Z, rear is +Z). */
  private buildArt(kind: TrafficKind): { group: THREE.Group; rear: THREE.Mesh | null; sides: THREE.Mesh[] } {
    const group = new THREE.Group();
    const plane = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), rearMaterials()[0]);
    const spec: Record<TrafficKind, { rear: [number, number, number, number, number]; side?: [number, number, number, number, number] }> = {
      // [w, h, x/y/z...] rear: w, h, y, z ; side: w, h, x, y, z
      bus: { rear: [2.2, 0.9, 0, 2.0, 5.52], side: [8.5, 0.5, 1.28, 1.02, 0] },
      truck: { rear: [2.2, 1.2, 0, 2.6, 4.12], side: [5.2, 0.75, 1.27, 2.7, 1.2] },
      cng: { rear: [1.2, 0.42, 0, 0.62, 1.31] },
      rickshaw: { rear: [0.9, 0.5, 0, 1.25, 0.87] },
      car: { rear: [1.2, 0.2, 0, 0.98, 2.21] },
    };
    const sp = spec[kind];
    const [rw, rh, rx, ry, rz] = sp.rear;
    const rear = plane(rw, rh);
    rear.position.set(rx, ry, rz);
    group.add(rear);
    const sides: THREE.Mesh[] = [];
    if (sp.side) {
      const [sw, sh, sx, sy, sz] = sp.side;
      for (const dir of [-1, 1]) {
        const m = plane(sw, sh);
        m.position.set(dir * sx, sy, sz);
        m.rotation.y = dir * (Math.PI / 2);
        sides.push(m);
        group.add(m);
      }
    }
    return { group, rear, sides };
  }

  /** Give a freshly spawned vehicle random writing. */
  private paint(v: Vehicle): void {
    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    if (v.rear) v.rear.material = v.kind === 'car' ? pick(stickerMaterials()) : pick(rearMaterials());
    const name = pick(sideMaterials());
    for (const m of v.sides) m.material = name;
  }

  /**
   * Player honked: the vehicle in front moves aside (inner lane → outer lane, outer lane → shoulder),
   * and an oncoming bus overtaking in our lane ducks back early.
   * Returns how many vehicles gave way.
   */
  honk(): number {
    const g = this.game;
    const t = g.truck;
    let n = 0;
    for (const v of this.pool) {
      if (!v.active || v.stalled > 0) continue;
      if (v.dir === -1) {
        if (v.overtaker && v.overtakeState === 1 && v.s - t.s < 320) {
          v.overtakeState = 2;
          v.targetD = 0.25 * g.track.halfWidth(v.s);
        }
        continue;
      }
      const gap = v.s - t.s;
      if (gap <= 0 || gap > 140 || Math.abs(v.d - t.d) > 2.6 || v.yieldTimer > 0) continue;
      const hw = g.track.halfWidth(v.s);
      if (g.track.bridgeAt(v.s) && v.d < -hw * 0.5) continue; // no shoulder on the bridge
      v.homeD = v.d;
      v.targetD = v.d > -hw * 0.5 ? -0.75 * hw : -(hw + 0.6);
      v.yieldTimer = 8;
      n++;
    }
    return n;
  }

  /** Turn vehicle lamps on in the dark. */
  setLights(level: number): void {
    const on = level > 0.35;
    if (on === this.lightsOn) return;
    this.lightsOn = on;
    for (const v of this.pool) v.mesh.getObjectByName('lamps')!.visible = on;
  }

  reset(): void {
    for (const v of this.pool) {
      v.active = false;
      v.mesh.visible = false;
    }
  }

  private activeCount(dir: 1 | -1, fromS: number): number {
    let n = 0;
    for (const v of this.pool) if (v.active && v.dir === dir && v.s > fromS) n++;
    return n;
  }

  /** Is s inside a zone where unresolved set pieces forbid traffic? */
  private excluded(s: number): boolean {
    for (const p of this.game.pieces) {
      if (!p.blocking || p.allowsQueue) continue;
      if (s > p.s - 230 && s < p.s + 40) return true;
    }
    return false;
  }

  private nextBlockingS(fromS: number): number {
    let best = Infinity;
    for (const p of this.game.pieces) if (p.blocking && p.s > fromS && p.s < best) best = p.s;
    return best;
  }

  /** Where same-direction traffic must stop for the next blocking piece (front bumper position). */
  private stopLineAhead(fromS: number): number {
    let best = Infinity;
    for (const p of this.game.pieces) {
      if (!p.blocking || p.s <= fromS) continue;
      const line = p.s - p.queueGap;
      if (line < best) best = line;
    }
    return best;
  }

  /** Oncoming traffic stops before a closed rail gate on its side. */
  private stopLineBehind(fromS: number): number {
    let best = -Infinity;
    for (const p of this.game.pieces) {
      if (!p.blocking || !p.allowsQueue || p.s >= fromS) continue;
      const line = p.s + p.queueGap;
      if (line > best) best = line;
    }
    return best;
  }

  private trySpawn(dir: 1 | -1): void {
    const g = this.game;
    const truckS = g.truck.s;
    // Busy streets: vehicles can appear closer (buildings hide the pop-in)
    const dense = g.track.zone(truckS + 150) === 'city';
    const min = dense ? 140 : TRAFFIC.spawnAheadMin;
    const s = truckS + min + Math.random() * (TRAFFIC.spawnAheadMax - min);
    if (s > g.track.length - 300) return;
    if (this.excluded(s)) return;
    // oncoming vehicles would have to drive through a closed barrier to reach us
    if (dir === -1 && this.nextBlockingS(truckS) < s + 60) return;
    const zone = g.track.zone(s);
    const mix = MIX[zone];
    if (!mix.length) return;
    let r = Math.random();
    let kind: TrafficKind = mix[0][0];
    for (const [k, w] of mix) {
      if ((r -= w) <= 0) {
        kind = k;
        break;
      }
    }
    const v = this.pool.find((p) => !p.active && p.kind === kind);
    if (!v) return;
    const hw = g.track.halfWidth(s);
    const slow = kind === 'rickshaw' || kind === 'cng';
    const outer = slow || Math.random() < 0.5;
    const lane = (outer ? 0.75 : 0.25) * hw;
    const d = dir === 1 ? -lane : lane;
    // keep a gap from others in the same lane
    for (const o of this.pool) {
      if (o.active && o.dir === dir && Math.abs(o.d - d) < 1.5 && Math.abs(o.s - s) < 30) return;
    }
    const [lo, hi] = SPEED_KMH[kind];
    v.active = true;
    v.s = s;
    v.d = v.targetD = d;
    v.dir = dir;
    v.cruise = v.speed = (lo + Math.random() * (hi - lo)) / 3.6;
    v.overtaker = dir === -1 && v.heavy && !outer && Math.random() < TRAFFIC.overtakerChance;
    v.overtakeState = 0;
    v.stalled = 0;
    v.hitCooldown = 0;
    v.hop = 0;
    v.yieldTimer = 0;
    v.homeD = d;
    v.mesh.visible = true;
    this.paint(v);
    v.mesh.rotation.set(0, dir === 1 ? 0 : Math.PI, 0);
  }

  update(dt: number): void {
    const g = this.game;
    if (g.state.phase !== 'HIGHWAY') return;
    const truck = g.truck;
    const zone = g.track.zone(truck.s + 200);
    const [wantSame, wantOn] = TRAFFIC.density[zone] ?? [0, 0];

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = zone === 'city' || zone === 'town' ? 0.15 : 0.3;
      if (this.activeCount(1, truck.s + 20) < wantSame) this.trySpawn(1);
      if (this.activeCount(-1, truck.s + 20) < wantOn) this.trySpawn(-1);
    }

    for (const v of this.pool) {
      if (!v.active) continue;
      if (v.stalled > 0) {
        v.stalled -= dt;
        v.speed = damp(v.speed, 0, 3, dt);
      } else {
        // follow the vehicle ahead in the same lane
        let target = v.cruise;
        for (const o of this.pool) {
          if (o === v || !o.active || o.dir !== v.dir || Math.abs(o.d - v.d) > 1.6) continue;
          const gap = (o.s - v.s) * v.dir;
          if (gap > 0 && gap < 22) target = Math.min(target, o.speed);
        }
        // nobody drives through a closed barrier / gate: queue up at the stop line
        const front = v.s + (v.dir * v.len) / 2;
        if (v.dir === 1) {
          const gap = this.stopLineAhead(v.s) - front;
          if (gap < 30) target = Math.min(target, Math.max(0, gap - 1.5) * 0.6);
        } else {
          const gap = front - this.stopLineBehind(v.s);
          if (gap < 30) target = Math.min(target, Math.max(0, gap - 1.5) * 0.6);
        }
        v.speed = damp(v.speed, target, 1.2, dt);
      }

      // Oncoming overtaker swings into our inner lane, then back
      if (v.overtaker) {
        const gap = v.s - truck.s;
        const hw = g.track.halfWidth(v.s);
        if (v.overtakeState === 0 && gap < 430 && gap > 260) {
          v.overtakeState = 1;
          v.targetD = -0.25 * hw;
          g.sound.otherHorn();
          g.hud.toast('⚠️ উল্টো দিক থেকে বাস আপনার লেনে ওভারটেক করছে!');
        } else if (v.overtakeState === 1 && gap < 200) {
          v.overtakeState = 2;
          v.targetD = 0.25 * hw;
        }
      }
      // Pulled aside for the horn: crawl on the side until the truck has passed, then merge back
      if (v.yieldTimer > 0) {
        v.yieldTimer -= dt;
        v.speed = Math.min(v.speed, v.cruise * 0.7);
        if (v.yieldTimer <= 0 || v.s < truck.s - 12) {
          v.yieldTimer = 0;
          if (v.s < truck.s - 12) v.targetD = v.homeD;
          else v.yieldTimer = 1;
        }
      }
      v.d = damp(v.d, v.targetD, v.overtaker ? 2.6 : v.yieldTimer > 0 ? 2.2 : 1.6, dt);
      v.s += v.speed * WORLD.speedScale * v.dir * dt;
      v.hitCooldown = Math.max(0, v.hitCooldown - dt);
      if (v.hop > 0) v.hop = Math.max(0, v.hop - dt);

      const rel = v.s - truck.s;
      // Writing is unreadable far away: skip those draw calls
      v.art.visible = rel > -40 && rel < 170;
      if (rel < -TRAFFIC.despawnBehind || rel > TRAFFIC.spawnAheadMax + 80 || (this.excluded(v.s) && Math.abs(rel) > 120)) {
        v.active = false;
        v.mesh.visible = false;
        continue;
      }

      const y = g.track.surfaceY(v.s) + Math.sin(Math.min(1, v.hop) * Math.PI) * 0.6;
      v.mesh.position.set(g.track.centerX(v.s) + v.d, y, -v.s);
      v.mesh.rotation.y = (v.dir === 1 ? 0 : Math.PI) - g.track.headingAt(v.s) - (v.targetD - v.d) * 0.05 * v.dir;

      this.collide(v);
    }
  }

  private collide(v: Vehicle): void {
    const g = this.game;
    const t = g.truck;
    if (v.hitCooldown > 0) return;
    const rel = t.heading - g.track.headingAt(t.s);
    const thl = TRUCK.length / 2;
    const thw = TRUCK.width / 2 + Math.abs(Math.sin(rel)) * thl * 0.8;
    const ds = v.s - t.s;
    const dd = v.d - t.d;
    const ovS = thl + v.len / 2 - Math.abs(ds);
    const ovD = thw + v.wid / 2 - Math.abs(dd);
    if (ovS <= 0 || ovD <= 0) return;

    v.hitCooldown = 1.2;
    g.stats.collisions++;
    const truckKmh = t.kmh;
    const vehKmh = v.speed * 3.6 * v.dir;
    const pct = ECONOMY.cargoDamagePct;

    if (ovS < ovD) {
      // front/back impact
      const closing = v.dir === -1 ? Math.max(0, truckKmh) + v.speed * 3.6 : truckKmh - vehKmh;
      if (v.dir === -1 && v.heavy && closing >= TRAFFIC.headOnGameOverKmh) {
        g.cam.shake(2.5);
        g.sound.crash(1.2);
        g.gameOver('crash');
        return;
      }
      if (ds > 0) {
        // we hit it from behind (or head-on at low closing speed)
        g.cam.shake(clamp(closing / 60, 0.3, 1.6));
        g.sound.crash(clamp(closing / 80, 0.3, 1));
        t.speed = v.dir === 1 ? Math.max(0, v.speed * 0.6) : -1.5;
        t.clampFront(v.s - v.len / 2 - 0.2);
        g.damageCargo(v.dir === -1 ? pct.headOnLight : clamp(closing * pct.rearEndPerKmh, 0.3, pct.rearEndMax), 'সংঘর্ষে মাল নষ্ট', 'মহাসড়ক');
        if (!v.heavy) this.knockAside(v, t.d);
        else v.speed += 2;
        g.hud.toast('💥 ধাক্কা! মাল পড়ে গেল');
      } else {
        // rear-ended by a faster vehicle
        g.cam.shake(0.4);
        g.sound.crash(0.3);
        v.speed = Math.max(0, t.speed - 2);
        t.speed += 1.5;
      }
    } else {
      // side swipe
      const push = Math.sign(t.d - v.d || -1);
      t.shiftLateral(push * Math.min(ovD, 0.8));
      t.speed *= 0.85;
      g.cam.shake(0.5);
      g.sound.crash(0.25);
      g.damageCargo(pct.sideSwipe, 'ঘষা লেগে মাল নষ্ট', 'মহাসড়ক');
      if (!v.heavy) this.knockAside(v, t.d);
      else v.targetD = v.d - push * 0.8;
    }
  }

  /** Light vehicles comically hop to the roadside and stall — nobody gets hurt. */
  private knockAside(v: Vehicle, truckD: number): void {
    const hw = this.game.track.halfWidth(v.s);
    v.targetD = (v.d < truckD ? -1 : 1) * (hw + ROAD.shoulder - 0.4);
    v.stalled = 4;
    v.hop = 1;
  }
}
