// Truck-art style writing for traffic: funny / epic Bengali slogans on the backs of vehicles,
// fictional company names on bus & truck sides, bumper stickers on cars. All names are made up.

import * as THREE from 'three';
import { canvasTexture, fillRich, FONT_BN, measureRich } from '../utils/textures';
import { mulberry32 } from '../utils/rng';

export const REAR_SLOGANS: string[][] = [
  ['মায়ের দোয়া'],
  ['দেখলে হবে', 'খরচ আছে'],
  ['১০০ হাত', 'দূরে থাকুন'],
  ['ব্রেক নাই', 'দোয়া আছে'],
  ['হর্ন দিন', 'সাইড পাবেন (হয়তো)'],
  ['রাস্তা আমার', 'বাপের'],
  ['টাকা নাই', 'ভাব আছে'],
  ['ধীরে চলুন', 'বউ অপেক্ষায়'],
  ['জাতে মাতাল', 'তালে ঠিক'],
  ['ওভারটেক করলে', 'খবর আছে'],
  ['আমি তোমার', 'পিছে পিছে'],
  ['জ্যামের রাজা'],
  ['লাইসেন্স?', 'বাড়িতে রাখা'],
  ['চাঁদা দিয়ে', 'আসছি'],
  ['দুষ্টু ছেলে', 'ধাক্কা দিও না'],
  ['চলিলাম', 'দুবাই {plane}'],
  ['সুপার ফাস্ট', '(মাঝে মাঝে)'],
  ['নো টেনশন', 'পরিবহন'],
];

/** Epic made-up company names for bus and truck sides. */
export const SIDE_NAMES = [
  'পঙ্খীরাজ এক্সপ্রেস',
  'তুফান মেইল',
  'ঝড়ের পাখি পরিবহন',
  'রকেট সার্ভিস (ডিরেক্ট)',
  'দুর্বার গতি ট্রাভেলস',
  'বেপরোয়া এক্সপ্রেস',
  'ভাই ভাই পরিবহন',
  'বাবার দোয়া ট্রান্সপোর্ট',
  'সোনার তরী কোচ',
  'চিতা বাঘ লাইন্স',
];

/** Short car bumper stickers. */
export const STICKERS = [
  'নতুন ড্রাইভার — দোয়া রাখবেন',
  'বেবি অন বোর্ড (বড় বেবি)',
  'জ্যামে বসে লেখা',
  'হর্ন নয়, হৃদয় দিয়ে চালান',
  'পিছনে তাকাবেন না',
  'ডেঞ্জার: শ্বশুরের গাড়ি',
];

const PALETTES: [string, string, string, string][] = [
  ['#e63946', '#ffd166', '#1d3557', '#ffffff'],
  ['#2a9d8f', '#f4a261', '#ffffff', '#264653'],
  ['#ffd166', '#e63946', '#1d3557', '#06d6a0'],
  ['#1d3557', '#ffd166', '#ffffff', '#e63946'],
  ['#7b2cbf', '#ffca3a', '#ffffff', '#ff595e'],
  ['#06d6a0', '#118ab2', '#073b4c', '#ffd166'],
];

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, center: string): void {
  ctx.fillStyle = petal;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, r * 0.28, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number): number {
  ctx.font = `700 ${size}px ${FONT_BN}`;
  while (measureRich(ctx, text) > maxW && size > 10) {
    size -= 2;
    ctx.font = `700 ${size}px ${FONT_BN}`;
  }
  return size;
}

/** Rear plate: bands, zigzag border, flowers and 1–2 lines of text. */
function rearTexture(lines: string[], i: number): THREE.Texture {
  const [bg, accent, ink, extra] = PALETTES[i % PALETTES.length];
  const rng = mulberry32(i * 31 + 7);
  return canvasTexture(384, 192, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // zigzag top/bottom
    for (const [y, dir] of [[0, 1], [h, -1]] as const) {
      ctx.fillStyle = accent;
      ctx.fillRect(0, dir > 0 ? 0 : h - 16, w, 16);
      ctx.fillStyle = extra;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10, y + dir * 16);
        ctx.lineTo(x + 20, y);
        ctx.fill();
      }
    }
    // flowers in the corners
    for (const [fx, fy] of [[26, 46], [w - 26, 46], [26, h - 46], [w - 26, h - 46]]) {
      flower(ctx, fx, fy, 16 + rng() * 4, extra, accent);
    }
    // text panel
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.roundRect(52, 28, w - 104, h - 56, 22);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = ink === '#ffffff' ? bg : ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lines.length === 1) {
      fitText(ctx, lines[0], w - 130, 56);
      fillRich(ctx, lines[0], w / 2, h / 2 + 4);
    } else {
      fitText(ctx, lines[0], w - 130, 44);
      fillRich(ctx, lines[0], w / 2, h / 2 - 24);
      ctx.fillStyle = '#c1121f';
      fitText(ctx, lines[1], w - 130, 38);
      fillRich(ctx, lines[1], w / 2, h / 2 + 26);
    }
  });
}

/** Long strip for vehicle sides and car stickers. */
function stripTexture(text: string, i: number, sticker: boolean): THREE.Texture {
  const [bg, accent, ink, extra] = PALETTES[(i + 2) % PALETTES.length];
  return canvasTexture(768, 96, (ctx, w, h) => {
    if (sticker) {
      ctx.fillStyle = '#fffbea';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c1121f';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = '#1d3557';
    } else {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, bg);
      g.addColorStop(0.5, accent);
      g.addColorStop(1, bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      flower(ctx, 40, h / 2, 26, extra, ink);
      flower(ctx, w - 40, h / 2, 26, extra, ink);
      ctx.fillStyle = ink === '#ffffff' ? '#1d3557' : ink;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, text, w - 130, 64);
    if (!sticker) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 6;
      fillRich(ctx, text, w / 2, h / 2 + 4, true);
    } else fillRich(ctx, text, w / 2, h / 2 + 4);
  });
}

let rear: THREE.MeshLambertMaterial[] | null = null;
let side: THREE.MeshLambertMaterial[] | null = null;
let sticker: THREE.MeshLambertMaterial[] | null = null;

const mat = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -1 });

export function rearMaterials(): THREE.MeshLambertMaterial[] {
  return (rear ??= REAR_SLOGANS.map((l, i) => mat(rearTexture(l, i))));
}
export function sideMaterials(): THREE.MeshLambertMaterial[] {
  return (side ??= SIDE_NAMES.map((n, i) => mat(stripTexture(n, i, false))));
}
export function stickerMaterials(): THREE.MeshLambertMaterial[] {
  return (sticker ??= STICKERS.map((n, i) => mat(stripTexture(n, i, true))));
}
