import type { VisionConfig } from "../../../core/vision/index.js";
import { sumComposition } from "./vision/composition.js";
import {
  testConstantContributor,
  testIntrinsicContributor,
} from "./vision/contributors.js";

/**
 * The test ruleset's vision configuration. Combines this ruleset's
 * own intrinsic + constant contributors with `sumComposition`.
 *
 * For a Tank target (intrinsicStealth=1): readings = [1, 2.5];
 * sumComposition value = 3.5. Clearly different from WWII's pipeline
 * (which would give 1 for a Tank in the open). Tests verify this in
 * tests/rulesets/test-ruleset/engine/integration.test.ts.
 */
export const testVisionConfig: VisionConfig = {
  contributors: [testIntrinsicContributor, testConstantContributor],
  compositionRule: sumComposition,
};
