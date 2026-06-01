import { describe, expect, it } from "vitest";
import { wwiiVisionConfig } from "../../../../src/rulesets/wwii/engine/vision.js";
import { wwiiComposition } from "../../../../src/rulesets/wwii/engine/vision/composition.js";

/**
 * Tests for the WWII ruleset's vision configuration.
 *
 * Phase B 2b-i: the slot now has real contributors (intrinsic,
 * inherent, terrain, gone-to-ground) and a custom WWII composition
 * rule that replaces the 1d singleHighest placeholder. These tests
 * pin the slot's wiring so accidental edits to the contributor list
 * or rule choice fail here, not in VisionCalculator after 2b-ii.
 *
 * Each individual contributor and the composition rule have their own
 * test files; this one is about the assembly.
 */

describe("wwiiVisionConfig", () => {
  it("uses the WWII custom composition rule (not the bare singleHighest primitive)", () => {
    expect(wwiiVisionConfig.compositionRule).toBe(wwiiComposition);
  });

  it("registers the four WWII contributors in breakdown-friendly order", () => {
    expect(wwiiVisionConfig.contributors.map((c) => c.id)).toEqual([
      "intrinsic",
      "inherent",
      "terrain",
      "gone-to-ground",
    ]);
  });
});
