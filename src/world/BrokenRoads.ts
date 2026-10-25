// Broken stretches of road (ভাঙা রাস্তা): warning signs, a speed cap of BROKEN_ROAD.maxKmh and a bumpy ride.
// The potholes themselves are drawn by RoadStreamer.

import * as THREE from 'three';
import { BROKEN_ROAD, ROAD } from '../config/tuning';
import type { Game } from '../game/Game';
import { toBnDigits } from '../utils/bnNumber';
import { signTexture, speedSignTexture } from '../utils/textures';
import { signPost } from './SetPiece';

interface Stretch {
  from: number;
  to: number;
  group: THREE.Group;
}

export class BrokenRoads {
  readonly group = new THREE.Group();
  private stretches: Stretch[] = [];
  private inside: Stretch | null = null;

  constructor(private game: Game) {}

  build(ranges: [number, number][]): void {
    for (const st of this.stretches) {
      st.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.userData.ownsMaterial) {
          (m.material as THREE.MeshLambertMaterial).map?.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
      this.group.remove(st.group);
    }
    this.stretches = [];
    this.inside = null;
    const track = this.game.track;
    for (const [from, to] of ranges) {
      const g = new THREE.Group();
      const hw = track.halfWidth(from);
      const warn = signPost(signTexture(['{warning} সামনে রাস্তা ভাঙা', 'গর্ত সাবধান'], { bg: '#ffd23f', fg: '#1d1d1d', border: '#c1121f', sizes: [56, 44] }), 2.8, 1.4, 2.2);
      warn.position.copy(track.point(from - 70, -(hw + 3.2), new THREE.Vector3(), ROAD.top));
      warn.rotation.y = 0.3;
      const limit = signPost(speedSignTexture(BROKEN_ROAD.maxKmh), 1.2, 1.2, 2.2);
      limit.position.copy(track.point(from - 45, -(hw + 3.0), new THREE.Vector3(), ROAD.top));
      limit.rotation.y = 0.3;
      g.add(warn, limit);
      this.group.add(g);
      this.stretches.push({ from, to, group: g });
    }
  }

  /** The broken stretch the truck's front is on (for the HUD limit badge). */
  get current(): boolean {
    return this.inside !== null;
  }

  update(): void {
    const g = this.game;
    const tr = g.truck;
    let now: Stretch | null = null;
    for (const st of this.stretches) {
      st.group.visible = tr.s > st.from - 650 && tr.s < st.from;
      if (tr.frontS >= st.from && tr.frontS <= st.to) now = st;
    }
    tr.speedCapKmh = now ? BROKEN_ROAD.maxKmh : Infinity;
    tr.rough = !!now;
    if (now && now !== this.inside && g.state.phase === 'HIGHWAY') {
      g.hud.warn(`{warning} ভাঙা রাস্তা — ${toBnDigits(BROKEN_ROAD.maxKmh)} কিমি/ঘণ্টার বেশি উঠবে না`, 'info', 2.5);
    }
    this.inside = now;
  }
}
