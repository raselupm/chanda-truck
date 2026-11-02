// Orchestrates a run: world, truck, route set pieces, traffic, chase, economy and UI.

import * as THREE from 'three';
import { Sound } from '../audio/Sound';
import { ECONOMY } from '../config/economy';
import { EXHAUST, TRAFFIC } from '../config/tuning';
import { DEFAULT_START_ID, generateRoute, START_POINTS, type FarmEvent, type RouteDef } from '../config/route';
import { VEGETABLES, type VegId } from '../config/vegetables';
import { track } from '../net/analytics';
import { player, submitRun } from '../net/leaderboard';
import { BuyPanel } from '../ui/BuyPanel';
import type { DebugOverlay } from '../ui/DebugOverlay';
import { HUD } from '../ui/HUD';
import { Menu, PauseMenu, rotateHint } from '../ui/Menu';
import { ResultReport } from '../ui/ResultReport';
import { TouchControls } from '../ui/TouchControls';
import { formatKg, formatTaka, toBnDigits } from '../utils/bnNumber';
import { CameraRig } from '../vehicle/CameraRig';
import { Cockpit } from '../vehicle/Cockpit';
import { Chasers } from '../vehicle/Chasers';
import { MAX_CRATES, Truck } from '../vehicle/Truck';
import { TruckController } from '../vehicle/TruckController';
import { AdBoards } from '../world/AdBoards';
import { Barrier } from '../world/Barrier';
import { Bridge } from '../world/Bridge';
import { BrokenRoads } from '../world/BrokenRoads';
import { Market } from '../world/City';
import { CityClutter } from '../world/CityClutter';
import { Junction } from '../world/Junction';
import { Roadworks } from '../world/Roadworks';
import { Mud } from '../world/Mud';
import { Thieves } from '../world/Thieves';
import { Environment } from '../world/Environment';
import { Exhaust } from '../world/Exhaust';
import { Pedestrians } from '../world/Pedestrians';
import { RailCrossing } from '../world/RailCrossing';
import { SlowZones } from '../world/SlowZones';
import { Weather } from '../world/Weather';
import { Farm } from '../world/Farm';
import { RoadStreamer } from '../world/RoadStreamer';
import { Scenery } from '../world/Scenery';
import { ShortcutRoads } from '../world/ShortcutRoads';
import { HillRoad } from '../world/HillRoad';
import type { SetPiece } from '../world/SetPiece';
import { TollPlaza } from '../world/TollPlaza';
import { Track } from '../world/Track';
import { Traffic, type HonkResult } from '../world/Traffic';
import { Cargo } from './Cargo';
import { GameState } from './GameState';
import { Input, NO_INPUT, type DriveInput } from './Input';
import { Ledger } from './Ledger';
import type { PaymentRequest } from './Payment';
import { computeResults, type Outcome, type RunStats } from './Results';
import { computeScore } from './Score';

const ARRIVAL_BRAKE: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: true };

function freshStats(): RunStats {
  return { barriersBroken: 0, barriersPaid: 0, slowHits: 0, chasesEscaped: 0, chasesCaught: 0, collisions: 0, highwayTime: 0 };
}

export class Game {
  readonly state = new GameState();
  readonly input = new Input();
  readonly sound = new Sound();
  ledger = new Ledger();
  cargo = new Cargo();
  cash = 0;
  stats: RunStats = freshStats();

  track: Track;
  readonly streamer: RoadStreamer;
  readonly scenery: Scenery;
  readonly env: Environment;
  readonly truckModel = new Truck();
  readonly truck: TruckController;
  readonly cam: CameraRig;
  private cockpit: Cockpit | null = null;
  readonly traffic: Traffic;
  readonly chase: Chasers;
  readonly pedestrians: Pedestrians;
  readonly slowZones: SlowZones;
  readonly brokenRoads: BrokenRoads;
  readonly thieves: Thieves;
  readonly mud: Mud;
  private ads = new AdBoards();
  private shortcuts: ShortcutRoads;
  private hillRoad = new HillRoad(this);
  readonly exhaust = new Exhaust();
  /** seconds of heavy smoke left from the engine starting */
  private smokeKick = 0;
  /** fell off the hill road: which side, and for how long (the truck tumbles into the valley) */
  private fallSide: -1 | 0 | 1 = 0;
  private fallT = 0;
  readonly clutter: CityClutter;
  readonly weather = new Weather();
  /** every set piece (farms, barriers, tolls, bridges, market) */
  pieces: SetPiece[] = [];
  /** the pieces that show up as "next event" (barriers, tolls, market) */
  private routePieces: SetPiece[] = [];
  private piecesGroup = new THREE.Group();

  readonly hud: HUD;
  private buyPanel: BuyPanel;
  private result: ResultReport;
  private menu: Menu;
  private pauseMenu: PauseMenu;
  private touch: TouchControls;

  /** a dialog/panel is open: the truck is held still */
  modal = false;
  /** bridge ambience level, rebuilt every frame */
  wind = 0;
  private startId = DEFAULT_START_ID;
  /** runs started since the page loaded (analytics) */
  private runCount = 0;
  route: RouteDef = generateRoute(DEFAULT_START_ID);
  private runTime = 0;
  private endTimer = -1;
  private pendingOutcome: Outcome | null = null;
  private farmWallCooldown = 0;
  private wasHonking = false;
  private hornHeld = 0;
  private longHornSent = false;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, uiRoot: HTMLElement, private debug: DebugOverlay) {
    this.track = new Track(this.route);
    this.env = new Environment(scene);
    this.streamer = new RoadStreamer(this.track);
    this.scenery = new Scenery(this.track);
    this.truck = new TruckController(this.track);
    this.cam = new CameraRig(camera, this.truckModel.eye);
    this.traffic = new Traffic(this);
    this.chase = new Chasers(this);
    this.pedestrians = new Pedestrians(this);
    this.slowZones = new SlowZones(this);
    this.brokenRoads = new BrokenRoads(this);
    this.thieves = new Thieves(this);
    this.mud = new Mud(this);
    this.clutter = new CityClutter(this.track);
    this.shortcuts = new ShortcutRoads(this);
    scene.add(this.shortcuts.group, this.hillRoad.group, this.exhaust.points);
    scene.add(this.pedestrians.group, this.slowZones.group, this.brokenRoads.group, this.thieves.group, this.mud.group, this.clutter.group, this.ads.group);
    scene.add(this.streamer.group, this.scenery.group, this.truckModel.root, this.traffic.group, this.chase.group, this.piecesGroup);

    this.hud = new HUD(uiRoot, this);
    this.touch = new TouchControls(uiRoot, this.input);
    this.buyPanel = new BuyPanel(uiRoot, this);
    this.pauseMenu = new PauseMenu(uiRoot, {
      onResume: () => this.togglePause(),
      onRestart: () => this.start(this.startId),
      onHome: () => this.goHome(),
    });
    this.result = new ResultReport(uiRoot, {
      onReplay: () => this.start(this.startId),
      onHome: () => this.goHome(),
    });
    this.menu = new Menu(uiRoot, this.sound, (id) => this.start(id));
    rotateHint(uiRoot);

    this.input.on('camera', () => this.toggleCamera());
    this.input.on('mute', () => this.sound.toggleMute());
    this.sound.onMuteChange((muted) => track('sound_toggle', { muted }));
    // closing the tab mid-run
    window.addEventListener('pagehide', () => this.trackQuit('close'));
    this.input.on('pause', () => this.togglePause());
    this.weather.onThunder((delay) => this.sound.thunder(delay));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.state.paused) this.togglePause();
    });

    // A pretty idle scene behind the menu
    this.buildRun();
    this.truck.reset(30, -1.6);
    this.truckModel.shuffleRearAd();
    this.cam.snap(this.truck);
  }

  // ---------------------------------------------------------------- run setup

  private buildRun(): void {
    for (const p of this.pieces) p.dispose();
    this.pieces = [];
    this.routePieces = [];
    const route = this.route;
    this.track = new Track(route);
    this.streamer.setTrack(this.track);
    this.scenery.setTrack(this.track);
    this.truck.setTrack(this.track);
    this.clutter.setTrack(this.track);
    this.shortcuts.build();
    this.hillRoad.build(this.track);
    this.slowZones.build(route.slowZones);
    this.brokenRoads.build(route.broken);
    this.thieves.reset();

    for (const e of route.events) {
      let piece: SetPiece;
      switch (e.type) {
        case 'farm':
          piece = new Farm(e, this);
          break;
        case 'barrier':
          piece = new Barrier(e, this);
          this.routePieces.push(piece);
          break;
        case 'roadTax':
        case 'roadToll':
        case 'bridgeToll':
          piece = new TollPlaza(e, this);
          this.routePieces.push(piece);
          if (e.bridge) {
            const bridge = new Bridge(e, this);
            this.pieces.push(bridge);
            this.piecesGroup.add(bridge.group);
          }
          break;
        case 'rail':
          piece = new RailCrossing(e, this);
          this.routePieces.push(piece);
          break;
        case 'market':
          piece = new Market(e, this);
          this.routePieces.push(piece);
          break;
        case 'roadworks':
          piece = new Roadworks(e, this);
          this.routePieces.push(piece);
          break;
        case 'junction':
          piece = new Junction(e, this);
          this.routePieces.push(piece);
          break;
      }
      this.pieces.push(piece);
      this.piecesGroup.add(piece.group);
    }
    this.ads.build(route, this.track);
  }

  private closeOverlays(): void {
    this.buyPanel.hide();
    this.pauseMenu.show(false);
    this.result.hide();
  }

  /** Start a run from a district; barrier positions are re-rolled every run. */
  start(startId: string): void {
    this.trackQuit('restart');
    this.startId = START_POINTS.some((p) => p.id === startId) ? startId : DEFAULT_START_ID;
    this.route = generateRoute(this.startId);
    this.closeOverlays();
    this.result.hide();
    this.menu.show(false);
    this.pauseMenu.show(false);
    this.state.paused = false;
    this.modal = false;
    this.endTimer = -1;
    this.pendingOutcome = null;
    this.fallSide = 0;

    this.ledger = new Ledger();
    this.cargo = new Cargo();
    this.cash = ECONOMY.startingCash;
    this.stats = freshStats();
    this.runTime = 0;
    this.chase.reset();
    this.traffic.reset();
    this.pedestrians.reset();
    this.buildRun();

    this.truck.reset(30, -1.6);
    this.mud.reset();
    this.truck.maxFrontS = this.route.highwayStartS - 25;
    this.truck.loadFrac = 0;
    this.truckModel.setCrates([]);
    this.truckModel.shuffleRearAd();
    this.cam.snap(this.truck);

    this.state.force('FARM');
    this.sound.engineStart();
    this.exhaust.reset();
    this.smokeKick = EXHAUST.player.startKick;
    this.hud.setRoute(this.route);
    this.hud.show(true);
    this.touch.show(true);
    this.hud.warn('{farm} ক্ষেতের পাশের সবুজ জায়গায় থেমে সবজি কিনুন', 'info', 4);
    track('level_start', { level_name: this.startId, route: this.startId, run_number: ++this.runCount });
  }

  /** the start point of the current run */
  get startPointId(): string {
    return this.startId;
  }

  /** How far the run got (for analytics): seconds played and % of the way to the market. */
  private runProgress(): { route: string; play_time_sec: number; progress_pct: number } {
    const market = this.route.events.find((e) => e.type === 'market');
    const pct = (100 * this.truck.s) / (market?.s ?? this.track.length);
    return { route: this.startId, play_time_sec: Math.round(this.runTime), progress_pct: Math.round(Math.min(100, Math.max(0, pct))) };
  }

  /** A run left before it ended: restarted, back to the menu or the tab closed. */
  private trackQuit(via: 'restart' | 'home' | 'close'): void {
    const phase = this.state.phase;
    if (phase !== 'FARM' && phase !== 'HIGHWAY') return;
    track('run_quit', { ...this.runProgress(), phase: phase.toLowerCase(), via });
  }

  depart(): void {
    if (this.state.phase !== 'FARM' || this.cargo.totalKg <= 0) return;
    if (this.buyPanel.isOpen) this.buyPanel.close();
    this.state.set('HIGHWAY');
    track('run_depart', { route: this.startId, cargo_kg: Math.round(this.cargo.totalKg), farm_time_sec: Math.round(this.runTime) });
    const market = this.route.events.find((e) => e.type === 'market');
    this.truck.maxFrontS = (market?.s ?? this.track.length) + 30;
    this.hud.warn('{truck} ঢাকার পথে রওনা! সাবধানে চালান', 'good', 3);
  }

  goHome(): void {
    this.trackQuit('home');
    this.state.paused = false;
    this.modal = false;
    this.closeOverlays();
    this.endTimer = -1;
    this.fallSide = 0;
    this.hud.show(false);
    this.touch.show(false);
    this.chase.reset();
    this.traffic.reset();
    this.thieves.reset();
    this.mud.reset();
    this.exhaust.reset();
    this.state.force('MENU');
    this.menu.show(true);
  }

  togglePause(): void {
    const phase = this.state.phase;
    if (phase !== 'FARM' && phase !== 'HIGHWAY') return;
    if (this.modal && !this.state.paused) return;
    this.state.paused = !this.state.paused;
    this.pauseMenu.show(this.state.paused);
    if (this.state.paused) this.sound.horn(false);
  }

  toggleCamera(): void {
    this.cam.toggle();
    const inside = this.cam.mode === 'cockpit';
    track('camera_change', { mode: this.cam.mode });
    // built the first time someone climbs in
    if (inside) this.cockpit ??= new Cockpit();
    this.truckModel.setCockpit(inside);
    this.cam.snap(this.truck);
  }

  /** Draw what goes over the 3D world (the cab interior in driver's view). */
  renderOverlay(renderer: THREE.WebGLRenderer): void {
    if (this.cam.mode === 'cockpit') this.cockpit?.render(renderer);
  }

  // ---------------------------------------------------------------- economy

  buy(veg: VegId, kg: number, locationBn: string): void {
    const v = VEGETABLES[veg];
    const affordable = Math.floor(this.cash / v.farmPricePerKg);
    kg = Math.min(kg, affordable, ECONOMY.truckCapacityKg - this.cargo.totalKg);
    if (kg <= 0) return;
    const cost = kg * v.farmPricePerKg;
    this.cash -= cost;
    this.cargo.add(veg, kg, v.farmPricePerKg);
    track('farm_purchase', { route: this.startId, veg, kg, cost });
    this.ledger.add({ category: 'PURCHASE', amount: cost, cash: true, kg, labelBn: `${v.nameBn} ${formatKg(kg)}`, locationBn, t: this.runTime });
    this.sound.coin();
    this.hud.floatText(`${v.icon} +${formatKg(kg)}`, 'good');
    this.refreshCrates();
  }

  estimatedRoadCost(): { legal: number; chanda: number } {
    let legal = 0;
    let chanda = 0;
    for (const e of this.route.events) {
      if (e.type === 'roadTax' || e.type === 'roadToll' || e.type === 'bridgeToll') legal += ECONOMY.fees[e.feeKey];
      if (e.type === 'barrier') chanda += e.chanda;
    }
    return { legal, chanda };
  }

  private refreshCrates(): void {
    const kg = this.cargo.totalKg;
    const n = kg > 0 ? Math.max(1, Math.round((kg / ECONOMY.truckCapacityKg) * MAX_CRATES)) : 0;
    this.truckModel.setCrates(this.cargo.crateColors(n));
    this.truck.loadFrac = kg / ECONOMY.truckCapacityKg;
  }

  /** Chanda, a toll or a fine: taken right away (cash first, then cargo) and booked in the ledger. */
  charge(req: PaymentRequest): void {
    const total = req.lines.reduce((a, l) => a + l.amount, 0);
    this.settle(req);
    this.hud.warn(
      req.kind === 'chanda' ? `{hand} ${req.titleBn} ${formatTaka(total)} কেটে নিল` : `{receipt} ${req.titleBn} ${formatTaka(total)} পরিশোধ`,
      req.kind === 'chanda' ? 'danger' : 'info',
      3,
    );
    if (req.messageBn) this.hud.toast(req.messageBn, 3);
    req.onPaid?.();
  }

  private settle(req: PaymentRequest): void {
    const kgBefore = this.cargo.totalKg;
    const perKgBefore = kgBefore > 0 ? this.ledger.cashSpent() / kgBefore : 0;
    let kgTaken = 0;
    for (const line of req.lines) {
      const cashPart = Math.min(this.cash, line.amount);
      if (cashPart > 0) {
        this.cash -= cashPart;
        this.ledger.add({ category: line.category, amount: cashPart, cash: true, kg: 0, labelBn: line.labelBn, locationBn: req.locationBn, t: this.runTime });
      }
      const rest = line.amount - cashPart;
      const avg = this.cargo.avgPricePerKg();
      if (rest > 0.5 && avg > 0) {
        const removed = this.cargo.removeProportional(rest / avg);
        if (removed.kg > 0) {
          kgTaken += removed.kg;
          this.ledger.add({ category: line.category, amount: removed.value, cash: false, kg: removed.kg, labelBn: `${line.labelBn} (মাল দিয়ে)`, locationBn: req.locationBn, t: this.runTime });
        }
      }
    }
    this.sound.coin();
    this.refreshCrates();
    const kgAfter = this.cargo.totalKg;
    const perKgAfter = kgAfter > 0 ? this.ledger.cashSpent() / kgAfter : 0;
    const delta = perKgAfter - perKgBefore;
    if (delta > 0.005) {
      this.hud.floatText(
        req.kind === 'chanda'
          ? `+${formatTaka(delta, 2)} প্রতি কেজি দাম বাড়লো`
          : `+${formatTaka(delta, 2)}/কেজি (${req.lines[0]?.category === 'FINE' ? 'জরিমানা' : 'বৈধ টোল'})`,
        req.kind === 'chanda' ? 'bad' : 'legal',
      );
    }
    if (kgTaken > 0) this.hud.toast(`{cabbage} নগদ শেষ — ${formatKg(kgTaken)} মাল নামিয়ে নিল`, 3.5);
  }

  /** A speed camera caught the truck: the fine is taken right away (cash first, then cargo), no dialog. */
  speedFine(kmh: number, limitKmh: number, locationBn: string): void {
    const f = ECONOMY.speedFine;
    const amount = f.base + f.perKmhOver * Math.round(kmh - limitKmh);
    this.settle({
      kind: 'toll',
      titleBn: 'স্পিড ক্যামেরা',
      messageBn: '',
      lines: [{ category: 'FINE', amount, labelBn: `গতিসীমা ${toBnDigits(limitKmh)}, চলছিল ${toBnDigits(Math.round(kmh))} কিমি/ঘণ্টা` }],
      locationBn,
    });
    this.sound.alarm();
    track('speed_fine', { route: this.startId, amount, kmh_over: Math.round(kmh - limitKmh) });
    this.hud.warn(`{camera} স্পিড ক্যামেরা! ${toBnDigits(Math.round(kmh))} কিমি/ঘণ্টা — জরিমানা ${formatTaka(amount)}`, 'fine', 3.5);
  }

  damageCargo(pct: number, labelBn: string, locationBn: string): void {
    const removed = this.cargo.removeProportional((this.cargo.totalKg * pct) / 100);
    if (removed.kg <= 0) return;
    this.ledger.add({ category: 'CARGO_LOSS', amount: removed.value, cash: false, kg: removed.kg, labelBn, locationBn, t: this.runTime });
    this.hud.floatText(`-${formatKg(removed.kg)} মাল নষ্ট`, 'bad');
    this.refreshCrates();
  }

  /** Thieves made off with kg of vegetables (booked as lost cargo). Returns the kg actually taken. */
  stealCargo(kg: number, locationBn: string): number {
    const removed = this.cargo.removeProportional(kg);
    if (removed.kg <= 0) return 0;
    this.ledger.add({ category: 'CARGO_LOSS', amount: removed.value, cash: false, kg: removed.kg, labelBn: 'জ্যামে সবজি চুরি', locationBn, t: this.runTime });
    this.hud.floatText(`-${formatKg(removed.kg)} সবজি চুরি!`, 'bad');
    this.sound.beep();
    this.refreshCrates();
    return removed.kg;
  }

  private reactToHorn(r: HonkResult): void {
    if (r.heavy > 0) this.hud.toast('{bus} বড় গাড়িও অবশেষে সাইড দিল!');
    else if (r.small > 0) this.hud.toast('{horn} সামনের গাড়ি সাইড দিল');
    else if (r.stubborn) {
      const name = r.stubborn.kind === 'bus' ? 'বাস' : 'ট্রাক';
      this.hud.toast(`${name === 'বাস' ? '{bus}' : '{truck}'} ${name} সাইড দিচ্ছে না — আরও হর্ন দিন (${toBnDigits(r.stubborn.count)}/${toBnDigits(TRAFFIC.heavyHonks)}) বা লম্বা হর্ন`, 2.5);
    }
  }

  // ---------------------------------------------------------------- events

  startChase(baseChanda: number, locationBn: string): void {
    this.chase.start(baseChanda, locationBn);
  }

  openBuyPanel(farm: FarmEvent): void {
    this.modal = true;
    this.truck.stop();
    this.buyPanel.open(farm);
  }

  onBuyPanelClosed(): void {
    this.modal = false;
  }

  gameOver(reason: Exclude<Outcome, 'arrived'>): void {
    if (this.state.phase !== 'HIGHWAY' && this.state.phase !== 'FARM') return;
    this.state.set('GAME_OVER');
    this.truck.stop();
    this.sound.horn(false);
    this.chase.reset();
    const why = {
      crash: '{crash} ভয়াবহ সংঘর্ষ!',
      toll: '{siren} টোল প্লাজা ভাঙার চেষ্টা — ট্রাক জব্দ!',
      helper: '{warning} হেল্পারকে নিতে ভুলে গেছেন! আবার চেষ্টা করেন।',
      fall: '{crash} বাঁকে বেশি জোরে — ট্রাক খাদে পড়ে গেল!',
    } as const;
    this.hud.warn(why[reason], 'danger', 3);
    if (reason === 'toll') this.sound.whistle();
    this.pendingOutcome = reason;
    this.endTimer = 1.8;
  }

  arrive(): void {
    if (this.state.phase !== 'HIGHWAY') return;
    this.state.set('ARRIVAL');
    this.sound.crowd(2);
    this.hud.warn('{cart} কাওরান বাজারে পৌঁছেছেন!', 'good', 3);
    this.pendingOutcome = 'arrived';
    this.endTimer = 2.6;
  }

  private showResult(): void {
    const outcome = this.pendingOutcome ?? 'arrived';
    if (this.state.phase === 'ARRIVAL') this.state.set('RESULT');
    this.hud.show(false);
    this.touch.show(false);
    const r = computeResults(this.ledger, this.cargo, this.stats, outcome);
    const market = this.route.events.find((e) => e.type === 'market');
    const distance = (market?.s ?? this.track.length) - this.route.highwayStartS;
    const score = computeScore({ arrived: outcome === 'arrived', profit: r.profit, driveTime: this.stats.highwayTime, distance });
    const submitted = player.name
      ? submitRun({ startId: this.startId, outcome, profit: r.profit, driveTime: this.stats.highwayTime, distance })
      : null;
    const st = this.stats;
    track('level_end', {
      ...this.runProgress(),
      level_name: this.startId,
      success: outcome === 'arrived',
      outcome,
      score: score.points,
      profit: Math.round(r.profit),
      drive_time_sec: Math.round(st.highwayTime),
      barriers_paid: st.barriersPaid,
      barriers_broken: st.barriersBroken,
      chases_escaped: st.chasesEscaped,
      chases_caught: st.chasesCaught,
      collisions: st.collisions,
    });
    this.result.show(r, score, submitted);
  }

  /** Is the truck on a village shortcut that goes round s (a barrier back on the highway)? */
  bypasses(s: number): boolean {
    const r = this.truck.road;
    return !!r && !r.inMouth(this.truck.s) && s > r.from && s < r.to;
  }

  /** Black smoke from the truck's tailpipe: a cloud when the engine starts or when it's floored from low speed. */
  private truckSmoke(dt: number): void {
    const P = EXHAUST.player;
    const t = this.truck;
    this.smokeKick = Math.max(0, this.smokeKick - dt);
    const throttle = this.modal ? 0 : this.input.throttle;
    // hardest pulling at low speed, easing off near top speed
    const pull = Math.max(this.smokeKick / P.startKick, throttle * Math.max(0, 1 - t.kmh / 110));
    const m = this.truckModel.root;
    this.exhaust.emit(dt, m.position.x, m.position.y, m.position.z, m.rotation.y, t.speed, P,
      P.rate + (P.accelRate - P.rate) * pull, P.size + (P.accelSize - P.size) * pull, P.alpha + (P.accelAlpha - P.alpha) * pull);
  }

  /** The truck rolls over the edge and down the slope into the valley (the camera stays on the road). */
  private tumble(dt: number): void {
    if (!this.state.paused) this.fallT = Math.min(this.fallT + dt, 2.5);
    const k = this.fallSide;
    const f = this.fallT;
    const r = this.truckModel.root;
    const h = this.truck.heading;
    const out = 3 * f + 2 * f * f;
    // sideways (across the road) is (cos, sin) of the heading in (x, z)
    r.position.x += k * out * Math.cos(h);
    r.position.z += k * out * Math.sin(h);
    r.position.y = Math.max(0.6, r.position.y - 4.9 * f * f);
    r.rotation.z = -k * Math.min(f * 2.2, 2.6);
  }

  nextBlockingPiece(fromS: number): SetPiece | null {
    let best: SetPiece | null = null;
    for (const p of this.routePieces) if (p.blocking && p.s > fromS - 1 && !this.bypasses(p.s) && (!best || p.s < best.s)) best = p;
    return best;
  }

  nextPieceAhead(fromS: number): SetPiece | null {
    let best: SetPiece | null = null;
    for (const p of this.routePieces) if (p.s > fromS && !this.bypasses(p.s) && (!best || p.s < best.s)) best = p;
    return best;
  }

  // ---------------------------------------------------------------- frame

  update(dt: number): void {
    this.input.update(dt);
    const phase = this.state.phase;
    const t = this.truck;

    if (!this.state.paused) {
      const driving = phase === 'FARM' || phase === 'HIGHWAY' || phase === 'ARRIVAL';
      if (driving) {
        this.runTime += dt;
        if (phase === 'HIGHWAY') this.stats.highwayTime += dt;
        if (this.modal) t.stop();
        const inp = this.modal ? NO_INPUT : phase === 'ARRIVAL' ? ARRIVAL_BRAKE : this.input;
        t.rumble = false;
        this.hud.tollMode = false;
        this.wind = 0;
        this.brokenRoads.update();
        this.mud.preUpdate();
        t.update(dt, inp);
        for (const p of this.pieces) p.update(dt);
        this.traffic.update(dt);
        this.chase.update(dt);
        this.pedestrians.update(dt);
        this.slowZones.update(dt);
        this.thieves.update(dt);
        this.mud.update(dt);
        this.shortcuts.update();
        this.hillRoad.update(dt);
        // ran off the edge of the hill road where it drops into the valley
        const off = phase === 'HIGHWAY' ? this.track.fallsOff(t.s, t.d) : 0;
        if (off) {
          this.fallSide = off;
          this.fallT = 0;
          this.gameOver('fall');
          // when it hits the slope
          this.sound.finalCrash(0.6);
        }
        const honking = this.input.horn && !this.modal && phase !== 'ARRIVAL';
        this.sound.horn(honking);
        // Horn: each press is a tap; holding it counts as a long press (buses & trucks need that or 3 taps)
        if (honking && phase === 'HIGHWAY') {
          if (!this.wasHonking) {
            if (this.thieves.scare() > 0) this.hud.toast('{horn} হর্ন শুনে চোর পালালো!');
            this.reactToHorn(this.traffic.honk('tap'));
          }
          this.hornHeld += dt;
          if (this.hornHeld >= TRAFFIC.longHornSeconds && !this.longHornSent) {
            this.longHornSent = true;
            this.reactToHorn(this.traffic.honk('long'));
          }
        } else {
          this.hornHeld = 0;
          this.longHornSent = false;
        }
        this.wasHonking = honking;
        this.farmWallCooldown -= dt;
        if (phase === 'FARM' && t.frontS >= t.maxFrontS - 0.5 && this.farmWallCooldown <= 0) {
          this.farmWallCooldown = 4;
          this.hud.warn(this.cargo.totalKg > 0 ? '{truck} "শহরের দিকে রওনা" চাপুন' : '{farm} আগে ক্ষেত থেকে সবজি কিনুন', 'info', 2.5);
        }
      } else if (phase === 'MENU') {
        // gentle idle: keep the world alive behind the menu
        this.wind = 0;
        for (const p of this.pieces) p.update(dt);
      }
      if (this.endTimer > 0) {
        this.endTimer -= dt;
        if (this.endTimer <= 0) this.showResult();
      }
    }

    if (this.streamer.update(t.s)) {
      const [a, b] = this.streamer.window;
      this.scenery.rebuild(a, b);
      this.clutter.rebuild(a, b);
    }
    for (const p of this.pieces) {
      const [a, b] = p.visibleRange();
      p.group.visible = t.s > a && t.s < b;
    }
    this.truckModel.update(dt, t.x, t.y, t.z, t.heading, t.pitch, t.speed, t.steer, t.yawRate, t.bump);
    if (!this.state.paused) {
      const driving = phase === 'FARM' || phase === 'HIGHWAY' || phase === 'ARRIVAL';
      if (driving && !this.fallSide) this.truckSmoke(dt);
      this.exhaust.update(dt);
    }
    if (this.fallSide) this.tumble(dt);
    this.cam.update(dt, t);
    if (!this.state.paused) this.weather.update(dt);
    const look = this.weather.look;
    if (this.cam.mode === 'cockpit' && this.cockpit) {
      const throttle = this.state.paused || this.modal ? 0 : this.input.throttle;
      this.cockpit.update(this.state.paused ? 0 : dt, this.cam.camera, { kmh: t.kmh, steer: t.steer, throttle, look, flash: this.weather.flash });
    }
    this.env.apply(look, this.weather.flash);
    this.env.update(dt, this.cam.camera, this.truckModel.root.position, look.rain);
    this.truckModel.setHeadlights(look.headlights);
    this.truck.wet = look.wet;
    this.traffic.setLights(look.headlights);
    this.sound.setRain(this.state.paused ? 0 : look.rain);
    this.hud.update(dt);

    const running = !this.state.paused && (phase === 'FARM' || phase === 'HIGHWAY' || phase === 'ARRIVAL');
    this.sound.setEngine(Math.min(1, Math.abs(t.speed) / 32), running ? this.input.throttle : 0, running, t.kmh);
    this.sound.setWind(this.state.paused ? 0 : this.wind);

    this.debug.set('phase', phase + (this.state.paused ? ' (paused)' : '') + (this.modal ? ' [modal]' : ''));
    this.debug.set('s/d', `${t.s.toFixed(0)} / ${t.d.toFixed(1)}`);
    this.debug.set('kmh', t.kmh.toFixed(1));
    this.debug.set('chase', this.chase.active ? `${this.chase.meter.toFixed(1)}s gap ${this.chase.gap.toFixed(0)}m` : '-');
  }
}
