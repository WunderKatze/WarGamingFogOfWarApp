import type { Point } from "../types.js";

const EPSILON = 1e-9;

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Returns the intersection point of segments (a1,a2) and (b1,b2), or null if
 * they don't strictly cross. Touching at endpoints or running parallel does
 * not count — callers that care about endpoint touches should handle those
 * cases themselves.
 */
export function segmentIntersection(
  a1: Point, a2: Point, b1: Point, b2: Point,
): Point | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < EPSILON) return null;

  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;

  if (t <= EPSILON || t >= 1 - EPSILON) return null;
  if (u <= EPSILON || u >= 1 - EPSILON) return null;

  return { x: a1.x + t * dax, y: a1.y + t * day };
}

/**
 * Ray-casting point-in-polygon test. Vertices form a closed polygon
 * (the last vertex implicitly connects back to the first).
 * Behavior on the boundary itself is undefined.
 */
export function pointInPolygon(p: Point, vertices: readonly Point[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    const crosses =
      (vi.y > p.y) !== (vj.y > p.y) &&
      p.x < ((vj.x - vi.x) * (p.y - vi.y)) / (vj.y - vi.y) + vi.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Number of polygon edges the segment (from, to) strictly crosses. */
export function segmentEdgeIntersectionCount(
  from: Point, to: Point, vertices: readonly Point[],
): number {
  let count = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i]!;
    const v2 = vertices[(i + 1) % n]!;
    if (segmentIntersection(from, to, v1, v2) !== null) count++;
  }
  return count;
}

/**
 * Total length of the portion of segment (from, to) that lies inside the polygon.
 * Uses the parity-toggle method: each edge intersection flips inside/outside,
 * starting from whether `from` is inside.
 * Degenerate cases (segment passing exactly through a vertex) are not handled.
 */
export function segmentLengthInsidePolygon(
  from: Point, to: Point, vertices: readonly Point[],
): number {
  const segLen = distance(from, to);
  if (segLen < EPSILON) return 0;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const useX = Math.abs(dx) >= Math.abs(dy);

  const ts: number[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i]!;
    const v2 = vertices[(i + 1) % n]!;
    const x = segmentIntersection(from, to, v1, v2);
    if (x === null) continue;
    const t = useX ? (x.x - from.x) / dx : (x.y - from.y) / dy;
    ts.push(t);
  }
  ts.sort((a, b) => a - b);

  let inside = pointInPolygon(from, vertices);
  let lastT = 0;
  let totalT = 0;
  for (const t of ts) {
    if (inside) totalT += t - lastT;
    inside = !inside;
    lastT = t;
  }
  if (inside) totalT += 1 - lastT;

  return totalT * segLen;
}
