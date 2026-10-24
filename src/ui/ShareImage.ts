// Renders the trip report to a PNG with a plain 2D canvas (no html2canvas dependency).

import { VEGETABLES } from '../config/vegetables';
import type { ResultData } from '../game/Results';
import { formatBn, formatTaka } from '../utils/bnNumber';
import { FONT_BN } from '../utils/textures';
import { BREAKDOWN_LABELS, CATEGORY_COLORS, outcomeLine } from './ResultReport';

const W = 1080;
const H = 1350;
const BG = '#1f1610';
const CARD = '#2a1d13';
const FG = '#fbeedd';
const MUTED = '#c9b8a2';

export async function renderShareImage(r: ResultData): Promise<Blob | null> {
  await document.fonts?.ready;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const font = (weight: number, size: number) => `${weight} ${size}px ${FONT_BN}`;
  const M = 60;
  const arrived = r.outcome === 'arrived';
  const perKg = (v: number) => (Number.isFinite(v) ? formatTaka(v, 2) : '—');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = CARD;
  ctx.beginPath();
  ctx.roundRect(M - 20, 40, W - 2 * (M - 20), H - 80, 28);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2a03d';
  ctx.font = font(700, 64);
  ctx.fillText('📋 যাত্রার হিসাব', M, 140);
  ctx.fillStyle = MUTED;
  ctx.font = font(500, 28);
  ctx.fillText('সবজির ট্রাক', M, 186);

  const o = outcomeLine(r);
  ctx.fillStyle = arrived ? '#8bd17c' : '#ff6b5a';
  ctx.font = font(700, 34);
  ctx.fillText(`${o.icon} ${o.text}`, M, 250);

  // Key numbers: 2 × 2 tiles
  const tiles: [string, string, string][] = [
    ['ক্ষেতের গড় দাম', `${perKg(r.avgFarmPerKg)}/কেজি`, FG],
    ['আপনার কেজিপ্রতি খরচ', arrived ? `${perKg(r.landedPerKg)}/কেজি` : '—', FG],
    ['কেজিপ্রতি চাঁদার ভাগ', arrived ? `${perKg(r.extortionPerKg)}/কেজি` : '—', '#ff6b5a'],
    ['চাঁদা না থাকলে খরচ হতো', arrived ? `${perKg(r.noExtortionPerKg)}/কেজি` : '—', '#8bd17c'],
  ];
  const tw = (W - 2 * M - 24) / 2;
  tiles.forEach(([label, value, color], i) => {
    const x = M + (i % 2) * (tw + 24);
    const y = 290 + Math.floor(i / 2) * 150;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, tw, 130, 18);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = font(500, 26);
    ctx.fillText(label, x + 24, y + 44);
    ctx.fillStyle = color;
    ctx.font = font(700, 46);
    ctx.fillText(value, x + 24, y + 104);
  });

  // Cost breakdown bar + legend
  let y = 650;
  ctx.fillStyle = FG;
  ctx.font = font(700, 34);
  ctx.fillText(`খরচের ভাগ — মোট ${formatTaka(r.totalCash)}`, M, y);
  y += 24;
  const keys = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[];
  const total = r.totalCash || 1;
  let x = M;
  for (const k of keys) {
    const w = (r.breakdown[k] / total) * (W - 2 * M);
    if (w <= 0) continue;
    ctx.fillStyle = CATEGORY_COLORS[k];
    ctx.fillRect(x, y, Math.max(0, w - 3), 44);
    x += w;
  }
  y += 90;
  ctx.font = font(500, 28);
  for (const k of keys) {
    ctx.fillStyle = CATEGORY_COLORS[k];
    ctx.fillRect(M, y - 22, 24, 24);
    ctx.fillStyle = FG;
    ctx.textAlign = 'left';
    ctx.fillText(BREAKDOWN_LABELS[k], M + 40, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${formatTaka(r.breakdown[k])}  (${formatBn((r.breakdown[k] / total) * 100, 0)}%)`, W - M, y);
    y += 44;
  }
  ctx.textAlign = 'left';

  // Per-vegetable rows
  y += 30;
  if (r.rows.length) {
    const cols = [M, M + 330, M + 600, W - M];
    ctx.fillStyle = MUTED;
    ctx.font = font(700, 26);
    ['সবজি', 'ক্ষেতে', 'আপনার খরচ', 'কাওরান বাজার'].forEach((h, i) => {
      ctx.textAlign = i === 3 ? 'right' : 'left';
      ctx.fillText(h, cols[i], y);
    });
    y += 46;
    ctx.font = font(500, 28);
    ctx.fillStyle = FG;
    for (const row of r.rows) {
      if (y > H - 90) break;
      const v = VEGETABLES[row.veg];
      [`${v.emoji} ${v.nameBn}`, perKg(row.farmPrice), perKg(row.landedPerKg), perKg(row.marketPrice)].forEach((cell, i) => {
        ctx.textAlign = i === 3 ? 'right' : 'left';
        ctx.fillText(cell, cols[i], y);
      });
      y += 42;
    }
  }

  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
