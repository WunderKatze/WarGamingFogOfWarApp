import { distance } from "../../../core/map/geometry.js";
import type { Substrate } from "../../../core/map/substrate/index.js";

/**
 * The WWII 1/100 ruleset's substrate: free-position inches.
 *
 * Units are placed anywhere on the (x, y) plane in inches; distance is
 * the Euclidean norm. Delegates to the existing geometry helper so the
 * substrate seam and the geometry primitive stay in sync — Phase B
 * step 2 may migrate `geometry.distance` into a substrate-owned
 * implementation, but for 1e the seam just exposes the existing
 * function through the substrate interface.
 *
 * Per [mechanics-refactor.md §11 D5], V2 ships only this substrate.
 * A hex / square-grid substrate would land in V3+ as a separate
 * implementation registered by a different ruleset.
 */
export const freePositionInches: Substrate = {
  id: "free-position-inches",
  displayName: "Free position (inches)",
  distance,
};
