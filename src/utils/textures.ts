// Procedural canvas textures: signs, truck art, ground, windows.

import * as THREE from 'three';
import { ICON_TOKEN, iconImage } from '../ui/icons';
import { toBnDigits } from './bnNumber';
import { mulberry32 } from './rng';

export const FONT_BN = '"Hind Siliguri", "Noto Sans Bengali", sans-serif';

// ---- text with {icon} tokens on a canvas

function fontPx(ctx: CanvasRenderingContext2D): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  return m ? +m[1] : 16;
}

function segments(text: string): { text?: string; icon?: string }[] {
  const out: { text?: string; icon?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(ICON_TOKEN)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ icon: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Width of text that may contain {icon} tokens, in the current ctx font. */
export function measureRich(ctx: CanvasRenderingContext2D, text: string): number {
  if (!text.includes('{')) return ctx.measureText(text).width;
  const px = fontPx(ctx);
  return segments(text).reduce((w, sgm) => w + (sgm.icon ? px * 1.2 : ctx.measureText(sgm.text!).width), 0);
}

/** fillText that draws {icon} tokens as SVG icons. Honours textAlign and textBaseline. */
export function fillRich(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, stroke = false): void {
  if (!text.includes('{')) {
    if (stroke) ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    return;
  }
  const px = fontPx(ctx);
  const total = measureRich(ctx, text);
  const align = ctx.textAlign;
  let cx = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x;
  ctx.textAlign = 'left';
  const size = px * 1.05;
  const top = ctx.textBaseline === 'middle' ? y - size / 2 : ctx.textBaseline === 'top' ? y : y - size * 0.85;
  for (const sgm of segments(text)) {
    if (sgm.icon) {
      const img = iconImage(sgm.icon);
      if (img) ctx.drawImage(img, cx + px * 0.05, top, size, size);
      cx += px * 1.2;
    } else {
      if (stroke) ctx.strokeText(sgm.text!, cx, y);
      ctx.fillText(sgm.text!, cx, y);
      cx += ctx.measureText(sgm.text!).width;
    }
  }
  ctx.textAlign = align;
}

export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export interface SignOpts {
  bg?: string;
  fg?: string;
  border?: string;
  w?: number;
  h?: number;
  /** font size per line, px */
  sizes?: number[];
}

/** Text sign; lines are drawn centred and auto-shrunk to fit the width. */
export function signTexture(lines: string[], opts: SignOpts = {}): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 256;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = opts.bg ?? '#1d5e2f';
    ctx.fillRect(0, 0, w, h);
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = Math.max(6, w * 0.02);
      ctx.strokeRect(ctx.lineWidth / 2 + 4, ctx.lineWidth / 2 + 4, w - ctx.lineWidth - 8, h - ctx.lineWidth - 8);
    }
    ctx.fillStyle = opts.fg ?? '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sizes = opts.sizes ?? lines.map(() => Math.floor(h / (lines.length + 0.8)));
    const total = sizes.reduce((a, b) => a + b * 1.15, 0);
    let y = (h - total) / 2;
    lines.forEach((line, i) => {
      let size = sizes[i];
      ctx.font = `700 ${size}px ${FONT_BN}`;
      while (measureRich(ctx, line) > w * 0.9 && size > 10) {
        size -= 2;
        ctx.font = `700 ${size}px ${FONT_BN}`;
      }
      y += sizes[i] * 1.15;
      fillRich(ctx, line, w / 2, y - sizes[i] * 0.55);
    });
  });
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, center: string) {
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

function zigzag(ctx: CanvasRenderingContext2D, y: number, w: number, h: number, a: string, b: string) {
  ctx.fillStyle = a;
  ctx.fillRect(0, y, w, h);
  ctx.fillStyle = b;
  const step = h * 1.4;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + step / 2, y);
    ctx.lineTo(x + step, y + h);
    ctx.fill();
  }
}

/** Bangladeshi truck-art style panels. */
export function truckArtTexture(kind: 'side' | 'back' | 'front'): THREE.CanvasTexture {
  if (kind === 'side') {
    return canvasTexture(1024, 256, (ctx, w, h) => {
      const bands = ['#0f8b8d', '#e63946', '#f4a261', '#2a9d8f', '#ffd166'];
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, (i * h) / bands.length, w, h / bands.length + 1);
      });
      zigzag(ctx, 0, w, 22, '#ffd166', '#e63946');
      zigzag(ctx, h - 22, w, 22, '#1d3557', '#ffd166');
      const rng = mulberry32(7);
      for (let i = 0; i < 16; i++) {
        flower(ctx, 40 + i * 64, 60 + (i % 2) * 130, 18 + rng() * 6, i % 2 ? '#ff6b9a' : '#ffffff', '#ffd166');
      }
      ctx.fillStyle = '#fff8e7';
      ctx.strokeStyle = '#1d3557';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(260, 70, 504, 116, 40);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c1121f';
      ctx.font = `700 64px ${FONT_BN}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('মায়ের দোয়া ট্রান্সপোর্ট', 512, 132);
    });
  }
  if (kind === 'back') {
    return canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(0, 0, w, h);
      zigzag(ctx, 0, w, 30, '#e63946', '#2a9d8f');
      zigzag(ctx, h - 30, w, 30, '#2a9d8f', '#e63946');
      for (let i = 0; i < 6; i++) flower(ctx, 45 + i * 84, 70, 22, '#e63946', '#1d3557');
      for (let i = 0; i < 6; i++) flower(ctx, 45 + i * 84, 440, 22, '#1d3557', '#ffffff');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#c1121f';
      ctx.font = `700 92px ${FONT_BN}`;
      ctx.fillText('হর্ন দিন', 256, 200);
      ctx.fillStyle = '#1d3557';
      ctx.font = `700 48px ${FONT_BN}`;
      ctx.fillText('সাবধানে চালান', 256, 290);
      ctx.fillStyle = '#fff';
      ctx.fillRect(96, 336, 320, 54);
      ctx.fillStyle = '#111';
      ctx.font = `600 30px ${FONT_BN}`;
      ctx.fillText('সবজি মেট্রো-ট ০০-০০০০', 256, 364);
    });
  }
  return canvasTexture(512, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#e63946');
    g.addColorStop(0.5, '#ffd166');
    g.addColorStop(1, '#e63946');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    zigzag(ctx, h - 16, w, 16, '#1d3557', '#ffffff');
    flower(ctx, 40, 54, 22, '#ffffff', '#1d3557');
    flower(ctx, w - 40, 54, 22, '#ffffff', '#1d3557');
    ctx.fillStyle = '#1d3557';
    ctx.font = `700 64px ${FONT_BN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('মায়ের দোয়া', w / 2, 56);
  });
}

export function groundTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7b9a3c';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(42);
    const tones = ['#86a544', '#6f8f35', '#8faa4a', '#7a9440', '#93a656'];
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(rng() * w, rng() * h, 6 + rng() * 22, 4 + rng() * 14, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function windowTexture(): THREE.CanvasTexture {
  const t = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const rng = mulberry32(3);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 4; x++) {
        const lit = rng();
        ctx.fillStyle = lit > 0.8 ? '#8fb3c9' : lit > 0.3 ? '#4d6170' : '#6c5a49';
        ctx.fillRect(10 + x * 30, 12 + y * 31, 18, 20);
      }
      ctx.fillStyle = '#b9b2a6';
      ctx.fillRect(0, 36 + y * 31, w, 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function stripeTexture(a: string, b: string, n = 8): THREE.CanvasTexture {
  return canvasTexture(256, 16, (ctx, w, h) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  });
}

/** Parody billboard. */
export function billboardTexture(lines: string[], bg: string, fg: string, accent: string): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 40, w, 40);
    ctx.fillRect(0, 0, 18, h);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sizes = [54, 34, 26];
    lines.forEach((line, i) => {
      let size = sizes[i] ?? 26;
      ctx.font = `700 ${size}px ${FONT_BN}`;
      while (ctx.measureText(line).width > w * 0.88 && size > 12) {
        size -= 2;
        ctx.font = `700 ${size}px ${FONT_BN}`;
      }
      ctx.fillText(line, w / 2 + 8, 60 + i * 64);
    });
  });
}

export interface PosterSpec {
  /** icon token, e.g. '{tea}' */
  icon: string;
  title: string;
  sub: string;
  fine?: string;
  /** two-colour gradient background */
  bg: [string, string];
  fg: string;
  accent: string;
  pattern: 'rays' | 'stripes' | 'dots' | 'plain';
}

/** Illustrated parody billboard: patterned background, big emoji "illustration", headline, tagline. */
export function posterTexture(p: PosterSpec): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, p.bg[0]);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = p.accent;
    if (p.pattern === 'rays') {
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(100, h / 2);
        ctx.arc(100, h / 2, 600, a0, a0 + Math.PI / 16);
        ctx.fill();
      }
    } else if (p.pattern === 'stripes') {
      for (let x = -h; x < w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + h, 0);
        ctx.lineTo(x + h + 16, 0);
        ctx.lineTo(x + 16, h);
        ctx.fill();
      }
    } else if (p.pattern === 'dots') {
      for (let y = 12; y < h; y += 24) for (let x = 12 + ((y / 24) % 2) * 12; x < w; x += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Illustration medallion
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(100, h / 2 - 8, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = p.accent;
    ctx.stroke();
    const art = iconImage(p.icon.replace(/[{}]/g, ''));
    if (art) ctx.drawImage(art, 100 - 56, h / 2 - 8 - 56, 112, 112);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Copy
    const tx = 340;
    const maxW = w - 200;
    ctx.fillStyle = p.fg;
    let size = 46;
    ctx.font = `700 ${size}px ${FONT_BN}`;
    while (measureRich(ctx, p.title) > maxW && size > 18) ctx.font = `700 ${(size -= 2)}px ${FONT_BN}`;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    fillRich(ctx, p.title, tx, 80);
    ctx.shadowBlur = 0;
    // tagline in a ribbon
    size = 30;
    ctx.font = `700 ${size}px ${FONT_BN}`;
    while (measureRich(ctx, p.sub) > maxW - 20 && size > 14) ctx.font = `700 ${(size -= 2)}px ${FONT_BN}`;
    const tw = Math.min(maxW, measureRich(ctx, p.sub) + 30);
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.roundRect(tx - tw / 2, 116, tw, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    fillRich(ctx, p.sub, tx, 141);
    if (p.fine) {
      ctx.fillStyle = p.fg;
      ctx.globalAlpha = 0.85;
      ctx.font = `600 18px ${FONT_BN}`;
      fillRich(ctx, p.fine, tx, 196);
      ctx.globalAlpha = 1;
    }
    // frame
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
  });
}

/** Round speed-limit sign with a red ring. */
export function speedSignTexture(limit: number): THREE.Texture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d62828';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(128, 128, 104, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = `700 110px ${FONT_BN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toBnDigits(limit), 128, 136);
  });
}

