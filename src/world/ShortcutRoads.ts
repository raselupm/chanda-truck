// The village shortcuts as you see them: the road (always on the ground), the piers under the highway's
// flyovers where a right-side one passes under it, and the signs, built once per run. Also tells the
// player about each one on the way. (The flyover deck itself is part of the highway, see RoadStreamer.)

import * as THREE from 'three';
import { ROAD, SHORTCUT } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, vertexColorMaterial, type Part } from '../utils/geometry';
import { toBnDigits } from '../utils/bnNumber';
import { hash2, mulberry32 } from '../utils/rng';
import { signTexture, speedSignTexture } from '../utils/textures';
import { StripBuilder } from './RoadStreamer';
import { signPost } from './SetPiece';
import type { Shortcut } from './Shortcut';
import type { Track } from './Track';

const C = {
  tarmac: new THREE.Color(0x5a5853),
  patch: new THREE.Color(0x6a665d),
  white: new THREE.Color(0xe4e2d8),
  dirt: new THREE.Color(0xa47b4c),
  embank: new THREE.Color(0x7d6a42),
};

const STEP = 3;
/** the highway's flyover deck (lanes + shoulders + parapets) */
const DECK_HALF = ROAD.highwayHalfWidth + ROAD.shoulder + 0.3;
/** pier columns stand this far either side of the highway's centreline */
const PIER_X = 4.5;

/** Road surface, shoulders and the low embankment down to the fields. */
function roadGeometry(sc: Shortcut): THREE.BufferGeometry {
  const sb = new StripBuilder(sc);
  const rng = mulberry32(hash2(Math.round(sc.from), 77));
  // a hair under the highway's surface, which wins where the two overlap at the fork and the join
  const top = ROAD.top - 0.01;
  const tmp = new THREE.Color();
  for (let s0 = sc.from; s0 < sc.to - 0.01; s0 += STEP) {
    const s1 = Math.min(s0 + STEP, sc.to);
    const hw0 = sc.halfWidth(s0);
    const hw1 = sc.halfWidth(s1);
    // the shoulder is measured along x too, so it widens with the road
    const e0 = hw0 * (1 + SHORTCUT.shoulder / SHORTCUT.halfWidth);
    const e1 = hw1 * (1 + SHORTCUT.shoulder / SHORTCUT.halfWidth);

    tmp.copy(rng() < 0.15 ? C.patch : C.tarmac).multiplyScalar(0.94 + rng() * 0.1);
    sb.quad(s0, s1, -hw0, hw0, -hw1, hw1, top, top, top, top, tmp);
    // dashed centre line between the two lanes
    if (Math.round((s0 - sc.from) / STEP) % 3 === 0) sb.strip(s0, s1, -0.08, 0.08, top + 0.015, C.white);
    const yTop = top - 0.02;
    sb.quad(s0, s1, -e0, -hw0, -e1, -hw1, yTop, yTop, yTop, yTop, C.dirt);
    sb.quad(s0, s1, hw0, e0, hw1, e1, yTop, yTop, yTop, yTop, C.dirt);
    for (const side of [-1, 1]) {
      const a0 = side * e0;
      const a1 = side * e1;
      const b0 = side * (e0 + 1.2);
      const b1 = side * (e1 + 1.2);
      sb.quad(
        s0, s1,
        side < 0 ? b0 : a0, side < 0 ? a0 : b0, side < 0 ? b1 : a1, side < 0 ? a1 : b1,
        side < 0 ? 0.02 : yTop, side < 0 ? yTop : 0.02,
        side < 0 ? 0.02 : yTop, side < 0 ? yTop : 0.02,
        C.embank,
      );
    }
  }
  return sb.build();
}

/** Piers (two columns and a crosshead) under the highway's flyovers, clear of the village road below. */
function pierGeometry(sc: Shortcut, track: Track): THREE.BufferGeometry | null {
  const parts: Part[] = [];
  const reach = SHORTCUT.deckFlat + SHORTCUT.ramp;
  const clear = SHORTCUT.halfWidth + SHORTCUT.shoulder + 2;
  for (const c of sc.crossings) for (let s = c - reach; s <= c + reach; s += 16) {
    const h = track.elevation(s) - SHORTCUT.girder;
    if (h < 0.8) continue;
    const o = sc.offset(s);
    const hw = sc.halfWidth(s) / SHORTCUT.halfWidth;
    // the village road runs under here at an angle: no pier on it
    if (Math.abs(o) < DECK_HALF + clear * hw) continue;
    const x = track.centerX(s);
    const head = track.headingAt(s);
    const r: [number, number, number] = [0, -head, 0];
    // across the road is (cos, sin) of the heading in (x, z)
    for (const px of [-PIER_X, PIER_X]) parts.push({ geo: box(1.2, h, 1.2), color: 0xb5ae9f, p: [x + px * Math.cos(head), h / 2, -s + px * Math.sin(head)], r });
    parts.push({ geo: box(2 * DECK_HALF, 0.7, 1.4), color: 0xa8a192, p: [x, h - 0.35, -s], r });
  }
  return parts.length ? buildColored(parts) : null;
}

export class ShortcutRoads {
  readonly group = new THREE.Group();
  private roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private announced = new Set<Shortcut>();
  /** the shortcut the truck has properly turned onto (past the fork) */
  private on: Shortcut | null = null;

  constructor(private game: Game) {}

  /** Build the shortcuts of the current track. */
  build(): void {
    this.clear();
    for (const sc of this.game.track.shortcuts) {
      this.group.add(new THREE.Mesh(roadGeometry(sc), this.roadMat));
      const piers = pierGeometry(sc, this.game.track);
      if (piers) this.group.add(new THREE.Mesh(piers, vertexColorMaterial()));
      this.addSigns(sc);
    }
  }

  private clear(): void {
    this.announced.clear();
    this.on = null;
    for (const child of [...this.group.children]) {
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (m.userData.ownsMaterial) {
          const mat = m.material as THREE.MeshLambertMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
        if (m.material === this.roadMat || m.material === vertexColorMaterial()) m.geometry.dispose();
      });
      this.group.remove(child);
    }
  }

  private addSigns(sc: Shortcut): void {
    const tr = this.game.track;
    // it forks off to the left, and rejoins from the left too (bending right onto the highway)
    const arrowed = (text: string, left: boolean) => (left ? `← ${text}` : `${text} →`);
    // facing the approaching truck, turned a little toward the road (side: which side of its road it stands)
    const put = (g: THREE.Group, s: number, d: number, side: number) => {
      g.position.set(tr.centerX(s) + d, ROAD.top, -s);
      g.rotation.y = -side * 0.3;
      this.group.add(g);
    };
    // on the highway, before the fork
    const s0 = sc.from - 140;
    const fork = signPost(signTexture([arrowed('গ্রামের শর্টকাট', true), 'চাঁদা পয়েন্ট এড়িয়ে যান'], { bg: '#1f6f3f', fg: '#ffffff', border: '#ffffff', sizes: [62, 40] }), 3.4, 1.7, 2.6);
    put(fork, s0, -(tr.halfWidth(s0) + ROAD.shoulder + 1.5), -1);
    // on the shortcut: just past the fork, and before it joins the highway again
    const roadside = (s: number) => sc.offset(s) - (sc.halfWidth(s) + SHORTCUT.shoulder + 1.2);
    const s1 = sc.from + 230;
    const narrow = signPost(signTexture(['{warning} গ্রামের সরু রাস্তা', 'রিকশা-সিএনজি সাবধান'], { bg: '#ffd23f', fg: '#1d1d1d', border: '#c1121f', sizes: [54, 42] }), 2.8, 1.4, 2.2);
    put(narrow, s1, roadside(s1), -1);
    const s2 = sc.to - SHORTCUT.forkLength - 30;
    const join = signPost(signTexture([arrowed('মহাসড়ক', false), 'ঢাকা'], { bg: '#1f6f3f', fg: '#ffffff', border: '#ffffff', sizes: [62, 44] }), 2.8, 1.4, 2.4);
    put(join, s2, roadside(s2), -1);
    // speed limit signs every 700 m or so (not under a flyover)
    const clearOfFlyovers = (s: number) => sc.crossings.every((c) => Math.abs(s - c) > SHORTCUT.crossLength / 2 + 30);
    for (let s = sc.from + 320; s < sc.to - SHORTCUT.forkLength - 80; s += 700) {
      let at = s;
      while (!clearOfFlyovers(at) && at < sc.to) at += 40;
      if (at >= sc.to - SHORTCUT.forkLength - 80) break;
      put(signPost(speedSignTexture(SHORTCUT.maxKmh), 1.2, 1.2, 2.2), at, roadside(at), -1);
    }
  }

  /** HUD hints: the fork ahead, turning onto the shortcut, back on the highway. */
  update(): void {
    const g = this.game;
    const t = g.truck;
    if (g.state.phase !== 'HIGHWAY') return;
    for (const sc of g.track.shortcuts) {
      if (!this.announced.has(sc) && !t.road && t.frontS > sc.from - 450 && t.frontS < sc.from) {
        this.announced.add(sc);
        g.hud.warn('{road} সামনে বাঁয়ে গ্রামের শর্টকাট — চাঁদা পয়েন্ট এড়াতে বাঁয়ে নামুন', 'info', 4.5);
      }
    }
    const r = t.road;
    const mid = (sc: Shortcut) => (sc.from + sc.to) / 2;
    if (!this.on && r && !r.inMouth(t.s) && t.s < mid(r)) {
      this.on = r;
      g.hud.warn(`{road} গ্রামের রাস্তা — সর্বোচ্চ ${toBnDigits(SHORTCUT.maxKmh)} কিমি/ঘণ্টা, রিকশা-সিএনজি-বাইক সাবধান!`, 'info', 4);
    } else if (this.on && !r) {
      if (t.s > mid(this.on)) g.hud.toast('{ok} মহাসড়কে ফিরলেন — চাঁদা পয়েন্ট পেরিয়ে এসেছেন!', 3.5);
      this.on = null;
    }
  }
}
