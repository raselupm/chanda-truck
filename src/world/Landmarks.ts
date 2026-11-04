// Real landmarks beside the highway (config/landmarks.ts): Rooppur's cooling towers after Lalon Shah Bridge,
// the National Memorial at Savar, Mahasthangarh, the ship-breaking yards at Sitakunda… Each site is one merged
// mesh built by its model (world/landmarkModels/), a name board at the road edge facing the truck, and a few
// lights that come on after dark. Sites are built when the route starts and shown only when near.

import * as THREE from 'three';
import type { PlacedLandmark } from '../config/route';
import { LANDMARK } from '../config/tuning';
import type { Game } from '../game/Game';
import { cyl } from '../utils/geometry';
import { GENERIC, MODELS } from './landmarkModels';
import { LKit } from './landmarkModels/kit';

interface Site {
  lm: PlacedLandmark;
  group: THREE.Group;
  lights: THREE.PointsMaterial | null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Landmarks {
  readonly group = new THREE.Group();
  private sites: Site[] = [];

  constructor(private game: Game) {}

  build(list: PlacedLandmark[]): void {
    this.clear();
    const track = this.game.track;
    for (const lm of list) {
      const { def, s, side: k } = lm;
      const [L, D] = lm.size;
      const hw = track.halfWidth(s);
      const x0 = hw + LANDMARK.gap + (def.setback ?? 0);
      // keep trees, huts and ad boards off the site and the strip in front of it
      const near = k * (hw + 2);
      const far = k * (x0 + D + 4);
      track.propBlocks.push({ from: s - L / 2 - 6, to: s + L / 2 + 6, dMin: Math.min(near, far), dMax: Math.max(near, far) });

      const group = new THREE.Group();
      track.point(s, 0, group.position);
      group.rotation.y = -track.headingAt(s);
      const inner = new THREE.Group();
      inner.position.x = k * x0;
      group.add(inner);

      const kit = new LKit(k, L, D, hash(def.nameBn));
      const model = (def.model && MODELS[def.model]) || GENERIC[def.kind];
      if (model) model(kit);
      else kit.block(D / 2, 0, D * 0.6, L * 0.6, 8, 0xcfc6b4);
      if (def.model && !MODELS[def.model]) console.warn(`landmark model '${def.model}' missing, using '${def.kind}'`);
      const { mesh, lights } = kit.finish();
      inner.add(mesh, ...kit.extras);
      if (lights) inner.add(lights);

      group.add(this.board(lm, hw, k));
      group.visible = false;
      this.group.add(group);
      this.sites.push({ lm, group, lights: lights ? (lights.material as THREE.PointsMaterial) : null });
    }
  }

  /** The brown name board on two posts at the road edge, just before the site, turned to the oncoming truck. */
  private board(lm: PlacedLandmark, hw: number, k: number): THREE.Group {
    const g = new THREE.Group();
    const w = 6.4;
    const h = lm.def.placeBn ? 1.9 : 1.5;
    const post = new THREE.MeshLambertMaterial({ color: 0x9a9a96 });
    for (const dx of [-w / 2 + 0.4, w / 2 - 0.4]) {
      const p = new THREE.Mesh(cyl(0.07, 0.07, 3.6, 6), post);
      p.position.set(dx, 1.8, 0);
      g.add(p);
    }
    const lines = lm.def.placeBn ? [lm.def.nameBn, lm.def.placeBn] : [lm.def.nameBn];
    const kit = new LKit(1, 0, 0);
    g.add(kit.sign(lines, 0, 3.6 + h / 2 - 0.4, 0, w, h, { bg: '#6b3b1f', fg: '#ffffff', border: '#f2e6c9', sizes: lm.def.placeBn ? [110, 64] : [120] }, 0));
    for (const o of g.children) o.userData.ownsMaterial = true;
    g.position.set(k * (hw + 2.4 + w / 2), 0, lm.size[0] / 2 + 6);
    // face the oncoming truck (+z), turned a little toward the road
    g.rotation.y = -k * 0.4;
    return g;
  }

  update(night: number): void {
    const ts = this.game.truck.s;
    for (const site of this.sites) {
      const rel = site.lm.s - ts;
      site.group.visible = rel > -site.lm.size[0] / 2 - 150 && rel < LANDMARK.visibleAhead;
      if (site.lights && site.group.visible) site.lights.opacity = Math.min(1, Math.max(0, night - 0.15) * 1.4);
    }
  }

  private clear(): void {
    for (const site of this.sites) {
      this.group.remove(site.group);
      site.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.userData.ownsGeometry || m.userData.ownsMaterial || (o as THREE.Points).isPoints) m.geometry?.dispose();
        if (m.userData.ownsMaterial || (o as THREE.Points).isPoints) {
          const mat = m.material as THREE.MeshLambertMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
    }
    this.sites = [];
  }
}
