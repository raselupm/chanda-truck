// Pooled highway traffic (left-hand driving): buses, trucks, cars, CNGs, rickshaws, plus collisions.
// The village shortcuts get their own: rickshaws, CNGs and motorbikes only.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import { BROKEN_ROAD, CITY, EXHAUST, FERRY, HILL, ROAD, SHORTCUT, TRAFFIC, TRUCK, WORLD } from '../config/tuning';
import type { Game } from '../game/Game';
import { blobShadow, vertexColorMaterial } from '../utils/geometry';
import { clamp, damp } from '../utils/math';
import { adMaterials } from './AdBoards';
import { rearMaterials, sideMaterials, stickerMaterials } from './VehicleArt';
import { VEHICLE_DIMS, vehicleGeometry, type TrafficKind } from './VehicleModels';
import type { Shortcut } from './Shortcut';
import type { ZoneKind } from './Track';

interface Vehicle {
  active: boolean;
  kind: TrafficKind;
  mesh: THREE.Group;
  /** the village shortcut it drives on (d is then across that road), null = the highway */
  road: Shortcut | null;
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
  /** horn taps received (buses/trucks need several) and seconds until that count is forgotten */
  honks: number;
  honkTimer: number;
  /** >0 while pulled aside after the player honked */
  yieldTimer: number;
  homeD: number;
  /** s of the last toll booth this vehicle has paid at, and seconds spent paying at the current one */
  servedS: number;
  serve: number;
  /** queued in a jam: kept alive (even far ahead) until it has passed this s */
  pinUntil: number;
  /** s of the flagman / light whose line this vehicle last saw open on its approach */
  greenS: number;
}

/** a vehicle this close sideways to the truck is in its lane (truck 2.5 m wide, cars ~2 m) */
const TRUCK_LANE = 2.2;

const MIX: Record<ZoneKind, [TrafficKind, number][]> = {
  village: [],
  rural: [['bus', 0.35], ['truck', 0.33], ['car', 0.2], ['cng', 0.12]],
  town: [['bus', 0.25], ['truck', 0.2], ['car', 0.15], ['cng', 0.25], ['rickshaw', 0.15]],
  river: [['bus', 0.45], ['truck', 0.4], ['car', 0.15]],
  city: [['bus', 0.18], ['car', 0.22], ['cng', 0.28], ['rickshaw', 0.32]],
  hill: [['bus', 0.3], ['truck', 0.3], ['car', 0.2], ['cng', 0.2]],
};
/** no buses or trucks on the village roads */
const SHORTCUT_MIX: [TrafficKind, number][] = [['rickshaw', 0.4], ['cng', 0.35], ['bike', 0.25]];

const SPEED_KMH: Record<TrafficKind, [number, number]> = {
  bus: [55, 72],
  truck: [45, 60],
  car: [60, 80],
  cng: [32, 42],
  rickshaw: [10, 15],
  bike: [32, 48],
};

export interface HonkResult {
  /** small vehicles that moved over */
  small: number;
  /** buses/trucks that finally moved over */
  heavy: number;
  /** a bus/truck that ignored this tap, with how many taps it has had */
  stubborn: { kind: TrafficKind; count: number } | null;
}

const LAMP_GEO = new THREE.BoxGeometry(0.34, 0.2, 0.06);

const POOL_PER_KIND: Record<TrafficKind, number> = { bus: 10, truck: 8, car: 12, cng: 18, rickshaw: 20, bike: 8 };

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
        const lampY = kind === 'rickshaw' || kind === 'bike' ? 0.9 : kind === 'cng' ? 0.7 : 1.0;
        const lamps = new THREE.Group();
        for (const x of kind === 'rickshaw' || kind === 'cng' || kind === 'bike' ? [0] : [-dims.wid * 0.34, dims.wid * 0.34]) {
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
          active: false, kind, mesh: g, road: null, s: 0, d: 0, targetD: 0, speed: 0, cruise: 0, dir: 1,
          len: dims.len, wid: dims.wid, heavy: kind === 'bus' || kind === 'truck',
          overtaker: false, overtakeState: 0, stalled: 0, hitCooldown: 0, hop: 0, yieldTimer: 0, homeD: 0, honks: 0, honkTimer: 0,
          servedS: -Infinity, serve: 0, pinUntil: -Infinity, greenS: -Infinity,
          art: art.group, rear: art.rear, sides: art.sides,
        });
      }
    }
  }

  /** Planes for slogans, placed on each model's rear / sides (models face -Z, rear is +Z). */
  private buildArt(kind: TrafficKind): { group: THREE.Group; rear: THREE.Mesh | null; sides: THREE.Mesh[] } {
    const group = new THREE.Group();
    const plane = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), rearMaterials()[0]);
    const spec: Record<TrafficKind, { rear?: [number, number, number, number, number]; side?: [number, number, number, number, number] }> = {
      // [w, h, x/y/z...] rear: w, h, y, z ; side: w, h, x, y, z
      bus: { rear: [2.2, 0.9, 0, 2.0, 5.52], side: [8.5, 0.5, 1.28, 1.02, 0] },
      truck: { rear: [2.2, 1.2, 0, 2.6, 4.12], side: [5.2, 0.75, 1.27, 2.7, 1.2] },
      cng: { rear: [1.2, 0.42, 0, 0.62, 1.31] },
      rickshaw: { rear: [0.9, 0.5, 0, 1.25, 0.87] },
      car: { rear: [1.2, 0.2, 0, 0.98, 2.21] },
      bike: {},
    };
    const sp = spec[kind];
    let rear: THREE.Mesh | null = null;
    if (sp.rear) {
      const [rw, rh, rx, ry, rz] = sp.rear;
      rear = plane(rw, rh);
      rear.position.set(rx, ry, rz);
      group.add(rear);
    }
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
    // trucks carry a random ad from the ads/ folder on the tailboard (same shape as the panel)
    const ads = adMaterials();
    if (v.rear) v.rear.material = v.kind === 'car' ? pick(stickerMaterials()) : v.kind === 'truck' && ads.length ? pick(ads) : pick(rearMaterials());
    const name = pick(sideMaterials());
    for (const m of v.sides) m.material = name;
  }

  /**
   * One horn press ('tap') or a long press ('long').
   * The vehicle in front swaps lanes to let the truck through: right lane → left, left lane → right.
   * Small vehicles (car, CNG, rickshaw) move on the first tap; buses and trucks only after
   * TRAFFIC.heavyHonks taps (within a few seconds) or a long press.
   * An oncoming bus overtaking in our lane ducks back on any horn.
   */
  honk(press: 'tap' | 'long'): HonkResult {
    const g = this.game;
    const t = g.truck;
    const res: HonkResult = { small: 0, heavy: 0, stubborn: null };
    for (const v of this.pool) {
      if (!v.active || v.stalled > 0) continue;
      if (v.dir === -1) {
        if (v.overtaker && v.overtakeState === 1 && v.s - t.s < 320) {
          v.overtakeState = 2;
          v.targetD = g.track.laneD(v.s, false);
        }
        continue;
      }
      const gap = v.s - t.s;
      if (gap <= 0 || gap > 140 || !this.meetsTruck(v) || Math.abs(this.worldD(v) - t.d) > 2.6 || v.yieldTimer > 0) continue;
      // stuck in a queue, or a bus on the city avenue with nowhere to go
      const wide = !v.road && g.track.isWide(v.s);
      if (v.speed < 1 || (wide && v.heavy)) continue;
      if (v.heavy && press === 'tap') {
        v.honks++;
        v.honkTimer = TRAFFIC.heavyHonkWindow;
        if (v.honks < TRAFFIC.heavyHonks) {
          res.stubborn = { kind: v.kind, count: v.honks };
          continue;
        }
      }
      let target: number;
      if (v.road) {
        // village road: squeeze onto the verge
        target = -(SHORTCUT.halfWidth - v.wid / 2 - 0.15);
      } else {
        const inner = g.track.laneD(v.s, false);
        const outer = g.track.laneD(v.s, true);
        // on the avenue small vehicles squeeze against the rickshaws; elsewhere they swap lanes
        target = wide ? -(CITY.openLanes * CITY.laneWidth + 0.45) : v.d > -(inner + outer) / 2 ? -outer : -inner;
      }
      // only if the other lane is free next to it
      const blocked = this.pool.some(
        (o) => o !== v && o.active && o.road === v.road && o.dir === 1 && Math.abs(o.d - target) < 1.6 && Math.abs(o.s - v.s) < (o.len + v.len) / 2 + 6,
      );
      if (blocked) continue;
      v.homeD = v.d;
      v.targetD = target;
      v.yieldTimer = 8;
      v.honks = 0;
      if (v.heavy) res.heavy++;
      else res.small++;
    }
    return res;
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

  private activeCount(dir: 1 | -1, fromS: number, road: Shortcut | null): number {
    let n = 0;
    for (const v of this.pool) if (v.active && v.road === road && v.dir === dir && v.s > fromS) n++;
    return n;
  }

  /** d measured from the highway's centreline, like the truck's. */
  private worldD(v: Vehicle): number {
    return v.road ? v.d + v.road.offset(v.s) : v.d;
  }

  /**
   * Can the truck and v run into each other? Only on the same road, or at a fork / join where the
   * shortcut still overlaps the highway (never with one on the flyover and the other underneath).
   */
  private meetsTruck(v: Vehicle): boolean {
    const t = this.game.truck;
    if (v.road === t.road) return true;
    const sc = (v.road ?? t.road)!;
    return Math.abs(sc.offset(v.s)) < 10 && this.game.track.elevation(v.s) < 1;
  }

  /** Is s inside a zone where unresolved set pieces forbid traffic? */
  private excluded(s: number): boolean {
    for (const p of this.game.pieces) {
      if (!p.blocking || p.allowsQueue || p.controlsTraffic) continue;
      if (s > p.s - 230 && s < p.s + 40) return true;
    }
    return false;
  }

  private nextBlockingS(fromS: number): number {
    let best = Infinity;
    for (const p of this.game.pieces) if (p.blocking && !p.controlsTraffic && p.s > fromS && p.s < best) best = p.s;
    return best;
  }

  /** Where same-direction traffic must stop for the next blocking piece (front bumper position). */
  private stopLineAhead(fromS: number): number {
    let best = Infinity;
    for (const p of this.game.pieces) {
      if (!p.blocking || p.controlsTraffic || p.s <= fromS) continue;
      const line = p.s - p.queueGap;
      if (line < best) best = line;
    }
    return best;
  }

  /** Oncoming traffic stops before a closed rail gate on its side. */
  private stopLineBehind(fromS: number): number {
    let best = -Infinity;
    for (const p of this.game.pieces) {
      if (!p.blocking || !p.allowsQueue || p.controlsTraffic || p.s >= fromS) continue;
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
    // nothing drives on the river where a ferry crosses it, nor at its ghats
    if (g.track.isFerry(s, FERRY.trafficClear + 80)) return;
    // not in the middle of a toll queue, roadworks or junction
    for (const p of g.pieces) if (p.controlsTraffic && s > p.s - 150 && s < p.s + 100) return;
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
    // on the city avenue the rickshaws are parked in the occupied lanes, not in the open one
    if (kind === 'rickshaw' && g.track.wideness(s) > 0) kind = 'cng';
    const v = this.pool.find((p) => !p.active && p.kind === kind);
    if (!v) return;
    const slow = kind === 'rickshaw' || kind === 'cng';
    const outer = slow || Math.random() < 0.5;
    const lane = g.track.laneD(s, outer);
    const d = dir === 1 ? -lane : lane;
    // keep a gap from others in the same lane
    for (const o of this.pool) {
      if (o.active && !o.road && o.dir === dir && Math.abs(o.d - d) < 3 && Math.abs(o.s - s) < 30) return;
    }
    this.activate(v, s, d, dir, null);
    // (no overtaking on the hill road's blind bends)
    v.overtaker = dir === -1 && v.heavy && !outer && zone !== 'hill' && Math.random() < TRAFFIC.overtakerChance;
  }

  /** A rickshaw, CNG or motorbike on a village shortcut, somewhere ahead of the truck. */
  private trySpawnShortcut(sc: Shortcut, dir: 1 | -1): void {
    const s = this.game.truck.s + TRAFFIC.spawnAheadMin + Math.random() * (TRAFFIC.spawnAheadMax - TRAFFIC.spawnAheadMin);
    if (s < sc.from + 40 || s > sc.to - 40) return;
    let r = Math.random();
    let kind: TrafficKind = SHORTCUT_MIX[0][0];
    for (const [k, w] of SHORTCUT_MIX) {
      if ((r -= w) <= 0) {
        kind = k;
        break;
      }
    }
    const v = this.pool.find((p) => !p.active && p.kind === kind);
    if (!v) return;
    // rickshaws keep to the verge
    const lane = kind === 'rickshaw' ? SHORTCUT.halfWidth - 0.85 : SHORTCUT.halfWidth / 2;
    const d = dir === 1 ? -lane : lane;
    for (const o of this.pool) {
      if (o.active && o.road === sc && o.dir === dir && Math.abs(o.s - s) < 25) return;
    }
    this.activate(v, s, d, dir, sc);
  }

  private activate(v: Vehicle, s: number, d: number, dir: 1 | -1, road: Shortcut | null): void {
    const [lo, hi] = SPEED_KMH[v.kind];
    v.active = true;
    v.road = road;
    v.s = s;
    v.d = v.targetD = d;
    v.dir = dir;
    v.cruise = v.speed = (lo + Math.random() * (hi - lo)) / 3.6;
    v.overtaker = false;
    v.overtakeState = 0;
    v.stalled = 0;
    v.hitCooldown = 0;
    v.hop = 0;
    v.yieldTimer = 0;
    v.homeD = d;
    v.honks = 0;
    v.honkTimer = 0;
    v.servedS = -Infinity;
    v.serve = 0;
    v.pinUntil = -Infinity;
    v.greenS = -Infinity;
    v.mesh.visible = true;
    this.paint(v);
    v.mesh.rotation.set(0, dir === 1 ? 0 : Math.PI, 0);
  }

  /**
   * A jam: `count` vehicles waiting nose to tail behind the stop line at lineS, in lane d, facing `dir`.
   * They drive on to `homeD` once past. Returns how many were placed.
   */
  spawnQueue(lineS: number, d: number, homeD: number, count: number, dir: 1 | -1 = 1): number {
    const kinds: TrafficKind[] = ['truck', 'car', 'bus', 'cng', 'car', 'truck', 'cng', 'car'];
    const first = Math.floor(Math.random() * kinds.length);
    // front bumper of the next vehicle; the queue grows away from the line, against `dir`
    let front = lineS - 0.3 * dir;
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const want = kinds[(first + i) % kinds.length];
      const v = this.pool.find((p) => !p.active && p.kind === want) ?? this.pool.find((p) => !p.active && p.kind !== 'rickshaw');
      if (!v) break;
      const s = front - (dir * v.len) / 2;
      // somebody is already standing there: queue starts behind them
      const there = this.pool.find((o) => o.active && o.dir === dir && Math.abs(o.d - d) < 2.5 && Math.abs(o.s - s) < (o.len + v.len) / 2 + 1);
      if (there) {
        front = there.s - dir * (there.len / 2 + 2.4);
        i--;
        if ((lineS - front) * dir > 120) break;
        continue;
      }
      this.activate(v, s, d, dir, null);
      v.speed = 0;
      v.homeD = homeD;
      // our way: kept until past the line; oncoming: kept until it has passed us (despawnBehind)
      v.pinUntil = dir === 1 ? lineS + 40 : Infinity;
      front -= dir * (v.len + 2.2 + Math.random() * 0.8);
      placed++;
    }
    return placed;
  }

  /** Is any vehicle going `dir` overlapping [fromS, toS]? */
  anyBetween(fromS: number, toS: number, dir: 1 | -1): boolean {
    return this.pool.some((v) => v.active && !v.road && v.dir === dir && v.s - v.len / 2 < toS && v.s + v.len / 2 > fromS);
  }

  /** Is a vehicle (our direction) occupying [fromS, toS] near lateral offset d? */
  vehicleBetween(fromS: number, toS: number, d: number): boolean {
    return this.pool.some((v) => v.active && !v.road && v.dir === 1 && Math.abs(v.d - d) < 2.4 && v.s - v.len / 2 < toS && v.s + v.len / 2 > fromS);
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
      if (this.activeCount(1, truck.s + 20, null) < wantSame) this.trySpawn(1);
      if (this.activeCount(-1, truck.s + 20, null) < wantOn) this.trySpawn(-1);
      // the village shortcut ahead (or the one the truck is on)
      const sc = g.track.shortcuts.find((c) => truck.s > c.from - 500 && truck.s < c.to - 60);
      if (sc) {
        const [same, on] = SHORTCUT.traffic;
        if (this.activeCount(1, truck.s + 20, sc) < same) this.trySpawnShortcut(sc, 1);
        if (this.activeCount(-1, truck.s + 20, sc) < on) this.trySpawnShortcut(sc, -1);
      }
    }

    let lead: Vehicle | null = null;
    let stopAt: number | null = null;
    let truckAhead = false;
    for (const v of this.pool) {
      if (!v.active) continue;
      // off the end of the shortcut: carry on along the highway (the two meet there, so d still fits)
      if (v.road && !v.road.contains(v.s)) v.road = null;
      lead = null;
      stopAt = null;
      truckAhead = false;
      if (v.stalled > 0) {
        v.stalled -= dt;
        v.speed = damp(v.speed, 0, 3, dt);
      } else {
        // follow the vehicle ahead in the same lane, bumper to bumper in a jam
        let target = v.cruise;
        if (!v.road && g.track.isHill(v.s)) target = Math.min(target, HILL.trafficKmh / 3.6);
        if (!v.road && g.track.isBroken(v.s)) target = Math.min(target, BROKEN_ROAD.maxKmh / 3.6);
        lead = null;
        let leadGap = Infinity;
        for (const o of this.pool) {
          if (o === v || !o.active || o.road !== v.road || o.dir !== v.dir || Math.abs(o.d - v.d) > 1.6) continue;
          const gap = (o.s - v.s) * v.dir - (o.len + v.len) / 2;
          if (gap > -2 && gap < leadGap) {
            leadGap = gap;
            lead = o;
          }
        }
        // the player's truck is traffic too: slow down and queue behind it, never drive into it
        if (v.dir === 1 && this.meetsTruck(v) && Math.abs(truck.d - this.worldD(v)) < TRUCK_LANE) {
          const gap = truck.rearS - (v.s + v.len / 2);
          if (gap > -2 && gap < leadGap) {
            leadGap = gap;
            lead = null;
            truckAhead = true;
          }
        }
        const leadSpeed = truckAhead ? Math.max(0, truck.speed) : lead?.speed ?? 0;
        if ((lead || truckAhead) && leadGap < 40) target = Math.min(target, Math.max(0, leadSpeed + (leadGap - 2.5) * 0.35));
        // nobody drives through a closed barrier / gate: queue up at the stop line
        // (none of that on the village shortcuts)
        const front = v.s + (v.dir * v.len) / 2;
        if (v.road) {
          // nothing to stop for
        } else if (v.dir === 1) {
          const gap = this.stopLineAhead(v.s) - front;
          if (gap < 30) target = Math.min(target, Math.max(0, gap - 1.5) * 0.6);
        } else {
          const gap = front - this.stopLineBehind(v.s);
          if (gap < 30) target = Math.min(target, Math.max(0, gap - 1.5) * 0.6);
        }
        // toll booths, flagmen and traffic lights
        stopAt = null;
        for (const p of v.road ? [] : g.pieces) {
          if (!p.controlsTraffic) continue;
          const line = p.stopLine(v.dir);
          if (line === null) {
            if (Math.abs(p.s - front) < 150) v.greenS = p.s;
            continue;
          }
          if (v.servedS === p.s) continue;
          const gap = (line - front) * v.dir;
          if (gap < -0.5 || gap > 45) continue;
          const service = p.serviceTime;
          // it changed to red just as we got there, too close to stop: carry on through
          // (arriving at a line that was already red, everyone stops)
          if (!service && v.greenS === p.s && v.speed > 3 && gap < v.speed * 1.2) continue;
          target = Math.min(target, Math.max(0, gap - 0.3) * 0.35);
          if (stopAt === null || gap < (stopAt - front) * v.dir) stopAt = line;
          if (service && gap < 1.2 && v.speed < 0.5 && (v.serve += dt) >= service) {
            v.servedS = p.s;
            v.serve = 0;
            p.served();
          }
        }
        v.speed = damp(v.speed, target, target < v.speed ? 3.5 : 1.2, dt);
      }

      // Oncoming overtaker swings into our inner lane, then back
      if (v.overtaker) {
        const gap = v.s - truck.s;
        if (v.overtakeState === 0 && gap < 430 && gap > 260) {
          v.overtakeState = 1;
          v.targetD = -g.track.laneD(v.s, false);
          g.sound.otherHorn();
          g.hud.toast('{warning} উল্টো দিক থেকে বাস আপনার লেনে ওভারটেক করছে!');
        } else if (v.overtakeState === 1 && gap < 200) {
          v.overtakeState = 2;
          v.targetD = g.track.laneD(v.s, false);
        }
      }
      if (v.honkTimer > 0 && (v.honkTimer -= dt) <= 0) v.honks = 0;
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
      // lane merges (toll lane, roadworks, the one open lane on the city avenue)
      if (v.road && v.yieldTimer <= 0 && v.stalled <= 0) {
        v.targetD = v.homeD;
      } else if (v.yieldTimer <= 0 && v.overtakeState !== 1 && v.stalled <= 0) {
        if (g.track.wideness(v.s + 30 * v.dir) > 0.5) v.homeD = -v.dir * g.track.laneD(v.s + 30 * v.dir, false);
        let guide: number | null = null;
        for (const p of g.pieces) {
          if (p.controlsTraffic && (guide = p.laneAt(v.s, v.dir)) !== null) break;
        }
        v.targetD = guide ?? v.homeD;
      }
      v.d = damp(v.d, v.targetD, v.overtaker ? 2.6 : v.yieldTimer > 0 ? 2.2 : 1.6, dt);
      v.s += v.speed * WORLD.speedScale * v.dir * dt;
      // never roll past a stop line or into the one ahead
      if (v.stalled <= 0) {
        if (stopAt !== null && (stopAt - (v.s + (v.dir * v.len) / 2)) * v.dir < 0) {
          v.s = stopAt - (v.dir * v.len) / 2;
          v.speed = 0;
        }
        if (lead && (lead.s - v.s) * v.dir - (lead.len + v.len) / 2 < 0.8 && Math.abs(lead.d - v.d) < 1.6) {
          v.s = lead.s - v.dir * ((lead.len + v.len) / 2 + 0.8);
          v.speed = Math.min(v.speed, lead.speed);
        }
        // (only a car that is driving up; one the truck backed up to stays put, see collide)
        if (truckAhead && v.speed > 0.05 && truck.rearS - (v.s + v.len / 2) < 0.8 && Math.abs(truck.d - this.worldD(v)) < TRUCK_LANE) {
          v.s = truck.rearS - v.len / 2 - 0.8;
          v.speed = Math.min(v.speed, Math.max(0, truck.speed));
        }
      }
      if (v.pinUntil > -Infinity && v.s > v.pinUntil) v.pinUntil = -Infinity;
      v.hitCooldown = Math.max(0, v.hitCooldown - dt);
      if (v.hop > 0) v.hop = Math.max(0, v.hop - dt);

      const rel = v.s - truck.s;
      // Writing is unreadable far away: skip those draw calls
      v.art.visible = rel > -40 && rel < 170;
      const pinned = v.pinUntil > v.s;
      // (at a ferry ghat they pull into the yard and are gone)
      const ferried = !v.road && g.track.isFerry(v.s, FERRY.trafficClear);
      if (ferried || rel < -TRAFFIC.despawnBehind || (!pinned && (rel > TRAFFIC.spawnAheadMax + 80 || (!v.road && this.excluded(v.s) && Math.abs(rel) > 120)))) {
        v.active = false;
        v.mesh.visible = false;
        continue;
      }

      const road = v.road ?? g.track;
      const y = road.surfaceY(v.s) + Math.sin(Math.min(1, v.hop) * Math.PI) * 0.6;
      v.mesh.position.set(road.centerX(v.s) + v.d, y, -v.s);
      v.mesh.rotation.y = (v.dir === 1 ? 0 : Math.PI) - road.headingAt(v.s) - (v.targetD - v.d) * 0.05 * v.dir;
      // pedal rickshaws have no engine
      if (v.kind !== 'rickshaw' && Math.abs(rel) < EXHAUST.range) {
        g.exhaust.emit(dt, v.mesh.position.x, v.mesh.position.y, v.mesh.position.z, v.mesh.rotation.y, v.speed, EXHAUST.traffic[v.kind]);
      }

      this.collide(v);
    }
  }

  private collide(v: Vehicle): void {
    const g = this.game;
    const t = g.truck;
    if (!this.meetsTruck(v) || !this.touching(v)) return;
    // how deep the overlap is along / across the road (tells a rear-end from a side swipe)
    const rel = t.heading - t.roadHeading(t.s);
    const thl = TRUCK.length / 2;
    const thw = TRUCK.width / 2;
    const ds = v.s - t.s;
    const vd = this.worldD(v);
    const dd = vd - t.d;
    const ovS = Math.max(0.01, thl * Math.abs(Math.cos(rel)) + thw * Math.abs(Math.sin(rel)) + v.len / 2 - Math.abs(ds));
    const ovD = Math.max(0.01, thl * Math.abs(Math.sin(rel)) + thw * Math.abs(Math.cos(rel)) + v.wid / 2 - Math.abs(dd));
    // creeping up to a queued / slower vehicle: just stop behind it
    if (v.dir === 1 && ds > 0 && ovS < ovD && t.kmh - v.speed * 3.6 < 12) {
      t.clampFront(v.s - v.len / 2 - 0.2);
      t.speed = Math.min(t.speed, v.speed);
      return;
    }
    // Something behind us: whoever is moving into the other one stops. Nobody gets shoved.
    if (ds < 0 && ovS < ovD) {
      if (t.speed < 0) {
        // reversing into it: the truck stops (a bump, not a crash)
        t.speed = 0;
        t.clampRear(v.s + v.len / 2 + 0.2);
        if (v.hitCooldown <= 0) {
          v.hitCooldown = 1.2;
          g.cam.shake(0.3);
          g.sound.crash(0.25);
        }
      } else if (v.dir === 1) {
        // it caught up with us: it stops at our tailboard
        v.s = t.rearS - v.len / 2 - 0.3;
        v.speed = Math.min(v.speed, t.speed);
      }
      return;
    }
    if (v.hitCooldown > 0) return;

    v.hitCooldown = 1.2;
    // on a village road a bump is just a bump: no lost cargo, no penalty, not counted
    const village = !!v.road || (!!t.road && !t.road.inMouth(t.s));
    if (!village) g.stats.collisions++;
    const truckKmh = t.kmh;
    const vehKmh = v.speed * 3.6 * v.dir;
    const pct = ECONOMY.cargoDamagePct;

    if (ovS < ovD) {
      // front/back impact
      const closing = v.dir === -1 ? Math.max(0, truckKmh) + v.speed * 3.6 : truckKmh - vehKmh;
      if (!village && v.dir === -1 && v.heavy && closing >= TRAFFIC.headOnGameOverKmh) {
        g.cam.shake(2.5);
        g.sound.finalCrash();
        g.gameOver('crash');
        return;
      }
      if (ds > 0) {
        // we hit it from behind (or head-on at low closing speed): we stop, it isn't shoved forward
        g.cam.shake(clamp(closing / 60, 0.3, 1.6));
        g.sound.crash(clamp(closing / 80, 0.3, 1));
        t.speed = v.dir === 1 ? Math.max(0, v.speed * 0.6) : -1.5;
        t.clampFront(v.s - v.len / 2 - 0.2);
        if (!village) g.damageCargo(v.dir === -1 ? pct.headOnLight : clamp(closing * pct.rearEndPerKmh, 0.3, pct.rearEndMax), 'সংঘর্ষে মাল নষ্ট', 'মহাসড়ক');
        if (v.dir === -1 && !v.heavy) this.knockAside(v, t.d);
        g.hud.toast(village ? '{crash} ধাক্কা! সাবধানে চালান' : '{crash} ধাক্কা! মাল পড়ে গেল');
      }
    } else {
      // side swipe
      const push = Math.sign(t.d - vd || -1);
      t.shiftLateral(push * Math.min(ovD, 0.8));
      t.speed *= 0.85;
      g.cam.shake(0.5);
      g.sound.crash(0.25);
      if (!village) g.damageCargo(pct.sideSwipe, 'ঘষা লেগে মাল নষ্ট', 'মহাসড়ক');
      if (!v.heavy) this.knockAside(v, t.d);
      else v.targetD = v.d - push * 0.8;
    }
  }

  /**
   * Do the truck and v actually overlap? Both as rectangles on the ground (their real length and width),
   * each turned the way it points: the separating-axis test.
   */
  private touching(v: Vehicle): boolean {
    const t = this.game.truck;
    const r = v.mesh.rotation.y;
    // forward (x, z) of each: the truck from its heading, the vehicle from its model's turn
    const a = { x: t.x, z: t.z, fx: Math.sin(t.heading), fz: -Math.cos(t.heading), hl: TRUCK.length / 2, hw: TRUCK.width / 2 };
    const b = { x: v.mesh.position.x, z: v.mesh.position.z, fx: -Math.sin(r), fz: -Math.cos(r), hl: v.len / 2, hw: v.wid / 2 };
    const cx = b.x - a.x;
    const cz = b.z - a.z;
    const reach = (o: typeof a, ax: number, az: number) => o.hl * Math.abs(o.fx * ax + o.fz * az) + o.hw * Math.abs(-o.fz * ax + o.fx * az);
    for (const o of [a, b]) {
      for (const [ax, az] of [[o.fx, o.fz], [-o.fz, o.fx]]) {
        if (Math.abs(cx * ax + cz * az) > reach(a, ax, az) + reach(b, ax, az)) return false;
      }
    }
    return true;
  }

  /** Light vehicles comically hop to the roadside and stall — nobody gets hurt. */
  private knockAside(v: Vehicle, truckD: number): void {
    const hw = v.road ? SHORTCUT.halfWidth + SHORTCUT.shoulder : this.game.track.halfWidth(v.s) + ROAD.shoulder;
    v.targetD = (this.worldD(v) < truckD ? -1 : 1) * (hw - 0.4);
    v.stalled = 4;
    v.hop = 1;
  }
}
