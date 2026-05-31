import type { CompositionRule } from "../compositionRule.js";

/**
 * WWII's composition rule: pick the contributor with the largest
 * modifier; drop the others. Returns `value: 1` (no concealment) and
 * an empty breakdown when no contributor exceeds 1 — matches
 * VisionCalculator.discover's current `Math.max(1, ...)` behavior.
 *
 * See [docs/features/v1/vision-rules-tweaks.md §2] for the rule's
 * origin in the WWII ruleset and [mechanics-refactor.md §11 D2]
 * for why composition is per-ruleset configurable.
 */
export const singleHighest: CompositionRule = (readings) => {
  let best: (typeof readings)[number] | null = null;
  for (const reading of readings) {
    if (!best || reading.modifier > best.modifier) best = reading;
  }
  if (!best || best.modifier <= 1) {
    return { value: 1, breakdown: [] };
  }
  return { value: best.modifier, breakdown: [best] };
};
