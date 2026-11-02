import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/hind-siliguri/700.css';
import './styles/base.css';
import './styles/ui.css';

import * as THREE from 'three';
import { LOOP, RENDER } from './config/tuning';
import { Game } from './game/Game';
import { initAnalytics } from './net/analytics';
import { DebugOverlay } from './ui/DebugOverlay';
import { preloadIconImages } from './ui/icons';
import { isMobile } from './utils/device';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(RENDER.fov, 1, RENDER.near, RENDER.far);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxDpr = isMobile ? RENDER.maxPixelRatioMobile : RENDER.maxPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
// iOS reports stale sizes right after rotation; resize again once it settles
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

async function boot(): Promise<void> {
  // Canvas textures (signs, truck art) need the Bengali font loaded first.
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 40px "Hind Siliguri"', 'বাংলা'),
        document.fonts.load('600 40px "Hind Siliguri"', 'বাংলা'),
        document.fonts.load('400 40px "Hind Siliguri"', 'বাংলা'),
      ]),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch {
    /* fall back to system Bengali font */
  }
  // SVG icons are drawn into canvas textures (signs, billboards), so load them as images first
  await preloadIconImages();
  document.getElementById('boot')?.remove();

  initAnalytics();
  const debug = new DebugOverlay(uiRoot, renderer);
  const game = new Game(scene, camera, uiRoot, debug);
  // Handy for tuning from the browser console during development
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const rawDt = Math.max(0, (now - last) / 1000);
    last = now;
    game.update(Math.min(rawDt, LOOP.maxDt));
    renderer.render(scene, camera);
    game.renderOverlay(renderer);
    debug.update(rawDt);
  });
}

void boot();
