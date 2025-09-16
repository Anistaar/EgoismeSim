import type { Drawable, Entity } from "./types";

let NEXT_ID = 1;

export class House implements Entity {
  id = NEXT_ID++;
  pos: { x: number; y: number };
  radius = 18;

  constructor(x: number, y: number) {
    this.pos = { x, y };
  }

  update(_dt: number) {}
  draw(_ctx: CanvasRenderingContext2D) {}
}
