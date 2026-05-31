import type { GameFlow } from "../../../core/gameflow/index.js";

/**
 * The WWII 1/100 ruleset's game-flow definition.
 *
 * Mirrors the state-machine sequence Game.ts currently hardcodes (see
 * src/core/Game.ts and src/core/GameState.ts) — same 5 phases, same 6
 * transitions, same phase ids so phase-name comparisons in the UI
 * keep working until they migrate. Phase B step 2 will retire Game.ts's
 * hand-coded transitions and drive the state machine from this
 * definition instead; for now it exists as parallel data.
 *
 * Activation model is `whole-team` for every WWII phase — the active
 * player completes the whole phase before any handoff. Other rulesets
 * (e.g. alternating-by-phase) would assemble different ActivationModels
 * per phase.
 *
 * Transition ids match the Game.ts method names that currently drive
 * each transition, so the step-2 migration mapping is mechanical:
 *   - endDeployment        — Game.endDeployment
 *   - startTurn-to-Deploy  — Game.startTurn (when deployment incomplete)
 *   - startTurn-to-Round   — Game.startTurn (when deployment complete)
 *   - endAddRemoveUnits    — Game.endAddRemoveUnits
 *   - endMove              — Game.endMove
 *   - endTurn              — Game.endTurn
 */
export const wwiiGameFlow: GameFlow = {
  initialPhaseId: "Deploy",
  phases: [
    { id: "Deploy", displayName: "Deploy", activationModel: { kind: "whole-team" } },
    { id: "Transition", displayName: "Transition", activationModel: { kind: "whole-team" } },
    { id: "AddRemoveUnits", displayName: "Add/Remove Units", activationModel: { kind: "whole-team" } },
    { id: "Move", displayName: "Move", activationModel: { kind: "whole-team" } },
    { id: "FireDeclare", displayName: "Fire Declare", activationModel: { kind: "whole-team" } },
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
