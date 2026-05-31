import { describe, expect, it } from "vitest";
import type { GameFlow } from "../../../src/core/gameflow/index.js";
import { validateGameFlow } from "../../../src/core/gameflow/index.js";

/**
 * Tests for validateGameFlow (src/core/gameflow/validate.ts).
 *
 * Phase B 1c — the validator enforces the structural invariants that
 * GameFlow's doc-comment promises. Each test isolates one invariant
 * so a regression points straight at the broken rule.
 */

const okPhase = (id: string) =>
  ({ id, displayName: id, activationModel: { kind: "whole-team" } } as const);

describe("validateGameFlow — passing cases", () => {
  it("accepts a minimal one-phase flow with no transitions", () => {
    expect(() =>
      validateGameFlow({
        initialPhaseId: "only",
        phases: [okPhase("only")],
        transitions: [],
      }),
    ).not.toThrow();
  });

  it("accepts a multi-phase flow with all transitions wired up", () => {
    expect(() =>
      validateGameFlow({
        initialPhaseId: "a",
        phases: [okPhase("a"), okPhase("b"), okPhase("c")],
        transitions: [
          { id: "a-to-b", from: "a", to: "b" },
          { id: "b-to-c", from: "b", to: "c" },
          { id: "c-to-a", from: "c", to: "a" },
        ],
      }),
    ).not.toThrow();
  });
});

describe("validateGameFlow — rejects malformed flows", () => {
  it("throws when initialPhaseId does not match any phase", () => {
    const flow: GameFlow = {
      initialPhaseId: "missing",
      phases: [okPhase("real")],
      transitions: [],
    };
    expect(() => validateGameFlow(flow)).toThrow(/initialPhaseId "missing"/);
  });

  it("throws on duplicate phase ids", () => {
    const flow: GameFlow = {
      initialPhaseId: "dup",
      phases: [okPhase("dup"), okPhase("dup")],
      transitions: [],
    };
    expect(() => validateGameFlow(flow)).toThrow(/duplicate phase id "dup"/);
  });

  it("throws on duplicate transition ids", () => {
    const flow: GameFlow = {
      initialPhaseId: "a",
      phases: [okPhase("a"), okPhase("b")],
      transitions: [
        { id: "edge", from: "a", to: "b" },
        { id: "edge", from: "b", to: "a" },
      ],
    };
    expect(() => validateGameFlow(flow)).toThrow(/duplicate transition id "edge"/);
  });

  it("throws when a transition references an unknown source phase", () => {
    const flow: GameFlow = {
      initialPhaseId: "a",
      phases: [okPhase("a"), okPhase("b")],
      transitions: [{ id: "bad", from: "ghost", to: "b" }],
    };
    expect(() => validateGameFlow(flow)).toThrow(/unknown source phase "ghost"/);
  });

  it("throws when a transition references an unknown destination phase", () => {
    const flow: GameFlow = {
      initialPhaseId: "a",
      phases: [okPhase("a"), okPhase("b")],
      transitions: [{ id: "bad", from: "a", to: "ghost" }],
    };
    expect(() => validateGameFlow(flow)).toThrow(/unknown destination phase "ghost"/);
  });
});
