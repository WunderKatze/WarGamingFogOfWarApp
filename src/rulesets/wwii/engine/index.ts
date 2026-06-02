import type { Ruleset } from "../../../core/ruleset/index.js";
import { wwiiGameFlow } from "./gameflow.js";
import { freePositionInches } from "./substrate.js";
import { wwiiTerrainCatalog } from "./terrain.js";
import { wwiiUnitTypes } from "./units/index.js";
import { wwiiVisionConfig } from "./vision.js";

/**
 * The WWII 1/100-scale wargame ruleset — the bundle this codebase was
 * originally built around. Slots filled per Phase B sub-step as each
 * interface lands in engine-core:
 *   - 1a — id + displayName
 *   - 1c — gameflow (Axis 1)
 *   - 1d — vision (Axis 2: contributors + composition rule)
 *   - 1e — substrate (Axis 3: distance seam)
 *   - 4a — unitTypes (data-driven unit model, this commit)
 *
 * Step 2 drove the engine's existing behavior from these parallel
 * structures; step 4a closes the residual engine-core R3 violation by
 * routing unit construction through the registry.
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
  terrain: wwiiTerrainCatalog,
  unitTypes: wwiiUnitTypes,
};
