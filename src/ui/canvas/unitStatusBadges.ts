import type { Game } from "../../core/Game.js";
import type { UnitId } from "../../core/types.js";
import { Infantry } from "../../core/units/Infantry.js";

export interface UnitStatusBadgeSets {
  dugInUnitIds: ReadonlySet<UnitId>;
  goneToGroundUnitIds: ReadonlySet<UnitId>;
}

/**
 * Per docs/features/vision-rules-tweaks.md §2.4, the dug-in and Gone to
 * Ground badges are visible on every unit MapCanvas renders — own and
 * revealed enemies alike. Enemies that aren't visible to the active
 * player simply aren't passed to MapCanvas, so they don't render the
 * badges incidentally. This helper produces the two id sets to thread
 * through MapCanvas; membership is checked per-token.
 */
export function computeUnitStatusBadges(game: Game): UnitStatusBadgeSets {
  return {
    dugInUnitIds: new Set(
      game.state.units.filter((u) => u instanceof Infantry && u.dugIn).map((u) => u.id),
    ),
    goneToGroundUnitIds: new Set(
      game.state.units.filter((u) => game.isGoneToGround(u)).map((u) => u.id),
    ),
  };
}
