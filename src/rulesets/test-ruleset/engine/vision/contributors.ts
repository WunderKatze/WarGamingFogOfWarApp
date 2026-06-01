import type { Contributor } from "../../../../core/vision/index.js";

/**
 * The test ruleset's contributors. Two: an intrinsic-reader and a
 * constant. Deliberately independent of WWII's contributor
 * implementations — proves a ruleset can define its own contributor
 * set without depending on another ruleset's code.
 *
 * Per [§11 D1], the test ruleset's contributors are stubs that
 * exercise the pipeline shape, not realized game mechanics.
 */

/**
 * Reads `target.getIntrinsicStealth()`. Same idea as WWII's intrinsic
 * contributor but distinct implementation — the test ruleset doesn't
 * import from `src/rulesets/wwii/`. Always emits (even when value=1),
 * because the test ruleset's `sumComposition` benefits from seeing
 * the explicit ×1 reading in the breakdown.
 */
export const testIntrinsicContributor: Contributor = {
  id: "test-intrinsic",
  contribute(target) {
    return [
      {
        contributorId: "test-intrinsic",
        modifier: target.getIntrinsicStealth(),
        label: "test intrinsic",
      },
    ];
  },
};

/**
 * Always emits ×2.5. Constant for testability — composition tests can
 * predict the exact value without modeling map / observer state.
 */
export const testConstantContributor: Contributor = {
  id: "test-constant",
  contribute() {
    return [
      {
        contributorId: "test-constant",
        modifier: 2.5,
        label: "test constant",
      },
    ];
  },
};
