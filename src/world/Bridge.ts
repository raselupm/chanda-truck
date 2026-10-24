// Long multi-span river bridge with piers, railings, lamps, water, sandbars and country boats.

import * as THREE from 'three';
import { ROAD } from '../config/tuning';
import type { TollEvent } from '../config/route';
import type { Game } from '../game/Game';
import { box, buildColored, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { canvasTexture, signTexture } from '../utils/textures';
import { boatHullGeometry } from './VehicleModels';
import { SetPiece } from './SetPiece';
import type { BridgeSpan } from './Track';

function waterTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % w;
      const y = (i * 61) % h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 14, y - 5, x + 28, y);
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}

interface Boat {
  x: number;
  z: number;
  speed: number;
  heading: number;
}

export class Bridge extends SetPiece<TollEvent> {
  private span: BridgeSpan;
  private water: THREE.Mesh;
  private waterTex: THREE.Texture;
  private boats: Boat[] = [];
  private boatMesh: THREE.InstancedMesh;
  private t = 0;

  constructor(event: TollEvent, game: Game) {
    super(event, game);
    const track = game.track;
    this.span = track.bridges.find((b) => b.start === event.s + event.bridge!.offset)!;
    const { start, end, style, nameBn } = this.span;
    const len = end - start;
    const hw = track.halfWidth(start);
    const deckY = this.span.deck + ROAD.top;
    const edge = hw + 1.0;
    const mat = vertexColorMaterial();
    const padma = style === 'padma';

    // Water
    this.waterTex = waterTexture();
    const waterLen = len + 260;
    this.water = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(1800, waterLen).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: { padma: 0x8a7a5a, jamuna: 0x6f8a86, lalon: 0x7d8466 }[style], map: this.waterTex }),
    ));
    this.water.position.set(0, 0.35, -(start + len / 2));
    this.group.add(this.water);

    // Sandbars (char)
    const sand: Part[] = [];
    for (let i = 0; i < 7; i++) {
      const x = (i % 2 ? 1 : -1) * (120 + ((i * 137) % 500));
      const z = -(start + 40 + ((i * 89) % Math.max(60, len - 80)));
      sand.push({ geo: cyl(1, 1, 0.3, 12), color: 0xd8c690, p: [x, 0.4, z], s: [30 + (i % 3) * 20, 1, 12 + (i % 2) * 10] });
    }
    this.group.add(new THREE.Mesh(buildColored(sand), mat));

    // Piers + railings + lamps (merged: the bridge is straight at x = 0)
    const parts: Part[] = [];
    const slab = deckY - 1.9; // underside of the road slab
    if (!padma) {
      // Concrete box-girder bridge on twin round piers every 50 m
      for (let s = start + 25; s < end - 10; s += 50) {
        for (const d of [-hw * 0.55, hw * 0.55]) parts.push({ geo: cyl(1.0, 1.2, slab + 2, 10), color: 0xb9b3a6, p: [d, (slab - 2) / 2, -s] });
        parts.push({ geo: box(edge * 2 - 1, 1.2, 2.2), color: 0xaaa497, p: [0, slab - 0.5, -s] });
      }
    }
    for (const side of [-1, 1]) {
      parts.push({ geo: box(0.4, 0.5, len), color: 0xd8d2c4, p: [side * (edge - 0.2), deckY + 0.25, -(start + len / 2)] });
      parts.push({ geo: box(0.1, 0.1, len), color: 0x7d8a96, p: [side * (edge - 0.2), deckY + 1.15, -(start + len / 2)] });
      parts.push({ geo: box(0.1, 0.1, len), color: 0x7d8a96, p: [side * (edge - 0.2), deckY + 0.8, -(start + len / 2)] });
      for (let s = start; s <= end; s += 3) parts.push({ geo: box(0.1, 0.7, 0.1), color: 0x7d8a96, p: [side * (edge - 0.2), deckY + 0.85, -s] });
    }
    // Lamp posts: Padma has them on both sides in pairs, the others alternate sides
    for (let s = start + 10, k = 0; s < end; s += padma ? 50 : 40, k++) {
      for (const side of padma ? [-1, 1] : [k % 2 ? 1 : -1]) {
        parts.push({ geo: cyl(0.09, 0.12, 8, 6), color: 0x9aa3ab, p: [side * (edge - 0.2), deckY + 4, -s] });
        parts.push({ geo: box(1.6, 0.1, 0.12), color: 0x9aa3ab, p: [side * (edge - 0.9), deckY + 8, -s] });
        parts.push({ geo: box(0.5, 0.15, 0.3), color: 0xfff3c0, p: [side * (edge - 1.6), deckY + 7.9, -s] });
      }
    }
    if (padma) {
      // Padma Setu: double-deck steel Warren truss. The road runs on top; the railway deck is
      // enclosed inside the truss box below it. Massive piers every ~150 m.
      const D = 10; // truss depth
      const top = slab;
      const bot = top - D;
      const tx = hw - 0.4; // truss planes
      const panel = 12.5;
      const steel = 0x8d969c;
      const steelDark = 0x737c82;
      const diagLen = Math.hypot(panel, D);
      const ang = Math.atan2(panel, D);
      for (const side of [-1, 1]) {
        const x = side * tx;
        parts.push({ geo: box(0.9, 0.9, len), color: steel, p: [x, top - 0.45, -(start + len / 2)] });
        parts.push({ geo: box(0.9, 1.1, len), color: steel, p: [x, bot + 0.55, -(start + len / 2)] });
        let k = 0;
        for (let s = start; s + panel <= end + 0.01; s += panel, k++) {
          parts.push({ geo: box(0.55, diagLen, 0.55), color: steel, p: [x, (top + bot) / 2, -(s + panel / 2)], r: [k % 2 ? ang : -ang, 0, 0] });
          parts.push({ geo: box(0.45, D, 0.45), color: steelDark, p: [x, (top + bot) / 2, -s] });
        }
      }
      // cross girders top and bottom + the enclosed railway deck with two tracks
      for (let s = start; s <= end; s += panel) {
        parts.push({ geo: box(tx * 2, 0.5, 0.5), color: steelDark, p: [0, top - 0.6, -s] });
        parts.push({ geo: box(tx * 2, 0.6, 0.6), color: steelDark, p: [0, bot + 0.3, -s] });
      }
      parts.push({ geo: box(tx * 2 - 0.6, 0.5, len), color: 0xa9a49a, p: [0, bot + 0.75, -(start + len / 2)] });
      for (const rx of [-2.3, -0.8, 0.8, 2.3]) parts.push({ geo: box(0.12, 0.15, len), color: 0x5d5d5d, p: [rx, bot + 1.08, -(start + len / 2)] });
      // Piers: tall concrete columns with a wide cap under the bottom chord
      for (let s = start + 75; s < end - 30; s += 150) {
        const h = bot + 2;
        parts.push({ geo: box(tx * 2 + 4, 2, 6), color: 0xb4aea0, p: [0, bot - 1, -s] });
        for (const d of [-tx * 0.45, tx * 0.45]) parts.push({ geo: box(3.4, h, 3.4), color: 0xc2bcae, p: [d, (bot - 2) / 2 - 1, -s] });
      }
    }
    const structure = new THREE.Mesh(buildColored(parts), mat);
    structure.frustumCulled = false;
    this.group.add(structure);

    // Name: an arch over the road (Jamuna, Lalon) or a big roadside monument (Padma)
    const nameTex = signTexture([`${nameBn}-এ স্বাগতম`], { bg: '#1f7a3d', fg: '#fff', w: 1024, h: 180, sizes: [90] });
    if (padma) {
      const mono = new THREE.Mesh(
        buildColored([
          { geo: box(10, 4, 1.2), color: 0xe8e4da, p: [0, 2.6, 0] },
          { geo: box(10.6, 0.6, 1.6), color: 0x8d969c, p: [0, 0.3, 0] },
        ]),
        mat,
      );
      mono.position.copy(this.at(start - this.span.ramp - 30, -(hw + 9), 0));
      mono.rotation.y = 0.35;
      const board = this.own(new THREE.Mesh(new THREE.PlaneGeometry(9.2, 1.6), new THREE.MeshLambertMaterial({ map: nameTex })));
      board.position.set(0, 3.1, 0.62);
      mono.add(board);
      this.group.add(mono);
    } else {
      const arch = new THREE.Mesh(
        buildColored([
          { geo: box(0.6, 10, 0.6), color: 0xe8e4da, p: [-edge - 0.5, 5, 0] },
          { geo: box(0.6, 10, 0.6), color: 0xe8e4da, p: [edge + 0.5, 5, 0] },
          { geo: box(edge * 2 + 1.6, 0.5, 0.6), color: 0xe8e4da, p: [0, 10.2, 0] },
        ]),
        mat,
      );
      arch.position.copy(this.at(start - 4, 0, ROAD.top));
      this.group.add(arch);
      const nameBoard = this.own(new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshLambertMaterial({ map: nameTex })));
      nameBoard.position.copy(this.at(start - 4.35, 0, ROAD.top + 9.2));
      this.group.add(nameBoard);
    }

    // Boats
    this.boatMesh = new THREE.InstancedMesh(boatHullGeometry(), mat, 10);
    this.boatMesh.frustumCulled = false;
    for (let i = 0; i < 10; i++) {
      const dir = i % 2 ? 1 : -1;
      this.boats.push({
        x: (i - 5) * 80 + 20,
        z: -(start - 70 + ((i * 113) % (len + 140))),
        speed: (2 + (i % 3)) * dir,
        heading: dir > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
    this.group.add(this.boatMesh);
    this.updateBoats(0);
  }

  get blocking(): boolean {
    return false;
  }

  visibleRange(): [number, number] {
    return [this.span.start - 900, this.span.end + 300];
  }

  private updateBoats(dt: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    this.boats.forEach((b, i) => {
      b.x += b.speed * dt;
      if (b.x > 700) b.x = -700;
      if (b.x < -700) b.x = 700;
      // keep boats out from under the deck
      if (Math.abs(b.x) < 14) b.x += Math.sign(b.speed) * 28;
      e.set(Math.sin(this.t * 1.3 + i) * 0.04, b.heading, Math.sin(this.t + i) * 0.05);
      q.setFromEuler(e);
      m.compose(p.set(b.x, 0.35 + Math.sin(this.t * 1.7 + i) * 0.08, b.z), q, one);
      this.boatMesh.setMatrixAt(i, m);
    });
    this.boatMesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    this.t += dt;
    this.waterTex.offset.x = this.t * 0.01;
    this.waterTex.offset.y = Math.sin(this.t * 0.3) * 0.01;
    this.updateBoats(dt);
    const s = this.game.truck.s;
    const { start, end } = this.span;
    const dist = s < start ? start - s : s > end ? s - end : 0;
    this.game.wind = Math.max(this.game.wind, 1 - dist / 250);
  }
}
