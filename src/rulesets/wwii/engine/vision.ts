import type { VisionConfig } from "../../../core/vision/index.js";
import { wwiiComposition } from "./vision/composition.js";
import {
  goneToGroundContributor,
  inherentContributor,
  intrinsicContributor,
  terrainContributor,
} from "./vision/contributors/index.js";

/**
 * The WWII 1/100 ruleset's vision-pipeline configuration.
 *
 * Phase B 2b-i: contributors and composition are now real. Order is
 * intentional and matches the composition rule's expectations —
 * intrinsic first so it appears first in breakdowns; gone-to-ground
 * last so it visually stacks "on top" of any pool winner. (Strictly
 * speaking the WWII composition rule routes by `contributorId`, not
 * by position, so order doesn't affect correctness. It does affect
 * the per-contributor `contribute()` call order, which is irrelevant
 * for these contributors since none of them depend on each other's
 * state.)
 *
 * VisionCalculator.discover doesn't read this config yet — 2b-ii
 * wires the consumption. Until then, the pipeline exists as parallel
 * data the VisionCalculator could opt into.
 */
export const wwiiVisionConfig: VisionConfig = {
  contributors: [
    intrinsicContributor,
    inherentContributor,
    terrainContributor,
    goneToGroundContributor,
  ],
  compositionRule: wwiiComposition,
};
