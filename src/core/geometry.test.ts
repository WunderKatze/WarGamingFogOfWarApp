import { describe, expect, it } from "vitest";
import {
  distance,
  pointInPolygon,
  segmentEdgeIntersectionCount,
  segmentIntersection,
  segmentLengthInsidePolygon,
} from "./geometry.js";
import type { Point } from "./types.js";

const p = (x: number, y: number): Point => ({ x, y });

describe("distance", () => {
  it("is 0 for the same point", () => {
    expect(distance(p(3, 4), p(3, 4))).toBe(0);
  });

  it("is 5 for a 3-4-5 triangle", () => {
    expect(distance(p(0, 0), p(3, 4))).toBe(5);
  });

  it("is symmetric", () => {
    expect(distance(p(1, 2), p(7, 9))).toBe(distance(p(7, 9), p(1, 2)));
  });
});

describe("segmentIntersection", () => {
  it("finds the intersection of two crossing segments", () => {
    // Horizontal segment y=0 from x=-1..1 crosses vertical segment x=0 from y=-1..1 at origin
    const x = segmentIntersection(p(-1, 0), p(1, 0), p(0, -1), p(0, 1));
    expect(x).not.toBeNull();
    expect(x!.x).toBeCloseTo(0, 9);
    expect(x!.y).toBeCloseTo(0, 9);
  });

  it("returns null for parallel non-overlapping segments", () => {
    expect(segmentIntersection(p(0, 0), p(1, 0), p(0, 1), p(1, 1))).toBeNull();
  });

  it("returns null for collinear segments", () => {
    expect(segmentIntersection(p(0, 0), p(2, 0), p(3, 0), p(5, 0))).toBeNull();
  });

  it("returns null when segments lie on lines that intersect outside their bounds", () => {
    // Both segments are short; their lines cross at (10, 10) but neither segment reaches there
    expect(segmentIntersection(p(0, 0), p(1, 1), p(2, 0), p(3, -1))).toBeNull();
  });

  it("returns null when segments only touch at a shared endpoint", () => {
    // Two segments meeting at (1,0) — endpoint touches don't count as a crossing
    expect(segmentIntersection(p(0, 0), p(1, 0), p(1, 0), p(1, 1))).toBeNull();
  });

  it("returns null when one segment's endpoint lies on the other (T-junction)", () => {
    // Segment B's endpoint (1,0) lies on segment A — endpoint touches don't count
    expect(segmentIntersection(p(0, 0), p(2, 0), p(1, 0), p(1, 1))).toBeNull();
  });
});

describe("pointInPolygon", () => {
  const square = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];

  it("returns true for a point inside a square", () => {
    expect(pointInPolygon(p(5, 5), square)).toBe(true);
  });

  it("returns false for a point outside a square", () => {
    expect(pointInPolygon(p(-1, 5), square)).toBe(false);
    expect(pointInPolygon(p(15, 5), square)).toBe(false);
    expect(pointInPolygon(p(5, -1), square)).toBe(false);
    expect(pointInPolygon(p(5, 15), square)).toBe(false);
  });

  it("handles concave polygons (L-shape)", () => {
    // L-shape: vertical bar (0..2 wide, 0..10 tall) joined to horizontal bar (0..10 wide, 0..2 tall)
    const lShape = [p(0, 0), p(10, 0), p(10, 2), p(2, 2), p(2, 10), p(0, 10)];
    expect(pointInPolygon(p(1, 5), lShape)).toBe(true);   // in the vertical arm
    expect(pointInPolygon(p(5, 1), lShape)).toBe(true);   // in the horizontal arm
    expect(pointInPolygon(p(5, 5), lShape)).toBe(false);  // in the notch (outside the L)
  });
});

describe("segmentEdgeIntersectionCount", () => {
  const square = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];

  it("returns 0 when the segment is entirely outside the polygon", () => {
    expect(segmentEdgeIntersectionCount(p(-5, 5), p(-1, 5), square)).toBe(0);
  });

  it("returns 0 when the segment is entirely inside the polygon", () => {
    expect(segmentEdgeIntersectionCount(p(2, 2), p(8, 8), square)).toBe(0);
  });

  it("returns 1 when the segment exits the polygon once", () => {
    expect(segmentEdgeIntersectionCount(p(5, 5), p(15, 5), square)).toBe(1);
  });

  it("returns 2 when the segment passes all the way through", () => {
    expect(segmentEdgeIntersectionCount(p(-5, 5), p(15, 5), square)).toBe(2);
  });
});

describe("segmentLengthInsidePolygon", () => {
  const square = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];

  it("is 0 when segment is entirely outside the polygon", () => {
    expect(segmentLengthInsidePolygon(p(-5, 5), p(-1, 5), square)).toBe(0);
  });

  it("equals segment length when the segment is entirely inside", () => {
    const len = segmentLengthInsidePolygon(p(2, 5), p(8, 5), square);
    expect(len).toBeCloseTo(6, 9);
  });

  it("is the inside portion when the segment exits the polygon", () => {
    // (5,5) inside → (15,5) outside: inside portion is from (5,5) to (10,5) = length 5
    const len = segmentLengthInsidePolygon(p(5, 5), p(15, 5), square);
    expect(len).toBeCloseTo(5, 9);
  });

  it("is the inside portion when the segment passes all the way through", () => {
    // (-5,5) → (15,5) passes through square from (0,5) to (10,5) = length 10
    const len = segmentLengthInsidePolygon(p(-5, 5), p(15, 5), square);
    expect(len).toBeCloseTo(10, 9);
  });

  it("handles a non-axis-aligned segment that crosses two edges", () => {
    // From (-5, 2) to (15, 8), slope 0.3. Enters left edge at (0, 3.5), exits right at (10, 6.5).
    // Inside portion length = sqrt(10² + 3²) = sqrt(109).
    const len = segmentLengthInsidePolygon(p(-5, 2), p(15, 8), square);
    expect(len).toBeCloseTo(Math.sqrt(109), 9);
  });
});
