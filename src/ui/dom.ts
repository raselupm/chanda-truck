/** Tiny DOM helper: el('div', 'cls', 'text or html') */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  html = '',
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

/** Set text only when it changed (avoids layout thrash in the per-frame HUD). */
export function setText(e: Element, text: string): void {
  if (e.textContent !== text) e.textContent = text;
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
