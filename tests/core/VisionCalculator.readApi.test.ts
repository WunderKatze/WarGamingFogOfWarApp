import { describe, expect, it } from "vitest";
import { GameMap } from "../../src/core/map/GameMap.js";
import { TerrainPolygon } from "../../src/core/map/TerrainPolygon.js";
import { Infantry } from "../../src/rulesets/wwii/engine/units/Infantry.js";
import { Tank } from "../../src/rulesets/wwii/engine/units/Tank.js";
import { VisionCalculator } from "../../src/core/VisionCalculator.js";
import { freePositionInches } from "../../src/rulesets/wwii/engine/substrate.js";
import { wwiiTerrainCatalog } from "../../src/rulesets/wwii/engine/terrain.js";
import { wwiiVisionConfig } from "../../src/rulesets/wwii/engine/vision.js";

/**
 * Tests for the R4 public read API on VisionCalculator
 * (effectiveStealth + detectionRange).
 *
 * Phase B 2b-iii: these methods are how the UI now consumes
 * vision-pipeline intermediate values instead of re-deriving them
 * (closes B7 in code-health-pass-ui.md). The existing 26
 * VisionCalculator tests cover discover's behavior via the pipeline;
 * this file pins the read API specifically.
 */

const tankAt = (id: string, x: number, y: number, opts: { recon?: boolean } = {}) =>
  new Tank({
    id,
    name: id,
    teamId: "A",
    position: { x, y },
    ...(opts.recon && { modifiers: ["Recon"] }),
  });

const infantryAt = (id: string, x: number, y: number, opts: { dugIn?: boolean; gtg?: boolean } = {}) =>
  new Infantry({
    id,
    name: id,
    teamId: "A",
    position: { x, y },
    ...(opts.dugIn !== undefined && { dugIn: opts.dugIn }),
    ...(opts.gtg !== undefined && { goneToGround: opts.gtg }),
  });

const emptyMap = (): GameMap => new GameMap({ width: 1000, height: 1000 });

const woodsMap = (): GameMap =>
  new GameMap({
    width: 1000,
    height: 100,
    polygons: [
      new TerrainPolygon({
        id: "w",
        terrainType: "TallWoods",
        vertices: [
          { x: 200, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 100 }, { x: 200, y: 100 },
        ],
      }),
    ],
  });

const makeVC = (map = emptyMap()) =>
  new VisionCalculator(map, wwiiVisionConfig, freePositionInches, wwiiTerrainCatalog);

describe("VisionCalculator.effectiveStealth — with observer (ray-based)", () => {
  it("returns value 1 + empty breakdown for a Tank in the open with no observer concerns", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0);
    const result = vc.effectiveStealth(tankAt("t", 100, 0), { x: 100, y: 0 }, observer);
    expect(result).toEqual({ value: 1, breakdown: [] });
  });

  it("breakdown includes intrinsic when Infantry (base 4/3)", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0);
    const result = vc.effectiveStealth(infantryAt("t", 100, 0), { x: 100, y: 0 }, observer);
    expect(result.value).toBeCloseTo(4 / 3, 10);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]?.contributorId).toBe("intrinsic");
  });

  it("ray through Tall Woods adds a terrain reading to the breakdown", () => {
    const vc = makeVC(woodsMap());
    const observer = tankAt("o", 0, 50);
    const result = vc.effectiveStealth(tankAt("t", 999, 50), { x: 999, y: 50 }, observer);
    expect(result.value).toBe(3);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]?.label).toBe("Tall Woods");
  });

  it("dug-in Infantry inside Tall Woods with GtG: intrinsic × pool(woods=3) × gtg(2)", () => {
    const vc = makeVC(woodsMap());
    const observer = tankAt("o", 0, 50);
    // Position the unit inside the woods polygon, ray comes from outside
    const target = infantryAt("t", 500, 50, { dugIn: true, gtg: true });
    const result = vc.effectiveStealth(target, { x: 500, y: 50 }, observer);
    // Pool: max(dugIn=2, woods=3) = 3; gtg stacks → 6; intrinsic 4/3 → 8.
    expect(result.value).toBeCloseTo((4 / 3) * 3 * 2, 10);
    // Breakdown: intrinsic, woods (pool winner — dug-in loses), gtg.
    expect(result.breakdown.map((b) => b.contributorId)).toEqual([
      "intrinsic", "terrain", "gone-to-ground",
    ]);
  });
});

describe("VisionCalculator.effectiveStealth — without observer (position-only)", () => {
  it("polygons containing the position contribute; walls drop out", () => {
    const vc = makeVC(woodsMap());
    // Position inside the woods, no observer.
    const result = vc.effectiveStealth(tankAt("t", 500, 50), { x: 500, y: 50 });
    expect(result.value).toBe(3);
    expect(result.breakdown[0]?.label).toBe("Tall Woods");
  });

  it("position outside any polygon: no terrain contribution", () => {
    const vc = makeVC(woodsMap());
    const result = vc.effectiveStealth(tankAt("t", 100, 50), { x: 100, y: 50 });
    expect(result.value).toBe(1);
    expect(result.breakdown).toEqual([]);
  });

  it("includes intrinsic + inherent + GtG even without an observer", () => {
    const vc = makeVC(woodsMap());
    const target = infantryAt("t", 500, 50, { dugIn: true, gtg: true });
    const result = vc.effectiveStealth(target, { x: 500, y: 50 });
    // Pool: max(dugIn=2, woods=3) = 3; gtg stacks → 6; intrinsic 4/3.
    expect(result.value).toBeCloseTo((4 / 3) * 3 * 2, 10);
  });

  it("GtG without external concealment: pool stays 1, GtG drops, only intrinsic counts", () => {
    // GtG only stacks when the external pool > 1. Without observer or
    // terrain, a GtG Tank in the open contributes nothing.
    const vc = makeVC();
    const result = vc.effectiveStealth(tankAt("t", 0, 0, {}), { x: 0, y: 0 });
    expect(result.value).toBe(1);
  });
});

describe("VisionCalculator.detectionRange", () => {
  it("equals observer.vision / target.effective_stealth (the §4 formula)", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0); // Tank vision 64
    const target = tankAt("t", 100, 0); // Tank intrinsic 1
    expect(vc.detectionRange(observer, target)).toBe(64);
  });

  it("shrinks for higher-stealth targets (Infantry intrinsic 4/3 → 64 / (4/3) = 48)", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0);
    const target = infantryAt("t", 100, 0);
    expect(vc.detectionRange(observer, target)).toBeCloseTo(64 / (4 / 3), 10);
  });

  it("grows for higher-vision observers (Recon Tank vision = 64 × 4/3)", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0, { recon: true });
    const target = tankAt("t", 100, 0);
    expect(vc.detectionRange(observer, target)).toBeCloseTo(64 * (4 / 3), 10);
  });

  it("matches discover's threshold: at exactly the range, discover succeeds", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0);
    const range = vc.detectionRange(observer, tankAt("t", 0, 0));
    // Place target exactly at the threshold; discover should be true.
    const target = tankAt("t", range, 0);
    expect(vc.discover(observer, target)).toBe(true);
  });

  it("just beyond the range, discover fails", () => {
    const vc = makeVC();
    const observer = tankAt("o", 0, 0);
    const range = vc.detectionRange(observer, tankAt("t", 0, 0));
    const target = tankAt("t", range + 0.001, 0);
    expect(vc.discover(observer, target)).toBe(false);
  });
});
