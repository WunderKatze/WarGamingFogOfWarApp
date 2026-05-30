import type { Point } from "../types.js";
import {
  segmentEdgeIntersectionCount,
  segmentIntersection,
  segmentLengthInsidePolygon,
} from "./geometry.js";
import type { TerrainPolygon } from "./TerrainPolygon.js";
import type { TerrainWall } from "./TerrainWall.js";

/**
 * Named terrain-vision primitives. Each is a small geometric predicate
 * that a terrain catalog entry composes by name + parameter. Catalog
 * entries never inline geometry — they reference a primitive defined here.
 *
 * The indirection is what makes terrain rules portable across rulesets:
 * a different wargame's "Tall Woods" can use the same primitives with
 * different parameters (e.g. a different depth limit) or compose a
 * different subset, without forking the catalog or rewriting the
 * underlying geometry.
 *
 * **Source code is the firm anchor for terminology** (per
 * docs/features/v2/code-health-pass.md §7 D4). Each primitive's TSDoc
 * below is the canonical definition of what that primitive does; the
 * [mechanics-refactor.md §14](../../../docs/features/v2/mechanics-refactor.md)
 * Definitions table points back here, not the other way around. When a
 * primitive's semantics change, its TSDoc here changes first and the
 * Definitions table follows.
 *
 * Design context: docs/features/v2/mechanics-refactor.md §6.2.1
 * (R2 modular terrain-vision interactions); extraction recorded in
 * docs/features/v2/code-health-pass.md §2 A3.
 */

// ---------- Polygon concealment primitives ----------

/**
 * "Concealment when the target is inside the polygon."
 *
 * True iff the target's position is inside the polygon. The observer's
 * position doesn't matter. Used by terrain that conceals anything inside
 * its boundary from observers outside (e.g. Buildings).
 */
export function concealsTargetInside(poly: TerrainPolygon, _from: Point, to: Point): boolean {
  return poly.containsPoint(to);
}

/**
 * "Concealment along the ray's inside segment, with asymmetric edge grace."
 *
 * True iff the ray from→to has any portion inside the polygon, with one
 * asymmetric exception: an observer *inside* the polygon trying to see
 * *out* is granted up to `graceDistance` inches of slack — if the ray's
 * inside-portion is ≤ graceDistance, the polygon contributes no
 * concealment. An observer *outside* the polygon gets no grace; any
 * inside-portion at all counts.
 *
 * The asymmetry rewards a unit hugging the inner edge of woods looking
 * out (the classic "treeline observer" tactical move) without weakening
 * concealment for targets hiding deeper inside the same polygon. See
 * docs/features/v1/vision-rules-tweaks.md §2.2 "Asymmetric by design"
 * for the rule's motivation.
 *
 * Used by terrain whose concealment extends along whatever ray it's
 * traversed by (e.g. Tall Woods, Short Terrain).
 */
export function concealsAlongRayInsideSegment(
  poly: TerrainPolygon,
  from: Point,
  to: Point,
  graceDistance: number,
): boolean {
  const insideLength = segmentLengthInsidePolygon(from, to, poly.vertices);
  if (insideLength === 0) return false;
  if (poly.containsPoint(from)) {
    return insideLength > graceDistance;
  }
  return true;
}

// ---------- Polygon ray-blocking primitives ----------

/**
 * "Blocks the ray when it crosses at least `minCrossings` of the polygon's
 * edges."
 *
 * Used by terrain that's only opaque when the ray meaningfully traverses
 * the polygon — e.g. a Building (minCrossings = 2) blocks sight when the
 * ray enters and exits, but a ray that just clips a corner (1 crossing)
 * is not blocked.
 */
export function blocksRayOnNEdgeCrossings(
  poly: TerrainPolygon,
  from: Point,
  to: Point,
  minCrossings: number,
): boolean {
  return segmentEdgeIntersectionCount(from, to, poly.vertices) >= minCrossings;
}

/**
 * "Blocks the ray once it has traveled more than `maxDepth` inches inside
 * the polygon."
 *
 * Used by terrain that's translucent for a short distance but opaque
 * beyond — e.g. Tall Woods. A ray can travel up to `maxDepth` inches
 * inside the polygon before sight is blocked entirely.
 */
export function blocksRayPastDepthXInside(
  poly: TerrainPolygon,
  from: Point,
  to: Point,
  maxDepth: number,
): boolean {
  return segmentLengthInsidePolygon(from, to, poly.vertices) > maxDepth;
}

// ---------- Wall primitives ----------

/**
 * "Concealment when the ray crosses the wall."
 *
 * True iff the ray from→to strictly intersects the wall's segment. Used
 * by walls that contribute concealment without blocking sight outright
 * (e.g. Short Walls).
 */
export function concealsWhenRayCrosses(wall: TerrainWall, from: Point, to: Point): boolean {
  return segmentIntersection(from, to, wall.from, wall.to) !== null;
}

/**
 * "Blocks the ray when it crosses the wall."
 *
 * True iff the ray from→to strictly intersects the wall's segment. The
 * geometry is identical to `concealsWhenRayCrosses`; the two are named
 * separately because the *intent* at the call site differs (blocking
 * sight vs. contributing concealment). Used by walls that block sight
 * outright (e.g. Tall Walls).
 */
export function blocksRayOnCrossing(wall: TerrainWall, from: Point, to: Point): boolean {
  return segmentIntersection(from, to, wall.from, wall.to) !== null;
}
