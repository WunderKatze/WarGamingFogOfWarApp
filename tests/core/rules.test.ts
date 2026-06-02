import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultRules,
  getRules,
  resetRules,
  setRules,
  subscribeRules,
} from "../../src/core/rules.js";

/**
 * Tests for the runtime-mutable rules singleton (src/core/rules.ts).
 *
 * Per docs/features/v2/code-health-pass-tests.md T2 (Phase A-3): these
 * mechanics were previously tested only transitively through fixtures
 * elsewhere. Direct tests pin the contract so Phase B's reshape of the
 * `Rules` interface (per-ruleset rules slot per B13) doesn't silently
 * break the subscription wiring the UI relies on.
 *
 * Each test starts from a known baseline (resetRules in beforeEach) and
 * unsubscribes any listeners it created (afterEach) so cross-test
 * pollution stays impossible.
 */

const pendingUnsubscribes: (() => void)[] = [];

beforeEach(() => {
  resetRules();
});

afterEach(() => {
  // resetRules clears the values but listeners persist until unsubscribed.
  // Drain every unsubscribe handle we accumulated so this file's spies
  // don't accumulate inside the singleton across runs.
  while (pendingUnsubscribes.length > 0) pendingUnsubscribes.pop()!();
  resetRules();
});

/** Subscribe and queue the unsubscribe handle for afterEach cleanup. */
function subscribe(fn: () => void): () => void {
  const unsubscribe = subscribeRules(fn);
  pendingUnsubscribes.push(unsubscribe);
  return unsubscribe;
}

describe("rules — defaults baseline", () => {
  it("getRules returns the default values on first call", () => {
    expect(getRules().goneToGroundStealthModifier).toBe(defaultRules.goneToGroundStealthModifier);
    expect(getRules().tallWoodsRayThroughLimit).toBe(defaultRules.tallWoodsRayThroughLimit);
    expect(getRules().unitTypeStats.Infantry.baseVision).toBe(defaultRules.unitTypeStats.Infantry.baseVision);
  });

  it("defaultRules is frozen at the top level", () => {
    expect(Object.isFrozen(defaultRules)).toBe(true);
  });

  it("getRules and defaultRules are NOT the same reference (defaults are deep-cloned at module load)", () => {
    // structuredClone gives `currentRules` its own object; mutations
    // through setRules must never bleed into defaultRules.
    expect(getRules()).not.toBe(defaultRules);
  });
});

describe("rules — setRules", () => {
  it("merges partial updates at the top level (leaves untouched fields intact)", () => {
    const beforeVision = getRules().unitTypeStats.Infantry.baseVision;
    setRules({ goneToGroundStealthModifier: 5 });
    expect(getRules().goneToGroundStealthModifier).toBe(5);
    // unrelated field stays at default
    expect(getRules().unitTypeStats.Infantry.baseVision).toBe(beforeVision);
  });

  it("replaces nested objects wholesale (merge is shallow by design)", () => {
    // Callers updating one nested field must spread the existing nested
    // object — passing a half-populated nested object would lose keys.
    // This test pins that contract.
    const fullStats = {
      Infantry: { baseVision: 99, baseStealth: 99 },
      Tank: { baseVision: 99, baseStealth: 99 },
    };
    setRules({ unitTypeStats: fullStats });
    expect(getRules().unitTypeStats.Infantry.baseVision).toBe(99);
    expect(getRules().unitTypeStats.Tank.baseStealth).toBe(99);
  });

  it("getRules returns a new object reference after setRules (so React can compare)", () => {
    const before = getRules();
    setRules({ goneToGroundStealthModifier: 5 });
    expect(getRules()).not.toBe(before);
  });

  it("does not mutate defaultRules", () => {
    const defaultGtg = defaultRules.goneToGroundStealthModifier;
    setRules({ goneToGroundStealthModifier: 999 });
    expect(defaultRules.goneToGroundStealthModifier).toBe(defaultGtg);
  });
});

describe("rules — resetRules", () => {
  it("restores every field to its default", () => {
    setRules({
      goneToGroundStealthModifier: 99,
      tallWoodsRayThroughLimit: 99,
      shortWallStealthModifier: 99,
    });
    resetRules();
    expect(getRules().goneToGroundStealthModifier).toBe(defaultRules.goneToGroundStealthModifier);
    expect(getRules().tallWoodsRayThroughLimit).toBe(defaultRules.tallWoodsRayThroughLimit);
    expect(getRules().shortWallStealthModifier).toBe(defaultRules.shortWallStealthModifier);
  });

  it("restores nested objects to their default values", () => {
    setRules({
      unitTypeStats: {
        Infantry: { baseVision: 1, baseStealth: 1 },
        Tank: { baseVision: 1, baseStealth: 1 },
      },
    });
    resetRules();
    expect(getRules().unitTypeStats.Infantry.baseVision).toBe(defaultRules.unitTypeStats.Infantry.baseVision);
    expect(getRules().unitTypeStats.Tank.baseStealth).toBe(defaultRules.unitTypeStats.Tank.baseStealth);
  });

  it("gives a deep-cloned copy each time (mutations to one reset's result don't bleed into the next)", () => {
    // After the first reset, mutate currentRules via setRules, then reset
    // again. The post-second-reset state must equal the original default —
    // any reference-sharing with defaultRules would let the first
    // mutation persist.
    resetRules();
    setRules({
      polygonStealthModifier: {
        ...getRules().polygonStealthModifier,
        Building: 999,
      },
    });
    resetRules();
    expect(getRules().polygonStealthModifier.Building).toBe(defaultRules.polygonStealthModifier.Building);
  });

  it("returns a new object reference (so React subscribers re-render)", () => {
    const before = getRules();
    resetRules();
    expect(getRules()).not.toBe(before);
  });
});

describe("rules — subscribeRules", () => {
  it("fires the subscriber when setRules runs", () => {
    const spy = vi.fn();
    subscribe(spy);
    setRules({ goneToGroundStealthModifier: 7 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("fires the subscriber when resetRules runs", () => {
    const spy = vi.fn();
    subscribe(spy);
    resetRules();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns an unsubscribe function that stops further notifications", () => {
    const spy = vi.fn();
    const unsubscribe = subscribe(spy);
    setRules({ goneToGroundStealthModifier: 1 });
    unsubscribe();
    setRules({ goneToGroundStealthModifier: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("fires every active subscriber (each setRules notifies all)", () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    subscribe(a);
    subscribe(b);
    subscribe(c);
    setRules({ goneToGroundStealthModifier: 3 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing one subscriber leaves the others firing", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribe(a);
    subscribe(b);
    unsubA();
    setRules({ goneToGroundStealthModifier: 4 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
