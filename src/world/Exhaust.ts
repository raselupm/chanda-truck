// Exhaust smoke: soft black puffs from every motor vehicle's tailpipe. They drift back and up, swell and
// fade. One pooled point cloud for the whole road.

import * as THREE from 'three';
import { EXHAUST, WORLD } from '../config/tuning';

const MAX = 2000;

export interface Pipe {
  /** tailpipe in the model's own space (rear = +z) */
  readonly pipe: readonly [number, number, number];
  readonly rate: number;
  readonly size: number;
  readonly alpha: number;
}

const VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  uniform float uScale;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(uColor, vAlpha * (1.0 - d) * (1.0 - d));
    #include <fog_fragment>
  }
`;

export class Exhaust {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private size0 = new Float32Array(MAX);
  private alpha0 = new Float32Array(MAX);
  private age = new Float32Array(MAX).fill(Infinity);
  private next = 0;
  private geo = new THREE.BufferGeometry();

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 500 }, uColor: { value: new THREE.Color(0x141414) } }]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    // point sizes in pixels: world size × focal length in pixels / distance
    const buf = new THREE.Vector2();
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(buf);
      mat.uniforms.uScale.value = (buf.y / 2) * camera.projectionMatrix.elements[5];
    };
  }

  reset(): void {
    this.age.fill(Infinity);
    this.alpha.fill(0);
  }

  /**
   * Smoke from a vehicle this frame. x/y/z and yaw are its model's position and rotation.y,
   * speed its signed speed (m/s on the speedometer). rate/size/alpha override the pipe's own.
   */
  emit(dt: number, x: number, y: number, z: number, yaw: number, speed: number, p: Pipe, rate = p.rate, size = p.size, alpha = p.alpha): void {
    const n = Math.floor(rate * dt + Math.random());
    if (n <= 0) return;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const [ox, oy, oz] = p.pipe;
    const px = x + ox * cos + oz * sin;
    const pz = z - ox * sin + oz * cos;
    // the vehicle's velocity (forward is the model's -z)
    const v = speed * WORLD.speedScale;
    const vx = -sin * v;
    const vz = -cos * v;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      // spread over the frame so a fast vehicle leaves a trail, not a dotted line
      const back = Math.random() * dt;
      this.pos[i * 3] = px - vx * back + (Math.random() - 0.5) * 0.15;
      this.pos[i * 3 + 1] = y + oy;
      this.pos[i * 3 + 2] = pz - vz * back + (Math.random() - 0.5) * 0.15;
      // blown out backwards, keeping a little of the vehicle's speed
      this.vel[i * 3] = vx * 0.3 + sin * 1.4 + (Math.random() - 0.5) * 0.6;
      this.vel[i * 3 + 1] = 0.5 + Math.random() * 0.5;
      this.vel[i * 3 + 2] = vz * 0.3 + cos * 1.4 + (Math.random() - 0.5) * 0.6;
      this.size0[i] = size * (0.8 + Math.random() * 0.4);
      this.alpha0[i] = alpha * (0.8 + Math.random() * 0.2);
      this.age[i] = 0;
    }
  }

  update(dt: number): void {
    const life = EXHAUST.life;
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] >= life) {
        this.alpha[i] = 0;
        continue;
      }
      const a = (this.age[i] += dt);
      const t = Math.min(1, a / life);
      const j = i * 3;
      this.vel[j] *= drag;
      this.vel[j + 2] *= drag;
      // warm smoke rises
      this.vel[j + 1] = this.vel[j + 1] * drag + 0.9 * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] = this.size0[i] * (1 + (EXHAUST.swell - 1) * Math.sqrt(t));
      this.alpha[i] = this.alpha0[i] * Math.min(1, a / 0.08) * (1 - t) * (1 - t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
