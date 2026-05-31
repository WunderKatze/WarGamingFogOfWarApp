import { describe, expect, it } from "vitest";
import { validateGameFlow } from "../../../../src/core/gameflow/index.js";
import { wwiiGameFlow } from "../../../../src/rulesets/wwii/engine/gameflow.js";

/**
 * Tests for the WWII ruleset's game-flow definition.
 *
 * The flow exists in step 1c as parallel data — Game.ts still drives
 * the state machine with hardcoded transitions. These tests pin the
 * data shape so the step-2 migration (Game.ts reading from this flow
 * instead of its own hardcoded sequence) has an obvious target.
 *
 * Source of truth for "what WWII's state machine looks like" is
 * src/core/Game.ts + src/core/GameState.ts. If those diverge from
 * what this flow encodes during the step-2 migration, the migration
 * isn't behavior-preserving — that's a bug, not a test update.
 */

describe("wwiiGameFlow", () => {
  it("passes validateGameFlow (structural invariants hold)", () => {
    expect(() => validateGameFlow(wwiiGameFlow)).not.toThrow();
  });

  it("starts in the Deploy phase (matches Game.ts initial state)", () => {
    expect(wwiiGameFlow.initialPhaseId).toBe("Deploy");
  });

  it("declares the five phases Game.ts uses, with matching ids", () => {
    const ids = wwiiGameFlow.phases.map((p) => p.id).sort();
    expect(ids).toEqual([
      "AddRemoveUnits",
      "Deploy",
      "FireDeclare",
      "Move",
      "Transition",
    ]);
  });

  it("uses whole-team activation for every phase (WWII's only activation mode)", () => {
    for (const phase of wwiiGameFlow.phases) {
      expect(phase.activationModel).toEqual({ kind: "whole-team" });
    }
  });

  it("declares the six transitions matching Game.ts's state-machine edges", () => {
    // The full WWII edge list. Transition ids match the Game.ts method
    // names that currently drive each transition — see
    // src/rulesets/wwii/engine/gameflow.ts top-comment.
    const edges = wwiiGameFlow.transitions
      .map((t) => ({ id: t.id, from: t.from, to: t.to }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(edges).toEqual(
      [
        { id: "endAddRemoveUnits", from: "AddRemoveUnits", to: "Move" },
        { id: "endDeployment", from: "Deploy", to: "Transition" },
        { id: "endMove", from: "Move", to: "FireDeclare" },
        { id: "endTurn", from: "FireDeclare", to: "Transition" },
        { id: "startTurn-to-Deploy", from: "Transition", to: "Deploy" },
        { id: "startTurn-to-Round", from: "Transition", to: "AddRemoveUnits" },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("the Transition phase has two outgoing transitions (the startTurn branch)", () => {
    // Game.startTurn branches on isDeploymentComplete: stay in Deploy
    // (more players to deploy) or advance to AddRemoveUnits (begin a
    // movement round). The flow models the branch as two transitions
    // from Transition with different destinations.
    const outgoing = wwiiGameFlow.transitions.filter((t) => t.from === "Transition");
    expect(outgoing).toHaveLength(2);
    const destinations = outgoing.map((t) => t.to).sort();
    expect(destinations).toEqual(["AddRemoveUnits", "Deploy"]);
  });
});
