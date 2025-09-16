import type { Entity } from "./types";

let NEXT_ID = 1;

/** Vache = source de 100 points de nourriture. */
export class Cow implements Entity {
  id = NEXT_ID++;
  pos: { x: number; y: number };
  radius = 14;        // zone de contact
  value = 100;        // points bruts à répartir

  constructor(x: number, y: number) {
    this.pos = { x, y };
  }

  update(_dt: number) {}
  draw(_ctx: CanvasRenderingContext2D) {} // rendu via Theme
}
