import type { Ruleset } from "../../../core/ruleset/index.js";

/**
 * The WWII 1/100-scale wargame ruleset — the bundle this codebase was
 * originally built around. Step 1a only defines identity; subsequent
 * Phase B step-1 sub-steps add the axis slots (gameflow, contributors,
 * terrain catalog, substrate) as each axis's interface is laid in
 * engine-core.
 *
 * Registered at app boot in src/main.tsx. Test fixtures that need this
 * bundle register it explicitly per test.
 *
 * See docs/features/v2/mechanics-refactor.md §13.1 — this file is the
 * `index.ts` for the WWII ruleset's engine half (`src/rulesets/wwii/engine/`).
 */
export const wwiiRuleset: Ruleset = {
  id: "wwii-1-100",
  displayName: "WWII 1/100",
};
