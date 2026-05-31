import type { UnitId } from "../../core/types.js";
import type { Unit } from "../../core/units/Unit.js";
import { useDebugContext } from "./useDebugContext.js";
import { useGameContext } from "./useGameContext.js";

/**
 * Units the active player sees right now: their own team's units, plus
 * enemies on the active team's vision team-list. In debug mode
 * (showAllUnits), returns every unit on the map regardless of vision.
 *
 * Reads `useGameContext` and `useDebugContext` internally so callers
 * just call `useVisibleUnits()` with no parameters. Extracted from three
 * views (MoveView, FireDeclareView, AddRemoveUnitsView) where the same
 * definition was duplicated word-for-word — see
 * docs/features/v2/code-health-pass-ui.md §2 U1.
 *
 * Note: this is a display filter, not the vision rule itself. The
 * `visionState.teamLists` it reads has already been computed by the
 * engine's vision phase; this hook just shapes the list for rendering.
 */
export function useVisibleUnits(): Unit[] {
  const { game } = useGameContext();
  const { showAllUnits } = useDebugContext();

  if (showAllUnits) return [...game.state.units];
  const active = game.state.getActivePlayer();
  const teamList = game.state.visionState.teamLists.get(active) ?? new Set<UnitId>();
  return game.state.units.filter(
    (u) => u.teamId === active || teamList.has(u.id),
  );
}
