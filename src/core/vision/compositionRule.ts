import type { ContributorReading } from "./contributors/Contributor.js";

/**
 * How a ruleset pools multiple contributor readings into a single
 * effective_stealth multiplier for the §4 discovery formula.
 *
 * WWII uses `singleHighest` — only the contributor with the largest
 * modifier counts; the others are dropped. Other rulesets can supply
 * `sum`, `product`, "average of contributors > 1," or any custom
 * combiner. Per [mechanics-refactor.md §11 D2], composition is the
 * ruleset's choice, picked once at registration; contributors don't
 * declare their own composition.
 *
 * `breakdown` returns the contributors that actually informed the
 * result so the UI can render the source list (per R4 — UI consumes
 * the engine's breakdown rather than re-deriving it). A rule that
 * drops contributors (singleHighest) returns just the winner; a rule
 * that uses every one (sum, product) returns the full input.
 */
export type CompositionRule = (
  readings: readonly ContributorReading[],
) => CompositionResult;

export interface CompositionResult {
  /** The pooled multiplier. 1 = no concealment. */
  readonly value: number;
  /** Contributors that actually informed the result, in input order. */
  readonly breakdown: readonly ContributorReading[];
}
