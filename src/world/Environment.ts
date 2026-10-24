// Sky dome, clouds, stars, rain, lights, fog and a ground plane that follows the truck.
// Weather.ts decides the look; this class applies it.

import * as THREE from 'three';
import { RENDER } from '../config/tuning';
import { groundTexture } from '../utils/textures';
import { mulberry32 } from '../utils/rng';
import type { WeatherLook } from './Weather';

const GROUND_SIZE = 1600;
const TEX_METRES = 40;
const RAIN_DROPS = 1400;
const RAIN_BOX = { x: 34, y: 26, z: 40 };

export class Environment {
  readonly sky: THREE.Mesh;
  readonly ground: THREE.Mesh;
  private groundTex: THREE.Texture;
  private skyUniforms: { top: { value: THREE.Color }; horizon: { value: THREE.Color } };
  private fog: THREE.Fog;
  private background: THREE.Color;
  private hemi: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private sunDisc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private clouds: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private rain: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private rainPos: Float32Array;
  private rainReady = false;
  private groundMat: THREE.MeshLambertMaterial;

  constructor(scene: THREE.Scene) {
    this.background = new THREE.Color(RENDER.skyColor);
    scene.background = this.background;
    this.fog = new THREE.Fog(RENDER.skyColor, RENDER.fogNear, RENDER.fogFar);
    scene.fog = this.fog;

    this.skyUniforms = {
      top: { value: new THREE.Color(RENDER.skyTop) },
      horizon: { value: new THREE.Color(RENDER.skyColor) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 2.2, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizon, top, pow(h, 0.8)), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const R = RENDER.far * 0.9;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 12), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // Sun by day, moon by night (same disc, recoloured)
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(22, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false, depthWrite: false, transparent: true }),
    );
    this.sunDisc.position.set(-180, 260, -420).multiplyScalar(0.95);
    this.sunDisc.lookAt(0, 0, 0);
    this.sunDisc.renderOrder = -9;
    this.sky.add(this.sunDisc);

    // Stars
    const rng = mulberry32(99);
    const starPos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const a = rng() * Math.PI * 2;
      const e = 0.12 + rng() * 1.3;
      const r = R * 0.97;
      starPos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false }));
    this.stars.renderOrder = -9;
    this.sky.add(this.stars);

    // Cloud layer: flattened low-poly blobs on a ring high in the sky
    const cloudGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rng() * 0.2;
      const elev = 0.12 + rng() * 0.3;
      const r = R * 0.8;
      const cx = Math.cos(a) * Math.cos(elev) * r;
      const cy = Math.sin(elev) * r;
      const cz = Math.sin(a) * Math.cos(elev) * r;
      for (let k = 0; k < 4; k++) {
        const g = new THREE.IcosahedronGeometry(1, 1);
        const sc = 26 + rng() * 30;
        g.scale(sc * 1.8, sc * 0.45, sc);
        g.rotateY(-a);
        g.translate(cx + (rng() - 0.5) * 60, cy + (rng() - 0.5) * 10, cz + (rng() - 0.5) * 60);
        cloudGeos.push(g.toNonIndexed());
      }
    }
    const merged = new THREE.BufferGeometry();
    const total = cloudGeos.reduce((n, g) => n + g.attributes.position.count, 0);
    const cp = new Float32Array(total * 3);
    let off = 0;
    for (const g of cloudGeos) {
      cp.set(g.attributes.position.array as Float32Array, off);
      off += g.attributes.position.count * 3;
    }
    merged.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    this.clouds = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    this.clouds.renderOrder = -8;
    this.clouds.frustumCulled = false;
    this.sky.add(this.clouds);

    this.hemi = new THREE.HemisphereLight(0xfff0d8, 0x6b5a32, 1.5);
    scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(0xffe3b5, 1.7);
    this.sunLight.position.set(-40, 80, 30);
    scene.add(this.sunLight);

    this.groundTex = groundTexture();
    this.groundTex.repeat.set(GROUND_SIZE / TEX_METRES, GROUND_SIZE / TEX_METRES);
    this.groundMat = new THREE.MeshLambertMaterial({ map: this.groundTex });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.renderOrder = -5;
    scene.add(this.ground);

    // Rain: short streaks in a box that travels with the camera
    this.rainPos = new Float32Array(RAIN_DROPS * 6);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  /** Apply a blended weather look. */
  apply(look: WeatherLook, flash: number): void {
    this.skyUniforms.top.value.copy(look.skyTop).lerp(WHITE, flash * 0.5);
    this.skyUniforms.horizon.value.copy(look.horizon).lerp(WHITE, flash * 0.6);
    this.background.copy(look.horizon);
    this.fog.color.copy(look.horizon).lerp(WHITE, flash * 0.3);
    this.fog.near = look.fogNear;
    this.fog.far = look.fogFar;
    this.hemi.color.copy(look.hemiSky);
    this.hemi.groundColor.copy(look.hemiGround);
    this.hemi.intensity = look.hemiInt + flash * 3;
    this.sunLight.color.copy(look.sunColor);
    this.sunLight.intensity = look.sunInt;
    this.sunDisc.material.color.copy(look.discColor);
    this.sunDisc.material.opacity = look.discOpacity;
    this.sunDisc.visible = look.discOpacity > 0.02;
    this.sunDisc.scale.setScalar(look.discScale);
    this.clouds.material.color.copy(look.cloudColor).lerp(WHITE, flash * 0.6);
    this.clouds.material.opacity = look.cloudOpacity;
    this.stars.material.opacity = look.stars;
    this.stars.visible = look.stars > 0.02;
    this.rain.material.opacity = look.rain * 0.55;
    this.rain.visible = look.rain > 0.02;
    this.groundMat.color.setScalar(1 - look.wet * 0.25);
  }

  update(dt: number, camera: THREE.Camera, focus: THREE.Vector3, rainLevel: number): void {
    this.sky.position.copy(camera.position);
    this.clouds.rotation.y += dt * 0.004;
    // Snap ground to texture tiles so it doesn't appear to slide
    const gx = Math.round(focus.x / TEX_METRES) * TEX_METRES;
    const gz = Math.round(focus.z / TEX_METRES) * TEX_METRES;
    this.ground.position.set(gx, 0, gz);
    if (this.rain.visible) this.updateRain(dt, camera.position, rainLevel);
  }

  private updateRain(dt: number, c: THREE.Vector3, level: number): void {
    const p = this.rainPos;
    const B = RAIN_BOX;
    if (!this.rainReady) {
      for (let i = 0; i < RAIN_DROPS; i++) {
        const x = c.x + (Math.random() - 0.5) * 2 * B.x;
        const y = c.y + (Math.random() - 0.3) * B.y;
        const z = c.z + (Math.random() - 0.5) * 2 * B.z;
        p.set([x, y, z, x + 0.15, y + 0.9, z], i * 6);
      }
      this.rainReady = true;
    }
    const fall = 26 * dt;
    const active = Math.floor(RAIN_DROPS * Math.min(1, level));
    for (let i = 0; i < RAIN_DROPS; i++) {
      const o = i * 6;
      if (i >= active) {
        p[o + 1] = p[o + 4] = -1000;
        continue;
      }
      let x = p[o];
      let y = p[o + 1] - fall;
      let z = p[o + 2];
      if (y < c.y - B.y * 0.4 || y < -1) y = Math.max(c.y, 2) + B.y * 0.5 + Math.random() * 6;
      if (x < c.x - B.x) x += 2 * B.x;
      else if (x > c.x + B.x) x -= 2 * B.x;
      if (z < c.z - B.z) z += 2 * B.z;
      else if (z > c.z + B.z) z -= 2 * B.z;
      p[o] = x;
      p[o + 1] = y;
      p[o + 2] = z;
      p[o + 3] = x + 0.12;
      p[o + 4] = y + 0.9;
      p[o + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}

const WHITE = new THREE.Color(0xffffff);
