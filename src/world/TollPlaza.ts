// Legal toll plaza / road-tax checkpoint. Must stop; crossing the stop line above 20 km/h = game over.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import type { TollEvent } from '../config/route';
import { feeFor } from '../config/trucks';
import { EVENTS, ROAD, TOLL_JAM } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cached, vertexColorMaterial, type Part } from '../utils/geometry';
import { formatTaka } from '../utils/bnNumber';
import { canvasTexture, FONT_BN, signTexture, speedSignTexture, stripeTexture } from '../utils/textures';
import { makePerson } from './People';
import { glowZone, pulseGlow, SetPiece, signPost } from './SetPiece';

function stopSignTexture(): THREE.Texture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#c1121f';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 76px ${FONT_BN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('থামুন', 128, 134);
  });
}

function roadText(text: string, color: string): THREE.Texture {
  return canvasTexture(512, 160, (ctx) => {
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = color;
    ctx.font = `700 120px ${FONT_BN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 88);
  });
}

export class TollPlaza extends SetPiece<TollEvent> {
  private paid = false;
  private dialogOpen = false;
  private warned = false;
  private boomPivot: THREE.Group;
  private boomT = 0;
  private zone: THREE.Mesh;
  private t = 0;
  readonly fee: number;
  private officials: THREE.Mesh[] = [];
  /** the queue of vehicles paying ahead of us */
  private jamSpawned = false;
  /** seconds the boom stays up for a vehicle that has just paid */
  private boomOpen = 0;

  constructor(event: TollEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    const hw = track.halfWidth(S);
    const small = event.type === 'roadTax' || !!event.small;
    this.fee = feeFor(event.feeKey);
    const mat = vertexColorMaterial();

    // Funnel the truck into the toll lane on our side
    track.limits.push({
      from: S - 100,
      to: S + 14,
      range: (s) => {
        const t = Math.min(1, Math.max(0, (s - (S - 100)) / 60));
        return [-hw + 1.3, hw - 1.3 + (-1.9 - (hw - 1.3)) * t];
      },
    });
    track.propBlocks.push({ from: S - 40, to: S + 30, dMin: -hw - 25, dMax: hw + 25 });

    // Canopy over the plaza
    const canopyW = small ? hw + 3 : hw * 2 + 6;
    const canopyD = small ? -hw / 2 - 0.5 : 0;
    const pillars: Part[] = [];
    const pillarDs = small ? [-hw - 1.2, 0] : [-hw - 1.2, 0, hw + 1.2];
    for (const d of pillarDs) for (const ds of [0, 8]) pillars.push({ geo: box(0.6, 8.2, 0.6), color: 0xe8e4da, p: [d - canopyD, 4.1, -ds] });
    const canopy = new THREE.Mesh(
      buildColored([
        { geo: box(canopyW, 0.7, 11), color: 0xf2f0ea, p: [0, 8.5, -4] },
        { geo: box(canopyW + 0.1, 0.35, 11.1), color: small ? 0x1d5e9e : 0x1f7a3d, p: [0, 8.2, -4] },
        ...pillars,
      ]),
      mat,
    );
    canopy.position.copy(this.at(S, canopyD, ROAD.top));
    this.group.add(canopy);

    const nameTex = signTexture([event.nameBn, `ট্রাক: ${formatTaka(this.fee)}`], {
      bg: small ? '#1d5e9e' : '#1f7a3d', fg: '#ffffff', w: 1024, h: 160, sizes: [70, 44],
    });
    const nameBoard = this.own(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(canopyW - 1, 13), 2.0), new THREE.MeshLambertMaterial({ map: nameTex })));
    nameBoard.position.copy(this.at(S - 1.56, canopyD, ROAD.top + 8.6));
    this.group.add(nameBoard);

    // Islands + booths: left edge island, median island
    const boothGeo = cached('toll:booth', () =>
      buildColored([
        { geo: box(1.2, 0.3, 9), color: 0xd9d4c5, p: [0, 0.15, -3] },
        { geo: box(1.2, 0.32, 0.4), color: 0xffd23f, p: [0, 0.16, 1.5] },
        { geo: box(1.6, 2.5, 2.2), color: 0xe8e4da, p: [0, 1.55, -1] },
        { geo: box(1.62, 0.9, 1.6), color: 0x2a4b5f, p: [0, 1.9, -1] },
        { geo: box(1.8, 0.15, 2.4), color: 0x1f7a3d, p: [0, 2.88, -1] },
      ]),
    );
    const islands = small ? [-hw - 0.6] : [-hw - 0.6, 0, hw + 0.6];
    for (const d of islands) {
      const b = new THREE.Mesh(boothGeo, mat);
      b.position.copy(this.at(S, d, ROAD.top - 0.02));
      this.group.add(b);
    }

    // Boom barrier across our side
    const boomLen = hw - 0.4;
    const boomMat = this.own(new THREE.Mesh(new THREE.BoxGeometry(boomLen, 0.14, 0.14), new THREE.MeshLambertMaterial({ map: stripeTexture('#d62828', '#ffffff', 10) })));
    boomMat.position.x = boomLen / 2;
    this.boomPivot = new THREE.Group();
    this.boomPivot.add(boomMat);
    this.boomPivot.position.copy(this.at(S + 0.3, -hw + 0.1, ROAD.top + 1.05));
    const boomPost = new THREE.Mesh(cached('toll:boompost', () => buildColored([{ geo: box(0.35, 1.1, 0.35), color: 0xffd23f, p: [0, 0.55, 0] }])), mat);
    boomPost.position.copy(this.at(S + 0.3, -hw + 0.1, ROAD.top));
    this.group.add(this.boomPivot, boomPost);

    // Stop line + painted text + rumble strips (one merged mesh)
    const paint: Part[] = [{ geo: box(hw, 0.03, 0.5), color: 0xffffff, p: [-hw / 2, 0.02, 0] }];
    for (let k = 0; k < 8; k++) {
      for (let j = 0; j < 3; j++) {
        paint.push({ geo: box(hw * 2 - 1, 0.06, 0.3), color: j % 2 ? 0xffffff : 0xffd23f, p: [0, 0.03, 60 + k * 11 + j * 0.7] });
      }
    }
    const paintMesh = new THREE.Mesh(buildColored(paint), mat);
    paintMesh.position.copy(this.at(S, 0, ROAD.top));
    this.group.add(paintMesh);

    const decal = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: roadText('থামুন', '#ffffff'), transparent: true, depthWrite: false }),
    ));
    decal.position.copy(this.at(S - 7, -hw / 2, ROAD.top + 0.03));
    this.group.add(decal);

    // Approach signs: speed limit "২০" and "থামুন"
    for (const off of [120, 60]) {
      const sp = signPost(speedSignTexture(ECONOMY.tollMaxSpeedKmh), 1.3, 1.3, 2.2);
      sp.position.copy(this.at(S - off, -hw - 2.6, ROAD.top));
      this.group.add(sp);
    }
    const stop = signPost(stopSignTexture(), 1.4, 1.4, 2.2);
    stop.position.copy(this.at(S - 25, -hw - 2.6, ROAD.top));
    this.group.add(stop);
    const ahead = signPost(signTexture([`${event.nameBn} — সামনে`, 'গতি কমান · থামতে হবে'], { bg: '#1f7a3d', border: '#ffffff', sizes: [56, 42] }), 4, 2, 2.4);
    ahead.position.copy(this.at(S - 420, -hw - 3, ROAD.top));
    this.group.add(ahead);

    // Officials (generic uniforms)
    const officialSpots: [number, number][] = small ? [[S - 1, -hw - 1.8], [S + 2, -hw - 2.4]] : [[S - 1, -hw - 1.8], [S + 2, -0.9], [S + 4, -hw - 2.4]];
    officialSpots.forEach(([s, d], i) => {
      const o = makePerson('official', i);
      o.position.copy(this.at(s, d, ROAD.top + 0.28));
      o.rotation.y = -Math.PI / 2 + (i % 2 ? 0.6 : 0);
      this.officials.push(o);
      this.group.add(o);
    });

    this.zone = glowZone(24, hw - 0.4, 0xffb020);
    this.zone.position.copy(this.at(S - 12.5, -hw / 2, ROAD.top + 0.04));
    this.group.add(this.zone);

    // Crawling in the queue: thieves come for the vegetables
    game.thieves.addZone(S - 220, S + 2, event.nameBn);
  }

  get blocking(): boolean {
    return !this.paid;
  }

  // Traffic queues at the booth, each vehicle pays and drives on
  get controlsTraffic(): boolean {
    return true;
  }

  stopLine(dir: 1 | -1): number | null {
    return dir === 1 && !this.paid ? this.s - 0.3 : null;
  }

  get serviceTime(): number {
    // the booth only starts serving once we're close, so we always end up in the queue
    return this.game.truck.frontS > this.s - TOLL_JAM.serveFrom ? TOLL_JAM.serviceSeconds : Infinity;
  }

  served(): void {
    this.boomOpen = 2.2;
  }

  laneAt(s: number, dir: 1 | -1): number | null {
    return dir === 1 && s > this.s - 150 && s < this.s + 15 ? -this.game.track.halfWidth(this.s) / 2 : null;
  }

  visibleRange(): [number, number] {
    return [this.s - 750, this.s + 120];
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const S = this.s;
    const front = tr.frontS;

    this.zone.visible = !this.paid;
    if (!this.paid) pulseGlow(this.zone, this.t, 0.2, 0.25);

    tr.rumble = tr.rumble || (front > S - 150 && front < S - 55 && !this.paid);

    if (!this.jamSpawned && g.state.phase === 'HIGHWAY' && front > S - TOLL_JAM.spawnDistance && front < S - 150) {
      this.jamSpawned = true;
      const n = TOLL_JAM.vehiclesMin + Math.floor(Math.random() * (TOLL_JAM.vehiclesMax - TOLL_JAM.vehiclesMin + 1));
      g.traffic.spawnQueue(S, -g.track.halfWidth(S) / 2, -g.track.laneD(S, Math.random() < 0.5), n);
    }
    const near = !this.paid && front > S - 600 && front < S + 5;
    if (near) g.hud.tollMode = true;

    if (!this.paid && !this.dialogOpen && g.state.phase === 'HIGHWAY') {
      if (!this.warned && front > S - EVENTS.tollWarnDistance && front < S) {
        this.warned = true;
        g.hud.warn('{stop} সামনে টোল — গতি ২০-এর নিচে এনে থামুন', 'info', 4);
        g.sound.beep();
      }
      if (front >= S && front < S + 15) {
        if (tr.kmh > ECONOMY.tollMaxSpeedKmh) {
          g.gameOver('toll');
          return;
        }
        tr.clampFront(S - 0.05);
        tr.stop();
        this.openDialog();
      } else if (!g.modal && Math.abs(tr.speed) < EVENTS.stopSpeed && front > S - 25 && front < S && !g.traffic.vehicleBetween(front, S + 2, tr.d)) {
        this.openDialog();
      }
    }

    // The boom lifts for every vehicle that has paid, and for us
    this.boomOpen = Math.max(0, this.boomOpen - dt);
    const up = this.paid || this.boomOpen > 0;
    if (up ? this.boomT < 1 : this.boomT > 0) {
      this.boomT = Math.min(1, Math.max(0, this.boomT + (up ? dt * (this.paid ? 0.9 : 2.2) : -dt * 1.2)));
      this.boomPivot.rotation.z = (this.boomT * this.boomT * (3 - 2 * this.boomT)) * (Math.PI / 2 - 0.1);
    }
    // official waves the truck through once paid
    this.officials[0].rotation.z = this.paid ? Math.sin(this.t * 5) * 0.08 : 0;
  }

  private openDialog(): void {
    const g = this.game;
    this.dialogOpen = true;
    g.truck.stop();
    const isTax = this.event.type === 'roadTax';
    g.charge({
      kind: 'toll',
      titleBn: isTax ? 'সরকারি সড়ক কর' : this.event.nameBn,
      messageBn: isTax ? 'বৈধ কর — রশিদ দেওয়া হবে।' : 'বৈধ টোল — সরকারি রশিদসহ।',
      lines: [{ category: isTax ? 'ROAD_TAX' : 'TOLL', amount: this.fee, labelBn: isTax ? 'সড়ক কর (ট্রাক)' : this.event.type === 'bridgeToll' ? 'সেতু টোল (মাঝারি ট্রাক)' : 'সড়ক টোল (ট্রাক)' }],
      locationBn: this.event.nameBn,
      onPaid: () => {
        this.paid = true;
        this.resolved = true;
        this.dialogOpen = false;
        g.sound.beep();
      },
    });
  }
}
