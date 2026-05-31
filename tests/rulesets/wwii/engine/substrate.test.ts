import { describe, expect, it } from "vitest";
import { freePositionInches } from "../../../../src/rulesets/wwii/engine/substrate.js";

/**
 * Tests for the WWII substrate (free-position inches).
 *
 * Phase B 1e ships only the substrate seam — the slot exists on
 * Ruleset and WWII provides distance(). These tests pin the identity
 * and the measurement so the slot's wiring is verifiable.
 *
 * Per [mechanics-refactor.md §11 D5], V2 ships only this one
 * substrate; a hex or square-grid substrate would land in V3+ as a
 * separate implementation.
 */

describe("freePositionInches substrate", () => {
  it("has the expected identity", () => {
    expect(freePositionInches.id).toBe("free-position-inches");
    expect(freePositionInches.displayName).toBe("Free position (inches)");
  });

  it("distance is the Euclidean norm in inches", () => {
    expect(freePositionInches.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("distance is 0 for the same point", () => {
    expect(freePositionInches.distance({ x: 7, y: 11 }, { x: 7, y: 11 })).toBe(0);
  });

  it("distance is symmetric", () => {
    const a = { x: -3, y: 5 };
    const b = { x: 8, y: -2 };
    expect(freePositionInches.distance(a, b)).toBeCloseTo(
      freePositionInches.distance(b, a),
      10,
    );
  });
});
