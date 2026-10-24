// Railway level crossing (রেলক্রসিং). As the truck approaches, a train is often coming:
// gates drop, red lights flash, the bell rings, and everybody waits for a long train to pass.

import * as THREE from 'three';
import type { RailEvent } from '../config/route';
import { EVENTS, RAIL, ROAD } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { canvasTexture, FONT_BN, signTexture, stripeTexture } from '../utils/textures';
import { makePerson, makeWaver } from './People';
import { SetPiece, signPost } from './SetPiece';

type State = 'idle' | 'closing' | 'closed' | 'opening' | 'open';

const ENGINE_LEN = 17;
const COACH_LEN = 21;
const GAP = 1.2;

/** Train lying along +X (nose at x = 0, carriages trailing toward -X). */
function trainGeometry(): THREE.BufferGeometry {
  return cached('train', () => {
    const parts: Part[] = [];
    // Locomotive: blue-red-yellow livery
    parts.push({ geo: box(ENGINE_LEN, 3.2, 3), color: 0x1d4e89, p: [-ENGINE_LEN / 2, 2.4, 0] });
    parts.push({ geo: box(ENGINE_LEN + 0.02, 0.5, 3.02), color: 0xe63946, p: [-ENGINE_LEN / 2, 1.5, 0] });
    parts.push({ geo: box(ENGINE_LEN + 0.04, 0.25, 3.04), color: 0xffd166, p: [-ENGINE_LEN / 2, 3.3, 0] });
    parts.push({ geo: box(0.06, 1.0, 2.2), color: 0x22313f, p: [0.01, 3.0, 0] });
    parts.push({ geo: box(0.1, 0.4, 0.5), color: 0xfff3b0, p: [0.03, 2.0, 0] });
    parts.push({ geo: box(ENGINE_LEN - 2, 0.6, 2.6), color: 0x163a66, p: [-ENGINE_LEN / 2, 4.2, 0] });
    for (let i = 0; i < 6; i++) parts.push({ geo: cyl(0.5, 0.5, 2.9, 10), color: 0x222222, p: [-2 - i * 2.6, 0.55, 0], r: [Math.PI / 2, 0, 0] });
    // Coaches: green with a yellow stripe and a row of windows (people hanging on the roof are optional extras)
    for (let c = 0; c < RAIL.coaches; c++) {
      const x0 = -ENGINE_LEN - GAP - c * (COACH_LEN + GAP);
      const cx = x0 - COACH_LEN / 2;
      const body = c % 4 === 3 ? 0x8b2e2e : 0x2f6b3a;
      parts.push({ geo: box(COACH_LEN, 3.1, 3), color: body, p: [cx, 2.35, 0] });
      parts.push({ geo: box(COACH_LEN + 0.02, 0.18, 3.02), color: 0xffd166, p: [cx, 1.6, 0] });
      parts.push({ geo: box(COACH_LEN - 1, 0.7, 3.04), color: 0x1f2a30, p: [cx, 2.7, 0] });
      parts.push({ geo: box(COACH_LEN, 0.3, 2.6), color: 0x5a5a5a, p: [cx, 4.05, 0] });
      for (const wx of [-COACH_LEN / 2 + 3, COACH_LEN / 2 - 3]) {
        parts.push({ geo: cyl(0.45, 0.45, 2.9, 8), color: 0x222222, p: [cx + wx, 0.5, 0], r: [Math.PI / 2, 0, 0] });
      }
    }
    return buildColored(parts);
  });
}

export function trainLength(): number {
  return ENGINE_LEN + RAIL.coaches * (COACH_LEN + GAP);
}

function crossbuckTexture(): THREE.Texture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.save();
    ctx.translate(128, 128);
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-120, -22, 240, 44);
      ctx.strokeStyle = '#c1121f';
      ctx.lineWidth = 8;
      ctx.strokeRect(-120, -22, 240, 44);
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#c1121f';
    ctx.font = `700 34px ${FONT_BN}`;
    ctx.textAlign = 'center';
    ctx.fillText('রেল', 128, 70);
  });
}

const WAIT_LINES = [
  'ট্রেন আসছে… ধৈর্য ধরুন, চা খান।',
  'রেলগেটে জীবনের অনেকটা সময় কাটে।',
  'গেটম্যান বলছেন: "এই তো, আর একটু!"',
  'ট্রেন লেট, কিন্তু গেট সময়মতো বন্ধ।',
];

export class RailCrossing extends SetPiece<RailEvent> {
  private state: State = 'idle';
  private gatePivots: THREE.Group[] = [];
  private gateT = 0;
  private lights: THREE.Mesh[] = [];
  private lightOn: THREE.MeshBasicMaterial;
  private lightOff: THREE.MeshBasicMaterial;
  private train: THREE.Mesh;
  /** x of the train's nose (world, the road is at x ≈ 0) */
  private trainX = 0;
  private trainDir = 1;
  private t = 0;
  private bellTimer = 0;
  private clackTimer = 0;
  private hornPlayed = false;
  private gateman: THREE.Mesh;
  private waitedTold = false;

  constructor(event: RailEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    const hw = track.halfWidth(S);
    const mat = vertexColorMaterial();
    const y0 = ROAD.top;

    track.limits.push({ from: S - 40, to: S + 14, range: () => [-hw - 0.6, hw + 0.6] });
    track.propBlocks.push({ from: S - 20, to: S + 20, dMin: -400, dMax: 400 });

    // Track bed across the road: ballast, sleepers, two rails (long, along x)
    const span = 900;
    const bed: Part[] = [
      { geo: box(span, 0.35, 4.2), color: 0x7d7468, p: [0, 0.1, 0] },
    ];
    for (let x = -span / 2; x < span / 2; x += 1.6) bed.push({ geo: box(0.3, 0.14, 2.8), color: 0x4a3a2c, p: [x, 0.3, 0] });
    for (const z of [-0.75, 0.75]) bed.push({ geo: box(span, 0.16, 0.12), color: 0xa9a9a9, p: [0, 0.42, z] });
    const bedMesh = new THREE.Mesh(buildColored(bed), mat);
    bedMesh.position.copy(this.at(S, 0, 0));
    bedMesh.position.x = track.centerX(S);
    bedMesh.frustumCulled = false;
    this.group.add(bedMesh);

    // Gates: our side (before the tracks) and the far side (for oncoming traffic)
    const boomMatMesh = (len: number) => {
      const m = this.own(new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.16), new THREE.MeshLambertMaterial({ map: stripeTexture('#d62828', '#ffffff', 12) })));
      m.position.x = len / 2;
      return m;
    };
    const postGeo = cached('rail:post', () =>
      buildColored([
        { geo: box(0.35, 1.2, 0.35), color: 0xffd23f, p: [0, 0.6, 0] },
        { geo: box(0.5, 0.5, 0.5), color: 0x333333, p: [-0.3, 1.0, 0] },
      ]),
    );
    for (const [sOff, side] of [[-7, -1], [7, 1]] as const) {
      const len = hw * 2 + 1.5;
      const pivot = new THREE.Group();
      pivot.add(boomMatMesh(len));
      // our-side gate pivots on the left, far-side gate on the right (booms swing up)
      pivot.position.copy(this.at(S + sOff, side < 0 ? -hw - 1 : hw + 1, y0 + 1.1));
      if (side > 0) pivot.rotation.y = Math.PI;
      const post = new THREE.Mesh(postGeo, mat);
      post.position.copy(this.at(S + sOff, side < 0 ? -hw - 1 : hw + 1, y0));
      this.group.add(pivot, post);
      this.gatePivots.push(pivot);
      pivot.rotation.z = Math.PI / 2 - 0.12;
    }

    // Signal posts with twin red lights + crossbuck
    this.lightOn = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    this.lightOff = new THREE.MeshBasicMaterial({ color: 0x3a1010 });
    const cross = crossbuckTexture();
    for (const [sOff, d] of [[-10, -hw - 2.4], [10, hw + 2.4]] as const) {
      const pole = new THREE.Mesh(cached('rail:signal', () => buildColored([
        { geo: cyl(0.08, 0.08, 4, 6), color: 0xdddddd, p: [0, 2, 0] },
        { geo: box(1.4, 0.5, 0.2), color: 0x111111, p: [0, 2.7, 0] },
      ])), mat);
      pole.position.copy(this.at(S + sOff, d, y0));
      if (sOff > 0) pole.rotation.y = Math.PI;
      this.group.add(pole);
      for (const lx of [-0.45, 0.45]) {
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), this.lightOff);
        l.position.set(lx, 2.7, 0.11);
        pole.add(l);
        this.lights.push(l);
      }
      const cb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: cross, transparent: true, side: THREE.DoubleSide }));
      cb.position.set(0, 3.7, 0.05);
      pole.add(cb);
    }

    // Approach sign
    const sign = signPost(signTexture(['{train} সামনে রেলক্রসিং', 'গেট বন্ধ থাকলে থামুন'], { bg: '#ffd23f', fg: '#1d1d1d', border: '#c1121f', sizes: [52, 40] }), 3, 1.5, 2.2);
    sign.position.copy(this.at(S - 220, -hw - 3, y0));
    sign.rotation.y = 0.3;
    this.group.add(sign);

    // Gateman hut + gateman with a red flag, and a jhalmuri seller for the waiting crowd
    const hut = new THREE.Mesh(cached('rail:hut', () => buildColored([
      { geo: box(2.4, 2.4, 2.4), color: 0xc9b98f, p: [0, 1.2, 0] },
      { geo: box(2.8, 0.15, 2.8), color: 0x8c99a3, p: [0, 2.5, 0] },
      { geo: box(0.9, 1.6, 0.06), color: 0x3a2a1e, p: [0, 0.8, 1.22] },
    ])), mat);
    hut.position.copy(this.at(S - 14, -hw - 7, 0));
    hut.rotation.y = Math.PI / 2;
    this.group.add(hut);
    this.gateman = makeWaver('official', 7, 'receipt');
    this.gateman.position.copy(this.at(S - 10, -hw - 4.2, y0));
    this.gateman.rotation.y = -Math.PI / 2;
    this.group.add(this.gateman);
    const seller = makePerson('trader', 12);
    seller.position.copy(this.at(S - 26, hw + 3.2, y0));
    seller.rotation.y = Math.PI / 2;
    const cart = new THREE.Mesh(cached('rail:cart', () => buildColored([
      { geo: box(1.6, 0.8, 0.9), color: 0xe9c46a, p: [0, 0.9, 0] },
      { geo: box(1.7, 0.08, 1.0), color: 0xe63946, p: [0, 1.9, 0] },
      { geo: box(0.05, 0.6, 0.05), color: 0x555555, p: [-0.75, 1.6, 0] },
      { geo: box(0.05, 0.6, 0.05), color: 0x555555, p: [0.75, 1.6, 0] },
    ])), mat);
    cart.position.copy(this.at(S - 27.5, hw + 3.4, y0));
    this.group.add(seller, cart);

    this.train = new THREE.Mesh(trainGeometry(), mat);
    this.train.visible = false;
    this.train.frustumCulled = false;
    this.group.add(this.train);
  }

  get blocking(): boolean {
    return this.state === 'closing' || this.state === 'closed';
  }

  /** Traffic queues right at the gate instead of stopping 60 m short. */
  get queueGap(): number {
    return 9;
  }

  get allowsQueue(): boolean {
    return true;
  }

  visibleRange(): [number, number] {
    return [this.s - 750, this.s + 150];
  }

  private close(): void {
    this.state = 'closing';
    this.gateT = 0;
    this.trainDir = Math.random() < 0.5 ? 1 : -1;
    // nose starts trainStartGap away from the road, coming toward it
    this.trainX = -this.trainDir * RAIL.trainStartGap;
    this.train.visible = true;
    this.train.rotation.y = this.trainDir > 0 ? 0 : Math.PI;
    this.hornPlayed = false;
    this.waitedTold = false;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const S = this.s;
    const front = tr.frontS;
    const gateS = S - 7.6;

    // (never slams shut in the middle of a chase — that would be a guaranteed catch)
    if (this.state === 'idle' && g.state.phase === 'HIGHWAY' && !g.chase.active && front > S - RAIL.triggerDistance && front < S) {
      if (Math.random() < RAIL.trainChance) {
        this.close();
        g.hud.warn('{train} রেলগেট বন্ধ হচ্ছে — ট্রেন আসছে!', 'info', 3.5);
      } else this.state = 'open';
    }

    // Gates animate down (closing) / up (opening)
    if (this.state === 'closing' || this.state === 'opening') {
      this.gateT = Math.min(1, this.gateT + dt * 0.5);
      if (this.gateT >= 1) {
        if (this.state === 'closing') this.state = 'closed';
        else {
          this.state = 'open';
          this.resolved = true;
        }
      }
    }
    const down = this.state === 'closing' ? this.gateT : this.state === 'closed' ? 1 : this.state === 'opening' ? 1 - this.gateT : 0;
    const e = down * down * (3 - 2 * down);
    for (const p of this.gatePivots) p.rotation.z = (1 - e) * (Math.PI / 2 - 0.12);

    const active = this.state === 'closing' || this.state === 'closed';
    const blink = Math.floor(this.t * 3) % 2 === 0;
    this.lights.forEach((l, i) => (l.material = active && (i % 2 === 0) === blink ? this.lightOn : this.lightOff));
    const gm = this.gateman.userData.arm as THREE.Object3D;
    gm.rotation.x = active ? 2.6 + Math.sin(this.t * 5) * 0.3 : 0;

    const near = Math.abs(front - S) < 450;
    if (active && near) {
      this.bellTimer -= dt;
      if (this.bellTimer <= 0) {
        this.bellTimer = 0.55;
        g.sound.bell();
      }
    }

    // Train
    if (this.train.visible) {
      if (this.state === 'closed' || this.state === 'closing') this.trainX += this.trainDir * RAIL.trainSpeed * dt;
      const roadX = g.track.centerX(S);
      this.train.position.set(roadX + this.trainX, g.track.elevation(S) + 0.45, -S);
      if (!this.hornPlayed && Math.abs(this.trainX) < 220 && near) {
        this.hornPlayed = true;
        g.sound.trainHorn();
      }
      // clackety-clack while carriages cross the road
      const tail = this.trainX - this.trainDir * trainLength();
      const overRoad = Math.sign(this.trainX) !== Math.sign(tail) || Math.abs(this.trainX) < 20 || Math.abs(tail) < 20;
      if (overRoad && near) {
        this.clackTimer -= dt;
        if (this.clackTimer <= 0) {
          this.clackTimer = (COACH_LEN + GAP) / RAIL.trainSpeed / 2;
          g.sound.clack();
        }
      }
      // tail has cleared the road: open the gates
      if (this.state === 'closed' && this.trainDir * tail > 25) {
        this.state = 'opening';
        this.gateT = 0;
        if (near) g.hud.toast('{train} ট্রেন চলে গেছে — গেট খুলছে');
      }
      if (this.trainDir * tail > 500) this.train.visible = false;
    }

    // Closed gate is a wall
    if (active && g.state.phase === 'HIGHWAY' && !g.modal) {
      if (front >= gateS && front < gateS + 12) {
        const hit = tr.kmh;
        tr.clampFront(gateS - 0.05);
        tr.stop();
        if (hit > RAIL.gateHitKmh) {
          g.cam.shake(0.6);
          g.sound.crash(0.4);
          g.damageCargo(1, 'রেলগেটে ধাক্কা', this.event.nameBn);
          g.hud.warn('{crash} রেলগেটে ধাক্কা! গেটম্যান খুব রাগ করেছেন', 'danger', 2.5);
        }
      }
      if (!this.waitedTold && Math.abs(tr.speed) < EVENTS.stopSpeed && front > S - 60 && front < gateS + 1) {
        this.waitedTold = true;
        g.hud.toast(`{hourglass} ${WAIT_LINES[Math.floor(Math.random() * WAIT_LINES.length)]}`, 4);
      }
    }
  }
}
