import type { GameMap } from "../../map/GameMap.js";
import type { Point } from "../../types.js";
import type { Unit } from "../../units/Unit.js";

/**
 * A source category that contributes — or doesn't — to a target's
 * effective stealth from an observer's perspective. The pipeline runs
 * every registered contributor for each observation, flattens the
 * readings, and pools them with the ruleset's composition rule to
 * produce the `effective_stealth` value the §4 discovery formula
 * consumes.
 *
 * Phase B step 1d laid this interface; step 2b implements WWII's
 * contributors (intrinsic, inherent-dug-in, terrain, gone-to-ground
 * stacking) by extracting the logic currently inline in
 * VisionCalculator.discover. Each contributor is a small object, one
 * per source category; assembly happens in the ruleset's VisionConfig.
 *
 * Design notes:
 *   - `position` is taken separately from `target` so callers that ask
 *     "what would this unit's stealth be at THIS position?" (the
 *     Discovery Visualizer, move-preview) can answer without mutating
 *     the target.
 *   - `observer` may be omitted for position-only computations (e.g.
 *     "what's this unit's static stealth?"). Contributors that depend
 *     on the observer (ray-direction-sensitive terrain) return an
 *     empty array when no observer is given.
 *   - `contribute` returns an **array** of readings, not a single
 *     reading. A category like "terrain" naturally produces multiple
 *     readings on one observation (one per applicable polygon, one per
 *     crossed wall). Single-source categories (intrinsic, gtg) return
 *     a one-element array; non-applicable contributions return an
 *     empty array. This shape was widened from the original single-or-
 *     null in 1d once WWII's terrain category surfaced the need.
 *
 * See docs/features/v2/mechanics-refactor.md §6.2 (Axis 2 target shape)
 * and §11 D2 (composition rule is per-ruleset configurable).
 */
export interface Contributor {
  /**
   * Stable identifier for the source category. Used by composition
   * rules to recognize and route readings (e.g. WWII's rule treats
   * "intrinsic" as an always-multiplier and "gone-to-ground" as a
   * conditional-stack), and as the label-source for UI breakdowns.
   */
  readonly id: string;

  /**
   * Return every reading this category produces for the given
   * observation. Empty array when nothing applies. Each reading
   * carries its own modifier + label so multi-source categories
   * (terrain) can attribute the modifier to the specific feature
   * (e.g. "Tall Woods" vs "Short Wall").
   */
  contribute(
    target: Unit,
    position: Point,
    map: GameMap,
    observer: Unit | undefined,
  ): readonly ContributorReading[];
}

/** One contributor's output for one observation. */
export interface ContributorReading {
  readonly contributorId: string;
  readonly modifier: number;
  readonly label: string;
}
