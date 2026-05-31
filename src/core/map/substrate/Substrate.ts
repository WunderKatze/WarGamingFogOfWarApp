import type { Point } from "../../types.js";

/**
 * A map substrate — the coordinate system on which the game is played.
 *
 * V2 only ever ships **one** substrate (free-position-inches, WWII's
 * model). Per [mechanics-refactor.md §7.2 and §11 D5], V2 abstracts
 * only the *seam* — enough that a future hex / square-grid substrate
 * could land in V3+ without re-refactoring engine-core. The full
 * substrate primitive set (ray traversal, snapping, terrain-as-cells)
 * is intentionally NOT designed here because:
 *
 *   1. Designing it without a second substrate to test against is the
 *      over-abstraction trap §2.1 / §10 warns against.
 *   2. "Duplication of vision rules / terrain catalogs across
 *      substrates is acceptable" (D5) — V3's hex implementation may
 *      ship its own terrain catalog rather than fitting into a shared
 *      abstraction, and that's fine.
 *
 * What V2 commits to:
 *   - Every ruleset declares a Substrate.
 *   - The substrate provides `distance(a, b)` — the measurement the §4
 *     vision formula reads (`distance ≤ vision / effective_stealth`).
 *
 * What V2 does NOT commit to:
 *   - A unified ray-traversal primitive across substrates.
 *   - A Position type abstract enough to cover hex / grid coordinates
 *     — V2 uses the existing `Point` ({x, y} inches). V3 generalizes
 *     when a second substrate exists to constrain the shape.
 */
export interface Substrate {
  readonly id: string;
  readonly displayName: string;
  /**
   * Distance between two positions in this substrate's measurement
   * unit (inches for free-position; cells / hexes for future grid
   * substrates). The §4 discovery formula consumes this as its
   * threshold input.
   */
  distance(a: Point, b: Point): number;
}
