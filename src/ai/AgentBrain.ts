import type { Agent } from "../entities/Agent";
import type { Cow } from "../entities/Cow";

export interface BrainSense {
  agent: Agent;
  dt: number;
  world: { width: number; height: number };
  nearbyCows: Cow[];
}

export interface AgentBrain {
  id: string;
  update(sense: BrainSense): void;
}

/** IA "égoïste/greedy" : vise la vache la plus proche ; évite les bords. */
export class GreedySelfishBrain implements AgentBrain {
  id = "greedy_selfish";
  private centerBias: number;

  constructor(opts?: { wallMargin?: number; centerBias?: number }) {
    this.centerBias = opts?.centerBias ?? 0.001;
  }

  update(sense: BrainSense) {
    const { agent: a, dt, world, nearbyCows } = sense;

    // Cible : vache la plus proche
    const senseR2 = a.senseRadius * a.senseRadius;
    let best: Cow | null = null;
    let bestD2 = senseR2;
    for (const c of nearbyCows) {
      const dx = a.pos.x - c.pos.x, dy = a.pos.y - c.pos.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = c; }
    }

    if (best) a.steerToward(best.pos, dt);
    else if (Math.random() < this.centerBias) a.steerToward({ x: world.width*0.5, y: world.height*0.5 }, dt);
    else a.wander(dt);
  }
}
