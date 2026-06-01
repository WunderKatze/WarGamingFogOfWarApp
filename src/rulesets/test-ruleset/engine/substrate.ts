import type { Substrate } from "../../../core/map/substrate/index.js";

/**
 * The test ruleset's substrate: Manhattan distance.
 *
 * Distance = |dx| + |dy| instead of WWII's Euclidean √(dx² + dy²).
 * Picked because (a) it's a real, recognized distance metric so it's
 * not arbitrary, (b) it produces measurably different values from
 * Euclidean for the same positions (3-4-5 triangle: Euclidean=5,
 * Manhattan=7), and (c) it doesn't require new position primitives
 * — same {x, y} Point shape.
 *
 * Per [§11 D5] V2 doesn't ship hex / square-grid substrates; the
 * test ruleset uses Manhattan-over-Points rather than introducing
 * cell coordinates because the position-type abstraction isn't part
 * of V2.
 */
export const manhattanGrid: Substrate = {
  id: "manhattan-grid",
  displayName: "Manhattan (test)",
  distance: (a, b) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y),
};
