/**
 * Game-flow definitions: the static shape of a ruleset's phase graph.
 *
 * Phase B Axis 1 reframes the game's state machine from hand-coded
 * methods in Game.ts into a composable graph of named phases and
 * transitions, each registered with the engine through a Ruleset.
 *
 * **Step 1c is the static shape only.** This file defines what a game
 * flow *looks like* as data. Phase B step 2 will migrate Game.ts to
 * drive its state machine from a `GameFlow` definition instead of its
 * hardcoded sequence. Triggers (e.g. "run vision recompute on this
 * transition") and per-transition effects layer in either as a 1c
 * follow-up or alongside the step 2 migration; intentionally absent
 * here so step 1c stays a single reviewable surface.
 *
 * See docs/features/v2/mechanics-refactor.md §5 (Axis 1 target shape)
 * and §11 D7 (naming deferred — "flow node" is the placeholder term
 * for the phase/transition/activation/trigger family).
 */

/** Stable identifier for a phase within one game-flow definition. */
export type PhaseId = string;

/**
 * Who is "active" during a phase. The activation model determines which
 * player drives the UI at any moment within the phase.
 *
 * - `whole-team`: the active player completes the entire phase before
 *   any swap. WWII uses this for every phase.
 * - `alternating-units`: players alternate placing / moving individual
 *   units within the same phase. Future rulesets only; not used by WWII.
 * - `simultaneous`: both players act in parallel (hidden orders / etc.).
 *   Future rulesets only.
 *
 * Tagged union so additional models can be added without breaking
 * existing rulesets — exhaustiveness checks at consumer sites catch
 * missing handling.
 */
export type ActivationModel =
  | { readonly kind: "whole-team" }
  | { readonly kind: "alternating-units"; readonly unitsPerActivation: number }
  | { readonly kind: "simultaneous" };

/** A named state in the flow graph. */
export interface Phase {
  readonly id: PhaseId;
  /** Human-readable label rendered by chrome (e.g. the Header phase badge). */
  readonly displayName: string;
  /** Whose turn during this phase. WWII uses `{ kind: "whole-team" }` for every phase. */
  readonly activationModel: ActivationModel;
}

/**
 * An edge in the flow graph: how one phase ends and what comes next.
 *
 * `id` is a stable label for the transition itself — useful for the
 * runtime ("which transition fired?"), for tests, and for the
 * (forthcoming) trigger-effect wiring. Conventionally matches the
 * Game.ts method name that currently drives this transition (e.g.
 * `"endMove"`, `"endTurn"`) so the migration mapping is obvious.
 */
export interface Transition {
  readonly id: string;
  readonly from: PhaseId;
  readonly to: PhaseId;
}

/**
 * A ruleset's complete flow definition. The runtime seeds its state
 * machine with `initialPhaseId`, looks up the current phase in
 * `phases`, and reads outgoing edges from `transitions`.
 *
 * Invariants (checked by `validateGameFlow` in tests / startup):
 *   - `initialPhaseId` references a phase in `phases`.
 *   - Every `Transition.from` and `Transition.to` references a phase
 *     in `phases`.
 *   - Phase ids are unique within `phases`.
 *   - Transition ids are unique within `transitions`.
 */
export interface GameFlow {
  readonly initialPhaseId: PhaseId;
  readonly phases: readonly Phase[];
  readonly transitions: readonly Transition[];
}
