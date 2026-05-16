import { describe, expect, it } from "vitest";
import { GameMap } from "../../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../../src/core/map/TerrainPolygon.js";
import { TerrainWall } from "../../../src/core/map/TerrainWall.js";
import {
  emptyWorkingMap,
  fromGameMap,
  parseWorkingMap,
  serializeWorkingMap,
  toGameMap,
} from "../../../src/core/map/WorkingMap.js";

const sampleMap = () =>
  new GameMap({
    width: 96,
    height: 60,
    polygons: [
      new TerrainPolygon({
        id: "b1",
        terrainType: "Building",
        vertices: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
        ],
      }),
      new TerrainPolygon({
        id: "tw1",
        terrainType: "TallWoods",
        vertices: [
          { x: 40, y: 30 },
          { x: 55, y: 28 },
          { x: 60, y: 45 },
          { x: 42, y: 48 },
        ],
      }),
    ],
    walls: [
      new TerrainWall({
        id: "w1",
        from: { x: 5, y: 5 },
        to: { x: 5, y: 20 },
        wallType: "Tall",
      }),
      new TerrainWall({
        id: "w2",
        from: { x: 30, y: 5 },
        to: { x: 45, y: 5 },
        wallType: "Short",
      }),
    ],
  });

describe("WorkingMap — round-trips", () => {
  it("fromGameMap captures dimensions, polygons, and walls", () => {
    const wm = fromGameMap(sampleMap());
    expect(wm.width).toBe(96);
    expect(wm.height).toBe(60);
    expect(wm.polygons).toHaveLength(2);
    expect(wm.walls).toHaveLength(2);
    expect(wm.polygons[0]?.terrainType).toBe("Building");
    expect(wm.walls[1]?.wallType).toBe("Short");
  });

  it("fromGameMap deep-copies vertices and endpoints (no shared references)", () => {
    const original = sampleMap();
    const wm = fromGameMap(original);
    // Each Point object in the working copy is its own allocation, not a
    // reference back into the GameMap. Values equal, identity distinct.
    expect(wm.polygons[0]?.vertices[0]).not.toBe(original.polygons[0]?.vertices[0]);
    expect(wm.walls[0]?.from).not.toBe(original.walls[0]?.from);
    expect(wm.walls[0]?.from).toEqual(original.walls[0]?.from);
  });

  it("toGameMap reconstructs a GameMap with equivalent fields", () => {
    const wm = fromGameMap(sampleMap());
    const restored = toGameMap(wm);
    expect(restored.width).toBe(96);
    expect(restored.height).toBe(60);
    expect(restored.polygons[0]?.terrainType).toBe("Building");
    expect(restored.polygons[0]?.vertices).toHaveLength(4);
    expect(restored.walls[0]?.wallType).toBe("Tall");
  });

  it("GameMap → WorkingMap → JSON → WorkingMap → GameMap preserves shape", () => {
    const original = sampleMap();
    const wm1 = fromGameMap(original);
    const json = serializeWorkingMap(wm1);
    const wm2 = parseWorkingMap(json);
    expect(wm2).not.toBeNull();
    const restored = toGameMap(wm2!);
    expect(restored.width).toBe(original.width);
    expect(restored.height).toBe(original.height);
    expect(restored.polygons.length).toBe(original.polygons.length);
    expect(restored.walls.length).toBe(original.walls.length);
    // sanity: stealth math still works the same on the round-tripped map
    expect(
      restored.getConcealmentModifiersAlongRay({ x: 15, y: 15 }, { x: 15, y: 15 }),
    ).toEqual(
      original.getConcealmentModifiersAlongRay({ x: 15, y: 15 }, { x: 15, y: 15 }),
    );
  });
});

describe("WorkingMap — emptyWorkingMap", () => {
  it("creates a blank map with no terrain", () => {
    const wm = emptyWorkingMap(48, 48);
    expect(wm.width).toBe(48);
    expect(wm.height).toBe(48);
    expect(wm.polygons).toEqual([]);
    expect(wm.walls).toEqual([]);
  });
});

describe("WorkingMap — parseWorkingMap shape validation", () => {
  it("returns null for non-JSON input", () => {
    expect(parseWorkingMap("not json")).toBeNull();
  });

  it("returns null for an array (not an object)", () => {
    expect(parseWorkingMap("[]")).toBeNull();
  });

  it("returns null when width is missing or non-positive", () => {
    expect(parseWorkingMap('{"height":1,"polygons":[],"walls":[]}')).toBeNull();
    expect(parseWorkingMap('{"width":0,"height":1,"polygons":[],"walls":[]}')).toBeNull();
    expect(parseWorkingMap('{"width":-1,"height":1,"polygons":[],"walls":[]}')).toBeNull();
  });

  it("returns null when polygons or walls is missing or not an array", () => {
    expect(parseWorkingMap('{"width":1,"height":1,"walls":[]}')).toBeNull();
    expect(parseWorkingMap('{"width":1,"height":1,"polygons":[]}')).toBeNull();
    expect(parseWorkingMap('{"width":1,"height":1,"polygons":"x","walls":[]}')).toBeNull();
  });

  it("ignores unknown extra top-level keys", () => {
    const json = JSON.stringify({
      width: 10,
      height: 10,
      polygons: [],
      walls: [],
      futureFeature: { ignored: true },
    });
    const wm = parseWorkingMap(json);
    expect(wm).not.toBeNull();
    expect(wm?.width).toBe(10);
  });
});
