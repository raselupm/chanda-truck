// Speed-limited stretches: bazaars, schools and the market approach.
// Signs + (for schools) a school building, playing kids behind a wall and a zebra crossing.
// Each zone has a speed camera: drive past it over the limit and the fine is taken automatically.

import * as THREE from 'three';
import type { SlowZone } from '../config/route';
import { ROAD, SLOW_ZONES } from '../config/tuning';
import type { Game } from '../game/Game';
import { box, buildColored, cached, cyl, vertexColorMaterial } from '../utils/geometry';
import { toBnDigits } from '../utils/bnNumber';
import { signTexture, speedSignTexture } from '../utils/textures';
import { makePerson } from './People';
import { signPost } from './SetPiece';

const ZONE_INFO: Record<SlowZone['kind'], { icon: string; enterBn: string; signLines: string[]; bg: string; lines: string[] }> = {
  school: {
    icon: '{school}',
    enterBn: 'স্কুল এলাকা — ধীরে চলুন',
    signLines: ['{school} সামনে স্কুল', 'ধীরে চলুন'],
    bg: '#ffd23f',
    lines: [
      'আস্তে! স্কুলের বাচ্চারা রাস্তা পার হয়।',
      'স্কুল এলাকা — এখানে রেস নয়, ক্লাস হয়।',
      'হেডস্যার দেখলে কান ধরে ওঠবস করাবে!',
    ],
  },
  bazar: {
    icon: '{cart}',
    enterBn: 'বাজার এলাকা — ধীরে চলুন',
    signLines: ['{cart} বাজার এলাকা', 'ধীরে চলুন'],
    bg: '#ffffff',
    lines: [
      'বাজারে ধীরে! মুরগিও আপনার চেয়ে ধীরে দৌড়ায়।',
      'রিকশা, ভ্যান, মানুষ, ছাগল — সবাই আছে। আস্তে!',
      'দাম দৌড়াক, আপনি না।',
    ],
  },
  market: {
    icon: '{cabbage}',
    enterBn: 'কাঁচাবাজার এলাকা — ধীরে চলুন',
    signLines: ['{cabbage} কাওরান বাজার এলাকা', 'ধীরে চলুন'],
    bg: '#ffffff',
    lines: ['কাঁচাবাজার — এখানে দাম দৌড়ায়, গাড়ি না।', 'আস্তে! টমেটোর ঝুড়ি মাথায় লোক যাচ্ছে।'],
  },
};

function schoolGeometry(): THREE.BufferGeometry {
  return cached('school', () =>
    buildColored([
      { geo: box(18, 4, 7), color: 0xf2d16b, p: [0, 2, 0] },
      { geo: box(18.6, 0.3, 7.6), color: 0xb5482d, p: [0, 4.15, 0] },
      { geo: box(18, 0.6, 0.1), color: 0x2a6f4a, p: [0, 3.5, -3.56] },
      ...[-6, -2, 2, 6].map((x) => ({ geo: box(1.6, 1.4, 0.08), color: 0x3a5a7a, p: [x, 2.1, -3.55] as [number, number, number] })),
      { geo: box(1.4, 2.4, 0.08), color: 0x6b4a2a, p: [0, 1.2, -3.55] },
      // boundary wall in front of the yard
      { geo: box(24, 1.2, 0.3), color: 0xd8d2c4, p: [0, 0.6, -10] },
      // flag pole with the national flag
      { geo: cyl(0.06, 0.06, 6, 5), color: 0xcccccc, p: [-10, 3, -6] },
      { geo: box(0.05, 1.0, 1.6), color: 0x006a4e, p: [-10, 5.4, -6.85] },
      { geo: cyl(0.3, 0.3, 0.07, 12), color: 0xf42a41, p: [-9.97, 5.4, -6.9], r: [0, 0, Math.PI / 2] },
    ]),
  );
}

/** Roadside pole with an arm out over the road edge and a camera facing the approaching traffic (+z). */
function speedCamera(): { group: THREE.Group; lamp: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    cached('speedcam', () =>
      buildColored([
        { geo: cyl(0.1, 0.12, 5.4, 6), color: 0x8a8a8a, p: [0, 2.7, 0] },
        { geo: box(1.8, 0.12, 0.12), color: 0x8a8a8a, p: [0.9, 5.2, 0] },
        { geo: box(0.5, 0.42, 0.8), color: 0xe8e8e8, p: [1.6, 4.9, 0] },
        { geo: box(0.3, 0.3, 0.06), color: 0x1d1d1d, p: [1.6, 4.88, 0.42] },
        { geo: box(1.0, 0.7, 0.06), color: 0x1d3557, p: [0, 3.2, 0.12] },
      ]),
    ),
    vertexColorMaterial(),
  ));
  // the flash
  const lamp = new THREE.MeshBasicMaterial({ color: 0x444444 });
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), lamp);
  flash.position.set(1.6, 5.2, 0.42);
  group.add(flash);
  return { group, lamp };
}

interface ZoneObj {
  zone: SlowZone;
  group: THREE.Group;
  kids: THREE.Mesh[];
  /** where the camera checks the speed */
  camS: number;
  lamp: THREE.MeshBasicMaterial;
  flash: number;
  fined: boolean;
}

export class SlowZones {
  readonly group = new THREE.Group();
  private zones: ZoneObj[] = [];
  private inside: SlowZone | null = null;
  private warnCooldown = 0;
  private t = 0;
  private lastFront = -Infinity;

  constructor(private game: Game) {}

  build(zones: SlowZone[]): void {
    for (const z of this.zones) this.group.remove(z.group);
    this.zones = [];
    this.inside = null;
    this.lastFront = -Infinity;
    const track = this.game.track;
    for (const zone of zones) {
      const g = new THREE.Group();
      const info = ZONE_INFO[zone.kind];
      const hw = track.halfWidth(zone.from);
      const kids: THREE.Mesh[] = [];
      const at = (s: number, d: number, y = 0) => track.point(s, d, new THREE.Vector3(), y);

      // Entry signs on both sides: warning board + speed limit
      for (const side of [-1, 1]) {
        const warn = signPost(signTexture(info.signLines, { bg: info.bg, fg: '#1d1d1d', border: '#c1121f', sizes: [56, 44] }), 2.8, 1.4, 2.2);
        warn.position.copy(at(zone.from - 60, side * (hw + 3.2), ROAD.top));
        warn.rotation.y = -side * 0.3;
        const limit = signPost(speedSignTexture(zone.limitKmh), 1.2, 1.2, 2.2);
        limit.position.copy(at(zone.from - 40, side * (hw + 3.0), ROAD.top));
        limit.rotation.y = -side * 0.3;
        g.add(warn, limit);
      }
      const end = signPost(signTexture(['ধন্যবাদ', 'আবার আসবেন'], { bg: '#2d6a4f', fg: '#ffffff', sizes: [48, 36] }), 2.2, 1.1, 2.2);
      end.position.copy(at(zone.to + 5, -(hw + 3.2), ROAD.top));
      g.add(end);

      if (zone.kind === 'school') {
        const mid = (zone.from + zone.to) / 2;
        const side = zone.side;
        const sd = side * (hw + 24);
        track.propBlocks.push({ from: mid - 25, to: mid + 25, dMin: Math.min(sd - 16, sd + 16), dMax: Math.max(sd - 16, sd + 16) });
        const school = new THREE.Mesh(schoolGeometry(), vertexColorMaterial());
        school.position.copy(at(mid, sd));
        school.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(school);
        const name = signPost(signTexture(['সরকারি প্রাথমিক বিদ্যালয়', 'মন দিয়ে পড়ো, ধীরে গাড়ি চালাও'], { bg: '#2a6f4a', fg: '#fff', border: '#ffd23f', sizes: [48, 30] }), 4, 1.3, 2.4);
        name.position.copy(at(mid - 14, side * (hw + 6), ROAD.top));
        name.rotation.y = -side * 0.5;
        g.add(name);
        // kids playing in the yard, safely behind the wall
        for (let i = 0; i < 9; i++) {
          const kid = makePerson(i % 3 === 0 ? 'farmer' : 'trader', 30 + i);
          kid.scale.setScalar(0.62);
          kid.position.copy(at(mid - 9 + i * 2.2, side * (hw + 15.5 + (i % 3) * 1.4)));
          kid.userData.phase = i * 1.3;
          kids.push(kid);
          g.add(kid);
        }
        // zebra crossing
        const stripes = new THREE.Mesh(
          buildColored(Array.from({ length: 9 }, (_, i) => ({ geo: box(0.6, 0.03, 3.2), color: 0xf2f2f2, p: [-hw + 0.9 + i * ((2 * hw - 1.8) / 8), 0, 0] as [number, number, number] }))),
          vertexColorMaterial(),
        );
        stripes.position.copy(at(mid, 0, ROAD.top + 0.02));
        g.add(stripes);
      }
      // speed camera on the left, mid-zone (before the zebra crossing at a school), and a sign for it
      const camS = zone.kind === 'school' ? (zone.from + zone.to) / 2 - 35 : (zone.from + zone.to) / 2;
      const cam = speedCamera();
      cam.group.position.copy(at(camS, -(hw + 2.4), ROAD.top));
      g.add(cam.group);
      const camSign = signPost(signTexture(['{camera} স্পিড ক্যামেরা', `সর্বোচ্চ ${toBnDigits(zone.limitKmh)} কিমি/ঘণ্টা`], { bg: '#1d3557', fg: '#ffffff', border: '#ffd23f', sizes: [52, 40] }), 2.8, 1.4, 2.2);
      camSign.position.copy(at(zone.from - 15, -(hw + 3.2), ROAD.top));
      camSign.rotation.y = 0.3;
      g.add(camSign);
      this.group.add(g);
      this.zones.push({ zone, group: g, kids, camS, lamp: cam.lamp, flash: 0, fined: false });
    }
  }

  /** Current zone the truck's front is in (for the HUD badge). */
  get current(): SlowZone | null {
    return this.inside;
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.game;
    const tr = g.truck;
    let now: SlowZone | null = null;
    for (const z of this.zones) {
      z.group.visible = tr.s > z.zone.from - 650 && tr.s < z.zone.to + 150;
      if (tr.frontS >= z.zone.from && tr.frontS <= z.zone.to && !tr.road) now = z.zone;
      if (z.group.visible) for (const k of z.kids) k.position.y = Math.max(0, Math.sin(this.t * 6 + k.userData.phase)) * 0.35;
    }
    // speed cameras: one fine per camera, when the truck's front passes it too fast
    const front = tr.frontS;
    for (const z of this.zones) {
      if (z.flash > 0 && (z.flash -= dt) <= 0) z.lamp.color.set(0x444444);
      const passing = this.lastFront < z.camS && front >= z.camS && front - this.lastFront < 10;
      if (!passing || z.fined || g.state.phase !== 'HIGHWAY' || g.modal || tr.road) continue;
      if (tr.kmh > z.zone.limitKmh + SLOW_ZONES.tolerance) {
        z.fined = true;
        z.flash = 0.25;
        z.lamp.color.set(0xffffff);
        g.speedFine(tr.kmh, z.zone.limitKmh, ZONE_INFO[z.zone.kind].enterBn.split(' — ')[0]);
      }
    }
    this.lastFront = front;
    if (g.state.phase !== 'HIGHWAY') {
      this.inside = null;
      return;
    }
    const info = now ? ZONE_INFO[now.kind] : null;
    if (now && now !== this.inside && info) g.hud.warn(`${info.icon} ${info.enterBn} — সর্বোচ্চ ${toBnDigits(now.limitKmh)} কিমি/ঘণ্টা`, 'info', 3);
    this.inside = now;
    this.warnCooldown -= dt;
    if (now && info && Math.abs(tr.kmh) > now.limitKmh + SLOW_ZONES.tolerance && this.warnCooldown <= 0 && !g.chase.active && !g.modal) {
      this.warnCooldown = 5;
      g.hud.warn(`{turtle} ধীরে! ${info.lines[Math.floor(Math.random() * info.lines.length)]}`, 'danger', 2.8);
      g.sound.beep();
    }
  }
}

