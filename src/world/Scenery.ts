// Deterministic, chunk-based roadside scenery drawn with InstancedMesh (one draw call per prop kind).

import * as THREE from 'three';
import { ROAD } from '../config/tuning';
import { vertexColorMaterial } from '../utils/geometry';
import { hash2, mulberry32, pick, range, type Rng } from '../utils/rng';
import { posterTexture, windowTexture, type PosterSpec } from '../utils/textures';
import { propGeometry, type PropKind } from './Props';
import type { Track } from './Track';

const CAPACITY: Record<PropKind, number> = {
  banana: 500, roundTree: 500, palm: 300, bamboo: 250, hut: 120, teaStall: 80, shop: 260, pole: 120,
  haystack: 120, paddy: 500, pond: 60, building: 400, pavement: 200, shrub: 400, billboardFrame: 24, crate: 1,
};

const PADDY_COLORS = [0x7fb23a, 0x8cbf3f, 0x6fa333, 0xa8c04a, 0x94b83d, 0xc2b85a];
const SHOP_COLORS = [0xf2e6c9, 0xe8c9a0, 0xb5d3e7, 0xf4b6a6, 0xd5e8b5, 0xf6e27f];
const BUILDING_COLORS = [0xe9e2d0, 0xd9c7a8, 0xc7cdd3, 0xe8d3b9, 0xbfb5a6, 0xd6a77a, 0xa9b8a0];

/** Harmless parody billboards (all brands are made up). */
const BILLBOARDS: PosterSpec[] = [
  { emoji: '☕', title: 'এক কাপ চা ৳১৫', sub: 'গত সপ্তাহে ছিল ৳১০', fine: 'দাম বাড়ার আগে খেয়ে নিন', bg: ['#fff3d6', '#f4c48a'], fg: '#4a2a12', accent: '#c1121f', pattern: 'rays' },
  { emoji: '🧅', title: 'পেঁয়াজ কাটলে কাঁদবেন', sub: 'দাম শুনলেও কাঁদবেন', bg: ['#6a4c93', '#9d4edd'], fg: '#ffffff', accent: '#ffca3a', pattern: 'dots' },
  { emoji: '🚚', title: 'মায়ের দোয়া ট্রান্সপোর্ট', sub: 'সারাদেশে সবজি পরিবহন', fine: '*চাঁদা আলাদা', bg: ['#ffd166', '#f4a261'], fg: '#1d3557', accent: '#e63946', pattern: 'stripes' },
  { emoji: '📱', title: 'ভাই ভাই টেলিকম', sub: 'নেটওয়ার্ক নাই, ভালোবাসা আছে', bg: ['#118ab2', '#073b4c'], fg: '#ffffff', accent: '#ef476f', pattern: 'rays' },
  { emoji: '🥟', title: 'ফুচকা কিং', sub: 'টক বেশি, ঝাল আরও বেশি', bg: ['#ffe8d6', '#ffb4a2'], fg: '#6d2e46', accent: '#e5383b', pattern: 'dots' },
  { emoji: '🐟', title: 'ইলিশ ভাই রেস্টুরেন্ট', sub: 'কাঁটা বেছে খাওয়ানো হয়', bg: ['#caf0f8', '#48cae4'], fg: '#023e8a', accent: '#0077b6', pattern: 'stripes' },
  { emoji: '🏢', title: 'স্বপ্ননীড় হাউজিং', sub: 'রাস্তা নাই, পার্কিং আছে', fine: '*বন্যামুক্ত (শুকনো মৌসুমে)', bg: ['#e9edc9', '#ccd5ae'], fg: '#283618', accent: '#bc6c25', pattern: 'plain' },
  { emoji: '👨‍🦲', title: 'টাক-বাবা হেয়ার অয়েল', sub: '৭ দিনে চুল, না হলে আরও ৭ দিন', bg: ['#2b2d42', '#8d99ae'], fg: '#ffffff', accent: '#ef233c', pattern: 'rays' },
  { emoji: '☂️', title: 'ছাতা ভাড়া', sub: 'বৃষ্টি এলে ৳২০, না এলে ৳১০', bg: ['#a2d2ff', '#cdb4db'], fg: '#22223b', accent: '#7b2cbf', pattern: 'dots' },
  { emoji: '🍮', title: 'মিষ্টিমুখ মিষ্টান্ন ভাণ্ডার', sub: 'রসগোল্লায় রসের গ্যারান্টি', bg: ['#fff1e6', '#fde2e4'], fg: '#7f5539', accent: '#d62828', pattern: 'stripes' },
  { emoji: '📚', title: 'স্মার্ট কোচিং সেন্টার', sub: 'জিপিএ-৫ গ্যারান্টি*', fine: '*শর্ত প্রযোজ্য, শর্ত গোপন', bg: ['#80ffdb', '#5390d9'], fg: '#1b263b', accent: '#e63946', pattern: 'rays' },
  { emoji: '🧾', title: 'সাবধানে চালান', sub: 'চাঁদার রশিদ সংগ্রহ করুন*', fine: '*রশিদ দেওয়া হয় না', bg: ['#1d3557', '#457b9d'], fg: '#ffffff', accent: '#e63946', pattern: 'stripes' },
  { emoji: '🛣️', title: 'রাস্তা আপনার', sub: 'টোল আমাদের', bg: ['#2a9d8f', '#264653'], fg: '#ffffff', accent: '#e9c46a', pattern: 'plain' },
  { emoji: '🕵️', title: 'কমিটি গঠন করা হয়', sub: 'তদন্ত? পরে দেখা যাবে', bg: ['#f8f9fa', '#dee2e6'], fg: '#c1121f', accent: '#1d3557', pattern: 'dots' },
  { emoji: '🌶️', title: 'দাদা ভাইয়ের ঝালমুড়ি', sub: 'ঝাল বেশি, দাম আরও বেশি', bg: ['#ffba08', '#f48c06'], fg: '#370617', accent: '#9d0208', pattern: 'rays' },
  { emoji: '💪', title: 'পালোয়ান সিমেন্ট', sub: 'রাস্তা ভাঙবে, দেয়াল না', bg: ['#adb5bd', '#495057'], fg: '#ffffff', accent: '#f77f00', pattern: 'stripes' },
  { emoji: '🐄', title: 'খাঁটি গরুর দুধ', sub: 'পানি মেশানো হয় না*', fine: '*বর্ষাকাল ছাড়া', bg: ['#ffffff', '#d8f3dc'], fg: '#1b4332', accent: '#2d6a4f', pattern: 'dots' },
  { emoji: '🚦', title: 'জ্যাম কোচিং', sub: '৩ ঘণ্টায় ধৈর্যের ডিগ্রি', bg: ['#ff595e', '#ffca3a'], fg: '#1d1d1d', accent: '#1982c4', pattern: 'rays' },
  { emoji: '🥭', title: 'রাজশাহীর আম', sub: 'ঢাকায় পৌঁছে দাম তিন গুণ', bg: ['#fff3b0', '#e09f3e'], fg: '#540b0e', accent: '#335c67', pattern: 'stripes' },
];

interface Placement {
  kind: PropKind;
  m: THREE.Matrix4;
  color?: number;
}

export class Scenery {
  readonly group = new THREE.Group();
  private meshes = new Map<PropKind, THREE.InstancedMesh>();
  private billboards: THREE.Object3D[] = [];
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();
  private tmpP = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpC = new THREE.Color();

  constructor(private track: Track) {
    const buildingMat = new THREE.MeshLambertMaterial({ map: windowTexture() });
    for (const kind of Object.keys(CAPACITY) as PropKind[]) {
      if (kind === 'crate' || kind === 'billboardFrame') continue;
      const mat = kind === 'building' ? buildingMat : vertexColorMaterial();
      const mesh = new THREE.InstancedMesh(propGeometry(kind), mat, CAPACITY[kind]);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
    const boardGeo = new THREE.PlaneGeometry(6, 3);
    for (let i = 0; i < BILLBOARDS.length; i++) {
      const board = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ map: posterTexture(BILLBOARDS[i]) }));
      board.position.set(0, 4.6, 0.22);
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(propGeometry('billboardFrame'), vertexColorMaterial()));
      holder.add(board);
      holder.visible = false;
      this.billboards.push(holder);
      this.group.add(holder);
    }
  }

  setTrack(track: Track): void {
    this.track = track;
  }

  private place(out: Placement[], kind: PropKind, s: number, d: number, rotY: number, sx = 1, sy = 1, sz = 1, color?: number): void {
    const t = this.track;
    if (t.isBlocked(s, d)) return;
    const y = t.isRiver(s, 0) ? -100 : 0;
    this.tmpE.set(0, rotY, 0);
    this.tmpQ.setFromEuler(this.tmpE);
    const m = new THREE.Matrix4().compose(
      this.tmpP.set(t.centerX(s) + d, y, -s),
      this.tmpQ,
      this.tmpS.set(sx, sy, sz),
    );
    out.push({ kind, m, color });
  }

  /** Rebuild every instance for chunks [first, last]. */
  rebuild(first: number, last: number): void {
    const out: Placement[] = [];
    const bbSlots: { s: number; d: number; side: number; idx: number }[] = [];
    const L = ROAD.chunkLength;
    for (let c = first; c <= last; c++) {
      const s0 = c * L;
      if (s0 < -200 || s0 > this.track.length + 300) continue;
      const rng = mulberry32(hash2(c, 1337));
      this.genChunk(out, rng, s0, L, bbSlots, c);
    }

    const counts = new Map<PropKind, number>();
    for (const p of out) {
      const mesh = this.meshes.get(p.kind);
      if (!mesh) continue;
      const i = counts.get(p.kind) ?? 0;
      if (i >= CAPACITY[p.kind]) continue;
      mesh.setMatrixAt(i, p.m);
      if (p.color !== undefined) mesh.setColorAt(i, this.tmpC.set(p.color));
      counts.set(p.kind, i + 1);
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    this.billboards.forEach((b) => (b.visible = false));
    for (const slot of bbSlots) {
      if (this.track.isBlocked(slot.s, slot.d)) continue;
      const b = this.billboards[slot.idx % this.billboards.length];
      if (b.visible) continue;
      b.visible = true;
      b.position.set(this.track.centerX(slot.s) + slot.d, 0, -slot.s);
      // Face the approaching truck, angled toward the road
      b.rotation.y = -slot.side * 0.35;
    }
  }

  private genChunk(out: Placement[], rng: Rng, s0: number, L: number, bb: { s: number; d: number; side: number; idx: number }[], c: number): void {
    const t = this.track;
    const sMid = s0 + L / 2;
    const zone = t.zone(sMid);
    const hw = t.halfWidth(sMid);
    if (zone === 'river') return;
    const edge = hw + ROAD.shoulder + 1.5;

    const trees = (n: number, dMin: number, dMax: number, kinds: PropKind[]) => {
      for (let i = 0; i < n; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const kind = pick(rng, kinds);
        const sc = range(rng, 0.8, 1.3);
        this.place(out, kind, s0 + rng() * L, side * range(rng, dMin, dMax), rng() * 6.28, sc, sc, sc);
      }
    };

    // Billboards on either side, angled toward the approaching truck
    const billboard = (dist: number) => {
      const side = rng() < 0.5 ? -1 : 1;
      bb.push({ s: s0 + L / 2, d: side * dist, side, idx: c * 7 });
    };

    const paddies = (n: number, dMin: number) => {
      for (let i = 0; i < n; i++) {
        const side = rng() < 0.5 ? -1 : 1;
        const w = range(rng, 14, 26);
        const l = range(rng, 16, 30);
        this.place(out, 'paddy', s0 + rng() * L, side * (dMin + w / 2 + rng() * 40), 0, w, 1, l, pick(rng, PADDY_COLORS));
      }
    };

    switch (zone) {
      case 'village': {
        trees(4, hw + 6, 34, ['banana', 'banana', 'roundTree', 'bamboo', 'palm']);
        if (rng() < 0.45) {
          const side = rng() < 0.5 ? -1 : 1;
          this.place(out, 'hut', s0 + rng() * L, side * range(rng, 16, 28), (side > 0 ? -Math.PI / 2 : Math.PI / 2) + range(rng, -0.3, 0.3));
        }
        if (rng() < 0.35) this.place(out, 'haystack', s0 + rng() * L, (rng() < 0.5 ? -1 : 1) * range(rng, 12, 30), 0);
        if (rng() < 0.15) this.place(out, 'pond', s0 + rng() * L, (rng() < 0.5 ? -1 : 1) * range(rng, 30, 50), 0, 9, 1, 7);
        paddies(2, 36);
        trees(3, 40, 90, ['roundTree', 'palm', 'bamboo']);
        if (rng() < 0.08) billboard(hw + 9);
        break;
      }
      case 'rural': {
        paddies(3, edge + 4);
        trees(2, edge + 2, 22, ['banana', 'roundTree', 'palm', 'shrub']);
        trees(4, 30, 110, ['roundTree', 'roundTree', 'palm', 'bamboo', 'banana']);
        if (c % 2 === 0) this.place(out, 'pole', s0 + 5, -(edge + 1.5), 0);
        if (rng() < 0.2) {
          const side = rng() < 0.5 ? -1 : 1;
          this.place(out, 'hut', s0 + rng() * L, side * range(rng, 24, 45), side > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
        if (rng() < 0.12) {
          const side = rng() < 0.5 ? -1 : 1;
          this.place(out, 'teaStall', s0 + rng() * L, side * (edge + 3), side > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
        if (rng() < 0.18) this.place(out, 'haystack', s0 + rng() * L, (rng() < 0.5 ? -1 : 1) * range(rng, 20, 50), 0);
        if (rng() < 0.24) billboard(edge + 6);
        break;
      }
      case 'town': {
        for (const side of [-1, 1]) {
          this.place(out, 'pavement', sMid, side * (edge + 2), 0, 4, 1, L, 0xb3aa98);
          for (let k = 0; k < 3; k++) {
            const s = s0 + 6 + k * 13 + rng() * 3;
            if (rng() < 0.25) this.place(out, 'teaStall', s, side * (edge + 4.5), side > 0 ? -Math.PI / 2 : Math.PI / 2);
            else this.place(out, 'shop', s, side * (edge + 5.5), side > 0 ? -Math.PI / 2 : Math.PI / 2, range(rng, 0.8, 1.1), range(rng, 0.9, 1.4), 1, pick(rng, SHOP_COLORS));
          }
        }
        if (c % 2 === 0) this.place(out, 'pole', s0 + 5, -(edge + 0.8), 0);
        trees(2, 20, 60, ['roundTree', 'palm', 'banana']);
        if (rng() < 0.35) billboard(edge + 9);
        break;
      }
      case 'city': {
        for (const side of [-1, 1]) {
          this.place(out, 'pavement', sMid, side * (edge + 2.5), 0, 5, 1, L, 0xa8a196);
          let s = s0 + rng() * 4;
          while (s < s0 + L) {
            const w = range(rng, 10, 16);
            const h = range(rng, 12, 34);
            const dep = range(rng, 10, 16);
            this.place(out, 'building', s + w / 2, side * (edge + 6 + dep / 2), 0, dep, h, w, pick(rng, BUILDING_COLORS));
            s += w + range(rng, 1, 4);
          }
          for (let k = 0; k < 2; k++) {
            const w = range(rng, 14, 24);
            this.place(out, 'building', s0 + rng() * L, side * range(rng, 45, 90), 0, w, range(rng, 25, 70), w, pick(rng, BUILDING_COLORS));
          }
        }
        if (c % 2 === 0) this.place(out, 'pole', s0 + 5, -(edge + 0.8), 0);
        if (rng() < 0.35) billboard(edge + 3.5);
        break;
      }
    }
  }
}
