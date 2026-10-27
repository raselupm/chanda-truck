// Arcade kinematic truck physics expressed in road coordinates (s along the road, d across it).

import { BROKEN_ROAD, TRUCK, WORLD } from '../config/tuning';
import type { DriveInput } from '../game/Input';
import { clamp, damp, lerp } from '../utils/math';
import type { Track } from '../world/Track';

const HALF_LEN = TRUCK.length / 2;

export class TruckController {
  x = 0;
  y = 0;
  z = 0;
  heading = 0;
  pitch = 0;
  /** m/s, negative when reversing */
  speed = 0;
  steer = 0;
  yawRate = 0;
  s = 0;
  d = 0;
  offRoad = false;
  scraping = false;
  /** 0..1 cargo load, reduces acceleration */
  loadFrac = 0;
  /** walls along the route */
  minS = 6;
  maxFrontS = Infinity;
  /** visual bumpiness (rumble strips, off-road) */
  bump = 0;
  rumble = false;
  /** broken road: bumpy, and no faster than speedCapKmh */
  rough = false;
  speedCapKmh = Infinity;
  /** 0..1 how wet the road is (longer braking, a little less steering) */
  wet = 0;
  /** wheels sunk in mud: the truck can't move at all */
  stuck = false;
  /** being pushed out of the mud: no faster than this either way */
  mudCapKmh = Infinity;
  private bumpPhase = 0;

  constructor(private track: Track) {}

  setTrack(track: Track): void {
    this.track = track;
  }

  get kmh(): number {
    return this.speed * 3.6;
  }

  get frontS(): number {
    return this.s + HALF_LEN * Math.cos(this.heading - this.track.headingAt(this.s));
  }

  get rearS(): number {
    return this.s - HALF_LEN;
  }

  reset(s: number, d: number): void {
    this.speed = 0;
    this.steer = 0;
    this.yawRate = 0;
    this.heading = this.track.headingAt(s);
    this.setS(s, d);
  }

  private setS(s: number, d: number): void {
    this.s = s;
    this.d = d;
    this.z = -s;
    this.x = this.track.centerX(s) + d;
    this.y = this.track.surfaceY(s);
  }

  stop(): void {
    this.speed = 0;
  }

  /** Push the truck back so its front is no further than frontS. */
  clampFront(frontS: number): void {
    const over = this.frontS - frontS;
    if (over > 0) this.setS(this.s - over, this.d);
  }

  /** Nudge sideways (collisions). */
  shiftLateral(dd: number): void {
    this.setS(this.s, this.d + dd);
  }

  update(dt: number, input: DriveInput): void {
    const T = TRUCK;
    const maxV = T.maxSpeedKmh / 3.6;
    const revMax = T.reverseMaxKmh / 3.6;
    const { throttle, brake, handbrake } = input;
    this.steer = input.steer;

    // Longitudinal
    let a = 0;
    if (throttle > 0) {
      if (this.speed >= -0.3) {
        const r = Math.max(0, this.speed) / maxV;
        a += T.engineAccel * throttle * Math.max(0, 1 - Math.pow(r, T.engineCurveExp)) * (1 - T.loadAccelPenalty * this.loadFrac);
      } else {
        a += T.brakeDecel * throttle;
      }
    }
    if (brake > 0) {
      if (this.speed > 0.3) a -= T.brakeDecel * (1 - 0.2 * this.wet) * brake;
      else if (throttle === 0 && this.speed > -revMax) a -= T.reverseAccel * brake;
    }
    this.speed += a * dt;
    let resist = T.coastDecel + T.airDrag * this.speed * this.speed;
    if (this.offRoad && Math.abs(this.speed) > 6) resist += T.offroadDecel;
    if (handbrake) resist += T.handbrakeDecel;
    const reversing = brake > 0 && this.speed <= 0.3 && throttle === 0;
    if (!reversing || this.speed > 0) {
      const dv = Math.min(Math.abs(this.speed), resist * dt);
      this.speed -= Math.sign(this.speed) * dv;
    }
    if (this.speed < -revMax) this.speed = -revMax;
    if (this.speed > maxV) this.speed = maxV;
    if (this.stuck) this.speed = 0;
    const mudCap = this.mudCapKmh / 3.6;
    if (Math.abs(this.speed) > mudCap) this.speed = Math.sign(this.speed) * mudCap;
    // Broken road: the potholes won't let you go faster (shed the extra speed quickly)
    const cap = this.speedCapKmh / 3.6;
    if (this.speed > cap) this.speed = Math.max(cap, this.speed - BROKEN_ROAD.slowDecel * dt);

    // Steering: yaw rate falls with speed; tiny at standstill
    const v = Math.abs(this.speed);
    let maxYaw = lerp(T.maxYawLow, T.maxYawHigh, clamp((v * 3.6) / 100, 0, 1)) * Math.min(1, v / 4);
    if (handbrake) maxYaw *= 1.4;
    maxYaw *= 1 - 0.1 * this.wet;
    // Yaw follows the wheel with a little lag so turns ease in and out
    // scaled with the world speed so turning circles stay the same size
    this.yawRate = damp(this.yawRate, this.steer * maxYaw * WORLD.speedScale * (this.speed < 0 ? -1 : 1), T.yawResponse, dt);
    this.heading += this.yawRate * dt;
    const roadH = this.track.headingAt(this.s);
    // No driving assist: the truck keeps its heading; the player steers through every bend.
    this.heading = clamp(this.heading, roadH - T.maxHeadingOffset, roadH + T.maxHeadingOffset);

    // Integrate position
    // World speed scale: we cover more ground per second than the speedometer says (faster trip)
    const move = this.speed * WORLD.speedScale * dt;
    this.x += Math.sin(this.heading) * move;
    this.z -= Math.cos(this.heading) * move;
    let s = -this.z;
    let d = this.x - this.track.centerX(s);

    // Walls along the route
    if (s < this.minS) {
      s = this.minS;
      if (this.speed < 0) this.speed = 0;
    }
    const front = s + HALF_LEN;
    if (front > this.maxFrontS) {
      s = this.maxFrontS - HALF_LEN;
      if (this.speed > 0) this.speed = 0;
    }

    const [lo, hi] = this.track.lateralRange(s);
    this.scraping = false;
    if (d < lo || d > hi) {
      d = d < lo ? lo : hi;
      this.scraping = true;
      this.speed *= 1 - Math.min(1, 1.2 * dt);
      this.heading = damp(this.heading, roadH, 4, dt);
    }
    this.setS(s, d);
    this.offRoad = Math.abs(d) > this.track.halfWidth(s) + 2.2 && !this.track.bridgeAt(s);
    this.pitch = Math.atan(this.track.slopeAt(s));

    // Visual bump
    const rough = (this.offRoad ? 1 : 0) + (this.rumble ? 1.2 : 0) + (this.rough ? 1.6 : 0);
    this.bumpPhase += dt * (8 + v * 0.8);
    this.bump = rough > 0 ? Math.sin(this.bumpPhase) * 0.04 * rough * Math.min(1, v / 8) : 0;
  }
}
