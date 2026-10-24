// A roadside farm field: crops, farmer, crates, name sign and a glowing buy zone on the road.

import * as THREE from 'three';
import type { FarmEvent } from '../config/route';
import { EVENTS, ROAD } from '../config/tuning';
import { VEGETABLES, type VegId } from '../config/vegetables';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cone, cyl, ico, sph, vertexColorMaterial, type Part } from '../utils/geometry';
import { signTexture } from '../utils/textures';
import { makeWaver } from './People';
import { propGeometry } from './Props';
import { glowZone, pulseGlow, SetPiece, signPost } from './SetPiece';

const LEAF = 0x3f8f2a;

function cropGeometry(veg: VegId): THREE.BufferGeometry {
  return cached(`crop:${veg}`, () => {
    const p: Part[] = [];
    switch (veg) {
      case 'tomato':
        p.push({ geo: cyl(0.02, 0.02, 1.0, 4), color: 0x8a6a3a, p: [0, 0.5, 0] });
        p.push({ geo: ico(0.38), color: LEAF, p: [0, 0.6, 0], s: [1, 1.2, 1] });
        for (let i = 0; i < 4; i++) p.push({ geo: sph(0.09, 6, 4), color: 0xe03b2a, p: [Math.cos(i * 1.6) * 0.32, 0.45 + (i % 2) * 0.25, Math.sin(i * 1.6) * 0.32] });
        break;
      case 'potato':
        p.push({ geo: sph(0.45, 7, 4), color: 0x7a5a36, p: [0, 0, 0], s: [1, 0.45, 1] });
        p.push({ geo: ico(0.28), color: LEAF, p: [0, 0.32, 0], s: [1.2, 0.7, 1.2] });
        break;
      case 'onion':
        for (let i = 0; i < 6; i++) p.push({ geo: cone(0.04, 0.6, 4), color: 0x5fae3a, p: [Math.cos(i) * 0.12, 0.3, Math.sin(i) * 0.12], r: [Math.cos(i) * 0.25, 0, Math.sin(i) * 0.25] });
        p.push({ geo: sph(0.1, 6, 4), color: 0xb5506b, p: [0, 0.05, 0] });
        break;
      case 'brinjal':
        p.push({ geo: ico(0.42), color: LEAF, p: [0, 0.55, 0] });
        for (let i = 0; i < 3; i++) p.push({ geo: sph(0.08, 6, 4), color: 0x5b2a6e, p: [Math.cos(i * 2.1) * 0.35, 0.35, Math.sin(i * 2.1) * 0.35], s: [1, 2, 1] });
        break;
      case 'cauliflower':
        p.push({ geo: ico(0.42), color: 0x4f8f3a, p: [0, 0.2, 0], s: [1.2, 0.6, 1.2] });
        p.push({ geo: sph(0.24, 7, 5), color: 0xf1ead0, p: [0, 0.38, 0], s: [1, 0.7, 1] });
        break;
      case 'cabbage':
        p.push({ geo: ico(0.42), color: 0x6fa33a, p: [0, 0.2, 0], s: [1.3, 0.5, 1.3] });
        p.push({ geo: sph(0.3, 7, 5), color: 0x9ccc65, p: [0, 0.33, 0] });
        break;
      case 'chili':
        p.push({ geo: ico(0.35), color: 0x3f8f2a, p: [0, 0.45, 0], s: [1, 1.1, 1] });
        for (let i = 0; i < 5; i++) p.push({ geo: cone(0.04, 0.16, 4), color: i % 2 ? 0xd62828 : 0x2e9e3a, p: [Math.cos(i * 1.3) * 0.3, 0.4, Math.sin(i * 1.3) * 0.3], r: [Math.PI, 0, 0] });
        break;
      case 'gourd':
        // bamboo trellis (macha) with gourds hanging under it
        for (const x of [-0.9, 0.9]) for (const z of [-0.9, 0.9]) p.push({ geo: cyl(0.04, 0.04, 1.8, 4), color: 0x9b8a5a, p: [x, 0.9, z] });
        p.push({ geo: box(2, 0.12, 2), color: 0x4f9a35, p: [0, 1.8, 0] });
        for (let i = 0; i < 3; i++) p.push({ geo: cyl(0.1, 0.13, 0.6, 6), color: 0x8bc34a, p: [-0.5 + i * 0.5, 1.4, (i % 2) * 0.4 - 0.2] });
        break;
    }
    return buildColored(p);
  });
}

export class Farm extends SetPiece<FarmEvent> {
  private zone: THREE.Mesh;
  private farmer: THREE.Mesh;
  private armed = true;
  private t = 0;

  constructor(event: FarmEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    const side = event.side;
    const hw = track.halfWidth(S);
    const fieldW = 30;
    const fieldL = 34;
    const fieldD = side * (hw + 4 + fieldW / 2);

    track.propBlocks.push({
      from: S - fieldL / 2 - 6,
      to: S + fieldL / 2 + 6,
      dMin: side > 0 ? hw + 1 : -(hw + 8 + fieldW),
      dMax: side > 0 ? hw + 8 + fieldW : -(hw + 1),
    });

    const soil = new THREE.Mesh(buildColored([{ geo: box(fieldW, 0.3, fieldL), color: 0x6b4a2e }]), vertexColorMaterial());
    soil.position.copy(this.at(S, fieldD, -0.1));
    this.group.add(soil);

    // Crop rows; the field is split between this farm's vegetables
    const vegs = event.vegetables;
    const rowsPerVeg = Math.max(2, Math.floor(8 / vegs.length));
    const m = new THREE.Matrix4();
    vegs.forEach((veg, vi) => {
      const spacing = veg === 'gourd' ? 2.6 : 1.4;
      const perRow = Math.floor((fieldL - 2) / spacing);
      const inst = new THREE.InstancedMesh(cropGeometry(veg), vertexColorMaterial(), rowsPerVeg * perRow);
      let k = 0;
      for (let r = 0; r < rowsPerVeg; r++) {
        const rowIdx = vi * rowsPerVeg + r;
        const dd = fieldD - side * (fieldW / 2 - 1.5 - rowIdx * (fieldW - 3) / (vegs.length * rowsPerVeg));
        for (let i = 0; i < perRow; i++) {
          const ss = S - fieldL / 2 + 1 + i * spacing + (r % 2) * 0.4;
          const pos = this.at(ss, dd, 0.05);
          m.makeRotationY(((i * 37 + r * 11) % 10) * 0.6).setPosition(pos);
          inst.setMatrixAt(k++, m);
        }
      }
      inst.count = k;
      this.group.add(inst);
    });

    // Farmer waving next to the road
    this.farmer = makeWaver('farmer', Math.floor(S) % 5, 'receipt');
    this.farmer.position.copy(this.at(S + 3, side * (hw + 2.5)));
    this.farmer.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.group.add(this.farmer);

    // Crates waiting for a buyer
    const crates = new THREE.InstancedMesh(propGeometry('crate'), vertexColorMaterial(), 9);
    const c = new THREE.Color();
    for (let i = 0; i < 9; i++) {
      const pos = this.at(S - 4 - (i % 3) * 0.8, side * (hw + 2.4 + Math.floor(i / 3) * 0.6), Math.floor(i / 3) * 0.47 + ROAD.top);
      m.makeRotationY(i * 0.3).setPosition(pos);
      crates.setMatrixAt(i, m);
      crates.setColorAt(i, c.set(VEGETABLES[vegs[i % vegs.length]].color).lerp(new THREE.Color(0xffffff), 0.35));
    }
    this.group.add(crates);

    // Name sign
    const sign = signPost(
      signTexture([event.nameBn, vegs.map((v) => VEGETABLES[v].emoji + ' ' + VEGETABLES[v].nameBn).join('  ')], {
        bg: '#f6efe0', fg: '#3b2a1a', border: '#3f8f2a', sizes: [64, 40],
      }),
      3.2, 1.6, 1.6,
    );
    sign.position.copy(this.at(S - 14, side * (hw + 2.2)));
    sign.rotation.y = -side * 0.4;
    this.group.add(sign);

    // Buy zone on the road
    this.zone = glowZone(18, hw * 2, 0x48ff7a);
    this.zone.position.copy(this.at(S, 0, ROAD.top + 0.04));
    this.group.add(this.zone);
  }

  get blocking(): boolean {
    return false;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const farmPhase = g.state.phase === 'FARM';
    this.zone.visible = farmPhase;
    if (farmPhase) pulseGlow(this.zone, this.t);
    const arm = this.farmer.userData.arm as THREE.Object3D;
    arm.rotation.x = farmPhase ? 2.4 + Math.sin(this.t * 6) * 0.5 : 0;

    const tr = g.truck;
    const inZone = Math.abs(tr.s - this.s) < 9;
    if (!inZone) this.armed = true;
    if (farmPhase && inZone && this.armed && !g.modal && Math.abs(tr.kmh) < EVENTS.farmStopKmh) {
      this.armed = false;
      g.openBuyPanel(this.event);
    }
  }
}
