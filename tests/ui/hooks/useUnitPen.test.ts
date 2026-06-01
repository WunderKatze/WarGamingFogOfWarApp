import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Infantry } from "../../../src/rulesets/wwii/engine/units/Infantry.js";
import { Tank } from "../../../src/rulesets/wwii/engine/units/Tank.js";
import { useUnitPen } from "../../../src/ui/hooks/useUnitPen.js";

/**
 * Tests for the useUnitPen hook (src/ui/hooks/useUnitPen.ts).
 *
 * Per docs/features/v2/code-health-pass-tests.md T1 (Phase A-3): the
 * hook landed with U2 (Phase A-2) and was validated transitively
 * through engine tests + manual smoke. These tests pin the helper
 * contracts (autoName, buildParams, loadFromUnit, clearName) so Phase
 * B's reshape of the WWII-specific options into a registry-driven
 * model is behavior-preserving for the existing flow.
 *
 * Uses @testing-library/react's renderHook (added as a dev dep with
 * this commit per code-health-pass-tests.md §8 D2). Each test mounts
 * a fresh hook; no cross-test state.
 */

const POSITION = { x: 5, y: 7 };

/**
 * Build a freestanding Infantry / Tank for `loadFromUnit` source tests.
 * Doesn't go through Game — the hook only reads `type`, `size`,
 * `hasModifier`, and (for Infantry) `dugIn`, so a bare construction is
 * enough.
 */
const makeInfantry = (init: Partial<{ dugIn: boolean; recon: boolean }> = {}) =>
  new Infantry({
    id: "i1",
    teamId: "A",
    name: "Test",
    position: { x: 0, y: 0 },
    size: "Squad",
    ...(init.recon && { modifiers: ["Recon"] }),
    ...(init.dugIn !== undefined && { dugIn: init.dugIn }),
  });

const makeTank = (recon = false) =>
  new Tank({
    id: "t1",
    teamId: "A",
    name: "Test",
    position: { x: 0, y: 0 },
    size: "Company",
    ...(recon && { modifiers: ["Recon"] }),
  });

describe("useUnitPen — initial state", () => {
  it("defaults to Infantry / Platoon / no Recon / not dug-in / empty name", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    expect(result.current.state).toEqual({
      type: "Infantry",
      size: "Platoon",
      recon: false,
      dugIn: false,
      name: "",
    });
  });

  it("applies defaults overrides at first render", () => {
    const { result } = renderHook(() =>
      useUnitPen({
        ownUnitCount: 0,
        defaults: { type: "Tank", size: "Battalion", recon: true, dugIn: true, name: "Vanguard" },
      }),
    );
    expect(result.current.state).toEqual({
      type: "Tank",
      size: "Battalion",
      recon: true,
      dugIn: true,
      name: "Vanguard",
    });
  });

  it("merges partial defaults with built-in defaults (dugIn-only override)", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { dugIn: true } }),
    );
    // dugIn flipped, everything else still default
    expect(result.current.state.type).toBe("Infantry");
    expect(result.current.state.size).toBe("Platoon");
    expect(result.current.state.recon).toBe(false);
    expect(result.current.state.dugIn).toBe(true);
    expect(result.current.state.name).toBe("");
  });
});

describe("useUnitPen — autoName", () => {
  it("returns 'I-{count+1}' for Infantry", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 2 }));
    expect(result.current.autoName()).toBe("I-3");
  });

  it("returns 'T-{count+1}' for Tank", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 4, defaults: { type: "Tank" } }),
    );
    expect(result.current.autoName()).toBe("T-5");
  });

  it("reflects the current pen type after a setter call", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    act(() => result.current.setters.setType("Tank"));
    expect(result.current.autoName()).toBe("T-1");
  });
});

describe("useUnitPen — buildParams", () => {
  it("uses the pen's current state + the given position", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { type: "Tank", size: "Company", name: "Spearhead" } }),
    );
    expect(result.current.buildParams(POSITION)).toEqual({
      type: "Tank",
      name: "Spearhead",
      position: POSITION,
      size: "Company",
    });
  });

  it("omits dugIn when the pen type is Tank (Tank has no dug-in)", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { type: "Tank", dugIn: true } }),
    );
    const params = result.current.buildParams(POSITION);
    expect(params).not.toHaveProperty("dugIn");
  });

  it("includes dugIn when the pen type is Infantry", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { type: "Infantry", dugIn: true } }),
    );
    expect(result.current.buildParams(POSITION).dugIn).toBe(true);
  });

  it("includes modifiers: ['Recon'] when Recon is set, otherwise omits the field", () => {
    const { result: withRecon } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { recon: true } }),
    );
    expect(withRecon.current.buildParams(POSITION).modifiers).toEqual(["Recon"]);

    const { result: withoutRecon } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    expect(withoutRecon.current.buildParams(POSITION)).not.toHaveProperty("modifiers");
  });

  it("falls back to autoName when the pen name is blank or whitespace", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    expect(result.current.buildParams(POSITION).name).toBe("I-1"); // empty default
    act(() => result.current.setters.setName("   "));
    expect(result.current.buildParams(POSITION).name).toBe("I-1"); // whitespace also falls back
  });

  it("trims whitespace around an explicit name", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    act(() => result.current.setters.setName("  Charlie  "));
    expect(result.current.buildParams(POSITION).name).toBe("Charlie");
  });
});

describe("useUnitPen — loadFromUnit", () => {
  it("copies type / size / recon / dugIn from an Infantry source", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    const source = makeInfantry({ dugIn: true, recon: true });
    act(() => result.current.loadFromUnit(source));
    expect(result.current.state.type).toBe("Infantry");
    expect(result.current.state.size).toBe("Squad");
    expect(result.current.state.recon).toBe(true);
    expect(result.current.state.dugIn).toBe(true);
  });

  it("copies type / size / recon from a Tank source but leaves dugIn at its current value", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { dugIn: true } }),
    );
    const source = makeTank(true);
    act(() => result.current.loadFromUnit(source));
    expect(result.current.state.type).toBe("Tank");
    expect(result.current.state.size).toBe("Company");
    expect(result.current.state.recon).toBe(true);
    // Tank has no dugIn — pen's dugIn was true, stays true
    expect(result.current.state.dugIn).toBe(true);
  });

  it("does NOT touch the name field (caller sets the clone name separately)", () => {
    const { result } = renderHook(() => useUnitPen({ ownUnitCount: 0 }));
    act(() => result.current.setters.setName("Hold-this"));
    act(() => result.current.loadFromUnit(makeInfantry({ dugIn: true })));
    expect(result.current.state.name).toBe("Hold-this");
  });
});

describe("useUnitPen — clearName", () => {
  it("resets only the name field", () => {
    const { result } = renderHook(() =>
      useUnitPen({ ownUnitCount: 0, defaults: { recon: true, dugIn: true, name: "Initial" } }),
    );
    act(() => result.current.clearName());
    expect(result.current.state.name).toBe("");
    // Other fields untouched
    expect(result.current.state.recon).toBe(true);
    expect(result.current.state.dugIn).toBe(true);
  });
});
