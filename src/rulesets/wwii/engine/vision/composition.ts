import type {
  CompositionRule,
  ContributorReading,
} from "../../../../core/vision/index.js";

/**
 * WWII's effective-stealth composition rule.
 *
 * The WWII rule is *more than single-highest pooling* — it's a
 * three-stage pipeline that 1d's plain `singleHighest` couldn't
 * express on its own:
 *
 *   1. **Intrinsic readings** (the target's `getIntrinsicStealth()`)
 *      are **always multiplied in**. They're not pooled; they're a
 *      base-stealth factor.
 *   2. **External readings** (inherent dug-in + terrain) are pooled
 *      by **single-highest**. Only the largest applies; the rest are
 *      dropped from the result and the breakdown. Matches
 *      VisionCalculator.discover's existing `Math.max(1, …)` semantics.
 *   3. **Gone-to-Ground** stacks on top **only when the external pool
 *      came out > 1** — i.e. only when the target is concealed by
 *      something else. Matches the existing
 *      `if (gtg && highestMod > 1) highestMod *= gtgMult` line.
 *
 * The rule keys on `contributorId` to route readings to the right
 * stage. The ids ("intrinsic", "gone-to-ground", and everything else
 * treated as "external") are WWII vocabulary — that's why this rule
 * lives in the WWII ruleset folder rather than core. Per
 * [mechanics-refactor.md §11 D2], composition is the ruleset's
 * choice; other rulesets can register `singleHighest` (the simpler
 * core primitive) or roll their own.
 *
 * **Why not just `singleHighest`?** Because WWII isn't actually
 * single-highest. The 1d wiring registered `singleHighest` as a
 * placeholder; 2b-i replaces it with this rule. `singleHighest` stays
 * available in core as a reusable primitive for rulesets that genuinely
 * want flat pooling without intrinsic / stacking concerns.
 */
export const wwiiComposition: CompositionRule = (readings) => {
  const intrinsics: ContributorReading[] = [];
  const externals: ContributorReading[] = [];
  let gtg: ContributorReading | null = null;

  for (const reading of readings) {
    if (reading.contributorId === "intrinsic") {
      intrinsics.push(reading);
    } else if (reading.contributorId === "gone-to-ground") {
      // Only the first GtG reading is honored; the contributor is
      // single-source so this is defensive (never expect >1).
      if (gtg === null) gtg = reading;
    } else {
      externals.push(reading);
    }
  }

  // Stage 2: pool externals single-highest, floor at 1.
  let pool = 1;
  let poolWinner: ContributorReading | null = null;
  for (const r of externals) {
    if (r.modifier > pool) {
      pool = r.modifier;
      poolWinner = r;
    }
  }

  // Stage 3: GtG stacks only when the external pool is doing work.
  let appliedGtg: ContributorReading | null = null;
  if (gtg && pool > 1) {
    pool *= gtg.modifier;
    appliedGtg = gtg;
  }

  // Stage 1: intrinsic always multiplies in (after externals are pooled
  // so we don't accidentally let intrinsic compete in the pool).
  const intrinsicProduct = intrinsics.reduce((acc, r) => acc * r.modifier, 1);
  const value = intrinsicProduct * pool;

  // Breakdown: intrinsics (in order), the pool winner if any, GtG if
  // it applied. The order matters for the UI's readability — intrinsic
  // first, then the dominant external concealment, then GtG.
  const breakdown: ContributorReading[] = [...intrinsics];
  if (poolWinner) breakdown.push(poolWinner);
  if (appliedGtg) breakdown.push(appliedGtg);

  return { value, breakdown };
};
