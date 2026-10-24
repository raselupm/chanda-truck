// Karwan Bazar: market gate, traders, crate piles, parked trucks and the unloading zone that ends the run.

import * as THREE from 'three';
import type { MarketEvent } from '../config/route';
import { ROAD } from '../config/tuning';
import { VEG_LIST } from '../config/vegetables';
import type { Game } from '../game/Game';
import { box, buildColored, vertexColorMaterial } from '../utils/geometry';
import { signTexture } from '../utils/textures';
import { makePerson } from './People';
import { propGeometry } from './Props';
import { glowZone, pulseGlow, SetPiece } from './SetPiece';
import { vehicleGeometry } from './VehicleModels';

export class Market extends SetPiece<MarketEvent> {
  private zone: THREE.Mesh;
  private traders: THREE.Mesh[] = [];
  private t = 0;
  private arrived = false;

  constructor(event: MarketEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    const hw = track.halfWidth(S);
    const mat = vertexColorMaterial();

    track.propBlocks.push({ from: S + 15, to: S + 120, dMin: -200, dMax: 200 });
    track.propBlocks.push({ from: S - 70, to: S + 15, dMin: -(hw + 12), dMax: hw + 12 });

    // Gate arch
    const gate = new THREE.Mesh(
      buildColored([
        { geo: box(1, 11, 1), color: 0xe63946, p: [-hw - 2.5, 5.5, 0] },
        { geo: box(1, 11, 1), color: 0xe63946, p: [hw + 2.5, 5.5, 0] },
        { geo: box(hw * 2 + 6, 0.6, 1), color: 0xffd166, p: [0, 11.2, 0] },
      ]),
      mat,
    );
    gate.position.copy(this.at(S - 45, 0, ROAD.top));
    this.group.add(gate);
    const gateSign = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(12, 2.4),
      new THREE.MeshLambertMaterial({ map: signTexture(['কাওরান বাজার', 'পাইকারি কাঁচাবাজার · ঢাকা'], { bg: '#e63946', fg: '#fff8e7', border: '#ffd166', w: 1024, h: 220, sizes: [96, 50] }) }),
    ));
    gateSign.position.copy(this.at(S - 45.55, 0, ROAD.top + 9.8));
    this.group.add(gateSign);

    // Market hall that closes the road
    const hall = new THREE.Mesh(
      buildColored([
        { geo: box(60, 9, 30), color: 0xd8cfbf, p: [0, 4.5, -15] },
        { geo: box(62, 0.6, 32), color: 0x8c99a3, p: [0, 9.3, -15] },
        { geo: box(20, 6, 0.2), color: 0x3a2a1e, p: [0, 3, 0.05] },
      ]),
      mat,
    );
    hall.position.copy(this.at(S + 34, 0, ROAD.top));
    this.group.add(hall);

    // Crate piles, parked trucks and rickshaws
    const crates = new THREE.InstancedMesh(propGeometry('crate'), mat, 160);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let k = 0;
    for (let pile = 0; pile < 10; pile++) {
      const side = pile % 2 ? 1 : -1;
      const ps = S - 40 + pile * 7;
      const pd = side * (hw + 4 + (pile % 3) * 1.5);
      const veg = VEG_LIST[pile % VEG_LIST.length];
      for (let i = 0; i < 16 && k < 160; i++) {
        const layer = Math.floor(i / 6);
        const pos = this.at(ps + (i % 3) * 0.75, pd + (Math.floor(i / 3) % 2) * 0.55, ROAD.top + layer * 0.47);
        m.makeRotationY((i * 0.37) % 0.3).setPosition(pos);
        crates.setMatrixAt(k, m);
        crates.setColorAt(k++, c.set(veg.color).lerp(new THREE.Color(0xffffff), 0.3));
      }
    }
    crates.count = k;
    this.group.add(crates);

    for (let i = 0; i < 3; i++) {
      const tr = new THREE.Mesh(vehicleGeometry('truck', i), mat);
      tr.position.copy(this.at(S - 30 + i * 14, hw + 7.5, ROAD.top));
      tr.rotation.y = 0.15;
      this.group.add(tr);
    }
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(vehicleGeometry('rickshaw', i), mat);
      r.position.copy(this.at(S - 60 + i * 3, -hw - 3.2, ROAD.top));
      r.rotation.y = 1.2;
      this.group.add(r);
    }

    // Traders and porters
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const p = makePerson('trader', i);
      p.position.copy(this.at(S - 50 + i * 4.2, side * (hw + 2 + (i % 4) * 1.4), ROAD.top));
      p.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.userData.phase = i * 0.7;
      this.traders.push(p);
      this.group.add(p);
    }

    this.zone = glowZone(24, hw, 0x48c7ff);
    this.zone.position.copy(this.at(S, -hw / 2, ROAD.top + 0.04));
    this.group.add(this.zone);
    const zoneSign = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: signTexture(['আনলোড এখানে'], { bg: '#00000000', fg: '#ffffff', w: 512, h: 140, sizes: [96] }), transparent: true, depthWrite: false }),
    ));
    zoneSign.position.copy(this.at(S - 8, -hw / 2, ROAD.top + 0.05));
    this.group.add(zoneSign);
  }

  get blocking(): boolean {
    return !this.arrived;
  }

  visibleRange(): [number, number] {
    return [this.s - 800, this.s + 200];
  }

  update(dt: number): void {
    this.t += dt;
    pulseGlow(this.zone, this.t);
    for (const p of this.traders) p.position.y = this.game.track.elevation(this.s) + ROAD.top + Math.max(0, Math.sin(this.t * 3 + p.userData.phase)) * 0.06;
    const g = this.game;
    if (!this.arrived && g.state.phase === 'HIGHWAY' && Math.abs(g.truck.s - this.s) < 12) {
      this.arrived = true;
      this.resolved = true;
      g.arrive();
    }
  }
}
