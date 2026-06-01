import { afterEach, describe, expect, it } from "vitest";
import { Game } from "../../../../src/core/Game.js";
import { GameMap } from "../../../../src/core/map/GameMap.js";
import { clearRulesets, registerRuleset } from "../../../../src/core/ruleset/index.js";
import { VisionCalculator } from "../../../../src/core/VisionCalculator.js";
import { Tank } from "../../../../src/rulesets/wwii/engine/units/Tank.js";
import { testRuleset } from "../../../../src/rulesets/test-ruleset/engine/index.js";

/**
 * Phase B step 3: integration tests proving the test ruleset works
 * end-to-end with engine-core. If any of these fail, the abstraction
 * step 1 built isn't actually per-ruleset configurable — it's
 * WWII-shaped wrapping pretending to be generic.
 *
 * Each test exercises one axis's variation:
 *   - Registry/spine: testRuleset registers without throwing.
 *   - Axis 1: testGameFlow validates + drives a Game's state
 *     transitions.
 *   - Axis 2: testVisionConfig's contributors run and sumComposition
 *     produces values demonstrably different from WWII's pipeline.
 *   - Axis 3: manhattanGrid's distance returns Manhattan, not
 *     Euclidean.
 *
 * Unit subclasses (Infantry, Tank) currently live in src/rulesets/wwii/
 * — see [§13.1]. The test ruleset borrows Tank for fixture
 * construction because the test's purpose is to exercise the engine
 * abstractions, not to ship a parallel unit catalog. A future
 * data-driven unit model (step 4) would let the test ruleset declare
 * its own unit types without subclassing.
 */

const p = (x: number, y: number) => ({ x, y });

const tankAt = (id: string, pos: { x: number; y: number }, teamId = "A") =>
  new Tank({ id, name: id, teamId, position: pos });

const makeMap = () => new GameMap({ width: 100, height: 100 });

afterEach(() => {
  clearRulesets();
});

describe("test ruleset — spine (registration)", () => {
  it("registers without throwing (validateGameFlow passes)", () => {
    expect(() => registerRuleset(testRuleset)).not.toThrow();
  });

  it("identifies itself with the expected id and displayName", () => {
    expect(testRuleset.id).toBe("test-ruleset");
    expect(testRuleset.displayName).toContain("alt-WWII");
  });
});

describe("test ruleset — Axis 1 (gameflow)", () => {
  it("declares the alternating-units activation model on the Move phase", () => {
    const movePhase = testRuleset.gameflow.phases.find((p) => p.id === "Move");
    expect(movePhase?.activationModel).toEqual({
      kind: "alternating-units",
      unitsPerActivation: 2,
    });
  });

  it("drives a Game through its transitions (Deploy → Transition → AddRemove → Move → FireDeclare → Transition)", () => {
    // Game.ts's advanceFlow consults the registered ruleset's
    // gameflow on every transition. If the test ruleset's transition
    // ids don't match what Game.ts calls advanceFlow with, this
    // throws — proving the test ruleset's flow plumbs end-to-end.
    const game = new Game({ map: makeMap(), players: ["A", "B"], ruleset: testRuleset });
    expect(game.state.phase).toBe("Deploy");

    // Player A deploys
    game.deployUnit({ type: "Tank", name: "ta1", position: p(10, 10) });
    game.endDeployment();
    expect(game.state.phase).toBe("Transition");

    // Player B deploys
    game.startTurn();
    expect(game.state.phase).toBe("Deploy");
    game.deployUnit({ type: "Tank", name: "tb1", position: p(20, 20) });
    game.endDeployment();
    expect(game.state.phase).toBe("Transition");

    // First movement round
    game.chooseFirstPlayer("A");
    game.startTurn();
    expect(game.state.phase).toBe("AddRemoveUnits");
    game.endAddRemoveUnits();
    expect(game.state.phase).toBe("Move");
    game.endMove();
    expect(game.state.phase).toBe("FireDeclare");
    game.endTurn();
    expect(game.state.phase).toBe("Transition");
  });
});

describe("test ruleset — Axis 2 (vision pipeline)", () => {
  it("VisionCalculator wired with the test ruleset uses sumComposition", () => {
    const vc = new VisionCalculator(makeMap(), testRuleset.vision, testRuleset.substrate);
    // Tank intrinsic stealth = 1. Test contributors emit:
    //   - testIntrinsicContributor: modifier 1 (Tank's intrinsic)
    //   - testConstantContributor:  modifier 2.5
    // sumComposition: 1 + 2.5 = 3.5.
    const observer = tankAt("o", p(0, 0));
    const target = tankAt("t", p(5, 0));
    const result = vc.effectiveStealth(target, target.getPosition(), observer);
    expect(result.value).toBe(3.5);
  });

  it("the breakdown includes every contributor reading (sum uses every reading)", () => {
    const vc = new VisionCalculator(makeMap(), testRuleset.vision, testRuleset.substrate);
    const result = vc.effectiveStealth(
      tankAt("t", p(0, 0)),
      p(0, 0),
      tankAt("o", p(0, 0)),
    );
    expect(result.breakdown.map((r) => r.contributorId)).toEqual([
      "test-intrinsic",
      "test-constant",
    ]);
  });

  it("differs from WWII's pipeline on the same observation", async () => {
    // WWII for a Tank in the open returns 1 (single-highest pool of
    // no contributors, no intrinsic factor since Tank intrinsic = 1).
    // Test ruleset returns 3.5 (sum). Different value → different
    // pipeline.
    const { wwiiVisionConfig } = await import("../../../../src/rulesets/wwii/engine/vision.js");
    const { freePositionInches } = await import("../../../../src/rulesets/wwii/engine/substrate.js");
    const wwiiVc = new VisionCalculator(makeMap(), wwiiVisionConfig, freePositionInches);
    const testVc = new VisionCalculator(makeMap(), testRuleset.vision, testRuleset.substrate);
    const target = tankAt("t", p(5, 0));
    const wwiiResult = wwiiVc.effectiveStealth(target, target.getPosition(), tankAt("o", p(0, 0)));
    const testResult = testVc.effectiveStealth(target, target.getPosition(), tankAt("o", p(0, 0)));
    expect(wwiiResult.value).toBe(1);
    expect(testResult.value).toBe(3.5);
    expect(wwiiResult.value).not.toBe(testResult.value);
  });
});

describe("test ruleset — Axis 3 (substrate)", () => {
  it("substrate.distance returns Manhattan, not Euclidean", () => {
    // 3-4-5 triangle: Euclidean=5, Manhattan=7.
    expect(testRuleset.substrate.distance(p(0, 0), p(3, 4))).toBe(7);
  });

  it("VisionCalculator wired with the test ruleset uses Manhattan distance for discover thresholds", () => {
    // Tank vision = 64. Test ruleset's effective_stealth for Tank = 3.5.
    // Detection range = 64 / 3.5 ≈ 18.286.
    // For an observer at (0,0) and a target at (20, 0):
    //   - Manhattan distance to (20, 0) = 20
    //   - 20 > 18.286 → not detected
    //
    // For a target at (10, 0):
    //   - Manhattan distance = 10
    //   - 10 < 18.286 → detected
    const vc = new VisionCalculator(makeMap(), testRuleset.vision, testRuleset.substrate);
    const observer = tankAt("o", p(0, 0));
    expect(vc.discover(observer, tankAt("t1", p(10, 0)))).toBe(true);
    expect(vc.discover(observer, tankAt("t2", p(20, 0)))).toBe(false);
  });

  it("Manhattan and Euclidean differ on diagonals", async () => {
    // At (3, 4): Euclidean=5, Manhattan=7. A target at this position
    // could be detected under one substrate's threshold but not the
    // other.
    const { wwiiVisionConfig } = await import("../../../../src/rulesets/wwii/engine/vision.js");
    const { freePositionInches } = await import("../../../../src/rulesets/wwii/engine/substrate.js");
    expect(freePositionInches.distance(p(0, 0), p(3, 4))).toBe(5);
    expect(testRuleset.substrate.distance(p(0, 0), p(3, 4))).toBe(7);
    // Sanity: composing both into VisionCalculator's discover would
    // give different results if the threshold sits between 5 and 7;
    // we don't need to construct that scenario here — the value
    // difference at the substrate level is the contract Phase B
    // ships.
  });
});
