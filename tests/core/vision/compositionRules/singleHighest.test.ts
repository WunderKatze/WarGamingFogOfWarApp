import { describe, expect, it } from "vitest";
import type { ContributorReading } from "../../../../src/core/vision/index.js";
import { singleHighest } from "../../../../src/core/vision/index.js";

/**
 * Tests for the singleHighest composition rule
 * (src/core/vision/compositionRules/singleHighest.ts).
 *
 * Phase B 1d — pins WWII's pooling-rule contract so the step-2
 * migration of VisionCalculator.discover lands behavior-preserving.
 * The rule's existing behavior comes from VisionCalculator's
 * `Math.max(1, inherentMod, ...terrainMods)` expression; this test
 * file translates that into explicit cases for the contributor-pipeline
 * shape.
 */

const reading = (id: string, modifier: number, label = id): ContributorReading => ({
  contributorId: id,
  modifier,
  label,
});

describe("singleHighest", () => {
  it("returns value=1 and empty breakdown when there are no readings", () => {
    expect(singleHighest([])).toEqual({ value: 1, breakdown: [] });
  });

  it("returns value=1 and empty breakdown when every reading is at-or-below 1", () => {
    // VisionCalculator's current Math.max(1, ...) semantics — a contributor
    // returning modifier=1 counts as "no concealment," not as a winner.
    const readings = [reading("a", 1), reading("b", 0.5), reading("c", 1)];
    expect(singleHighest(readings)).toEqual({ value: 1, breakdown: [] });
  });

  it("returns the single highest modifier when one reading exceeds 1", () => {
    const readings = [reading("a", 1), reading("b", 3), reading("c", 1)];
    expect(singleHighest(readings)).toEqual({
      value: 3,
      breakdown: [reading("b", 3)],
    });
  });

  it("picks the strict winner when multiple readings exceed 1", () => {
    const readings = [reading("a", 2), reading("b", 3), reading("c", 2)];
    expect(singleHighest(readings)).toEqual({
      value: 3,
      breakdown: [reading("b", 3)],
    });
  });

  it("breaks ties by first-seen (preserves caller's contributor order)", () => {
    // First-seen wins so the breakdown is deterministic for the UI; if
    // two contributors tie, the one earlier in the registered list
    // shows up in the breakdown. The numeric value is identical either
    // way, so this is purely a presentation contract.
    const readings = [reading("first", 3), reading("second", 3)];
    const result = singleHighest(readings);
    expect(result.value).toBe(3);
    expect(result.breakdown).toEqual([reading("first", 3)]);
  });

  it("does not mutate the input array", () => {
    const readings = [reading("a", 2), reading("b", 3)];
    const snapshot = [...readings];
    singleHighest(readings);
    expect(readings).toEqual(snapshot);
  });
});
