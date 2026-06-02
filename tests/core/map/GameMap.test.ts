import { describe, expect, it } from "vitest";
import { GameMap } from "../../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../../src/core/map/TerrainPolygon.js";
import { TerrainWall } from "../../../src/core/map/TerrainWall.js";
import { getRules } from "../../../src/core/rules.js";
import type { Point } from "../../../src/core/types.js";
import { wwiiTerrainCatalog } from "../../../src/rulesets/wwii/engine/terrain.js";

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
    expect(map.isRayBlocked(p(0, 0), p(50, 50), wwiiTerrainCatalog)).toBe(false);
  });

  it("a Tall wall blocks a ray that crosses it", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Tall" });
    const map = new GameMap({ width: 100, height: 100, walls: [wall] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50), wwiiTerrainCatalog)).toBe(true);
    expect(map.isRayBlocked(p(10, 50), p(40, 50), wwiiTerrainCatalog)).toBe(false);
  });

  it("a Short wall does NOT block a ray (it conceals only)", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Short" });
    const map = new GameMap({ width: 100, height: 100, walls: [wall] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50), wwiiTerrainCatalog)).toBe(false);
  });

  it("a Building blocks a ray that crosses ≥ 2 of its edges", () => {
    const building = square("b", 40, 40, 20, 20, "Building");
    const map = new GameMap({ width: 100, height: 100, polygons: [building] });
    // ray passes all the way through: enters left edge, exits right edge
    expect(map.isRayBlocked(p(10, 50), p(90, 50), wwiiTerrainCatalog)).toBe(true);
    // ray ends inside the building: only crosses 1 edge
    expect(map.isRayBlocked(p(10, 50), p(50, 50), wwiiTerrainCatalog)).toBe(false);
    // ray entirely outside the building
    expect(map.isRayBlocked(p(10, 10), p(30, 10), wwiiTerrainCatalog)).toBe(false);
  });

  it("Tall woods blocks a ray that travels more than the configured limit through it", () => {
    // Strip wider than the limit; ray going fully across is blocked.
    const width = getRules().tallWoodsRayThroughLimit + 1;
    const woods = square("w", 40, 0, width, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50), wwiiTerrainCatalog)).toBe(true);
  });

  it("Tall woods does NOT block a ray whose inside-portion is within the configured limit", () => {
    // Strip narrower than the limit; ray going fully across is NOT blocked.
    const width = Math.max(0.5, getRules().tallWoodsRayThroughLimit - 0.5);
    const woods = square("w", 40, 0, width, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    expect(map.isRayBlocked(p(10, 50), p(90, 50), wwiiTerrainCatalog)).toBe(false);
  });

  it("Short terrain never blocks a ray", () => {
    const wheat = square("wh", 0, 0, 100, 100, "ShortTerrain");
    const map = new GameMap({ width: 100, height: 100, polygons: [wheat] });
    expect(map.isRayBlocked(p(10, 10), p(90, 90), wwiiTerrainCatalog)).toBe(false);
  });
});

// Note: the GameMap.getConcealmentModifiersAlongRay tests that lived
// here through V1 / early Phase B were dropped with the
// terrain-catalog R3 split (Phase B 2d follow-up). The method went
// away when VisionCalculator started building readings through the
// WWII terrainContributor directly. Coverage of the underlying
// concealment behavior (single-highest pooling, asymmetric edge
// grace) now lives in:
//   - tests/rulesets/wwii/engine/vision/contributors.test.ts
//   - tests/core/VisionCalculator.test.ts
//   - tests/core/VisionCalculator.readApi.test.ts
//
// describe("GameMap.getConcealmentModifiersAlongRay", () => { ... }) — removed
