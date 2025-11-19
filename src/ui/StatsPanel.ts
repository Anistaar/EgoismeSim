import { colorForEgo } from "../visuals/Theme";
import CONFIG from "../config";

type Canvii = {
  hist: HTMLCanvasElement;
  pop: HTMLCanvasElement;
  cows: HTMLCanvasElement;
  dist: HTMLCanvasElement;
  outcomes: HTMLCanvasElement;
};

export type OutcomeBuckets = {
  dead: number;
  survived: number; // >= seuil, 0 reproduction
  r1: number;
  r2: number;
  r3: number;
  r4p: number;      // >= +4
};

export class StatsPanel {
  private cvs: Canvii;
  private ctx: { [K in keyof Canvii]: CanvasRenderingContext2D };
  private dpr = 1;

  // temps réel 0..100 %
  currentBuckets = new Array<number>(101).fill(0);

  // historiques par jour
  popHistory: number[] = [];
  cowsHistory: number[] = [];
  distAvgHistory: number[] = [];
  outcomesHistory: OutcomeBuckets[] = [];

  // valeurs "live"
  private livePop: number | null = null;
  private liveCows: number | null = null;
  private liveDist: number | null = null;

  constructor(cvs: Canvii) {
    this.cvs = cvs;
    this.ctx = {
      hist: must2d(cvs.hist),
      pop: must2d(cvs.pop),
      cows: must2d(cvs.cows),
      dist: must2d(cvs.dist),
      outcomes: must2d(cvs.outcomes),
    };
    this.resizeAll();
    window.addEventListener("resize", () => this.resizeAll(), { passive: true });
  }

  private resizeAll() {
  this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDevicePixelRatio));
    for (const key of Object.keys(this.cvs) as (keyof Canvii)[]) {
      const c = this.cvs[key];
      const w = Math.max(1, Math.floor(c.clientWidth));
      const h = Math.max(1, Math.floor(c.clientHeight));
      c.width = Math.floor(w * this.dpr);
      c.height = Math.floor(h * this.dpr);
      this.ctx[key].setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  // === temps réel ===
  updateRealtime(agents: { ego: number }[]) {
    this.currentBuckets.fill(0);
    for (const a of agents) {
      const idx = Math.min(100, Math.max(0, Math.round(a.ego * 100)));
      this.currentBuckets[idx]++;
    }
  }

  /** À appeler chaque frame avec les métriques du jour en cours */
  setLive(pop: number, cows: number, avgDist: number) {
    this.livePop = pop;
    this.liveCows = cows;
    this.liveDist = avgDist;
  }

  // === fin de journée ===
  commitDaySnapshot(metrics: {
    populationAfter: number;
    cowsKilled: number;
    avgDistance: number;
    outcomes: OutcomeBuckets;
  }) {
    this.popHistory.push(metrics.populationAfter);
    this.cowsHistory.push(metrics.cowsKilled);
    this.distAvgHistory.push(metrics.avgDistance);
    this.outcomesHistory.push(metrics.outcomes);

    const cap = CONFIG.ui.historyCap;
    if (this.popHistory.length > cap) {
      this.popHistory.shift();
      this.cowsHistory.shift();
      this.distAvgHistory.shift();
      this.outcomesHistory.shift();
    }
  }

  // === rendu global ===
  render() {
    this.drawHistogram1pct(this.ctx.hist, this.cvs.hist, this.currentBuckets);

    const lastPop = last(this.popHistory) ?? 0;
    const liveDist = this.liveDist ?? 0;
    const livePop = this.livePop ?? lastPop;
    const liveCows = this.liveCows ?? 0;

    this.drawLine(this.ctx.pop, this.cvs.pop, this.popHistory, "Population", livePop, "agents");
    this.drawBars(this.ctx.cows, this.cvs.cows, this.cowsHistory, "Vaches / jour", liveCows);
    this.drawLine(this.ctx.dist, this.cvs.dist, this.distAvgHistory, "Distance moyenne", liveDist, "px");

    this.drawOutcomes(this.ctx.outcomes, this.cvs.outcomes, this.outcomesHistory);
  }

  // === dessins ===
  private drawHistogram1pct(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, buckets: number[]) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    const x = 8, y = 6, w = W - 16, h = H - 14;

    ctx.fillStyle = "#0b0c10";
    ctx.fillRect(x, y, w, h);

    const total = buckets.reduce((a, b) => a + b, 0) || 1;
    const maxRatio = Math.max(...buckets.map(b => b / total), 0.1);

    const n = 101, gap = 1;
    const barW = Math.max(1, Math.floor((w - gap * (n + 1)) / n));
    const usedW = barW * n + gap * (n + 1);
    const offsetX = x + Math.floor((w - usedW) / 2);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let d = 0; d <= 10; d++) {
      const bx = offsetX + gap + d * 10 * (barW + gap) - gap / 2;
      ctx.beginPath(); ctx.moveTo(bx + 0.5, y + 2); ctx.lineTo(bx + 0.5, y + h - 18); ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(x, y + h - 0.5); ctx.lineTo(x + w, y + h - 0.5); ctx.stroke();

    for (let i = 0; i < n; i++) {
      const ratio = buckets[i] / total;
      const bh = Math.max(1, Math.round((ratio / maxRatio) * (h - 26)));
      const bx = offsetX + gap + i * (barW + gap);
      const by = y + h - bh - 16;
      ctx.fillStyle = colorForEgo(i / 100);
      ctx.fillRect(bx, by, barW, bh);
    }

    // ticks
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "10px system-ui"; ctx.textAlign = "center";
    for (let t = 0; t <= 100; t += 10) {
      const bx = offsetX + gap + t * (barW + gap) + barW / 2;
      ctx.fillText(String(t), Math.round(bx), y + h - 4);
    }
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: number[],
    label: string,
    liveValue?: number | null,
    unit?: string
  ) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const pad = 8, x = pad, y = pad, w = W - 2 * pad, h = H - 2 * pad;

    ctx.fillStyle = "#0b0c10"; ctx.fillRect(x, y, w, h);
    const hasHist = data.length > 0;
    if (!hasHist && (liveValue == null)) { this.noData(ctx, x, y); return; }

    const series = data.slice();
    let yMin: number, yMax: number;
    if (series.length === 0 && liveValue != null) { yMin = 0; yMax = Math.max(1, liveValue); }
    else {
      yMin = Math.min(...series); yMax = Math.max(...series);
      if (liveValue != null) { yMin = Math.min(yMin, liveValue); yMax = Math.max(yMax, liveValue); }
    }
    const ymin = Math.floor(yMin * 0.95), ymax = Math.ceil((yMax || 1) * 1.05);

    const nHist = series.length;
    const n = nHist + (liveValue != null ? 1 : 0);
    const stepX = w / Math.max(1, n - 1);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(x, y + h - 0.5); ctx.lineTo(x + w, y + h - 0.5); ctx.stroke();

    if (nHist > 0) {
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < nHist; i++) {
        const px = x + i * stepX;
        const py = y + h - ((series[i] - ymin) / (ymax - ymin)) * (h - 18);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (liveValue != null) {
      const px = x + (n - 1) * stepX;
      const py = y + h - ((liveValue - ymin) / (ymax - ymin)) * (h - 18);
      if (nHist > 0) {
        const lastVal = series[nHist - 1];
        const ppx = x + (n - 2) * stepX;
        const ppy = y + h - ((lastVal - ymin) / (ymax - ymin)) * (h - 18);
        ctx.strokeStyle = "rgba(96,165,250,0.6)";
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(px, py); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = "#93c5fd"; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    }

    // titre + valeurs (live & dernière)
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "11px system-ui"; ctx.textAlign = "left";
    ctx.fillText(label, x + 4, y + 14);

    const lastVal = series.length ? series[series.length - 1] : undefined;
    const rightText = [
      lastVal !== undefined ? `dernier: ${fmtInt(lastVal)}${unit ? " " + unit : ""}` : null,
      liveValue != null ? `live: ${fmtInt(liveValue)}${unit ? " " + unit : ""}` : null,
    ].filter(Boolean).join("   ");

    if (rightText) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(rightText, x + w - 4, y + 14);
    }
  }

  private drawBars(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    data: number[],
    label: string,
    liveValue?: number | null
  ) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const pad = 8, x = pad, y = pad, w = W - 2 * pad, h = H - 2 * pad;
    ctx.fillStyle = "#0b0c10"; ctx.fillRect(x, y, w, h);
    const n = data.length + (liveValue != null ? 1 : 0);
    if (n === 0) { this.noData(ctx, x, y); return; }

    const max = Math.max(...data, liveValue ?? 0, 1);
    const gap = 2, barW = Math.max(2, Math.floor((w - gap * (n + 1)) / n));
    let bx = x + gap;

    for (let i = 0; i < data.length; i++) {
      const bh = ((data[i] / max) * (h - 18)) | 0;
      const by = y + h - bh - 16;
      ctx.fillStyle = "#34d399";
      ctx.fillRect(bx, by, barW, bh);
      bx += barW + gap;
    }

    if (liveValue != null) {
      const bh = ((liveValue / max) * (h - 18)) | 0;
      const by = y + h - bh - 16;
      ctx.fillStyle = "rgba(52,211,153,0.6)";
      ctx.fillRect(bx, by, barW, bh);
    }

    // titre + chiffres
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "11px system-ui"; ctx.textAlign = "left";
    ctx.fillText(label, x + 4, y + 14);

    const lastVal = data.length ? data[data.length - 1] : undefined;
    const rightText = [
      lastVal !== undefined ? `dernier: ${fmtInt(lastVal)}` : null,
      liveValue != null ? `live: ${fmtInt(liveValue)}` : null,
    ].filter(Boolean).join("   ");
    if (rightText) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(rightText, x + w - 4, y + 14);
    }
  }

  /** Empilé absolu des résultats par jour + légende chiffres du dernier jour */
  private drawOutcomes(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    history: OutcomeBuckets[]
  ) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const pad = 8, x = pad, y = pad, w = W - 2 * pad, h = H - 2 * pad;
    ctx.fillStyle = "#0b0c10"; ctx.fillRect(x, y, w, h);

    if (history.length === 0) { this.noData(ctx, x, y); return; }

    const totals = history.map(o => o.dead + o.survived + o.r1 + o.r2 + o.r3 + o.r4p);
    const ymax = Math.max(...totals, 1);

    const stepX = w / Math.max(1, history.length - 1);

    const layers: { key: keyof OutcomeBuckets; color: string; label: string }[] = [
      { key: "dead",     color: "#ef4444", label: "morts" },
      { key: "survived", color: "#60a5fa", label: "surv." },
      { key: "r1",       color: "#34d399", label: "repro +1" },
      { key: "r2",       color: "#a3e635", label: "repro +2" },
      { key: "r3",       color: "#f59e0b", label: "repro +3" },
      { key: "r4p",      color: "#f472b6", label: "repro ≥4" },
    ];

    // cumuls
    const cum = layers.map(() => new Array<number>(history.length).fill(0));
    for (let d = 0; d < history.length; d++) {
      let acc = 0;
      for (let li = 0; li < layers.length; li++) {
        const v = history[d][layers[li].key];
        acc += v;
        cum[li][d] = acc;
      }
    }

    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li];
      ctx.beginPath();
      for (let d = 0; d < history.length; d++) {
        const px = x + d * stepX;
        const py = y + h - (cum[li][d] / ymax) * (h - 24);
        if (d === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let d = history.length - 1; d >= 0; d--) {
        const prev = li > 0 ? cum[li - 1][d] : 0;
        const px = x + d * stepX;
        const py = y + h - (prev / ymax) * (h - 24);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = layer.color + "cc";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.stroke();
    }

    // titre
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "11px system-ui"; ctx.textAlign = "left";
    ctx.fillText("Résultats par jour (morts/surv./repro)", x + 4, y + 14);

    // légende chiffres du dernier jour
    const lastDay = history[history.length - 1];
    const entries: [string, number, string][] = [
      ["morts", lastDay.dead, layers[0].color],
      ["surv.", lastDay.survived, layers[1].color],
      ["+1", lastDay.r1, layers[2].color],
      ["+2", lastDay.r2, layers[3].color],
      ["+3", lastDay.r3, layers[4].color],
      ["≥4", lastDay.r4p, layers[5].color],
    ];
    const boxW = 210, boxH = 74;
    const bx = x + w - boxW - 6, by = y + 6;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    let yy = by + 16;
    for (const [lab, val, col] of entries) {
      ctx.fillStyle = col;
      ctx.fillRect(bx + 8, yy - 8, 10, 10);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`${lab}: ${fmtInt(val)}`, bx + 24, yy);
      yy += 12;
    }
  }

  private noData(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px system-ui";
    ctx.fillText("Pas encore de données", x + 6, y + 16);
  }
}

function must2d(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");
  return ctx;
}

function fmtInt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

function last<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined;
}