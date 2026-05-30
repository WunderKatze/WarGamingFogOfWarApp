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
export class VisionState {
  readonly individualLists: Map<UnitId, Set<UnitId>> = new Map();
  readonly teamLists: Map<TeamId, Set<UnitId>> = new Map();
  readonly revealed: Set<UnitId> = new Set();

  /**
   * Remove every reference to a deleted unit. A unit can appear in three
   * roles and all three are dropped here:
   *   - as observer — its own individual-list entry (the map key)
   *   - as target — in every other observer's individual-list value set,
   *     and in every team-list value set
   *   - as revealed — its membership in the revealed set
   *
   * Called by Game.deleteUnit so VisionState stays consistent when a unit
   * is removed mid-game. `firedThisTurn` is on GameState, not here, and
   * is cleaned up separately by Game.
   */
  removeUnit(unitId: UnitId): void {
    this.individualLists.delete(unitId);
    this.revealed.delete(unitId);
    for (const teamList of this.teamLists.values()) {
      teamList.delete(unitId);
    }
    for (const list of this.individualLists.values()) {
      list.delete(unitId);
    }
  }
}

/**
 * Construct an empty VisionState. Equivalent to `new VisionState()`;
 * kept as a factory for call sites (mostly tests) that read more clearly
 * with a named constructor.
 */
export function createEmptyVisionState(): VisionState {
  return new VisionState();
}
