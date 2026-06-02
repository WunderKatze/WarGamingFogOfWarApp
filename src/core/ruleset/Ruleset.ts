import type { GameFlow } from "../gameflow/index.js";
import type { Substrate } from "../map/substrate/index.js";
import type { TerrainCatalog } from "../map/terrainCatalog.js";
import type { UnitTypeEntry } from "../units/UnitTypeEntry.js";
import type { VisionConfig } from "../vision/index.js";

/**
 * A registered wargame ruleset.
 *
 * Phase B introduces the abstraction layer that lets this codebase support
 * more than the WWII 1/100 ruleset it was built around. A `Ruleset` is the
 * bundle every other engine concern composes through: turn flow, vision
 * contributors, terrain catalog, substrate. The WWII bundle becomes one
 * registered ruleset under this interface; future rulesets register their
 * own bundles.
 *
 * Slots are added per Phase B step-1 sub-step so each axis's shape is
 * reviewable in isolation rather than as one monolithic interface:
 *   - 1a — id + displayName
 *   - 1c — gameflow (Axis 1)
 *   - 1d — vision (Axis 2: contributors + composition rule)
 *   - 1e — substrate (Axis 3: distance seam)
 *   - 4a — unitTypes (data-driven unit model, this commit)
 *
 * See docs/features/v2/mechanics-refactor.md §13.1 for the target shape.
 */
export interface Ruleset {
  /**
   * Stable identifier used by registry lookups. Kebab-case by convention.
   * Treat this like a database primary key — once published, don't rename
   * without a migration path.
   */
  readonly id: string;
  /** Human-readable label shown in ruleset pickers and the UI chrome. */
  readonly displayName: string;
  /**
   * The ruleset's game-flow definition — phase graph + transitions.
   * Phase B step 2 migrates Game.ts to drive its state machine from this
   * definition instead of its hardcoded sequence. Validated against
   * `validateGameFlow` at registration time so malformed flows fail at
   * boot, not in mid-game.
   */
  readonly gameflow: GameFlow;
  /**
   * The ruleset's vision pipeline: ordered contributors + the
   * composition rule that pools them into effective_stealth for the §4
   * formula. Phase B step 2 migrates VisionCalculator.discover and the
   * new R4 read API to drive their math from this config.
   */
  readonly vision: VisionConfig;
  /**
   * The substrate this ruleset is played on. V2 ships only the seam —
   * every ruleset provides one and engine-core reads `distance(a, b)`
   * through it. Hex / square-grid substrate implementations are V3+
   * work (see Substrate doc and §11 D5).
   */
  readonly substrate: Substrate;
  /**
   * The ruleset's terrain catalog — polygon and wall entries keyed by
   * type. Engine consults this through `ruleset.terrain` lookups
   * instead of importing a specific ruleset's catalog file directly,
   * which keeps engine-core ruleset-agnostic (R3). May register a
   * subset of terrain kinds; unknown lookups return undefined.
   */
  readonly terrain: TerrainCatalog;
  /**
   * The ruleset's unit type catalog — entries keyed by the string id
   * that `CreateUnitParams.type` carries. Game.buildUnit consults this
   * to instantiate units without importing any ruleset's concrete Unit
   * subclasses (closes the engine-core R3 violation that Phase B step
   * 4a tracks). Must be non-empty; validated at registration time.
   */
  readonly unitTypes: Record<string, UnitTypeEntry>;
}
