// Aircraft over the road on every route: airliners and turboprops on their way in and out of Dhaka, Air Force
// fighters on a low pass, and helicopters (military Mi-17s, civil Bell 212s). Each flight is a straight pass
// that crosses the sky ahead of the truck (helicopters sometimes follow the road), fades in and out at its
// ends, spins its rotors and propellers, shows navigation lights after dark and has its own Doppler sound.
// High flights drift along with the truck (they're far away, so they barely move against the sky).

import * as THREE from 'three';
import { AIRCRAFT } from '../config/tuning';
import type { AircraftSound, AircraftVoice } from '../audio/Sound';
import type { Game } from '../game/Game';
import { bell212, f7, LIVERIES, mi17, mig29, narrowBody, turboprop, wideBody, type AircraftModel } from './AircraftModels';

type Kind = keyof typeof AIRCRAFT.weights;
type V3 = [number, number, number];

const SOUND: Record<Kind, AircraftSound> = {
  wideBody: 'airliner', narrowBody: 'airliner', turboprop: 'prop', f7: 'jet', mig29: 'jet', mi17: 'rotorHeavy', bell212: 'rotorLight',
};
/** distance (m) at which each kind's sound is full volume */
const SOUND_REF: Record<AircraftSound, number> = { jet: 140, airliner: 160, prop: 110, rotorHeavy: 75, rotorLight: 60 };
const SPEED_OF_SOUND = 340;

interface Profile {
  alt: readonly number[];
  ahead: readonly number[];
  speed: number;
  scale: number;
  pass: number;
  /** how much of the truck's own motion the flight shares (1 = fixed against the sky) */
  follow: number;
  descent: number;
  fog: boolean;
  gear: boolean;
  contrail: boolean;
}

interface Flight {
  kind: Kind;
  group: THREE.Group;
  mat: THREE.MeshLambertMaterial;
  extraMats: THREE.Material[];
  spinners: { mesh: THREE.Mesh; axis: 'x' | 'y' | 'z'; rate: number }[];
  navMat: THREE.PointsMaterial;
  beacon: THREE.Points | null;
  glow: THREE.Mesh[];
  contrails: THREE.Mesh[];
  from: THREE.Vector3;
  dir: THREE.Vector3;
  p: Profile;
  /** metres flown along the pass */
  t: number;
  /** truck position at spawn (for `follow`) */
  anchor: THREE.Vector3;
  /** the lead aircraft of its flight (a formation's wingmen are not) */
  lead: boolean;
  voice: AircraftVoice | null;
  lastDist: number;
  blink: number;
}

const models = new Map<string, AircraftModel>();

function model(kind: Kind, livery: keyof typeof LIVERIES): AircraftModel {
  const key = `${kind}:${livery}`;
  let m = models.get(key);
  if (!m) {
    const c = LIVERIES[livery];
    m = { wideBody: () => wideBody(c), narrowBody: () => narrowBody(c), turboprop: () => turboprop(c), f7, mig29, mi17, bell212 }[kind]();
    models.set(key, m);
  }
  return m;
}

let contrailGeo: THREE.BufferGeometry | null = null;
let contrailAlpha: THREE.Texture | null = null;
let glowGeo: THREE.BufferGeometry | null = null;

/** A white trail widening behind an engine, fading out at its far end (model space, long). */
function contrailMaterial(): THREE.MeshBasicMaterial {
  contrailAlpha ??= (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#000');
    g.addColorStop(0.06, '#fff');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  })();
  return new THREE.MeshBasicMaterial({ color: 0xffffff, alphaMap: contrailAlpha, transparent: true, opacity: 0, depthWrite: false, fog: false });
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Aircraft {
  readonly group = new THREE.Group();
  private flights: Flight[] = [];
  private timer: number = AIRCRAFT.firstAfter;
  private time = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(private game: Game) {}

  reset(): void {
    for (const f of this.flights) this.remove(f);
    this.flights = [];
    this.timer = AIRCRAFT.firstAfter;
  }

  update(dt: number, night: number, paused: boolean): void {
    const g = this.game;
    if (paused) {
      for (const f of this.flights) f.voice?.set(0, 1);
      return;
    }
    this.time += dt;
    this.timer -= dt;
    const leaders = this.flights.filter((f) => f.lead).length;
    if (this.timer <= 0) {
      this.timer = rand(AIRCRAFT.gapMin, AIRCRAFT.gapMax);
      if (leaders < AIRCRAFT.maxAtOnce) this.spawn();
    }
    const tr = g.truck;
    const truckPos = this.tmp.set(tr.x, tr.y, tr.z);
    const ear = g.cam.camera.position;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += f.p.speed * dt;
      const u = f.t / f.p.pass;
      if (u >= 1) {
        this.remove(f);
        this.flights.splice(i, 1);
        continue;
      }
      const pos = f.group.position.copy(f.from).addScaledVector(f.dir, f.t);
      pos.y -= f.p.descent * f.t;
      if (f.p.follow) pos.add(this.tmp2.copy(truckPos).sub(f.anchor).multiplyScalar(f.p.follow));
      // fade in and out at the ends of the pass
      const fade = Math.min(1, u / AIRCRAFT.fade, (1 - u) / AIRCRAFT.fade);
      f.mat.opacity = fade;
      f.mat.transparent = fade < 0.999;
      f.mat.depthWrite = fade > 0.5;
      for (const c of f.contrails) (c.material as THREE.MeshBasicMaterial).opacity = 0.45 * fade;
      f.navMat.opacity = fade * (0.15 + 0.85 * night);
      if (f.beacon) f.beacon.visible = (this.time + f.blink) % 1.1 < 0.12;
      for (const s of f.spinners) s.mesh.rotation[s.axis] += s.rate * dt;
      for (const gl of f.glow) {
        gl.scale.setScalar(0.85 + Math.random() * 0.3);
        (gl.material as THREE.MeshBasicMaterial).opacity = fade * (0.55 + 0.25 * night);
      }
      if (f.voice) {
        const d = pos.distanceTo(ear);
        // approaching = higher pitch
        const vr = dt > 0 && f.lastDist > 0 ? (d - f.lastDist) / dt : 0;
        f.lastDist = d;
        const ref = SOUND_REF[SOUND[f.kind]] * (f.p.contrail ? 1.6 : 1);
        const level = Math.min(1, (ref / Math.max(d, 1)) ** 1.6) * fade;
        const pitch = THREE.MathUtils.clamp(SPEED_OF_SOUND / (SPEED_OF_SOUND + vr), 0.7, 1.35);
        f.voice.set(level, pitch);
      }
    }
  }

  private pickKind(nearDhaka: boolean): Kind {
    const w = { ...AIRCRAFT.weights } as Record<Kind, number>;
    if (nearDhaka) {
      w.wideBody *= 2.5;
      w.narrowBody *= 2.5;
      w.turboprop *= 1.5;
    }
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(w) as Kind[]) if ((r -= w[k]) <= 0) return k;
    return 'narrowBody';
  }

  /** Send a flight over now (a random kind unless one is given: handy from the console). */
  spawn(force?: Kind): void {
    const g = this.game;
    const tr = g.truck;
    const market = g.route.events.find((e) => e.type === 'market');
    const nearDhaka = !!market && tr.s > market.s - AIRCRAFT.approachRange;
    const kind = force ?? this.pickKind(nearDhaka);
    const A = AIRCRAFT;
    const airliner = kind === 'wideBody' || kind === 'narrowBody';
    const heli = kind === 'mi17' || kind === 'bell212';
    const fighter = kind === 'f7' || kind === 'mig29';
    let p: Profile;
    if ((airliner || kind === 'turboprop') && nearDhaka) {
      p = { ...A.approach, follow: 0.35, fog: true, gear: true, contrail: false };
    } else if (airliner) {
      p = { ...A.cruise, follow: 1, descent: 0, fog: false, gear: false, contrail: true };
    } else if (kind === 'turboprop') {
      p = { ...A.turboprop, follow: 0.7, descent: 0, fog: false, gear: false, contrail: false };
    } else if (fighter) {
      p = { ...A.fighter, follow: 0, descent: 0, fog: true, gear: false, contrail: false };
    } else {
      p = { ...A.helicopter, follow: 0, descent: 0, fog: true, gear: false, contrail: false };
    }
    const h = tr.heading;
    const fwd = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
    const right = new THREE.Vector3(Math.cos(h), 0, Math.sin(h));
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3(tr.x, tr.y, tr.z);
    if (heli && Math.random() < A.helicopter.alongRoad) {
      // following the road, one way or the other, a little off to one side
      dir.copy(fwd).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      mid.addScaledVector(fwd, rand(p.ahead[0], p.ahead[1])).addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * rand(15, 60));
    } else {
      const a = THREE.MathUtils.degToRad(rand(35, 145)) * (Math.random() < 0.5 ? 1 : -1);
      dir.copy(fwd).multiplyScalar(Math.cos(a)).addScaledVector(right, Math.sin(a)).normalize();
      mid.addScaledVector(fwd, rand(p.ahead[0], p.ahead[1])).addScaledVector(right, rand(-60, 60));
    }
    mid.y += rand(p.alt[0], p.alt[1]);
    const from = mid.clone().addScaledVector(dir, -p.pass / 2);
    from.y += (p.descent * p.pass) / 2;
    const livery = kind === 'turboprop' ? (Math.random() < 0.5 ? 'teal' : 'green') : Math.random() < 0.5 ? 'green' : 'navy';
    const anchor = new THREE.Vector3(tr.x, tr.y, tr.z);

    // fighters: a MiG-29 pair, or an F-7 vic of three
    const slots: V3[] = [[0, 0, 0]];
    if (fighter && Math.random() < A.formation) {
      slots.push([-14, -2, 18]);
      if (kind === 'f7') slots.push([14, -2, 18]);
    }
    const roll = fighter ? rand(-0.3, 0.3) : 0;
    slots.forEach(([sx, sy, sz], i) => {
      // formation offsets are in the leader's frame: x across, z behind
      const across = new THREE.Vector3(-dir.z, 0, dir.x);
      const f0 = from.clone().addScaledVector(across, sx).addScaledVector(dir, -sz);
      f0.y += sy;
      this.flights.push(this.make(kind, livery, p, f0, dir.clone(), anchor, roll, i === 0));
    });
  }

  private make(kind: Kind, livery: keyof typeof LIVERIES, p: Profile, from: THREE.Vector3, dir: THREE.Vector3, anchor: THREE.Vector3, roll: number, lead: boolean): Flight {
    const m = model(kind, livery);
    const group = new THREE.Group();
    // double-sided: the mirrored (left) wing panels face inward
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0, fog: p.fog, side: THREE.DoubleSide });
    const body = new THREE.Mesh(m.body, mat);
    body.frustumCulled = false;
    group.add(body);
    const spinners = m.spinners.map((s) => {
      const mesh = new THREE.Mesh(s.geo, mat);
      mesh.position.set(...s.p);
      group.add(mesh);
      return { mesh, axis: s.axis, rate: s.rate };
    });
    if (p.gear && m.gear) group.add(new THREE.Mesh(m.gear, mat));
    const extraMats: THREE.Material[] = [];

    // navigation lights and the flashing beacon: fixed-size dots, so they show even on far, small aircraft
    const navGeo = new THREE.BufferGeometry();
    navGeo.setAttribute('position', new THREE.Float32BufferAttribute(m.nav.flatMap((n) => n.p), 3));
    navGeo.setAttribute('color', new THREE.Float32BufferAttribute(m.nav.flatMap((n) => new THREE.Color(n.color).toArray()), 3));
    const navMat = new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    group.add(new THREE.Points(navGeo, navMat));
    let beacon: THREE.Points | null = null;
    if (m.beacon.length) {
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(m.beacon.flat(), 3));
      const bMat = new THREE.PointsMaterial({ color: 0xff3020, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
      extraMats.push(bMat);
      beacon = new THREE.Points(bGeo, bMat);
      group.add(beacon);
    }

    // contrails at cruise, afterburner-orange glow at a fighter's jet pipe
    const contrails: THREE.Mesh[] = [];
    if (p.contrail) {
      contrailGeo ??= new THREE.ConeGeometry(55, 1400, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 700 + 6);
      for (const e of m.exhausts) {
        const cm = contrailMaterial();
        extraMats.push(cm);
        const c = new THREE.Mesh(contrailGeo, cm);
        c.position.set(...e);
        c.frustumCulled = false;
        contrails.push(c);
        group.add(c);
      }
    }
    const glow: THREE.Mesh[] = [];
    if (kind === 'f7' || kind === 'mig29') {
      glowGeo ??= new THREE.ConeGeometry(0.45, 2.2, 8).rotateX(Math.PI / 2).translate(0, 0, 1.1);
      for (const e of m.exhausts) {
        const gm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        extraMats.push(gm);
        const gl = new THREE.Mesh(glowGeo, gm);
        gl.position.set(...e);
        glow.push(gl);
        group.add(gl);
      }
    }

    group.scale.setScalar(p.scale);
    // nose (-z) along the flight direction; helicopters dip the nose, airliners on approach raise it
    const pitch = kind === 'mi17' || kind === 'bell212' ? -0.08 : p.gear ? 0.06 : 0;
    group.rotation.set(pitch, Math.atan2(-dir.x, -dir.z), roll, 'YXZ');
    group.position.copy(from);
    this.group.add(group);
    const voice = lead ? this.game.sound.aircraftVoice(SOUND[kind]) : null;
    return { kind, group, mat, extraMats, spinners, navMat, beacon, glow, contrails, from, dir, p, t: 0, anchor, lead, voice, lastDist: 0, blink: Math.random() };
  }

  private remove(f: Flight): void {
    this.group.remove(f.group);
    f.mat.dispose();
    f.navMat.dispose();
    for (const m of f.extraMats) m.dispose();
    f.group.traverse((o) => {
      if (o instanceof THREE.Points) o.geometry.dispose();
    });
    f.voice?.stop();
  }
}
