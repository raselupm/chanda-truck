import * as THREE from 'three';
import type { RouteEvent } from '../config/route';
import type { Game } from '../game/Game';

/** A hand-built location on the route (farm, barrier, toll plaza, bridge, market). */
export abstract class SetPiece<E extends RouteEvent = RouteEvent> {
  readonly group = new THREE.Group();
  /** true once it no longer blocks the road */
  resolved = false;

  constructor(readonly event: E, protected game: Game) {}

  get s(): number {
    return this.event.s;
  }

  /** Does this piece stop the truck until handled (used by chase cut-off and traffic)? */
  get blocking(): boolean {
    return !this.resolved;
  }

  /** s-range where this piece should be visible */
  visibleRange(): [number, number] {
    return [this.s - 750, this.s + 200];
  }

  /** How far before this piece queued traffic stops while it's blocking. */
  get queueGap(): number {
    return 60;
  }

  /** Traffic may wait here in a queue (instead of being removed while out of sight). */
  get allowsQueue(): boolean {
    return false;
  }

  abstract update(dt: number): void;

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      // Only dispose per-piece materials with their own textures; shared geometry stays cached.
      if (m.isMesh && m.userData.ownsMaterial) {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }

  /** world position for (s, d) at the road surface + yOffset */
  protected at(s: number, d: number, yOffset = 0): THREE.Vector3 {
    return this.game.track.point(s, d, new THREE.Vector3(), yOffset);
  }

  protected own<T extends THREE.Mesh>(m: T): T {
    m.userData.ownsMaterial = true;
    return m;
  }
}

/** Pulsing translucent rectangle drawn on the road (stop/buy/unload zones). */
export function glowZone(len: number, width: number, color: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const g = new THREE.PlaneGeometry(width, len).rotateX(-Math.PI / 2);
  // border
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(g),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  const m = new THREE.Mesh(g, mat);
  m.add(edges);
  m.userData.ownsMaterial = true;
  m.renderOrder = 2;
  return m;
}

export function pulseGlow(m: THREE.Mesh, t: number, base = 0.25, amp = 0.2): void {
  (m.material as THREE.MeshBasicMaterial).opacity = base + amp * (0.5 + 0.5 * Math.sin(t * 4));
}

/** Simple post-mounted sign facing the approaching truck. */
export function signPost(tex: THREE.Texture, w: number, h: number, poleH: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, poleH, 6), new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
  pole.position.y = poleH / 2;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  board.position.set(0, poleH + h / 2 - 0.1, 0.07);
  board.userData.ownsMaterial = true;
  g.add(pole, board);
  return g;
}
