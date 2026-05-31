import { singleHighest, type VisionConfig } from "../../../core/vision/index.js";

/**
 * The WWII 1/100 ruleset's vision-pipeline configuration.
 *
 * Step 1d wires the slot with the composition rule WWII uses
 * (single-highest pooling) but with an empty contributor list. The
 * actual contributors (intrinsic stealth, dug-in inherent, polygon
 * terrain, walls, GtG stacking) are extracted from VisionCalculator
 * and registered here in step 2. Until then, the registered config is
 * structurally complete but inert — nothing reads it; VisionCalculator
 * continues to compose contributors inline as it does today.
 *
 * Phase B over-abstraction note: composition is `singleHighest` for
 * WWII; that's locked-in for this ruleset. Other rulesets register
 * `sum` / `product` / their own combiner.
 */
export const wwiiVisionConfig: VisionConfig = {
  contributors: [],
  compositionRule: singleHighest,
};
