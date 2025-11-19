import { Camera } from "./core/Camera";
import { Input } from "./core/Input";
import { World } from "./core/World";
import { Renderer } from "./core/Renderer";
import { GameLoop } from "./core/GameLoop";

import { Agent } from "./entities/Agent";
import { House } from "./entities/House";
import { Cow } from "./entities/Cow";
import { SpatialHash } from "./sim/SpatialHash";
import { CoverageGrid } from "./sim/Coverage";
import { clamp, randRange } from "./entities/types";
import { getTheme, PrimitivesTheme } from "./visuals/Theme";
import { SpritesTheme } from "./visuals/ThemeSprites";
import { GreedySelfishBrain } from "./ai/AgentBrain";
import { OutcomeBuckets, StatsPanel } from "./ui/StatsPanel";
import CONFIG from "./config";

const WORLD_WIDTH = CONFIG.world.width;
const WORLD_HEIGHT = CONFIG.world.height;
const DAY_DURATION_SEC = CONFIG.sim.dayDurationSec;

// RÈGLES
const COW_VALUE = CONFIG.rules.cowValue;
const TARGET_COWS = CONFIG.rules.targetCows;
const SURVIVE_POINTS = CONFIG.rules.survivePoints;
const REPRO_EVERY = CONFIG.rules.reproEvery;
const HOUSE_CAPACITY = CONFIG.rules.houseCapacity;

// NOUVEAU : vaches jamais trop près des maisons
const COW_HOUSE_BUFFER = CONFIG.cows.houseBuffer; // px (augmenter si besoin)

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
  private showSense: boolean = !!CONFIG.debug?.showSenseOverlayDefault;

  private agents: Agent[] = [];
  private houses: House[] = [];
  private cows: Cow[] = [];

  private cowHash = new SpatialHash<Cow>(CONFIG.sim.spatialHashCellCows);
  private agentHash = new SpatialHash<Agent>(CONFIG.sim.spatialHashCellAgents);
  private coverage = new CoverageGrid(WORLD_WIDTH, WORLD_HEIGHT, CONFIG.analysis?.coverageCellSize ?? 16, !!CONFIG.world.wrap);

  private dayTime = 0;
  private dayCount = 1;
  private phase: Phase = Phase.Daytime;
  private mode: SimMode = (CONFIG.sim.initialMode as SimMode);
  private preset: PopulationPreset = CONFIG.sim.initialPreset;

  private dayCowKills = 0;

  private autoWaitTimer = 0;
  private AUTO_WAIT_SEC = CONFIG.sim.autoWaitSec;

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

  this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDevicePixelRatio));
    this.measureViewportFromCanvas();

    this.world = new World(WORLD_WIDTH, WORLD_HEIGHT);
  this.camera = new Camera(this.viewW, this.viewH, WORLD_WIDTH, WORLD_HEIGHT, { minScale: CONFIG.camera.minScale, maxScale: CONFIG.camera.maxScale, wrapWorld: !!CONFIG.world.wrap });
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
      if (k === "v") { this.showSense = !this.showSense; }
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
    // Override for exact agent count testing
    if (CONFIG.sim.totalAgentsOverride && CONFIG.sim.totalAgentsOverride > 0) {
      const N = CONFIG.sim.totalAgentsOverride;
      const ego = Math.max(0, Math.min(100, CONFIG.sim.singleEgoPercent ?? 50));
      for (let i = 0; i < N; i++) {
        const jitter = () => (Math.random() - 0.5) * 80;
        this.agents.push(new Agent(
          center.pos.x + jitter(), center.pos.y + jitter(),
          { home: center, brain: new GreedySelfishBrain(CONFIG.ai.greedy), egoPercent: ego, ...CONFIG.entities.agentDefaults }
        ));
      }
      this.rebuildHousesForPopulation();
      return;
    }
    if (preset === "uniform10each") {
      for (let p = 0; p <= 100; p++) {
        for (let i = 0; i < CONFIG.presets.uniformEach; i++) {
          const jitter = () => (Math.random() - 0.5) * 80;
          this.agents.push(new Agent(
            center.pos.x + jitter(), center.pos.y + jitter(),
            { home: center, brain: new GreedySelfishBrain(CONFIG.ai.greedy), egoPercent: p, ...CONFIG.entities.agentDefaults }
          ));
        }
      }
    } else if (preset === "all70" || preset === "all30") {
      const p = preset === "all70" ? 70 : 30;
      const total = CONFIG.presets.allCount;
      for (let i = 0; i < total; i++) {
        const jitter = () => (Math.random() - 0.5) * 80;
        this.agents.push(new Agent(
          center.pos.x + jitter(), center.pos.y + jitter(),
          { home: center, brain: new GreedySelfishBrain(CONFIG.ai.greedy), egoPercent: p, ...CONFIG.entities.agentDefaults }
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
    this.coverage.clear();
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
        // Mark scanned area by this agent
        this.coverage.markCircle(a.pos.x, a.pos.y, a.senseRadius);
        if (CONFIG.world.wrap) {
          // Toroidal wrapping
          if (a.pos.x < 0) a.pos.x += WORLD_WIDTH; else if (a.pos.x >= WORLD_WIDTH) a.pos.x -= WORLD_WIDTH;
          if (a.pos.y < 0) a.pos.y += WORLD_HEIGHT; else if (a.pos.y >= WORLD_HEIGHT) a.pos.y -= WORLD_HEIGHT;
        } else {
          a.pos.x = clamp(a.pos.x, 0, WORLD_WIDTH);
          a.pos.y = clamp(a.pos.y, 0, WORLD_HEIGHT);
        }
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
        if (CONFIG.world.wrap) {
          if (a.pos.x < 0) a.pos.x += WORLD_WIDTH; else if (a.pos.x >= WORLD_WIDTH) a.pos.x -= WORLD_WIDTH;
          if (a.pos.y < 0) a.pos.y += WORLD_HEIGHT; else if (a.pos.y >= WORLD_HEIGHT) a.pos.y -= WORLD_HEIGHT;
        } else {
          a.pos.x = clamp(a.pos.x, 0, WORLD_WIDTH);
          a.pos.y = clamp(a.pos.y, 0, WORLD_HEIGHT);
        }
        const arriveDist = a.radius + h.radius + 2;
        // distance with wrap-aware shortest path
        let dx = a.pos.x - h.pos.x, dy = a.pos.y - h.pos.y;
        if (CONFIG.world.wrap) {
          if (Math.abs(dx) > WORLD_WIDTH / 2) dx -= Math.sign(dx) * WORLD_WIDTH;
          if (Math.abs(dy) > WORLD_HEIGHT / 2) dy -= Math.sign(dy) * WORLD_HEIGHT;
        }
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
    const covPct = this.coverage.getCoveragePercent();
    this.hud.innerHTML =
      `Jour <code>${this.dayCount}</code> | Phase <code>${this.phase}</code> | ` +
      (this.phase === Phase.Daytime ? `reste <code>${timeLeft.toFixed(1)}s</code> | ` : ``) +
      `Agents <code>${this.agents.length}</code> | ` +
      `Vaches <code>${this.cows.length}</code> | ` +
      `Maisons <code>${this.houses.length}</code><br/>` +
      `Zone scannée <code>${covPct.toFixed(1)}%</code> | ` +
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
    // Optional sensing overlay for analysis
    if (this.showSense) {
      this.camera.applyToContext(this.ctx, this.dpr);
      this.ctx.save();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = "rgba(0,0,0,0.35)";
      for (const a of this.agents) {
        const r = a.senseRadius;
        // Base circle
        this.ctx.beginPath();
        this.ctx.arc(a.pos.x, a.pos.y, r, 0, Math.PI * 2);
        this.ctx.stroke();
        // Wrapped copies near edges (visualize torus coverage)
        if (CONFIG.world.wrap) {
          const nearLeft = a.pos.x < r;
          const nearRight = a.pos.x > WORLD_WIDTH - r;
          const nearTop = a.pos.y < r;
          const nearBottom = a.pos.y > WORLD_HEIGHT - r;
          const offsets: Array<[number, number]> = [];
          if (nearLeft) offsets.push([WORLD_WIDTH, 0]);
          if (nearRight) offsets.push([-WORLD_WIDTH, 0]);
          if (nearTop) offsets.push([0, WORLD_HEIGHT]);
          if (nearBottom) offsets.push([0, -WORLD_HEIGHT]);
          // Corners if near both in x and y
          if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
            const xs = nearLeft ? [WORLD_WIDTH] : nearRight ? [-WORLD_WIDTH] : [];
            const ys = nearTop ? [WORLD_HEIGHT] : nearBottom ? [-WORLD_HEIGHT] : [];
            for (const ox of xs) for (const oy of ys) offsets.push([ox, oy]);
          }
          for (const [ox, oy] of offsets) {
            this.ctx.beginPath();
            this.ctx.arc(a.pos.x + ox, a.pos.y + oy, r, 0, Math.PI * 2);
            this.ctx.stroke();
          }
        }
      }
      this.ctx.restore();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  };

  /** Abattage + métriques */
  private resolveCowKills() {
    for (let i = this.cows.length - 1; i >= 0; i--) {
      const cow = this.cows[i];
      const nearbyAgents = this.agentHash.queryAround(cow.pos.x, cow.pos.y).filter(a => {
        let dx = a.pos.x - cow.pos.x, dy = a.pos.y - cow.pos.y;
        if (CONFIG.world.wrap) {
          if (Math.abs(dx) > WORLD_WIDTH / 2) dx -= Math.sign(dx) * WORLD_WIDTH;
          if (Math.abs(dy) > WORLD_HEIGHT / 2) dy -= Math.sign(dy) * WORLD_HEIGHT;
        }
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
