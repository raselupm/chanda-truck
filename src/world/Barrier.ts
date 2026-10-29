// Illegal extortion barrier (অবৈধ চাঁদা). Stop & pay, ram it at ≥ 90 km/h, or bump it slowly and pay extra.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import type { BarrierEvent } from '../config/route';
import { EVENTS, ROAD, WORLD } from '../config/tuning';
import type { Game } from '../game/Game';
import type { ChargeLine } from '../ui/PaymentDialog';
import { box, buildColored, cached, cyl, vertexColorMaterial } from '../utils/geometry';
import { formatTaka } from '../utils/bnNumber';
import { signTexture } from '../utils/textures';
import { makePerson, makeWaver } from './People';
import { SetPiece } from './SetPiece';

type State = 'closed' | 'paying' | 'open' | 'broken';

interface Piece {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  flying: boolean;
  /** lateral direction to slide when the barrier is opened */
  openDir: number;
}

interface Worker {
  mesh: THREE.Mesh;
  s: number;
  d: number;
  homeS: number;
  homeD: number;
  targetS: number;
  targetD: number;
  speed: number;
  waver: boolean;
  phase: number;
}

const MOCK_SLOW = [
  'আস্তে ধাক্কা দিলে বাঁশ ভাঙে না, পকেট ভাঙে!',
  'ব্রেক কি বাড়িতে রেখে এসেছেন? বাঁশের ক্ষতিপূরণসহ দেন।',
  'সাহস আছে, গতি নাই। জরিমানা লাগবে।',
];
const PAY_LINES = [
  'রশিদ নাই, তবে হিসাব আছে।',
  'এটা চাঁদা না ভাই, "সড়ক উন্নয়ন ফি"।',
  'সবাই দেয়, আপনিও দেন। শান্তিতে যান।',
  'উপরের লেভেলে ভাগ যায়, বোঝেনই তো।',
];

export class Barrier extends SetPiece<BarrierEvent> {
  private state: State = 'closed';
  private pieces: Piece[] = [];
  private workers: Worker[] = [];
  private warned = false;
  private dodging = false;
  private t = 0;
  private openT = 0;
  readonly base: number;

  constructor(event: BarrierEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    const hw = track.halfWidth(S);
    const span = hw + 3.5;
    this.base = event.chanda;

    track.limits.push({ from: S - 45, to: S + 8, range: () => [-hw - 1.5, hw + 1.5] });
    track.propBlocks.push({ from: S - 25, to: S + 25, dMin: -span - 8, dMax: span + 8 });

    const mat = vertexColorMaterial();
    const poleGeo = cached('bar:pole', () => buildColored([{ geo: cyl(0.07, 0.07, 3.6, 6), color: 0xc9b26a, r: [0, 0, Math.PI / 2] }]));
    const postGeo = cached('bar:post', () => buildColored([{ geo: cyl(0.08, 0.09, 1.7, 6), color: 0xb59f5a }]));
    const barrelGeo = (c: number) =>
      cached(`bar:barrel:${c}`, () =>
        buildColored([
          { geo: cyl(0.33, 0.33, 0.95, 10), color: c },
          { geo: cyl(0.34, 0.34, 0.08, 10), color: 0x222222, p: [0, 0.2, 0] },
          { geo: cyl(0.34, 0.34, 0.08, 10), color: 0x222222, p: [0, -0.2, 0] },
        ]),
      );
    const groundY = ROAD.top;

    const addPiece = (geo: THREE.BufferGeometry, d: number, y: number, sOff = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(this.at(S + sOff, d, groundY + y));
      this.group.add(mesh);
      this.pieces.push({
        mesh, home: mesh.position.clone(), vel: new THREE.Vector3(), ang: new THREE.Vector3(),
        flying: false, openDir: d < 0 ? -1 : 1,
      });
    };

    // Bamboo posts, two rails, barrels
    const nSeg = Math.ceil((span * 2) / 3.5);
    const segW = (span * 2) / nSeg;
    for (let i = 0; i <= nSeg; i++) addPiece(postGeo, -span + i * segW, 0.85);
    for (let i = 0; i < nSeg; i++) {
      const d = -span + (i + 0.5) * segW;
      addPiece(poleGeo, d, 0.7);
      addPiece(poleGeo, d, 1.3);
    }
    const barrelColors = [0x1f6fb2, 0xe76f1c, 0x1f6fb2, 0x3a3a3a];
    [-hw + 1.2, -hw / 2, 0.6, hw / 2 + 0.5, hw - 1].forEach((d, i) => addPiece(barrelGeo(barrelColors[i % 4]), d, 0.48, -0.6));

    // Banner on two tall bamboo poles above the road (generic, euphemistic, no party symbols)
    const bannerTex = signTexture(['স্বেচ্ছাসেবী সড়ক উন্নয়ন ফি', 'আদায় কেন্দ্র — বাধ্যতামূলক'], {
      bg: '#f4f1e8', fg: '#2b2b2b', border: '#8a8a8a', w: 1024, h: 200, sizes: [70, 54],
    });
    const banner = this.own(new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshLambertMaterial({ map: bannerTex, side: THREE.DoubleSide })));
    banner.position.copy(this.at(S + 3, -1, 4.3));
    this.group.add(banner);
    for (const d of [-5.6, 3.6]) {
      const p = new THREE.Mesh(cached('bar:tall', () => buildColored([{ geo: cyl(0.07, 0.09, 5.4, 6), color: 0xc9b26a }])), mat);
      p.position.copy(this.at(S + 3, d, 2.7));
      this.group.add(p);
    }

    // Roadside table, plastic chairs, a flask
    const table = new THREE.Mesh(
      cached('bar:table', () =>
        buildColored([
          { geo: box(1.4, 0.06, 0.8), color: 0x8a5a2b, p: [0, 0.75, 0] },
          { geo: box(0.06, 0.75, 0.06), color: 0x6b4a2a, p: [-0.6, 0.37, -0.3] },
          { geo: box(0.06, 0.75, 0.06), color: 0x6b4a2a, p: [0.6, 0.37, -0.3] },
          { geo: box(0.06, 0.75, 0.06), color: 0x6b4a2a, p: [-0.6, 0.37, 0.3] },
          { geo: box(0.06, 0.75, 0.06), color: 0x6b4a2a, p: [0.6, 0.37, 0.3] },
          { geo: cyl(0.08, 0.08, 0.3, 6), color: 0xc0c0c0, p: [0.3, 0.93, 0] },
          { geo: box(0.25, 0.04, 0.32), color: 0xfafafa, p: [-0.3, 0.8, 0] },
          { geo: box(0.5, 0.06, 0.5), color: 0x2f6fb2, p: [0, 0.45, 0.8] },
          { geo: box(0.5, 0.5, 0.06), color: 0x2f6fb2, p: [0, 0.7, 1.05] },
        ]),
      ),
      mat,
    );
    table.position.copy(this.at(S - 4, -(hw + 4), 0));
    table.rotation.y = Math.PI / 2;
    this.group.add(table);

    // Workers
    const n = event.workers;
    for (let i = 0; i < n; i++) {
      let s: number;
      let d: number;
      let waver = false;
      if (i === 0) { s = S + 1.6; d = -hw / 2; waver = true; }
      else if (i === 1) { s = S + 1.8; d = hw / 4; waver = true; }
      else {
        const side = i % 2 ? -1 : 1;
        s = S - 2 - (i % 3) * 3;
        d = side * (hw + 3.3 + (i % 2) * 0.8);
      }
      const mesh = waver ? makeWaver('worker', i, i === 0 ? 'receipt' : 'stick') : makePerson('worker', i);
      this.group.add(mesh);
      this.workers.push({ mesh, s, d, homeS: s, homeD: d, targetS: s, targetD: d, speed: 0, waver, phase: i * 1.7 });
    }
    this.placeWorkers();
  }

  private placeWorkers(): void {
    for (const w of this.workers) w.mesh.position.copy(this.at(w.s, w.d, ROAD.top - 0.02));
  }

  get blocking(): boolean {
    return this.state === 'closed' || this.state === 'paying';
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const S = this.s;
    const front = tr.frontS;
    const hw = g.track.halfWidth(S);
    const lineS = S - 0.6;

    // (not while the truck goes round it on a village shortcut)
    if (this.state === 'closed' && g.state.phase === 'HIGHWAY' && !g.bypasses(S)) {
      if (!this.warned && front > S - EVENTS.barrierWarnDistance && front < S) {
        this.warned = true;
        g.hud.warn('{warning} সামনে চাঁদাবাজি!', 'danger', 3.5);
        g.sound.whistle();
      }
      // They see a truck coming fast — jump out of the way (they never get hit)
      if (!this.dodging && tr.kmh > 30 && front > S - 110 && front < S) {
        this.dodging = true;
        for (const w of this.workers) {
          if (Math.abs(w.d) < hw + 1.5) {
            w.targetD = (w.d < tr.d ? -1 : 1) * (hw + 3 + Math.random() * 2);
            if (Math.abs(w.targetD - tr.d) < 4) w.targetD = -w.targetD;
            w.speed = 7;
          }
        }
      }
      if (front >= lineS && front < lineS + 15 && !g.modal) {
        if (tr.kmh >= ECONOMY.ramSpeedKmh) this.breakThrough();
        else this.slowHit();
      } else if (!g.modal && Math.abs(tr.speed) < EVENTS.stopSpeed && front > S - 40 && front < lineS + 0.1) {
        this.requestPay(false);
      }
    }

    this.animateWorkers(dt);
    this.animatePieces(dt);
  }

  private requestPay(penalty: boolean): void {
    const g = this.game;
    this.state = 'paying';
    g.truck.stop();
    if (!penalty) this.surround();
    const lines: ChargeLine[] = [{ category: 'CHANDA', amount: this.base, labelBn: 'চাঁদা' }];
    if (penalty) {
      lines.push({ category: 'PENALTY', amount: Math.round(this.base * (ECONOMY.penaltyMultiplierSlowHit - 1)), labelBn: 'বাঁশ ভাঙার "জরিমানা"' });
    }
    g.requestPayment({
      kind: 'chanda',
      titleBn: penalty ? 'জরিমানাসহ চাঁদা দিন!' : `চাঁদা দিন: ${formatTaka(this.base)}`,
      messageBn: penalty ? MOCK_SLOW[Math.floor(Math.random() * MOCK_SLOW.length)] : PAY_LINES[Math.floor(Math.random() * PAY_LINES.length)],
      lines,
      locationBn: this.event.nameBn,
      onPaid: () => this.open(),
    });
  }

  private slowHit(): void {
    const g = this.game;
    g.truck.clampFront(this.s - 0.6);
    g.truck.stop();
    g.cam.shake(0.5);
    g.sound.crash(0.35);
    g.sound.crowd(1.6);
    g.stats.slowHits++;
    g.damageCargo(ECONOMY.cargoDamagePct.slowHit, 'বাঁশে ধাক্কা — মাল নষ্ট', this.event.nameBn);
    // wobble the barrier
    for (const p of this.pieces) p.mesh.rotation.z += (Math.random() - 0.5) * 0.15;
    this.surround();
    this.requestPay(true);
  }

  private breakThrough(): void {
    const g = this.game;
    const tr = g.truck;
    this.state = 'broken';
    this.resolved = true;
    g.stats.barriersBroken++;
    g.cam.shake(1.4);
    g.sound.crash(1);
    g.sound.crowd(2.5);
    tr.speed *= 0.97;
    const fwd = new THREE.Vector3(Math.sin(tr.heading), 0, -Math.cos(tr.heading));
    for (const p of this.pieces) {
      const lateral = p.mesh.position.x - tr.x;
      const near = Math.abs(lateral) < 3.5;
      p.flying = true;
      p.vel.copy(fwd).multiplyScalar(tr.speed * WORLD.speedScale * (near ? 0.75 : 0.25) * (0.7 + Math.random() * 0.5));
      p.vel.x += Math.sign(lateral || 1) * (3 + Math.random() * 7);
      p.vel.y = (near ? 5 : 2) + Math.random() * 5;
      p.ang.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    }
    // anyone still near the truck's path steps aside instantly
    for (const w of this.workers) {
      if (Math.abs(w.d - tr.d) < 3.5) {
        w.d = w.targetD = (w.d < tr.d ? -1 : 1) * (g.track.halfWidth(this.s) + 4);
      }
    }
    const pct = ECONOMY.cargoDamagePct.ramMin + Math.random() * (ECONOMY.cargoDamagePct.ramMax - ECONOMY.cargoDamagePct.ramMin);
    g.damageCargo(pct, 'ব্যারিকেড ভাঙতে গিয়ে মাল পড়ে গেছে', this.event.nameBn);
    g.hud.warn('{crash} ব্যারিকেড ভেঙে গেল! এখন পালান!', 'danger', 2.5);
    g.startChase(this.base, this.event.nameBn);
  }

  /** Workers gather around the truck's cab. */
  private surround(): void {
    const tr = this.game.truck;
    this.workers.forEach((w, i) => {
      const side = i % 2 ? -1 : 1;
      w.targetS = tr.s - 3.5 + (i >> 1) * 1.6;
      w.targetD = tr.d + side * (2.2 + (i % 3) * 0.4);
      w.speed = 3.5;
    });
  }

  private open(): void {
    this.state = 'open';
    this.resolved = true;
    this.openT = 0;
    this.game.stats.barriersPaid++;
    this.workers.forEach((w) => {
      w.targetS = w.homeS;
      w.targetD = Math.sign(w.homeD || 1) * (this.game.track.halfWidth(this.s) + 3.5 + Math.random() * 2);
      w.speed = 3;
    });
  }

  private animateWorkers(dt: number): void {
    for (const w of this.workers) {
      const ds = w.targetS - w.s;
      const dd = w.targetD - w.d;
      const dist = Math.hypot(ds, dd);
      const moving = dist > 0.05 && w.speed > 0;
      if (moving) {
        const step = Math.min(dist, w.speed * dt);
        w.s += (ds / dist) * step;
        w.d += (dd / dist) * step;
        w.mesh.rotation.y = Math.atan2(-dd, ds);
      } else {
        const tr = this.game.truck;
        // face the truck
        w.mesh.rotation.y = Math.atan2(-(tr.d - w.d), tr.s - w.s);
      }
      w.mesh.position.copy(this.at(w.s, w.d, ROAD.top - 0.02));
      w.mesh.position.y += moving ? Math.abs(Math.sin(this.t * 14 + w.phase)) * 0.12 : 0;
      if (w.waver) {
        const arm = w.mesh.userData.arm as THREE.Object3D;
        const active = this.state !== 'broken';
        arm.rotation.x = active ? 2.3 + Math.sin(this.t * 7 + w.phase) * 0.6 : 2.8 + Math.sin(this.t * 12) * 0.3;
      }
    }
  }

  private animatePieces(dt: number): void {
    if (this.state === 'open') {
      this.openT = Math.min(1, this.openT + dt * 0.8);
      const e = this.openT * this.openT * (3 - 2 * this.openT);
      const hw = this.game.track.halfWidth(this.s);
      for (const p of this.pieces) {
        if (Math.abs(p.home.x) < hw + 0.5) p.mesh.position.x = p.home.x + p.openDir * e * (hw + 2.5 - Math.abs(p.home.x) * 0.3);
      }
      return;
    }
    if (this.state !== 'broken') return;
    const floor = this.game.track.elevation(this.s) + ROAD.top + 0.08;
    for (const p of this.pieces) {
      if (!p.flying) continue;
      p.vel.y -= 20 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.ang.x * dt;
      p.mesh.rotation.y += p.ang.y * dt;
      p.mesh.rotation.z += p.ang.z * dt;
      if (p.mesh.position.y < floor) {
        p.mesh.position.y = floor;
        p.vel.y *= -0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
        p.ang.multiplyScalar(0.5);
        if (Math.abs(p.vel.y) < 0.6 && p.vel.lengthSq() < 0.5) p.flying = false;
      }
    }
  }
}
