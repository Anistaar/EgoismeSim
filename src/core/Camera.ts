export class Camera {
  public x = 0;
  public y = 0;
  public scale = 1;

  private minScale: number;
  private maxScale: number;

  private viewportW: number;
  private viewportH: number;
  private readonly worldW: number;
  private readonly worldH: number;

  constructor(
    viewportW: number,
    viewportH: number,
    worldW: number,
    worldH: number,
    opts?: { minScale?: number; maxScale?: number }
  ) {
    this.viewportW = viewportW;
    this.viewportH = viewportH;
    this.worldW = worldW;
    this.worldH = worldH;
    this.minScale = opts?.minScale ?? 0.25;
    this.maxScale = opts?.maxScale ?? 4;
    this.clamp();
  }

  setViewportSize(w: number, h: number) {
    this.viewportW = Math.max(1, w);
    this.viewportH = Math.max(1, h);
    this.clamp();
  }

  moveBy(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.clamp();
  }

  setScale(s: number) {
    this.scale = this.clampScale(s);
    this.clamp();
  }

  zoomAt(screenX: number, screenY: number, zoomFactor: number) {
    const oldScale = this.scale;
    const newScale = this.clampScale(this.scale * zoomFactor);
    if (newScale === oldScale) return;

    const worldBefore = this.screenToWorld(screenX, screenY);
    this.scale = newScale;
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;

    this.clamp();
  }

  worldToScreen(wx: number, wy: number) {
    return {
      x: (wx - this.x) * this.scale,
      y: (wy - this.y) * this.scale
    };
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: this.x + sx / this.scale,
      y: this.y + sy / this.scale
    };
  }

  applyToContext(ctx: CanvasRenderingContext2D, deviceScale: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const s = deviceScale * this.scale;
    ctx.setTransform(s, 0, 0, s, -this.x * s, -this.y * s);
  }

  private clamp() {
    const visibleW = this.viewportW / this.scale;
    const visibleH = this.viewportH / this.scale;

    const maxX = Math.max(0, this.worldW - visibleW);
    const maxY = Math.max(0, this.worldH - visibleH);

    this.x = Math.min(Math.max(0, this.x), maxX);
    this.y = Math.min(Math.max(0, this.y), maxY);
  }

  private clampScale(s: number) {
    return Math.min(this.maxScale, Math.max(this.minScale, s));
  }

  getViewportWorldSize() {
    return { w: this.viewportW / this.scale, h: this.viewportH / this.scale };
  }

  getViewportSize() {
    return { w: this.viewportW, h: this.viewportH };
  }
}
