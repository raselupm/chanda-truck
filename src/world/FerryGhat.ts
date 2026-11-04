// A river with no bridge: the ferry ghat (Daulatdia), the ferry over the Padma and the landing ghat on the far
// bank (Paturia). Stop at the ticket counter like a toll (the official ticket plus the "serial" brokers' cut),
// drive down onto the ferry and stop in the yellow box; she casts off, carries the truck across and you drive
// off at the far pontoon once the bus in front of you has rolled off.

import * as THREE from 'three';
import { ECONOMY } from '../config/economy';
import type { TollEvent } from '../config/route';
import { chandaFor, feeFor } from '../config/trucks';
import { EVENTS, FERRY, ROAD, TOLL_JAM } from '../config/tuning';
import type { Game } from '../game/Game';
import { formatTaka } from '../utils/bnNumber';
import { box, buildColored, cached, cyl, vertexColorMaterial, type Part } from '../utils/geometry';
import { canvasTexture, signTexture, speedSignTexture, stripeTexture } from '../utils/textures';
import { smoothstep } from '../utils/math';
import { makePerson } from './People';
import { glowZone, pulseGlow, SetPiece, signPost } from './SetPiece';
import type { BridgeSpan } from './Track';
import { boatHullGeometry, vehicleGeometry, VEHICLE_DIMS, type TrafficKind } from './VehicleModels';

const L = FERRY.length;
const FW = FERRY.halfWidth;
/** our lane on the ghat road and on the ferry's deck (truck centre), the other lane is for the parked vehicles */
const LANE: [number, number] = [-FW + 1.3, -1.0];
const PARKED_D = 3.3;
/** where the truck stops on the deck: its front this far behind the ferry's bow (the bus is in front of it) */
const BOW_GAP = 15;
const WATER_Y = 0.35;

const BROKER_LINES = [
  'টিকিট সরকারি, সিরিয়াল আমার। না দিলে দুই দিন ঘাটে বসে থাকেন।',
  'দালাল ছাড়া ঘাটে চাকা ঘোরে না, ভাই।',
  'পরের ফেরিতে তুলে দিচ্ছি — খরচাপাতি একটু লাগে।',
  'ট্রাকের সিরিয়াল সবার পরে। আগে যেতে চাইলে...',
];

type Stage = 'ticket' | 'board' | 'cast' | 'cross' | 'dock' | 'off' | 'done';

interface Parked {
  mesh: THREE.Mesh;
  s: number;
  d: number;
  len: number;
  speed: number;
  gone: boolean;
}

interface Boat {
  x: number;
  z: number;
  speed: number;
}

/** The ferry in its own frame: deck top at y = 0, bow toward -z, wheelhouse on a sponson to starboard (+x). */
function ferryParts(): Part[] {
  const white = 0xf0efe9;
  const blue = 0x1d5e9e;
  const p: Part[] = [
    { geo: box(FW * 2 + 0.6, 2.0, L), color: white, p: [0, -1.02, 0] },
    { geo: box(FW * 2 + 0.64, 0.35, L + 0.04), color: blue, p: [0, -0.6, 0] },
    { geo: box(FW * 2 + 0.64, 0.5, L + 0.04), color: 0x8c2a22, p: [0, -1.4, 0] },
    { geo: box(FW * 2, 0.06, L), color: 0x5f6266, p: [0, -0.03, 0] },
    { geo: box(0.15, 0.02, L - 4), color: 0xe8c02e, p: [0.3, 0.01, 0] },
  ];
  // bulwarks with a blue rail, lifebuoys outboard
  for (const side of [-1, 1]) {
    p.push({ geo: box(0.3, 1.0, L), color: white, p: [side * (FW + 0.15), 0.5, 0] });
    p.push({ geo: box(0.36, 0.12, L), color: blue, p: [side * (FW + 0.15), 1.06, 0] });
    for (let z = -L / 2 + 6; z < L / 2 - 4; z += 9) {
      p.push({ geo: cyl(0.36, 0.36, 0.12, 10), color: 0xf77f00, p: [side * (FW + 0.33), 0.55, z], r: [0, 0, Math.PI / 2] });
    }
  }
  // the wheelhouse block on the starboard sponson
  const x = FW + 2.1;
  p.push(
    { geo: box(3.6, 2.0, 18), color: white, p: [x, -1.02, 0] },
    { geo: box(3.6, 2.6, 16), color: white, p: [x, 1.3, 0] },
    { geo: box(3.66, 0.8, 14), color: 0x2c3a44, p: [x, 1.6, 0] },
    { geo: box(4.0, 2.2, 7), color: white, p: [x, 3.7, 1] },
    { geo: box(4.06, 0.8, 7.06), color: 0x2c3a44, p: [x, 4.0, 1] },
    { geo: box(4.6, 0.2, 8), color: blue, p: [x, 4.9, 1] },
    { geo: cyl(0.08, 0.08, 4, 6), color: 0xd8d8d8, p: [x, 6.9, -1] },
    { geo: cyl(0.6, 0.7, 2.4, 10), color: 0xf2c14e, p: [x + 0.4, 6.1, 4.2] },
    { geo: cyl(0.62, 0.62, 0.5, 10), color: 0x1d1d1d, p: [x + 0.4, 7.5, 4.2] },
    // the flag at the masthead
    { geo: box(0.04, 0.8, 1.3), color: 0x006a4e, p: [x, 8.3, -0.3] },
    { geo: cyl(0.25, 0.25, 0.05, 10), color: 0xf42a41, p: [x - 0.03, 8.3, -0.35], r: [0, 0, Math.PI / 2] },
  );
  return p;
}

/** A hinged loading ramp, pivot at the deck edge; it extends toward +z (flip the group for the bow). */
function rampGeometry(): THREE.BufferGeometry {
  return cached('ferry:ramp', () =>
    buildColored([
      { geo: box(FW * 2 - 1.2, 0.22, 6.5), color: 0x55585c, p: [0, -0.11, 3.25] },
      { geo: box(0.25, 0.3, 6.5), color: 0xe8c02e, p: [-FW + 0.75, 0.04, 3.25] },
      { geo: box(0.25, 0.3, 6.5), color: 0xe8c02e, p: [FW - 0.75, 0.04, 3.25] },
    ]),
  );
}

/** One of the other ferries on the river: hull, raised ramps and a load of trucks and buses. */
function loadedFerryGeometry(): THREE.BufferGeometry {
  return cached('ferry:loaded', () => {
    const parts = ferryParts();
    const load: [TrafficKind, number, number, number][] = [
      ['truck', 0, -3.3, -14], ['bus', 1, -3.3, 1], ['truck', 2, -3.3, 14], ['bus', 3, 3.3, -13], ['truck', 1, 3.3, 0], ['car', 2, 3.3, 10], ['truck', 0, 3.3, 17],
    ];
    for (const [kind, v, x, z] of load) parts.push({ geo: vehicleGeometry(kind, v), p: [x, 0, z] });
    for (const [z, a] of [[L / 2, -1.15], [-L / 2, Math.PI + 1.15]] as const) parts.push({ geo: rampGeometry(), p: [0, 0, z], r: [a, 0, 0] });
    return buildColored(parts);
  });
}

function waterTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 46; i++) {
      const x = (i * 89) % w;
      const y = (i * 53) % h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 14, y - 5, x + 28, y);
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}

export class FerryGhat extends SetPiece<TollEvent> {
  private span: BridgeSpan;
  private stage: Stage = 'ticket';
  private stageT = 0;
  private t = 0;
  private warned = false;
  readonly fare: number;
  readonly serial: number;
  /** the ferry's stern (the end the truck drives on at), s along the road */
  private rear: number;
  private ferry = new THREE.Group();
  private sternRamp = new THREE.Group();
  private bowRamp = new THREE.Group();
  private deckZone: THREE.Mesh;
  private counterZone: THREE.Mesh;
  private boomPivot: THREE.Group;
  private boomT = 0;
  private boomOpen = 0;
  private parked: Parked[] = [];
  private others: { mesh: THREE.Mesh; x: number; from: number; to: number; period: number; phase: number }[] = [];
  private boats: Boat[] = [];
  private boatMesh: THREE.InstancedMesh;
  private water: THREE.Mesh;
  private waterTex: THREE.Texture;
  private lights: THREE.PointsMaterial;
  private officials: THREE.Mesh[] = [];

  constructor(event: TollEvent, game: Game) {
    super(event, game);
    const track = game.track;
    const S = event.s;
    this.span = track.bridges.find((b) => b.start === S + event.bridge!.offset)!;
    const { start, end } = this.span;
    const len = end - start;
    const hw = track.halfWidth(S);
    this.fare = feeFor(event.feeKey);
    this.serial = chandaFor(ECONOMY.ferrySerialChanda);
    this.rear = start;
    const mat = vertexColorMaterial();

    // Our side only, from the waiting yard to well past the far pontoon: the queue, the ramp, the deck
    const funnel = (s: number) => {
      const t = smoothstep(S - 100, S - 40, s);
      return [-hw + 1.3, hw - 1.3 + (LANE[1] - (hw - 1.3)) * t] as [number, number];
    };
    track.limits.push(
      { from: S - FERRY.yardLength, to: S - 40, range: funnel },
      { from: S - 40, to: end + 60, range: () => LANE },
    );
    track.propBlocks.push(
      { from: S - FERRY.yardLength - 10, to: start + 10, dMin: -hw - 30, dMax: hw + 30 },
      { from: end - 10, to: end + 280, dMin: -hw - 30, dMax: hw + 30 },
    );

    // ---- the river
    this.waterTex = waterTexture();
    this.water = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(1800, len + 80).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x8a7a5a, map: this.waterTex }),
    ));
    this.water.position.set(0, WATER_Y, -(start + len / 2));
    this.group.add(this.water);
    const sand: Part[] = [];
    for (let i = 0; i < 8; i++) {
      const x = (i % 2 ? 1 : -1) * (90 + ((i * 151) % 520));
      const z = -(start + 60 + ((i * 97) % Math.max(60, len - 120)));
      sand.push({ geo: cyl(1, 1, 0.3, 12), color: 0xd8c690, p: [x, WATER_Y + 0.05, z], s: [36 + (i % 3) * 24, 1, 14 + (i % 2) * 12] });
    }
    // the pontoons at both banks, the far bank's line of moored launches
    for (const [s0, dir] of [[start, -1], [end, 1]] as const) {
      const y = track.surfaceY(s0) - 0.05;
      sand.push({ geo: box(FW * 2 + 4, y - WATER_Y + 0.6, 14), color: 0x3c4a55, p: [0, (y + WATER_Y - 0.6) / 2, -(s0 + dir * 7)] });
      for (const side of [-1, 1]) {
        sand.push({ geo: box(0.12, 0.9, 14), color: 0xd8d8d8, p: [side * (FW + 1.9), y + 0.45, -(s0 + dir * 7)] });
        for (let k = 0; k < 3; k++) sand.push({ geo: cyl(0.25, 0.25, 0.8, 8), color: 0x1d1d1d, p: [side * (FW + 1.6), y + 0.4, -(s0 + dir * (2 + k * 5))] });
      }
    }
    this.group.add(new THREE.Mesh(buildColored(sand), mat));

    // ---- our ferry, docked at Daulatdia with her stern ramp down on the pontoon
    const hull = new THREE.Mesh(cached('ferry:hull', () => buildColored(ferryParts())), mat);
    this.ferry.add(hull);
    for (const [ramp, z, flip] of [[this.sternRamp, L / 2, 0], [this.bowRamp, -L / 2, Math.PI]] as const) {
      ramp.position.z = z;
      ramp.rotation.y = flip;
      ramp.add(new THREE.Mesh(rampGeometry(), mat));
      this.ferry.add(ramp);
    }
    this.setRamps(0, 1);
    const nameTex = signTexture(['ফেরি শাপলা'], { bg: '#f0efe9', fg: '#1d5e9e', w: 512, h: 128, sizes: [80] });
    const name = this.own(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshLambertMaterial({ map: nameTex })));
    name.position.set(FW + 2.1, 3.9, 4.53);
    this.ferry.add(name);
    // the yellow box on the deck: stop here
    this.deckZone = glowZone(L - BOW_GAP - 3, LANE[1] - LANE[0] + 2.4, 0xffd23f);
    this.deckZone.position.set((LANE[0] + LANE[1]) / 2, 0.03, L / 2 - 2 - (L - BOW_GAP - 3) / 2);
    this.deckZone.visible = false;
    this.ferry.add(this.deckZone);
    // crew at the stern ramp, passengers at the rail
    for (const [x, z, kind, i] of [[-FW + 0.8, L / 2 - 1.2, 'worker', 0], [FW - 0.8, L / 2 - 1.5, 'worker', 1], [-FW + 0.6, -L / 2 + 3, 'trader', 2], [-FW + 0.6, -L / 2 + 5, 'farmer', 3]] as const) {
      const p = makePerson(kind, i);
      p.position.set(x, 0, z);
      p.rotation.y = z > 0 ? Math.PI : 0;
      this.ferry.add(p);
    }
    // night: masthead, port (red), starboard (green), the cabin windows
    const lp: number[] = [];
    const lc: number[] = [];
    const light = (x: number, y: number, z: number, c: number) => {
      lp.push(x, y, z);
      lc.push(...new THREE.Color(c).toArray());
    };
    light(FW + 2.1, 8.9, -1, 0xffffff);
    light(-FW - 0.2, 1.3, -L / 2 + 2, 0xff3030);
    light(FW + 3.9, 1.3, -L / 2 + 8, 0x30ff60);
    for (let z = -6; z <= 6; z += 3) light(FW + 0.25, 1.6, z, 0xfff2c4);
    for (let z = -1.5; z <= 3.5; z += 2.5) light(FW + 0.05, 4.0, z, 0xfff2c4);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    this.lights = new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
    const pts = new THREE.Points(lg, this.lights);
    pts.frustumCulled = false;
    pts.userData.ownsMaterial = true;
    this.ferry.add(pts);
    this.group.add(this.ferry);
    this.placeFerry();

    // the vehicles that came aboard before us: a bus ahead in our lane, a row in the other lane
    const load: [TrafficKind, number, number, number][] = [
      ['bus', 2, LANE[0] + 2.35, L - 2 - VEHICLE_DIMS.bus.len / 2],
      ['truck', 1, PARKED_D, L - 2 - VEHICLE_DIMS.truck.len / 2],
      ['car', 0, PARKED_D, L - 13.5],
      ['truck', 2, PARKED_D, L - 23],
      ['bus', 0, PARKED_D, L - 36],
    ];
    for (const [kind, v, d, at] of load) {
      const mesh = new THREE.Mesh(vehicleGeometry(kind, v), mat);
      this.group.add(mesh);
      this.parked.push({ mesh, s: start + at, d, len: VEHICLE_DIMS[kind].len, speed: 0, gone: false });
    }
    this.placeParked();

    // the other ferries: one coming the other way, one further off going our way, one waiting off Paturia
    const otherGeo = loadedFerryGeometry();
    for (const [x, from, to, period, phase] of [[-150, end - L / 2, start + L / 2, 70, 0.15], [280, start + L / 2, end - L / 2, 80, 0.55], [70, end - L / 2 - 40, end - L / 2 - 40, 1, 0]]) {
      const mesh = new THREE.Mesh(otherGeo, mat);
      if (from > to) mesh.rotation.y = Math.PI;
      this.group.add(mesh);
      this.others.push({ mesh, x, from, to, period, phase });
    }
    // country boats
    this.boatMesh = new THREE.InstancedMesh(boatHullGeometry(), mat, 12);
    this.boatMesh.frustumCulled = false;
    for (let i = 0; i < 12; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = (i - 6) * 95 + 30;
      this.boats.push({ x: Math.abs(x) < 40 ? x + 80 : x, z: -(start + 30 + ((i * 131) % (len - 60))), speed: (1.5 + (i % 3)) * dir });
    }
    this.group.add(this.boatMesh);

    // ---- Daulatdia ghat: the waiting yard, the ticket counter, the boom, the ghat bazaar
    const ghat: Part[] = [];
    for (let s = S - 14, i = 0; s > S - FERRY.yardLength; s -= VEHICLE_DIMS.truck.len + 2 + (i % 3) * 0.6, i++) {
      const p = this.at(s, -hw - 4.6, ROAD.top - 0.2);
      ghat.push({ geo: vehicleGeometry('truck', i % 3), p: [p.x, p.y, p.z], r: [0, (i % 4) * 0.02 - 0.03, 0] });
    }
    // ...and the ones with tickets, waiting to be called down to the ferry (traffic pulls in among them)
    for (let s = S + 45, i = 0; s < S + 150; s += VEHICLE_DIMS.truck.len + 2.4, i++) {
      const p = this.at(s, -hw - 4.6, ROAD.top - 0.2);
      ghat.push({ geo: vehicleGeometry(i % 4 === 2 ? 'bus' : 'truck', (i + 1) % 3), p: [p.x, p.y, p.z] });
    }
    // across the road: tin-roofed hotels and tea stalls
    for (let k = 0; k < 6; k++) {
      const s = S - 150 + k * 26;
      const p = this.at(s, hw + 9, 0);
      const w = 8 + (k % 3) * 2;
      ghat.push(
        { geo: box(6, 3, w), color: [0xc9b79c, 0xa7b8a3, 0xd2c2a2][k % 3], p: [p.x, 1.5, p.z] },
        { geo: box(7.2, 0.15, w + 1), color: 0x9aa0a6, p: [p.x - 0.4, 3.15, p.z], r: [0, 0, 0.12] },
        { geo: box(0.08, 1.6, w - 2), color: 0x2c2420, p: [p.x - 3.02, 1.2, p.z] },
      );
    }
    // the counter on our side, under a small canopy
    const counter = this.at(S, -hw - 1.6, ROAD.top);
    ghat.push(
      { geo: box(1.2, 0.3, 9), color: 0xd9d4c5, p: [counter.x + 0.4, counter.y + 0.15, counter.z + 3] },
      { geo: box(1.8, 2.5, 2.4), color: 0xe8e4da, p: [counter.x, counter.y + 1.55, counter.z + 1] },
      { geo: box(1.82, 0.9, 1.8), color: 0x2a4b5f, p: [counter.x, counter.y + 1.9, counter.z + 1] },
      { geo: box(2.2, 0.15, 2.8), color: 0x1d5e9e, p: [counter.x, counter.y + 2.88, counter.z + 1] },
    );
    // gantry with the ghat's name over our half
    const gL = this.at(S - 2, -hw - 1, ROAD.top);
    const gR = this.at(S - 2, 0.3, ROAD.top);
    ghat.push(
      { geo: box(0.4, 7, 0.4), color: 0x1d5e9e, p: [gL.x, gL.y + 3.5, gL.z] },
      { geo: box(0.4, 7, 0.4), color: 0x1d5e9e, p: [gR.x, gR.y + 3.5, gR.z] },
      { geo: box(gR.x - gL.x + 0.6, 0.4, 0.4), color: 0x1d5e9e, p: [(gL.x + gR.x) / 2, gL.y + 7, gL.z] },
    );
    // stop line and yellow-white rumble strips
    const line = this.at(S, -hw / 2, ROAD.top + 0.02);
    ghat.push({ geo: box(hw, 0.03, 0.5), color: 0xffffff, p: [line.x, line.y, line.z] });
    for (let k = 0; k < 6; k++) {
      const r = this.at(S - 60 - k * 11, -hw / 2, ROAD.top + 0.03);
      ghat.push({ geo: box(hw - 0.6, 0.06, 0.3), color: k % 2 ? 0xffffff : 0xffd23f, p: [r.x, r.y, r.z] });
    }
    // lamp posts down the ghat road and on both pontoons
    for (const s of [S + 40, S + 110, S + 180, start - 6, end + 6, end + 70]) {
      const lp2 = this.at(s, -FW - 1.4, ROAD.top);
      ghat.push(
        { geo: cyl(0.09, 0.12, 7, 6), color: 0x9aa3ab, p: [lp2.x, lp2.y + 3.5, lp2.z] },
        { geo: box(1.4, 0.1, 0.12), color: 0x9aa3ab, p: [lp2.x + 0.7, lp2.y + 7, lp2.z] },
        { geo: box(0.5, 0.15, 0.3), color: 0xfff3c0, p: [lp2.x + 1.3, lp2.y + 6.9, lp2.z] },
      );
    }
    // Paturia: trucks waiting for the ferry back, nose to tail on their side
    for (let s = end + 260, i = 0; s > end + 70; s -= VEHICLE_DIMS.truck.len + 2.2, i++) {
      const p = this.at(s, hw + 4.6, ROAD.top - 0.2);
      ghat.push({ geo: vehicleGeometry(i % 2 ? 'truck' : 'bus', i % 3), p: [p.x, p.y, p.z], r: [0, Math.PI, 0] });
    }
    this.group.add(new THREE.Mesh(buildColored(ghat), mat));

    const board = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(hw + 0.8, 2.2),
      new THREE.MeshLambertMaterial({ map: signTexture([event.nameBn, `ফেরি টিকিট — ট্রাক ${formatTaka(this.fare)}`], { bg: '#1d5e9e', fg: '#ffffff', w: 1024, h: 300, sizes: [96, 60] }) }),
    ));
    board.position.copy(this.at(S - 2.25, (-hw - 1 + 0.3) / 2, ROAD.top + 7));
    this.group.add(board);
    const far = this.own(new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.8),
      new THREE.MeshLambertMaterial({ map: signTexture([event.bridge!.farBn ?? '', 'মানিকগঞ্জ · ঢাকা'], { bg: '#1d5e9e', fg: '#ffffff', w: 1024, h: 200, sizes: [80, 48] }) }),
    ));
    far.position.copy(this.at(end + 46, -FW - 3, ROAD.top + 4.2));
    far.rotation.y = 0.35;
    this.group.add(far);
    const farPost = signPost(signTexture(['সাবধানে নামুন'], { bg: '#f2c14e', fg: '#1d1d1d', sizes: [60] }), 2.6, 0.9, 1.8);
    farPost.position.copy(this.at(end + 20, -FW - 2.2, ROAD.top));
    this.group.add(farPost);

    // the boom across our lane at the counter
    const boomLen = hw - 0.4;
    const boom = this.own(new THREE.Mesh(new THREE.BoxGeometry(boomLen, 0.14, 0.14), new THREE.MeshLambertMaterial({ map: stripeTexture('#d62828', '#ffffff', 10) })));
    boom.position.x = boomLen / 2;
    this.boomPivot = new THREE.Group();
    this.boomPivot.add(boom);
    this.boomPivot.position.copy(this.at(S + 0.3, -hw + 0.1, ROAD.top + 1.05));
    this.group.add(this.boomPivot);

    // approach signs
    for (const off of [120, 60]) {
      const sp = signPost(speedSignTexture(ECONOMY.tollMaxSpeedKmh), 1.3, 1.3, 2.2);
      sp.position.copy(this.at(S - off, -hw - 2.6, ROAD.top));
      this.group.add(sp);
    }
    const ahead = signPost(signTexture([`${event.nameBn} — সামনে`, 'কাউন্টারে থামুন · ফেরিতে পদ্মা পার'], { bg: '#1d5e9e', border: '#ffffff', sizes: [56, 40] }), 4, 2, 2.4);
    ahead.position.copy(this.at(S - 420, -hw - 3, ROAD.top));
    this.group.add(ahead);

    // the man at the counter, and the broker who does the real business
    for (const [s, d, kind, i, yaw] of [[S - 1, -hw - 1.9, 'official', 0, -Math.PI / 2], [S - 4, -hw - 0.9, 'trader', 1, -Math.PI / 2 + 0.7], [S + 3, -hw - 2.6, 'worker', 2, -Math.PI / 2]] as const) {
      const o = makePerson(kind, i);
      o.position.copy(this.at(s, d, ROAD.top + 0.28));
      o.rotation.y = yaw;
      this.officials.push(o);
      this.group.add(o);
    }

    this.counterZone = glowZone(24, hw - 0.4, 0xffb020);
    this.counterZone.position.copy(this.at(S - 12.5, -hw / 2, ROAD.top + 0.04));
    this.group.add(this.counterZone);
  }

  // ---------------------------------------------------------------- traffic

  // vehicles buy their ticket at the counter and pull into the yard; oncoming traffic waits at Paturia
  get controlsTraffic(): boolean {
    return true;
  }

  get blocking(): boolean {
    return this.stage === 'ticket';
  }

  stopLine(dir: 1 | -1): number | null {
    return dir === 1 ? this.s - 0.3 : this.span.end + FERRY.trafficClear + 20;
  }

  get serviceTime(): number {
    return TOLL_JAM.serviceSeconds;
  }

  served(): void {
    this.boomOpen = 2.2;
  }

  laneAt(s: number, dir: 1 | -1): number | null {
    if (dir !== 1 || s < this.s - 150 || s > this.span.start) return null;
    const hw = this.game.track.halfWidth(this.s);
    // through the counter in our lane, then off into the yard on the left (where they're removed)
    return s < this.s + 15 ? -hw / 2 : -hw - 4.6;
  }

  visibleRange(): [number, number] {
    return [this.s - 750, this.span.end + 450];
  }

  // ---------------------------------------------------------------- the crossing

  private setStage(stage: Stage): void {
    this.stage = stage;
    this.stageT = 0;
  }

  /** ramp angles: 0 = down (resting on the pontoon), 1 = up */
  private setRamps(stern: number, bow: number): void {
    const up = 1.15;
    this.sternRamp.rotation.x = -stern * up;
    this.bowRamp.rotation.x = -bow * up;
  }

  private placeFerry(): void {
    this.ferry.position.copy(this.at(this.rear + L / 2, 0, ROAD.top));
  }

  private placeParked(): void {
    const tr = this.game.track;
    for (const v of this.parked) {
      if (v.gone) continue;
      tr.point(v.s, v.d, v.mesh.position, ROAD.top);
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.stageT += dt;
    const g = this.game;
    const tr = g.truck;
    const S = this.s;
    const { start, end } = this.span;
    const front = tr.frontS;

    this.waterTex.offset.x = this.t * 0.012;
    this.waterTex.offset.y = Math.sin(this.t * 0.3) * 0.01;
    this.updateBoats(dt);
    this.updateOthers();
    this.lights.opacity = Math.min(1, Math.max(0, g.weather.look.headlights - 0.15) * 1.4);
    const dist = tr.s < start ? start - tr.s : tr.s > end ? tr.s - end : 0;
    g.wind = Math.max(g.wind, 1 - dist / 250);

    this.counterZone.visible = this.stage === 'ticket';
    if (this.stage === 'ticket') pulseGlow(this.counterZone, this.t, 0.2, 0.25);
    this.deckZone.visible = this.stage === 'board';
    if (this.stage === 'board') pulseGlow(this.deckZone, this.t, 0.15, 0.25);

    const playing = g.state.phase === 'HIGHWAY';
    switch (this.stage) {
      case 'ticket': {
        tr.rumble = tr.rumble || (front > S - 130 && front < S - 55);
        if (front > S - 600 && front < S + 5) g.hud.tollMode = true;
        if (!playing || g.modal) break;
        if (!this.warned && front > S - EVENTS.tollWarnDistance && front < S) {
          this.warned = true;
          g.hud.warn('{ferry} সামনে ফেরিঘাট — গতি ২০-এর নিচে এনে কাউন্টারে থামুন', 'info', 4);
          g.sound.beep();
        }
        if (front >= S && front < S + 15) {
          if (tr.kmh > ECONOMY.tollMaxSpeedKmh) {
            g.gameOver('toll');
            return;
          }
          tr.clampFront(S - 0.05);
          tr.stop();
          this.pay();
        } else if (Math.abs(tr.speed) < EVENTS.stopSpeed && front > S - 25 && front < S && !g.traffic.vehicleBetween(front, S + 2, tr.d)) {
          this.pay();
        }
        break;
      }
      case 'board': {
        // nothing beyond the bus in front of us
        if (front > this.rear + L - BOW_GAP) {
          tr.clampFront(this.rear + L - BOW_GAP);
          tr.stop();
        }
        if (tr.rearS > this.rear + 1 && front > this.rear + L - BOW_GAP - 8 && Math.abs(tr.speed) < EVENTS.stopSpeed) {
          this.setStage('cast');
          g.sound.shipHorn(2);
          g.hud.toast('{ferry} ফেরি ছাড়লো — পদ্মা পার হচ্ছি, পাটুরিয়া ঘাটে নামবো', 4);
        }
        break;
      }
      case 'cast': {
        this.holdOnDeck();
        this.setRamps(Math.min(1, this.stageT / FERRY.boardSeconds), 1);
        if (this.stageT >= FERRY.boardSeconds) this.setStage('cross');
        break;
      }
      case 'cross': {
        const k = Math.min(1, this.stageT / FERRY.crossSeconds);
        // eases away from the pontoon and slows into the far one
        const next = start + (end - L - start) * (k * k * (3 - 2 * k));
        const ds = next - this.rear;
        this.rear = next;
        tr.carry(ds);
        for (const v of this.parked) v.s += ds;
        this.placeFerry();
        this.placeParked();
        this.holdOnDeck();
        if (k >= 1) {
          this.setStage('dock');
          g.sound.shipHorn(1, 0.8);
        }
        break;
      }
      case 'dock': {
        this.holdOnDeck();
        this.setRamps(1, 1 - Math.min(1, this.stageT / FERRY.dockSeconds));
        if (this.stageT >= FERRY.dockSeconds) {
          this.setStage('off');
          g.hud.toast(`{ferry} ${this.event.bridge!.farBn} — সামনের বাস নামলে নেমে যান`, 3.5);
        }
        break;
      }
      case 'off': {
        // the vehicles in front roll off first, one after another
        let ahead = Infinity;
        this.parked.forEach((v, i) => {
          if (v.gone) return;
          const prev = this.parked[i - 1];
          if (this.stageT > i * 1.2 && (!prev || prev.gone || prev.s - prev.len / 2 - (v.s + v.len / 2) > 3)) v.speed = Math.min(7, v.speed + 2.2 * dt);
          v.s += v.speed * dt;
          if (v.s > end + 240) {
            v.gone = true;
            v.mesh.visible = false;
          }
          if (v.d < 0 && !v.gone) ahead = Math.min(ahead, v.s - v.len / 2);
        });
        this.placeParked();
        if (tr.rearS < this.rear + 0.5) tr.clampRear(this.rear + 0.5);
        if (front > ahead - 2) {
          tr.clampFront(ahead - 2);
          tr.stop();
        }
        if (tr.rearS > end + 4) this.setStage('done');
        break;
      }
      case 'done': {
        for (const v of this.parked) {
          if (v.gone) continue;
          v.speed = Math.min(7, v.speed + 2.2 * dt);
          v.s += v.speed * dt;
          if (v.s > end + 240) {
            v.gone = true;
            v.mesh.visible = false;
          }
        }
        this.placeParked();
        break;
      }
    }

    this.boomOpen = Math.max(0, this.boomOpen - dt);
    const up = this.stage !== 'ticket' || this.boomOpen > 0;
    if (up ? this.boomT < 1 : this.boomT > 0) {
      this.boomT = Math.min(1, Math.max(0, this.boomT + (up ? dt * (this.stage !== 'ticket' ? 0.9 : 2.2) : -dt * 1.2)));
      this.boomPivot.rotation.z = this.boomT * this.boomT * (3 - 2 * this.boomT) * (Math.PI / 2 - 0.1);
    }
    this.officials[0].rotation.z = this.stage !== 'ticket' ? Math.sin(this.t * 5) * 0.08 : 0;
  }

  /** Keep the truck between the stern ramp and the bus while she's under way. */
  private holdOnDeck(): void {
    const tr = this.game.truck;
    if (tr.rearS < this.rear + 0.5) {
      tr.clampRear(this.rear + 0.5);
      tr.stop();
    }
    if (tr.frontS > this.rear + L - BOW_GAP) {
      tr.clampFront(this.rear + L - BOW_GAP);
      tr.stop();
    }
  }

  private pay(): void {
    const g = this.game;
    g.truck.stop();
    this.setStage('board');
    g.charge({
      kind: 'chanda',
      titleBn: 'ফেরির টিকিট আর ঘাটের সিরিয়াল',
      messageBn: BROKER_LINES[Math.floor(Math.random() * BROKER_LINES.length)],
      lines: [
        { category: 'TOLL', amount: this.fare, labelBn: 'ফেরি টিকিট (ট্রাক)' },
        { category: 'CHANDA', amount: this.serial, labelBn: 'ঘাটের সিরিয়াল (দালাল)' },
      ],
      locationBn: this.event.nameBn,
      onPaid: () => {
        g.sound.beep();
        g.hud.warn('{ferry} ফেরিতে উঠুন — হলুদ ঘরে থামুন', 'info', 4);
      },
    });
  }

  private updateOthers(): void {
    for (const o of this.others) {
      // there and back: loaded one way, a pause at each pontoon
      const k = ((this.t / o.period + o.phase) % 1) * 2;
      const leg = k < 1 ? k : 2 - k;
      const e = smoothstep(0.08, 0.92, leg);
      const s = o.from + (o.to - o.from) * e;
      o.mesh.position.set(o.x, this.game.track.surfaceY(this.span.start + 1) + Math.sin(this.t * 0.8 + o.x) * 0.05, -s);
      o.mesh.rotation.y = (k < 1) === o.from > o.to ? Math.PI : 0;
    }
  }

  private updateBoats(dt: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    this.boats.forEach((b, i) => {
      b.x += b.speed * dt;
      if (b.x > 700) b.x = -700;
      if (b.x < -700) b.x = 700;
      // keep clear of the ferry lane
      if (Math.abs(b.x) < 20) b.x += Math.sign(b.speed) * 40;
      e.set(Math.sin(this.t * 1.3 + i) * 0.04, b.speed > 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(this.t + i) * 0.05);
      q.setFromEuler(e);
      m.compose(p.set(b.x, WATER_Y + Math.sin(this.t * 1.7 + i) * 0.08, b.z), q, one);
      this.boatMesh.setMatrixAt(i, m);
    });
    this.boatMesh.instanceMatrix.needsUpdate = true;
  }
}
