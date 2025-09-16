import type { Vec2 } from "../entities/types";

export class SpatialHash<T extends { pos: Vec2 }> {
  private cell: number;
  private map = new Map<string, T[]>();

  constructor(cellSize: number) { this.cell = Math.max(8, cellSize); }

  private key(x: number, y: number) {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    return `${cx},${cy}`;
  }

  clear() { this.map.clear(); }

  insert(item: T) {
    const k = this.key(item.pos.x, item.pos.y);
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k)!.push(item);
  }

  queryAround(x: number, y: number): T[] {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const out: T[] = [];
    for (let iy = -1; iy <= 1; iy++) {
      for (let ix = -1; ix <= 1; ix++) {
        const k = `${cx+ix},${cy+iy}`;
        const arr = this.map.get(k);
        if (arr) out.push(...arr);
      }
    }
    return out;
  }
}
