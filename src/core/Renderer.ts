import { Camera } from "./Camera";
import { World } from "./World";
import type { Agent } from "../entities/Agent";
import type { House } from "../entities/House";
import type { Cow } from "../entities/Cow";
import type { Theme } from "../visuals/Theme";

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private camera: Camera,
    private world: World,
    private dpr: number,
    private theme: Theme
  ) {}

  setTheme(theme: Theme) { this.theme = theme; }

  render(viewW: number, viewH: number, data?: {
    agents?: Agent[], houses?: House[], cows?: Cow[]
  }) {
    // clear viewport
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, viewW, viewH);

    // monde
    this.camera.applyToContext(this.ctx, this.dpr);
    this.world.draw(this.ctx);

    if (data?.houses) data.houses.forEach(h => this.theme.drawHouse(this.ctx, h));
    if (data?.cows)   data.cows.forEach(c => this.theme.drawCow(this.ctx, c));
    if (data?.agents) {
      for (const a of data.agents) {
        this.theme.drawAgent(this.ctx, a);
        this.theme.drawAgentLabel(this.ctx, a, `${Math.floor(a.points)}/55`);
      }
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
