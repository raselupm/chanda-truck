// Random, slowly changing weather and time of day:
// দিন (day), বিকেল/সন্ধ্যা (evening), রাত (night), মেঘলা (cloudy), বৃষ্টি (rainy), ঝড় (thunderstorm).
// Each state holds for a while, then blends smoothly into a neighbouring state.

import * as THREE from 'three';
import { WEATHER } from '../config/tuning';
import { smoothstep } from '../utils/math';

export type WeatherKind = 'day' | 'evening' | 'night' | 'cloudy' | 'rainy' | 'storm';

export interface WeatherLook {
  skyTop: THREE.Color;
  horizon: THREE.Color;
  fogNear: number;
  fogFar: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiInt: number;
  sunColor: THREE.Color;
  sunInt: number;
  discColor: THREE.Color;
  discOpacity: number;
  discScale: number;
  cloudColor: THREE.Color;
  cloudOpacity: number;
  stars: number;
  /** 0..1 */
  rain: number;
  /** 0..1 how often lightning strikes */
  lightning: number;
  /** 0..1 vehicle headlights */
  headlights: number;
  /** 0..1 darkens the ground when wet */
  wet: number;
}

/** Colours as hex numbers, everything else as plain numbers. */
type Preset = Record<keyof WeatherLook, number>;

const PRESETS: Record<WeatherKind, Preset> = {
  day: {
    skyTop: 0x8fb8d8, horizon: 0xf1d9b4, fogNear: 140, fogFar: 560, hemiSky: 0xfff0d8, hemiGround: 0x6b5a32, hemiInt: 1.5,
    sunColor: 0xffe3b5, sunInt: 1.7, discColor: 0xfff3d0, discOpacity: 1, discScale: 1, cloudColor: 0xffffff, cloudOpacity: 0.55,
    stars: 0, rain: 0, lightning: 0, headlights: 0, wet: 0,
  },
  evening: {
    skyTop: 0x4a5d8f, horizon: 0xf0a060, fogNear: 120, fogFar: 520, hemiSky: 0xffc89a, hemiGround: 0x4a3a2a, hemiInt: 1.05,
    sunColor: 0xff9a50, sunInt: 1.3, discColor: 0xff9a40, discOpacity: 1, discScale: 1.5, cloudColor: 0xffaa80, cloudOpacity: 0.65,
    stars: 0.1, rain: 0, lightning: 0, headlights: 0.6, wet: 0,
  },
  night: {
    skyTop: 0x070c18, horizon: 0x1a2232, fogNear: 50, fogFar: 380, hemiSky: 0x6070a0, hemiGround: 0x15151c, hemiInt: 0.5,
    sunColor: 0x8090c0, sunInt: 0.35, discColor: 0xe4ecff, discOpacity: 0.95, discScale: 0.6, cloudColor: 0x2a3040, cloudOpacity: 0.45,
    stars: 1, rain: 0, lightning: 0, headlights: 1, wet: 0,
  },
  cloudy: {
    skyTop: 0x9aa3ab, horizon: 0xc9c6bd, fogNear: 110, fogFar: 470, hemiSky: 0xe8e8e8, hemiGround: 0x5a5a4a, hemiInt: 1.3,
    sunColor: 0xdddddd, sunInt: 0.7, discColor: 0xffffff, discOpacity: 0, discScale: 1, cloudColor: 0xc4c8cc, cloudOpacity: 0.95,
    stars: 0, rain: 0, lightning: 0, headlights: 0.15, wet: 0,
  },
  rainy: {
    skyTop: 0x6d757d, horizon: 0x9aa0a3, fogNear: 60, fogFar: 340, hemiSky: 0xc8d0d8, hemiGround: 0x404848, hemiInt: 1.0,
    sunColor: 0xb0b8c0, sunInt: 0.45, discColor: 0xffffff, discOpacity: 0, discScale: 1, cloudColor: 0x7a8088, cloudOpacity: 1,
    stars: 0, rain: 0.7, lightning: 0, headlights: 0.6, wet: 1,
  },
  storm: {
    skyTop: 0x343943, horizon: 0x5c6269, fogNear: 45, fogFar: 290, hemiSky: 0xa0a8b8, hemiGround: 0x2a2e30, hemiInt: 0.75,
    sunColor: 0x8890a0, sunInt: 0.3, discColor: 0xffffff, discOpacity: 0, discScale: 1, cloudColor: 0x474c55, cloudOpacity: 1,
    stars: 0, rain: 1, lightning: 1, headlights: 0.9, wet: 1,
  },
};

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  day: '☀️ দিন',
  evening: '🌇 সন্ধ্যা',
  night: '🌙 রাত',
  cloudy: '☁️ মেঘলা',
  rainy: '🌧️ বৃষ্টি',
  storm: '⛈️ ঝড়-বজ্রপাত',
};

/** Which states each state can drift into (keeps changes believable). */
const NEXT: Record<WeatherKind, WeatherKind[]> = {
  day: ['evening', 'cloudy', 'cloudy'],
  evening: ['night', 'night', 'cloudy'],
  night: ['day', 'rainy', 'cloudy'],
  cloudy: ['day', 'rainy', 'rainy', 'evening'],
  rainy: ['cloudy', 'storm', 'night'],
  storm: ['rainy', 'cloudy'],
};

function toLook(p: Preset): WeatherLook {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    out[k] = COLOR_KEYS.has(k) ? new THREE.Color(v) : v;
  }
  return out as unknown as WeatherLook;
}

const COLOR_KEYS = new Set(['skyTop', 'horizon', 'hemiSky', 'hemiGround', 'sunColor', 'discColor', 'cloudColor']);
const LOOKS: Record<WeatherKind, WeatherLook> = Object.fromEntries(
  Object.entries(PRESETS).map(([k, p]) => [k, toLook(p)]),
) as Record<WeatherKind, WeatherLook>;

export class Weather {
  current: WeatherKind;
  target: WeatherKind;
  /** 0..1 progress of the current blend */
  private blend = 1;
  private holdTimer: number;
  readonly look: WeatherLook = toLook(PRESETS.day);
  /** lightning flash brightness 0..1 */
  flash = 0;
  private flashTimer = 0;
  private boltTimer = 3;
  private changeListeners: ((k: WeatherKind) => void)[] = [];
  private thunderListeners: ((delay: number) => void)[] = [];

  constructor() {
    const starts: WeatherKind[] = ['day', 'day', 'cloudy', 'evening', 'rainy'];
    this.current = this.target = starts[Math.floor(Math.random() * starts.length)];
    this.holdTimer = this.randomHold();
    this.mix(1);
  }

  onChange(fn: (k: WeatherKind) => void): void {
    this.changeListeners.push(fn);
  }

  onThunder(fn: (delay: number) => void): void {
    this.thunderListeners.push(fn);
  }

  /** Name of the state we're in or heading to. */
  get label(): string {
    return WEATHER_LABEL[this.blend < 0.5 ? this.current : this.target];
  }

  private randomHold(): number {
    return WEATHER.holdMin + Math.random() * (WEATHER.holdMax - WEATHER.holdMin);
  }

  /** Jump to a random new state immediately (new run). */
  randomize(): void {
    const all = Object.keys(PRESETS) as WeatherKind[];
    this.current = this.target = all[Math.floor(Math.random() * all.length)];
    this.blend = 1;
    this.holdTimer = this.randomHold();
    this.mix(1);
    for (const fn of this.changeListeners) fn(this.current);
  }

  private mix(t: number): void {
    const a = LOOKS[this.current];
    const b = LOOKS[this.target];
    const e = smoothstep(0, 1, t);
    const L = this.look as unknown as Record<string, number | THREE.Color>;
    for (const key of Object.keys(PRESETS.day)) {
      const av = (a as unknown as Record<string, number | THREE.Color>)[key];
      const bv = (b as unknown as Record<string, number | THREE.Color>)[key];
      if (av instanceof THREE.Color) (L[key] as THREE.Color).copy(av).lerp(bv as THREE.Color, e);
      else L[key] = (av as number) + ((bv as number) - (av as number)) * e;
    }
  }

  update(dt: number): void {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / WEATHER.blendSeconds);
      this.mix(this.blend);
      if (this.blend >= 1) this.current = this.target;
    } else {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        const options = NEXT[this.current];
        this.target = options[Math.floor(Math.random() * options.length)];
        this.blend = 0;
        this.holdTimer = this.randomHold();
        for (const fn of this.changeListeners) fn(this.target);
      }
    }

    // Lightning
    if (this.look.lightning > 0.5) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltTimer = 3 + Math.random() * 7;
        this.flashTimer = 0.35;
        for (const fn of this.thunderListeners) fn(0.3 + Math.random() * 1.4);
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      // double flicker
      const t = this.flashTimer;
      this.flash = t > 0.25 ? 1 : t > 0.18 ? 0.2 : t > 0.08 ? 0.8 : Math.max(0, t / 0.08) * 0.5;
    } else this.flash = 0;
  }
}
