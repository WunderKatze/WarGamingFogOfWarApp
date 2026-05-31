import { afterEach, describe, expect, it } from "vitest";
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
 * Phase B step 1a establishes the spine; the registry is the
 * load-bearing piece engine-core uses to stay ruleset-agnostic (R3).
 * Tests pin the contract: register/get/list, duplicate-id rejection,
 * idempotent re-registration of the same object, and a clean-slate
 * test-only reset helper.
 */

const sampleA: Ruleset = { id: "alpha", displayName: "Alpha" };
const sampleB: Ruleset = { id: "beta", displayName: "Beta" };

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
    const conflicting: Ruleset = { id: "alpha", displayName: "Alpha conflict" };
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
});
