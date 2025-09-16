export class World {
  private trees: { x: number; y: number; r: number }[] = [];

  constructor(public readonly width: number, public readonly height: number) {
    // génère des arbres décoratifs
    const N = 120;
    for (let i = 0; i < N; i++) {
      this.trees.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 10 + Math.random() * 14
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // herbe (dégradé)
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#96d14a");
    grad.addColorStop(1, "#65b32e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // vignette douce
    ctx.save();
    const g2 = ctx.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.2,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7
    );
    g2.addColorStop(0, "rgba(0,0,0,0)");
    g2.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    // arbres placeholders
    for (const t of this.trees) {
      // ombre
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(t.x + 10, t.y + 12, t.r*0.9, t.r*0.5, 0, 0, Math.PI*2);
      ctx.fill();

      // tronc
      ctx.fillStyle = "#3d2d1f";
      ctx.fillRect(t.x - 2, t.y, 4, t.r);

      // feuillage
      ctx.fillStyle = "#1f7a4a";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = "#2a9b5f";
      ctx.beginPath();
      ctx.arc(t.x - t.r*0.4, t.y + 2, t.r*0.7, 0, Math.PI*2);
      ctx.fill();
    }

    // bordure douce
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);
  }
}
