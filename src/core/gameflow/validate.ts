import type { GameFlow } from "./types.js";

/**
 * Validate a GameFlow definition's structural invariants. Throws a
 * descriptive Error on the first violation; returns silently when the
 * flow is well-formed. Called by the runtime on every registered
 * ruleset's gameflow at boot so malformed registrations fail fast
 * before any state machine runs against them.
 *
 * Checked invariants (see GameFlow doc-comment):
 *   - initialPhaseId references a phase in `phases`.
 *   - Every Transition's `from` / `to` references a phase in `phases`.
 *   - Phase ids are unique within `phases`.
 *   - Transition ids are unique within `transitions`.
 */
export function validateGameFlow(flow: GameFlow): void {
  const phaseIds = new Set<string>();
  for (const phase of flow.phases) {
    if (phaseIds.has(phase.id)) {
      throw new Error(`GameFlow: duplicate phase id "${phase.id}"`);
    }
    phaseIds.add(phase.id);
  }

  if (!phaseIds.has(flow.initialPhaseId)) {
    throw new Error(
      `GameFlow: initialPhaseId "${flow.initialPhaseId}" does not reference any phase`,
    );
  }

  const transitionIds = new Set<string>();
  for (const t of flow.transitions) {
    if (transitionIds.has(t.id)) {
      throw new Error(`GameFlow: duplicate transition id "${t.id}"`);
    }
    transitionIds.add(t.id);
    if (!phaseIds.has(t.from)) {
      throw new Error(
        `GameFlow: transition "${t.id}" references unknown source phase "${t.from}"`,
      );
    }
    if (!phaseIds.has(t.to)) {
      throw new Error(
        `GameFlow: transition "${t.id}" references unknown destination phase "${t.to}"`,
      );
    }
  }
}
