import { afterEach, describe, expect, it } from "vitest";
import type { GameFlow } from "../../../src/core/gameflow/index.js";
import type { Substrate } from "../../../src/core/map/substrate/index.js";
import type { UnitTypeEntry } from "../../../src/core/units/UnitTypeEntry.js";
import { singleHighest, type VisionConfig } from "../../../src/core/vision/index.js";
import {
  clearRulesets,
  getRuleset,
  listRulesets,
  registerRuleset,
  type Ruleset,
} from "../../../src/core/ruleset/index.js";
import { Tank } from "../../../src/rulesets/wwii/engine/units/Tank.js";

/**
 * Tests for the Ruleset registry (src/core/ruleset/registry.ts).
 *
 * Phase B step 1a establishes the spine; subsequent sub-steps add
 * required axis slots (1c gameflow, 1d vision, 1e substrate). The
 * minimal axis values used here are just enough to satisfy the
 * required-fields shape — they don't model real game behavior; that's
 * what the per-axis ruleset tests exercise.
 */

const minimalFlow: GameFlow = {
  initialPhaseId: "only",
  phases: [{ id: "only", displayName: "Only", activationModel: { kind: "whole-team" } }],
  transitions: [],
};

const minimalVision: VisionConfig = {
  contributors: [],
  compositionRule: singleHighest,
};

const minimalSubstrate: Substrate = {
  id: "test-substrate",
  displayName: "Test",
  distance: () => 0,
};

const minimalTerrain = { polygons: {}, walls: {} };

const minimalUnitTypes: Record<string, UnitTypeEntry> = {
  Tank: {
    id: "Tank",
    displayName: "Tank",
    construct: (p) => new Tank(p),
  },
};

const sampleA: Ruleset = {
  id: "alpha",
  displayName: "Alpha",
  gameflow: minimalFlow,
  vision: minimalVision,
  substrate: minimalSubstrate,
  terrain: minimalTerrain,
  unitTypes: minimalUnitTypes,
};
const sampleB: Ruleset = {
  id: "beta",
  displayName: "Beta",
  gameflow: minimalFlow,
  vision: minimalVision,
  substrate: minimalSubstrate,
  terrain: minimalTerrain,
  unitTypes: minimalUnitTypes,
};

afterEach(() => {
  clearRulesets();
});

describe("ruleset registry", () => {
  it("starts empty", () => {
    expect(listRulesets()).toEqual([]);
    expect(getRuleset("anything")).toBeUndefined();
  });

  it("registerRuleset makes the bundle retrievable by id", () => {
    registerRuleset(sampleA);
    expect(getRuleset("alpha")).toBe(sampleA);
  });

  it("listRulesets returns every registered bundle in registration order", () => {
    registerRuleset(sampleA);
    registerRuleset(sampleB);
    expect(listRulesets()).toEqual([sampleA, sampleB]);
  });

  it("listRulesets returns a fresh array each call (mutation safe)", () => {
    registerRuleset(sampleA);
    const list1 = listRulesets();
    const list2 = listRulesets();
    expect(list1).not.toBe(list2);
    expect(list1).toEqual(list2);
  });

  it("rejects a different bundle re-registered with the same id", () => {
    registerRuleset(sampleA);
    const conflicting: Ruleset = {
      id: "alpha",
      displayName: "Alpha conflict",
      gameflow: minimalFlow,
      vision: minimalVision,
      substrate: minimalSubstrate,
      terrain: minimalTerrain,
      unitTypes: minimalUnitTypes,
    };
    expect(() => registerRuleset(conflicting)).toThrow(
      /Ruleset already registered with id "alpha"/,
    );
    // The original is still the one in the registry.
    expect(getRuleset("alpha")).toBe(sampleA);
  });

  it("is idempotent when re-registering the exact same object reference", () => {
    // Lets HMR / repeated test setup safely call register() again.
    registerRuleset(sampleA);
    expect(() => registerRuleset(sampleA)).not.toThrow();
    expect(listRulesets()).toHaveLength(1);
  });

  it("clearRulesets resets the registry", () => {
    registerRuleset(sampleA);
    registerRuleset(sampleB);
    clearRulesets();
    expect(listRulesets()).toEqual([]);
    expect(getRuleset("alpha")).toBeUndefined();
  });

  it("rejects a ruleset whose gameflow is malformed", () => {
    // Phase B 1c: registerRuleset runs validateGameFlow at registration
    // time so malformed bundles fail fast at boot rather than in mid-game.
    const broken: Ruleset = {
      id: "broken",
      displayName: "Broken",
      gameflow: {
        initialPhaseId: "missing",
        phases: [{ id: "real", displayName: "Real", activationModel: { kind: "whole-team" } }],
        transitions: [],
      },
      vision: minimalVision,
      substrate: minimalSubstrate,
      terrain: minimalTerrain,
      unitTypes: minimalUnitTypes,
    };
    expect(() => registerRuleset(broken)).toThrow(/initialPhaseId "missing"/);
    expect(getRuleset("broken")).toBeUndefined();
  });

  it("rejects a ruleset that registers no unit types", () => {
    // Phase B 4a: a ruleset with no unit types can't build anything,
    // so the registry treats it as malformed and fails fast at boot.
    const empty: Ruleset = {
      id: "empty",
      displayName: "Empty",
      gameflow: minimalFlow,
      vision: minimalVision,
      substrate: minimalSubstrate,
      terrain: minimalTerrain,
      unitTypes: {},
    };
    expect(() => registerRuleset(empty)).toThrow(/no unit types/);
    expect(getRuleset("empty")).toBeUndefined();
  });
});
