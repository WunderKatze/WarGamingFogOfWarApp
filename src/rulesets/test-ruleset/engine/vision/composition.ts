import type { CompositionRule } from "../../../../core/vision/index.js";

/**
 * The test ruleset's composition rule: **sum** of all contributor
 * modifiers. Floor at 1 when there are no readings (so a target with
 * no contributors still has a meaningful stealth value).
 *
 * Picked specifically to differ from WWII's three-stage rule (intrinsic
 * × pool × gtg-conditional). Per [§11 D1], the test ruleset exists to
 * prove the composition slot is genuinely per-ruleset configurable —
 * if Axis 2's interfaces only worked for WWII semantics, this rule
 * wouldn't plug in.
 *
 * `breakdown` returns every reading because sum uses every reading.
 * Order preserved from input.
 */
export const sumComposition: CompositionRule = (readings) => {
  if (readings.length === 0) return { value: 1, breakdown: [] };
  const value = readings.reduce((acc, r) => acc + r.modifier, 0);
  return { value, breakdown: [...readings] };
};
