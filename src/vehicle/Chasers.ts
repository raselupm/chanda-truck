// Motorbike (and pickup) chase after ramming a barrier.
// Escape = ECONOMY.chaseRequiredSeconds continuous seconds at ≥ ramSpeedKmh. Caught = forced penalty chanda.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import { CHASE, EVENTS, TRUCK, WORLD } from '../config/tuning';
import type { Game } from '../game/Game';
import { toBnDigits } from '../utils/bnNumber';
import { blobShadow, vertexColorMaterial } from '../utils/geometry';
import { damp } from '../utils/math';
import { bikeGeometry, pickupGeometry, VEHICLE_DIMS } from '../world/VehicleModels';

type ChaseState = 'idle' | 'chasing' | 'caught' | 'leaving';

interface Unit {
  mesh: THREE.Group;
  pickup: boolean;
  active: boolean;
  s: number;
  d: number;
  speed: number;
  phase: number;
  offset: number;
  len: number;
  /** 1 = facing the same way as the truck, -1 = turned around */
  facing: 1 | -1;
}

const CAUGHT_LINES = [
  'পালাবেন? এই রাস্তা আমাদের!',
  'বাঁশ ভাঙলেন, এখন দাম দেন — দ্বিগুণ!',
  'আমাদের বাইক আপনার ট্রাকের চেয়ে দ্রুত, চাচা।',
];

export class Chasers {
  readonly group = new THREE.Group();
  state: ChaseState = 'idle';
  /** seconds accumulated at ≥ ramSpeedKmh */
  meter = 0;
  private units: Unit[] = [];
  private base = 0;
  private locationBn = '';
  private t = 0;
  private shoutTimer = 0;

  constructor(private game: Game) {
    const mat = vertexColorMaterial();
    for (let i = 0; i < CHASE.bikesMax; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bikeGeometry(i), mat), blobShadow(1, 2.2));
      g.visible = false;
      this.group.add(g);
      this.units.push({ mesh: g, pickup: false, active: false, s: 0, d: 0, speed: 0, phase: i * 1.3, offset: 0, len: VEHICLE_DIMS.bike.len, facing: 1 });
    }
    const pg = new THREE.Group();
    pg.add(new THREE.Mesh(pickupGeometry(), mat), blobShadow(2.4, 5.4));
    pg.visible = false;
    this.group.add(pg);
    this.units.push({ mesh: pg, pickup: true, active: false, s: 0, d: 0, speed: 0, phase: 0, offset: 0, len: VEHICLE_DIMS.pickup.len, facing: 1 });
  }

  get active(): boolean {
    return this.state === 'chasing';
  }

  reset(): void {
    this.state = 'idle';
    this.meter = 0;
    for (const u of this.units) {
      u.active = false;
      u.mesh.visible = false;
    }
  }

  /** Distance from the closest chaser's front to the truck's rear. */
  get gap(): number {
    let best = Infinity;
    for (const u of this.units) {
      if (!u.active || u.facing !== 1) continue;
      best = Math.min(best, this.game.truck.rearS - (u.s + u.len / 2));
    }
    return best;
  }

  start(baseChanda: number, locationBn: string): void {
    const t = this.game.truck;
    this.base = baseChanda;
    this.locationBn = locationBn;
    this.state = 'chasing';
    this.meter = 0;
    this.shoutTimer = 1.5;
    const bikes = CHASE.bikesMin + Math.floor(Math.random() * (CHASE.bikesMax - CHASE.bikesMin + 1));
    const withPickup = Math.random() < CHASE.pickupChance;
    let k = 0;
    for (const u of this.units) {
      const use = u.pickup ? withPickup : k < bikes;
      if (!u.pickup) k++;
      u.active = use;
      u.mesh.visible = use;
      if (!use) continue;
      const i = this.units.indexOf(u);
      u.s = t.s - CHASE.spawnGap - i * 10;
      u.offset = u.pickup ? -1.75 : [-3, 1, -5, 3][i % 4];
      u.d = u.offset;
      u.speed = Math.max(0, t.speed - 3);
      u.facing = 1;
    }
    this.game.hud.warn(`🏍️ পিছনে ধাওয়া! ${toBnDigits(ECONOMY.ramSpeedKmh)}+ গতিতে ${toBnDigits(ECONOMY.chaseRequiredSeconds)} সেকেন্ড টিকে থাকুন`, 'danger', 4);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.state === 'idle') return;
    const g = this.game;
    const t = g.truck;

    if (this.state === 'chasing' && !g.modal) {
      // Chase meter
      if (t.kmh >= ECONOMY.ramSpeedKmh) this.meter += dt;
      else if (ECONOMY.chaseMeterMode === 'reset') this.meter = 0;

      if (this.meter >= ECONOMY.chaseRequiredSeconds) {
        this.escape();
      } else {
        const gap = this.gap;
        const next = g.nextBlockingPiece(t.frontS);
        if (gap < CHASE.caughtGap) this.caught('bike');
        else if (next && next.s - t.frontS < EVENTS.chaseCutoffBeforeEvent) this.caught('event');
      }
      this.shoutTimer -= dt;
      if (this.shoutTimer <= 0) {
        this.shoutTimer = 4 + Math.random() * 4;
        if (this.gap < 120) g.sound.crowd(0.9);
      }
    }

    for (const u of this.units) {
      if (!u.active) continue;
      if (this.state === 'chasing') {
        const gapU = t.rearS - (u.s + u.len / 2);
        const max = (gapU > CHASE.boostGap ? CHASE.boostKmh : CHASE.chaserMaxKmh) / 3.6;
        u.speed = Math.min(max, u.speed + CHASE.accel * dt);
        // weave behind the truck
        u.d = damp(u.d, t.d + u.offset + Math.sin(this.t * 1.5 + u.phase) * 1.2, 1.5, dt);
        u.s += u.speed * WORLD.speedScale * dt;
        // never overlap the truck
        const maxS = t.rearS - u.len / 2 - 0.5;
        if (u.s > maxS) {
          u.s = maxS;
          u.speed = Math.min(u.speed, Math.max(0, t.speed));
        }
      } else if (this.state === 'caught') {
        // park around the truck
        u.speed = 0;
      } else if (this.state === 'leaving') {
        if (u.facing === 1) {
          u.speed = damp(u.speed, 0, 1.5, dt);
          u.s += u.speed * WORLD.speedScale * dt;
          if (u.speed < 2) u.facing = -1;
        } else {
          u.speed = Math.min(20, u.speed + 6 * dt);
          u.s -= u.speed * WORLD.speedScale * dt;
        }
        if (t.s - u.s > 400) {
          u.active = false;
          u.mesh.visible = false;
        }
      }
      const tr = g.track;
      u.mesh.position.set(tr.centerX(u.s) + u.d, tr.surfaceY(u.s), -u.s);
      u.mesh.rotation.set(Math.sin(this.t * 3 + u.phase) * 0.01, (u.facing === 1 ? 0 : Math.PI) - tr.headingAt(u.s), u.pickup ? 0 : Math.sin(this.t * 1.5 + u.phase) * 0.12);
    }
    if (this.state === 'leaving' && !this.units.some((u) => u.active)) this.state = 'idle';
  }

  private escape(): void {
    const g = this.game;
    this.state = 'leaving';
    g.stats.chasesEscaped++;
    g.sound.crowd(2);
    g.hud.warn('🎉 পালিয়ে গেলেন!', 'good', 3.5);
    g.hud.toast('ওরা হাল ছেড়ে দিল… পরের মোড়ে আবার দেখা হবে।');
  }

  private caught(reason: 'bike' | 'event'): void {
    const g = this.game;
    const t = g.truck;
    this.state = 'caught';
    g.stats.chasesCaught++;
    t.stop();
    g.cam.shake(0.6);
    g.sound.crowd(2.2);
    // Surround the truck
    this.units.forEach((u, i) => {
      if (!u.active) return;
      const side = i % 2 ? 1 : -1;
      u.s = t.s + TRUCK.length / 2 - 1 - Math.floor(i / 2) * 3.5;
      u.d = t.d + side * (u.pickup ? 4.2 : 3.2);
      u.speed = 0;
    });
    g.damageCargo(ECONOMY.cargoDamagePct.caught, 'ধরা পড়ার পর মাল "জব্দ"', this.locationBn);
    g.requestPayment({
      kind: 'chanda',
      titleBn: 'ধরা পড়েছেন! জরিমানা চাঁদা',
      messageBn: reason === 'event' ? 'সামনে লাইনে আটকে গেলেন — ধরা খেলেন!' : CAUGHT_LINES[Math.floor(Math.random() * CAUGHT_LINES.length)],
      lines: [
        { category: 'CHANDA', amount: this.base, labelBn: 'বকেয়া চাঁদা' },
        { category: 'PENALTY', amount: Math.round(this.base * (ECONOMY.caughtMultiplier - 1)), labelBn: 'ধাওয়া করার "খরচ"' },
      ],
      locationBn: this.locationBn,
      onPaid: () => {
        this.state = 'leaving';
        for (const u of this.units) {
          u.facing = -1;
          u.speed = 4;
        }
      },
    });
  }
}
