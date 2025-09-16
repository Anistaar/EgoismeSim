import { Camera } from "./Camera";

export class Input {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.bind();
  }

  private bind() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerUp);

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0015);
        this.camera.zoomAt(sx, sy, factor);
      },
      { passive: false }
    );
  }

  private getCanvasRelative(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.getCanvasRelative(e);
    this.dragging = true;
    this.lastX = p.x;
    this.lastY = p.y;
    this.canvas.classList.add("dragging");
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const p = this.getCanvasRelative(e);
    const dx = p.x - this.lastX;
    const dy = p.y - this.lastY;
    this.camera.moveBy(-dx / this.camera.scale, -dy / this.camera.scale);
    this.lastX = p.x;
    this.lastY = p.y;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.classList.remove("dragging");
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
}
