import { afterEach, describe, expect, it } from "vitest";
import type { GameFlow } from "../../../src/core/gameflow/index.js";
import {
  clearRulesets,
  getRuleset,
  listRulesets,
  registerRuleset,
  type Ruleset,
} from "../../../src/core/ruleset/index.js";

/**
 * Tests for the Ruleset registry (src/core/ruleset/registry.ts).
 *
 * Phase B step 1a establishes the spine; step 1c added validation of
 * each registered ruleset's gameflow at registration time. The minimal
 * flow used here is just enough to satisfy the validator — it doesn't
 * model real game behavior; that's what wwiiGameFlow.test.ts exercises.
 */

const minimalFlow: GameFlow = {
  initialPhaseId: "only",
  phases: [{ id: "only", displayName: "Only", activationModel: { kind: "whole-team" } }],
  transitions: [],
};

const sampleA: Ruleset = { id: "alpha", displayName: "Alpha", gameflow: minimalFlow };
const sampleB: Ruleset = { id: "beta", displayName: "Beta", gameflow: minimalFlow };

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
    const conflicting: Ruleset = { id: "alpha", displayName: "Alpha conflict", gameflow: minimalFlow };
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
    };
    expect(() => registerRuleset(broken)).toThrow(/initialPhaseId "missing"/);
    expect(getRuleset("broken")).toBeUndefined();
  });
});
