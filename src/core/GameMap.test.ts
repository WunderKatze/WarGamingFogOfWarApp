import { describe, expect, it } from "vitest";
import {
  polygonStealthModifier,
  shortWallStealthModifier,
} from "./config.js";
import { GameMap } from "./GameMap.js";
import { TerrainPolygon } from "./TerrainPolygon.js";
import { TerrainWall } from "./TerrainWall.js";
import type { Point } from "./types.js";

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
    // 20" wide woods; ray going through > 4" inside is blocked
    const woods = square("w", 40, 0, 20, 100, "TallWoods");
    const map = new GameMap({ width: 100, height: 100, polygons: [woods] });
    // 20" through the woods: blocked
    expect(map.isRayBlocked(p(10, 50), p(90, 50))).toBe(true);
  });

  it("Tall woods does NOT block a ray that grazes <= 4 inches through it", () => {
    // narrow strip of woods 3" wide
    const woods = square("w", 40, 0, 3, 100, "TallWoods");
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
});
