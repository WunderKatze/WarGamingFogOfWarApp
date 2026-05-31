import type { GameMap } from "../../map/GameMap.js";
import type { Point } from "../../types.js";
import type { Unit } from "../../units/Unit.js";

/**
 * A single source that contributes — or doesn't — to a target's
 * effective stealth from an observer's perspective. The pipeline runs
 * every registered contributor for each observation, collects the
 * non-null readings, and pools them with the ruleset's composition rule
 * to produce the `effective_stealth` value the §4 discovery formula
 * consumes.
 *
 * Phase B step 1d lays this interface; step 2 implements WWII's
 * contributors (intrinsic, inherent-dug-in, polygon-terrain, wall,
 * gone-to-ground stacking) by extracting the logic currently inline
 * in VisionCalculator.discover. Each contributor is a small object,
 * one per concern; assembly happens in the ruleset's VisionConfig.
 *
 * Design notes:
 *   - `position` is taken separately from `target` so callers that ask
 *     "what would this unit's stealth be at THIS position?" (the
 *     Discovery Visualizer, move-preview) can answer without mutating
 *     the target. WWII's existing UI helper effectiveStealth.ts uses
 *     the same separation; the engine read API in step 2 inherits it.
 *   - `observer` may be omitted for position-only computations (e.g.
 *     "what's this unit's static stealth?"). Contributors that depend
 *     on the observer (ray-direction-sensitive terrain) return null
 *     when no observer is given.
 *
 * See docs/features/v2/mechanics-refactor.md §6.2 (Axis 2 target shape)
 * and §11 D2 (composition rule is per-ruleset configurable).
 */
export interface Contributor {
  /**
   * Stable identifier. Used as the source label in breakdown displays
   * (InfoMenu "× 3 Tall Woods", Discovery Visualizer ring tooltips)
   * and as a test / debug handle.
   */
  readonly id: string;

  /**
   * Return this contributor's stealth output for the given observation,
   * or `null` when the contributor doesn't apply. The number is a
   * multiplier applied to base stealth; `label` is the human-readable
   * source the UI displays (e.g. "Tall Woods", "dug in", "GtG").
   */
  contribute(
    target: Unit,
    position: Point,
    map: GameMap,
    observer: Unit | undefined,
  ): ContributorReading | null;
}

/** One contributor's output for one observation. */
export interface ContributorReading {
  readonly contributorId: string;
  readonly modifier: number;
  readonly label: string;
}
