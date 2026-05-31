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
 * This interface is **intentionally minimal in step 1a** — only identity
 * and display label. Each Phase B step-1 sub-step adds the slot for its
 * axis (1c gameflow, 1d contributors + terrain catalog, 1e substrate) so
 * each axis's shape is reviewable in isolation rather than as one
 * monolithic interface. See docs/features/v2/mechanics-refactor.md
 * §13.1 for the target shape.
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
}
