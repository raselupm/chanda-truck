// Third-person chase camera with lag, speed-based FOV and impact shake; optional cockpit view.

import * as THREE from 'three';
import { CAMERA, WORLD } from '../config/tuning';
import { clamp, damp } from '../utils/math';
import type { TruckController } from './TruckController';

export class CameraRig {
  mode: 'chase' | 'cockpit' = 'chase';
  private shakeAmp = 0;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private smoothHeading = 0;
  private smoothLook = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  toggle(): void {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
  }

  snap(t: TruckController): void {
    this.smoothHeading = t.heading;
    this.compute(t);
    this.camera.position.copy(this.pos);
    this.smoothLook.copy(this.look);
    this.camera.lookAt(this.look);
    this.camera.fov = this.cfg.fovMin;
    this.camera.updateProjectionMatrix();
  }

  /** Camera settings for the current screen shape. */
  private get cfg() {
    return this.camera.aspect < 1 ? { ...CAMERA, ...CAMERA.portrait } : CAMERA;
  }

  private compute(t: TruckController): void {
    const h = this.smoothHeading;
    const c = this.cfg;
    this.fwd.set(Math.sin(h), 0, -Math.cos(h));
    if (this.mode === 'chase') {
      this.pos.set(t.x, t.y, t.z).addScaledVector(this.fwd, -c.distance);
      this.pos.y += c.height;
      this.look.set(t.x, t.y + c.lookHeight, t.z).addScaledVector(this.fwd, c.lookAhead);
    } else {
      const f = new THREE.Vector3(Math.sin(t.heading), 0, -Math.cos(t.heading));
      this.pos.set(t.x, t.y + 2.75, t.z).addScaledVector(f, -2.9);
      this.look.copy(this.pos).addScaledVector(f, 30);
      this.look.y += -1.2 + Math.tan(t.pitch) * 30;
    }
  }

  update(dt: number, t: TruckController, bump: number): void {
    this.smoothHeading = damp(this.smoothHeading, t.heading, this.mode === 'chase' ? 2.6 : 30, dt);
    this.compute(t);
    if (this.mode === 'chase') {
      // follow tighter when the world moves faster, so the lag distance stays the same
      const k = CAMERA.followLambda * WORLD.speedScale;
      this.camera.position.x = damp(this.camera.position.x, this.pos.x, k, dt);
      this.camera.position.y = damp(this.camera.position.y, this.pos.y, k * 0.8, dt);
      this.camera.position.z = damp(this.camera.position.z, this.pos.z, k * 1.6, dt);
      // Smooth the aim point too, so bumps and steering don't jerk the view
      this.smoothLook.x = damp(this.smoothLook.x, this.look.x, 8, dt);
      this.smoothLook.y = damp(this.smoothLook.y, this.look.y, 5, dt);
      this.smoothLook.z = damp(this.smoothLook.z, this.look.z, 12, dt);
    } else {
      this.camera.position.copy(this.pos);
      this.camera.position.y += bump;
      this.smoothLook.copy(this.look);
    }
    this.camera.lookAt(this.smoothLook);

    if (this.shakeAmp > 0.001) {
      const a = this.shakeAmp;
      this.tmp.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      this.camera.position.add(this.tmp);
      this.camera.rotation.z += (Math.random() - 0.5) * a * 0.05;
      this.shakeAmp *= Math.exp(-5 * dt);
    }

    const kmh = Math.abs(t.kmh);
    const c = this.cfg;
    const fov = c.fovMin + (c.fovMax - c.fovMin) * clamp((kmh - 40) / 80, 0, 1);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, fov, 2, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
