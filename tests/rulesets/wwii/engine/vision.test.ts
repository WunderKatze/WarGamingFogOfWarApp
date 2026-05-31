import { describe, expect, it } from "vitest";
import { singleHighest } from "../../../../src/core/vision/index.js";
import { wwiiVisionConfig } from "../../../../src/rulesets/wwii/engine/vision.js";

/**
 * Tests for the WWII ruleset's vision configuration.
 *
 * Phase B 1d ships the slot wired with WWII's composition rule
 * (single-highest) but with an empty contributor list — the actual
 * contributors land in step 2 alongside the VisionCalculator migration.
 * These tests pin the slot's current shape so the step-2 work has an
 * obvious starting point and any regression in the slot's wiring fails
 * here, not at app boot.
 */

describe("wwiiVisionConfig", () => {
  it("uses singleHighest as the composition rule (WWII's pooling rule)", () => {
    expect(wwiiVisionConfig.compositionRule).toBe(singleHighest);
  });

  it("has an empty contributor list in step 1d (step 2 populates it)", () => {
    expect(wwiiVisionConfig.contributors).toEqual([]);
  });
});
