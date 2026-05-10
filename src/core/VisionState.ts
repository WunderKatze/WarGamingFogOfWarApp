import type { TeamId, UnitId } from "./types.js";

/**
 * Per-turn detection state owned by GameState and operated on by VisionCalculator.
 *
 * - `individualLists[F]` is the set of enemy unit IDs that unit F has personally detected.
 * - `teamLists[T]` is the union of the individual lists of every unit on team T,
 *   plus every currently Revealed enemy unit. Maintained incrementally during the
 *   vision phase but recomputed from scratch where simpler.
 * - `revealed` is the set of unit IDs that are currently publicly known
 *   (placed on the physical table).
 */
export interface VisionState {
  individualLists: Map<UnitId, Set<UnitId>>;
  teamLists: Map<TeamId, Set<UnitId>>;
  revealed: Set<UnitId>;
}

export function createEmptyVisionState(): VisionState {
  return {
    individualLists: new Map(),
    teamLists: new Map(),
    revealed: new Set(),
  };
}
