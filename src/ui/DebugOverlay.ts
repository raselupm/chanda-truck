import type { WebGLRenderer } from 'three';

/** F3-toggled overlay with fps, frame time and renderer stats. */
export class DebugOverlay {
  private el: HTMLDivElement;
  private visible = false;
  private frames = 0;
  private accum = 0;
  private worstDt = 0;
  private extra: Record<string, string> = {};

  constructor(parent: HTMLElement, private renderer: WebGLRenderer) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.el.style.display = 'none';
    parent.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    });
    // Mobile: ?debug in the URL shows it from the start
    if (new URLSearchParams(location.search).has('debug')) this.toggle();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  /** Arbitrary key/value lines other systems can publish (e.g. speed, chunk count). */
  set(key: string, value: string): void {
    this.extra[key] = value;
  }

  update(rawDt: number): void {
    this.frames++;
    this.accum += rawDt;
    this.worstDt = Math.max(this.worstDt, rawDt);
    if (this.accum < 0.5) return;
    const fps = this.frames / this.accum;
    if (this.visible) {
      const info = this.renderer.info;
      const lines = [
        `fps   ${fps.toFixed(1)}`,
        `worst ${(this.worstDt * 1000).toFixed(1)} ms`,
        `calls ${info.render.calls}  tris ${info.render.triangles}`,
        `geo ${info.memory.geometries}  tex ${info.memory.textures}`,
        `dpr ${this.renderer.getPixelRatio().toFixed(2)}`,
        ...Object.entries(this.extra).map(([k, v]) => `${k} ${v}`),
      ];
      this.el.textContent = lines.join('\n');
    }
    this.frames = 0;
    this.accum = 0;
    this.worstDt = 0;
  }
}
