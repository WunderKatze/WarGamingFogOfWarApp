import { describe, expect, it } from "vitest";
import { TerrainWall } from "../../../src/core/map/TerrainWall.js";

describe("TerrainWall", () => {
  it("stores its id, endpoints, and wall type", () => {
    const w = new TerrainWall({
      id: "w1",
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 },
      wallType: "Tall",
    });
    expect(w.id).toBe("w1");
    expect(w.from).toEqual({ x: 0, y: 0 });
    expect(w.to).toEqual({ x: 10, y: 0 });
    expect(w.wallType).toBe("Tall");
  });

  it("supports both Short and Tall wall types", () => {
    const tall = new TerrainWall({ id: "t", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, wallType: "Tall" });
    const short = new TerrainWall({ id: "s", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, wallType: "Short" });
    expect(tall.wallType).toBe("Tall");
    expect(short.wallType).toBe("Short");
  });
});
