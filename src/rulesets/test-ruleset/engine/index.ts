import type { Ruleset } from "../../../core/ruleset/index.js";
import { testGameFlow } from "./gameflow.js";
import { manhattanGrid } from "./substrate.js";
import { testVisionConfig } from "./vision.js";

/**
 * The test ruleset — exists to prove Phase B's abstractions are
 * genuinely per-ruleset configurable, not WWII-shaped wrappers.
 *
 * Per [mechanics-refactor.md §3 success criterion 2] + [§11 D1], the
 * test ruleset:
 *   - is NOT a fully-realized playable wargame (no UI, no full unit
 *     catalog, no terrain rules — those would be 10× the scope)
 *   - DOES differ from WWII on every axis so each axis's abstraction
 *     is exercised by something other than the bundle it was built
 *     around:
 *       Axis 1 (turn flow): Move phase declares `alternating-units`
 *         activation model instead of WWII's `whole-team`
 *       Axis 2 (vision):   sum composition + the ruleset's own
 *         intrinsic + constant contributors (not WWII's)
 *       Axis 3 (substrate): Manhattan distance instead of Euclidean
 *
 * Registered by test fixtures only — never by production code.
 * Integration tests in tests/rulesets/test-ruleset/ exercise the
 * abstractions end-to-end.
 */
export const testRuleset: Ruleset = {
  id: "test-ruleset",
  displayName: "Test Ruleset (alt-WWII)",
  gameflow: testGameFlow,
  vision: testVisionConfig,
  substrate: manhattanGrid,
};
