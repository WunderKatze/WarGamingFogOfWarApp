import type { Modifier, Point, TeamId, UnitId, UnitSize } from "../types.js";
import type { Unit } from "./Unit.js";

/**
 * Parameters Game.buildUnit hands to a unit-type entry's `construct`
 * function. Mirrors `Unit`'s base init shape plus a couple of
 * Game-resolved defaults (id, teamId, goneToGround) so each ruleset's
 * entry never has to know how Game.ts assembles them.
 *
 * `dugIn` is carried as an optional pass-through because the WWII
 * Infantry ruleset needs it; unit types whose rules don't include
 * dug-in simply ignore it. Phase B step 4b generalizes this into a
 * unit-type-supported-modifier abstraction so engine-core stops
 * carrying WWII-specific field names.
 */
export interface UnitConstructParams {
  readonly id: UnitId;
  readonly teamId: TeamId;
  readonly name: string;
  readonly position: Point;
  readonly goneToGround: boolean;
  readonly size?: UnitSize;
  readonly modifiers?: Iterable<Modifier>;
  /** WWII-specific dug-in hint; ignored by unit types that don't use it. */
  readonly dugIn?: boolean;
}

/**
 * A registered unit type within a ruleset. Each entry knows how to
 * instantiate its concrete Unit subclass and carries the display
 * metadata the UI needs.
 *
 * Phase B step 4a: lets engine-core stop importing WWII-specific
 * subclasses to build units. Game.buildUnit looks the entry up by id
 * on `ruleset.unitTypes` and delegates construction.
 *
 * See docs/features/v2/mechanics-refactor.md §13.1 (R3) and the
 * data-driven unit model.
 */
export interface UnitTypeEntry {
  /** Stable identifier; the string passed as `CreateUnitParams.type`. */
  readonly id: string;
  /** Human-readable label shown in pickers / panels. */
  readonly displayName: string;
  /** Build a Unit of this type from Game-resolved init parameters. */
  readonly construct: (params: UnitConstructParams) => Unit;
}
