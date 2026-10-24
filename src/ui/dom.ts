import { rich } from './icons';

/** Tiny DOM helper: el('div', 'cls', 'text or html'). {icon} tokens in html become SVG icons. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  html = '',
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = rich(html);
  parent?.appendChild(e);
  return e;
}

/** Set text only when it changed (avoids layout thrash in the per-frame HUD). {icon} tokens become SVG. */
export function setText(e: Element, text: string): void {
  const el = e as Element & { _raw?: string };
  if (el._raw === text) return;
  el._raw = text;
  if (text.includes('{')) e.innerHTML = rich(esc(text));
  else e.textContent = text;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** A button that reacts on pointerdown (snappy on touch) and click (keyboard). */
export function button(label: string, className: string, onPress: () => void, parent?: HTMLElement): HTMLButtonElement {
  const b = el('button', className, label, parent);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!b.disabled) onPress();
  });
  return b;
}
