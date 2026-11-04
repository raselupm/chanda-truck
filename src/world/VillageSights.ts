// Village life beside the highway: a gorur hat (cattle market), a waz mahfil, and football and cricket fields.
// The route picks quiet rural stretches for them (Sight in route.ts). Each site is one merged static mesh
// (ground, bamboo, tarps, cattle, crowds) plus a few animated figures:
// - gorur hat: rows of deshi cattle tied to bamboo rails, goats, tarp shades, the hasil (toll) desk with a
//   loudspeaker, straw piles, buyers walking the rows, cows being led along the road shoulder; it moos
// - waz mahfil: a patchwork shamiana over rows of listeners on mats, a stage with the speakers, string lights
//   and horn loudspeakers on bamboo poles down the road; the sermon carries over the speakers
// - football: bamboo goals on a worn field, two teams of boys in sky-blue and yellow jerseys chasing the ball
// - cricket: a pitch with stumps, the bowler runs in, the batter swings, fielders chase it down
// Sites are built in a frame where +x points away from the road and -z runs with the road, mirrored for the
// left side. The players go home after dark; the mahfil's lights come on.

import * as THREE from 'three';
import type { Sight, SightKind } from '../config/route';
import { VILLAGE } from '../config/tuning';
import type { AircraftVoice } from '../audio/Sound';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cone, cyl, sph, vertexColorMaterial, type Part } from '../utils/geometry';
import { signTexture } from '../utils/textures';
import { personParts } from './People';

type V3 = [number, number, number];

const SKINS = [0x8d5a3b, 0x9c6644, 0x7b4a2e, 0xa87150];
const BAMBOO = 0xb59a5a;
const BAMBOO_DARK = 0x8f7a45;

// ---------------------------------------------------------------- shared models

/** A deshi (zebu) cow facing -z: humped back, dewlap, short horns. */
function cowGeometry(color: number, garland: boolean): THREE.BufferGeometry {
  return cached(`cow:${color}:${garland}`, () => {
    const dark = new THREE.Color(color).multiplyScalar(0.7).getHex();
    const parts: Part[] = [
      { geo: box(0.68, 0.72, 1.5), color, p: [0, 1.02, 0] },
      { geo: box(0.5, 0.45, 0.45), color, p: [0, 0.78, -0.62] },
      { geo: box(0.34, 0.3, 0.42), color: dark, p: [0, 1.46, -0.45] },
      { geo: box(0.34, 0.42, 0.42), color, p: [0, 1.18, -0.86], r: [0.35, 0, 0] },
      { geo: box(0.3, 0.32, 0.52), color, p: [0, 1.18, -1.15], r: [0.55, 0, 0] },
      { geo: box(0.25, 0.18, 0.16), color: 0x3a2e28, p: [0, 0.98, -1.4] },
      { geo: cone(0.05, 0.22, 5), color: 0xd9cfb8, p: [-0.12, 1.42, -1.02], r: [0, 0, 0.5] },
      { geo: cone(0.05, 0.22, 5), color: 0xd9cfb8, p: [0.12, 1.42, -1.02], r: [0, 0, -0.5] },
      { geo: box(0.2, 0.06, 0.1), color, p: [-0.23, 1.28, -1.02] },
      { geo: box(0.2, 0.06, 0.1), color, p: [0.23, 1.28, -1.02] },
      { geo: cyl(0.025, 0.02, 0.7, 4), color, p: [0, 0.95, 0.8], r: [0.25, 0, 0] },
      { geo: box(0.08, 0.16, 0.08), color: 0x2a2522, p: [0, 0.6, 0.88] },
    ];
    for (const [x, z] of [[-0.22, -0.55], [0.22, -0.55], [-0.22, 0.55], [0.22, 0.55]]) {
      parts.push({ geo: box(0.14, 0.66, 0.14), color, p: [x, 0.33, z] });
      parts.push({ geo: box(0.15, 0.08, 0.15), color: 0x2a2522, p: [x, 0.04, z] });
    }
    // an Eid garland and a ribbon on the forehead
    if (garland) {
      parts.push({ geo: box(0.42, 0.1, 0.34), color: 0xe63946, p: [0, 1.05, -0.86], r: [0.35, 0, 0] });
      parts.push({ geo: box(0.44, 0.06, 0.36), color: 0xffd166, p: [0, 0.96, -0.86], r: [0.35, 0, 0] });
    }
    return buildColored(parts);
  });
}

/** A Black Bengal goat facing -z. */
function goatGeometry(color: number): THREE.BufferGeometry {
  return cached(`goat:${color}`, () => {
    const parts: Part[] = [
      { geo: box(0.32, 0.34, 0.72), color, p: [0, 0.56, 0] },
      { geo: box(0.18, 0.3, 0.18), color, p: [0, 0.78, -0.4], r: [0.4, 0, 0] },
      { geo: box(0.16, 0.18, 0.28), color, p: [0, 0.9, -0.52], r: [0.5, 0, 0] },
      { geo: cone(0.03, 0.16, 4), color: 0x5a4a3a, p: [-0.05, 1.04, -0.46], r: [0.6, 0, 0] },
      { geo: cone(0.03, 0.16, 4), color: 0x5a4a3a, p: [0.05, 1.04, -0.46], r: [0.6, 0, 0] },
      { geo: box(0.14, 0.04, 0.06), color, p: [-0.12, 0.92, -0.46] },
      { geo: box(0.14, 0.04, 0.06), color, p: [0.12, 0.92, -0.46] },
    ];
    for (const [x, z] of [[-0.1, -0.28], [0.1, -0.28], [-0.1, 0.28], [0.1, 0.28]]) parts.push({ geo: box(0.07, 0.4, 0.07), color, p: [x, 0.2, z] });
    return buildColored(parts);
  });
}

interface Look {
  shirt: number;
  lower: number;
  lungi?: boolean;
  cap?: number;
  seated?: boolean;
  /** stripes down a jersey (Argentina fans) */
  stripes?: number;
  beard?: boolean;
  skin?: number;
}

/** A person facing -z (People.personParts), with a few extras: jersey stripes, a beard. */
function personGeometry(l: Look, variant = 0): THREE.BufferGeometry {
  const skin = l.skin ?? SKINS[variant % SKINS.length];
  return cached(`vperson:${l.shirt}:${l.lower}:${!!l.lungi}:${l.cap}:${!!l.seated}:${l.stripes}:${!!l.beard}:${skin}`, () => {
    const parts = personParts({ skin, shirt: l.shirt, lower: l.lower, lungi: !!l.lungi, cap: l.cap, seated: l.seated });
    const y0 = l.seated ? -0.35 : 0;
    if (l.stripes !== undefined) {
      for (const x of [-0.14, 0, 0.14]) parts.push({ geo: box(0.06, 0.6, 0.29), color: l.stripes, p: [x, y0 + 1.16, 0] });
    }
    if (l.beard) parts.push({ geo: box(0.2, 0.14, 0.12), color: 0x1d1a17, p: [0, y0 + 1.56, -0.1] });
    return buildColored(parts);
  });
}

const BUYERS: Look[] = [
  { shirt: 0xf2f0ea, lower: 0x3b5d8f, lungi: true },
  { shirt: 0x9ec3e6, lower: 0x2f6f5e, lungi: true, cap: 0xf2f0ea },
  { shirt: 0xd9c7a3, lower: 0x3a3a40 },
  { shirt: 0xc9c9c9, lower: 0x6b4f8a, lungi: true },
  { shirt: 0xe8d8b0, lower: 0x7a3b3b, lungi: true, cap: 0xf2f0ea },
  { shirt: 0x8a9bb0, lower: 0x2d3b55 },
];

// ---------------------------------------------------------------- building kit

/** Collects parts in the site frame (+x away from the road) and mirrors them onto the chosen side. */
class Kit {
  readonly parts: Part[] = [];
  constructor(readonly k: number) {}

  add(geo: THREE.BufferGeometry, color: number | undefined, x: number, y: number, z: number, r: V3 = [0, 0, 0], s?: V3): void {
    this.parts.push({ geo, color, p: [this.k * x, y, z], r: [r[0], this.k * r[1], this.k * r[2]], s });
  }

  /** a bamboo pole standing at (x, z) */
  pole(x: number, z: number, h: number, r = 0.06): void {
    this.add(cyl(r, r * 1.2, h, 5), BAMBOO, x, h / 2, z);
  }

  /** a bamboo pole lying along z, at height y */
  railZ(x: number, y: number, z0: number, z1: number, r = 0.05): void {
    this.add(cyl(r, r, z1 - z0, 5), BAMBOO_DARK, x, y, (z0 + z1) / 2, [Math.PI / 2, 0, 0]);
  }

  /** a bamboo pole lying along x, at height y */
  railX(x0: number, x1: number, y: number, z: number, r = 0.05): void {
    this.add(cyl(r, r, x1 - x0, 5), BAMBOO_DARK, (x0 + x1) / 2, y, z, [0, 0, Math.PI / 2]);
  }

  /** a tarpaulin shade on four bamboo poles, sloping down toward +x */
  tarp(x: number, z: number, w: number, d: number, h: number, color: number, stripe?: number): void {
    for (const [px, pz] of [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2]]) this.pole(px, pz, px < x ? h : h - 0.5);
    this.add(box(w + 0.4, 0.06, d + 0.4), color, x, h - 0.25, z, [0, 0, -0.1]);
    if (stripe !== undefined) for (let i = -1; i <= 1; i += 2) this.add(box(w + 0.42, 0.07, 0.5), stripe, x, h - 0.25, z + i * d * 0.3, [0, 0, -0.1]);
  }

  person(l: Look, x: number, z: number, yaw: number, variant = 0): void {
    this.add(personGeometry(l, variant), undefined, x, 0, z, [0, yaw, 0]);
  }

  mesh(): THREE.Mesh {
    const m = new THREE.Mesh(buildColored(this.parts), vertexColorMaterial());
    m.frustumCulled = false;
    return m;
  }
}

/** A road-facing banner on a bamboo gate, readable by the oncoming truck. */
function gate(kit: Kit, group: THREE.Group, x: number, z: number, width: number, lines: string[], bg: string, fg: string, sizes: number[]): void {
  kit.pole(x, z - width / 2, 5.6, 0.09);
  kit.pole(x, z + width / 2, 5.6, 0.09);
  kit.railZ(x, 5.4, z - width / 2, z + width / 2, 0.07);
  // cloth wrapped round the posts in bands
  const bands = [0xe63946, 0xffd166, 0x2a9d8f, 0xffffff];
  for (let i = 0; i < 6; i++) {
    for (const zz of [z - width / 2, z + width / 2]) kit.add(cyl(0.14, 0.14, 0.5, 6), bands[i % 4], x, 0.6 + i * 0.8, zz);
  }
  const tex = signTexture(lines, { bg, fg, border: '#ffd166', w: 1024, h: 256, sizes });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.4, 1.6), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(kit.k * x, 4.5, z);
  // face the road, turned a little toward the oncoming traffic (+z)
  sign.rotation.y = -kit.k * (Math.PI / 2 - 0.45);
  group.add(sign);
}

// ---------------------------------------------------------------- animated figures

interface Walker {
  mesh: THREE.Object3D;
  /** walks between a and b in the site frame (x, z), at speed */
  a: [number, number];
  b: [number, number];
  speed: number;
  u: number;
  dir: 1 | -1;
}

interface Footballer {
  mesh: THREE.Mesh;
  team: 0 | 1;
  /** home position on the field (x, z) */
  home: [number, number];
  x: number;
  z: number;
  keeper: boolean;
}

interface Site {
  sight: Sight;
  group: THREE.Group;
  /** for converting site-frame positions */
  k: number;
  hw: number;
  walkers: Walker[];
  footballers: Footballer[];
  ball: THREE.Mesh | null;
  ballV: THREE.Vector3;
  kickCooldown: number;
  cricket: Cricket | null;
  lights: THREE.PointsMaterial | null;
  /** players and walkers, hidden after dark at the fields */
  players: THREE.Object3D[];
  voice: AircraftVoice | null;
  soundTimer: number;
  warned: boolean;
  /** field centre (x, z) and half-size */
  field: { x: number; z: number; hx: number; hz: number };
}

interface Cricket {
  bowler: THREE.Mesh;
  striker: THREE.Mesh;
  bat: THREE.Object3D;
  nonStriker: THREE.Mesh;
  keeper: THREE.Mesh;
  fielders: { mesh: THREE.Mesh; home: [number, number] }[];
  t: number;
  hit: boolean;
  /** where the ball goes after the shot (site frame) */
  shot: THREE.Vector3;
  chaser: number;
}

// ---------------------------------------------------------------- the system

export class VillageSights {
  readonly group = new THREE.Group();
  private sites: Site[] = [];
  private t = 0;

  constructor(private game: Game) {}

  build(sights: Sight[]): void {
    for (const s of this.sites) {
      s.voice?.stop();
      this.group.remove(s.group);
    }
    this.sites = [];
    const track = this.game.track;
    for (const sight of sights) {
      const cfg = VILLAGE[sight.kind];
      const hw = track.halfWidth(sight.s);
      const k = sight.side;
      const x0 = hw + cfg.gap;
      // keep trees, huts and ads off the site
      const near = k * (hw + 2);
      const far = k * (x0 + cfg.depth + 3);
      track.propBlocks.push({ from: sight.s - cfg.length / 2 - 6, to: sight.s + cfg.length / 2 + 6, dMin: Math.min(near, far), dMax: Math.max(near, far) });
      const group = new THREE.Group();
      track.point(sight.s, 0, group.position);
      group.rotation.y = -track.headingAt(sight.s);
      const site: Site = {
        sight, group, k, hw, walkers: [], footballers: [], ball: null, ballV: new THREE.Vector3(), kickCooldown: 0, cricket: null,
        lights: null, players: [], voice: null, soundTimer: 2, warned: false,
        field: { x: x0 + cfg.depth / 2, z: 0, hx: cfg.depth / 2 - 4, hz: cfg.length / 2 - 4 },
      };
      const kit = new Kit(k);
      ({ gorurHat: () => this.gorurHat(site, kit, x0), wazMahfil: () => this.wazMahfil(site, kit, x0), football: () => this.football(site, kit, x0), cricket: () => this.cricketField(site, kit, x0) } as Record<SightKind, () => void>)[sight.kind]();
      group.add(kit.mesh());
      group.visible = false;
      this.group.add(group);
      this.sites.push(site);
    }
  }

  // ---------------------------------------------------------------- gorur hat

  private gorurHat(site: Site, kit: Kit, x0: number): void {
    const { length: L, depth: D } = VILLAGE.gorurHat;
    const zEnd = L / 2 - 4;
    // trampled earth with muddy patches and dung-dark spots
    kit.add(box(D, 0.05, L), 0x9b7d58, x0 + D / 2, 0.03, 0);
    for (let i = 0; i < 9; i++) kit.add(box(5 + (i % 3) * 3, 0.06, 4 + (i % 2) * 5), 0x7d6040, x0 + 6 + ((i * 17) % (D - 10)), 0.035, -zEnd + ((i * 29) % (L - 8)));
    gate(kit, site.group, x0 + 0.6, 6, 9, ['গরুর হাট', 'গরু-ছাগল বেচাকেনা — হাসিল এখানে'], '#7a3b1d', '#ffffff', [96, 44]);

    // rows of cattle tied to bamboo rails, facing the rail from both sides
    const COWS = [0xe9e4da, 0xd8c7a6, 0xa87a4f, 0x7a3f22, 0x2a2522, 0x9a9590, 0xc9a074];
    let n = 0;
    for (const rx of [x0 + 12, x0 + 24, x0 + 36]) {
      kit.railZ(rx, 0.95, -zEnd + 4, zEnd - 14);
      for (let z = -zEnd + 4; z <= zEnd - 14; z += 5) kit.pole(rx, z, 1.3, 0.05);
      for (const side of [-1, 1]) {
        for (let z = -zEnd + 6; z < zEnd - 15; z += 2.4) {
          n++;
          if ((n * 7) % 10 < 2) continue;
          const color = COWS[(n * 13 + (side > 0 ? 3 : 0)) % COWS.length];
          kit.add(cowGeometry(color, n % 5 === 0), undefined, rx + side * 1.45, 0, z + ((n * 37) % 10) / 20, [0, side < 0 ? -Math.PI / 2 : Math.PI / 2, 0]);
        }
      }
    }
    // goats tied near the gate, a big bull alone at the back with his own shade
    for (let i = 0; i < 14; i++) {
      kit.add(goatGeometry([0x222222, 0x2a2522, 0x7a5a3a, 0xe9e4da][i % 4]), undefined, x0 + 4 + (i % 5) * 1.1, 0, zEnd - 6 - Math.floor(i / 5) * 1.6, [0, (i * 1.3) % (Math.PI * 2), 0]);
    }
    kit.railZ(x0 + 3.5, 0.6, zEnd - 12, zEnd - 3);
    kit.tarp(x0 + D - 8, -zEnd + 10, 8, 9, 3.6, 0x2f6db5);
    kit.add(cowGeometry(0x2a2522, true), undefined, x0 + D - 8, 0, -zEnd + 10, [0, Math.PI / 2, 0], [1.25, 1.25, 1.25]);
    kit.tarp(x0 + 30, zEnd - 6, 12, 8, 3.8, 0xf28c28, 0x2f6db5);
    kit.tarp(x0 + 48, 4, 9, 14, 3.6, 0x3a8a4a);

    // hasil desk by the gate: striped awning, table, chairs, two men with the receipt book, a loudspeaker
    kit.tarp(x0 + 6, -2, 5, 4, 3.2, 0xffffff, 0xc1121f);
    kit.add(box(2.4, 0.8, 1), 0x8a5a33, x0 + 6, 0.4, -2);
    kit.add(box(2.5, 0.04, 1.1), 0x2a7a4a, x0 + 6, 0.82, -2);
    kit.person({ shirt: 0xf2f0ea, lower: 0x3a3a40, seated: true, cap: 0xf2f0ea }, x0 + 6.7, -1.1, Math.PI);
    kit.person({ shirt: 0x9ec3e6, lower: 0x3a3a40, seated: true }, x0 + 5.3, -1.1, Math.PI);
    kit.pole(x0 + 3.4, -4.2, 6.5, 0.07);
    kit.add(cone(0.35, 0.8, 8), 0xd6d6d2, x0 + 3.4, 6.1, -4.6, [-Math.PI / 2 - 0.3, 0, 0]);
    kit.add(cone(0.35, 0.8, 8), 0xd6d6d2, x0 + 3.0, 6.1, -4.2, [0, 0, Math.PI / 2 + 0.3]);
    const hasil = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshLambertMaterial({ map: signTexture(['হাসিল ঘর'], { bg: '#c1121f', fg: '#fff', w: 512, h: 128, sizes: [72] }), side: THREE.DoubleSide }));
    hasil.position.set(kit.k * (x0 + 6), 2.6, 0.05);
    site.group.add(hasil);

    // straw (khor) and cut grass for the animals, water drums
    for (let i = 0; i < 6; i++) kit.add(sph(1.3, 8, 5), i % 2 ? 0xd9b35a : 0xc9a24a, x0 + 18 + i * 6, 0.5, zEnd - 3, [0, 0, 0], [1.4, 0.8, 1.1]);
    for (let i = 0; i < 4; i++) kit.add(box(1.4, 0.5, 0.8), 0x5a8a3a, x0 + 42 + i * 1.6, 0.25, zEnd - 4);
    for (let i = 0; i < 3; i++) kit.add(cyl(0.35, 0.35, 0.9, 8), 0x2f6db5, x0 + 10 + i * 12, 0.45, -zEnd + 2);

    // buyers, sellers and dalals between the rows
    for (let i = 0; i < 30; i++) {
      const row = [x0 + 6, x0 + 18, x0 + 30, x0 + 42][i % 4];
      kit.person(BUYERS[i % BUYERS.length], row + ((i * 7) % 5) - 2, -zEnd + 8 + ((i * 23) % (L - 30)), ((i * 2.1) % 6.28) - 3.14, i);
    }
    // walkers in the aisles, cows led along the road shoulder
    for (let i = 0; i < 6; i++) {
      const ax = [x0 + 6, x0 + 18, x0 + 30, x0 + 42][i % 4] + (i > 3 ? 1.5 : 0);
      this.walker(site, buyerMesh(i + 3), [ax, -zEnd + 8], [ax, zEnd - 18], 1.1 + (i % 3) * 0.2, i / 6);
    }
    for (let i = 0; i < 2; i++) {
      const pair = new THREE.Group();
      pair.add(new THREE.Mesh(cowGeometry(i ? 0xa87a4f : 0xe9e4da, true), vertexColorMaterial()));
      const man = buyerMesh(i);
      man.position.set(0.7, 0, -1.6);
      pair.add(man);
      this.walker(site, pair, [site.hw + 1.8, -zEnd - 30], [site.hw + 1.8, zEnd + 20], 0.9, i * 0.5);
    }
  }

  // ---------------------------------------------------------------- waz mahfil

  private wazMahfil(site: Site, kit: Kit, x0: number): void {
    const { length: L, depth: D } = VILLAGE.wazMahfil;
    kit.add(box(D, 0.04, L), 0x7d9a48, x0 + D / 2, 0.025, 0);
    // the shamiana: patchwork cloth roof on a grid of bamboo poles, scalloped valance round the edge
    const px0 = x0 + 6;
    const px1 = x0 + D - 4;
    const pz0 = -L / 2 + 8;
    const pz1 = L / 2 - 14;
    const roofY = 6.4;
    const CLOTH = [0xc1121f, 0xffd166, 0x2a9d8f, 0xffffff, 0xf28c28, 0x1d6f42];
    const cell = 5;
    let c = 0;
    for (let x = px0; x < px1 - 0.1; x += cell) {
      for (let z = pz0; z < pz1 - 0.1; z += cell) {
        const w = Math.min(cell, px1 - x);
        const d = Math.min(cell, pz1 - z);
        kit.add(box(w, 0.08, d), CLOTH[(c++ * 5 + Math.floor(x)) % CLOTH.length], x + w / 2, roofY + Math.sin((x - px0) / (px1 - px0) * Math.PI) * 0.8, z + d / 2);
      }
    }
    for (let x = px0; x <= px1 + 0.1; x += 10) for (let z = pz0; z <= pz1 + 0.1; z += 10) kit.pole(Math.min(x, px1), Math.min(z, pz1), roofY + 0.4, 0.08);
    for (let x = px0; x < px1; x += 1.2) {
      for (const z of [pz0, pz1]) kit.add(box(1.1, 0.6, 0.05), CLOTH[Math.floor(x) % CLOTH.length], x + 0.6, roofY - 0.35, z);
    }
    for (let z = pz0; z < pz1; z += 1.2) {
      for (const x of [px0, px1]) kit.add(box(0.05, 0.6, 1.1), CLOTH[Math.floor(z + 40) % CLOTH.length], x, roofY - 0.35, z + 0.6);
    }

    // printed cloth walls (qanat) down the far side and across the back; the road side stays open
    for (let z = pz0; z < pz1 - 0.1; z += 2) kit.add(box(0.06, roofY - 0.4, 2), CLOTH[Math.floor(z / 2 + 40) % CLOTH.length], px1, (roofY - 0.4) / 2, z + 1);
    for (let x = px0 + 10; x < px1 - 0.1; x += 2) kit.add(box(2, roofY - 0.4, 0.06), CLOTH[Math.floor(x / 2) % CLOTH.length], x + 1, (roofY - 0.4) / 2, pz1);
    for (let z = pz0; z < pz1 - 0.1; z += 2) kit.add(box(0.07, 0.5, 2), 0xffd166, px1, 1.3 + (Math.floor(z / 2) % 2) * 2.2, z + 1);

    // stage at the front with a carpet, a backdrop, a lectern and the speakers on their chairs
    const sx = (px0 + px1) / 2;
    const sz = pz0 + 5;
    kit.add(box(16, 1.2, 7), 0x6b2a2a, sx, 0.6, sz);
    kit.add(box(16.2, 0.06, 7.2), 0x2e7d32, sx, 1.23, sz);
    kit.add(box(16.4, 0.4, 0.06), 0xffd166, sx, 1.0, sz + 3.53);
    kit.add(box(17, 5, 0.2), 0x1d3557, sx, 3.7, sz - 3.6);
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 3),
      new THREE.MeshLambertMaterial({ map: signTexture(['তাফসিরুল কুরআন মাহফিল', 'সকলকে দাওয়াত'], { bg: '#1d3557', fg: '#ffd166', border: '#2a9d8f', w: 1024, h: 220, sizes: [84, 46] }), side: THREE.DoubleSide }),
    );
    backdrop.position.set(kit.k * sx, 4.3, sz - 3.45);
    site.group.add(backdrop);
    for (let i = 0; i < 5; i++) {
      kit.add(box(0.9, 0.5, 0.8), 0xf2e6c9, sx - 5 + i * 2.5, 1.5, sz - 2.2);
      kit.person({ shirt: 0xf6f4ee, lower: 0xf6f4ee, seated: true, cap: 0xffffff, beard: true }, sx - 5 + i * 2.5, sz - 1.9, Math.PI);
    }
    kit.add(box(1.0, 1.1, 0.6), 0x8a5a33, sx, 1.8, sz + 1.6);
    kit.add(cyl(0.015, 0.015, 0.5, 4), 0x222222, sx, 2.6, sz + 1.5);
    kit.person({ shirt: 0xf6f4ee, lower: 0xf6f4ee, cap: 0xffffff, beard: true }, sx, sz + 0.9, Math.PI);

    // listeners in rows on mats, facing the stage (-z)
    for (let r = 0; r < 9; r++) {
      const z = sz + 6 + r * 3.2;
      kit.add(box(px1 - px0 - 4, 0.03, 2.8), r % 2 ? 0x2f6db5 : 0xa3222a, sx, 0.05, z);
      for (let i = 0; i < 12; i++) {
        if ((r * 12 + i) % 7 === 3) continue;
        const shirt = [0xf6f4ee, 0xf2f0ea, 0xe8e4d8, 0x9ec3e6][(r + i) % 4];
        kit.person({ shirt, lower: 0x3b5d8f, seated: true, cap: (r + i) % 3 ? 0xffffff : undefined, beard: (r * i) % 4 === 1 }, px0 + 3 + i * ((px1 - px0 - 6) / 11), z, 0, r + i);
      }
    }
    // people still arriving, tea and jilapi stalls by the gate
    gate(kit, site.group, x0 + 0.8, L / 2 - 8, 10, ['বার্ষিক ওয়াজ মাহফিল', 'আজ বাদ আসর থেকে'], '#1d6f42', '#ffffff', [80, 44]);
    kit.tarp(x0 + 6, L / 2 - 3, 4, 3, 2.8, 0xf28c28);
    kit.tarp(x0 + 12, L / 2 - 3, 4, 3, 2.8, 0x2f6db5);
    for (const [x, z] of [[x0 + 6, L / 2 - 3], [x0 + 12, L / 2 - 3]]) {
      kit.add(box(2.6, 0.8, 1.2), 0x8a5a33, x, 0.4, z);
      kit.add(cyl(0.45, 0.35, 0.2, 10), 0x333333, x - 0.6, 0.9, z);
    }
    for (let i = 0; i < 4; i++) {
      this.walker(site, buyerMesh(i, { shirt: 0xf6f4ee, lower: 0x3b5d8f, lungi: true, cap: 0xffffff }), [site.hw + 2.2, L / 2 + 40 + i * 12], [x0 + 10, L / 2 - 10], 1.0 + i * 0.1, i / 4);
    }

    // horn loudspeakers on tall bamboo down the road both ways, and on the pandal corners
    for (let z = -L / 2 - 180; z <= L / 2 + 180; z += 45) {
      const x = site.hw + 2.6;
      kit.pole(x, z, 8, 0.07);
      for (const dir of [-1, 1]) kit.add(cone(0.32, 0.75, 8), 0xd6d6d2, x, 7.6, z + dir * 0.45, [dir * (Math.PI / 2 - 0.15), 0, 0]);
    }
    for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) kit.add(cone(0.32, 0.75, 8), 0xd6d6d2, x, roofY + 0.2, z, [Math.PI / 2, 0, 0]);

    // string lights along the valance, the stage and the poles to the road
    const pts: number[] = [];
    const cols: number[] = [];
    const BULBS = [0xff3b3b, 0x3bff6a, 0x3b8bff, 0xffe03b, 0xffffff, 0xff7a2a];
    const bulb = (x: number, y: number, z: number, i: number) => {
      pts.push(kit.k * x, y, z);
      cols.push(...new THREE.Color(BULBS[i % BULBS.length]).toArray());
    };
    let b = 0;
    for (let x = px0; x <= px1; x += 0.8) for (const z of [pz0, pz1]) bulb(x, roofY - 0.7, z, b++);
    for (let z = pz0; z <= pz1; z += 0.8) for (const x of [px0, px1]) bulb(x, roofY - 0.7, z, b++);
    for (let x = sx - 8; x <= sx + 8; x += 0.5) bulb(x, 6.1, sz - 3.5, b++);
    for (let z = -L / 2 - 180; z <= L / 2 + 180; z += 1.5) bulb(site.hw + 2.6, 6.4 - Math.abs(Math.sin(z / 45 * Math.PI)) * 1.2, z, b++);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    site.lights = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false });
    site.group.add(new THREE.Points(geo, site.lights));
    // tube lights under the roof
    for (let x = px0 + 5; x < px1; x += 10) {
      for (let z = pz0 + 5; z < pz1; z += 10) {
        const tube = new THREE.Mesh(cached('tube', () => new THREE.BoxGeometry(1.2, 0.08, 0.08)), new THREE.MeshBasicMaterial({ color: 0xf4fbff }));
        tube.position.set(kit.k * x, roofY - 0.3, z);
        site.group.add(tube);
      }
    }
  }

  // ---------------------------------------------------------------- football

  private football(site: Site, kit: Kit, x0: number): void {
    const { length: L, depth: D } = VILLAGE.football;
    const cx = x0 + D / 2;
    const hz = L / 2 - 6;
    kit.add(box(D - 2, 0.04, L - 4), 0x6fae3f, cx, 0.025, 0);
    // worn bare earth in the goalmouths and the centre
    for (const z of [-hz + 3, hz - 3, 0]) kit.add(box(z ? 10 : 8, 0.05, z ? 7 : 8), 0x9b8a5a, cx, 0.03, z);
    // bamboo goals at both ends (posts, crossbar, the net's back frame)
    for (const z of [-hz, hz]) {
      const back = z < 0 ? -1.4 : 1.4;
      for (const dx of [-3, 3]) {
        kit.pole(cx + dx, z, 2.3, 0.07);
        kit.pole(cx + dx, z + back, 1.5, 0.04);
        kit.add(cyl(0.03, 0.03, Math.hypot(1.4, 0.8), 4), 0xdddddd, cx + dx, 1.9, z + back / 2, [Math.sign(back) * 1.05, 0, 0]);
      }
      kit.railX(cx - 3, cx + 3, 2.3, z, 0.07);
      kit.add(box(6, 1.5, 0.03), 0xe8e8e8, cx, 0.75, z + back);
    }
    // spectators along the road side, a couple of cows grazing at the far corner
    for (let i = 0; i < 12; i++) kit.person({ ...BUYERS[i % BUYERS.length], seated: i % 3 !== 0 }, x0 + 1.5 + (i % 2) * 0.8, -hz + 8 + i * 5, -Math.PI / 2, i);
    kit.add(cowGeometry(0xe9e4da, false), undefined, x0 + D - 3, 0, hz + 1, [0, 0.8, 0]);
    kit.add(cowGeometry(0xa87a4f, false), undefined, x0 + D - 6, 0, hz + 2.5, [0, 2.3, 0]);

    // two teams: sky-blue and white stripes (Argentina fans) and yellow with green shorts (Brazil fans)
    const kits: Look[] = [
      { shirt: 0x75aadb, stripes: 0xffffff, lower: 0x1d1d1d },
      { shirt: 0xf7d117, lower: 0x1b7a3d },
    ];
    for (let team = 0 as 0 | 1; team < 2; team++) {
      const own = team === 0 ? -hz : hz;
      const homes: [number, number][] = [[cx, own * 0.95], [cx - 10, own * 0.6], [cx + 10, own * 0.6], [cx, own * 0.45], [cx - 7, own * 0.15], [cx + 7, own * 0.15], [cx, -own * 0.1]];
      homes.forEach((home, i) => {
        const keeper = i === 0;
        const look = keeper ? { shirt: team ? 0xf28c28 : 0x2a2a2a, lower: 0x1d1d1d } : kits[team];
        const mesh = new THREE.Mesh(personGeometry({ ...look, skin: SKINS[(i + team) % 4] }), vertexColorMaterial());
        mesh.scale.setScalar(0.95);
        site.group.add(mesh);
        site.players.push(mesh);
        site.footballers.push({ mesh, team, home, x: home[0], z: home[1], keeper });
      });
    }
    site.ball = new THREE.Mesh(cached('football', () => buildColored([{ geo: sph(0.17, 8, 6), color: 0xf4f4f4 }])), vertexColorMaterial());
    site.ball.position.set(kit.k * cx, 0.17, 0);
    site.group.add(site.ball);
    site.players.push(site.ball);
    site.field = { x: cx, z: 0, hx: D / 2 - 3, hz };
  }

  // ---------------------------------------------------------------- cricket

  private cricketField(site: Site, kit: Kit, x0: number): void {
    const { length: L, depth: D } = VILLAGE.cricket;
    const cx = x0 + D / 2;
    kit.add(box(D - 2, 0.04, L - 4), 0x78b043, cx, 0.025, 0);
    // the pitch with its creases and stumps at both ends
    kit.add(box(3, 0.05, 22), 0xc9b07a, cx, 0.04, 0);
    for (const z of [-11, 11]) {
      kit.add(box(3, 0.06, 0.08), 0xffffff, cx, 0.05, z - Math.sign(z) * 1.2);
      for (const dx of [-0.11, 0, 0.11]) kit.add(cyl(0.02, 0.02, 0.72, 4), 0xf0e6c8, cx + dx, 0.36, z);
      kit.add(box(0.26, 0.03, 0.03), 0xf0e6c8, cx, 0.73, z);
    }
    // the boundary marked with a rope of bricks, spectators and a tea stall by the road
    for (let a = 0; a < Math.PI * 2; a += 0.12) kit.add(box(0.5, 0.12, 0.25), 0xb5482d, cx + Math.cos(a) * (D / 2 - 3), 0.06, Math.sin(a) * (L / 2 - 4), [0, -a, 0]);
    for (let i = 0; i < 10; i++) kit.person({ ...BUYERS[(i + 2) % BUYERS.length], seated: i % 2 === 0 }, x0 + 1.2, -L / 2 + 14 + i * 6, -Math.PI / 2, i + 4);
    kit.tarp(x0 + 2.5, L / 2 - 5, 3.5, 3, 2.6, 0x2f6db5);

    const mesh = (look: Look, i: number) => {
      const m = new THREE.Mesh(personGeometry({ ...look, skin: SKINS[i % 4] }), vertexColorMaterial());
      m.scale.setScalar(0.95);
      site.group.add(m);
      site.players.push(m);
      return m;
    };
    const batting: Look = { shirt: 0xf6f4ee, lower: 0x3a3a40 };
    const fielding: Look = { shirt: 0x1d6f42, lower: 0x3a3a40 };
    const bowler = mesh({ shirt: 0x1d6f42, lower: 0x3a3a40, cap: 0xc1121f }, 1);
    const striker = mesh(batting, 2);
    const bat = new THREE.Mesh(cached('cricketBat', () => buildColored([{ geo: box(0.1, 0.85, 0.04), color: 0xd9b36a, p: [0, -0.45, 0] }, { geo: cyl(0.025, 0.025, 0.25, 4), color: 0x222222, p: [0, 0.08, 0] }])), vertexColorMaterial());
    bat.position.set(0.35, 1.0, -0.15);
    striker.add(bat);
    const nonStriker = mesh(batting, 3);
    const keeper = mesh(fielding, 4);
    const fielders = [[-12, -18], [12, -16], [-17, 2], [17, 4], [-9, 20], [10, 22], [0, -30]].map(([dx, dz], i) => {
      const f = mesh(fielding, 5 + i);
      return { mesh: f, home: [cx + dx, dz] as [number, number] };
    });
    site.ball = new THREE.Mesh(cached('cricketBall', () => buildColored([{ geo: sph(0.12, 6, 5), color: 0xf2f2f2 }])), vertexColorMaterial());
    site.group.add(site.ball);
    site.players.push(site.ball);
    site.cricket = { bowler, striker, bat, nonStriker, keeper, fielders, t: 0, hit: false, shot: new THREE.Vector3(), chaser: 0 };
    site.field = { x: cx, z: 0, hx: D / 2 - 3, hz: L / 2 - 4 };
  }

  // ---------------------------------------------------------------- helpers

  private walker(site: Site, mesh: THREE.Object3D, a: [number, number], b: [number, number], speed: number, u: number): void {
    site.group.add(mesh);
    site.walkers.push({ mesh, a, b, speed, u, dir: 1 });
  }

  /** place a figure at (x, z) in the site frame, facing along (dx, dz) */
  private put(site: Site, o: THREE.Object3D, x: number, z: number, dx: number, dz: number, bob = 0): void {
    o.position.set(site.k * x, bob, z);
    if (dx || dz) o.rotation.y = Math.atan2(-site.k * dx, -dz);
  }

  // ---------------------------------------------------------------- update

  /**
   * night = how dim it is (the headlight level: dusk, rain and storms count) for the lights;
   * stars = how dark the sky is (only real night has stars) for sending the players home.
   */
  update(dt: number, night: number, stars: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    const driving = g.state.phase === 'HIGHWAY' || g.state.phase === 'FARM';
    for (const site of this.sites) {
      const { s } = site.sight;
      const cfg = VILLAGE[site.sight.kind];
      const rel = s - tr.s;
      site.group.visible = rel > -cfg.length / 2 - 120 && rel < 700;
      // the players go home once it's properly night (rain doesn't stop a village match); the lights come on
      const dark = stars > 0.5;
      for (const p of site.players) p.visible = !dark;
      // string lights only show once it gets dark
      if (site.lights) site.lights.opacity = Math.max(0, night - 0.1) * 1.1;
      if (!site.group.visible) {
        if (site.voice) {
          site.voice.stop();
          site.voice = null;
        }
        continue;
      }
      for (const w of site.walkers) this.walk(site, w, dt);
      if (!dark && site.ball && site.footballers.length) this.playFootball(site, dt);
      if (!dark && site.cricket) this.playCricket(site, dt);
      this.sounds(site, dt, Math.abs(rel), driving, night);
    }
  }

  private walk(site: Site, w: Walker, dt: number): void {
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    w.u += (w.dir * w.speed * dt) / len;
    if (w.u > 1 || w.u < 0) {
      w.dir = w.dir > 0 ? -1 : 1;
      w.u = Math.min(1, Math.max(0, w.u));
    }
    const x = w.a[0] + (w.b[0] - w.a[0]) * w.u;
    const z = w.a[1] + (w.b[1] - w.a[1]) * w.u;
    this.put(site, w.mesh, x, z, (w.b[0] - w.a[0]) * w.dir, (w.b[1] - w.a[1]) * w.dir, Math.abs(Math.sin(this.t * 7 + w.u * 30)) * 0.05);
  }

  private playFootball(site: Site, dt: number): void {
    const ball = site.ball!;
    const f = site.field;
    const bx = ball.position.x * site.k;
    const bz = ball.position.z;
    // the ball rolls and slows; a lofted ball falls back down
    const v = site.ballV;
    let x = bx + v.x * dt;
    let z = bz + v.z * dt;
    let y = ball.position.y + v.y * dt;
    v.y -= 9.8 * dt;
    if (y <= 0.17) {
      y = 0.17;
      v.y = Math.abs(v.y) > 2 ? -v.y * 0.4 : 0;
      v.x *= 1 - 1.1 * dt;
      v.z *= 1 - 1.1 * dt;
    }
    // a goal: back to the centre spot
    if (Math.abs(z - f.z) > f.hz && Math.abs(x - f.x) < 3 && y < 2.3) {
      x = f.x;
      z = f.z;
      v.set(0, 0, 0);
      if (Math.abs(site.sight.s - this.game.truck.s) < VILLAGE.hearing) this.game.sound.crowd(1.2);
    }
    // the edges of the field: bounce back in (no throw-ins in the village)
    if (Math.abs(x - f.x) > f.hx) {
      x = f.x + Math.sign(x - f.x) * f.hx;
      v.x = -v.x * 0.5;
    }
    if (Math.abs(z - f.z) > f.hz + 1) {
      z = f.z + Math.sign(z - f.z) * (f.hz + 1);
      v.z = -v.z * 0.5;
    }
    ball.position.set(site.k * x, y, z);
    site.kickCooldown -= dt;

    // nearest two of each side chase it, the rest drift with play, keepers stay home
    for (const team of [0, 1] as const) {
      const squad = site.footballers.filter((p) => p.team === team && !p.keeper);
      const byDist = [...squad].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
      for (const p of squad) {
        const chase = byDist.indexOf(p) < 2;
        const tx = chase ? x : p.home[0] + (x - f.x) * 0.4;
        const tz = chase ? z : p.home[1] + (z - f.z) * 0.5;
        this.runTo(site, p, tx, tz, chase ? 5.5 : 3, dt);
        if (chase && site.kickCooldown <= 0 && Math.hypot(p.x - x, p.z - z) < 0.7) this.kick(site, p, x, z);
      }
      const keeper = site.footballers.find((p) => p.team === team && p.keeper)!;
      this.runTo(site, keeper, f.x + Math.max(-2.5, Math.min(2.5, x - f.x)), keeper.home[1], 3, dt);
      if (site.kickCooldown <= 0 && Math.hypot(keeper.x - x, keeper.z - z) < 1.2) this.kick(site, keeper, x, z);
    }
  }

  private runTo(site: Site, p: Footballer, tx: number, tz: number, speed: number, dt: number): void {
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.3) {
      const step = Math.min(d, speed * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
    }
    const lookX = d > 0.3 ? dx : (site.ball!.position.x * site.k) - p.x;
    const lookZ = d > 0.3 ? dz : site.ball!.position.z - p.z;
    this.put(site, p.mesh, p.x, p.z, lookX, lookZ, d > 0.3 ? Math.abs(Math.sin(this.t * 12 + p.home[0])) * 0.12 : 0);
  }

  private kick(site: Site, p: Footballer, x: number, z: number): void {
    const f = site.field;
    const goal = p.team === 0 ? f.z + f.hz : f.z - f.hz;
    const aimX = f.x + (Math.random() - 0.5) * 16;
    const dx = aimX - x;
    const dz = goal - z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = p.keeper ? 16 : 7 + Math.random() * 8;
    site.ballV.set((dx / d) * speed, Math.random() < 0.3 || p.keeper ? 4 + Math.random() * 4 : 0, (dz / d) * speed);
    site.kickCooldown = 0.6;
  }

  private playCricket(site: Site, dt: number): void {
    const c = site.cricket!;
    const ball = site.ball!;
    const f = site.field;
    const cx = f.x;
    c.t += dt;
    const t = c.t;
    const RUN = 1.8;
    const FLIGHT = 0.55;
    // striker at the near-truck end (+z) facing the bowler, wicketkeeper behind him
    const strikerZ = 9.9;
    this.put(site, c.striker, cx + 0.3, strikerZ, 0, -1);
    this.put(site, c.keeper, cx + 0.2, 13.5, 0, -1);
    if (t < RUN) {
      // run-up from deep behind the far stumps
      const u = t / RUN;
      this.put(site, c.bowler, cx - 0.4, -24 + u * 13, 0, 1, Math.abs(Math.sin(t * 13)) * 0.12);
      this.put(site, c.nonStriker, cx - 1.2, -10.5, 0, 1);
      ball.position.set(site.k * (cx - 0.4), 1.2, -24 + u * 13);
      c.bat.rotation.x = 0.3;
      c.hit = Math.random() < 0.72;
    } else if (t < RUN + FLIGHT) {
      // the delivery, pitching short of the batter
      const u = (t - RUN) / FLIGHT;
      const z = -10.5 + u * (strikerZ - 0.4 + 10.5);
      const y = u < 0.7 ? 2.1 - (2.1 / 0.7) * u : ((u - 0.7) / 0.3) * 0.7;
      ball.position.set(site.k * cx, Math.max(0.08, y), z);
      c.bat.rotation.x = 0.3 - Math.max(0, u - 0.6) * 4;
      if (u > 0.9 && c.hit && c.shot.lengthSq() === 0) {
        // the shot: anywhere in front of square, sometimes in the air
        const a = (Math.random() - 0.5) * Math.PI * 1.3;
        const power = 14 + Math.random() * 14;
        c.shot.set(Math.sin(a) * power, Math.random() < 0.4 ? 6 + Math.random() * 6 : 1, -Math.cos(a) * power);
        const near = Math.abs(site.sight.s - this.game.truck.s) < VILLAGE.hearing;
        if (near) this.game.sound.bat(0.8);
        // the fielder nearest to where it's going
        const land = [cx + c.shot.x * 1.6, strikerZ + c.shot.z * 1.6];
        c.chaser = c.fielders.reduce((best, fl, i) => (Math.hypot(fl.home[0] - land[0], fl.home[1] - land[1]) < Math.hypot(c.fielders[best].home[0] - land[0], c.fielders[best].home[1] - land[1]) ? i : best), 0);
      }
    } else if (t < RUN + FLIGHT + 3.2) {
      const u = t - RUN - FLIGHT;
      if (c.hit) {
        // the ball flies or runs out, slowing, and the fielder runs it down; the batters run
        const k = 1 - Math.exp(-u * 0.9);
        const bx = cx + c.shot.x * 1.8 * k;
        const bz = strikerZ + c.shot.z * 1.8 * k;
        const by = Math.max(0.1, 1 + c.shot.y * u - 4.9 * u * u);
        ball.position.set(site.k * Math.max(f.x - f.hx, Math.min(f.x + f.hx, bx)), by, Math.max(-f.hz, Math.min(f.hz, bz)));
        const fl = c.fielders[c.chaser];
        const fx = fl.home[0] + (bx - fl.home[0]) * Math.min(1, u / 2.6);
        const fz = fl.home[1] + (bz - fl.home[1]) * Math.min(1, u / 2.6);
        this.put(site, fl.mesh, fx, fz, bx - fl.home[0], bz - fl.home[1], Math.abs(Math.sin(t * 12)) * 0.12);
        const run = Math.min(1, u / 2.2);
        this.put(site, c.nonStriker, cx - 1.2, -10.5 + run * 20, 0, 1, Math.abs(Math.sin(t * 12)) * 0.1);
        c.bat.rotation.x = -1.4 + u * 0.5;
      } else {
        // missed: into the keeper's gloves
        const u2 = Math.min(1, u / 0.25);
        ball.position.set(site.k * (cx + 0.2), 0.9, strikerZ + u2 * 3.4);
      }
    } else {
      c.t = 0;
      c.shot.set(0, 0, 0);
      c.bat.rotation.x = 0.3;
    }
    for (const [i, fl] of c.fielders.entries()) if (!(c.hit && i === c.chaser && t > RUN + FLIGHT)) this.put(site, fl.mesh, fl.home[0], fl.home[1], cx - fl.home[0], -fl.home[1]);
  }

  private sounds(site: Site, dt: number, dist: number, driving: boolean, night: number): void {
    const g = this.game;
    const hear = driving && !g.state.paused && dist < VILLAGE.hearing;
    const vol = hear ? Math.max(0, 1 - dist / VILLAGE.hearing) : 0;
    if (site.sight.kind === 'wazMahfil') {
      // the loudspeakers carry the sermon a long way, louder after dark
      if (hear && !site.voice) site.voice = g.sound.mahfilVoice();
      if (site.voice) {
        site.voice.set(vol * (0.7 + 0.3 * night), 1);
        if (!hear) {
          site.voice.stop();
          site.voice = null;
        }
      }
    } else if (hear) {
      site.soundTimer -= dt;
      if (site.soundTimer <= 0) {
        if (site.sight.kind === 'gorurHat') {
          g.sound.moo(vol);
          site.soundTimer = 1.5 + Math.random() * 3;
        } else {
          site.soundTimer = 6 + Math.random() * 6;
          if (site.sight.kind === 'football' && night < 0.55) g.sound.crowd(0.6 * vol + 0.2);
        }
      }
    }
    if (!site.warned && driving && g.state.phase === 'HIGHWAY' && site.sight.s - g.truck.s < 220 && site.sight.s - g.truck.s > 0) {
      site.warned = true;
      if (site.sight.kind === 'gorurHat') g.hud.toast('{warning} সামনে গরুর হাট — রাস্তার পাশে গরু-মানুষ, সাবধানে!', 3);
      if (site.sight.kind === 'wazMahfil') g.hud.toast('{horn} মাইকে ওয়াজ শোনা যাচ্ছে — সামনে ওয়াজ মাহফিল', 3);
    }
  }
}

function buyerMesh(i: number, look: Look = BUYERS[i % BUYERS.length]): THREE.Mesh {
  return new THREE.Mesh(personGeometry(look, i), vertexColorMaterial());
}
