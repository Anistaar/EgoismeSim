export class GameLoop {
  private last = 0;
  private rafId = 0;

  constructor(
    private update: (dt: number) => void,
    private render: () => void
  ) {}

  start() {
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }
}
