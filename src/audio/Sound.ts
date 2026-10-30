// Audio with the Web Audio API. The engine plays a recording (ENGINE_SOUND: start, idle, running, gear
// change) when it has loaded, a synthesised hum until then; the run-ending crash is a recording too
// (FINAL_CRASH_SOUND). Horn, small crashes, whistle, crowd, coins, beeps and wind are synthesised.

import { ENGINE_SOUND, FINAL_CRASH_SOUND } from '../config/tuning';

const MUTE_KEY = 'sobjir-truck-muted';

/** The recorded engine: idle and running loops (crossfaded by speed) and one-shot parts. */
interface SampleEngine {
  buffer: AudioBuffer;
  bus: GainNode;
  idle: { src: AudioBufferSourceNode; gain: GainNode };
  run: { src: AudioBufferSourceNode; gain: GainNode };
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private engineOsc: OscillatorNode[] = [];
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private hornNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  private windGain!: GainNode;
  private rainGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private muteListeners: ((m: boolean) => void)[] = [];
  private sample: SampleEngine | null = null;
  private finalCrashBuf: AudioBuffer | null = null;
  /** the engine-start part is playing until this time (idle waits for it) */
  private startingUntil = 0;
  /** an engine start was asked for before the recording had loaded */
  private startPending = false;
  private gear = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
    const unlock = () => {
      this.init();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchend', unlock);
  }

  /** Lazily create the audio graph on the first user gesture (autoplay policies). */
  private init(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Engine: detuned saw + square sub through a low-pass
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain).connect(this.master);
    const types: OscillatorType[] = ['sawtooth', 'square', 'sawtooth'];
    const mults = [1, 0.5, 1.01];
    types.forEach((type, i) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 45 * mults[i];
      const g = ctx.createGain();
      g.gain.value = i === 1 ? 0.5 : 0.3;
      o.connect(g).connect(this.engineFilter);
      o.start();
      this.engineOsc.push(o);
    });

    void this.loadEngine(ctx);
    void this.load(ctx, FINAL_CRASH_SOUND.url).then((b) => (this.finalCrashBuf = b));

    // Wind/water ambience
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();

    // Rain hiss
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 1400;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rf).connect(this.rainGain).connect(this.master);
    rain.start(0, 0.7);
  }

  setRain(level: number): void {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(level * 0.09, this.ctx.currentTime, 0.5);
  }

  /** Rolling thunder after a lightning flash. */
  thunder(delay: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    this.noiseBurst(t0, 0.25, 2500, 0.8, 0.25);
    this.noiseBurst(t0 + 0.05, 2.8, 160, 0.7, 0.9);
    this.noiseBurst(t0 + 0.5, 2.2, 90, 0.5, 0.6);
  }

  onMuteChange(fn: (m: boolean) => void): void {
    this.muteListeners.push(fn);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    for (const fn of this.muteListeners) fn(this.muted);
  }

  /** Fetch and decode a recording; null if it is missing or can't be decoded. */
  private async load(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      return res.ok ? await ctx.decodeAudioData(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }

  private async loadEngine(ctx: AudioContext): Promise<void> {
    try {
      const buffer = await this.load(ctx, ENGINE_SOUND.url);
      if (!buffer) return;
      const bus = ctx.createGain();
      bus.gain.value = ENGINE_SOUND.volume;
      bus.connect(this.master);
      const loop = ([from, to]: readonly [number, number]) => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.loopStart = from;
        src.loopEnd = to;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(bus);
        src.start(0, from);
        return { src, gain };
      };
      this.sample = { buffer, bus, idle: loop(ENGINE_SOUND.idle), run: loop(ENGINE_SOUND.running) };
      this.engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      if (this.startPending) this.engineStart();
    } catch {
      /* no recording: keep the synthesised engine */
    }
  }

  /** Play one part of the engine recording once (with a short fade at both ends). */
  private playPart([from, to]: readonly [number, number], volume: number): void {
    const ctx = this.ctx;
    const s = this.sample;
    if (!ctx || !s) return;
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const len = to - from;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.setValueAtTime(volume, now + len - 0.4);
    gain.gain.linearRampToValueAtTime(0, now + len);
    src.connect(gain).connect(s.bus);
    src.start(now, from, len);
  }

  /** The driver turns the key: the engine-start part, then the idle takes over. */
  engineStart(): void {
    const ctx = this.ctx;
    this.gear = 0;
    if (!ctx || !this.sample) {
      this.startPending = true;
      return;
    }
    this.startPending = false;
    this.playPart(ENGINE_SOUND.start, 1);
    this.startingUntil = ctx.currentTime + (ENGINE_SOUND.start[1] - ENGINE_SOUND.start[0]) - 0.5;
  }

  /** speedRatio 0..1, throttle 0..1; running=false silences the engine. kmh picks the gear. */
  setEngine(speedRatio: number, throttle: number, running: boolean, kmh = speedRatio * 115): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.sample) {
      this.setSampleEngine(Math.abs(kmh), throttle, running, now);
      return;
    }
    const base = 42 + speedRatio * 85 + throttle * 12;
    // fake gear shifts so the pitch doesn't rise forever
    const gearFrac = (speedRatio * 4) % 1;
    const f = base * (0.85 + gearFrac * 0.3);
    this.engineOsc.forEach((o, i) => o.frequency.setTargetAtTime(f * [1, 0.5, 1.01][i], now, 0.08));
    this.engineFilter.frequency.setTargetAtTime(350 + throttle * 700 + speedRatio * 600, now, 0.1);
    this.engineGain.gain.setTargetAtTime(running ? 0.06 + throttle * 0.05 + speedRatio * 0.04 : 0, now, 0.15);
  }

  private setSampleEngine(kmh: number, throttle: number, running: boolean, now: number): void {
    const s = this.sample!;
    const E = ENGINE_SOUND;
    const [a, b] = E.idleToRunKmh;
    const k = Math.min(1, Math.max(0, (kmh - a) / (b - a)));
    // gear: the running sound's pitch climbs through each gear and drops back at the shift
    let g = 0;
    while (g < E.gearKmh.length && kmh >= E.gearKmh[g]) g++;
    const lo = g > 0 ? E.gearKmh[g - 1] : 0;
    const hi = g < E.gearKmh.length ? E.gearKmh[g] : 125;
    const frac = Math.min(1, (kmh - lo) / (hi - lo));
    if (running && g > this.gear) this.playPart(E.gearUp, 0.9);
    this.gear = g;
    const starting = now < this.startingUntil;
    s.idle.gain.gain.setTargetAtTime(running && !starting ? (1 - k) * (0.8 + throttle * 0.2) : 0, now, starting ? 0.05 : 0.2);
    s.run.gain.gain.setTargetAtTime(running ? k * (0.65 + throttle * 0.35) : 0, now, 0.2);
    s.idle.src.playbackRate.setTargetAtTime(1 + throttle * 0.1, now, 0.2);
    s.run.src.playbackRate.setTargetAtTime(0.8 + frac * 0.4 + throttle * 0.05, now, 0.15);
  }

  setWind(level: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(level * 0.12, now, 0.4);
    this.windFilter.frequency.setTargetAtTime(400 + Math.sin(now * 0.7) * 150, now, 0.5);
  }

  horn(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.hornNodes) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.01);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 2200;
      gain.connect(filt).connect(this.master);
      const oscs = [392, 494].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      this.hornNodes = { oscs, gain };
    } else if (!on && this.hornNodes) {
      const { oscs, gain } = this.hornNodes;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      oscs.forEach((o) => o.stop(ctx.currentTime + 0.15));
      this.hornNodes = null;
    }
  }

  /** A bus horn from another vehicle (two quick blasts). */
  otherHorn(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const start of [0, 0.35]) {
      const t0 = ctx.currentTime + start;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.08, t0 + 0.02);
      g.gain.setValueAtTime(0.08, t0 + 0.22);
      g.gain.linearRampToValueAtTime(0, t0 + 0.28);
      g.connect(this.master);
      for (const f of [311, 370]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(g);
        o.start(t0);
        o.stop(t0 + 0.3);
      }
    }
  }

  private noiseBurst(t0: number, dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  crash(intensity = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    this.noiseBurst(t0, 0.5 + intensity * 0.6, 1200, 0.7, 0.5 * intensity);
    this.noiseBurst(t0 + 0.05, 0.3, 3500, 2, 0.15 * intensity, 'bandpass');
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(35, t0 + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6 * intensity, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.55);
  }

  /** The crash that ends the run (the recording, or a big synthesised crash without it). */
  finalCrash(delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.finalCrashBuf) {
      if (delay > 0) setTimeout(() => this.crash(1.2), delay * 1000);
      else this.crash(1.2);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.finalCrashBuf;
    const gain = ctx.createGain();
    gain.gain.value = FINAL_CRASH_SOUND.volume;
    src.connect(gain).connect(this.master);
    src.start(ctx.currentTime + delay);
  }

  whistle(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [start, dur] of [[0, 0.35], [0.5, 0.8]]) {
      const t0 = ctx.currentTime + start;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2900;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 28;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.02);
      g.gain.setValueAtTime(0.13, t0 + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + dur + 0.02);
      lfo.stop(t0 + dur + 0.02);
    }
  }

  /** Crowd shouting: formant-filtered noise + a few gliding "voices". */
  crowd(duration = 1.5): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(500 + i * 350, t0);
      for (let k = 0; k < 6; k++) f.frequency.linearRampToValueAtTime(400 + Math.random() * 1400, t0 + (k + 1) * (duration / 6));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      for (let k = 0; k <= 8; k++) g.gain.linearRampToValueAtTime(Math.random() * 0.22, t0 + (k * duration) / 8);
      g.gain.linearRampToValueAtTime(0, t0 + duration + 0.1);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0, Math.random());
      src.stop(t0 + duration + 0.2);
    }
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const st = t0 + Math.random() * duration * 0.5;
      const base = 160 + Math.random() * 120;
      o.frequency.setValueAtTime(base, st);
      o.frequency.linearRampToValueAtTime(base * 1.5, st + 0.25);
      o.frequency.linearRampToValueAtTime(base * 0.9, st + 0.6);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.05, st + 0.05);
      g.gain.linearRampToValueAtTime(0, st + 0.6);
      o.connect(f).connect(g).connect(this.master);
      o.start(st);
      o.stop(st + 0.65);
    }
  }

  coin(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    [0, 0.08, 0.16].forEach((dt, i) => {
      const t0 = ctx.currentTime + dt;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime([1320, 1760, 2093][i], t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.3);
    });
  }

  /** Level-crossing bell: a bright double "ding". */
  bell(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const dt of [0, 0.16]) {
      const t0 = ctx.currentTime + dt;
      for (const [f, v] of [[1480, 0.07], [2960, 0.025]] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        o.connect(g).connect(this.master);
        o.start(t0);
        o.stop(t0 + 0.4);
      }
    }
  }

  /** Long two-tone diesel train horn. */
  trainHorn(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [start, dur] of [[0, 0.9], [1.1, 1.8]]) {
      const t0 = ctx.currentTime + start;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.1, t0 + 0.08);
      g.gain.setValueAtTime(0.1, t0 + dur - 0.15);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      g.connect(f).connect(this.master);
      for (const hz of [233, 277, 349]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz;
        o.connect(g);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      }
    }
  }

  /** Wheels over rail joints: "ta-dak". */
  clack(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    this.noiseBurst(t0, 0.09, 700, 1.5, 0.35, 'bandpass');
    this.noiseBurst(t0 + 0.11, 0.09, 600, 1.5, 0.3, 'bandpass');
  }

  /** Warning alarm (speed camera fine): three urgent high-low "wee-woo"s. */
  alarm(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (let i = 0; i < 6; i++) {
      const t0 = ctx.currentTime + i * 0.2;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = i % 2 ? 740 : 990;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.09, t0 + 0.015);
      g.gain.setValueAtTime(0.09, t0 + 0.17);
      g.gain.linearRampToValueAtTime(0, t0 + 0.19);
      o.connect(f).connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.2);
    }
  }

  beep(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.32);
  }
}
