import { describe, expect, it } from "vitest";
import {
  dugInStealthModifier,
  modifierEffects,
  polygonStealthModifier,
  unitTypeStats,
} from "../../src/core/config.js";
import { GameMap } from "../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../src/core/map/TerrainPolygon.js";
import { TerrainWall } from "../../src/core/map/TerrainWall.js";
import { Infantry } from "../../src/core/units/Infantry.js";
import { Tank } from "../../src/core/units/Tank.js";
import type { Point } from "../../src/core/types.js";
import { VisionCalculator } from "../../src/core/VisionCalculator.js";

const p = (x: number, y: number): Point => ({ x, y });

const tankAt = (id: string, pos: Point) =>
  new Tank({ id, name: id, position: pos });
const reconTankAt = (id: string, pos: Point) =>
  new Tank({ id, name: id, position: pos, modifiers: ["Recon"] });
const infantryAt = (id: string, pos: Point, dugIn = false) =>
  new Infantry({ id, name: id, position: pos, dugIn });

const square = (id: string, x: number, y: number, w: number, h: number, terrainType: "Building" | "TallWoods" | "ShortTerrain") =>
  new TerrainPolygon({
    id,
    vertices: [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)],
    terrainType,
  });

describe("VisionCalculator.see", () => {
  it("returns true on an empty map regardless of distance", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 1000 }));
    const a = tankAt("a", p(0, 0));
    const b = tankAt("b", p(900, 900));
    expect(vc.see(a, b)).toBe(true);
  });

  it("returns false when a tall wall is between the units", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Tall" });
    const vc = new VisionCalculator(new GameMap({ width: 100, height: 100, walls: [wall] }));
    const a = tankAt("a", p(10, 50));
    const b = tankAt("b", p(90, 50));
    expect(vc.see(a, b)).toBe(false);
  });

  it("returns true when only a short wall is between the units", () => {
    const wall = new TerrainWall({ id: "w", from: p(50, 0), to: p(50, 100), wallType: "Short" });
    const vc = new VisionCalculator(new GameMap({ width: 100, height: 100, walls: [wall] }));
    const a = tankAt("a", p(10, 50));
    const b = tankAt("b", p(90, 50));
    expect(vc.see(a, b)).toBe(true);
  });

  it("returns false when a building blocks the ray (≥ 2 edges crossed)", () => {
    const building = square("b", 40, 40, 20, 20, "Building");
    const vc = new VisionCalculator(new GameMap({ width: 100, height: 100, polygons: [building] }));
    const a = tankAt("a", p(10, 50));
    const b = tankAt("b", p(90, 50));
    expect(vc.see(a, b)).toBe(false);
  });
});

describe("VisionCalculator.discover", () => {
  it("returns false whenever see() is false, regardless of distance", () => {
    const wall = new TerrainWall({ id: "w", from: p(5, 0), to: p(5, 10), wallType: "Tall" });
    const vc = new VisionCalculator(new GameMap({ width: 20, height: 20, walls: [wall] }));
    const a = tankAt("a", p(2, 5));
    const b = tankAt("b", p(8, 5));
    expect(vc.see(a, b)).toBe(false);
    expect(vc.discover(a, b)).toBe(false);
  });

  it("a tank exactly at vision range can be discovered (≤, inclusive)", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const observer = tankAt("o", p(0, 0));
    const target = tankAt("t", p(unitTypeStats.Tank.baseVision, 0));
    expect(vc.discover(observer, target)).toBe(true);
  });

  it("a tank just beyond vision range cannot be discovered", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const observer = tankAt("o", p(0, 0));
    const target = tankAt("t", p(unitTypeStats.Tank.baseVision + 0.01, 0));
    expect(vc.discover(observer, target)).toBe(false);
  });

  it("Recon extends the observer's effective vision range by its multiplier", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const baseRange = unitTypeStats.Tank.baseVision; // tank vs tank → effective_stealth = 1
    const observer = reconTankAt("o", p(0, 0));
    // Just inside the extended range
    const inside = tankAt("ti", p(baseRange * modifierEffects.Recon.visionMultiplier - 0.01, 0));
    expect(vc.discover(observer, inside)).toBe(true);
    // Just outside the extended range
    const outside = tankAt("to", p(baseRange * modifierEffects.Recon.visionMultiplier + 0.01, 0));
    expect(vc.discover(observer, outside)).toBe(false);
  });

  it("an infantry target has shorter discovery range than a tank (higher base stealth)", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const observer = tankAt("o", p(0, 0));
    const baseRange = unitTypeStats.Tank.baseVision;
    const infantryRange = baseRange / unitTypeStats.Infantry.baseStealth;
    // Infantry at the threshold of the reduced range can be discovered
    const inf = infantryAt("inf", p(infantryRange, 0));
    expect(vc.discover(observer, inf)).toBe(true);
    // One step further — discoverable falls off
    const farInf = infantryAt("far", p(infantryRange + 0.01, 0));
    expect(vc.discover(observer, farInf)).toBe(false);
  });

  it("a dug-in infantry target has further reduced discovery range (its inherent concealment applies)", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const observer = tankAt("o", p(0, 0));
    const baseRange = unitTypeStats.Tank.baseVision;
    // Dug-in infantry: effective_stealth = baseStealth × dugInModifier
    const dugInRange = baseRange / (unitTypeStats.Infantry.baseStealth * dugInStealthModifier);
    const dug = infantryAt("dug", p(dugInRange, 0), true);
    expect(vc.discover(observer, dug)).toBe(true);
    const farDug = infantryAt("farDug", p(dugInRange + 0.01, 0), true);
    expect(vc.discover(observer, farDug)).toBe(false);
  });

  it("terrain stealth applies when the ray passes through concealing polygons", () => {
    // Thin strip of tall woods between observer and target (3" wide < 4" block threshold)
    const thinWoods = square("w", 4, 0, 3, 100, "TallWoods");
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100, polygons: [thinWoods] }));
    const observer = tankAt("o", p(0, 50));
    const baseRange = unitTypeStats.Tank.baseVision;
    // Effective stealth = tank base (1) × tallWoods modifier (3) → range / 3
    const reducedRange = baseRange / polygonStealthModifier.TallWoods;
    const target = tankAt("t", p(reducedRange, 50));
    expect(vc.discover(observer, target)).toBe(true);
    const farTarget = tankAt("ft", p(reducedRange + 0.01, 50));
    expect(vc.discover(observer, farTarget)).toBe(false);
  });

  it("modifiers do NOT stack — only the single highest applies", () => {
    // Dug-in infantry (2x) inside a building (3x): effective stealth uses 3x, not 6x.
    // expectedRange = 48 / ((4/3) × 3) = 12 — building must contain the target at x=12.
    const building = square("b", 5, 0, 20, 100, "Building");
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100, polygons: [building] }));
    const observer = tankAt("o", p(0, 50));
    const baseRange = unitTypeStats.Tank.baseVision;
    const expectedHighest = Math.max(dugInStealthModifier, polygonStealthModifier.Building);
    const expectedRange = baseRange / (unitTypeStats.Infantry.baseStealth * expectedHighest);
    const dugInside = infantryAt("dugIn", p(expectedRange, 50), true);
    expect(building.containsPoint(dugInside.getPosition())).toBe(true);
    expect(vc.discover(observer, dugInside)).toBe(true);
    // If modifiers stacked (would be 6x → range 6), the unit at distance 12 would be undiscoverable.
    // It IS discoverable, confirming the highest single applies. Just past the threshold fails:
    const justFar = infantryAt("justFar", p(expectedRange + 0.01, 50), true);
    expect(vc.discover(observer, justFar)).toBe(false);
  });

  it("building stealth modifier applies when the target is inside the building", () => {
    // Building must contain the target. reducedRange = 48 / 3 = 16. Building x=5..30 contains x=16.
    const building = square("b", 5, 0, 25, 100, "Building");
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100, polygons: [building] }));
    const observer = tankAt("o", p(0, 50));
    const baseRange = unitTypeStats.Tank.baseVision;
    const reducedRange = baseRange / polygonStealthModifier.Building;
    const target = tankAt("t", p(reducedRange, 50));
    expect(building.containsPoint(target.getPosition())).toBe(true);
    expect(vc.discover(observer, target)).toBe(true);
    const farTarget = tankAt("ft", p(reducedRange + 0.01, 50));
    expect(building.containsPoint(farTarget.getPosition())).toBe(true);
    expect(vc.discover(observer, farTarget)).toBe(false);
  });
});
