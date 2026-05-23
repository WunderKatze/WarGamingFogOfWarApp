import { describe, expect, it } from "vitest";
import {
  polygonStealthModifier,
  shortWallStealthModifier,
  tallWoodsRayThroughLimit,
  terrainEdgeGraceDistance,
} from "../../../src/core/config.js";
import { GameMap } from "../../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../../src/core/map/TerrainPolygon.js";
import { TerrainWall } from "../../../src/core/map/TerrainWall.js";
import type { Point } from "../../../src/core/types.js";

const p = (x: number, y: number): Point => ({ x, y });

const square = (id: string, x: number, y: number, w: number, h: number, terrainType: "Building" | "TallWoods" | "ShortTerrain") =>
  new TerrainPolygon({
    id,
    vertices: [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)],
    terrainType,
  });

describe("GameMap construction", () => {
  it("stores dimensions, polygons, walls, and backdrop", () => {
    const poly = square("b1", 10, 10, 5, 5, "Building");
    const wall = new TerrainWall({ id: "w1", from: p(0, 0), to: p(1, 0), wallType: "Tall" });
    const map = new GameMap({
      width: 100, height: 60,
      polygons: [poly], walls: [wall],
      backdrop: { imageDataUrl: "data:image/png;base64,abc", inchesPerPixel: 0.1 },
    });
    expect(map.width).toBe(100);
    expect(map.height).toBe(60);
    expect(map.polygons).toEqual([poly]);
    expect(map.walls).toEqual([wall]);
    expect(map.backdrop).toEqual({ imageDataUrl: "data:image/png;base64,abc", inchesPerPixel: 0.1 });
  });

  it("defaults polygons and walls to empty arrays", () => {
    const map = new GameMap({ width: 10, height: 10 });
    expect(map.polygons).toEqual([]);
    expect(map.walls).toEqual([]);
    expect(map.backdrop).toBeUndefined();
  });

  it("rejects non-positive dimensions", () => {
    expect(() => new GameMap({ width: 0, height: 10 })).toThrow();
    expect(() => new GameMap({ width: 10, height: -5 })).toThrow();
  });
});

describe("GameMap.isRayBlocked", () => {
  it("returns false on an empty map", () => {
    const map = new GameMap({ width: 100, height: 100 });
    expect(map.isRayBlocked(p(0, 0), p(50, 50))).toBe(false);
  });

  it("a Tall wall blocks a ray that crosses it", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Tall" });
    const map = new GameMap({ width: 100, height: 100, walls: [wall] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50))).toBe(true);
    expect(map.isRayBlocked(p(10, 50), p(40, 50))).toBe(false);
  });

  it("a Short wall does NOT block a ray (it conceals only)", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Short" });
    const map = new GameMap({ width: 100, height: 100, walls: [wall] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50))).toBe(false);
  });

  it("a Building blocks a ray that crosses ≥ 2 of its edges", () => {
    const building = square("b", 40, 40, 20, 20, "Building");
    const map = new GameMap({ width: 100, height: 100, polygons: [building] });
    // ray passes all the way through: enters left edge, exits right edge
    expect(map.isRayBlocked(p(10, 50), p(90, 50))).toBe(true);
    // ray ends inside the building: only crosses 1 edge
    expect(map.isRayBlocked(p(10, 50), p(50, 50))).toBe(false);
    // ray entirely outside the building
    expect(map.isRayBlocked(p(10, 10), p(30, 10))).toBe(false);
  });

  it("Tall woods blocks a ray that travels more than the configured limit through it", () => {
    // Strip wider than the limit; ray going fully across is blocked.
    const width = tallWoodsRayThroughLimit + 1;
    const woods = square("w", 40, 0, width, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50))).toBe(true);
  });

  it("Tall woods does NOT block a ray whose inside-portion is within the configured limit", () => {
    // Strip narrower than the limit; ray going fully across is NOT blocked.
    const width = Math.max(0.5, tallWoodsRayThroughLimit - 0.5);
    const woods = square("w", 40, 0, width, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50))).toBe(false);
  });

  it("Short terrain never blocks a ray", () => {
    const wheat = square("wh", 0, 0, 100, 100, "ShortTerrain");
    const map = new GameMap({ width: 100, height: 100, polygons: [wheat] });
    expect(map.isRayBlocked(p(10, 10), p(90, 90))).toBe(false);
  });
});

describe("GameMap.getConcealmentModifiersAlongRay", () => {
  it("returns [] on an empty map", () => {
    const map = new GameMap({ width: 100, height: 100 });
    expect(map.getConcealmentModifiersAlongRay(p(0, 0), p(50, 50))).toEqual([]);
  });

  it("Short wall contributes shortWallStealthModifier when crossed", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Short" });
    const map = new GameMap({ width: 100, height: 100, walls: [wall] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50)))
      .toEqual([shortWallStealthModifier]);
  });

  it("Tall wall contributes nothing (it blocks instead)", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Tall" });
    const map = new GameMap({ width: 100, height: 100, walls: [wall] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50))).toEqual([]);
  });

  it("Building contributes its modifier only when the target is INSIDE", () => {
    const building = square("b", 40, 40, 20, 20, "Building");
    const map = new GameMap({ width: 100, height: 100, polygons: [building] });
    // target inside the building
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(50, 50)))
      .toEqual([polygonStealthModifier.Building]);
    // target outside the building (ray passes through but target is past it)
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50))).toEqual([]);
  });

  it("Tall woods contributes its modifier when the ray passes through", () => {
    const woods = square("w", 40, 40, 20, 20, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50)))
      .toEqual([polygonStealthModifier.TallWoods]);
  });

  it("Short terrain contributes its modifier when the ray passes through", () => {
    const wheat = square("wh", 40, 40, 20, 20, "ShortTerrain");
    const map = new GameMap({ width: 100, height: 100, polygons: [wheat] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50)))
      .toEqual([polygonStealthModifier.ShortTerrain]);
  });

  it("returns one entry per applicable terrain feature (caller takes the max)", () => {
    const wheat = square("wh", 40, 40, 20, 20, "ShortTerrain");
    const wall = new TerrainWall({ id: "w", from: p(70, 0), to: p(70, 100), wallType: "Short" });
    const map = new GameMap({ width: 100, height: 100, polygons: [wheat], walls: [wall] });
    // ray passes through the wheat AND crosses the short wall
    const mods = map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50));
    expect(mods).toHaveLength(2);
    expect(mods).toContain(polygonStealthModifier.ShortTerrain);
    expect(mods).toContain(shortWallStealthModifier);
  });

  it("Building still contributes stealth without an edge grace (target-inside rule)", () => {
    // Even a narrow building counts when the target is inside — the
    // grace is woods/short-only, not buildings.
    const tiny = square("b", 40, 49, 1, 2, "Building");
    const map = new GameMap({ width: 100, height: 100, polygons: [tiny] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(40.5, 50)))
      .toEqual([polygonStealthModifier.Building]);
  });
});

// Edge grace is asymmetric (vision-rules-tweaks §2.2): it rewards an
// observer hugging the inside of a TallWoods / ShortTerrain polygon
// who is trying to see OUT. It must NOT help an observer who is
// outside the polygon trying to see in or through it.
describe("GameMap.getConcealmentModifiersAlongRay — edge-grace asymmetry", () => {
  // Geometry helpers chosen as a fraction of `terrainEdgeGraceDistance`
  // so any future grace tweak doesn't churn these tests.
  const underGrace = terrainEdgeGraceDistance / 2;
  const overGrace = terrainEdgeGraceDistance * 4;

  it("observer outside + target outside (ray slivers through Tall Woods) → polygon contributes", () => {
    // Strip narrower than the grace, so under a *symmetric* rule the
    // ray would NOT contribute concealment.
    const sliver = square("w", 40, 0, underGrace, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [sliver] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(90, 50)))
      .toEqual([polygonStealthModifier.TallWoods]);
  });

  it("observer outside + target inside Short Terrain (target just barely inside) → polygon contributes", () => {
    // Wide enough strip that we can place target just inside the entry edge.
    const stripWidth = overGrace;
    const strip = square("st", 40, 0, stripWidth, 100, "ShortTerrain");
    const map = new GameMap({ width: 100, height: 100, polygons: [strip] });
    // Target inside the strip at depth < grace from the entry edge.
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(40 + underGrace, 50)))
      .toEqual([polygonStealthModifier.ShortTerrain]);
  });

  it("observer inside Tall Woods hugging the EXIT edge + target outside → grace applies, polygon does NOT contribute", () => {
    // Strip at x=40..(40+stripWidth). Observer placed under-grace inches
    // from the exit edge in the ray's direction; target outside.
    const stripWidth = overGrace;
    const exitX = 40 + stripWidth;
    const woods = square("w", 40, 0, stripWidth, 100, "TallWoods");
    const map = new GameMap({ width: 200, height: 100, polygons: [woods] });
    expect(map.getConcealmentModifiersAlongRay(p(exitX - underGrace, 50), p(150, 50))).toEqual([]);
  });

  it("observer inside Tall Woods deeper than grace from the exit + target outside → polygon contributes", () => {
    const stripWidth = overGrace;
    const woods = square("w", 40, 0, stripWidth, 100, "TallWoods");
    const map = new GameMap({ width: 200, height: 100, polygons: [woods] });
    // Observer near the entry edge → still far from exit (full strip width remaining).
    expect(map.getConcealmentModifiersAlongRay(p(40 + underGrace, 50), p(150, 50)))
      .toEqual([polygonStealthModifier.TallWoods]);
  });

  it("both inside the same Short Terrain, close together (within grace) → polygon does NOT contribute", () => {
    const stripWidth = overGrace;
    const strip = square("st", 40, 0, stripWidth, 100, "ShortTerrain");
    const map = new GameMap({ width: 200, height: 100, polygons: [strip] });
    // Two units side by side with a sub-grace gap → full ray inside, length < grace.
    expect(map.getConcealmentModifiersAlongRay(p(50, 50), p(50 + underGrace, 50))).toEqual([]);
  });

  it("both inside the same Short Terrain, far apart (past grace) → polygon contributes", () => {
    const stripWidth = overGrace;
    const strip = square("st", 40, 0, stripWidth, 100, "ShortTerrain");
    const map = new GameMap({ width: 200, height: 100, polygons: [strip] });
    expect(map.getConcealmentModifiersAlongRay(p(45, 50), p(45 + overGrace - 1, 50)))
      .toEqual([polygonStealthModifier.ShortTerrain]);
  });

  it("observer outside + target inside (just barely) Tall Woods → polygon contributes", () => {
    // Symmetric check to the Short Terrain target-inside test above.
    const stripWidth = overGrace;
    const woods = square("w", 40, 0, stripWidth, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    expect(map.getConcealmentModifiersAlongRay(p(10, 50), p(40 + underGrace, 50)))
      .toEqual([polygonStealthModifier.TallWoods]);
  });

  it("observer inside Short Terrain hugging the EXIT edge + target outside → grace applies, polygon does NOT contribute", () => {
    const stripWidth = overGrace;
    const exitX = 40 + stripWidth;
    const strip = square("st", 40, 0, stripWidth, 100, "ShortTerrain");
    const map = new GameMap({ width: 200, height: 100, polygons: [strip] });
    expect(map.getConcealmentModifiersAlongRay(p(exitX - underGrace, 50), p(150, 50))).toEqual([]);
  });
});
