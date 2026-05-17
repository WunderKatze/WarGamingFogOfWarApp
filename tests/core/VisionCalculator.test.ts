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
import type { Point, TeamId, UnitId } from "../../src/core/types.js";
import { VisionCalculator } from "../../src/core/VisionCalculator.js";
import { createEmptyVisionState, type VisionState } from "../../src/core/VisionState.js";

const p = (x: number, y: number): Point => ({ x, y });

const tankAt = (id: string, pos: Point, teamId = "A") =>
  new Tank({ id, name: id, teamId, position: pos });
const reconTankAt = (id: string, pos: Point, teamId = "A") =>
  new Tank({ id, name: id, teamId, position: pos, modifiers: ["Recon"] });
const infantryAt = (id: string, pos: Point, dugIn = false, teamId = "A") =>
  new Infantry({ id, name: id, teamId, position: pos, dugIn });

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

// --- runVisionPhase ---

const sortedArr = (s: ReadonlySet<UnitId>): UnitId[] => [...s].sort();

const expectIndividual = (state: VisionState, observerId: UnitId, expected: UnitId[]) => {
  const list = state.individualLists.get(observerId) ?? new Set<UnitId>();
  expect(sortedArr(list)).toEqual([...expected].sort());
};

const expectTeam = (state: VisionState, teamId: TeamId, expected: UnitId[]) => {
  const list = state.teamLists.get(teamId) ?? new Set<UnitId>();
  expect(sortedArr(list)).toEqual([...expected].sort());
};

const expectRevealed = (state: VisionState, expected: UnitId[]) => {
  expect(sortedArr(state.revealed)).toEqual([...expected].sort());
};

describe("VisionCalculator.runVisionPhase — first turn (empty state)", () => {
  it("two close enemy tanks mutually discover and both become Revealed", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const a = tankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(40, 0), "B");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a, b], new Set());

    expectIndividual(state, "A1", ["B1"]);
    expectIndividual(state, "B1", ["A1"]);
    expectTeam(state, "A", ["B1"]);
    expectTeam(state, "B", ["A1"]);
    expectRevealed(state, ["A1", "B1"]);
  });

  it("asymmetric vision: a recon tank detects a regular tank but is not detected back", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    // Recon tank's vision range = 64; recon tank's intrinsic stealth = 4/3, so
    // a regular tank's range against it = 48 / (4/3) = 36. Place them at distance 50:
    // recon detects (50 ≤ 64), regular tank cannot (50 > 36).
    const a = reconTankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(50, 0), "B");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a, b], new Set());

    expectIndividual(state, "A1", ["B1"]);
    expectIndividual(state, "B1", []);
    expectRevealed(state, []);
  });
});

describe("VisionCalculator.runVisionPhase — step 5 See branch (team list dispenses with Discover)", () => {
  it("a teammate too far to Discover can still See an already-detected enemy", () => {
    // A1 is close enough to Discover B1. A2 is far beyond Discover range,
    // but has clear line of sight. Once B1 enters Team A's team list (via A1),
    // A2 should add B1 to its own individual list via See alone.
    const vc = new VisionCalculator(new GameMap({ width: 5000, height: 100 }));
    const a1 = tankAt("A1", p(0, 0), "A");
    const a2 = tankAt("A2", p(2000, 0), "A");
    const b1 = tankAt("B1", p(40, 0), "B");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a1, a2, b1], new Set());

    expectIndividual(state, "A1", ["B1"]);
    expectIndividual(state, "A2", ["B1"]); // via See, despite being far past discover range
    expectTeam(state, "A", ["B1"]);
  });
});

describe("VisionCalculator.runVisionPhase — step 2 lost-sight removal", () => {
  it("an enemy that becomes blocked by terrain is removed from the individual list", () => {
    const wall = new TerrainWall({ id: "w", from: p(20, -10), to: p(20, 10), wallType: "Tall" });
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100, walls: [wall] }));
    const a = tankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(40, 0), "B");
    // Pre-existing carry-over state: A1 had detected B1 last turn (before the wall existed)
    const state = createEmptyVisionState();
    state.individualLists.set("A1", new Set(["B1"]));
    state.individualLists.set("B1", new Set(["A1"]));

    vc.runVisionPhase(state, [a, b], new Set());

    expectIndividual(state, "A1", []);
    expectIndividual(state, "B1", []);
  });
});

describe("VisionCalculator.runVisionPhase — step 4 unreveal", () => {
  it("a Revealed unit no enemy can See becomes unrevealed", () => {
    const wall = new TerrainWall({ id: "w", from: p(20, -10), to: p(20, 10), wallType: "Tall" });
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100, walls: [wall] }));
    const a = tankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(40, 0), "B");
    // B1 was Revealed last turn, but can no longer be Seen by any enemy (wall in the way)
    const state = createEmptyVisionState();
    state.revealed.add("B1");

    vc.runVisionPhase(state, [a, b], new Set());

    expect(state.revealed.has("B1")).toBe(false);
  });

  it("a Revealed unit at least one enemy can See remains Revealed", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const a = tankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(40, 0), "B");
    const state = createEmptyVisionState();
    state.revealed.add("B1");

    vc.runVisionPhase(state, [a, b], new Set());

    expect(state.revealed.has("B1")).toBe(true);
  });
});

describe("VisionCalculator.runVisionPhase — step 7 fire actions", () => {
  it("a unit that fired this turn becomes Revealed even if no enemy can See it", () => {
    const wall = new TerrainWall({ id: "w", from: p(20, -10), to: p(20, 10), wallType: "Tall" });
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100, walls: [wall] }));
    const a = tankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(40, 0), "B");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a, b], new Set(["A1"]));

    expect(state.revealed.has("A1")).toBe(true);
    // B1 not revealed — neither side can see the other, no mutual, no fire by B1
    expect(state.revealed.has("B1")).toBe(false);
  });

  it("ignores fired ids that don't correspond to any current unit", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const a = tankAt("A1", p(0, 0), "A");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a], new Set(["ghost-id"]));

    expectRevealed(state, []);
  });
});

describe("VisionCalculator.runVisionPhase — step 9 cascade (fire → See addition → mutual reveal)", () => {
  it("a fired recon tank becomes Revealed, which lets the enemy add it via See, triggering mutual reveal of the enemy too", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 1000 }));
    // Setup: recon A1 can Discover B1 (one-way detection). Distance 50:
    //   A1 → B1: 50 ≤ 64 ✓
    //   B1 → A1: 50 ≤ 36 ✗
    // Then A1 fires. Expected cascade:
    //   1. fire reveals A1
    //   2. team B's team list expands with A1
    //   3. step 5 sees that A1 is on B1's team list → uses See instead of Discover → adds A1
    //   4. step 8 sees mutual (A1↔B1 in each other's individual lists) → both revealed
    const a = reconTankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(50, 0), "B");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a, b], new Set(["A1"]));

    expectIndividual(state, "A1", ["B1"]);
    expectIndividual(state, "B1", ["A1"]);
    expectRevealed(state, ["A1", "B1"]);
  });
});

describe("VisionCalculator.runVisionPhase — carry-over", () => {
  it("preserves stable detections and reveals across consecutive vision phases", () => {
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const a = tankAt("A1", p(0, 0), "A");
    const b = tankAt("B1", p(40, 0), "B");
    const state = createEmptyVisionState();

    vc.runVisionPhase(state, [a, b], new Set());
    const firstIndividualA = new Set(state.individualLists.get("A1"));
    const firstRevealed = new Set(state.revealed);

    // Run again with no changes — state should remain stable
    vc.runVisionPhase(state, [a, b], new Set());

    expect(state.individualLists.get("A1")).toEqual(firstIndividualA);
    expect(state.revealed).toEqual(firstRevealed);
  });
});

describe("VisionCalculator — Gone to Ground", () => {
  // A 30"-wide Short Terrain strip from x=10 to x=40. Short Terrain never
  // blocks sight (so we rely on discover, not see) and its stealth
  // multiplier is 2. Tank intrinsic stealth = 1, vision = 48.
  // Observer at (0, 50), target at (18, 50): ray crosses 8" of short
  // terrain (well past the 2" grace), target inside the polygon.
  //   Without GtG: range = 48 / 2     = 24" → 18" detected.
  //   With    GtG: range = 48 / (2*2) = 12" → 18" NOT detected.
  const coverMap = () => {
    const strip = square("st", 10, 0, 30, 100, "ShortTerrain");
    return new GameMap({ width: 1000, height: 100, polygons: [strip] });
  };

  it("stacks GtG on top of the single-highest terrain mod when target is concealed", () => {
    const vc = new VisionCalculator(coverMap());
    const observer = tankAt("A1", p(0, 50), "A");
    const target = tankAt("B1", p(18, 50), "B");

    // Baseline: target NOT gone to ground → no GtG → A discovers B at 18".
    target.goneToGround = false;
    const baseState = createEmptyVisionState();
    vc.runVisionPhase(baseState, [observer, target], new Set());
    expectIndividual(baseState, "A1", ["B1"]);

    // With B gone to ground → GtG stacks (target is concealed by the strip)
    // → stealth doubles to ×4 → A does NOT discover B at 18".
    target.goneToGround = true;
    const gtgState = createEmptyVisionState();
    vc.runVisionPhase(gtgState, [observer, target], new Set());
    expectIndividual(gtgState, "A1", []);
  });

  it("does NOT apply GtG when the target is in the open (no concealment for this ray)", () => {
    // No cover map; target in the open. Even with goneToGround=true, no
    // per-ray concealment exists, so GtG must not stack.
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const observer = tankAt("A1", p(0, 50), "A");
    const target = tankAt("B1", p(40, 50), "B");
    target.goneToGround = true;

    const state = createEmptyVisionState();
    vc.runVisionPhase(state, [observer, target], new Set());
    expectIndividual(state, "A1", ["B1"]);
  });

  it("dug-in inherent concealment counts as cover for GtG stacking", () => {
    // Open map, target is dug-in Infantry. Inherent concealment >1, so the
    // discover ray is "concealed" → GtG should stack.
    // Infantry vision = 48, intrinsic stealth = 4/3, dug-in = 2.
    // Without GtG: range = 48 / (4/3 × 2)  = 18"   → 16" detected.
    // With    GtG: range = 48 / (4/3 × 4)  = 9"    → 16" NOT detected.
    const vc = new VisionCalculator(new GameMap({ width: 1000, height: 100 }));
    const observer = tankAt("A1", p(0, 50), "A");
    const target = infantryAt("B1", p(16, 50), /* dugIn */ true, "B");

    target.goneToGround = false;
    const baseState = createEmptyVisionState();
    vc.runVisionPhase(baseState, [observer, target], new Set());
    expectIndividual(baseState, "A1", ["B1"]);

    target.goneToGround = true;
    const gtgState = createEmptyVisionState();
    vc.runVisionPhase(gtgState, [observer, target], new Set());
    expectIndividual(gtgState, "A1", []);
  });
});
