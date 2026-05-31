import type { Ruleset } from "../../../core/ruleset/index.js";
import { wwiiGameFlow } from "./gameflow.js";
import { freePositionInches } from "./substrate.js";
import { wwiiVisionConfig } from "./vision.js";

/**
 * The WWII 1/100-scale wargame ruleset — the bundle this codebase was
 * originally built around. Slots filled per Phase B step-1 sub-step
 * as each axis's interface lands in engine-core:
 *   - 1a — id + displayName
 *   - 1c — gameflow (Axis 1)
 *   - 1d — vision (Axis 2: contributors + composition rule)
 *   - 1e — substrate (Axis 3: distance seam, this commit)
 *
 * All Phase B step 1 axis slots are now wired. Step 2 migrates the
 * engine to drive its existing behavior from these parallel data
 * structures.
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
  vision: wwiiVisionConfig,
  substrate: freePositionInches,
};
