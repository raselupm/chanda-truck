// Vegetable thieves: while the truck crawls through a jam (toll queue, roadworks), people run up from
// the roadside, grab a sack off the back and run away. A horn blast scares them off.

import * as THREE from 'three';
import { activeTruck } from '../config/trucks';
import { THIEVES, ROAD, TRUCK } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cached, vertexColorMaterial } from '../utils/geometry';
import { makePerson } from './People';

interface Zone {
  from: number;
  to: number;
  labelBn: string;
  warned: boolean;
}

interface Thief {
  active: boolean;
  mesh: THREE.Mesh;
  sack: THREE.Mesh;
  state: 'run' | 'grab' | 'flee';
  s: number;
  d: number;
  /** which side of the truck (and road) he works from */
  side: -1 | 1;
  /** where along the truck he grabs from */
  grabOff: number;
  t: number;
  zone: Zone | null;
  phase: number;
}

const RUN_SPEED = 4.6;

export class Thieves {
  readonly group = new THREE.Group();
  private zones: Zone[] = [];
  private pool: Thief[] = [];
  private timer = 1.5;
  private t = 0;

  constructor(private game: Game) {
    const sackGeo = cached('thief:sack', () =>
      buildColored([
        { geo: box(0.55, 0.5, 0.45), color: 0xa8875a, p: [0, 0, 0] },
        { geo: box(0.2, 0.12, 0.2), color: 0x3f8f2a, p: [0.05, 0.3, 0] },
      ]),
    );
    for (let i = 0; i < 5; i++) {
      const mesh = makePerson(i % 2 ? 'farmer' : 'trader', 60 + i);
      const sack = new THREE.Mesh(sackGeo, vertexColorMaterial());
      sack.position.set(0.1, 1.75, 0.15);
      mesh.add(sack);
      mesh.rotation.order = 'YXZ';
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ active: false, mesh, sack, state: 'run', s: 0, d: 0, side: 1, grabOff: 0, t: 0, zone: null, phase: i * 1.7 });
    }
  }

  /** A stretch where traffic jams up (registered by toll plazas and roadworks when the route is built). */
  addZone(from: number, to: number, labelBn: string): void {
    this.zones.push({ from, to, labelBn, warned: false });
  }

  reset(): void {
    this.zones = [];
    this.timer = 1.5;
    for (const th of this.pool) {
      th.active = false;
      th.mesh.visible = false;
    }
  }

  /** Horn: every thief close to the truck who hasn't got away yet drops it and runs. Returns how many. */
  scare(): number {
    const tr = this.game.truck;
    let n = 0;
    for (const th of this.pool) {
      if (!th.active || th.state === 'flee') continue;
      if (Math.hypot(th.s - tr.s, th.d - tr.d) > THIEVES.hornRange) continue;
      this.flee(th, false);
      n++;
    }
    return n;
  }

  private flee(th: Thief, withSack: boolean): void {
    th.state = 'flee';
    th.sack.visible = withSack;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const crawling = Math.abs(tr.kmh) < THIEVES.maxKmh;
    const zone = g.state.phase === 'HIGHWAY' ? this.zones.find((z) => tr.frontS >= z.from && tr.frontS <= z.to) ?? null : null;

    // a covered van's doors are locked: nothing to grab
    const exposed = g.cargo.totalKg > 0 && !activeTruck().theftProof;
    if (zone && !zone.warned && crawling && exposed) {
      zone.warned = true;
      g.hud.toast('{warning} জ্যামে চোরের উপদ্রব! কেউ সবজি টানলে হর্ন দিন', 3.5);
    }

    this.timer -= dt;
    if (zone && crawling && !g.modal && exposed && this.timer <= 0) {
      this.timer = THIEVES.intervalMin + Math.random() * (THIEVES.intervalMax - THIEVES.intervalMin);
      const busy = this.pool.filter((th) => th.active && th.state !== 'flee').length;
      const th = this.pool.find((p) => !p.active);
      if (th && busy < THIEVES.maxAtOnce) this.spawn(th, zone);
    }

    const hw = g.track.halfWidth(tr.s);
    for (const th of this.pool) {
      if (!th.active) continue;
      let speed = RUN_SPEED;
      let ts: number;
      let td: number;
      if (th.state === 'flee') {
        // back to the roadside and into the crowd
        ts = th.s - 4;
        td = th.side * (hw + 16);
        speed = RUN_SPEED * 1.2;
      } else {
        ts = tr.s + th.grabOff;
        td = tr.d + th.side * (TRUCK.width / 2 + 0.45);
        // the truck got going: no chance
        if (!crawling || g.state.phase !== 'HIGHWAY') {
          this.flee(th, false);
          continue;
        }
      }
      const ds = ts - th.s;
      const dd = td - th.d;
      const dist = Math.hypot(ds, dd);
      if (th.state === 'grab') {
        // hanging on to the back of the truck, pulling at a sack
        th.s = ts;
        th.d = td;
        th.t += dt;
        if (th.t >= THIEVES.grabSeconds) {
          const kg = THIEVES.kgMin + Math.random() * (THIEVES.kgMax - THIEVES.kgMin);
          if (g.stealCargo(kg, th.zone?.labelBn ?? 'জ্যাম') > 0) g.hud.toast('{warning} চোর সবজির বস্তা নিয়ে পালালো!', 2.5);
          this.flee(th, true);
        }
      } else if (dist > 0.05) {
        const step = Math.min(dist, speed * dt);
        th.s += (ds / dist) * step;
        th.d += (dd / dist) * step;
        if (th.state === 'run' && dist < 0.6) {
          th.state = 'grab';
          th.t = 0;
        }
      }
      if (th.state === 'flee' && (Math.abs(th.d) > hw + 14 || th.s < tr.s - 60)) {
        th.active = false;
        th.mesh.visible = false;
        continue;
      }

      // Pose: running bob, facing where he's going; reaching up while grabbing
      const grabbing = th.state === 'grab';
      const bob = grabbing ? 0 : Math.abs(Math.sin(this.t * 11 + th.phase)) * 0.12;
      g.track.point(th.s, th.d, th.mesh.position, ROAD.top + bob);
      th.mesh.rotation.set(grabbing ? -0.25 : -0.12, grabbing ? (th.side * Math.PI) / 2 : Math.atan2(-dd, ds), 0);
      th.mesh.position.y += grabbing ? 0.25 : 0;
    }
  }

  private spawn(th: Thief, zone: Zone): void {
    const g = this.game;
    const tr = g.truck;
    th.active = true;
    th.zone = zone;
    th.side = Math.random() < 0.5 ? -1 : 1;
    th.state = 'run';
    th.t = 0;
    th.grabOff = -1.2 - Math.random() * 2.4;
    th.s = tr.s + th.grabOff + (Math.random() - 0.3) * 8;
    th.d = th.side * (g.track.halfWidth(th.s) + 2.5 + Math.random() * 3);
    th.sack.visible = false;
    th.mesh.visible = true;
    th.mesh.position.set(0, -100, 0);
  }
}
