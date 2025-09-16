import type { Theme } from "./Theme";
import { PrimitivesTheme, colorForEgo } from "./Theme";

function load(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}
const images = {
  agent: load("/assets/agent.png"),
  cow:   load("/assets/cow.png"),
  house: load("/assets/house.png"),
};
function ready(img: HTMLImageElement) { return img.complete && img.naturalWidth > 0; }

export const SpritesTheme: Theme = {
  name: "sprites",

  drawAgent(ctx, a) {
    if (!ready(images.agent)) {
      // Fallback rapide (primitives + anneau de teinte)
      PrimitivesTheme.drawAgent(ctx, a);
      // anneau coloré (teinte égoïsme)
      ctx.save();
      ctx.strokeStyle = colorForEgo(a.ego);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.pos.x, a.pos.y, a.radius + 3, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.dir);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    const s = a.radius * 2.2; // échelle approximative
    ctx.drawImage(images.agent, -s/2, -s/2, s, s);
    // anneau de teinte pour l'égoïsme
    ctx.strokeStyle = colorForEgo(a.ego);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s*0.55, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  },

  drawAgentLabel: PrimitivesTheme.drawAgentLabel,

  drawHouse(ctx, h) {
    if (!ready(images.house)) { PrimitivesTheme.drawHouse(ctx, h); return; }
    ctx.save();
    // ombre
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(h.pos.x + 10, h.pos.y + 10, h.radius*1.1, h.radius*0.6, 0, 0, Math.PI*2);
    ctx.fill();
    const s = h.radius * 2.2;
    ctx.drawImage(images.house, h.pos.x - s/2, h.pos.y - s/2, s, s);
    ctx.restore();
  },

  drawCow(ctx, c) {
    if (!ready(images.cow)) { PrimitivesTheme.drawCow(ctx, c); return; }
    ctx.save();
    // ombre
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(c.pos.x + 8, c.pos.y + 8, c.radius*1.2, c.radius*0.7, 0, 0, Math.PI*2);
    ctx.fill();
    const s = c.radius * 2.0;
    ctx.drawImage(images.cow, c.pos.x - s/2, c.pos.y - s/2, s, s);
    ctx.restore();
  }
};
