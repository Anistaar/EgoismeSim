export class CoverageGrid {
  private readonly w: number;
  private readonly h: number;
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly wrap: boolean;
  private data: Uint8Array; // 0/1 per cell
  private markedCount = 0;

  constructor(width: number, height: number, cellSize: number, wrapWorld: boolean) {
    this.w = Math.max(1, Math.floor(width));
    this.h = Math.max(1, Math.floor(height));
    this.cell = Math.max(2, Math.floor(cellSize));
    this.cols = Math.ceil(this.w / this.cell);
    this.rows = Math.ceil(this.h / this.cell);
    this.wrap = wrapWorld;
    this.data = new Uint8Array(this.cols * this.rows);
  }

  clear() {
    this.data.fill(0);
    this.markedCount = 0;
  }

  private idx(cx: number, cy: number) { return cy * this.cols + cx; }

  private markCell(cx: number, cy: number) {
    if (this.wrap) {
      cx = (cx % this.cols + this.cols) % this.cols;
      cy = (cy % this.rows + this.rows) % this.rows;
    } else {
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    }
    const i = this.idx(cx, cy);
    if (this.data[i] === 0) { this.data[i] = 1; this.markedCount++; }
  }

  // Marks all cells whose centers lie within the circle (x,y,r)
  markCircle(x: number, y: number, r: number) {
    if (r <= 0) return;
    const rr = r * r;
    const minCx = Math.floor((x - r) / this.cell);
    const maxCx = Math.floor((x + r) / this.cell);
    const minCy = Math.floor((y - r) / this.cell);
    const maxCy = Math.floor((y + r) / this.cell);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        // center of cell
        let ccx = cx * this.cell + this.cell * 0.5;
        let ccy = cy * this.cell + this.cell * 0.5;
        if (this.wrap) {
          // choose nearest wrapped image relative to (x,y)
          let dx = ccx - x;
          let dy = ccy - y;
          const W = this.w, H = this.h;
          if (Math.abs(dx) > W / 2) ccx += -Math.sign(dx) * W;
          if (Math.abs(dy) > H / 2) ccy += -Math.sign(dy) * H;
        }
        const dx2 = (ccx - x);
        const dy2 = (ccy - y);
        if (dx2 * dx2 + dy2 * dy2 <= rr) this.markCell(cx, cy);
      }
    }
  }

  getCoveredCells() { return this.markedCount; }
  getCellArea() { return this.cell * this.cell; }
  getCoveredArea() { return this.markedCount * this.getCellArea(); }
  getWorldArea() { return this.w * this.h; }
  getCoverageRatio() { return this.getCoveredArea() / this.getWorldArea(); }
  getCoveragePercent() { return this.getCoverageRatio() * 100; }
}
