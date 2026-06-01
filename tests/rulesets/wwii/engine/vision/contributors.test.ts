import { describe, expect, it } from "vitest";
import { GameMap } from "../../../../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../../../../src/core/map/TerrainPolygon.js";
import { TerrainWall } from "../../../../../src/core/map/TerrainWall.js";
import { Infantry } from "../../../../../src/core/units/Infantry.js";
import { Tank } from "../../../../../src/core/units/Tank.js";
import type { Unit } from "../../../../../src/core/units/Unit.js";
import { goneToGroundContributor } from "../../../../../src/rulesets/wwii/engine/vision/contributors/goneToGround.js";
import { inherentContributor } from "../../../../../src/rulesets/wwii/engine/vision/contributors/inherent.js";
import { intrinsicContributor } from "../../../../../src/rulesets/wwii/engine/vision/contributors/intrinsic.js";
import { terrainContributor } from "../../../../../src/rulesets/wwii/engine/vision/contributors/terrain.js";

/**
 * Tests for the WWII vision contributors
 * (src/rulesets/wwii/engine/vision/contributors/).
 *
 * Phase B 2b-i: each contributor produces readings the WWII
 * composition rule will route. Tests pin each contributor's
 * individual contract; composition is tested separately
 * (composition.test.ts), and end-to-end behavior comes through
 * VisionCalculator's existing 26 tests once 2b-ii wires the
 * pipeline.
 */

const emptyMap = (): GameMap => new GameMap({ width: 100, height: 100 });

const makeInfantry = (opts: Partial<{ dugIn: boolean; recon: boolean; gtg: boolean }> = {}): Infantry =>
  new Infantry({
    id: "inf1",
    teamId: "A",
    name: "Test",
    position: { x: 0, y: 0 },
    ...(opts.dugIn !== undefined && { dugIn: opts.dugIn }),
    ...(opts.recon && { modifiers: ["Recon"] }),
    ...(opts.gtg !== undefined && { goneToGround: opts.gtg }),
  });

const makeTank = (opts: Partial<{ recon: boolean; gtg: boolean }> = {}): Tank =>
  new Tank({
    id: "t1",
    teamId: "A",
    name: "Test",
    position: { x: 0, y: 0 },
    ...(opts.recon && { modifiers: ["Recon"] }),
    ...(opts.gtg !== undefined && { goneToGround: opts.gtg }),
  });

const makeObserver = (): Unit =>
  new Tank({ id: "obs", teamId: "B", name: "Obs", position: { x: 50, y: 0 } });

describe("intrinsicContributor", () => {
  it("returns Infantry's base 4/3 multiplier", () => {
    const readings = intrinsicContributor.contribute(makeInfantry(), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([
      { contributorId: "intrinsic", modifier: 4 / 3, label: "intrinsic" },
    ]);
  });

  it("returns empty for Tank (intrinsic = 1 → no contribution)", () => {
    const readings = intrinsicContributor.contribute(makeTank(), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([]);
  });

  it("Recon Infantry: base × Recon multiplier (Recon = ×1 currently → still 4/3)", () => {
    const readings = intrinsicContributor.contribute(makeInfantry({ recon: true }), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings[0]?.modifier).toBe(4 / 3);
  });

  it("does not depend on observer (works without one)", () => {
    const readings = intrinsicContributor.contribute(makeInfantry(), { x: 0, y: 0 }, emptyMap(), undefined);
    expect(readings).toHaveLength(1);
  });
});

describe("inherentContributor", () => {
  it("returns dugInStealthModifier when Infantry is dug-in, labeled 'dug in'", () => {
    const readings = inherentContributor.contribute(makeInfantry({ dugIn: true }), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([
      { contributorId: "inherent", modifier: 2, label: "dug in" },
    ]);
  });

  it("returns empty when Infantry is not dug-in", () => {
    const readings = inherentContributor.contribute(makeInfantry({ dugIn: false }), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([]);
  });

  it("returns empty for Tank (no inherent concealment)", () => {
    const readings = inherentContributor.contribute(makeTank(), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([]);
  });
});

describe("terrainContributor", () => {
  const woodsMap = (): GameMap =>
    new GameMap({
      width: 1000,
      height: 100,
      polygons: [
        new TerrainPolygon({
          id: "w1",
          terrainType: "TallWoods",
          vertices: [
            { x: 200, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 100 }, { x: 200, y: 100 },
          ],
        }),
      ],
    });

  const shortWallMap = (): GameMap =>
    new GameMap({
      width: 100,
      height: 100,
      walls: [
        new TerrainWall({ id: "sw1", from: { x: 50, y: 0 }, to: { x: 50, y: 100 }, wallType: "Short" }),
      ],
    });

  it("returns a reading per applicable terrain feature (ray through Tall Woods)", () => {
    const observer = new Tank({ id: "o", teamId: "A", name: "o", position: { x: 0, y: 50 } });
    const readings = terrainContributor.contribute(makeTank(), { x: 999, y: 50 }, woodsMap(), observer);
    expect(readings).toEqual([
      { contributorId: "terrain", modifier: 3, label: "Tall Woods" },
    ]);
  });

  it("returns empty when no terrain applies (clear shot)", () => {
    const observer = new Tank({ id: "o", teamId: "A", name: "o", position: { x: 0, y: 50 } });
    const readings = terrainContributor.contribute(makeTank(), { x: 100, y: 50 }, woodsMap(), observer);
    expect(readings).toEqual([]);
  });

  it("returns a wall reading when a short wall is crossed", () => {
    const observer = new Tank({ id: "o", teamId: "A", name: "o", position: { x: 10, y: 50 } });
    const readings = terrainContributor.contribute(makeTank(), { x: 90, y: 50 }, shortWallMap(), observer);
    expect(readings).toEqual([
      { contributorId: "terrain", modifier: 2, label: "Short Wall" },
    ]);
  });

  it("returns empty when no observer is given (ray-direction-sensitive contributor needs one)", () => {
    const readings = terrainContributor.contribute(makeTank(), { x: 999, y: 50 }, woodsMap(), undefined);
    expect(readings).toEqual([]);
  });
});

describe("goneToGroundContributor", () => {
  it("returns the configured GtG multiplier when goneToGround is true", () => {
    const readings = goneToGroundContributor.contribute(makeInfantry({ gtg: true }), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([
      { contributorId: "gone-to-ground", modifier: 2, label: "GtG" },
    ]);
  });

  it("returns empty when goneToGround is false", () => {
    const readings = goneToGroundContributor.contribute(makeInfantry({ gtg: false }), { x: 0, y: 0 }, emptyMap(), makeObserver());
    expect(readings).toEqual([]);
  });

  it("doesn't depend on concealment context (rule decides whether to apply)", () => {
    // The contributor emits whenever GtG is true; the WWII composition
    // rule is what conditions the *application* on pool > 1. See
    // composition.test.ts for that side of the contract.
    const readings = goneToGroundContributor.contribute(makeTank({ gtg: true }), { x: 0, y: 0 }, emptyMap(), undefined);
    expect(readings).toHaveLength(1);
  });
});
