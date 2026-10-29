// Driver's-seat interior: dashboard with working speedometer and rev counter, steering wheel, wipers that run
// in the rain, drops on the glass and truck-art tassels. It lives in its own small scene, drawn over the world
// after a depth clear, so the main camera keeps its far-reaching near plane.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import type { WeatherLook } from '../world/Weather';
import { toBnDigits } from '../utils/bnNumber';
import { box, buildColored, cone, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { clamp, damp } from '../utils/math';
import { canvasTexture } from '../utils/textures';

/** Driver's eye in truck-body space (right-hand drive) and how far it looks down. */
export const EYE = { x: 0.5, y: 2.62, z: -2.2, tilt: -0.1 } as const;

const SPEEDO_MAX = 120;
const RPM_MAX = 4;
const GLASS = { z: -3.55, bottom: 2.0, top: 2.98, half: 1.1 };
/** km/h where each gear tops out, for a believable rev needle */
const GEARS = [18, 35, 55, 80, SPEEDO_MAX];

export interface CockpitState {
  kmh: number;
  steer: number;
  throttle: number;
  look: WeatherLook;
  flash: number;
}

/** angle (radians, CCW from +x) for a value on a 240° dial */
function dialAngle(v: number, max: number): number {
  return ((210 - (clamp(v, 0, max) / max) * 240) * Math.PI) / 180;
}

function gaugeTexture(max: number, step: number, label: string, redFrom: number, scale = 1): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    const c = 128;
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(c, c, 127, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#121212';
    ctx.beginPath();
    ctx.arc(c, c, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(226,60,48,.85)';
    ctx.beginPath();
    ctx.arc(c, c, 100, -dialAngle(redFrom, max), -dialAngle(max, max));
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= max + 1e-6; v += step / 2) {
      const a = dialAngle(v, max);
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const r0 = 108;
      const r1 = major ? 88 : 96;
      ctx.strokeStyle = v >= redFrom ? '#ff5a4a' : '#f2efe6';
      ctx.lineWidth = major ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c - Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c - Math.sin(a) * r1);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#f2efe6';
        ctx.font = `700 ${max > 10 ? 24 : 28}px "Hind Siliguri", sans-serif`;
        ctx.fillText(toBnDigits(Math.round(v * scale)), c + Math.cos(a) * 68, c - Math.sin(a) * 68);
      }
    }
    ctx.fillStyle = '#bdb6a6';
    ctx.font = '600 20px "Hind Siliguri", sans-serif';
    ctx.fillText(label, c, c + 78);
  });
}

function dropsTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 192, (ctx, w, h) => {
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1.5 + Math.random() * Math.random() * 6;
      ctx.fillStyle = 'rgba(210,225,240,.45)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // a few run down the glass
      if (r > 4 && Math.random() < 0.5) {
        ctx.fillStyle = 'rgba(210,225,240,.3)';
        ctx.fillRect(x - r * 0.35, y, r * 0.7, 10 + Math.random() * 30);
      }
    }
  });
}

export class Cockpit {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 12);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private wheel = new THREE.Group();
  private speedNeedle = new THREE.Group();
  private rpmNeedle = new THREE.Group();
  private wipers: THREE.Group[] = [];
  private ornament = new THREE.Group();
  private dropsMat: THREE.MeshBasicMaterial;
  private digitalTex: THREE.CanvasTexture;
  private digitalCtx: CanvasRenderingContext2D;
  private lampHead: THREE.MeshBasicMaterial;
  private lampWiper: THREE.MeshBasicMaterial;
  private shownKmh = -1;
  private rpm = 0.8;
  private wiperPhase = 0;
  private wiping = false;
  private drops = 0;

  constructor() {
    this.camera.position.set(EYE.x, EYE.y, EYE.z);
    this.camera.rotation.set(EYE.tilt, 0, 0);
    this.sun.position.set(-0.3, 1, -0.6);
    this.scene.add(this.hemi, this.sun, this.camera);
    const mat = vertexColorMaterial();
    const { z: gz, bottom, top, half } = GLASS;
    const gh = top - bottom;

    // Cab shell: dashboard, windscreen frame with the old Tata centre post, roof, doors
    const shell: Part[] = [
      { geo: box(2.4, 0.6, 0.6), color: 0x2b2522, p: [0, bottom - 0.3, gz + 0.28] },
      { geo: box(2.4, 0.05, 0.62), color: 0x3a312b, p: [0, bottom, gz + 0.28] },
      // red dash cloth with a yellow trim, like most Bangladeshi trucks
      { geo: box(2.3, 0.02, 0.5), color: 0xb3202a, p: [0, bottom + 0.035, gz + 0.3] },
      { geo: box(2.3, 0.08, 0.02), color: 0xf2c230, p: [0, bottom - 0.01, gz + 0.56] },
      // frame
      { geo: box(0.14, gh + 0.1, 0.12), color: 0xd98a00, p: [-half - 0.04, (top + bottom) / 2, gz] },
      { geo: box(0.14, gh + 0.1, 0.12), color: 0xd98a00, p: [half + 0.04, (top + bottom) / 2, gz] },
      { geo: box(0.05, gh, 0.06), color: 0xd98a00, p: [0, (top + bottom) / 2, gz] },
      { geo: box(2.5, 0.1, 0.12), color: 0xd98a00, p: [0, top + 0.05, gz] },
      { geo: box(2.5, 0.06, 0.1), color: 0x9a6400, p: [0, bottom + 0.02, gz + 0.02] },
      // roof lining and sun visors
      { geo: box(2.5, 0.06, 2.1), color: 0x6e5a45, p: [0, top + 0.13, gz + 1.05] },
      { geo: box(0.85, 0.03, 0.3), color: 0x4d3f31, p: [-0.55, top + 0.06, gz + 0.22], r: [0.25, 0, 0] },
      { geo: box(0.85, 0.03, 0.3), color: 0x4d3f31, p: [0.55, top + 0.06, gz + 0.22], r: [0.25, 0, 0] },
      // doors: lower panel, window frame
      { geo: box(0.08, 1.0, 1.9), color: 0xc77d00, p: [-1.22, 1.75, gz + 0.95] },
      { geo: box(0.08, 1.0, 1.9), color: 0xc77d00, p: [1.22, 1.75, gz + 0.95] },
      { geo: box(0.09, 0.12, 1.9), color: 0x8a5a00, p: [-1.22, 2.3, gz + 0.95] },
      { geo: box(0.09, 0.12, 1.9), color: 0x8a5a00, p: [1.22, 2.3, gz + 0.95] },
      { geo: box(0.1, 0.75, 0.12), color: 0xd98a00, p: [-1.22, 2.6, gz + 1.9] },
      { geo: box(0.1, 0.75, 0.12), color: 0xd98a00, p: [1.22, 2.6, gz + 1.9] },
      // instrument binnacle in front of the driver
      { geo: box(0.6, 0.27, 0.1), color: 0x1a1614, p: [EYE.x, bottom + 0.15, gz + 0.42], r: [-0.45, 0, 0] },
      { geo: box(0.64, 0.03, 0.14), color: 0x1a1614, p: [EYE.x, bottom + 0.29, gz + 0.4], r: [-0.45, 0, 0] },
      // rear-view mirror
      { geo: box(0.025, 0.08, 0.025), color: 0x222222, p: [-0.15, top - 0.04, gz + 0.1] },
      { geo: box(0.24, 0.07, 0.03), color: 0x222222, p: [-0.15, top - 0.1, gz + 0.12] },
      { geo: box(0.21, 0.05, 0.01), color: 0x9fb4c4, p: [-0.15, top - 0.1, gz + 0.14] },
      // steering column
      { geo: cyl(0.04, 0.05, 0.5, 6), color: 0x1a1a1a, p: [EYE.x, 1.82, gz + 0.78], r: [-0.95, 0, 0] },
      // gear lever
      { geo: cyl(0.015, 0.015, 0.45, 5), color: 0x333333, p: [0.05, 1.72, gz + 0.85], r: [-0.3, 0, 0] },
      { geo: cyl(0.045, 0.045, 0.06, 8), color: 0x111111, p: [0.05, 1.95, gz + 0.78] },
    ];
    // tassel garland along the top of the windscreen
    const colors = [0xe63946, 0xffd166, 0x2a9d8f, 0xf72585, 0x4361ee, 0xff8c1a];
    for (let i = 0; i < 36; i++) {
      const x = -1.05 + i * 0.06;
      const len = 0.05 + ((i * 37) % 5) * 0.008;
      shell.push({ geo: cone(0.016, len, 4), color: colors[i % colors.length], p: [x, top - 0.02 - len / 2, gz + 0.09], r: [Math.PI, 0, 0] });
    }
    shell.push({ geo: box(2.15, 0.02, 0.02), color: 0xf2c230, p: [0, top - 0.01, gz + 0.09] });
    this.scene.add(new THREE.Mesh(buildColored(shell), mat));

    // Ornament hanging from the mirror; sways with the truck
    this.ornament.position.set(-0.15, top - 0.14, gz + 0.12);
    this.ornament.add(
      new THREE.Mesh(
        buildColored([
          { geo: box(0.004, 0.1, 0.004), color: 0xf2c230, p: [0, -0.05, 0] },
          { geo: cone(0.02, 0.04, 6), color: 0xe63946, p: [0, -0.11, 0], r: [Math.PI, 0, 0] },
          { geo: cone(0.016, 0.07, 5), color: 0xffd166, p: [0, -0.16, 0], r: [Math.PI, 0, 0] },
        ]),
        mat,
      ),
    );
    this.scene.add(this.ornament);

    // Steering wheel
    const wheelPos = new THREE.Group();
    wheelPos.position.set(EYE.x, 1.98, gz + 0.9);
    wheelPos.rotation.x = -0.55;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.024, 6, 22), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
    const spokes = new THREE.Mesh(
      buildColored([
        { geo: box(0.44, 0.04, 0.02), color: 0x2c2c2c, p: [0, -0.02, 0] },
        { geo: box(0.04, 0.22, 0.02), color: 0x2c2c2c, p: [0, -0.12, 0] },
        { geo: cyl(0.06, 0.06, 0.04, 10), color: 0xc1121f, r: [Math.PI / 2, 0, 0] },
      ]),
      mat,
    );
    this.wheel.add(rim, spokes);
    wheelPos.add(this.wheel);
    this.scene.add(wheelPos);

    // Gauges, tilted up toward the driver
    const binnacle = new THREE.Group();
    binnacle.position.set(EYE.x, bottom + 0.15, gz + 0.48);
    binnacle.rotation.x = -0.45;
    this.scene.add(binnacle);
    const needleGeo = buildColored([{ geo: box(0.008, 0.1, 0.004), color: 0xff7a1a, p: [0, 0.04, 0] }]);
    const needleMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const gauge = (x: number, r: number, tex: THREE.Texture, needle: THREE.Group) => {
      const face = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map: tex }));
      face.position.set(x, 0, 0);
      binnacle.add(face);
      needle.position.set(x, 0, 0.006);
      const n = new THREE.Mesh(needleGeo, needleMat);
      n.scale.set(1, r / 0.12, 1);
      needle.add(n, new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), new THREE.MeshBasicMaterial({ color: 0x333333 })));
      needle.children[1].position.z = 0.002;
      binnacle.add(needle);
    };
    gauge(0.1, 0.11, gaugeTexture(SPEEDO_MAX, 20, 'কিমি/ঘণ্টা', ECONOMY.ramSpeedKmh), this.speedNeedle);
    gauge(-0.15, 0.085, gaugeTexture(RPM_MAX, 1, 'RPM ×১০০০', 3.2), this.rpmNeedle);

    // digital speed readout under the speedometer
    const dc = document.createElement('canvas');
    dc.width = 128;
    dc.height = 48;
    this.digitalCtx = dc.getContext('2d')!;
    this.digitalTex = new THREE.CanvasTexture(dc);
    this.digitalTex.colorSpace = THREE.SRGBColorSpace;
    const digital = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.028), new THREE.MeshBasicMaterial({ map: this.digitalTex }));
    digital.position.set(0.1, -0.06, 0.008);
    binnacle.add(digital);

    // warning lamps: headlights (green) and wipers (blue)
    this.lampHead = new THREE.MeshBasicMaterial({ color: 0x113311 });
    this.lampWiper = new THREE.MeshBasicMaterial({ color: 0x111a33 });
    const lampGeo = new THREE.CircleGeometry(0.014, 10);
    for (const [y, m] of [[0.05, this.lampHead], [0.0, this.lampWiper]] as const) {
      const l = new THREE.Mesh(lampGeo, m);
      l.position.set(-0.03, y * 0.8, 0.004);
      binnacle.add(l);
    }

    // Rain on the glass
    this.dropsMat = new THREE.MeshBasicMaterial({ map: dropsTexture(), transparent: true, opacity: 0, depthWrite: false });
    const drops = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, gh), this.dropsMat);
    drops.position.set(0, (top + bottom) / 2, gz + 0.01);
    this.scene.add(drops);

    // Wipers: pivots on the bottom of the glass, parked pointing left
    const bladeGeo = buildColored([
      { geo: box(0.014, 0.72, 0.012), color: 0x151515, p: [0, 0.36, 0] },
      { geo: box(0.022, 0.6, 0.018), color: 0x0a0a0a, p: [0, 0.42, 0.015] },
      { geo: cyl(0.03, 0.03, 0.03, 8), color: 0x222222, r: [Math.PI / 2, 0, 0] },
    ]);
    for (const x of [-0.78, 0.32]) {
      const w = new THREE.Group();
      w.position.set(x, bottom + 0.04, gz + 0.05);
      w.add(new THREE.Mesh(bladeGeo, mat));
      this.scene.add(w);
      this.wipers.push(w);
    }
    this.setWipers(0);
  }

  /** 0 = parked, 1 = fully swept up */
  private setWipers(u: number): void {
    const a = THREE.MathUtils.degToRad(86 - 100 * u);
    for (const w of this.wipers) w.rotation.z = a;
  }

  update(dt: number, mainCam: THREE.PerspectiveCamera, s: CockpitState): void {
    if (this.camera.fov !== mainCam.fov || this.camera.aspect !== mainCam.aspect) {
      this.camera.fov = mainCam.fov;
      this.camera.aspect = mainCam.aspect;
      this.camera.updateProjectionMatrix();
    }
    const L = s.look;
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiInt * 0.9 + s.flash * 2.5;
    this.sun.color.copy(L.sunColor);
    this.sun.intensity = L.sunInt * 0.6;

    const kmh = Math.abs(s.kmh);
    this.speedNeedle.rotation.z = dialAngle(kmh, SPEEDO_MAX) - Math.PI / 2;
    const gear = GEARS.findIndex((g) => kmh <= g);
    const lo = gear > 0 ? GEARS[gear - 1] : 0;
    const hi = GEARS[Math.max(0, gear)];
    const frac = (kmh - lo) / (hi - lo);
    const rpmTarget = 0.8 + (gear === 0 ? frac * 1.6 : 1.3 + frac * 1.6) * (kmh > 1 ? 1 : 0) + s.throttle * 0.5;
    this.rpm = damp(this.rpm, rpmTarget, 6, dt);
    this.rpmNeedle.rotation.z = dialAngle(this.rpm, RPM_MAX) - Math.PI / 2;
    const shown = Math.round(kmh);
    if (shown !== this.shownKmh) {
      this.shownKmh = shown;
      const ctx = this.digitalCtx;
      ctx.fillStyle = '#0b1a0e';
      ctx.fillRect(0, 0, 128, 48);
      ctx.fillStyle = kmh >= ECONOMY.ramSpeedKmh ? '#ff5a4a' : '#7dff8a';
      ctx.font = '700 38px "Hind Siliguri", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(toBnDigits(shown), 64, 27);
      this.digitalTex.needsUpdate = true;
    }

    this.wheel.rotation.z = -s.steer * 1.9;
    this.ornament.rotation.z = damp(this.ornament.rotation.z, s.steer * 0.35 * Math.min(1, kmh / 40), 3, dt);
    this.ornament.rotation.x = Math.sin(performance.now() * 0.004) * 0.06 * Math.min(1, kmh / 20);

    // Wipers run while it rains (faster in a storm) and finish their sweep before parking
    const rain = L.rain;
    if (rain > 0.08) this.wiping = true;
    if (this.wiping) {
      const before = this.wiperPhase;
      this.wiperPhase += dt * Math.PI * 2 * (rain > 0.8 ? 1.1 : 0.7);
      // passing the top of the sweep clears the glass
      if (before < Math.PI && this.wiperPhase >= Math.PI) this.drops *= 0.15;
      if (this.wiperPhase >= Math.PI * 2) {
        this.wiperPhase -= Math.PI * 2;
        if (rain <= 0.08) {
          this.wiping = false;
          this.wiperPhase = 0;
        }
      }
    }
    this.setWipers(0.5 - 0.5 * Math.cos(this.wiperPhase));
    this.drops = rain > 0.02 ? Math.min(rain, this.drops + rain * dt * 0.7) : Math.max(0, this.drops - dt * 0.15);
    this.dropsMat.opacity = this.drops * 0.85;

    this.lampHead.color.setHex(L.headlights > 0.3 ? 0x34ff5a : 0x113311);
    this.lampWiper.color.setHex(this.wiping ? 0x3fa9ff : 0x111a33);
  }

  /** Draw the cab over the already-rendered world. */
  render(renderer: THREE.WebGLRenderer): void {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
}
