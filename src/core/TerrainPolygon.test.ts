import { describe, expect, it } from "vitest";
import { TerrainPolygon } from "./TerrainPolygon.js";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("TerrainPolygon", () => {
  it("stores its id, vertices, and terrain type", () => {
    const tp = new TerrainPolygon({ id: "b1", vertices: square, terrainType: "Building" });
    expect(tp.id).toBe("b1");
    expect(tp.vertices).toHaveLength(4);
    expect(tp.terrainType).toBe("Building");
  });

  it("supports all polygon terrain types", () => {
    const types = ["Building", "TallWoods", "ShortTerrain"] as const;
    for (const t of types) {
      const tp = new TerrainPolygon({ id: `${t}-1`, vertices: square, terrainType: t });
      expect(tp.terrainType).toBe(t);
    }
  });

  it("rejects polygons with fewer than 3 vertices", () => {
    expect(() => new TerrainPolygon({
      id: "bad", vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], terrainType: "Building",
    })).toThrow(/at least 3 vertices/);
  });

  it("copies the input vertices array (caller mutations don't leak in)", () => {
    const verts = [...square];
    const tp = new TerrainPolygon({ id: "b1", vertices: verts, terrainType: "Building" });
    verts.push({ x: 999, y: 999 });
    expect(tp.vertices).toHaveLength(4);
  });

  it("getEdges returns N edges including the closing edge", () => {
    const tp = new TerrainPolygon({ id: "b1", vertices: square, terrainType: "Building" });
    const edges = tp.getEdges();
    expect(edges).toHaveLength(4);
    // First three edges follow the vertex pairs in order
    expect(edges[0]).toEqual({ from: { x: 0, y: 0 }, to: { x: 10, y: 0 } });
    expect(edges[1]).toEqual({ from: { x: 10, y: 0 }, to: { x: 10, y: 10 } });
    expect(edges[2]).toEqual({ from: { x: 10, y: 10 }, to: { x: 0, y: 10 } });
    // Closing edge wraps the last vertex back to the first
    expect(edges[3]).toEqual({ from: { x: 0, y: 10 }, to: { x: 0, y: 0 } });
  });

  it("containsPoint identifies points inside and outside the polygon", () => {
    const tp = new TerrainPolygon({ id: "b1", vertices: square, terrainType: "Building" });
    expect(tp.containsPoint({ x: 5, y: 5 })).toBe(true);
    expect(tp.containsPoint({ x: 50, y: 50 })).toBe(false);
  });
});
