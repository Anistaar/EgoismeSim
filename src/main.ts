import { Camera } from "./core/Camera";
import { Input } from "./core/Input";
import { World } from "./core/World";
import { Renderer } from "./core/Renderer";
import { GameLoop } from "./core/GameLoop";

import { Agent } from "./entities/Agent";
import { House } from "./entities/House";
import { Cow } from "./entities/Cow";
import { SpatialHash } from "./sim/SpatialHash";
import { clamp, randRange } from "./entities/types";
import { getTheme, PrimitivesTheme } from "./visuals/Theme";
import { SpritesTheme } from "./visuals/ThemeSprites";
import { GreedySelfishBrain } from "./ai/AgentBrain";
import { OutcomeBuckets, StatsPanel } from "./ui/StatsPanel";

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1500;
const DAY_DURATION_SEC = 30;

// RÈGLES
const COW_VALUE = 50;
const TARGET_COWS = 20;
const SURVIVE_POINTS = 55;
const REPRO_EVERY = 50;
const HOUSE_CAPACITY = 10000;

// NOUVEAU : vaches jamais trop près des maisons
const COW_HOUSE_BUFFER = 64; // px (augmenter si besoin)

enum SimMode { Auto = "Auto", Turn = "Tour" }
enum Phase { Daytime = "Jour", Returning = "RetourMaison", Waiting = "Attente" }

type PopulationPreset = "uniform10each" | "all70" | "all30";

class Simulation {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hud: HTMLElement;
  private btnToggleMode: HTMLButtonElement;
  private btnNextDay: HTMLButtonElement;
  private selectTheme: HTMLSelectElement;
  private selectPreset: HTMLSelectElement;
  private btnResetPop: HTMLButtonElement;

  private stats: StatsPanel;

  private dpr = 1;
  private camera: Camera;
  private input: Input;
  private world: World;
  private renderer: Renderer;
  private loop: GameLoop;

  private viewW = 0;
  private viewH = 0;

  private agents: Agent[] = [];
  private houses: House[] = [];
  private cows: Cow[] = [];

  private cowHash = new SpatialHash<Cow>(96);
  private agentHash = new SpatialHash<Agent>(96);

  private dayTime = 0;
  private dayCount = 1;
  private phase: Phase = Phase.Daytime;
  private mode: SimMode = SimMode.Auto;
  private preset: PopulationPreset = "uniform10each";

  private dayCowKills = 0;

  private autoWaitTimer = 0;
  private AUTO_WAIT_SEC = 1.0;

  constructor(
    canvas: HTMLCanvasElement,
    hud: HTMLElement,
    btnToggleMode: HTMLButtonElement,
    btnNextDay: HTMLButtonElement,
    selectTheme: HTMLSelectElement,
    selectPreset: HTMLSelectElement,
    btnResetPop: HTMLButtonElement,
    charts: {
      hist: HTMLCanvasElement; pop: HTMLCanvasElement; cows: HTMLCanvasElement; dist: HTMLCanvasElement; outcomes: HTMLCanvasElement;
    }
  ) {
    this.canvas = canvas;
    this.hud = hud;
    this.btnToggleMode = btnToggleMode;
    this.btnNextDay = btnNextDay;
    this.selectTheme = selectTheme;
    this.selectPreset = selectPreset;
    this.btnResetPop = btnResetPop;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    this.ctx = ctx;

    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.measureViewportFromCanvas();

    this.world = new World(WORLD_WIDTH, WORLD_HEIGHT);
    this.camera = new Camera(this.viewW, this.viewH, WORLD_WIDTH, WORLD_HEIGHT, { minScale: 0.25, maxScale: 4 });
    this.input = new Input(this.canvas, this.camera);
    this.renderer = new Renderer(this.ctx, this.camera, this.world, this.dpr, PrimitivesTheme);

    // Stats
    this.stats = new StatsPanel(charts);

    // UI
    this.btnToggleMode.addEventListener("click", () => this.toggleMode());
    this.btnNextDay.addEventListener("click", () => this.tryStartNextDay());
    this.selectTheme.addEventListener("change", () => {
      const val = this.selectTheme.value;
      if (val === "sprites") this.renderer.setTheme(SpritesTheme);
      else this.renderer.setTheme(getTheme(val));
    });
    this.selectPreset.addEventListener("change", () => {
      this.preset = (this.selectPreset.value as PopulationPreset);
    });
    this.btnResetPop.addEventListener("click", () => {
      this.resetPopulation(this.preset);
      // reset historique
      this.stats.popHistory = [];
      this.stats.cowsHistory = [];
      this.stats.distAvgHistory = [];
      this.stats.outcomesHistory = [];
      this.dayCount = 1;
    });

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "m") this.toggleMode();
      if (k === "n") this.tryStartNextDay();
      if (k === "h") { this.camera.setPosition(0, 0); this.camera.setScale(1); }
    });

    // Thème initial
    {
      const val = this.selectTheme.value;
      if (val === "sprites") this.renderer.setTheme(SpritesTheme);
      else this.renderer.setTheme(getTheme(val));
    }

    // Population & vaches
    this.resetPopulation(this.preset);
    this.ensureCowCount();

    this.startDay();

    this.loop = new GameLoop(this.update, this.render);
    this.loop.start();

    window.addEventListener("resize", this.onResize, { passive: true });
    requestAnimationFrame(() => this.onResize());
    this.updateButtons();
  }

  private measureViewportFromCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const cw = Math.max(1, Math.floor(rect.width));
    const ch = Math.max(1, Math.floor(rect.height));
    this.viewW = cw; this.viewH = ch;
    this.canvas.width = Math.floor(cw * this.dpr);
    this.canvas.height = Math.floor(ch * this.dpr);
    if (this.camera) this.camera.setViewportSize(this.viewW, this.viewH);
  }

  /** === Population / maisons === */
  private resetPopulation(preset: PopulationPreset) {
    this.houses.length = 0;
    const center = new House(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.houses.push(center);

    this.agents.length = 0;
    if (preset === "uniform10each") {
      for (let p = 0; p <= 100; p++) {
        for (let i = 0; i < 10; i++) {
          const jitter = () => (Math.random() - 0.5) * 80;
          this.agents.push(new Agent(
            center.pos.x + jitter(), center.pos.y + jitter(),
            { home: center, brain: new GreedySelfishBrain(), egoPercent: p }
          ));
        }
      }
    } else if (preset === "all70" || preset === "all30") {
      const p = preset === "all70" ? 70 : 30;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        const jitter = () => (Math.random() - 0.5) * 80;
        this.agents.push(new Agent(
          center.pos.x + jitter(), center.pos.y + jitter(),
          { home: center, brain: new GreedySelfishBrain(), egoPercent: p }
        ));
      }
    }
    this.rebuildHousesForPopulation();
  }

  private rebuildHousesForPopulation() {
    const needed = Math.max(1, Math.ceil(this.agents.length / HOUSE_CAPACITY));
    while (this.houses.length < needed) {
      for (let tries = 0; tries < 200; tries++) {
        const x = randRange(80, WORLD_WIDTH - 80);
        const y = randRange(80, WORLD_HEIGHT - 80);
        const ok = this.houses.every(h => Math.hypot(h.pos.x - x, h.pos.y - y) >= 60 + h.radius + 18);
        if (ok) { this.houses.push(new House(x, y)); break; }
      }
      if (this.houses.length >= needed) break;
    }
    for (const a of this.agents) {
      let best = this.houses[0], bestD2 = Infinity;
      for (const h of this.houses) {
        const dx = h.pos.x - a.pos.x, dy = h.pos.y - a.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; best = h; }
      }
      a.home = best;
    }
  }

  /** === VACHES : jamais sur/près des maisons === */
  private spawnCowAwayFromHouses(): Cow {
    for (let tries = 0; tries < 200; tries++) {
      const x = randRange(12, WORLD_WIDTH - 12);
      const y = randRange(12, WORLD_HEIGHT - 12);
      const farEnough = this.houses.every(h => {
        const d = Math.hypot(h.pos.x - x, h.pos.y - y);
        return d >= h.radius + COW_HOUSE_BUFFER;
      });
      if (farEnough) return new Cow(x, y);
    }
    // fallback (rare) : on ne bloque pas le spawn
    return new Cow(randRange(0, WORLD_WIDTH), randRange(0, WORLD_HEIGHT));
  }

  private ensureCowCount() {
    while (this.cows.length < TARGET_COWS) {
      this.cows.push(this.spawnCowAwayFromHouses());
    }
  }

  private respawnCow() {
    this.cows.push(this.spawnCowAwayFromHouses());
  }

  /** === Cycle jour === */
  private startDay() {
    this.dayTime = 0;
    this.phase = Phase.Daytime;
    this.dayCowKills = 0;
    for (const a of this.agents) {
      a.returningHome = false;
      a.atHome = false;
      a.points = 0;
      a.distToday = 0;
    }
  }

  private endOfDay() {
    const N = this.agents.length || 1;
    const avgDist = this.agents.reduce((s, a) => s + a.distToday, 0) / N;

    // outcomes + reproductions
    const outcomes: OutcomeBuckets = { dead: 0, survived: 0, r1: 0, r2: 0, r3: 0, r4p: 0 };

    const survivors: Agent[] = [];
    const births: Agent[] = [];

    for (const a of this.agents) {
      if (a.points < SURVIVE_POINTS) {
        outcomes.dead++;
      } else {
        const extra = a.points - SURVIVE_POINTS;
        const babies = Math.floor(extra / REPRO_EVERY);
        if (babies <= 0) outcomes.survived++;
        else if (babies === 1) outcomes.r1++;
        else if (babies === 2) outcomes.r2++;
        else if (babies === 3) outcomes.r3++;
        else outcomes.r4p++;

        survivors.push(a);
        for (let i = 0; i < babies; i++) {
          const h = a.home;
          const jitter = () => (Math.random() - 0.5) * 40;
          const childEgo = mutateEgoPercent(Math.round(a.ego * 100));
          births.push(new Agent(h.pos.x + jitter(), h.pos.y + jitter(), {
            home: h, brain: new GreedySelfishBrain(), egoPercent: childEgo
          }));
        }
      }
    }

    this.agents = survivors.concat(births);

    // snapshot stats
    this.stats.commitDaySnapshot({
      populationAfter: this.agents.length,
      cowsKilled: this.dayCowKills,
      avgDistance: avgDist,
      outcomes,
    });

    this.rebuildHousesForPopulation();

    for (const a of this.agents) {
      a.returningHome = true; a.atHome = false;
      a.points = 0; a.distToday = 0;
    }
    this.phase = Phase.Returning;
    this.autoWaitTimer = 0;
  }

  /** === UI / Mode === */
  private toggleMode() {
    this.mode = this.mode === SimMode.Auto ? SimMode.Turn : SimMode.Auto;
    this.autoWaitTimer = 0; this.updateButtons();
  }
  private tryStartNextDay() {
    if (this.mode !== SimMode.Turn) return;
    if (this.phase !== Phase.Waiting) return;
    this.dayCount++; this.startDay(); this.updateButtons();
  }
  private updateButtons() {
    this.btnToggleMode.textContent = this.mode === SimMode.Auto ? "Auto" : "Tour";
    const waiting = this.phase === Phase.Waiting;
    this.btnNextDay.disabled = !(this.mode === SimMode.Turn && waiting);
  }

  /** === Loop === */
  private onResize = () => { this.measureViewportFromCanvas(); };

  // NOUVEAU : évitement doux des maisons (utile à grande vitesse)
  private avoidHouses(a: Agent, dt: number) {
    if (a.returningHome) return; // on n'évite pas sa propre maison au retour
    for (const h of this.houses) {
      const dx = a.pos.x - h.pos.x;
      const dy = a.pos.y - h.pos.y;
      const dist = Math.hypot(dx, dy);
      const min = h.radius + 14; // rayon de sécurité
      if (dist < min) {
        const nx = (dx || 0.0001) / (dist || 1);
        const ny = (dy || 0.0001) / (dist || 1);
        // pousse le point à l'extérieur du disque + petit tampon
        const targetDist = min + 6;
        a.pos.x = h.pos.x + nx * targetDist;
        a.pos.y = h.pos.y + ny * targetDist;
        // oriente légèrement à l'opposé
        const away = Math.atan2(ny, nx);
        const turnRate = 4.5;
        let delta = ((away - a.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const maxStep = turnRate * dt;
        if (delta > maxStep) delta = maxStep;
        if (delta < -maxStep) delta = -maxStep;
        a.dir += delta;
      }
    }
  }

  private update = (dt: number) => {
    if (this.phase === Phase.Daytime) {
      this.dayTime += dt;

      this.cowHash.clear(); for (const c of this.cows) this.cowHash.insert(c);
      this.agentHash.clear(); for (const a of this.agents) this.agentHash.insert(a as any);

      for (const a of this.agents) {
        const nearbyCows = this.cowHash.queryAround(a.pos.x, a.pos.y);
        a.brain.update({ agent: a, dt, world: { width: WORLD_WIDTH, height: WORLD_HEIGHT }, nearbyCows });
        a.update(dt);
        this.avoidHouses(a, dt); // ⬅️ évitement
        a.pos.x = clamp(a.pos.x, 0, WORLD_WIDTH);
        a.pos.y = clamp(a.pos.y, 0, WORLD_HEIGHT);
      }

      this.resolveCowKills();

      // garde-fou : on garantit le stock de vaches
      if (this.cows.length < TARGET_COWS) this.ensureCowCount();

      if (this.dayTime >= DAY_DURATION_SEC) this.endOfDay();
    } else if (this.phase === Phase.Returning) {
      for (const a of this.agents) {
        if (a.atHome) continue;
        const h = a.home;
        a.steerToward(h.pos, dt);
        a.update(dt);
        a.pos.x = clamp(a.pos.x, 0, WORLD_WIDTH);
        a.pos.y = clamp(a.pos.y, 0, WORLD_HEIGHT);
        const arriveDist = a.radius + h.radius + 2;
        const dx = a.pos.x - h.pos.x, dy = a.pos.y - h.pos.y;
        if (dx * dx + dy * dy <= arriveDist * arriveDist) {
          a.atHome = true; a.returningHome = false;
          const j = () => (Math.random() - 0.5) * 6;
          a.pos.x = h.pos.x + j(); a.pos.y = h.pos.y + j();
        }
      }
      if (this.everyoneAtHome()) { this.phase = Phase.Waiting; this.updateButtons(); }
    } else if (this.phase === Phase.Waiting) {
      if (this.mode === SimMode.Turn) this.autoWaitTimer = 0;
      else {
        this.autoWaitTimer += dt;
        if (this.autoWaitTimer >= this.AUTO_WAIT_SEC) {
          this.dayCount++; this.startDay(); this.updateButtons(); this.autoWaitTimer = 0;
        }
      }
    }

    // stats : live + répartition
    const N = this.agents.length || 1;
    const liveAvgDist = this.agents.reduce((s, a) => s + a.distToday, 0) / N;
    this.stats.setLive(this.agents.length, this.dayCowKills, liveAvgDist);
    this.stats.updateRealtime(this.agents);
    this.stats.render();

    const { w, h } = this.camera.getViewportSize();
    const timeLeft = this.phase === Phase.Daytime ? Math.max(0, DAY_DURATION_SEC - this.dayTime) : 0;
    this.hud.innerHTML =
      `Jour <code>${this.dayCount}</code> | Phase <code>${this.phase}</code> | ` +
      (this.phase === Phase.Daytime ? `reste <code>${timeLeft.toFixed(1)}s</code> | ` : ``) +
      `Agents <code>${this.agents.length}</code> | ` +
      `Vaches <code>${this.cows.length}</code> | ` +
      `Maisons <code>${this.houses.length}</code><br/>` +
      `Mode <code>${this.mode}</code> | ` +
      `cameraX=<code>${Math.round(this.camera.x)}</code> | ` +
      `cameraY=<code>${Math.round(this.camera.y)}</code> | ` +
      `zoom=<code>${this.camera.scale.toFixed(2)}x</code> | ` +
      `viewport=<code>${w}×${h}</code>`;
  };

  private everyoneAtHome(): boolean { return this.agents.every(a => a.atHome); }

  private render = () => {
    this.renderer.render(this.viewW, this.viewH, {
      agents: this.agents, houses: this.houses, cows: this.cows
    });
  };

  /** Abattage + métriques */
  private resolveCowKills() {
    for (let i = this.cows.length - 1; i >= 0; i--) {
      const cow = this.cows[i];
      const nearbyAgents = this.agentHash.queryAround(cow.pos.x, cow.pos.y).filter(a => {
        const dx = a.pos.x - cow.pos.x, dy = a.pos.y - cow.pos.y;
        return (dx * dx + dy * dy) <= (cow.radius + a.pickupRadius) * (cow.radius + a.pickupRadius);
      });
      if (nearbyAgents.length >= 2) {
        nearbyAgents.sort((a, b) => {
          const da = (a.pos.x - cow.pos.x) ** 2 + (a.pos.y - cow.pos.y) ** 2;
          const db = (b.pos.x - cow.pos.x) ** 2 + (b.pos.y - cow.pos.y) ** 2;
          return da - db;
        });
        const a = nearbyAgents[0], b = nearbyAgents[1];
        const [gainA, gainB] = distributeCowPoints(a.ego, b.ego, COW_VALUE);
        a.points += gainA; b.points += gainB;
        this.dayCowKills++;
        this.cows.splice(i, 1);
        this.respawnCow();
      }
    }
  }
}

function distributeCowPoints(egoA: number, egoB: number, value: number): [number, number] {
  const wantA = egoA * value, wantB = egoB * value, totalWant = wantA + wantB;
  if (Math.abs(egoA - 0.5) < 1e-6 && Math.abs(egoB - 0.5) < 1e-6) return [value / 2 + 5, value / 2 + 5];
  if (totalWant < value - 1e-6) {
    const rest = value - totalWant;
    let shareA = (wantA + rest / 2) * 1.10;
    let shareB = (wantB + rest / 2) * 1.10;
    return [shareA, shareB];
  }
  if (Math.abs(totalWant - value) <= 1e-6) return [wantA, wantB];
  let shareA = (wantA / totalWant) * value;
  let shareB = (wantB / totalWant) * value;
  let penA = 0.10 * egoA * shareA, penB = 0.10 * egoB * shareB;
  if (egoA > egoB) penA *= 2; else if (egoB > egoA) penB *= 2;
  return [Math.max(0, shareA - penA*3), Math.max(0, shareB - penB*3)];
}

// Mutation : 80% identique, 20% aléatoire [0..100]
function mutateEgoPercent(_parentPercent: number): number {
  if (Math.random() < 0.80) return _parentPercent;
  return Math.floor(Math.random() * 101);
}

// Boot
(function boot() {
  const canvas = document.getElementById("sim") as HTMLCanvasElement | null;
  const hud = document.getElementById("hud") as HTMLElement | null;
  const btnToggleMode = document.getElementById("toggleMode") as HTMLButtonElement | null;
  const btnNextDay = document.getElementById("nextDay") as HTMLButtonElement | null;
  const selectTheme = document.getElementById("theme") as HTMLSelectElement | null;
  const selectPreset = document.getElementById("preset") as HTMLSelectElement | null;
  const btnResetPop = document.getElementById("resetPop") as HTMLButtonElement | null;

  const hist = document.getElementById("chart-hist") as HTMLCanvasElement | null;
  const pop = document.getElementById("chart-pop") as HTMLCanvasElement | null;
  const cows = document.getElementById("chart-cows") as HTMLCanvasElement | null;
  const dist = document.getElementById("chart-dist") as HTMLCanvasElement | null;
  const outcomes = document.getElementById("chart-outcomes") as HTMLCanvasElement | null;

  if (!canvas || !hud || !btnToggleMode || !btnNextDay || !selectTheme || !selectPreset || !btnResetPop || !hist || !pop || !cows || !dist || !outcomes)
    throw new Error("UI manquante");

  const w = (window as any);
  if (w.__SIM_RUNNING__) { console.warn("Simulation déjà démarrée — skip boot"); return; }
  w.__SIM_RUNNING__ = true;

  new Simulation(canvas, hud, btnToggleMode, btnNextDay, selectTheme, selectPreset, btnResetPop, { hist, pop, cows, dist, outcomes });

  window.addEventListener("touchmove", (e) => {
    if ((e.target as HTMLElement).tagName === "CANVAS") e.preventDefault();
  }, { passive: false });
})();
