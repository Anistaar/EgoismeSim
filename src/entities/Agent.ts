import type { AgentBrain } from "../ai/AgentBrain";
import type { House } from "./House";

let NEXT_ID = 1;

export interface AgentOpts {
  speed?: number;
  senseRadius?: number;
  pickupRadius?: number;
  home: House;
  brain: AgentBrain;
  egoPercent: number;     // 0..100
}

export class Agent {
  id = NEXT_ID++;
  pos: { x: number; y: number };
  vel: { x: number; y: number } = { x: 0, y: 0 };
  dir: number = Math.random() * Math.PI * 2;
  radius = 8;

  // stats du jour
  points = 0;
  distToday = 0;          // ⬅️ ajouté

  // perf/IA
  speed: number;
  senseRadius: number;
  pickupRadius: number;
  wanderTimer = 0;

  // maison & états fin de journée
  home: House;
  returningHome = false;
  atHome = false;

  ego: number;            // 0..1

  brain: AgentBrain;

  constructor(x: number, y: number, opts: AgentOpts) {
    this.pos = { x, y };
    this.speed = opts.speed ?? 180;
    this.senseRadius = opts.senseRadius ?? 220;
    this.pickupRadius = opts.pickupRadius ?? 18;
    this.home = opts.home;
    this.brain = opts.brain;
    this.ego = Math.min(1, Math.max(0, opts.egoPercent / 100));
  }

  update(dt: number) {
    const cos = Math.cos(this.dir), sin = Math.sin(this.dir);
    this.vel.x = cos * this.speed;
    this.vel.y = sin * this.speed;

    const px = this.pos.x, py = this.pos.y;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    // distance réellement parcourue ce tick
    const dx = this.pos.x - px, dy = this.pos.y - py;
    this.distToday += Math.hypot(dx, dy);
  }

  steerToward(target: { x: number; y: number }, dt: number) {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const ang = Math.atan2(dy, dx);
    const turnRate = 6.0;
    let delta = ((ang - this.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const maxStep = turnRate * dt;
    if (delta > maxStep) delta = maxStep;
    if (delta < -maxStep) delta = -maxStep;
    this.dir += delta;
  }

  wander(dt: number) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = Math.random() * 1.2 + 0.2;
      this.dir += (Math.random() - 0.5) * 0.8;
    }
  }

  draw(_ctx: CanvasRenderingContext2D) {}
}
