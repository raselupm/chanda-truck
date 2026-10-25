// Village roadworks (রাস্তার কাজ): our half of the road is dug up, so both directions share one lane.
// A flagman lets one side through at a time; 5-6 vehicles are already queued at his flag when we arrive.

import * as THREE from 'three';
import type { RoadworksEvent } from '../config/route';
import { ROAD, ROADWORKS } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cone, cyl, ico, vertexColorMaterial, type Part } from '../utils/geometry';
import { signTexture, speedSignTexture, stripeTexture } from '../utils/textures';
import { makePerson, makeWaver } from './People';
import { SetPiece, signPost } from './SetPiece';

/** whose turn it is in the shared lane */
type Phase = 'hold' | 'ours' | 'clearA' | 'theirs' | 'clearB';

/** traffic going our way waits this far before the works */
const STOP_BACK = 12;

function excavatorGeometry(): THREE.BufferGeometry {
  return cached('works:excavator', () =>
    buildColored([
      { geo: box(2.6, 0.7, 3.6), color: 0x2b2b2b, p: [0, 0.35, 0] },
      { geo: box(2.4, 1.1, 2.6), color: 0xf2b705, p: [0, 1.25, 0.3] },
      { geo: box(1.1, 1.2, 1.2), color: 0xf2b705, p: [-0.6, 2.35, 0.6] },
      { geo: box(1.0, 0.8, 0.06), color: 0x2a4b5f, p: [-0.6, 2.45, -0.02] },
      { geo: box(0.35, 0.35, 3.2), color: 0xe0a800, p: [0.5, 2.3, -1.4], r: [-0.45, 0, 0] },
      { geo: box(0.3, 0.3, 2.4), color: 0xe0a800, p: [0.5, 2.0, -3.6], r: [0.7, 0, 0] },
      { geo: box(0.9, 0.6, 0.7), color: 0x3a3a3a, p: [0.5, 0.9, -4.3] },
    ]),
  );
}

export class Roadworks extends SetPiece<RoadworksEvent> {
  private phase: Phase = 'hold';
  private timer = 0;
  private jamSpawned = false;
  private warned = false;
  private ranFlag = false;
  private prevFront = 0;
  private t = 0;
  private flagMats: THREE.MeshBasicMaterial[] = [];
  private flagmen: THREE.Mesh[] = [];
  private workers: THREE.Mesh[] = [];

  constructor(event: RoadworksEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    const L = event.length;
    const hw = track.halfWidth(S);
    const lane = track.laneD(S, false);
    const mat = vertexColorMaterial();

    // Cone line (d) along s: outer lane tapers shut, then our whole half is closed for the works
    const coneD = (s: number): number => {
      // (shut before the queue's tail, so we end up behind it, not beside it)
      if (s < S - 150) return -hw;
      if (s < S - 100) return -hw + 0.3 + ((s - (S - 150)) / 50) * (hw - 0.3 - 3.5);
      if (s < S + 2) return -3.5;
      if (s < S + 6) return -3.5 + ((s - (S + 2)) / 4) * 3.2;
      if (s < S + L) return -0.3;
      if (s < S + L + 35) return -0.3 - ((s - (S + L)) / 35) * (hw - 0.6);
      return -hw;
    };
    track.limits.push({ from: S - 155, to: S + L + 40, range: (s) => [coneD(s) + 1.35, 100] });
    track.propBlocks.push({ from: S - 10, to: S + L + 10, dMin: -hw - 22, dMax: -hw });

    const parts: Part[] = [];
    const P = (s: number, d: number, y: number): [number, number, number] => [d, y, -(s - S)];
    // dug-up dirt, a trench, heaps of sand and bricks
    parts.push({ geo: box(hw - 0.6, 0.08, L), color: 0x8b6a45, p: P(S + L / 2, -(hw + 0.3) / 2 - 0.15, 0.04) });
    parts.push({ geo: box(1.6, 0.06, L - 8), color: 0x3b2f24, p: P(S + L / 2, -hw / 2 - 1.2, 0.1) });
    for (let i = 0; i < 4; i++) parts.push({ geo: ico(1.3 + (i % 2) * 0.4), color: i % 2 ? 0xc9a86a : 0x9c7a4f, p: P(S + 12 + i * 14, -hw + 1.6 + (i % 2) * 0.8, 0.2), s: [1.4, 0.55, 1.2] });
    for (let i = 0; i < 3; i++) parts.push({ geo: box(1.2, 0.7, 0.8), color: 0xa63c2a, p: P(S + 20 + i * 1.3, -2.2, 0.4) });
    parts.push({ geo: box(0.4, 0.4, 6), color: 0x6c757d, p: P(S + 50, -1.8, 0.25), r: [0, 0.2, 0] });
    // traffic cones with a white band
    for (let s = S - 150; s <= S + L + 35; s += 4) {
      const d = coneD(s);
      parts.push({ geo: cone(0.22, 0.7, 6), color: 0xff6d00, p: P(s, d, 0.35) });
      parts.push({ geo: cyl(0.13, 0.15, 0.1, 6), color: 0xffffff, p: P(s, d, 0.42) });
    }
    const site = new THREE.Mesh(buildColored(parts), mat);
    site.position.copy(this.at(S, 0, ROAD.top));
    this.group.add(site);

    const excavator = new THREE.Mesh(excavatorGeometry(), mat);
    excavator.position.copy(this.at(S + L * 0.6, -hw / 2 - 0.4, ROAD.top + 0.05));
    excavator.rotation.y = 0.5;
    this.group.add(excavator);

    // Striped barricade across our lane where the works begin
    const barricade = this.own(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 0.08), new THREE.MeshLambertMaterial({ map: stripeTexture('#ff6d00', '#ffffff', 8) })));
    barricade.position.copy(this.at(S + 2, -1.9, ROAD.top + 0.9));
    this.group.add(barricade);
    const legs = new THREE.Mesh(cached('works:legs', () => buildColored([
      { geo: box(0.08, 1.0, 0.5), color: 0x555555, p: [-1.6, 0.5, 0] },
      { geo: box(0.08, 1.0, 0.5), color: 0x555555, p: [1.6, 0.5, 0] },
    ])), mat);
    legs.position.copy(this.at(S + 2, -1.9, ROAD.top));
    this.group.add(legs);

    // Signs
    const ahead = signPost(signTexture(['{cement} সামনে রাস্তার কাজ চলছে', 'এক লেনে চলাচল · পতাকা দেখে চলুন'], { bg: '#f77f00', fg: '#1d1d1d', border: '#1d1d1d', sizes: [52, 40] }), 4, 2, 2.4);
    ahead.position.copy(this.at(S - 420, -hw - 3, ROAD.top));
    this.group.add(ahead);
    for (const off of [160, 80]) {
      const limit = signPost(speedSignTexture(20), 1.2, 1.2, 2.2);
      limit.position.copy(this.at(S - off, -hw - 2.6, ROAD.top));
      this.group.add(limit);
    }
    const sorry = signPost(signTexture(['উন্নয়ন কাজ চলছে', 'সাময়িক অসুবিধার জন্য দুঃখিত', 'কাজ শুরু: ২০১৯ · শেষ: শীঘ্রই'], { bg: '#ffd23f', fg: '#1d1d1d', border: '#c1121f', sizes: [50, 34, 30] }), 3.6, 1.8, 2.2);
    sorry.position.copy(this.at(S - 6, -hw - 2.4, ROAD.top));
    sorry.rotation.y = 0.3;
    this.group.add(sorry);

    // Workers in hard hats
    const helmet = cached('works:helmet', () => buildColored([{ geo: cyl(0.17, 0.19, 0.12, 8), color: 0xffd23f, p: [0, 1.8, 0] }]));
    for (let i = 0; i < 4; i++) {
      const w = makePerson(i % 2 ? 'farmer' : 'trader', 70 + i);
      w.add(new THREE.Mesh(helmet, mat));
      w.position.copy(this.at(S + 10 + i * 13, -hw / 2 - 1.2 + (i % 2) * 2.4, ROAD.top + 0.08));
      w.rotation.order = 'YXZ';
      w.rotation.y = i * 1.3;
      w.userData.phase = i * 1.1;
      this.workers.push(w);
      this.group.add(w);
    }

    // Flagmen: one at our stop line, one at the far end for the oncoming side
    for (const [s, d, rot] of [[S - STOP_BACK, -lane - 2.4, Math.PI + 0.4], [S + L + 8, hw + 1.6, 0.4]] as const) {
      const f = makeWaver('farmer', 75, 'stick');
      f.add(new THREE.Mesh(helmet, mat));
      const flagMat = new THREE.MeshBasicMaterial({ color: 0xd62828, side: THREE.DoubleSide });
      this.flagMats.push(flagMat);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.42), flagMat);
      flag.position.set(0, -0.95, -0.9);
      flag.userData.ownsMaterial = true;
      (f.userData.arm as THREE.Mesh).add(flag);
      f.position.copy(this.at(s, d, ROAD.top));
      f.rotation.y = rot;
      this.flagmen.push(f);
      this.group.add(f);
    }

    game.thieves.addZone(S - 220, S - 4, 'রাস্তার কাজের জ্যাম');
    this.resolved = true;
  }

  visibleRange(): [number, number] {
    return [this.s - 750, this.s + this.event.length + 150];
  }

  get controlsTraffic(): boolean {
    return true;
  }

  stopLine(dir: 1 | -1): number | null {
    if (dir === 1) return this.phase === 'ours' ? null : this.s - STOP_BACK;
    return this.phase === 'theirs' || this.phase === 'hold' ? null : this.s + this.event.length + 10;
  }

  laneAt(s: number, dir: 1 | -1): number | null {
    const S = this.s;
    const L = this.event.length;
    const lane = this.game.track.laneD(S, false);
    if (dir === 1) {
      if (s > S - 170 && s <= S - STOP_BACK + 2) return -lane;
      if (s > S - STOP_BACK + 2 && s < S + L + 12) return lane;
      return null;
    }
    return s > S - 15 && s < S + L + 110 ? lane : null;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const S = this.s;
    const front = tr.frontS;
    const highway = g.state.phase === 'HIGHWAY';

    if (highway && !this.jamSpawned && front > S - ROADWORKS.spawnDistance && front < S - 200) {
      this.jamSpawned = true;
      const n = ROADWORKS.vehiclesMin + Math.floor(Math.random() * (ROADWORKS.vehiclesMax - ROADWORKS.vehiclesMin + 1));
      const lane = g.track.laneD(S, false);
      g.traffic.spawnQueue(S - STOP_BACK, -lane, -lane, n);
    }
    if (highway && !this.warned && front > S - 400 && front < S) {
      this.warned = true;
      g.hud.warn('{cement} সামনে রাস্তার কাজ — এক লেনে চলাচল, পতাকা দেখে চলুন', 'info', 3.5);
    }

    // The flagman's cycle starts once we're close (until then he holds our side)
    if (this.phase === 'hold') {
      if (front > S - ROADWORKS.cycleFrom) {
        this.phase = 'theirs';
        this.timer = 6;
      }
    } else if ((this.timer -= dt) <= 0) {
      const next: Record<Exclude<Phase, 'hold'>, [Phase, number]> = {
        ours: ['clearA', ROADWORKS.clearSeconds],
        clearA: ['theirs', ROADWORKS.redSeconds],
        theirs: ['clearB', ROADWORKS.clearSeconds],
        clearB: ['ours', ROADWORKS.greenSeconds],
      };
      [this.phase, this.timer] = next[this.phase];
    }
    const ours = this.phase === 'ours';

    // Driving past the red flag
    const line = S - STOP_BACK;
    if (highway && !ours && this.prevFront < line && front >= line && !this.ranFlag) {
      this.ranFlag = true;
      g.hud.warn('{warning} লাল পতাকা! উল্টো দিক থেকে গাড়ি আসছে', 'danger', 2.5);
      g.sound.whistle();
    }
    if (front < line - 5) this.ranFlag = false;
    this.prevFront = front;

    // Flagmen wave the green flag, hold the red one out; workers dig
    const theirs = this.phase === 'theirs' || this.phase === 'hold';
    this.flagmen.forEach((f, i) => {
      const go = i === 0 ? ours : theirs;
      this.flagMats[i].color.setHex(go ? 0x2d9d4f : 0xd62828);
      (f.userData.arm as THREE.Mesh).rotation.x = go ? 2.3 + Math.sin(this.t * 6) * 0.6 : Math.PI / 2;
    });
    for (const w of this.workers) w.rotation.x = Math.max(0, Math.sin(this.t * 3 + w.userData.phase)) * 0.4;
  }
}
