export interface Updatable { update(dt: number): void; }
export interface Drawable { draw(ctx: CanvasRenderingContext2D): void; }
export interface Entity extends Updatable, Drawable { id: number; }

export type Vec2 = { x: number; y: number };
export function dist2(a: Vec2, b: Vec2) { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; }
export function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
export function randRange(min: number, max: number) { return Math.random() * (max - min) + min; }
