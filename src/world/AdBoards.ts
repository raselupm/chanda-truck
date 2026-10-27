// Big roadside billboards showing real ads: every image in the project's ads/ folder (drop a file in, it
// appears in the game). Each board picks an ad at random every run. They stand at the start field, along
// the driver's side of the highway, and where the truck has to wait: toll plazas and rail crossings.

import * as THREE from 'three';
import type { RouteDef } from '../config/route';
import { ROAD } from '../config/tuning';
import { box, buildColored, cached, vertexColorMaterial } from '../utils/geometry';
import type { Track } from './Track';

const AD_URLS: string[] = Object.values(
  import.meta.glob('../../ads/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
);

/** ad panel size in metres (wide, like a highway hoarding) */
const PANEL_W = 12;
const PANEL_H = 6.5;
const PANEL_Y = 7.6;
/** texture size; ads are scaled to fit inside without cropping */
const TEX_W = 1024;
const TEX_H = Math.round((TEX_W * PANEL_H) / PANEL_W);
/** one roadside board every this many metres along the highway */
const ROADSIDE_EVERY = 900;

function frameGeometry(): THREE.BufferGeometry {
  return cached('adboard:frame', () =>
    buildColored([
      // two steel legs, a catwalk and the dark frame round the panel
      { geo: box(0.4, PANEL_Y, 0.4), color: 0x4a4a4a, p: [-PANEL_W * 0.3, PANEL_Y / 2, -0.2] },
      { geo: box(0.4, PANEL_Y, 0.4), color: 0x4a4a4a, p: [PANEL_W * 0.3, PANEL_Y / 2, -0.2] },
      { geo: box(PANEL_W + 0.6, PANEL_H + 0.6, 0.3), color: 0x2b2b2b, p: [0, PANEL_Y, 0] },
      { geo: box(PANEL_W, 0.12, 0.9), color: 0x5a5a5a, p: [0, PANEL_Y - PANEL_H / 2 - 0.45, 0.5] },
      // lamp arms along the top
      ...[-4, 0, 4].map((x) => ({ geo: box(0.15, 0.15, 1.2), color: 0x333333, p: [x, PANEL_Y + PANEL_H / 2 + 0.35, 0.6] as [number, number, number] })),
      ...[-4, 0, 4].map((x) => ({ geo: box(0.6, 0.25, 0.35), color: 0xd9d9d9, p: [x, PANEL_Y + PANEL_H / 2 + 0.3, 1.2] as [number, number, number] })),
    ]),
  );
}

/** Loads an ad and letterboxes it onto a panel-shaped canvas (white margins, never cropped). */
function loadAd(url: string, mat: THREE.MeshLambertMaterial): void {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = TEX_W;
    c.height = TEX_H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    const k = Math.min(TEX_W / img.width, TEX_H / img.height);
    const w = img.width * k;
    const h = img.height * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (TEX_W - w) / 2, (TEX_H - h) / 2, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.needsUpdate = true;
  };
  img.src = url;
}

interface Slot {
  s: number;
  d: number;
  /** -1 = left of the road, 1 = right; the board is angled toward the road */
  side: -1 | 1;
}

export class AdBoards {
  readonly group = new THREE.Group();
  /** one material per ad, shared by every board showing it */
  private mats: THREE.MeshLambertMaterial[] = [];
  private boards: THREE.Group[] = [];

  constructor() {
    for (const url of AD_URLS) {
      // a little self-lit so the ad stays readable at dusk and at night
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 });
      loadAd(url, mat);
      this.mats.push(mat);
    }
  }

  get count(): number {
    return AD_URLS.length;
  }

  /** Place the boards for a route and give each one a random ad. Call after the set pieces are built. */
  build(route: RouteDef, track: Track): void {
    for (const b of this.boards) this.group.remove(b);
    this.boards = [];
    if (!this.mats.length) return;

    const slots = this.slots(route, track);
    // shuffle a deck of ads so neighbouring boards differ when there are several
    let deck: number[] = [];
    for (const slot of slots) {
      if (!deck.length) deck = shuffle(this.mats.map((_, i) => i));
      this.add(slot, this.mats[deck.pop()!], track);
    }
  }

  private add(slot: Slot, mat: THREE.MeshLambertMaterial, track: Track): void {
    const board = new THREE.Group();
    board.add(new THREE.Mesh(frameGeometry(), vertexColorMaterial()));
    const panel = new THREE.Mesh(cached('adboard:panel', () => new THREE.PlaneGeometry(PANEL_W, PANEL_H)), mat);
    panel.position.set(0, PANEL_Y, 0.16);
    board.add(panel);
    board.position.set(track.centerX(slot.s) + slot.d, 0, -slot.s);
    // face the approaching truck, turned a little toward the road
    board.rotation.y = -slot.side * 0.3;
    this.group.add(board);
    this.boards.push(board);
    // keep trees, shops and the small billboards out of its way, and out of the view from the road
    const half = PANEL_W / 2 + 2;
    const roadEdge = slot.side * (track.halfWidth(slot.s) + 1);
    track.propBlocks.push({
      from: slot.s - 35,
      to: slot.s + 6,
      dMin: Math.min(roadEdge, slot.d - half),
      dMax: Math.max(roadEdge, slot.d + half),
    });
  }

  private slots(route: RouteDef, track: Track): Slot[] {
    const out: Slot[] = [];
    const off = (s: number) => track.halfWidth(s) + ROAD.shoulder + 1.5 + PANEL_W / 2;
    /** clear ground: not on the river, a bridge ramp or anything a set piece has reserved */
    const free = (s: number, d: number) =>
      !track.isRiver(s, 120) && track.elevation(s) < 1 && !track.isBlocked(s, d) && !track.isBlocked(s, d - Math.sign(d) * PANEL_W * 0.45);
    const tryAdd = (s: number, side: -1 | 1, extra = 0) => {
      for (const shift of [0, 15, -15, 30, -30]) {
        const ss = s + shift;
        const d = side * (off(ss) + extra);
        if (free(ss, d)) {
          out.push({ s: ss, d, side });
          return;
        }
      }
    };

    // The start field: the first thing in view, across the road from the first farm
    const farm = route.events.find((e) => e.type === 'farm');
    tryAdd(85, farm?.side === 1 ? -1 : 1, 4);

    // Where the truck waits: just past every toll plaza and rail crossing (in view while stopped)
    for (const e of route.events) {
      if (e.type === 'roadTax' || e.type === 'roadToll' || e.type === 'bridgeToll') tryAdd(e.s + 60, -1, 6);
      else if (e.type === 'rail') tryAdd(e.s + 45, 1, 4);
    }

    // Along the driver's side of the highway, away from the set pieces
    const market = route.events.find((e) => e.type === 'market')?.s ?? route.length;
    for (let s = route.highwayStartS + 400; s < market - 400; s += ROADSIDE_EVERY) {
      if (route.events.some((e) => Math.abs(e.s - s) < 150)) continue;
      tryAdd(s, -1);
    }
    return out;
  }
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
