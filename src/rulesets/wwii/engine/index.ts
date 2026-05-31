import type { Ruleset } from "../../../core/ruleset/index.js";
import { wwiiGameFlow } from "./gameflow.js";

/**
 * The WWII 1/100-scale wargame ruleset — the bundle this codebase was
 * originally built around. Slots are filled per Phase B step-1
 * sub-step as each axis's interface lands in engine-core:
 *   - 1a — id + displayName
 *   - 1c — gameflow (Axis 1, this commit)
 *   - 1d — contributors + terrain catalog (Axis 2) [pending]
 *   - 1e — substrate (Axis 3) [pending]
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
  gameflow: wwiiGameFlow,
};
