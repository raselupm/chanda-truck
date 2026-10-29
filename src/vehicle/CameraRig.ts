// Third-person chase camera with lag, speed-based FOV and impact shake; optional driver's-seat cockpit view.

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
  private scale = new THREE.Vector3();

  /** @param eye the driver's-eye anchor on the truck model, used in cockpit view */
  constructor(readonly camera: THREE.PerspectiveCamera, private eye: THREE.Object3D) {}

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
    this.camera.fov = this.fovRange[0];
    this.camera.updateProjectionMatrix();
  }

  /** Camera settings for the current screen shape. */
  private get cfg() {
    return this.camera.aspect < 1 ? { ...CAMERA, ...CAMERA.portrait } : CAMERA;
  }

  private get fovRange(): readonly [number, number] {
    if (this.mode === 'cockpit') return this.camera.aspect < 1 ? CAMERA.cockpit.portraitFov : CAMERA.cockpit.fov;
    return [this.cfg.fovMin, this.cfg.fovMax];
  }

  private compute(t: TruckController): void {
    const h = this.smoothHeading;
    const c = this.cfg;
    this.fwd.set(Math.sin(h), 0, -Math.cos(h));
    this.pos.set(t.x, t.y, t.z).addScaledVector(this.fwd, -c.distance);
    this.pos.y += c.height;
    this.look.set(t.x, t.y + c.lookHeight, t.z).addScaledVector(this.fwd, c.lookAhead);
  }

  update(dt: number, t: TruckController): void {
    this.smoothHeading = damp(this.smoothHeading, t.heading, 2.6, dt);
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
      this.camera.lookAt(this.smoothLook);
    } else {
      // sit in the driver's seat: pitch, roll and bounce come with the truck body
      this.eye.updateWorldMatrix(true, false);
      this.eye.matrixWorld.decompose(this.camera.position, this.camera.quaternion, this.scale);
      // keep the chase camera's state current so switching back doesn't swoop in from far away
      this.smoothLook.copy(this.look);
    }

    if (this.shakeAmp > 0.001) {
      const a = this.shakeAmp;
      this.tmp.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      this.camera.position.add(this.tmp);
      this.camera.rotation.z += (Math.random() - 0.5) * a * 0.05;
      this.shakeAmp *= Math.exp(-5 * dt);
    }

    const kmh = Math.abs(t.kmh);
    const [fovMin, fovMax] = this.fovRange;
    const fov = fovMin + (fovMax - fovMin) * clamp((kmh - 40) / 80, 0, 1);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, fov, 2, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
