import type { Agent } from "../entities/Agent";
import type { House } from "../entities/House";
import type { Cow } from "../entities/Cow";


export interface Theme {
  name: string;
  drawAgent(ctx: CanvasRenderingContext2D, a: Agent): void;
  drawAgentLabel(ctx: CanvasRenderingContext2D, a: Agent, text: string): void;
  drawHouse(ctx: CanvasRenderingContext2D, h: House): void;
  drawCow(ctx: CanvasRenderingContext2D, c: Cow): void;
}

/** Couleur HSL de 120° (vert) → 0° (rouge) selon l'égoïsme 0..1 */
export function colorForEgo(ego: number) {
  const hue = (1 - ego) * 120; // 120=vert, 0=rouge
  return `hsl(${hue} 70% 55%)`;
}

export const PrimitivesTheme: Theme = {
  name: "primitives",
  drawAgent(ctx, a) {
    const color = colorForEgo(a.ego);
    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.dir);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, a.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  drawAgentLabel(ctx, a, text) {
    ctx.save();
    ctx.fillStyle = "#f3f4f6";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(text, a.pos.x, a.pos.y - a.radius - 4);
    ctx.restore();
  },
  drawHouse(ctx, h) {
    ctx.save();
    // ombre
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(h.pos.x + 10, h.pos.y + 10, h.radius*1.1, h.radius*0.6, 0, 0, Math.PI*2);
    ctx.fill();

    // corps
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.arc(h.pos.x, h.pos.y, h.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(h.pos.x - h.radius, h.pos.y);
    ctx.lineTo(h.pos.x, h.pos.y - h.radius);
    ctx.lineTo(h.pos.x + h.radius, h.pos.y);
    ctx.stroke();
    ctx.restore();
  },
  drawCow(ctx, c) {
    ctx.save();
    // ombre
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(c.pos.x + 8, c.pos.y + 8, c.radius*1.2, c.radius*0.7, 0, 0, Math.PI*2);
    ctx.fill();

    // corps simplifié
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI*2);
    ctx.fill();

    // tête
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.arc(c.pos.x + c.radius*0.9, c.pos.y - 3, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
};

export const TrianglesTheme: Theme = {
  ...PrimitivesTheme,
  name: "triangles",
  drawAgent(ctx, a) {
    const color = colorForEgo(a.ego);
    const r = a.radius;
    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.dir);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * 0.6);
    ctx.lineTo(-r * 0.8, -r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

export function getTheme(name: string): Theme {
  switch (name) {
    case "triangles": return TrianglesTheme;
    case "primitives":
    default:          return PrimitivesTheme;
  }
}
