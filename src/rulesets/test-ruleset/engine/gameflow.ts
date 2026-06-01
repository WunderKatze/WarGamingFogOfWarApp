import type { GameFlow } from "../../../core/gameflow/index.js";

/**
 * The test ruleset's game-flow definition.
 *
 * Same phase ids and transition ids as WWII — Game.ts hardcodes both
 * (the `advanceFlow("endMove")` etc. calls), so until step 4 lifts
 * those, the test ruleset's flow has to share the WWII transition
 * graph. The Axis 1 variation comes through the **activationModel**:
 * the Move phase declares `alternating-units` with N=2 instead of
 * WWII's `whole-team`. Game.ts doesn't yet consult activationModel
 * for actual game logic, but the ruleset *declares* the variation
 * and the integration test verifies the declaration survives a
 * round-trip through registerRuleset + validateGameFlow.
 *
 * Per [mechanics-refactor.md §11 D1] — the test ruleset's purpose is
 * to prove the abstractions plug in; it doesn't need to be a
 * realized playable game.
 */
export const testGameFlow: GameFlow = {
  initialPhaseId: "Deploy",
  phases: [
    { id: "Deploy", displayName: "Deploy (test)", activationModel: { kind: "whole-team" } },
    { id: "Transition", displayName: "Transition (test)", activationModel: { kind: "whole-team" } },
    { id: "AddRemoveUnits", displayName: "Roster (test)", activationModel: { kind: "whole-team" } },
    {
      id: "Move",
      displayName: "Move (test, alternating)",
      // Axis 1 differentiator: this phase declares alternating-units
      // instead of WWII's whole-team. Symbolic until Game.ts
      // consults activationModel.
      activationModel: { kind: "alternating-units", unitsPerActivation: 2 },
    },
    { id: "FireDeclare", displayName: "Fire (test)", activationModel: { kind: "whole-team" } },
  ],
  transitions: [
    { id: "endDeployment", from: "Deploy", to: "Transition" },
    { id: "startTurn-to-Deploy", from: "Transition", to: "Deploy" },
    { id: "startTurn-to-Round", from: "Transition", to: "AddRemoveUnits" },
    { id: "endAddRemoveUnits", from: "AddRemoveUnits", to: "Move" },
    { id: "endMove", from: "Move", to: "FireDeclare" },
    { id: "endTurn", from: "FireDeclare", to: "Transition" },
  ],
};
