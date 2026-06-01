import { describe, expect, it } from "vitest";
import type { ContributorReading } from "../../../../../src/core/vision/index.js";
import { wwiiComposition } from "../../../../../src/rulesets/wwii/engine/vision/composition.js";

/**
 * Tests for the WWII composition rule
 * (src/rulesets/wwii/engine/vision/composition.ts).
 *
 * Phase B 2b-i: this rule replaces 1d's `singleHighest` placeholder.
 * The three-stage WWII semantics live here:
 *   1. intrinsic readings always multiply in
 *   2. external readings (everything else except gone-to-ground) pool single-highest
 *   3. gone-to-ground stacks on top only when pool > 1
 *
 * Each test isolates one stage's contract so a regression points at
 * the broken stage.
 */

const reading = (
  contributorId: string,
  modifier: number,
  label = contributorId,
): ContributorReading => ({ contributorId, modifier, label });

describe("wwiiComposition — empty input", () => {
  it("returns value=1 + empty breakdown when nothing contributes", () => {
    expect(wwiiComposition([])).toEqual({ value: 1, breakdown: [] });
  });
});

describe("wwiiComposition — intrinsic stage (stage 1)", () => {
  it("multiplies intrinsic readings into the result regardless of pool", () => {
    const r = wwiiComposition([reading("intrinsic", 4 / 3)]);
    expect(r.value).toBeCloseTo(4 / 3, 10);
    expect(r.breakdown).toEqual([reading("intrinsic", 4 / 3)]);
  });

  it("multiplies multiple intrinsic readings together (defensive — only one expected)", () => {
    const r = wwiiComposition([reading("intrinsic", 2), reading("intrinsic", 3)]);
    expect(r.value).toBe(6);
  });
});

describe("wwiiComposition — external pool (stage 2)", () => {
  it("pools by single-highest, picking the largest external modifier", () => {
    const r = wwiiComposition([
      reading("terrain", 2, "Short Terrain"),
      reading("terrain", 3, "Tall Woods"),
      reading("inherent", 2, "dug in"),
    ]);
    expect(r.value).toBe(3);
    expect(r.breakdown).toEqual([reading("terrain", 3, "Tall Woods")]);
  });

  it("floors the pool at 1 when no external reading exceeds 1", () => {
    // Empty externals → pool stays 1 → result is whatever intrinsic
    // multiplies (here nothing) → 1.
    expect(wwiiComposition([]).value).toBe(1);
  });
});

describe("wwiiComposition — GtG stacking (stage 3)", () => {
  it("stacks GtG when an external reading exceeds 1", () => {
    const r = wwiiComposition([
      reading("terrain", 3, "Tall Woods"),
      reading("gone-to-ground", 2, "GtG"),
    ]);
    // pool = 3, gtg = ×2, no intrinsic → 6
    expect(r.value).toBe(6);
    expect(r.breakdown).toEqual([
      reading("terrain", 3, "Tall Woods"),
      reading("gone-to-ground", 2, "GtG"),
    ]);
  });

  it("does NOT stack GtG when no external reading exceeds 1 (target in the open)", () => {
    // The classic vision-rules-tweaks §2.3 case: GtG tank in the open
    // gets no stack because there's no concealment to stack on top of.
    const r = wwiiComposition([reading("gone-to-ground", 2, "GtG")]);
    expect(r.value).toBe(1);
    expect(r.breakdown).toEqual([]);
  });

  it("does NOT include GtG in the breakdown when it didn't apply", () => {
    const r = wwiiComposition([
      reading("terrain", 1, "Short Wall"), // doesn't exceed 1
      reading("gone-to-ground", 2, "GtG"),
    ]);
    expect(r.value).toBe(1);
    expect(r.breakdown).toEqual([]);
  });
});

describe("wwiiComposition — combined stages", () => {
  it("Recon Infantry dug-in with GtG: intrinsic × dug-in-pool × GtG", () => {
    // Walks the full pipeline: intrinsic (4/3) × pool(dug-in=2) × gtg(2)
    // = 16/3 ≈ 5.333. Mirrors a real WWII observation.
    const r = wwiiComposition([
      reading("intrinsic", 4 / 3, "intrinsic"),
      reading("inherent", 2, "dug in"),
      reading("gone-to-ground", 2, "GtG"),
    ]);
    expect(r.value).toBeCloseTo((4 / 3) * 2 * 2, 10);
    expect(r.breakdown).toEqual([
      reading("intrinsic", 4 / 3, "intrinsic"),
      reading("inherent", 2, "dug in"),
      reading("gone-to-ground", 2, "GtG"),
    ]);
  });

  it("pool drops the loser when multiple externals are present", () => {
    // Two externals, GtG present. Dug-in (2) loses to Tall Woods (3);
    // pool is 3; GtG stacks → 6. Dug-in does NOT appear in breakdown.
    const r = wwiiComposition([
      reading("inherent", 2, "dug in"),
      reading("terrain", 3, "Tall Woods"),
      reading("gone-to-ground", 2, "GtG"),
    ]);
    expect(r.value).toBe(6);
    expect(r.breakdown).toEqual([
      reading("terrain", 3, "Tall Woods"),
      reading("gone-to-ground", 2, "GtG"),
    ]);
  });

  it("breakdown order: intrinsic → pool winner → GtG", () => {
    const r = wwiiComposition([
      reading("gone-to-ground", 2, "GtG"),   // out of order on purpose
      reading("terrain", 3, "Tall Woods"),
      reading("intrinsic", 4 / 3, "intrinsic"),
    ]);
    expect(r.breakdown.map((b) => b.contributorId)).toEqual([
      "intrinsic",
      "terrain",
      "gone-to-ground",
    ]);
  });
});
